// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
// The Supabase service role key bypasses all Row Level Security policies.
// Approved server-only AI operations that require the service role:
//   - AI usage logging (ai_usage_logs — no authenticated INSERT)
//   - Rate-limit enforcement (ai_usage_logs SELECT count)
//   - Finder result persistence (ai_finder_results, ai_finder_program_matches — no authenticated INSERT)
//   - Chat conversation/message persistence (ai_conversations INSERT, ai_messages — no authenticated INSERT)
import { createClient } from '@supabase/supabase-js'

export function createServiceClient(serviceRoleKey: string) {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}
