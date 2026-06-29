import { callAI } from './gateway'
import { buildAdminArticleDraftPrompt } from './prompts/admin-article-draft'
import { ARTICLE_ASSIST_ACTIONS } from './types'
import type { AIContext, AIRuntimeEnv, ArticleAssistAction } from './types'

type ArticleAssistFieldKey =
  | 'title'
  | 'summary'
  | 'content'
  | 'category'
  | 'seo_title'
  | 'seo_description'

export type ArticleAssistErrorCode =
  | 'invalid_request'
  | 'insufficient_context'
  | 'rate_limit_exceeded'
  | 'ai_setup_unavailable'
  | 'ai_unavailable'

export interface ArticleAssistSuccess {
  ok: true
  action: ArticleAssistAction
  suggestion: string
  warnings: string[]
  used_ai: true
}

export interface ArticleAssistFailure {
  ok: false
  status: number
  error: ArticleAssistErrorCode
  message: string
}

export type ArticleAssistResult = ArticleAssistSuccess | ArticleAssistFailure

interface ArticleAssistInput {
  action: ArticleAssistAction
  title: string
  summary: string
  content: string
  category: string
  seoTitle: string
  seoDescription: string
  warnings: string[]
}

const FIELD_LIMITS: Record<ArticleAssistFieldKey, number> = {
  title: 180,
  summary: 1000,
  content: 12000,
  category: 120,
  seo_title: 160,
  seo_description: 320,
}

const ACTION_LABELS: Record<ArticleAssistAction, string> = {
  outline: 'Generate outline',
  seo_title: 'Suggest SEO title',
  seo_description: 'Suggest SEO description',
  summary: 'Improve summary',
  faq: 'Suggest FAQ ideas',
  risk_check: 'Check risky claims',
}

class ArticleAssistError extends Error {
  code: ArticleAssistErrorCode
  status: number

  constructor(code: ArticleAssistErrorCode, status: number, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

function invalidRequest(message = 'The request could not be processed.'): never {
  throw new ArticleAssistError('invalid_request', 400, message)
}

function normalizeMultilineText(value: string): string {
  return value.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim()
}

function readTextField(
  body: Record<string, unknown>,
  key: ArticleAssistFieldKey,
  warnings: string[],
): string {
  const raw = body[key]
  if (raw == null || raw === '') return ''
  if (typeof raw !== 'string') {
    invalidRequest('One or more article fields are invalid.')
  }

  const normalized = normalizeMultilineText(raw)
  const maxLength = FIELD_LIMITS[key]
  if (normalized.length <= maxLength) return normalized

  warnings.push(`${key} was truncated before sending it to the AI assistant.`)
  return normalized.slice(0, maxLength).trim()
}

function readAction(body: Record<string, unknown>): ArticleAssistAction {
  const raw = body.action
  if (typeof raw !== 'string') {
    invalidRequest('Choose an AI action first.')
  }

  const normalized = raw.trim()
  if (!(ARTICLE_ASSIST_ACTIONS as readonly string[]).includes(normalized)) {
    invalidRequest('That AI action is not supported.')
  }

  return normalized as ArticleAssistAction
}

function parseArticleAssistInput(body: Record<string, unknown>): ArticleAssistInput {
  const warnings: string[] = []
  const action = readAction(body)
  const input = {
    action,
    title: readTextField(body, 'title', warnings),
    summary: readTextField(body, 'summary', warnings),
    content: readTextField(body, 'content', warnings),
    category: readTextField(body, 'category', warnings),
    seoTitle: readTextField(body, 'seo_title', warnings),
    seoDescription: readTextField(body, 'seo_description', warnings),
    warnings,
  }

  const hasUsefulTitle = input.title.length >= 8
  const hasUsefulSummary = input.summary.length >= 40
  const hasUsefulContent = input.content.length >= 120

  if (!hasUsefulTitle && !hasUsefulSummary && !hasUsefulContent) {
    throw new ArticleAssistError(
      'insufficient_context',
      400,
      'Add a clearer title, summary, or draft body before using the AI assistant.',
    )
  }

  if (
    (input.action === 'outline' || input.action === 'faq' || input.action === 'risk_check')
    && !hasUsefulSummary
    && !hasUsefulContent
  ) {
    throw new ArticleAssistError(
      'insufficient_context',
      400,
      'Add more summary or body content before using that AI action.',
    )
  }

  return input
}

function mapFailureMessage(code: ArticleAssistErrorCode): { status: number; message: string } {
  if (code === 'rate_limit_exceeded') {
    return {
      status: 429,
      message: "Today's AI article-assist limit has been reached. Please try again later.",
    }
  }

  if (code === 'ai_setup_unavailable') {
    return {
      status: 503,
      message: 'AI article assistant is not configured yet. Ask an AI Gateway admin to add an active admin_article_draft route.',
    }
  }

  if (code === 'insufficient_context') {
    return {
      status: 400,
      message: 'Add more article context before requesting an AI suggestion.',
    }
  }

  return {
    status: code === 'invalid_request' ? 400 : 503,
    message: 'AI article assistant is temporarily unavailable. Please try again later.',
  }
}

function failure(code: ArticleAssistErrorCode): ArticleAssistFailure {
  const mapped = mapFailureMessage(code)
  return {
    ok: false,
    error: code,
    status: mapped.status,
    message: mapped.message,
  }
}

export async function runArticleAssist(
  body: Record<string, unknown>,
  env: AIRuntimeEnv,
  userId: string,
): Promise<ArticleAssistResult> {
  let input: ArticleAssistInput

  try {
    input = parseArticleAssistInput(body)
  } catch (error) {
    if (error instanceof ArticleAssistError) {
      return {
        ok: false,
        error: error.code,
        status: error.status,
        message: error.message,
      }
    }
    return failure('invalid_request')
  }

  const context: AIContext = {
    source: 'articles',
    records: [
      {
        title: input.title,
        summary: input.summary,
        content: input.content,
        category: input.category,
        seo_title: input.seoTitle,
        seo_description: input.seoDescription,
      },
    ],
  }

  const aiResponse = await callAI(
    {
      useCase: 'admin_article_draft',
      audienceTier: 'admin',
      sessionType: 'chat',
      userMessage: `${ACTION_LABELS[input.action]} for article draft review.`,
      context,
      prompt: buildAdminArticleDraftPrompt(input),
      userId,
    },
    env,
  )

  if (aiResponse.fallbackUsed || aiResponse.guardrailTripped || aiResponse.text.trim().length === 0) {
    if (aiResponse.failure?.source === 'rate_limit' && aiResponse.failure.reason === 'limit_exceeded') {
      return failure('rate_limit_exceeded')
    }

    if (aiResponse.failure?.source === 'provider_config') {
      return failure('ai_setup_unavailable')
    }

    return failure('ai_unavailable')
  }

  return {
    ok: true,
    action: input.action,
    suggestion: aiResponse.text.trim(),
    warnings: input.warnings,
    used_ai: true,
  }
}
