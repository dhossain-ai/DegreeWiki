import type { APIRoute } from 'astro'
import { jsonResponse, parseJsonBody, requireAIAdminAccess } from '../../../../lib/ai/admin/api'
import { importKnowledgeAnswers, KnowledgeBaseValidationError } from '../../../../lib/ai/admin/knowledge-base'
import { AdminAPIValidationError, getString } from '../../../../lib/ai/admin/validation'

function knowledgeErrorStatus(code: string): number {
  if (code === 'internal_error' || code === 'save_failed') return 500
  return 400
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIAdminAccess(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  try {
    const body = await parseJsonBody(request)
    const jsonInput = getString(body, 'json_input', {
      required: true,
      maxLength: 200000,
      allowEmpty: false,
    })

    const result = await importKnowledgeAnswers(
      auth.context.supabase,
      auth.context.userId,
      jsonInput,
    )

    return jsonResponse(200, {
      ok: true,
      inserted_count: result.insertedCount,
      rows: result.rows,
    })
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

    console.error('ai knowledge import api: unexpected failure')
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }
}
