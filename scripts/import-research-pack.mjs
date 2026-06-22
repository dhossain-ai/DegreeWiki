#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_INPUT = 'data/raw/mru-lithuania-2026.research-pack.clean.json'
const DEFAULT_FALLBACK_INPUT = 'data/raw/mru-lithuania-2026.research-pack.json'
const DEFAULT_REPORT = 'data/reports/mru-lithuania-2026.import-report.md'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEGREE_LEVEL_ALIASES = new Map([
  ['bsc', 'bachelor'],
  ['bs', 'bachelor'],
  ['ba', 'bachelor'],
  ['bachelor', 'bachelor'],
  ['bachelors', 'bachelor'],
  ["bachelor's", 'bachelor'],
  ['undergraduate', 'bachelor'],
  ['msc', 'master'],
  ['ms', 'master'],
  ['ma', 'master'],
  ['mba', 'master'],
  ['llm', 'master'],
  ['master', 'master'],
  ['masters', 'master'],
  ["master's", 'master'],
  ['graduate', 'master'],
  ['phd', 'phd'],
  ['doctorate', 'phd'],
  ['doctoral', 'phd'],
  ['foundation', 'foundation'],
  ['diploma', 'diploma'],
  ['certificate', 'certificate'],
  ['associate', 'associate'],
])

const PROGRAM_INSERT_FIELDS = [
  'title',
  'slug',
  'university_id',
  'country_id',
  'city_id',
  'degree_level_id',
  'degree_award',
  'primary_subject_id',
  'duration_months',
  'study_mode',
  'delivery_mode',
  'language_of_instruction',
  'tuition_min_amount',
  'tuition_max_amount',
  'tuition_currency',
  'tuition_period',
  'tuition_notes',
  'application_fee_amount',
  'application_fee_currency',
  'application_fee_notes',
  'application_url',
  'official_url',
  'admission_requirements',
  'english_requirements',
  'gpa_requirements',
  'curriculum_summary',
  'career_outcomes',
  'content_status',
  'verification_status',
  'indexing_status',
]

const UNIVERSITY_INSERT_FIELDS = [
  'name',
  'slug',
  'country_id',
  'city_id',
  'official_url',
  'overview',
  'content_status',
  'verification_status',
  'indexing_status',
]

const DRAFT_STATUS = {
  content_status: 'draft',
  verification_status: 'unverified',
  indexing_status: 'draft',
}

function die(message, code = 1) {
  console.error(message)
  process.exit(code)
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeUrl(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  try {
    const url = new URL(text)
    url.hash = ''
    url.username = ''
    url.password = ''
    url.hostname = url.hostname.toLowerCase()
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
      if (!url.pathname) url.pathname = '/'
    }
    return url.toString()
  } catch {
    return null
  }
}

function canonicalizeUrlForCompare(value) {
  const normalized = normalizeUrl(value)
  if (!normalized) return null
  return normalized.replace(/\/$/, '')
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toMaybeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))]
}

function short(value, max = 120) {
  const text = String(value ?? '')
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function markdownEscape(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
}

function formatList(values) {
  if (!values || values.length === 0) return '—'
  return values.map(value => `\`${value}\``).join(', ')
}

function normalizeDegreeLevel(value) {
  const raw = normalizeText(value).replace(/[.']/g, '').replace(/\s+/g, ' ')
  if (!raw) return null
  return DEGREE_LEVEL_ALIASES.get(raw) ?? DEGREE_LEVEL_ALIASES.get(raw.replace(/\s+/g, '_')) ?? raw.replace(/\s+/g, '_')
}

function parseArgs(argv) {
  let mode = null
  let inputPath = null
  let reportPath = DEFAULT_REPORT

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run' || arg === '--apply') {
      if (mode && mode !== arg) {
        die('Choose exactly one mode: --dry-run or --apply.')
      }
      mode = arg
      continue
    }
    if (arg === '--report') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        die('--report requires a file path.')
      }
      reportPath = next
      i += 1
      continue
    }
    if (arg.startsWith('--')) {
      die(`Unknown flag: ${arg}`)
    }
    if (!inputPath) {
      inputPath = arg
      continue
    }
    die(`Unexpected extra argument: ${arg}`)
  }

  if (!mode) {
    die('Select one mode: --dry-run or --apply.')
  }

  return {
    mode,
    inputPath: inputPath ?? DEFAULT_INPUT,
    reportPath,
  }
}

async function resolveInputFile(candidatePath) {
  const direct = path.resolve(candidatePath)
  try {
    await fs.access(direct)
    return {
      inputPath: direct,
      fallbackUsed: false,
      cleanOutputPath: direct.endsWith('.clean.json')
        ? direct
        : direct.replace(/\.json$/i, '.clean.json'),
    }
  } catch {}

  if (direct.endsWith('.clean.json')) {
    const rawFallback = direct.replace(/\.clean\.json$/i, '.json')
    try {
      await fs.access(rawFallback)
      return {
        inputPath: path.resolve(rawFallback),
        fallbackUsed: true,
        cleanOutputPath: direct,
      }
    } catch {}
  }

  if (candidatePath === DEFAULT_INPUT) {
    try {
      await fs.access(path.resolve(DEFAULT_FALLBACK_INPUT))
      return {
        inputPath: path.resolve(DEFAULT_FALLBACK_INPUT),
        fallbackUsed: true,
        cleanOutputPath: path.resolve(DEFAULT_INPUT),
      }
    } catch {}
  }

  throw new Error(`Input file not found: ${candidatePath}`)
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Failed to parse JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function requireResearchPackShape(value) {
  if (!isPlainObject(value)) {
    throw new Error('Research pack must be a JSON object.')
  }
  if (value.import_format !== 'degreewiki_research_pack_v1') {
    throw new Error('import_format must equal "degreewiki_research_pack_v1".')
  }
  if (!isPlainObject(value.university)) {
    throw new Error('Research pack university must be an object.')
  }
  if (!Array.isArray(value.programs)) {
    throw new Error('Research pack programs must be an array.')
  }
  if (!isPlainObject(value.research_notes ?? {})) {
    throw new Error('Research pack research_notes must be an object.')
  }
  return {
    importFormat: value.import_format,
    university: value.university,
    programs: value.programs,
    researchNotes: value.research_notes ?? {},
  }
}

function buildTextSections(sections) {
  const parts = []
  for (const section of sections) {
    if (!section || !section.text) continue
    const header = section.label ? `${section.label}:\n` : ''
    parts.push(`${header}${section.text}`.trim())
  }
  return parts.length > 0 ? parts.join('\n\n') : null
}

function firstText(raw, keys) {
  for (const key of keys) {
    const value = raw[key]
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return null
}

function firstNumber(raw, keys) {
  for (const key of keys) {
    const value = raw[key]
    const number = toMaybeNumber(value)
    if (number !== null) return number
  }
  return null
}

function buildEnglishRequirements(raw) {
  const requirements = {}
  const notes = firstText(raw, ['english_requirements_text'])
  if (notes) requirements.notes = notes
  const ielts = firstNumber(raw, ['ielts_min_score'])
  if (ielts !== null) requirements.ielts = { min_overall: ielts }
  const toefl = firstNumber(raw, ['toefl_min_score'])
  if (toefl !== null) requirements.toefl = { min_overall: toefl }
  const pte = firstNumber(raw, ['pte_min_score'])
  if (pte !== null) requirements.pte = { min_overall: pte }
  const duolingo = firstNumber(raw, ['duolingo_min_score'])
  if (duolingo !== null) requirements.duolingo = { min_overall: duolingo }
  return Object.keys(requirements).length > 0 ? requirements : null
}

function buildUniversityPayload(raw, countryId, cityId, slug) {
  return {
    name: firstText(raw, ['name']),
    slug,
    country_id: countryId,
    city_id: cityId,
    official_url: normalizeUrl(firstText(raw, ['official_url'])) ?? null,
    overview: null,
    ...DRAFT_STATUS,
  }
}

function buildProgramPayload(raw, context) {
  const degreeLevelCode = normalizeDegreeLevel(firstText(raw, ['degree_level']))
  const programSlugBase = slugify(firstText(raw, ['title']))
  const programSlugCandidates = uniqueStrings([
    programSlugBase,
    degreeLevelCode ? `${programSlugBase}-${degreeLevelCode}` : null,
    context.universitySlug ? `${programSlugBase}-${degreeLevelCode || 'prog'}-${slugify(context.universitySlug)}` : null,
    `${programSlugBase}-${degreeLevelCode || 'prog'}-${context.universityId.slice(0, 8)}`,
  ])

  const admissionRequirements = buildTextSections([
    { label: 'Admission requirements', text: firstText(raw, ['admission_requirements_text']) },
    { label: 'Academic requirements', text: firstText(raw, ['academic_requirements_text']) },
    { label: 'Required documents', text: firstText(raw, ['required_documents_text']) },
  ])

  const gpaRequirements = firstText(raw, ['gpa_requirement_text']) ??
    ((firstNumber(raw, ['minimum_gpa_value']) !== null && firstNumber(raw, ['minimum_gpa_scale']) !== null)
      ? `Minimum ${firstNumber(raw, ['minimum_gpa_value'])} of ${firstNumber(raw, ['minimum_gpa_scale'])}.`
      : null)

  return {
    degreeLevelCode,
    slugCandidates: programSlugCandidates,
    payload: {
      title: firstText(raw, ['title']),
      slug: programSlugBase,
      university_id: context.universityId,
      country_id: context.countryId,
      city_id: context.cityId,
      degree_level_id: context.degreeLevelId,
      degree_award: firstText(raw, ['degree_award']),
      primary_subject_id: context.primarySubjectId,
      duration_months: firstNumber(raw, ['duration_months']),
      study_mode: normalizeEnum(firstText(raw, ['study_mode']), ['full_time', 'part_time', 'online', 'hybrid'], {
        fulltime: 'full_time',
        parttime: 'part_time',
        oncampus: 'full_time',
        inperson: 'full_time',
      }),
      delivery_mode: normalizeEnum(firstText(raw, ['delivery_mode']), ['on_campus', 'online', 'hybrid', 'distance'], {
        campus: 'on_campus',
        oncampus: 'on_campus',
        inperson: 'on_campus',
      }),
      language_of_instruction: firstText(raw, ['language_of_instruction', 'language']),
      tuition_min_amount: firstNumber(raw, ['tuition_amount', 'tuition_min_amount']),
      tuition_max_amount: firstNumber(raw, ['tuition_max_amount']),
      tuition_currency: firstText(raw, ['tuition_currency']),
      tuition_period: normalizeEnum(firstText(raw, ['tuition_period']), ['per_year', 'per_semester', 'total', 'per_credit'], {
        year: 'per_year',
        yearly: 'per_year',
        annual: 'per_year',
        annually: 'per_year',
        per_year: 'per_year',
        semester: 'per_semester',
        per_semester: 'per_semester',
        credit: 'per_credit',
      }),
      tuition_notes: firstText(raw, ['tuition_notes']),
      application_fee_amount: firstNumber(raw, ['application_fee_amount']),
      application_fee_currency: firstText(raw, ['application_fee_currency']),
      application_fee_notes: firstText(raw, ['application_fee_notes']),
      application_url: normalizeUrl(firstText(raw, ['official_application_url', 'application_url'])) ?? null,
      official_url: normalizeUrl(firstText(raw, ['official_program_url', 'official_url'])) ?? null,
      admission_requirements: admissionRequirements,
      english_requirements: buildEnglishRequirements(raw),
      gpa_requirements: gpaRequirements,
      curriculum_summary: firstText(raw, ['curriculum_or_modules_text', 'curriculum_summary']),
      career_outcomes: firstText(raw, ['career_outcomes_text', 'career_outcomes']),
      ...DRAFT_STATUS,
    },
  }
}

function normalizeEnum(value, allowed, aliases = {}) {
  if (!value) return null
  const token = normalizeText(value).replace(/[\s-]+/g, '_')
  const normalized = aliases[token] ?? token
  return allowed.includes(normalized) ? normalized : null
}

function buildSourceUrls(raw, extraUrls = []) {
  const sourceUrls = []
  const rawArray = Array.isArray(raw.source_urls) ? raw.source_urls : []
  for (const value of [...rawArray, ...extraUrls]) {
    const normalized = normalizeUrl(value)
    if (normalized) sourceUrls.push(normalized)
  }
  return uniqueStrings(sourceUrls)
}

function buildSourceRows({
  entityType,
  entityId,
  sourceUrls,
  confidenceLevel = 'high',
  notes,
  primaryTitle,
  secondaryTitle,
  sourceType = 'official_university',
}) {
  const rows = []
  sourceUrls.forEach((sourceUrl, index) => {
    rows.push({
      entity_type: entityType,
      entity_id: entityId,
      source_url: sourceUrl,
      source_domain: new URL(sourceUrl).hostname,
      source_title: index === 0 ? primaryTitle : secondaryTitle,
      source_type: sourceType,
      confidence_level: confidenceLevel,
      source_status: 'active',
      is_primary_source: index === 0,
      notes,
    })
  })
  return rows
}

function normalizeEntityRow(row, type) {
  if (type === 'university') {
    return {
      ...row,
      name_norm: normalizeText(row.name),
      official_url_norm: canonicalizeUrlForCompare(row.official_url),
    }
  }
  return {
    ...row,
    title_norm: normalizeText(row.title),
  }
}

function createReportBuilder({
  mode,
  inputPath,
  resolvedInputPath,
  fallbackUsed,
  researchPack,
  universityRow,
  rows,
  universityPlan,
  validationNotes,
  unmappedFields,
}) {
  return {
    mode,
    inputPath,
    resolvedInputPath,
    fallbackUsed,
    researchPack,
    universityRow,
    rows,
    universityPlan,
    validationNotes,
    unmappedFields,
  }
}

function buildSummary(results) {
  const summary = { created: 0, updated: 0, skipped: 0, error: 0 }
  for (const row of results) {
    summary[row.action] += 1
  }
  return summary
}

function renderReport(report) {
  const lines = []
  const summary = buildSummary(report.rows)
  const created = report.rows.filter(row => row.action === 'created')
  const updated = report.rows.filter(row => row.action === 'updated')
  const skipped = report.rows.filter(row => row.action === 'skipped')
  const errored = report.rows.filter(row => row.action === 'error')
  const warnings = report.rows.filter(row => row.warning)

  lines.push('# MRU Research Pack Import Report')
  lines.push('')
  lines.push(`- Mode: \`${report.mode}\``)
  lines.push(`- Input file: \`${path.relative(process.cwd(), report.inputPath)}\``)
  lines.push(`- Resolved source: \`${path.relative(process.cwd(), report.resolvedInputPath)}\``)
  lines.push(`- Clean fallback used: \`${report.fallbackUsed ? 'yes' : 'no'}\``)
  lines.push(`- Import format: \`${report.researchPack.importFormat}\``)
  lines.push(`- University: ${report.universityRow ? `\`${report.universityRow.displayName}\`` : 'not resolved'}`)
  lines.push(`- Programs: ${report.researchPack.programs.length}`)
  lines.push('')
  lines.push('## Counts')
  lines.push('')
  lines.push(`- Created: ${summary.created}`)
  lines.push(`- Updated: ${summary.updated}`)
  lines.push(`- Skipped: ${summary.skipped}`)
  lines.push(`- Errors: ${summary.error}`)
  lines.push(`- Warnings: ${warnings.length}`)
  lines.push('')

  if (report.universityPlan) {
    lines.push('## University')
    lines.push('')
    lines.push(`- Action: **${report.universityPlan.action}**`)
    lines.push(`- Reason: ${report.universityPlan.reason}`)
    lines.push(`- Production ID: \`${report.universityPlan.productionId ?? '—'}\``)
    lines.push(`- Mapped fields: ${formatList(report.universityPlan.mappedFields)}`)
    lines.push(`- Unmapped fields: ${formatList(report.universityPlan.unmappedFields)}`)
    if (report.universityPlan.sourceCount !== undefined) {
      lines.push(`- Source URLs attached: ${report.universityPlan.sourceCount}`)
    }
    lines.push('')
  }

  lines.push('## Programs')
  lines.push('')
  if (report.rows.length === 0) {
    lines.push('No program rows were processed.')
    lines.push('')
  } else {
    lines.push('| # | Title | Action | Reason | Mapped fields | Unmapped fields |')
    lines.push('| - | - | - | - | - | - |')
    let programIndex = 0
    report.rows.forEach((row, index) => {
      const rowLabel = row.entityType === 'university' ? 'University' : String(++programIndex)
      lines.push(
        `| ${rowLabel} | ${markdownEscape(short(row.displayName, 40))} | ${row.action} | ${markdownEscape(short(row.reason, 80))} | ${markdownEscape(short(formatList(row.mappedFields), 90))} | ${markdownEscape(short(formatList(row.unmappedFields), 90))} |`,
      )
    })
    lines.push('')
  }

  if (created.length + updated.length + skipped.length + errored.length > 0) {
    lines.push('## Row Details')
    lines.push('')
    for (const row of report.rows) {
      lines.push(`- ${row.entityType === 'university' ? 'University' : 'Program'}: ${row.displayName}`)
      lines.push(`  - Action: ${row.action}`)
      lines.push(`  - Reason: ${row.reason}`)
      if (row.productionId) lines.push(`  - Production ID: \`${row.productionId}\``)
      if (row.mappedFields.length > 0) lines.push(`  - Mapped: ${formatList(row.mappedFields)}`)
      if (row.unmappedFields.length > 0) lines.push(`  - Unmapped: ${formatList(row.unmappedFields)}`)
      if (row.warning) lines.push(`  - Warning: ${row.warning}`)
      if (row.duplicateKey) lines.push(`  - Duplicate key: \`${row.duplicateKey}\``)
      lines.push('')
    }
  }

  lines.push('## Field Mapping')
  lines.push('')
  lines.push('- University production fields used: `name`, `slug`, `country_id`, `city_id`, `official_url`, `overview`, `content_status`, `verification_status`, `indexing_status`.')
  lines.push('- Program production fields used: `title`, `slug`, `university_id`, `country_id`, `city_id`, `degree_level_id`, `degree_award`, `primary_subject_id`, `duration_months`, `study_mode`, `delivery_mode`, `language_of_instruction`, `tuition_min_amount`, `tuition_max_amount`, `tuition_currency`, `tuition_period`, `tuition_notes`, `application_fee_amount`, `application_fee_currency`, `application_fee_notes`, `application_url`, `official_url`, `admission_requirements`, `english_requirements`, `gpa_requirements`, `curriculum_summary`, `career_outcomes`, `content_status`, `verification_status`, `indexing_status`.')
  lines.push('- Source URLs are preserved in `data_sources` rows, not in the production content tables.')
  lines.push('- Production tables have no raw JSON column for these entities, so the original pack is preserved only in the source files and this report.')
  lines.push('')

  lines.push('## Safety Rules')
  lines.push('')
  lines.push('- Inserted and updated production rows remain `draft` / `unverified` / `draft` indexing status.')
  lines.push('- Existing published or verified rows are skipped, never overwritten.')
  lines.push('- Existing draft/unverified rows only receive empty-field patches; populated fields are left untouched.')
  lines.push('- No delete operations are performed.')
  lines.push('- No service role key is printed.')
  lines.push('')

  if (report.validationNotes.length > 0) {
    lines.push('## Validation Notes')
    lines.push('')
    for (const note of report.validationNotes) {
      lines.push(`- ${note}`)
    }
    lines.push('')
  }

  if (report.unmappedFields.length > 0) {
    lines.push('## Unmapped Fields')
    lines.push('')
    for (const field of uniqueStrings(report.unmappedFields)) {
      lines.push(`- \`${field}\``)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function buildUniversityDuplicateKey(row) {
  return `${normalizeText(row.name)}|${canonicalizeUrlForCompare(row.official_url) ?? ''}`
}

function buildProgramDuplicateKey(row, universityId, degreeLevelId) {
  return `${normalizeText(row.title)}|${universityId}|${degreeLevelId}`
}

function selectBestUniversityMatch(university, existingUniversities) {
  const normalizedName = normalizeText(firstText(university, ['name']))
  const normalizedUrl = canonicalizeUrlForCompare(firstText(university, ['official_url']))
  const matches = existingUniversities.filter(row => {
    const byName = row.name_norm === normalizedName
    const byUrl = normalizedUrl ? row.official_url_norm === normalizedUrl : false
    return byName || byUrl
  })

  if (matches.length === 0) return { match: null, matches: [] }

  const uniqueIds = uniqueStrings(matches.map(row => row.id))
  if (uniqueIds.length > 1) {
    return { match: null, matches }
  }

  return { match: matches[0], matches }
}

function allowedEmptyPatch(existing, proposed, fields) {
  const patch = {}
  const changed = []

  for (const field of fields) {
    const proposedValue = proposed[field]
    if (proposedValue === undefined || proposedValue === null || proposedValue === '') continue

    const existingValue = existing[field]
    const existingIsEmpty =
      existingValue === null ||
      existingValue === undefined ||
      existingValue === '' ||
      (typeof existingValue === 'object' && !Array.isArray(existingValue) && Object.keys(existingValue).length === 0)

    if (existingIsEmpty) {
      patch[field] = proposedValue
      changed.push(field)
    }
  }

  return { patch, changed }
}

async function loadSupabase() {
  const url = process.env.PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    die('PUBLIC_SUPABASE_URL is required.')
  }
  if (!serviceRoleKey) {
    die('SUPABASE_SERVICE_ROLE_KEY is required for direct production import.')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function loadLookupTables(supabase) {
  const [
    { data: countriesData, error: countriesError },
    { data: degreeLevelsData, error: degreeLevelsError },
    { data: subjectsData, error: subjectsError },
    { data: universitiesData, error: universitiesError },
    { data: programsData, error: programsError },
  ] = await Promise.all([
    supabase.from('countries').select('id, name, iso2, slug').order('name', { ascending: true }),
    supabase.from('degree_levels').select('id, code, name').order('display_order', { ascending: true }),
    supabase.from('subjects').select('id, name').order('name', { ascending: true }),
    supabase.from('universities').select('id, name, slug, country_id, city_id, official_url, overview, content_status, verification_status').order('name', { ascending: true }),
    supabase.from('programs').select('id, title, slug, university_id, country_id, city_id, degree_level_id, degree_award, primary_subject_id, duration_months, study_mode, delivery_mode, language_of_instruction, tuition_min_amount, tuition_max_amount, tuition_currency, tuition_period, tuition_notes, application_fee_amount, application_fee_currency, application_fee_notes, application_url, official_url, admission_requirements, english_requirements, gpa_requirements, curriculum_summary, career_outcomes, content_status, verification_status, indexing_status').order('title', { ascending: true }),
  ])

  if (countriesError) die(`Failed to load countries: ${countriesError.message}`)
  if (degreeLevelsError) die(`Failed to load degree levels: ${degreeLevelsError.message}`)
  if (subjectsError) die(`Failed to load subjects: ${subjectsError.message}`)
  if (universitiesError) die(`Failed to load universities: ${universitiesError.message}`)
  if (programsError) die(`Failed to load programs: ${programsError.message}`)

  return {
    countries: (countriesData ?? []).map(row => ({
      ...row,
      iso2_norm: normalizeText(row.iso2),
      name_norm: normalizeText(row.name),
    })),
    degreeLevels: (degreeLevelsData ?? []).map(row => ({
      ...row,
      code_norm: normalizeText(row.code),
    })),
    subjects: (subjectsData ?? []).map(row => ({
      ...row,
      name_norm: normalizeText(row.name),
    })),
    universities: (universitiesData ?? []).map(row => normalizeEntityRow(row, 'university')),
    programs: (programsData ?? []).map(row => normalizeEntityRow(row, 'program')),
  }
}

function buildCountryMaps(countries) {
  const byIso2 = new Map()
  const byName = new Map()
  for (const country of countries) {
    byIso2.set(country.iso2_norm, country)
    byName.set(country.name_norm, country)
  }
  return { byIso2, byName }
}

function buildDegreeLevelMap(degreeLevels) {
  const byCode = new Map()
  for (const degreeLevel of degreeLevels) {
    byCode.set(degreeLevel.code_norm, degreeLevel)
  }
  return byCode
}

function buildSubjectMap(subjects) {
  const byName = new Map()
  for (const subject of subjects) {
    const existing = byName.get(subject.name_norm) ?? []
    existing.push(subject)
    byName.set(subject.name_norm, existing)
  }
  return byName
}

async function loadEntitySourceUrls(supabase, entityType, entityId) {
  const { data, error } = await supabase
    .from('data_sources')
    .select('source_url, is_primary_source')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)

  if (error) {
    return { urls: [], primaryExists: false, error: error.message }
  }

  const urls = uniqueStrings((data ?? []).map(row => canonicalizeUrlForCompare(row.source_url)).filter(Boolean))
  return {
    urls,
    primaryExists: (data ?? []).some(row => row.is_primary_source),
    error: null,
  }
}

async function insertEntitySources(supabase, rows) {
  if (rows.length === 0) return { inserted: 0, warning: null }
  const { error } = await supabase.from('data_sources').insert(rows)
  if (error) {
    return { inserted: 0, warning: error.message }
  }
  return { inserted: rows.length, warning: null }
}

async function writeReport(reportPath, reportContent) {
  const fullPath = path.resolve(reportPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, reportContent, 'utf8')
  return fullPath
}

async function writeCleanCopyIfNeeded(cleanOutputPath, parsedPack) {
  if (!cleanOutputPath) return null
  const fullPath = path.resolve(cleanOutputPath)
  try {
    await fs.access(fullPath)
    return fullPath
  } catch {}

  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, `${JSON.stringify(parsedPack, null, 2)}\n`, 'utf8')
  return fullPath
}

async function main() {
  const { mode, inputPath, reportPath } = parseArgs(process.argv.slice(2))
  const resolved = await resolveInputFile(inputPath)
  const raw = await readJsonFile(resolved.inputPath)
  const researchPack = requireResearchPackShape(raw)
  const supabase = await loadSupabase()
  const lookups = await loadLookupTables(supabase)

  const validationNotes = []
  const unmappedFields = new Set()
  const rows = []

  const countryText = firstText(researchPack.university, ['country', 'country_code']) || ''
  const countryCode = normalizeText(firstText(researchPack.university, ['country_code']))
  const countryName = firstText(researchPack.university, ['country'])
  const { byIso2, byName } = buildCountryMaps(lookups.countries)

  let country = null
  if (countryCode && byIso2.has(countryCode)) {
    country = byIso2.get(countryCode)
  } else if (countryName && byName.has(normalizeText(countryName))) {
    country = byName.get(normalizeText(countryName))
  }

  if (!country) {
    validationNotes.push(`Could not resolve university country from "${countryText}".`)
  }

  const universitySourceUrls = buildSourceUrls(researchPack.university, [researchPack.university.official_url])
  const universitySlugBase = slugify(researchPack.university.name)
  const universityPlan = {
    action: 'error',
    reason: '',
    productionId: null,
    mappedFields: [],
    unmappedFields: [],
    sourceCount: universitySourceUrls.length,
  }
  let universityForPrograms = null

  const universityMatch = country
    ? selectBestUniversityMatch(researchPack.university, lookups.universities)
    : { match: null, matches: [] }

  if (country && universityMatch.matches.length > 1 && !universityMatch.match) {
    universityPlan.action = 'error'
    universityPlan.reason = 'Ambiguous university match: more than one production university matched the same normalized name or official URL.'
    validationNotes.push('Multiple university candidates matched by normalized name or official URL.')
  } else if (country && universityMatch.match) {
    const existing = universityMatch.match
    const isProtected = existing.content_status !== 'draft' || existing.verification_status !== 'unverified'

    if (isProtected) {
        universityPlan.action = 'skipped'
        universityPlan.reason = `Matched existing ${existing.content_status}/${existing.verification_status} university. No changes were written.`
        universityPlan.productionId = existing.id
        universityPlan.mappedFields = []
        universityPlan.unmappedFields = ['notes']
        universityPlan.unmappedFields.forEach(field => unmappedFields.add(field))
        universityForPrograms = existing
    } else {
      const cityCandidates = country ? (await supabase
        .from('cities')
        .select('id, name, country_id')
        .eq('country_id', country.id)
      ).data ?? [] : []
      const cityNorm = normalizeText(firstText(researchPack.university, ['city']))
      const matchedCity = cityCandidates.find(row => normalizeText(row.name) === cityNorm) ?? null

      const universityPayload = buildUniversityPayload(
        researchPack.university,
        country.id,
        matchedCity ? matchedCity.id : null,
        universitySlugBase,
      )

      const patch = allowedEmptyPatch(existing, universityPayload, UNIVERSITY_INSERT_FIELDS)
      const sourceLoad = await loadEntitySourceUrls(supabase, 'university', existing.id)
      const existingSourceUrls = sourceLoad.urls
      const combinedUrls = uniqueStrings([...existingSourceUrls, ...universitySourceUrls])
      const newSourceUrls = combinedUrls.filter(url => !existingSourceUrls.includes(url))

      if (Object.keys(patch.patch).length === 0 && newSourceUrls.length === 0) {
        universityPlan.action = 'skipped'
        universityPlan.reason = 'Matched an existing draft/unverified university, but all allowlisted fields and source URLs were already present.'
        universityPlan.productionId = existing.id
      } else {
        if (Object.keys(patch.patch).length > 0) {
          const { error } = await supabase.from('universities').update(patch.patch).eq('id', existing.id)
          if (error) {
            die(`Failed to update existing university ${existing.id}: ${error.message}`)
          }
        }

        if (newSourceUrls.length > 0) {
          const insertedRows = buildSourceRows({
            entityType: 'university',
            entityId: existing.id,
            sourceUrls: newSourceUrls,
            confidenceLevel: 'high',
            notes: 'Imported directly from the MRU research pack. Verify manually before publishing.',
            primaryTitle: 'Official university page',
            secondaryTitle: 'Official university page',
          })
          const sourceInsert = await insertEntitySources(supabase, insertedRows)
          if (sourceInsert.warning) {
            validationNotes.push(`University source attachment warning: ${sourceInsert.warning}`)
          }
        }

        const changeNotes = []
        if (patch.changed.length > 0) {
          changeNotes.push(`filled ${patch.changed.length} empty field(s)`)
        }
        if (newSourceUrls.length > 0) {
          changeNotes.push(`attached ${newSourceUrls.length} new source URL(s)`)
        }

        universityPlan.action = 'updated'
        universityPlan.reason = `Updated the existing draft/unverified university by ${changeNotes.join(' and ')}.`
        universityPlan.productionId = existing.id
        universityPlan.mappedFields = patch.changed
        universityPlan.unmappedFields = ['notes']
        universityPlan.unmappedFields.forEach(field => unmappedFields.add(field))
        universityForPrograms = {
          ...existing,
          country_id: country.id,
          city_id: patch.patch.city_id ?? existing.city_id,
          slug: universityPayload.slug,
        }
      }
    }
  } else if (country) {
    const cityCandidates = await supabase
      .from('cities')
      .select('id, name, country_id')
      .eq('country_id', country.id)
    const cityNorm = normalizeText(firstText(researchPack.university, ['city']))
    const matchedCity = (cityCandidates.data ?? []).find(row => normalizeText(row.name) === cityNorm) ?? null

    let slug = universitySlugBase
    const existingSlugs = new Set(lookups.universities.map(row => row.slug))
    let counter = 2
    while (existingSlugs.has(slug)) {
      slug = `${universitySlugBase}-${counter}`
      counter += 1
    }

    const payload = buildUniversityPayload(researchPack.university, country.id, matchedCity ? matchedCity.id : null, slug)
    const { data, error } = await supabase
      .from('universities')
      .insert(payload)
      .select('id')
      .single()

    if (error || !data) {
      die(`Failed to insert production university: ${error?.message ?? 'unknown error'}`)
    }

    universityPlan.action = 'created'
    universityPlan.reason = 'Created a new draft/unverified production university.'
    universityPlan.productionId = data.id
    universityPlan.mappedFields = UNIVERSITY_INSERT_FIELDS.filter(field => payload[field] !== undefined && payload[field] !== null && payload[field] !== '')
    universityPlan.unmappedFields = ['notes']
    universityPlan.unmappedFields.forEach(field => unmappedFields.add(field))
    universityForPrograms = {
      id: data.id,
      country_id: country.id,
      city_id: payload.city_id ?? null,
      slug: payload.slug,
    }

    if (universitySourceUrls.length > 0) {
      const sourceInsert = await insertEntitySources(
        supabase,
        buildSourceRows({
          entityType: 'university',
          entityId: data.id,
          sourceUrls: universitySourceUrls,
          confidenceLevel: 'high',
          notes: 'Imported directly from the MRU research pack. Verify manually before publishing.',
          primaryTitle: 'Official university page',
          secondaryTitle: 'Official university page',
        }),
      )
      if (sourceInsert.warning) {
        validationNotes.push(`University source attachment warning: ${sourceInsert.warning}`)
      }
    }
  }

  if (!country) {
    universityPlan.action = 'error'
    universityPlan.reason = 'Could not resolve the university country, so no production write was attempted.'
  }

  const universityId = universityPlan.productionId
  const resolvedUniversity = universityForPrograms ?? (universityId
    ? lookups.universities.find(row => row.id === universityId) ?? null
    : null)

  const primaryUniversity = resolvedUniversity ?? (universityMatch.match ?? null)
  const programSourceConfidenceDefault = firstText(researchPack.programs[0] ?? {}, ['source_confidence']) ?? 'unknown'

  if (!universityId) {
    validationNotes.push('Programs were not imported because the university could not be resolved safely.')
  }

  const programDuplicateTracker = new Set()
  const programPlans = []

  if (universityId) {
    const degreeLevelByCode = buildDegreeLevelMap(lookups.degreeLevels)
    const subjectByName = buildSubjectMap(lookups.subjects)
    const cityCandidates = (await supabase
      .from('cities')
      .select('id, name, country_id')
      .eq('country_id', primaryUniversity?.country_id ?? country.id)
    ).data ?? []
    const existingProgramsForUniversity = lookups.programs.filter(row => row.university_id === universityId)

    for (const [index, rawProgram] of researchPack.programs.entries()) {
      if (!isPlainObject(rawProgram)) {
        programPlans.push({
          entityType: 'program',
          displayName: `Row ${index + 1}`,
          action: 'error',
          reason: 'Program row is not an object.',
          productionId: null,
          mappedFields: [],
          unmappedFields: [],
          warning: null,
          duplicateKey: null,
        })
        continue
      }

      const title = firstText(rawProgram, ['title'])
      const degreeLevelCode = normalizeDegreeLevel(firstText(rawProgram, ['degree_level']))
      const degreeLevel = degreeLevelCode ? degreeLevelByCode.get(normalizeText(degreeLevelCode)) ?? degreeLevelByCode.get(degreeLevelCode) : null
      const displayName = title || `Program row ${index + 1}`
      const duplicateKey = title && degreeLevel ? buildProgramDuplicateKey(rawProgram, universityId, degreeLevel.id) : null

      if (!title) {
        programPlans.push({
          entityType: 'program',
          displayName,
          action: 'error',
          reason: 'Missing required field: title.',
          productionId: null,
          mappedFields: [],
          unmappedFields: [],
          warning: null,
          duplicateKey,
        })
        continue
      }

      if (!degreeLevel) {
        programPlans.push({
          entityType: 'program',
          displayName,
          action: 'error',
          reason: `Could not resolve degree level "${firstText(rawProgram, ['degree_level']) ?? ''}".`,
          productionId: null,
          mappedFields: [],
          unmappedFields: [],
          warning: null,
          duplicateKey,
        })
        continue
      }

      if (duplicateKey && programDuplicateTracker.has(duplicateKey)) {
        programPlans.push({
          entityType: 'program',
          displayName,
          action: 'skipped',
          reason: 'Skipped same-batch duplicate program row.',
          productionId: null,
          mappedFields: [],
          unmappedFields: [],
          warning: null,
          duplicateKey,
        })
        continue
      }
      if (duplicateKey) programDuplicateTracker.add(duplicateKey)

      const subjectArea = firstText(rawProgram, ['subject_area'])
      let primarySubjectId = null
      if (subjectArea) {
        const exactSubjects = subjectByName.get(normalizeText(subjectArea)) ?? []
        if (exactSubjects.length === 1) {
          primarySubjectId = exactSubjects[0].id
        } else if (exactSubjects.length > 1) {
          validationNotes.push(`Ambiguous subject match for "${subjectArea}" on "${displayName}".`)
          unmappedFields.add('primary_subject_id')
        } else {
          unmappedFields.add('primary_subject_id')
        }
      }

      const cityText = firstText(rawProgram, ['city', 'campus_or_location'])
      const cityMatch = cityText
        ? cityCandidates.find(row => normalizeText(row.name) === normalizeText(cityText)) ?? null
        : null
      if (cityText && !cityMatch) {
        unmappedFields.add('city_id')
      }

      const programContext = {
        universityId,
        universitySlug: primaryUniversity?.slug ?? resolvedUniversity?.slug ?? '',
        countryId: primaryUniversity?.country_id ?? country.id,
        cityId: cityMatch ? cityMatch.id : primaryUniversity?.city_id ?? null,
        degreeLevelId: degreeLevel.id,
        primarySubjectId,
      }
      const built = buildProgramPayload(rawProgram, programContext)
      const proposed = built.payload
      const insertableFields = PROGRAM_INSERT_FIELDS.filter(field => proposed[field] !== undefined && proposed[field] !== null && proposed[field] !== '')
      const sourceUrls = buildSourceUrls(rawProgram, [
        proposed.official_url,
        proposed.application_url,
        firstText(rawProgram, ['official_tuition_url']),
      ])
      const sourceConfidence = firstText(rawProgram, ['source_confidence']) || programSourceConfidenceDefault || 'unknown'

      const existingMatch = existingProgramsForUniversity.find(row => {
        return row.title_norm === normalizeText(title) && row.degree_level_id === degreeLevel.id
      }) ?? null

      if (existingMatch) {
        const protectedExisting = existingMatch.content_status !== 'draft' || existingMatch.verification_status !== 'unverified'
        if (protectedExisting) {
          programPlans.push({
            entityType: 'program',
            displayName,
            action: 'skipped',
            reason: `Matched existing ${existingMatch.content_status}/${existingMatch.verification_status} production program. No changes were written.`,
            productionId: existingMatch.id,
            mappedFields: [],
            unmappedFields: [
              ...(proposed.official_url ? [] : ['official_url']),
              ...(proposed.application_url ? [] : ['application_url']),
            ],
            warning: null,
            duplicateKey,
          })
          continue
        }

        const sourceLoad = await loadEntitySourceUrls(supabase, 'program', existingMatch.id)
        const existingSourceUrls = sourceLoad.urls
        const newSourceUrls = sourceUrls.filter(url => !existingSourceUrls.includes(url))
        const patch = allowedEmptyPatch(existingMatch, proposed, PROGRAM_INSERT_FIELDS)

        if (Object.keys(patch.patch).length === 0 && newSourceUrls.length === 0) {
          programPlans.push({
            entityType: 'program',
            displayName,
            action: 'skipped',
            reason: 'Matched an existing draft/unverified program, but no allowlisted empty fields or new sources were available.',
            productionId: existingMatch.id,
            mappedFields: [],
            unmappedFields: [
              ...(proposed.official_url ? [] : ['official_url']),
              ...(proposed.application_url ? [] : ['application_url']),
            ],
            warning: null,
            duplicateKey,
          })
          continue
        }

        if (Object.keys(patch.patch).length > 0) {
          const { error } = await supabase.from('programs').update(patch.patch).eq('id', existingMatch.id)
          if (error) {
            die(`Failed to update existing program ${existingMatch.id}: ${error.message}`)
          }
        }

        let warning = null
        if (newSourceUrls.length > 0) {
          const sourceInsert = await insertEntitySources(
            supabase,
            buildSourceRows({
              entityType: 'program',
              entityId: existingMatch.id,
              sourceUrls: newSourceUrls,
              confidenceLevel: sourceConfidence,
              notes: 'Imported directly from the MRU research pack. Verify manually before publishing.',
              primaryTitle: 'Official program page',
              secondaryTitle: 'Research source',
            }),
          )
          warning = sourceInsert.warning
          if (warning) validationNotes.push(`Program source attachment warning for "${displayName}": ${warning}`)
        }

        const changeNotes = []
        if (patch.changed.length > 0) {
          changeNotes.push(`filled ${patch.changed.length} empty field(s)`)
        }
        if (newSourceUrls.length > 0) {
          changeNotes.push(`attached ${newSourceUrls.length} new source URL(s)`)
        }

        programPlans.push({
          entityType: 'program',
          displayName,
          action: 'updated',
          reason: `Updated the existing draft/unverified program by ${changeNotes.join(' and ')}.`,
          productionId: existingMatch.id,
          mappedFields: patch.changed,
          unmappedFields: uniqueStrings([
            ...(proposed.official_url ? [] : ['official_url']),
            ...(proposed.application_url ? [] : ['application_url']),
          ]),
          warning,
          duplicateKey,
        })
        continue
      }

      let slug = built.slugCandidates[0] || slugify(title)
      const existingSlugs = new Set(lookups.programs.map(row => row.slug))
      let counter = 2
      while (existingSlugs.has(slug)) {
        slug = `${built.slugCandidates[0] || slugify(title)}-${counter}`
        counter += 1
      }
      proposed.slug = slug

      const { data, error } = await supabase
        .from('programs')
        .insert(proposed)
        .select('id')
        .single()

      if (error || !data) {
        programPlans.push({
          entityType: 'program',
          displayName,
          action: 'error',
          reason: `Failed to insert production program: ${error?.message ?? 'unknown error'}`,
          productionId: null,
          mappedFields: insertableFields,
          unmappedFields: uniqueStrings([
            ...(proposed.official_url ? [] : ['official_url']),
            ...(proposed.application_url ? [] : ['application_url']),
          ]),
          warning: null,
          duplicateKey,
        })
        continue
      }

      let warning = null
      if (sourceUrls.length > 0) {
        const sourceInsert = await insertEntitySources(
          supabase,
          buildSourceRows({
            entityType: 'program',
            entityId: data.id,
            sourceUrls,
            confidenceLevel: sourceConfidence,
            notes: 'Imported directly from the MRU research pack. Verify manually before publishing.',
            primaryTitle: 'Official program page',
            secondaryTitle: 'Research source',
          }),
        )
        warning = sourceInsert.warning
        if (warning) validationNotes.push(`Program source attachment warning for "${displayName}": ${warning}`)
      }

      const unmapped = uniqueStrings([
        ...(subjectArea && primarySubjectId ? [] : ['primary_subject_id']),
        ...(cityText && cityMatch ? [] : ['city_id']),
        ...(firstText(rawProgram, ['official_tuition_url']) ? [] : []),
        ...(firstText(rawProgram, ['duration_text']) ? ['duration_text'] : []),
        ...(firstText(rawProgram, ['intake_text']) ? ['intake_text'] : []),
        ...(firstText(rawProgram, ['application_deadline_text']) ? ['application_deadline_text'] : []),
        ...(firstText(rawProgram, ['next_application_deadline']) ? ['next_application_deadline'] : []),
        ...(firstText(rawProgram, ['study_field_keywords']) ? ['study_field_keywords'] : []),
        ...(firstText(rawProgram, ['scholarship_notes']) ? ['scholarship_notes'] : []),
        ...(firstText(rawProgram, ['notes']) ? ['notes'] : []),
      ])
      unmapped.forEach(field => unmappedFields.add(field))

      programPlans.push({
        entityType: 'program',
        displayName,
        action: 'created',
        reason: 'Created a new draft/unverified production program.',
        productionId: data.id,
        mappedFields: insertableFields,
        unmappedFields: unmapped,
        warning,
        duplicateKey,
      })
    }
  }

  const report = createReportBuilder({
    mode,
    inputPath,
    resolvedInputPath: resolved.inputPath,
    fallbackUsed: resolved.fallbackUsed,
    researchPack,
    universityRow: universityPlan.productionId
      ? { displayName: researchPack.university.name }
      : null,
    rows: [
      {
        entityType: 'university',
        displayName: researchPack.university.name,
        action: universityPlan.action,
        reason: universityPlan.reason,
        productionId: universityPlan.productionId,
        mappedFields: universityPlan.mappedFields,
        unmappedFields: universityPlan.unmappedFields,
        warning: null,
        duplicateKey: buildUniversityDuplicateKey(researchPack.university),
      },
      ...programPlans,
    ],
    universityPlan,
    validationNotes,
    unmappedFields: [...unmappedFields],
  })

  const reportContent = renderReport(report)
  const savedReportPath = await writeReport(reportPath, reportContent)
  const cleanCopyPath = await writeCleanCopyIfNeeded(resolved.cleanOutputPath, raw)

  if (mode === '--dry-run') {
    console.log(`Dry run complete. Report written to ${savedReportPath}.`)
    if (cleanCopyPath) console.log(`Clean copy written to ${cleanCopyPath}.`)
    return
  }

  const summary = buildSummary(report.rows)
  console.log(`Apply complete. Created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, errors ${summary.error}.`)
  console.log(`Report written to ${savedReportPath}.`)
  if (cleanCopyPath) console.log(`Clean copy written to ${cleanCopyPath}.`)
}

main().catch(error => {
  die(error instanceof Error ? error.message : String(error))
})
