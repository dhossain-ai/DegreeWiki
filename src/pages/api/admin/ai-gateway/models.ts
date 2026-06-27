import type { APIRoute } from 'astro'
import { jsonResponse, parseJsonBody, requireAIGatewayAdmin } from '../../../../lib/ai/admin/api'
import {
  createModel,
  loadAdminModels,
  updateModel,
} from '../../../../lib/ai/admin/store'
import {
  AdminAPIValidationError,
  getBoolean,
  getNullableString,
  getOptionalNumber,
  getRequiredInteger,
  getString,
  getUuid,
} from '../../../../lib/ai/admin/validation'

function readModelPayload(body: Record<string, unknown>) {
  return {
    providerAccountId: getUuid(body, 'provider_account_id'),
    modelName: getString(body, 'model_name', { required: true, maxLength: 200 }),
    displayName: getString(body, 'display_name', { required: true, maxLength: 200 }),
    isActive: getBoolean(body, 'is_active'),
    supportsText: getBoolean(body, 'supports_text'),
    supportsJsonMode: getBoolean(body, 'supports_json_mode'),
    supportsStreaming: getBoolean(body, 'supports_streaming'),
    supportsToolCalling: getBoolean(body, 'supports_tool_calling'),
    maxOutputTokens: getOptionalInteger(body, 'max_output_tokens', { min: 1 }),
    inputCostPerMillion: getOptionalNumber(body, 'input_cost_per_million', { min: 0 }),
    outputCostPerMillion: getOptionalNumber(body, 'output_cost_per_million', { min: 0 }),
    costTier: getNullableString(body, 'cost_tier', { maxLength: 100 }),
  }
}

function getOptionalInteger(
  body: Record<string, unknown>,
  key: string,
  options: { min?: number } = {},
): number | null {
  const value = body[key]
  if (value == null || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new AdminAPIValidationError('invalid_request')
  }
  if (options.min !== undefined && value < options.min) {
    throw new AdminAPIValidationError('invalid_request')
  }
  return value
}

export const GET: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  const models = await loadAdminModels(auth.context.env)
  return jsonResponse(200, { ok: true, models })
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  try {
    const body = await parseJsonBody(request)
    const action = getString(body, 'action', { required: true, maxLength: 40 })

    if (action === 'create') {
      const model = await createModel(readModelPayload(body), auth.context.env)
      if (!model) {
        return jsonResponse(500, { ok: false, error: 'save_failed' })
      }

      return jsonResponse(200, { ok: true, model })
    }

    if (action === 'update') {
      const modelId = getUuid(body, 'id')
      const model = await updateModel(modelId, readModelPayload(body), auth.context.env)
      if (!model) {
        return jsonResponse(500, { ok: false, error: 'save_failed' })
      }

      return jsonResponse(200, { ok: true, model })
    }

    return jsonResponse(400, { ok: false, error: 'invalid_request' })
  } catch (error) {
    if (error instanceof AdminAPIValidationError) {
      return jsonResponse(400, { ok: false, error: error.code })
    }
    if (error instanceof Error && error.message === 'invalid_body') {
      return jsonResponse(400, { ok: false, error: 'invalid_body' })
    }

    console.error('ai gateway admin models api: unexpected failure')
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }
}
