import type { APIRoute } from 'astro'
import { jsonResponse, parseJsonBody, requireAIGatewayAdmin } from '../../../../lib/ai/admin/api'
import {
  createRoutingPolicy,
  deleteRoutingPolicy,
  loadAdminRoutingPolicies,
  updateRoutingPolicy,
} from '../../../../lib/ai/admin/store'
import {
  AdminAPIValidationError,
  getBoolean,
  getNullableString,
  getRequiredInteger,
  getString,
  getUseCase,
  getUuid,
} from '../../../../lib/ai/admin/validation'

function getNullableInteger(
  body: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number } = {},
): number | null {
  const value = body[key]
  if (value == null || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new AdminAPIValidationError('invalid_request')
  }
  if (options.min !== undefined && value < options.min) {
    throw new AdminAPIValidationError('invalid_request')
  }
  if (options.max !== undefined && value > options.max) {
    throw new AdminAPIValidationError('invalid_request')
  }
  return value
}

function readPolicyPayload(body: Record<string, unknown>) {
  return {
    useCase: getUseCase(body),
    modelId: getUuid(body, 'model_id'),
    priority: getRequiredInteger(body, 'priority', { min: 1 }),
    isActive: getBoolean(body, 'is_active'),
    fallbackEnabled: getBoolean(body, 'fallback_enabled'),
    maxAttempts: getRequiredInteger(body, 'max_attempts', { min: 1 }),
    timeoutMs: getNullableInteger(body, 'timeout_ms', { min: 1000, max: 120000 }),
    allowEnvFallback: getBoolean(body, 'allow_env_fallback'),
    notes: getNullableString(body, 'notes', { maxLength: 1000 }),
  }
}

export const GET: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  const policies = await loadAdminRoutingPolicies(auth.context.env)
  return jsonResponse(200, { ok: true, policies })
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  try {
    const body = await parseJsonBody(request)
    const action = getString(body, 'action', { required: true, maxLength: 40 })

    if (action === 'create') {
      const policy = await createRoutingPolicy(readPolicyPayload(body), auth.context.env)
      if (!policy) {
        return jsonResponse(500, { ok: false, error: 'save_failed' })
      }

      return jsonResponse(200, { ok: true, policy })
    }

    if (action === 'update') {
      const policyId = getUuid(body, 'id')
      const policy = await updateRoutingPolicy(policyId, readPolicyPayload(body), auth.context.env)
      if (!policy) {
        return jsonResponse(500, { ok: false, error: 'save_failed' })
      }

      return jsonResponse(200, { ok: true, policy })
    }

    if (action === 'delete') {
      const policyId = getUuid(body, 'id')
      const deleted = await deleteRoutingPolicy(policyId, auth.context.env)
      if (!deleted) {
        return jsonResponse(500, { ok: false, error: 'save_failed' })
      }

      return jsonResponse(200, { ok: true })
    }

    return jsonResponse(400, { ok: false, error: 'invalid_request' })
  } catch (error) {
    if (error instanceof AdminAPIValidationError) {
      return jsonResponse(400, { ok: false, error: error.code })
    }
    if (error instanceof Error && error.message === 'invalid_body') {
      return jsonResponse(400, { ok: false, error: 'invalid_body' })
    }

    console.error('ai gateway admin policies api: unexpected failure')
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }
}
