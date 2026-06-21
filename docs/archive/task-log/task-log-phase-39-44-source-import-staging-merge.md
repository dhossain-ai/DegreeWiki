# DegreeWiki Task Log Archive: Phase 39-44

Extracted from the 2026-06-21 pre-compaction snapshot. Covers source/verification, import/staging, and merge workflows.

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


## 2026-06-19 - Phase 40: Import / Staging Foundation Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Complete the import/staging foundation by adding the missing staging_articles table,
extending batch type and error table constraints, adding a manual import batch creation
form to /admin/imports, and adding a read-only /admin/imports/[id] detail page.
No CSV/file upload, no parsing, no AI extraction, no approve/merge workflow.

---

### Files Created

supabase/migrations/018_import_staging_articles.sql:
  Additive. Three changes:
  1. ALTER TABLE import_batches: drops and re-adds batch_type CHECK to include 'articles'.
  2. ALTER TABLE staging_errors: drops and re-adds staging_table CHECK to include 'staging_articles'.
  3. CREATE TABLE staging_articles: mirrors staging_universities/programs/scholarships conventions.
     Columns: id, import_batch_id (FK→import_batches CASCADE), raw_data (jsonb),
     extracted_title, extracted_slug, extracted_category, extracted_content,
     match_article_id (FK→articles SET NULL), import_status (CHECK), duplicate_of_id (self-ref),
     review_notes, reviewed_by_user_id (FK→user_profiles SET NULL), reviewed_at,
     created_at, updated_at.
     Trigger: set_staging_articles_updated_at → update_updated_at_column().
     8 indexes (inc. composite batch+status). RLS: admin-only via manage_imports OR super_admin.

src/pages/admin/imports/[id].astro:
  New. Read-only detail page. requireSuperAdmin guard. Loads import_batches row by id (UUID
  validated). Shows batch metadata panel (type, status, counts, notes, linked data source,
  timestamps, batch ID). Queries staging table(s) depending on batch_type: universities →
  staging_universities, programs → staging_programs, scholarships → staging_scholarships,
  articles → staging_articles, mixed → all four. Each table shown in its own section with
  key extracted fields, import_status badge, review_notes. Raw JSON shown collapsed via
  <details><summary>/<pre>{JSON.stringify(...)}</pre> — never innerHTML/set:html. Staging
  errors shown in a separate red-accented table. No approve/reject/merge actions.

---

### Files Modified

src/lib/admin/badges.ts:
  Added 'articles': 'bg-teal-100 text-teal-700' to BATCH_TYPE_BADGE.

src/pages/admin/imports.astro:
  Added BATCH_TYPES constant (5 values including 'articles').
  Added POST handler: parses batch_type + notes, validates batch_type with validateIn,
  inserts import_batches row (status=pending, all counts=0, created_by_user_id=user.id),
  redirects to /admin/imports/{newBatch.id} on success.
  Added "Create Import Batch" collapsible form (<details>) above the batch list.
  Added "View" link column to batch list table rows linking to /admin/imports/{id}.
  Updated heading sub-label from "Read-only" to batch count.

---

### Pre-implementation Checks Run

1. Read migration 010 in full. Confirmed exact constraint names (auto-generated inline CHECK):
   import_batches_batch_type_check and staging_errors_staging_table_check.
2. Confirmed batch_type CHECK values: 'universities','programs','scholarships','mixed' (no 'articles').
3. Confirmed staging_errors.staging_table CHECK: 'staging_universities','staging_programs',
   'staging_scholarships','import_files','import_batches' (no 'staging_articles').
4. Confirmed requireSuperAdmin() usage in imports.astro and AdminSidebar already links Imports.
5. Confirmed articles table exists (migration 008) for match_article_id FK.
6. Confirmed BATCH_TYPE_BADGE did not include 'articles'. Added teal variant.

---

### Security Checks

- No service role in pages/components/layouts.
- No createServiceClient in pages/components/layouts.
- No public service key exposed.
- No innerHTML / set:html added. Raw JSON rendered via JSON.stringify in <pre> text only.
- No public route changes. Staged data never exposed publicly.
- Both new/modified pages use requireSuperAdmin() guard.

---


## 2026-06-19 - Phase 39: Data Source + Verification Foundation Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Surface the existing source/verification foundation with the smallest safe additive changes.
One migration to fix a missing column on articles. Admin verification_status fields added to
countries and universities (consistent with programs/scholarships/articles). Data sources panel
added to program/university/scholarship admin detail pages backed by the existing data_sources
table (migration 009). No new tables, no new dependencies, no public-facing changes.

---

### Files Created

supabase/migrations/017_articles_last_verified_at.sql:
  Additive, idempotent. ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS last_verified_at timestamptz.
  Articles was the only content table missing this column.

---

### Files Modified

src/pages/admin/countries/[id].astro:
  Added VERIFICATION_OPTIONS constant (6 values matching programs/scholarships).
  Added verification_status to: SELECT query, CountryRecord type, Values type,
  initial values, POST form parsing, validateIn check, UPDATE call, HTML form select element.

src/pages/admin/universities/[id].astro:
  Added VERIFICATION_OPTIONS, SOURCE_TYPE_OPTIONS, CONFIDENCE_OPTIONS, SOURCE_STATUS_OPTIONS constants.
  Added verification_status everywhere (same pattern as countries).
  Added DataSourceRow type, data_sources SELECT query (entity_type='university', entity_id=id).
  Added sourceError variable. Added add_source POST branch with if/else discriminating on
  _action hidden field; on success redirects to same page; on error sets sourceError.
  Added Verification section (select) to edit form HTML.
  Added Data Sources panel HTML below main form: lists linked sources, add-source form
  with source_url (required), source_type, confidence_level, source_status, source_title,
  is_primary_source. SSR session client. RLS enforced (super_admin required).

src/pages/admin/programs/[id].astro:
  Added SOURCE_TYPE_OPTIONS, CONFIDENCE_OPTIONS, SOURCE_STATUS_OPTIONS constants.
  Added DataSourceRow type, data_sources SELECT (entity_type='program').
  Added sourceError variable. Added add_source POST branch (same _action pattern as universities).
  Existing entity edit logic wrapped in else block. Added Data Sources panel HTML after form.

src/pages/admin/scholarships/[id].astro:
  Same changes as programs. entity_type='scholarship'.

---

### Pre-implementation Checks Run

1. Read migration 009 in full before writing any admin source UI.
2. Confirmed data_sources schema: polymorphic entity_type + entity_id, source_url NOT NULL,
   source_type/confidence_level/source_status with CHECK constraints and DEFAULTs.
   No FK on entity_id (by design — see migration 009 header comment).
3. Confirmed RLS: SELECT and INSERT both reachable by super_admin (requireSuperAdmin guard
   on all admin pages satisfies `has_role('super_admin')`). manage_data_sources permission
   not required because super_admin satisfies the OR condition directly.
4. Confirmed admin pages are fully editable (POST handlers exist on all four pages).
   Universities was missing verification_status; countries was missing verification_status.
   Programs and scholarships already had it.

---

### Security Checks

- No service role in pages/components/layouts.
- No createServiceClient in pages/components/layouts.
- No public service key exposed.
- No innerHTML / set:html added.
- Public pages unchanged. data_sources not joinable from any public route.
- Admin notes field from data_sources not exposed (source_title only, which is descriptive).

---


