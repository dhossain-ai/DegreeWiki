export type PromptEntityType = 'universities' | 'programs' | 'scholarships' | 'articles' | 'research_pack'

const SHARED_RULES = `Rules:
- Use null for any field you cannot confirm from an official source. Do not guess or invent values.
- Use only the fields shown in the schema. Do not add extra keys.
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
- Use only supported import fields.
- degree_level_code should use one of: bachelor, master, phd, diploma, certificate, foundation, language, other.
- primary_subject should use a broad existing-friendly subject when obvious (for example "Computer Science" or "Business & Management"). If unsure, use null. Do not invent narrow random subjects.
- study_mode should use one of: full_time, part_time, full_time_or_part_time, or null.
- delivery_mode should use one of: on_campus, online, hybrid, or null.
- tuition_period should use one of: per_year, per_semester, per_credit, total, or null.
- Use official_url for the canonical official program page and application_url when available.
- source_urls should include the official program page when available, plus any other official source pages used for factual fields.
- career_outcomes and curriculum_summary must be grounded in the official program description. Do not invent claims.
- Do not include content_status or verification_status.
- Do not include intake arrays, deadline arrays, deadline text, or application_deadline in this phase.
- staging_university_id: Do not include this field in your JSON response — it is a batch-internal UUID that only exists after universities are staged in DegreeWiki and cannot be known in advance. The admin will add it manually to each program object before importing.
- One object per program.

Required schema:
[
  {
    "title": "Full program name",
    "degree_level_code": "master",
    "degree_award": null,
    "primary_subject": null,
    "study_mode": null,
    "delivery_mode": null,
    "language_of_instruction": null,
    "duration_months": null,
    "tuition_min_amount": null,
    "tuition_max_amount": null,
    "tuition_currency": null,
    "tuition_period": null,
    "tuition_notes": null,
    "application_fee_amount": null,
    "application_fee_currency": null,
    "application_fee_notes": null,
    "official_url": null,
    "application_url": null,
    "admission_requirements": null,
    "gpa_requirements": null,
    "curriculum_summary": null,
    "career_outcomes": null,
    "source_urls": []
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

  research_pack: `Research one university and its degree programs, then return the nested JSON object below.
Use official university pages as primary sources. Include source URLs for every program whenever possible.

${SHARED_RULES}
- This is the preferred university-by-university Program Import shape for DegreeWiki.
- Use only supported import fields shown below.
- Unknown factual data must be null.
- degree_level_code should use one of: bachelor, master, phd, diploma, certificate, foundation, language, other.
- study_mode should use one of: full_time, part_time, full_time_or_part_time, or null.
- delivery_mode should use one of: on_campus, online, hybrid, or null.
- tuition_period should use one of: per_year, per_semester, per_credit, total, or null.
- primary_subject should use a broad existing-friendly subject when obvious. Suggested examples: Computer Science, Data Science, Business & Management, Law, Economics, Finance, Marketing, Education, Psychology, Engineering, Health Sciences, Social Sciences, Arts & Humanities, Communication, Public Administration, International Relations. If the subject is uncertain or may not exist in DegreeWiki, use null.
- source_urls should include the official program page when available, plus any other official source pages used for factual fields.
- career_outcomes and curriculum_summary must be grounded in the official program description. Do not invent claims.
- Do not include intakes, deadlines, application_deadline, content_status, or verification_status.
- Do not include content_status or verification_status.

Required schema:
{
  "university": {
    "name": "Full official university name",
    "country": "Country name",
    "official_website": null,
    "source_urls": []
  },
  "programs": [
    {
      "title": "Full official program title",
      "degree_level_code": "master",
      "degree_award": null,
      "primary_subject": null,
      "study_mode": null,
      "delivery_mode": null,
      "language_of_instruction": null,
      "duration_months": null,
      "tuition_min_amount": null,
      "tuition_max_amount": null,
      "tuition_currency": null,
      "tuition_period": null,
      "tuition_notes": null,
      "application_fee_amount": null,
      "application_fee_currency": null,
      "application_fee_notes": null,
      "official_url": null,
      "application_url": null,
      "admission_requirements": null,
      "gpa_requirements": null,
      "curriculum_summary": null,
      "career_outcomes": null,
      "source_urls": []
    }
  ]
}

University and programs to research:
[PASTE UNIVERSITY NAME AND PROGRAM LIST HERE]`,
}
