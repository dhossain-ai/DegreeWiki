# DegreeWiki Current Status

> AI agent reading rule:
> Read this active status file first for current context. Open archive files only when older phase detail is specifically needed, and pick the smallest matching archive range.

## Current Project Status

Bundle 14 added secure bearer-token mobile endpoints for the authenticated user profile and
Saved Programs. These endpoints support the next Android Profile/Saved Items implementation.
No service-role key, cookie dependency, or schema change was introduced. Existing browser
routes, public mobile APIs, and RLS behavior are unaffected.

Authenticated mobile endpoints now available:

- `GET /api/mobile/me`
- `GET /api/mobile/me/saved-items`
- `POST /api/mobile/me/saved-items`
- `DELETE /api/mobile/me/saved-items/[savedItemId]`

Public mobile endpoints (unchanged):

- `GET /api/mobile/programs`
- `GET /api/mobile/programs/[slug]`
- `GET /api/mobile/universities`
- `GET /api/mobile/universities/[slug]`
- `GET /api/mobile/countries`
- `GET /api/mobile/countries/[slug]`
- `GET /api/mobile/scholarships`
- `GET /api/mobile/scholarships/[slug]`
- `GET /api/mobile/guides`
- `GET /api/mobile/guides/[slug]`

Bundle 14 payload highlights:

- Bearer-token auth helper (`src/lib/mobile/auth.ts`) validates tokens through Supabase Auth,
  creates an authenticated anon client, and preserves RLS without cookies or service-role key.
- `GET /api/mobile/me` returns user identity, optional profile, and saved-program count.
- `GET /api/mobile/me/saved-items` returns saved programs with joined program details,
  newest first, excluding unpublished programs.
- `POST /api/mobile/me/saved-items` validates published status and upserts idempotently.
- `DELETE /api/mobile/me/saved-items/[savedItemId]` is RLS-scoped and idempotent.
- Only `program` entity type is supported. No compare, fit finder, chat, or other saved entity types.
- Exact contracts are documented in `docs/11-mobile-api.md`.

Current branch: `main`

Very short import pipeline summary:
- Program Import Staging is the primary path.
- General Batch Creation stays Advanced / Legacy.
- Review rows first, then choose the production action, then publish only if needed.
- Cleanup is super-admin only and limited to import/staging records.

## Bundle 12 Validation

- `npm run build` passed
- Local API QA passed for:
  - `GET /api/mobile/scholarships` returned 1 published record
  - `GET /api/mobile/scholarships/romanian-government-scholarship` returned `{ ok, item }`
  - `GET /api/mobile/guides` returned 3 published records
  - `GET /api/mobile/guides/erasmus-mundus-scholarship-for-non-eu-students-complete-guide-20252026`
    returned `{ ok, item }` with 36 structured body blocks
  - missing scholarship and guide slugs returned safe JSON `404` responses

## Bundle 13.1 Runtime Verification

- Live `https://degreewiki.com/api/mobile/programs`, `/universities`, and `/countries` returned
  `200`, while all scholarship/guide list and detail patterns returned Cloudflare `1101` before the
  route handlers could return their safe JSON responses.
- Before this fix, `origin/main` did not contain the Bundle 12 commits and the deployed Worker was
  behind the verified Bundle 12 build. Bundle 12 is now merged into `main` and deployed.
- The configured local Astro server and `wrangler dev --local` worker both returned `200` for the
  known scholarship/guide routes and safe JSON `404` for missing slugs. This rules out the Supabase
  queries, table/relationship names, anonymous RLS, nullable rows, serialization, and Markdown
  transformation as the source of the production 500s.
- `npm run build` passed. No raw database error, stack trace, or internal error detail was exposed
  by the verified local routes.
- Production retest after deploy passed: both lists and known details returned `200`; missing
  scholarship and guide slugs returned the safe JSON `404` bodies.

## Bundle 14 Deployment + Authenticated QA

- `npm run build` passed.
- Deployed to Cloudflare Worker via `npx wrangler deploy`.
  Worker Version ID: `99ef881b-1e7b-4811-9f4a-3063fd3e1d2e`.
- Fixed a production runtime bug in `GET /api/mobile/me/saved-items`: the original query used PostgREST embedded join `programs!inner(...)` which fails because `saved_items.entity_id` has no FK to `programs`. Replaced with a two-query approach: fetch saved items, then batch-fetch matching published programs.
- All five public mobile list endpoints returned `200` after deploy.
- Authenticated production QA with a real user bearer token: 61 tests, 0 failures.
- Unauthenticated QA:
  - `GET /api/mobile/me` → `401 { ok: false, error: "sign_in_required" }`
  - `GET /api/mobile/me/saved-items` → `401`
  - `POST /api/mobile/me/saved-items` → `401`
  - `DELETE /api/mobile/me/saved-items/[id]` → `401`
- Authenticated QA:
  - `GET /api/mobile/me` → `200` with `user`, `profile`, `savedSummary`
  - `GET /api/mobile/me/saved-items` → `200` empty `items` array
  - `POST /api/mobile/me/saved-items` with valid program → `200` with `savedItemId`
  - Saving the same program twice → idempotent, same `savedItemId`
  - `GET /api/mobile/me/saved-items` → saved item appears in list with program details
  - `GET /api/mobile/me` → `programCount >= 1`
  - `DELETE /api/mobile/me/saved-items/[savedItemId]` → `200 { ok: true, saved: false }`
  - Double delete → idempotent `200`
  - Deleted item no longer in list
- Validation QA:
  - Malformed JSON body → `400 { error: "invalid_json" }`
  - Unsupported entity type → `400 { error: "unsupported_entity_type" }`
  - Missing entity ID → `400 { error: "invalid_entity_id" }`
  - Non-existent program → `404 { error: "program_not_found" }`
  - Invalid UUID on delete → `400 { error: "invalid_saved_item_id" }`
- Security checks: no raw database errors, no tokens, no stack traces in any response.

## Next Recommended Bundle

- Add Android Profile/Saved Items screens consuming the new authenticated mobile endpoints
  (`/api/mobile/me`, `/api/mobile/me/saved-items`). Add Android scholarship and guide DTOs,
  repositories/cache integration, and public browse/detail screens.

## Current Import Workflows

- First import: approve -> merge new programs -> publish as unverified.
- Enrichment: approve -> update existing matched programs.
- Approved rows remain the only rows eligible for production actions.
- Batch actions stay scoped to visible or explicitly matched rows unless a deliberate all-matching confirmation is used.

## Critical Rules

- Contributor Phase 82C stays review-workflow-only:
  no public contributor directory, no public contributor profile pages, no contributor avatar
  upload endpoint/UI, no contributor submission form UI yet, and no live-content publishing or
  verification actions by contributors.
- Bundle 14 stays profile-and-saved-programs-only:
  no Android app changes, no public-page design changes, no compare/fit-finder/chat changes,
  no saved universities/scholarships/guides/countries, no schema changes, and no new dependencies.
- Contributors must not directly publish or verify live public data.
- Keep AI usage-limit rollout incremental: no seeded active policy rows in the migration.
- Preserve legacy env fallback when no matching DB policy exists.
- No new dependencies.
- No service role, `createServiceClient`, or RLS bypass in app pages or mobile auth routes.
- No production deletion from import cleanup: programs, universities, scholarships, articles, media, and production `data_sources` stay untouched.
- No auto-overwrite of non-empty production fields.
- No subject auto-creation and no intake/deadline import.
- No unsafe HTML APIs such as `set:html` or `innerHTML`.
- Phase 82C checks run:
  `npm run build`,
  `npx tsc --noEmit`,
  `rg -n \"innerHTML|set:html|service_role|SERVICE_ROLE|createServiceClient\" src`,
  and
  `rg -n \"AI_GATEWAY_MASTER_KEY|GEMINI_API_KEY|OPENROUTER_API_KEY|SUPABASE_SERVICE_ROLE_KEY\" src`.
- Phase 82C keeps scope tight:
  no public contributor directory/profile pages, no proof upload flow, no Cloudinary contributor
  upload endpoint, no contributor content-submission UI, no admin-permission grant to contributors,
  and no new dependencies.

## Known Open Notes

- Phase 80B production-hardening target is Cloudflare-first launch on `https://degreewiki.com`.
- `www.degreewiki.com` should redirect to the apex domain and should not be treated as a first-launch auth hostname.
- Astro's Cloudflare adapter expects a production KV binding named `SESSION`; the real namespace must be created and bound in Cloudflare before deploy.
- Google OAuth remains configured in Supabase Auth, not in app runtime env vars.
- Google-created users remain non-admin by default for launch.
- The new `contributor` role is seeded with no admin permissions.
- Contributor application submit/update flows and admin review UI now exist, but public contributor
  directory/profile pages, contributor proof upload, contributor content-submission UI, direct
  public contributor-profile reads, and avatar upload/review flows remain deferred.
- `030_contributor_review_workflow.sql` must be applied before live admin contributor approvals can
  grant the `contributor` role or create approved contributor profiles/scopes.
- `npx tsc --noEmit` still reports pre-existing repo-wide type errors in older AI/import modules
  outside Phase 82C contributor files.
- A later follow-up may add explicit `student` role assignment on signup if future features require role membership beyond the current non-admin default.
- Phase 70B kept the article workflow small and safe:
  no migration, no dependency changes, no schema changes, and no create/edit/save/publish contract
  changes.
- Phase 70C keeps AI article assistance equally narrow:
  no migration, no dependency changes, no suggestion persistence, no auto-save, no auto-publish,
  and no automatic body replacement.
- Public guide rendering contracts stayed the same in Phase 70B aside from tiny fallback bug fixes
  for trimmed SEO/meta values and safer OG image URL generation.
- Article verification remains status-only in Phase 70A.
  The admin article editor does not stamp or update `last_verified_at`.
- The admin article assistant uses `use_case = 'admin_article_draft'`, resolves to the `admin`
  audience tier, and requires active AI Gateway routing before it can return suggestions.
- AI usage quotas can now be controlled through `ai_usage_limit_policies` and the
  `/admin/ai-gateway?tab=limits` tab.
- The new quota system checks DB policy first, then falls back to the legacy env-based combined
  daily counting, then fails closed if authoritative counting is unavailable.
- Static site-chat answers and reviewed preset `ai_static_answers` answers remain uncounted because
  they bypass provider-backed AI calls entirely.
- AI Gateway admin tests remain uncounted because they do not use the normal runtime quota/logging
  path.
- Old `ai_usage_logs` rows cannot be perfectly split retroactively by use case because earlier
  successful chat-like calls were logged only by `session_type`.
- DB-backed provider routing is ready, but it still depends on provider/account/model/policy rows
  before it replaces env fallback in practice.
- DB-managed provider accounts currently support `openai_compatible` only.
- Gemini and OpenRouter remain env-fallback only for now, outside the DB-managed provider list.
- The AI Gateway admin page is now a tabbed control center with Overview, Providers, Models,
  Routing, Limits, Testing, and Health tabs.
- The public chatbot shell is limited to `/`, `/programs*`, `/universities*`, `/scholarships*`,
  and `/guides*`. Anonymous visitors get static guidance only; logged-in site chat stays separate
  from saved-result chat and does not attach Finder-result or student-profile context.
- Published `ai_static_answers` rows can now answer common site-chat questions without calling AI.
  Answers are plain text only and are managed at `/admin/ai-knowledge` under `manage_ai_settings`.
- Cloudinary still needs the SHA-256 signature setup, or `CLOUDINARY_SIGNATURE_ALGORITHM=sha1` as a fallback.
- Default site OG image is still not configured.
- CSV import and persistent uploaded-file import storage remain deferred.
- Destination country profiles now exist at `/destinations/[slug]`, but guide/article previews for
  countries remain deferred because articles still do not carry a proper country relation.
- Country profile enrichment columns now exist in the schema, the admin country form wires those
  fields for create/edit, and the public destination page now renders the enriched country content.
- Destination sitemap/indexing enforcement remains intentionally deferred until country admin
  exposes `indexing_status`, so published destination pages are still included in the sitemap
  without additional indexing filtering.
- University profile enrichment columns now exist in the schema, the admin university create/edit
  forms wire both the previously hidden existing fields and the new enrichment fields, and the
  public university pages now render the richer profile sections.
- `indexing_status` still exists on universities but remains intentionally deferred for admin/public
  behavior in this phase.
- University-wide tuition/application-fee content and provider-specific ranking fields remain
  intentionally deferred to keep university profiles plain-text, low-risk, and additive.
- After creating the university enrichment migration, it must be applied to Supabase before live
  testing or deployment of admin/public code that queries the new university columns.
- `program_intakes` import remains intentionally deferred.
- Mobile list routes still preserve the existing raw-array response shape for backward
  compatibility, while the new slug detail routes use `{ ok: true, item }`.
- Public mobile routes use the anon Supabase client plus published-only filters, and destination
  country routes additionally require `is_destination_enabled = true`.
- Authenticated mobile routes use the anon client with the user's bearer token injected as an
  Authorization header, preserving RLS without cookies or the service-role key.

## Archive Index

Status archives:
- [Status 01-10](archive/status/status-history-phase-01-10.md)
- [Status 11-20](archive/status/status-history-phase-11-20.md)
- [Status 21-30](archive/status/status-history-phase-21-30.md)
- [Status 31-40](archive/status/status-history-phase-31-40.md)
- [Status 41-50](archive/status/status-history-phase-41-50.md)
- [Status 51-60](archive/status/status-history-phase-51-60.md)
- [Status 61-68](archive/status/status-history-phase-61-68.md)

Task-log archives:
- [Task log 01-10](archive/task-log/task-log-phase-01-10.md)
- [Task log 11-20](archive/task-log/task-log-phase-11-20.md)
- [Task log 21-30](archive/task-log/task-log-phase-21-30.md)
- [Task log 31-40](archive/task-log/task-log-phase-31-40.md)
- [Task log 41-50](archive/task-log/task-log-phase-41-50.md)
- [Task log 51-60](archive/task-log/task-log-phase-51-60.md)
- [Task log 61-68](archive/task-log/task-log-phase-61-68.md)

## Reading Guidance

- Future agents should read archive files only when older context is specifically needed.
- Use the narrowest matching phase range first.
- Prefer the recent task log for current work, and the split archives for older phase details.

