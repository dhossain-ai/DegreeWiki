import type { AIProvider } from './providers/interface'
import type { AIRequest, AIResponse, AIRuntimeEnv } from './types'
import { createGeminiProvider } from './providers/gemini'
import { buildFinderPrompt } from './prompts/finder-summary'
import { buildChatPrompt } from './prompts/chat-answer'
import { checkInput, checkOutput } from './safety/guardrails'
import { checkRateLimit } from './usage/limits'
import { writeUsageLog } from './usage/logging'
import { createServiceClient } from '../supabase/service'

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

  // Step 2: rate limit check — fail closed.
  // No service client → denied. Anonymous user → denied. Query error → denied.
  const { allowed, reason: limitReason } = await checkRateLimit(
    request.userId ?? null,
    request.sessionType,
    { serviceClient, dailyLimit },
  )
  if (!allowed) {
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
    }
  }

  // Step 3: resolve provider from env.
  let provider: AIProvider
  try {
    provider = resolveProvider(env)
  } catch {
    return {
      text: 'AI is not available at this time. Please try again later.',
      modelUsed: 'none',
      promptTokens: 0,
      completionTokens: 0,
      guardrailTripped: false,
      fallbackUsed: true,
    }
  }

  // Step 4: build prompt.
  const prompt =
    request.sessionType === 'finder'
      ? buildFinderPrompt(request.context)
      : buildChatPrompt(request.userMessage, request.context)

  // Step 5: call provider.
  const model = env.AI_MODEL ?? 'gemini-2.5-flash'
  let providerResponse: Awaited<ReturnType<AIProvider['complete']>>
  try {
    providerResponse = await provider.complete(prompt, {
      model,
      temperature: 0.2,
      maxOutputTokens: 2048,
    })
  } catch {
    return {
      text: 'AI is temporarily unavailable. Please try again later.',
      modelUsed: model,
      promptTokens: 0,
      completionTokens: 0,
      guardrailTripped: false,
      fallbackUsed: true,
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

  throw new Error('Requested AI provider is not available')
}
