export type PromptEntityType = 'universities' | 'programs' | 'scholarships' | 'articles' | 'research_pack'

const SHARED_RULES = `Rules:
- Use null for any field you cannot confirm from an official source. Do not guess or invent values.
- Return only valid JSON. No markdown code fences, no explanation text before or after.
- No trailing commas in JSON.`

export const AI_PROMPTS: Record<PromptEntityType, string> = {
  universities: `Research the following universities and return a JSON array in the exact schema below.
Use official university websites and government education directories as primary sources.

${SHARED_RULES}
- country_code must be a 2-letter ISO 3166-1 alpha-2 code (e.g. FI, US, GB, DE).
- official_url must be the university homepage starting with https://
- One object per university.

Required schema:
[
  {
    "name": "Full official university name",
    "country_code": "XX",
    "official_url": "https://..."
  }
]

Universities to research:
[LIST UNIVERSITY NAMES HERE — one per line]`,

  programs: `Research the following degree programs and return a JSON array in the exact schema below.
Use official university program pages as sources.

${SHARED_RULES}
- degree_level_code must be one of: bachelor, master, phd, foundation, diploma, certificate, associate
- tuition_amount: annual fee as a plain number (no currency, no commas). Use null if not found.
- deadline: YYYY-MM-DD format. Use null if rolling admissions or not specified.
- language: primary language of instruction.
- staging_university_id: Do not include this field in your JSON response — it is a batch-internal UUID that only exists after universities are staged in DegreeWiki and cannot be known in advance. The admin will add it manually to each program object before importing.
- One object per program.

Required schema:
[
  {
    "title": "Full program name",
    "degree_level_code": "master",
    "language": "English",
    "tuition_amount": null,
    "deadline": null
  }
]

Programs to research (include university name for context):
[LIST PROGRAMS HERE — e.g. "MSc Computer Science at University of Helsinki"]`,

  scholarships: `Research the following scholarships and return a JSON array in the exact schema below.
Use only official scholarship pages or authoritative government education sites.

${SHARED_RULES}
- amount: total award amount as a plain number (no currency symbol). Use null if variable or not published.
- deadline: YYYY-MM-DD format. Use null if rolling or not yet announced.
- One object per scholarship.

Required schema:
[
  {
    "name": "Official scholarship name",
    "amount": null,
    "deadline": null
  }
]

Scholarships to research:
[LIST SCHOLARSHIP NAMES HERE — one per line]`,

  articles: `Write or research the following articles for DegreeWiki, a study abroad information site for international students.

${SHARED_RULES}
- title: clear and descriptive for students researching study abroad.
- slug: URL-safe — lowercase letters, digits, and hyphens only. No spaces or special characters.
- category must be one of: guides, scholarships, news, universities, programs, countries
- content: plain text or basic Markdown. Aim for 300-800 words. Focus on practical, accurate information.
- One object per article.

Required schema:
[
  {
    "title": "Article title",
    "slug": "article-url-slug",
    "category": "guides",
    "content": "Full article text..."
  }
]

Articles to write or research:
[LIST ARTICLE TOPICS HERE — one per line]`,

  research_pack: `Research one university and its degree programs, then return a nested university + programs research pack in the exact schema below.
Use official university pages as primary sources. Include source URLs for every program whenever possible.

${SHARED_RULES}
- This shape is for a DegreeWiki mixed import batch.
- The importer stages the university first, then links every staged program to that staged university.
- degree_level must be one of: bachelor, master, phd, foundation, diploma, certificate, associate.
- study_mode must be one of: full_time, part_time, online, hybrid, or null.
- delivery_mode must be one of: on_campus, online, hybrid, distance, or null.
- tuition_period may be year, semester, total, credit, or null.
- Use official_program_url for the canonical program page.
- source_confidence must be high, medium, low, or unknown.

Required schema:
{
  "university": {
    "name": "Full official university name",
    "country": "Country name",
    "country_code": "XX",
    "city": "City name or null",
    "official_url": "https://...",
    "source_urls": []
  },
  "programs": [
    {
      "title": "Full official program title",
      "degree_level": "master",
      "degree_award": null,
      "subject_area": null,
      "language_of_instruction": null,
      "study_mode": null,
      "delivery_mode": null,
      "duration_text": null,
      "duration_months": null,
      "tuition_amount": null,
      "tuition_currency": null,
      "tuition_period": null,
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
      "official_program_url": null,
      "official_application_url": null,
      "official_tuition_url": null,
      "source_urls": [],
      "source_confidence": "unknown",
      "missing_fields": [],
      "notes": null
    }
  ]
}

University and programs to research:
[PASTE UNIVERSITY NAME AND PROGRAM LIST HERE]`,
}
