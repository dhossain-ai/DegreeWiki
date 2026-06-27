import type { AIProvider } from './interface'
import type { AIPrompt, AIProviderConfig, AIProviderResponse } from '../types'
import { AIProviderError, categoryForStatus } from './gemini'

// Internal types for the OpenRouter chat-completions response.
// OpenRouter exposes an OpenAI-compatible endpoint, so the shape matches the
// OpenAI chat-completions contract. Not exported — callers use AIProviderResponse.
interface OpenRouterMessage {
  content?: string
}

interface OpenRouterChoice {
  message?: OpenRouterMessage
  finish_reason?: string
}

interface OpenRouterUsage {
  prompt_tokens?: number
  completion_tokens?: number
}

interface OpenRouterChatResponse {
  choices?: OpenRouterChoice[]
  usage?: OpenRouterUsage
  model?: string
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

export class OpenRouterProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async complete(prompt: AIPrompt, config: AIProviderConfig): Promise<AIProviderResponse> {
    const model = config.model
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeoutMs = config.timeoutMs ?? 30000
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

    // Same final prompt/context the gateway hands to Gemini: the safety system
    // prompt plus the context-bound user turn. No prompt content is logged.
    const body = {
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: config.temperature ?? 0.2,
      max_tokens: config.maxOutputTokens ?? 2048,
    }

    let response: Response
    try {
      response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Bearer auth — never logged. Key stays server-side only.
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller?.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIProviderError('OpenRouter request timed out', 'timeout')
      }
      throw new AIProviderError('OpenRouter request failed before receiving a response', 'network_error')
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }

    if (!response.ok) {
      // Do not include the response body — it may echo back prompt context.
      throw new AIProviderError(
        `OpenRouter API returned status ${response.status}`,
        categoryForStatus(response.status),
        response.status,
      )
    }

    let data: OpenRouterChatResponse
    try {
      data = (await response.json()) as OpenRouterChatResponse
    } catch {
      throw new AIProviderError('OpenRouter response was not valid JSON', 'invalid_provider_response', response.status)
    }

    const choices = data.choices ?? []
    if (choices.length === 0) {
      throw new AIProviderError('OpenRouter returned no choices', 'invalid_provider_response', response.status)
    }

    const text = (choices[0].message?.content ?? '').trim()
    if (!text) {
      throw new AIProviderError('OpenRouter response missing text', 'invalid_provider_response', response.status)
    }

    const promptTokens = data.usage?.prompt_tokens ?? 0
    const completionTokens = data.usage?.completion_tokens ?? 0
    const modelUsed = data.model ?? model

    return { text, promptTokens, completionTokens, modelUsed }
  }
}

export function createOpenRouterProvider(apiKey: string): AIProvider {
  return new OpenRouterProvider(apiKey)
}
