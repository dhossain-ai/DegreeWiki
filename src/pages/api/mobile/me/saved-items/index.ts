// GET  /api/mobile/me/saved-items  — list authenticated user's saved programs
// POST /api/mobile/me/saved-items  — save a program for the authenticated user
//
// Requires Authorization: Bearer <access_token>.
// Does not depend on browser cookies or the service-role key.
// All queries are scoped by RLS (user_id = auth.uid()).
import type { APIRoute } from 'astro'
import {
  authenticateMobileRequest,
  badRequestResponse,
  unauthorizedResponse,
} from '../../../../../lib/mobile/auth'
import {
  credentialsErrorResponse,
  formatDuration,
  formatTuitionSummary,
  jsonResponse,
  notFoundResponse,
} from '../../../../../lib/mobile/public'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── GET: list saved programs ──────────────────────────────────

export const GET: APIRoute = async ({ request }) => {
  const auth = await authenticateMobileRequest(request)
  if (!auth) {
    return unauthorizedResponse()
  }

  const { supabase } = auth

  // RLS on saved_items ensures only the authenticated user's rows are returned.
  const { data, error } = await supabase
    .from('saved_items')
    .select(`
      id,
      entity_type,
      entity_id,
      created_at,
      programs!inner(
        id,
        slug,
        title,
        content_status,
        duration_months,
        tuition_min_amount,
        tuition_max_amount,
        tuition_currency,
        tuition_period,
        universities(name),
        countries(name),
        degree_levels(name),
        subjects!programs_primary_subject_id_fkey(name)
      )
    `)
    .eq('entity_type', 'program')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('mobile saved-items GET: list failed:', error.message)
    return credentialsErrorResponse()
  }

  // Filter out saved items whose programs are no longer published,
  // and normalise the response shape.
  const items = (data ?? [])
    .filter((row: any) => {
      const program = row.programs
      return program && program.content_status === 'published'
    })
    .map((row: any) => {
      const program = row.programs
      const tuition = formatTuitionSummary(
        program.tuition_min_amount,
        program.tuition_max_amount,
        program.tuition_currency,
        program.tuition_period,
      )

      return {
        savedItemId: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        savedAt: row.created_at,
        program: {
          id: program.id,
          slug: program.slug,
          title: program.title,
          universityName: program.universities?.name ?? null,
          countryName: program.countries?.name ?? null,
          degreeLevel: program.degree_levels?.name ?? null,
          subject: program.subjects?.name ?? null,
          tuitionDisplay: tuition.display,
          durationMonths: program.duration_months ?? null,
          duration: formatDuration(program.duration_months),
        },
      }
    })

  return jsonResponse(200, { ok: true, items })
}

// ── POST: save a program ──────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  const auth = await authenticateMobileRequest(request)
  if (!auth) {
    return unauthorizedResponse()
  }

  const { supabase, user } = auth

  // Parse and validate JSON body safely.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequestResponse('invalid_json')
  }

  if (!body || typeof body !== 'object') {
    return badRequestResponse('invalid_body')
  }

  const { entityType, entityId } = body as Record<string, unknown>

  if (entityType !== 'program') {
    return badRequestResponse('unsupported_entity_type')
  }

  if (typeof entityId !== 'string' || !UUID_RE.test(entityId)) {
    return badRequestResponse('invalid_entity_id')
  }

  // Verify the program exists and is published.
  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('id')
    .eq('id', entityId)
    .eq('content_status', 'published')
    .maybeSingle()

  if (programError) {
    console.error('mobile saved-items POST: program check failed:', programError.message)
    return credentialsErrorResponse()
  }

  if (!program) {
    return notFoundResponse('program_not_found')
  }

  // Upsert — idempotent. The unique constraint on (user_id, entity_type, entity_id)
  // prevents duplicate rows. RLS enforces user_id = auth.uid() on INSERT.
  const { data: savedRow, error: saveError } = await supabase
    .from('saved_items')
    .upsert(
      {
        user_id: user.id,
        entity_type: 'program',
        entity_id: entityId,
      },
      {
        onConflict: 'user_id,entity_type,entity_id',
        ignoreDuplicates: true,
      },
    )
    .select('id, entity_type, entity_id, created_at')
    .single()

  // When ignoreDuplicates is true and the row already exists, the upsert may
  // not return a row. Fetch the existing row in that case.
  let item = savedRow

  if (!item || saveError) {
    if (saveError && saveError.code !== 'PGRST116') {
      console.error('mobile saved-items POST: save failed:', saveError.message)
      return credentialsErrorResponse()
    }

    // Fetch the existing saved item.
    const { data: existing, error: fetchError } = await supabase
      .from('saved_items')
      .select('id, entity_type, entity_id, created_at')
      .eq('entity_type', 'program')
      .eq('entity_id', entityId)
      .maybeSingle()

    if (fetchError || !existing) {
      console.error('mobile saved-items POST: fetch after upsert failed:', fetchError?.message)
      return credentialsErrorResponse()
    }

    item = existing
  }

  return jsonResponse(200, {
    ok: true,
    saved: true,
    item: {
      savedItemId: item.id,
      entityType: item.entity_type,
      entityId: item.entity_id,
      savedAt: item.created_at,
    },
  })
}
