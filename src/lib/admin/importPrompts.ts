export type PromptEntityType = 'universities' | 'programs' | 'scholarships' | 'articles'

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
- degree_level_code must be one of: bsc, ba, msc, ma, mba, llm, md, phd, other
- tuition_amount: annual fee as a plain number (no currency, no commas). Use null if not found.
- deadline: YYYY-MM-DD format. Use null if rolling admissions or not specified.
- language: primary language of instruction.
- staging_university_id: Do not include this field in your JSON response — it is a batch-internal UUID that only exists after universities are staged in DegreeWiki and cannot be known in advance. The admin will add it manually to each program object before importing.
- One object per program.

Required schema:
[
  {
    "title": "Full program name",
    "degree_level_code": "msc",
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
}
