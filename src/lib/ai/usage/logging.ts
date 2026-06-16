import type { AIUsageEntry } from '../types'

// Phase 18: placeholder — no database writes yet.
// Phase 19 will wire a Supabase service role client and insert into ai_usage_logs.
// writeUsageLog is fire-and-forget; a failed log must never break the AI response.
export async function writeUsageLog(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _entry: AIUsageEntry,
): Promise<void> {
  // TODO Phase 19: insert _entry into ai_usage_logs via service role client.
  // Do not import a service role client here in Phase 18.
}
