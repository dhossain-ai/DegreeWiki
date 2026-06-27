// SERVER-ONLY. Authenticated JSON API endpoint that generates (or returns a
// cached) AI summary for a saved Fit Finder result.
//
// POST /api/ai/finder-summary
//   Body: { finder_result_id: string }
//   Success (cached):   { ok: true, ai_explanation: string, cached: true }
//   Success (generated):{ ok: true, ai_explanation: string, cached: false }
//   Unavailable:        { ok: false, error: 'ai_unavailable' } (+ dev-only safe detail)
//   Errors: 400, 401, 404
//
// Caching/quota contract:
//   - If ai_explanation already exists, return it WITHOUT calling the provider.
//   - The provider is only called when a saved result exists and lacks a summary.
//   - A provider failure NEVER marks the result failed and triggers no retry loop
//     (the client fetches once; a cached value short-circuits future calls).
//
// Ownership is verified with the authenticated SSR client (RLS). The summary
// write uses the service role inside updateFinderSummary — never in this file.
import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase/server'
import { callAI } from '../../../lib/ai/gateway'
import { getAIEnv } from '../../../lib/ai/env'
import { updateFinderSummary } from '../../../lib/ai/finder/persist'
import { sanitizeAIExplanation } from '../../../lib/ai/finder/sanitize'
import type { AIContext, StudentProfileSummary } from '../../../lib/ai/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function formatTuition(p: any): string | null {
  if (p.tuition_min_amount == null && p.tuition_max_amount == null) return null
  const fmt = (n: number) => Number(n).toLocaleString()
  const range =
    p.tuition_min_amount != null && p.tuition_max_amount != null
      ? `${fmt(p.tuition_min_amount)} - ${fmt(p.tuition_max_amount)}`
      : p.tuition_min_amount != null
        ? fmt(p.tuition_min_amount)
        : `up to ${fmt(p.tuition_max_amount)}`
  const period = p.tuition_period?.replace(/_/g, ' ') ?? ''
  return [p.tuition_currency, range, period].filter(Boolean).join(' ').trim()
}

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  // Parse and validate body.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_body' })
  }

  const resultId = (body as Record<string, unknown>)['finder_result_id']
  if (typeof resultId !== 'string' || !UUID_RE.test(resultId)) {
    return jsonResponse(400, { ok: false, error: 'invalid_request' })
  }

  // Authenticate. getUser() verifies the JWT with Supabase on every request.
  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return jsonResponse(401, { ok: false, error: 'unauthenticated' })
  }

  // Verify ownership via RLS-scoped SSR client. Returns no row if not found or
  // not owned. Reuse cached ai_explanation without touching the provider.
  const { data: result, error: resultError } = await supabase
    .from('ai_finder_results')
    .select('id, student_profile_id, ai_explanation')
    .eq('id', resultId)
    .maybeSingle()

  if (resultError) {
    console.error('finder-summary: ai_finder_results read error:', resultError.message)
    return jsonResponse(404, { ok: false, error: 'not_found' })
  }
  if (!result) {
    return jsonResponse(404, { ok: false, error: 'not_found' })
  }

  const existing = result.ai_explanation as string | null
  if (existing && existing.trim().length > 0) {
    return jsonResponse(200, {
      ok: true,
      ai_explanation: sanitizeAIExplanation(existing),
      cached: true,
    })
  }

  // Load the top matched programs for this result (RLS enforces ownership via
  // parent result). Uses the existing safe relationship names.
  const { data: matchRows, error: matchError } = await supabase
    .from('ai_finder_program_matches')
    .select(`
      rank, score, match_reasons, warnings,
      programs(
        title, official_url,
        tuition_min_amount, tuition_max_amount, tuition_currency, tuition_period,
        universities(name),
        countries(name),
        cities(name),
        degree_levels(name),
        subjects!programs_primary_subject_id_fkey(name)
      )
    `)
    .eq('ai_finder_result_id', result.id)
    .order('rank', { ascending: true })
    .limit(3)

  if (matchError) {
    console.error('finder-summary: ai_finder_program_matches read error:', matchError.message)
    return jsonResponse(404, { ok: false, error: 'not_found' })
  }

  const matches = (matchRows ?? []).filter((m: any) => m.programs)
  if (matches.length === 0) {
    return jsonResponse(404, { ok: false, error: 'not_found' })
  }

  // Optional student profile summary for prompt context (best-effort, RLS-scoped).
  let studentProfile: StudentProfileSummary | undefined
  if (result.student_profile_id) {
    const [{ data: profile }, { data: subjectRows }, { data: countryRows }] = await Promise.all([
      supabase
        .from('student_profiles')
        .select('budget_min, budget_max, budget_currency, degree_levels(name)')
        .eq('id', result.student_profile_id)
        .maybeSingle(),
      supabase
        .from('student_profile_subjects')
        .select('subjects(name)')
        .eq('student_profile_id', result.student_profile_id),
      supabase
        .from('student_profile_countries')
        .select('countries(name)')
        .eq('student_profile_id', result.student_profile_id),
    ])

    if (profile) {
      const subjects = (subjectRows ?? []).map((r: any) => r.subjects?.name).filter(Boolean) as string[]
      const countries = (countryRows ?? []).map((r: any) => r.countries?.name).filter(Boolean) as string[]
      studentProfile = {
        degreeLevel:     (profile as any).degree_levels?.name ?? undefined,
        subjects:        subjects.length > 0 ? subjects : undefined,
        targetCountries: countries.length > 0 ? countries : undefined,
        budgetMin:       (profile as any).budget_min ?? undefined,
        budgetMax:       (profile as any).budget_max ?? undefined,
        currency:        (profile as any).budget_currency ?? undefined,
      }
    }
  }

  // Build the same finder context shape used by result.astro.
  const aiContext: AIContext = {
    source: 'programs',
    records: matches.map((m: any) => ({
      title:        m.programs.title,
      university:   m.programs.universities?.name ?? null,
      country:      m.programs.countries?.name ?? null,
      city:         m.programs.cities?.name ?? null,
      degreeLevel:  m.programs.degree_levels?.name ?? null,
      subject:      m.programs.subjects?.name ?? null,
      tuitionRange: formatTuition(m.programs),
      officialUrl:  m.programs.official_url ?? null,
      rank:         m.rank,
      matchReasons: Array.isArray(m.match_reasons) ? m.match_reasons : [],
      warnings:     Array.isArray(m.warnings) ? m.warnings : [],
    })),
    studentProfile,
  }

  const aiEnv = getAIEnv(locals as Record<string, unknown>)

  const aiResponse = await callAI(
    {
      useCase: 'fit_finder_summary',
      sessionType: 'finder',
      aiFinderResultId: result.id,
      userMessage: 'Explain the shortlisted programs for this student.',
      context: aiContext,
      userId: user.id,
    },
    aiEnv,
  )

  // Provider unavailable (rate limit, guardrail, provider error, missing key).
  // Do NOT mark the result failed; return a generic unavailable response.
  if (aiResponse.fallbackUsed || aiResponse.guardrailTripped || aiResponse.text.trim().length === 0) {
    const payload: Record<string, unknown> = { ok: false, error: 'ai_unavailable' }
    if (import.meta.env.DEV && aiResponse.failure) {
      // Safe diagnostics only — no prompts, no provider bodies, no secrets.
      payload.dev = aiResponse.failure
    }
    return jsonResponse(503, payload)
  }

  const cleaned = sanitizeAIExplanation(aiResponse.text)
  if (!cleaned) {
    return jsonResponse(503, { ok: false, error: 'ai_unavailable' })
  }

  // Store the summary via service role (inside updateFinderSummary). A storage
  // failure must not break the response — the user still gets the explanation.
  const stored = await updateFinderSummary(
    result.id,
    cleaned,
    aiResponse.modelUsed,
    { promptTokens: aiResponse.promptTokens, completionTokens: aiResponse.completionTokens },
    aiEnv,
  )
  if (!stored) {
    console.error('finder-summary: updateFinderSummary failed for result', result.id)
  }

  return jsonResponse(200, { ok: true, ai_explanation: cleaned, cached: false })
}
