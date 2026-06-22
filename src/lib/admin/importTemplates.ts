export type EntityTemplateType = 'universities' | 'programs' | 'scholarships' | 'articles'

export const IMPORT_TEMPLATES: Record<EntityTemplateType, string> = {
  universities: `[
  {
    "name": "University of Example",
    "country_code": "FI",
    "official_url": "https://example.fi"
  }
]`,
  programs: `[
  {
    "title": "MSc Computer Science",
    "degree_level_code": "msc",
    "language": "English",
    "tuition_amount": 15000,
    "deadline": "2026-09-01",
    "staging_university_id": "<paste UUID from Staged Universities in this batch>"
  }
]`,
  scholarships: `[
  {
    "name": "Global Excellence Award",
    "amount": 5000,
    "deadline": "2026-05-01"
  }
]`,
  articles: `[
  {
    "title": "How to Study Abroad",
    "slug": "how-to-study-abroad",
    "category": "guides",
    "content": "Article body text..."
  }
]`,
}

export const TEMPLATE_FIELD_NOTES: Record<EntityTemplateType, Array<{ field: string; required: boolean; note: string }>> = {
  universities: [
    { field: 'name', required: true, note: 'Official full name of the university' },
    { field: 'country_code', required: true, note: '2-letter ISO 3166-1 alpha-2 code (e.g. FI, US, GB, DE)' },
    { field: 'official_url', required: false, note: 'Homepage URL — must start with https://' },
  ],
  programs: [
    { field: 'title', required: true, note: 'Full program name as listed officially' },
    { field: 'degree_level_code', required: true, note: 'Code from degree_levels table — bsc, ba, msc, ma, mba, llm, md, phd, other' },
    { field: 'language', required: false, note: 'Primary language of instruction (e.g. English, Finnish)' },
    { field: 'tuition_amount', required: false, note: 'Annual tuition as a plain number — no currency symbol or commas' },
    { field: 'deadline', required: false, note: 'Application deadline in YYYY-MM-DD format; null if rolling or unspecified' },
    { field: 'staging_university_id', required: false, note: 'UUID of a staged university in this same batch — required for merge. Must be in the JSON at import time; cannot be set via UI after bulk import. Import universities first, then paste each university\'s staging UUID here.' },
  ],
  scholarships: [
    { field: 'name', required: true, note: 'Official scholarship name' },
    { field: 'amount', required: false, note: 'Award amount as a plain number — no currency symbol' },
    { field: 'deadline', required: false, note: 'Application deadline in YYYY-MM-DD format' },
  ],
  articles: [
    { field: 'title', required: true, note: 'Article title as it should appear on the site' },
    { field: 'slug', required: true, note: 'URL slug — lowercase letters, digits, hyphens only (e.g. how-to-apply)' },
    { field: 'category', required: false, note: 'Category key (e.g. guides, scholarships, news, universities)' },
    { field: 'content', required: false, note: 'Full article body text — plain text or Markdown' },
  ],
}
