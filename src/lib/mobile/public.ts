import { createClient } from '@supabase/supabase-js'
import { cloudinaryUrl } from '../cloudinary/url'

type JsonHeaders = {
  'Content-Type': string
}

const JSON_HEADERS: JsonHeaders = {
  'Content-Type': 'application/json',
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  })
}

export function createPublicMobileClient() {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
}

export function credentialsErrorResponse(): Response {
  return jsonResponse(503, { ok: false, error: 'mobile_api_unavailable' })
}

export function notFoundResponse(error = 'not_found'): Response {
  return jsonResponse(404, { ok: false, error })
}

export function internalErrorResponse(error = 'mobile_api_unavailable'): Response {
  return jsonResponse(500, { ok: false, error })
}

export function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatLongDate(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatEnumLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function formatDuration(months: number | null | undefined): string | null {
  if (!months) return null
  if (months === 12) return '1 year'
  if (months % 12 === 0) return `${months / 12} years`
  return `${months} months`
}

export function formatMode(value: string | null | undefined): string | null {
  if (!value) return null
  return value.replace(/_/g, ' ')
}

export function abbreviateDegree(code: string | null | undefined, name: string | null | undefined): string | null {
  if (!code && !name) return null
  const normalizedCode = (code ?? '').toLowerCase()
  const normalizedName = (name ?? '').toLowerCase()

  if (normalizedCode === 'phd' || normalizedCode === 'doctorate' || normalizedName.includes('phd') || normalizedName.includes('doctor')) return 'PhD'
  if (normalizedCode === 'mba' || normalizedName.includes('mba')) return 'MBA'
  if (normalizedCode === 'master' || normalizedName.includes('master')) return 'MSc'
  if (normalizedCode === 'bachelor' || normalizedName.includes('bachelor')) return 'BSc'
  if (normalizedCode === 'postgraduate' || normalizedName.includes('postgraduate')) return 'PG'

  if (name) {
    const firstWord = name.split(' ')[0]
    return firstWord || name
  }

  return null
}

export function moneyPrefix(currency: string | null | undefined): string {
  const normalizedCurrency = (currency ?? '').toUpperCase()
  if (normalizedCurrency === 'EUR') return '€'
  if (normalizedCurrency === 'USD') return '$'
  if (normalizedCurrency === 'GBP') return '£'
  return normalizedCurrency ? `${normalizedCurrency} ` : ''
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount == null) return null
  return `${moneyPrefix(currency)}${Number(amount).toLocaleString()}`
}

export function formatRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  suffix: string,
): string | null {
  if (min == null && max == null) return null

  const prefix = moneyPrefix(currency)
  const formatAmount = (value: number) => `${prefix}${Number(value).toLocaleString()}`

  if (min != null && max != null) {
    if (min === max) return `${formatAmount(min)} ${suffix}`.trimEnd()
    return `${formatAmount(min)} - ${formatAmount(max)} ${suffix}`.trimEnd()
  }

  if (min != null) return `From ${formatAmount(min)} ${suffix}`.trimEnd()
  return `Up to ${formatAmount(max!)} ${suffix}`.trimEnd()
}

export function formatTuitionSummary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  period: string | null | undefined,
): { display: string | null; detail: string | null } {
  if (min == null && max == null) {
    return { display: null, detail: null }
  }

  const formatAmount = (value: number) => `${moneyPrefix(currency)}${Number(value).toLocaleString()}`
  const display = min != null && max != null && min !== max
    ? `${formatAmount(min)}–${formatAmount(max)}`
    : formatAmount(min ?? max!)
  const detail = period ? `per ${period.replace(/_/g, ' ')}` : 'per year'

  return { display, detail }
}

export function formatLocation(city: string | null | undefined, country: string | null | undefined): string | null {
  const location = [city, country].filter(Boolean).join(', ')
  return location || null
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function formatIntakeLabel(intake: {
  intake_name?: string | null
  intake_month?: number | string | null
  intake_year?: number | null
}): string | null {
  if (intake.intake_name) return intake.intake_name

  const monthValue = intake.intake_month
  const monthLabel = typeof monthValue === 'number'
    ? MONTH_NAMES[monthValue - 1] ?? null
    : monthValue
      ? String(monthValue)
      : null
  const yearLabel = intake.intake_year ? String(intake.intake_year) : null

  if (!monthLabel && !yearLabel) return null
  return [monthLabel, yearLabel].filter(Boolean).join(' ')
}

export type EnglishRequirementEntry = {
  test: string
  details: string
}

export function formatEnglishRequirements(reqs: unknown): EnglishRequirementEntry[] | null {
  if (!reqs) return null

  if (typeof reqs === 'string') {
    return [{ test: 'Requirement', details: reqs }]
  }

  if (Array.isArray(reqs)) {
    const values = reqs.map((item) => String(item).trim()).filter(Boolean)
    return values.length > 0 ? [{ test: 'Requirement', details: values.join(' · ') }] : null
  }

  if (typeof reqs !== 'object') {
    return [{ test: 'Requirement', details: String(reqs) }]
  }

  const entries = Object.entries(reqs as Record<string, unknown>)
  if (entries.length === 0) return null

  return entries.map(([test, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const details = Object.entries(value as Record<string, unknown>)
        .map(([key, innerValue]) => `${key.replace(/_/g, ' ')}: ${innerValue}`)
        .join(' · ')

      return {
        test: test.toUpperCase(),
        details,
      }
    }

    return {
      test: test.toUpperCase(),
      details: String(value),
    }
  })
}

export function teaserFromText(value: string | null | undefined, maxLength = 180): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null

  const firstParagraph = normalized
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .find(Boolean)

  if (!firstParagraph) return null
  if (firstParagraph.length <= maxLength) return firstParagraph

  const slice = firstParagraph.slice(0, maxLength)
  const trimmed = slice.includes(' ') ? slice.slice(0, slice.lastIndexOf(' ')) : slice
  return `${trimmed.trimEnd()}...`
}

export function confidenceLabel(score: number | null | undefined): string | null {
  if (score == null) return null
  if (score >= 75) return `High (${score}/100)`
  if (score >= 40) return `Medium (${score}/100)`
  return `Low (${score}/100)`
}

export function buildCloudinaryImageUrl(
  cloudName: string | undefined,
  publicId: string | null | undefined,
): string | null {
  if (!cloudName || !publicId) return null
  return cloudinaryUrl(cloudName, publicId)
}

export function normalizeFaq(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []

    const question = typeof (entry as Record<string, unknown>).question === 'string'
      ? (entry as Record<string, string>).question.trim()
      : ''
    const answer = typeof (entry as Record<string, unknown>).answer === 'string'
      ? (entry as Record<string, string>).answer.trim()
      : ''

    return question && answer ? [{ question, answer }] : []
  })
}
