import type { SupabaseClient } from '@supabase/supabase-js'

export type MergeEntityType = 'universities' | 'scholarships' | 'articles' | 'programs'
export type MergeAction = 'create_new' | 'update_existing' | 'skip_existing'
export type MergeStatusFilter = 'all' | 'pending' | 'validated' | 'needs_review' | 'approved' | 'rejected' | 'skipped' | 'merged' | 'error'

const CREATE_NEW_TYPES: readonly MergeEntityType[] = ['universities', 'scholarships', 'articles', 'programs']
const UPDATE_EXISTING_TYPES: readonly string[] = ['universities', 'scholarships', 'articles', 'programs']
const SKIP_EXISTING_TYPES: readonly string[] = ['programs']
const VALID_MERGE_STATUS_FILTERS: readonly MergeStatusFilter[] = [
  'all', 'pending', 'validated', 'needs_review', 'approved', 'rejected', 'skipped', 'merged', 'error',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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
    action?: MergeAction
    allowDuplicateCreate?: boolean
  }
): Promise<{ ok: true; productionId: string; warning?: string } | { ok: false; error: string }> {
  const { entityType, rowId, batchId, action = 'create_new', allowDuplicateCreate = false } = params

  if (!UUID_RE.test(rowId)) return { ok: false, error: 'Invalid row ID.' }
  if (!UUID_RE.test(batchId)) return { ok: false, error: 'Invalid batch ID.' }

  if (action === 'update_existing') {
    if (!UPDATE_EXISTING_TYPES.includes(entityType)) {
      return { ok: false, error: 'Update-existing is not supported for this entity type.' }
    }
    return updateExistingRow(supabase, entityType as 'universities' | 'scholarships' | 'articles' | 'programs', rowId, batchId)
  }

  if (action === 'skip_existing') {
    if (!SKIP_EXISTING_TYPES.includes(entityType)) {
      return { ok: false, error: 'Skip-existing is not supported for this entity type.' }
    }
    return skipExistingRow(supabase, entityType as 'programs', rowId, batchId)
  }

  if (!(CREATE_NEW_TYPES as readonly string[]).includes(entityType)) {
    return { ok: false, error: 'Entity type not supported for merge.' }
  }

  const entity = entityType as MergeEntityType
  if (entity === 'universities') return mergeUniversity(supabase, rowId, batchId)
  if (entity === 'scholarships') return mergeScholarship(supabase, rowId, batchId)
  if (entity === 'programs') return mergeProgram(supabase, rowId, batchId, { allowDuplicateCreate })
  return mergeArticle(supabase, rowId, batchId)
}

// ---------------------------------------------------------------------------
// Update-existing dispatcher (exported for direct use if needed)
// ---------------------------------------------------------------------------

export async function updateExistingRow(
  supabase: SupabaseClient,
  entity: 'universities' | 'scholarships' | 'articles' | 'programs',
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  if (entity === 'universities') return updateExistingUniversity(supabase, rowId, batchId)
  if (entity === 'scholarships') return updateExistingScholarship(supabase, rowId, batchId)
  if (entity === 'programs') return updateExistingProgram(supabase, rowId, batchId)
  return updateExistingArticle(supabase, rowId, batchId)
}

export async function skipExistingRow(
  supabase: SupabaseClient,
  entity: 'programs',
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  return skipExistingProgram(supabase, rowId, batchId)
}

// ---------------------------------------------------------------------------
// Universities — create-new
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

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
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

  const { data: country, error: countryErr } = await supabase
    .from('countries')
    .select('id')
    .eq('iso2', row.extracted_country_code.toUpperCase().trim())
    .single()

  if (countryErr || !country) {
    return { ok: false, error: `Country code "${row.extracted_country_code}" does not match any country. Merge blocked.` }
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

  const { error: stagingUpdateErr } = await supabase
    .from('staging_universities')
    .update({ import_status: 'merged', match_university_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] mergeUniversity: staging status update failed after production insert:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: true,
      productionId,
      warning: 'Production university created but staging row status update failed. The row may still show "approved". Reload the page to check.',
    }
  }

  return { ok: true, productionId }
}

// ---------------------------------------------------------------------------
// Universities — update-existing
// ---------------------------------------------------------------------------

async function updateExistingUniversity(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_universities')
    .select('id, import_batch_id, import_status, extracted_official_url, match_university_id')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
  const row = staged as {
    id: string; import_batch_id: string; import_status: string
    extracted_official_url: string | null; match_university_id: string | null
  }

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be updated.` }
  }
  if (!row.match_university_id) {
    return { ok: false, error: 'No match_university_id set. Cannot update-existing without a target production record.' }
  }

  const { data: prod, error: prodErr } = await supabase
    .from('universities')
    .select('id, official_url')
    .eq('id', row.match_university_id)
    .single()

  if (prodErr || !prod) {
    return { ok: false, error: 'Target production university not found. It may have been deleted.' }
  }

  const prodRow = prod as { id: string; official_url: string | null }
  const patches: Record<string, unknown> = {}

  if (!prodRow.official_url?.trim() && row.extracted_official_url?.trim()) {
    patches.official_url = row.extracted_official_url.trim()
  }

  // Apply production patch only when there is something safe to update.
  // If nothing to patch, proceed without patching — the staging row is still
  // marked merged so downstream program imports can resolve match_university_id.
  if (Object.keys(patches).length > 0) {
    const { error: updateErr } = await supabase.from('universities').update(patches).eq('id', prodRow.id)
    if (updateErr) return { ok: false, error: 'Failed to update production university. Please try again.' }
  }

  const { error: stagingUpdateErr } = await supabase
    .from('staging_universities')
    .update({ import_status: 'merged', match_university_id: prodRow.id })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] updateExistingUniversity: staging status update failed:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: true,
      productionId: prodRow.id,
      warning: 'Production university linked but staging row status update failed. The row may still show "approved". Reload the page to check.',
    }
  }

  return { ok: true, productionId: prodRow.id }
}

// ---------------------------------------------------------------------------
// Scholarships — create-new
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

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
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

  if (row.extracted_amount !== null && row.extracted_amount !== undefined) {
    insertPayload.amount_min = row.extracted_amount
  }
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

  const { error: stagingUpdateErr } = await supabase
    .from('staging_scholarships')
    .update({ import_status: 'merged', match_scholarship_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] mergeScholarship: staging status update failed after production insert:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: true,
      productionId,
      warning: 'Production scholarship created but staging row status update failed. The row may still show "approved". Reload the page to check.',
    }
  }

  return { ok: true, productionId }
}

// ---------------------------------------------------------------------------
// Scholarships — update-existing
// ---------------------------------------------------------------------------

async function updateExistingScholarship(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_scholarships')
    .select('id, import_batch_id, import_status, extracted_amount, extracted_deadline, match_scholarship_id')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
  const row = staged as {
    id: string; import_batch_id: string; import_status: string
    extracted_amount: number | null; extracted_deadline: string | null
    match_scholarship_id: string | null
  }

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be updated.` }
  }
  if (!row.match_scholarship_id) {
    return { ok: false, error: 'No match_scholarship_id set. Cannot update-existing without a target production record.' }
  }

  const { data: prod, error: prodErr } = await supabase
    .from('scholarships')
    .select('id, amount_min, deadline_text')
    .eq('id', row.match_scholarship_id)
    .single()

  if (prodErr || !prod) {
    return { ok: false, error: 'Target production scholarship not found. It may have been deleted.' }
  }

  const prodRow = prod as { id: string; amount_min: number | null; deadline_text: string | null }
  const patches: Record<string, unknown> = {}

  if (prodRow.amount_min === null && row.extracted_amount !== null) {
    patches.amount_min = row.extracted_amount
  }
  if (!prodRow.deadline_text?.trim() && row.extracted_deadline?.trim()) {
    patches.deadline_text = row.extracted_deadline.trim()
  }

  if (Object.keys(patches).length === 0) {
    return {
      ok: false,
      error: 'Nothing safe to patch: all allowlisted production fields are already set, or staging has no values. Merge not applied.',
    }
  }

  const { error: updateErr } = await supabase.from('scholarships').update(patches).eq('id', prodRow.id)
  if (updateErr) return { ok: false, error: 'Failed to update production scholarship. Please try again.' }

  const { error: stagingUpdateErr } = await supabase
    .from('staging_scholarships')
    .update({ import_status: 'merged' })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] updateExistingScholarship: staging status update failed:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: true,
      productionId: prodRow.id,
      warning: 'Production scholarship patched but staging row status update failed. The row may still show "approved". Reload the page to check.',
    }
  }

  return { ok: true, productionId: prodRow.id }
}

// ---------------------------------------------------------------------------
// Articles — create-new
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

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
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

  if (row.extracted_content?.trim()) {
    insertPayload.content = row.extracted_content.trim()
  }

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

  const { error: stagingUpdateErr } = await supabase
    .from('staging_articles')
    .update({ import_status: 'merged', match_article_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] mergeArticle: staging status update failed after production insert:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: true,
      productionId,
      warning: 'Production article created but staging row status update failed. The row may still show "approved". Reload the page to check.',
    }
  }

  return { ok: true, productionId }
}

// ---------------------------------------------------------------------------
// Articles — update-existing
// ---------------------------------------------------------------------------

async function updateExistingArticle(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_articles')
    .select('id, import_batch_id, import_status, extracted_content, match_article_id')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
  const row = staged as {
    id: string; import_batch_id: string; import_status: string
    extracted_content: string | null; match_article_id: string | null
  }

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be updated.` }
  }
  if (!row.match_article_id) {
    return { ok: false, error: 'No match_article_id set. Cannot update-existing without a target production record.' }
  }

  const { data: prod, error: prodErr } = await supabase
    .from('articles')
    .select('id, content')
    .eq('id', row.match_article_id)
    .single()

  if (prodErr || !prod) {
    return { ok: false, error: 'Target production article not found. It may have been deleted.' }
  }

  const prodRow = prod as { id: string; content: string | null }
  const patches: Record<string, unknown> = {}

  if (!prodRow.content?.trim() && row.extracted_content?.trim()) {
    patches.content = row.extracted_content.trim()
  }

  if (Object.keys(patches).length === 0) {
    return {
      ok: false,
      error: 'Nothing safe to patch: production content is already set, or staging has no content. Merge not applied.',
    }
  }

  const { error: updateErr } = await supabase.from('articles').update(patches).eq('id', prodRow.id)
  if (updateErr) return { ok: false, error: 'Failed to update production article. Please try again.' }

  const { error: stagingUpdateErr } = await supabase
    .from('staging_articles')
    .update({ import_status: 'merged' })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] updateExistingArticle: staging status update failed:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: true,
      productionId: prodRow.id,
      warning: 'Production article patched but staging row status update failed. The row may still show "approved". Reload the page to check.',
    }
  }

  return { ok: true, productionId: prodRow.id }
}

// ---------------------------------------------------------------------------
// Programs — create-new
// ---------------------------------------------------------------------------

type StagedProgramRow = {
  id: string
  import_batch_id: string
  import_status: string
  raw_data: Record<string, unknown>
  extracted_title: string | null
  extracted_degree_level_code: string | null
  extracted_language: string | null
  extracted_tuition_amount: number | null
  staging_university_id: string | null
  match_program_id: string | null
}

type ProgramMatchLookupRow = Pick<StagedProgramRow, 'id' | 'extracted_title' | 'extracted_degree_level_code' | 'staging_university_id' | 'match_program_id'>

export type ProgramProductionMatch = {
  id: string
  title: string
  slug: string
  university_id: string
  degree_level_id: string
  content_status: string
  verification_status: string
}

export type ProgramProductionMatchResolution = {
  rowId: string
  status: 'missing_title' | 'missing_university_link' | 'missing_degree_level' | 'no_match' | 'matched' | 'ambiguous'
  linkedUniversityId: string | null
  degreeLevelId: string | null
  matches: ProgramProductionMatch[]
}

export type ProgramPrimarySubjectResolution = {
  status: 'missing' | 'matched_by_name' | 'matched_by_slug' | 'unmatched' | 'ambiguous'
  input: string | null
  subjectId: string | null
}

export type ProgramImportPreview = {
  language: string | null
  durationLabel: string | null
  tuitionLabel: string | null
  officialUrl: string | null
  applicationUrl: string | null
  primarySubject: string | null
  admissionSnippet: string | null
  curriculumSnippet: string | null
  careerSnippet: string | null
  sourceUrlCount: number
}

function normalizeForExactProgramMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function resolveProgramProductionMatchContext(
  supabase: SupabaseClient,
  rows: ProgramMatchLookupRow[]
): Promise<{
  stagingUniversityMatchMap: Map<string, string | null>
  degreeLevelIdMap: Map<string, string>
  candidatesByKey: Map<string, ProgramProductionMatch[]>
}> {
  const stagingUniversityIds = [...new Set(
    rows
      .map((row) => row.staging_university_id)
      .filter((value): value is string => Boolean(value))
  )]

  const stagingUniversityMatchMap = new Map<string, string | null>()
  if (stagingUniversityIds.length > 0) {
    const { data: stagingUnis } = await supabase
      .from('staging_universities')
      .select('id, match_university_id')
      .in('id', stagingUniversityIds)

    for (const stagingUni of (stagingUnis ?? []) as Array<{ id: string; match_university_id: string | null }>) {
      stagingUniversityMatchMap.set(stagingUni.id, stagingUni.match_university_id)
    }
  }

  const degreeCodes = [...new Set(
    rows
      .map((row) => row.extracted_degree_level_code?.trim())
      .filter((value): value is string => Boolean(value))
  )]

  const degreeLevelIdMap = new Map<string, string>()
  if (degreeCodes.length > 0) {
    const { data: degreeLevels } = await supabase
      .from('degree_levels')
      .select('id, code')
      .in('code', degreeCodes)
      .eq('is_active', true)

    for (const degreeLevel of (degreeLevels ?? []) as Array<{ id: string; code: string }>) {
      degreeLevelIdMap.set(degreeLevel.code.trim(), degreeLevel.id)
    }
  }

  const linkedUniversityIds = [...new Set(
    [...stagingUniversityMatchMap.values()].filter((value): value is string => Boolean(value))
  )]
  const degreeLevelIds = [...new Set(degreeLevelIdMap.values())]
  const candidatesByKey = new Map<string, ProgramProductionMatch[]>()

  if (linkedUniversityIds.length > 0 && degreeLevelIds.length > 0) {
    const { data: productionPrograms } = await supabase
      .from('programs')
      .select('id, title, slug, university_id, degree_level_id, content_status, verification_status')
      .in('university_id', linkedUniversityIds)
      .in('degree_level_id', degreeLevelIds)

    for (const program of (productionPrograms ?? []) as ProgramProductionMatch[]) {
      const key = `${program.university_id}|${program.degree_level_id}|${normalizeForExactProgramMatch(program.title)}`
      const existing = candidatesByKey.get(key) ?? []
      existing.push(program)
      candidatesByKey.set(key, existing)
    }
  }

  return { stagingUniversityMatchMap, degreeLevelIdMap, candidatesByKey }
}

export async function resolveProgramProductionMatches(
  supabase: SupabaseClient,
  rows: ProgramMatchLookupRow[]
): Promise<Map<string, ProgramProductionMatchResolution>> {
  const results = new Map<string, ProgramProductionMatchResolution>()
  if (rows.length === 0) return results

  const { stagingUniversityMatchMap, degreeLevelIdMap, candidatesByKey } = await resolveProgramProductionMatchContext(supabase, rows)

  for (const row of rows) {
    const title = row.extracted_title?.trim() ?? ''
    if (!title) {
      results.set(row.id, {
        rowId: row.id,
        status: 'missing_title',
        linkedUniversityId: null,
        degreeLevelId: null,
        matches: [],
      })
      continue
    }

    const linkedUniversityId = row.staging_university_id
      ? (stagingUniversityMatchMap.get(row.staging_university_id) ?? null)
      : null
    if (!linkedUniversityId) {
      results.set(row.id, {
        rowId: row.id,
        status: 'missing_university_link',
        linkedUniversityId: null,
        degreeLevelId: null,
        matches: [],
      })
      continue
    }

    const degreeCode = row.extracted_degree_level_code?.trim() ?? ''
    const degreeLevelId = degreeCode ? (degreeLevelIdMap.get(degreeCode) ?? null) : null
    if (!degreeLevelId) {
      results.set(row.id, {
        rowId: row.id,
        status: 'missing_degree_level',
        linkedUniversityId,
        degreeLevelId: null,
        matches: [],
      })
      continue
    }

    const key = `${linkedUniversityId}|${degreeLevelId}|${normalizeForExactProgramMatch(title)}`
    const matches = candidatesByKey.get(key) ?? []

    results.set(row.id, {
      rowId: row.id,
      status: matches.length === 0 ? 'no_match' : matches.length === 1 ? 'matched' : 'ambiguous',
      linkedUniversityId,
      degreeLevelId,
      matches,
    })
  }

  return results
}

async function resolveSingleProgramProductionMatch(
  supabase: SupabaseClient,
  row: ProgramMatchLookupRow
): Promise<ProgramProductionMatchResolution> {
  const resolutions = await resolveProgramProductionMatches(supabase, [row])
  return resolutions.get(row.id) ?? {
    rowId: row.id,
    status: 'no_match',
    linkedUniversityId: null,
    degreeLevelId: null,
    matches: [],
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function textField(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key]
    if (value === null || value === undefined) continue
    if (typeof value === 'object') continue
    const s = String(value).trim()
    if (s) return s
  }
  return null
}

function numberField(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key]
    if (value === null || value === undefined || value === '') continue
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function positiveIntegerField(raw: Record<string, unknown>, keys: string[]): number | null {
  const n = numberField(raw, keys)
  if (n === null || n < 1 || !Number.isInteger(n)) return null
  return n
}

function normalizeEnum(value: string | null, allowed: readonly string[], aliases: Record<string, string> = {}): string | null {
  if (!value) return null
  const key = value.toLowerCase().replace(/[\s-]+/g, '_').trim()
  const normalized = aliases[key] ?? key
  return allowed.includes(normalized) ? normalized : null
}

function normalizeTuitionPeriod(value: string | null): string | null {
  return normalizeEnum(value, ['per_year', 'per_semester', 'total', 'per_credit'], {
    year: 'per_year',
    yearly: 'per_year',
    annual: 'per_year',
    annually: 'per_year',
    per_annum: 'per_year',
    semester: 'per_semester',
    credit: 'per_credit',
  })
}

function formatProgramImportSnippet(value: string | null, maxLength = 96): string | null {
  if (!value) return null
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return null
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1).trimEnd()}…` : compact
}

function formatProgramImportTuitionLabel(raw: Record<string, unknown>, fallbackAmount: number | null = null): string | null {
  const tuitionMin = numberField(raw, ['tuition_min_amount', 'tuition_amount', 'tuition'])
  const tuitionMax = numberField(raw, ['tuition_max_amount', 'tuition_amount_max'])
  const currency = textField(raw, ['tuition_currency', 'currency'])
  const period = normalizeTuitionPeriod(textField(raw, ['tuition_period', 'tuition_frequency']))
  const effectiveMin = tuitionMin ?? fallbackAmount

  if (effectiveMin === null && tuitionMax === null && !currency && !period) return null

  let amountLabel = 'Not listed'
  if (effectiveMin !== null && tuitionMax !== null) {
    amountLabel = effectiveMin === tuitionMax
      ? String(effectiveMin)
      : `${effectiveMin}-${tuitionMax}`
  } else if (effectiveMin !== null) {
    amountLabel = String(effectiveMin)
  } else if (tuitionMax !== null) {
    amountLabel = String(tuitionMax)
  }

  const suffix = [currency, period].filter(Boolean).join(' / ')
  return suffix ? `${amountLabel} ${suffix}` : amountLabel
}

function collectUniqueProgramSourceUrls(raw: Record<string, unknown>): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  function add(urlValue: string | null) {
    const sourceUrl = validUrlOrNull(urlValue)
    if (!sourceUrl || seen.has(sourceUrl)) return
    seen.add(sourceUrl)
    urls.push(sourceUrl)
  }

  add(textField(raw, ['official_program_url', 'official_url', 'program_url']))
  add(textField(raw, ['official_application_url', 'application_url', 'apply_url']))
  add(textField(raw, ['official_tuition_url']))

  const sourceUrls = raw.source_urls
  if (Array.isArray(sourceUrls)) {
    for (const value of sourceUrls) {
      if (typeof value === 'string') add(value)
    }
  }

  return urls
}

export function buildProgramImportPreview(
  raw: Record<string, unknown>,
  extracted: { language?: string | null; tuitionAmount?: number | null } = {},
): ProgramImportPreview {
  const language = textField(raw, ['language_of_instruction', 'language', 'instruction_language'])
    ?? extracted.language?.trim()
    ?? null
  const durationMonths = positiveIntegerField(raw, ['duration_months', 'duration_in_months'])
  const durationText = textField(raw, ['duration_text'])
  const admissionText = textField(raw, [
    'admission_requirements_text',
    'admission_requirements',
    'entry_requirements',
    'academic_requirements_text',
  ])

  return {
    language,
    durationLabel: durationMonths !== null
      ? `${durationMonths} month${durationMonths === 1 ? '' : 's'}`
      : durationText,
    tuitionLabel: formatProgramImportTuitionLabel(raw, extracted.tuitionAmount ?? null),
    officialUrl: textField(raw, ['official_program_url', 'official_url', 'program_url']),
    applicationUrl: textField(raw, ['official_application_url', 'application_url', 'apply_url']),
    primarySubject: textField(raw, ['primary_subject', 'subject_area', 'subject']),
    admissionSnippet: formatProgramImportSnippet(admissionText),
    curriculumSnippet: formatProgramImportSnippet(textField(raw, [
      'curriculum_or_modules_text',
      'curriculum_summary',
      'curriculum',
      'modules_summary',
    ])),
    careerSnippet: formatProgramImportSnippet(textField(raw, [
      'career_outcomes_text',
      'career_outcomes',
      'career_prospects',
    ])),
    sourceUrlCount: collectUniqueProgramSourceUrls(raw).length,
  }
}

function buildEnglishRequirements(raw: Record<string, unknown>): Record<string, unknown> | null {
  const structured = raw.english_requirements
  if (isPlainObject(structured)) {
    return structured
  }

  const englishText = textField(raw, ['english_requirements_text', 'english_requirements'])
  const ielts = numberField(raw, ['ielts_min_score'])
  const toefl = numberField(raw, ['toefl_min_score'])

  const requirements: Record<string, unknown> = {}
  if (englishText) requirements.notes = englishText
  if (ielts !== null) requirements.ielts = { min_overall: ielts }
  if (toefl !== null) requirements.toefl = { min_overall: toefl }

  return Object.keys(requirements).length > 0 ? requirements : null
}

export async function resolveProgramPrimarySubject(
  supabase: SupabaseClient,
  raw: Record<string, unknown>,
): Promise<ProgramPrimarySubjectResolution> {
  const subjectName = textField(raw, ['primary_subject', 'subject_area', 'subject'])
  if (!subjectName) {
    return { status: 'missing', input: null, subjectId: null }
  }

  const { data: byName } = await supabase
    .from('subjects')
    .select('id, name')
    .ilike('name', subjectName)
    .limit(10)

  const exactMatches = ((byName ?? []) as { id: string; name: string }[])
    .filter((subject) => subject.name.toLowerCase() === subjectName.toLowerCase())

  if (exactMatches.length === 1) {
    return { status: 'matched_by_name', input: subjectName, subjectId: exactMatches[0].id }
  }
  if (exactMatches.length > 1) {
    return { status: 'ambiguous', input: subjectName, subjectId: null }
  }

  const subjectSlug = slugify(subjectName)
  if (!subjectSlug) {
    return { status: 'unmatched', input: subjectName, subjectId: null }
  }

  const { data: bySlug } = await supabase
    .from('subjects')
    .select('id')
    .eq('slug', subjectSlug)
    .limit(2)

  const slugMatches = (bySlug ?? []) as { id: string }[]
  if (slugMatches.length === 1) {
    return { status: 'matched_by_slug', input: subjectName, subjectId: slugMatches[0].id }
  }
  if (slugMatches.length > 1) {
    return { status: 'ambiguous', input: subjectName, subjectId: null }
  }

  return { status: 'unmatched', input: subjectName, subjectId: null }
}

async function buildRichProgramPayload(
  supabase: SupabaseClient,
  raw: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {}

  const directTextFields: Array<[string, string[]]> = [
    ['degree_award', ['degree_award', 'award', 'credential']],
    ['language_of_instruction', ['language_of_instruction', 'language', 'instruction_language']],
    ['tuition_currency', ['tuition_currency', 'currency']],
    ['tuition_notes', ['tuition_notes', 'tuition_note']],
    ['application_fee_currency', ['application_fee_currency', 'app_fee_currency']],
    ['application_fee_notes', ['application_fee_notes', 'app_fee_notes']],
    ['official_url', ['official_program_url', 'official_url', 'program_url']],
    ['application_url', ['official_application_url', 'application_url', 'apply_url']],
    ['admission_requirements', ['admission_requirements_text', 'admission_requirements', 'entry_requirements']],
    ['gpa_requirements', ['gpa_requirements_text', 'gpa_requirements', 'minimum_gpa']],
    ['curriculum_summary', ['curriculum_or_modules_text', 'curriculum_summary', 'curriculum', 'modules_summary']],
    ['career_outcomes', ['career_outcomes_text', 'career_outcomes', 'career_prospects']],
  ]

  for (const [column, keys] of directTextFields) {
    const value = textField(raw, keys)
    if (value) payload[column] = value
  }

  const studyMode = normalizeEnum(
    textField(raw, ['study_mode', 'attendance_mode']),
    ['full_time', 'part_time', 'online', 'hybrid'],
    { fulltime: 'full_time', full_time: 'full_time', parttime: 'part_time', part_time: 'part_time' }
  )
  if (studyMode) payload.study_mode = studyMode

  const deliveryMode = normalizeEnum(
    textField(raw, ['delivery_mode', 'delivery_format']),
    ['on_campus', 'online', 'hybrid', 'distance'],
    { campus: 'on_campus', in_person: 'on_campus', oncampus: 'on_campus' }
  )
  if (deliveryMode) payload.delivery_mode = deliveryMode

  const durationMonths = positiveIntegerField(raw, ['duration_months', 'duration_in_months'])
  if (durationMonths !== null) payload.duration_months = durationMonths

  const tuitionMin = numberField(raw, ['tuition_min_amount', 'tuition_amount', 'tuition'])
  if (tuitionMin !== null) payload.tuition_min_amount = tuitionMin

  const tuitionMax = numberField(raw, ['tuition_max_amount', 'tuition_amount_max'])
  if (tuitionMax !== null) payload.tuition_max_amount = tuitionMax

  const tuitionPeriod = normalizeTuitionPeriod(textField(raw, ['tuition_period', 'tuition_frequency']))
  if (tuitionPeriod) payload.tuition_period = tuitionPeriod

  const applicationFee = numberField(raw, ['application_fee_amount', 'application_fee', 'app_fee_amount'])
  if (applicationFee !== null) payload.application_fee_amount = applicationFee

  const englishRequirements = buildEnglishRequirements(raw)
  if (englishRequirements) payload.english_requirements = englishRequirements

  const subjectResolution = await resolveProgramPrimarySubject(supabase, raw)
  if (subjectResolution.subjectId) {
    payload.primary_subject_id = subjectResolution.subjectId
  }

  return payload
}

function validUrlOrNull(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).toString()
  } catch {
    return null
  }
}

function confidenceLevel(raw: Record<string, unknown>): string {
  const value = textField(raw, ['source_confidence'])
  return normalizeEnum(value, ['high', 'medium', 'low', 'unknown']) ?? 'unknown'
}

function collectProgramSourceRows(
  productionId: string,
  raw: Record<string, unknown>
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  const confidence = confidenceLevel(raw)
  const officialProgramUrl = validUrlOrNull(textField(raw, ['official_program_url', 'official_url', 'program_url']))
  const officialApplicationUrl = validUrlOrNull(textField(raw, ['official_application_url', 'application_url', 'apply_url']))
  const officialTuitionUrl = validUrlOrNull(textField(raw, ['official_tuition_url']))

  function addSource(sourceUrl: string, title: string, sourceType: string, isPrimary: boolean) {
    rows.push({
      entity_type: 'program',
      entity_id: productionId,
      source_url: sourceUrl,
      source_domain: new URL(sourceUrl).hostname,
      source_title: title,
      source_type: sourceType,
      confidence_level: confidence,
      source_status: 'active',
      is_primary_source: isPrimary,
      notes: 'Imported from staged research pack. Verify manually before marking the program verified.',
    })
  }

  for (const sourceUrl of collectUniqueProgramSourceUrls(raw)) {
    if (sourceUrl === officialProgramUrl) {
      addSource(sourceUrl, 'Official program page', 'official_university', rows.length === 0)
      continue
    }
    if (sourceUrl === officialApplicationUrl) {
      addSource(sourceUrl, 'Official application page', 'official_university', rows.length === 0)
      continue
    }
    if (sourceUrl === officialTuitionUrl) {
      addSource(sourceUrl, 'Official tuition page', 'official_university', rows.length === 0)
      continue
    }

    addSource(sourceUrl, 'Research source', 'third_party', rows.length === 0)
  }

  return rows
}

async function attachProgramSourceRows(
  supabase: SupabaseClient,
  productionId: string,
  raw: Record<string, unknown>
): Promise<string | undefined> {
  const sourceRows = collectProgramSourceRows(productionId, raw)
  if (sourceRows.length === 0) return undefined

  let rowsToInsert = sourceRows
  const { data: existingSourceRows, error: existingSourceErr } = await supabase
    .from('data_sources')
    .select('source_url')
    .eq('entity_type', 'program')
    .eq('entity_id', productionId)

  if (existingSourceErr) {
    console.error('[importMerge] attachProgramSourceRows: source lookup failed:', existingSourceErr.code, existingSourceErr.message)
  } else {
    const existingUrls = new Set(
      ((existingSourceRows ?? []) as Array<{ source_url: string | null }>)
        .map((row) => row.source_url?.trim())
        .filter((value): value is string => Boolean(value))
    )
    rowsToInsert = sourceRows.filter((row) => {
      const sourceUrl = typeof row.source_url === 'string' ? row.source_url.trim() : ''
      return sourceUrl && !existingUrls.has(sourceUrl)
    })
  }

  if (rowsToInsert.length === 0) return undefined

  const { error: sourceErr } = await supabase.from('data_sources').insert(rowsToInsert)
  if (sourceErr) {
    console.error('[importMerge] attachProgramSourceRows: data source insert failed:', sourceErr.code, sourceErr.message)
    return 'Production program was saved, but source links could not be attached. Add them manually from the program edit page.'
  }

  return undefined
}

function patchWhenEmpty(
  patches: Record<string, unknown>,
  currentValue: unknown,
  nextValue: unknown,
  column: string
) {
  if (nextValue === null || nextValue === undefined) return

  if (typeof nextValue === 'string') {
    if (!nextValue.trim()) return
    if (typeof currentValue === 'string' && currentValue.trim()) return
    if (currentValue !== null && currentValue !== undefined && typeof currentValue !== 'string') return
    patches[column] = nextValue.trim()
    return
  }

  if (typeof nextValue === 'number') {
    if (currentValue === null || currentValue === undefined) {
      patches[column] = nextValue
    }
    return
  }

  if (typeof nextValue === 'boolean') {
    if (currentValue === null || currentValue === undefined) {
      patches[column] = nextValue
    }
    return
  }

  if (currentValue === null || currentValue === undefined) {
    patches[column] = nextValue
  }
}

async function mergeProgram(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string,
  options: { allowDuplicateCreate?: boolean } = {}
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { allowDuplicateCreate = false } = options
  // 1. Read staged row
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_programs')
    .select('id, import_batch_id, import_status, raw_data, extracted_title, extracted_degree_level_code, extracted_language, extracted_tuition_amount, staging_university_id, match_program_id')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
  const row = staged as StagedProgramRow

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be merged.` }
  }
  if (row.match_program_id) {
    return { ok: false, error: 'Row is already linked to a production program. Create-new merge blocked.' }
  }
  if (!row.extracted_title?.trim()) {
    return { ok: false, error: 'Missing required field: extracted_title.' }
  }
  if (!row.extracted_degree_level_code?.trim()) {
    return { ok: false, error: 'Missing required field: extracted_degree_level_code.' }
  }
  if (!row.staging_university_id) {
    return { ok: false, error: 'No linked staging university. Program merge requires staging_university_id to resolve university_id.' }
  }

  const existingMatchResolution = await resolveSingleProgramProductionMatch(supabase, row)
  if (existingMatchResolution.status === 'matched' && !allowDuplicateCreate) {
    const existingProgram = existingMatchResolution.matches[0]
    return {
      ok: false,
      error: `Exact production match already exists: "${existingProgram.title}" (${existingProgram.slug}). Use skip-existing, update-existing, or confirm create-new anyway.`,
    }
  }
  if (existingMatchResolution.status === 'ambiguous' && !allowDuplicateCreate) {
    return {
      ok: false,
      error: 'Multiple exact production matches already exist for this title, university, and degree level. Link a specific program first or confirm create-new anyway.',
    }
  }

  // 2. Resolve university via staging_universities.match_university_id
  const { data: stagingUni, error: stagingUniErr } = await supabase
    .from('staging_universities')
    .select('id, match_university_id')
    .eq('id', row.staging_university_id)
    .single()

  if (stagingUniErr || !stagingUni) {
    return { ok: false, error: 'Linked staging university row not found.' }
  }

  const stagingUniRow = stagingUni as { id: string; match_university_id: string | null }

  if (!stagingUniRow.match_university_id) {
    return {
      ok: false,
      error: 'Linked staging university has not been merged yet. Merge the university first, then retry this program.',
    }
  }

  // 3. Read production university for university_id, country_id, slug
  const { data: prodUni, error: prodUniErr } = await supabase
    .from('universities')
    .select('id, country_id, slug')
    .eq('id', stagingUniRow.match_university_id)
    .single()

  if (prodUniErr || !prodUni) {
    return { ok: false, error: 'Production university not found. It may have been deleted.' }
  }

  const prodUniRow = prodUni as { id: string; country_id: string | null; slug: string }

  if (!prodUniRow.country_id) {
    return { ok: false, error: 'Production university has no country_id. Cannot resolve country for program. Merge blocked.' }
  }

  // 4. Resolve degree_level_id from active degree_levels.code
  const { data: degreeLevel, error: degreeLevelErr } = await supabase
    .from('degree_levels')
    .select('id')
    .eq('code', row.extracted_degree_level_code.trim())
    .eq('is_active', true)
    .single()

  if (degreeLevelErr || !degreeLevel) {
    return {
      ok: false,
      error: `Degree level code "${row.extracted_degree_level_code}" does not match any active degree level. Merge blocked.`,
    }
  }

  const degreeLevelId = (degreeLevel as { id: string }).id

  // 5. Generate slug — try candidates in order until one is unique
  const titleSlug = slugify(row.extracted_title)
  if (!titleSlug || !SLUG_RE.test(titleSlug)) {
    return { ok: false, error: 'Could not generate a valid slug from extracted_title. Merge blocked.' }
  }

  const degreeCode = slugify(row.extracted_degree_level_code.trim())
  const uniSlug = prodUniRow.slug ? slugify(prodUniRow.slug) : ''
  const shortUniId = prodUniRow.id.replace(/-/g, '').slice(-8)

  const slugCandidates = [
    titleSlug,
    degreeCode ? `${titleSlug}-${degreeCode}` : null,
    degreeCode && uniSlug ? `${titleSlug}-${degreeCode}-${uniSlug}` : null,
    `${titleSlug}-${degreeCode || 'prog'}-${shortUniId}`,
  ].filter((s): s is string => Boolean(s) && SLUG_RE.test(s as string))

  let resolvedSlug: string | null = null
  for (const candidate of slugCandidates) {
    const { data: conflict } = await supabase
      .from('programs')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!conflict) {
      resolvedSlug = candidate
      break
    }
  }

  if (!resolvedSlug) {
    return { ok: false, error: 'All slug candidates conflict with existing production programs. Merge blocked.' }
  }

  // 6. Insert production program
  const insertPayload: Record<string, unknown> = {
    title: row.extracted_title.trim(),
    slug: resolvedSlug,
    university_id: prodUniRow.id,
    country_id: prodUniRow.country_id,
    degree_level_id: degreeLevelId,
    content_status: 'draft',
    verification_status: 'unverified',
    indexing_status: 'draft',
  }

  const rawData = isPlainObject(row.raw_data) ? row.raw_data : {}
  Object.assign(insertPayload, await buildRichProgramPayload(supabase, rawData))

  if (!insertPayload.language_of_instruction && row.extracted_language?.trim()) {
    insertPayload.language_of_instruction = row.extracted_language.trim()
  }
  if (insertPayload.tuition_min_amount === undefined && row.extracted_tuition_amount !== null && row.extracted_tuition_amount !== undefined) {
    insertPayload.tuition_min_amount = row.extracted_tuition_amount
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('programs')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    if (insertErr?.code === '23505') {
      return { ok: false, error: `Slug conflict on insert: "${resolvedSlug}" already exists. Merge blocked.` }
    }
    return { ok: false, error: 'Failed to insert production program record. Please try again.' }
  }

  const productionId = (inserted as { id: string }).id
  const sourceWarning = await attachProgramSourceRows(supabase, productionId, rawData)

  const { error: stagingUpdateErr } = await supabase
    .from('staging_programs')
    .update({ import_status: 'merged', match_program_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] mergeProgram: staging status update failed after production insert:', stagingUpdateErr.code, stagingUpdateErr.message)
    const combinedWarning = sourceWarning
      ? `${sourceWarning} Also, the staging row status update failed. The row may still show "approved". Reload the page to check.`
      : 'Production program created but staging row status update failed. The row may still show "approved". Reload the page to check.'
    return {
      ok: true,
      productionId,
      warning: combinedWarning,
    }
  }

  return sourceWarning ? { ok: true, productionId, warning: sourceWarning } : { ok: true, productionId }
}

type ProductionProgramPatchableFields = {
  id: string
  degree_award: string | null
  primary_subject_id: string | null
  study_mode: string | null
  delivery_mode: string | null
  language_of_instruction: string | null
  duration_months: number | null
  tuition_min_amount: number | null
  tuition_max_amount: number | null
  tuition_currency: string | null
  tuition_period: string | null
  tuition_notes: string | null
  application_fee_amount: number | null
  application_fee_currency: string | null
  application_fee_notes: string | null
  official_url: string | null
  application_url: string | null
  admission_requirements: string | null
  gpa_requirements: string | null
  curriculum_summary: string | null
  career_outcomes: string | null
}

async function buildExistingProgramPatches(
  supabase: SupabaseClient,
  row: StagedProgramRow,
  targetProgramId: string
): Promise<
  | { ok: true; productionId: string; rawData: Record<string, unknown>; patches: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const { data: prod, error: prodErr } = await supabase
    .from('programs')
    .select('id, degree_award, primary_subject_id, study_mode, delivery_mode, language_of_instruction, duration_months, tuition_min_amount, tuition_max_amount, tuition_currency, tuition_period, tuition_notes, application_fee_amount, application_fee_currency, application_fee_notes, official_url, application_url, admission_requirements, gpa_requirements, curriculum_summary, career_outcomes')
    .eq('id', targetProgramId)
    .single()

  if (prodErr || !prod) {
    return { ok: false, error: 'Target production program not found. It may have been deleted.' }
  }

  const rawData = isPlainObject(row.raw_data) ? row.raw_data : {}
  const candidatePatches = await buildRichProgramPayload(supabase, rawData)
  if (!candidatePatches.language_of_instruction && row.extracted_language?.trim()) {
    candidatePatches.language_of_instruction = row.extracted_language.trim()
  }
  if (candidatePatches.tuition_min_amount === undefined && row.extracted_tuition_amount !== null && row.extracted_tuition_amount !== undefined) {
    candidatePatches.tuition_min_amount = row.extracted_tuition_amount
  }

  const prodRow = prod as ProductionProgramPatchableFields
  const patches: Record<string, unknown> = {}
  patchWhenEmpty(patches, prodRow.degree_award, candidatePatches.degree_award, 'degree_award')
  patchWhenEmpty(patches, prodRow.primary_subject_id, candidatePatches.primary_subject_id, 'primary_subject_id')
  patchWhenEmpty(patches, prodRow.study_mode, candidatePatches.study_mode, 'study_mode')
  patchWhenEmpty(patches, prodRow.delivery_mode, candidatePatches.delivery_mode, 'delivery_mode')
  patchWhenEmpty(patches, prodRow.language_of_instruction, candidatePatches.language_of_instruction, 'language_of_instruction')
  patchWhenEmpty(patches, prodRow.duration_months, candidatePatches.duration_months, 'duration_months')
  patchWhenEmpty(patches, prodRow.tuition_min_amount, candidatePatches.tuition_min_amount, 'tuition_min_amount')
  patchWhenEmpty(patches, prodRow.tuition_max_amount, candidatePatches.tuition_max_amount, 'tuition_max_amount')
  patchWhenEmpty(patches, prodRow.tuition_currency, candidatePatches.tuition_currency, 'tuition_currency')
  patchWhenEmpty(patches, prodRow.tuition_period, candidatePatches.tuition_period, 'tuition_period')
  patchWhenEmpty(patches, prodRow.tuition_notes, candidatePatches.tuition_notes, 'tuition_notes')
  patchWhenEmpty(patches, prodRow.application_fee_amount, candidatePatches.application_fee_amount, 'application_fee_amount')
  patchWhenEmpty(patches, prodRow.application_fee_currency, candidatePatches.application_fee_currency, 'application_fee_currency')
  patchWhenEmpty(patches, prodRow.application_fee_notes, candidatePatches.application_fee_notes, 'application_fee_notes')
  patchWhenEmpty(patches, prodRow.official_url, candidatePatches.official_url, 'official_url')
  patchWhenEmpty(patches, prodRow.application_url, candidatePatches.application_url, 'application_url')
  patchWhenEmpty(patches, prodRow.admission_requirements, candidatePatches.admission_requirements, 'admission_requirements')
  patchWhenEmpty(patches, prodRow.gpa_requirements, candidatePatches.gpa_requirements, 'gpa_requirements')
  patchWhenEmpty(patches, prodRow.curriculum_summary, candidatePatches.curriculum_summary, 'curriculum_summary')
  patchWhenEmpty(patches, prodRow.career_outcomes, candidatePatches.career_outcomes, 'career_outcomes')

  return { ok: true, productionId: prodRow.id, rawData, patches }
}

async function updateExistingProgram(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_programs')
    .select('id, import_batch_id, import_status, raw_data, extracted_title, extracted_degree_level_code, extracted_language, extracted_tuition_amount, staging_university_id, match_program_id')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
  const row = staged as StagedProgramRow

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be updated.` }
  }

  let targetProgramId = row.match_program_id
  if (!targetProgramId) {
    const matchResolution = await resolveSingleProgramProductionMatch(supabase, row)
    if (matchResolution.status === 'matched') {
      targetProgramId = matchResolution.matches[0].id
    } else if (matchResolution.status === 'ambiguous') {
      return { ok: false, error: 'Multiple exact production matches were found. Link the intended production program first.' }
    } else {
      return { ok: false, error: 'No exact production match was found. Link a production program first or use create-new.' }
    }
  }

  const prepared = await buildExistingProgramPatches(supabase, row, targetProgramId)
  if (!prepared.ok) {
    return prepared
  }

  const { productionId, rawData, patches } = prepared

  if (Object.keys(patches).length === 0) {
    return {
      ok: false,
      error: 'Nothing safe to patch: all allowlisted program fields are already set, or staging has no new values. Use skip-existing if you only want to mark the duplicate handled.',
    }
  }

  const { error: updateErr } = await supabase.from('programs').update(patches).eq('id', productionId)
  if (updateErr) {
    return { ok: false, error: 'Failed to update production program. Please try again.' }
  }

  const sourceWarning = await attachProgramSourceRows(supabase, productionId, rawData)

  const { error: stagingUpdateErr } = await supabase
    .from('staging_programs')
    .update({ import_status: 'merged', match_program_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] updateExistingProgram: staging status update failed:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: true,
      productionId,
      warning: sourceWarning
        ? `${sourceWarning} The staging row status update also failed. Reload the page to confirm the current state.`
        : 'Production program patched but staging row status update failed. The row may still show "approved". Reload the page to check.',
    }
  }

  return sourceWarning ? { ok: true, productionId, warning: sourceWarning } : { ok: true, productionId }
}

async function skipExistingProgram(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  const { data: staged, error: fetchErr } = await supabase
    .from('staging_programs')
    .select('id, import_batch_id, import_status, extracted_title, extracted_degree_level_code, staging_university_id, match_program_id')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchErr || !staged) return { ok: false, error: 'Staged row not found in this batch.' }
  const row = staged as ProgramMatchLookupRow & { import_batch_id: string; import_status: string }

  if (row.import_status !== 'approved') {
    return { ok: false, error: `Row status is "${row.import_status}". Only approved rows can be skipped as existing.` }
  }

  let targetProgramId = row.match_program_id
  if (!targetProgramId) {
    const matchResolution = await resolveSingleProgramProductionMatch(supabase, row)
    if (matchResolution.status === 'matched') {
      targetProgramId = matchResolution.matches[0].id
    } else if (matchResolution.status === 'ambiguous') {
      return { ok: false, error: 'Multiple exact production matches were found. Link the intended production program first.' }
    } else {
      return { ok: false, error: 'No exact production match was found. Link a production program first or use create-new.' }
    }
  }

  const { data: prod, error: prodErr } = await supabase
    .from('programs')
    .select('id')
    .eq('id', targetProgramId)
    .single()

  if (prodErr || !prod) {
    return { ok: false, error: 'Target production program not found. It may have been deleted.' }
  }

  const { error: stagingUpdateErr } = await supabase
    .from('staging_programs')
    .update({ import_status: 'skipped', match_program_id: targetProgramId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] skipExistingProgram: staging status update failed:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: false,
      error: 'Failed to mark the staged program as skipped. Please try again.',
    }
  }

  return { ok: true, productionId: targetProgramId }
}

export async function bulkMergeApprovedPrograms(
  supabase: SupabaseClient,
  params: {
    batchId: string
    rowIds?: string[]
    statusFilter?: string
  }
): Promise<
  | { ok: true; created: number; updated: number; skippedExisting: number; skipped: number; failed: number; warned: number }
  | { ok: false; error: string }
> {
  const { batchId, rowIds, statusFilter = 'all' } = params

  if (!UUID_RE.test(batchId)) {
    return { ok: false, error: 'Invalid batch ID.' }
  }
  if (!(VALID_MERGE_STATUS_FILTERS as readonly string[]).includes(statusFilter)) {
    return { ok: false, error: 'Invalid status filter.' }
  }

  const uniqueRowIds = [...new Set((rowIds ?? []).map((rowId) => rowId.trim()))]
  if (uniqueRowIds.some((rowId) => !UUID_RE.test(rowId))) {
    return { ok: false, error: 'Invalid staged row ID.' }
  }

  let query = supabase
    .from('staging_programs')
    .select('id, import_status, extracted_title, extracted_degree_level_code, staging_university_id, match_program_id')
    .eq('import_batch_id', batchId)

  if (uniqueRowIds.length > 0) {
    query = query.in('id', uniqueRowIds)
  } else if (statusFilter !== 'all') {
    query = query.eq('import_status', statusFilter)
  }

  const { data: stagedRows, error: fetchError } = await query

  if (fetchError) {
    return { ok: false, error: 'Failed to load staged programs for bulk merge.' }
  }

  const rows = (stagedRows ?? []) as Array<{
    id: string
    import_status: string
    extracted_title: string | null
    extracted_degree_level_code: string | null
    staging_university_id: string | null
    match_program_id: string | null
  }>

  const foundRowIds = new Set(rows.map((row) => row.id))
  let created = 0
  let updated = 0
  let skippedExisting = 0
  let skipped = 0
  let failed = uniqueRowIds.length > 0
    ? uniqueRowIds.filter((rowId) => !foundRowIds.has(rowId)).length
    : 0
  let warned = 0
  const matchResolutions = await resolveProgramProductionMatches(supabase, rows)

  for (const row of rows) {
    if (row.import_status !== 'approved' || row.match_program_id) {
      skipped += 1
      continue
    }

    const matchResolution = matchResolutions.get(row.id)
    const mergeAction: MergeAction =
      matchResolution?.status === 'matched' ? 'skip_existing' : 'create_new'

    if (matchResolution?.status === 'ambiguous') {
      skipped += 1
      continue
    }

    const result = await mergeApprovedRow(supabase, {
      entityType: 'programs',
      rowId: row.id,
      batchId,
      action: mergeAction,
    })

    if (!result.ok) {
      failed += 1
      continue
    }

    if (mergeAction === 'skip_existing') {
      skippedExisting += 1
    } else if (mergeAction === 'update_existing') {
      updated += 1
    } else {
      created += 1
    }
    if (result.warning) warned += 1
  }

  return { ok: true, created, updated, skippedExisting, skipped, failed, warned }
}

export async function bulkUpdateExistingMatchedPrograms(
  supabase: SupabaseClient,
  params: {
    batchId: string
    rowIds?: string[]
    statusFilter?: string
  }
): Promise<
  | {
      ok: true
      updated: number
      skippedNoExactMatch: number
      skippedAmbiguousMatch: number
      skippedNoSafeFields: number
      failed: number
      warned: number
    }
  | { ok: false; error: string }
> {
  const { batchId, rowIds, statusFilter = 'all' } = params

  if (!UUID_RE.test(batchId)) {
    return { ok: false, error: 'Invalid batch ID.' }
  }
  if (!(VALID_MERGE_STATUS_FILTERS as readonly string[]).includes(statusFilter)) {
    return { ok: false, error: 'Invalid status filter.' }
  }

  const uniqueRowIds = [...new Set((rowIds ?? []).map((rowId) => rowId.trim()))]
  if (uniqueRowIds.some((rowId) => !UUID_RE.test(rowId))) {
    return { ok: false, error: 'Invalid staged row ID.' }
  }

  let query = supabase
    .from('staging_programs')
    .select('id, import_batch_id, import_status, raw_data, extracted_title, extracted_degree_level_code, extracted_language, extracted_tuition_amount, staging_university_id, match_program_id')
    .eq('import_batch_id', batchId)

  if (uniqueRowIds.length > 0) {
    query = query.in('id', uniqueRowIds)
  } else if (statusFilter !== 'all') {
    query = query.eq('import_status', statusFilter)
  }

  const { data: stagedRows, error: fetchError } = await query

  if (fetchError) {
    return { ok: false, error: 'Failed to load staged programs for bulk update-existing.' }
  }

  const rows = (stagedRows ?? []) as StagedProgramRow[]
  const foundRowIds = new Set(rows.map((row) => row.id))
  let updated = 0
  let skippedNoExactMatch = 0
  let skippedAmbiguousMatch = 0
  let skippedNoSafeFields = 0
  let failed = uniqueRowIds.length > 0
    ? uniqueRowIds.filter((rowId) => !foundRowIds.has(rowId)).length
    : 0
  let warned = 0
  const matchResolutions = await resolveProgramProductionMatches(supabase, rows)

  for (const row of rows) {
    if (row.import_status !== 'approved') {
      skippedNoExactMatch += 1
      continue
    }

    const matchResolution = matchResolutions.get(row.id)
    if (!matchResolution || matchResolution.status === 'no_match' || matchResolution.status === 'missing_title' || matchResolution.status === 'missing_university_link' || matchResolution.status === 'missing_degree_level') {
      skippedNoExactMatch += 1
      continue
    }
    if (matchResolution.status === 'ambiguous') {
      skippedAmbiguousMatch += 1
      continue
    }

    const targetProgramId = matchResolution.matches[0]?.id
    if (!targetProgramId) {
      skippedNoExactMatch += 1
      continue
    }

    const prepared = await buildExistingProgramPatches(supabase, row, targetProgramId)
    if (!prepared.ok) {
      failed += 1
      continue
    }

    if (Object.keys(prepared.patches).length === 0) {
      skippedNoSafeFields += 1
      continue
    }

    const { error: updateErr } = await supabase
      .from('programs')
      .update(prepared.patches)
      .eq('id', prepared.productionId)

    if (updateErr) {
      failed += 1
      continue
    }

    const sourceWarning = await attachProgramSourceRows(supabase, prepared.productionId, prepared.rawData)
    const { error: stagingUpdateErr } = await supabase
      .from('staging_programs')
      .update({ import_status: 'merged', match_program_id: prepared.productionId })
      .eq('id', row.id)
      .eq('import_batch_id', batchId)

    if (stagingUpdateErr) {
      console.error('[importMerge] bulkUpdateExistingMatchedPrograms: staging status update failed:', stagingUpdateErr.code, stagingUpdateErr.message)
      failed += 1
      continue
    }

    updated += 1
    if (sourceWarning) warned += 1
  }

  return {
    ok: true,
    updated,
    skippedNoExactMatch,
    skippedAmbiguousMatch,
    skippedNoSafeFields,
    failed,
    warned,
  }
}

export async function bulkPublishMergedPrograms(
  supabase: SupabaseClient,
  params: {
    batchId: string
    statusFilter?: string
  }
): Promise<
  | { ok: true; published: number; skipped: number; failed: number }
  | { ok: false; error: string }
> {
  const { batchId, statusFilter = 'all' } = params

  if (!UUID_RE.test(batchId)) {
    return { ok: false, error: 'Invalid batch ID.' }
  }
  if (!(VALID_MERGE_STATUS_FILTERS as readonly string[]).includes(statusFilter)) {
    return { ok: false, error: 'Invalid status filter.' }
  }

  let query = supabase
    .from('staging_programs')
    .select('id, import_status, match_program_id')
    .eq('import_batch_id', batchId)

  if (statusFilter !== 'all') {
    query = query.eq('import_status', statusFilter)
  }

  const { data: stagedRows, error: fetchError } = await query

  if (fetchError) {
    return { ok: false, error: 'Failed to load merged staged programs for publishing.' }
  }

  const rows = (stagedRows ?? []) as Array<{
    id: string
    import_status: string
    match_program_id: string | null
  }>

  const targetProgramIds: string[] = []
  const seenProgramIds = new Set<string>()
  let skipped = 0

  for (const row of rows) {
    if (row.import_status !== 'merged' || !row.match_program_id) {
      skipped += 1
      continue
    }
    if (seenProgramIds.has(row.match_program_id)) {
      skipped += 1
      continue
    }

    seenProgramIds.add(row.match_program_id)
    targetProgramIds.push(row.match_program_id)
  }

  if (targetProgramIds.length === 0) {
    return { ok: true, published: 0, skipped, failed: 0 }
  }

  const { data: productionPrograms, error: productionFetchError } = await supabase
    .from('programs')
    .select('id, content_status')
    .in('id', targetProgramIds)

  if (productionFetchError) {
    return { ok: false, error: 'Failed to load linked production programs.' }
  }

  const productionById = new Map(
    ((productionPrograms ?? []) as Array<{ id: string; content_status: string }>)
      .map((program) => [program.id, program])
  )

  let published = 0
  let failed = 0

  for (const programId of targetProgramIds) {
    const program = productionById.get(programId)

    if (!program) {
      failed += 1
      continue
    }

    if (program.content_status !== 'draft' && program.content_status !== 'in_review') {
      skipped += 1
      continue
    }

    const { error: updateError } = await supabase
      .from('programs')
      .update({
        content_status: 'published',
        indexing_status: 'index',
      })
      .eq('id', programId)

    if (updateError) {
      failed += 1
      continue
    }

    published += 1
  }

  return { ok: true, published, skipped, failed }
}
