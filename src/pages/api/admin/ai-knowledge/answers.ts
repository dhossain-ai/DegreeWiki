import type { APIRoute } from 'astro'
import { jsonResponse, parseJsonBody, requireAIAdminAccess } from '../../../../lib/ai/admin/api'
import {
  archiveKnowledgeAnswer,
  createKnowledgeAnswer,
  deleteKnowledgeAnswer,
  KnowledgeBaseValidationError,
  listKnowledgeAnswers,
  loadKnowledgeCategories,
  publishKnowledgeAnswer,
  updateKnowledgeAnswer,
} from '../../../../lib/ai/admin/knowledge-base'
import { AdminAPIValidationError, getString, getUuid } from '../../../../lib/ai/admin/validation'

function knowledgeErrorStatus(code: string): number {
  if (code === 'not_found') return 404
  if (code === 'internal_error' || code === 'save_failed') return 500
  return 400
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
