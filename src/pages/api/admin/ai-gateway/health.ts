import type { APIRoute } from 'astro'
import { jsonResponse, parseJsonBody, requireAIGatewayAdmin } from '../../../../lib/ai/admin/api'
import { loadAdminProviderHealth, resetProviderHealth } from '../../../../lib/ai/admin/store'
import {
  AdminAPIValidationError,
  getString,
  getUuid,
} from '../../../../lib/ai/admin/validation'

export const GET: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  const health = await loadAdminProviderHealth(auth.context.env)
  return jsonResponse(200, { ok: true, health })
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  try {
    const body = await parseJsonBody(request)
    const action = getString(body, 'action', { required: true, maxLength: 40 })
    if (action !== 'reset') {
      return jsonResponse(400, { ok: false, error: 'invalid_request' })
    }

    const healthId = getUuid(body, 'id')
    const health = await resetProviderHealth(healthId, auth.context.env)
    if (!health) {
      return jsonResponse(500, { ok: false, error: 'save_failed' })
    }

    return jsonResponse(200, { ok: true, health })
  } catch (error) {
    if (error instanceof AdminAPIValidationError) {
      return jsonResponse(400, { ok: false, error: error.code })
    }
    if (error instanceof Error && error.message === 'invalid_body') {
      return jsonResponse(400, { ok: false, error: 'invalid_body' })
    }

    console.error('ai gateway admin health api: unexpected failure')
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }
}
