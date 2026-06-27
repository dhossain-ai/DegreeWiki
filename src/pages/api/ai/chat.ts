// SERVER-ONLY. Authenticated JSON API endpoint for saved-result-bound AI chat.
//
// POST /api/ai/chat
//   Body: { ai_finder_result_id: string, message: string }
//   Success: { ok: true, answer: string, conversation_id: string }
//   Errors: see jsonResponse calls below
//
// All privileged Supabase operations are delegated to approved server-only lib
// helpers (checkAIRateLimit, getOrCreateConversation, persistChatTurn, persistStaticTurn, callAI).
// This file contains no direct database service-key access.
import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase/server'
import { routeChatMessage, STATIC_RESPONSES } from '../../../lib/ai/chat/router'
import { loadChatContext } from '../../../lib/ai/chat/context'
import { getOrCreateConversation, persistChatTurn, persistStaticTurn } from '../../../lib/ai/chat/persist'
import { callAI } from '../../../lib/ai/gateway'
import { checkAIRateLimit } from '../../../lib/ai/usage/limits'
import { getAIEnv } from '../../../lib/ai/env'
import { CHAT_SAVED_RESULT_PROMPT_VERSION } from '../../../lib/ai/prompts/chat-answer'
import { GUARDRAILS_VERSION } from '../../../lib/ai/safety/guardrails'
import type { AIContext, ContextUsedSnapshot } from '../../../lib/ai/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  // Parse JSON body.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_body' })
  }

  // Validate fields.
  const b = body as Record<string, unknown>
  const resultId = b['ai_finder_result_id']
  const rawMessage = b['message']

  if (typeof resultId !== 'string' || !UUID_RE.test(resultId)) {
    return jsonResponse(400, { ok: false, error: 'invalid_request' })
  }
  if (typeof rawMessage !== 'string') {
    return jsonResponse(400, { ok: false, error: 'invalid_message' })
  }
  const message = rawMessage.trim()
  if (message.length === 0 || message.length > 1000) {
    return jsonResponse(400, { ok: false, error: 'invalid_message' })
  }

  // Authenticate. getUser() verifies the JWT with Supabase on every request.
  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return jsonResponse(401, { ok: false, error: 'unauthenticated' })
  }

  // Route the message deterministically before any LLM or rate-limit call.
  const decision = routeChatMessage(message)

  // Extract AI runtime env from Cloudflare Worker bindings (needed by both paths).
  const aiEnv = getAIEnv(locals as Record<string, unknown>)

  // Static path: no LLM, no rate-limit, no provider usage log.
  if (decision.route === 'static') {
    // Verify result ownership with authenticated SSR client (RLS enforced).
    // Full context load is not needed for static responses.
    const { data: resultRow } = await supabase
      .from('ai_finder_results')
      .select('id')
      .eq('id', resultId)
      .maybeSingle()

    if (!resultRow) {
      return jsonResponse(404, { ok: false, error: 'not_found' })
    }

    // Get or create the persistent conversation for this (user, result) pair.
    const conversationId = await getOrCreateConversation(
      { userId: user.id, finderResultId: resultId },
      aiEnv,
    )
    if (!conversationId) {
      return jsonResponse(500, { ok: false, error: 'internal_error' })
    }

    const answer = STATIC_RESPONSES[decision.category]

    // Persist the static turn. Failure is logged server-side only; answer is still returned.
    const persisted = await persistStaticTurn(
      {
        conversationId,
        resultId,
        userMessage:      message,
        assistantText:    answer,
        safetyPolicyVersion: GUARDRAILS_VERSION,
      },
      aiEnv,
    )
    if (!persisted) {
      console.error('chat api: persistStaticTurn failed for conversation', conversationId)
    }

    return jsonResponse(200, { ok: true, answer, conversation_id: conversationId })
  }

  // LLM path: existing rate limit → context → AI → persist flow.

  // Pre-check rate limit via server-only lib helper.
  // Privileged access is encapsulated inside checkAIRateLimit — not in this file.
  const rateCheck = await checkAIRateLimit(user.id, 'chat', aiEnv)
  if (!rateCheck.allowed) {
    return jsonResponse(
      rateCheck.reason === 'limit_exceeded' ? 429 : 503,
      {
        ok: false,
        error: rateCheck.reason === 'limit_exceeded' ? 'rate_limit_exceeded' : 'ai_unavailable',
      },
    )
  }

  // Load chat context via RLS-scoped SSR client. No service role.
  // Returns null when result not found, not owned by user, or result_status !== 'complete'.
  const chatContext = await loadChatContext(resultId, supabase)
  if (!chatContext) {
    return jsonResponse(404, { ok: false, error: 'not_found' })
  }

  // Get or create the persistent conversation for this (user, result) pair.
  // Privileged DB access is inside getOrCreateConversation — not in this file.
  const conversationId = await getOrCreateConversation(
    { userId: user.id, finderResultId: resultId },
    aiEnv,
  )
  if (!conversationId) {
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }

  // Build AIContext from the allowlisted program fields loaded by loadChatContext.
  // chatContext.programs contains no internal UUIDs — safe to pass to the gateway.
  const aiContext: AIContext = {
    source: 'programs',
    records: chatContext.programs as unknown as Array<Record<string, unknown>>,
  }

  // Call AI gateway with saved-result chat mode.
  // Rate limit, provider call, output guardrail, and usage logging all run inside callAI.
  const aiResponse = await callAI(
    {
      useCase:        'chat_answer',
      sessionType:    'chat',
      chatMode:       'saved_result',
      aiFinderResultId: resultId,
      userMessage:    message,
      context:        aiContext,
      userId:         user.id,
      conversationId,
    },
    aiEnv,
  )

  // Input guardrail blocked the message before the LLM was called.
  if (aiResponse.guardrailTripped) {
    return jsonResponse(400, { ok: false, error: 'message_rejected', answer: aiResponse.text })
  }

  // AI was unavailable (non-guardrail fallback — provider error, missing key, or
  // race at rate limit boundary after the pre-check passed).
  if (aiResponse.fallbackUsed) {
    return jsonResponse(503, { ok: false, error: 'ai_unavailable' })
  }

  // Build the audit snapshot stored in ai_messages.context_used (DB-side only).
  // Internal IDs appear here for traceability — never in the LLM prompt.
  const contextUsed: ContextUsedSnapshot = {
    chatMode:              'saved_result',
    promptTemplateVersion: CHAT_SAVED_RESULT_PROMPT_VERSION,
    safetyPolicyVersion:   GUARDRAILS_VERSION,
    aiFinderResultId:      resultId,
    conversationId,
    programsUsed: chatContext.programs.map(p => ({
      rank:       p.rank,
      title:      p.title,
      university: p.university,
    })),
    warningsIncluded:    chatContext.programs.some(p => p.warnings.length > 0),
    missingTuitionCount: chatContext.programs.filter(p => !p.tuitionSummary).length,
  }

  // Persist the chat turn. Privileged DB access is inside persistChatTurn — not here.
  // A persistence failure is logged server-side only; the answer is still returned.
  const persisted = await persistChatTurn(
    {
      conversationId,
      userMessage:      message,
      assistantText:    aiResponse.text,
      modelUsed:        aiResponse.modelUsed,
      promptTokens:     aiResponse.promptTokens,
      completionTokens: aiResponse.completionTokens,
      contextUsed,
    },
    aiEnv,
  )
  if (!persisted) {
    console.error('chat api: persistChatTurn failed for conversation', conversationId)
  }

  // conversation_id is returned so future chat UI can load conversation history.
  // Never return: user_id, ai_finder_result_id, student_profile_id, model internals,
  // token counts, prompt text, or raw provider errors.
  return jsonResponse(200, { ok: true, answer: aiResponse.text, conversation_id: conversationId })
}
