import type { AIRuntimeEnv, AIUsageAudienceTier, AIUsagePeriod, AIUseCase } from '../types'
import { createAIGatewayServiceClient } from './store'
import { getLegacyUsageFallbackDefaults } from '../usage/policies'

export interface AdminAIUsageLimitPolicyRecord {
  id: string
  useCase: AIUseCase
  audienceTier: AIUsageAudienceTier
  period: AIUsagePeriod
  maxCalls: number
  maxTokens: number | null
  isEnabled: boolean
  notes: string | null
  createdByUserId: string | null
  updatedByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminAIUsageFallbackDefaults {
  legacyUserDaily: number
  legacyAnonymousDaily: number
  behavior: 'shared_combined_daily'
}

export interface SuggestedAIUsageLimitPolicy {
  useCase: AIUseCase
  audienceTier: AIUsageAudienceTier
  period: AIUsagePeriod
  maxCalls: number
  notes: string
}

export type AdminAIUsageLimitMutationResult =
  | { status: 'ok'; policy?: AdminAIUsageLimitPolicyRecord }
  | { status: 'duplicate' | 'not_found' | 'save_failed' }

const SUGGESTED_USAGE_LIMIT_POLICIES: SuggestedAIUsageLimitPolicy[] = [
  {
    useCase: 'chat_answer',
    audienceTier: 'anonymous',
    period: 'daily',
    maxCalls: 0,
    notes: 'Keep anonymous site chat on static or reviewed preset answers only.',
  },
  {
    useCase: 'chat_answer',
    audienceTier: 'authenticated_free',
    period: 'daily',
    maxCalls: 10,
    notes: 'Starter limit for logged-in public and saved-result chat.',
  },
  {
    useCase: 'fit_finder_summary',
    audienceTier: 'anonymous',
    period: 'daily',
    maxCalls: 0,
    notes: 'Anonymous finder summaries stay disabled unless a future AI flow is added.',
  },
  {
    useCase: 'fit_finder_summary',
    audienceTier: 'authenticated_free',
    period: 'daily',
    maxCalls: 10,
    notes: 'Starter limit for saved Fit Finder explanation calls.',
  },
  {
    useCase: 'admin_article_draft',
    audienceTier: 'admin',
    period: 'daily',
    maxCalls: 30,
    notes: 'Starter editorial-only quota for the article assistant.',
  },
  {
    useCase: 'admin_article_draft',
    audienceTier: 'anonymous',
    period: 'daily',
    maxCalls: 0,
    notes: 'Anonymous access should remain disabled.',
  },
  {
    useCase: 'admin_article_draft',
    audienceTier: 'authenticated_free',
    period: 'daily',
    maxCalls: 0,
    notes: 'Non-admin product users should not use the admin article assistant.',
  },
] as const

function mapPolicy(row: any): AdminAIUsageLimitPolicyRecord | null {
  if (!row?.id || !row?.use_case || !row?.audience_tier || !row?.period) return null
  return {
    id: row.id,
    useCase: row.use_case,
    audienceTier: row.audience_tier,
    period: row.period,
    maxCalls: row.max_calls,
    maxTokens: row.max_tokens ?? null,
    isEnabled: row.is_enabled === true,
    notes: row.notes ?? null,
    createdByUserId: row.created_by_user_id ?? null,
    updatedByUserId: row.updated_by_user_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isDuplicateError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505'
}

export function getSuggestedUsageLimitPolicies(): SuggestedAIUsageLimitPolicy[] {
  return [...SUGGESTED_USAGE_LIMIT_POLICIES]
}

export function getAdminUsageFallbackDefaults(env: AIRuntimeEnv): AdminAIUsageFallbackDefaults {
  const defaults = getLegacyUsageFallbackDefaults(env)
  return {
    legacyUserDaily: defaults.userDaily,
    legacyAnonymousDaily: defaults.anonymousDaily,
    behavior: 'shared_combined_daily',
  }
}

export async function loadAdminUsageLimitPolicies(
  env: AIRuntimeEnv,
): Promise<AdminAIUsageLimitPolicyRecord[]> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return []

  const { data, error } = await serviceClient
    .from('ai_usage_limit_policies')
    .select(`
      id,
      use_case,
      audience_tier,
      period,
      max_calls,
      max_tokens,
      is_enabled,
      notes,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .order('use_case', { ascending: true })
    .order('audience_tier', { ascending: true })
    .order('period', { ascending: true })

  if (error) {
    console.error('ai usage limit admin read failed:', error.message)
    return []
  }

  return (data ?? [])
    .map(mapPolicy)
    .filter((row): row is AdminAIUsageLimitPolicyRecord => row !== null)
}

export async function createAdminUsageLimitPolicy(
  input: {
    useCase: AIUseCase
    audienceTier: AIUsageAudienceTier
    period: AIUsagePeriod
    maxCalls: number
    maxTokens: number | null
    isEnabled: boolean
    notes: string | null
    actorUserId: string
  },
  env: AIRuntimeEnv,
): Promise<AdminAIUsageLimitMutationResult> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return { status: 'save_failed' }

  const { data, error } = await serviceClient
    .from('ai_usage_limit_policies')
    .insert({
      use_case: input.useCase,
      audience_tier: input.audienceTier,
      period: input.period,
      max_calls: input.maxCalls,
      max_tokens: input.maxTokens,
      is_enabled: input.isEnabled,
      notes: input.notes,
      created_by_user_id: input.actorUserId,
      updated_by_user_id: input.actorUserId,
    })
    .select(`
      id,
      use_case,
      audience_tier,
      period,
      max_calls,
      max_tokens,
      is_enabled,
      notes,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error('ai usage limit admin create failed:', error.message)
    return { status: isDuplicateError(error) ? 'duplicate' : 'save_failed' }
  }

  const policy = mapPolicy(data)
  return policy ? { status: 'ok', policy } : { status: 'save_failed' }
}

export async function updateAdminUsageLimitPolicy(
  input: {
    id: string
    useCase: AIUseCase
    audienceTier: AIUsageAudienceTier
    period: AIUsagePeriod
    maxCalls: number
    maxTokens: number | null
    isEnabled: boolean
    notes: string | null
    actorUserId: string
  },
  env: AIRuntimeEnv,
): Promise<AdminAIUsageLimitMutationResult> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return { status: 'save_failed' }

  const { data, error } = await serviceClient
    .from('ai_usage_limit_policies')
    .update({
      use_case: input.useCase,
      audience_tier: input.audienceTier,
      period: input.period,
      max_calls: input.maxCalls,
      max_tokens: input.maxTokens,
      is_enabled: input.isEnabled,
      notes: input.notes,
      updated_by_user_id: input.actorUserId,
    })
    .eq('id', input.id)
    .select(`
      id,
      use_case,
      audience_tier,
      period,
      max_calls,
      max_tokens,
      is_enabled,
      notes,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .maybeSingle()

  if (error) {
    console.error('ai usage limit admin update failed:', error.message)
    return { status: isDuplicateError(error) ? 'duplicate' : 'save_failed' }
  }

  if (!data) return { status: 'not_found' }
  const policy = mapPolicy(data)
  return policy ? { status: 'ok', policy } : { status: 'save_failed' }
}

export async function setAdminUsageLimitPolicyEnabled(
  input: {
    id: string
    isEnabled: boolean
    actorUserId: string
  },
  env: AIRuntimeEnv,
): Promise<AdminAIUsageLimitMutationResult> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return { status: 'save_failed' }

  const { data, error } = await serviceClient
    .from('ai_usage_limit_policies')
    .update({
      is_enabled: input.isEnabled,
      updated_by_user_id: input.actorUserId,
    })
    .eq('id', input.id)
    .select(`
      id,
      use_case,
      audience_tier,
      period,
      max_calls,
      max_tokens,
      is_enabled,
      notes,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .maybeSingle()

  if (error) {
    console.error('ai usage limit admin toggle failed:', error.message)
    return { status: 'save_failed' }
  }

  if (!data) return { status: 'not_found' }
  const policy = mapPolicy(data)
  return policy ? { status: 'ok', policy } : { status: 'save_failed' }
}

export async function deleteAdminUsageLimitPolicy(
  id: string,
  env: AIRuntimeEnv,
): Promise<AdminAIUsageLimitMutationResult> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return { status: 'save_failed' }

  const { error, count } = await serviceClient
    .from('ai_usage_limit_policies')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    console.error('ai usage limit admin delete failed:', error.message)
    return { status: 'save_failed' }
  }

  if ((count ?? 0) === 0) return { status: 'not_found' }
  return { status: 'ok' }
}
