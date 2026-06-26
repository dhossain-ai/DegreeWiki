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
    "study_mode": "full_time",
    "delivery_mode": "on_campus",
    "language_of_instruction": "English",
    "duration_months": 24,
    "tuition_min_amount": 15000,
    "tuition_max_amount": 18000,
    "tuition_currency": "EUR",
    "tuition_period": "per_year",
    "tuition_notes": null,
    "application_fee_amount": 75,
    "application_fee_currency": "EUR",
    "application_fee_notes": null,
    "official_url": "https://example.fi/programs/computer-science",
    "application_url": "https://apply.example.fi/programs/computer-science",
    "admission_requirements": "Bachelor degree in a relevant field.",
    "gpa_requirements": "Minimum 3.0 GPA",
    "curriculum_summary": "Core modules in algorithms, systems, and AI.",
    "career_outcomes": "Software engineer, data engineer, or research assistant roles.",
    "source_urls": [
      "https://example.fi/programs/computer-science"
    ],
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
    "official_website": "https://example.fi",
    "source_urls": [
      "https://example.fi"
    ]
  },
  "programs": [
    {
      "title": "MSc Computer Science",
      "degree_level_code": "master",
      "degree_award": "Master of Science",
      "primary_subject": "Computer Science",
      "study_mode": "full_time",
      "delivery_mode": "on_campus",
      "language_of_instruction": "English",
      "duration_months": 24,
      "tuition_min_amount": 15000,
      "tuition_max_amount": 18000,
      "tuition_currency": "EUR",
      "tuition_period": "per_year",
      "tuition_notes": null,
      "application_fee_amount": 75,
      "application_fee_currency": "EUR",
      "application_fee_notes": null,
      "official_url": "https://example.fi/programs/computer-science",
      "application_url": "https://apply.example.fi/programs/computer-science",
      "admission_requirements": "Bachelor degree in a relevant field.",
      "gpa_requirements": "Minimum 3.0 GPA",
      "curriculum_summary": "Core modules in algorithms, systems, and AI.",
      "career_outcomes": "Software engineer, data engineer, or research assistant roles.",
      "source_urls": [
        "https://example.fi/programs/computer-science",
        "https://apply.example.fi/programs/computer-science"
      ]
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
    { field: 'degree_level_code', required: true, note: 'Recommended values for new research JSON: bachelor, master, phd, diploma, certificate, foundation, language, or other.' },
    { field: 'primary_subject', required: false, note: 'Use a broad existing-friendly subject when obvious. If unsure, use null. Unknown subjects warn and are ignored; no subjects are auto-created.' },
    { field: 'study_mode / delivery_mode / tuition_period', required: false, note: 'Recommended values for new research JSON: study_mode full_time/part_time/full_time_or_part_time; delivery_mode on_campus/online/hybrid; tuition_period per_year/per_semester/per_credit/total.' },
    { field: 'official_url / application_url / source_urls', required: false, note: 'Use official program/apply URLs when available. source_urls should include the official program page and any official supporting sources used.' },
    { field: 'admission_requirements / gpa_requirements / curriculum_summary / career_outcomes', required: false, note: 'Use null when unknown. Curriculum and career text should be grounded in official descriptions only.' },
    { field: 'content_status / verification_status', required: false, note: 'Ignored if present in JSON. Imported programs still merge as draft + unverified.' },
    { field: 'deadlines / intakes', required: false, note: 'Do not include these in new JSON for this phase. Program intake/deadline import is still deferred.' },
    { field: 'staging_university_id', required: false, note: 'Required only for flat program arrays imported into a generic programs/mixed batch. The dedicated /admin/imports/programs flow selects the production university first and does not need this field in the research JSON.' },
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
    { field: 'university', required: true, note: 'Preferred university-by-university import shape. Use name, country, official_website, and source_urls only.' },
    { field: 'programs', required: true, note: 'Array of supported program objects. Each staged program is automatically linked to the staged university from this pack.' },
    { field: 'programs[].degree_level_code', required: true, note: 'Recommended values for new research JSON: bachelor, master, phd, diploma, certificate, foundation, language, or other.' },
    { field: 'programs[].primary_subject', required: false, note: 'Use a broad existing-friendly subject when obvious; otherwise null. Do not invent new subject names.' },
    { field: 'programs[].source_urls', required: false, note: 'Include the official program page when available, plus any other official supporting source pages used.' },
    { field: 'programs[].content_status / programs[].verification_status', required: false, note: 'Ignored if present. Imported programs still merge as draft + unverified.' },
    { field: 'programs[].intakes / programs[].deadlines', required: false, note: 'Do not include intake/deadline data in new JSON for this phase. Intake import is still deferred.' },
  ],
}
