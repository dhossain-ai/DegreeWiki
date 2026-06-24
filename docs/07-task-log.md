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

Deferred to Phase 58C (now complete — see below):
- JSON template and download, AI/Perplexity prompt copy block.
- Bulk import preview before insert.
- `set_match_scholarship_id` and `set_match_article_id` actions.
- Programs university dropdown in manual add form.
- Auto quality checks after bulk import.

Deferred to Phase 60:
- CSV and file upload support.
- Supabase Storage import file attachments.
- Large batch processing and background workers.
- Bulk merge and bulk approve.
- CSV column mapping UI.

Validation:
- npm run build: PASS.

## 2026-06-22 - Phase 58C: Import Templates + Preview + AI Research Workflow

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Make the JSON-based import workflow easier to use with AI/Perplexity-researched data, without adding file upload or CSV support.

Files added:
- `src/lib/admin/importTemplates.ts`: JSON template strings and field notes for all 4 entity types.
- `src/lib/admin/importPrompts.ts`: copyable AI/Perplexity research prompt strings for all 4 entity types.

Files modified:
- `src/pages/admin/imports/[id].astro`: multiple targeted edits.
- `docs/06-status.md`: updated phase.
- `docs/07-task-log.md`: added Phase 58C entry.

No changes to existing import library files (importParse.ts, importValidation.ts, importReview.ts, importMerge.ts, importQuality.ts). No schema changes. No new dependencies.

Feature: JSON templates & AI prompts
- New `src/lib/admin/importTemplates.ts` exports `IMPORT_TEMPLATES` and `TEMPLATE_FIELD_NOTES` for universities, programs, scholarships, articles.
- New `src/lib/admin/importPrompts.ts` exports `AI_PROMPTS` with research prompts instructing AI to use official sources, return null for unknown fields, and emit valid JSON matching the template shape.
- "Templates & AI Prompts" collapsible section added on the batch detail page, above the bulk import form.
- For mixed batches, section shows 4 tabs (universities/programs/scholarships/articles); single-type batches show only the relevant tab.
- Each tab shows: JSON template textarea (readonly) + Copy button + Download .json link; AI prompt textarea + Copy button; field notes list with required/optional markers.
- Copy buttons use `navigator.clipboard.writeText()` with execCommand fallback — no innerHTML.
- Download links use `data:application/json;charset=utf-8,...` data URIs rendered server-side — no new endpoints.

Feature: JSON preview
- Bulk JSON import textarea now has `id="bulk-json-input"`.
- Preview `<div>` below textarea updated live on each keystroke via `is:inline` vanilla JS.
- Valid state (green): shows item count + first 3 sample names + "Preview does not save data" note.
- Invalid state (red): shows JSON parse error message.
- Not-array state (red): explains expected array format.
- No innerHTML, no external deps.

Feature: program university selector
- Manual Add Staged Record form: program fieldset now includes a "Staging University" field.
- If staged universities exist in the batch: renders a `<select>` with options (name or UUID).
- If no staged universities: renders a text `<input>` with guidance text.
- Server handler reads `prog_staging_university_id`, validates UUID format + batch membership, inserts `staging_university_id` into staging_programs row.

Feature: set_match_scholarship_id + set_match_article_id
- New POST action handlers `set_match_scholarship_id` and `set_match_article_id` added, mirroring existing `set_match_university_id`.
- Both validate: UUID format, batch membership, `approved` status, production record existence.
- "Link to existing production scholarship/article" collapsible forms added on scholarship/article rows when approved and no match ID is set.
- This unblocks the update-existing merge paths that were already implemented in importMerge.ts but unreachable.

Feature: auto quality checks after bulk import
- Quality checks now auto-run at the end of every successful `bulk_import` action (when `inserted > 0`).
- Reuses all existing detect* functions from importQuality.ts — no logic rewritten.
- Non-fatal: errors are logged to console; quality check failure does not block the import success redirect.
- Auto quality count is appended to the redirect as `&quality=N`, which shows the existing quality banner.
- Manual "Run quality checks" button remains available for re-runs.

Feature: import method guidance
- Workflow steps (Copy template → AI research → Paste JSON → Import) shown inside the templates panel.
- Existing "What to do next?" guidance banner preserved.

Architecture notes:
- `BATCH_UUID_RE` const added at module scope in `[id].astro` (avoids repeating the regex in each handler).
- Nested university+programs pack import NOT supported (parser does not support it); templates document current supported shape; nested-pack deferred to Phase 60.
- Template/prompt section hidden for batch types that have no matching entity type (defensive, should not occur given BATCH_TYPES validation on creation).

Validation:
- npm run build: PASS.
- service_role / createServiceClient grep: zero new matches.
- set:html / innerHTML grep: zero new matches (preview uses textContent + style only).
- Cloudinary secret exposure grep: zero new matches.

Deferred to Phase 60:
- CSV import and file upload.
- Nested university+programs pack import.
- Supabase Storage import file attachments.
- Bulk merge / bulk approve.
- Background processing for large batches.
- service_role grep: zero new matches in Phase 57C files.
- set:html/innerHTML grep: zero matches in Phase 57C files.
- Cloudinary secret grep: zero matches in Phase 57C files.
- config.ts/upload.ts import grep: zero matches in Phase 57C files.

## 2026-06-22 - Phase 58D: Research Pack Import + Rich Program Field Mapping

Tool:
- Codex GPT-5

Goal:
- Accept nested source-backed AI research packs in mixed import batches.
- Preserve rich program source data in staging raw_data.
- Map safely supported rich program fields into existing production `programs` columns during reviewed create-new merge.

Inspection findings:
- `programs` already has rich columns for degree_award, primary_subject_id, study_mode, delivery_mode, language_of_instruction, duration_months, tuition amounts/currency/period/notes, application fee fields, official_url, application_url, admission_requirements, english_requirements, gpa_requirements, curriculum_summary, career_outcomes, content_status, verification_status, indexing_status, and quality scores.
- `staging_programs.raw_data` already exists.
- Program merge previously read only extracted staging columns, not raw_data.
- `data_sources` can represent program source URLs, but insert is governed by existing RLS (`manage_data_sources` or super_admin).

Implementation:
- `src/lib/admin/importParse.ts`: added `parseResearchPackJson()` for `{ university, programs }`; retained flat-array parsing; normalized common degree aliases to seeded degree level codes.
- `src/pages/admin/imports/[id].astro`: mixed bulk import now detects research-pack shape, stages the university first, resolves exact country name/ISO2 to country code when possible, stages each program with the new `staging_university_id`, and reuses existing review/quality-check flow.
- `src/lib/admin/importMerge.ts`: program create-new merge now reads `raw_data` and maps supported rich fields to production; primary subject resolves only by exact case-insensitive subject name; verification remains `unverified`; source URLs are best-effort inserted into `data_sources` after production program creation.
- `src/lib/admin/importTemplates.ts` and `src/lib/admin/importPrompts.ts`: added "Research Pack" template/prompt and corrected program degree-level examples to current seeded codes.
- Batch JSON preview now recognizes research packs and shows `1 university, N programs` with sample program titles.

Safety:
- No schema changes and no new dependencies.
- No direct production import; staging/review/approve/merge remains required.
- No automatic `verified` status.
- Flat JSON array imports remain supported.
- Data-source insert failure does not expose raw provider errors and does not roll back the already-created draft program; admin can add sources manually.

Validation:
- `npm run build`: PASS.
- Required service-role, XSS, and Cloudinary secret scans run after implementation.

Known limitations:
- Research packs are mixed-batch only.
- Country name resolution requires an exact country name match; otherwise the staged university keeps a validation warning until corrected.
- `duration_text`, `required_documents_text`, `scholarship_notes`, `official_tuition_url`, `missing_fields`, and freeform notes remain in `raw_data`.
- `primary_subject_id` is mapped only when exactly one existing subject name matches; no new subjects are created.
- Source attachment depends on current user permissions and existing `data_sources` RLS.

## 2026-06-22 - Phase 58E: Direct Draft Research Pack Import

Tool:
- Codex GPT-5

Goal:
- Add a local-only workflow that imports a cleaned or raw nested research-pack JSON file directly into production tables as draft/unverified content only, with safe duplicate matching and a markdown report.

Core findings:
- There was no existing `scripts/` import runner, so a standalone Node script was the safest pattern.
- Direct production writes require the Supabase service role; an anon/RLS admin session would not be a good fit for a local direct-import tool.
- `universities` supports the draft fields needed for a direct import, and `programs` already has the rich content columns that Phase 58D mapped from staging.
- `data_sources` can preserve source URLs for both universities and programs.

Implementation:
- Added `scripts/import-research-pack.mjs`.
- Added `npm run import:research-pack`.
- Reads the clean research pack if present, otherwise falls back to the raw JSON after validating the JSON shape.
- Matches universities by exact normalized name and/or official URL.
- Matches programs by normalized title + university_id + degree level.
- Creates draft/unverified production records only.
- Existing draft/unverified matches receive empty-field-only patches; existing published/verified matches are skipped.
- Source URLs are preserved in `data_sources`.
- Writes `data/reports/mru-lithuania-2026.import-report.md`.
- Generates a sibling `.clean.json` copy when the raw file is used directly.

Safety:
- No staging tables are used by this script.
- No delete, publish, or verified status changes are performed.
- No app page/component uses the service role; the script is local-only.
- Missing `PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` causes a fast failure before any write.

Validation:
- `npm run build`: PASS.
- `Get-ChildItem src/pages,src/lib,src/layouts,src/components,scripts -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE|createServiceClient"`: existing AI server-only hits plus the new local import script only.
- `Get-ChildItem src/pages,src/lib,src/layouts,src/components,scripts -Recurse -File | Select-String -Pattern "set:html|innerHTML"`: existing fit-finder comment only.
- `Get-ChildItem src/pages,src/lib,src/layouts,src/components,scripts -Recurse -File | Select-String -Pattern "CLOUDINARY_API_SECRET|PUBLIC_CLOUDINARY_API_SECRET|PUBLIC_CLOUDINARY_API_KEY"`: existing server-only Cloudinary config/comments only.
- `npm run import:research-pack -- data/raw/mru-lithuania-2026.research-pack.json --dry-run`: failed closed because `PUBLIC_SUPABASE_URL` is not set in this workspace.

Known limitations:
- The script still depends on local Supabase credentials to actually run.
- Program rows that cannot resolve degree level or required university context are skipped with a report entry instead of being forced through.

## 2026-06-23 - Phase 60: Public Article UX + SEO Rendering

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Improve the public article/guide detail page UX and SEO signal after Phase 59 improved the admin authoring form.
- Wire the SEO fields that were added to the schema but not yet used on the public side.
- Add reading time, Fit Finder CTA, and related article cards.

Hard stop check:
- No database migration required — seo_h1 existed since migration 008; last_verified_at since migration 017.
- No new dependencies.
- No Markdown renderer introduced — content continues to render as plain paragraphs split on \n\n.
- No set:html or innerHTML.
- No service role in public pages.
- No architecture changes.
- No changes to admin article forms (Phase 59 files untouched).

Files modified:
- `src/pages/guides/[slug].astro`: full rewrite.
- `src/layouts/BaseLayout.astro`: added articlePublishedTime/articleModifiedTime props and meta tags.
- `src/layouts/PublicLayout.astro`: pass-through for the two new props.
- `docs/06-status.md`: updated phase.
- `docs/07-task-log.md`: added this entry.

Changes to `[slug].astro`:
- SELECT now fetches `seo_h1` and `last_verified_at` (both existed in schema; both were previously missing from the public query).
- H1 element now uses `seo_h1 || title` so editors can set a different display heading without changing the canonical title.
- Reading time computed server-side: `ceil(wordCount / 200)` where wordCount is whitespace-split word count of `content`.
- Category badge + published date + reading time shown in a single meta row in the article header.
- Summary moved from the article body (below featured image) into the header band as a lede/subtitle directly below the H1 — better editorial structure.
- `SourceBox` now receives `lastVerifiedAt` from the DB (was hardcoded to `null` since Phase 57C).
- `ogType="article"` passed to PublicLayout for correct Open Graph type.
- `articlePublishedTime` and `articleModifiedTime` passed as ISO strings for the new meta tags.
- `FitFinderMiniPanel` added below the article body and trust box.
- Related articles query added: same `article_category_id`, excludes current article, ordered by `published_at` DESC, limit 3.
- Related articles rendered as a `GuideCard` grid in a new section below the main article container.

Changes to `BaseLayout.astro`:
- Added `articlePublishedTime?: string` and `articleModifiedTime?: string` props.
- Emits `<meta property="article:published_time">` and `<meta property="article:modified_time">` when values are present.

Changes to `PublicLayout.astro`:
- Added `articlePublishedTime?: string` and `articleModifiedTime?: string` props with pass-through to BaseLayout.

Security:
- No innerHTML or set:html in any modified file.
- No service role or createServiceClient in any public file.
- Related articles query uses the anon/RLS client — RLS `articles_select_published` enforces content_status = 'published'.
- All reading time and word count logic is server-side arithmetic on trusted DB content.

Validation:
- `npm run build`: PASS.
- `grep -rn "innerHTML|set:html" src/pages/guides/ src/layouts/BaseLayout.astro src/layouts/PublicLayout.astro`: NONE.
- `grep -rn "service_role|SERVICE_ROLE|createServiceClient" src/pages/guides/ src/layouts/BaseLayout.astro src/layouts/PublicLayout.astro`: NONE.

Deferred:
- Article junction table wiring (article_countries/subjects/degree_levels) in the admin form.
- Markdown/rich-text body rendering.
- Reading time on guide listing cards (would require selecting `content` in the listing query; expensive for large lists).

## 2026-06-23 - Phase 59: Article Authoring UX

Tool:
- Claude Sonnet 4.6 (Claude Code)

Goal:
- Improve the admin article create and edit forms with a better layout, surface the six SEO fields that already existed in the schema but were never wired into the forms, and add live editorial aids (word count, SEO preview, writing templates, char counters).

Files modified:
- `src/pages/admin/articles/new.astro`: full rewrite.
- `src/pages/admin/articles/[id].astro`: full rewrite.
- `docs/06-status.md`: updated phase and next phases.
- `docs/07-task-log.md`: added this entry.

Schema gap surfaced (no migration needed):
- Six fields existed in `articles` since migration 008 but were never in the admin form: `seo_title`, `seo_description`, `seo_h1`, `canonical_url`, `og_title`, `og_description`.
- `data_completeness_score` and `source_confidence_score` added to the edit page select query and displayed read-only.

Layout changes:
- Identity section (title + slug) is now full-width above a two-column grid.
- Left column: Editorial Setup (category + writing template buttons), Content (summary + body), Images, SEO (preview + 6 fields).
- Right sidebar (`lg:sticky lg:top-6`): Publishing, Verification, Data Quality (edit only, read-only), Actions.
- Single `<form method="post">` wraps both columns — POST logic unchanged.

Features added:
- **Writing template buttons**: five `<button type="button" data-template="...">` buttons; clicking pre-fills `#content` textarea via `.value = WRITING_TEMPLATES[key]`; `confirm()` if body is non-empty. Templates defined entirely inside `<script is:inline>` as a JS object literal — no Astro frontmatter interpolation.
- **Summary character counter**: `#summary-count` updated via `input` event using `textContent`.
- **Word count + reading time**: `#word-count` updated via `input` event; words = whitespace-split count; reading time = `ceil(words/200)` minutes.
- **SEO preview box**: simulated Google snippet with `#seo-preview-url`, `#seo-preview-title`, `#seo-preview-desc` updated via `textContent` only; fallback chain `seo_title || title` and `seo_description || summary`.
- **SEO char counters**: inline `<span>` counters next to seo_title and seo_description labels; green ≥50/120, red >60/160.
- **Save and Publish action**: `<button name="action" value="publish">` triggers server-side status override (`content_status = published`, `indexing_status = index`) before validation runs; validation still executes in full.
- **Human-readable status labels**: `CONTENT_STATUS_LABELS`, `VERIFICATION_LABELS`, `INDEXING_LABELS` maps used in `<select>` options; raw enum values unchanged as form values.
- **`canonical_url` validation**: `validateUrl()` from existing `validate.ts` applied server-side.
- **Data quality sidebar** (edit only): `data_completeness_score` and `source_confidence_score` shown as read-only progress bars with inline percentage widths via server-rendered `style` attribute; `published_at` shown if set.

Security:
- No `innerHTML`, no `set:html`, no `eval` anywhere in the modified files.
- No `service_role` or `createServiceClient` in any page or component.
- All JS preview and counter updates use `textContent` or `.value` only.
- `WRITING_TEMPLATES` are static string constants — no user input interpolated.
- `canonical_url` validated with `validateUrl()` server-side.
- UUID allow-list validation for media fields unchanged.
- Progress bar widths are clamped server-side (`Math.min(100, Math.max(0, Number(...)))`) before use in `style` attribute.

Validation:
- `npm run build`: PASS.
- `grep -rn "innerHTML" src/pages/admin/articles/`: no matches (exit 1).
- `grep -rn "set:html" src/pages/admin/articles/`: no matches (exit 1).
- `grep -rn "service_role|SERVICE_ROLE|createServiceClient" src/pages/admin/articles/`: no matches (exit 1).

Deferred:
- Article junction table wiring (article_countries, article_subjects, article_degree_levels) — requires additional DB queries and multi-select UI.
- Markdown/rich-text body preview.
- Slug auto-generation on title keystroke (currently server-side only on POST).

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
