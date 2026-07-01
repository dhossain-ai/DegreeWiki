import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'

const MAX_QUERY_LENGTH = 80
const MAX_PER_GROUP = 5
const PROGRAM_CANDIDATE_LIMIT = 40
const LOOKUP_CANDIDATE_LIMIT = 24

type Suggestion = {
  label: string
  meta?: string
  href: string
  score: number
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function sanitizeLike(value: string): string {
  return normalize(value).replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreText(query: string, label: string, extras: Array<string | null | undefined> = []): number {
  const normalizedLabel = normalize(label)
  const haystack = [normalizedLabel, ...extras.map(normalize)].filter(Boolean).join(' ')
  const tokens = query.split(' ').filter(Boolean)

  if (!normalizedLabel || tokens.length === 0) return 0
  if (normalizedLabel === query) return 100
  if (normalizedLabel.startsWith(query)) return 92
  if (normalizedLabel.includes(query)) return 78
  if (haystack.includes(query)) return 68

  const allTokensMatch = tokens.every((token) => haystack.includes(token))
  if (allTokensMatch) return 58

  const prefixMatches = tokens.filter((token) =>
    haystack.split(' ').some((word) => word.startsWith(token)),
  ).length

  if (prefixMatches > 0) return 38 + prefixMatches * 5
  return 0
}

function sortAndCap(items: Suggestion[]): Omit<Suggestion, 'score'>[] {
  return items
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, MAX_PER_GROUP)
    .map(({ score, ...item }) => item)
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  })
}

export const GET: APIRoute = async ({ url }) => {
  const rawQuery = url.searchParams.get('q') ?? ''
  const query = normalize(rawQuery).slice(0, MAX_QUERY_LENGTH)
  const likeQuery = sanitizeLike(query)

  const emptySuggestions = {
    programs: [],
    subjects: [],
    universities: [],
    destinations: [],
  }

  if (likeQuery.length < 2) {
    return json({ ok: true, query, suggestions: emptySuggestions })
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ ok: false, error: 'search_unavailable', suggestions: emptySuggestions }, 503)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })

  const like = `%${likeQuery}%`

  const [
    { data: programRows, error: programError },
    { data: subjectRows, error: subjectError },
    { data: universityRows, error: universityError },
    { data: destinationRows, error: destinationError },
  ] = await Promise.all([
    supabase
      .from('programs')
      .select(`
        id, title, slug, language_of_instruction, degree_award,
        universities(name),
        degree_levels(name, code),
        subjects!programs_primary_subject_id_fkey(name),
        countries(name)
      `)
      .eq('content_status', 'published')
      .or(`title.ilike.${like},language_of_instruction.ilike.${like},degree_award.ilike.${like}`)
      .order('title')
      .limit(PROGRAM_CANDIDATE_LIMIT),
    supabase
      .from('subjects')
      .select('id, name')
      .ilike('name', like)
      .order('name')
      .limit(LOOKUP_CANDIDATE_LIMIT),
    supabase
      .from('universities')
      .select('id, name')
      .eq('content_status', 'published')
      .ilike('name', like)
      .order('name')
      .limit(LOOKUP_CANDIDATE_LIMIT),
    supabase
      .from('countries')
      .select('id, name')
      .eq('content_status', 'published')
      .eq('is_destination_enabled', true)
      .ilike('name', like)
      .order('name')
      .limit(LOOKUP_CANDIDATE_LIMIT),
  ])

  if (programError) console.error('search suggestions programs error:', programError.message)
  if (subjectError) console.error('search suggestions subjects error:', subjectError.message)
  if (universityError) console.error('search suggestions universities error:', universityError.message)
  if (destinationError) console.error('search suggestions destinations error:', destinationError.message)

  const programs = sortAndCap((programRows ?? []).map((program: any) => {
    const universityName = program.universities?.name ?? null
    const countryName = program.countries?.name ?? null
    const subjectName = program.subjects?.name ?? null
    const degreeName = program.degree_levels?.name ?? null
    const degreeCode = program.degree_levels?.code ?? null
    const meta = [universityName, countryName].filter(Boolean).join(' · ')

    return {
      label: program.title,
      meta,
      href: `/programs/${program.slug}`,
      score: scoreText(likeQuery, program.title, [
        universityName,
        countryName,
        subjectName,
        degreeName,
        degreeCode,
        program.degree_award,
        program.language_of_instruction,
      ]),
    }
  }))

  const subjects = sortAndCap((subjectRows ?? []).map((subject: any) => ({
    label: subject.name,
    meta: 'Field of study',
    href: `/programs?subject=${encodeURIComponent(subject.id)}`,
    score: scoreText(likeQuery, subject.name),
  })))

  const universities = sortAndCap((universityRows ?? []).map((university: any) => ({
    label: university.name,
    meta: 'University',
    href: `/programs?university=${encodeURIComponent(university.id)}`,
    score: scoreText(likeQuery, university.name),
  })))

  const destinations = sortAndCap((destinationRows ?? []).map((destination: any) => ({
    label: destination.name,
    meta: 'Destination',
    href: `/programs?country=${encodeURIComponent(destination.id)}`,
    score: scoreText(likeQuery, destination.name),
  })))

  return json({
    ok: true,
    query,
    suggestions: {
      programs,
      subjects,
      universities,
      destinations,
    },
  })
}
