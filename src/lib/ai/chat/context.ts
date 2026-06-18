// SERVER-ONLY. Never import this file from browser code, client components,
// Astro component scripts, or any file that runs in the browser.
//
// Loads a saved Fit Finder result for the current user and assembles a compact
// ChatResultContext suitable for use in a saved-result-bound chat prompt.
//
// Uses the caller's authenticated SSR Supabase client — RLS enforces ownership.
// If the result does not exist or does not belong to the authenticated user,
// the query returns no data and this function returns null.
// No service role is used here. No other user's data can be accessed.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatResultContext, ChatResultProgram } from '../types'

// Maximum number of programs to include in chat context.
// Keeps prompt token usage bounded and focuses the chat on the most relevant matches.
const MAX_PROGRAMS_IN_CONTEXT = 10

function formatTuition(p: {
  tuition_min_amount: number | null
  tuition_max_amount: number | null
  tuition_currency: string | null
  tuition_period: string | null
}): string | null {
  if (p.tuition_min_amount == null && p.tuition_max_amount == null) return null
  const fmt = (n: number) => Number(n).toLocaleString()
  const range =
    p.tuition_min_amount != null && p.tuition_max_amount != null
      ? `${fmt(p.tuition_min_amount)} - ${fmt(p.tuition_max_amount)}`
      : p.tuition_min_amount != null
        ? fmt(p.tuition_min_amount)
        : `up to ${fmt(p.tuition_max_amount!)}`
  const period = p.tuition_period?.replace(/_/g, ' ') ?? ''
  return [p.tuition_currency, range, period].filter(Boolean).join(' ').trim() || null
}

// loadChatContext loads the saved Fit Finder result identified by resultId and
// builds a ChatResultContext from the matched programs.
//
// Returns null when:
//   - The result does not exist or belongs to another user (RLS returns no data)
//   - The result_status is not 'complete' (result is not usable for chat)
//   - Any query fails (error is logged server-side)
//
// The caller must pass an authenticated SSR Supabase client created from
// the user's session cookies. RLS enforces that only the result owner sees data.
export async function loadChatContext(
  resultId: string,
  supabase: SupabaseClient,
): Promise<ChatResultContext | null> {
  const { data: result, error: resultError } = await supabase
    .from('ai_finder_results')
    .select('id, result_status')
    .eq('id', resultId)
    .maybeSingle()

  if (resultError) {
    console.error('chat context: ai_finder_results read error:', resultError.message)
    return null
  }

  if (!result) return null

  if (result.result_status !== 'complete') return null

  const { data: matchRows, error: matchError } = await supabase
    .from('ai_finder_program_matches')
    .select(`
      rank, match_reasons, warnings,
      programs(
        title, official_url,
        tuition_min_amount, tuition_max_amount, tuition_currency, tuition_period,
        universities(name),
        countries(name),
        cities(name),
        degree_levels(name),
        subjects(name)
      )
    `)
    .eq('ai_finder_result_id', resultId)
    .order('rank', { ascending: true })
    .limit(MAX_PROGRAMS_IN_CONTEXT)

  if (matchError) {
    console.error('chat context: ai_finder_program_matches read error:', matchError.message)
    return null
  }

  const programs: ChatResultProgram[] = (matchRows ?? []).flatMap((row: any) => {
    const p = row.programs
    if (!p) return []

    const matchReasons: string[] = Array.isArray(row.match_reasons) ? row.match_reasons : []
    const warnings: string[] = Array.isArray(row.warnings) ? row.warnings : []

    return [{
      rank:          row.rank as number,
      title:         (p.title as string) ?? null,
      university:    p.universities?.name ?? null,
      country:       p.countries?.name ?? null,
      city:          p.cities?.name ?? null,
      degreeLevel:   p.degree_levels?.name ?? null,
      subject:       p.subjects?.name ?? null,
      tuitionSummary: formatTuition(p),
      officialUrl:   (p.official_url as string | null) ?? null,
      matchReasons,
      warnings,
    } satisfies ChatResultProgram]
  })

  return {
    resultId,
    programs,
  }
}
