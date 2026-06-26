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
    "degree_level_code": "master",
    "staging_university_id": "00000000-0000-0000-0000-000000000000",
    "language_of_instruction": "English",
    "study_mode": "full_time",
    "delivery_mode": "on_campus",
    "duration_months": 24,
    "tuition_min_amount": 25000,
    "tuition_currency": "EUR",
    "tuition_period": "per_year",
    "official_program_url": "https://www.example.edu/programs/master-of-computing",
    "source_urls": []
  }
]
```

Fields:

- `title`: required for merge. Maps to `extracted_title`.
- `degree_level_code`: required for merge. Must match an active
  `degree_levels.code`.
- `staging_university_id`: required for merge. Must point to a staged university
  in the same batch whose row has already been merged.
- `primary_subject` / `subject_area` / `subject`: optional. Exact subject-name
  match is preferred; unknown or ambiguous values warn and are ignored.
- `study_mode`: optional. Supported values: `full_time`, `part_time`,
  `online`, `hybrid`. Invalid values warn and are ignored.
- `delivery_mode`: optional. Supported values: `on_campus`, `online`,
  `hybrid`, `distance`. Invalid values warn and are ignored.
- `language` / `language_of_instruction`: optional.
- `duration_months`: optional positive whole number.
- `tuition_*`: optional. Supported directly on production programs.
- `application_fee_*`: optional. Supported directly on production programs.
- `official_program_url` / `official_url`: optional. Maps to
  `programs.official_url` and can also be attached to `data_sources`.
- `official_application_url` / `application_url`: optional. Maps to
  `programs.application_url` and can also be attached to `data_sources`.
- `admission_requirements_text` / `admission_requirements`: optional.
- `gpa_requirements_text` / `gpa_requirements`: optional.
- `curriculum_or_modules_text` / `curriculum_summary`: optional.
- `career_outcomes_text` / `career_outcomes`: optional.
- `english_requirements_text`, `ielts_min_score`, `toefl_min_score`, or
  structured `english_requirements`: optional.
- `source_urls`: optional. Best-effort attached to `data_sources` after merge.
- `content_status` / `verification_status`: ignored if present.
- `deadline` / `application_deadline`: staging-only context for review. Phase
  66E does not create `program_intakes`.

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

## Importing Programs Against Existing Production Universities

Programs require a merged staging university row (one with `match_university_id` set) in the
same batch. When those universities already exist in production from a previous phase, follow
this sequence to link them without creating duplicates.

**Step 1 — Create a mixed batch.**
Open `/admin/imports` and create a new batch with batch type `mixed`. This allows universities
and programs to share a single batch so programs can reference their staging university UUIDs.

**Step 2 — Import the university stubs.**
Bulk-import the universities JSON into the mixed batch under the `universities` entity type.
These rows arrive in `pending` or `validated` status.

**Step 3 — Run quality checks.**
Use the quality check action to detect possible production matches. Confirm that each staged
university corresponds to an existing production university.

**Step 4 — Link to production using set_match_university_id.**
For each approved staging university row that matches an existing production record, expand the
"Link to existing production university" form in the row's Actions column. Paste the production
university's UUID and submit. The form writes only `staging_universities.match_university_id`;
no production data is written. The UUID can be found on the university's admin edit page URL or
from the production universities list.

**Step 5 — Merge each university row using update_existing.**
With `match_university_id` now set, use the "Update Existing" merge form. This marks the staging
row as merged and optionally patches `official_url` if currently empty in production. No
production fields are overwritten.

**Step 6 — Note staging UUIDs.**
After merge, the staging university rows are in `merged` status. Note the staging row UUID for
each university. These UUIDs are what the programs JSON must reference in `staging_university_id`.

**Step 7 — Fill staging UUIDs into the programs JSON.**
Edit the programs JSON to replace placeholder `staging_university_id` values with the actual
staging UUIDs from Step 6. The staging UUID is the row's `id` in `staging_universities`, not
the production `match_university_id`.

**Step 8 — Import programs.**
Bulk-import the updated programs JSON into the same mixed batch under the `programs` entity type.
The import validates that each `staging_university_id` belongs to the current batch and that the
referenced staging university has `match_university_id` set.

**Step 9 — Review and merge programs.**
Approve each program row after manual review. Use the create-new merge form for each. Program
merge resolves the linked staging university's `match_university_id` to get the production
university UUID for the FK relationship.

The `set_match_university_id` action is available only for universities and only for rows in
`approved` status. It validates: the row belongs to the current batch, the row is not already
merged, and the target production university UUID exists. It does not write any production data.

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

Program merges now try to attach source links automatically from
`official_program_url`, `official_application_url`, `official_tuition_url`, and
`source_urls`.

Important notes:

- Source attachment is best-effort and respects existing `data_sources` RLS.
- URL duplicates are removed before insert.
- A source-link failure does not roll back the already-created draft program.
- If source attachment fails, add the missing links manually from the merged
  program's admin edit page.

Use the program edit page Data Sources panel for any manual additions or fixes.

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
