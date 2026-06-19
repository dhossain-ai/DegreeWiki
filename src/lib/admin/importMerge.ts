import type { SupabaseClient } from '@supabase/supabase-js'

export type MergeEntityType = 'universities' | 'scholarships' | 'articles'

const MERGE_ALLOWED_ENTITY_TYPES: readonly MergeEntityType[] = [
  'universities', 'scholarships', 'articles',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Strict slug: lowercase letters, digits, single hyphens between segments.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function mergeApprovedRow(
  supabase: SupabaseClient,
  params: {
    entityType: string
    rowId: string
    batchId: string
  }
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { entityType, rowId, batchId } = params

  if (!(MERGE_ALLOWED_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return { ok: false, error: 'Entity type not supported for merge.' }
  }
  if (!UUID_RE.test(rowId)) {
    return { ok: false, error: 'Invalid row ID.' }
  }
  if (!UUID_RE.test(batchId)) {
    return { ok: false, error: 'Invalid batch ID.' }
  }

  const entity = entityType as MergeEntityType

  if (entity === 'universities') return mergeUniversity(supabase, rowId, batchId)
  if (entity === 'scholarships') return mergeScholarship(supabase, rowId, batchId)
  return mergeArticle(supabase, rowId, batchId)
}

// ---------------------------------------------------------------------------
// Universities
// ---------------------------------------------------------------------------

type StagedUniversityRow = {
  id: string
  import_batch_id: string
  import_status: string
  extracted_name: string | null
  extracted_country_code: string | null
  extracted_official_url: string | null
}

async function mergeUniversity(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_universities')
    .select('id, import_batch_id, import_status, extracted_name, extracted_country_code, extracted_official_url')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) {
    return { ok: false, error: 'Staged row not found in this batch.' }
  }

  const row = staged as StagedUniversityRow

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be merged.` }
  }

  if (!row.extracted_name?.trim()) {
    return { ok: false, error: 'Missing required field: extracted_name.' }
  }

  if (!row.extracted_country_code?.trim()) {
    return { ok: false, error: 'Missing required field: extracted_country_code.' }
  }

  // Resolve country_id from iso2 code — this field is NOT NULL on universities.
  const { data: country, error: countryErr } = await supabase
    .from('countries')
    .select('id')
    .eq('iso2', row.extracted_country_code.toUpperCase().trim())
    .single()

  if (countryErr || !country) {
    return {
      ok: false,
      error: `Country code "${row.extracted_country_code}" does not match any country. Merge blocked.`,
    }
  }

  const countryId = (country as { id: string }).id
  const slug = slugify(row.extracted_name)

  if (!slug || !SLUG_RE.test(slug)) {
    return { ok: false, error: 'Could not generate a valid slug from extracted_name. Merge blocked.' }
  }

  const { data: conflict } = await supabase
    .from('universities')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (conflict) {
    return { ok: false, error: `Slug "${slug}" already exists in production universities. Merge blocked.` }
  }

  const insertPayload: Record<string, unknown> = {
    name: row.extracted_name.trim(),
    slug,
    country_id: countryId,
    content_status: 'draft',
    verification_status: 'unverified',
    indexing_status: 'draft',
  }

  if (row.extracted_official_url?.trim()) {
    insertPayload.official_url = row.extracted_official_url.trim()
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('universities')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    if (insertErr?.code === '23505') {
      return { ok: false, error: `Slug conflict on insert: "${slug}" already exists. Merge blocked.` }
    }
    return { ok: false, error: 'Failed to insert production university record. Please try again.' }
  }

  const productionId = (inserted as { id: string }).id

  await supabase
    .from('staging_universities')
    .update({ import_status: 'merged', match_university_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  return { ok: true, productionId }
}

// ---------------------------------------------------------------------------
// Scholarships
// ---------------------------------------------------------------------------

type StagedScholarshipRow = {
  id: string
  import_batch_id: string
  import_status: string
  extracted_name: string | null
  extracted_amount: number | null
  extracted_deadline: string | null
}

async function mergeScholarship(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_scholarships')
    .select('id, import_batch_id, import_status, extracted_name, extracted_amount, extracted_deadline')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) {
    return { ok: false, error: 'Staged row not found in this batch.' }
  }

  const row = staged as StagedScholarshipRow

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be merged.` }
  }

  if (!row.extracted_name?.trim()) {
    return { ok: false, error: 'Missing required field: extracted_name.' }
  }

  const slug = slugify(row.extracted_name)

  if (!slug || !SLUG_RE.test(slug)) {
    return { ok: false, error: 'Could not generate a valid slug from extracted_name. Merge blocked.' }
  }

  const { data: conflict } = await supabase
    .from('scholarships')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (conflict) {
    return { ok: false, error: `Slug "${slug}" already exists in production scholarships. Merge blocked.` }
  }

  const insertPayload: Record<string, unknown> = {
    name: row.extracted_name.trim(),
    slug,
    content_status: 'draft',
    verification_status: 'unverified',
    indexing_status: 'draft',
  }

  // extracted_amount → amount_min only; currency is unknown so left null.
  if (row.extracted_amount !== null && row.extracted_amount !== undefined) {
    insertPayload.amount_min = row.extracted_amount
  }

  // extracted_deadline stored as deadline_text (no date parsing attempted).
  if (row.extracted_deadline?.trim()) {
    insertPayload.deadline_text = row.extracted_deadline.trim()
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('scholarships')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    if (insertErr?.code === '23505') {
      return { ok: false, error: `Slug conflict on insert: "${slug}" already exists. Merge blocked.` }
    }
    return { ok: false, error: 'Failed to insert production scholarship record. Please try again.' }
  }

  const productionId = (inserted as { id: string }).id

  await supabase
    .from('staging_scholarships')
    .update({ import_status: 'merged', match_scholarship_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  return { ok: true, productionId }
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

type StagedArticleRow = {
  id: string
  import_batch_id: string
  import_status: string
  extracted_title: string | null
  extracted_slug: string | null
  extracted_content: string | null
}

async function mergeArticle(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_articles')
    .select('id, import_batch_id, import_status, extracted_title, extracted_slug, extracted_content')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) {
    return { ok: false, error: 'Staged row not found in this batch.' }
  }

  const row = staged as StagedArticleRow

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be merged.` }
  }

  if (!row.extracted_title?.trim()) {
    return { ok: false, error: 'Missing required field: extracted_title.' }
  }

  if (!row.extracted_slug?.trim()) {
    return { ok: false, error: 'Missing required field: extracted_slug.' }
  }

  const slug = row.extracted_slug.trim()

  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: `Slug "${slug}" is not valid. Must be lowercase letters, digits, and hyphens only. Merge blocked.`,
    }
  }

  const { data: conflict } = await supabase
    .from('articles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (conflict) {
    return { ok: false, error: `Slug "${slug}" already exists in production articles. Merge blocked.` }
  }

  const insertPayload: Record<string, unknown> = {
    title: row.extracted_title.trim(),
    slug,
    content_status: 'draft',
    verification_status: 'unverified',
    indexing_status: 'draft',
  }

  // content is nullable in production; include only if present.
  if (row.extracted_content?.trim()) {
    insertPayload.content = row.extracted_content.trim()
  }

  // extracted_category FK lookup deferred: article_categories match is ambiguous.

  const { data: inserted, error: insertErr } = await supabase
    .from('articles')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    if (insertErr?.code === '23505') {
      return { ok: false, error: `Slug conflict on insert: "${slug}" already exists. Merge blocked.` }
    }
    return { ok: false, error: 'Failed to insert production article record. Please try again.' }
  }

  const productionId = (inserted as { id: string }).id

  await supabase
    .from('staging_articles')
    .update({ import_status: 'merged', match_article_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  return { ok: true, productionId }
}
