# DegreeWiki Recent Task Log

> AI agent reading rule:
> For normal work, read only this recent task log. Do not open older archive files unless the task specifically needs older phase details.

## Recent Task Log

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

- Next major phase: AI Gateway provider/account management UI on top of the 69B backend foundation.

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
