import {
  AI_GATEWAY_AUTH_TYPES,
  AI_GATEWAY_DB_PROVIDER_PROTOCOLS,
  AI_GATEWAY_PRIVACY_LEVELS,
  AI_GATEWAY_TEST_PRESETS,
  AI_USAGE_LIMIT_AUDIENCE_TIERS,
  AI_USAGE_LIMIT_PERIODS,
  AI_GATEWAY_USE_CASES,
} from './constants'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class AdminAPIValidationError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'AdminAPIValidationError'
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminAPIValidationError('invalid_body')
  }
  return value as Record<string, unknown>
}

export function getObject(value: unknown, key: string): Record<string, unknown> {
  return asRecord(asRecord(value)[key])
}

export function getString(
  value: unknown,
  key: string,
  options: { required?: boolean; maxLength?: number; allowEmpty?: boolean } = {},
): string {
  const record = asRecord(value)
  const raw = record[key]
  if (typeof raw !== 'string') {
    if (options.required) throw new AdminAPIValidationError('invalid_request')
    return ''
  }

  const trimmed = raw.trim()
  if (!options.allowEmpty && trimmed.length === 0) {
    if (options.required) throw new AdminAPIValidationError('invalid_request')
    return ''
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new AdminAPIValidationError('invalid_request')
  }

  return trimmed
}

export function getNullableString(
  value: unknown,
  key: string,
  options: { maxLength?: number } = {},
): string | null {
  const record = asRecord(value)
  const raw = record[key]
  if (raw == null) return null
  if (typeof raw !== 'string') throw new AdminAPIValidationError('invalid_request')

  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new AdminAPIValidationError('invalid_request')
  }
  return trimmed
}

export function getBoolean(
  value: unknown,
  key: string,
  options: { defaultValue?: boolean } = {},
): boolean {
  const record = asRecord(value)
  const raw = record[key]
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw == null && options.defaultValue !== undefined) return options.defaultValue
  throw new AdminAPIValidationError('invalid_request')
}

export function getUuid(value: unknown, key: string): string {
  const raw = getString(value, key, { required: true, maxLength: 64 })
  if (!UUID_RE.test(raw)) {
    throw new AdminAPIValidationError('invalid_request')
  }
  return raw
}

export function getOptionalInteger(
  value: unknown,
  key: string,
  options: { min?: number; max?: number } = {},
): number | null {
  const record = asRecord(value)
  const raw = record[key]
  if (raw == null || raw === '') return null
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw new AdminAPIValidationError('invalid_request')
  }
  if (options.min !== undefined && raw < options.min) {
    throw new AdminAPIValidationError('invalid_request')
  }
  if (options.max !== undefined && raw > options.max) {
    throw new AdminAPIValidationError('invalid_request')
  }
  return raw
}

export function getRequiredInteger(
  value: unknown,
  key: string,
  options: { min?: number; max?: number } = {},
): number {
  const parsed = getOptionalInteger(value, key, options)
  if (parsed === null) {
    throw new AdminAPIValidationError('invalid_request')
  }
  return parsed
}

export function getOptionalNumber(
  value: unknown,
  key: string,
  options: { min?: number } = {},
): number | null {
  const record = asRecord(value)
  const raw = record[key]
  if (raw == null || raw === '') return null
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new AdminAPIValidationError('invalid_request')
  }
  if (options.min !== undefined && raw < options.min) {
    throw new AdminAPIValidationError('invalid_request')
  }
  return raw
}

export function getRequiredEnum<T extends readonly string[]>(
  value: unknown,
  key: string,
  allowed: T,
): T[number] {
  return getEnum(value, key, allowed)
}

export function getOptionalUrl(value: unknown, key: string): string | null {
  const raw = getNullableString(value, key, { maxLength: 500 })
  if (raw === null) return null

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new AdminAPIValidationError('invalid_request')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AdminAPIValidationError('invalid_request')
  }

  return url.toString()
}

export function getEnum<T extends readonly string[]>(
  value: unknown,
  key: string,
  allowed: T,
): T[number] {
  const raw = getString(value, key, { required: true, maxLength: 100 })
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new AdminAPIValidationError('invalid_request')
  }
  return raw as T[number]
}

export function getProviderProtocol(value: unknown, key = 'adapter_type') {
  return getEnum(value, key, AI_GATEWAY_DB_PROVIDER_PROTOCOLS)
}

export function getAuthType(value: unknown, key = 'auth_type') {
  return getEnum(value, key, AI_GATEWAY_AUTH_TYPES)
}

export function getPrivacyLevel(value: unknown, key = 'privacy_level') {
  return getEnum(value, key, AI_GATEWAY_PRIVACY_LEVELS)
}

export function getUseCase(value: unknown, key = 'use_case') {
  return getEnum(value, key, AI_GATEWAY_USE_CASES)
}

export function getUsageAudienceTier(value: unknown, key = 'audience_tier') {
  return getEnum(value, key, AI_USAGE_LIMIT_AUDIENCE_TIERS)
}

export function getUsagePeriod(value: unknown, key = 'period') {
  return getEnum(value, key, AI_USAGE_LIMIT_PERIODS)
}

export function getTestPresetId(value: unknown, key = 'preset_id') {
  return getEnum(value, key, AI_GATEWAY_TEST_PRESETS.map((preset) => preset.id) as readonly string[])
}
