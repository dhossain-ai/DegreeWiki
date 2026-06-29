import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AIRuntimeEnv,
  AIUsageAudienceTier,
  AIUsagePeriod,
  AIUseCase,
} from '../types'

export type UsageLimitSource =
  | 'db_policy'
  | 'env_fallback'
  | 'conservative_default'

export interface UsageLimitResolution {
  allowed: boolean
  reason?: 'limit_exceeded' | 'service_unavailable'
  limit: number
  used: number
  remaining: number
  period: AIUsagePeriod
  source: UsageLimitSource
}

export interface ResolveUsageLimitInput {
  serviceClient: SupabaseClient | null
  env: AIRuntimeEnv
  useCase: AIUseCase
  userId: string | null
  anonymousSessionId?: string | null
  audienceTier?: AIUsageAudienceTier
}

interface UsageLimitPolicyRow {
  use_case: AIUseCase
  audience_tier: AIUsageAudienceTier
  period: AIUsagePeriod
  max_calls: number
}

export const LEGACY_AI_LIMIT_DEFAULTS = {
  userDaily: 20,
  anonymousDaily: 5,
} as const

function parseLegacyDailyLimit(raw: string | undefined, fallback: number): number {
  const parsed = parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback
  return Math.max(1, parsed)
}

export function getLegacyUsageFallbackDefaults(env: AIRuntimeEnv) {
  return {
    userDaily: parseLegacyDailyLimit(env.AI_RATE_LIMIT_USER_DAILY, LEGACY_AI_LIMIT_DEFAULTS.userDaily),
    anonymousDaily: parseLegacyDailyLimit(env.AI_RATE_LIMIT_ANON_DAILY, LEGACY_AI_LIMIT_DEFAULTS.anonymousDaily),
  }
}

export function resolveAIUsageAudienceTier(input: {
  userId: string | null
  anonymousSessionId?: string | null
  audienceTier?: AIUsageAudienceTier
}): AIUsageAudienceTier {
  if (input.audienceTier) return input.audienceTier
  if (input.userId) return 'authenticated_free'
  return 'anonymous'
}

function startOfUtcWindow(period: AIUsagePeriod, now: Date): Date {
  if (period === 'monthly') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }

  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ))
}

async function loadEnabledPolicies(
  serviceClient: SupabaseClient,
  useCase: AIUseCase,
  audienceTier: AIUsageAudienceTier,
): Promise<UsageLimitPolicyRow[] | null> {
  const { data, error } = await serviceClient
    .from('ai_usage_limit_policies')
    .select('use_case, audience_tier, period, max_calls')
    .eq('use_case', useCase)
    .eq('audience_tier', audienceTier)
    .eq('is_enabled', true)
    .order('period', { ascending: true })

  if (error) {
    console.error('ai usage limit policies read failed:', error.message)
    return null
  }

  return (data ?? []) as UsageLimitPolicyRow[]
}

async function countPolicyUsage(
  serviceClient: SupabaseClient,
  input: {
    useCase: AIUseCase
    audienceTier: AIUsageAudienceTier
    userId: string | null
    anonymousSessionId?: string | null
    period: AIUsagePeriod
  },
): Promise<number | null> {
  const startedAt = startOfUtcWindow(input.period, new Date()).toISOString()
  let query = serviceClient
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('use_case', input.useCase)
    .eq('audience_tier', input.audienceTier)
    .gte('created_at', startedAt)

  if (input.userId) {
    query = query.eq('user_id', input.userId)
  } else if (input.anonymousSessionId) {
    query = query.eq('anonymous_session_id', input.anonymousSessionId)
  } else {
    return null
  }

  const { count, error } = await query
  if (error) {
    console.error('ai usage policy count failed:', error.message)
    return null
  }

  return count ?? 0
}

async function resolveLegacyEnvFallback(
  input: ResolveUsageLimitInput,
  audienceTier: AIUsageAudienceTier,
): Promise<UsageLimitResolution> {
  if (input.serviceClient === null) {
    return {
      allowed: false,
      reason: 'service_unavailable',
      limit: 0,
      used: 0,
      remaining: 0,
      period: 'daily',
      source: 'conservative_default',
    }
  }

  const defaults = getLegacyUsageFallbackDefaults(input.env)
  const dailyLimit = audienceTier === 'anonymous'
    ? defaults.anonymousDaily
    : defaults.userDaily
  const todayStart = startOfUtcWindow('daily', new Date()).toISOString()

  let query = input.serviceClient
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart)

  if (input.userId) {
    query = query.eq('user_id', input.userId)
  } else if (input.anonymousSessionId) {
    query = query.eq('anonymous_session_id', input.anonymousSessionId)
  } else {
    return {
      allowed: false,
      reason: 'service_unavailable',
      limit: 0,
      used: 0,
      remaining: 0,
      period: 'daily',
      source: 'conservative_default',
    }
  }

  const { count, error } = await query
  if (error) {
    console.error('ai legacy rate limit query failed:', error.message)
    return {
      allowed: false,
      reason: 'service_unavailable',
      limit: 0,
      used: 0,
      remaining: 0,
      period: 'daily',
      source: 'conservative_default',
    }
  }

  const used = count ?? 0
  if (used >= dailyLimit) {
    return {
      allowed: false,
      reason: 'limit_exceeded',
      limit: dailyLimit,
      used,
      remaining: 0,
      period: 'daily',
      source: 'env_fallback',
    }
  }

  return {
    allowed: true,
    limit: dailyLimit,
    used,
    remaining: dailyLimit - used,
    period: 'daily',
    source: 'env_fallback',
  }
}

export async function resolveAIUsageLimit(
  input: ResolveUsageLimitInput,
): Promise<UsageLimitResolution> {
  const audienceTier = resolveAIUsageAudienceTier({
    userId: input.userId,
    anonymousSessionId: input.anonymousSessionId,
    audienceTier: input.audienceTier,
  })

  if (input.serviceClient === null) {
    return resolveLegacyEnvFallback(input, audienceTier)
  }

  const policies = await loadEnabledPolicies(input.serviceClient, input.useCase, audienceTier)
  if (policies === null || policies.length === 0) {
    return resolveLegacyEnvFallback(input, audienceTier)
  }

  let tightestAllowed: UsageLimitResolution | null = null

  for (const policy of policies) {
    const used = await countPolicyUsage(input.serviceClient, {
      useCase: input.useCase,
      audienceTier,
      userId: input.userId,
      anonymousSessionId: input.anonymousSessionId,
      period: policy.period,
    })

    if (used === null) {
      return resolveLegacyEnvFallback(input, audienceTier)
    }

    if (used >= policy.max_calls) {
      return {
        allowed: false,
        reason: 'limit_exceeded',
        limit: policy.max_calls,
        used,
        remaining: 0,
        period: policy.period,
        source: 'db_policy',
      }
    }

    const current: UsageLimitResolution = {
      allowed: true,
      limit: policy.max_calls,
      used,
      remaining: policy.max_calls - used,
      period: policy.period,
      source: 'db_policy',
    }

    if (!tightestAllowed || current.remaining < tightestAllowed.remaining) {
      tightestAllowed = current
    }
  }

  return tightestAllowed ?? {
    allowed: false,
    reason: 'service_unavailable',
    limit: 0,
    used: 0,
    remaining: 0,
    period: 'daily',
    source: 'conservative_default',
  }
}
