import type { SupabaseClient } from '@supabase/supabase-js'

export type MergeEntityType = 'universities' | 'scholarships' | 'articles' | 'programs'
export type MergeAction = 'create_new' | 'update_existing'

const CREATE_NEW_TYPES: readonly MergeEntityType[] = ['universities', 'scholarships', 'articles', 'programs']
const UPDATE_EXISTING_TYPES: readonly string[] = ['universities', 'scholarships', 'articles']

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
  }
): Promise<{ ok: true; productionId: string; warning?: string } | { ok: false; error: string }> {
  const { entityType, rowId, batchId, action = 'create_new' } = params

  if (!UUID_RE.test(rowId)) return { ok: false, error: 'Invalid row ID.' }
  if (!UUID_RE.test(batchId)) return { ok: false, error: 'Invalid batch ID.' }

  if (action === 'update_existing') {
    if (!UPDATE_EXISTING_TYPES.includes(entityType)) {
      return { ok: false, error: 'Update-existing is not supported for this entity type.' }
    }
    return updateExistingRow(supabase, entityType as 'universities' | 'scholarships' | 'articles', rowId, batchId)
  }

  if (!(CREATE_NEW_TYPES as readonly string[]).includes(entityType)) {
    return { ok: false, error: 'Entity type not supported for merge.' }
  }

  const entity = entityType as MergeEntityType
  if (entity === 'universities') return mergeUniversity(supabase, rowId, batchId)
  if (entity === 'scholarships') return mergeScholarship(supabase, rowId, batchId)
  if (entity === 'programs') return mergeProgram(supabase, rowId, batchId)
  return mergeArticle(supabase, rowId, batchId)
}

// ---------------------------------------------------------------------------
// Update-existing dispatcher (exported for direct use if needed)
// ---------------------------------------------------------------------------

export async function updateExistingRow(
  supabase: SupabaseClient,
  entity: 'universities' | 'scholarships' | 'articles',
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
  if (entity === 'universities') return updateExistingUniversity(supabase, rowId, batchId)
  if (entity === 'scholarships') return updateExistingScholarship(supabase, rowId, batchId)
  return updateExistingArticle(supabase, rowId, batchId)
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function textField(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key]
    if (value === null || value === undefined) continue
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

function buildEnglishRequirements(raw: Record<string, unknown>): Record<string, unknown> | null {
  const englishText = textField(raw, ['english_requirements_text', 'english_requirements'])
  const ielts = numberField(raw, ['ielts_min_score'])
  const toefl = numberField(raw, ['toefl_min_score'])

  const requirements: Record<string, unknown> = {}
  if (englishText) requirements.notes = englishText
  if (ielts !== null) requirements.ielts = { min_overall: ielts }
  if (toefl !== null) requirements.toefl = { min_overall: toefl }

  return Object.keys(requirements).length > 0 ? requirements : null
}

async function buildRichProgramPayload(
  supabase: SupabaseClient,
  raw: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {}

  const directTextFields: Array<[string, string[]]> = [
    ['degree_award', ['degree_award']],
    ['language_of_instruction', ['language_of_instruction', 'language']],
    ['tuition_currency', ['tuition_currency']],
    ['tuition_notes', ['tuition_notes']],
    ['application_fee_currency', ['application_fee_currency']],
    ['application_fee_notes', ['application_fee_notes']],
    ['official_url', ['official_program_url', 'official_url']],
    ['application_url', ['official_application_url', 'application_url']],
    ['admission_requirements', ['admission_requirements_text', 'admission_requirements']],
    ['gpa_requirements', ['gpa_requirements_text', 'gpa_requirements']],
    ['curriculum_summary', ['curriculum_or_modules_text', 'curriculum_summary']],
    ['career_outcomes', ['career_outcomes_text', 'career_outcomes']],
  ]

  for (const [column, keys] of directTextFields) {
    const value = textField(raw, keys)
    if (value) payload[column] = value
  }

  const studyMode = normalizeEnum(
    textField(raw, ['study_mode']),
    ['full_time', 'part_time', 'online', 'hybrid'],
    { fulltime: 'full_time', full_time: 'full_time', parttime: 'part_time', part_time: 'part_time' }
  )
  if (studyMode) payload.study_mode = studyMode

  const deliveryMode = normalizeEnum(
    textField(raw, ['delivery_mode']),
    ['on_campus', 'online', 'hybrid', 'distance'],
    { campus: 'on_campus', in_person: 'on_campus', oncampus: 'on_campus' }
  )
  if (deliveryMode) payload.delivery_mode = deliveryMode

  const durationMonths = positiveIntegerField(raw, ['duration_months'])
  if (durationMonths !== null) payload.duration_months = durationMonths

  const tuitionMin = numberField(raw, ['tuition_min_amount', 'tuition_amount'])
  if (tuitionMin !== null) payload.tuition_min_amount = tuitionMin

  const tuitionMax = numberField(raw, ['tuition_max_amount'])
  if (tuitionMax !== null) payload.tuition_max_amount = tuitionMax

  const tuitionPeriod = normalizeTuitionPeriod(textField(raw, ['tuition_period']))
  if (tuitionPeriod) payload.tuition_period = tuitionPeriod

  const applicationFee = numberField(raw, ['application_fee_amount'])
  if (applicationFee !== null) payload.application_fee_amount = applicationFee

  const englishRequirements = buildEnglishRequirements(raw)
  if (englishRequirements) payload.english_requirements = englishRequirements

  const subjectName = textField(raw, ['primary_subject', 'subject_area', 'subject'])
  if (subjectName) {
    const { data } = await supabase
      .from('subjects')
      .select('id, name')
      .ilike('name', subjectName)
      .limit(2)
    const exactMatches = ((data ?? []) as { id: string; name: string }[])
      .filter(s => s.name.toLowerCase() === subjectName.toLowerCase())
    if (exactMatches.length === 1) {
      payload.primary_subject_id = exactMatches[0].id
    }
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
  const seen = new Set<string>()
  const confidence = confidenceLevel(raw)

  function addSource(urlValue: string | null, title: string, sourceType: string, isPrimary: boolean) {
    const sourceUrl = validUrlOrNull(urlValue)
    if (!sourceUrl || seen.has(sourceUrl)) return
    seen.add(sourceUrl)
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

  addSource(textField(raw, ['official_program_url', 'official_url']), 'Official program page', 'official_university', true)
  addSource(textField(raw, ['official_application_url', 'application_url']), 'Official application page', 'official_university', false)
  addSource(textField(raw, ['official_tuition_url']), 'Official tuition page', 'official_university', false)

  const sourceUrls = raw.source_urls
  if (Array.isArray(sourceUrls)) {
    for (const value of sourceUrls) {
      if (typeof value === 'string') {
        addSource(value, 'Research source', 'third_party', rows.length === 0)
      }
    }
  }

  return rows
}

async function mergeProgram(
  supabase: SupabaseClient,
  rowId: string,
  batchId: string
): Promise<{ ok: true; productionId: string } | { ok: false; error: string }> {
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
  let sourceWarning: string | undefined

  const sourceRows = collectProgramSourceRows(productionId, rawData)
  if (sourceRows.length > 0) {
    const { error: sourceErr } = await supabase.from('data_sources').insert(sourceRows)
    if (sourceErr) {
      console.error('[importMerge] mergeProgram: data source insert failed after production insert:', sourceErr.code, sourceErr.message)
      sourceWarning = 'Production program created, but source links could not be attached. Add them manually from the program edit page.'
    }
  }

  const { error: stagingUpdateErr } = await supabase
    .from('staging_programs')
    .update({ import_status: 'merged', match_program_id: productionId })
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (stagingUpdateErr) {
    console.error('[importMerge] mergeProgram: staging status update failed after production insert:', stagingUpdateErr.code, stagingUpdateErr.message)
    return {
      ok: true,
      productionId,
      warning: 'Production program created but staging row status update failed. The row may still show "approved". Reload the page to check.',
    }
  }

  return sourceWarning ? { ok: true, productionId, warning: sourceWarning } : { ok: true, productionId }
}
