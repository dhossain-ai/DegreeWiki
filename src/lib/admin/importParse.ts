import type { StagedEntityType } from './importValidation'

export type BulkParsedRow = {
  rawData: Record<string, unknown>
  fields: Record<string, string | number | null>
  parseWarnings: string[]
}

export type BulkParseResult =
  | { ok: false; error: string }
  | { ok: true; rows: BulkParsedRow[]; nonObjectCount: number }

export const MAX_BULK_ROWS = 100

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s || null
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mapUniversity(item: Record<string, unknown>): BulkParsedRow {
  return {
    rawData: item,
    fields: {
      extracted_name: str(item.name),
      extracted_country_code: str(item.country_code),
      extracted_official_url: str(item.official_url),
    },
    parseWarnings: [],
  }
}

function mapProgram(item: Record<string, unknown>): BulkParsedRow {
  const parseWarnings: string[] = []
  const rawId = str(item.staging_university_id)
  let staging_university_id: string | null = null

  if (rawId !== null) {
    if (UUID_RE.test(rawId)) {
      // Batch-scope validation (same import_batch_id) happens in the page handler.
      staging_university_id = rawId
    } else {
      parseWarnings.push('staging_university_id is not a valid UUID and will be ignored')
    }
  }

  return {
    rawData: item,
    fields: {
      extracted_title: str(item.title),
      extracted_degree_level_code: str(item.degree_level_code),
      extracted_language: str(item.language),
      extracted_tuition_amount: num(item.tuition_amount),
      extracted_deadline: str(item.deadline),
      staging_university_id,
    },
    parseWarnings,
  }
}

function mapScholarship(item: Record<string, unknown>): BulkParsedRow {
  return {
    rawData: item,
    fields: {
      extracted_name: str(item.name),
      extracted_amount: num(item.amount),
      extracted_deadline: str(item.deadline),
    },
    parseWarnings: [],
  }
}

function mapArticle(item: Record<string, unknown>): BulkParsedRow {
  return {
    rawData: item,
    fields: {
      extracted_title: str(item.title),
      extracted_slug: str(item.slug),
      extracted_category: str(item.category),
      extracted_content: str(item.content),
    },
    parseWarnings: [],
  }
}

/**
 * Parses a JSON array string into per-entity staged row fields.
 *
 * Pure/deterministic — no Supabase calls. Batch-scope validation of
 * staging_university_id (programs only) must happen in the caller.
 *
 * Returns { ok: false } for: empty input, non-JSON, non-array, or arrays
 * exceeding MAX_BULK_ROWS. Non-object array elements are counted in
 * nonObjectCount and excluded from rows.
 */
export function parseBulkJson(
  input: string,
  entityType: StagedEntityType,
): BulkParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: 'Input is empty. Paste a JSON array.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'Input is not valid JSON.' }
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Input must be a JSON array (e.g. [{...}, {...}]).' }
  }

  if (parsed.length > MAX_BULK_ROWS) {
    return {
      ok: false,
      error: `Maximum ${MAX_BULK_ROWS} rows per import. Received ${parsed.length}.`,
    }
  }

  const rows: BulkParsedRow[] = []
  let nonObjectCount = 0

  for (const item of parsed) {
    if (!isPlainObject(item)) {
      nonObjectCount++
      continue
    }

    let row: BulkParsedRow
    if (entityType === 'universities') row = mapUniversity(item)
    else if (entityType === 'programs') row = mapProgram(item)
    else if (entityType === 'scholarships') row = mapScholarship(item)
    else row = mapArticle(item)

    rows.push(row)
  }

  return { ok: true, rows, nonObjectCount }
}
