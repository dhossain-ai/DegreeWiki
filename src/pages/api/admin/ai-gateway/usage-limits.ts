import type { APIRoute } from 'astro'
import {
  createAdminUsageLimitPolicy,
  deleteAdminUsageLimitPolicy,
  getAdminUsageFallbackDefaults,
  getSuggestedUsageLimitPolicies,
  loadAdminUsageLimitPolicies,
  setAdminUsageLimitPolicyEnabled,
  updateAdminUsageLimitPolicy,
} from '../../../../lib/ai/admin/usage-limits'
import { jsonResponse, parseJsonBody, requireAIGatewayAdmin } from '../../../../lib/ai/admin/api'
import {
  AdminAPIValidationError,
  getBoolean,
  getNullableString,
  getOptionalInteger,
  getRequiredInteger,
  getString,
  getUsageAudienceTier,
  getUsagePeriod,
  getUseCase,
  getUuid,
} from '../../../../lib/ai/admin/validation'

function readPolicyPayload(body: Record<string, unknown>) {
  return {
    useCase: getUseCase(body),
    audienceTier: getUsageAudienceTier(body),
    period: getUsagePeriod(body),
    maxCalls: getRequiredInteger(body, 'max_calls', { min: 0, max: 100000 }),
    maxTokens: getOptionalInteger(body, 'max_tokens', { min: 0, max: 100000000 }),
    isEnabled: getBoolean(body, 'is_enabled', { defaultValue: true }),
    notes: getNullableString(body, 'notes', { maxLength: 1000 }),
  }
}

function mutationErrorResponse(status: string): Response {
  if (status === 'duplicate') {
    return jsonResponse(409, { ok: false, error: 'duplicate_policy' })
  }
  if (status === 'not_found') {
    return jsonResponse(404, { ok: false, error: 'not_found' })
  }
  return jsonResponse(500, { ok: false, error: 'save_failed' })
}

export const GET: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  const policies = await loadAdminUsageLimitPolicies(auth.context.env)
  return jsonResponse(200, {
    ok: true,
    policies,
    fallbackDefaults: getAdminUsageFallbackDefaults(auth.context.env),
    suggestedStarterPolicies: getSuggestedUsageLimitPolicies(),
  })
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  try {
    const body = await parseJsonBody(request)
    const action = getString(body, 'action', { required: true, maxLength: 40 })

    if (action === 'create') {
      const result = await createAdminUsageLimitPolicy(
        {
          ...readPolicyPayload(body),
          actorUserId: auth.context.userId,
        },
        auth.context.env,
      )

      if (result.status !== 'ok' || !result.policy) {
        return mutationErrorResponse(result.status)
      }

      return jsonResponse(200, { ok: true, policy: result.policy })
    }

    if (action === 'update') {
      const result = await updateAdminUsageLimitPolicy(
        {
          id: getUuid(body, 'id'),
          ...readPolicyPayload(body),
          actorUserId: auth.context.userId,
        },
        auth.context.env,
      )

      if (result.status !== 'ok' || !result.policy) {
        return mutationErrorResponse(result.status)
      }

      return jsonResponse(200, { ok: true, policy: result.policy })
    }

    if (action === 'set_enabled') {
      const result = await setAdminUsageLimitPolicyEnabled(
        {
          id: getUuid(body, 'id'),
          isEnabled: getBoolean(body, 'is_enabled'),
          actorUserId: auth.context.userId,
        },
        auth.context.env,
      )

      if (result.status !== 'ok' || !result.policy) {
        return mutationErrorResponse(result.status)
      }

      return jsonResponse(200, { ok: true, policy: result.policy })
    }

    if (action === 'delete') {
      const result = await deleteAdminUsageLimitPolicy(getUuid(body, 'id'), auth.context.env)
      if (result.status !== 'ok') {
        return mutationErrorResponse(result.status)
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

    console.error('ai gateway usage limits api: unexpected failure')
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }
}
