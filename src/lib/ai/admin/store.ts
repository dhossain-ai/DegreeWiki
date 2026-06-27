// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
import { createServiceClient } from '../../supabase/service'
import type {
  AIRuntimeEnv,
  AIUseCase,
  AIGatewayProviderHealth,
  AIGatewayRoutingCandidate,
  AIGatewayRoutingPolicy,
  AIGatewayModel,
  AIGatewayProviderAccount,
} from '../types'

export interface AdminAIGatewayProviderRecord {
  id: string
  providerCode: string
  displayName: string
  adapterType: string
  baseUrl: string | null
  endpointPath: string | null
  authType: string
  timeoutMs: number
  isActive: boolean
  privacyLevel: string
  allowsStudentData: boolean
  allowsChat: boolean
  allowsFitFinder: boolean
  apiKeyLast4: string | null
  apiKeyFingerprint: string | null
  apiKeyKeyVersion: string | null
  hasStoredKey: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AdminAIGatewayModelRecord {
  id: string
  providerAccountId: string
  providerCode: string | null
  providerDisplayName: string | null
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
  createdAt?: string
  updatedAt?: string
}

export interface AdminAIGatewayPolicyRecord {
  id: string
  useCase: string
  modelId: string
  modelName: string | null
  modelDisplayName: string | null
  providerCode: string | null
  providerDisplayName: string | null
  priority: number
  isActive: boolean
  fallbackEnabled: boolean
  maxAttempts: number
  timeoutMs: number | null
  allowEnvFallback: boolean
  notes: string | null
  createdAt?: string
  updatedAt?: string
}

export interface AdminAIGatewayHealthRecord {
  id: string
  providerAccountId: string
  modelId: string
  providerCode: string | null
  providerDisplayName: string | null
  modelName: string | null
  modelDisplayName: string | null
  consecutiveFailures: number
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastErrorType: string | null
  cooldownUntil: string | null
}

export function createAIGatewayServiceClient(env: AIRuntimeEnv) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  return key ? createServiceClient(key) : null
}

export function isAIGatewayEnvFallbackEnabled(env: AIRuntimeEnv): boolean {
  return (env.AI_GATEWAY_ENV_FALLBACK_ENABLED ?? '').trim().toLowerCase() === 'true'
}

function mapProviderAccount(row: any): AIGatewayProviderAccount | null {
  if (!row?.id || !row.provider_code || !row.adapter_type || !row.auth_type) return null
  return {
    id: row.id,
    providerCode: row.provider_code,
    displayName: row.display_name,
    adapterType: row.adapter_type,
    baseUrl: row.base_url ?? null,
    endpointPath: row.endpoint_path ?? null,
    authType: row.auth_type,
    apiKeyCiphertext: row.api_key_ciphertext,
    apiKeyIv: row.api_key_iv,
    apiKeyKeyVersion: row.api_key_key_version,
    apiKeyLast4: row.api_key_last4 ?? null,
    apiKeyFingerprint: row.api_key_fingerprint ?? null,
    timeoutMs: row.timeout_ms,
    isActive: row.is_active === true,
    privacyLevel: row.privacy_level,
    allowsStudentData: row.allows_student_data === true,
    allowsChat: row.allows_chat === true,
    allowsFitFinder: row.allows_fit_finder === true,
  }
}

function mapModel(row: any): AIGatewayModel | null {
  if (!row?.id || !row.provider_account_id || !row.model_name) return null
  return {
    id: row.id,
    providerAccountId: row.provider_account_id,
    modelName: row.model_name,
    displayName: row.display_name,
    isActive: row.is_active === true,
    supportsText: row.supports_text === true,
    supportsJsonMode: row.supports_json_mode === true,
    supportsStreaming: row.supports_streaming === true,
    supportsToolCalling: row.supports_tool_calling === true,
    maxOutputTokens: row.max_output_tokens ?? null,
    inputCostPerMillion: row.input_cost_per_million == null ? null : Number(row.input_cost_per_million),
    outputCostPerMillion: row.output_cost_per_million == null ? null : Number(row.output_cost_per_million),
    costTier: row.cost_tier ?? null,
  }
}

function mapPolicy(row: any): AIGatewayRoutingPolicy | null {
  if (!row?.id || !row?.use_case || !row?.model_id) return null
  return {
    id: row.id,
    useCase: row.use_case,
    modelId: row.model_id,
    priority: row.priority,
    isActive: row.is_active === true,
    fallbackEnabled: row.fallback_enabled === true,
    maxAttempts: row.max_attempts,
    timeoutMs: row.timeout_ms ?? null,
    allowEnvFallback: row.allow_env_fallback === true,
    notes: row.notes ?? null,
  }
}

function mapHealth(row: any): AIGatewayProviderHealth | null {
  if (!row?.id || !row?.provider_account_id || !row?.model_id) return null
  return {
    id: row.id,
    providerAccountId: row.provider_account_id,
    modelId: row.model_id,
    consecutiveFailures: row.consecutive_failures ?? 0,
    lastSuccessAt: row.last_success_at ?? null,
    lastFailureAt: row.last_failure_at ?? null,
    lastErrorType: row.last_error_type ?? null,
    cooldownUntil: row.cooldown_until ?? null,
  }
}

function mapAdminProviderRecord(row: any): AdminAIGatewayProviderRecord | null {
  if (!row?.id || !row?.provider_code || !row?.display_name) return null
  return {
    id: row.id,
    providerCode: row.provider_code,
    displayName: row.display_name,
    adapterType: row.adapter_type,
    baseUrl: row.base_url ?? null,
    endpointPath: row.endpoint_path ?? null,
    authType: row.auth_type,
    timeoutMs: row.timeout_ms,
    isActive: row.is_active === true,
    privacyLevel: row.privacy_level,
    allowsStudentData: row.allows_student_data === true,
    allowsChat: row.allows_chat === true,
    allowsFitFinder: row.allows_fit_finder === true,
    apiKeyLast4: row.api_key_last4 ?? null,
    apiKeyFingerprint: row.api_key_fingerprint ?? null,
    apiKeyKeyVersion: row.api_key_key_version ?? null,
    hasStoredKey: Boolean(row.api_key_ciphertext && row.api_key_iv && row.api_key_key_version),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

function mapAdminModelRecord(row: any): AdminAIGatewayModelRecord | null {
  if (!row?.id || !row?.provider_account_id || !row?.model_name) return null
  return {
    id: row.id,
    providerAccountId: row.provider_account_id,
    providerCode: row.ai_provider_accounts?.provider_code ?? null,
    providerDisplayName: row.ai_provider_accounts?.display_name ?? null,
    modelName: row.model_name,
    displayName: row.display_name,
    isActive: row.is_active === true,
    supportsText: row.supports_text === true,
    supportsJsonMode: row.supports_json_mode === true,
    supportsStreaming: row.supports_streaming === true,
    supportsToolCalling: row.supports_tool_calling === true,
    maxOutputTokens: row.max_output_tokens ?? null,
    inputCostPerMillion: row.input_cost_per_million == null ? null : Number(row.input_cost_per_million),
    outputCostPerMillion: row.output_cost_per_million == null ? null : Number(row.output_cost_per_million),
    costTier: row.cost_tier ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

function mapAdminPolicyRecord(row: any): AdminAIGatewayPolicyRecord | null {
  if (!row?.id || !row?.model_id || !row?.use_case) return null
  return {
    id: row.id,
    useCase: row.use_case,
    modelId: row.model_id,
    modelName: row.ai_models?.model_name ?? null,
    modelDisplayName: row.ai_models?.display_name ?? null,
    providerCode: row.ai_models?.ai_provider_accounts?.provider_code ?? null,
    providerDisplayName: row.ai_models?.ai_provider_accounts?.display_name ?? null,
    priority: row.priority,
    isActive: row.is_active === true,
    fallbackEnabled: row.fallback_enabled === true,
    maxAttempts: row.max_attempts,
    timeoutMs: row.timeout_ms ?? null,
    allowEnvFallback: row.allow_env_fallback === true,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

function mapAdminHealthRecord(row: any): AdminAIGatewayHealthRecord | null {
  if (!row?.id || !row?.provider_account_id || !row?.model_id) return null
  return {
    id: row.id,
    providerAccountId: row.provider_account_id,
    modelId: row.model_id,
    providerCode: row.ai_provider_accounts?.provider_code ?? null,
    providerDisplayName: row.ai_provider_accounts?.display_name ?? null,
    modelName: row.ai_models?.model_name ?? null,
    modelDisplayName: row.ai_models?.display_name ?? null,
    consecutiveFailures: row.consecutive_failures ?? 0,
    lastSuccessAt: row.last_success_at ?? null,
    lastFailureAt: row.last_failure_at ?? null,
    lastErrorType: row.last_error_type ?? null,
    cooldownUntil: row.cooldown_until ?? null,
  }
}

export async function loadAdminProviderAccounts(
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayProviderRecord[]> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return []

  const { data, error } = await serviceClient
    .from('ai_provider_accounts')
    .select(`
      id,
      provider_code,
      display_name,
      adapter_type,
      base_url,
      endpoint_path,
      auth_type,
      api_key_ciphertext,
      api_key_iv,
      api_key_key_version,
      api_key_last4,
      api_key_fingerprint,
      timeout_ms,
      is_active,
      privacy_level,
      allows_student_data,
      allows_chat,
      allows_fit_finder,
      created_at,
      updated_at
    `)
    .order('provider_code', { ascending: true })

  if (error) {
    console.error('ai gateway store: ai_provider_accounts read failed:', error.message)
    return []
  }

  return (data ?? [])
    .map(mapAdminProviderRecord)
    .filter((row): row is AdminAIGatewayProviderRecord => row !== null)
}

export async function loadAdminModels(
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayModelRecord[]> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return []

  const { data, error } = await serviceClient
    .from('ai_models')
    .select(`
      id,
      provider_account_id,
      model_name,
      display_name,
      is_active,
      supports_text,
      supports_json_mode,
      supports_streaming,
      supports_tool_calling,
      max_output_tokens,
      input_cost_per_million,
      output_cost_per_million,
      cost_tier,
      created_at,
      updated_at,
      ai_provider_accounts (
        provider_code,
        display_name
      )
    `)
    .order('display_name', { ascending: true })

  if (error) {
    console.error('ai gateway store: ai_models read failed:', error.message)
    return []
  }

  return (data ?? [])
    .map(mapAdminModelRecord)
    .filter((row): row is AdminAIGatewayModelRecord => row !== null)
}

export async function loadAdminRoutingPolicies(
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayPolicyRecord[]> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return []

  const { data, error } = await serviceClient
    .from('ai_routing_policies')
    .select(`
      id,
      use_case,
      model_id,
      priority,
      is_active,
      fallback_enabled,
      max_attempts,
      timeout_ms,
      allow_env_fallback,
      notes,
      created_at,
      updated_at,
      ai_models (
        model_name,
        display_name,
        ai_provider_accounts (
          provider_code,
          display_name
        )
      )
    `)
    .order('use_case', { ascending: true })
    .order('priority', { ascending: true })

  if (error) {
    console.error('ai gateway store: ai_routing_policies admin read failed:', error.message)
    return []
  }

  return (data ?? [])
    .map(mapAdminPolicyRecord)
    .filter((row): row is AdminAIGatewayPolicyRecord => row !== null)
}

export async function loadAdminProviderHealth(
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayHealthRecord[]> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return []

  const { data, error } = await serviceClient
    .from('ai_provider_health')
    .select(`
      id,
      provider_account_id,
      model_id,
      consecutive_failures,
      last_success_at,
      last_failure_at,
      last_error_type,
      cooldown_until,
      ai_provider_accounts (
        provider_code,
        display_name
      ),
      ai_models (
        model_name,
        display_name
      )
    `)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('ai gateway store: ai_provider_health admin read failed:', error.message)
    return []
  }

  return (data ?? [])
    .map(mapAdminHealthRecord)
    .filter((row): row is AdminAIGatewayHealthRecord => row !== null)
}

export async function getProviderAccountById(
  providerAccountId: string,
  env: AIRuntimeEnv,
): Promise<AIGatewayProviderAccount | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_provider_accounts')
    .select(`
      id,
      provider_code,
      display_name,
      adapter_type,
      base_url,
      endpoint_path,
      auth_type,
      api_key_ciphertext,
      api_key_iv,
      api_key_key_version,
      api_key_last4,
      api_key_fingerprint,
      timeout_ms,
      is_active,
      privacy_level,
      allows_student_data,
      allows_chat,
      allows_fit_finder
    `)
    .eq('id', providerAccountId)
    .maybeSingle()

  if (error) {
    console.error('ai gateway store: ai_provider_accounts single read failed:', error.message)
    return null
  }

  return mapProviderAccount(data)
}

export async function getModelById(
  modelId: string,
  env: AIRuntimeEnv,
): Promise<AIGatewayModel | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_models')
    .select(`
      id,
      provider_account_id,
      model_name,
      display_name,
      is_active,
      supports_text,
      supports_json_mode,
      supports_streaming,
      supports_tool_calling,
      max_output_tokens,
      input_cost_per_million,
      output_cost_per_million,
      cost_tier
    `)
    .eq('id', modelId)
    .maybeSingle()

  if (error) {
    console.error('ai gateway store: ai_models single read failed:', error.message)
    return null
  }

  return mapModel(data)
}

export async function createProviderAccount(
  input: {
    providerCode: string
    displayName: string
    adapterType: string
    baseUrl: string | null
    endpointPath: string | null
    authType: string
    timeoutMs: number
    isActive: boolean
    privacyLevel: string
    allowsStudentData: boolean
    allowsChat: boolean
    allowsFitFinder: boolean
    apiKeyCiphertext: string
    apiKeyIv: string
    apiKeyKeyVersion: string
    apiKeyLast4: string | null
    apiKeyFingerprint: string
  },
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayProviderRecord | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_provider_accounts')
    .insert({
      provider_code: input.providerCode,
      display_name: input.displayName,
      adapter_type: input.adapterType,
      base_url: input.baseUrl,
      endpoint_path: input.endpointPath,
      auth_type: input.authType,
      timeout_ms: input.timeoutMs,
      is_active: input.isActive,
      privacy_level: input.privacyLevel,
      allows_student_data: input.allowsStudentData,
      allows_chat: input.allowsChat,
      allows_fit_finder: input.allowsFitFinder,
      api_key_ciphertext: input.apiKeyCiphertext,
      api_key_iv: input.apiKeyIv,
      api_key_key_version: input.apiKeyKeyVersion,
      api_key_last4: input.apiKeyLast4,
      api_key_fingerprint: input.apiKeyFingerprint,
    })
    .select(`
      id,
      provider_code,
      display_name,
      adapter_type,
      base_url,
      endpoint_path,
      auth_type,
      api_key_ciphertext,
      api_key_iv,
      api_key_key_version,
      api_key_last4,
      api_key_fingerprint,
      timeout_ms,
      is_active,
      privacy_level,
      allows_student_data,
      allows_chat,
      allows_fit_finder,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error('ai gateway store: ai_provider_accounts create failed:', error.message)
    return null
  }

  return mapAdminProviderRecord(data)
}

export async function updateProviderAccountMetadata(
  providerAccountId: string,
  input: {
    providerCode: string
    displayName: string
    adapterType: string
    baseUrl: string | null
    endpointPath: string | null
    authType: string
    timeoutMs: number
    isActive: boolean
    privacyLevel: string
    allowsStudentData: boolean
    allowsChat: boolean
    allowsFitFinder: boolean
  },
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayProviderRecord | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_provider_accounts')
    .update({
      provider_code: input.providerCode,
      display_name: input.displayName,
      adapter_type: input.adapterType,
      base_url: input.baseUrl,
      endpoint_path: input.endpointPath,
      auth_type: input.authType,
      timeout_ms: input.timeoutMs,
      is_active: input.isActive,
      privacy_level: input.privacyLevel,
      allows_student_data: input.allowsStudentData,
      allows_chat: input.allowsChat,
      allows_fit_finder: input.allowsFitFinder,
    })
    .eq('id', providerAccountId)
    .select(`
      id,
      provider_code,
      display_name,
      adapter_type,
      base_url,
      endpoint_path,
      auth_type,
      api_key_ciphertext,
      api_key_iv,
      api_key_key_version,
      api_key_last4,
      api_key_fingerprint,
      timeout_ms,
      is_active,
      privacy_level,
      allows_student_data,
      allows_chat,
      allows_fit_finder,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error('ai gateway store: ai_provider_accounts update failed:', error.message)
    return null
  }

  return mapAdminProviderRecord(data)
}

export async function replaceProviderApiKey(
  providerAccountId: string,
  input: {
    apiKeyCiphertext: string
    apiKeyIv: string
    apiKeyKeyVersion: string
    apiKeyLast4: string | null
    apiKeyFingerprint: string
  },
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayProviderRecord | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_provider_accounts')
    .update({
      api_key_ciphertext: input.apiKeyCiphertext,
      api_key_iv: input.apiKeyIv,
      api_key_key_version: input.apiKeyKeyVersion,
      api_key_last4: input.apiKeyLast4,
      api_key_fingerprint: input.apiKeyFingerprint,
    })
    .eq('id', providerAccountId)
    .select(`
      id,
      provider_code,
      display_name,
      adapter_type,
      base_url,
      endpoint_path,
      auth_type,
      api_key_ciphertext,
      api_key_iv,
      api_key_key_version,
      api_key_last4,
      api_key_fingerprint,
      timeout_ms,
      is_active,
      privacy_level,
      allows_student_data,
      allows_chat,
      allows_fit_finder,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error('ai gateway store: ai_provider_accounts key replace failed:', error.message)
    return null
  }

  return mapAdminProviderRecord(data)
}

export async function createModel(
  input: {
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
  },
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayModelRecord | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_models')
    .insert({
      provider_account_id: input.providerAccountId,
      model_name: input.modelName,
      display_name: input.displayName,
      is_active: input.isActive,
      supports_text: input.supportsText,
      supports_json_mode: input.supportsJsonMode,
      supports_streaming: input.supportsStreaming,
      supports_tool_calling: input.supportsToolCalling,
      max_output_tokens: input.maxOutputTokens,
      input_cost_per_million: input.inputCostPerMillion,
      output_cost_per_million: input.outputCostPerMillion,
      cost_tier: input.costTier,
    })
    .select(`
      id,
      provider_account_id,
      model_name,
      display_name,
      is_active,
      supports_text,
      supports_json_mode,
      supports_streaming,
      supports_tool_calling,
      max_output_tokens,
      input_cost_per_million,
      output_cost_per_million,
      cost_tier,
      created_at,
      updated_at,
      ai_provider_accounts (
        provider_code,
        display_name
      )
    `)
    .single()

  if (error) {
    console.error('ai gateway store: ai_models create failed:', error.message)
    return null
  }

  return mapAdminModelRecord(data)
}

export async function updateModel(
  modelId: string,
  input: {
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
  },
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayModelRecord | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_models')
    .update({
      provider_account_id: input.providerAccountId,
      model_name: input.modelName,
      display_name: input.displayName,
      is_active: input.isActive,
      supports_text: input.supportsText,
      supports_json_mode: input.supportsJsonMode,
      supports_streaming: input.supportsStreaming,
      supports_tool_calling: input.supportsToolCalling,
      max_output_tokens: input.maxOutputTokens,
      input_cost_per_million: input.inputCostPerMillion,
      output_cost_per_million: input.outputCostPerMillion,
      cost_tier: input.costTier,
    })
    .eq('id', modelId)
    .select(`
      id,
      provider_account_id,
      model_name,
      display_name,
      is_active,
      supports_text,
      supports_json_mode,
      supports_streaming,
      supports_tool_calling,
      max_output_tokens,
      input_cost_per_million,
      output_cost_per_million,
      cost_tier,
      created_at,
      updated_at,
      ai_provider_accounts (
        provider_code,
        display_name
      )
    `)
    .single()

  if (error) {
    console.error('ai gateway store: ai_models update failed:', error.message)
    return null
  }

  return mapAdminModelRecord(data)
}

export async function createRoutingPolicy(
  input: {
    useCase: string
    modelId: string
    priority: number
    isActive: boolean
    fallbackEnabled: boolean
    maxAttempts: number
    timeoutMs: number | null
    allowEnvFallback: boolean
    notes: string | null
  },
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayPolicyRecord | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_routing_policies')
    .insert({
      use_case: input.useCase,
      model_id: input.modelId,
      priority: input.priority,
      is_active: input.isActive,
      fallback_enabled: input.fallbackEnabled,
      max_attempts: input.maxAttempts,
      timeout_ms: input.timeoutMs,
      allow_env_fallback: input.allowEnvFallback,
      notes: input.notes,
    })
    .select(`
      id,
      use_case,
      model_id,
      priority,
      is_active,
      fallback_enabled,
      max_attempts,
      timeout_ms,
      allow_env_fallback,
      notes,
      created_at,
      updated_at,
      ai_models (
        model_name,
        display_name,
        ai_provider_accounts (
          provider_code,
          display_name
        )
      )
    `)
    .single()

  if (error) {
    console.error('ai gateway store: ai_routing_policies create failed:', error.message)
    return null
  }

  return mapAdminPolicyRecord(data)
}

export async function updateRoutingPolicy(
  policyId: string,
  input: {
    useCase: string
    modelId: string
    priority: number
    isActive: boolean
    fallbackEnabled: boolean
    maxAttempts: number
    timeoutMs: number | null
    allowEnvFallback: boolean
    notes: string | null
  },
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayPolicyRecord | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_routing_policies')
    .update({
      use_case: input.useCase,
      model_id: input.modelId,
      priority: input.priority,
      is_active: input.isActive,
      fallback_enabled: input.fallbackEnabled,
      max_attempts: input.maxAttempts,
      timeout_ms: input.timeoutMs,
      allow_env_fallback: input.allowEnvFallback,
      notes: input.notes,
    })
    .eq('id', policyId)
    .select(`
      id,
      use_case,
      model_id,
      priority,
      is_active,
      fallback_enabled,
      max_attempts,
      timeout_ms,
      allow_env_fallback,
      notes,
      created_at,
      updated_at,
      ai_models (
        model_name,
        display_name,
        ai_provider_accounts (
          provider_code,
          display_name
        )
      )
    `)
    .single()

  if (error) {
    console.error('ai gateway store: ai_routing_policies update failed:', error.message)
    return null
  }

  return mapAdminPolicyRecord(data)
}

export async function deleteRoutingPolicy(
  policyId: string,
  env: AIRuntimeEnv,
): Promise<boolean> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return false

  const { error } = await serviceClient
    .from('ai_routing_policies')
    .delete()
    .eq('id', policyId)

  if (error) {
    console.error('ai gateway store: ai_routing_policies delete failed:', error.message)
    return false
  }

  return true
}

export async function resetProviderHealth(
  healthId: string,
  env: AIRuntimeEnv,
): Promise<AdminAIGatewayHealthRecord | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_provider_health')
    .update({
      consecutive_failures: 0,
      last_error_type: null,
      cooldown_until: null,
    })
    .eq('id', healthId)
    .select(`
      id,
      provider_account_id,
      model_id,
      consecutive_failures,
      last_success_at,
      last_failure_at,
      last_error_type,
      cooldown_until,
      ai_provider_accounts (
        provider_code,
        display_name
      ),
      ai_models (
        model_name,
        display_name
      )
    `)
    .single()

  if (error) {
    console.error('ai gateway store: ai_provider_health reset failed:', error.message)
    return null
  }

  return mapAdminHealthRecord(data)
}

export async function loadRoutingCandidates(
  useCase: AIUseCase,
  env: AIRuntimeEnv,
): Promise<AIGatewayRoutingCandidate[]> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return []

  const { data: policyRows, error: policyError } = await serviceClient
    .from('ai_routing_policies')
    .select(`
      id,
      use_case,
      model_id,
      priority,
      is_active,
      fallback_enabled,
      max_attempts,
      timeout_ms,
      allow_env_fallback,
      notes,
      ai_models (
        id,
        provider_account_id,
        model_name,
        display_name,
        is_active,
        supports_text,
        supports_json_mode,
        supports_streaming,
        supports_tool_calling,
        max_output_tokens,
        input_cost_per_million,
        output_cost_per_million,
        cost_tier,
        ai_provider_accounts (
          id,
          provider_code,
          display_name,
          adapter_type,
          base_url,
          endpoint_path,
          auth_type,
          api_key_ciphertext,
          api_key_iv,
          api_key_key_version,
          api_key_last4,
          api_key_fingerprint,
          timeout_ms,
          is_active,
          privacy_level,
          allows_student_data,
          allows_chat,
          allows_fit_finder
        )
      )
    `)
    .eq('use_case', useCase)
    .order('priority', { ascending: true })

  if (policyError) {
    console.error('ai gateway store: ai_routing_policies read failed:', policyError.message)
    return []
  }

  const modelIds = (policyRows ?? [])
    .map((row: any) => row.model_id)
    .filter((value: unknown): value is string => typeof value === 'string')

  const healthByModelId = new Map<string, AIGatewayProviderHealth>()
  if (modelIds.length > 0) {
    const { data: healthRows, error: healthError } = await serviceClient
      .from('ai_provider_health')
      .select('id, provider_account_id, model_id, consecutive_failures, last_success_at, last_failure_at, last_error_type, cooldown_until')
      .in('model_id', modelIds)

    if (healthError) {
      console.error('ai gateway store: ai_provider_health read failed:', healthError.message)
    } else {
      for (const row of healthRows ?? []) {
        const health = mapHealth(row)
        if (health) healthByModelId.set(health.modelId, health)
      }
    }
  }

  const candidates: AIGatewayRoutingCandidate[] = []
  for (const row of policyRows ?? []) {
    const policy = mapPolicy(row)
    const model = mapModel((row as any).ai_models)
    const providerAccount = mapProviderAccount((row as any).ai_models?.ai_provider_accounts)
    if (!policy || !model || !providerAccount) continue

    candidates.push({
      policy,
      model,
      providerAccount,
      health: healthByModelId.get(model.id) ?? null,
    })
  }

  return candidates
}
