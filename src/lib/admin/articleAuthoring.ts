export const CONTENT_STATUS_OPTIONS = ['draft', 'in_review', 'published', 'unpublished', 'archived'] as const
export const VERIFICATION_OPTIONS = ['unverified', 'partially_verified', 'verified', 'source_conflict', 'outdated', 'needs_review'] as const
export const INDEXING_STATUS_OPTIONS = ['draft', 'index', 'noindex'] as const

export const CONTENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  published: 'Published',
  unpublished: 'Unpublished',
  archived: 'Archived',
}

export const VERIFICATION_LABELS: Record<string, string> = {
  unverified: 'Unverified',
  partially_verified: 'Partially Verified',
  verified: 'Verified',
  source_conflict: 'Source Conflict',
  outdated: 'Outdated',
  needs_review: 'Needs Review',
}

export const INDEXING_LABELS: Record<string, string> = {
  draft: 'Not set (draft)',
  index: 'Allow indexing',
  noindex: 'No-index',
}

export const WRITING_TEMPLATES: Record<string, string> = {
  'country-guide': '## Overview\n\n## Why Study Here?\n\n## Top Universities\n\n## Admission Requirements\n\n## Tuition and Living Costs\n\n## Visa Requirements\n\n## Student Life\n\n## Sources\n',
  'scholarship-guide': '## Overview\n\n## Who Can Apply?\n\n## Award Value\n\n## How to Apply\n\n## Key Deadlines\n\n## Tips for a Strong Application\n\n## Sources\n',
  'university-guide': '## About the University\n\n## Popular Programs\n\n## Admission Requirements\n\n## Tuition Fees\n\n## Campus Life\n\n## How to Apply\n\n## Sources\n',
  'application-advice': '## Before You Apply\n\n## Step-by-Step Process\n\n## Documents Required\n\n## Common Mistakes to Avoid\n\n## After You Apply\n\n## Sources\n',
  general: '## Introduction\n\n## Key Points\n\n## What to Know\n\n## Next Steps\n\n## Sources\n',
}

export const TITLE_SOFT_MAX = 70
export const SUMMARY_IDEAL_MIN = 120
export const SUMMARY_IDEAL_MAX = 155
export const SEO_TITLE_IDEAL_MIN = 45
export const SEO_TITLE_IDEAL_MAX = 60
export const SEO_DESCRIPTION_IDEAL_MIN = 120
export const SEO_DESCRIPTION_IDEAL_MAX = 160
export const MIN_BODY_WORDS = 200
export const WORDS_PER_MINUTE = 200

export type ArticleEditorValues = {
  title: string
  slug: string
  content_status: string
  article_category_id: string
  summary: string
  content: string
  indexing_status: string
  verification_status: string
  featured_image_id: string
  og_image_id: string
  seo_title: string
  seo_description: string
  seo_h1: string
  canonical_url: string
  og_title: string
  og_description: string
}

export type ArticleCategoryOption = {
  id: string
  name: string
  slug: string
}

export type ArticleLengthState = 'empty' | 'short' | 'good' | 'long'
export type ArticleChecklistState = 'ready' | 'needs_attention' | 'missing'
export type ArticleReadinessLevel = 'ready_to_publish' | 'strong_draft' | 'needs_polish' | 'early_draft'

export type ArticleChecklistKey =
  | 'title'
  | 'slug'
  | 'summary'
  | 'body'
  | 'featured_image'
  | 'seo_title'
  | 'seo_description'
  | 'indexing'
  | 'verification'

export interface ArticleLengthInfo {
  count: number
  label: string
  state: ArticleLengthState
}

export interface ArticleChecklistItem {
  key: ArticleChecklistKey
  label: string
  detail: string
  state: ArticleChecklistState
}

export interface ArticleReadinessSummary {
  level: ArticleReadinessLevel
  label: string
  missingCount: number
  needsAttentionCount: number
  readyCount: number
  score: number
  total: number
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stateFromRecommendedLength(
  count: number,
  recommendedMin: number,
  recommendedMax: number,
): ArticleLengthState {
  if (count === 0) return 'empty'
  if (count > recommendedMax) return 'long'
  if (count < recommendedMin) return 'short'
  return 'good'
}

function verificationChecklistState(status: string): ArticleChecklistState {
  if (status === 'verified' || status === 'partially_verified') return 'ready'
  if (normalizeText(status)) return 'needs_attention'
  return 'missing'
}

function indexingChecklistState(status: string): ArticleChecklistState {
  if (status === 'index' || status === 'noindex') return 'ready'
  if (normalizeText(status)) return 'needs_attention'
  return 'missing'
}

export function countWords(value: string | null | undefined): number {
  const text = normalizeText(value)
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

export function estimateReadingTimeMinutes(wordCount: number): number {
  if (wordCount <= 0) return 0
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE))
}

export function countMarkdownHeadings(value: string | null | undefined): number {
  const text = normalizeText(value)
  if (!text) return 0

  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(line => /^#{1,6}\s+\S/.test(line.trim()))
    .length
}

export function getSummaryLengthState(summary: string | null | undefined): ArticleLengthInfo {
  const count = normalizeText(summary).length
  const state = stateFromRecommendedLength(count, SUMMARY_IDEAL_MIN, SUMMARY_IDEAL_MAX)

  if (state === 'empty') return { count, state, label: 'Add a 2-3 sentence summary.' }
  if (state === 'short') return { count, state, label: 'A little short for listings and meta fallback.' }
  if (state === 'long') return { count, state, label: 'Trim this to keep cards and snippets tighter.' }
  return { count, state, label: 'Good length for cards and search fallback.' }
}

export function getSeoTitleLengthState(title: string | null | undefined): ArticleLengthInfo {
  const count = normalizeText(title).length
  const state = stateFromRecommendedLength(count, SEO_TITLE_IDEAL_MIN, SEO_TITLE_IDEAL_MAX)

  if (state === 'empty') return { count, state, label: 'Blank uses the article title.' }
  if (state === 'short') return { count, state, label: 'Readable, but a bit short for a target keyword.' }
  if (state === 'long') return { count, state, label: 'Long titles may truncate in search results.' }
  return { count, state, label: 'Strong range for a search result title.' }
}

export function getSeoDescriptionLengthState(description: string | null | undefined): ArticleLengthInfo {
  const count = normalizeText(description).length
  const state = stateFromRecommendedLength(count, SEO_DESCRIPTION_IDEAL_MIN, SEO_DESCRIPTION_IDEAL_MAX)

  if (state === 'empty') return { count, state, label: 'Blank uses the article summary.' }
  if (state === 'short') return { count, state, label: 'Add a bit more context for search snippets.' }
  if (state === 'long') return { count, state, label: 'Too long for a clean search snippet.' }
  return { count, state, label: 'Strong range for a search snippet.' }
}

export function getPublicGuidePath(slug: string | null | undefined): string {
  const cleanSlug = normalizeText(slug)
  return cleanSlug ? `/guides/${cleanSlug}` : '/guides/...'
}

export function calculateArticleChecklist(values: ArticleEditorValues): ArticleChecklistItem[] {
  const title = normalizeText(values.title)
  const slug = normalizeText(values.slug)
  const summary = normalizeText(values.summary)
  const bodyWordCount = countWords(values.content)
  const featuredImageId = normalizeText(values.featured_image_id)
  const seoTitle = normalizeText(values.seo_title)
  const seoDescription = normalizeText(values.seo_description)

  return [
    {
      key: 'title',
      label: 'Title present',
      state: title ? 'ready' : 'missing',
      detail: title || 'Add a clear title for the guide.',
    },
    {
      key: 'slug',
      label: 'Slug present',
      state: slug ? 'ready' : 'missing',
      detail: slug ? getPublicGuidePath(slug) : 'Add a slug for the public guide URL.',
    },
    {
      key: 'summary',
      label: 'Summary present',
      state: summary ? 'ready' : 'missing',
      detail: summary ? 'Summary is available for cards and fallback meta.' : 'Add a short summary for cards and search fallback.',
    },
    {
      key: 'body',
      label: 'Body meets minimum length',
      state: bodyWordCount >= MIN_BODY_WORDS ? 'ready' : bodyWordCount > 0 ? 'needs_attention' : 'missing',
      detail: bodyWordCount >= MIN_BODY_WORDS
        ? `${bodyWordCount} words.`
        : bodyWordCount > 0
          ? `${bodyWordCount} words. Aim for at least ${MIN_BODY_WORDS}.`
          : `Start writing. Aim for at least ${MIN_BODY_WORDS} words.`,
    },
    {
      key: 'featured_image',
      label: 'Featured image present',
      state: featuredImageId ? 'ready' : 'missing',
      detail: featuredImageId ? 'Featured image selected.' : 'Add a featured image for guide cards and the header.',
    },
    {
      key: 'seo_title',
      label: 'SEO title present',
      state: seoTitle ? 'ready' : 'needs_attention',
      detail: seoTitle ? 'Custom SEO title set.' : 'Optional, but recommended. Blank falls back to the article title.',
    },
    {
      key: 'seo_description',
      label: 'SEO description present',
      state: seoDescription ? 'ready' : 'needs_attention',
      detail: seoDescription ? 'Custom SEO description set.' : 'Optional, but recommended. Blank falls back to the summary.',
    },
    {
      key: 'indexing',
      label: 'Indexing chosen',
      state: indexingChecklistState(values.indexing_status),
      detail: INDEXING_LABELS[values.indexing_status] ?? 'Choose how search engines should handle this guide.',
    },
    {
      key: 'verification',
      label: 'Verification reviewed',
      state: verificationChecklistState(values.verification_status),
      detail: VERIFICATION_LABELS[values.verification_status] ?? 'Select a verification state for editorial review.',
    },
  ]
}

export function getArticleReadiness(checklist: ArticleChecklistItem[]): ArticleReadinessSummary {
  const total = checklist.length
  const readyCount = checklist.filter(item => item.state === 'ready').length
  const needsAttentionCount = checklist.filter(item => item.state === 'needs_attention').length
  const missingCount = checklist.filter(item => item.state === 'missing').length
  const rawScore = checklist.reduce((sum, item) => {
    if (item.state === 'ready') return sum + 1
    if (item.state === 'needs_attention') return sum + 0.5
    return sum
  }, 0)

  const score = total === 0 ? 0 : Math.round((rawScore / total) * 100)

  if (score >= 85) {
    return {
      level: 'ready_to_publish',
      label: 'Ready to publish',
      missingCount,
      needsAttentionCount,
      readyCount,
      score,
      total,
    }
  }

  if (score >= 65) {
    return {
      level: 'strong_draft',
      label: 'Strong draft',
      missingCount,
      needsAttentionCount,
      readyCount,
      score,
      total,
    }
  }

  if (score >= 35) {
    return {
      level: 'needs_polish',
      label: 'Needs polish',
      missingCount,
      needsAttentionCount,
      readyCount,
      score,
      total,
    }
  }

  return {
    level: 'early_draft',
    label: 'Early draft',
    missingCount,
    needsAttentionCount,
    readyCount,
    score,
    total,
  }
}
