import {
  AI_USE_CASES,
  AI_USAGE_AUDIENCE_TIERS,
  AI_USAGE_PERIODS,
  type AIUseCase,
} from '../types'

export const AI_GATEWAY_DB_PROVIDER_PROTOCOLS = [
  'openai_compatible',
] as const

export const AI_GATEWAY_PLANNED_PROVIDER_PROTOCOLS = [
  'gemini',
  'openrouter_legacy',
  'disabled',
] as const

export const AI_GATEWAY_AUTH_TYPES = [
  'bearer',
] as const

export const AI_GATEWAY_PRIVACY_LEVELS = [
  'standard',
  'restricted',
] as const

export const AI_GATEWAY_USE_CASES = AI_USE_CASES

export const AI_USAGE_LIMIT_AUDIENCE_TIERS = AI_USAGE_AUDIENCE_TIERS

export const AI_USAGE_LIMIT_PERIODS = AI_USAGE_PERIODS

export const AI_GATEWAY_ADMIN_USE_CASES = [
  'admin_article_draft',
] as const

export const AI_GATEWAY_LIVE_USE_CASES = [
  'fit_finder_summary',
  'chat_answer',
  'admin_article_draft',
] as const

export const AI_GATEWAY_USE_CASE_DESCRIPTIONS: Record<AIUseCase, string> = {
  fit_finder_summary: 'Fit Finder shortlist summaries for saved results.',
  chat_answer: 'Saved-result and logged-in chat answers.',
  intent_detection: 'Reserved intent detection routing.',
  subject_mapping: 'Reserved subject mapping routing.',
  program_comparison: 'Reserved program comparison routing.',
  scholarship_explanation: 'Reserved scholarship explanation routing.',
  admin_article_draft: 'Admin article drafting and SEO suggestions.',
}

export const AI_GATEWAY_TEST_PRESETS = [
  {
    id: 'fit_finder_summary_style',
    label: 'Fit Finder summary style test',
  },
  {
    id: 'chat_answer_style',
    label: 'Chat answer style test',
  },
  {
    id: 'do_not_invent_facts',
    label: 'Do not invent tuition/deadline safety test',
  },
  {
    id: 'missing_data_handling',
    label: 'Missing data handling test',
  },
] as const

export const AI_USAGE_LIMIT_AUDIENCE_LABELS = {
  anonymous: 'Anonymous',
  authenticated_free: 'Authenticated Free',
  admin: 'Admin',
  paid_basic: 'Paid Basic',
  paid_pro: 'Paid Pro',
} as const

export const AI_USAGE_LIMIT_PERIOD_LABELS = {
  daily: 'Daily',
  monthly: 'Monthly',
} as const

export type AIGatewayDbProviderProtocol = typeof AI_GATEWAY_DB_PROVIDER_PROTOCOLS[number]
export type AIGatewayPlannedProviderProtocol = typeof AI_GATEWAY_PLANNED_PROVIDER_PROTOCOLS[number]
export type AIGatewayPrivacyLevel = typeof AI_GATEWAY_PRIVACY_LEVELS[number]
export type AIGatewayAuthType = typeof AI_GATEWAY_AUTH_TYPES[number]
export type AIGatewayTestPresetId = typeof AI_GATEWAY_TEST_PRESETS[number]['id']
