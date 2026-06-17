import type { AIRuntimeEnv } from './types'

// Extract AI env vars from Cloudflare Workers runtime locals.
// In @astrojs/cloudflare, bindings and secrets are available at
// locals.runtime.env — not import.meta.env and not process.env.
// Safe cast is required because src/env.d.ts does not exist in this project.
// Call this once per server endpoint/page, then pass the result to callAI().
export function getAIEnv(locals: Record<string, unknown>): AIRuntimeEnv {
  const runtime = locals.runtime as { env?: Record<string, string | undefined> } | undefined
  const raw = runtime?.env ?? {}
  return {
    AI_PROVIDER:              raw['AI_PROVIDER'],
    AI_MODEL:                 raw['AI_MODEL'],
    GEMINI_API_KEY:           raw['GEMINI_API_KEY'],
    AI_RATE_LIMIT_ANON_DAILY: raw['AI_RATE_LIMIT_ANON_DAILY'],
    AI_RATE_LIMIT_USER_DAILY: raw['AI_RATE_LIMIT_USER_DAILY'],
  }
}
