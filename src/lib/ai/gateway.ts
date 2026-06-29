import type { AIRequest, AIResponse, AIRuntimeEnv } from './types'
import { buildFinderPrompt } from './prompts/finder-summary'
import { buildChatPrompt } from './prompts/chat-answer'
import { checkInput, checkOutput } from './safety/guardrails'
import { checkRateLimit } from './usage/limits'
import { writeUsageLog } from './usage/logging'
import { createServiceClient } from '../supabase/service'
import { runAIGatewayRoute } from './router'

function logAIDev(message: string, details: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  console.log(`[AI gateway] ${message}:`, details)
}

function logAIFailure(
  request: AIRequest,
  useCase: string,
  routeResult: {
    failure: {
      providerCode: string
      modelName: string
      category: string
      status?: number
    } | null
    diagnosticReason?: string
    candidateCount?: number
    usedEnvFallback: boolean
  },
): void {
  console.warn('[AI gateway] route failed', {
    useCase,
    sessionType: request.sessionType,
    chatMode: request.chatMode ?? null,
    diagnosticReason: routeResult.diagnosticReason ?? 'unknown',
    candidateCount: routeResult.candidateCount ?? 0,
    usedEnvFallback: routeResult.usedEnvFallback,
    provider: routeResult.failure?.providerCode ?? null,
    model: routeResult.failure?.modelName ?? null,
    category: routeResult.failure?.category ?? null,
    status: routeResult.failure?.status ?? null,
  })
}

// callAI is the single server-only entry point for all LLM calls.
//
// Caller contract:
//   1. Retrieve real database records first.
//   2. Build an AIContext from those records.
//   3. Pass the AIContext here — the LLM must not be the source of facts.
//
// This function must only be called from server endpoints.
// Never import or call this from browser code or Astro component frontmatter
// that runs on the client.
export async function callAI(
  request: AIRequest,
  env: AIRuntimeEnv,
): Promise<AIResponse> {
  // Step 1: input guardrails — block prohibited content before touching the provider.
  const inputCheck = checkInput(request.userMessage)
  if (!inputCheck.passed) {
    return {
      text: inputCheck.reason ?? 'Your message contains content that cannot be processed.',
      modelUsed: 'none',
      promptTokens: 0,
      completionTokens: 0,
      guardrailTripped: true,
      fallbackUsed: true,
    }
  }

  // Resolve the service role client for rate limiting and usage logging.
  // Null when SUPABASE_SERVICE_ROLE_KEY is absent — both operations fail closed.
  const serviceClient = env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(env.SUPABASE_SERVICE_ROLE_KEY)
    : null

  const dailyLimit = Math.max(1, parseInt(env.AI_RATE_LIMIT_USER_DAILY ?? '20', 10) || 20)
  const useCase = request.useCase
    ?? (request.sessionType === 'finder' ? 'fit_finder_summary' : 'chat_answer')

  logAIDev('use case selected', { useCase })

  // Step 2: rate limit check — fail closed.
  // No service client → denied. Anonymous user → denied. Query error → denied.
  const { allowed, reason: limitReason } = await checkRateLimit(
    request.userId ?? null,
    request.sessionType,
    { serviceClient, dailyLimit },
  )
  logAIDev('rate limit result', { allowed, reason: limitReason ?? null })
  if (!allowed) {
    if (import.meta.env.DEV && limitReason === 'service_unavailable' && !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[AI gateway] AI call denied: SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (local dev) or Cloudflare secrets (production) to enable AI rate limiting and AI calls.')
    }
    const text = limitReason === 'limit_exceeded'
      ? "You have reached today's AI usage limit. Your rule-based matches are still available."
      : 'AI is temporarily unavailable.'
    return {
      text,
      modelUsed: 'none',
      promptTokens: 0,
      completionTokens: 0,
      guardrailTripped: false,
      fallbackUsed: true,
      failure: {
        source: 'rate_limit',
        reason: limitReason ?? 'service_unavailable',
        requestAttempted: false,
      },
    }
  }

  // Step 3: build prompt from approved DegreeWiki context.
  const prompt = request.prompt
    ?? (
      request.sessionType === 'finder'
        ? buildFinderPrompt(request.context)
        : buildChatPrompt(request.userMessage, request.context, request.chatMode)
    )

  // Step 4: use the DB-backed router. App-level validation and rate limits stay here.
  const routeResult = await runAIGatewayRoute({
    useCase,
    prompt,
    temperature: 0.2,
    maxOutputTokens: 2048,
    env,
    context: {
      userId: request.userId ?? null,
      anonymousSessionId: request.sessionToken ?? null,
      aiFinderResultId: request.aiFinderResultId ?? null,
      aiConversationId: request.conversationId ?? null,
    },
  })

  if (!('response' in routeResult)) {
    const failure = routeResult.failure
    logAIFailure(request, useCase, routeResult)
    return {
      text: 'AI is temporarily unavailable. Please try again later.',
      modelUsed: failure?.modelName ?? 'none',
      promptTokens: 0,
      completionTokens: 0,
      guardrailTripped: false,
      fallbackUsed: true,
      failure:
        routeResult.diagnosticReason === 'no_candidates'
        || routeResult.diagnosticReason === 'no_eligible_candidates'
        || routeResult.diagnosticReason === 'provider_setup_failed'
          ? {
              source: 'provider_config',
              provider: failure?.providerCode ?? 'unconfigured',
              model: failure?.modelName ?? useCase,
              requestAttempted: false,
            }
          : failure
            ? {
                source: 'provider',
                provider: failure.providerCode,
                model: failure.modelName,
                category: failure.category,
                status: failure.status,
                requestAttempted: true,
              }
            : undefined,
    }
  }
  const providerResponse = routeResult.response

  // Step 5: output guardrail — never return blocked text.
  const outputCheck = checkOutput(providerResponse.text)
  if (!outputCheck.passed) {
    return {
      text: 'The AI response contained content that could not be shown. Please try a different question.',
      modelUsed: providerResponse.modelUsed,
      promptTokens: providerResponse.promptTokens,
      completionTokens: providerResponse.completionTokens,
      guardrailTripped: true,
      fallbackUsed: true,
    }
  }

  // Step 6: usage log — fire-and-forget; a failed log must never break the response.
  // Only session metadata and token counts are logged. No prompt or response text.
  writeUsageLog(
    {
      userId:           request.userId ?? null,
      sessionType:      request.sessionType,
      tokensUsed:       providerResponse.promptTokens + providerResponse.completionTokens,
      modelUsed:        providerResponse.modelUsed,
      costEstimateUsd:  null,
    },
    serviceClient,
  ).catch(() => {
    // intentionally silent
  })

  // Step 7: return successful response.
  return {
    text: providerResponse.text,
    modelUsed: providerResponse.modelUsed,
    promptTokens: providerResponse.promptTokens,
    completionTokens: providerResponse.completionTokens,
    guardrailTripped: false,
    fallbackUsed: false,
  }
}
