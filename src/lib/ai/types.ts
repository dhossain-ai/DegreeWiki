export type AISessionType = 'finder' | 'chat'

export type AIRole = 'user' | 'assistant' | 'system'

export const AI_USE_CASES = [
  'fit_finder_summary',
  'chat_answer',
  'intent_detection',
  'subject_mapping',
  'program_comparison',
  'scholarship_explanation',
  'admin_article_draft',
] as const

export type AIUseCase = typeof AI_USE_CASES[number]

export const AI_USAGE_AUDIENCE_TIERS = [
  'anonymous',
  'authenticated_free',
  'admin',
  'paid_basic',
  'paid_pro',
] as const

export type AIUsageAudienceTier = typeof AI_USAGE_AUDIENCE_TIERS[number]

export const AI_USAGE_PERIODS = [
  'daily',
  'monthly',
] as const

export type AIUsagePeriod = typeof AI_USAGE_PERIODS[number]

export const ARTICLE_ASSIST_ACTIONS = [
  'outline',
  'seo_title',
  'seo_description',
  'summary',
  'faq',
  'risk_check',
] as const

export type ArticleAssistAction = typeof ARTICLE_ASSIST_ACTIONS[number]

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
  useCase?: AIUseCase
  audienceTier?: AIUsageAudienceTier
  // When sessionType === 'chat', set to 'saved_result' for context-bound saved-result chat.
  // Use 'site' for the logged-in public chatbot shell. Omit for generic/future chat surfaces.
  // Only used when sessionType === 'chat'.
  chatMode?: 'saved_result' | 'site'
  aiFinderResultId?: string
  conversationId?: string
  userMessage: string
  context: AIContext
  // Optional caller-provided prompt override for non-chat/non-finder surfaces
  // that still need the shared gateway, quota, and logging path.
  prompt?: AIPrompt
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
  | 'rate_limit'
  | 'quota_exceeded'
  | 'timeout'
  | 'provider_unavailable'
  | 'provider_5xx'
  | 'network_error'
  | 'invalid_provider_response'
  | 'auth_error'
  | 'bad_request'
  | 'model_not_found'
  | 'policy_refusal'
  | 'unknown_error'

export type AIGatewayLogStatus =
  | 'success'
  | 'failure'
  | 'skipped_cooldown'
  | 'skipped_inactive'
  | 'blocked_by_policy'
  | 'env_fallback_success'
  | 'env_fallback_failure'
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
  timeoutMs?: number
}

// What a provider returns after completing a prompt.
export interface AIProviderResponse {
  text: string
  promptTokens: number
  completionTokens: number
  modelUsed: string
}

export interface AIGatewayProviderAccount {
  id: string
  providerCode: string
  displayName: string
  adapterType: 'openai_compatible'
  baseUrl: string | null
  endpointPath: string | null
  authType: 'bearer'
  apiKeyCiphertext: string
  apiKeyIv: string
  apiKeyKeyVersion: string
  apiKeyLast4: string | null
  apiKeyFingerprint: string | null
  timeoutMs: number
  isActive: boolean
  privacyLevel: 'standard' | 'restricted'
  allowsStudentData: boolean
  allowsChat: boolean
  allowsFitFinder: boolean
}

export interface AIGatewayModel {
  id: string
  providerAccountId: string
  modelName: string
  displayName: string
  isActive: boolean
  supportsText: boolean
  supportsJsonMode: boolean
  supportsStreaming: boolean
  supportsToolCalling: boolean
  maxOutputTokens: number | null
  inputCostPerMillion: number | null
  outputCostPerMillion: number | null
  costTier: string | null
}

export interface AIGatewayRoutingPolicy {
  id: string
  useCase: AIUseCase
  modelId: string
  priority: number
  isActive: boolean
  fallbackEnabled: boolean
  maxAttempts: number
  timeoutMs: number | null
  allowEnvFallback: boolean
  notes: string | null
}

export interface AIGatewayProviderHealth {
  id: string
  providerAccountId: string
  modelId: string
  consecutiveFailures: number
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastErrorType: AIProviderErrorCategory | null
  cooldownUntil: string | null
}

export interface AIGatewayRoutingCandidate {
  policy: AIGatewayRoutingPolicy
  model: AIGatewayModel
  providerAccount: AIGatewayProviderAccount
  health: AIGatewayProviderHealth | null
}

export interface AIGatewayCallContext {
  userId?: string | null
  anonymousSessionId?: string | null
  aiFinderResultId?: string | null
  aiConversationId?: string | null
  aiMessageId?: string | null
}

export interface AIGatewayCallLogEntry extends AIGatewayCallContext {
  useCase: AIUseCase
  providerAccountId: string | null
  modelId: string | null
  providerCode: string | null
  modelName: string | null
  status: AIGatewayLogStatus
  normalizedErrorType?: AIProviderErrorCategory | null
  providerHttpStatus?: number | null
  latencyMs?: number | null
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  estimatedCostUsd?: number | null
  wasFallback: boolean
  fallbackAttemptNumber: number
  fallbackFromCallId?: string | null
}

export interface AIGatewayAttemptFailure {
  providerCode: string
  modelName: string
  category: AIProviderErrorCategory
  status?: number
}

export interface AIGatewaySuccess {
  response: AIProviderResponse
  providerCode: string
  modelName: string
  providerAccountId: string | null
  modelId: string | null
  usedEnvFallback: boolean
  logId: string | null
}

export interface AIGatewayFailure {
  usedEnvFallback: boolean
  failure: AIGatewayAttemptFailure | null
  diagnosticReason?:
    | 'no_candidates'
    | 'no_eligible_candidates'
    | 'provider_setup_failed'
    | 'provider_request_failed'
  candidateCount?: number
}

// Usage audit entry written to ai_usage_logs (Phase 25+).
export interface AIUsageEntry {
  userId: string | null
  anonymousSessionId?: string | null
  sessionType: AISessionType
  useCase: AIUseCase
  audienceTier: AIUsageAudienceTier
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

export type SiteChatAnswerSource =
  | 'knowledge_base'
  | 'assistant'
  | 'safety_notice'
  | 'system_notice'

export interface SiteChatContextUsedSnapshot {
  chatMode: 'site'
  promptTemplateVersion: string
  safetyPolicyVersion: string
  currentPath: string
  pageType: string
  answerSource?: SiteChatAnswerSource
  responseSource?: 'static' | 'preset'
  staticCategory?: string | null
  presetAnswerId?: string | null
  presetCategory?: string | null
}

export type AIMessageContextSnapshot =
  | ContextUsedSnapshot
  | SiteChatContextUsedSnapshot

// Server/worker runtime env vars consumed by the AI module.
// These are server-only — never use PUBLIC_ prefix for AI secrets.
// In Cloudflare Workers accessed via locals.runtime.env.
export interface AIRuntimeEnv {
  AI_PROVIDER?: string
  AI_MODEL?: string
  AI_GATEWAY_MASTER_KEY?: string
  AI_GATEWAY_ACTIVE_KEY_VERSION?: string
  AI_GATEWAY_ENV_FALLBACK_ENABLED?: string
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
