// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
import type { AIRuntimeEnv, AIGatewayProviderAccount } from '../types'

const KEY_LENGTH_BYTES = 32
const IV_LENGTH_BYTES = 12

export class AIGatewayCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIGatewayCryptoError'
  }
}

function decodeBase64(value: string): Uint8Array {
  try {
    if (typeof atob === 'function') {
      const binary = atob(value)
      return Uint8Array.from(binary, ch => ch.charCodeAt(0))
    }
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(value, 'base64'))
    }
  } catch {
    // handled below
  }
  throw new AIGatewayCryptoError('AI gateway key material is not valid base64.')
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  throw new AIGatewayCryptoError('Base64 encoding is unavailable in this runtime.')
}

function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function utf8Decode(value: Uint8Array): string {
  return new TextDecoder().decode(value)
}

async function importGatewayKey(env: AIRuntimeEnv): Promise<CryptoKey> {
  const raw = env.AI_GATEWAY_MASTER_KEY?.trim()
  if (!raw) {
    throw new AIGatewayCryptoError('AI gateway master key is not configured.')
  }

  const bytes = decodeBase64(raw)
  if (bytes.byteLength !== KEY_LENGTH_BYTES) {
    throw new AIGatewayCryptoError('AI gateway master key has an invalid length.')
  }

  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

function activeKeyVersion(env: AIRuntimeEnv): string {
  const version = env.AI_GATEWAY_ACTIVE_KEY_VERSION?.trim()
  if (!version) {
    throw new AIGatewayCryptoError('AI gateway active key version is not configured.')
  }
  return version
}

export function maskApiKey(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 4) return null
  return trimmed.slice(-4)
}

export async function fingerprintApiKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8Encode(value))
  return encodeBase64(new Uint8Array(digest))
}

export async function encryptProviderApiKey(
  value: string,
  env: AIRuntimeEnv,
): Promise<{
  ciphertext: string
  iv: string
  keyVersion: string
  last4: string | null
  fingerprint: string
}> {
  const key = await importGatewayKey(env)
  const keyVersion = activeKeyVersion(env)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    utf8Encode(value),
  )

  return {
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    iv: encodeBase64(iv),
    keyVersion,
    last4: maskApiKey(value),
    fingerprint: await fingerprintApiKey(value),
  }
}

export async function decryptProviderApiKey(
  record: Pick<AIGatewayProviderAccount, 'apiKeyCiphertext' | 'apiKeyIv' | 'apiKeyKeyVersion'>,
  env: AIRuntimeEnv,
): Promise<string> {
  const expectedVersion = activeKeyVersion(env)
  if (record.apiKeyKeyVersion !== expectedVersion) {
    throw new AIGatewayCryptoError('AI gateway key version is not available in this runtime.')
  }

  const key = await importGatewayKey(env)
  const ciphertext = decodeBase64(record.apiKeyCiphertext)
  const iv = decodeBase64(record.apiKeyIv)
  if (iv.byteLength !== IV_LENGTH_BYTES) {
    throw new AIGatewayCryptoError('AI gateway IV has an invalid length.')
  }

  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
  } catch {
    throw new AIGatewayCryptoError('AI gateway key decryption failed.')
  }

  return utf8Decode(new Uint8Array(plaintext))
}
