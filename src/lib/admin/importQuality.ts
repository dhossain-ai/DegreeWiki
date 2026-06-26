import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveProgramProductionMatches } from './importMerge'

export type QualityWarning = {
  rowId: string
  stagingTable: 'staging_universities' | 'staging_programs' | 'staging_scholarships' | 'staging_articles'
  errorType: 'same_batch_duplicate' | 'possible_production_match'
  errorMessage: string
}

export function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

// ---------------------------------------------------------------------------
// Universities
// ---------------------------------------------------------------------------

type StagingUniRow = {
  id: string
  extracted_name: string | null
  extracted_official_url: string | null
}

export function detectUniSameBatchDuplicates(rows: StagingUniRow[]): QualityWarning[] {
  const warnings: QualityWarning[] = []

  const byName = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_name?.trim()) continue
    const key = normalizeForMatch(row.extracted_name)
    const ids = byName.get(key) ?? []
    ids.push(row.id)
    byName.set(key, ids)
  }
  for (const [name, ids] of byName) {
    if (ids.length < 2) continue
    for (const rowId of ids) {
      warnings.push({
        rowId,
        stagingTable: 'staging_universities',
        errorType: 'same_batch_duplicate',
        errorMessage: `Same-batch duplicate: another row in this batch has the same name "${name}".`,
      })
    }
  }

  const byUrl = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_official_url?.trim()) continue
    const key = row.extracted_official_url.trim().toLowerCase()
    const ids = byUrl.get(key) ?? []
    ids.push(row.id)
    byUrl.set(key, ids)
  }
  for (const [url, ids] of byUrl) {
    if (ids.length < 2) continue
    for (const rowId of ids) {
      if (warnings.some(w => w.rowId === rowId && w.errorType === 'same_batch_duplicate')) continue
      warnings.push({
        rowId,
        stagingTable: 'staging_universities',
        errorType: 'same_batch_duplicate',
        errorMessage: `Same-batch duplicate: another row in this batch has the same official URL "${url}".`,
      })
    }
  }

  return warnings
}

export async function detectUniProductionMatches(
  supabase: SupabaseClient,
  rows: StagingUniRow[],
): Promise<QualityWarning[]> {
  const warnings: QualityWarning[] = []
  if (rows.length === 0) return warnings

  const nameToRowIds = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_name?.trim()) continue
    const key = normalizeForMatch(row.extracted_name)
    const ids = nameToRowIds.get(key) ?? []
    ids.push(row.id)
    nameToRowIds.set(key, ids)
  }

  const nameChecks = await Promise.all(
    [...nameToRowIds.keys()].map(async normName => {
      const { data } = await supabase
        .from('universities')
        .select('id, name')
        .ilike('name', normName)
        .limit(1)
      return { normName, match: (data?.[0] as { id: string; name: string } | undefined) ?? null }
    }),
  )

  for (const { normName, match } of nameChecks) {
    if (!match) continue
    for (const rowId of nameToRowIds.get(normName) ?? []) {
      warnings.push({
        rowId,
        stagingTable: 'staging_universities',
        errorType: 'possible_production_match',
        errorMessage: `Possible match: production university "${match.name}" already exists.`,
      })
    }
  }

  const warnedByUrl = new Set<string>()
  const urlToRowIds = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_official_url?.trim()) continue
    const key = row.extracted_official_url.trim()
    const ids = urlToRowIds.get(key) ?? []
    ids.push(row.id)
    urlToRowIds.set(key, ids)
  }

  const urlChecks = await Promise.all(
    [...urlToRowIds.keys()].map(async url => {
      const { data } = await supabase
        .from('universities')
        .select('id, name, official_url')
        .eq('official_url', url)
        .limit(1)
      return {
        url,
        match: (data?.[0] as { id: string; name: string; official_url: string } | undefined) ?? null,
      }
    }),
  )

  for (const { url, match } of urlChecks) {
    if (!match) continue
    for (const rowId of urlToRowIds.get(url) ?? []) {
      if (warnings.some(w => w.rowId === rowId && w.errorType === 'possible_production_match')) continue
      warnedByUrl.add(rowId)
      warnings.push({
        rowId,
        stagingTable: 'staging_universities',
        errorType: 'possible_production_match',
        errorMessage: `Possible match: production university "${match.name}" has the same official URL.`,
      })
    }
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

type StagingProgRow = {
  id: string
  extracted_title: string | null
  extracted_degree_level_code: string | null
  staging_university_id: string | null
}

export function detectProgSameBatchDuplicates(rows: StagingProgRow[]): QualityWarning[] {
  const warnings: QualityWarning[] = []
  const byKey = new Map<string, string[]>()

  for (const row of rows) {
    if (!row.extracted_title?.trim()) continue
    const normTitle = normalizeForMatch(row.extracted_title)
    const uniPart = row.staging_university_id ?? ''
    const degreePart = row.extracted_degree_level_code?.trim().toLowerCase() ?? ''
    const key = `${normTitle}|${uniPart}|${degreePart}`
    const ids = byKey.get(key) ?? []
    ids.push(row.id)
    byKey.set(key, ids)
  }

  for (const ids of byKey.values()) {
    if (ids.length < 2) continue
    for (const rowId of ids) {
      warnings.push({
        rowId,
        stagingTable: 'staging_programs',
        errorType: 'same_batch_duplicate',
        errorMessage: 'Same-batch duplicate: another row in this batch has the same title, university, and degree level.',
      })
    }
  }

  return warnings
}

export async function detectProgProductionMatches(
  supabase: SupabaseClient,
  rows: StagingProgRow[],
): Promise<QualityWarning[]> {
  const warnings: QualityWarning[] = []
  if (rows.length === 0) return warnings

  const matchResolutions = await resolveProgramProductionMatches(supabase, rows)

  for (const row of rows) {
    const resolution = matchResolutions.get(row.id)
    if (!resolution) continue

    if (resolution.status === 'matched') {
      const match = resolution.matches[0]
      warnings.push({
        rowId: row.id,
        stagingTable: 'staging_programs',
        errorType: 'possible_production_match',
        errorMessage: `Possible exact match: production program "${match.title}" (${match.slug}) already exists for the same university and degree level.`,
      })
      continue
    }

    if (resolution.status === 'ambiguous') {
      warnings.push({
        rowId: row.id,
        stagingTable: 'staging_programs',
        errorType: 'possible_production_match',
        errorMessage: 'Possible exact match: multiple production programs already exist with the same title, university, and degree level. Link the intended program before updating or skipping.',
      })
    }
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Scholarships
// ---------------------------------------------------------------------------

type StagingScholRow = {
  id: string
  extracted_name: string | null
}

export function detectScholSameBatchDuplicates(rows: StagingScholRow[]): QualityWarning[] {
  const warnings: QualityWarning[] = []
  const byName = new Map<string, string[]>()

  for (const row of rows) {
    if (!row.extracted_name?.trim()) continue
    const key = normalizeForMatch(row.extracted_name)
    const ids = byName.get(key) ?? []
    ids.push(row.id)
    byName.set(key, ids)
  }

  for (const [name, ids] of byName) {
    if (ids.length < 2) continue
    for (const rowId of ids) {
      warnings.push({
        rowId,
        stagingTable: 'staging_scholarships',
        errorType: 'same_batch_duplicate',
        errorMessage: `Same-batch duplicate: another row in this batch has the same name "${name}".`,
      })
    }
  }

  return warnings
}

export async function detectScholProductionMatches(
  supabase: SupabaseClient,
  rows: StagingScholRow[],
): Promise<QualityWarning[]> {
  const warnings: QualityWarning[] = []
  if (rows.length === 0) return warnings

  const nameToRowIds = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_name?.trim()) continue
    const key = normalizeForMatch(row.extracted_name)
    const ids = nameToRowIds.get(key) ?? []
    ids.push(row.id)
    nameToRowIds.set(key, ids)
  }

  const checks = await Promise.all(
    [...nameToRowIds.keys()].map(async normName => {
      const { data } = await supabase
        .from('scholarships')
        .select('id, name')
        .ilike('name', normName)
        .limit(1)
      return { normName, match: (data?.[0] as { id: string; name: string } | undefined) ?? null }
    }),
  )

  for (const { normName, match } of checks) {
    if (!match) continue
    for (const rowId of nameToRowIds.get(normName) ?? []) {
      warnings.push({
        rowId,
        stagingTable: 'staging_scholarships',
        errorType: 'possible_production_match',
        errorMessage: `Possible match: production scholarship "${match.name}" already exists.`,
      })
    }
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

type StagingArtRow = {
  id: string
  extracted_title: string | null
  extracted_slug: string | null
}

export function detectArtSameBatchDuplicates(rows: StagingArtRow[]): QualityWarning[] {
  const warnings: QualityWarning[] = []

  const bySlug = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_slug?.trim()) continue
    const key = row.extracted_slug.trim().toLowerCase()
    const ids = bySlug.get(key) ?? []
    ids.push(row.id)
    bySlug.set(key, ids)
  }
  for (const [slug, ids] of bySlug) {
    if (ids.length < 2) continue
    for (const rowId of ids) {
      warnings.push({
        rowId,
        stagingTable: 'staging_articles',
        errorType: 'same_batch_duplicate',
        errorMessage: `Same-batch duplicate: another row in this batch has the same slug "${slug}".`,
      })
    }
  }

  const byTitle = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_title?.trim()) continue
    const key = normalizeForMatch(row.extracted_title)
    const ids = byTitle.get(key) ?? []
    ids.push(row.id)
    byTitle.set(key, ids)
  }
  for (const [title, ids] of byTitle) {
    if (ids.length < 2) continue
    for (const rowId of ids) {
      if (warnings.some(w => w.rowId === rowId && w.errorType === 'same_batch_duplicate')) continue
      warnings.push({
        rowId,
        stagingTable: 'staging_articles',
        errorType: 'same_batch_duplicate',
        errorMessage: `Same-batch duplicate: another row in this batch has the same title "${title}".`,
      })
    }
  }

  return warnings
}

export async function detectArtProductionMatches(
  supabase: SupabaseClient,
  rows: StagingArtRow[],
): Promise<QualityWarning[]> {
  const warnings: QualityWarning[] = []
  if (rows.length === 0) return warnings

  const slugToRowIds = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_slug?.trim()) continue
    const key = row.extracted_slug.trim().toLowerCase()
    const ids = slugToRowIds.get(key) ?? []
    ids.push(row.id)
    slugToRowIds.set(key, ids)
  }

  const slugChecks = await Promise.all(
    [...slugToRowIds.keys()].map(async slug => {
      const { data } = await supabase
        .from('articles')
        .select('id, title, slug')
        .eq('slug', slug)
        .limit(1)
      return {
        slug,
        match: (data?.[0] as { id: string; title: string; slug: string } | undefined) ?? null,
      }
    }),
  )

  const warnedBySlug = new Set<string>()
  for (const { slug, match } of slugChecks) {
    if (!match) continue
    for (const rowId of slugToRowIds.get(slug) ?? []) {
      warnedBySlug.add(rowId)
      warnings.push({
        rowId,
        stagingTable: 'staging_articles',
        errorType: 'possible_production_match',
        errorMessage: `Possible match: production article "${match.title}" has the same slug "${match.slug}".`,
      })
    }
  }

  const titleToRowIds = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.extracted_title?.trim()) continue
    const key = normalizeForMatch(row.extracted_title)
    const ids = titleToRowIds.get(key) ?? []
    ids.push(row.id)
    titleToRowIds.set(key, ids)
  }

  const titleChecks = await Promise.all(
    [...titleToRowIds.keys()].map(async normTitle => {
      const { data } = await supabase
        .from('articles')
        .select('id, title')
        .ilike('title', normTitle)
        .limit(1)
      return { normTitle, match: (data?.[0] as { id: string; title: string } | undefined) ?? null }
    }),
  )

  for (const { normTitle, match } of titleChecks) {
    if (!match) continue
    for (const rowId of titleToRowIds.get(normTitle) ?? []) {
      if (warnedBySlug.has(rowId)) continue
      warnings.push({
        rowId,
        stagingTable: 'staging_articles',
        errorType: 'possible_production_match',
        errorMessage: `Possible match: production article "${match.title}" has the same title.`,
      })
    }
  }

  return warnings
}
