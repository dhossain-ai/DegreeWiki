# DegreeWiki Status Archive

> Split archive for Phase 41-50. Use the narrowest matching range first.
> Older phases beyond this range live in the next archive file.

Phase 50 — Starter Content Activation Bundle — complete (code + data committed; operational import run pending).


Phase 49 — Full Starter University Import + Activation — complete.


Phase 48 — Starter University Data Pack — complete.


Phase 47 — Initial Real Data Import Bundle — workflow and templates foundation — complete.


Phase 46 — Import Quality Hardening Bundle — complete.


Phase 45 — Structured File Import Bundle — complete.


Phase 44 — Program Merge + Safe Update MVP Bundle — complete.


Phase 43 — Staged-to-Production Merge MVP Bundle — complete.


Phase 42 — Staging Review + Safe Merge Planning Bundle — complete.


Phase 41 — Manual Staged Record Entry + Validation Preview — complete.


Phase 50 — Starter Content Activation Bundle (code + data committed):

- Fixed fire-and-forget staging UPDATE bug in all 4 merge functions
  (`mergeUniversity`, `mergeScholarship`, `mergeArticle`, `mergeProgram`) in
  `src/lib/admin/importMerge.ts`. Each now captures the error from the post-merge
  staging status UPDATE and logs it with `console.error`. On failure, the merge
  function returns `ok: true` (the production insert succeeded) with an optional
  `warning` string surfaced to the admin in the batch detail page as a yellow banner
  via the `?mergeWarning=` query param.

- Fixed `updateExistingUniversity` in `importMerge.ts`:
  No longer fails with "Nothing safe to patch" when `official_url` is already set
  in production. Now proceeds to mark the staging row merged and set
  `match_university_id` regardless of whether any production fields were patched.
  Always sets `match_university_id: prodRow.id` on the staging row.

- Added `set_match_university_id` POST action in
  `src/pages/admin/imports/[id].astro`. Staging-only: validates row UUID, validates
  production university UUID, confirms staging row belongs to the current batch,
  confirms production university exists, writes only
  `staging_universities.match_university_id`. No production writes.

- Added corresponding UI in the university row Actions column: a collapsible "Link
  to existing production university" form shown when `import_status === 'approved'`
  and `match_university_id` is not set. The create-new merge form remains available
  in the same block for rows that do not yet have a production match.

- Added merge warning banner and `setMatchError` banner to `[id].astro`.

- Prepared 13 verified Finland master's programme records in
  `data/starter/programs.phase50.json` with `degree_level_code: "master"` and
  `staging_university_id: REPLACE_WITH_STAGING_UUID` placeholders to fill in
  during the operational import workflow.

- Prepared source URL documentation in `data/starter/programs.phase50.sources.md`
  including per-university official page URLs, tuition facts, UUID assignment
  worksheet, and post-merge data source instructions.

- Wrote 2 guide articles in `data/starter/articles.phase50.json`:
  "Study in Finland: A Starter Guide for International Students"
  (slug: `study-in-finland-starter-guide`) and
  "How to Compare English-Taught Master's Programmes in Finland"
  (slug: `compare-english-masters-finland`).

- Fixed `degree_level_code` in `data/import-templates/programs.example.json` and
  `docs/10-import-workflow.md` from wrong `"masters"` to correct `"master"`.

- Added "Importing Programs Against Existing Production Universities" section to
  `docs/10-import-workflow.md` documenting the 9-step workflow using
  `set_match_university_id` for mixed-batch program imports against existing
  production universities.

- Scholarships excluded: Finnish government master's scholarships do not exist
  per studyinfinland.fi; university-specific scholarship pages were not reachable.

- No data source attachment for articles: `official_editorial` is not a valid
  `source_type` in the schema. Article data source attachment deferred.

- Article `article_category_id` must be set manually via the admin article edit
  page after merge (the merge pipeline does not set it).

Files created (3):
  data/starter/programs.phase50.json
  data/starter/programs.phase50.sources.md
  data/starter/articles.phase50.json

Files modified (5):
  src/lib/admin/importMerge.ts
  src/pages/admin/imports/[id].astro
  data/import-templates/programs.example.json
  docs/06-status.md
  docs/07-task-log.md
  docs/10-import-workflow.md

Validation results:
  npm run build: PASS (Cloudflare server build, Server built in 10.56s, zero errors).
  service_role in src/: 0 matches.
  createServiceClient in src/pages,src/components,src/layouts: 0 matches (existing AI lib unchanged).
  innerHTML|set:html in src/: 0 matches.
  PUBLIC_SUPABASE_SERVICE in src/: 0 matches.
  git diff package.json: 0 lines (no dependency changes).

Operational import run (admin UI steps, not yet executed):
  See docs/10-import-workflow.md section "Importing Programs Against Existing Production
  Universities" for the full 9-step workflow. Programs.phase50.json staging UUIDs must be
  filled in from the batch detail page before program import.


Phase 49 — Full Starter University Import + Activation (complete):

- Completed the Finland starter university activation run through the existing
  admin UI workflow using batch
  `bd0805e8-3264-4e9c-82bc-099af5b78b23`.
  Phase 48 starter JSON was imported into staging, quality checks were run,
  all 8 staged rows were reviewed, and no direct SQL or manual Supabase table
  edits were used.

- Import and review outcome:
  8 rows imported, 0 warned, 0 failed.
  Quality checks produced 1 warning:
  `possible_production_match` for `University of Helsinki`.
  No validation warnings. No same-batch duplicates.

- Duplicate handling outcome:
  `University of Helsinki` was rejected from staging after confirming an
  existing correct production row already existed with
  `https://www.helsinki.fi/en`.
  `University of Turku` and `Åbo Akademi University` were also rejected from
  staging after review because correct draft production rows already existed
  with the expected official URLs.

- Safe create-new merge outcome:
  5 new production university rows were created from staging:
  `Aalto University`, `Tampere University`, `University of Oulu`,
  `University of Eastern Finland`, and `University of Jyväskylä`.
  The two Unicode-name records later had their production names corrected
  through the existing admin edit workflow so the public/admin UI now shows the
  correct names.

- Source activation outcome:
  Added 8 official production data sources through the existing admin university
  edit pages, one for each activated Finland university, using:
  `source_type = official_university`, `confidence_level = high`,
  `source_status = active`, `is_primary_source = true`.
  Tampere University kept the manually reviewed shared-domain source
  `https://www.tuni.fi/en`; this was accepted as the official first-party web
  presence for the university row and recorded as a note in the task log.

- Publishing outcome:
  Published 7 draft Finland university rows after source verification:
  `Aalto University`, `Tampere University`, `University of Turku`,
  `University of Oulu`, `University of Eastern Finland`,
  `University of Jyväskylä`, and `Åbo Akademi University`.
  `University of Helsinki` was already published and remained published.
  All 8 Finland universities were set to `verification_status =
  partially_verified` after the official source check.

- Verification outcome:
  `/admin/universities` showed all activated Finland rows.
  Public `/universities` listed all 8 Finland universities.
  Public detail pages loaded successfully for the actual saved slugs:
  `aalto-university`, `university-of-helsinki`, `tampere-university`,
  `university-of-turku`, `university-of-oulu`,
  `university-of-eastern-finland`, `university-of-jyvskyl`,
  and `bo-akademi-university`.
  Each verified public detail page showed the correct university name, Finland
  as country, the official URL, and the `Partially Verified` badge.

- Workflow/documentation follow-up:
  Updated `docs/10-import-workflow.md` to use the real schema/UI source type
  value `official_university` instead of `official_website`.
  Observed one admin workflow issue during the run:
  some merged staging university rows still rendered as `approved` on the batch
  detail page instead of clearly showing `merged`, even though the production
  rows were created successfully. No code change was made in Phase 49.

Files modified (3):
  docs/06-status.md
  docs/07-task-log.md
  docs/10-import-workflow.md

Validation results:
  npm run build: PASS (Cloudflare server build, Server built in 9.82s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts: 0 matches.
  createServiceClient in src/pages,src/components,src/layouts: 0 matches.
  innerHTML|set:html in src/pages,src/components: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
  git diff package.json package-lock.json: 0 lines (no dependency changes).


Phase 48 — Starter University Data Pack (complete):

- Added a reviewed Finland starter university pack under `data/starter/` for later
  use with the existing admin bulk JSON import workflow.
  The JSON file contains exactly 8 universities and uses only the existing
  university import fields: `name`, `country_code`, and `official_url`.

- Added companion source notes documenting the official first-party source URL
  used for each row and the verification date.
  Tampere University is explicitly flagged for manual review because
  `https://www.tuni.fi/en` is a shared Tampere Universities domain covering both
  Tampere University and Tampere University of Applied Sciences.

- Kept Phase 48 within the approved non-operational boundary:
  no import batches, no admin paste/import run, no quality checks in admin,
  no review/approval/merge actions, no Supabase mutation, no `src/` edits, no
  migrations, and no dependency changes.

Files created (2):
  data/starter/universities.phase48.json
  data/starter/universities.phase48.sources.md

Files modified (2):
  docs/06-status.md
  docs/07-task-log.md

Validation results:
  JSON parse + rule checks: PASS (8 rows; all `country_code` values `FI`; all URLs `https://`; no duplicate names; no duplicate URLs; all rows covered by source notes).
  npm run build: PASS.
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  innerHTML|set:html in pages/components: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
  git diff package.json package-lock.json: 0 lines (no dependency changes).


Phase 47 — Initial Real Data Import Bundle — workflow and templates foundation (complete):

- Added `docs/10-import-workflow.md` as the admin import workflow reference.
  The guide documents the JSON-only import path, universities-first recommendation,
  entity field references, warning/error handling, quality checks, manual review,
  merge rules, post-merge data source entry, and common troubleshooting cases.

- Added placeholder-only JSON templates under `data/import-templates/`:
  `universities.example.json`, `programs.example.json`,
  `scholarships.example.json`, and `articles.example.json`.
  These files intentionally use obvious example names and are not real starter
  datasets.

- Documented the hard boundary for Phase 47:
  no real Supabase/admin import run, no import batches, no pasted real data,
  no review actions, no merges, no production data mutation, no `src/` edits,
  no migrations, and no dependency changes.

- Actual real data import remains an operational step after template/workflow
  review and explicit approval. It is not performed automatically by this
  code/docs update.

Files created (5):
  docs/10-import-workflow.md
  data/import-templates/universities.example.json
  data/import-templates/programs.example.json
  data/import-templates/scholarships.example.json
  data/import-templates/articles.example.json

Files modified (2):
  docs/06-status.md
  docs/07-task-log.md

Validation results:
  npm run build: PASS (Cloudflare server build, Server built in 13.37s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  innerHTML|set:html in pages/components: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
  git diff package.json package-lock.json: 0 lines (no dependency changes).


Phase 46 — Import Quality Hardening Bundle (complete):

- Added explicit "Run quality checks" admin action on the import batch detail page.
  Admin clicks "Run quality checks" after adding staging rows; server runs deterministic
  checks and writes results to staging_errors. No import_status changes. No production
  writes. No auto-review, auto-approve, or auto-merge. Idempotent: re-running replaces
  previous Phase 46 warnings without touching validation_warning entries.

- New `src/lib/admin/importQuality.ts`:
  Pure normalization helper: `normalizeForMatch(s)` — lowercase, trim, collapse whitespace.
  Per-entity same-batch duplicate detection (in-memory, no DB):
    `detectUniSameBatchDuplicates(rows)` — by normalized name; also by official URL if present.
    `detectProgSameBatchDuplicates(rows)` — by normalized title + staging_university_id + degree_level_code.
    `detectScholSameBatchDuplicates(rows)` — by normalized name.
    `detectArtSameBatchDuplicates(rows)` — by exact slug; also by normalized title.
  Per-entity production match detection (SELECT-only Supabase queries):
    `detectUniProductionMatches(supabase, rows)` — ilike name match; eq official_url match.
    `detectProgProductionMatches(supabase, rows)` — ilike title match on programs table.
    `detectScholProductionMatches(supabase, rows)` — ilike name match on scholarships table.
    `detectArtProductionMatches(supabase, rows)` — eq slug match; ilike title match on articles table.
  Production queries use per-name parallel SELECT queries with Supabase ilike/eq (no .or() filter
  strings — avoids fragility with special characters in names). False positives and false negatives
  are acceptable — warnings are informational only.
  All functions return `QualityWarning[]` — no DB writes inside the helper.
  No Supabase production table INSERT/UPDATE/DELETE anywhere in this file.

- Modified `src/pages/admin/imports/[id].astro`:
  Added `_action=run_quality_checks` POST branch:
    1. For each entity type in the batch (universities/programs/scholarships/articles or mixed):
       Fetches up to 100 staging rows (fresh SELECT, not display-limit-constrained).
    2. Calls same-batch and production-match helpers. Combines all QualityWarning results.
    3. Deletes previous Phase 46 quality warnings for this batch only:
         DELETE FROM staging_errors WHERE import_batch_id = batchId
           AND error_type IN ('same_batch_duplicate', 'possible_production_match')
       Validation warnings (error_type = 'validation_warning') are never touched.
    4. Batch-inserts new staging_errors rows (if any warnings).
    5. PRG redirect to ?quality=N.
  Added `qualitySummary` URL param reading: reads ?quality=N param after redirect.
  Added purple quality summary banner: "Quality checks complete. N warning(s) found."
    or "No quality warnings found." — shown on GET after redirect.
  Added red quality error banner: shown when quality check POST fails without redirect.
  Added "Run quality checks" POST form above staging tables (visible when totalStaged > 0).
  Existing per-row staging_errors display (errsByRowId map) automatically shows quality
  warnings in the Actions column alongside validation warnings.
  Existing review, merge, and bulk_import flows unchanged.

- No migration. `staging_errors.error_type` is free-form TEXT — no CHECK constraint.
  New error_type values 'same_batch_duplicate' and 'possible_production_match' work without schema changes.
- No new npm dependencies.
- No service role in pages/components/layouts.
- No innerHTML / set:html.
- No public UI changes.
- No production INSERT/UPDATE/DELETE.

Deferred to Phase 47+:
  URL extraction from raw_data jsonb for programs/scholarships production-match.
  Cross-batch duplicate detection (same record in two different batches).
  Filter toggles on staging table UI ("warnings only", "duplicates only").
  `duplicate_of_id` auto-population (remains human-set after review).
  Async quality checks for very large batch sizes (current max 100 rows).

Files created (1):
  src/lib/admin/importQuality.ts

Files modified (1):
  src/pages/admin/imports/[id].astro

Validation results:
  npm run build: PASS (Cloudflare server build, Server built in 12.93s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  innerHTML|set:html in pages/components: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
  insert/update/delete in importQuality.ts: 0 matches (SELECT-only).
  git diff package.json package-lock.json: 0 lines (no dependency changes).


Phase 45 — Structured File Import Bundle (complete):

- Added paste-based JSON array bulk import into existing staging tables.
  Admin opens a batch, pastes a JSON array into a textarea, selects entity type
  (auto-selected for non-mixed batches), and submits. Server parses, validates, inserts.

- New `src/lib/admin/importParse.ts`:
  Pure/deterministic JSON array parser and per-entity field mapper. No Supabase calls.
  `parseBulkJson(input, entityType)` returns `{ ok, rows, nonObjectCount }` or
  `{ ok: false, error }`. Handles: empty input, non-JSON, non-array, arrays > 100 rows,
  non-object array elements (counted as failures, excluded from rows). Entity mappers:
    universities — name → extracted_name, country_code, official_url.
    programs — title, degree_level_code, language, tuition_amount, deadline,
               staging_university_id (UUID format-checked; batch-scope validated in page).
    scholarships — name, amount (numeric), deadline.
    articles — title, slug, category, content.

- Modified `src/pages/admin/imports/[id].astro`:
  Added `_action=bulk_import` POST branch:
    1. Entity type and batch type validated against allowlists.
    2. JSON input parsed via `parseBulkJson()`.
    3. For programs: batch-scoped SELECT on staging_universities to validate any
       staging_university_id values (must belong to same import_batch_id); invalid
       IDs set to null with a validation warning added to that row.
    4. Per-row: `validateStagedRecord()` called (existing); all warnings (parse +
       validation) combined; import_status = 'validated' if zero warnings, 'pending'
       if any.
    5. Per-row staging INSERT (universities / programs / scholarships / articles).
       DB errors: server-side console.error only; row counted as failed; no raw error
       to browser.
    6. All staging_errors rows (for warned rows that inserted) batch-inserted at end.
    7. import_batches counts updated (best-effort; failure non-fatal):
         total_records   += received (all array items including non-objects)
         processed_count += inserted (rows that made it into staging, warned or not)
         error_count     += failed (non-object items + DB insert errors)
       Validation warnings are NOT counted as error_count — warned rows still insert
       and are counted in processed_count only.
    8. PRG redirect to `?imported=N&warned=N&failed=N`.
  Added bulkSummary URL param reading on GET; green summary banner on page.
  Added Bulk JSON Import <details> section above the manual-entry form.
  Existing manual-entry form, review actions, and merge actions unchanged.

- No migration.
- No new npm dependencies.
- JSON-only paste import. CSV deferred. File upload / import_files deferred.
- No production table writes.
- No auto-review, auto-approve, or auto-merge.
- No service role in pages/components/layouts.
- No innerHTML / set:html.
- No public UI changes.

Deferred to Phase 46+:
  CSV import (textarea or file).
  File upload + Supabase Storage + import_files row creation.
  Async/background processing for large batches.
  Duplicate detection during import.
  staging_university_id auto-resolution by university name.
  Programs update-existing mode.

Files created (1):
  src/lib/admin/importParse.ts

Files modified (1):
  src/pages/admin/imports/[id].astro

Validation results:
  npm run build: PASS (Cloudflare server build, Server built in 4.63s, zero errors).
  service_role / SERVICE_ROLE / SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  innerHTML / set:html in pages/components/layouts: 0 matches.
  PUBLIC_SUPABASE_SERVICE / PUBLIC_.*SERVICE in src/: 0 matches.
  git diff package.json package-lock.json: 0 lines (no dependency changes).


Phase 44 — Program Merge + Safe Update MVP Bundle (complete):

- No migration required. All required match columns and enum values already existed.

- `src/lib/admin/importMerge.ts` extended:
  - `MergeEntityType` union now includes `'programs'`.
  - `MergeAction` type exported: `'create_new' | 'update_existing'`.
  - `mergeApprovedRow()` accepts optional `action` param (defaults to `'create_new'`).
  - `mergeProgram()`: create-new for programs. Resolves university_id via
    staging_university_id → staging_universities.match_university_id chain.
    Resolves country_id from production university. Resolves degree_level_id from
    active degree_levels.code. Slug generated with 4-step fallback sequence
    (title / title+code / title+code+uniSlug / title+code+shortUniId).
    Optional: language_of_instruction, tuition_min_amount. Defaults: draft/unverified/draft.
    Blocked if: staging_university_id null, staged university not merged,
    degree_level_code not found, country_id missing, all slug candidates conflict.
  - `updateExistingRow()` exported: dispatches to entity-specific update-existing helpers.
  - `updateExistingUniversity()`: patches official_url if null in production and
    staging extracted_official_url is non-empty. Errors if nothing safe to patch.
  - `updateExistingScholarship()`: patches amount_min and/or deadline_text if null
    in production and staging has values. Errors if nothing safe to patch.
  - `updateExistingArticle()`: patches content if null/empty in production and
    staging extracted_content is non-empty. Errors if nothing safe to patch.
  - All update-existing helpers: re-read staged row at POST time; verify approved
    status; verify match target exists; patch-if-empty only; mark staged 'merged'
    after successful patch; leave match_*_id and review_notes unchanged.

- `src/pages/admin/imports/[id].astro` extended:
  - Type definitions updated: StagingUniversity + match_university_id,
    StagingProgram + staging_university_id + match_program_id,
    StagingScholarship + match_scholarship_id, StagingArticle + match_article_id.
  - SELECT queries extended to fetch the new columns.
  - Program eligibility batch-resolved after data load (no N+1):
    collect unique staging_university_ids from approved program rows → batch-fetch
    staging_universities.match_university_id → build Map<rowId, ProgEligibility>.
  - POST handler: reads merge_action ('create_new'|'update_existing'); passes action
    to mergeApprovedRow. Defaults to 'create_new' for any unrecognised value.
  - University actions cell: create-new shown when match_university_id null;
    update-existing shown when match_university_id set; both require confirmation.
  - Scholarship actions cell: same pattern (amount_min + deadline_text patch note).
  - Article actions cell: same pattern (content patch note).
  - Program actions cell: create-new form shown only when eligibility chain resolves;
    blocked reason shown otherwise. No update-existing for programs.

- Deferred to Phase 45+:
  - programs update-existing mode
  - manual production university picker for programs
  - bulk merge, auto-merge, duplicate resolution
  - verification_events on merge, data_sources linkage
  - article category FK, scholarship currency


Phase 42 — Staging Review + Safe Merge Planning Bundle (complete):

- Migration 019: Added `skipped` to the `import_status` CHECK constraint on all four
  staging tables (staging_universities, staging_programs, staging_scholarships,
  staging_articles). Final allowed values: pending, processing, validated,
  duplicate_detected, needs_review, approved, rejected, error, skipped.

- New `src/lib/admin/importReview.ts`: `applyReviewAction()` helper. Validates entity
  type (allowlist), review action (allowlist), row UUID, batch UUID. Fetches current
  row status to block actions on `processing` or `error` rows. Maps actions to statuses:
  approve→approved, reject→rejected, skip→skipped, reset→pending. Reset clears
  review_notes, reviewed_by_user_id, reviewed_at. All other actions set reviewer fields.
  Always scopes UPDATE with `.eq('import_batch_id', batchId)` — a row cannot be reviewed
  across batch boundaries. No production table writes.

- `/admin/imports/[id]`: Added `_action=review` POST branch. Reads entity_type, row_id,
  review_action, review_notes from form; calls applyReviewAction; redirects on success
  or shows inline reviewError banner on failure. SELECT queries updated to include
  reviewed_by_user_id and reviewed_at. Added per-row "Actions" column to all four
  staging tables: shows per-row validation warnings (from errsByRowId map), reviewed_at
  timestamp if set, and an expandable review form with Approve/Reject/Skip/Reset buttons.
  No merge buttons. No production write actions exposed.

- Merge planning notes added to `docs/03-database-plan.md`: preconditions, merge modes
  (create vs update), entity-specific field rules, verification_status defaults, why bulk
  merge is deferred.

No production merge implemented. No bulk approve. No CSV/XLSX/JSON upload.
No AI extraction. No scraping. No background jobs. No duplicate matching.
No public UI changes. No new npm dependencies. No service role in pages/components/layouts.
No innerHTML/set:html.

Files created (2):
  supabase/migrations/019_add_skipped_status.sql
  src/lib/admin/importReview.ts

Files modified (3):
  src/pages/admin/imports/[id].astro
  docs/03-database-plan.md
  docs/06-status.md, docs/07-task-log.md

Validation results:
  npm run build: PASS (Cloudflare server build, Server built in 8.65s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
  innerHTML|set:html in pages/components: 0 matches.

## Last Completed Work


Phase 41 — Manual Staged Record Entry + Validation Preview (complete):

- New `src/lib/admin/importValidation.ts`: pure validation helpers. `parseRawData()` validates
  JSON and blocks insert on malformed input. `validateStagedRecord()` runs deterministic
  field-level checks per entity type (universities: name/URL/country code; programs: title/tuition;
  scholarships: name/amount; articles: title/slug/content length). No AI, no external calls.

- `/admin/imports/[id]`: Added POST handler for manual staged row creation. Entity-type-prefixed
  form field names (uni_*, prog_*, sch_*, art_*) avoid name collisions in the mixed-batch form.
  For non-mixed batches: hidden `entity_type` input, only the relevant fieldset shown.
  For mixed batches: entity type `<select>` + all four labeled fieldsets visible; server reads
  only the selected entity's prefixed fields. Invalid JSON blocks insert with inline form error.
  On clean insert: import_status='validated'. On warnings: import_status='pending' plus one
  staging_errors row per warning (error_type='validation_warning'). No needs_review used.
  Redirect to same page on success. No approve/reject/delete buttons added.

No schema migration. No new dependencies. No service role. No innerHTML/set:html.
No production table writes. No approve/merge workflow.

Files created (1):
  src/lib/admin/importValidation.ts

Files modified (3):
  src/pages/admin/imports/[id].astro
  docs/06-status.md, docs/07-task-log.md

Validation results:
  npm run build: passed (Server built in 8.01s).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
  innerHTML|set:html in pages/components: 0 matches.

## Last Completed Work


