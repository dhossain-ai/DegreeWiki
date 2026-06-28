import type { APIRoute } from 'astro'
import { jsonResponse, parseJsonBody, requireAIAdminAccess } from '../../../../lib/ai/admin/api'
import {
  archiveKnowledgeAnswer,
  AI_KNOWLEDGE_MAX_BULK_IDS,
  bulkArchiveKnowledgeAnswers,
  bulkDeleteDraftKnowledgeAnswers,
  bulkMoveKnowledgeAnswersToDraft,
  bulkPublishKnowledgeAnswers,
  createKnowledgeAnswer,
  deleteKnowledgeAnswer,
  KnowledgeBaseValidationError,
  listKnowledgeAnswers,
  loadKnowledgeCategories,
  publishKnowledgeAnswer,
  updateKnowledgeAnswer,
} from '../../../../lib/ai/admin/knowledge-base'
import { AdminAPIValidationError, getString, getUuid } from '../../../../lib/ai/admin/validation'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function knowledgeErrorStatus(code: string): number {
  if (code === 'not_found') return 404
  if (code === 'internal_error' || code === 'save_failed') return 500
  return 400
}

function getUuidArray(
  body: Record<string, unknown>,
  key: string,
): string[] {
  const raw = body[key]
  if (!Array.isArray(raw)) {
    throw new AdminAPIValidationError('invalid_request')
  }

  const ids = raw
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)

  if (ids.length === 0 || ids.length > AI_KNOWLEDGE_MAX_BULK_IDS) {
    throw new AdminAPIValidationError('invalid_request')
  }

  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length !== ids.length) {
    throw new AdminAPIValidationError('invalid_request')
  }

  if (uniqueIds.some((id) => !UUID_RE.test(id))) {
    throw new AdminAPIValidationError('invalid_request')
  }

  return uniqueIds
}

export const GET: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIAdminAccess(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)

  const filters = {
    status: url.searchParams.get('status') ?? '',
    category: url.searchParams.get('category') ?? '',
    locale: url.searchParams.get('locale') ?? '',
    audience: url.searchParams.get('audience') ?? '',
    search: url.searchParams.get('search') ?? '',
  }

  const [answers, categories] = await Promise.all([
    listKnowledgeAnswers(auth.context.supabase, filters),
    loadKnowledgeCategories(auth.context.supabase),
  ])

  return jsonResponse(200, {
    ok: true,
    answers,
    categories,
  })
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIAdminAccess(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  try {
    const body = await parseJsonBody(request)
    const action = getString(body, 'action', { required: true, maxLength: 40 })

    if (action === 'create') {
      const answer = await createKnowledgeAnswer(
        auth.context.supabase,
        auth.context.userId,
        body,
      )
      return jsonResponse(200, { ok: true, answer })
    }

    if (action === 'update') {
      const id = getUuid(body, 'id')
      const answer = await updateKnowledgeAnswer(
        auth.context.supabase,
        id,
        auth.context.userId,
        body,
      )
      return jsonResponse(200, { ok: true, answer })
    }

    if (action === 'publish') {
      const id = getUuid(body, 'id')
      const answer = await publishKnowledgeAnswer(auth.context.supabase, id, auth.context.userId)
      return jsonResponse(200, { ok: true, answer })
    }

    if (action === 'archive') {
      const id = getUuid(body, 'id')
      const answer = await archiveKnowledgeAnswer(auth.context.supabase, id, auth.context.userId)
      return jsonResponse(200, { ok: true, answer })
    }

    if (action === 'delete') {
      const id = getUuid(body, 'id')
      await deleteKnowledgeAnswer(auth.context.supabase, id)
      return jsonResponse(200, { ok: true })
    }

    if (action === 'bulk_publish') {
      const ids = getUuidArray(body, 'ids')
      const result = await bulkPublishKnowledgeAnswers(
        auth.context.supabase,
        ids,
        auth.context.userId,
      )
      return jsonResponse(200, { ok: true, result })
    }

    if (action === 'bulk_draft') {
      const ids = getUuidArray(body, 'ids')
      const result = await bulkMoveKnowledgeAnswersToDraft(
        auth.context.supabase,
        ids,
        auth.context.userId,
      )
      return jsonResponse(200, { ok: true, result })
    }

    if (action === 'bulk_archive') {
      const ids = getUuidArray(body, 'ids')
      const result = await bulkArchiveKnowledgeAnswers(
        auth.context.supabase,
        ids,
        auth.context.userId,
      )
      return jsonResponse(200, { ok: true, result })
    }

    if (action === 'bulk_delete_drafts') {
      const ids = getUuidArray(body, 'ids')
      const result = await bulkDeleteDraftKnowledgeAnswers(
        auth.context.supabase,
        ids,
      )
      return jsonResponse(200, { ok: true, result })
    }

    return jsonResponse(400, { ok: false, error: 'invalid_request' })
  } catch (error) {
    if (error instanceof KnowledgeBaseValidationError) {
      return jsonResponse(knowledgeErrorStatus(error.code), {
        ok: false,
        error: error.code,
        message: error.message,
        details: error.details ?? [],
      })
    }
    if (error instanceof AdminAPIValidationError) {
      return jsonResponse(400, { ok: false, error: error.code })
    }
    if (error instanceof Error && error.message === 'invalid_body') {
      return jsonResponse(400, { ok: false, error: 'invalid_body' })
    }

    console.error('ai knowledge answers api: unexpected failure')
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }
}
