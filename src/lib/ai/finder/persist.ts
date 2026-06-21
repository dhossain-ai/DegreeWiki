// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
// Uses the Supabase service role client to write ai_finder_results and
// ai_finder_program_matches — both tables have no authenticated INSERT
// policy by design; all writes are server-only via service role.
import { createServiceClient } from '../../supabase/service'
import type { AIRuntimeEnv } from '../types'
import { sanitizeAIExplanation } from './sanitize'

export interface FinderPersistInput {
  studentProfileId: string
  shortlistCount: number
  aiExplanation: string | null
  aiModelUsed: string | null
  promptTokenCount: number
  completionTokenCount: number
  matches: Array<{
    programId: string
    rank: number
    score: number
    matchReasons: string[]
    warnings: string[]
  }>
}

// persistFinderResult inserts one ai_finder_results row and up to 20
// ai_finder_program_matches rows using the service role.
//
// Returns the created result UUID on success, or null on any failure.
// Never throws — all failures are logged server-side only.
export async function persistFinderResult(
  input: FinderPersistInput,
  env: AIRuntimeEnv,
): Promise<string | null> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    return null
  }

  const serviceClient = createServiceClient(key)

  const { data: resultRow, error: resultError } = await serviceClient
    .from('ai_finder_results')
    .insert({
      student_profile_id:     input.studentProfileId,
      result_status:          'complete',
      shortlist_count:        input.shortlistCount,
      ai_explanation:         input.aiExplanation,
      ai_model_used:          input.aiModelUsed,
      prompt_token_count:     input.promptTokenCount,
      completion_token_count: input.completionTokenCount,
      expires_at:             null,
    })
    .select('id')
    .single()

  if (resultError || !resultRow?.id) {
    console.error('ai_finder_results insert failed:', resultError?.message ?? 'no id returned')
    return null
  }

  const resultId = resultRow.id as string

  const matchRows = input.matches.map((m) => ({
    ai_finder_result_id: resultId,
    program_id:          m.programId,
    rank:                m.rank,
    score:               m.score,
    match_reasons:       m.matchReasons,
    warnings:            m.warnings,
  }))

  const { error: matchError } = await serviceClient
    .from('ai_finder_program_matches')
    .insert(matchRows)

  if (matchError) {
    console.error('ai_finder_program_matches insert failed:', matchError.message)
    await serviceClient
      .from('ai_finder_results')
      .update({ result_status: 'failed' })
      .eq('id', resultId)
    return null
  }

  return resultId
}

export interface FinderSummaryTokenUsage {
  promptTokens?: number
  completionTokens?: number
}

// updateFinderSummary stores an AI explanation onto an existing finder result
// using the service role. Called by the async summary endpoint after the
// rule-based result row already exists. Text is sanitized here so the stored
// value is always safe plain text regardless of the caller.
//
// A summary-generation failure must NOT mark the result failed — this helper
// only ever writes ai_explanation / ai_model_used / token counts. It never
// touches result_status. Returns true on success, false on any failure.
// Never throws; raw DB errors are logged server-side only, never returned.
export async function updateFinderSummary(
  resultId: string,
  text: string,
  model: string | null,
  tokenUsage: FinderSummaryTokenUsage | undefined,
  env: AIRuntimeEnv,
): Promise<boolean> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    return false
  }

  const cleaned = sanitizeAIExplanation(text)
  if (!cleaned) {
    return false
  }

  const update: Record<string, unknown> = {
    ai_explanation: cleaned,
  }
  if (model) {
    update.ai_model_used = model
  }
  if (tokenUsage?.promptTokens != null) {
    update.prompt_token_count = tokenUsage.promptTokens
  }
  if (tokenUsage?.completionTokens != null) {
    update.completion_token_count = tokenUsage.completionTokens
  }

  const serviceClient = createServiceClient(key)

  const { error } = await serviceClient
    .from('ai_finder_results')
    .update(update)
    .eq('id', resultId)

  if (error) {
    console.error('updateFinderSummary update failed:', error.message)
    return false
  }

  return true
}
