// SERVER-ONLY. Never import from browser code or client components.
// Uses Web Crypto (crypto.subtle) — no Node.js APIs, Cloudflare-compatible.
// No Cloudinary SDK dependency.

import type { SignatureAlgorithm } from './config'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function digestHex(algorithm: 'SHA-256' | 'SHA-1', message: string): Promise<string> {
  const encoded = new TextEncoder().encode(message)
  const buf = await crypto.subtle.digest(algorithm, encoded)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function toSubtleAlgorithm(algorithm: SignatureAlgorithm): 'SHA-256' | 'SHA-1' {
  return algorithm === 'sha256' ? 'SHA-256' : 'SHA-1'
}

// ---------------------------------------------------------------------------
// signCloudinaryParams
//
// Signs a set of upload parameters for the Cloudinary upload API.
// The string-to-sign is: sorted_params_string + api_secret
//   where sorted_params_string is "&"-joined "key=value" pairs sorted
//   alphabetically by key. The api_key parameter must NOT be included.
//
// Returns the hex-encoded hash.
// ---------------------------------------------------------------------------
export async function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
  algorithm: SignatureAlgorithm = 'sha256',
): Promise<string> {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')
  const message = sorted + apiSecret
  return digestHex(toSubtleAlgorithm(algorithm), message)
}

// ---------------------------------------------------------------------------
// verifyCloudinaryResponseSignature
//
// Verifies the `signature` field returned in a Cloudinary upload response.
// Cloudinary computes this as:
//   hash("public_id=" + public_id + "&version=" + version + api_secret)
//
// Returns true only if the computed hash matches the provided signature.
// Call this in complete-upload.ts before inserting into the database.
// ---------------------------------------------------------------------------
export async function verifyCloudinaryResponseSignature({
  publicId,
  version,
  signature,
  apiSecret,
  algorithm = 'sha256',
}: {
  publicId: string
  version: string | number
  signature: string
  apiSecret: string
  algorithm?: SignatureAlgorithm
}): Promise<boolean> {
  const message = `public_id=${publicId}&version=${version}${apiSecret}`
  const expected = await digestHex(toSubtleAlgorithm(algorithm), message)
  return expected === signature
}

// ---------------------------------------------------------------------------
// validateImportUrl
//
// SSRF guard for URL import. Rejects non-HTTPS URLs and private/loopback
// IP ranges. Returns { ok: true } or { ok: false; reason: string }.
// ---------------------------------------------------------------------------
export function validateImportUrl(
  url: string,
): { ok: true } | { ok: false; reason: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'https_required' }
  }

  const host = parsed.hostname.toLowerCase()

  // Reject loopback and IPv6 loopback
  if (host === 'localhost' || host === '::1' || host === '[::1]') {
    return { ok: false, reason: 'private_host' }
  }

  // Reject private IPv4 ranges
  const octets = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (octets) {
    const [, a, b] = octets.map(Number)
    if (
      a === 10 ||                           // 10.x.x.x
      a === 127 ||                          // 127.x.x.x
      (a === 169 && b === 254) ||           // 169.254.x.x link-local
      (a === 172 && b >= 16 && b <= 31) ||  // 172.16–31.x.x
      (a === 192 && b === 168) ||           // 192.168.x.x
      a === 0                               // 0.x.x.x
    ) {
      return { ok: false, reason: 'private_host' }
    }
  }

  // Reject empty hostnames
  if (!host) {
    return { ok: false, reason: 'invalid_url' }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// callCloudinaryUploadApi
//
// Calls the Cloudinary upload API with a pre-signed parameter set.
// Used by import-url.ts to fetch a remote image via Cloudinary.
// Returns the parsed JSON response or throws on network/API error.
// ---------------------------------------------------------------------------
export async function callCloudinaryUploadApi(
  cloudName: string,
  signedParams: Record<string, string | number>,
  fileOrUrl: string,
): Promise<Record<string, unknown>> {
  const form = new FormData()
  form.append('file', fileOrUrl)
  for (const [k, v] of Object.entries(signedParams)) {
    form.append(k, String(v))
  }

  const resp = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: form },
  )

  const json = await resp.json() as Record<string, unknown>

  if (!resp.ok) {
    // Log server-side detail; do not surface to caller
    console.error('Cloudinary upload API error:', resp.status, json)
    throw new Error('cloudinary_upload_failed')
  }

  return json
}
