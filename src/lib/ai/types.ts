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
  // When sessionType === 'chat', set to 'saved_result' for context-bound saved-result chat.
  // Omit for generic/future chat surfaces. Only used when sessionType === 'chat'.
  chatMode?: 'saved_result'
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
  failure?: AIFailureReason
}

export type AIProviderErrorCategory =
  | 'auth_error'
  | 'model_not_found'
  | 'quota_or_rate_limit'
  | 'bad_request'
  | 'provider_error'
  | 'network_error'

export type AIFailureReason =
  | {
      source: 'rate_limit'
      reason: 'limit_exceeded' | 'service_unavailable'
      requestAttempted: false
    }
  | {
      source: 'provider_config'
      provider: string
      model: string
      requestAttempted: false
    }
  | {
      source: 'provider'
      provider: string
      model: string
      category: AIProviderErrorCategory
      status?: number
      requestAttempted: true
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

// Compact public representation of one matched program for use in chat prompts.
// All internal UUIDs are excluded. This is the LLM-facing shape — every field
// here may appear in a prompt sent to the AI provider.
export interface ChatResultProgram {
  rank: number
  title: string
  university: string | null
  country: string | null
  city: string | null
  degreeLevel: string | null
  subject: string | null
  tuitionSummary: string | null
  officialUrl: string | null
  matchReasons: string[]
  warnings: string[]
}

// Server-side context for one saved-result chat session.
// resultId is internal (used to create/find the conversation row) and must
// never be sent to the AI provider. programs is the allowlisted LLM-facing data.
export interface ChatResultContext {
  resultId: string
  programs: ChatResultProgram[]
  studentProfile?: StudentProfileSummary
}

// Compact audit snapshot stored in ai_messages.context_used (jsonb).
// This is a DB-side audit record — not sent to the LLM.
// Internal IDs (ai_finder_result_id, conversation_id) are included here for
// audit traceability; they never appear in the AI prompt itself.
export interface ContextUsedSnapshot {
  chatMode: 'saved_result'
  promptTemplateVersion: string
  safetyPolicyVersion: string
  aiFinderResultId: string
  conversationId: string
  programsUsed: Array<{ rank: number; title: string; university: string | null }>
  warningsIncluded: boolean
  missingTuitionCount: number
}

// Server/worker runtime env vars consumed by the AI module.
// These are server-only — never use PUBLIC_ prefix for AI secrets.
// In Cloudflare Workers accessed via locals.runtime.env.
export interface AIRuntimeEnv {
  AI_PROVIDER?: string
  AI_MODEL?: string
  GEMINI_API_KEY?: string
  // Server-only. Never expose with PUBLIC_ prefix. Used only when
  // AI_PROVIDER=openrouter for local AI testing via the OpenRouter provider.
  OPENROUTER_API_KEY?: string
  AI_RATE_LIMIT_ANON_DAILY?: string
  AI_RATE_LIMIT_USER_DAILY?: string
  // Server-only. Never expose with PUBLIC_ prefix. Used only by AI logging
  // and rate-limit infrastructure via src/lib/supabase/service.ts.
  SUPABASE_SERVICE_ROLE_KEY?: string
}
