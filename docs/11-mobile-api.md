# Public Mobile API Contracts

All routes are unauthenticated, read-only JSON endpoints backed by the Supabase anon client and
database RLS. List routes return raw arrays. Detail routes return `{ "ok": true, "item": ... }`.
Missing or non-public detail records return `404` with `{ "ok": false, "error": "..._not_found" }`.
Database failures return a generic error body and never include raw database messages.

For the contracts below, `id`, `slug`, and the entity name/title are required. Every other scalar
field is nullable unless explicitly described as an array or object. Relationship arrays are always
arrays and may be empty. External URLs are returned only when they parse as HTTP or HTTPS URLs.

## Scholarships

Public visibility is exactly `scholarships.content_status = 'published'`, reinforced by RLS. A past
deadline does not hide a published scholarship. The API does not invent an active, open, expired,
or closing-soon status: clients should compare the stored ISO date in `deadline` or
`deadline.date` with their current date and use `deadlineText`/`deadline.text` when the date is not
available.

Scholarship descriptions (`overview`, `eligibilitySummary`, and `coverageNotes`) are stored and
returned as plain text. Numeric amount fields are JSON numbers when present. No private notes,
staging/import metadata, SEO administration fields, next-review scheduling, or completeness scores
are selected.

### `GET /api/mobile/scholarships`

Returns a raw array, limited to 200 records, ordered by deadline and then name. Each item has:

```text
id: string
slug: string
name: string
providerName: string | null
providerType: string | null
providerTypeLabel: string | null
summary: string | null
scholarshipType: string | null
scholarshipTypeLabel: string | null
fundingType: string | null
fundingTypeLabel: string | null
applicationType: string | null
amountMin: number | null
amountMax: number | null
currency: string | null
amountDisplay: string | null
deadline: string | null              # stored ISO date
deadlineText: string | null          # stored free-text fallback/context
deadlineDisplay: string | null
studyCountries: string[]
eligibleDegreeLevels: string[]
eligibleSubjects: string[]
officialUrl: string | null
applicationUrl: string | null
verificationStatus: string | null
lastVerifiedAt: string | null
updatedAt: string | null
imageUrl: string | null              # cover image, falling back to logo
```

### `GET /api/mobile/scholarships/[slug]`

Returns `{ ok: true, item }`. The item has:

```text
id, slug, name
providerName, providerType, providerTypeLabel
summary
scholarshipType, scholarshipTypeLabel
fundingType, fundingTypeLabel
applicationType, applicationTypeLabel
overview: string | null
contentFormat: "plain_text"
eligibilitySummary: string | null
coverageNotes: string | null
amount: {
  min: number | null,
  max: number | null,
  currency: string | null,
  display: string | null
}
deadline: {
  date: string | null,
  text: string | null,
  display: string | null
}
studyCountries: RelationItem[]
eligibleDegreeLevels: RelationItem[]
eligibleSubjects: RelationItem[]
eligibleNationalities: NationalityRule[]
universities: RelationItem[]           # published related universities only
programs: ProgramItem[]                # published related programs only
officialUrl, applicationUrl, providerUrl: string | null
verificationStatus: string | null
lastVerifiedAt: string | null
sourceConfidenceScore: number | null
updatedAt: string | null
logoUrl, coverImageUrl, imageUrl: string | null

RelationItem = {
  id: string,
  slug: string | null,
  name: string,
  code: string | null
}

NationalityRule = {
  country: { id: string, slug: string | null, name: string, code: string | null },
  eligibilityType: "eligible" | "ineligible" | "preferred",
  notes: string | null
}

ProgramItem = { id: string, slug: string | null, title: string }
```

The current schema does not model opening dates, required documents, application steps,
requirements, selection process, or public contact details as separate scholarship fields, so the
API does not invent them.

## Guides

Public visibility is exactly `articles.content_status = 'published'`, reinforced by RLS. Draft,
in-review, unpublished, and archived articles are excluded. The current schema has a single
category plus country, subject, and degree-level relationships; it does not model tags or a
featured flag. Author records are not displayed on the existing public guide page, so authorship is
not exposed by this mobile contract.

### `GET /api/mobile/guides`

Returns a raw array, limited to 200 records, ordered by publication date and then title. Each item
has:

```text
id: string
slug: string
title: string
summary: string | null
category: { id: string, slug: string, name: string } | null
countries: string[]
subjects: string[]
degreeLevels: string[]
publishedAt: string | null
updatedAt: string | null
coverImageUrl: string | null
```

The list intentionally does not select full article content merely to calculate reading time; this
keeps the browse query lightweight.

### `GET /api/mobile/guides/[slug]`

Returns `{ ok: true, item }`. The item has:

```text
id, slug, title
summary: string | null
category: { id: string, slug: string, name: string } | null
countries: RelationItem[]
subjects: RelationItem[]
degreeLevels: RelationItem[]
publishedAt: string | null
updatedAt: string | null
readTimeMinutes: number | null          # derived at 200 words/minute, matching the web page
contentFormat: "structured_blocks_v1"
body: ContentBlock[]
sectionHeadings: { level: 2 | 3 | 4, text: string }[]
coverImageUrl: string | null
verificationStatus: string | null
lastVerifiedAt: string | null
sourceConfidenceScore: number | null
relatedGuides: RelatedGuide[]           # up to 3 published guides in the same category
```

`structured_blocks_v1` is JSON, not executable HTML. It is produced by the same parser used by the
public guide page. Supported block types are:

```text
{ type: "heading", level: 2 | 3 | 4, children: InlineNode[] }
{ type: "paragraph", children: InlineNode[] }
{ type: "ul", items: InlineNode[][] }
{ type: "ol", items: InlineNode[][] }

InlineNode =
  { type: "text", text: string }
  | { type: "strong", text: string }
  | { type: "em", text: string }
  | { type: "link", href: string, text: string }
```

Only HTTP(S) Markdown links become link nodes. Unsafe or invalid link destinations are reduced to
plain text. Raw HTML is never executed or returned as an HTML rendering contract. Related guides
contain `id`, `slug`, `title`, nullable `summary`, nullable `category`, nullable `publishedAt`, and
nullable `coverImageUrl`.
