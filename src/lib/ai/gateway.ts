import type { AIRequest, AIResponse, AIRuntimeEnv } from './types'
import { checkInput } from './safety/guardrails'
import { checkRateLimit } from './usage/limits'

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
  _env: AIRuntimeEnv,
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

  // Step 2: rate limit check.
  const { allowed } = await checkRateLimit(request.userId ?? null, request.sessionType)
  if (!allowed) {
    return {
      text: 'You have reached the daily AI usage limit. Please try again tomorrow.',
      modelUsed: 'none',
      promptTokens: 0,
      completionTokens: 0,
      guardrailTripped: false,
      fallbackUsed: true,
    }
  }

  // TODO Phase 19:
  // Step 3: resolve provider from _env.AI_PROVIDER (gemini | openrouter).
  // Step 4: build prompt via buildFinderPrompt(request.context) or
  //         buildChatPrompt(request.userMessage, request.context).
  // Step 5: call provider.complete(prompt, { model: _env.AI_MODEL ?? 'gemini-2.0-flash' }).
  // Step 6: run checkOutput() on provider response — return safe fallback if it trips.
  // Step 7: call writeUsageLog({ userId, sessionType, tokensUsed, modelUsed }).
  // Step 8: return AIResponse with provider text and token counts.

  // Phase 18: no provider is enabled — return a controlled fallback.
  return {
    text: 'AI provider is not enabled in this phase. Please try again later.',
    modelUsed: 'none',
    promptTokens: 0,
    completionTokens: 0,
    guardrailTripped: false,
    fallbackUsed: true,
  }
}
