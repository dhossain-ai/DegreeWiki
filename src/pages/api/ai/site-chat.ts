import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase/server'
import { callAI } from '../../../lib/ai/gateway'
import { checkAIRateLimit } from '../../../lib/ai/usage/limits'
import { getAIEnv } from '../../../lib/ai/env'
import { GUARDRAILS_VERSION } from '../../../lib/ai/safety/guardrails'
import { CHAT_SITE_PROMPT_VERSION } from '../../../lib/ai/prompts/chat-answer'
import { buildSiteChatContext, getSiteChatPageType } from '../../../lib/ai/site-chat/context'
import {
  getOrCreateSiteConversation,
  persistSiteChatTurn,
  persistSiteStaticTurn,
} from '../../../lib/ai/site-chat/persist'
import {
  routeSiteChatMessage,
  SITE_LOGIN_REQUIRED_RESPONSE,
  SITE_STATIC_RESPONSES,
} from '../../../lib/ai/site-chat/router'
import type { SiteChatContextUsedSnapshot } from '../../../lib/ai/types'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeCurrentPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  return value.slice(0, 180)
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_body' })
  }

  const rawMessage = (body as Record<string, unknown>)['message']
  const currentPath = normalizeCurrentPath((body as Record<string, unknown>)['current_path'])

  if (typeof rawMessage !== 'string') {
    return jsonResponse(400, { ok: false, error: 'invalid_message' })
  }

  const message = rawMessage.trim()
  if (message.length === 0 || message.length > 1000) {
    return jsonResponse(400, { ok: false, error: 'invalid_message' })
  }

  const pageType = getSiteChatPageType(currentPath)
  const decision = routeSiteChatMessage(message)
  const aiEnv = getAIEnv(locals as Record<string, unknown>)
  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()

  if (decision.route === 'static') {
    const answer = SITE_STATIC_RESPONSES[decision.category]

    if (user) {
      const conversationId = await getOrCreateSiteConversation(user.id, aiEnv)
      if (conversationId) {
        const persisted = await persistSiteStaticTurn(
          {
            conversationId,
            currentPath,
            pageType,
            userMessage: message,
            assistantText: answer,
            safetyPolicyVersion: GUARDRAILS_VERSION,
          },
          aiEnv,
        )
        if (!persisted) {
          console.error('site chat api: persistSiteStaticTurn failed for conversation', conversationId)
        }
      }
    }

    return jsonResponse(200, {
      ok: true,
      authenticated: !!user,
      used_ai: false,
      answer,
    })
  }

  if (!user) {
    return jsonResponse(200, {
      ok: true,
      authenticated: false,
      used_ai: false,
      requires_login: true,
      answer: SITE_LOGIN_REQUIRED_RESPONSE,
    })
  }

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

  const conversationId = await getOrCreateSiteConversation(user.id, aiEnv)
  if (!conversationId) {
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }

  const aiResponse = await callAI(
    {
      useCase: 'chat_answer',
      sessionType: 'chat',
      chatMode: 'site',
      userMessage: message,
      context: buildSiteChatContext(currentPath),
      userId: user.id,
      conversationId,
    },
    aiEnv,
  )

  if (aiResponse.guardrailTripped) {
    return jsonResponse(400, { ok: false, error: 'message_rejected', answer: aiResponse.text })
  }

  if (aiResponse.fallbackUsed) {
    return jsonResponse(503, { ok: false, error: 'ai_unavailable' })
  }

  const contextUsed: SiteChatContextUsedSnapshot = {
    chatMode: 'site',
    promptTemplateVersion: CHAT_SITE_PROMPT_VERSION,
    safetyPolicyVersion: GUARDRAILS_VERSION,
    currentPath,
    pageType,
  }

  const persisted = await persistSiteChatTurn(
    {
      conversationId,
      userMessage: message,
      assistantText: aiResponse.text,
      modelUsed: aiResponse.modelUsed,
      promptTokens: aiResponse.promptTokens,
      completionTokens: aiResponse.completionTokens,
      contextUsed,
    },
    aiEnv,
  )

  if (!persisted) {
    console.error('site chat api: persistSiteChatTurn failed for conversation', conversationId)
  }

  return jsonResponse(200, {
    ok: true,
    authenticated: true,
    used_ai: true,
    answer: aiResponse.text,
  })
}
