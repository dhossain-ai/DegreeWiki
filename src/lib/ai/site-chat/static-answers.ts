import type { SupabaseClient } from '@supabase/supabase-js'

export type SiteStaticAnswerAudience = 'all' | 'anonymous' | 'authenticated'
export type SiteStaticAnswerMatchType = 'exact' | 'keyword' | 'hybrid'
export type SiteStaticAnswerMatchSource = 'question' | 'alias' | 'keyword'

type StaticAnswerRow = {
  id: string
  question: string
  question_normalized: string
  answer: string
  category: string
  keywords_json: unknown
  aliases_json: unknown
  audience: SiteStaticAnswerAudience
  locale: string
  priority: number
  match_type: SiteStaticAnswerMatchType
}

export interface FindStaticSiteAnswerOptions {
  authenticated: boolean
  locale: string
}

export interface StaticSiteAnswerMatch {
  id: string
  answer: string
  category: string
  locale: string
  audience: SiteStaticAnswerAudience
  priority: number
  matchType: SiteStaticAnswerMatchType
  matchSource: SiteStaticAnswerMatchSource
  keywordHits: number
}

const NOISE_RE = /[^a-z0-9\s]+/gi
const MULTISPACE_RE = /\s+/g

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const items: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    items.push(trimmed)
  }
  return items
}

function keywordHits(messageNormalized: string, keywords: string[]): number {
  const haystack = ` ${messageNormalized} `
  let hits = 0

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeQuestion(keyword)
    if (!normalizedKeyword) continue
    if (haystack.includes(` ${normalizedKeyword} `)) {
      hits++
    }
  }

  return hits
}

function audienceRank(audience: SiteStaticAnswerAudience, authenticated: boolean): number {
  if (authenticated) {
    return audience === 'authenticated' ? 0 : 1
  }
  return audience === 'anonymous' ? 0 : 1
}

function exactSort(
  left: StaticAnswerRow,
  right: StaticAnswerRow,
  authenticated: boolean,
): number {
  if (left.priority !== right.priority) return left.priority - right.priority

  const audienceDiff = audienceRank(left.audience, authenticated) - audienceRank(right.audience, authenticated)
  if (audienceDiff !== 0) return audienceDiff

  return left.id.localeCompare(right.id)
}

function keywordSort(
  left: { row: StaticAnswerRow; hits: number },
  right: { row: StaticAnswerRow; hits: number },
  authenticated: boolean,
): number {
  if (left.row.priority !== right.row.priority) return left.row.priority - right.row.priority
  if (left.hits !== right.hits) return right.hits - left.hits

  const audienceDiff = audienceRank(left.row.audience, authenticated) - audienceRank(right.row.audience, authenticated)
  if (audienceDiff !== 0) return audienceDiff

  return left.row.id.localeCompare(right.row.id)
}

export function normalizeQuestion(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(NOISE_RE, ' ')
    .replace(MULTISPACE_RE, ' ')
    .trim()
}

export async function findStaticSiteAnswer(
  supabase: SupabaseClient,
  message: string,
  options: FindStaticSiteAnswerOptions,
): Promise<StaticSiteAnswerMatch | null> {
  const normalizedMessage = normalizeQuestion(message)
  if (!normalizedMessage) return null

  const allowedAudiences: SiteStaticAnswerAudience[] = options.authenticated
    ? ['all', 'authenticated']
    : ['all', 'anonymous']

  const { data, error } = await supabase
    .from('ai_static_answers')
    .select(`
      id,
      question,
      question_normalized,
      answer,
      category,
      keywords_json,
      aliases_json,
      audience,
      locale,
      priority,
      match_type
    `)
    .eq('status', 'published')
    .eq('locale', options.locale)
    .in('audience', allowedAudiences)
    .order('priority', { ascending: true })
    .limit(500)

  if (error) {
    console.error('site static answers: query failed:', error.message)
    return null
  }

  const rows = (data ?? []) as StaticAnswerRow[]

  const exactMatches = rows
    .filter((row) => row.match_type === 'exact' || row.match_type === 'hybrid')
    .filter((row) => row.question_normalized === normalizedMessage)
    .sort((left, right) => exactSort(left, right, options.authenticated))

  if (exactMatches.length > 0) {
    const match = exactMatches[0]
    return {
      id: match.id,
      answer: match.answer,
      category: match.category,
      locale: match.locale,
      audience: match.audience,
      priority: match.priority,
      matchType: match.match_type,
      matchSource: 'question',
      keywordHits: 0,
    }
  }

  const aliasMatches = rows
    .filter((row) => row.match_type === 'exact' || row.match_type === 'hybrid')
    .filter((row) => {
      const aliases = readStringArray(row.aliases_json)
      return aliases.some((alias) => normalizeQuestion(alias) === normalizedMessage)
    })
    .sort((left, right) => exactSort(left, right, options.authenticated))

  if (aliasMatches.length > 0) {
    const match = aliasMatches[0]
    return {
      id: match.id,
      answer: match.answer,
      category: match.category,
      locale: match.locale,
      audience: match.audience,
      priority: match.priority,
      matchType: match.match_type,
      matchSource: 'alias',
      keywordHits: 0,
    }
  }

  const keywordMatches = rows
    .filter((row) => row.match_type === 'keyword' || row.match_type === 'hybrid')
    .map((row) => ({ row, hits: keywordHits(normalizedMessage, readStringArray(row.keywords_json)) }))
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => keywordSort(left, right, options.authenticated))

  if (keywordMatches.length === 0) return null

  const match = keywordMatches[0]
  return {
    id: match.row.id,
    answer: match.row.answer,
    category: match.row.category,
    locale: match.row.locale,
    audience: match.row.audience,
    priority: match.row.priority,
    matchType: match.row.match_type,
    matchSource: 'keyword',
    keywordHits: match.hits,
  }
}
