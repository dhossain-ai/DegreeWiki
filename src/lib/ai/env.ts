import type { AIRuntimeEnv } from './types'

// Extract AI env vars from Cloudflare Workers runtime locals.
//
// Source priority (highest to lowest):
//   1. locals.runtime.env — Cloudflare Workers runtime bindings.
//      In dev: populated from .dev.vars + wrangler.toml [vars] via getPlatformProxy.
//      In production: populated by Cloudflare Workers secrets/env vars.
//   2. import.meta.env — Vite/Astro SSR injection.
//      Populated at SSR transform time from .env.local in `astro dev`.
//      May not be reliable in all Cloudflare adapter configurations.
//   3. process.env — Node.js process environment.
//      Available in `astro dev` (Node.js); undefined in Cloudflare Workers runtime.
//      Acts as a last-resort fallback for the `astro dev` case.
//
// In `astro dev` (npm run dev): .env.local is the primary source.
// In `wrangler pages dev`: .dev.vars is the primary source.
// In production Cloudflare: Cloudflare secrets set via wrangler secret put.
//
// Call this once per server endpoint/page, then pass the result to callAI().
export function getAIEnv(locals: Record<string, unknown>): AIRuntimeEnv {
  const runtime = locals.runtime as { env?: Record<string, string | undefined> } | undefined
  const raw = runtime?.env ?? {}

  // Safe process.env reference for the Node.js `astro dev` context.
  // In Cloudflare Workers, process is undefined or has no user env vars.
  const nodeEnv = typeof process !== 'undefined' ? process.env : {} as Record<string, string | undefined>
  const shouldLogEnvPresence =
    import.meta.env.DEV
    && (raw['DEBUG_AI_ENV'] === 'true'
      || import.meta.env.DEBUG_AI_ENV === 'true'
      || nodeEnv['DEBUG_AI_ENV'] === 'true')

  const result: AIRuntimeEnv = {
    AI_PROVIDER:               raw['AI_PROVIDER']               ?? import.meta.env.AI_PROVIDER               ?? nodeEnv['AI_PROVIDER'],
    AI_MODEL:                  raw['AI_MODEL']                  ?? import.meta.env.AI_MODEL                  ?? nodeEnv['AI_MODEL'],
    AI_GATEWAY_MASTER_KEY:     raw['AI_GATEWAY_MASTER_KEY']     ?? import.meta.env.AI_GATEWAY_MASTER_KEY     ?? nodeEnv['AI_GATEWAY_MASTER_KEY'],
    AI_GATEWAY_ACTIVE_KEY_VERSION:
                               raw['AI_GATEWAY_ACTIVE_KEY_VERSION']
                                                                  ?? import.meta.env.AI_GATEWAY_ACTIVE_KEY_VERSION
                                                                  ?? nodeEnv['AI_GATEWAY_ACTIVE_KEY_VERSION'],
    AI_GATEWAY_ENV_FALLBACK_ENABLED:
                               raw['AI_GATEWAY_ENV_FALLBACK_ENABLED']
                                                                  ?? import.meta.env.AI_GATEWAY_ENV_FALLBACK_ENABLED
                                                                  ?? nodeEnv['AI_GATEWAY_ENV_FALLBACK_ENABLED'],
    GEMINI_API_KEY:            raw['GEMINI_API_KEY']            ?? import.meta.env.GEMINI_API_KEY            ?? nodeEnv['GEMINI_API_KEY'],
    OPENROUTER_API_KEY:        raw['OPENROUTER_API_KEY']        ?? import.meta.env.OPENROUTER_API_KEY        ?? nodeEnv['OPENROUTER_API_KEY'],
    AI_RATE_LIMIT_ANON_DAILY:  raw['AI_RATE_LIMIT_ANON_DAILY']  ?? import.meta.env.AI_RATE_LIMIT_ANON_DAILY  ?? nodeEnv['AI_RATE_LIMIT_ANON_DAILY'],
    AI_RATE_LIMIT_USER_DAILY:  raw['AI_RATE_LIMIT_USER_DAILY']  ?? import.meta.env.AI_RATE_LIMIT_USER_DAILY  ?? nodeEnv['AI_RATE_LIMIT_USER_DAILY'],
    SUPABASE_SERVICE_ROLE_KEY: raw['SUPABASE_SERVICE_ROLE_KEY'] ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? nodeEnv['SUPABASE_SERVICE_ROLE_KEY'],
  }

  if (shouldLogEnvPresence) {
    const keys = [
      'AI_PROVIDER', 'AI_MODEL',
      'AI_GATEWAY_MASTER_KEY', 'AI_GATEWAY_ACTIVE_KEY_VERSION', 'AI_GATEWAY_ENV_FALLBACK_ENABLED',
      'GEMINI_API_KEY', 'OPENROUTER_API_KEY',
      'AI_RATE_LIMIT_ANON_DAILY', 'AI_RATE_LIMIT_USER_DAILY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ] as const
    const imEnv = import.meta.env as Record<string, unknown>
    const report: Record<string, { runtime_env: boolean; import_meta_env: boolean; process_env: boolean; resolved: boolean }> = {}
    for (const key of keys) {
      report[key] = {
        runtime_env:     !!raw[key],
        import_meta_env: !!imEnv[key],
        process_env:     !!(nodeEnv as Record<string, unknown>)[key],
        resolved:        !!(result as Record<string, unknown>)[key],
      }
    }
    console.log('[AI env] key presence (true=set, false=missing):', JSON.stringify(report, null, 2))
  }

  return result
}
