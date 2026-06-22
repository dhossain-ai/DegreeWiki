// SERVER-ONLY. Admin-only API endpoint.
// POST /api/admin/media/import-url
//
// Imports an image from a remote HTTPS URL via the Cloudinary upload API.
// The server fetches the image on behalf of Cloudinary (Cloudinary fetches
// the URL itself — the image bytes never pass through this Worker).
//
// Includes SSRF protection: rejects non-HTTPS URLs and private IP ranges.
// Does not expose raw Cloudinary errors to the client.
//
// Request body (JSON):
//   source_url, subfolder, display_name, alt_text, caption,
//   credit_text, license_type, license_url, copyright_owner,
//   is_public, is_reusable
//
// Success: { ok: true, id: string }
// Errors:  { ok: false, error: string }

import type { APIRoute } from 'astro'
import { createClient } from '../../../../lib/supabase/server'
import {
  getCloudinaryConfig,
  isAllowedSubfolder,
} from '../../../../lib/cloudinary/config'
import {
  signCloudinaryParams,
  validateImportUrl,
  callCloudinaryUploadApi,
} from '../../../../lib/cloudinary/upload'

const VALID_LICENSE_TYPES = [
  'owned', 'cc_by', 'cc_by_sa', 'cc0', 'royalty_free', 'editorial', 'other',
] as const

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ cookies, request }) => {
  // Auth
  const supabase = createClient(cookies, request)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user || userError) {
    return jsonResponse(401, { ok: false, error: 'unauthenticated' })
  }

  // Permission
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

  const sourceUrl = typeof b['source_url'] === 'string' ? b['source_url'].trim() : ''
  const subfolder = b['subfolder']

  if (!sourceUrl) {
    return jsonResponse(400, { ok: false, error: 'source_url_required' })
  }

  // SSRF guard
  const urlCheck = validateImportUrl(sourceUrl)
  if (!urlCheck.ok) {
    return jsonResponse(400, { ok: false, error: 'invalid_source_url' })
  }

  if (!isAllowedSubfolder(subfolder)) {
    return jsonResponse(400, { ok: false, error: 'invalid_subfolder' })
  }

  // Get config
  let config
  try {
    config = getCloudinaryConfig()
  } catch (e) {
    console.error('Cloudinary config error:', e)
    return jsonResponse(500, { ok: false, error: 'configuration_error' })
  }

  const folder = `${config.uploadFolder}/${subfolder}`
  const timestamp = Math.floor(Date.now() / 1000)

  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  }

  const signature = await signCloudinaryParams(
    paramsToSign,
    config.apiSecret,
    config.signatureAlgorithm,
  )

  const uploadParams: Record<string, string | number> = {
    ...paramsToSign,
    api_key: config.apiKey,
    signature,
  }

  // Call Cloudinary upload API
  let cloudJson: Record<string, unknown>
  try {
    cloudJson = await callCloudinaryUploadApi(config.cloudName, uploadParams, sourceUrl)
  } catch {
    return jsonResponse(502, { ok: false, error: 'import_failed' })
  }

  // Validate Cloudinary response
  const publicId     = typeof cloudJson['public_id']     === 'string' ? cloudJson['public_id']     : null
  const secureUrl    = typeof cloudJson['secure_url']    === 'string' ? cloudJson['secure_url']    : null
  const resourceType = typeof cloudJson['resource_type'] === 'string' ? cloudJson['resource_type'] : null
  const assetId      = typeof cloudJson['asset_id']      === 'string' ? cloudJson['asset_id']      : null
  const version      = cloudJson['version']
  const width        = typeof cloudJson['width']  === 'number' ? cloudJson['width']  : null
  const height       = typeof cloudJson['height'] === 'number' ? cloudJson['height'] : null
  const bytes        = typeof cloudJson['bytes']  === 'number' ? cloudJson['bytes']  : null
  const format       = typeof cloudJson['format'] === 'string' ? cloudJson['format'] : null

  if (!publicId || !secureUrl) {
    console.error('import-url: Cloudinary response missing required fields')
    return jsonResponse(502, { ok: false, error: 'import_failed' })
  }

  if (resourceType !== 'image') {
    return jsonResponse(400, { ok: false, error: 'not_an_image' })
  }

  if (!publicId.startsWith(config.uploadFolder + '/')) {
    console.error('import-url: public_id outside upload folder:', publicId)
    return jsonResponse(502, { ok: false, error: 'import_failed' })
  }

  // Sanitize admin metadata
  const displayName    = String(b['display_name']    ?? '').trim() || null
  const altText        = String(b['alt_text']        ?? '').trim() || null
  const caption        = String(b['caption']         ?? '').trim() || null
  const creditText     = String(b['credit_text']     ?? '').trim() || null
  const licenseUrl     = String(b['license_url']     ?? '').trim() || null
  const copyrightOwner = String(b['copyright_owner'] ?? '').trim() || null
  const isPublic       = b['is_public']   === true || b['is_public']   === 'true'
  const isReusable     = b['is_reusable'] !== false && b['is_reusable'] !== 'false'

  const rawLicenseType = typeof b['license_type'] === 'string' ? b['license_type'] : null
  const licenseType = rawLicenseType && (VALID_LICENSE_TYPES as readonly string[]).includes(rawLicenseType)
    ? rawLicenseType
    : null

  // Insert into media_assets
  const { data: newAsset, error: insertError } = await supabase
    .from('media_assets')
    .insert({
      cloudinary_public_id:     publicId,
      cloudinary_url:           secureUrl,
      cloudinary_asset_id:      assetId,
      cloudinary_version:       version !== undefined ? String(version) : null,
      cloudinary_resource_type: 'image',
      display_name:             displayName,
      alt_text:                 altText,
      caption,
      credit_text:              creditText,
      license_type:             licenseType,
      license_url:              licenseUrl,
      copyright_owner:          copyrightOwner,
      media_type:               'image',
      format,
      folder,
      width,
      height,
      file_size_bytes:          bytes,
      source_type:              'url_import',
      source_url:               sourceUrl,
      is_public:                isPublic,
      is_reusable:              isReusable,
      upload_status:            'ready',
      created_by_user_id:       user.id,
    })
    .select('id, cloudinary_public_id, display_name, alt_text, folder')
    .single()

  if (insertError || !newAsset) {
    console.error('import-url: DB insert error:', insertError)
    return jsonResponse(500, { ok: false, error: 'save_failed' })
  }

  return jsonResponse(200, {
    ok: true,
    id:                   newAsset.id,
    cloudinary_public_id: newAsset.cloudinary_public_id,
    display_name:         newAsset.display_name,
    alt_text:             newAsset.alt_text,
    folder:               newAsset.folder,
  })
}
