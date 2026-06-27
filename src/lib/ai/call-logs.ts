// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
import type {
  AIRuntimeEnv,
  AIGatewayCallLogEntry,
  AIGatewayRoutingCandidate,
  AIProviderErrorCategory,
} from './types'
import { createAIGatewayServiceClient } from './admin/store'

const FAILURE_THRESHOLD = 3
const COOLDOWN_MS = 10 * 60 * 1000

export function isRecoverableProviderFailure(category: AIProviderErrorCategory): boolean {
  return [
    'rate_limit',
    'quota_exceeded',
    'timeout',
    'provider_unavailable',
    'provider_5xx',
    'network_error',
    'invalid_provider_response',
  ].includes(category)
}

export async function writeGatewayCallLog(
  entry: AIGatewayCallLogEntry,
  env: AIRuntimeEnv,
): Promise<string | null> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return null

  const { data, error } = await serviceClient
    .from('ai_gateway_call_logs')
    .insert({
      use_case: entry.useCase,
      provider_account_id: entry.providerAccountId,
      model_id: entry.modelId,
      provider_code: entry.providerCode,
      model_name: entry.modelName,
      status: entry.status,
      normalized_error_type: entry.normalizedErrorType ?? null,
      provider_http_status: entry.providerHttpStatus ?? null,
      latency_ms: entry.latencyMs ?? null,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      total_tokens: entry.totalTokens ?? null,
      estimated_cost_usd: entry.estimatedCostUsd ?? null,
      was_fallback: entry.wasFallback,
      fallback_attempt_number: entry.fallbackAttemptNumber,
      fallback_from_call_id: entry.fallbackFromCallId ?? null,
      user_id: entry.userId ?? null,
      anonymous_session_id: entry.anonymousSessionId ?? null,
      ai_finder_result_id: entry.aiFinderResultId ?? null,
      ai_conversation_id: entry.aiConversationId ?? null,
      ai_message_id: entry.aiMessageId ?? null,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error('ai gateway logs: ai_gateway_call_logs write failed:', error?.message ?? 'no id returned')
    return null
  }

  return data.id as string
}

export async function updateProviderHealthOnSuccess(
  candidate: AIGatewayRoutingCandidate,
  env: AIRuntimeEnv,
): Promise<void> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return

  const now = new Date().toISOString()
  const payload = {
    provider_account_id: candidate.providerAccount.id,
    model_id: candidate.model.id,
    consecutive_failures: 0,
    last_success_at: now,
    cooldown_until: null,
    last_error_type: null,
  }

  const { error } = await serviceClient
    .from('ai_provider_health')
    .upsert(payload, { onConflict: 'provider_account_id,model_id' })

  if (error) {
    console.error('ai gateway logs: ai_provider_health success upsert failed:', error.message)
  }
}

export async function updateProviderHealthOnFailure(
  candidate: AIGatewayRoutingCandidate,
  errorType: AIProviderErrorCategory,
  env: AIRuntimeEnv,
): Promise<void> {
  const serviceClient = createAIGatewayServiceClient(env)
  if (!serviceClient) return

  const now = new Date()
  const currentFailures = candidate.health?.consecutiveFailures ?? 0
  const nextFailures = currentFailures + 1
  const cooldownUntil = isRecoverableProviderFailure(errorType) && nextFailures >= FAILURE_THRESHOLD
    ? new Date(now.getTime() + COOLDOWN_MS).toISOString()
    : null

  const payload = {
    provider_account_id: candidate.providerAccount.id,
    model_id: candidate.model.id,
    consecutive_failures: nextFailures,
    last_failure_at: now.toISOString(),
    last_error_type: errorType,
    cooldown_until: cooldownUntil,
  }

  const { error } = await serviceClient
    .from('ai_provider_health')
    .upsert(payload, { onConflict: 'provider_account_id,model_id' })

  if (error) {
    console.error('ai gateway logs: ai_provider_health failure upsert failed:', error.message)
  }
}
