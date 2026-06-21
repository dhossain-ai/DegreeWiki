// SERVER-ONLY. Admin-only API endpoint.
// POST /api/admin/media/sign-upload
//
// Generates a server-signed parameter set for a direct browser-to-Cloudinary
// image upload. The CLOUDINARY_API_SECRET never leaves the server.
//
// Request body (JSON):
//   { subfolder: AllowedSubfolder, timestamp: number }
//
// Success response:
//   { ok: true, signature, timestamp, api_key, cloud_name, folder,
//     allowed_formats }
//
// The browser must include api_key, signature, and every signed param
// (timestamp, folder, allowed_formats) in its FormData POST to Cloudinary.

import type { APIRoute } from 'astro'
import { createClient } from '../../../../lib/supabase/server'
import { getCloudinaryConfig, isAllowedSubfolder } from '../../../../lib/cloudinary/config'
import { signCloudinaryParams } from '../../../../lib/cloudinary/upload'

const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,gif,svg,avif'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ cookies, request }) => {
  // Auth: must be a signed-in user
  const supabase = createClient(cookies, request)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user || userError) {
    return jsonResponse(401, { ok: false, error: 'unauthenticated' })
  }

  // Permission: must have manage_media
  const { data: canManage } = await supabase.rpc('has_permission', {
    permission_code: 'manage_media',
  })
  if (!canManage) {
    return jsonResponse(403, { ok: false, error: 'forbidden' })
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_body' })
  }

  const b = body as Record<string, unknown>
  const subfolder = b['subfolder']
  const rawTimestamp = b['timestamp']

  if (!isAllowedSubfolder(subfolder)) {
    return jsonResponse(400, { ok: false, error: 'invalid_subfolder' })
  }

  const timestamp =
    typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp)
      ? Math.floor(rawTimestamp)
      : Math.floor(Date.now() / 1000)

  // Build config
  let config
  try {
    config = getCloudinaryConfig()
  } catch (e) {
    console.error('Cloudinary config error:', e)
    return jsonResponse(500, { ok: false, error: 'configuration_error' })
  }

  const folder = `${config.uploadFolder}/${subfolder}`

  // Params to sign — must match exactly what the browser will send to Cloudinary
  // Do not sign resource_type; the /image/upload endpoint supplies it.
  const paramsToSign: Record<string, string | number> = {
    allowed_formats: ALLOWED_FORMATS,
    folder,
    timestamp,
  }

  const signature = await signCloudinaryParams(
    paramsToSign,
    config.apiSecret,
    config.signatureAlgorithm,
  )

  return jsonResponse(200, {
    ok: true,
    signature,
    timestamp,
    api_key: config.apiKey,
    cloud_name: config.cloudName,
    folder,
    allowed_formats: ALLOWED_FORMATS,
  })
}
