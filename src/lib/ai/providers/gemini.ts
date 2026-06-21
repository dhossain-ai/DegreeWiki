import type { AIProvider } from './interface'
import type {
  AIPrompt,
  AIProviderConfig,
  AIProviderErrorCategory,
  AIProviderResponse,
} from '../types'

// Internal types for the Gemini generateContent REST API response.
// Not exported — callers use AIProviderResponse.
interface GeminiPart {
  text?: string
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[]; role?: string }
  finishReason?: string
}

interface GeminiUsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
}

interface GeminiRestResponse {
  candidates?: GeminiCandidate[]
  usageMetadata?: GeminiUsageMetadata
  modelVersion?: string
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly category: AIProviderErrorCategory,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}

export function isAIProviderError(error: unknown): error is AIProviderError {
  return error instanceof AIProviderError
}

export function categoryForStatus(status: number): AIProviderErrorCategory {
  if (status === 400) return 'bad_request'
  if (status === 401 || status === 403) return 'auth_error'
  if (status === 404) return 'model_not_found'
  if (status === 429) return 'quota_or_rate_limit'
  return 'provider_error'
}

function modelPath(model: string): string {
  const trimmed = model.trim()
  const path = trimmed.startsWith('models/') ? trimmed : `models/${trimmed}`
  return path.split('/').map(encodeURIComponent).join('/')
}

export class GeminiProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async complete(prompt: AIPrompt, config: AIProviderConfig): Promise<AIProviderResponse> {
    const model = config.model
    const url = `${GEMINI_API_BASE}/${modelPath(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`

    const body = {
      systemInstruction: {
        parts: [{ text: prompt.system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt.user }],
        },
      ],
      generationConfig: {
        temperature: config.temperature ?? 0.2,
        maxOutputTokens: config.maxOutputTokens ?? 2048,
      },
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new AIProviderError('Gemini request failed before receiving a response', 'network_error')
    }

    if (!response.ok) {
      // Do not include the response body — it may echo back prompt context.
      throw new AIProviderError(
        `Gemini API returned status ${response.status}`,
        categoryForStatus(response.status),
        response.status,
      )
    }

    let data: GeminiRestResponse
    try {
      data = (await response.json()) as GeminiRestResponse
    } catch {
      throw new AIProviderError('Gemini response was not valid JSON', 'provider_error', response.status)
    }

    const candidates = data.candidates ?? []
    if (candidates.length === 0) {
      throw new AIProviderError('Gemini returned no candidates', 'provider_error', response.status)
    }

    const candidate = candidates[0]
    const finishReason = candidate.finishReason ?? ''
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
      throw new AIProviderError(`Gemini candidate blocked: ${finishReason}`, 'provider_error', response.status)
    }

    const parts = candidate.content?.parts ?? []
    const text = parts
      .map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!text) {
      throw new AIProviderError('Gemini response missing text', 'provider_error', response.status)
    }

    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0
    const modelUsed = data.modelVersion ?? model

    return { text, promptTokens, completionTokens, modelUsed }
  }
}

export function createGeminiProvider(apiKey: string): AIProvider {
  return new GeminiProvider(apiKey)
}
