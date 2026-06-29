# DegreeWiki Current Status

> AI agent reading rule:
> Read this active status file first for current context. Open archive files only when older phase detail is specifically needed, and pick the smallest matching archive range.

## Current Project Status

Phase 72A is complete. DegreeWiki now has dedicated public destination country profiles at
`/destinations/[slug]`, slug-based destination card links, preview sections for country-linked
programs and universities, and public route coverage updates for sitemap and chat visibility.

Current branch: `main`

Very short import pipeline summary:
- Program Import Staging is the primary path.
- General Batch Creation stays Advanced / Legacy.
- Review rows first, then choose the production action, then publish only if needed.
- Cleanup is super-admin only and limited to import/staging records.

## Current Import Workflows

- First import: approve -> merge new programs -> publish as unverified.
- Enrichment: approve -> update existing matched programs.
- Approved rows remain the only rows eligible for production actions.
- Batch actions stay scoped to visible or explicitly matched rows unless a deliberate all-matching confirmation is used.

## Critical Rules

- Keep AI usage-limit rollout incremental: no seeded active policy rows in the migration.
- Preserve legacy env fallback when no matching DB policy exists.
- No new dependencies.
- No service role, `createServiceClient`, or RLS bypass in app pages.
- No production deletion from import cleanup: programs, universities, scholarships, articles, media, and production `data_sources` stay untouched.
- No auto-overwrite of non-empty production fields.
- No subject auto-creation and no intake/deadline import.
- No unsafe HTML APIs such as `set:html` or `innerHTML`.
- Phase 72A checks run:
  `npm run build`,
  `rg -n "innerHTML|set:html|service_role|SERVICE_ROLE|createServiceClient" src`,
  and
  `rg -n "AI_GATEWAY_MASTER_KEY|GEMINI_API_KEY|OPENROUTER_API_KEY|SUPABASE_SERVICE_ROLE_KEY" src`.

## Known Open Notes

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
- `program_intakes` import remains intentionally deferred.

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
