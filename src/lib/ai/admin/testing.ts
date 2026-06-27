// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
import { decryptProviderApiKey } from './crypto'
import {
  getModelById,
  getProviderAccountById,
  isAIGatewayEnvFallbackEnabled,
  loadRoutingCandidates,
} from './store'
import type {
  AIGatewayModel,
  AIGatewayProviderAccount,
  AIGatewayRoutingCandidate,
  AIPrompt,
  AIProvider,
  AIProviderErrorCategory,
  AIUseCase,
  AIRuntimeEnv,
  ChatResultProgram,
} from '../types'
import type { AIGatewayTestPresetId } from './constants'
import { buildFinderPrompt } from '../prompts/finder-summary'
import { buildChatPrompt } from '../prompts/chat-answer'
import { createGeminiProvider, AIProviderError, isAIProviderError } from '../providers/gemini'
import { createOpenAICompatibleProvider } from '../providers/openai-compatible'
import { createOpenRouterProvider } from '../providers/openrouter'

type TestTargetMode = 'use_case' | 'model'

interface AdminTestRunInput {
  presetId: AIGatewayTestPresetId
  targetMode: TestTargetMode
  useCase?: AIUseCase
  modelId?: string
  env: AIRuntimeEnv
}

interface SafePromptFixture {
  prompt: AIPrompt
  defaultUseCase: AIUseCase
}

export interface AdminProviderTestResult {
  success: boolean
  targetMode: TestTargetMode
  presetId: AIGatewayTestPresetId
  providerCode: string | null
  providerDisplayName: string | null
  modelName: string | null
  modelDisplayName: string | null
  latencyMs: number | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  normalizedErrorType: AIProviderErrorCategory | null
  providerHttpStatus: number | null
  usedEnvFallback: boolean
  responsePreview: string | null
}

function truncatePreview(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 240) return trimmed
  return `${trimmed.slice(0, 237)}...`
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

function isRecoverableProviderFailure(category: AIProviderErrorCategory): boolean {
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

function getProviderConfig(
  candidate: AIGatewayRoutingCandidate,
): { model: string; temperature: number; maxOutputTokens: number; timeoutMs: number } {
  const timeoutMs = candidate.policy.timeoutMs ?? candidate.providerAccount.timeoutMs
  const maxOutputTokens = candidate.model.maxOutputTokens == null
    ? 1024
    : Math.min(1024, candidate.model.maxOutputTokens)

  return {
    model: candidate.model.modelName,
    temperature: 0.2,
    maxOutputTokens,
    timeoutMs,
  }
}

function createProviderForAccount(
  providerAccount: AIGatewayProviderAccount,
  apiKey: string,
): AIProvider | null {
  if (providerAccount.adapterType === 'openai_compatible' && providerAccount.baseUrl) {
    return createOpenAICompatibleProvider({
      apiKey,
      baseUrl: providerAccount.baseUrl,
      endpointPath: providerAccount.endpointPath,
    })
  }
  return null
}

function envProviderName(env: AIRuntimeEnv): string {
  return env.AI_PROVIDER ?? 'gemini'
}

function envModelName(env: AIRuntimeEnv): string {
  return env.AI_MODEL ?? 'gemini-2.5-flash'
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

function envFallbackAllowed(candidates: AIGatewayRoutingCandidate[], env: AIRuntimeEnv): boolean {
  if (!isAIGatewayEnvFallbackEnabled(env)) return false
  if (candidates.length === 0) return true
  return candidates.some((candidate) => candidate.policy.allowEnvFallback)
}

function buildProgramsFixture(): ChatResultProgram[] {
  return [
    {
      rank: 1,
      title: 'MSc Data Science',
      university: 'Northern Coast University',
      country: 'Netherlands',
      city: 'Rotterdam',
      degreeLevel: 'Master',
      subject: 'Data Science',
      tuitionSummary: 'EUR 18,500 per year',
      officialUrl: 'https://example.edu/programs/msc-data-science',
      matchReasons: [
        'Matches the student target degree level.',
        'Strong fit with data analysis and Python interests.',
      ],
      warnings: [
        'Confirm final tuition and scholarship options on the official page.',
      ],
    },
    {
      rank: 2,
      title: 'MSc Business Analytics',
      university: 'Central City Institute',
      country: 'Ireland',
      city: 'Dublin',
      degreeLevel: 'Master',
      subject: 'Business Analytics',
      tuitionSummary: 'EUR 21,000 per year',
      officialUrl: 'https://example.edu/programs/msc-business-analytics',
      matchReasons: [
        'Combines analytics with industry-focused coursework.',
      ],
      warnings: [
        'Check internship availability and intake deadlines directly.',
      ],
    },
  ]
}

function buildFixture(presetId: AIGatewayTestPresetId): SafePromptFixture {
  const finderContext = {
    source: 'programs' as const,
    records: buildProgramsFixture().map((program) => ({
      title: program.title,
      university: program.university,
      country: program.country,
      city: program.city,
      degreeLevel: program.degreeLevel,
      subject: program.subject,
      tuitionRange: program.tuitionSummary,
      officialUrl: program.officialUrl,
      rank: program.rank,
      matchReasons: program.matchReasons,
      warnings: program.warnings,
    })),
    studentProfile: {
      degreeLevel: 'Master',
      subjects: ['Data Science', 'Analytics'],
      targetCountries: ['Netherlands', 'Ireland'],
      budgetMax: 22000,
      currency: 'EUR',
    },
  }

  const chatContext = {
    source: 'programs' as const,
    records: buildProgramsFixture() as unknown as Array<Record<string, unknown>>,
  }

  if (presetId === 'fit_finder_summary_style') {
    return {
      defaultUseCase: 'fit_finder_summary',
      prompt: buildFinderPrompt(finderContext),
    }
  }

  if (presetId === 'chat_answer_style') {
    return {
      defaultUseCase: 'chat_answer',
      prompt: buildChatPrompt(
        'Which of these programs looks stronger for a student who wants practical analytics work after graduation?',
        chatContext,
        'saved_result',
      ),
    }
  }

  if (presetId === 'do_not_invent_facts') {
    const sparseContext = {
      source: 'programs' as const,
      records: [
        {
          rank: 1,
          title: 'BA Global Studies',
          university: 'Harbor State University',
          country: 'Spain',
          city: 'Valencia',
          degreeLevel: 'Bachelor',
          subject: 'International Studies',
          tuitionSummary: null,
          officialUrl: 'https://example.edu/programs/ba-global-studies',
          matchReasons: ['Matches the student interest in international subjects.'],
          warnings: ['Deadline data is not currently stored in DegreeWiki.'],
        },
      ] as unknown as Array<Record<string, unknown>>,
    }

    return {
      defaultUseCase: 'chat_answer',
      prompt: buildChatPrompt(
        'What is the tuition and what are the application deadlines for this program?',
        sparseContext,
        'saved_result',
      ),
    }
  }

  const missingDataContext = {
    source: 'programs' as const,
    records: [
      {
        rank: 1,
        title: 'MSc Environmental Systems',
        university: 'Green Valley University',
        country: 'Sweden',
        city: null,
        degreeLevel: 'Master',
        subject: 'Environmental Science',
        tuitionSummary: null,
        officialUrl: 'https://example.edu/programs/msc-environmental-systems',
        matchReasons: ['Strong subject alignment.'],
        warnings: ['Tuition and city details are not fully populated yet.'],
      },
    ] as unknown as Array<Record<string, unknown>>,
  }

  return {
    defaultUseCase: 'chat_answer',
    prompt: buildChatPrompt(
      'What can I safely conclude from this saved result when some details are missing?',
      missingDataContext,
      'saved_result',
    ),
  }
}

async function runDirectModelTest(
  providerAccount: AIGatewayProviderAccount,
  model: AIGatewayModel,
  prompt: AIPrompt,
  presetId: AIGatewayTestPresetId,
  env: AIRuntimeEnv,
): Promise<AdminProviderTestResult> {
  const startedAt = Date.now()

  try {
    const apiKey = await decryptProviderApiKey(providerAccount, env)
    const provider = createProviderForAccount(providerAccount, apiKey)
    if (!provider) {
      return {
        success: false,
        targetMode: 'model',
        presetId,
        providerCode: providerAccount.providerCode,
        providerDisplayName: providerAccount.displayName,
        modelName: model.modelName,
        modelDisplayName: model.displayName,
        latencyMs: Date.now() - startedAt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        normalizedErrorType: 'unknown_error',
        providerHttpStatus: null,
        usedEnvFallback: false,
        responsePreview: null,
      }
    }

    const response = await provider.complete(prompt, {
      model: model.modelName,
      temperature: 0.2,
      maxOutputTokens: model.maxOutputTokens == null ? 1024 : Math.min(1024, model.maxOutputTokens),
      timeoutMs: providerAccount.timeoutMs,
    })

    return {
      success: true,
      targetMode: 'model',
      presetId,
      providerCode: providerAccount.providerCode,
      providerDisplayName: providerAccount.displayName,
      modelName: response.modelUsed,
      modelDisplayName: model.displayName,
      latencyMs: Date.now() - startedAt,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.promptTokens + response.completionTokens,
      normalizedErrorType: null,
      providerHttpStatus: null,
      usedEnvFallback: false,
      responsePreview: truncatePreview(response.text),
    }
  } catch (error) {
    return {
      success: false,
      targetMode: 'model',
      presetId,
      providerCode: providerAccount.providerCode,
      providerDisplayName: providerAccount.displayName,
      modelName: model.modelName,
      modelDisplayName: model.displayName,
      latencyMs: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      normalizedErrorType: isAIProviderError(error) ? error.category : 'unknown_error',
      providerHttpStatus: isAIProviderError(error) ? error.status ?? null : null,
      usedEnvFallback: false,
      responsePreview: null,
    }
  }
}

async function runRoutedUseCaseTest(
  useCase: AIUseCase,
  prompt: AIPrompt,
  presetId: AIGatewayTestPresetId,
  env: AIRuntimeEnv,
): Promise<AdminProviderTestResult> {
  const candidates = await loadRoutingCandidates(useCase, env)

  for (const candidate of candidates) {
    if (!candidate.policy.isActive || !candidate.model.isActive || !candidate.providerAccount.isActive) {
      continue
    }

    if (!providerAllowsUseCase(candidate, useCase)) {
      continue
    }

    if (isCooldownActive(candidate)) {
      continue
    }

    const startedAt = Date.now()

    try {
      const apiKey = await decryptProviderApiKey(candidate.providerAccount, env)
      const provider = createProviderForAccount(candidate.providerAccount, apiKey)
      if (!provider) {
        return {
          success: false,
          targetMode: 'use_case',
          presetId,
          providerCode: candidate.providerAccount.providerCode,
          providerDisplayName: candidate.providerAccount.displayName,
          modelName: candidate.model.modelName,
          modelDisplayName: candidate.model.displayName,
          latencyMs: Date.now() - startedAt,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          normalizedErrorType: 'unknown_error',
          providerHttpStatus: null,
          usedEnvFallback: false,
          responsePreview: null,
        }
      }

      const response = await provider.complete(prompt, getProviderConfig(candidate))
      return {
        success: true,
        targetMode: 'use_case',
        presetId,
        providerCode: candidate.providerAccount.providerCode,
        providerDisplayName: candidate.providerAccount.displayName,
        modelName: response.modelUsed,
        modelDisplayName: candidate.model.displayName,
        latencyMs: Date.now() - startedAt,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.promptTokens + response.completionTokens,
        normalizedErrorType: null,
        providerHttpStatus: null,
        usedEnvFallback: false,
        responsePreview: truncatePreview(response.text),
      }
    } catch (error) {
      const category = isAIProviderError(error) ? error.category : 'unknown_error'
      const status = isAIProviderError(error) ? error.status ?? null : null
      if (candidate.policy.fallbackEnabled && isRecoverableProviderFailure(category)) {
        continue
      }

      return {
        success: false,
        targetMode: 'use_case',
        presetId,
        providerCode: candidate.providerAccount.providerCode,
        providerDisplayName: candidate.providerAccount.displayName,
        modelName: candidate.model.modelName,
        modelDisplayName: candidate.model.displayName,
        latencyMs: Date.now() - startedAt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        normalizedErrorType: category,
        providerHttpStatus: status,
        usedEnvFallback: false,
        responsePreview: null,
      }
    }
  }

  if (envFallbackAllowed(candidates, env)) {
    const startedAt = Date.now()
    try {
      const provider = resolveEnvProvider(env)
      const response = await provider.complete(prompt, {
        model: envModelName(env),
        temperature: 0.2,
        maxOutputTokens: 1024,
        timeoutMs: 30000,
      })

      return {
        success: true,
        targetMode: 'use_case',
        presetId,
        providerCode: envProviderName(env),
        providerDisplayName: envProviderName(env),
        modelName: response.modelUsed,
        modelDisplayName: response.modelUsed,
        latencyMs: Date.now() - startedAt,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.promptTokens + response.completionTokens,
        normalizedErrorType: null,
        providerHttpStatus: null,
        usedEnvFallback: true,
        responsePreview: truncatePreview(response.text),
      }
    } catch (error) {
      return {
        success: false,
        targetMode: 'use_case',
        presetId,
        providerCode: envProviderName(env),
        providerDisplayName: envProviderName(env),
        modelName: envModelName(env),
        modelDisplayName: envModelName(env),
        latencyMs: Date.now() - startedAt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        normalizedErrorType: isAIProviderError(error) ? error.category : 'unknown_error',
        providerHttpStatus: isAIProviderError(error) ? error.status ?? null : null,
        usedEnvFallback: true,
        responsePreview: null,
      }
    }
  }

  return {
    success: false,
    targetMode: 'use_case',
    presetId,
    providerCode: null,
    providerDisplayName: null,
    modelName: null,
    modelDisplayName: null,
    latencyMs: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    normalizedErrorType: 'provider_unavailable',
    providerHttpStatus: null,
    usedEnvFallback: false,
    responsePreview: null,
  }
}

export async function runAdminProviderTest(
  input: AdminTestRunInput,
): Promise<AdminProviderTestResult | null> {
  const fixture = buildFixture(input.presetId)
  const useCase = input.useCase ?? fixture.defaultUseCase

  if (input.targetMode === 'model') {
    if (!input.modelId) return null

    const model = await getModelById(input.modelId, input.env)
    if (!model) return null

    const providerAccount = await getProviderAccountById(model.providerAccountId, input.env)
    if (!providerAccount) return null

    return runDirectModelTest(providerAccount, model, fixture.prompt, input.presetId, input.env)
  }

  return runRoutedUseCaseTest(useCase, fixture.prompt, input.presetId, input.env)
}
