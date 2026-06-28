# DegreeWiki Recent Task Log

> AI agent reading rule:
> For normal work, read only this recent task log. Do not open older archive files unless the task specifically needs older phase details.

## Recent Task Log

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
