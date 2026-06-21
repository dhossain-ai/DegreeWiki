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

## Current / Open Notes

- Phase 57A changes are uncommitted and ready for review before commit.
- Entity image attachment to public pages deferred to Phase 57B.
- Cloudinary account must be configured for SHA-256 signatures (or set CLOUDINARY_SIGNATURE_ALGORITHM=sha1 as fallback).
- If a future task needs older history, open the smallest relevant archive file instead of rereading the full snapshots.
