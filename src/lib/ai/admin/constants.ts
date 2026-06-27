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

export const AI_GATEWAY_USE_CASES = [
  'fit_finder_summary',
  'chat_answer',
  'intent_detection',
  'subject_mapping',
  'program_comparison',
  'scholarship_explanation',
  'admin_article_draft',
] as const

export const AI_GATEWAY_LIVE_USE_CASES = [
  'fit_finder_summary',
  'chat_answer',
] as const

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

export type AIGatewayDbProviderProtocol = typeof AI_GATEWAY_DB_PROVIDER_PROTOCOLS[number]
export type AIGatewayPlannedProviderProtocol = typeof AI_GATEWAY_PLANNED_PROVIDER_PROTOCOLS[number]
export type AIGatewayPrivacyLevel = typeof AI_GATEWAY_PRIVACY_LEVELS[number]
export type AIGatewayAuthType = typeof AI_GATEWAY_AUTH_TYPES[number]
export type AIGatewayTestPresetId = typeof AI_GATEWAY_TEST_PRESETS[number]['id']
