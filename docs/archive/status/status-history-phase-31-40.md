# DegreeWiki Status Archive

> Split archive for Phase 31-40. Use the narrowest matching range first.
> Older phases beyond this range live in the next archive file.

Phase 40 — Import / Staging Foundation Bundle — complete.


Phase 39 — Data Source + Verification Foundation Bundle — complete.


Phase 38 — Program + Scholarship Advisor Boundary Plan — complete (docs only).


Phase 37 — AI Chat Routing + Static Response Bundle — complete.


Phase 36 — Saved Result Chat Completion Bundle — complete.


Phase 35 — Saved Result Chat UI Foundation — complete.


Phase 34 — Saved Result Chat API Endpoint Foundation — complete.


Phase 33 — Context-Bound Chat Prompt + Server Helper Foundation — complete.


Phase 32 — AI Chat Schema Foundation — complete.


Phase 31 — AI Chat Architecture Plan — complete.


Phase 40 — Import / Staging Foundation Bundle (complete):

- Migration 018: Added `staging_articles` table (mirrors staging_universities/programs/scholarships
  conventions: raw_data jsonb, extracted fields, match_article_id FK, import_status CHECK,
  self-ref duplicate_of_id, reviewed_by/at, timestamps, trigger, 8 indexes, admin-only RLS).
  Extended `import_batches.batch_type` CHECK to include `'articles'`.
  Extended `staging_errors.staging_table` CHECK to include `'staging_articles'`.

- badges.ts: Added `articles: 'bg-teal-100 text-teal-700'` to BATCH_TYPE_BADGE.

- /admin/imports: Added manual "Create Import Batch" form (batch_type + notes, POST handler,
  validates batch_type with validateIn, inserts with status=pending and zero counts, redirects
  to new batch detail page on success). Added "View" link per row to detail page.

- /admin/imports/[id]: New read-only detail page. Shows batch metadata (type, status, counts,
  notes, linked data source, timestamps). Queries staging records for the batch's entity type
  (or all four sections for mixed). Raw JSON shown only via JSON.stringify in <pre> — never
  innerHTML or set:html. Staging errors shown in a separate section. No approve/reject actions.

No CSV/file upload. No parsing. No AI extraction. No approve/merge workflow.
No duplicate detection. No background jobs. No public UI changes. No new dependencies.

Files created (2):
  supabase/migrations/018_import_staging_articles.sql
  src/pages/admin/imports/[id].astro

Files modified (3):
  src/lib/admin/badges.ts
  src/pages/admin/imports.astro
  docs/06-status.md, docs/07-task-log.md

Validation results:
  npm run build: see build check in task log.
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
  innerHTML|set:html in new/modified files: 0 matches.

## Last Completed Work


Phase 39 — Data Source + Verification Foundation Bundle (complete):

- Migration 017: Added `last_verified_at timestamptz` to `articles` table.
  Articles was the only content table missing this column; all other content tables
  (countries, universities, programs, scholarships) already had it. SourceBox.astro
  can now display a verified-at date for articles.

- Admin countries edit: Added `verification_status` select field (same 6-option enum
  as programs/scholarships/articles). Updated SELECT, type, values, validation, UPDATE.

- Admin universities edit: Added `verification_status` select field. Also added a
  Data Sources panel below the main edit form.

- Admin programs edit: Added Data Sources panel below the main edit form.

- Admin scholarships edit: Added Data Sources panel below the main edit form.

Data Sources panel (universities, programs, scholarships):
- Lists all `data_sources` rows linked to the entity via polymorphic entity_type + entity_id.
- Displays: source_url (clickable), source_type, confidence_level, source_status,
  source_title, primary badge. No admin notes exposed.
- Add-source form: source_url (required), source_type, confidence_level, source_status,
  source_title (optional), is_primary_source checkbox. Uses `_action=add_source` hidden
  field to discriminate from the main entity edit POST on the same page.
- On success: redirects to same page (prevents double-submit, shows new row immediately).
- On error: renders inline error above the form; main entity edit state preserved.
- SSR session client only. RLS enforces super_admin access (SELECT + INSERT via
  `manage_data_sources OR super_admin`). No service role.

No new tables. No import pipeline. No user-facing features. No new dependencies.
Public pages unchanged. SourceBox.astro unchanged.

Files created (1):

  supabase/migrations/017_articles_last_verified_at.sql:
    Additive/idempotent. One ALTER TABLE ADD COLUMN IF NOT EXISTS.
    No index (no current filter/sort on last_verified_at for articles).

Files modified (4):

  src/pages/admin/countries/[id].astro:
    Added VERIFICATION_OPTIONS constant. Added verification_status to SELECT,
    CountryRecord type, Values type, initial values, POST parsing, validation,
    UPDATE call, and HTML form (select element before Save buttons).

  src/pages/admin/universities/[id].astro:
    Added VERIFICATION_OPTIONS + SOURCE_TYPE/CONFIDENCE/SOURCE_STATUS constants.
    Added verification_status everywhere (same as countries). Added DataSourceRow type,
    data_sources query, sourceError variable, add_source POST branch, Verification
    section in edit form, Data Sources panel HTML section after form.

  src/pages/admin/programs/[id].astro:
    Added SOURCE_TYPE/CONFIDENCE/SOURCE_STATUS constants. Added DataSourceRow type,
    data_sources query, sourceError variable, add_source POST branch (wraps existing
    edit logic in else), Data Sources panel HTML section after form.

  src/pages/admin/scholarships/[id].astro:
    Same changes as programs. entity_type = 'scholarship'.


Phase 35 — Saved Result Chat UI Foundation (complete):

- Minimal client-side chat UI added to the saved Fit Finder result detail page.
  No new route, no streaming, no chat history loading, no schema changes, no migrations,
  no new dependencies, no React, no service-role expansion in pages/components/layouts.

Files created (1):

  src/components/ai/SavedResultChat.astro:
    Astro component. Props: resultId (server-embedded UUID from result.id).
    Renders: "Ask about this result" heading, scope disclaimer, initially hidden
    transcript area, initially hidden error/status area, labeled textarea, submit button.
    Inline script (define:vars={{ resultId }}):
      Blocks empty and >1000 char messages client-side.
      Disables submit + shows "Asking..." during in-flight request.
      POST to /api/ai/chat with { ai_finder_result_id: resultId, message }.
      On ok: true — appends user and assistant turns via DOM textContent (no innerHTML).
      On error — maps data.error to a safe user-facing string; shows in status area.
      Clears textarea on successful send. Re-enables button in finally block.
      Transcript persists for the page session; cleared on page reload.
    No chat history loading. No streaming. No React. No external dependencies.

Files modified (1 in src):

  src/pages/fit-finder/results/[id].astro:
    Added import SavedResultChat.
    Mounted below match list, conditionally:
      result.result_status === 'complete' && matches.length > 0.
    No other logic changes. No AI calls added to this file.

Error mapping (data.error):
  invalid_message     → "Please enter a valid question between 1 and 1000 characters."
  message_rejected    → data.answer (if present), else safe generic rejection string.
  unauthenticated     → "Please sign in again to continue."
  not_found           → "This result is not available. It may have been deleted..."
  rate_limit_exceeded → "You've reached today's AI usage limit. Please try again tomorrow."
  ai_unavailable      → "AI is temporarily unavailable. Please try again in a few minutes."
  internal_error      → "Something went wrong. Please try again."
  (any other)         → "Something went wrong. Please try again."

Safety boundary:
  Client sends only ai_finder_result_id (server-embedded) and message (user text).
  No program IDs, user IDs, or AI context records in page HTML.
  No model name, token counts, or system prompt text exposed.
  No service_role, createServiceClient, or callAI in component or [id].astro.
  Transcript built with DOM textContent — no HTML injection.
  Scope disclaimer shown on every page load above the input.

Explicit exclusions:
  No new route (src/pages/fit-finder/results/[id]/chat.astro not created).
  No chat history loading from ai_messages.
  No streaming. No WebSocket.
  No schema changes. No migrations. No new npm dependencies.
  No React or client-side framework.
  No service_role in pages/components/layouts.
  No createServiceClient in pages/components/layouts.
  No callAI in pages/components (except existing approved chat.ts and result.astro).
  No changes to src/lib/ai/* or src/pages/api/ai/chat.ts.

Validation results:
  npm run build: PASS (Cloudflare server build, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  callAI in pages/components: chat.ts + result.astro only (unchanged; not in new files).
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
  innerHTML|set:html in src/components/ai: 0 matches.


Phase 34 — Saved Result Chat API Endpoint Foundation (complete):

- Authenticated JSON API endpoint for saved-result-bound AI chat.
  No chat UI, no chat page, no migrations, no new dependencies,
  no service-key expansion in pages/components/layouts.

Files created (1):

  src/pages/api/ai/chat.ts:
    Authenticated POST handler for /api/ai/chat.
    Accepts: { ai_finder_result_id: uuid, message: string (1–1000 chars) }
    Success: { ok: true, answer: string, conversation_id: uuid }
    Errors: 400 (invalid_body, invalid_request, invalid_message, message_rejected),
            401 (unauthenticated), 404 (not_found), 429 (rate_limit_exceeded),
            503 (ai_unavailable), 500 (internal_error).
    Flow: parse → validate → getUser() → checkAIRateLimit → loadChatContext (RLS) →
          getOrCreateConversation → callAI(chat/saved_result) → guardrail check →
          persistChatTurn → return answer.
    No service-key strings in this file. All privileged ops delegated to src/lib/.
    callAI called with sessionType: 'chat', chatMode: 'saved_result'.

Files modified (1):

  src/lib/ai/usage/limits.ts:
    Added checkAIRateLimit(userId, sessionType, env: AIRuntimeEnv): Promise<RateLimitResult>.
    Wraps checkRateLimit with internal service-client creation from AIRuntimeEnv.
    Allows API routes to pre-check rate limits without directly reading service-role secrets.

Security boundary confirmed:
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts: 0 matches.
  createServiceClient in src/pages,src/components,src/layouts: 0 matches.
  callAI in src/pages,src/components: chat.ts (import + call) + result.astro (unchanged).
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.

Persistence failure handling:
  getOrCreateConversation null → 500, no AI call made.
  AI fallbackUsed → no persistChatTurn call.
  persistChatTurn false → server-side console.error; answer still returned (200).
  Usage logging (inside callAI) is fire-and-forget; failure silently ignored.

Explicit exclusions:
  No chat UI. No chat page (src/pages/fit-finder/results/[id]/chat.astro not created).
  No migration. No new npm dependency. No React. No client-side JS. No anonymous chat.
  No service-key usage in pages/components/layouts.
  No AI calls outside saved-result context (chatMode: 'saved_result' + RLS-enforced programs).

Validation results:
  npm run build: PASS (Cloudflare server build, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  callAI in pages/components: chat.ts + result.astro only (both approved).
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.


Phase 33 — Context-Bound Chat Prompt + Server Helper Foundation (complete):

- Server-only helper and prompt hardening phase. No chat route, no API endpoint, no chat UI,
  no live user-facing AI chat, no migrations, no new dependencies, no React, no client-side JS,
  no service_role expansion in pages/components/layouts.

Files created (2):

  src/lib/ai/chat/context.ts:
    Server-only RLS-scoped context loader.
    loadChatContext(resultId, supabase): Promise<ChatResultContext | null>
    Accepts the caller's authenticated SSR Supabase client — no service role.
    RLS enforces result ownership (student_profiles.user_id = auth.uid()).
    Returns null when result not found, not owned by user, or result_status !== 'complete'.
    Limits to top 10 matched programs (MAX_PROGRAMS_IN_CONTEXT).
    Builds ChatResultProgram[] from explicit allowlist: rank, title, university, country,
      city, degreeLevel, subject, tuitionSummary, officialUrl, matchReasons, warnings.
    Internal UUIDs (program_id, ai_finder_result_id, score) never included.

  src/lib/ai/chat/persist.ts:
    Server-only service-role message persistence helper.
    getOrCreateConversation(params, env): Promise<string | null>
      Finds or creates ai_conversations row for (userId, finderResultId).
      Handles unique-constraint race (code 23505) via retry-SELECT.
      session_type: 'chat'. expires_at: null for logged-in users.
    persistChatTurn(params, env): Promise<boolean>
      Inserts user message row (role: 'user', no context_used, no token counts).
      Inserts assistant message row (role: 'assistant', context_used snapshot, token counts).
      Updates ai_conversations.last_message_at (best-effort; failure does not affect return value).
      Returns false if either message INSERT fails.
      Must only be called when callAI() returned fallbackUsed: false.
    Confirmed exact column names from migration 012/016:
      ai_conversation_id (FK), role, content, context_used, ai_model_used,
      prompt_token_count, completion_token_count.

Files modified (5):

  src/lib/ai/types.ts:
    Added ChatResultProgram — LLM-facing compact program shape, no internal UUIDs.
    Added ChatResultContext — server-side chat session context (resultId + programs[]).
    Added ContextUsedSnapshot — audit record for ai_messages.context_used (jsonb).
      Fields: chatMode, promptTemplateVersion, safetyPolicyVersion,
              aiFinderResultId, conversationId, programsUsed, warningsIncluded, missingTuitionCount.
    Added chatMode?: 'saved_result' to AIRequest.

  src/lib/ai/gateway.ts:
    One-line change: passes request.chatMode to buildChatPrompt in the chat branch.

  src/lib/ai/prompts/chat-answer.ts:
    buildChatPrompt(userMessage, context, chatMode?) — backward-compatible.
    chatMode === 'saved_result': 12-rule SAVED_RESULT_SYSTEM_PROMPT.
      Programs formatted as human-readable structured block (not raw JSON).
      Rule 12: model instructed to decline prompt injection attempts.
      User input in user turn only — never interpolated into system prompt.
    chatMode undefined: original generic behavior preserved.
    Exports CHAT_SAVED_RESULT_PROMPT_VERSION = 'chat-saved-result-v1'.

  src/lib/ai/safety/guardrails.ts:
    Input patterns added (checked before LLM call):
      ignore (all) (previous|prior|your) (instructions|rules|context|guidelines|constraints)
      disregard (all) (previous|prior|your) (instructions|rules|context|guidelines|constraints)
    Output patterns added (checked after LLM response):
      you will (receive|get|be awarded) the scholarship
      i can confirm (your) (eligibility|admission|acceptance)
    Exports GUARDRAILS_VERSION = 'guardrails-v2'.

  src/lib/supabase/service.ts:
    Comment updated to reflect approved server-only AI operations:
      usage logging, rate limiting, finder result persistence, chat conversation/message persistence.

Schema/migration facts confirmed:
  result_status 'complete' — confirmed from migration 012 CHECK constraint and all existing page code.
  ai_messages FK column: ai_conversation_id (not conversation_id).
  ai_conversations.session_type CHECK ('finder'|'chat'). Column: session_type.
  ai_conversations.last_message_at: present, timestamptz, nullable.
  No migration added in Phase 33.

Validation results:
  npm run build: PASS (Cloudflare server build, ~9s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  chat/context|chat/persist in src/pages,src/components,src/layouts → 0 matches.
  callAI in src/pages,src/components → 2 matches only in src/pages/fit-finder/result.astro
    (import + invocation, unchanged from Phase 32).
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/ → 0 matches.
  src/pages/fit-finder/results/[id]/chat.astro → does not exist.
  src/pages/api/fit-finder → does not exist.

Explicit exclusions:
  No chat route: src/pages/fit-finder/results/[id]/chat.astro — not created.
  No chat API: src/pages/api/fit-finder — not created.
  No callAI call in Phase 33 code. No getAIEnv call in Phase 33 code.
  No service_role in pages/components/layouts.
  No createServiceClient in pages/components/layouts.
  No new npm dependencies. No migrations beyond 016.
  No React. No client-side JS. No chat UI. No live user-facing chat.
  No changes to providers, env.ts, logging.ts, limits.ts, finder/persist.ts.
  No changes to src/pages/*, src/components/*, src/layouts/*.


Phase 32 — AI Chat Schema Foundation (complete):

- Migration-only phase. No chat UI, no chat route, no API endpoint, no AI calls,
  no source app behavior changes, no new dependencies, no React, no client-side JS,
  no service_role expansion, no admin UI, no public sharing, no matching algorithm changes.

Migration deliverable:
  supabase/migrations/016_ai_chat_schema.sql

Column added:
  ai_conversations.ai_finder_result_id uuid (nullable)
  FK: REFERENCES public.ai_finder_results(id) ON DELETE CASCADE.
  Nullable so existing conversations and future generic chat sessions are unaffected.
  ON DELETE CASCADE: deleting a saved result cascades to its bound conversation and all
    child ai_messages rows (via the existing ai_conversation_id ON DELETE CASCADE FK).

Indexes added:
  idx_ai_conversations_finder_result_id — lookup index on ai_finder_result_id.
  idx_ai_conversations_unique_user_finder_result — partial unique index on
    (user_id, ai_finder_result_id) WHERE ai_finder_result_id IS NOT NULL.
    Enforces one conversation per (user, saved result) pair.
    NULL rows excluded — multiple conversations without a linked result are allowed.

RLS policies updated (drop and recreate):
  ai_conversations_insert_own — WITH CHECK extended with:
    1. ai_finder_result_id ownership: if set, the linked ai_finder_results row must
       belong to auth.uid() via ai_finder_results.student_profile_id →
       student_profiles.user_id = auth.uid().
    2. Cross-field consistency: if both student_profile_id and ai_finder_result_id
       are set, ai_finder_results.student_profile_id must equal
       ai_conversations.student_profile_id. Implemented as a RLS subquery (not a
       table CHECK constraint — PostgreSQL CHECK constraints cannot use subqueries).
  ai_conversations_update_own — same WITH CHECK additions as INSERT.
    USING (user_id = auth.uid()) unchanged.

RLS policies unchanged:
  ai_conversations_select_own, ai_conversations_delete_own,
  ai_conversations_select_super_admin, ai_conversations_delete_super_admin.
  ai_messages schema and RLS unchanged.
  ai_finder_results, ai_finder_program_matches, ai_usage_logs unchanged.

Explicit exclusions:
  No chat route: src/pages/fit-finder/results/[id]/chat.astro — not created.
  No chat API: src/pages/api/fit-finder — not created.
  No src/lib/ai/* changes. No src/pages/* changes. No src/components/* changes.
  No src/layouts/* changes. No callAI call. No getAIEnv call.
  No service_role reference in pages/components/layouts.
  No createServiceClient in pages/components/layouts.
  No new npm dependencies. No new migrations beyond 016.

Validation results:
  supabase db reset: PASS — migrations 001–016 applied successfully.
  npm run build: PASS (Cloudflare server build, zero errors).
  ai_conversations.ai_finder_result_id: exists, nullable uuid.
  FK to ai_finder_results(id) ON DELETE CASCADE: present.
  idx_ai_conversations_finder_result_id: present.
  idx_ai_conversations_unique_user_finder_result: present (partial WHERE ai_finder_result_id IS NOT NULL).
  ai_conversations_insert_own and ai_conversations_update_own: include ai_finder_result_id
    ownership check and cross-field consistency check.
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  callAI in src/pages,src/components → 2 matches only in src/pages/fit-finder/result.astro (unchanged).
  src/pages/fit-finder/results/[id]/chat.astro → does not exist.
  src/pages/api/fit-finder → does not exist.

Files created (1):
  supabase/migrations/016_ai_chat_schema.sql

Files modified (3):
  docs/09-ai-chat-architecture.md — Section 6 updated to reflect Phase 32 resolution;
    Section 10 updated; Section 16 marks Phase 32 as complete.
  docs/06-status.md — this entry.
  docs/07-task-log.md — Phase 32 entry appended.


Phase 31 — AI Chat Architecture Plan (complete):

- Docs-only architecture phase. No source code changes, no routes, no API endpoints,
  no AI calls, no migrations, no new dependencies, no React, no client-side JS,
  no service-role expansion, no admin UI, no public sharing, no matching changes.

Docs deliverable:
  docs/09-ai-chat-architecture.md — complete AI chat architecture document.
    17 sections covering: purpose, non-goals, core product rule, first chat surface,
    current architecture findings, required future migration, route/API architecture,
    context construction, prompt contract, persistence strategy, context_used decision,
    rate-limit/logging strategy, safety layers, privacy/retention, UX boundaries,
    future implementation phases, and test checklist.

Key architecture decisions recorded:
  First chat surface: /fit-finder/results/[id]/chat — context-bound to one saved result.
  No global chatbot. No anonymous chat. No streaming in MVP. No React. No WebSocket.
  Prefer same-page SSR POST handler (consistent with existing results pages).
  Context allowlist: top 10 matched programs, public fields only, no internal UUIDs.
  Multi-turn: pack last 10 pairs into user prompt field for MVP.
  Rate limit: chat + finder share same combined daily user bucket in MVP.
  Persistence: one conversation per (user, saved result); ai_messages via service role only.
  context_used: compact public snapshot; no raw records, no internal IDs, no prompt text.
  Privacy page update required before chat launches publicly.

Key schema finding:
  ai_conversations has NO ai_finder_result_id column. A conversation cannot currently be
  linked to a specific saved ai_finder_results row. A future migration is required.

Future migration requirement (NOT in Phase 31):
  ALTER TABLE ai_conversations ADD COLUMN ai_finder_result_id uuid
    REFERENCES public.ai_finder_results(id) ON DELETE CASCADE;
  ADD CONSTRAINT uq_ai_conversations_user_result UNIQUE (user_id, ai_finder_result_id);
  UPDATE INSERT/UPDATE RLS WITH CHECK to validate result ownership via auth.uid().

Explicit exclusions:
  No src/pages route created. No src/components file changed. No src/layouts file changed.
  No src/lib/ai/* file changed. No supabase/migrations/* file changed.
  No callAI call. No getAIEnv call. No service_role reference in pages/components/layouts.
  No createServiceClient in pages/components/layouts.
  No chat route: src/pages/fit-finder/results/[id]/chat.astro (not created).
  No chat API: src/pages/api/fit-finder (not created).

Files created (1):
  docs/09-ai-chat-architecture.md

Files modified (2):
  docs/06-status.md
  docs/07-task-log.md

Validation results:
  npm run build: PASS (Cloudflare server build, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  callAI in src/pages,src/components → 2 matches only in src/pages/fit-finder/result.astro (unchanged).
  src/pages/fit-finder/results/[id]/chat.astro → does not exist.
  src/pages/api/fit-finder → does not exist.
  docs/09-ai-chat-architecture.md → exists.


