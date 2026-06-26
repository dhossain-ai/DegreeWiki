import type { StagedEntityType } from './importValidation'

export type BulkParsedRow = {
  rawData: Record<string, unknown>
  fields: Record<string, string | number | null>
  parseWarnings: string[]
}

export type BulkParseResult =
  | { ok: false; error: string }
  | { ok: true; rows: BulkParsedRow[]; nonObjectCount: number }

export type ResearchPackParseResult =
  | { ok: false; error: string }
  | {
      ok: true
      university: BulkParsedRow
      programs: BulkParsedRow[]
      nonObjectCount: number
    }

export type ProgramImportSourceShape = 'array' | 'programs_object' | 'research_pack'

export type ProgramImportParseResult =
  | { ok: false; error: string }
  | {
      ok: true
      rows: BulkParsedRow[]
      nonObjectCount: number
      sourceShape: ProgramImportSourceShape
      sourceUniversity: BulkParsedRow | null
    }

export const MAX_BULK_ROWS = 100

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEGREE_LEVEL_ALIASES: Record<string, string> = {
  bsc: 'bachelor',
  bs: 'bachelor',
  ba: 'bachelor',
  bachelor: 'bachelor',
  bachelors: 'bachelor',
  "bachelor's": 'bachelor',
  undergraduate: 'bachelor',
  msc: 'master',
  ms: 'master',
  ma: 'master',
  mba: 'master',
  llm: 'master',
  master: 'master',
  masters: 'master',
  "master's": 'master',
  graduate: 'master',
  phd: 'phd',
  doctorate: 'phd',
  doctoral: 'phd',
  foundation: 'foundation',
  diploma: 'diploma',
  certificate: 'certificate',
  associate: 'associate',
}

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

function degreeCode(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const key = s.toLowerCase().replace(/\./g, '').trim()
  return DEGREE_LEVEL_ALIASES[key] ?? key
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mapUniversity(item: Record<string, unknown>): BulkParsedRow {
  const rawCountryCode = str(item.country_code)
  const rawCountry = str(item.country)
  const countryCode = rawCountryCode ?? (rawCountry && /^[a-z]{2}$/i.test(rawCountry) ? rawCountry : null)

  return {
    rawData: item,
    fields: {
      extracted_name: str(item.name),
      extracted_country_code: countryCode ? countryCode.toUpperCase() : null,
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
      extracted_degree_level_code: degreeCode(item.degree_level_code ?? item.degree_level),
      extracted_language: str(item.language_of_instruction ?? item.language ?? item.instruction_language),
      extracted_tuition_amount: num(item.tuition_amount ?? item.tuition_min_amount ?? item.tuition),
      extracted_deadline: str(item.deadline ?? item.application_deadline),
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

function parseProgramArray(
  items: unknown[],
): { ok: true; rows: BulkParsedRow[]; nonObjectCount: number } | { ok: false; error: string } {
  if (items.length === 0) {
    return { ok: false, error: 'Programs array must include at least one program.' }
  }

  if (items.length > MAX_BULK_ROWS) {
    return {
      ok: false,
      error: `Maximum ${MAX_BULK_ROWS} programs per import. Received ${items.length}.`,
    }
  }

  const rows: BulkParsedRow[] = []
  let nonObjectCount = 0

  for (const item of items) {
    if (!isPlainObject(item)) {
      nonObjectCount++
      continue
    }
    rows.push(mapProgram(item))
  }

  return { ok: true, rows, nonObjectCount }
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

export function parseResearchPackJson(input: string): ResearchPackParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: 'Input is empty. Paste a nested research pack object.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'Input is not valid JSON.' }
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      error: 'Research pack must be a JSON object with a university object and programs array.',
    }
  }

  if (!isPlainObject(parsed.university)) {
    return { ok: false, error: 'Research pack must include a university object.' }
  }

  if (!Array.isArray(parsed.programs)) {
    return { ok: false, error: 'Research pack programs must be an array.' }
  }

  if (parsed.programs.length === 0) {
    return { ok: false, error: 'Research pack must include at least one program.' }
  }

  const totalRows = 1 + parsed.programs.length
  if (totalRows > MAX_BULK_ROWS) {
    return {
      ok: false,
      error: `Maximum ${MAX_BULK_ROWS} rows per import. Research pack contains ${totalRows} rows.`,
    }
  }

  const programs: BulkParsedRow[] = []
  let nonObjectCount = 0

  for (const item of parsed.programs) {
    if (!isPlainObject(item)) {
      nonObjectCount++
      continue
    }
    programs.push(mapProgram(item))
  }

  return {
    ok: true,
    university: mapUniversity(parsed.university),
    programs,
    nonObjectCount,
  }
}

export function parseProgramImportJson(input: string): ProgramImportParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: 'Input is empty. Paste program JSON first.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'Input is not valid JSON.' }
  }

  if (Array.isArray(parsed)) {
    const result = parseProgramArray(parsed)
    if (!result.ok) return result
    return {
      ok: true,
      rows: result.rows,
      nonObjectCount: result.nonObjectCount,
      sourceShape: 'array',
      sourceUniversity: null,
    }
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      error: 'Supported shapes are a raw program array, { programs: [...] }, or { university: {...}, programs: [...] }.',
    }
  }

  if (!Array.isArray(parsed.programs)) {
    return {
      ok: false,
      error: 'Supported object shapes must include a programs array.',
    }
  }

  const result = parseProgramArray(parsed.programs)
  if (!result.ok) return result

  const sourceUniversity = isPlainObject(parsed.university) ? mapUniversity(parsed.university) : null

  return {
    ok: true,
    rows: result.rows,
    nonObjectCount: result.nonObjectCount,
    sourceShape: sourceUniversity ? 'research_pack' : 'programs_object',
    sourceUniversity,
  }
}
