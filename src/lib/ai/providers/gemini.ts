import type { AIProvider } from './interface'
import type { AIPrompt, AIProviderConfig, AIProviderResponse } from '../types'

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

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export class GeminiProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async complete(prompt: AIPrompt, config: AIProviderConfig): Promise<AIProviderResponse> {
    const model = config.model
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${this.apiKey}`

    const body = {
      system_instruction: {
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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      // Do not include the response body — it may echo back prompt context.
      throw new Error(`Gemini API returned status ${response.status}`)
    }

    const data = (await response.json()) as GeminiRestResponse

    const candidates = data.candidates ?? []
    if (candidates.length === 0) {
      throw new Error('Gemini returned no candidates')
    }

    const candidate = candidates[0]
    const finishReason = candidate.finishReason ?? ''
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
      throw new Error(`Gemini candidate blocked: ${finishReason}`)
    }

    const parts = candidate.content?.parts ?? []
    const text = parts
      .map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!text) {
      throw new Error('Gemini response missing text')
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
