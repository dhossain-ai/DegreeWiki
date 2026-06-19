# Import Workflow

Phase 47 establishes the import workflow and example templates only. It does not
authorize a real import run, production merge, Supabase data mutation, or direct
production write. Actual real data import is an operational step that must be
reviewed and explicitly approved before it starts.

## Hard Boundary

- Direct production writes are forbidden.
- Do not insert, update, delete, merge, or manually patch production rows outside
  the approved admin import workflow.
- Do not create import batches for real data until the operational import run is
  explicitly approved.
- Do not paste real data into the admin UI during this docs/templates phase.
- Do not approve, reject, review, or merge real staged rows during this phase.
- Do not use scraping, AI extraction, or secondary aggregator data as source data.

## Recommended Entity Order

Start with universities.

Universities have no staging dependencies and create the production records that
program imports need later. Programs depend on merged universities through
`staging_university_id -> staging_universities.match_university_id`. Scholarships
and articles have fewer dependencies and can follow once the core university and
program data workflow is proven.

Recommended sequence:

1. Universities
2. Programs linked to merged universities
3. Scholarships
4. Articles

## Template Files

Example templates live in `data/import-templates/`.

The `.example.json` files contain placeholder data only. Names such as
`Example University One` are intentionally not real institutions. They document
field names and JSON shape; they are not starter data and must not be imported
as production content.

If a real starter dataset is ever added, keep it separate from placeholder
examples. Use a name such as `universities.real-starter.au.json`, document the
source expectations in the file's companion notes, and manually verify every row
against official websites before import.

## JSON-Only Import Workflow

The current structured import path accepts a JSON array of up to 100 rows.
For first operational runs, keep batches much smaller than the technical limit:
5-10 university rows is the recommended starting size.

Pre-import checklist for an approved operational run:

1. Confirm the run is approved.
2. Confirm the entity type and batch scope.
3. Verify country codes exist in `countries.iso2`.
4. For programs, verify degree level codes exist in active `degree_levels.code`.
5. Prepare a JSON array manually from official source pages.
6. Validate JSON syntax before pasting.
7. Keep a separate source list of official URLs for post-merge data source entry.

Admin import steps after approval:

1. Open `/admin/imports`.
2. Create a new import batch for the entity type.
3. Open the batch detail page.
4. Expand `Bulk JSON Import`.
5. Select the entity type when using a mixed batch.
6. Paste the JSON array.
7. Submit the import.
8. Read the inserted, warned, and failed row counts.

## Field Reference

### Universities

Minimum operational fields:

```json
[
  {
    "name": "Example University One",
    "country_code": "EX",
    "official_url": "https://www.example.edu"
  }
]
```

Fields:

- `name`: required for merge. Maps to `extracted_name`.
- `country_code`: required for merge. Must match `countries.iso2` exactly.
- `official_url`: optional but strongly recommended. Used by validation and
  production-match checks.

### Programs

Minimum operational fields:

```json
[
  {
    "title": "Example Master of Computing",
    "degree_level_code": "masters",
    "staging_university_id": "00000000-0000-0000-0000-000000000000",
    "language": "English",
    "tuition_amount": 25000
  }
]
```

Fields:

- `title`: required for merge. Maps to `extracted_title`.
- `degree_level_code`: required for merge. Must match an active
  `degree_levels.code`.
- `staging_university_id`: required for merge. Must point to a staged university
  in the same batch whose row has already been merged.
- `language`: optional.
- `tuition_amount`: optional numeric value.
- `deadline`: optional text value.

### Scholarships

Minimum operational fields:

```json
[
  {
    "name": "Example Merit Scholarship",
    "amount": 5000,
    "deadline": "2026-09-01"
  }
]
```

Fields:

- `name`: required for merge. Maps to `extracted_name`.
- `amount`: optional numeric value. Maps to `extracted_amount`.
- `deadline`: optional text value. Maps to `extracted_deadline`.

### Articles

Minimum operational fields:

```json
[
  {
    "title": "Example Application Guide",
    "slug": "example-application-guide",
    "category": "guide",
    "content": "Example article content for template shape only."
  }
]
```

Fields:

- `title`: required for merge. Maps to `extracted_title`.
- `slug`: required for merge. Must be lowercase URL-safe slug text.
- `category`: optional text value. Category FK mapping is not automatic.
- `content`: optional but recommended for article usefulness.

## Warning And Error Handling

Validation warnings do not always block staging insert. They mean a human must
read the row before review or merge.

Common warning sources:

- Missing university name, program title, scholarship name, or article title.
- Missing or invalid URL.
- Country code not formatted as two uppercase characters.
- Invalid program `staging_university_id` format or batch mismatch.
- Non-numeric tuition or scholarship amount.
- Article slug format issues.
- Same-batch duplicate warning from quality checks.
- Possible production match warning from quality checks.

Failed rows are different from warned rows. Failed rows did not insert into
staging and must be corrected in source JSON before re-importing into a new
batch or adding a corrected row manually.

Never approve a row with unresolved warnings. Resolve the warning, reject the
bad row, or create a corrected replacement row before proceeding.

## Quality Check Step

After rows are staged, run quality checks from the import batch detail page.

Quality checks are advisory and non-destructive. They detect same-batch
duplicates and possible production matches. They write warning rows to
`staging_errors`; they do not approve, reject, merge, or modify production
records.

Review every quality warning:

- `same_batch_duplicate`: reject all duplicate staged rows except the one chosen
  for review.
- `possible_production_match`: manually compare the staged row with the existing
  production record. Reject the row if it is a duplicate. Continue only if it is
  clearly distinct.

## Manual Review Step

Manual review is required before merge.

For each staged row:

1. Read the extracted fields.
2. Read validation and quality warnings.
3. Compare against the official source page.
4. Approve only if the row is accurate and warnings are resolved.
5. Reject rows that are duplicate, inaccurate, unverifiable, or malformed.
6. Skip rows that should be deferred without being treated as rejected.
7. Use reset only when a row needs to return to pending review.

Approval is not a merge. Approval only marks the staged row as ready for an
explicit merge action.

## Merge Step

Merge is one row at a time. Bulk merge and auto-merge are intentionally excluded.

Before merging:

1. Confirm the row is approved.
2. Confirm there are no unresolved warnings.
3. Confirm required lookup values exist.
4. Confirm the row is not a duplicate of production data.
5. Confirm the operator understands that merge creates or safely patches
   production data.

Expected merge behavior:

- Universities create draft, unverified production university rows.
- Programs require a merged staged university and active degree level code.
- Scholarships create draft, unverified production scholarship rows.
- Articles require a valid title and slug.

If merge is blocked, do not force a production edit around the workflow. Record
the error, reject or skip the staged row as appropriate, correct the source JSON,
and re-import through the approved process.

## Post-Merge Data Source Step

After each successful merge, add a production data source record through the
admin UI.

Use the merged entity's admin edit page and Data Sources panel:

- `source_type`: `official_website`
- `confidence_level`: `high`
- `is_primary_source`: `true`
- URL: the official source page used for manual verification

The data source step is required so future verification work can trace every
real production record back to an official source.

## Troubleshooting

`JSON parse error`

The pasted value is not valid JSON. Confirm it is a JSON array, uses double
quotes, has no comments, and has no trailing commas.

`Expected a JSON array`

The import parser requires `[...]`, even for one row.

`Array exceeds 100 rows`

Split the data into smaller batches. First real operational runs should use
5-10 rows.

`Country code mismatch`

The university merge requires `country_code` to match `countries.iso2`. Confirm
the country exists and that the code is uppercase.

`Degree level code not found`

The program merge requires `degree_level_code` to match an active
`degree_levels.code`.

`Staged university is not merged`

Programs cannot merge until their linked staged university has
`match_university_id` set by a successful university merge.

`Possible production match`

Pause. Compare the staged row with production data manually. Reject duplicates.

`Slug conflict`

The target slug already exists or slug generation collided. Do not patch
production directly. Correct the staged data and retry through the workflow.

`Row imported with warnings`

Warnings are not approval. Read and resolve warnings before approving the row.

`Merge creates the wrong record`

Stop the operational run. Do not continue merging nearby rows until the cause is
understood. Use the admin UI and existing data governance process to repair or
remove the incorrect production row, then re-import corrected data only after
review.
