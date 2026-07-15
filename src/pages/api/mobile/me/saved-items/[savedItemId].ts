// DELETE /api/mobile/me/saved-items/[savedItemId]
// Removes a saved item belonging to the authenticated user.
//
// Requires Authorization: Bearer <access_token>.
// Does not depend on browser cookies or the service-role key.
// RLS enforces that only the owner's rows can be deleted.
// Idempotent: missing or foreign IDs return success without
// revealing ownership information.
import type { APIRoute } from 'astro'
import {
  authenticateMobileRequest,
  badRequestResponse,
  unauthorizedResponse,
} from '../../../../../lib/mobile/auth'
import { jsonResponse } from '../../../../../lib/mobile/public'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DELETE: APIRoute = async ({ params, request }) => {
  const auth = await authenticateMobileRequest(request)
  if (!auth) {
    return unauthorizedResponse()
  }

  const { supabase } = auth

  const savedItemId = params.savedItemId ?? ''
  if (!UUID_RE.test(savedItemId)) {
    return badRequestResponse('invalid_saved_item_id')
  }

  // RLS ensures this can only delete the authenticated user's own row.
  // If the ID does not exist or belongs to another user, delete affects
  // zero rows — which is safe and idempotent.
  const { error: deleteError } = await supabase
    .from('saved_items')
    .delete()
    .eq('id', savedItemId)

  if (deleteError) {
    console.error('mobile saved-items DELETE: failed:', deleteError.message)
    return jsonResponse(500, { ok: false, error: 'delete_unavailable' })
  }

  return jsonResponse(200, { ok: true, saved: false })
}
