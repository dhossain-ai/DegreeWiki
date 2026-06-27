# DegreeWiki Task Log Archive

> Split archive for Phase 61-68. Use the narrowest matching range first.
> Use the recent active task log only for the newest phases.

## 2026-06-26 - Phase 68: Import Pipeline Polish Bundle

Tool:
- Codex GPT-5

Goal:
- Polish the import pipeline UX without changing import semantics, schema, dependencies, or security boundaries.

Files modified:
- `src/lib/admin/importCleanup.ts`
- `src/pages/admin/imports.astro`
- `src/pages/admin/imports/programs.astro`
- `src/pages/admin/imports/[id].astro`
- `docs/06-status.md`
- `docs/07-task-log.md`
- `docs/10-import-workflow.md`

Implementation:
- Made Program Import Staging the primary recommended path on `/admin/imports`.
- Moved General Batch Creation into an Advanced / Legacy framing and clarified that it is for universities, scholarships, articles, mixed research packs, and manual staging, not the normal program workflow.
- Added recent-batch filters for type, status, and active/recent windows, plus direct links for Program Import, active batches needing review, and batch history.
- Clarified `/admin/imports/programs` as a five-step staging flow: select university, paste/upload JSON, create staging batch, open batch, then choose first import or enrichment.
- Reorganized `/admin/imports/[id]` around Step 1 review, Step 2 production action, Step 3 publish only if needed, and Advanced tools.
- Added lightweight contextual recommendations from visible program rows: enrichment for approved exact matches, first-import merge for approved rows without exact matches, and publish when merged draft programs are ready.
- Renamed key actions to reduce confusion: approve selected rows, first-import merge, enrichment update-existing, and publish merged drafts as unverified.
- Added super-admin-only import batch cleanup guarded by a checkbox and typed `DELETE`.
- Cleanup deletes only `staging_programs`, `staging_universities`, `staging_scholarships`, `staging_articles`, `staging_errors`, `import_files`, and the `import_batches` row for the batch.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No merge/update/publish/review behavior change.
- No production program, university, scholarship, article, media, or production `data_sources` deletion from import batch cleanup.
- No auto-overwrite of non-empty production fields.
- No subject auto-creation.
- No intake/deadline import.

Validation:
- `npm run build`: PASS.
- Required security greps on modified source files for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient`: PASS (no matches).


## 2026-06-26 - Phase 67C: Program Import Bulk Update Existing Enrichment

Tool:
- Codex GPT-5

Goal:
- Add a safe second-pass enrichment workflow for program re-imports so richer JSON can patch exact existing production programs in bulk without creating duplicates.

Files modified:
- `src/lib/admin/importMerge.ts`
- `src/pages/admin/imports/[id].astro`
- `docs/10-import-workflow.md`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Added a dedicated `bulkUpdateExistingMatchedPrograms()` helper for program staging rows.
- Bulk enrichment supports the same two batch scopes already used by the import page pattern: selected visible rows and all matching rows in the current batch/filter after confirmation.
- Matching still requires the exact safe rule already used elsewhere: normalized title plus linked production university plus resolved degree level.
- Bulk enrichment never creates production programs. Rows with no exact match are skipped, ambiguous exact matches are skipped for manual handling, and only rows with one exact match can proceed.
- Program patching now reuses a shared helper so single-row `Update Existing` and bulk enrichment apply the same empty-field-only allowlist.
- Tightened the program update allowlist to the fields explicitly approved for this phase and stopped treating `english_requirements` as update-existing patchable in this workflow.
- Successful enrichment updates keep the existing staging behavior of marking the row `merged` and linking `match_program_id`; skipped rows remain unchanged for manual follow-up.
- Source URLs still attach best-effort only, dedupe against existing `data_sources` URLs on the target program, and surface warning counts without failing the whole batch action.
- Added a dedicated enrichment-pass panel on `/admin/imports/[id]` with confirmation copy that explains the intended second-research-pass workflow and the no-duplicate / empty-field-only / no-publish / no-verify rules.
- Added batch summary reporting for updated rows, skipped no exact match, skipped ambiguous match, skipped no safe fields, failed, and source-link follow-up counts.
- Updated the import workflow docs with an explicit "Enrichment pass" section.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No subject auto-creation.
- No `program_intakes` import.
- No trust in JSON `content_status` or `verification_status`.
- No auto-overwrite of non-empty production fields.

Validation:
- `npm run build`: PASS.
- Required security greps on modified source files for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient`: PASS (no matches).


## 2026-06-26 - Phase 67B: Program Import Final QA + Prompt Tightening

Tool:
- Codex GPT-5

Goal:
- Make the program import workflow easier to use for repeated university-by-university collection without changing merge semantics, duplicate behavior, schema, or security boundaries.
- Tighten the built-in prompt/template, dedicated import-page helper copy, and import docs so external research JSON stays closer to the importer's supported field set.

Files modified:
- `src/lib/admin/importPrompts.ts`
- `src/lib/admin/importTemplates.ts`
- `src/lib/admin/importParse.ts`
- `src/pages/admin/imports/programs.astro`
- `src/pages/admin/imports/[id].astro`
- `docs/10-import-workflow.md`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Tightened the shared AI prompt rules so the built-in prompts explicitly require JSON-only output and forbid extra keys outside the shown schema.
- Updated the flat `programs` prompt/template to use the current supported field names for new research JSON: `official_url`, `application_url`, `admission_requirements`, `gpa_requirements`, `curriculum_summary`, `career_outcomes`, and `source_urls`.
- Reworked the `research_pack` prompt/template into the preferred university-by-university shape with `university + programs`, explicit `official_website` support, null-on-unknown guidance, and an explicit ban on deadline/intake/status fields.
- Added clearer prompt/template guidance for broad primary subjects, `source_urls`, supported enum values, and the rule that imported production programs still become draft/unverified by server logic.
- Added a small parser alignment so `official_website` is accepted as a university official URL alias in the preferred nested shape.
- Updated `/admin/imports/programs` helper copy to explain the recommended workflow, staging-only behavior, duplicate-safe re-imports, empty-field-only `Update Existing`, later publish-as-unverified flow, supported JSON shapes, and the broad-subject/source-URL reminders.
- Tightened generic batch helper copy on `/admin/imports/[id]` so program examples and key guidance no longer recommend deadline fields and instead point operators toward the supported program field set for new JSON.
- Rewrote `docs/10-import-workflow.md` around the current preferred operational path: one university at a time, recommended prompt usage, JSON field rules, unsupported scope, duplicate handling, cleanup guidance, and a manual QA checklist.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No merge-semantics change.
- No duplicate-handling change.
- No `program_intakes` import.
- No trust in JSON `content_status` or `verification_status`.

Validation:
- `npm run build`: pending local run after implementation.
- Required security greps on modified source files for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient`: pending local run after implementation.


## 2026-06-26 - Phase 67A: Program Duplicate Cleanup + Safe Delete

Tool:
- Codex GPT-5

Goal:
- Add safe admin cleanup tools for existing duplicate/test program rows without changing schema, RLS architecture, or public program behavior.
- Support archive/unpublish as the normal safe path and super-admin hard delete as a pre-launch duplicate cleanup path.

Files modified:
- `src/lib/admin/programCleanup.ts`
- `src/pages/admin/programs/index.astro`
- `src/pages/admin/programs/[id].astro`
- `docs/06-status.md`
- `docs/07-task-log.md`
- `docs/10-import-workflow.md`

Implementation:
- Added shared program-cleanup helpers for duplicate-key normalization, duplicate-group detection, super-admin detection, hard-delete preflight, and safe program-scoped cleanup deletes.
- Reworked `/admin/programs` so it can show a duplicate-focused cleanup view through `?duplicates=1`, while preserving the existing GET filter flow for title, university, status, degree level, subject, country, and sort.
- Duplicate grouping now uses normalized `title` plus `university_id` plus `degree_level_id`; rows in duplicate groups are visually marked and the duplicate-only view filters the current result set down to rows whose key is duplicated anywhere in production.
- Added row checkboxes plus safe `Select visible` / `Clear selection` helpers that affect only currently rendered rows.
- Added bulk archive selected and restore selected actions. Archive sets `content_status = archived` and `indexing_status = draft`; restore moves archived rows back to `draft` and also sets `indexing_status = draft`. Neither flow changes `verification_status`.
- Added super-admin-only bulk hard delete with both required safeguards: a confirmation checkbox and typed `DELETE`.
- Hard delete now runs a preflight per selected program. It skips rows referenced by `ai_finder_program_matches`, or by immutable `analytics_events` / `outbound_clicks` history, and tells the admin to archive those rows instead.
- When hard delete is allowed, cleanup removes only safe program-scoped rows through existing RLS before deleting the program itself: `scholarship_programs`, `data_sources`, `saved_items`, `user_reports`, `verification_events`, and `data_quality_checks`. Existing `program_subjects` and `program_intakes` still clean up through their database cascades.
- Added matching single-record cleanup controls on `/admin/programs/[id]`: archive, restore-to-draft when archived, and a super-admin-only hard-delete panel with the same confirmation rules.
- Hard delete does not touch shared university rows, shared Cloudinary/media assets, or other shared entities. The program record may drop its own FK reference on delete, but asset records themselves are never deleted here.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No shared university delete.
- No shared media delete.

Validation:
- `npm run build`: PASS.
- Required security greps on modified source files for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient`: PASS (no matches).

Notes:
- Hard delete stays intentionally conservative: immutable analytics/outbound logs block permanent delete even though they are polymorphic rather than FK-backed, because the current RLS model does not allow safe cleanup there.
- Duplicate cleanup is now available directly in admin, but archive remains the recommended default once the site is public.


## 2026-06-26 - Phase 66E: Program Import Field Mapping Hardening

Tool:
- Codex GPT-5

Goal:
- Harden the existing no-migration program import mapping without changing JSON shapes, merge defaults, RLS boundaries, or bulk-action semantics.
- Improve alias coverage, validation warnings, primary-subject handling, staged preview clarity, and prompt/template alignment while explicitly deferring intake import.

Files modified:
- `src/lib/admin/importMerge.ts`
- `src/lib/admin/importValidation.ts`
- `src/lib/admin/importParse.ts`
- `src/lib/admin/importTemplates.ts`
- `src/lib/admin/importPrompts.ts`
- `src/pages/admin/imports/programs.astro`
- `src/pages/admin/imports/[id].astro`
- `docs/06-status.md`
- `docs/07-task-log.md`
- `docs/10-import-workflow.md`

Implementation:
- Expanded the rich-field alias path in `mergeProgram()` so the existing `raw_data -> programs` mapping now accepts additional safe variants for degree award, language, study mode, delivery mode, duration, tuition, application fee, official/application URLs, admissions, GPA, curriculum, and career fields.
- Hardened `textField()` to ignore nested objects instead of stringifying them into `[object Object]`, and added support for structured `english_requirements` JSON when it is already provided as an object.
- Added reusable primary-subject resolution that first exact-matches `subjects.name` case-insensitively, then falls back to a safe exact `subjects.slug` match. Unknown or ambiguous subjects now warn and are ignored; no subjects are auto-created.
- Added program validation warnings for missing or unsupported `degree_level_code`, and for invalid optional `study_mode`, `delivery_mode`, and `tuition_period` values. These optional enum-like values warn and are ignored instead of crashing or blocking merge.
- Kept JSON `content_status` and `verification_status` ignored. Programs still merge only through the existing reviewed merge flow and still create draft, unverified, indexing-draft production rows.
- Kept deadline/intake import deferred. The parser can still surface deadline-like text for review context, but Phase 66E does not create `program_intakes`.
- Improved staged program preview on `/admin/imports/[id]` so rows now summarize language, duration, tuition range/currency/period, primary subject, source URL count, official/application URLs, and short admissions/curriculum/career snippets before raw JSON.
- Improved the dedicated `/admin/imports/programs` client preview so it now shows a richer sample-field summary from the first parsed program object.
- Updated the flat program template and AI prompt so they request the rich fields that the hardened merge path already supports, explicitly warn that status/verification are ignored, and explicitly exclude intake arrays for this phase.
- Updated the import workflow docs to match the current supported program field set and the deferred-intakes rule.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No direct production write outside the existing merge flow.
- No subject auto-creation.
- No `program_intakes` import.
- No trust in JSON `content_status` or `verification_status`.

Validation:
- `npm run build`: PASS.
- Required security greps on modified source files for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient`: PASS.

Notes:
- `data_sources` attachment remains best-effort and deduped by normalized URL. Friendly warnings are preserved when source attachment fails.
- Intake/deadline import remains intentionally deferred until a later phase introduces an explicit intake schema.


## 2026-06-26 - Phase 66F2: Program Import Duplicate Handling

Tool:
- Codex GPT-5

Goal:
- Stop repeat program imports from silently creating duplicate production programs with new slugs.
- Add explicit safe handling for exact existing program matches without changing schema, RLS boundaries, or public publish defaults.

Files modified:
- `src/lib/admin/importMerge.ts`
- `src/lib/admin/importQuality.ts`
- `src/pages/admin/imports/[id].astro`
- `docs/06-status.md`
- `docs/07-task-log.md`
- `docs/10-import-workflow.md`

Implementation:
- Added exact program production matching based on normalized title plus the linked production university and resolved degree level, replacing the earlier title-only quality warning behavior for programs.
- Added `skip_existing` support for programs so an approved staged row can be linked to an existing production program and marked handled without creating a new production row.
- Added program `update_existing`, which fills only empty allowlisted production fields from staged rich program data and never overwrites identity, ownership, status, SEO, media, or already-filled rich fields.
- Kept `create_new` available for intentional duplicates, but now block it server-side when an exact unique or ambiguous match exists unless the admin explicitly confirms duplicate creation from the UI.
- Added `set_match_program_id` on `/admin/imports/[id]` so admins can manually link a staged program to a chosen production UUID before using skip/update actions.
- Updated the program row actions UI to show detected exact matches, ambiguous matches, explicit link-existing, skip-existing, update-existing, and create-new-anyway paths with stronger confirmation copy.
- Changed bulk program merge so exact unique matches are skipped as existing duplicates by default, unmatched rows are created normally, and ambiguous matches stay untouched for manual review instead of creating more duplicates.
- Deduped imported program `data_sources` URLs against existing sources on the target program before best-effort insert, for both create-new and update-existing flows.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No hard delete.
- No public publish-default change.
- No `program_intakes` import.

Validation:
- `npm run build`: PASS.

Notes:
- Bulk merge now reports created, updated, skipped-as-existing, skipped, failed, and warning counts through the existing batch summary flow.
- Ambiguous exact matches remain intentionally manual so the import path does not guess between multiple production duplicates.


## 2026-06-26 - Phase 66C2: Import Batch Bulk Merge + Publish + Mark All Actions

Tool:
- Codex GPT-5

Goal:
- Extend `/admin/imports/[id]` so large program batches can be advanced safely without clicking one row at a time.
- Add explicit all-matching approval, batch-scoped program merge, and batch-scoped publish while preserving the existing single-row workflow and merge semantics.

Files modified:
- `src/pages/admin/imports/[id].astro`
- `src/lib/admin/importReview.ts`
- `src/lib/admin/importMerge.ts`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Added a batch-actions panel on `/admin/imports/[id]` that stays scoped to the current batch, entity filter, and status filter, and explains when hidden pages can be affected.
- Added `_action=bulk_review_matching`, which requires an explicit confirmation checkbox and re-queries all matching rows server-side before approving them; helper staging-university rows plus `merged` / `processing` / `error` rows are skipped automatically.
- Kept the existing selected-visible bulk review flow intact for `approve`, `reject`, `skip`, and `reset`.
- Added exported review helper logic in `src/lib/admin/importReview.ts` so all-matching approval reuses `applyReviewAction()` instead of introducing a second review transition path.
- Added `_action=bulk_merge_programs` with two safe scopes: selected visible approved program rows, and all approved program rows in the current batch/filter after explicit confirmation.
- Bulk merge re-queries staged program rows from the current batch only, skips rows that are not currently `approved` or are already linked, and then calls the existing `mergeApprovedRow(..., entityType='programs')` path so `mergeProgram()` semantics remain unchanged.
- Added `_action=bulk_publish_programs`, which only looks at `staging_programs` rows in the current batch/filter that are already `merged` and linked to production `programs` through `match_program_id`.
- Bulk publish updates only linked production programs whose `content_status` is currently `draft` or `in_review`, sets `content_status = published` and `indexing_status = index`, and leaves `verification_status` plus `last_verified_at` unchanged.
- Added current-filter counts for approval-ready rows, approved program rows ready to merge, and merged draft/in-review programs ready to publish.
- Added generic batch-action summaries plus a small JS helper that mirrors the selected visible program row IDs into the selected-merge form without changing the existing checkbox UX.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No direct production writes outside the existing merge flow for create-new program merges.
- No `mergeProgram()` semantic change.
- No bulk verify action.
- No `last_verified_at` update during bulk publish.

Validation:
- `npm run build`: pending local run after implementation.

Notes:
- Bulk publish is intentionally limited to programs and intentionally keeps verification manual.
- All-matching actions can affect hidden pages only after the explicit confirmation checkbox is ticked.


## 2026-06-26 - Phase 66C1: Import Batch Pagination + Bulk Approve

Tool:
- Codex GPT-5

Goal:
- Make `/admin/imports/[id]` workable for larger staged batches without touching merge semantics or introducing any new schema.
- Add URL-driven staged-row pagination, page-size/status/entity filters, visible-row selection, and safe bulk review for selected visible rows only.

Files modified:
- `src/pages/admin/imports/[id].astro`
- `src/lib/admin/importReview.ts`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Reworked the batch detail page so staged-row review is URL-driven through `entity`, `status`, `page`, and `pageSize`, with the programs view chosen by default when a batch includes staged programs.
- Replaced the old fixed 50-row staged-entity display with server-side paged range/count queries for the active entity only, while preserving whole-batch summary cards and detected university context.
- Added filter controls for entity, status, and page size, plus a clear link and previous/next pagination controls.
- Preserved current filter context through existing POST review/merge/link/quality/import redirects so admins stay on the same filtered batch view after actions complete.
- Added visible-row checkboxes and safe client-side `Select visible` / `Clear selection` helpers using `querySelectorAll`, `checked`, `textContent`, and `addEventListener` only.
- Added `_action=bulk_review` for selected visible rows only, with support for `approve`, `reject`, `skip`, and `reset`; the handler revalidates current batch membership and visible-row scope, and reuses `applyReviewAction()` per row so existing review transition rules stay authoritative.
- Tightened review safety by blocking review actions on `merged` rows in `applyReviewAction()`, matching the existing UI expectation that merged rows are no longer reviewable.
- Prevented program-import helper university rows from being changed through bulk review, since those helper rows preserve the selected production-university merge context for staged programs.
- Added a lightweight program preview block that surfaces language, tuition, deadline, official URL, and application URL before raw JSON.
- Left bulk merge, bulk publish, service-role usage, and any `mergeProgram()` semantic changes out of scope.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No bulk merge.
- No bulk publish.
- No “select all across hidden pages”.

Validation:
- `npm run build`: PASS.

Deferred:
- Bulk merge remains deferred.
- Batch-scoped bulk publish remains deferred.
- Issue-list pagination remains deferred; the issues table is still capped separately from staged-row pagination in this phase.


## 2026-06-26 - Phase 66B: Import Hub + Program Import Staging UX

Tool:
- Codex GPT-5

Goal:
- Turn `/admin/imports` into a clearer option-based hub.
- Add a dedicated program-import staging page that selects one production university first, supports safe client preview plus local `.json` loading, stages programs into the existing import pipeline, and avoids any direct production program writes.
- Improve batch-detail context so university-linked program batches are easier to review after staging.

Files modified:
- `src/pages/admin/imports.astro`
- `src/pages/admin/imports/programs.astro`
- `src/pages/admin/imports/[id].astro`
- `src/lib/admin/importParse.ts`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Reworked `/admin/imports` into an Import Hub with a prominent Program Import card, preserved generic batch creation, and retained recent batch history in the same route.
- Added `/admin/imports/programs`, which requires one production university, accepts pasted JSON text, and can load a local `.json` file into the textarea entirely in the browser before submit.
- Added client-side preview for the dedicated program page using safe DOM APIs only; it recognizes raw arrays, `{ programs: [...] }`, and nested `{ university, programs }` research-pack shapes, shows object counts and sample titles, and warns if the JSON university name differs from the selected production university.
- Extended `src/lib/admin/importParse.ts` with a dedicated program-import parser that reparses those three supported shapes server-side and preserves the existing `MAX_BULK_ROWS` boundary at the program-array level.
- Server-side program import now validates the selected production university UUID and existence, creates a new mixed import batch, creates a batch-local helper staging-university row linked to the selected production university, and stages each parsed program into `staging_programs` with that helper row as `staging_university_id`.
- Program staging keeps the existing import-status pattern: rows without warnings start as `validated`, rows with warnings start as `pending`, non-object array items count as failures, and mismatch/unparseable-row warnings are recorded as friendly `staging_errors`.
- The helper staging-university row is marked and linked so `mergeProgram()` can keep its existing semantics while program rows still resolve their production university through the normal staging-university chain.
- `/admin/imports/[id]` now detects matched-university context when possible, shows entity counts plus row-outcome counts, excludes helper rows from the main lifecycle summary so guidance stays focused on actionable review work, and adds a direct review-next link to `/admin/programs?university=<id>&status=draft&sort=newest` when a single linked university can be detected.
- Mixed-batch research-pack support on the existing batch-detail page was preserved; the new program-import route does not replace or remove that older path.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No direct browser write to production `programs`.
- No `mergeProgram()` semantic change.
- No mixed-batch support removal.

Validation:
- `npm run build`: PASS.

Deferred:
- CSV import and persistent uploaded-file storage remain deferred.
- Additional dedicated import pages for other entity types remain optional future work.


## 2026-06-25 - Phase 65C: Admin Content List Filters Bundle

Tool:
- Codex GPT-5

Goal:
- Copy the successful Phase 65A URL-driven admin list pattern from `/admin/programs` to the main university, scholarship, and article admin lists.
- Preserve filtered-list review context into the corresponding edit pages without introducing migrations, dependencies, service-role usage, unsafe HTML APIs, or broader architecture changes.

Files modified:
- `src/pages/admin/universities/index.astro`
- `src/pages/admin/universities/[id].astro`
- `src/pages/admin/scholarships/index.astro`
- `src/pages/admin/scholarships/[id].astro`
- `src/pages/admin/articles/index.astro`
- `src/pages/admin/articles/[id].astro`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Rebuilt `/admin/universities` around a GET filter form with query-driven state for name search, country, city, content status, verification status, and newest/oldest/name sorting.
- Added university result counts, clearer filtered empty states, Clear action, and compact row hints for missing official link, missing logo/cover, and low completeness/confidence.
- Rebuilt `/admin/scholarships` around GET filters for name, provider, host country relation, content status, verification status, funding type, deadline state, and newest/oldest/deadline/name sorting.
- Added scholarship result counts, safer empty states, Clear action, and compact row hints for missing official/application links, missing funding detail, missing deadline, and low completeness/confidence.
- Rebuilt `/admin/articles` around GET filters for title, category, author, content status, verification status, and newest/oldest/updated/title sorting.
- Added article result counts, safer empty states, Clear action, and compact row hints for missing summary, missing SEO title/description, and low completeness/confidence.
- Added local `returnTo` propagation from each filtered list into edit links for universities, scholarships, and articles.
- Updated the three edit pages so Back, Cancel, Save, existing Publish, and add-source redirects preserve only safe local `returnTo` values for their matching admin list paths.
- Invalid or non-local `returnTo` values are ignored.
- All pages continue to return friendly generic load/save errors instead of raw database errors.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No import/staging logic change.
- No admin auth architecture change.
- No persistent saved filters.

Validation:
- `npm run build`: PASS.
- Required security greps on modified source files for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient`: PASS.

Deferred:
- Bulk publish/verify remains out of scope.
- Persistent saved filters remain out of scope.
- Additional shared abstractions for admin list filters remain deferred in favor of keeping each page readable and close to the working `/admin/programs` pattern.


## 2026-06-25 - Phase 65B: Admin Program Review Checklist + Verification Workflow

Tool:
- Codex GPT-5

Goal:
- Turn `/admin/programs/[id]` into a practical review screen for imported draft programs using existing schema only.
- Keep the Phase 65A filtered-list `returnTo` flow intact while adding review guidance and explicit workflow actions.
- Avoid migrations, new dependencies, service role usage, RLS bypasses, import/staging changes, unsafe HTML APIs, and persistent checklist storage.

Files modified:
- `src/pages/admin/programs/[id].astro`
- `src/lib/admin/badges.ts`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Expanded the program edit query to load existing `data_completeness_score`, `source_confidence_score`, `last_verified_at`, and `next_review_due_at`.
- Added a read-only review checklist sidebar covering core identity, student decision fields, intake/deadline coverage, source/trust coverage, and public-readiness hints.
- Checklist states are advisory only and use existing loaded program, `data_sources`, and `program_intakes` data; they do not create new publish blockers beyond current validation and RLS.
- Added read-only data-quality progress bars modeled after the article admin edit page pattern.
- Added workflow buttons for `save`, `mark_in_review`, `publish`, `mark_partially_verified`, and `mark_verified`.
- `publish` updates `content_status` only; verification workflow buttons update `verification_status`, and the two verification buttons stamp `last_verified_at`.
- `next_review_due_at` is displayed but not changed because no existing pattern safely manages it here.
- Strengthened add-source validation to check URL and enum values before insert while continuing to return only friendly errors.
- Preserved safe local `returnTo` handling for Back, Cancel, Save, workflow actions, and add-source redirects.
- Added shared verification badge classes in `src/lib/admin/badges.ts` for restrained admin status display.
- Corrected the stale Phase 65A status note that still implied uncommitted pending-review changes.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No RLS bypass.
- No import/staging logic change.
- No admin auth architecture change.
- No persistent checklist storage.
- No raw database errors shown to admins.


## 2026-06-25 - Phase 65A: Admin Program Review Filters

Tool:
- Codex GPT-5

Goal:
- Make `/admin/programs` useful for bulk-import review by keeping university/status context in the URL and making it easy to continue through edit cycles.
- Avoid migrations, new dependencies, service-role expansion, admin auth/RLS changes, import logic changes, unsafe HTML APIs, and large query rewrites.

Files modified:
- `src/pages/admin/programs/index.astro`
- `src/pages/admin/programs/[id].astro`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Rebuilt `/admin/programs` around a GET form so filters are driven by query params and remain shareable/bookmarkable.
- Added filters for title search (`q`), university (`university`), status (`status`), degree level (`degree_level`), subject (`subject`), optional country (`country`), and created-date sort (`sort=newest|oldest`).
- Added a result count line, clearer no-results messaging, and a real Clear action that resets to `/admin/programs`.
- Kept the table focused on title, university, level, status, created date, and edit action while adding compact row-level review hints for missing official links and missing tuition.
- Edit links now include a safe local `returnTo` value when the list has query params.
- Updated `src/pages/admin/programs/[id].astro` so Back, Cancel, Save, and add-source redirects preserve the filtered list context through that `returnTo` value.
- `returnTo` is allow-listed to local `/admin/programs` paths only and invalid values are ignored.
- The page continues to show safe generic load/save errors instead of raw database errors.

Safety:
- No migration.
- No new dependency.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient`.
- No admin auth/RLS architecture change.
- No import/staging logic change.
- No large query architecture rewrite.

Validation:
- `npm run build`: PASS.
- Required security greps on modified source files for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient`: PASS.

Notes:
- Country filter was included because `programs.country_id` already exists and is indexed, making it a low-risk optional addition.
- Missing-official-link and missing-tuition quick filters were left out to keep the phase focused, but compact review hints were added in the table rows.


## 2026-06-24 - Phase 63: Saved Programs MVP

Tool:
- Codex GPT-5

Goal:
- Make the public program Save button real using the existing `public.saved_items` table.
- Avoid database migrations, service role usage, RLS bypasses, new dependencies, and admin/import/AI changes.

Files added:
- `src/components/public/SavedProgramEnhancement.astro`
- `src/pages/api/saved-items/program.ts`
- `src/pages/account/saved-programs.astro`

Files modified:
- `src/components/public/cards/ProgramCard.astro`
- `src/pages/index.astro`
- `src/pages/programs/index.astro`
- `src/pages/programs/[slug].astro`
- `src/pages/account.astro`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Added authenticated `POST`/`DELETE` API at `/api/saved-items/program`.
- API validates JSON body and UUID-shaped `program_id`, requires `supabase.auth.getUser()`, verifies the program exists with `content_status = 'published'` before saving, then writes `saved_items` with `user_id = user.id`, `entity_type = 'program'`, and `entity_id = program_id`.
- Duplicate saves are idempotent through the existing unique constraint and `upsert(..., ignoreDuplicates: true)`.
- Deletes are scoped to the current user's `saved_items` row and are idempotent.
- Updated `ProgramCard` Save controls with saved/auth/login data attributes and accessible Save/Saved state.
- Added a shared safe client enhancement that uses `querySelectorAll`, `dataset`, `classList`, `textContent`, `addEventListener`, and `fetch`; anonymous clicks route to sign-in with a return URL.
- `/programs`, homepage featured programs, and `/programs/[slug]` now load initial saved state server-side for signed-in users using only visible published program IDs.
- `/programs/[slug]` now includes a page-level Save/Saved button in the "Apply and verify" panel.
- `/account` now shows a saved-program count and link.
- Added `/account/saved-programs`, listing the current user's saved published programs with existing `ProgramCard` UI.

Safety:
- No migration.
- No new dependency.
- No service role or `createServiceClient`.
- No RLS bypass.
- No `set:html`.
- No `innerHTML`.
- No admin changes.
- No AI/import changes.
- API does not expose raw Supabase errors publicly.
- API does not allow saving unpublished/nonexistent programs through the app path.

Validation:
- `npm run build`: PASS.
- Security grep checks for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient`: PASS on modified source files.


## 2026-06-24 - Phase 62C: Program Compare UX Fix

Tool:
- Codex GPT-5

Goal:
- Clarify the public program compare workflow so users understand that compare needs 2-4 programs.
- Fix the one-program direct compare state so it no longer says there are no published programs to compare.

Files modified:
- `src/pages/programs/index.astro`
- `src/pages/programs/compare.astro`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Updated the `/programs` local compare enhancement so compare controls behave as toggle buttons when JS is available and do not navigate on the first click.
- The compare tray now shows "Selected for comparison", selected count, available selected titles, a clear action, and guidance to select 2-4 programs.
- The "Compare programs" action stays inactive until 2-4 programs are selected, then navigates to `/programs/compare?ids=id1,id2`.
- Selection remains capped at 4 programs, with a clear message when users try to add a fifth.
- Fixed the browser and server UUID validators used by compare from the inherited malformed pattern to the full UUID shape.
- Updated `/programs/compare` so exactly one valid published program shows "1 program selected. Add one more program to compare.", keeps the selected program visible, and links back to browse programs.
- Updated the zero-valid-program state to say "No valid published programs found." and explain that invalid, unpublished, or unavailable IDs may have been ignored.
- The compare page still fetches only `content_status = published`, limits input to the first 4 valid-looking IDs, ignores invalid UUIDs safely, and renders missing fields as `Not listed.`.

Safety:
- No migrations.
- No new dependencies.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient` in modified public files.
- No admin changes.
- No AI feature changes.
- No import/staging changes.
- No large architecture change.

Validation:
- `npm run build`: PASS.
- `rg -n "innerHTML"` on modified source files: no matches.
- `rg -n "set:html"` on modified source files: no matches.
- `rg -n "service_role"` on modified source files: no matches.
- `rg -n "SERVICE_ROLE"` on modified source files: no matches.
- `rg -n "createServiceClient"` on modified source files: no matches.


## 2026-06-24 - Phase 62B: Public Navigation + Program Compare Bugfix

Tool:
- Codex GPT-5

Goal:
- Fix the visible-but-nonfunctional public program compare control before committing Phase 62.
- Fix the public Destinations menu/footer link opening a 404.

Files added:
- `src/pages/programs/compare.astro`
- `src/pages/destinations/index.astro`

Files modified:
- `src/components/public/cards/ProgramCard.astro`
- `src/pages/programs/index.astro`
- `src/pages/programs/[slug].astro`
- `src/pages/index.astro`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Added real compare metadata and fallback hrefs to `ProgramCard`, with `programId` passed from the program listing, homepage featured programs, and related program cards.
- Added a small anonymous client-side compare enhancement on `/programs` using `localStorage`, `dataset`, `classList`, `textContent`, and `URLSearchParams` only.
- The compare tray appears once programs are selected, enables navigation when at least 2 programs are selected, stores up to 4 selected IDs, and prevents selecting more than 4 with a friendly message.
- Added `/programs/compare?ids=id1,id2,id3,id4`, which validates UUIDs, limits to 4 IDs, fetches only `content_status = published` programs, reorders results to the requested order, and shows missing fields as `Not listed`.
- The compare page includes title, university, country/city, degree level, subject, tuition, duration, language, study mode, delivery mode, deadline/intake, verification status, and official/application links when available.
- Added `/destinations`, which lists published `is_destination_enabled` countries using existing country cover image data and links each card to the existing `/programs?country=...` public route.

Safety:
- No migrations.
- No new dependencies.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient` in modified public files.
- No admin form changes.
- No AI feature changes.
- No import/staging changes.
- No raw DB errors exposed publicly.

Validation:
- `npm run build`: PASS.
- `rg -n "innerHTML"` on modified source files: no matches.
- `rg -n "set:html"` on modified source files: no matches.
- `rg -n "service_role"` on modified source files: no matches.
- `rg -n "SERVICE_ROLE"` on modified source files: no matches.
- `rg -n "createServiceClient"` on modified source files: no matches.

Notes:
- The compare flow is intentionally anonymous and browser-local; it does not add saved compares, accounts, tables, or server writes.
- `/destinations` uses the lowest-risk route fix because the header and footer already point to that public path.


## 2026-06-24 - Phase 62: Public Program Discovery UX Bundle

Tool:
- Codex GPT-5

Goal:
- Improve public program discovery UX because programs are the core DegreeWiki content type.
- Upgrade `/programs`, `ProgramCard`, and `/programs/[slug]` using only existing schema, existing data, and existing components.

Files modified:
- `src/pages/programs/index.astro`
- `src/pages/programs/[slug].astro`
- `src/components/public/cards/ProgramCard.astro`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Reworked `/programs` with a stronger discovery hero, browse-universities / guides CTAs, a Fit Finder panel, better helper copy, and quick browse entry points for degree levels, subjects, and destinations.
- Kept the existing SSR/RLS query pattern and expanded the public-safe filters already implied by the page state so city, university, and delivery mode are now exposed in the UI alongside keyword, degree level, subject, country, language, study mode, and max tuition.
- Added safer list-state handling on `/programs`: server-side query errors still log internally, while the public page now shows friendly fallback copy instead of raw failures; no unpublished rows are exposed.
- Expanded list-card usage so program cards now show duration, explicit verification labels for verified/partially verified records, and last-checked trust context when available.
- Extended `ProgramCard.astro` with `verificationLabel` and `verificationTone` props so public pages can distinguish verified vs partially verified without changing saved/compare affordances.
- Rebuilt `/programs/[slug]` around earlier decision-making context: tuition, duration, language, next intake/deadline, official/apply actions, and verification state now surface much higher on the page.
- Added a wider detail layout with optional university cover media, a sticky key-facts rail, SourceBox trust display, Fit Finder CTA, and sectioned content for admissions, tuition/fees, intakes, curriculum, and career outcomes.
- Added a cheap related-programs section that reuses existing published data only, preferring same-subject matches and falling back to same university or country context without introducing new tables or architecture changes.

Safety:
- No migrations.
- No new dependencies.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient` in modified public files.
- No admin form changes.
- No AI feature expansion.
- No import/staging changes.
- No raw DB/provider errors exposed publicly.

Validation:
- `npm run build`: PASS.
- `rg -n "innerHTML"` on modified source files: no matches.
- `rg -n "set:html"` on modified source files: no matches.
- `rg -n "service_role"` on modified source files: no matches.
- `rg -n "SERVICE_ROLE"` on modified source files: no matches.
- `rg -n "createServiceClient"` on modified source files: no matches.

Notes:
- Related programs stay intentionally cheap and conservative so the phase does not drift into major query architecture work.
- Verification labels are only surfaced on list cards for public-safe published records where the existing verification status is already meaningful.


## 2026-06-24 - Phase 61: Guide Discovery UX + Safe Article Markdown Rendering

Tool:
- Codex GPT-5

Goal:
- Fix public guide/article body rendering so published guides no longer show raw Markdown markers.
- Improve `/guides` discovery UX without schema changes, new dependencies, or unsafe HTML rendering.

Files added:
- `src/lib/public/markdown.ts`
- `src/components/public/ArticleInlineContent.astro`
- `src/components/public/ArticleBody.astro`

Files modified:
- `src/pages/guides/[slug].astro`
- `src/pages/guides/index.astro`
- `src/components/public/cards/GuideCard.astro`
- `docs/06-status.md`
- `docs/07-task-log.md`

Implementation:
- Added a small internal parser in `src/lib/public/markdown.ts` that converts stored article body text into a safe block model instead of HTML strings.
- Supported block-level subset: blank-line paragraphs, `##`/`###`/`####` headings, unordered lists, ordered lists, and graceful fallback for unknown syntax.
- Supported inline subset: `**bold**`, simple `*italic*`, and `[label](https://...)` links.
- `# Heading` is normalized to an `h2` rather than rendering a second page-level `h1`.
- Links are accepted only for valid `http/https` URLs; invalid/unsafe URLs degrade to plain text labels.
- Added `ArticleBody.astro` + `ArticleInlineContent.astro` so Astro renders escaped text nodes and semantic elements directly, with no `set:html`, `innerHTML`, or full Markdown library.
- Updated `src/pages/guides/[slug].astro` to use the safe renderer while preserving featured image, SourceBox, last-updated text, Fit Finder panel, related guides, and 404 behavior.
- Improved `/guides` with a richer hero, Fit Finder / programs CTAs, quick category pills, latest-guide highlights, stronger empty-state copy, and clearer “All guides” hierarchy.
- Refined `GuideCard.astro` spacing and added a clearer “Read guide” affordance.

Safety:
- No migrations.
- No new dependencies.
- No `set:html`.
- No `innerHTML`.
- No service role or `createServiceClient` in any modified public file.
- No admin article form changes.

Validation:
- `npm run build`: pending at implementation time; run immediately after code changes.
- Required greps for `innerHTML`, `set:html`, `service_role`, `SERVICE_ROLE`, and `createServiceClient` to be run against the modified files.

Notes:
- The inline parser intentionally stays small and conservative rather than aiming for full Markdown compatibility.
- Unknown or malformed Markdown degrades to readable text instead of throwing or injecting HTML.


## 2026-06-24 - Phase 64: Public University + Scholarship UX Bundle

Tool:
- Codex GPT-5

Goal:
- Improve public university and scholarship listing/detail UX using existing schema, existing components, existing data, and bounded public-safe queries only.

Files modified:
- `src/pages/universities/index.astro`
- `src/pages/universities/[slug].astro`
- `src/pages/scholarships/index.astro`
- `src/pages/scholarships/[slug].astro`
- `docs/06-status.md`
- `docs/07-task-log.md`

University UX changes:
- Rebuilt `/universities` around a wider information-first discovery header with program search and scholarship paths, Fit Finder CTA, summary cards, sticky country/city filters, active chips, richer empty states, and denser university result cards.
- University cards now show logo/monogram, location, verification badge, source-checked date, official link, and a bounded published program count for currently visible universities.
- Rebuilt `/universities/[slug]` with logo/cover support, official action panel, sticky key facts, SourceBox, Fit Finder CTA, resilient empty-detail fallback, and a related published-program sample from `programs.university_id`.
- Did not add institution type or ownership UI because those columns are absent from the current `universities` schema.

Scholarship UX changes:
- Rebuilt `/scholarships` around a wider discovery header, Fit Finder CTA, sticky filters, active chips, richer empty state, and information-dense scholarship cards.
- Scholarship cards now show provider, amount, deadline, funding/application classification, verification/source date, host countries, degree levels, and eligibility summary when available.
- Rebuilt `/scholarships/[slug]` with logo/cover support, apply/verify action panel, sticky key facts, SourceBox, Fit Finder CTA, relationship-backed applies-to sections, nationality notes, and linked published programs.
- Related university/program data is filtered before rendering so draft/unpublished related records do not appear publicly.

Security and scope:
- No migration.
- No new dependency.
- No `set:html` or `innerHTML`.
- No service role or `createServiceClient`.
- No admin, import/staging, or AI feature changes.
- All public primary entity queries still require `content_status = 'published'`.
- Related program samples are bounded and filtered to published records before rendering.

Validation:
- `npm run build`: PASS.
- Security greps for modified source files:
  - `innerHTML`: none.
  - `set:html`: none.
  - `service_role`: none.
  - `SERVICE_ROLE`: none.
  - `createServiceClient`: none.

Deferred:
- Saved universities/scholarships and compare flows remain out of scope.
- New university ownership/type filters remain deferred because the schema has no such columns.
- Scholarship country/degree filters remain deferred because listing filters were limited to existing scalar filter controls already present on the page.

## Current / Open Notes

- Cloudinary account must be configured for SHA-256 signatures (or set CLOUDINARY_SIGNATURE_ALGORITHM=sha1 as fallback).
- If a future task needs older history, open the smallest relevant archive file instead of rereading the full snapshots.

