# DegreeWiki Task Log Archive

> Split archive for Phase 41-50. Use the narrowest matching range first.
> Use the recent active task log only for the newest phases.

## 2026-06-19 - Phase 44: Program Merge + Safe Update MVP Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Extend staged-to-production merge with program create-new merge (FK chain–gated)
and safe update-existing mode for universities, scholarships, and articles.
No migration. No bulk merge. No destructive overwrite.

---

### Files Modified

src/lib/admin/importMerge.ts:
  MergeEntityType: extended to include 'programs'.
  MergeAction type exported: 'create_new' | 'update_existing'.
  mergeApprovedRow(): added optional action param (defaults 'create_new').
    Routes update_existing to updateExistingRow(); enforces UPDATE_EXISTING_TYPES allowlist.
    Routes programs create_new to mergeProgram().
  updateExistingRow(): exported dispatcher to entity-specific update-existing helpers.
  updateExistingUniversity(): re-reads staged row; verifies approved + match_university_id;
    reads production university; patches official_url patch-if-empty; errors if nothing to patch;
    marks staged 'merged' after success.
  updateExistingScholarship(): patches amount_min + deadline_text patch-if-empty.
  updateExistingArticle(): patches content patch-if-empty.
  mergeProgram(): six-step validation + resolution:
    1. Read staged row; check approved, match_program_id null, title+code+staging_uni present.
    2. staging_university_id → staging_universities.match_university_id (must be non-null).
    3. match_university_id → universities (id, country_id, slug); country_id must exist.
    4. extracted_degree_level_code → degree_levels.code (active=true) → degree_level_id.
    5. Slug fallback sequence: title / title+code / title+code+uniSlug / title+code+shortUniId.
    6. Insert program draft; set staging match_program_id + status=merged.
  All merge functions: re-read from DB at call time; batch+row scoped; 23505 caught.

src/pages/admin/imports/[id].astro:
  Imports: added MergeAction type from importMerge.
  StagingUniversity type: added match_university_id.
  StagingProgram type: added staging_university_id, match_program_id.
  StagingScholarship type: added match_scholarship_id.
  StagingArticle type: added match_article_id.
  SELECT queries: extended to fetch new columns.
  Program eligibility computation block (after data load):
    Filters approved programs without match_program_id.
    Batch-fetches staging_universities.match_university_id for unique staging_university_ids.
    Builds Map<rowId, ProgEligibility> — no N+1 queries.
  POST merge handler: reads merge_action; normalises to MergeAction; passes to mergeApprovedRow.
  University merge UI: create_new when match_university_id null; update_existing when set.
  Scholarship merge UI: create_new when match_scholarship_id null; update_existing when set.
  Article merge UI: create_new when match_article_id null; update_existing when set.
  Program merge UI: create_new form when progEligibility.canMerge true;
    blocked message with reason when canMerge false; nothing when already merged.
  All update-existing forms: orange button; confirmation checkbox; field patch note.
  No fake disabled buttons. No set:html. No service role. No new dependencies.

docs/03-database-plan.md:
  Updated Phase 43 merge rules section title and deferred list.
  Added Phase 44 program merge rules, update-existing rules, and deferred list.

docs/06-status.md:
  Current phase updated to Phase 44. Last completed work block added.

docs/07-task-log.md:
  This entry.

### Checks Run

npm run build: passed — no type errors, no build warnings on changed files.

Security greps (pages/components/layouts):
  service_role / SERVICE_ROLE / SUPABASE_SERVICE: 0 matches.
  createServiceClient: 0 matches.
  PUBLIC_SUPABASE_SERVICE / PUBLIC_.*SERVICE: 0 matches.
  innerHTML / set:html: 0 matches.

npm run check: not present in this project.

### Deferred

Programs update-existing mode. Manual production university picker.
Bulk merge. Auto-merge. Duplicate resolution workflow.
verification_events on merge. data_sources linkage.
Article category FK. Scholarship currency mapping.

---



## 2026-06-19 - Phase 43: Staged-to-Production Merge MVP Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add one-by-one create-new staged-to-production merge for approved staged records.
Hard boundary: no bulk merge, no auto-merge, no update-existing, no programs merge.

---

### Files Created

supabase/migrations/020_add_merged_status.sql:
  Adds 'merged' to import_status CHECK constraint on all four staging tables.
  Pattern: DROP CONSTRAINT + ADD CONSTRAINT (same as migrations 018 and 019).
  Constraint names: staging_{table}_import_status_check (explicit, set by migration 019).
  Final values: pending, processing, validated, duplicate_detected, needs_review,
  approved, rejected, error, skipped, merged. All prior values preserved.

src/lib/admin/importMerge.ts:
  mergeApprovedRow(supabase, { entityType, rowId, batchId }):
    Promise<{ok:true;productionId:string}|{ok:false;error:string}>.
  Supported entity types: universities, scholarships, articles (programs deferred).
  Entity type validated against MERGE_ALLOWED_ENTITY_TYPES allowlist before any DB access.
  UUID validation on rowId and batchId before any DB access.
  All staged data re-read from DB (never from form input).
  import_status re-confirmed as 'approved' at merge time.
  Slug uniqueness checked via maybeSingle() before insert; 23505 error caught on insert.
  Universities: country_code resolved via countries.iso2; merge blocked if no match.
  Scholarships: amount_min from extracted_amount; deadline_text from extracted_deadline (no date parse).
  Articles: slug validated with strict /^[a-z0-9]+(?:-[a-z0-9]+)*$/ regex; content optional.
  Post-merge: sets import_status='merged' and match_*_id to new production id.
  review_notes unchanged. verification_events, data_sources, batch counts deferred.

### Files Modified

src/lib/admin/badges.ts:
  Added 'merged' entry to IMPORT_STATUS_BADGE: 'bg-emerald-100 text-emerald-700'.

src/pages/admin/imports/[id].astro:
  Import: added mergeApprovedRow from importMerge.
  State: added mergeError variable.
  POST handler: added 'merge' action branch.
    Checks: confirmation value ('yes'), batch type match, delegates to mergeApprovedRow.
    On success: redirects to batch page.
    On failure: sets mergeError for inline display.
  HTML: added mergeError display block (amber, styled to match reviewError).
  Universities table: merge form and merged text added to Actions column.
    Merge form shown only when import_status === 'approved'.
    'Merged to production.' text shown when import_status === 'merged'.
  Scholarships table: same pattern.
  Articles table: same pattern.
  Programs table: no merge controls (programs merge deferred).

docs/03-database-plan.md:
  Replaced Phase 42 planning section with Phase 43 MVP implemented section.
  Documents: field mappings, eligibility rules, post-merge behavior, deferred items.

docs/06-status.md:
  Added Phase 43 complete entry.

docs/07-task-log.md:
  This entry.

---

### Deferred

- Programs merge (university_id, degree_level_id, country_id FKs not resolvable from staging)
- update-existing mode (match columns in place; deferred to Phase 44)
- article category FK mapping (extracted_category is plain text; lookup ambiguous)
- scholarship currency (not in staging schema)
- verification_events on merge
- data_sources linkage on merge
- import_batch count updates
- bulk merge
- auto-merge

---



## 2026-06-19 - Phase 42: Staging Review + Safe Merge Planning Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add super-admin review actions for staged rows (approve/reject/skip/reset) and document
future staged-to-production merge rules. Hard boundary: no production merge implementation.

---

### Files Created

supabase/migrations/019_add_skipped_status.sql:
  Adds 'skipped' to the import_status CHECK constraint on all four staging tables.
  Uses DROP CONSTRAINT + ADD CONSTRAINT pattern (same as migration 018).
  Constraint names: staging_{table}_import_status_check (auto-generated by PostgreSQL).
  Final values: pending, processing, validated, duplicate_detected, needs_review,
  approved, rejected, error, skipped. needs_review preserved.

src/lib/admin/importReview.ts:
  applyReviewAction(supabase, params): Promise<{ok:true}|{ok:false;error:string}>.
  Validates entityType against VALID_ENTITY_TYPES allowlist before building table name.
  Validates action against VALID_REVIEW_ACTIONS allowlist.
  Validates rowId and batchId as UUIDs.
  Fetches current row status (.eq('id').eq('import_batch_id')) to block on
  processing/error. UPDATE always scoped with .eq('import_batch_id', batchId).
  reset: sets status=pending, clears review_notes/reviewed_by_user_id/reviewed_at.
  approve/reject/skip: sets status, review_notes (null if blank), reviewed_by_user_id,
  reviewed_at=now(). No production table writes anywhere in this file.

### Files Modified

src/pages/admin/imports/[id].astro:
  Import: added applyReviewAction from importReview.ts.
  Added reviewError: string|null variable separate from formError.
  POST handler: branched on _action field. 'review' branch calls applyReviewAction
  and redirects on success or sets reviewError on failure. Create branch (else) unchanged
  in logic, re-indented by 2 spaces due to else block.
  Type definitions: added reviewed_by_user_id:string|null and reviewed_at:string|null
  to StagingUniversity, StagingProgram, StagingScholarship, StagingArticle.
  SELECT queries: added reviewed_by_user_id, reviewed_at to all four staging table queries.
  errsByRowId Map: built from stagingErrors after query, keyed by staging_row_id.
  UI: added reviewError banner above "Add Staged Record" form.
  All four staging tables: added Actions column header + per-row review cell showing
  inline validation warnings (from errsByRowId), reviewed_at if set, and an expandable
  <details> with a POST form (hidden _action=review, entity_type, row_id; textarea for
  review_notes pre-filled; Approve/Reject/Skip/Reset buttons using name=review_action).
  No merge buttons. No production links. No set:html or innerHTML.

docs/03-database-plan.md:
  Added "Staged-to-Production Merge Rules (Phase 42 Planning — NOT YET IMPLEMENTED)"
  section after the Import flow list. Documents: preconditions, create vs update merge
  modes, entity-specific rules (universities/programs/scholarships/articles), safe vs
  confirmation-required fields, verification_status defaults, verification_events deferral,
  and why bulk merge is deferred.

---

### Validation

npm run build: PASS (Cloudflare server build, Server built in 8.65s, zero errors).
service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
createServiceClient in pages/components/layouts: 0 matches.
PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
innerHTML|set:html in pages/components: 0 matches.

---



## 2026-06-19 - Phase 41: Manual Staged Record Entry + Validation Preview

Tool:
Claude (claude-sonnet-4-6)

Goal:
Allow super admins to manually add staged records into existing import batches and preview
deterministic validation warnings. Store rows only in staging tables. Store validation warnings
in staging_errors. No file upload, no AI, no approve/merge, no production table writes.

---

### Files Created

src/lib/admin/importValidation.ts:
  New. Pure functions only — no DB access, no external calls.
  `parseRawData(raw: string)`: returns `{ ok: true, value }` for valid JSON object or empty string;
    returns `{ ok: false, error }` for invalid JSON or non-object value. Used to block insert.
  `validateStagedRecord(entityType, values)`: returns `{ warnings: string[] }` from deterministic
    field checks:
      universities: warn if extracted_name missing; warn if extracted_official_url missing or
        invalid URL; warn if extracted_country_code non-empty but not 2 chars.
      programs: warn if extracted_title missing; warn if extracted_tuition_amount non-numeric.
      scholarships: warn if extracted_name missing; warn if extracted_amount non-numeric.
      articles: warn if extracted_title missing; warn if extracted_slug missing or fails
        /^[a-z0-9-]+$/; warn if extracted_content non-empty but < 50 chars.
  Private `isValidUrl()` uses `new URL()` — no network calls.

---

### Files Modified

src/pages/admin/imports/[id].astro:
  Added import of parseRawData, validateStagedRecord, StagedEntityType from importValidation.ts.
  Added helper constants: VALID_ENTITY_TYPES, ENTITY_PREFIX (uni_/prog_/sch_/art_),
    STAGING_TABLE_NAME map, nullIfEmpty(), numericOrNull().
  Added POST handler block (before GET data loading):
    - Reads entity_type from form; validates against VALID_ENTITY_TYPES.
    - Rejects entity_type that doesn't match batch_type (unless batch is mixed).
    - Calls parseRawData(); if invalid JSON sets formError and falls through to render.
    - Reads entity-type-prefixed form fields (e.g., uni_extracted_name for universities).
    - Calls validateStagedRecord(); assigns import_status='validated' (no warnings) or
      import_status='pending' (warnings present). Does not use needs_review.
    - Inserts into correct staging table (literal table name per entity branch, not dynamic).
    - On insert failure: sets formError, falls through to render.
    - On success: if warnings exist, inserts one staging_errors row per warning
      (error_type='validation_warning', staging_table=staging_*, staging_row_id=inserted.id).
      Then redirects to /admin/imports/{b.id}.
  Added "Add Staged Record" <details> collapsible form between batch metadata and records tables.
    Form uses entity-type-prefixed input names to avoid name collisions (extracted_name shared by
    universities and scholarships; extracted_title shared by programs and articles;
    extracted_deadline shared by programs and scholarships).
    Non-mixed batches: hidden entity_type input, only the relevant <fieldset> shown.
    Mixed batches: entity type <select> (required) + all four labeled <fieldset> groups visible;
      server reads only the selected entity's prefixed fields via ENTITY_PREFIX map.
    Shared raw_data textarea at bottom (no prefix needed, no name collision).
    Form opens automatically (open attribute) if formError is set.
    Inline error banner shown if formError is set.
    No approve/reject/delete buttons. No JS required.
  No changes to GET data loading or existing staging record tables.
  Added INPUT_CLS and LABEL_CLS string constants for form styling consistency.

---

### Checks Run

npm run build: passed — Server built in ~8s, no errors.
Get-ChildItem src/pages,src/components,src/layouts | Select-String "service_role|SERVICE_ROLE|SUPABASE_SERVICE": 0 matches.
Get-ChildItem src/pages,src/components,src/layouts | Select-String "createServiceClient": 0 matches.
Get-ChildItem src/ | Select-String "PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE": 0 matches.
Get-ChildItem src/pages,src/components | Select-String "innerHTML|set:html": 0 matches.

---

### Deferred

CSV/XLSX/JSON upload · AI extraction · scraping · background jobs · approve/reject/merge workflow ·
production table writes · row editing/deletion · duplicate detection · field-level source tracking ·
data_quality_checks integration · public display of staged data.

---



## 2026-06-19 - Phase 50: Starter Content Activation Bundle

Tool:
Claude Sonnet 4.6 (Claude Code)

Goal:
Fix import workflow bugs (fire-and-forget staging UPDATE; updateExistingUniversity
not setting match_university_id; no link-to-production UI for staging universities),
prepare verified Finland master's programme data, write 2 guide articles, update
workflow docs, validate build and security, and commit. Operational import run
(admin UI steps) to follow separately.

---

### Code Changes

**importMerge.ts — fire-and-forget fix (all 4 merge functions):**
Added error capture to staging UPDATE calls in `mergeUniversity`, `mergeScholarship`,
`mergeArticle`, and `mergeProgram`. On failure: logs with `console.error`, returns
`ok: true` with an optional `warning` string. Changed return type to include
`warning?: string`.

**importMerge.ts — updateExistingUniversity fix:**
Removed early-exit "Nothing safe to patch" error. The function now proceeds to mark
the staging row merged and sets `match_university_id: prodRow.id` regardless of
whether any production field was patched. Staging UPDATE error is also captured and
surfaced as a warning.

**[id].astro — set_match_university_id action:**
New POST action that writes only `staging_universities.match_university_id`. Validates:
row UUID format, production UUID format, batch membership, approved status, production
university existence. No production writes.

**[id].astro — set_match_university_id UI:**
Added a collapsible "Link to existing production university" form in the university row
Actions column. Shown when `import_status === 'approved' && !match_university_id`.
Accepts a UUID text input and submits to the new action. The create-new merge form
remains visible in the same block.

**[id].astro — mergeWarning banner:**
Added yellow banner rendered from `?mergeWarning=` query param (after PRG redirect
when merge returns `ok: true` but `warning` is set).

**[id].astro — setMatchError banner:**
Added amber error banner for `setMatchError` (POST-side failure from `set_match_university_id`).

### Data Files Prepared

- `data/starter/programs.phase50.json` — 13 verified English-taught Finland master's
  programmes across all 8 Phase 49 universities. `degree_level_code: "master"` for all.
  `staging_university_id` placeholders must be filled from batch detail page before import.
  Tuition included for 6 programmes where officially confirmed (Aalto: 17000 EUR/year,
  Tampere: 12000 EUR/year, JYU: 12000 EUR/year). No deadlines (change annually).

- `data/starter/programs.phase50.sources.md` — Source URL documentation, UUID assignment
  worksheet, per-university official page URLs, tuition verification notes, and post-merge
  data source entry instructions.

- `data/starter/articles.phase50.json` — 2 guide articles:
  "Study in Finland: A Starter Guide for International Students"
  (slug: `study-in-finland-starter-guide`, category: `country-guides`) and
  "How to Compare English-Taught Master's Programmes in Finland"
  (slug: `compare-english-masters-finland`, category: `program-guides`).
  No data source attachment (no valid source_type for editorial content).
  `article_category_id` must be set manually post-merge via admin article edit page.

### Template and Docs Fixes

- `data/import-templates/programs.example.json`: corrected `degree_level_code` from
  `"masters"` (wrong) to `"master"` (correct per migration 015 seed data).
- `docs/10-import-workflow.md`: same correction in field reference example; added
  "Importing Programs Against Existing Production Universities" section (9-step workflow
  for mixed-batch imports using set_match_university_id).

### Exclusions

- Scholarships excluded: Finnish government master's scholarships do not exist
  (confirmed studyinfinland.fi). University scholarship pages not reachable at research time.
- Article data sources excluded: `official_editorial` is not a valid source_type in the
  schema (valid values: official_university, government, third_party, aggregator,
  user_submitted).

### Validation

- npm run build: PASS (Server built in 10.56s, zero errors).
- service_role in src/: 0 matches.
- createServiceClient in src/pages, src/components, src/layouts: 0 matches.
- innerHTML|set:html in src/: 0 matches.
- PUBLIC_SUPABASE_SERVICE in src/: 0 matches.
- git diff package.json: 0 lines (no dependency changes).

---



## 2026-06-19 - Phase 49: Full Starter University Import + Activation

Tool:
Codex (GPT-5)

Goal:
Complete the end-to-end activation of the Finland Phase 48 starter university
pack using only the existing admin UI workflow: staging import, quality checks,
row review, safe merge decisions, production source attachment, publishing,
verification, docs updates, validation checks, commit, tag, and push. No
direct SQL, no manual table edits outside admin flows, no service role usage,
no schema changes, and no new dependencies.

---

### Operational Scope Completed

- Created and used import batch:
  `bd0805e8-3264-4e9c-82bc-099af5b78b23`
- Imported the exact Phase 48 JSON starter pack into staging.
- Ran quality checks.
- Reviewed all 8 staged university rows.
- Rejected duplicate staged rows instead of creating duplicate production rows.
- Merged safe new rows with the existing one-row-at-a-time create-new flow.
- Added official production data sources through admin university edit pages.
- Published safe draft rows after source verification.
- Verified admin and public visibility using the saved production slugs.
- Updated docs and corrected the `official_website` wording mismatch to
  `official_university`.

### Import / Review Summary

- Imported: 8
- Warned: 0
- Failed: 0
- Quality-check warnings: 1
- Warning type summary:
  - validation_warning: 0
  - same_batch_duplicate: 0
  - possible_production_match: 1

Only quality warning:
- `possible_production_match` for `University of Helsinki`

### Review / Merge Decisions

Approved and merged with `create_new` (5):
- Aalto University
- Tampere University
- University of Oulu
- University of Eastern Finland
- University of Jyväskylä

Rejected as duplicates after production inspection (3):
- University of Helsinki
- University of Turku
- Åbo Akademi University

Helsinki decision:
- Existing production `University of Helsinki` row was inspected first.
- It was already the same institution, already published, and already had the
  correct official URL `https://www.helsinki.fi/en`.
- No safe update was needed.
- The staged Helsinki row was rejected as a duplicate.

Unexpected duplicate findings:
- `University of Turku` already existed in production as a draft university row
  with the correct official URL `https://www.utu.fi/en`.
- `Åbo Akademi University` already existed in production as a draft university
  row with the correct official URL `https://www.abo.fi/en/`.
- Their staged rows were rejected as duplicates instead of creating new rows.

### Production Activation Outcome

Source records added (8):
- Aalto University — `https://www.aalto.fi/en`
- University of Helsinki — `https://www.helsinki.fi/en`
- Tampere University — `https://www.tuni.fi/en`
- University of Turku — `https://www.utu.fi/en`
- University of Oulu — `https://www.oulu.fi/en`
- University of Eastern Finland — `https://www.uef.fi/en`
- University of Jyväskylä — `https://www.jyu.fi/en`
- Åbo Akademi University — `https://www.abo.fi/en/`

All 8 source rows used:
- `source_type = official_university`
- `confidence_level = high`
- `source_status = active`
- `is_primary_source = true`

Publishing outcome:
- Newly published from draft in this phase: 7
- Already published and retained: 1 (`University of Helsinki`)
- Final public Finland university total from this activation set: 8

Verification status outcome:
- All 8 Finland university rows were set to `partially_verified` after source
  verification.

### Tampere Manual Note

- Tampere University had no automated admin warning.
- The source `https://www.tuni.fi/en` is a shared Tampere Universities domain
  covering both Tampere University and Tampere University of Applied Sciences.
- Manual review accepted this URL as the official first-party web presence for
  the Tampere University row in this starter pack, and the row was published.

### Unicode / Slug Note

- Two production names were corrected through the existing admin edit workflow
  after merge/import handling:
  - `University of Jyväskylä`
  - `Åbo Akademi University`
- Public verification used the actual saved slugs currently present in
  production:
  - `university-of-jyvskyl`
  - `bo-akademi-university`

### Verification Completed

Admin verification:
- `/admin/universities` showed all activated Finland rows.
- Each activated university had the expected name, official URL, and published
  or retained-published status.
- Each activated university had one official primary data source attached.

Public verification:
- `/universities` listed all 8 Finland universities.
- Detail pages loaded successfully for:
  - `/universities/aalto-university`
  - `/universities/university-of-helsinki`
  - `/universities/tampere-university`
  - `/universities/university-of-turku`
  - `/universities/university-of-oulu`
  - `/universities/university-of-eastern-finland`
  - `/universities/university-of-jyvskyl`
  - `/universities/bo-akademi-university`
- Verified on public detail pages:
  - correct university name
  - country displayed as Finland
  - official website link present
  - `Partially Verified` badge present

### Workflow Issue Observed

- The import batch detail page continued to show some successfully merged
  university staging rows as `approved` instead of clearly rendering them as
  `merged`, even though the production rows existed and were subsequently
  verified. No code change was made in this phase.

### Files Modified

docs/06-status.md
  Updated current phase and added the Phase 49 completion summary and
  validation results.

docs/07-task-log.md
  This entry.

docs/10-import-workflow.md
  Corrected post-merge source type wording from `official_website` to the
  actual schema/UI value `official_university`.

### Checks Run

npm run build:
  PASS (Cloudflare server build, Server built in 9.82s, zero errors).

Security greps:
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts: 0 matches.
  createServiceClient in src/pages,src/components,src/layouts: 0 matches.
  innerHTML|set:html in src/pages,src/components: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.

Dependency check:
  git diff package.json package-lock.json: 0 lines.

### Explicit Exclusions Respected

No direct SQL.
No manual Supabase table edits outside approved admin UI flows.
No service role usage.
No import of programs, scholarships, or articles.
No scraping or crawling.
No new dependencies.
No schema changes.
No source-code changes in `src/`.

---



## 2026-06-19 - Phase 48: Starter University Data Pack

Tool:
Codex (GPT-5)

Goal:
Create a reviewed starter university data pack for later admin bulk JSON import,
using only official university sources. Keep scope limited to data/docs files only.
Do not create import batches, paste data into admin, run admin quality checks,
approve/merge rows, mutate Supabase data, edit `src/`, create migrations, add
dependencies, or commit.

---

### Files Created

data/starter/universities.phase48.json
  Finland starter university pack with exactly 8 rows for later use in the
  existing universities bulk JSON import flow. Each row uses only:
  `name`, `country_code`, `official_url`.

data/starter/universities.phase48.sources.md
  Companion source notes file. Includes one section per university with:
  university name, official URL used, verification date, and a short note that
  the URL is an official first-party source. Tampere University is explicitly
  marked for manual review because `https://www.tuni.fi/en` is a shared Tampere
  Universities domain.

### Files Modified

docs/06-status.md
  Added Phase 48 completion entry, created/modified file list, and validation summary.

docs/07-task-log.md
  This entry.

### Source Set Used

- Aalto University — `https://www.aalto.fi/en`
- University of Helsinki — `https://www.helsinki.fi/en`
- Tampere University — `https://www.tuni.fi/en`
- University of Turku — `https://www.utu.fi/en`
- University of Oulu — `https://www.oulu.fi/en`
- University of Eastern Finland — `https://www.uef.fi/en`
- University of Jyväskylä — `https://www.jyu.fi/en`
- Åbo Akademi University — `https://www.abo.fi/en/`

### Explicit Exclusions

No import batches created.
No data pasted into admin.
No admin quality checks run.
No review, approval, reject, skip, reset, or merge actions.
No Supabase mutation.
No `src/` edits.
No migrations.
No dependency changes.
No package file edits.
No commit.

### Checks Run

JSON validation:
  PASS — parses successfully as a top-level array.
  PASS — exactly 8 rows.
  PASS — every `country_code` is `FI`.
  PASS — every `official_url` starts with `https://`.
  PASS — no duplicate names.
  PASS — no duplicate official URLs.
  PASS — every JSON row has a matching source-note section.

npm run build:
  PASS.

Security greps:
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  innerHTML|set:html in pages/components: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.

Dependency check:
  git diff package.json package-lock.json: 0 lines.

---



## 2026-06-19 - Phase 47: Initial Real Data Import Bundle - Workflow and Templates Foundation

Tool:
Codex (GPT-5)

Goal:
Add the import workflow documentation and placeholder JSON templates needed before
any real operational import run. Keep Phase 47 docs/templates/process only.
Do not create import batches, paste real data, review rows, merge rows, modify
Supabase data, edit `src/`, create migrations, or add dependencies.

---

### Files Created

docs/10-import-workflow.md
  Admin import workflow reference. Covers the JSON-only import workflow,
  universities-first recommendation, field references for universities/programs/
  scholarships/articles, warning and error handling, quality checks, manual
  review, one-row-at-a-time merge, post-merge data source entry, troubleshooting,
  and the direct-production-write prohibition.

data/import-templates/universities.example.json
  Placeholder-only university import template with obvious example institution
  names. Not a real starter dataset.

data/import-templates/programs.example.json
  Placeholder-only program import template. Uses example staged university UUIDs
  to show required shape; not real data.

data/import-templates/scholarships.example.json
  Placeholder-only scholarship import template. Not real data.

data/import-templates/articles.example.json
  Placeholder-only article import template. Not real content.

### Files Modified

docs/06-status.md
  Added Phase 47 completion entry and documented that actual real data import is
  an operational step after review and explicit approval, not part of this update.

docs/07-task-log.md
  This entry.

### Explicit Exclusions

No real Supabase/admin import run.
No import batches created.
No real data pasted into admin.
No row review actions.
No row merge actions.
No production data mutation.
No `src/` edits.
No migrations.
No dependency changes.
No package file edits.

### Checks Run

npm run build: PASS (Cloudflare server build, Server built in 13.37s, zero errors).

Security greps:
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  innerHTML|set:html in pages/components: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.

Dependency check:
  git diff package.json package-lock.json: 0 lines.

---



## 2026-06-19 - Phase 46: Import Quality Hardening Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add import-quality warning checks to the staging import workflow.
Detect same-batch duplicates and possible production matches as advisory warnings.
All warnings are non-destructive: no import_status changes, no production writes,
no auto-review, no auto-approve, no auto-merge. Idempotent re-run replaces previous
Phase 46 warnings only; validation warnings from Phase 45 are never touched.

---

### Files Created

src/lib/admin/importQuality.ts
  Pure normalization (normalizeForMatch), per-entity same-batch duplicate detection
  (in-memory), per-entity production match detection (SELECT-only Supabase queries).
  Returns QualityWarning[] from all functions. No DB writes inside helpers.
  Eight exported functions: detectUniSameBatchDuplicates, detectUniProductionMatches,
  detectProgSameBatchDuplicates, detectProgProductionMatches,
  detectScholSameBatchDuplicates, detectScholProductionMatches,
  detectArtSameBatchDuplicates, detectArtProductionMatches.

### Files Modified

src/pages/admin/imports/[id].astro
  Added _action=run_quality_checks POST handler.
  Added qualitySummary URL param read + purple summary banner.
  Added qualityError state + red error banner.
  Added "Run quality checks" POST form above staging tables.

### Checks Passed

npm run build: PASS (Server built in 12.93s, zero errors).
service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
createServiceClient in pages/components/layouts: 0 matches.
innerHTML|set:html in pages/components: 0 matches.
PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
insert/update/delete in importQuality.ts: 0 matches.
git diff package.json package-lock.json: 0 lines.

---



## 2026-06-19 - Phase 45: Structured File Import Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add paste-based JSON array bulk import into existing staging tables.
Admin pastes a JSON array, selects entity type, server parses/validates/inserts.
Staging only. No production writes. No auto-review. No auto-merge.
CSV and file upload deferred.

---

### Files Created

src/lib/admin/importParse.ts:
  New pure/deterministic JSON array parser and per-entity field mapper.
  No Supabase calls — intentional; batch-scope DB validation stays in the page handler.
  Exports:
    MAX_BULK_ROWS = 100.
    BulkParsedRow type: { rawData, fields: Record<string, string | number | null>, parseWarnings }.
    BulkParseResult type: discriminated union ok/error.
    parseBulkJson(input, entityType): BulkParseResult.
  Error returns: empty input, non-JSON, non-array, array length > MAX_BULK_ROWS.
  Non-object array elements: excluded from rows[], counted in nonObjectCount (caller
    adds to failed count).
  Entity field mappers:
    mapUniversity: name → extracted_name; country_code; official_url.
    mapProgram: title; degree_level_code; language; tuition_amount (numeric); deadline;
      staging_university_id — UUID regex check at parse time; batch-scope check in page.
      Invalid UUID format: null + parseWarning.
    mapScholarship: name; amount (numeric); deadline.
    mapArticle: title; slug; category; content.
  All str() coercions return null for empty/null/undefined.
  num() returns null for empty/non-numeric values.

### Files Modified

src/pages/admin/imports/[id].astro:
  Imports: added parseBulkJson from importParse.
  Variables: added bulkImportError (string | null).
  Added _action=bulk_import POST branch (inserted between merge and single-row branches):
    1. entity_type validated against VALID_ENTITY_TYPES allowlist.
    2. Batch type / entity type mismatch check (same rule as single-row entry).
    3. parseBulkJson() called on textarea value.
    4. Programs only: batch-scoped SELECT on staging_universities for candidate
       staging_university_ids; invalid IDs set to null + warning added to that row.
    5. Per-row loop:
       a. validateStagedRecord() called on string-coerced field values.
       b. Parse warnings + validation warnings combined.
       c. import_status = 'validated' (0 warnings) or 'pending' (any warnings).
       d. Entity-specific INSERT into staging table (.select('id').single()).
       e. DB error: console.error(code only); insertFailed = true; no staging_errors.
    6. errorEntries[] collected; single batch staging_errors INSERT after loop.
    7. import_batches counts updated (best-effort UPDATE; failure is console.error only):
         total_records   += rows.length + nonObjectCount
         processed_count += inserted
         error_count     += failed (non-objects + DB failures; warnings not included)
    8. return Astro.redirect(.../admin/imports/${id}?imported=N&warned=N&failed=N).
  Added bulkSummary URL param reading (GET section, before staging data queries):
    importedParam from searchParams; bulkSummary null when absent.
  Template additions (above manual-entry <details>):
    Green summary banner: shown when bulkSummary !== null; shows inserted/warned/failed counts.
      Warned rows: prompts to check Staging Errors section.
      Failed count: shown in red if > 0.
    Red bulkImportError banner: shown when bulkImportError is set.
    Bulk JSON Import <details> section:
      Auto-opens when bulkImportError is set.
      Entity type select for mixed batches; hidden field for typed batches.
      Textarea (rows=10, font-mono text-xs, entity-specific placeholder).
      Field key hint below textarea per entity type.
      Submit button "Import Rows" (POST _action=bulk_import).
  No changes to existing manual-entry form, review actions, or merge actions.

docs/06-status.md:
  Current phase updated to Phase 45. Phase 45 completed work block added.

docs/07-task-log.md:
  This entry.

### Batch Count Semantics (documented in code comment)

total_records: rows received = all array items (including non-objects that failed).
processed_count: rows successfully inserted into staging (validated or pending; both count).
error_count: rows that failed to insert = non-object parse failures + DB insert errors.
Validation warnings: tracked in staging_errors; do NOT increment error_count.

### Deferred

CSV import (textarea or file) — needs robust quoting/encoding parser.
File upload + Supabase Storage + import_files rows — storage_path NOT NULL blocks paste use.
Async/background processing — not needed for ≤100 rows.
Duplicate detection during import.
staging_university_id auto-resolution by university name.
Programs update-existing mode.

### Checks Run

npm run build: PASS (Cloudflare server build, Server built in 4.63s, zero errors).

Security greps (pages/components/layouts):
  service_role / SERVICE_ROLE / SUPABASE_SERVICE: 0 matches.
  createServiceClient: 0 matches.
  innerHTML / set:html: 0 matches.
  PUBLIC_SUPABASE_SERVICE / PUBLIC_.*SERVICE in src/: 0 matches.

importParse.ts Supabase grep: 1 match — JSDoc comment "no Supabase calls" only.
  No imports or function calls referencing Supabase.

Dependency check:
  git diff package.json package-lock.json: 0 lines — no new dependencies added.

---



