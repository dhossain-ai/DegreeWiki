// SERVER-ONLY. Admin-only API endpoint.
// POST /api/admin/media/complete-upload
//
// Called by the browser after a successful direct upload to Cloudinary.
// Verifies the Cloudinary response signature before inserting into media_assets.
// The browser cannot fabricate a valid signature without the API secret.
//
// Request body (JSON) — Cloudinary response fields + admin metadata:
//   public_id, version, signature, secure_url, width, height, format,
//   bytes, asset_id, resource_type, folder,
//   display_name, alt_text, caption, credit_text, license_type,
//   license_url, copyright_owner, is_public, is_reusable
//
// Success: { ok: true, id: string }
// Errors:  { ok: false, error: string } — generic messages only

import type { APIRoute } from 'astro'
import { createClient } from '../../../../lib/supabase/server'
import { getCloudinaryConfig, isAllowedSubfolder } from '../../../../lib/cloudinary/config'
import { verifyCloudinaryResponseSignature } from '../../../../lib/cloudinary/upload'

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

  // Extract Cloudinary response fields
  const publicId     = typeof b['public_id']     === 'string' ? b['public_id']     : null
  const version      = b['version']
  const signature    = typeof b['signature']     === 'string' ? b['signature']     : null
  const secureUrl    = typeof b['secure_url']    === 'string' ? b['secure_url']    : null
  const resourceType = typeof b['resource_type'] === 'string' ? b['resource_type'] : null
  const assetId      = typeof b['asset_id']      === 'string' ? b['asset_id']      : null
  const folder       = typeof b['folder']        === 'string' ? b['folder']        : null

  const width         = typeof b['width']  === 'number' ? b['width']  : null
  const height        = typeof b['height'] === 'number' ? b['height'] : null
  const bytes         = typeof b['bytes']  === 'number' ? b['bytes']  : null
  const format        = typeof b['format'] === 'string' ? b['format'] : null

  // Basic presence check before signature verification
  if (!publicId || !version || !signature || !secureUrl) {
    return jsonResponse(400, { ok: false, error: 'invalid_request' })
  }

  // Resource type must be image
  if (resourceType !== 'image') {
    return jsonResponse(400, { ok: false, error: 'invalid_resource_type' })
  }

  // Get config
  let config
  try {
    config = getCloudinaryConfig()
  } catch (e) {
    console.error('Cloudinary config error:', e)
    return jsonResponse(500, { ok: false, error: 'configuration_error' })
  }

  // public_id must start with the configured upload folder
  if (!publicId.startsWith(config.uploadFolder + '/')) {
    console.error('complete-upload: public_id outside upload folder:', publicId)
    return jsonResponse(400, { ok: false, error: 'invalid_public_id' })
  }

  // Validate the subfolder portion is in the allowed list
  const parts = publicId.replace(config.uploadFolder + '/', '').split('/')
  const subfolder = parts[0]
  if (!isAllowedSubfolder(subfolder)) {
    console.error('complete-upload: disallowed subfolder:', subfolder)
    return jsonResponse(400, { ok: false, error: 'invalid_subfolder' })
  }

  // Verify Cloudinary response signature
  const isValid = await verifyCloudinaryResponseSignature({
    publicId,
    version: version as string | number,
    signature,
    apiSecret: config.apiSecret,
    algorithm: config.signatureAlgorithm,
  })

  if (!isValid) {
    console.error('complete-upload: Cloudinary response signature verification failed for:', publicId)
    return jsonResponse(400, { ok: false, error: 'invalid_signature' })
  }

  // Extract and sanitize admin metadata
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
      cloudinary_public_id:      publicId,
      cloudinary_url:            secureUrl,
      cloudinary_asset_id:       assetId,
      cloudinary_version:        String(version),
      cloudinary_resource_type:  'image',
      display_name:              displayName,
      alt_text:                  altText,
      caption,
      credit_text:               creditText,
      license_type:              licenseType,
      license_url:               licenseUrl,
      copyright_owner:           copyrightOwner,
      media_type:                'image',
      format,
      folder,
      width,
      height,
      file_size_bytes:           bytes,
      source_type:               'direct_upload',
      is_public:                 isPublic,
      is_reusable:               isReusable,
      upload_status:             'ready',
      created_by_user_id:        user.id,
    })
    .select('id')
    .single()

  if (insertError || !newAsset) {
    console.error('complete-upload: DB insert error:', insertError)
    return jsonResponse(500, { ok: false, error: 'save_failed' })
  }

  return jsonResponse(200, { ok: true, id: newAsset.id })
}
