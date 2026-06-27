import type { APIRoute } from 'astro'
import { jsonResponse, parseJsonBody, requireAIGatewayAdmin } from '../../../../lib/ai/admin/api'
import { runAdminProviderTest } from '../../../../lib/ai/admin/testing'
import {
  AdminAPIValidationError,
  getString,
  getTestPresetId,
  getUseCase,
  getUuid,
} from '../../../../lib/ai/admin/validation'

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  try {
    const body = await parseJsonBody(request)
    const targetMode = getString(body, 'target_mode', { required: true, maxLength: 20 })
    if (targetMode !== 'use_case' && targetMode !== 'model') {
      return jsonResponse(400, { ok: false, error: 'invalid_request' })
    }

    const result = await runAdminProviderTest({
      presetId: getTestPresetId(body),
      targetMode,
      useCase: targetMode === 'use_case' ? getUseCase(body) : undefined,
      modelId: targetMode === 'model' ? getUuid(body, 'model_id') : undefined,
      env: auth.context.env,
    })

    if (!result) {
      return jsonResponse(404, { ok: false, error: 'not_found' })
    }

    return jsonResponse(200, { ok: true, result })
  } catch (error) {
    if (error instanceof AdminAPIValidationError) {
      return jsonResponse(400, { ok: false, error: error.code })
    }
    if (error instanceof Error && error.message === 'invalid_body') {
      return jsonResponse(400, { ok: false, error: 'invalid_body' })
    }

    console.error('ai gateway admin test api: unexpected failure')
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }
}
