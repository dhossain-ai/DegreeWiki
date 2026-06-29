# DegreeWiki Recent Task Log

> AI agent reading rule:
> For normal work, read only this recent task log. Do not open older archive files unless the task specifically needs older phase details.

## Recent Task Log

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
