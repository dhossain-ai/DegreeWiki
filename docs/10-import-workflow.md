# Import Workflow

This file documents the current safe import workflow, with the final QA focus on
university-by-university program import.

## Hard Boundary

- Use official university and official program pages as primary sources.
- Do not write directly to production outside the existing reviewed merge flow.
- Do not trust JSON `content_status` or `verification_status`.
- Do not import `program_intakes`, deadlines, or intake arrays in this phase.
- Do not auto-create subjects.
- Do not hard delete production data unless you are intentionally using the
  existing pre-launch cleanup tools.

## Recommended Program Workflow

The preferred operational path for program imports is one university at a time.

1. Open `/admin/imports/programs`.
2. Select the production university first.
3. Use the recommended research prompt to collect one university and its
   programs into the preferred nested JSON shape.
4. Paste or upload the JSON.
5. Confirm the preview shows the right university, sample titles, and useful
   rich fields.
6. Submit to create a staging-only import batch.
7. Review staged rows and warnings on `/admin/imports/[id]`.
8. Approve matching rows after manual QA.
9. Merge approved rows.
10. Use **Publish merged drafts as unverified** only after review.
11. Verify manually later.

What this flow does:

- It stages rows only at first.
- It creates draft, unverified programs only through the existing merge flow.
- It detects exact duplicate re-imports by normalized title + university +
  degree level.
- `Update Existing` fills empty allowlisted production fields only.
- Bulk Update Existing Matched Programs fills empty allowlisted production
  fields only on exact existing matches and never creates duplicates.

## Recommended Research Prompt

Use the built-in `research_pack` prompt as the default starting point for
university-by-university collection. The preferred output shape is:

```json
{
  "university": {
    "name": "Full official university name",
    "country": "Country name",
    "official_website": null,
    "source_urls": []
  },
  "programs": [
    {
      "title": null,
      "degree_level_code": null,
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
```

Prompt rules for researchers:

- Return valid JSON only.
- Use only the supported fields shown above.
- Use `null` for unknown facts.
- Do not include `content_status` or `verification_status`.
- Do not include deadlines, `application_deadline`, intake arrays, or
  `program_intakes`.
- `source_urls` should include the official program page when available, plus
  any other official source pages used for factual fields.
- `curriculum_summary` and `career_outcomes` must be grounded in the official
  program description. Do not invent claims.

Known supported values for new research JSON:

- `degree_level_code`: `bachelor`, `master`, `phd`, `diploma`,
  `certificate`, `foundation`, `language`, `other`
- `study_mode`: `full_time`, `part_time`, `full_time_or_part_time`, `null`
- `delivery_mode`: `on_campus`, `online`, `hybrid`, `null`
- `tuition_period`: `per_year`, `per_semester`, `per_credit`, `total`, `null`

Primary subject guidance:

- Prefer broad existing-friendly names such as `Computer Science`,
  `Data Science`, `Business & Management`, `Law`, `Economics`, `Finance`,
  `Marketing`, `Education`, `Psychology`, `Engineering`,
  `Health Sciences`, `Social Sciences`, `Arts & Humanities`,
  `Communication`, `Public Administration`, or `International Relations`.
- If the subject is uncertain or may not exist yet, use `null`.
- Do not invent narrow random subject names.

## JSON Field Rules

### Dedicated Program Import Page

`/admin/imports/programs` accepts:

- `[...]`
- `{ "programs": [...] }`
- `{ "university": { ... }, "programs": [...] }`

The nested university + programs shape is preferred.

### Flat Program Arrays

Flat program arrays are still supported for generic batch import, but they need
`staging_university_id` at import time. Use them only when you intentionally
need the generic mixed/program batch flow.

### Supported Program Fields

Recommended supported program keys for new research JSON:

- `title`
- `degree_level_code`
- `degree_award`
- `primary_subject`
- `study_mode`
- `delivery_mode`
- `language_of_instruction`
- `duration_months`
- `tuition_min_amount`
- `tuition_max_amount`
- `tuition_currency`
- `tuition_period`
- `tuition_notes`
- `application_fee_amount`
- `application_fee_currency`
- `application_fee_notes`
- `official_url`
- `application_url`
- `admission_requirements`
- `gpa_requirements`
- `curriculum_summary`
- `career_outcomes`
- `source_urls`

Notes:

- Older alias fields may still parse, but new research JSON should prefer the
  supported keys above.
- Imported programs still merge as `draft` + `unverified` by server logic.
- Source attachment is best-effort and does not roll back a successful program
  merge if source linking fails.

## What Program Import Does Not Support Yet

- `program_intakes`
- deadline arrays
- `application_deadline`
- automatic publish as verified
- subject auto-creation
- direct production edits outside reviewed merge

## Duplicate Handling

Program import is now duplicate-safe by default.

- Exact production matches are detected by normalized title + linked university +
  degree level.
- Re-importing the same university data should not silently create new duplicate
  production rows.
- Bulk merge skips exact unique matches as existing by default.
- Ambiguous matches stay manual.

Use these actions after review:

- **Skip Existing** when the staged row is already represented in production.
- **Update Existing** when you want to fill empty allowlisted production fields
  only.
- **Bulk Update Existing Matched Programs** after a richer second import when
  you want to patch many exact existing matches in one pass.
- **Create New** only when the program is genuinely distinct, or when you have
  explicitly confirmed that a duplicate production row is intentional.

## Enrichment Pass

Use this when a first import created draft/unverified programs but some safe
rich fields were still missing.

1. First import creates draft, unverified programs.
2. If fields are missing, run deep research again.
3. Import the richer JSON into staging.
4. Use **Bulk Update Existing Matched Programs** on `/admin/imports/[id]`.
5. Review the patched production programs.
6. Publish as unverified only after review.
7. Verify manually later.

Enrichment-pass rules:

- Matching still requires normalized title + linked production university +
  degree level.
- Rows without one exact match are skipped, not created.
- Ambiguous exact matches stay manual.
- Only empty allowlisted production fields are filled.
- Source URLs are attached best-effort and deduped by URL.
- The enrichment pass does not publish or verify programs.

## Cleanup Rules

When older duplicate or test programs already exist:

- Use `/admin/programs?duplicates=1` to isolate duplicate groups.
- Archive is the normal safe cleanup path.
- Super-admin hard delete is pre-launch only, explicitly confirmed, and should
  be reserved for safe duplicate/test cleanup.
- If hard delete is blocked by preserved history or dependencies, archive the
  program instead.

## Manual QA Checklist For One University

1. Open `/admin/imports/programs`.
2. Confirm the helper copy is clear.
3. Copy the recommended prompt.
4. Use it with one small real university or college.
5. Paste or upload the JSON.
6. Confirm the preview shows useful fields.
7. Stage rows.
8. Approve all matching.
9. Merge approved.
10. Confirm duplicate handling does not create duplicates on re-import.
11. Confirm `Update Existing` fills empty fields only.
12. Confirm `Publish merged drafts as unverified` works.
13. Confirm the public page shows imported rich fields.
14. Confirm `npm run build` passes.
