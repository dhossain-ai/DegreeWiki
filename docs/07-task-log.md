# DegreeWiki Recent Task Log

> AI agent reading rule:
> For normal work, read only this recent task log. Do not read full archived task logs unless investigating an older phase. Use `docs/archive/README.md` to choose the smallest relevant archive file.

This file is intentionally compact.
It only records the recent phases needed for day-to-day work.
Older detail lives in `docs/archive/`.

## Archive Map

- `archive/README.md`
- `archive/snapshots/2026-06-21-06-status-before-compaction.md`
- `archive/snapshots/2026-06-21-07-task-log-before-compaction.md`
- `archive/status/status-history-phase-01-56.md`
- `archive/task-log/task-log-phase-01-10-schema-auth-admin-foundation.md`
- `archive/task-log/task-log-phase-11-20-public-search-ai-matching.md`
- `archive/task-log/task-log-phase-21-30-ai-finder-account-hardening.md`
- `archive/task-log/task-log-phase-31-38-ai-chat-boundaries.md`
- `archive/task-log/task-log-phase-39-44-source-import-staging-merge.md`
- `archive/task-log/task-log-phase-45-50-public-data-staging-frontend.md`
- `archive/task-log/task-log-phase-51-54-student-fit-finder-ai-runtime.md`
- `archive/task-log/task-log-phase-55-56-public-redesign-auth-routing.md`

## Phase 55A-55F Short Summary

- Phase 55A: locked the public design reference files and normalized the design-direction docs so later UI work had a stable target.
- Phase 55B: established the public design system foundation, tokens, and reusable UI primitives.
- Phase 55C: implemented the homepage redesign with the new public visual language.
- Phase 55D: performed homepage QA and responsive polish after the redesign landed.
- Phase 55E: rebuilt the programs listing page into a proper discovery experience.
- Phase 55F: completed the directory/detail-page redesign bundle for universities, scholarships, guides, and program detail pages.

## 2026-06-21 - Phase 56A: Auth Role Routing Fix

Tool:
- Codex GPT-5

Goal:
- Fix auth routing so the admin account `degreewiki@gmail.com` lands on `/admin` instead of the student dashboard while preserving the student `/account` flow.

Core findings:
- Login, signup, and auth-callback redirects were all resolving to the student dashboard path.
- `PublicNav` hardcoded the signed-in dashboard link to `/account`.
- `/account` allowed signed-in users but did not redirect admin-role users away from the student dashboard.
- Admin-role detection already existed through Supabase `has_role(role_code)`.

Implementation:
- Added `src/lib/auth/dashboard.ts` with shared dashboard-destination helpers and admin role codes.
- Updated `src/pages/login.astro`, `src/pages/signup.astro`, and `src/pages/auth/callback.astro` to resolve auth redirects by role.
- Updated `src/pages/account.astro` so admin-role users are redirected to `/admin`.
- Added `src/pages/dashboard.astro` as a small router/alias.
- Updated `src/components/public/PublicNav.astro` so the signed-in dashboard link points to `/admin` for admin users and `/account` for students.
- Updated admin page 403 text from `super_admin role required` to `admin role required`.

Validation:
- `npm run build`: PASS.
- Equivalent `rg` checks for service-role usage and `set:html` / `innerHTML`: no new matches in phase files.
- Manual routing checks confirmed admin, student, and signed-out flows behaved as expected.

Notes:
- No migrations.
- No dependency changes.
- No Cloudinary/media work.
- No new roles or schema changes.

## 2026-06-21 - Phase 56B: Admin Role QA and Navigation Hardening

Tool:
- Codex GPT-5

Goal:
- Harden the admin shell after Phase 56A by checking navigation clarity, 403 behavior, and admin-role boundaries without rebuilding permissions or RLS.

Core findings:
- `requireSuperAdmin(...)` remained the guard pattern across `src/pages/admin/**`.
- Before this phase, the sidebar showed every admin section to every admin-role user.
- Lower admin roles could see links to areas where RLS or permission policies might still block actual data access.
- Route 403 responses were repeated raw text responses rather than a shared helper.

Implementation:
- Added `src/lib/admin/navigation.ts` to filter sidebar items with the existing `has_permission(permission_code)` RPC.
- Updated `src/components/admin/AdminSidebar.astro` to load filtered nav items through the SSR Supabase client.
- Updated `src/lib/admin/guard.ts` with `forbiddenAdminResponse()` and explicit `text/plain` output.
- Updated `src/pages/admin/**/*.astro` to use the shared 403 helper instead of repeating response construction.

Validation:
- `npm run build`: PASS.
- Security grep checks found no new service-role usage in the edited admin files.
- XSS grep checks found no new `set:html` or `innerHTML` usage in the edited admin files.

Notes:
- Sidebar filtering is clarity hardening, not authorization enforcement.
- Direct URL access to hidden admin sections still depends on the page guard plus RLS/permission policies.
- The admin dashboard count cards are still not fully permission-tailored.

## 2026-06-21 - Phase 56C: Repo Docs Compaction

Tool:
- Codex GPT-5

Goal:
- Preserve the full active docs history, then compact `docs/06-status.md` and `docs/07-task-log.md` so future AI sessions do not need to load thousands of lines up front.

Required preservation steps completed:
- Created exact snapshots of the pre-compaction docs in `docs/archive/snapshots/`.
- Copied the full current status doc into `docs/archive/status/status-history-phase-01-56.md`.
- Split the task log into phase-range archive files under `docs/archive/task-log/`.

Archive work completed:
- Added `docs/archive/README.md` as the archive index and reading guide.
- Created phase-range task-log archives for:
  - phases 01-10
  - phases 11-20
  - phases 21-30
  - phases 31-38
  - phases 39-44
  - phases 45-50
  - phases 51-54
  - phases 55-56
- Kept the snapshots exact and untouched after copying.

Active-doc work completed:
- Rewrote `docs/06-status.md` as a compact current-status entry point.
- Rewrote `docs/07-task-log.md` as a compact recent-task entry point.
- Added AI-agent reading rules near the top of both active docs.
- Added archive links so future sessions can jump to the smallest relevant history file.

Validation:
- Checked the branch and worktree state before and after the archive generation.
- Confirmed the worktree was already dirty with unrelated admin/source changes.
- Confirmed the active docs are now compact enough for normal use.

Notes:
- The task-log archive split is by numeric phase range.
- Non-phase foundation entries were grouped into the phase 01-10 archive.
- The standalone Phase 28 tail entry was grouped into the phase 21-30 archive by its phase number.

## 2026-06-22 - Phase 57A: Cloudinary / Media Asset Foundation

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Add the missing application-layer media foundation on top of the existing 003_media.sql schema.
- Extend media_assets and entity_media with provenance, soft-delete, and override columns.
- Add admin media library with signed upload, URL import, and metadata editing.
- Add public MediaImage component.

Schema context:
- 003_media.sql (already applied) created media_assets, entity_media, and all RLS policies using manage_media.
- 015_seed_data.sql (already applied) seeded manage_media and assigned it to content_admin and super_admin.
- Phase 57A adds migration 022 to extend those tables — does not recreate them.

Core findings:
- Direct FK columns already existed: countries.og_image_id, universities.logo_id/cover_image_id/og_image_id, scholarships.og_image_id, articles.featured_image_id/og_image_id.
- No Cloudinary lib files, admin media pages, or API endpoints existed before this phase.
- No Cloudinary SDK installed — all signing and upload calls use Web Crypto + fetch (Cloudflare-compatible).

Migration:
- supabase/migrations/022_media_extended.sql:
  - Extends media_assets with cloudinary_asset_id, cloudinary_version, cloudinary_resource_type, display_name, caption, folder, source_type, source_url, credit_text, license_type, license_url, copyright_owner, is_reusable, deleted_at.
  - Drops and recreates media_assets_select_public_ready to add deleted_at IS NULL guard.
  - Extends entity_media with is_primary, alt_text_override, caption_override, updated_at.
  - Creates idempotent updated_at trigger (DO $$ ... $$ block checking pg_trigger).
  - Creates UNIQUE partial index idx_entity_media_primary_unique (entity_type, entity_id, role) WHERE is_primary = true.

Library files created:
- src/lib/cloudinary/config.ts: reads env vars, validates, returns CloudinaryConfig; defines ALLOWED_SUBFOLDERS.
- src/lib/cloudinary/url.ts: cloudinaryUrl() builder with f_auto/q_auto; no secrets; safe for public components.
- src/lib/cloudinary/upload.ts: signCloudinaryParams() (SHA-256/SHA-1 via crypto.subtle), verifyCloudinaryResponseSignature(), validateImportUrl() (SSRF guard), callCloudinaryUploadApi().

API endpoints created:
- src/pages/api/admin/media/sign-upload.ts: generates server-signed upload params for browser-to-Cloudinary direct upload.
- src/pages/api/admin/media/complete-upload.ts: verifies Cloudinary response signature before inserting into media_assets.
- src/pages/api/admin/media/import-url.ts: SSRF-guarded URL import via Cloudinary upload API (fetch-based).

Admin pages created:
- src/pages/admin/media/index.astro: grid list of non-deleted assets, thumbnails via cloudinaryUrl, links to new/edit.
- src/pages/admin/media/new.astro: mode selector (upload file / import URL), shared metadata fields, JS-driven both flows.
- src/pages/admin/media/[id].astro: image preview, editable metadata, read-only Cloudinary fields, soft-delete (sets deleted_at).

Component created:
- src/components/public/MediaImage.astro: accepts publicId + required alt; renders optimized img or accessible fallback span; no secrets; no set:html.

Navigation updated:
- src/lib/admin/navigation.ts: added Media Library nav item with requiredPermissions: ['manage_media'].

Env example updated:
- .env.example: added PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_UPLOAD_FOLDER, CLOUDINARY_SIGNATURE_ALGORITHM with security comments.

Security measures:
- CLOUDINARY_API_SECRET stays server-only; never returned to browser.
- sign-upload returns only signature + timestamp + api_key (not secret).
- complete-upload verifies Cloudinary response signature before any DB write.
- import-url rejects non-HTTPS, localhost, 10.x, 127.x, 192.168.x, 172.16–31.x, ::1.
- Folder containment: subfolder must be in allowed list; full path always under CLOUDINARY_UPLOAD_FOLDER/.
- resource_type: 'image' enforced in allowed_formats signed param and in complete-upload validation.
- All media endpoints: requireAdminUser + has_permission('manage_media') RPC check.
- No service role used in any media page or endpoint.

Validation:
- npm run build: PASS.
- service_role grep: zero new matches in Phase 57A files.
- set:html / innerHTML grep: zero matches in Phase 57A files.
- Cloudinary secret exposure grep: zero matches for PUBLIC_CLOUDINARY_API_SECRET or PUBLIC_CLOUDINARY_API_KEY.

Deferred to Phase 57B:
- Adding cover_image_id to cities/subjects, logo_id/cover_image_id to scholarships.
- MediaPicker component for entity form image attachment.
- Image slots in admin country/university/scholarship/article forms.
- Image rendering on public entity pages.
- Cloudinary hard-delete (destroy API).
- Public entity_media SELECT (gallery support).

## 2026-06-22 - Phase 57B: Entity Media Attachment

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Add the 7 missing image FK columns to the schema.
- Create MediaPicker admin component for inline image selection.
- Wire image pickers into all 6 entity admin forms (both new and edit pages).

Schema changes:
- supabase/migrations/023_entity_image_fk_columns.sql:
  - countries: added cover_image_id (og_image_id already existed).
  - cities: added cover_image_id, og_image_id (neither existed).
  - subjects: added cover_image_id, og_image_id (neither existed).
  - scholarships: added logo_id, cover_image_id (og_image_id already existed).
  - All 7 new columns: uuid REFERENCES public.media_assets(id) ON DELETE SET NULL. Indexed.

Library changes:
- src/lib/cloudinary/config.ts: added 'cities' and 'subjects' to ALLOWED_SUBFOLDERS.

Component created:
- src/components/admin/MediaPicker.astro: select + thumbnail preview. data-thumb on each <option>; inline script reads selectedOption.dataset.thumb, updates img.src; no innerHTML/set:html; imports only url.ts (no secrets). Exports MediaAssetOption interface.

Admin forms updated (both new.astro and [id].astro for each):
- countries: cover_image_id, og_image_id.
- cities: cover_image_id, og_image_id.
- universities: logo_id, cover_image_id, og_image_id (pre-existing columns, now surfaced in forms).
- scholarships: logo_id, cover_image_id, og_image_id (logo_id/cover_image_id new; og_image_id pre-existing).
- articles: featured_image_id, og_image_id (pre-existing columns, now surfaced in forms).
- subjects: cover_image_id, og_image_id.
- Image sections placed: after Content, before Publishing/Verification (articles/scholarships); bottom fieldset (countries/cities/subjects); bottom fieldset (universities).

Security:
- UUID whitelist validation on every submitted image FK before DB write.
- No service role in any form page.
- No innerHTML or set:html anywhere.
- No Cloudinary secrets exposed to browser.
- cloudName from PUBLIC_ env var only.

Validation:
- npm run build: PASS.
- service_role grep: zero new matches in Phase 57B files.
- set:html / innerHTML grep: zero matches in Phase 57B files.
- Cloudinary secret exposure grep: zero matches.

Deferred to Phase 57C:
- Rendering entity images on public pages.
- Cloudinary hard-delete (destroy API).
- Public entity_media SELECT (gallery support).

## 2026-06-22 - Phase 57B.1: Inline Media Picker UX Upgrade

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Replace the plain dropdown MediaPicker with a full inline slot-card + native `<dialog>` modal so admins can select, upload, or import images without navigating away from the entity form.

Files created:
- src/lib/cloudinary/folders.ts: ALLOWED_SUBFOLDERS constant extracted from config.ts. Safe to import in Astro frontmatter (no secrets). config.ts re-exports from here.
- src/lib/admin/media.ts: loadReusableReadyMediaAssets() (GET helper) and validateReusableReadyMediaIds() (batch UUID check via single .in('id', unique) Supabase query on POST).

Files modified:
- src/lib/cloudinary/config.ts: removed inline ALLOWED_SUBFOLDERS; now re-exports from folders.ts.
- src/pages/api/admin/media/complete-upload.ts: expanded .select() and JSON response to include cloudinary_public_id, display_name, alt_text, folder.
- src/pages/api/admin/media/import-url.ts: same expansion as complete-upload.ts.
- src/components/admin/MediaPicker.astro: fully rewritten. Props: fieldName, label, currentId, assets, cloudName, defaultSubfolder, copyFromField, copyFromLabel. Structure: slot card (160×120 preview, action buttons), hidden input (data-field), native <dialog> with Library / Upload / Import tabs. JS: root-scoped querySelectorAll, applySelection, clearSelection, prependAssetCard (createElement only), broadcastNewAsset (degreewiki:media-added CustomEvent). 403 → friendly message. No innerHTML/set:html/eval.
- All 12 entity admin forms (new + [id] for countries, cities, universities, scholarships, articles, subjects):
  - Removed MediaAssetOption import; replaced per-form DB query with loadReusableReadyMediaAssets(supabase).
  - Replaced Set.has() validation with validateReusableReadyMediaIds() in POST block.
  - Added defaultSubfolder to all MediaPicker calls; added copyFromField/copyFromLabel on OG image pickers (cover→OG for universities/scholarships/subjects/countries/cities; featured→OG for articles).

Security:
- CLOUDINARY_API_SECRET stays server-only; never returned to browser.
- No innerHTML/set:html/eval in MediaPicker script.
- 403 from upload/import endpoints → "You do not have permission to upload/import media." (no raw error echoed).
- UUID batch validation on POST; new inline-uploaded IDs accepted (live DB round-trip rather than stale in-memory set).
- ALLOWED_SUBFOLDERS in folders.ts (no secrets); MediaPicker imports folders.ts, never config.ts.

Validation:
- npm run build: PASS.
- service_role grep: zero new matches. Pre-existing hits in src/lib/ai/ are unrelated.
- set:html / innerHTML grep: one pre-existing comment in fit-finder/result.astro; no new matches.
- Cloudinary secret grep: hits only in config.ts (legitimate server-side reads) and a comment in sign-upload.ts; no PUBLIC_CLOUDINARY_API_SECRET/KEY leak.

Deferred to Phase 57C:
- Rendering entity images on public pages.
- Cloudinary hard-delete (destroy API).
- Public entity_media SELECT (gallery support).

## 2026-06-22 - Phase 57C: Public Media Rendering

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Render selected public media assets on public pages, listing cards, program/fit-finder cards, and SEO/social metadata using MediaImage component and cloudinaryUrl helper.

Key findings:
- No public routes exist for countries, cities, or subjects — image rendering for those entities deferred to when routes are built.
- BaseLayout had no og:image or twitter:image support at all — added in this phase.
- All entity FK constraint names follow PostgreSQL auto-naming ({table}_{column}_fkey) — FK hint joins work without a new migration.
- RLS policy media_assets_select_public_ready enforces is_public/ready/not-deleted at DB level; PostgREST applies it automatically to embedded joins.

New files:
- src/lib/public/media.ts: getPublicId(), getAlt(), getOgImageUrl() helpers. Imports only cloudinaryUrl() — no secrets.

Layout changes:
- src/layouts/BaseLayout.astro: added ogImage? prop; emits og:image, twitter:image, and conditional twitter:card (summary_large_image when image present, summary otherwise).
- src/layouts/PublicLayout.astro: added ogImage? prop, passes through to BaseLayout.

Public pages updated:
- src/pages/guides/[slug].astro: featured_image + og_image joins; featured image renders below h1; ogImage passed to layout.
- src/pages/guides/index.astro: featured_image join; imagePublicId/imageAlt passed to GuideCard.
- src/pages/universities/[slug].astro: logo + cover_image + og_image joins; logo replaces monogram or falls back; cover hero rendered; ogImage passed.
- src/pages/universities/index.astro: logo join; logo or initials fallback per listing row.
- src/pages/scholarships/[slug].astro: logo + cover_image + og_image joins; logo in header; cover hero rendered; ogImage passed.
- src/pages/scholarships/index.astro: logo join; logo or initials fallback per listing row.
- src/pages/programs/[slug].astro: university logo/cover/og nested join; small logo next to university name; ogImage via university chain.
- src/pages/programs/index.astro: university logo nested join; logoPublicId/logoAlt passed to ProgramCard.
- src/pages/fit-finder/result.astro: university logo join (display only); logo in each program result card.
- src/pages/fit-finder/results/[id].astro: university logo join (display only); logo in each saved program match card.
- src/pages/index.astro: country cover_image join; imagePublicId/imageAlt passed to DestinationCard.

Components updated:
- src/components/public/cards/GuideCard.astro: imagePublicId? + imageAlt? props; thumbnail rendered above title when present; fallback = existing text card.
- src/components/public/cards/ProgramCard.astro: logoPublicId? + logoAlt? props; logo renders in monogram slot when present; fallback = existing monogram.
- src/components/public/cards/DestinationCard.astro: imagePublicId? + imageAlt? props; cover image above name when present; fallback = existing text card.

Security:
- No service role in any modified public file.
- No set:html or innerHTML in any new code.
- No CLOUDINARY_API_SECRET or forbidden imports (config.ts, upload.ts) in any public file.
- All Cloudinary URLs built via url.ts only.
- RLS enforces public-ready filter; app also defensively checks cloudinary_public_id non-null.

Deferred:
- Country/city/subject standalone page image rendering (no public routes).
- Cloudinary hard-delete (destroy API).
- Default site OG image (no brand asset uploaded yet).
- Galleries / entity_media SELECT.
- Inline article body images / rich editor.

## 2026-06-22 - Phase 58A: Import Pipeline UX Inspection

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Inspect the existing admin import pipeline at `/admin/imports/` and answer 14 specific questions about the implementation before beginning 58B UX improvements. No code changes.

Core findings:
- 4 entity types supported: universities, programs, scholarships, articles.
- Batch status was never automatically set to `needs_review` — only `pending` after create and manually driven.
- Staging errors table has 3 error_type values: `validation_warning`, `same_batch_duplicate`, `possible_production_match`.
- Review action buttons (`<details>review…</details>`) were hidden behind a collapsible wrapper.
- Programs table had no university column; the staging_university_id FK was not rendered.
- All 6 junction tables (university/scholarship/program×country/subject) deferred and not wired into the import.
- 50-row display limit per entity type may silently truncate large batches.
- `import_batches.import_status` has a valid `needs_review` CHECK constraint value but no app code ever set it.

No files modified.

## 2026-06-22 - Phase 58B: Import Pipeline UX Implementation

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Implement import pipeline UX improvements based on Phase 58A findings. No schema changes, no new dependencies, no merge behavior changes.

Files modified:
- `src/pages/admin/imports.astro`: full rewrite.
- `src/pages/admin/imports/[id].astro`: 13 targeted edits.
- `docs/06-status.md`: updated phase.
- `docs/07-task-log.md`: added Phase 58A and 58B entries.

Import list page improvements (`imports.astro`):
- Added `LIFECYCLE_LABEL` const mapping each batch status to a human-readable label.
- Added local `BATCH_STATUS_BADGE` extending `IMPORT_STATUS_BADGE` with `needs_review: 'bg-amber-100 text-amber-700'`.
- Added introductory paragraph explaining the import batch lifecycle.
- Added helper text inside create batch form about batch type meanings.
- `<details>` auto-opens on form errors via `hasFormError`.
- Updated table columns: Type | Status | Lifecycle | Records staged | Errors | Created | (action).
- Dates changed to `toLocaleString()`.
- "View" link renamed to "Open".
- Better empty state with dashed border.

Batch detail page improvements (`[id].astro`):
- Added `stagingUniNameMap` built from already-fetched staging universities — no extra query.
- Added status count computation: awaitingReview (pending+validated), approved, rejected/skipped, merged.
- Added quality issue and validation warning counts.
- Added `qualityChecksRun` flag, `DISPLAY_LIMIT`, `mayBeTruncated`, and `nextStepMessage` guidance string.
- Added local `BATCH_STATUS_BADGE` and `ERROR_TYPE_LABEL` consts.
- 6-cell status summary grid (staged / awaiting / approved / rejected / merged / issues) with colored counts.
- 4-step lifecycle progress bar (Import rows → Quality checks → Review rows → Merge) with per-step completion indicators.
- "What to do next?" guidance banner showing computed next action.
- Truncation warning banner when any entity type hits the display limit.
- Review buttons now always visible — outer `<details>review…</details>` wrapper removed from all 4 entity sections.
- Programs table: added University column showing staging university name via `stagingUniNameMap`.
- Per-row status cell: added `warnings` and `quality` mini-badges for rows with issues.
- Actions cell: error messages now use amber color for quality issues vs. orange for validation warnings.
- Staging errors section: replaced plain table with friendlier "Issues (N)" section with friendly type labels, When timestamp, and debug info collapsed in `<details>raw</details>`.

Batch status behavior fix:
- `bulk_import` handler: sets `import_batches.import_status = 'needs_review'` when `inserted > 0` and current status is `pending`.
- Manual form handler: sets `import_batches.import_status = 'needs_review'` when current status is `pending`.

Validation:
- npm run build: PASS.
- service_role / createServiceClient grep: zero new matches in Phase 58B files.
- set:html / innerHTML grep: zero new matches in Phase 58B files.
- Cloudinary secret exposure grep: zero matches for PUBLIC_ exposure; all hits are in pre-existing server-only lib files.

Deferred to 58C:
- JSON template download button.
- AI/Perplexity prompt copy block.
- Bulk import preview before insert.
- CSV and file upload support.
- `set_match_scholarship_id` and `set_match_article_id` actions.
- Programs university dropdown in manual add form.
- Auto quality checks after import.

Deferred to Phase 60:
- Supabase Storage import file attachments.
- Large batch processing and background workers.
- Bulk merge and bulk approve.
- CSV column mapping UI.

Validation:
- npm run build: PASS.
- service_role grep: zero new matches in Phase 57C files.
- set:html/innerHTML grep: zero matches in Phase 57C files.
- Cloudinary secret grep: zero matches in Phase 57C files.
- config.ts/upload.ts import grep: zero matches in Phase 57C files.

## Current / Open Notes

- Cloudinary account must be configured for SHA-256 signatures (or set CLOUDINARY_SIGNATURE_ALGORITHM=sha1 as fallback).
- If a future task needs older history, open the smallest relevant archive file instead of rereading the full snapshots.
