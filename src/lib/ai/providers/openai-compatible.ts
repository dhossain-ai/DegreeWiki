import type { AIProvider } from './interface'
import type { AIPrompt, AIProviderConfig, AIProviderResponse } from '../types'
import { AIProviderError, categoryForStatus } from './gemini'

interface OpenAICompatibleProviderOptions {
  apiKey: string
  baseUrl: string
  endpointPath?: string | null
}

interface OpenAICompatibleMessage {
  content?: string
}

interface OpenAICompatibleChoice {
  message?: OpenAICompatibleMessage
}

interface OpenAICompatibleUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface OpenAICompatibleResponse {
  choices?: OpenAICompatibleChoice[]
  usage?: OpenAICompatibleUsage
  model?: string
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function normalizePath(path: string | null | undefined): string {
  if (!path) return '/chat/completions'
  return path.startsWith('/') ? path : `/${path}`
}

function detectQuotaExceeded(bodyText: string): boolean {
  const normalized = bodyText.toLowerCase()
  return normalized.includes('insufficient_quota') || normalized.includes('quota')
}

export class OpenAICompatibleProvider implements AIProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly endpointPath: string

  constructor(options: OpenAICompatibleProviderOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.endpointPath = normalizePath(options.endpointPath)
  }

  async complete(prompt: AIPrompt, config: AIProviderConfig): Promise<AIProviderResponse> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeoutMs = config.timeoutMs ?? 30000
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
    const url = `${this.baseUrl}${this.endpointPath}`

    const body = {
      model: config.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: config.temperature ?? 0.2,
      max_tokens: config.maxOutputTokens ?? 2048,
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller?.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIProviderError('OpenAI-compatible request timed out', 'timeout')
      }
      throw new AIProviderError('OpenAI-compatible request failed before receiving a response', 'network_error')
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }

    if (!response.ok) {
      let errorBody = ''
      try {
        errorBody = await response.text()
      } catch {
        // ignore
      }
      const category = response.status === 429 && detectQuotaExceeded(errorBody)
        ? 'quota_exceeded'
        : categoryForStatus(response.status)
      throw new AIProviderError(
        `OpenAI-compatible API returned status ${response.status}`,
        category,
        response.status,
      )
    }

    let data: OpenAICompatibleResponse
    try {
      data = (await response.json()) as OpenAICompatibleResponse
    } catch {
      throw new AIProviderError('OpenAI-compatible response was not valid JSON', 'invalid_provider_response', response.status)
    }

    const choices = data.choices ?? []
    if (choices.length === 0) {
      throw new AIProviderError('OpenAI-compatible response returned no choices', 'invalid_provider_response', response.status)
    }

    const text = (choices[0].message?.content ?? '').trim()
    if (!text) {
      throw new AIProviderError('OpenAI-compatible response missing text', 'invalid_provider_response', response.status)
    }

    const promptTokens = data.usage?.prompt_tokens ?? 0
    const completionTokens = data.usage?.completion_tokens ?? 0
    const modelUsed = data.model ?? config.model

    return {
      text,
      promptTokens,
      completionTokens,
      modelUsed,
    }
  }
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleProviderOptions,
): AIProvider {
  return new OpenAICompatibleProvider(options)
}
