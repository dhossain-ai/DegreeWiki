import type { SupabaseClient } from '@supabase/supabase-js'
import type { AIRuntimeEnv, AISessionType } from '../types'
import { createServiceClient } from '../../supabase/service'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reason?: 'limit_exceeded' | 'service_unavailable'
}

export interface RateLimitOpts {
  serviceClient: SupabaseClient | null
  dailyLimit: number
}

// checkRateLimit enforces a per-user daily AI call limit via ai_usage_logs.
//
// Fail-closed: any condition that prevents an authoritative count (no userId,
// no service client, query error) returns allowed=false so Gemini is not called.
//
// Count is across all session_type values for the user on the current UTC day.
// Anonymous rate limiting is deferred — no anonymous AI calls exist yet.
export async function checkRateLimit(
  userId: string | null,
  _sessionType: AISessionType,
  opts: RateLimitOpts,
): Promise<RateLimitResult> {
  if (userId === null) {
    return { allowed: false, remaining: 0, reason: 'service_unavailable' }
  }

  if (opts.serviceClient === null) {
    return { allowed: false, remaining: 0, reason: 'service_unavailable' }
  }

  const now = new Date()
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ))

  const { count, error } = await opts.serviceClient
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error('ai rate limit query failed:', error.message)
    return { allowed: false, remaining: 0, reason: 'service_unavailable' }
  }

  const used = count ?? 0
  if (used >= opts.dailyLimit) {
    return { allowed: false, remaining: 0, reason: 'limit_exceeded' }
  }

  return { allowed: true, remaining: opts.dailyLimit - used }
}

// checkAIRateLimit is a server-only convenience wrapper used by API routes.
// It creates the service role client from AIRuntimeEnv internally, so the
// caller does not need to read service-role secrets directly.
// API routes under src/pages/ must use this function rather than calling
// checkRateLimit directly with a manually constructed service client.
export async function checkAIRateLimit(
  userId: string | null,
  sessionType: AISessionType,
  env: AIRuntimeEnv,
): Promise<RateLimitResult> {
  const serviceClient = env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(env.SUPABASE_SERVICE_ROLE_KEY)
    : null
  const dailyLimit = Math.max(1, parseInt(env.AI_RATE_LIMIT_USER_DAILY ?? '20', 10) || 20)
  return checkRateLimit(userId, sessionType, { serviceClient, dailyLimit })
}
