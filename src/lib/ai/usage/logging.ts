import type { SupabaseClient } from '@supabase/supabase-js'
import type { AIUsageEntry } from '../types'

// writeUsageLog inserts one row into ai_usage_logs via the service role client.
//
// Fire-and-forget contract: this function must never throw. A logging failure
// must never interrupt or affect the AI response returned to the caller.
//
// Only session metadata and token counts are logged. Prompt text, AI response
// text, profile IDs, emails, session tokens, and raw profile data are never
// included in the log entry.
export async function writeUsageLog(
  entry: AIUsageEntry,
  serviceClient: SupabaseClient | null,
): Promise<void> {
  if (serviceClient === null) {
    return
  }

  const { error } = await serviceClient
    .from('ai_usage_logs')
    .insert({
      user_id:              entry.userId,
      anonymous_session_id: entry.anonymousSessionId ?? null,
      session_type:         entry.sessionType,
      use_case:             entry.useCase,
      audience_tier:        entry.audienceTier,
      tokens_used:          entry.tokensUsed,
      model_used:           entry.modelUsed,
      cost_estimate_usd:    entry.costEstimateUsd ?? null,
    })

  if (error) {
    console.error('ai_usage_logs write failed:', error.message)
  }
}
