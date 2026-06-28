// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
import type {
  AIPrompt,
  AIProvider,
  AIProviderConfig,
  AIProviderErrorCategory,
  AIUseCase,
  AIRuntimeEnv,
  AIGatewayAttemptFailure,
  AIGatewayCallContext,
  AIGatewayFailure,
  AIGatewayRoutingCandidate,
  AIGatewaySuccess,
} from './types'
import { createGeminiProvider, AIProviderError, isAIProviderError } from './providers/gemini'
import { createOpenRouterProvider } from './providers/openrouter'
import { createOpenAICompatibleProvider } from './providers/openai-compatible'
import { decryptProviderApiKey } from './admin/crypto'
import { isAIGatewayEnvFallbackEnabled, loadRoutingCandidates } from './admin/store'
import {
  isRecoverableProviderFailure,
  updateProviderHealthOnFailure,
  updateProviderHealthOnSuccess,
  writeGatewayCallLog,
} from './call-logs'

export interface AIRouterRequest {
  useCase: AIUseCase
  prompt: AIPrompt
  temperature: number
  maxOutputTokens: number
  env: AIRuntimeEnv
  context: AIGatewayCallContext
}

function useCaseRequiresStudentData(useCase: AIUseCase): boolean {
  return useCase === 'fit_finder_summary' || useCase === 'chat_answer'
}

function providerAllowsUseCase(candidate: AIGatewayRoutingCandidate, useCase: AIUseCase): boolean {
  if (useCaseRequiresStudentData(useCase) && !candidate.providerAccount.allowsStudentData) return false
  if (useCase === 'fit_finder_summary' && !candidate.providerAccount.allowsFitFinder) return false
  if (useCase === 'chat_answer' && !candidate.providerAccount.allowsChat) return false
  return true
}

function isCooldownActive(candidate: AIGatewayRoutingCandidate): boolean {
  const cooldownUntil = candidate.health?.cooldownUntil
  if (!cooldownUntil) return false
  return new Date(cooldownUntil).getTime() > Date.now()
}

function getProviderConfig(
  candidate: AIGatewayRoutingCandidate,
  request: AIRouterRequest,
): AIProviderConfig {
  const timeoutMs = candidate.policy.timeoutMs ?? candidate.providerAccount.timeoutMs
  const maxOutputTokens = candidate.model.maxOutputTokens == null
    ? request.maxOutputTokens
    : Math.min(request.maxOutputTokens, candidate.model.maxOutputTokens)

  return {
    model: candidate.model.modelName,
    temperature: request.temperature,
    maxOutputTokens,
    timeoutMs,
  }
}

function createProviderForCandidate(
  candidate: AIGatewayRoutingCandidate,
  apiKey: string,
): AIProvider | null {
  if (candidate.providerAccount.adapterType === 'openai_compatible' && candidate.providerAccount.baseUrl) {
    return createOpenAICompatibleProvider({
      apiKey,
      baseUrl: candidate.providerAccount.baseUrl,
      endpointPath: candidate.providerAccount.endpointPath,
    })
  }
  return null
}

function buildAttemptFailure(
  providerCode: string,
  modelName: string,
  category: AIProviderErrorCategory,
  status?: number,
): AIGatewayAttemptFailure {
  return { providerCode, modelName, category, status }
}

function estimateCostUsd(
  promptTokens: number,
  completionTokens: number,
  candidate: AIGatewayRoutingCandidate,
): number | null {
  const inputRate = candidate.model.inputCostPerMillion
  const outputRate = candidate.model.outputCostPerMillion
  if (inputRate == null && outputRate == null) return null

  const promptCost = inputRate == null ? 0 : (promptTokens / 1_000_000) * inputRate
  const completionCost = outputRate == null ? 0 : (completionTokens / 1_000_000) * outputRate
  return Number((promptCost + completionCost).toFixed(8))
}

function envFallbackAllowed(candidates: AIGatewayRoutingCandidate[], env: AIRuntimeEnv): boolean {
  if (!isAIGatewayEnvFallbackEnabled(env)) return false
  if (candidates.length === 0) return true
  return candidates.some(candidate => candidate.policy.allowEnvFallback)
}

function envProviderName(env: AIRuntimeEnv): string {
  return env.AI_PROVIDER ?? 'gemini'
}

function envModelName(env: AIRuntimeEnv): string {
  return env.AI_MODEL ?? 'gemini-2.5-flash'
}

function envProviderConfig(request: AIRouterRequest): AIProviderConfig {
  return {
    model: envModelName(request.env),
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
    timeoutMs: 30000,
  }
}

function resolveEnvProvider(env: AIRuntimeEnv): AIProvider {
  const providerName = envProviderName(env)
  if (providerName === 'gemini') {
    if (!env.GEMINI_API_KEY) throw new AIProviderError('Gemini provider is not configured', 'provider_unavailable')
    return createGeminiProvider(env.GEMINI_API_KEY)
  }
  if (providerName === 'openrouter') {
    if (!env.OPENROUTER_API_KEY) throw new AIProviderError('OpenRouter provider is not configured', 'provider_unavailable')
    return createOpenRouterProvider(env.OPENROUTER_API_KEY)
  }
  throw new AIProviderError('Requested AI provider is not available', 'provider_unavailable')
}

async function runEnvFallback(
  request: AIRouterRequest,
  fallbackAttemptNumber: number,
  fallbackFromCallId: string | null,
): Promise<AIGatewaySuccess | AIGatewayFailure> {
  const providerCode = envProviderName(request.env)
  const modelName = envModelName(request.env)
  const start = Date.now()

  try {
    const provider = resolveEnvProvider(request.env)
    const response = await provider.complete(request.prompt, envProviderConfig(request))
    const logId = await writeGatewayCallLog(
      {
        useCase: request.useCase,
        providerAccountId: null,
        modelId: null,
        providerCode,
        modelName: response.modelUsed,
        status: 'env_fallback_success',
        providerHttpStatus: null,
        latencyMs: Date.now() - start,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.promptTokens + response.completionTokens,
        estimatedCostUsd: null,
        wasFallback: true,
        fallbackAttemptNumber,
        fallbackFromCallId,
        userId: request.context.userId ?? null,
        anonymousSessionId: request.context.anonymousSessionId ?? null,
        aiFinderResultId: request.context.aiFinderResultId ?? null,
        aiConversationId: request.context.aiConversationId ?? null,
        aiMessageId: request.context.aiMessageId ?? null,
      },
      request.env,
    )

    return {
      response,
      providerCode,
      modelName: response.modelUsed,
      providerAccountId: null,
      modelId: null,
      usedEnvFallback: true,
      logId,
    }
  } catch (error) {
    const category = isAIProviderError(error) ? error.category : 'unknown_error'
    const status = isAIProviderError(error) ? error.status : undefined
    await writeGatewayCallLog(
      {
        useCase: request.useCase,
        providerAccountId: null,
        modelId: null,
        providerCode,
        modelName,
        status: 'env_fallback_failure',
        normalizedErrorType: category,
        providerHttpStatus: status ?? null,
        latencyMs: Date.now() - start,
        wasFallback: true,
        fallbackAttemptNumber,
        fallbackFromCallId,
        userId: request.context.userId ?? null,
        anonymousSessionId: request.context.anonymousSessionId ?? null,
        aiFinderResultId: request.context.aiFinderResultId ?? null,
        aiConversationId: request.context.aiConversationId ?? null,
        aiMessageId: request.context.aiMessageId ?? null,
      },
      request.env,
    )

    return {
      usedEnvFallback: true,
      failure: buildAttemptFailure(providerCode, modelName, category, status),
    }
  }
}

export async function runAIGatewayRoute(
  request: AIRouterRequest,
): Promise<AIGatewaySuccess | AIGatewayFailure> {
  const candidates = await loadRoutingCandidates(request.useCase, request.env)
  const candidateCount = candidates.length
  let lastFailure: AIGatewayAttemptFailure | null = null
  let lastFailureLogId: string | null = null
  let fallbackAttemptNumber = 0
  let sawEligibleCandidate = false
  let lastFailureReason: AIGatewayFailure['diagnosticReason'] | undefined

  for (const candidate of candidates) {
    if (!candidate.policy.isActive || !candidate.model.isActive || !candidate.providerAccount.isActive) {
      await writeGatewayCallLog(
        {
          useCase: request.useCase,
          providerAccountId: candidate.providerAccount.id,
          modelId: candidate.model.id,
          providerCode: candidate.providerAccount.providerCode,
          modelName: candidate.model.modelName,
          status: 'skipped_inactive',
          wasFallback: fallbackAttemptNumber > 0,
          fallbackAttemptNumber,
          userId: request.context.userId ?? null,
          anonymousSessionId: request.context.anonymousSessionId ?? null,
          aiFinderResultId: request.context.aiFinderResultId ?? null,
          aiConversationId: request.context.aiConversationId ?? null,
          aiMessageId: request.context.aiMessageId ?? null,
        },
        request.env,
      )
      continue
    }

    if (!providerAllowsUseCase(candidate, request.useCase)) {
      await writeGatewayCallLog(
        {
          useCase: request.useCase,
          providerAccountId: candidate.providerAccount.id,
          modelId: candidate.model.id,
          providerCode: candidate.providerAccount.providerCode,
          modelName: candidate.model.modelName,
          status: 'blocked_by_policy',
          wasFallback: fallbackAttemptNumber > 0,
          fallbackAttemptNumber,
          userId: request.context.userId ?? null,
          anonymousSessionId: request.context.anonymousSessionId ?? null,
          aiFinderResultId: request.context.aiFinderResultId ?? null,
          aiConversationId: request.context.aiConversationId ?? null,
          aiMessageId: request.context.aiMessageId ?? null,
        },
        request.env,
      )
      continue
    }

    if (isCooldownActive(candidate)) {
      await writeGatewayCallLog(
        {
          useCase: request.useCase,
          providerAccountId: candidate.providerAccount.id,
          modelId: candidate.model.id,
          providerCode: candidate.providerAccount.providerCode,
          modelName: candidate.model.modelName,
          status: 'skipped_cooldown',
          wasFallback: fallbackAttemptNumber > 0,
          fallbackAttemptNumber,
          userId: request.context.userId ?? null,
          anonymousSessionId: request.context.anonymousSessionId ?? null,
          aiFinderResultId: request.context.aiFinderResultId ?? null,
          aiConversationId: request.context.aiConversationId ?? null,
          aiMessageId: request.context.aiMessageId ?? null,
        },
        request.env,
      )
      continue
    }

    sawEligibleCandidate = true

    let apiKey: string
    try {
      apiKey = await decryptProviderApiKey(candidate.providerAccount, request.env)
    } catch {
      lastFailureReason = 'provider_setup_failed'
      lastFailure = buildAttemptFailure(
        candidate.providerAccount.providerCode,
        candidate.model.modelName,
        'unknown_error',
      )
      lastFailureLogId = await writeGatewayCallLog(
        {
          useCase: request.useCase,
          providerAccountId: candidate.providerAccount.id,
          modelId: candidate.model.id,
          providerCode: candidate.providerAccount.providerCode,
          modelName: candidate.model.modelName,
          status: 'failure',
          normalizedErrorType: 'unknown_error',
          wasFallback: fallbackAttemptNumber > 0,
          fallbackAttemptNumber,
          userId: request.context.userId ?? null,
          anonymousSessionId: request.context.anonymousSessionId ?? null,
          aiFinderResultId: request.context.aiFinderResultId ?? null,
          aiConversationId: request.context.aiConversationId ?? null,
          aiMessageId: request.context.aiMessageId ?? null,
        },
        request.env,
      )
      break
    }

    const provider = createProviderForCandidate(candidate, apiKey)
    if (!provider) {
      lastFailureReason = 'provider_setup_failed'
      lastFailure = buildAttemptFailure(
        candidate.providerAccount.providerCode,
        candidate.model.modelName,
        'unknown_error',
      )
      lastFailureLogId = await writeGatewayCallLog(
        {
          useCase: request.useCase,
          providerAccountId: candidate.providerAccount.id,
          modelId: candidate.model.id,
          providerCode: candidate.providerAccount.providerCode,
          modelName: candidate.model.modelName,
          status: 'failure',
          normalizedErrorType: 'unknown_error',
          wasFallback: fallbackAttemptNumber > 0,
          fallbackAttemptNumber,
          userId: request.context.userId ?? null,
          anonymousSessionId: request.context.anonymousSessionId ?? null,
          aiFinderResultId: request.context.aiFinderResultId ?? null,
          aiConversationId: request.context.aiConversationId ?? null,
          aiMessageId: request.context.aiMessageId ?? null,
        },
        request.env,
      )
      break
    }

    const providerConfig = getProviderConfig(candidate, request)
    const startedAt = Date.now()

    try {
      const response = await provider.complete(request.prompt, providerConfig)
      const estimatedCostUsd = estimateCostUsd(
        response.promptTokens,
        response.completionTokens,
        candidate,
      )
      const logId = await writeGatewayCallLog(
        {
          useCase: request.useCase,
          providerAccountId: candidate.providerAccount.id,
          modelId: candidate.model.id,
          providerCode: candidate.providerAccount.providerCode,
          modelName: response.modelUsed,
          status: 'success',
          latencyMs: Date.now() - startedAt,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.promptTokens + response.completionTokens,
          estimatedCostUsd,
          wasFallback: fallbackAttemptNumber > 0,
          fallbackAttemptNumber,
          fallbackFromCallId: lastFailureLogId,
          userId: request.context.userId ?? null,
          anonymousSessionId: request.context.anonymousSessionId ?? null,
          aiFinderResultId: request.context.aiFinderResultId ?? null,
          aiConversationId: request.context.aiConversationId ?? null,
          aiMessageId: request.context.aiMessageId ?? null,
        },
        request.env,
      )
      await updateProviderHealthOnSuccess(candidate, request.env)

      return {
        response,
        providerCode: candidate.providerAccount.providerCode,
        modelName: response.modelUsed,
        providerAccountId: candidate.providerAccount.id,
        modelId: candidate.model.id,
        usedEnvFallback: false,
        logId,
      }
    } catch (error) {
      lastFailureReason = 'provider_request_failed'
      const category = isAIProviderError(error) ? error.category : 'unknown_error'
      const status = isAIProviderError(error) ? error.status : undefined
      lastFailure = buildAttemptFailure(
        candidate.providerAccount.providerCode,
        candidate.model.modelName,
        category,
        status,
      )
      lastFailureLogId = await writeGatewayCallLog(
        {
          useCase: request.useCase,
          providerAccountId: candidate.providerAccount.id,
          modelId: candidate.model.id,
          providerCode: candidate.providerAccount.providerCode,
          modelName: candidate.model.modelName,
          status: 'failure',
          normalizedErrorType: category,
          providerHttpStatus: status ?? null,
          latencyMs: Date.now() - startedAt,
          wasFallback: fallbackAttemptNumber > 0,
          fallbackAttemptNumber,
          fallbackFromCallId: lastFailureLogId,
          userId: request.context.userId ?? null,
          anonymousSessionId: request.context.anonymousSessionId ?? null,
          aiFinderResultId: request.context.aiFinderResultId ?? null,
          aiConversationId: request.context.aiConversationId ?? null,
          aiMessageId: request.context.aiMessageId ?? null,
        },
        request.env,
      )
      await updateProviderHealthOnFailure(candidate, category, request.env)

      fallbackAttemptNumber += 1
      if (!candidate.policy.fallbackEnabled || !isRecoverableProviderFailure(category)) {
        break
      }
    }
  }

  if (envFallbackAllowed(candidates, request.env)) {
    return runEnvFallback(request, fallbackAttemptNumber, lastFailureLogId)
  }

  return {
    usedEnvFallback: false,
    failure: lastFailure,
    diagnosticReason: lastFailure
      ? (lastFailureReason ?? 'provider_request_failed')
      : candidateCount === 0
        ? 'no_candidates'
        : sawEligibleCandidate
          ? 'provider_setup_failed'
          : 'no_eligible_candidates',
    candidateCount,
  }
}
