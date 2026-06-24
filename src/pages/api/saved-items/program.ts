// Authenticated saved-program API. Uses the user's SSR Supabase client only;
// RLS on saved_items enforces ownership, while this route verifies the program
// is published before creating a save.
import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function readProgramId(request: Request): Promise<string | null> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return null
  }

  const programId = (body as Record<string, unknown>)['program_id']
  return typeof programId === 'string' && UUID_RE.test(programId) ? programId : null
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const programId = await readProgramId(request)
  if (!programId) {
    return jsonResponse(400, { ok: false, error: 'invalid_program' })
  }

  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return jsonResponse(401, { ok: false, error: 'sign_in_required' })
  }

  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('content_status', 'published')
    .maybeSingle()

  if (programError) {
    console.error('saved-program POST: published program check failed:', programError.message)
    return jsonResponse(500, { ok: false, error: 'save_unavailable' })
  }

  if (!program) {
    return jsonResponse(404, { ok: false, error: 'program_not_found' })
  }

  const { error: saveError } = await supabase
    .from('saved_items')
    .upsert(
      {
        user_id: user.id,
        entity_type: 'program',
        entity_id: programId,
      },
      {
        onConflict: 'user_id,entity_type,entity_id',
        ignoreDuplicates: true,
      },
    )

  if (saveError) {
    console.error('saved-program POST: save failed:', saveError.message)
    return jsonResponse(500, { ok: false, error: 'save_unavailable' })
  }

  return jsonResponse(200, { ok: true, saved: true })
}

export const DELETE: APIRoute = async ({ cookies, request }) => {
  const programId = await readProgramId(request)
  if (!programId) {
    return jsonResponse(400, { ok: false, error: 'invalid_program' })
  }

  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return jsonResponse(401, { ok: false, error: 'sign_in_required' })
  }

  const { error: deleteError } = await supabase
    .from('saved_items')
    .delete()
    .eq('user_id', user.id)
    .eq('entity_type', 'program')
    .eq('entity_id', programId)

  if (deleteError) {
    console.error('saved-program DELETE: unsave failed:', deleteError.message)
    return jsonResponse(500, { ok: false, error: 'save_unavailable' })
  }

  return jsonResponse(200, { ok: true, saved: false })
}
