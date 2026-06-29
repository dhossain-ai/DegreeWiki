import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AIRuntimeEnv,
  AISessionType,
  AIUsageAudienceTier,
  AIUsagePeriod,
  AIUseCase,
} from '../types'
import { createServiceClient } from '../../supabase/service'
import {
  resolveAIUsageAudienceTier,
  resolveAIUsageLimit,
  type UsageLimitSource,
} from './policies'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  used: number
  period: AIUsagePeriod
  source: UsageLimitSource
  audienceTier: AIUsageAudienceTier
  reason?: 'limit_exceeded' | 'service_unavailable'
}

export interface RateLimitRequest {
  userId: string | null
  sessionType: AISessionType
  useCase: AIUseCase
  audienceTier?: AIUsageAudienceTier
  anonymousSessionId?: string | null
}

export interface RateLimitOpts {
  serviceClient: SupabaseClient | null
  env: AIRuntimeEnv
}

export async function checkRateLimit(
  request: RateLimitRequest,
  opts: RateLimitOpts,
): Promise<RateLimitResult> {
  const audienceTier = resolveAIUsageAudienceTier({
    userId: request.userId,
    anonymousSessionId: request.anonymousSessionId,
    audienceTier: request.audienceTier,
  })
  const resolved = await resolveAIUsageLimit({
    serviceClient: opts.serviceClient,
    env: opts.env,
    useCase: request.useCase,
    userId: request.userId,
    anonymousSessionId: request.anonymousSessionId,
    audienceTier: request.audienceTier,
  })

  return {
    ...resolved,
    audienceTier,
  }
}

// checkAIRateLimit is a server-only convenience wrapper used by API routes.
// It creates the service role client from AIRuntimeEnv internally, so the
// caller does not need to read service-role secrets directly.
// API routes under src/pages/ must use this function rather than calling
// checkRateLimit directly with a manually constructed service client.
export async function checkAIRateLimit(
  request: RateLimitRequest,
  env: AIRuntimeEnv,
): Promise<RateLimitResult> {
  const serviceClient = env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(env.SUPABASE_SERVICE_ROLE_KEY)
    : null
  return checkRateLimit(request, { serviceClient, env })
}
