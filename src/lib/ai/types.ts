export type AISessionType = 'finder' | 'chat'

export type AIRole = 'user' | 'assistant' | 'system'

// Minimal profile summary passed into prompts.
// All fields are optional — this is a partial view of student_profiles,
// never the full row.
export interface StudentProfileSummary {
  budgetMin?: number
  budgetMax?: number
  currency?: string
  degreeLevel?: string
  subjects?: string[]
  targetCountries?: string[]
  studyStartPreference?: string
}

// Pre-fetched database records required before any LLM call.
// The LLM must not be the source of facts — caller retrieves records first.
export interface AIContext {
  source: 'programs' | 'scholarships' | 'universities' | 'articles' | 'none'
  records: Array<Record<string, unknown>>
  studentProfile?: StudentProfileSummary
}

// What enters the AI gateway from a server endpoint.
export interface AIRequest {
  sessionType: AISessionType
  conversationId?: string
  userMessage: string
  context: AIContext
  userId?: string
  sessionToken?: string
}

// What the AI gateway returns to the server endpoint.
export interface AIResponse {
  text: string
  modelUsed: string
  promptTokens: number
  completionTokens: number
  guardrailTripped: boolean
  fallbackUsed: boolean
}

// The structured prompt handed to a provider.
export interface AIPrompt {
  system: string
  user: string
}

// Provider-level configuration.
export interface AIProviderConfig {
  model: string
  maxOutputTokens?: number
  temperature?: number
}

// What a provider returns after completing a prompt.
export interface AIProviderResponse {
  text: string
  promptTokens: number
  completionTokens: number
  modelUsed: string
}

// Usage audit entry written to ai_usage_logs (Phase 25+).
export interface AIUsageEntry {
  userId: string | null
  sessionType: AISessionType
  tokensUsed: number
  modelUsed: string
  costEstimateUsd?: number | null
}

// Result of a guardrail check.
export interface AIGuardrailResult {
  passed: boolean
  reason?: string
}

// Server/worker runtime env vars consumed by the AI module.
// These are server-only — never use PUBLIC_ prefix for AI secrets.
// In Cloudflare Workers accessed via locals.runtime.env.
export interface AIRuntimeEnv {
  AI_PROVIDER?: string
  AI_MODEL?: string
  GEMINI_API_KEY?: string
  AI_RATE_LIMIT_ANON_DAILY?: string
  AI_RATE_LIMIT_USER_DAILY?: string
  // Server-only. Never expose with PUBLIC_ prefix. Used only by AI logging
  // and rate-limit infrastructure via src/lib/supabase/service.ts.
  SUPABASE_SERVICE_ROLE_KEY?: string
}
