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
