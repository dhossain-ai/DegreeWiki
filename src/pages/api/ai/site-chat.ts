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
  getSiteStaticAnswerSource,
  routeSiteChatMessage,
  SITE_LOGIN_REQUIRED_RESPONSE,
  SITE_STATIC_RESPONSES,
} from '../../../lib/ai/site-chat/router'
import { findStaticSiteAnswer } from '../../../lib/ai/site-chat/static-answers'
import type { SiteChatAnswerSource, SiteChatContextUsedSnapshot } from '../../../lib/ai/types'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function systemNotice(error: string, answer?: string): Response {
  return jsonResponse(200, {
    ok: true,
    authenticated: false,
    used_ai: false,
    requires_login: true,
    error,
    answer,
    answer_source: 'system_notice' satisfies SiteChatAnswerSource,
  })
}

function normalizeCurrentPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  return value.slice(0, 180)
}

function logSiteChatFallback(
  userId: string,
  currentPath: string,
  pageType: string,
  failure: ReturnType<typeof mapSiteChatFallbackError>['failure'],
): void {
  console.warn('site chat api: AI fallback', {
    userId,
    currentPath,
    pageType,
    failureSource: failure?.source ?? null,
    failureReason: failure && 'reason' in failure ? failure.reason : null,
    provider: failure && 'provider' in failure ? failure.provider : null,
    model: failure && 'model' in failure ? failure.model : null,
    category: failure && 'category' in failure ? failure.category : null,
    status: failure && 'status' in failure ? failure.status ?? null : null,
    requestAttempted: failure?.requestAttempted ?? null,
  })
}

function mapSiteChatFallbackError(
  aiResponse: Awaited<ReturnType<typeof callAI>>,
): { status: number; error: 'rate_limit_exceeded' | 'ai_unavailable' | 'ai_setup_unavailable'; failure: typeof aiResponse.failure } {
  const failure = aiResponse.failure
  if (failure?.source === 'rate_limit' && failure.reason === 'limit_exceeded') {
    return { status: 429, error: 'rate_limit_exceeded', failure }
  }
  if (failure?.source === 'provider_config') {
    return { status: 503, error: 'ai_setup_unavailable', failure }
  }
  return { status: 503, error: 'ai_unavailable', failure }
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, {
      ok: false,
      error: 'invalid_body',
      answer_source: 'system_notice' satisfies SiteChatAnswerSource,
    })
  }

  const rawMessage = (body as Record<string, unknown>)['message']
  const currentPath = normalizeCurrentPath((body as Record<string, unknown>)['current_path'])

  if (typeof rawMessage !== 'string') {
    return jsonResponse(400, {
      ok: false,
      error: 'invalid_message',
      answer_source: 'system_notice' satisfies SiteChatAnswerSource,
    })
  }

  const message = rawMessage.trim()
  if (message.length === 0 || message.length > 1000) {
    return jsonResponse(400, {
      ok: false,
      error: 'invalid_message',
      answer_source: 'system_notice' satisfies SiteChatAnswerSource,
    })
  }

  const pageType = getSiteChatPageType(currentPath)
  const decision = routeSiteChatMessage(message)
  const aiEnv = getAIEnv(locals as Record<string, unknown>)
  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()

  if (decision.route === 'static') {
    const answer = SITE_STATIC_RESPONSES[decision.category]
    const answerSource = getSiteStaticAnswerSource(decision.category)

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
            answerSource,
            responseSource: 'static',
            staticCategory: decision.category,
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
      answer_source: answerSource,
    })
  }

  const presetAnswer = await findStaticSiteAnswer(supabase, message, {
    authenticated: !!user,
    locale: 'en',
  })

  if (presetAnswer) {
    const answerSource: SiteChatAnswerSource = 'knowledge_base'

    if (user) {
      const conversationId = await getOrCreateSiteConversation(user.id, aiEnv)
      if (conversationId) {
        const persisted = await persistSiteStaticTurn(
          {
            conversationId,
            currentPath,
            pageType,
            userMessage: message,
            assistantText: presetAnswer.answer,
            safetyPolicyVersion: GUARDRAILS_VERSION,
            promptTemplateVersion: 'site-preset-v1',
            answerSource,
            responseSource: 'preset',
            presetAnswerId: presetAnswer.id,
            presetCategory: presetAnswer.category,
          },
          aiEnv,
        )
        if (!persisted) {
          console.error('site chat api: persistSiteStaticTurn failed for preset answer', presetAnswer.id)
        }
      }
    }

    return jsonResponse(200, {
      ok: true,
      authenticated: !!user,
      used_ai: false,
      answer: presetAnswer.answer,
      answer_source: answerSource,
    })
  }

  if (!user) {
    return systemNotice('login_required', SITE_LOGIN_REQUIRED_RESPONSE)
  }

  const rateCheck = await checkAIRateLimit(user.id, 'chat', aiEnv)
  if (!rateCheck.allowed) {
    return jsonResponse(
      rateCheck.reason === 'limit_exceeded' ? 429 : 503,
      {
        ok: false,
        error: rateCheck.reason === 'limit_exceeded' ? 'rate_limit_exceeded' : 'ai_unavailable',
        answer_source: 'system_notice' satisfies SiteChatAnswerSource,
      },
    )
  }

  const conversationId = await getOrCreateSiteConversation(user.id, aiEnv)
  if (!conversationId) {
    return jsonResponse(500, {
      ok: false,
      error: 'internal_error',
      answer_source: 'system_notice' satisfies SiteChatAnswerSource,
    })
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
    return jsonResponse(400, {
      ok: false,
      error: 'message_rejected',
      answer: aiResponse.text,
      answer_source: 'safety_notice' satisfies SiteChatAnswerSource,
    })
  }

  if (aiResponse.fallbackUsed) {
    const mapped = mapSiteChatFallbackError(aiResponse)
    logSiteChatFallback(user.id, currentPath, pageType, mapped.failure)
    return jsonResponse(mapped.status, {
      ok: false,
      error: mapped.error,
      answer_source: 'system_notice' satisfies SiteChatAnswerSource,
    })
  }

  const contextUsed: SiteChatContextUsedSnapshot = {
    chatMode: 'site',
    promptTemplateVersion: CHAT_SITE_PROMPT_VERSION,
    safetyPolicyVersion: GUARDRAILS_VERSION,
    currentPath,
    pageType,
    answerSource: 'assistant',
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
    answer_source: 'assistant' satisfies SiteChatAnswerSource,
  })
}
