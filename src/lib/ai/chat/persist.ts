// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
//
// Chat conversation and message persistence helpers.
// Uses the Supabase service role client to write to ai_conversations and ai_messages,
// both of which have no authenticated browser INSERT policy by design.
//
// All functions are fail-safe: they log errors server-side and return null/false
// rather than throwing. A persistence failure must never crash the calling page.
import { createServiceClient } from '../../supabase/service'
import type { AIRuntimeEnv, ContextUsedSnapshot } from '../types'

// getOrCreateConversation finds the existing ai_conversations row for a
// (userId, finderResultId) pair, or creates one if it does not exist yet.
//
// The partial unique index idx_ai_conversations_unique_user_finder_result
// (user_id, ai_finder_result_id WHERE ai_finder_result_id IS NOT NULL)
// enforces one conversation per user + saved result. On a race between two
// concurrent first-message requests, the INSERT will fail with a unique
// constraint violation (code 23505); this function retries the SELECT in
// that case and returns the existing row.
//
// Returns the conversation UUID on success, or null on any unrecoverable failure.
export async function getOrCreateConversation(
  params: { userId: string; finderResultId: string },
  env: AIRuntimeEnv,
): Promise<string | null> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null

  const serviceClient = createServiceClient(key)

  // Try to find an existing conversation first.
  const { data: existing, error: selectError } = await serviceClient
    .from('ai_conversations')
    .select('id')
    .eq('user_id', params.userId)
    .eq('ai_finder_result_id', params.finderResultId)
    .maybeSingle()

  if (selectError) {
    console.error('chat persist: ai_conversations select failed:', selectError.message)
    return null
  }

  if (existing?.id) return existing.id as string

  // No existing conversation — attempt to create one.
  const { data: created, error: insertError } = await serviceClient
    .from('ai_conversations')
    .insert({
      user_id:              params.userId,
      ai_finder_result_id:  params.finderResultId,
      session_type:         'chat',
      expires_at:           null,
    })
    .select('id')
    .single()

  if (!insertError && created?.id) return created.id as string

  // Unique constraint violation (23505) means a concurrent request already created
  // the conversation. Retry the SELECT to return the existing row.
  if (insertError?.code === '23505') {
    const { data: retry, error: retryError } = await serviceClient
      .from('ai_conversations')
      .select('id')
      .eq('user_id', params.userId)
      .eq('ai_finder_result_id', params.finderResultId)
      .maybeSingle()

    if (retryError) {
      console.error('chat persist: ai_conversations retry select failed:', retryError.message)
      return null
    }
    return retry?.id ? (retry.id as string) : null
  }

  console.error('chat persist: ai_conversations insert failed:', insertError?.message)
  return null
}

export interface PersistChatTurnParams {
  conversationId: string
  userMessage: string
  assistantText: string
  modelUsed: string
  promptTokens: number
  completionTokens: number
  contextUsed: ContextUsedSnapshot
}

// persistChatTurn writes one complete chat turn to ai_messages:
//   1. User message row (no context_used, no token counts)
//   2. Assistant message row (context_used snapshot, token counts, model)
//   3. Updates ai_conversations.last_message_at
//
// If either message INSERT fails, the function returns false.
// If only the last_message_at update fails, the messages are still written
// and the function returns true (metadata is best-effort).
//
// This function must only be called after callAI() returns fallbackUsed=false.
// Do not persist turns when the AI returned a fallback or guardrail response.
export async function persistChatTurn(
  params: PersistChatTurnParams,
  env: AIRuntimeEnv,
): Promise<boolean> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return false

  const serviceClient = createServiceClient(key)

  // Insert user message row.
  const { error: userMsgError } = await serviceClient
    .from('ai_messages')
    .insert({
      ai_conversation_id:     params.conversationId,
      role:                   'user',
      content:                params.userMessage,
      context_used:           null,
      ai_model_used:          null,
      prompt_token_count:     0,
      completion_token_count: 0,
    })

  if (userMsgError) {
    console.error('chat persist: user message insert failed:', userMsgError.message)
    return false
  }

  // Insert assistant message row with context snapshot.
  const { error: assistantMsgError } = await serviceClient
    .from('ai_messages')
    .insert({
      ai_conversation_id:     params.conversationId,
      role:                   'assistant',
      content:                params.assistantText,
      context_used:           params.contextUsed,
      ai_model_used:          params.modelUsed,
      prompt_token_count:     params.promptTokens,
      completion_token_count: params.completionTokens,
    })

  if (assistantMsgError) {
    console.error('chat persist: assistant message insert failed:', assistantMsgError.message)
    return false
  }

  // Update conversation metadata — best-effort, failure does not affect return value.
  const { error: updateError } = await serviceClient
    .from('ai_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', params.conversationId)

  if (updateError) {
    console.error('chat persist: last_message_at update failed:', updateError.message)
  }

  return true
}
