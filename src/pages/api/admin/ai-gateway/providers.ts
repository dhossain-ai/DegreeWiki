import type { APIRoute } from 'astro'
import { jsonResponse, parseJsonBody, requireAIGatewayAdmin } from '../../../../lib/ai/admin/api'
import { AI_GATEWAY_DB_PROVIDER_PROTOCOLS } from '../../../../lib/ai/admin/constants'
import { encryptProviderApiKey } from '../../../../lib/ai/admin/crypto'
import {
  createProviderAccount,
  loadAdminProviderAccounts,
  replaceProviderApiKey,
  updateProviderAccountMetadata,
} from '../../../../lib/ai/admin/store'
import {
  AdminAPIValidationError,
  getAuthType,
  getBoolean,
  getPrivacyLevel,
  getProviderProtocol,
  getRequiredInteger,
  getString,
  getNullableString,
  getUuid,
  getOptionalUrl,
} from '../../../../lib/ai/admin/validation'

function readProviderMetadata(body: Record<string, unknown>) {
  const baseUrl = getOptionalUrl(body, 'base_url')
  if (!baseUrl) {
    throw new AdminAPIValidationError('invalid_request')
  }

  return {
    providerCode: getString(body, 'provider_code', { required: true, maxLength: 100 }),
    displayName: getString(body, 'display_name', { required: true, maxLength: 150 }),
    adapterType: getProviderProtocol(body),
    baseUrl,
    endpointPath: getNullableString(body, 'endpoint_path', { maxLength: 200 }),
    authType: getAuthType(body),
    timeoutMs: getRequiredInteger(body, 'timeout_ms', { min: 1000, max: 120000 }),
    isActive: getBoolean(body, 'is_active'),
    privacyLevel: getPrivacyLevel(body),
    allowsStudentData: getBoolean(body, 'allows_student_data'),
    allowsChat: getBoolean(body, 'allows_chat'),
    allowsFitFinder: getBoolean(body, 'allows_fit_finder'),
  }
}

export const GET: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  const providers = await loadAdminProviderAccounts(auth.context.env)
  return jsonResponse(200, {
    ok: true,
    providers,
    supported_protocols: AI_GATEWAY_DB_PROVIDER_PROTOCOLS,
  })
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const auth = await requireAIGatewayAdmin(cookies, request, locals as Record<string, unknown>)
  if (!auth.ok) return auth.response

  try {
    const body = await parseJsonBody(request)
    const action = getString(body, 'action', { required: true, maxLength: 40 })

    if (action === 'create') {
      const metadata = readProviderMetadata(body)
      const apiKey = getString(body, 'api_key', { required: true, maxLength: 1000 })
      const encrypted = await encryptProviderApiKey(apiKey, auth.context.env)
      const provider = await createProviderAccount(
        {
          ...metadata,
          apiKeyCiphertext: encrypted.ciphertext,
          apiKeyIv: encrypted.iv,
          apiKeyKeyVersion: encrypted.keyVersion,
          apiKeyLast4: encrypted.last4,
          apiKeyFingerprint: encrypted.fingerprint,
        },
        auth.context.env,
      )

      if (!provider) {
        return jsonResponse(500, { ok: false, error: 'save_failed' })
      }

      return jsonResponse(200, { ok: true, provider })
    }

    if (action === 'update') {
      const providerAccountId = getUuid(body, 'id')
      const metadata = readProviderMetadata(body)
      const provider = await updateProviderAccountMetadata(providerAccountId, metadata, auth.context.env)
      if (!provider) {
        return jsonResponse(500, { ok: false, error: 'save_failed' })
      }

      return jsonResponse(200, { ok: true, provider })
    }

    if (action === 'replace_key') {
      const providerAccountId = getUuid(body, 'id')
      const apiKey = getString(body, 'api_key', { required: true, maxLength: 1000 })
      const encrypted = await encryptProviderApiKey(apiKey, auth.context.env)
      const provider = await replaceProviderApiKey(
        providerAccountId,
        {
          apiKeyCiphertext: encrypted.ciphertext,
          apiKeyIv: encrypted.iv,
          apiKeyKeyVersion: encrypted.keyVersion,
          apiKeyLast4: encrypted.last4,
          apiKeyFingerprint: encrypted.fingerprint,
        },
        auth.context.env,
      )

      if (!provider) {
        return jsonResponse(500, { ok: false, error: 'save_failed' })
      }

      return jsonResponse(200, { ok: true, provider })
    }

    return jsonResponse(400, { ok: false, error: 'invalid_request' })
  } catch (error) {
    if (error instanceof AdminAPIValidationError) {
      return jsonResponse(400, { ok: false, error: error.code })
    }
    if (error instanceof Error && error.message === 'invalid_body') {
      return jsonResponse(400, { ok: false, error: 'invalid_body' })
    }

    console.error('ai gateway admin providers api: unexpected failure')
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }
}
