import type { AIProvider } from './providers/interface'
import type { AIRequest, AIResponse, AIRuntimeEnv } from './types'
import { createGeminiProvider } from './providers/gemini'
import { createOpenRouterProvider } from './providers/openrouter'
import { isAIProviderError } from './providers/gemini'
import { buildFinderPrompt } from './prompts/finder-summary'
import { buildChatPrompt } from './prompts/chat-answer'
import { checkInput, checkOutput } from './safety/guardrails'
import { checkRateLimit } from './usage/limits'
import { writeUsageLog } from './usage/logging'
import { createServiceClient } from '../supabase/service'

function logAIDev(message: string, details: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  console.log(`[AI gateway] ${message}:`, details)
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
  const providerName = env.AI_PROVIDER ?? 'gemini'
  const model = env.AI_MODEL ?? 'gemini-2.5-flash'

  logAIDev('provider selected', { provider: providerName })
  logAIDev('model selected', { model })

  // Step 2: rate limit check — fail closed.
  // No service client → denied. Anonymous user → denied. Query error → denied.
  const { allowed, reason: limitReason } = await checkRateLimit(
    request.userId ?? null,
    request.sessionType,
    { serviceClient, dailyLimit },
  )
  logAIDev('rate limit result', { allowed, reason: limitReason ?? null })
  if (!allowed) {
    logAIDev('provider request attempted', { provider: providerName, attempted: false })
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

  // Step 3: resolve provider from env.
  let provider: AIProvider
  try {
    provider = resolveProvider(env)
  } catch {
    logAIDev('provider request attempted', { provider: providerName, attempted: false })
    if (import.meta.env.DEV && providerName !== 'gemini' && providerName !== 'openrouter') {
      console.warn(`[AI gateway] Unknown AI_PROVIDER="${providerName}". Supported providers: gemini, openrouter. AI is unavailable until this is corrected.`)
    }
    return {
      text: 'AI is not available at this time. Please try again later.',
      modelUsed: 'none',
      promptTokens: 0,
      completionTokens: 0,
      guardrailTripped: false,
      fallbackUsed: true,
      failure: {
        source: 'provider_config',
        provider: providerName,
        model,
        requestAttempted: false,
      },
    }
  }

  // Step 4: build prompt.
  const prompt =
    request.sessionType === 'finder'
      ? buildFinderPrompt(request.context)
      : buildChatPrompt(request.userMessage, request.context, request.chatMode)

  // Step 5: call provider.
  let providerResponse: Awaited<ReturnType<AIProvider['complete']>>
  try {
    logAIDev('provider request attempted', { provider: providerName, attempted: true })
    providerResponse = await provider.complete(prompt, {
      model,
      temperature: 0.2,
      maxOutputTokens: 2048,
    })
  } catch (error) {
    const category = isAIProviderError(error) ? error.category : 'provider_error'
    const status = isAIProviderError(error) ? error.status : undefined
    logAIDev('provider failed', { provider: providerName, status: status ?? null, category })
    return {
      text: 'AI is temporarily unavailable. Please try again later.',
      modelUsed: model,
      promptTokens: 0,
      completionTokens: 0,
      guardrailTripped: false,
      fallbackUsed: true,
      failure: {
        source: 'provider',
        provider: providerName,
        model,
        category,
        status,
        requestAttempted: true,
      },
    }
  }

  // Step 6: output guardrail — never return blocked text.
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

  // Step 7: usage log — fire-and-forget; a failed log must never break the response.
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

  // Step 8: return successful response.
  return {
    text: providerResponse.text,
    modelUsed: providerResponse.modelUsed,
    promptTokens: providerResponse.promptTokens,
    completionTokens: providerResponse.completionTokens,
    guardrailTripped: false,
    fallbackUsed: false,
  }
}

// resolveProvider maps env.AI_PROVIDER to a live AIProvider instance.
// Throws on misconfiguration — callAI catches this and returns a fallback.
// No provider name or API key appears in thrown error messages.
function resolveProvider(env: AIRuntimeEnv): AIProvider {
  const providerName = env.AI_PROVIDER ?? 'gemini'

  if (providerName === 'gemini') {
    if (!env.GEMINI_API_KEY) {
      throw new Error('Gemini provider is not configured')
    }
    return createGeminiProvider(env.GEMINI_API_KEY)
  }

  if (providerName === 'openrouter') {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter provider is not configured')
    }
    return createOpenRouterProvider(env.OPENROUTER_API_KEY)
  }

  throw new Error('Requested AI provider is not available')
}
