# DegreeWiki Recent Task Log

> AI agent reading rule:
> For normal work, read only this recent task log. Do not open older archive files unless the task specifically needs older phase details.

## Recent Task Log


### Bundle 14 - Mobile Profile + Saved Programs API

- Added secure bearer-token mobile endpoints for the authenticated user profile and Saved Programs.
- Created `src/lib/mobile/auth.ts` — reusable bearer-token authentication helper that validates
  tokens through Supabase Auth, creates an authenticated anon client with the token injected as
  an Authorization header, and preserves RLS without cookies or the service-role key.
- Created `GET /api/mobile/me` — returns the authenticated user identity, optional profile,
  and saved-item summary. A missing `user_profiles` row returns `profile: null` without error.
- Created `GET /api/mobile/me/saved-items` — returns saved programs newest first with joined
  program details. Excludes unpublished programs. Empty list is valid `200`.
- Created `POST /api/mobile/me/saved-items` — validates JSON body, verifies published program,
  idempotent upsert via `onConflict` unique constraint. Returns saved item details.
- Created `DELETE /api/mobile/me/saved-items/[savedItemId]` — RLS-scoped deletion, idempotent.
- No service-role key. No client-provided user ID. RLS enforces `user_id = auth.uid()`.
- No schema changes. No new dependencies. No Android modifications. No public web UI changes.
- Only `program` entity type supported.

#### Files Created

- `src/lib/mobile/auth.ts`
- `src/pages/api/mobile/me/index.ts`
- `src/pages/api/mobile/me/saved-items/index.ts`
- `src/pages/api/mobile/me/saved-items/[savedItemId].ts`

#### Files Modified

- `docs/11-mobile-api.md`
- `docs/05-coding-standards.md`
- `docs/06-status.md`
- `docs/07-task-log.md`

#### Validation

- `npm run build` passed.
- Security grep checks passed.
- Unauthenticated QA: all four endpoints return `401`.
- Authenticated QA marked as pending.

### Bundle 13.1 - Scholarship/Guide API Runtime Fix

- Diagnosed production `500 error code: 1101` responses from the scholarship and guide list/detail
  route patterns. Existing mobile browse routes (`programs`, `universities`, and `countries`) still
  returned `200` in production.
- Confirmed `origin/main` is behind: it does not include Bundle 12 commits `623cf93`, `d2e46dc`, or
  `883c5a8`. The completed implementation is on
  `codex/bundle-12-scholarships-guides-api`.
- Reproduced the intended routes using the configured local environment in both Astro dev and the
  Cloudflare-compatible `wrangler dev --local` worker. Scholarship/guide lists and known details
  returned `200`; missing slugs returned the existing safe JSON `404` bodies.
- The local Worker emitted no server error for any focused request. Because the same live Supabase
  configuration, anon client, queries, relationships, published-only filters, null handling, and
  content transformation pass locally, the production failure is a stale/bad deployed Worker
  version, not an application runtime defect. No code contract redesign or runtime code change was
  required.
- Merged Bundle 12 into `main` as `cec2e5b` and pushed it to `origin/main`, then deployed the
  verified Worker. After rollout propagation, all six production route checks passed.
- Kept raw arrays for lists, `{ ok: true, item }` for details, published-only visibility, anon/RLS
  access, safe errors, and no service role.

#### Validation And API QA

- `npm run build` passed.
- Local Astro and local Worker QA each passed:
  - `GET /api/mobile/scholarships` -> `200` raw array.
  - `GET /api/mobile/scholarships/romanian-government-scholarship` -> `200 { ok, item }`.
  - `GET /api/mobile/scholarships/does-not-exist` -> safe JSON `404`.
  - `GET /api/mobile/guides` -> `200` raw array.
  - `GET /api/mobile/guides/erasmus-mundus-scholarship-for-non-eu-students-complete-guide-20252026`
    -> `200 { ok, item }`.
  - `GET /api/mobile/guides/does-not-exist` -> safe JSON `404`.
- Production QA after deployment passed with the same expected statuses and shapes: lists are raw
  arrays, known details are `{ ok: true, item }`, and missing slugs are safe JSON `404`s. No response
  exposed raw database errors or stack details.

#### Files Modified

- `docs/06-status.md`
- `docs/07-task-log.md`

### Bundle 12 - Scholarships + Guides Public Mobile API

- Added raw-array `GET /api/mobile/scholarships` and `{ ok: true, item }`
  `GET /api/mobile/scholarships/[slug]` routes using the established anon Supabase mobile helper.
- Confirmed scholarship public visibility is `content_status = 'published'`; expired records are
  not automatically hidden. Responses expose the stored ISO deadline, free-text deadline context,
  and display value without inventing active/expired/closing-soon status.
- Scholarship list fields cover id/slug/name, provider and classification values/labels, teaser,
  numeric/display amounts, deadline values, study countries, degree levels, subjects, safe public
  URLs, verification metadata, update date, and Cloudinary image URL.
- Scholarship detail adds plain-text overview/eligibility/coverage, structured nationality,
  country, degree, subject, published university/program relationships, provider URL,
  source-confidence metadata, and separate logo/cover URLs.
- Added raw-array `GET /api/mobile/guides` and `{ ok: true, item }`
  `GET /api/mobile/guides/[slug]` routes for published articles only.
- Guide list fields cover id/slug/title, summary, category, modeled country/subject/degree-level
  relationships, publication/update dates, and Cloudinary cover URL. Full content is omitted from
  the list query, so read time is not generated there.
- Guide detail converts the stored Markdown-like text with the existing public-page parser into
  `structured_blocks_v1` JSON blocks, returns derived section headings and detail-only reading time,
  and includes up to three cheap same-category published related guides.
- Content safety: no raw HTML rendering contract; only headings, paragraphs, lists, emphasis, and
  safe HTTP(S) links are represented. Invalid link schemes become plain text. Public outbound
  scholarship URLs are also restricted to HTTP(S).
- Security: all four routes use the anon client plus explicit published filters and RLS; there is no
  service role, schema change, auth requirement, private/student/admin/import data, raw database
  error, stack trace, dependency, Android change, public-page design change, or personalized feature.
- Exact response shapes and nullable behavior are documented in `docs/11-mobile-api.md`.

#### Files Created

- `src/pages/api/mobile/scholarships.ts`
- `src/pages/api/mobile/scholarships/[slug].ts`
- `src/pages/api/mobile/guides.ts`
- `src/pages/api/mobile/guides/[slug].ts`
- `docs/11-mobile-api.md`

#### Files Modified

- `src/lib/mobile/public.ts`
- `docs/06-status.md`
- `docs/07-task-log.md`

#### Files Deleted

- none

#### Validation And API QA

- `npm run build` passed.
- Local configured-environment QA returned 1 published scholarship and 3 published guides.
- `GET /api/mobile/scholarships/romanian-government-scholarship` returned `{ ok, item }`.
- `GET /api/mobile/guides/erasmus-mundus-scholarship-for-non-eu-students-complete-guide-20252026`
  returned `{ ok, item }` with `structured_blocks_v1` and 36 body blocks.
- `GET /api/mobile/scholarships/does-not-exist` returned
  `404 { "ok": false, "error": "scholarship_not_found" }`.
- `GET /api/mobile/guides/does-not-exist` returned
  `404 { "ok": false, "error": "guide_not_found" }`.

#### Known Issues

- The current scholarship schema has no structured opening date, required-document, application
  process, selection-process, or public-contact fields; those values were not invented.
- The current guide schema has no tags or featured flag. Public guide pages do not expose authors,
  so mobile guide author data remains deliberately omitted.

#### Next Recommended Bundle

- Implement Android scholarship/guide DTOs, repositories and cache behavior, then public list/detail
  UI against these documented contracts. Keep Saved, Compare, Fit Finder, Chat, and personalization
  out of that browse integration unless separately authorized.

### Bundle 6 - Public Mobile API Expansion for Browse Details

- Expanded the existing public mobile list routes under `src/pages/api/mobile/` without breaking
  the current raw-array list contract shape used by Android.
- Added a shared `src/lib/mobile/public.ts` helper for public mobile JSON responses, anon Supabase
  client creation, safe Cloudinary URL building, shared date/money/duration formatting, intake
  labels, FAQ normalization, and safe mobile-only response helpers.
- Expanded `GET /api/mobile/programs` with additive public-safe browse fields including university
  ids/slugs, country id/code, city/location, degree metadata, structured tuition metadata,
  language, study mode, delivery mode, official URL, verification status, last verified date, and
  image URL.
- Added `GET /api/mobile/programs/[slug]` returning a published-only normalized detail payload with
  university/country/city summaries, degree/subject metadata, duration, language, study and
  delivery mode, tuition/application fee fields, intake/deadline rows, requirements, curriculum,
  career outcomes, public URLs, verification metadata, and public-safe media URLs.
- Expanded `GET /api/mobile/universities` with additive short/native naming, country name/code,
  official URL, verification metadata, ranking summary, and teaser-friendly list fields.
- Added `GET /api/mobile/universities/[slug]` returning a published-only normalized detail payload
  with admissions/application/support summaries plus a small related-program summary.
- Expanded `GET /api/mobile/countries` to destination-enabled published countries only and added
  ISO code, continent, currency, tuition/living overview, and verification fields.
- Added `GET /api/mobile/countries/[slug]` returning a published-only normalized destination detail
  payload with enriched study-abroad guidance, structured cost ranges, work/post-study fields,
  official URLs, FAQ entries, verification metadata, and small related university/program
  summaries.
- Hardened the mobile routes so database errors no longer return raw Supabase error messages in the
  JSON body.
- Kept scope intentionally narrow: no Android changes, no scholarships/guides mobile endpoints, no
  auth saved-items changes, no Fit Finder/chat changes, no schema changes, and no new dependencies.
- Ran `npm run build`, `npx tsc --noEmit`, and local API QA against the new list/detail routes.

#### Files Created

- `src/lib/mobile/public.ts`
- `src/pages/api/mobile/programs/[slug].ts`
- `src/pages/api/mobile/universities/[slug].ts`
- `src/pages/api/mobile/countries/[slug].ts`

#### Files Modified

- `src/pages/api/mobile/programs.ts`
- `src/pages/api/mobile/universities.ts`
- `src/pages/api/mobile/countries.ts`
- `docs/06-status.md`
- `docs/07-task-log.md`

#### Files Deleted

- none

#### Validation And API QA

- `npm run build` passed
- `npx tsc --noEmit` still fails on pre-existing repo-wide AI/import typing issues outside Bundle 6
- Local dev server API checks passed:
  - `GET /api/mobile/programs`
  - `GET /api/mobile/programs/accounting-and-management-information-systems`
  - `GET /api/mobile/universities`
  - `GET /api/mobile/universities/aalto-university`
  - `GET /api/mobile/countries`
  - `GET /api/mobile/countries/bulgaria`
  - missing program/university/country slugs returned `404`

#### Known Issues

- `npx tsc --noEmit` remains red because of older repo-wide AI/import typing problems unrelated to
  this mobile API bundle
- The existing mobile list routes still use raw arrays, while the new detail routes use
  `{ ok: true, item }`
- Program list routes intentionally do not include intake/deadline fields yet because that would
  require a broader cross-row intake query than this low-risk bundle allowed

#### Next Recommended Bundle

- Update Android DTOs/cache/detail flows to consume the new public mobile detail endpoints and
  additive list fields
- Design scholarships and guides mobile endpoints only as a separate explicit bundle

### Phase 82C - Contributor Application + Admin Review Bundle

- Added `030_contributor_review_workflow.sql` with a narrow authenticated
  `review_contributor_application()` RPC so reviewer/admin users can move contributor applications
  through review, block self-review, ensure `contributor_profiles` exists on approval, grant the
  non-admin `contributor` role via `user_roles`, and optionally create approved country/university
  contributor scopes without using service-role code in app pages.
- Added `src/lib/contributors/application.ts` for contributor form normalization, server-side
  validation, external-link parsing, and shared contributor status labels/badges/summaries.
- Added public `/become-a-contributor` with contributor-program explainer copy, login/signup CTA
  for signed-out users, draft/save + submit handling for authenticated users, owner-safe status
  display, and `needs_more_info` review-note feedback.
- Added `/account/contributor` plus a new contributor status card on `/account` so authenticated
  users can track application state, reviewer notes, approved contributor placeholder state, and
  resume editable draft or `needs_more_info` applications.
- Added `/admin/contributors` and `/admin/contributors/[userId]`, linked the queue in admin
  navigation, and protected both routes with the existing admin permission guard using the same
  reviewer/admin permission family already recognized by `can_manage_contributor_records()`.
- Added admin review actions for `pending_review`, `needs_more_info`, `approved`, and `rejected`,
  including optional scope assignment on approval and a visible approved-contributor state when a
  matching `contributor_profiles` row already exists.
- Kept scope intentionally tight: no public contributor directory or profile pages, no proof/file
  upload flow, no Cloudinary contributor avatar work, no contributor content-submission UI, no new
  dependencies, and no admin-permission grant to contributor users.
- Ran `npm run build`, `rg -n "innerHTML|set:html|service_role|SERVICE_ROLE|createServiceClient" src`,
  and `rg -n "AI_GATEWAY_MASTER_KEY|GEMINI_API_KEY|OPENROUTER_API_KEY|SUPABASE_SERVICE_ROLE_KEY" src`.
- Ran `npx tsc --noEmit`; it still fails on pre-existing repo-wide AI/import typing issues outside
  the Phase 82C contributor files.

### Phase 82B - Contributor DB/RLS Foundation

- Added `029_contributor_foundation.sql` with a seeded non-admin `contributor` role and six new
  contributor foundation tables:
  `contributor_applications`, `contributor_profiles`, `contributor_scopes`,
  `contributor_profile_subjects`, `contributor_submissions`, and
  `contributor_submission_sources`.
- Added additive contributor constraints and indexes for application status, public profile review
  state, approved scope targets, normalized subject expertise, contributor submission ownership,
  and submission-source linkage.
- Added reviewer/admin contributor-management RLS plus owner-safe RLS across the new contributor
  tables, while intentionally deferring direct public `contributor_profiles` reads until a later
  safe public view or server-side route can gate row and field visibility more strictly.
- Added owner-update trigger guards on contributor applications and contributor submissions so
  future owner flows can edit draft or `needs_more_info` rows without letting owners self-review,
  self-approve, or change protected review fields.
- Added minimal contributor helper modules under `src/lib/contributors/` for shared status unions,
  editability checks, and public profile/avatar visibility checks.
- Updated the database plan and active status docs to record the new contributor foundation and to
  note that UI, upload, and review workflows remain deferred.
- Kept the phase intentionally narrow: no contributor public pages, no contributor dashboard or
  admin review UI, no contributor submission form UI, no Cloudinary contributor upload flow, no
  live-content publishing by contributors, and no new dependencies.
- Ran `npm run build`, `npx tsc --noEmit`, and the existing safety greps for unsafe HTML,
  service-role usage, and secret-key references in `src`.

### Phase 74 - University Profile Enrichment Bundle

- Added `028_university_profile_enrichment.sql` with additive nullable columns on `public.universities`
  for profile identity, campus summary, admissions/application content, student-support content,
  and a ranking source URL.
- Expanded `src/pages/admin/universities/new.astro` and `src/pages/admin/universities/[id].astro`
  so admins can now create and edit existing hidden university fields plus the new enrichment
  fields, grouped into identity/location, profile, admissions/application, student support/life,
  ranking, SEO, and edit-only review/trust sections.
- Added conservative admin validation for official/application/ranking/canonical URLs, admissions
  email, founded year, student count, selected country existence, selected city existence, and
  city-to-country matching while preserving form values on validation errors.
- Tightened the edit-only university data-source panel with URL validation and safe enum validation
  without redesigning source management.
- Expanded `src/pages/universities/[slug].astro` so public university pages now use `seo_h1`,
  render secondary short/native naming when present, expand key facts, and show conditional plain-
  text sections for admissions, campus life, international-student support, career support,
  scholarships, housing, and language requirements.
- Updated `src/pages/universities/index.astro` with a small teaser improvement so list cards prefer
  `overview` text when available and fall back to `ranking_summary` otherwise, without redesigning
  the listing page.
- Kept the phase intentionally narrow: no country changes, no import/staging changes, no new
  dependencies, no QS/THE/national ranking-specific fields, no university-wide tuition or
  application-fee fields, and no indexing/sitemap enforcement changes.
- Ran `npm run build` plus the required safety greps for unsafe HTML/service-role usage and
  secret-key references in `src`.

### Phase 73D - Public Country Profile Enrichment Wiring

- Expanded `src/pages/destinations/[slug].astro` so public destination pages now query and render
  the Phase 73B country enrichment fields, including quick facts, structured tuition/living-cost
  ranges, visa/work guidance, education and scholarship content, official source links, and
  defensively validated FAQ entries.
- Removed the duplicate country overview rendering by switching the hero to a short overview teaser
  and keeping the full overview in a single dedicated Overview section rendered as safe plain-text
  paragraphs only.
- Improved the country page hierarchy with a richer quick-facts grid, expanded section navigation,
  grouped content cards, a stronger trust note, and country-specific empty states for program and
  university previews.
- Reused `ProgramCard` for the programs preview, fetched a slightly larger candidate set, and
  diversified the visible preview in memory so one university is less likely to dominate the first
  six cards.
- Extended university previews to include public-safe overview teasers when available while keeping
  the existing inline card pattern and country-filter CTA to `/universities?country=<uuid>`.
- Wired country SEO fields on the public page with sensible fallbacks for title, description, H1,
  canonical, and OG metadata, while intentionally deferring sitemap/indexing enforcement because
  country admin still does not expose `indexing_status`.
- Kept the phase public-page-only and low-risk: no schema changes, no migrations, no admin form
  changes, no import/staging changes, no university schema/admin changes, and no new dependencies.
- Ran `npm run build` plus the required safety greps for unsafe HTML/service-role usage and secret
  key references in `src`.

### Phase 73C - Country Admin Form Wiring

- Expanded `src/pages/admin/countries/new.astro` and `src/pages/admin/countries/[id].astro` so
  admins can now create and edit the Phase 73B country enrichment fields directly from the admin
  UI.
- Added grouped admin sections for destination facts, cost and study planning, visa and work,
  education and scholarships, official source URLs, and optional FAQ JSON while preserving the
  existing base country fields, image pickers, redirects, and edit-only verification status field.
- Added comma-separated parsing for country `text[]` inputs, nullable select handling for
  work-rights booleans, uppercase normalization for currency codes, numeric range validation for
  tuition and living costs, and URL validation for official education/visa links.
- Added raw FAQ JSON textarea handling with server-side validation that accepts only an array of
  objects containing non-empty string `question` and `answer` values, while saving empty input as
  `null`.
- Kept the phase admin-only and low-risk: no schema changes, no migration changes, no public
  destination page changes, no import/staging changes, no university changes, and no new
  dependencies.
- Ran `npm run build` plus the required safety greps for unsafe HTML/service-role usage and
  secret-key references in `src`.

### Phase 73B - Country Profile Enrichment Schema

- Added `027_country_profile_enrichment.sql` with additive nullable columns on `public.countries`
  for destination facts, editorial overviews, structured tuition/living-cost ranges, work and
  post-study metadata, official education/visa URLs, and FAQ JSON content.
- Added nullable-safe CHECK constraints for non-negative tuition/living-cost values and for
  `max >= min` range safety when both sides are present.
- Kept the phase schema-only and low-risk: no `universities` changes, no admin form wiring, no
  public destination page changes, no import/staging changes, no new indexes, and no RLS changes.
- Documented the phase in the active database plan and status docs, with admin country wiring
  deferred to Phase 73C, public destination wiring deferred to Phase 73D, and university
  admin/schema work deferred to Phase 74.
- Ran `npm run build` plus the required safety greps for unsafe HTML/service-role usage and
  secret-key references in `src`.

### Phase 72A - Public Country Profile UX Polish

- Added a dedicated public destination country route at `src/pages/destinations/[slug].astro`
  using `countries.slug`, published-only filtering, destination-enabled filtering, and the same
  `404` response pattern used by the existing public slug pages.
- Built a country hub with a hero, quick stats, anchor navigation, overview handling, country-level
  trust note, bottom Fit Finder CTA, and preview sections for published programs and universities.
- Reused the public `ProgramCard` component for country-linked program previews, including saved
  state support, and kept university previews inline to avoid introducing a new component just for
  this phase.
- Updated destination card links on `/destinations` and the homepage so public country cards now
  open `/destinations/{slug}` instead of sending users directly to `/programs?country=<uuid>`.
- Extended the sitemap to include published destination country profile URLs and expanded the
  `PublicLayout` chat allowlist so the public chat shell also appears on destination profile pages.
- Kept the phase UI-focused and safe: no migration, no schema change, no dependency install, no
  guide/article country previews, and no country-level verification claims beyond the existing
  `verification_status` field.
- Ran `npm run build` plus the required safety greps for unsafe HTML, service-role usage, and
  secret-key references in `src`.

### Phase 71A - AI Usage Limits Admin

- Added `026_ai_usage_limit_policies.sql` with DB-backed per-use-case/per-audience quota policy
  rows, updated-at trigger, admin-only RLS, and additive `ai_usage_logs` columns for `use_case`,
  `audience_tier`, and `anonymous_session_id`.
- Added shared usage-policy resolution in `src/lib/ai/usage/policies.ts` so runtime quota checks
  now prefer DB policy rows, fall back to the legacy env-based combined daily counting when no
  matching DB policy exists, and fail closed when authoritative counting is unavailable.
- Extended the shared AI logging and rate-limit path so successful usage rows now record
  `use_case` and `audience_tier`, with the article assistant explicitly resolving to the `admin`
  audience tier instead of blending into generic chat rows going forward.
- Kept static site-chat answers and reviewed preset `ai_static_answers` answers uncounted because
  they still bypass `callAI()` and provider calls entirely.
- Kept AI Gateway admin tests uncounted because the testing path still bypasses the normal product
  quota/logging flow.
- Added admin usage-limit CRUD helpers plus `/api/admin/ai-gateway/usage-limits` with safe JSON
  validation, duplicate protection, no raw Postgres errors, and suggested starter policies shown
  in the response/UI only.
- Added a new Limits tab to `/admin/ai-gateway` with fallback/env guidance, starter policy
  examples, filters, create/edit/enable-disable/delete actions, and explicit explanations about
  static answers and admin tests not consuming quota.
- Documented the rollout rule that the new policy table starts empty so the legacy env fallback
  remains active until admins deliberately create DB-backed policy rows.
- Ran `npm run build` plus the required safety greps for unsafe HTML, service-role usage, and
  secret-key references in `src`.

### Phase 70C - Article AI Assistant Foundation

- Added an admin-only article AI assistant endpoint at `/api/admin/articles/ai-assist` plus
  server-side article-assist normalization that caps title, summary, content, category, and SEO
  fields before calling the shared AI Gateway.
- Added a dedicated `src/lib/ai/prompts/admin-article-draft.ts` prompt for the
  `admin_article_draft` route with plain-text output rules, anti-hallucination constraints,
  no-citation/no-live-verification rules, and supported actions limited to outline, SEO title,
  SEO description, summary, FAQ ideas, and risk checks.
- Kept the assistant narrow and editorial-only: no auto-save, no auto-publish, no full article
  generation, no automatic body replacement, no new persistence table, and no raw provider errors
  exposed to the browser.
- Extended the shared `callAI()` path with a prompt override so admin-only article assist can reuse
  the existing gateway routing, rate limiting, output guardrails, usage logging, and metadata-only
  gateway call logs without changing Fit Finder or chat behavior.
- Added an AI Assistant card to `src/components/admin/ArticleEditorForm.astro` with safe fetch
  calls, loading/error states, plain-text suggestion output, warning display, copy support, local
  apply buttons for summary/SEO fields, and local append-only body actions for outline/FAQ
  suggestions.
- Updated `/admin/ai-gateway` so `admin_article_draft` is clearly visible as the admin article
  drafting and SEO suggestion use case alongside the existing live student-facing routes.
- Kept article suggestions session-only and documented that the assistant currently shares the
  existing `chat` quota bucket to avoid a migration.

### Phase 70B - Article Publish + SEO Polish

- Polished `/admin/articles` to surface article readiness more quickly with readiness badges,
  clearer missing-summary/body/image/SEO indicators, indexing badges, and direct links to edit or
  open the public guide when an article is published.
- Tightened the shared `src/components/admin/ArticleEditorForm.astro` workflow so the public guide
  path messaging is clearer, the open-guide action only appears for published articles with a slug,
  and the placeholder guidance explains whether the next step is adding a slug or publishing.
- Clarified editor fallback copy for OG title and description while preserving the exact field
  names, POST payloads, save redirects, and existing publish behavior.
- Hardened `src/pages/guides/[slug].astro` and `src/lib/public/media.ts` so whitespace-only SEO
  fields fall back sensibly, canonical URLs prefer the stored article slug when available, and OG
  image URLs are skipped instead of rendered malformed when the public Cloudinary cloud name is
  absent.
- Kept the public article body renderer and Markdown contract unchanged: no `innerHTML`, no
  `set:html`, no live Markdown preview, no migration, no new dependency, and no schema change.
- Ran `npm run build` plus the required safety greps for unsafe HTML, service-role usage, and
  secret-key references in `src`.

### Phase 70A - Article Authoring UX Improvement

- Extracted the duplicated admin article create/edit UI into a shared
  `src/components/admin/ArticleEditorForm.astro` component so both routes now stay thin and keep
  the same POST field names, validation, redirects, and save/publish behavior.
- Added pure `src/lib/admin/articleAuthoring.ts` helpers for article word count, reading time,
  heading count, summary and SEO length states, public guide path display, readiness checklist, and
  editorial readiness scoring.
- Reworked the admin article editor into clearer Basics, Article Content, Media, SEO, and
  Publishing / Verification sections with a sticky editorial sidebar for actions, status summary,
  guide path, open-guide link, checklist, metrics, and SEO hints.
- Kept the article body editor plain text / Markdown only, reused safe DOM text updates for live
  counters and SERP preview, and added no `innerHTML`, no `set:html`, no migration, no new
  dependencies, and no public rendering changes.
- Preserved existing article create/edit/save/publish behavior, including first-publish
  `published_at` handling and the Phase 70A decision not to stamp `last_verified_at`.

### Phase 69E - Static Knowledge Base / Preset Q&A Admin

- Added `025_ai_static_answers.sql` with reviewed preset-answer storage, indexes, updated-at
  trigger, published-only anon/authenticated read policies, and admin CRUD policies under
  `manage_ai_settings`.
- Added a site-chat preset matcher that normalizes questions, checks exact question match,
  alias match, and keyword phrase match in that order, with simple priority tie-breaks.
- Kept hardcoded safety/refusal routes first, then added DB-backed preset answers before the
  anonymous sign-in prompt or logged-in AI fallback in `/api/ai/site-chat`.
- Added `/admin/ai-knowledge` with filters, search, create/edit, publish/archive actions, and
  a bulk JSON import panel for reviewed preset answers.
- Added admin API endpoints for knowledge-base list/create/update/publish/archive/delete plus
  JSON import validation with a 100-row max and draft-only imports.
- Kept answers plain text only with no Markdown rendering, no HTML rendering, no embeddings,
  no RAG, and no live AI generation at request time for preset answers.

### Phase 69D - Public Chatbot Shell + Logged-In AI Chat Foundation

- Added a floating public chatbot widget rendered through `PublicLayout` on a tight allowlist of
  public routes only: home, programs, universities, scholarships, and guides.
- Kept anonymous chatbot behaviour static-only with no AI call, no persistence, and no access to
  saved results, student profile context, RAG, or internet browsing.
- Added dedicated site-chat endpoints for session loading, logged-in chat, and chat clearing under
  `src/pages/api/ai/site-chat*.ts`.
- Reused the existing `chat_answer` AI Gateway use case, shared guardrails, and existing
  `ai_usage_logs` quota checks for logged-in site chat only.
- Added a separate site-chat router/context/persistence layer that stores global site chat in
  `ai_conversations` / `ai_messages` with `session_type = 'chat'` and
  `ai_finder_result_id = null`.
- Preserved saved-result chat behaviour and UI on `/fit-finder/results/[id]` with no route,
  prompt, or context regression.
- Updated privacy and AI docs to document the new public shell, the anonymous static-only rule,
  and the fact that global site chat does not attach the latest Finder result in Phase 69D.

### Phase 69C-UX2 - AI Gateway Control Center Redesign

- Redesigned `/admin/ai-gateway` from one long stacked admin page into a server-rendered tabbed
  control center with Overview, Providers, Models, Routing, Testing, and Health tabs.
- Expanded the Overview tab with live route order summaries, env fallback status, active entity
  counts, setup guidance, and provider/model/routing definitions for admins.
- Converted provider records into summary cards with masked key metadata visible and metadata/key
  replacement actions kept in separate collapsed panels.
- Kept model editing, routing policy editing, preset tests, and health reset flows on their own
  focused tabs while reusing the existing admin API endpoints.
- Made no backend/router/security changes: no migrations, no provider encryption behavior changes,
  no public `/api/ai/finder-summary` or `/api/ai/chat` changes, and no public chatbot expansion.

### Phase 69C-UX - AI Gateway Admin UX Polish

- Reworked `/admin/ai-gateway` into a clearer operating dashboard with top summary cards for env
  fallback, active providers/models/policies, health issues, and live use cases.
- Added a visible recommended setup panel that walks admins through provider, model, policy, and
  preset-test steps for the two live routes: `fit_finder_summary` and `chat_answer`.
- Polished provider account cards to surface protocol/base URL, masked key metadata,
  privacy/access flags, linked model/policy counts, and clearer separation between metadata edits
  and warning-labeled key replacement.
- Collapsed the create forms for provider/model/policy management when records already exist to
  reduce page overwhelm, while keeping provider creation open by default on empty state.
- Grouped routing policies by use case, made live versus non-live routes obvious, and surfaced
  priority order, env fallback allowance, and timeout/attempt controls more clearly.
- Improved admin test result guidance with recommendation copy for success, rate limits,
  compatibility errors, and timeout/network failures without exposing raw provider bodies.

### Phase 69C - Admin AI Gateway Dashboard + Provider Testing

- Added `/admin/ai-gateway`, protected by `manage_ai_settings`, and linked it in admin navigation.
- Added admin-only API endpoints for provider accounts, models, routing policies, health reset,
  and preset provider/model tests under `src/pages/api/admin/ai-gateway/`.
- Added server-only admin helpers for AI Gateway API auth, strict validation, CRUD operations,
  and isolated preset testing.
- Implemented provider account create/edit/key-replace flows with immediate server-side encryption
  and masked-only key metadata in the UI.
- Implemented model and routing policy management UI for practical admin configuration.
- Added provider health visibility plus reset action that clears failures/error/cooldown while
  preserving historical success/failure timestamps.
- Added preset-only admin provider/model tests that use no real student data and do not mutate
  production provider health/cooldown state.
- Kept DB-managed provider support scoped to `openai_compatible` only.
- Kept Gemini/OpenRouter as env-fallback only, with no public chatbot expansion and no change to
  `/api/ai/finder-summary` or `/api/ai/chat` contracts.

### Phase 69B - AI Gateway Foundation Bundle

- Added `024_ai_gateway_foundation.sql` with:
  `ai_provider_accounts`, `ai_models`, `ai_routing_policies`, `ai_provider_health`,
  and `ai_gateway_call_logs`.
- Seeded `manage_ai_settings` and granted it to `super_admin` without changing
  existing `view_ai_logs` behavior or `ai_usage_logs`.
- Added server-only AI gateway helpers for encrypted provider key storage,
  DB-backed provider/model/policy loading, structured gateway attempt logs,
  and provider health/cooldown updates.
- Added a reusable OpenAI-compatible provider adapter for DB-managed accounts.
- Refactored `callAI()` to keep app-level guardrails/quota checks in place while routing
  existing LLM execution through use-case routing:
  `fit_finder_summary` for Fit Finder summaries and `chat_answer` for saved-result chat.
- Preserved current product behavior:
  Fit Finder still renders rule-based matches first, AI summary stays async and summary-only,
  saved-result chat stays bound to `ai_finder_result_id`, and static chat responses still avoid AI.
- Updated privacy disclosure to mention stored AI chat messages/responses.

### Phase 68 - Import Pipeline Polish Bundle

- Made Program Import Staging the primary recommended path on `/admin/imports`.
- Framed General Batch Creation as Advanced / Legacy and clarified the valid use cases.
- Added recent-batch filters, direct links to Program Import, and clearer batch-detail review steps.
- Added super-admin batch cleanup for import/staging records only, guarded by checkbox plus typed `DELETE`.

### Phase 67C - Program Import Bulk Update Existing Enrichment

- Added a dedicated bulk enrichment pass for program staging rows.
- Kept the exact duplicate-safe match rule: normalized title + linked production university + degree level.
- Bulk enrichment only patches empty allowlisted fields, never creates production programs, and reports skipped or failed rows clearly.
- Updated the import workflow docs and batch-page guidance for the second-pass enrichment flow.

### Phase 67B - Program Import Final QA + Prompt Tightening

- Tightened the built-in program import prompts so they stay JSON-only and stick to the supported field set.
- Reworked the preferred research-pack shape around `university + programs`.
- Updated the import helper copy and workflow docs to match the current supported program import path.

### Phase 67A - Program Duplicate Cleanup + Safe Delete

- Added duplicate-focused program cleanup tools with archive, restore, and super-admin hard-delete flows.
- Hard delete stays conservative and skips programs tied to immutable analytics/outbound history.
- Safe cleanup only removes program-scoped records and never touches shared universities or media.

### Open Note

- Next major AI work can build on the reviewed preset-answer layer without changing the existing
  provider-key privacy boundaries or adding RAG/internet dependencies.

## Archive Index

- [Task log 01-10](archive/task-log/task-log-phase-01-10.md)
- [Task log 11-20](archive/task-log/task-log-phase-11-20.md)
- [Task log 21-30](archive/task-log/task-log-phase-21-30.md)
- [Task log 31-40](archive/task-log/task-log-phase-31-40.md)
- [Task log 41-50](archive/task-log/task-log-phase-41-50.md)
- [Task log 51-60](archive/task-log/task-log-phase-51-60.md)
- [Task log 61-68](archive/task-log/task-log-phase-61-68.md)

## Reading Guidance

- Do not read old archive files unless the task specifically needs old phase details.
- Prefer the smallest matching archive range when older context is required.
