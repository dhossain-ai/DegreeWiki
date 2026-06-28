import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeQuestion } from '../site-chat/static-answers'

export const AI_KNOWLEDGE_AUDIENCES = ['all', 'anonymous', 'authenticated'] as const
export const AI_KNOWLEDGE_STATUSES = ['draft', 'published', 'archived'] as const
export const AI_KNOWLEDGE_MATCH_TYPES = ['exact', 'keyword', 'hybrid'] as const
export const AI_KNOWLEDGE_IMPORT_MAX_ROWS = 100
export const AI_KNOWLEDGE_MAX_LIST_ITEMS = 30
export const AI_KNOWLEDGE_MAX_BULK_IDS = 100

export type AIKnowledgeAudience = typeof AI_KNOWLEDGE_AUDIENCES[number]
export type AIKnowledgeStatus = typeof AI_KNOWLEDGE_STATUSES[number]
export type AIKnowledgeMatchType = typeof AI_KNOWLEDGE_MATCH_TYPES[number]

export interface AIKnowledgeAnswerRecord {
  id: string
  question: string
  questionNormalized: string
  answer: string
  category: string
  keywords: string[]
  aliases: string[]
  intentCode: string | null
  audience: AIKnowledgeAudience
  locale: string
  status: AIKnowledgeStatus
  priority: number
  matchType: AIKnowledgeMatchType
  sourceNote: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  createdByUserId: string
  updatedByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface KnowledgeAnswerInput {
  question: string
  answer: string
  category: string
  keywords: string[]
  aliases: string[]
  intentCode: string | null
  audience: AIKnowledgeAudience
  locale: string
  status: AIKnowledgeStatus
  priority: number
  matchType: AIKnowledgeMatchType
  sourceNote: string | null
}

export interface ListKnowledgeAnswersFilters {
  status?: string
  category?: string
  locale?: string
  audience?: string
  search?: string
}

export interface KnowledgeImportIssue {
  index: number
  field: string
  message: string
}

export interface KnowledgeBulkActionResult {
  requestedCount: number
  affectedCount: number
}

export interface KnowledgeBulkDeleteResult {
  requestedCount: number
  deletedCount: number
  skippedCount: number
}

export class KnowledgeBaseValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: KnowledgeImportIssue[],
  ) {
    super(message)
    this.name = 'KnowledgeBaseValidationError'
  }
}

type RawKnowledgeAnswerRow = {
  id: string
  question: string
  question_normalized: string
  answer: string
  category: string
  keywords_json: unknown
  aliases_json: unknown
  intent_code: string | null
  audience: AIKnowledgeAudience
  locale: string
  status: AIKnowledgeStatus
  priority: number
  match_type: AIKnowledgeMatchType
  source_note: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  created_by_user_id: string
  updated_by_user_id: string | null
  created_at: string
  updated_at: string
}

type SupabaseLike = SupabaseClient

const HTML_TAG_RE = /<[^>]+>/i

function hasHtmlTag(value: string): boolean {
  return HTML_TAG_RE.test(value)
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const results: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    results.push(trimmed)
  }
  return results
}

function mapKnowledgeAnswerRow(row: RawKnowledgeAnswerRow): AIKnowledgeAnswerRecord {
  return {
    id: row.id,
    question: row.question,
    questionNormalized: row.question_normalized,
    answer: row.answer,
    category: row.category,
    keywords: readStringArray(row.keywords_json),
    aliases: readStringArray(row.aliases_json),
    intentCode: row.intent_code,
    audience: row.audience,
    locale: row.locale,
    status: row.status,
    priority: row.priority,
    matchType: row.match_type,
    sourceNote: row.source_note,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function assertEnumValue<T extends readonly string[]>(
  value: string,
  allowed: T,
  field: string,
): T[number] {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new KnowledgeBaseValidationError('invalid_request', `${field} is invalid.`)
  }
  return value as T[number]
}

function normalizeListItems(
  value: unknown,
  field: string,
): string[] {
  if (!Array.isArray(value)) {
    throw new KnowledgeBaseValidationError('invalid_request', `${field} must be an array of strings.`)
  }

  const items: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new KnowledgeBaseValidationError('invalid_request', `${field} must contain only strings.`)
    }

    const trimmed = item.trim()
    if (!trimmed) {
      throw new KnowledgeBaseValidationError('invalid_request', `${field} cannot contain empty values.`)
    }
    if (hasHtmlTag(trimmed)) {
      throw new KnowledgeBaseValidationError('invalid_request', `${field} cannot contain HTML.`)
    }

    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    items.push(trimmed)
  }

  if (items.length > AI_KNOWLEDGE_MAX_LIST_ITEMS) {
    throw new KnowledgeBaseValidationError(
      'invalid_request',
      `${field} cannot contain more than ${AI_KNOWLEDGE_MAX_LIST_ITEMS} items.`,
    )
  }

  return items
}

function readRequiredText(
  value: Record<string, unknown>,
  key: string,
): string {
  const raw = value[key]
  if (typeof raw !== 'string') {
    throw new KnowledgeBaseValidationError('invalid_request', `${key} must be a string.`)
  }
  return raw.trim()
}

function readOptionalText(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const raw = value[key]
  if (raw == null) return null
  if (typeof raw !== 'string') {
    throw new KnowledgeBaseValidationError('invalid_request', `${key} must be a string.`)
  }
  const trimmed = raw.trim()
  return trimmed || null
}

function parseKnowledgeAnswerInput(value: Record<string, unknown>): KnowledgeAnswerInput {
  const question = readRequiredText(value, 'question')
  const answer = readRequiredText(value, 'answer')
  const category = readRequiredText(value, 'category')
  const locale = value.locale == null ? 'en' : readRequiredText(value, 'locale')
  const sourceNote = readOptionalText(value, 'source_note')
  const intentCode = readOptionalText(value, 'intent_code')
  const priority = Number(value.priority ?? 100)

  if (question.length < 3 || question.length > 300) {
    throw new KnowledgeBaseValidationError('invalid_request', 'Question length is invalid.')
  }
  if (answer.length < 20 || answer.length > 3000) {
    throw new KnowledgeBaseValidationError('invalid_request', 'Answer length is invalid.')
  }
  if (category.length < 2 || category.length > 80) {
    throw new KnowledgeBaseValidationError('invalid_request', 'Category length is invalid.')
  }
  if (!locale) {
    throw new KnowledgeBaseValidationError('invalid_request', 'Locale is required.')
  }
  if (!Number.isInteger(priority) || priority <= 0) {
    throw new KnowledgeBaseValidationError('invalid_request', 'Priority must be a positive integer.')
  }

  for (const [field, fieldValue] of [
    ['question', question],
    ['answer', answer],
    ['category', category],
    ['locale', locale],
    ['source_note', sourceNote],
    ['intent_code', intentCode],
  ] as Array<[string, string | null]>) {
    if (fieldValue && hasHtmlTag(fieldValue)) {
      throw new KnowledgeBaseValidationError('invalid_request', `${field} cannot contain HTML.`)
    }
  }

  return {
    question,
    answer,
    category,
    keywords: normalizeListItems(value.keywords ?? [], 'keywords'),
    aliases: normalizeListItems(value.aliases ?? [], 'aliases'),
    intentCode,
    audience: assertEnumValue(String(value.audience ?? 'all'), AI_KNOWLEDGE_AUDIENCES, 'Audience'),
    locale,
    status: assertEnumValue(String(value.status ?? 'draft'), AI_KNOWLEDGE_STATUSES, 'Status'),
    priority,
    matchType: assertEnumValue(String(value.match_type ?? 'hybrid'), AI_KNOWLEDGE_MATCH_TYPES, 'Match type'),
    sourceNote,
  }
}

async function assertNoActiveDuplicate(
  supabase: SupabaseLike,
  normalizedQuestion: string,
  locale: string,
  audience: AIKnowledgeAudience,
  excludeId?: string,
): Promise<void> {
  let query = supabase
    .from('ai_static_answers')
    .select('id')
    .eq('locale', locale)
    .eq('audience', audience)
    .eq('question_normalized', normalizedQuestion)
    .neq('status', 'archived')
    .limit(1)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query
  if (error) {
    console.error('ai knowledge base: duplicate check failed:', error.message)
    throw new KnowledgeBaseValidationError('internal_error', 'Could not validate duplicate questions.')
  }

  if ((data ?? []).length > 0) {
    throw new KnowledgeBaseValidationError('duplicate_question', 'An active answer with the same question already exists for this locale and audience.')
  }
}

function applySearch(rows: AIKnowledgeAnswerRecord[], search: string): AIKnowledgeAnswerRecord[] {
  const normalizedSearch = search.trim().toLowerCase()
  if (!normalizedSearch) return rows

  return rows.filter((row) => {
    const haystack = [
      row.question,
      row.answer,
      row.category,
      row.intentCode ?? '',
      row.sourceNote ?? '',
      row.locale,
      row.audience,
      row.status,
      row.keywords.join(' '),
      row.aliases.join(' '),
    ].join('\n').toLowerCase()

    return haystack.includes(normalizedSearch)
  })
}

export async function listKnowledgeAnswers(
  supabase: SupabaseLike,
  filters: ListKnowledgeAnswersFilters = {},
): Promise<AIKnowledgeAnswerRecord[]> {
  let query = supabase
    .from('ai_static_answers')
    .select(`
      id,
      question,
      question_normalized,
      answer,
      category,
      keywords_json,
      aliases_json,
      intent_code,
      audience,
      locale,
      status,
      priority,
      match_type,
      source_note,
      reviewed_by_user_id,
      reviewed_at,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .order('priority', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(300)

  if (filters.status && (AI_KNOWLEDGE_STATUSES as readonly string[]).includes(filters.status)) {
    query = query.eq('status', filters.status)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.locale) {
    query = query.eq('locale', filters.locale)
  }
  if (filters.audience && (AI_KNOWLEDGE_AUDIENCES as readonly string[]).includes(filters.audience)) {
    query = query.eq('audience', filters.audience)
  }

  const { data, error } = await query
  if (error) {
    console.error('ai knowledge base: list failed:', error.message)
    return []
  }

  const rows = ((data ?? []) as RawKnowledgeAnswerRow[]).map(mapKnowledgeAnswerRow)
  return filters.search ? applySearch(rows, filters.search) : rows
}

export async function loadKnowledgeCategories(supabase: SupabaseLike): Promise<string[]> {
  const { data, error } = await supabase
    .from('ai_static_answers')
    .select('category')
    .order('category', { ascending: true })
    .limit(500)

  if (error) {
    console.error('ai knowledge base: category list failed:', error.message)
    return []
  }

  return [...new Set((data ?? [])
    .map((row: any) => (typeof row.category === 'string' ? row.category.trim() : ''))
    .filter(Boolean))]
}

export async function createKnowledgeAnswer(
  supabase: SupabaseLike,
  userId: string,
  value: Record<string, unknown>,
): Promise<AIKnowledgeAnswerRecord> {
  const input = parseKnowledgeAnswerInput(value)
  const questionNormalized = normalizeQuestion(input.question)
  await assertNoActiveDuplicate(supabase, questionNormalized, input.locale, input.audience)

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ai_static_answers')
    .insert({
      question: input.question,
      question_normalized: questionNormalized,
      answer: input.answer,
      category: input.category,
      keywords_json: input.keywords,
      aliases_json: input.aliases,
      intent_code: input.intentCode,
      audience: input.audience,
      locale: input.locale,
      status: input.status,
      priority: input.priority,
      match_type: input.matchType,
      source_note: input.sourceNote,
      reviewed_by_user_id: input.status === 'published' ? userId : null,
      reviewed_at: input.status === 'published' ? now : null,
      created_by_user_id: userId,
      updated_by_user_id: userId,
    })
    .select(`
      id,
      question,
      question_normalized,
      answer,
      category,
      keywords_json,
      aliases_json,
      intent_code,
      audience,
      locale,
      status,
      priority,
      match_type,
      source_note,
      reviewed_by_user_id,
      reviewed_at,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .single()

  if (error || !data) {
    console.error('ai knowledge base: create failed:', error?.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not save the answer.')
  }

  return mapKnowledgeAnswerRow(data as RawKnowledgeAnswerRow)
}

export async function updateKnowledgeAnswer(
  supabase: SupabaseLike,
  id: string,
  userId: string,
  value: Record<string, unknown>,
): Promise<AIKnowledgeAnswerRecord> {
  const input = parseKnowledgeAnswerInput(value)
  const questionNormalized = normalizeQuestion(input.question)
  await assertNoActiveDuplicate(supabase, questionNormalized, input.locale, input.audience, id)

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ai_static_answers')
    .update({
      question: input.question,
      question_normalized: questionNormalized,
      answer: input.answer,
      category: input.category,
      keywords_json: input.keywords,
      aliases_json: input.aliases,
      intent_code: input.intentCode,
      audience: input.audience,
      locale: input.locale,
      status: input.status,
      priority: input.priority,
      match_type: input.matchType,
      source_note: input.sourceNote,
      reviewed_by_user_id: input.status === 'published' ? userId : null,
      reviewed_at: input.status === 'published' ? now : null,
      updated_by_user_id: userId,
    })
    .eq('id', id)
    .select(`
      id,
      question,
      question_normalized,
      answer,
      category,
      keywords_json,
      aliases_json,
      intent_code,
      audience,
      locale,
      status,
      priority,
      match_type,
      source_note,
      reviewed_by_user_id,
      reviewed_at,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .single()

  if (error || !data) {
    console.error('ai knowledge base: update failed:', error?.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not update the answer.')
  }

  return mapKnowledgeAnswerRow(data as RawKnowledgeAnswerRow)
}

export async function publishKnowledgeAnswer(
  supabase: SupabaseLike,
  id: string,
  userId: string,
): Promise<AIKnowledgeAnswerRecord> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ai_static_answers')
    .update({
      status: 'published',
      reviewed_by_user_id: userId,
      reviewed_at: now,
      updated_by_user_id: userId,
    })
    .eq('id', id)
    .select(`
      id,
      question,
      question_normalized,
      answer,
      category,
      keywords_json,
      aliases_json,
      intent_code,
      audience,
      locale,
      status,
      priority,
      match_type,
      source_note,
      reviewed_by_user_id,
      reviewed_at,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .single()

  if (error || !data) {
    console.error('ai knowledge base: publish failed:', error?.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not publish the answer.')
  }

  return mapKnowledgeAnswerRow(data as RawKnowledgeAnswerRow)
}

export async function archiveKnowledgeAnswer(
  supabase: SupabaseLike,
  id: string,
  userId: string,
): Promise<AIKnowledgeAnswerRecord> {
  const { data, error } = await supabase
    .from('ai_static_answers')
    .update({
      status: 'archived',
      updated_by_user_id: userId,
    })
    .eq('id', id)
    .select(`
      id,
      question,
      question_normalized,
      answer,
      category,
      keywords_json,
      aliases_json,
      intent_code,
      audience,
      locale,
      status,
      priority,
      match_type,
      source_note,
      reviewed_by_user_id,
      reviewed_at,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)
    .single()

  if (error || !data) {
    console.error('ai knowledge base: archive failed:', error?.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not archive the answer.')
  }

  return mapKnowledgeAnswerRow(data as RawKnowledgeAnswerRow)
}

export async function deleteKnowledgeAnswer(
  supabase: SupabaseLike,
  id: string,
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from('ai_static_answers')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    console.error('ai knowledge base: delete lookup failed:', existingError.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not verify the answer before deletion.')
  }

  if (!existing) {
    throw new KnowledgeBaseValidationError('not_found', 'Answer not found.')
  }

  if (existing.status !== 'draft') {
    throw new KnowledgeBaseValidationError('archive_preferred', 'Only draft answers can be deleted. Archive published or archived answers instead.')
  }

  const { error } = await supabase
    .from('ai_static_answers')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('ai knowledge base: delete failed:', error.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not delete the answer.')
  }
}

export async function bulkPublishKnowledgeAnswers(
  supabase: SupabaseLike,
  ids: string[],
  userId: string,
): Promise<KnowledgeBulkActionResult> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ai_static_answers')
    .update({
      status: 'published',
      reviewed_by_user_id: userId,
      reviewed_at: now,
      updated_by_user_id: userId,
      updated_at: now,
    })
    .in('id', ids)
    .select('id')

  if (error) {
    console.error('ai knowledge base: bulk publish failed:', error.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not publish the selected answers.')
  }

  return {
    requestedCount: ids.length,
    affectedCount: (data ?? []).length,
  }
}

export async function bulkMoveKnowledgeAnswersToDraft(
  supabase: SupabaseLike,
  ids: string[],
  userId: string,
): Promise<KnowledgeBulkActionResult> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ai_static_answers')
    .update({
      status: 'draft',
      reviewed_by_user_id: null,
      reviewed_at: null,
      updated_by_user_id: userId,
      updated_at: now,
    })
    .in('id', ids)
    .select('id')

  if (error) {
    console.error('ai knowledge base: bulk draft failed:', error.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not move the selected answers to draft.')
  }

  return {
    requestedCount: ids.length,
    affectedCount: (data ?? []).length,
  }
}

export async function bulkArchiveKnowledgeAnswers(
  supabase: SupabaseLike,
  ids: string[],
  userId: string,
): Promise<KnowledgeBulkActionResult> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ai_static_answers')
    .update({
      status: 'archived',
      updated_by_user_id: userId,
      updated_at: now,
    })
    .in('id', ids)
    .select('id')

  if (error) {
    console.error('ai knowledge base: bulk archive failed:', error.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not archive the selected answers.')
  }

  return {
    requestedCount: ids.length,
    affectedCount: (data ?? []).length,
  }
}

export async function bulkDeleteDraftKnowledgeAnswers(
  supabase: SupabaseLike,
  ids: string[],
): Promise<KnowledgeBulkDeleteResult> {
  const { data: draftRows, error: selectError } = await supabase
    .from('ai_static_answers')
    .select('id')
    .in('id', ids)
    .eq('status', 'draft')

  if (selectError) {
    console.error('ai knowledge base: bulk delete draft lookup failed:', selectError.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not verify draft answers before deletion.')
  }

  const draftIds = (draftRows ?? [])
    .map((row: any) => (typeof row.id === 'string' ? row.id : ''))
    .filter(Boolean)

  if (draftIds.length === 0) {
    return {
      requestedCount: ids.length,
      deletedCount: 0,
      skippedCount: ids.length,
    }
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from('ai_static_answers')
    .delete()
    .in('id', draftIds)
    .select('id')

  if (deleteError) {
    console.error('ai knowledge base: bulk delete drafts failed:', deleteError.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not delete the selected draft answers.')
  }

  const deletedCount = (deletedRows ?? []).length
  return {
    requestedCount: ids.length,
    deletedCount,
    skippedCount: ids.length - deletedCount,
  }
}

export async function importKnowledgeAnswers(
  supabase: SupabaseLike,
  userId: string,
  rawJson: string,
): Promise<{ insertedCount: number; rows: AIKnowledgeAnswerRecord[] }> {
  const trimmed = rawJson.trim()
  if (!trimmed) {
    throw new KnowledgeBaseValidationError('invalid_request', 'Paste a JSON array before importing.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new KnowledgeBaseValidationError('invalid_request', 'Import JSON is not valid.')
  }

  if (!Array.isArray(parsed)) {
    throw new KnowledgeBaseValidationError('invalid_request', 'Import JSON must be an array.')
  }

  if (parsed.length === 0) {
    throw new KnowledgeBaseValidationError('invalid_request', 'Import JSON must include at least one row.')
  }
  if (parsed.length > AI_KNOWLEDGE_IMPORT_MAX_ROWS) {
    throw new KnowledgeBaseValidationError(
      'invalid_request',
      `Import JSON can include at most ${AI_KNOWLEDGE_IMPORT_MAX_ROWS} rows.`,
    )
  }

  const issues: KnowledgeImportIssue[] = []
  const normalizedPayloadKeys = new Set<string>()
  const inserts: Array<{ originalIndex: number; values: Record<string, unknown> }> = []

  for (let index = 0; index < parsed.length; index++) {
    const item = parsed[index]
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push({ index, field: 'row', message: 'Each import row must be an object.' })
      continue
    }

    let input: KnowledgeAnswerInput
    try {
      input = parseKnowledgeAnswerInput({
        ...item,
        status: 'draft',
      })
    } catch (error) {
      const message = error instanceof KnowledgeBaseValidationError
        ? error.message
        : 'This import row is invalid.'
      issues.push({ index, field: 'row', message })
      continue
    }

    const questionNormalized = normalizeQuestion(input.question)
    const payloadKey = `${input.locale}::${input.audience}::${questionNormalized}`
    if (normalizedPayloadKeys.has(payloadKey)) {
      issues.push({
        index,
        field: 'question',
        message: 'Duplicate question in this import payload for the same locale and audience.',
      })
      continue
    }
    normalizedPayloadKeys.add(payloadKey)

    inserts.push({
      originalIndex: index,
      values: {
        question: input.question,
        question_normalized: questionNormalized,
        answer: input.answer,
        category: input.category,
        keywords_json: input.keywords,
        aliases_json: input.aliases,
        intent_code: input.intentCode,
        audience: input.audience,
        locale: input.locale,
        status: 'draft',
        priority: input.priority,
        match_type: input.matchType,
        source_note: input.sourceNote,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      },
    })
  }

  for (const entry of inserts) {
    const row = entry.values
    try {
      await assertNoActiveDuplicate(
        supabase,
        String(row.question_normalized),
        String(row.locale),
        row.audience as AIKnowledgeAudience,
      )
    } catch (error) {
      const message = error instanceof KnowledgeBaseValidationError
        ? error.message
        : 'Duplicate question check failed.'
      issues.push({ index: entry.originalIndex, field: 'question', message })
    }
  }

  if (issues.length > 0) {
    throw new KnowledgeBaseValidationError(
      'validation_failed',
      'Import validation failed.',
      issues,
    )
  }

  const { data, error } = await supabase
    .from('ai_static_answers')
    .insert(inserts.map((entry) => entry.values))
    .select(`
      id,
      question,
      question_normalized,
      answer,
      category,
      keywords_json,
      aliases_json,
      intent_code,
      audience,
      locale,
      status,
      priority,
      match_type,
      source_note,
      reviewed_by_user_id,
      reviewed_at,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    `)

  if (error) {
    console.error('ai knowledge base: import failed:', error.message)
    throw new KnowledgeBaseValidationError('save_failed', 'Could not import these answers.')
  }

  const rows = ((data ?? []) as RawKnowledgeAnswerRow[]).map(mapKnowledgeAnswerRow)
  return {
    insertedCount: rows.length,
    rows,
  }
}
