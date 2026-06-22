// Admin-only media helpers. SERVER-ONLY.
// Never import from client-facing code.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface MediaAssetRow {
  id: string
  cloudinary_public_id: string | null
  display_name: string | null
  alt_text: string | null
  folder: string | null
}

// Loads all reusable, ready, non-deleted media assets for picker dropdowns/grids.
export async function loadReusableReadyMediaAssets(
  supabase: SupabaseClient,
): Promise<MediaAssetRow[]> {
  const { data } = await supabase
    .from('media_assets')
    .select('id, cloudinary_public_id, display_name, alt_text, folder')
    .is('deleted_at', null)
    .eq('is_reusable', true)
    .eq('upload_status', 'ready')
    .order('display_name', { ascending: true })
  return (data ?? []) as MediaAssetRow[]
}

// Validates a set of submitted image FK values against the database in one query.
// Accepts blank/null/undefined values and de-duplicates before querying.
// Returns a Set of UUIDs that are reusable, ready, and not deleted.
export async function validateReusableReadyMediaIds(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>,
): Promise<Set<string>> {
  const valid = ids.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  const unique = [...new Set(valid)]

  if (unique.length === 0) return new Set()

  const { data } = await supabase
    .from('media_assets')
    .select('id')
    .in('id', unique)
    .is('deleted_at', null)
    .eq('is_reusable', true)
    .eq('upload_status', 'ready')

  return new Set((data ?? []).map((r: { id: string }) => r.id))
}
