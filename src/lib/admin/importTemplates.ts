export type EntityTemplateType = 'universities' | 'programs' | 'scholarships' | 'articles' | 'research_pack'

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
    "degree_level_code": "master",
    "degree_award": "Master of Science",
    "primary_subject": "Computer Science",
    "language_of_instruction": "English",
    "study_mode": "full_time",
    "delivery_mode": "on_campus",
    "duration_months": 24,
    "tuition_min_amount": 15000,
    "tuition_max_amount": 18000,
    "tuition_currency": "EUR",
    "tuition_period": "per_year",
    "tuition_notes": null,
    "application_fee_amount": 75,
    "application_fee_currency": "EUR",
    "application_fee_notes": null,
    "official_program_url": "https://example.fi/programs/computer-science",
    "official_application_url": "https://apply.example.fi/programs/computer-science",
    "admission_requirements_text": "Bachelor degree in a relevant field.",
    "gpa_requirements_text": "Minimum 3.0 GPA",
    "english_requirements_text": "IELTS 6.5 overall",
    "ielts_min_score": 6.5,
    "curriculum_or_modules_text": "Core modules in algorithms, systems, and AI.",
    "career_outcomes_text": "Software engineer, data engineer, or research assistant roles.",
    "source_urls": [],
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
  research_pack: `{
  "university": {
    "name": "University of Example",
    "country": "Finland",
    "country_code": "FI",
    "city": "Helsinki",
    "official_url": "https://example.fi",
    "source_urls": []
  },
  "programs": [
    {
      "title": "MSc Computer Science",
      "degree_level": "master",
      "degree_award": "Master of Science",
      "subject_area": "Computer Science",
      "language_of_instruction": "English",
      "study_mode": "full_time",
      "delivery_mode": "on_campus",
      "duration_months": null,
      "duration_text": null,
      "tuition_amount": 15000,
      "tuition_currency": "EUR",
      "tuition_period": "year",
      "tuition_notes": null,
      "application_fee_amount": null,
      "application_fee_currency": null,
      "application_fee_notes": null,
      "admission_requirements_text": null,
      "academic_requirements_text": null,
      "english_requirements_text": null,
      "ielts_min_score": null,
      "toefl_min_score": null,
      "required_documents_text": null,
      "curriculum_or_modules_text": null,
      "career_outcomes_text": null,
      "scholarship_notes": null,
      "official_program_url": "https://example.fi/programs/computer-science",
      "official_application_url": null,
      "official_tuition_url": null,
      "source_urls": [],
      "source_confidence": "unknown",
      "missing_fields": [],
      "notes": null
    }
  ]
}`,
}

export const TEMPLATE_FIELD_NOTES: Record<EntityTemplateType, Array<{ field: string; required: boolean; note: string }>> = {
  universities: [
    { field: 'name', required: true, note: 'Official full name of the university' },
    { field: 'country_code', required: true, note: '2-letter ISO 3166-1 alpha-2 code (e.g. FI, US, GB, DE)' },
    { field: 'official_url', required: false, note: 'Homepage URL — must start with https://' },
  ],
  programs: [
    { field: 'title', required: true, note: 'Full program name as listed officially' },
    { field: 'degree_level_code', required: true, note: 'Code from degree_levels table — bachelor, master, phd, foundation, diploma, certificate, associate' },
    { field: 'primary_subject', required: false, note: 'Exact subject name is best. Unknown subjects warn and are ignored; no subjects are auto-created.' },
    { field: 'study_mode / delivery_mode / tuition_period', required: false, note: 'Invalid enum-like values warn and are ignored. Supported: study_mode full_time/part_time/online/hybrid; delivery_mode on_campus/online/hybrid/distance; tuition_period per_year/per_semester/total/per_credit.' },
    { field: 'official_program_url / official_application_url / source_urls', required: false, note: 'Best-effort source links are attached to production programs when permissions allow.' },
    { field: 'content_status / verification_status', required: false, note: 'Ignored if present in JSON. Imported programs still merge as draft + unverified.' },
    { field: 'deadline / application_deadline', required: false, note: 'Accepted as staging-only text for review context, but Phase 66E does not create program_intakes.' },
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
  research_pack: [
    { field: 'university', required: true, note: 'Nested university object. country_code is best; country name is resolved only on exact match.' },
    { field: 'programs', required: true, note: 'Array of program objects. Each staged program is automatically linked to the staged university from this pack.' },
    { field: 'programs[].degree_level', required: true, note: 'Use bachelor, master, phd, foundation, diploma, certificate, or associate. Common aliases are normalized.' },
    { field: 'programs[].source_urls', required: false, note: 'Official/source URLs are preserved in raw_data and attached as data sources when permissions allow.' },
    { field: 'programs[].source_confidence', required: false, note: 'Use high, medium, low, or unknown. Imported programs remain unverified until manually reviewed.' },
    { field: 'programs[].content_status / programs[].verification_status', required: false, note: 'Ignored if present. Imported programs still merge as draft + unverified.' },
    { field: 'programs[].intakes / programs[].deadlines', required: false, note: 'Do not include intake arrays for Phase 66E. Intake import is deferred.' },
  ],
}
