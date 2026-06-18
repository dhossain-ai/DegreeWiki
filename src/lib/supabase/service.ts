// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
// The Supabase service role key bypasses all Row Level Security policies.
// This module exists solely to support server-side AI usage logging and
// rate-limit enforcement via ai_usage_logs, which has no authenticated
// INSERT or SELECT policy for regular users.
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
