import type { AIPrompt, AIProviderConfig, AIProviderResponse } from '../types'

// All AI providers must implement this interface.
// Implementations must use fetch() only — no Node http/https modules.
// This ensures Cloudflare Workers compatibility.
export interface AIProvider {
  complete(prompt: AIPrompt, config: AIProviderConfig): Promise<AIProviderResponse>
}
