# DegreeWiki Current Status

> AI agent reading rule:
> Read this active status file first for current context. Do not read archived status/history files unless the current task explicitly needs older phase details. For old phase details, use `docs/archive/README.md` to choose the smallest relevant archive file.

Last updated: 2026-06-26

## Current Phase

Phase 66F2 - Program Import Duplicate Handling - complete.
Program import merge now uses exact duplicate detection for programs based on normalized title + linked production university + degree level, instead of the earlier title-only warning path and create-new-only merge path. `/admin/imports/[id]` now lets admins link a staged program to an existing production program, skip an exact duplicate safely, or update an existing production program by filling only empty allowlisted rich fields. Bulk program merge now creates only unmatched rows, auto-skips exact unique matches, leaves ambiguous matches for manual review, and keeps new production programs draft + unverified + indexing draft. The flow still ignores JSON `content_status` / `verification_status`, still does not create `program_intakes`, and still keeps `data_sources` best-effort with duplicate URL dedupe. No migration, no new dependency, no unsafe HTML APIs, no service role, no RLS bypass, and no hard delete in this phase.

Current branch / git status note:
- Branch: `main`
- Phase 65A pending-review note was stale and has been removed. Check live repo state with `git status --short` when needed.

## Current Product Summary

- DegreeWiki is an Astro + Supabase app for public degree discovery, student dashboards, admin workflows, source verification, and AI-assisted Fit Finder guidance.
- The current product direction favors role-aware auth routing, server-side enforcement, token-driven public UI, and fail-closed AI behavior.

## Current Stack

- Astro SSR application with Cloudflare-oriented deployment output.
- Supabase Auth, RPC checks, and row-level security for auth and data boundaries.
- Server-side cookie/session handling through `@supabase/ssr`.
- Public UI built from Astro components and design tokens.
- Fit Finder AI runtime that can fall back to rule-based results when AI is unavailable.

## Current Architecture Decisions

- Admin access is role-based, not email-based.
- `/admin`, `/account`, and `/dashboard` resolve through shared auth helpers instead of page-local redirect logic.
- Admin sidebar navigation is permission-filtered for clarity, but direct route access still depends on admin-role admission plus RLS/permissions.
- Public pages use the locked design system and token-based UI components.
- Fit Finder AI remains fail-closed and can show rule-based matches without an AI summary.
- Docs are split into compact active files plus archive files for older history.
- Cloudinary stores and delivers media assets. Supabase stores metadata. Secrets stay server-only.
- Upload flow: server-signed direct browser → Cloudinary upload; server verifies response signature before DB insert.
- URL import: server calls Cloudinary upload API with SSRF-guarded remote URL.
- Entity image FKs now exist on all 6 admin entity tables. MediaPicker component used in all 12 admin forms.
- Public entity page image rendering is deferred to Phase 57C.

## Last Completed Phases

- Phase 66F2: program import duplicate handling; added exact program production matching keyed by normalized title + linked university + degree level, added `skip_existing` plus safe empty-field-only `update_existing` for programs, added staging `set_match_program_id` linking, changed bulk program merge to skip exact unique matches instead of creating duplicates, kept ambiguous matches manual, and deduped imported program `data_sources` URLs against existing rows. No migration, no new dependency, no unsafe HTML APIs, no service role, no RLS bypass, no subject auto-creation, and no hard delete.
- Phase 66E: program import field mapping hardening; kept the existing array / `{ programs: [...] }` / research-pack shapes, expanded safe rich-field aliases in the no-migration `raw_data -> mergeProgram()` path, added validation warnings for invalid `degree_level_code`, `study_mode`, `delivery_mode`, and `tuition_period`, warned on unknown or ambiguous primary subjects without blocking merge, improved staged program preview clarity, and aligned templates/prompts/docs with the actual supported field set. Programs still merge as draft/unverified, JSON status/verification fields remain ignored, `data_sources` remain best-effort, and `program_intakes` remain deferred. No migration, no new dependency, no unsafe HTML APIs, no service role, and no RLS bypass.
- Phase 66C2: import batch bulk merge + publish + mark-all actions; `/admin/imports/[id]` now adds a batch-actions panel with server-validated all-matching approval, selected-visible bulk program merge, all-matching approved-program merge, and confirmed bulk publish for linked merged draft/in-review programs only. Bulk publish updates public workflow fields only, keeps verification manual, and does not touch `last_verified_at`. No migration, no new dependency, no unsafe HTML APIs, no service role, no RLS bypass, and no `mergeProgram()` semantic change.
- Phase 66C1: import batch pagination + bulk approve; `/admin/imports/[id]` now supports URL-driven staged-row filters for entity, status, page, and page size, uses paged staged-row queries instead of rendering every visible entity section at once, preserves review context through POST redirects, adds visible-row selection with safe select-visible / clear-selection helpers, and adds bulk review actions for selected visible rows only (`approve`, `reject`, `skip`, `reset`). Program rows now expose a lightweight preview of language, tuition, deadline, and official/application URLs before raw JSON. No migration, no new dependency, no unsafe HTML APIs, no service role, no RLS bypass, no `mergeProgram()` semantic change, and no bulk merge/publish implementation in this phase.
- Phase 66B: import hub + program import staging UX; `/admin/imports` now promotes a dedicated program-import path while preserving generic batch creation. `/admin/imports/programs` requires one production university, accepts pasted JSON or browser-read local `.json` text, previews supported shapes client-side, reparses server-side, creates a mixed import batch plus a helper staging-university row linked to the selected production university, stages programs for review, and redirects to the batch detail page. `/admin/imports/[id]` now surfaces detected matched-university context, entity counts, row outcome counts, helper-row awareness, and a direct review-next link to `/admin/programs?university=<id>&status=draft&sort=newest` when the university can be detected. No migration, no new dependency, no unsafe HTML APIs, no service role, no RLS bypass, and no production program writes from the import page.

- Phase 65C: admin content list filters bundle; `/admin/universities` now supports name, country, city, content-status, verification-status, and newest/oldest/name sorting with result count and compact row hints for missing official link/media and low quality signals. `/admin/scholarships` now supports name, provider, host country relation, content-status, verification-status, funding-type, deadline-state, and newest/oldest/deadline/name sorting with result count and quick hints for missing links, funding detail, deadline, and low quality signals. `/admin/articles` now supports title, category, author, content-status, verification-status, and newest/oldest/updated/title sorting with result count and quick hints for missing SEO fields, missing summary, and low quality signals. Safe `returnTo` context is preserved for university, scholarship, and article edit pages on Back, Cancel, Save, existing Publish, and add-source redirects where applicable. No migration, no new dependency, no unsafe HTML APIs, no service role, no RLS bypass, and no import/auth architecture changes.
- Phase 65B: admin program review workflow; `/admin/programs/[id]` now shows a read-only checklist for core identity, student decision fields, sources, intakes, and public readiness; loads existing `data_completeness_score`, `source_confidence_score`, `last_verified_at`, and `next_review_due_at`; adds safe workflow buttons for save, mark in review, publish, mark partially verified, and mark verified; verification buttons stamp `last_verified_at`; review hints remain advisory and do not create new publish blockers beyond existing validation/RLS. No migration, no new dependency, no unsafe HTML APIs, no service role, and no import/auth architecture changes.
- Phase 65A: admin program review filters; `/admin/programs` now uses GET query params for title, university, status, degree level, subject, optional country, and newest/oldest sort; selected filters remain visible after apply; clear resets to `/admin/programs`; result count and safer empty states were added; list rows now show compact missing-official-link / missing-tuition hints; edit links carry safe `returnTo` context, and the edit page preserves that context on Back, Cancel, Save, and add-source redirects. No migration, no new dependency, no unsafe HTML APIs, no service role, and no admin/import architecture changes.
- Phase 64: public university and scholarship UX bundle; `/universities` has a stronger discovery header, program-search/Fit Finder paths, location filters in a sticky rail, richer university cards with media, verification, source dates, official links, and bounded published program counts. `/universities/[slug]` now uses a wide detail layout with an action panel, cover/logo media, sticky key facts, SourceBox, Fit Finder, empty-detail fallback, and related published programs. `/scholarships` now has a stronger discovery header, sticky filters, richer scholarship cards with provider/funding/deadline/eligibility/host-country/degree-level/source context, and better empty states. `/scholarships/[slug]` now has an apply/verify panel, key facts, SourceBox, Fit Finder, relationship-backed applies-to sections, nationality notes, and linked published programs filtered to published records before rendering. No migration, no new dependency, no unsafe HTML APIs, no service role, and no admin/import/AI changes.
- Phase 63: saved programs MVP; uses existing `saved_items` owner-only RLS table, adds authenticated `/api/saved-items/program` POST/DELETE, validates published programs before saving, wires ProgramCard/home/program listing/program detail save states, and adds `/account/saved-programs`. No migration, no new dependency, no service role, no RLS bypass, and no admin/import/AI changes.
- Phase 62C: program compare UX fix; `/programs` compare buttons now behave as JS-enhanced toggles into a local tray, the tray shows selected count/title context and activates "Compare programs" only with 2-4 programs, selection remains capped at 4, `/programs/compare` now handles exactly one valid published program with a helpful "Add one more program to compare" state, zero valid IDs with a "No valid published programs found" state, invalid UUIDs safely ignored, and missing fields rendered as `Not listed.`. No migrations, no new dependencies, no unsafe HTML APIs, no service role, and no admin/import/AI changes.
- Phase 62B: public navigation + program compare bugfix; `ProgramCard` compare controls now carry real compare links/metadata, `/programs` has a small localStorage compare tray that allows 2-4 selected published programs and prevents more than 4, `/programs/compare` renders a safe public comparison page from existing published data only, and `/destinations` now lists published destination-enabled countries instead of the public menu opening a 404. No migrations, no new dependencies, no unsafe HTML APIs, no service role, and no admin/import/AI changes.
- Phase 62: public program discovery UX bundle; `/programs` now has a stronger discovery hero, broader existing-field filters (including city, university, and delivery mode), quick browse entry points, improved safe empty/error states, clearer verification display, and a Fit Finder CTA. `ProgramCard` now supports explicit public verification labels, and `/programs/[slug]` now surfaces tuition/duration/language/intake earlier, shows official/apply actions sooner, uses a sticky key-facts rail plus SourceBox and Fit Finder, and adds cheap related programs from existing published data only. No migrations, no new dependencies.
- Phase 61: guide discovery UX + safe article Markdown rendering; public guide bodies now render a safe internal Markdown subset (h2/h3/h4, paragraphs, ordered/unordered lists, bold, simple italics, safe external links) without `set:html`/`innerHTML`; `/guides` now has an improved hero, quick category browsing, latest-guide highlights, better empty state, and clearer guide card affordances. No migrations, no new dependencies.
- Phase 60: Public article UX + SEO rendering; seo_h1 wired as H1; last_verified_at wired into SourceBox; reading time computed server-side and shown in article header; summary moved to header as lede; FitFinderMiniPanel CTA added; related articles by same category added; og:type="article" set; article:published_time/article:modified_time meta tags added to BaseLayout. No migrations, no new dependencies.
- Phase 59: Article authoring UX; two-column layout; six SEO fields surfaced (seo_title/description/h1, og_title/description, canonical_url); live word count + reading time; summary char counter; SEO search preview; writing template buttons; Save and Publish action; data quality scores read-only in edit form. No migrations, no new dependencies.
- Phase 58D: Mixed-batch nested research pack import; staged university inserted first; staged programs auto-linked to that university; rich program `raw_data` mapped during create-new program merge; research pack template/prompt and preview added. No migrations, no new dependencies.
- Phase 58E: Local direct-draft research pack import script; draft/unverified production-only writes; exact university/program duplicate matching; empty-field-only updates for draft matches; source URLs preserved in `data_sources`; markdown import report added. No migrations, no new dependencies.
- Phase 58C: Import templates + AI prompts + JSON preview + program university selector + set_match_scholarship_id + set_match_article_id + auto quality check on bulk import. No migrations, no new dependencies.
- Phase 58B: Import pipeline UX improvements; batch list lifecycle labels, batch detail summary cards, lifecycle steps, guidance banner, always-visible review buttons, programs university column, friendly error labels, batch status transition to needs_review. No migrations.
- Phase 57C: Public media rendering; article featured images, university/scholarship logos and covers, program/fit-finder university logos, og:image/twitter:image in layouts, country cover on homepage DestinationCard. No migrations. No admin changes.
- Phase 57B.1: Inline media picker UX upgrade; slot-card + native dialog modal, inline upload/import, auto-select, degreewiki:media-added event.
- Phase 57B: Entity media attachment; migration 023, MediaPicker component, image pickers in all 12 admin entity forms (6 entities × 2 pages).
- Phase 57A: Cloudinary/media asset foundation; migration 022, admin media library, signed upload, URL import, MediaImage component.
- Phase 56C: repo docs compaction complete; exact snapshots were taken, archive files were created, and the active docs were rewritten.
- Phase 56B: admin-role QA and navigation hardening; shared 403 helper plus filtered sidebar links.
- Phase 56A: auth role routing fix; admin users route to `/admin`, student users route to `/account`.

## Known Active Issues

- Standalone country/city/subject detail pages do not exist — `/destinations` now lists destination countries, while deeper entity detail pages remain deferred.
- Cloudinary hard-delete (destroy API) not yet implemented.
- Sidebar filtering improves clarity but does not replace route-level permission checks.
- Dashboard count cards are not fully permission-tailored yet.
- Default site OG image not yet configured (no brand asset uploaded to Cloudinary yet).
- CSV import and persistent uploaded-file import storage remain deferred to a future import-focused phase. Phase 66B adds browser-local `.json` file loading for the dedicated program import page only.
- Mixed-batch research pack staging import is still supported, and Phase 58E adds a separate local direct-draft production import script for trusted packs.
- Program intake/deadline import remains deferred. Phase 66E intentionally does not create `program_intakes`, even when JSON includes deadline-like fields.
- Program duplicate cleanup still has no dedicated archive/delete admin action; Phase 66F2 only prevents new accidental duplicates during import and adds safer skip/update handling in staging.
- Fields without production columns, such as `duration_text`, `required_documents_text`, `scholarship_notes`, `official_tuition_url`, `missing_fields`, and freeform `notes`, remain preserved in staging `raw_data`.
- Bulk verify flows, persistent saved admin filters, and broader admin review workflow storage remain deferred.

## Immediate Next Phases

- Expand the option-based import hub with additional dedicated entity flows if needed.
- Batch-scoped bulk verify for import-reviewed programs remains deferred by design; current bulk publish intentionally leaves verification manual.
- CSV/file upload import pipeline (intentionally deferred from Phase 58C/58D; local browser-read `.json` support now exists only for program staging).
- Article junction table wiring (article_countries, article_subjects, article_degree_levels) in the admin form — deferred from Phase 59.
- Continue admin permission boundary hardening.
- Add default site OG image (upload DegreeWiki brand asset to Cloudinary, wire PUBLIC_DEFAULT_OG_IMAGE_PUBLIC_ID).
- Cloudinary hard-delete (destroy API) when needed.

## Archive Map

- [Archive README](archive/README.md)
- [Status snapshot](archive/snapshots/2026-06-21-06-status-before-compaction.md)
- [Task log snapshot](archive/snapshots/2026-06-21-07-task-log-before-compaction.md)
- [Status history archive](archive/status/status-history-phase-01-56.md)
- [Task log archive, phases 01-10](archive/task-log/task-log-phase-01-10-schema-auth-admin-foundation.md)
- [Task log archive, phases 11-20](archive/task-log/task-log-phase-11-20-public-search-ai-matching.md)
- [Task log archive, phases 21-30](archive/task-log/task-log-phase-21-30-ai-finder-account-hardening.md)
- [Task log archive, phases 31-38](archive/task-log/task-log-phase-31-38-ai-chat-boundaries.md)
- [Task log archive, phases 39-44](archive/task-log/task-log-phase-39-44-source-import-staging-merge.md)
- [Task log archive, phases 45-50](archive/task-log/task-log-phase-45-50-public-data-staging-frontend.md)
- [Task log archive, phases 51-54](archive/task-log/task-log-phase-51-54-student-fit-finder-ai-runtime.md)
- [Task log archive, phases 55-56](archive/task-log/task-log-phase-55-56-public-redesign-auth-routing.md)

## How To Read Old History

- Start with `archive/README.md`.
- Pick the smallest archive file that matches the phase range or topic.
- Use the exact snapshots only when a task needs byte-for-byte pre-compaction text.
- Avoid rereading the large archive files unless the work explicitly depends on old phase detail.
