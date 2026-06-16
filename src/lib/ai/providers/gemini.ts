import type { AIProvider } from './interface'
import type { AIPrompt, AIProviderConfig, AIProviderResponse } from '../types'

// Gemini provider stub — Phase 18.
// Live implementation (fetch-based REST call) is wired in Phase 19.
// GEMINI_API_KEY is server-only and must never use the PUBLIC_ prefix.
export class GeminiProvider implements AIProvider {
  async complete(
    _prompt: AIPrompt,
    _config: AIProviderConfig,
  ): Promise<AIProviderResponse> {
    throw new Error('Gemini provider is not enabled in Phase 18.')
  }
}

export function createGeminiProvider(): AIProvider {
  return new GeminiProvider()
}
