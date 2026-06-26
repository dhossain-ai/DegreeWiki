import type { SupabaseClient } from '@supabase/supabase-js'

type ProgramDuplicateSource = {
  id: string
  title: string
  university_id: string
  degree_level_id: string
}

type ProgramDeleteSummary = {
  dataSources: number
  savedItems: number
  userReports: number
  verificationEvents: number
  dataQualityChecks: number
  scholarshipLinks: number
}

export type ProgramDeletePreflight = {
  programId: string
  blockingReasons: string[]
  cleanup: ProgramDeleteSummary
}

export function normalizeProgramDuplicateTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function getProgramDuplicateKey(program: Omit<ProgramDuplicateSource, 'id'>): string {
  return [
    program.university_id,
    program.degree_level_id,
    normalizeProgramDuplicateTitle(program.title),
  ].join('::')
}

export function buildProgramDuplicateGroupIndex(programs: ProgramDuplicateSource[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()

  for (const program of programs) {
    const key = getProgramDuplicateKey(program)
    const existing = groups.get(key)

    if (existing) {
      existing.push(program.id)
    } else {
      groups.set(key, [program.id])
    }
  }

  for (const [key, ids] of groups.entries()) {
    if (ids.length < 2) groups.delete(key)
  }

  return groups
}

function countByKey(rows: Array<Record<string, unknown>>, key: string): Map<string, number> {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const value = row[key]
    if (typeof value !== 'string' || !value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return counts
}

function countProgramEntityRows(rows: Array<Record<string, unknown>>): Map<string, number> {
  const counts = new Map<string, number>()

  for (const row of rows) {
    if (row.entity_type !== 'program') continue
    const entityId = row.entity_id
    if (typeof entityId !== 'string' || !entityId) continue
    counts.set(entityId, (counts.get(entityId) ?? 0) + 1)
  }

  return counts
}

export async function userIsSuperAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_role', { role_code: 'super_admin' })
  if (error) return false
  return data === true
}

export async function preflightProgramHardDelete(
  supabase: SupabaseClient,
  programIds: string[],
): Promise<ProgramDeletePreflight[]> {
  const ids = [...new Set(programIds.filter(Boolean))]
  if (ids.length === 0) return []

  const [
    aiMatchesRes,
    scholarshipLinksRes,
    analyticsEventsRes,
    outboundClicksRes,
    dataSourcesRes,
    savedItemsRes,
    userReportsRes,
    verificationEventsRes,
    dataQualityChecksRes,
  ] = await Promise.all([
    supabase.from('ai_finder_program_matches').select('program_id').in('program_id', ids),
    supabase.from('scholarship_programs').select('program_id').in('program_id', ids),
    supabase.from('analytics_events').select('entity_id, entity_type').eq('entity_type', 'program').in('entity_id', ids),
    supabase.from('outbound_clicks').select('entity_id, entity_type').eq('entity_type', 'program').in('entity_id', ids),
    supabase.from('data_sources').select('entity_id, entity_type').eq('entity_type', 'program').in('entity_id', ids),
    supabase.from('saved_items').select('entity_id, entity_type').eq('entity_type', 'program').in('entity_id', ids),
    supabase.from('user_reports').select('entity_id, entity_type').eq('entity_type', 'program').in('entity_id', ids),
    supabase.from('verification_events').select('entity_id, entity_type').eq('entity_type', 'program').in('entity_id', ids),
    supabase.from('data_quality_checks').select('entity_id, entity_type').eq('entity_type', 'program').in('entity_id', ids),
  ])

  const queryFailed = [
    aiMatchesRes,
    scholarshipLinksRes,
    analyticsEventsRes,
    outboundClicksRes,
    dataSourcesRes,
    savedItemsRes,
    userReportsRes,
    verificationEventsRes,
    dataQualityChecksRes,
  ].some(result => !!result.error)

  if (queryFailed) {
    return ids.map(programId => ({
      programId,
      blockingReasons: ['Could not verify delete safety for this program right now. Archive it instead.'],
      cleanup: {
        dataSources: 0,
        savedItems: 0,
        userReports: 0,
        verificationEvents: 0,
        dataQualityChecks: 0,
        scholarshipLinks: 0,
      },
    }))
  }

  const aiMatchCounts = countByKey((aiMatchesRes.data ?? []) as Array<Record<string, unknown>>, 'program_id')
  const scholarshipLinkCounts = countByKey((scholarshipLinksRes.data ?? []) as Array<Record<string, unknown>>, 'program_id')
  const analyticsCounts = countProgramEntityRows((analyticsEventsRes.data ?? []) as Array<Record<string, unknown>>)
  const outboundCounts = countProgramEntityRows((outboundClicksRes.data ?? []) as Array<Record<string, unknown>>)
  const dataSourceCounts = countProgramEntityRows((dataSourcesRes.data ?? []) as Array<Record<string, unknown>>)
  const savedItemCounts = countProgramEntityRows((savedItemsRes.data ?? []) as Array<Record<string, unknown>>)
  const userReportCounts = countProgramEntityRows((userReportsRes.data ?? []) as Array<Record<string, unknown>>)
  const verificationEventCounts = countProgramEntityRows((verificationEventsRes.data ?? []) as Array<Record<string, unknown>>)
  const dataQualityCheckCounts = countProgramEntityRows((dataQualityChecksRes.data ?? []) as Array<Record<string, unknown>>)

  return ids.map(programId => {
    const blockingReasons: string[] = []

    if ((aiMatchCounts.get(programId) ?? 0) > 0) {
      blockingReasons.push('Skipped because this program is referenced by AI Finder history. Archive it instead.')
    }

    if ((analyticsCounts.get(programId) ?? 0) > 0) {
      blockingReasons.push('Skipped because this program has analytics history in an immutable log. Archive it instead.')
    }

    if ((outboundCounts.get(programId) ?? 0) > 0) {
      blockingReasons.push('Skipped because this program has outbound click history in an immutable log. Archive it instead.')
    }

    return {
      programId,
      blockingReasons,
      cleanup: {
        dataSources: dataSourceCounts.get(programId) ?? 0,
        savedItems: savedItemCounts.get(programId) ?? 0,
        userReports: userReportCounts.get(programId) ?? 0,
        verificationEvents: verificationEventCounts.get(programId) ?? 0,
        dataQualityChecks: dataQualityCheckCounts.get(programId) ?? 0,
        scholarshipLinks: scholarshipLinkCounts.get(programId) ?? 0,
      },
    }
  })
}

export async function hardDeleteProgramById(
  supabase: SupabaseClient,
  programId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const deleteSteps = [
    () => supabase.from('scholarship_programs').delete().eq('program_id', programId),
    () => supabase.from('saved_items').delete().eq('entity_type', 'program').eq('entity_id', programId),
    () => supabase.from('user_reports').delete().eq('entity_type', 'program').eq('entity_id', programId),
    () => supabase.from('verification_events').delete().eq('entity_type', 'program').eq('entity_id', programId),
    () => supabase.from('data_quality_checks').delete().eq('entity_type', 'program').eq('entity_id', programId),
    () => supabase.from('data_sources').delete().eq('entity_type', 'program').eq('entity_id', programId),
    () => supabase.from('programs').delete().eq('id', programId),
  ]

  for (const step of deleteSteps) {
    const { error } = await step()
    if (error) {
      return { ok: false, message: 'Could not permanently delete this program safely. Archive it instead.' }
    }
  }

  return { ok: true }
}
