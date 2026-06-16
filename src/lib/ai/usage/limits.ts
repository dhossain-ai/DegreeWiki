import type { AISessionType } from '../types'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

// Phase 18: placeholder — no enforcement yet.
// Phase 19 will query ai_usage_logs to count today's calls per user/session
// and compare against env var limits:
//   AI_RATE_LIMIT_ANON_DAILY  (default 5)
//   AI_RATE_LIMIT_USER_DAILY  (default 20)
// If env vars are absent, the implementation should fall back to the
// conservative defaults to prevent runaway API costs.
export async function checkRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sessionType: AISessionType,
): Promise<RateLimitResult> {
  // TODO Phase 19: query ai_usage_logs for today's count and enforce limits.
  return { allowed: true, remaining: 99 }
}
