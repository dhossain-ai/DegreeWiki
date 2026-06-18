# DegreeWiki Current Status

Last updated: 2026-06-18

## Current Phase

Phase 35 — Saved Result Chat UI Foundation — complete.

Phase 34 — Saved Result Chat API Endpoint Foundation — complete.

Phase 33 — Context-Bound Chat Prompt + Server Helper Foundation — complete.

Phase 32 — AI Chat Schema Foundation — complete.

Phase 31 — AI Chat Architecture Plan — complete.

Phase 30 — Account/Profile Area Foundation — complete.

Phase 29 — Fit Finder History Polish — complete.

Phase 28 — AI Finder Production Hardening — complete.

Phase 27 — Saved Finder Results Management — complete.

Phase 26 — AI Finder Result Persistence — complete.

## Last Completed Work

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

Phase 30 — Account/Profile Area Foundation (complete):

- Added a simple authenticated account hub at /account for logged-in users.
  No AI calls, no service_role, no schema changes, no matching algorithm changes,
  no new dependencies, no React, no client-side JS, no admin UI, no public sharing.

Route added:
  /account — SSR page, noindex=true. Anonymous users redirect to
    /login?redirect=/account. Auth gate via supabase.auth.getUser().
    After gate, two lightweight RLS-safe queries run in Promise.all:
      1. student_profiles SELECT id, eq is_anonymous false, limit 1
         → profileExists boolean.
      2. ai_finder_results SELECT id count head:true
         → savedCount integer.
    Both queries fail-safe: console.error server-only, defaults to false/0.
    No user_id, student_profile_id, or internal UUIDs rendered in HTML.

Account page links:
  Fit Finder section:
    Fit Finder preferences → /fit-finder
      subtext: "Preferences saved" or "Not set up yet" from profileExists
    Saved Fit Finder results → /fit-finder/results
      subtext: "N saved result[s]" from savedCount
    Run Fit Finder → /fit-finder/result
  Browse section:
    Browse programs → /programs
  Privacy & trust section:
    Privacy policy → /privacy, Terms → /terms, Disclaimer → /disclaimer
  Account section:
    Sign out → POST form to /api/auth/logout

Homepage navigation:
  Added "Account →" link to /account in the existing logged-in auth row
  (src/pages/index.astro). No new auth query; homepage already calls
  supabase.auth.getUser(). Account link is only visible when user is logged in.

RLS-safe summary signals:
  Fit Finder profile: student_profiles RLS (user_id = auth.uid()) enforces
    ownership; no explicit user_id filter needed in page code.
  Saved results count: ai_finder_results RLS (EXISTS on student_profiles.user_id =
    auth.uid()) enforces ownership; count returns only the current user's rows.

Explicit exclusions:
  No AI calls. No callAI. No getAIEnv. No Gemini/OpenAI references in account route.
  No service_role. No createServiceClient. No migrations. No new dependencies.
  No React or client-side JS. No admin UI. No public sharing. No matching changes.
  No persistence changes (no INSERT/UPDATE). No AI gateway/logging/rate-limit changes.
  No /account/profile page. No /account/fit-finder page.
  No changes to PublicNav, PublicLayout, fit-finder pages, or AI lib files.

Files created (1):
  src/pages/account.astro — account hub page

Files modified (1 in src):
  src/pages/index.astro — added "Account" link in logged-in auth row

Validation results:
  npm run build: PASS (Cloudflare server build, 9.87s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient|Gemini|OpenAI in
    src/pages/account.astro → 0 matches.
  callAI in src/pages,src/components → 2 matches, both in
    src/pages/fit-finder/result.astro (import + invocation only, unchanged).

Phase 29 — Fit Finder History Polish (complete):

- Polished the saved Fit Finder results list and history experience. No AI calls, no
  service_role, no schema changes, no matching algorithm changes, no new dependencies,
  no React, no client-side JS, no admin UI, no public sharing.

Saved-results list (/fit-finder/results):
  Added top-program preview via a second SSR client query on ai_finder_program_matches
  filtered to rank=1 and ai_finder_result_id IN (current result IDs). Joins programs,
  universities(name, slug), countries(name), cities(name). Maps previews by result ID
  into a Map<string, TopProgram>. RLS ai_finder_program_matches_select_own enforces
  ownership via grandparent join (ai_finder_results → student_profiles.user_id =
  auth.uid()). If preview query fails: console.error server-side only; list renders
  without previews; no user-facing error shown.

  Card badge logic:
    complete + ai_explanation → purple "AI summary" pill
    complete + no ai_explanation → gray "No AI summary" pill
    pending → yellow "Incomplete" pill
    failed → red "Failed" pill
  Previously: only a yellow badge for non-complete, no label for no-AI case.

  Top match preview block (when rank-1 match exists):
    Program title (text-sm font-medium text-gray-800)
    University name · Country, City (text-xs text-gray-500)
    Omitted gracefully when preview is unavailable.

  Top action row: added "Browse programs" CTA (third link → /programs).

  Empty state: updated copy from "No saved results yet" to "No saved Fit Finder results
    yet." with expanded explanation: "Results are saved automatically after you run Fit
    Finder. Your matched programs and any AI summary are stored so you can review them
    later." Added "Browse programs" as third CTA.

Detail page (/fit-finder/results/[id]):
  Added status/AI badge row next to saved date:
    complete + ai_explanation → purple "AI summary"
    complete + no ai_explanation → gray "No AI summary"
    pending → yellow "Incomplete"
    failed → red "Failed"
  Existing failed warning paragraph kept below badge row. No logic changes, no new queries.

Navigation links:
  /fit-finder: added "View saved results →" plain text link in submit button row,
    rendered only when user is logged in (user variable already available from
    Promise.all auth.getUser() call).
  /fit-finder/result: added "View all saved results →" plain text link in action
    buttons row, rendered only when user is logged in AND pageState === 'ready'.
    Not shown in no_matches, sparse_profile, error, or anonymous states.

Delete behavior (unchanged from Phase 27):
  POST handler, UUID validation, SSR client delete on ai_finder_results, RLS
  ai_finder_results_delete_own enforces ownership. ON DELETE CASCADE removes
  ai_finder_program_matches automatically. No user_id or student_profile_id accepted.

Files created: 0

Files modified (4 in src):
  src/pages/fit-finder/results/index.astro — preview query, TopProgram type, previews
    Map, badge logic function, improved card template, improved empty state, Browse
    programs CTA
  src/pages/fit-finder/results/[id].astro — badge row added to metadata section
  src/pages/fit-finder/index.astro — "View saved results →" link for logged-in users
  src/pages/fit-finder/result.astro — "View all saved results →" link in ready state only

Service-role/AI boundary:
  No service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts.
  No createServiceClient in src/pages,src/components,src/layouts.
  No callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient|Gemini|OpenAI in
    src/pages/fit-finder/results.
  callAI only in src/pages/fit-finder/result.astro (import + invocation, unchanged).

Explicit exclusions:
  No AI calls. No callAI in saved-results routes. No getAIEnv in saved-results routes.
  No service_role. No createServiceClient. No migrations. No new dependencies.
  No React or client-side JS. No admin UI. No public sharing. No matching algorithm changes.
  No persistence logic changes. No rate-limit changes. No prompt changes.
  No chatbot. No new AI endpoint. No Gemini/OpenAI code references in results routes.
  ai_model_used fetched in results/index.astro but not rendered to users.
  user_id and student_profile_id not accepted in forms or rendered to page.

Validation results:
  npm run build: PASS (Cloudflare server build, 3.52s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient|Gemini|OpenAI in
    src/pages/fit-finder/results → 0 matches.
  callAI in src/pages,src/components → 2 matches, both in src/pages/fit-finder/result.astro
    (import + invocation only, unchanged from Phase 28).

Phase 28 — AI Finder Production Hardening (complete):

- Hardened AI Finder operational readiness without adding any new AI surfaces, chatbot,
  migrations, dependencies, React, client-side JS, or service-role expansion.

AI unavailable UX (src/pages/fit-finder/result.astro):
  Added aiUnavailable boolean. Set to true only inside the pageState === 'ready' &&
  matches.length > 0 AI attempt block: when callAI returns fallbackUsed=true or
  guardrailTripped=true, or when the outer catch fires. Not set for anonymous,
  no_profile, sparse_profile, error, or no_matches states.
  Template: shows subtle gray note "AI summary is unavailable right now. Your rule-based
  matches are still shown." only when !aiExplanation && aiUnavailable.
  Does not expose rate-limit reason, API key state, provider name, model name, or
  daily limit. Rule-based matches always render regardless of AI state.

Privacy page copy (src/pages/privacy.astro):
  Updated "AI features (future)" section heading to "AI features" (AI logging is live).
  Updated body from future tense to present tense. Added mention of:
    - AI usage logged server-side (user ID, session type, model, token count)
    - Fit Finder match results saved to account for later review
    - Data used for rate limiting, cost management, saved results
    - AI context sent to Google Gemini; data not sold or used for advertising

AI system docs (docs/04-ai-system.md):
  Updated "Server-Only Secret Rules" env vars block:
    - Added SUPABASE_SERVICE_ROLE_KEY as required secret with explanation
    - Separated required secrets from optional env vars with clear comments
  Added "AI Production Readiness" section with:
    - Fail-closed behavior table by missing secret
    - Cloudflare Pages and Workers secret setup commands
    - Production verification steps (ai_usage_logs, ai_finder_results,
      ai_finder_program_matches, owner access, non-owner 404)
    - Local dev notes (.dev.vars pattern, no PUBLIC_ prefix, no commit)

Deployment checklist (docs/08-ai-deployment-checklist.md):
  New file. 13 sections:
    1. Purpose
    2. Required secrets table
    3. Required env vars table with defaults
    4. Cloudflare setup commands (Pages and Workers variants)
    5. Supabase prerequisites checklist
    6. Build verification checklist
    7. Security grep checks (5 checks with expected results)
    8. Post-deploy smoke tests (9 test cases)
    9. Rate-limit test procedure
    10. AI usage log verification SQL
    11. Saved-result persistence verification SQL
    12. Expected behavior by failure mode table
    13. Rollback notes

Files created (1):
  docs/08-ai-deployment-checklist.md

Files modified (3 in src):
  src/pages/fit-finder/result.astro — aiUnavailable flag + gray note in template
  src/pages/privacy.astro — AI features section updated to present tense
  docs/04-ai-system.md — production readiness section added

Service-role boundary:
  No service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts.
  No createServiceClient in src/pages,src/components,src/layouts.
  No PUBLIC_ prefix on service keys.
  callAI only in src/pages/fit-finder/result.astro (import + invocation).
  src/pages/fit-finder/results: zero AI/service imports.

Explicit exclusions:
  No chatbot. No new AI surfaces or endpoints. No free-form prompt.
  No migrations. No new dependencies. No React or client-side JS. No admin UI.
  No service-role usage outside approved lib paths. No matching algorithm changes.
  No AI prompt changes (finder-summary.ts, chat-answer.ts unchanged).
  No rate-limit algorithm changes (limits.ts unchanged).
  No persistence strategy changes (persist.ts unchanged).
  No changes to gateway.ts, env.ts, gemini.ts, logging.ts, service.ts.
  No changes to results/index.astro or results/[id].astro.

Validation results:
  npm run build: PASS (Cloudflare server build, 10.18s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/ → 0 matches.
  callAI|Gemini|OpenAI in src/pages,src/components → callAI only in
    src/pages/fit-finder/result.astro (import + invocation); "Gemini" appears once in
    src/pages/privacy.astro as informational copy text only (not a code import).
  callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient in
    src/pages/fit-finder/results → 0 matches.

Phase 27 — Saved Finder Results Management (complete):

- Added /fit-finder/results list page for logged-in users showing all their saved Fit Finder
  results, sorted newest first. Each result card shows date, program count, status badge
  (only when non-complete), and an AI summary indicator. Links to each detail page.
  Owner-only delete flow via server-side POST: accepts only result UUID in hidden field;
  RLS (ai_finder_results_delete_own: student_profiles.user_id = auth.uid()) enforces
  ownership server-side; ON DELETE CASCADE removes ai_finder_program_matches automatically.
  Anonymous users redirect to /login?redirect=/fit-finder/results.
  No AI calls, no service_role, no service client, no public sharing, no anonymous
  persistence, no migrations, no new dependencies, no React, no client-side JS,
  no admin changes, no matching algorithm changes.

Files created (1):
  src/pages/fit-finder/results/index.astro — list page and POST delete handler.
    GET: queries ai_finder_results via SSR client (RLS filters to owner's rows only).
    Select: id, created_at, result_status, shortlist_count, ai_explanation, ai_model_used.
    Order: created_at DESC. Three states: list, empty, error.
    POST: reads 'id' from formData, validates UUID regex, calls
      supabase.from('ai_finder_results').delete().eq('id', rawId) via SSR client.
    On success: redirect to /fit-finder/results (PRG).
    On failure: re-renders list with deleteError banner.
    Non-owner UUID submit: RLS no-ops delete; page redirects normally (no disclosure).
    No user_id/student_profile_id in forms. No service client.

Files modified (1 in src):
  src/pages/fit-finder/results/[id].astro — added "← Back to saved results" link above
    h1, and a "Delete this result" form (method=post, action=/fit-finder/results, hidden
    id=result.id) in the action buttons row. No logic changes, no AI calls, no service client.

RLS/ownership:
  SELECT: ai_finder_results_select_own — EXISTS on student_profiles.user_id = auth.uid().
    Plain .select() returns only current user's rows; no explicit user filter needed.
  DELETE: ai_finder_results_delete_own — same EXISTS check. Server enforces ownership.
    No page-level ownership check required. Non-owner attempt: 0 rows affected (no error).
  CASCADE: ai_finder_program_matches.ai_finder_result_id ON DELETE CASCADE removes
    child rows automatically when parent ai_finder_results row is deleted.
    No explicit match-row deletion in page code.

Validation results:
  npm run build: PASS (Cloudflare server build, 1.88s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  callAI|Gemini|OpenAI in src/pages,src/components → callAI only in
    src/pages/fit-finder/result.astro (import + invocation, unchanged from Phase 26).
  callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient in
    src/pages/fit-finder/results → 0 matches.

Phase 26 — AI Finder Result Persistence (complete):

- Persists each logged-in user's Fit Finder run in the existing ai_finder_results and
  ai_finder_program_matches tables. Persistence uses the service role client inside a
  server-only lib helper (src/lib/ai/finder/persist.ts); no service role usage in pages,
  components, or layouts. No chatbot, no public share links, no anonymous persistence,
  no matching algorithm changes, no AI prompt changes, no migrations, no new dependencies,
  no React, no client-side JS.

Files created (2):
  src/lib/ai/finder/persist.ts — server-only persistence helper. Exports
    persistFinderResult(input, env: AIRuntimeEnv). Accepts the full AIRuntimeEnv
    and extracts SUPABASE_SERVICE_ROLE_KEY internally (key string never referenced in
    pages). Creates service client, inserts ai_finder_results row (result_status=complete,
    shortlist_count, optional ai_explanation/ai_model_used/token counts, expires_at=null),
    then batch-inserts ai_finder_program_matches (rank, score, match_reasons, warnings,
    program_id). If match insert fails: marks result_status=failed and returns null.
    Returns result UUID on success, null on any failure. Never throws.

  src/pages/fit-finder/results/[id].astro — private saved-result page. SSR, noindex=true.
    Anonymous users redirect to /login?redirect=/fit-finder/results/{id}. Validates id as
    UUID (invalid → 404). Queries ai_finder_results via SSR client — RLS enforces owner
    access (student_profiles.user_id = auth.uid()); non-owner or missing → 404. Queries
    ai_finder_program_matches with programs join ordered by rank. Shows heading, saved date,
    stale-data note, optional AI explanation, match cards (rank badge, stored match_reasons
    and warnings, current program data from FK join), action buttons. No callAI, no
    getAIEnv, no service client, no re-running matching on the view page.

Files modified (1 in src):
  src/pages/fit-finder/result.astro — added persistFinderResult import. Added
    savedResultId/persistAttempted variables. Hoisted getAIEnv call out of AI try/catch
    so aiEnv is available for both AI call and persist call. Captures aiModelUsed,
    promptTokenCount, completionTokenCount from successful aiResponse. After AI block:
    60-second dedupe check via SSR client (ai_finder_results for this profile,
    result_status=complete, created_at >= 60s ago); if found, reuses existing id; if
    not found, calls persistFinderResult(input, aiEnv). On success: shows green "Your
    matches have been saved. View saved result →" link. On persist failure (persistAttempted
    && !savedResultId): shows muted "Results could not be saved this time." If service key
    absent: no attempt, no failure note. Persistence wrapped in try/catch — failure never
    affects transient match rendering or AI summary.

Persistence strategy:
  ai_finder_results: student_profile_id, result_status='complete', shortlist_count,
    ai_explanation (null when AI unavailable), ai_model_used/token counts (0 when
    AI unavailable), expires_at=null.
  ai_finder_program_matches: program_id FK (RESTRICT), rank (1-based), score (raw points),
    match_reasons (jsonb string[]), warnings (jsonb string[]).
  Not persisted: prompt text, raw AI response, user email, session token, additional_notes,
    raw admission/english/gpa requirements, profile scoring signal IDs.

Dedupe: 60-second window via SSR client read on ai_finder_results (RLS-enforced). Prevents
  duplicate rows on page refresh without suppressing intentional re-runs.

Ownership: ai_finder_results RLS (student_profiles.user_id = auth.uid()) enforces read
  access in both result.astro dedupe check and [id].astro saved-result view. Non-owner
  access returns 404 with no information leak.

Validation results:
  npm run build: PASS (Cloudflare server build, 1.58s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/ → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  callAI in src/pages,src/components → 2 matches, both in src/pages/fit-finder/result.astro
    (import + invocation only, unchanged from Phase 25).
  callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient in
    src/pages/fit-finder/results → 0 matches.
  ai_finder_results|ai_finder_program_matches in src/pages → 4 matches:
    src/pages/fit-finder/result.astro (dedupe check only) and
    src/pages/fit-finder/results/[id].astro (read queries only).

Phase 25 — AI Usage Logging + Rate Limit Enforcement — complete.

## Last Completed Work

Phase 25 — AI Usage Logging + Rate Limit Enforcement (complete):

- Activated server-only AI usage logging and daily per-user rate-limit enforcement.
  Both writeUsageLog and checkRateLimit stubs replaced with real implementations.
  No chatbot, no free-form prompt, no new public pages, no ai_finder_results writes,
  no ai_finder_program_matches writes, no migrations, no new dependencies, no React,
  no client-side JS, no admin UI, no matching algorithm changes, no prompt or
  response text logged.

Files created (1):
  src/lib/supabase/service.ts — narrow server-only service role Supabase client
    factory. Uses @supabase/supabase-js createClient with persistSession: false,
    autoRefreshToken: false. Created per-call inside callAI(); never at module scope.
    Must never be imported from browser code, client components, or layouts.

Files modified (6 in src):
  src/lib/ai/types.ts — added SUPABASE_SERVICE_ROLE_KEY?: string to AIRuntimeEnv;
    added costEstimateUsd?: number | null to AIUsageEntry.

  src/lib/ai/env.ts — added SUPABASE_SERVICE_ROLE_KEY extraction from
    locals.runtime.env alongside other AI runtime vars.

  src/lib/ai/usage/limits.ts — replaced always-allowed stub with real fail-closed
    implementation. Signature: checkRateLimit(userId, sessionType, opts).
    Fail-closed: null userId → denied; null serviceClient → denied; query error →
    denied; count >= limit → denied. Counts all session_type values for the user
    on the current UTC day. Default limit: 20 (AI_RATE_LIMIT_USER_DAILY env var).
    Returns reason: 'limit_exceeded' | 'service_unavailable' for message selection.

  src/lib/ai/usage/logging.ts — replaced no-op stub with real insert into
    ai_usage_logs. Signature: writeUsageLog(entry, serviceClient). Logs user_id,
    session_type, tokens_used, model_used, cost_estimate_usd (null for Phase 25).
    No prompt text, AI response text, profile UUIDs, emails, or raw profile data.
    Never throws — logging failure is console.error only.

  src/lib/ai/gateway.ts — creates service client from env.SUPABASE_SERVICE_ROLE_KEY
    (null if absent) inside callAI(). Passes { serviceClient, dailyLimit } to
    checkRateLimit; passes serviceClient to writeUsageLog. Rate-limit fallback
    messages: 'limit_exceeded' → "You have reached today's AI usage limit. Your
    rule-based matches are still available."; 'service_unavailable' → "AI is
    temporarily unavailable." writeUsageLog called fire-and-forget after Step 6
    output guardrail passes. costEstimateUsd: null passed to writeUsageLog.

  .env.example — added SUPABASE_SERVICE_ROLE_KEY= with strict server-only
    annotation. Set via: wrangler secret put SUPABASE_SERVICE_ROLE_KEY.

Fail-closed behaviour:
  Without SUPABASE_SERVICE_ROLE_KEY configured, all AI calls return a safe fallback
  ("AI is temporarily unavailable.") and Gemini is not called. The Fit Finder
  result page renders rule-based matches normally in all fallback cases.

Logged data (ai_usage_logs):
  user_id, session_type, tokens_used, model_used, cost_estimate_usd (null).
  No prompt text, no AI response text, no profile IDs, no emails, no raw profile data.

FK chain verified before implementation:
  auth.users.id ← public.user_profiles.id (migration 002, PRIMARY KEY REFERENCES)
  public.user_profiles.id ← ai_usage_logs.user_id (migration 012, FK)
  user.id from supabase.auth.getUser() is the correct value to pass as userId.

Validation results:
  npm run build: PASS (Cloudflare server build, 2.27s, zero errors).
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts
    → 0 matches.
  PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/ → 0 matches.
  callAI in src/pages,src/components → 2 matches, both in
    src/pages/fit-finder/result.astro (import + invocation only).
  ai_usage_logs in src/pages → 0 matches.

Phase 24 — AI Finder Explanation MVP — complete.

## Last Completed Work

Phase 24 — AI Finder Explanation MVP (complete):

- Added optional AI explanation section to /fit-finder/result for logged-in users
  with rule-based matches. AI explains the top 3 already-computed matches using
  only the matched program context and saved preference summary. Rule-based matches
  remain the source of truth. No chatbot, no free-form prompt, no AI DB writes,
  no service_role, no migrations, no new dependencies, no React, no client-side JS.

Route enhanced:
  /fit-finder/result — noindex SSR page; AI summary section added (optional, requires
    GEMINI_API_KEY and a successful callAI response).

Files modified (1 in src):
  src/pages/fit-finder/result.astro — added callAI/getAIEnv/AIContext imports;
    added aiExplanation variable; added AI call block inside pageState === 'ready'
    guard after matches are computed; added AI summary UI section between action
    buttons and match cards.

AI call details:
  sessionType: 'finder'
  userMessage: system-constructed, not user-authored
  context.source: 'programs'
  context.records: top 3 rule-based matches only (slice(0, 3))
  context.studentProfile: degreeLevel name, targetCountries names, subjects names,
    budgetMin/budgetMax/currency from saved profile
  userId: user.id (server-side only, not rendered, for future rate-limit use)

Data minimization (included per record):
  title, university name, country, city, degreeLevel, subject, formatted tuition
  range, officialUrl, matchPercentage, matchReasons array, warnings array

Data minimization (excluded):
  profile ID, user ID, email, session token, additional_notes,
  raw admission_requirements, raw english_requirements, raw gpa_requirements,
  internal UUIDs, study_mode, delivery_mode, language_of_instruction raw fields

AI rendering:
  Output split on double newlines and rendered as <p> tags.
  No set:html. Astro default HTML escaping applied.
  Section only rendered when aiExplanation is non-null (callAI returned a clean
  non-empty response with fallbackUsed=false and guardrailTripped=false).

Fallback behavior:
  Missing GEMINI_API_KEY → callAI returns fallbackUsed=true → aiExplanation=null →
    AI section not rendered; rule-based matches render normally.
  Provider/network error → same fallback path.
  Output guardrail trip → guardrailTripped=true → AI section not rendered.
  Empty response text → guard prevents setting aiExplanation.
  Outer try/catch prevents any AI failure from breaking rule-based results.

Explicit exclusions:
  No ai_finder_results insert. No ai_finder_program_matches insert.
  No ai_usage_logs write (writeUsageLog remains no-op stub).
  No service_role. No migrations. No new npm dependencies.
  No React or client-side JS. No chatbot UI. No free-form prompt.
  No src/lib/ai/* changes. No admin changes. No src/pages/fit-finder/index.astro changes.
  No matching algorithm changes. No profile ID in rendered HTML.

Validation results:
  npm run build: PASS (Cloudflare server build, 1.81s, zero errors).
  service_role/SERVICE_ROLE/SUPABASE_SERVICE → 0 matches.
  PUBLIC_GEMINI/PUBLIC_AI → 0 matches.
  callAI in src/pages,src/components → 2 matches, both in src/pages/fit-finder/result.astro
    (import line and invocation line only).
  ai_finder_results/ai_finder_program_matches/ai_usage_logs in fit-finder → 0 matches.

Phase 23 — AI Runtime Env + Provider Wiring — complete.

## Last Completed Work

Phase 23 — AI Runtime Env + Provider Wiring (complete):

- Wired server-only AI runtime env extraction, implemented Gemini REST provider,
  and connected the gateway to a live provider. No public AI feature, no public
  AI endpoint, no Fit Finder AI output, no chatbot, no AI database writes,
  no service_role, no migrations, no new dependencies, no React, no client-side JS,
  no public page changes, no admin UI changes.

Files created (1):
  src/lib/ai/env.ts — getAIEnv(locals) helper: extracts AIRuntimeEnv from
    Cloudflare Workers locals.runtime.env using a safe cast (src/env.d.ts
    does not exist in this project). Call once per server endpoint, pass
    result to callAI().

Files modified (4 in src):
  src/lib/ai/providers/gemini.ts — replaced Phase 18 stub with live
    GeminiProvider.complete() using fetch-based REST call to Gemini
    generateContent v1beta endpoint. system_instruction + contents request
    shape. Parses text from candidates[0].content.parts[], promptTokens
    and completionTokens from usageMetadata, modelUsed from modelVersion.
    Controlled throws for non-ok HTTP (status only, no response body),
    empty candidates, finishReason SAFETY/RECITATION, missing text.
    createGeminiProvider(apiKey) factory updated to accept apiKey.

  src/lib/ai/gateway.ts — replaced Phase 18 TODO block and static fallback
    with live Steps 3–8:
    Step 3: resolveProvider(env) — reads env.AI_PROVIDER (default: gemini),
      checks GEMINI_API_KEY, throws on misconfiguration (no key/provider in
      error message). callAI catches and returns fallback.
    Step 4: buildFinderPrompt for sessionType=finder, buildChatPrompt for chat.
    Step 5: provider.complete() with model env.AI_MODEL ?? 'gemini-2.5-flash',
      temperature 0.2, maxOutputTokens 2048. Catch → safe fallback.
    Step 6: checkOutput() on provider text. Guardrail trip → fallback with
      guardrailTripped=true; blocked text is never returned.
    Step 7: writeUsageLog() fire-and-forget no-op (DB writes deferred to Phase 24+).
    Step 8: return AIResponse with provider text, token counts, guardrailTripped=false.
    _env parameter renamed to env (was prefixed because unused in Phase 18).

  .env.example — updated AI_MODEL default from gemini-2.0-flash to
    gemini-2.5-flash (gemini-2.0-flash is shut down).

  docs/04-ai-system.md — updated Phase 18 architecture section to Phase 23:
    added getAIEnv helper, Gemini REST provider shape, Phase 23 behaviour
    notes, updated default model.

Explicit exclusions:
  No public AI endpoint.
  No smoke endpoint.
  No Fit Finder AI output.
  No chatbot.
  No ai_usage_logs writes (writeUsageLog remains no-op stub).
  No rate-limit enforcement (checkRateLimit remains always-allowed stub).
  No service_role.
  No migrations.
  No new npm dependencies.
  No React or client-side JS.
  No public page changes.
  No admin UI changes.
  No src/lib/ai/types.ts changes.
  No src/lib/ai/providers/interface.ts changes.
  No src/lib/ai/prompts/* changes.
  No src/lib/ai/safety/guardrails.ts changes.
  No src/lib/ai/usage/logging.ts changes.
  No src/lib/ai/usage/limits.ts changes.
  No src/pages/fit-finder/* changes.
  No src/pages/api/ai/smoke.ts created.

Validation results:
  npm run build: PASS (Cloudflare server build, 2.14s, zero errors).
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "PUBLIC_GEMINI|PUBLIC_AI" → 0 matches.
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.
  Get-ChildItem -Path src\pages,src\components -Recurse -File | Select-String -Pattern "callAI" → 0 matches.
  Test-Path src\pages\api\ai\smoke.ts → False.

Phase 22 — Legal / Trust / Disclaimer Pages Foundation — complete.

## Last Completed Work

Phase 22 — Legal / Trust / Disclaimer Pages Foundation (complete):

- Added plain-language legal/trust pages (/about, /privacy, /terms, /disclaimer).
  Added PublicFooter component rendered in PublicLayout below <main>.
  Added four static legal routes to sitemap.xml.ts static URL list.
  No AI calls, no database writes, no service_role, no migrations, no new dependencies,
  no React, no client-side JS, no admin changes, no auth changes, no Fit Finder logic changes,
  no AI gateway changes, no cookie banner, no analytics, no payment/subscription terms.

Routes added:
  /about      — what DegreeWiki is, what it is not, data accuracy, Fit Finder, AI future
  /privacy    — account data, Fit Finder preferences, session cookies, future AI logs,
                third-party services (Supabase, Cloudflare), no ad trackers, data deletion
  /terms      — acceptable use, information accuracy, no professional advice, limitation of liability
  /disclaimer — independence, data accuracy, Fit Finder match score limits, AI limits, no guarantees

Files created (6):
  src/components/public/PublicFooter.astro
  src/pages/about.astro
  src/pages/privacy.astro
  src/pages/terms.astro
  src/pages/disclaimer.astro

Files modified (2):
  src/layouts/PublicLayout.astro — added PublicFooter import and render below <main>
  src/pages/sitemap.xml.ts — added /about, /privacy, /terms, /disclaimer to STATIC_PATHS

PublicFooter:
  Minimal footer rendered on every public page via PublicLayout.
  Shows © current year DegreeWiki + About / Privacy / Terms / Disclaimer links.
  Uses quiet gray styling; does not compete with primary navigation.
  Year evaluated at SSR time via new Date().getFullYear().

Legal/trust wording decisions:
  All four pages use plain language — no legalese, no GDPR/CCPA compliance claims,
  no lawyer-review assertions.
  AI wording: "AI-assisted features are based on available DegreeWiki context" —
  future-safe phrasing that does not limit to "database content."
  Fit Finder scores described as preference-alignment signals only, consistent with
  Phase 21 result page wording.
  No guarantees of admission, scholarships, visa approval, employment, salary, or outcomes.
  No invented email address for contact — uses placeholder wording:
  "A public contact and correction channel will be added before launch."
  Privacy statement acknowledges Supabase and Cloudflare as infrastructure providers.

Validation results:
  npm run build: PASS (Cloudflare server build, 1.97s, zero errors).
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.
  Get-ChildItem -Path src/pages/about.astro,src/pages/privacy.astro,src/pages/terms.astro,src/pages/disclaimer.astro -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder" → 0 matches.

## Last Completed Work

Phase 21 — Fit Finder Results UX Polish + Matching Safety Review (complete):

- Polished /fit-finder/result UX and safety wording. No scoring algorithm changes.
  No AI calls, no database writes, no service_role, no migrations, no new dependencies,
  no React, no client-side JS, no admin changes, no anonymous persistence,
  no profile IDs exposed.

Route enhanced:
  /fit-finder/result — existing SSR page; UX/safety polished.

Files modified:
  src/pages/fit-finder/result.astro
  src/pages/fit-finder/index.astro
  docs/06-status.md
  docs/07-task-log.md

Preference summary:
  A compact saved-preferences panel now appears in the ready and no_matches states,
  showing only scoring signals: target degree level name, preferred country names
  (in preference_rank order), subject names (in preference_rank order), and budget
  summary. Non-scoring profile fields (gpa, english_score, work_experience_years,
  current_country_id, study_start_preference, additional_notes) are never shown.
  Names are fetched via Supabase PostgREST joins added to existing queries:
    profile query adds degree_levels(name)
    subject preference query adds subjects(name)
    country preference query adds countries(name)
  No additional round-trips. If fewer than 2 signals are present, a soft hint
  encourages adding more preferences.

Score explanation:
  A blue info box (bg-blue-50 border-blue-100) is rendered once per page in the
  ready and no_matches states. It explains that match scores show preference
  alignment only, and explicitly states that scores do not assess eligibility,
  academic qualifications, admission chances, scholarship prospects, or visa outcomes.

Score badge label:
  Per-card badge label changed from "match score" to "preference match".

Degree reason specificity:
  When degreeLevelName is available from the join, the degree match reason reads
  "Matches your target degree level: [Name]." rather than the generic form.

Warning consolidation:
  The two separate warnings for admission_requirements/gpa_requirements and
  english_requirements are merged into one:
  "Admission and language requirements must be verified with the official source."
  Tuition warnings are unchanged.

No-match state:
  Now shows a count of how many published programs were checked against the user's
  preferences. Guidance message is targeted: single-signal profiles get a prompt to
  add more preferences; multi-signal profiles get advice to broaden subject/country
  choices or browse all programs.

Sparse-profile state:
  Now explicitly lists which scoring signals are missing (target degree level,
  subjects of interest, preferred countries, budget) so the user knows exactly
  what to add to generate matches.

Stale copy fix:
  /fit-finder description updated from "Program matching will be added in the next
  phase." to "Save your study preferences to see possible program matches based on
  your inputs."

Algorithm stability:
  Scoring weights unchanged: degree 35, subject primary 30, subject secondary 24,
  country 25, budget 10/5. possiblePoints computation unchanged. Candidate cap 200
  unchanged. Top result cap 20 unchanged. Deterministic sort unchanged.

Explicit exclusions:
  No AI calls. No callAI import. No Gemini/OpenAI. No chatbot.
  No ai_finder_results, ai_finder_program_matches, or ai_usage_logs.
  No service_role. No migrations. No new dependencies. No React or client-side JS.
  No admin changes. No anonymous persistence. No profile IDs in rendered output.

Validation results:
  npm run build: PASS (Cloudflare server build, 5.14s, zero errors).
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.
  Get-ChildItem -Path src/pages/fit-finder -Recurse -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder_results|ai_finder_program_matches|ai_usage_logs" → 0 matches.

## Last Completed Work

Phase 20 — Rule-Based Program Matching Engine (complete):

- Replaced the /fit-finder/result placeholder with a deterministic server-rendered
  program matching page.
- The page now uses the logged-in user's latest saved non-anonymous student profile,
  loads owned subject and country preferences through existing RLS, queries a capped
  set of published programs, scores them in Astro server code, and renders ranked
  possible matches.

Route enhanced:
  /fit-finder/result — noindex SSR page showing possible program matches for
  logged-in users with usable saved preferences.

Files modified:
  src/pages/fit-finder/result.astro
  docs/06-status.md
  docs/07-task-log.md

Access behavior:
  Anonymous users see sign-in/save guidance with links to /login?redirect=/fit-finder
  and /fit-finder. No profile query is made for anonymous users.
  Logged-in users without a saved profile see "No saved Fit Finder profile yet."
  Logged-in users with sparse profiles are prompted to add degree, subject, country,
  or budget preferences.
  Logged-in users with usable profiles see transient ranked results.

Candidate query strategy:
  Uses the existing Supabase SSR client and supabase.auth.getUser().
  Loads only the latest own student_profiles row where user_id = auth.uid()
  through the authenticated session and is_anonymous=false.
  Queries only programs where content_status='published', limited to 200 rows,
  with display joins for universities, countries, cities, degree_levels, and subjects.
  Fetches program_subjects for the candidate program IDs in one batch. If that query
  fails, scoring continues with primary_subject_id only and shows a page-level note.

Scoring signals:
  target_degree_level_id match — 35 points.
  preferred subject match — 30 points for primary_subject_id, 24 points through
  program_subjects.
  preferred country match — 25 points.
  budget fit — 10 points when max tuition is within saved budget and currency matches;
  5 points when tuition may partially fit.
  Active possible points include only signals the user saved. Profiles with zero
  possible points show a refine-profile state instead of arbitrary matches.

Result display:
  Shows match score percentage, program link, university link when available,
  country/city, degree level, subject, tuition range, deterministic match reasons,
  conservative warnings, official-source reminder, and official_url link when available.
  Wording avoids guaranteed admission, eligibility, scholarship, or visa claims.

Explicit exclusions:
  Transient SSR only.
  No AI calls.
  No callAI import.
  No Gemini/OpenAI calls.
  No chatbot.
  No ai_finder_results writes.
  No ai_finder_program_matches writes.
  No ai_usage_logs writes.
  No service_role.
  No migrations.
  No new dependencies.
  No React or client-side JS.
  No admin changes.
  No anonymous persistence.
  No profile IDs in URLs or rendered output.

Validation results:
  npm run build: PASS (Cloudflare server build, 1.54s, zero errors).
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.
  Get-ChildItem -Path src/pages/fit-finder -Recurse -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder_results|ai_finder_program_matches|ai_usage_logs" → 0 matches.

Phase 19 — Fit Finder / Student Profile Input Foundation (complete):

- Added a public server-rendered Fit Finder input foundation.
  The route collects schema-backed student profile preferences for future matching,
  but does not run AI, does not run program matching, does not create chatbot UI,
  and does not write AI Finder result rows.

Routes added:
  /fit-finder — public SSR form for student profile preferences.
  /fit-finder/result — noindex placeholder confirmation page.

Files created:
  src/pages/fit-finder/index.astro
  src/pages/fit-finder/result.astro

Files modified:
  src/components/public/PublicNav.astro — added Fit Finder link.
  docs/06-status.md
  docs/07-task-log.md

Schema/RLS findings used:
  student_profiles supports logged-in rows with user_id set, is_anonymous=false,
  and session_token=NULL.
  student_profile_subjects and student_profile_countries are writable for logged-in
  users only when the parent profile belongs to auth.uid().
  Anonymous profile rows are supported by schema, but direct anonymous browser RLS
  is intentionally omitted. Anonymous persistence is deferred because it requires
  a security-reviewed privileged server endpoint.

Form fields implemented:
  current_country_id, target_degree_level_id, budget_min, budget_max,
  budget_currency, gpa, english_score_type, english_score,
  work_experience_years, study_start_preference, additional_notes.
  Junction inputs: student_profile_subjects[] and student_profile_countries[].

Lookup data:
  countries: id, name.
  degree_levels: id, name, display_order.
  subjects: id, name.
  Lookup query failures log server-side and default to [] so the page remains functional.

Validation:
  Server-side only. UUID values must match UUID shape and exist in loaded lookup data.
  Numeric fields must be non-negative. work_experience_years must be a non-negative
  integer. budget_max must be greater than or equal to budget_min when both are set.
  Short text fields are trimmed/capped; budget_currency is normalized uppercase.
  Invalid submissions re-render the form with entered values preserved.

Logged-in persistence:
  Uses the existing Supabase SSR client and supabase.auth.getUser().
  POST creates or updates exactly one non-anonymous profile selected by user_id and
  is_anonymous=false. The profile UUID is never accepted from the form, rendered to
  the page, placed in hidden inputs, or included in the result URL.
  Subject and country junction rows are replaced after the profile save using the
  RLS-protected parent profile id.

Anonymous behavior:
  GET /fit-finder renders for everyone.
  POST /fit-finder while logged out does not save anything, does not create cookies,
  and does not create anonymous student_profiles rows. The form re-renders with a
  sign-in required message linking to /login?redirect=/fit-finder.

Result placeholder:
  /fit-finder/result uses PublicLayout, noindex=true, and shows:
  "Your preferences have been saved. Program matching will be added in the next phase."
  Links point to /programs and /fit-finder.

Exclusions:
  No AI calls.
  No matching engine.
  No chatbot.
  No ai_finder_results writes.
  No ai_finder_program_matches writes.
  No anonymous session_token cookies.
  No service_role usage.
  No migrations.
  No new dependencies.
  No React or client-side JS.
  No admin changes.
  No src/lib/ai changes.

Validation results:
  npm run build: PASS (Cloudflare server build, 1.48s, zero errors).
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.
  Get-ChildItem -Path src/pages/fit-finder -Recurse -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder_results|ai_finder_program_matches" → 0 matches.

Phase 18 — AI Gateway + AI Safety Architecture (implementation complete):

- Created server-only AI foundation in src/lib/ai/.
  No public chatbot UI, no Fit Finder UI, no live LLM calls, no external API calls,
  no public AI endpoint, no migrations, no new dependencies, no service_role, no React,
  no client-side JS, no admin changes.

src/lib/ai/ structure:
  types.ts — all shared types: AIRequest, AIResponse, AIContext, AIPrompt,
    AIProviderConfig, AIProviderResponse, AIUsageEntry, AIGuardrailResult,
    AIRuntimeEnv, StudentProfileSummary, AISessionType, AIRole.
  gateway.ts — callAI() entry point: runs input guardrails, rate limit check,
    then returns controlled fallback (no live provider in Phase 18).
    TODO Phase 19 block marks provider resolution, prompt build, output
    guardrails, and usage logging steps.
  providers/interface.ts — AIProvider interface: complete(prompt, config).
    All implementations must use fetch() only (Cloudflare Workers compatible).
  providers/gemini.ts — GeminiProvider stub. Throws "Gemini provider is not
    enabled in Phase 18." No fetch calls.
  prompts/finder-summary.ts — buildFinderPrompt(context): builds system +
    user prompt for AI Finder explanation. System prompt enforces database-first
    rule, no invented facts, no guarantees, verify-official-sources disclaimer.
  prompts/chat-answer.ts — buildChatPrompt(userMessage, context): builds
    system + user prompt for chatbot. Same safety boundaries.
  safety/guardrails.ts — checkInput() and checkOutput(): deterministic
    first-pass regex guardrails. Blocks fake documents, essay ghostwriting,
    immigration fraud, visa fraud (input). Blocks guaranteed admission/
    scholarship/visa claims (output). Conservative exact-phrase matching.
  usage/logging.ts — writeUsageLog() placeholder. No database writes in
    Phase 18. TODO Phase 19 marker for service role wiring.
  usage/limits.ts — checkRateLimit() placeholder. Always returns allowed.
    TODO Phase 19 marker for ai_usage_logs query enforcement.

Files created (9):
  src/lib/ai/types.ts
  src/lib/ai/gateway.ts
  src/lib/ai/providers/interface.ts
  src/lib/ai/providers/gemini.ts
  src/lib/ai/prompts/finder-summary.ts
  src/lib/ai/prompts/chat-answer.ts
  src/lib/ai/safety/guardrails.ts
  src/lib/ai/usage/logging.ts
  src/lib/ai/usage/limits.ts

Files modified (3):
  .env.example (added GEMINI_API_KEY, AI_PROVIDER, AI_MODEL, rate limit vars
    with server-only annotations)
  docs/04-ai-system.md (replaced structural sketch with finalized Phase 18
    architecture: gateway, provider abstraction, safety rules, prompt boundaries,
    env strategy, rate-limit/logging future plans, Cloudflare compatibility)
  docs/06-status.md (this file)

src/env.d.ts: does not exist in this project — not created or modified.
  AI env vars typed via AIRuntimeEnv interface in src/lib/ai/types.ts instead.

npm run build: PASS (Cloudflare server build, 1.75s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.
Get-ChildItem -Path src/lib/ai -Recurse -File | Select-String -Pattern "PUBLIC_" → 2 matches,
  both are comments warning against PUBLIC_ usage, not actual misuse.

Exclusions (deferred to Phase 19+):
  No public chatbot UI.
  No Fit Finder UI.
  No live LLM calls.
  No external AI API calls.
  No public AI endpoint.
  No migrations.
  No new npm dependencies.
  No service_role.
  No React or client-side JS.
  No admin changes.
  No src/pages/api/ai/health.ts (removed from scope).
  No providers/openrouter.ts (removed from scope).
  No src/env.d.ts (does not exist; AIRuntimeEnv in types.ts covers AI vars).
  No wrangler.toml changes.

Phase 17 — Source / Verification Display Foundation (implementation complete):

- Added a lightweight Source & Verification box to all four public detail pages.
  No admin changes, no migrations, no new dependencies, no React, no client-side JS,
  no AI, no service_role, no set:html, no schema.org structured data.
  Internal source/data-quality tables (data_sources, source_snapshots, verification_events,
  data_quality_checks) intentionally not queried — all are admin-only per RLS.

Files created (1):
  src/components/public/SourceBox.astro

Files modified (4):
  src/pages/programs/[slug].astro
  src/pages/scholarships/[slug].astro
  src/pages/universities/[slug].astro
  src/pages/guides/[slug].astro

SourceBox component:
  Shared Astro component with props: verificationStatus, lastVerifiedAt, officialUrl,
  sourceConfidenceScore. Renders a small bordered gray box (border-gray-200, bg-gray-50).
  Status line: verified → "Verified by DegreeWiki", partially_verified → "Partially verified",
  source_conflict → "Source conflict under review", outdated → "May need updating",
  needs_review → "Needs review", unverified → "Not yet verified", null/unknown → omitted.
  Last verified line: shown only when lastVerifiedAt is non-null.
  Source confidence: shown only when sourceConfidenceScore > 0.
    ≥75 → High, ≥40 → Medium, 1–39 → Low.
  Official source link: shown only when officialUrl is non-null; opens in _blank.
  Disclaimer: always shown — "Always confirm important details — including deadlines, fees,
    and eligibility requirements — directly with the official university, scholarship provider,
    or government/source website before applying."
  Placement: after main content/CTA sections, before existing "Last updated" line and back link.
  Existing near-title verification badge unchanged.

Entity-level fields used per entity:
  programs:      verification_status (existing), last_verified_at (added), source_confidence_score (added)
                 official_url (existing, passed as officialUrl)
  scholarships:  verification_status (existing), last_verified_at (added), source_confidence_score (added)
                 official_url ?? provider_url (existing, passed as officialUrl)
  universities:  verification_status (existing), last_verified_at (added), source_confidence_score (added)
                 official_url (existing, passed as officialUrl)
  articles:      verification_status (existing), source_confidence_score (added)
                 lastVerifiedAt=null (articles table has no last_verified_at column)
                 officialUrl=null (articles have no official URL field)

Source table decision:
  data_sources, source_snapshots, verification_events, data_quality_checks —
  intentionally NOT queried in public pages. All four tables have RLS policies that
  block anonymous and regular authenticated user access. These are internal admin-only
  data-quality tables. Only entity row fields are used.

npm run build: PASS (Cloudflare server build, 1.55s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No list/search page changes.
  No admin CRUD changes.
  No migrations.
  No new npm dependencies.
  No React or client-side JS.
  No data_sources/verification_events/data_quality_checks queries in public pages.
  No data_completeness_score display (internal metric, not shown publicly).
  No schema.org structured data.
  No report form, saved items, or user dashboard.

Phase 16 — Public Detail Page Polish (implementation complete):

- Polished all four public detail pages (programs, scholarships, universities, guides).
  No admin changes, no migrations, no new dependencies, no React, no client-side JS,
  no AI, no service_role, no set:html, no markdown renderer.

Files changed (4 source files):
  src/pages/programs/[slug].astro
  src/pages/scholarships/[slug].astro
  src/pages/universities/[slug].astro
  src/pages/guides/[slug].astro

Route improvements:

  programs/[slug]:
    - Added verification_status and updated_at to Supabase select.
    - Added secondary program_intakes query (runs after 404 check; defaults to [] on error).
    - Renders "Intakes & Deadlines" section when program_intakes rows exist; omitted when empty.
    - Intake rows show intake_name, open date, deadline date, deadline_text, deadline_status badge
      (open/closing_soon/closed/rolling), is_rolling flag, and notes.
    - Replaced JSON.stringify/pre block for english_requirements with a readable <ul> list:
      Object.entries() over the JSONB — test name uppercased, nested properties joined as
      "key: value · key: value". Falls back to plain text notice if shape is unexpected.
    - Removed official_url and application_url from key facts <dl>; moved to CTA block.
    - CTA block: "Apply Now ↗" (application_url, blue filled) + "Official Program Page ↗"
      (official_url, border ghost). Shown only when at least one URL exists.
    - Section order: Key Facts → Admission Requirements → English Requirements →
      Tuition Notes → Application Fee → Intakes & Deadlines → Curriculum → Career Outcomes
      → CTA block → Last updated → Back link.
    - Added bottom back link (second ← All Programs above the footer area).

  scholarships/[slug]:
    - Added verification_status and updated_at to Supabase select.
    - Fixed deadline_text condition: now renders whenever s.deadline_text exists,
      even when s.deadline (structured date) is null. Previously only rendered when both were set.
    - Removed official_url, application_url, provider_url from key facts <dl>; moved to CTA block.
    - CTA block: "Apply Now ↗" (application_url, blue filled), "Official Scholarship Page ↗"
      (official_url, border ghost), "Provider Website ↗" (provider_url, border ghost).
      Shown only when at least one URL exists.
    - Added bottom back link.

  universities/[slug]:
    - Added verification_status and updated_at to Supabase select.
    - Removed official_url from key facts <dl>; moved to CTA block.
    - CTA block: "Visit Official Website ↗" (official_url, border ghost).
    - Added "Browse Programs at [name] →" text link → /programs?university={u.id}.
    - Added bottom back link.

  guides/[slug]:
    - Added verification_status and updated_at to Supabase select.
    - Changed article_categories(name, slug) to article_categories(id, name, slug).
    - Category badge is now a clickable link → /guides?category={id} when category id exists.
      Falls back to non-linked span if category exists but id is absent.
    - Added bottom back link.

Verification badge strategy (all four pages):
  verified → "Verified" (green: bg-green-50 text-green-700 border-green-200)
  partially_verified → "Partially Verified" (yellow: bg-yellow-50 text-yellow-700 border-yellow-200)
  source_conflict/outdated/needs_review → "Under Review" (orange: bg-orange-50 text-orange-700 border-orange-200)
  unverified → no badge rendered
  All class strings are complete literals in a static lookup object — safe for Tailwind v4 scanner.
  Placement: small badge row immediately below h1, above key facts dl.

Last updated strategy (all four pages):
  updated_at queried from DB, formatted with toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }).
  Rendered as small muted gray text "Last updated: Month D, YYYY" near the bottom of the page,
  above the bottom back link. Omitted entirely when updated_at is null.

CTA strategy:
  URL fields removed from key facts <dl>. A dedicated CTA block replaces them.
  Primary CTAs (application_url) use blue filled button style.
  Secondary CTAs (official_url, provider_url) use border ghost button style.
  All CTAs use target="_blank" rel="noopener noreferrer".
  CTA block omitted entirely when no URLs are present on a record.

English requirements (programs):
  Previous: JSON.stringify in <pre> — unreadable to users.
  New: Object.entries() over JSONB → <ul> with test name (IELTS, TOEFL) and detail string.
  Fallback to plain text notice when JSONB shape is non-object or empty.
  No set:html. No <pre>. No raw JSON visible to users.

Intakes (programs):
  Separate Supabase query after 404 check: program_intakes for this program.id.
  Ordered by application_deadline_date ASC nulls last, limit 10.
  Defaults to [] on error — page never crashes.
  Section shown only when rows exist.

SEO/404 preservation:
  All four pages preserve Phase 15 canonical/ogTitle/ogDesc computation unchanged.
  PublicLayout call signature unchanged. All existing 404 behavior preserved.
  content_status='published' filter preserved on all queries.

npm run build: PASS (Cloudflare server build, 1.49s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No list/search page changes.
  No admin CRUD changes.
  No migrations.
  No new dependencies.
  No React or client-side JS.
  No markdown renderer.
  No media/Cloudinary.
  No junction table display (scholarship_countries, article_subjects, etc.).
  No indexing_status noindex behavior on detail pages.
  No author display on articles.
  No pagination.

Phase 15 — Basic SEO System (implementation complete):

- Added basic SEO infrastructure layer for DegreeWiki's public routes.
  No admin changes, no migrations, no new dependencies, no React, no client-side JS,
  no service_role, no AI, no schema.org structured data.

Files created:
  public/robots.txt — static robots file: allows public crawling, disallows /admin/, /login,
    /auth/, /api/, points Sitemap to https://degreewiki.com/sitemap.xml.
  src/lib/site.ts — exports SITE_URL constant using PUBLIC_SITE_URL env var with fallback
    to 'https://degreewiki.com'. Trailing slash stripped. Consistent with PUBLIC_* env pattern.
  src/pages/sitemap.xml.ts — dynamic Astro API endpoint. Queries all 4 content tables in
    parallel via existing createClient(context.cookies, context.request) with anon key / RLS.
    Includes static URLs (/, /programs, /scholarships, /universities, /guides) plus detail URLs
    filtered to content_status='published' AND indexing_status='index'. updated_at date used
    as lastmod for detail URLs; omitted for static URLs. All loc/lastmod values XML-escaped.
    Returns Content-Type: application/xml; charset=utf-8 with Cache-Control: public, max-age=3600.
    Per-table error isolation: failed tables log to console.error and default to [] — sitemap
    never crashes, static URLs always returned.

Files modified:
  .env.example — added PUBLIC_SITE_URL= line.
  src/layouts/BaseLayout.astro — added canonical, ogTitle, ogDescription, ogType, ogUrl props.
    Renders <link rel="canonical"> when canonical provided. Renders og:site_name, og:type,
    og:title, og:description (if available), og:url (if available). Renders twitter:card=summary,
    twitter:title, twitter:description (if available). All OG/Twitter props have sensible
    fallbacks to title/description. No og:image, no twitter:image, no twitter:site.
    Existing noindex behavior unchanged.
  src/layouts/PublicLayout.astro — passes all new SEO props through to BaseLayout.
  src/pages/index.astro — added SITE_URL import; added canonical={SITE_URL + '/'} to PublicLayout.
  src/pages/programs/index.astro — added SITE_URL import; added canonical={SITE_URL + '/programs'}.
    Canonical always points to clean path regardless of active filters. noindex behavior unchanged.
  src/pages/scholarships/index.astro — same pattern, canonical={SITE_URL + '/scholarships'}.
  src/pages/universities/index.astro — same pattern, canonical={SITE_URL + '/universities'}.
  src/pages/guides/index.astro — same pattern, canonical={SITE_URL + '/guides'}.
  src/pages/programs/[slug].astro — added SITE_URL import; added canonical_url, og_title,
    og_description to Supabase select; computes canonical = canonical_url || SITE_URL+'/programs/'+slug,
    ogTitle = og_title || pageTitle, ogDesc = og_description || pageDesc; passes to PublicLayout.
  src/pages/scholarships/[slug].astro — same pattern.
  src/pages/universities/[slug].astro — same pattern.
  src/pages/guides/[slug].astro — same pattern.

Sitemap indexing behavior:
  All 4 content tables (programs, scholarships, universities, articles) require
  content_status='published' AND indexing_status='index' to appear in the sitemap.
  indexing_status defaults to 'draft' on all tables — records must be explicitly set to 'index'
  by an admin before appearing in the sitemap. This is intentional: it gives the admin explicit
  crawl-inclusion control per record.

Canonical strategy:
  List pages and homepage: SITE_URL + clean path (no query params).
  Filtered list pages: canonical still points to the clean path (/programs not /programs?q=...).
  Detail pages: db.canonical_url if set, otherwise SITE_URL + '/[type]/' + slug.

OG/Twitter strategy:
  ogTitle falls back to title (including — DegreeWiki suffix) when DB og_title is absent.
  ogDescription falls back to description (which itself falls back to seo_description/summary).
  og:type is 'website' for all pages in Phase 15.
  og:image and twitter:image deferred (Cloudinary integration pending).

Environment variable:
  PUBLIC_SITE_URL added to .env.example. Set in .env.local for dev, Cloudflare Pages
  dashboard for production. Falls back to 'https://degreewiki.com' if unset.

npm run build: PASS (Cloudflare server build, 1.42s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No og:image or twitter:image (Cloudinary not yet integrated).
  No twitter:site handle.
  No schema.org / JSON-LD structured data.
  No RSS feed.
  No hreflang.
  No og:type="article" for guides (requires article:published_time metadata — deferred).
  No sitemap index (single sitemap file for now).
  No admin CRUD changes.
  No migrations.
  No new npm dependencies.

## Last Completed Work

Phase 14 — Public Home Page Foundation (implementation complete):

- Upgraded / from a bare auth-placeholder page into a real public-facing homepage.
  Uses PublicLayout (gains PublicNav automatically). No admin changes, no migrations,
  no new dependencies, no React, no client-side JS, no service_role.
- Replaced src/pages/index.astro — full rewrite with hero, discovery cards, start-here block,
  latest programs/scholarships/guides sections, and secondary auth/admin row.

Homepage sections implemented:

  Hero: product name, subtitle for international students, two CTA buttons
    (Browse Programs → /programs, Find Scholarships → /scholarships).
  Discovery cards: four equal cards linking to /programs, /scholarships, /universities, /guides,
    each with a title and one-line description.
  Start here block: four goal-framed plain-link prompts using section index pages (no pre-filtered URLs).
  Latest programs: 3 most-recently created published programs with title, university name,
    degree level badge. Section omitted when no rows.
  Latest scholarships: 3 most-recently created published scholarships with name, provider name,
    deadline badge. Section omitted when no rows.
  Latest guides: 3 most-recently published articles with category badge, date, title, summary.
    Section omitted when no rows.
  Auth/admin row: visually secondary footer row — signed-in shows email, Admin dashboard link,
    Logout form; signed-out shows Sign in link.

Supabase query strategy:
  Four queries in Promise.all: auth.getUser(), programs limit 3 created_at DESC,
  scholarships limit 3 created_at DESC, articles limit 3 published_at DESC nulls last.
  All content queries include .eq('content_status', 'published').
  All failures default to [] — homepage never crashes.
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.
  No service_role. No new dependencies. No migrations.

SEO/meta:
  title: "DegreeWiki — Find Degrees, Scholarships & University Guides"
  description: "Discover university programs, scholarships, and study-abroad guides for international students."
  No noindex — homepage is fully indexable.

npm run build: PASS (Cloudflare server build, 1.36s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No search bar, autocomplete, or global search.
  No personalized homepage, saved items, or user dashboard.
  No AI features.
  No sitemap, robots.txt, canonical, OpenGraph, or structured data (future SEO phase).
  No latest universities section (no published_at column; created_at ordering is misleading).
  No admin CRUD changes.
  No public search/detail page changes.
  No PublicNav, BaseLayout, or PublicLayout changes.


Phase 13 — Public Guides Search / Category Foundation (implementation complete):

- Upgraded /guides from a basic published-guide list into a server-rendered guide discovery
  page with GET-form search and category filter. No admin changes, no migrations, no new
  dependencies, no React, no client-side JS, no service_role.
- Replaced src/pages/guides/index.astro — full rewrite with filter form, conditional Supabase
  query, result cards, result count, over-limit notice, and empty states.

Filters implemented (2 total, all via GET query params):
  q        — articles.title ilike '%q%' OR articles.summary ilike '%q%'
  category — articles.article_category_id = <uuid>

Filters deferred (column does not exist in current schema — no migration added):
  article_type — not a column on articles table in schema v1

Validation:
  q: trim, remove commas and parentheses, max 100 chars. Empty string → absent.
  category: UUID regex validated — invalid values treated as absent.
  Invalid filters never crash the page; they are silently dropped before the query.

Supabase query strategy:
  Single query with { count: 'exact' } and .limit(201).
  .eq('content_status', 'published') always applied (belt-and-suspenders + planner hint).
  .order('published_at', { ascending: false, nullsFirst: false }) then .order('title', { ascending: true }).
  q search uses .or('title.ilike.%q%,summary.ilike.%q%').
  category filter uses .eq('article_category_id', categoryId).
  Lookup query (article_categories) runs in parallel: select id, name, ordered by display_order then name.
  Failed lookups default to [] — page does not crash.
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.

Result UI:
  Card layout. Each card shows: category badge (if set), published_at date (if set),
  title linked to /guides/[slug], summary (if set).
  Result count shown above results. Over-200 notice when more than 200 match.
  Selected filter values preserved after form submit.
  Clear filters link shown when any filter is active.

noindex behavior:
  Filtered URLs (/guides?...) render <meta name="robots" content="noindex, follow">.
  Unfiltered /guides has no robots meta tag and remains indexable.
  Uses existing noindex prop support from Phase 10 (BaseLayout + PublicLayout).

Empty states:
  No filters + no rows → "No guides have been published yet."
  Filters active + no rows → "No guides match your filters." + clear filters link.
  Neither message reveals unpublished or hidden data.

npm run build: PASS (Cloudflare server build, 1.56s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No article_type filter (column absent from schema v1).
  No article junction table filters (article_countries, article_subjects, article_degree_levels).
  No updated_at display.
  No markdown rendering (no set:html).
  No indexing_status behavior changes.
  No pagination (hard limit 200 with over-limit notice).
  No AI, no saved items, no user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

Phase 12 — Public University Search & Filter Foundation (implementation complete):

- Upgraded /universities from a basic published-university list into a server-rendered
  university discovery page with GET-form search and filters. No admin changes, no migrations,
  no new dependencies, no React, no client-side JS, no service_role.
- Replaced src/pages/universities/index.astro — full rewrite with filter form, conditional
  Supabase query, result cards, result count, over-limit notice, and empty states.

Filters implemented (3 total, all via GET query params):
  q       — universities.name ilike '%q%'
  country — universities.country_id = <uuid>
  city    — universities.city_id = <uuid>

Filters deferred (columns do not exist in current schema — no migration added):
  institution_type — not a column on universities table in schema v1
  ownership_type   — not a column on universities table in schema v1
  short_name       — not a column on universities table in schema v1

Validation:
  q: trim, max 100 chars. Empty string → absent.
  country/city: UUID regex validated — invalid values treated as absent.
  Invalid filters never crash the page; they are silently dropped before the query.

Supabase query strategy:
  Single query with { count: 'exact' } and .limit(201).
  .eq('content_status', 'published') always applied (belt-and-suspenders + planner hint).
  .order('name', { ascending: true }).
  Filters chained conditionally: if (q) ilike, if (countryId) eq, if (cityId) eq.
  Lookup queries (countries, cities) run in Promise.all in parallel.
  Failed lookups default to [] — page does not crash.
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.

Result UI:
  Card layout. Each card shows: name (link to /universities/[slug]),
  country/city location line, ranking_summary (truncated, if set),
  official_url as "Official site ↗" link (if set, right-aligned).
  Result count shown above results. Over-200 notice when more than 200 match.
  Selected filter values preserved after form submit.
  Clear filters link shown when any filter is active.

noindex behavior:
  Filtered URLs (/universities?...) render <meta name="robots" content="noindex, follow">.
  Unfiltered /universities has no robots meta tag and remains indexable.
  Uses existing noindex prop support from Phase 10 (BaseLayout + PublicLayout).

Empty states:
  No filters + no rows → "No universities have been published yet."
  Filters active + no rows → "No universities match your filters." + clear filters link.
  Neither message reveals unpublished or hidden data.

npm run build: PASS (Cloudflare server build, 1.48s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No institution_type or ownership_type filters (columns absent from schema v1).
  No short_name display (column absent from schema v1).
  No pagination (hard limit 200 with over-limit notice).
  No city-scoped-by-country cascade (global city dropdown for Phase 12).
  No cross-table name search (country/city name search deferred).
  No AI, no saved items, no user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

Phase 11 — Public Scholarship Search & Filter Foundation (implementation complete):

- Upgraded /scholarships from a basic published-scholarship list into a server-rendered
  scholarship discovery page with GET-form search and filters. No admin changes, no migrations,
  no new dependencies, no React, no client-side JS, no service_role.
- Replaced src/pages/scholarships/index.astro — full rewrite with filter form, conditional
  Supabase query, result cards, result count, over-limit notice, and empty states.

Filters implemented (7 total, all via GET query params):
  q               — scholarships.name ilike '%q%' OR provider_name ilike '%q%'
  scholarship_type — scholarships.scholarship_type = <enum>
  provider_type    — scholarships.provider_type = <enum>
  funding_type     — scholarships.funding_type = <enum>
  application_type — scholarships.application_type = <enum>
  currency         — scholarships.currency ilike '%currency%'
  deadline         — deadline=upcoming → scholarships.deadline >= today (UTC date-only ISO)

Enum values confirmed from migration 007 CHECK constraints:
  scholarship_type: full, partial, merit, need_based, government, institutional, other
  provider_type:    government, university, private_foundation, corporate, ngo, other
  funding_type:     full_tuition, partial_tuition, living_stipend, travel, research, full_funding, other
  application_type: direct, university_portal, nomination, embassy, other

Validation:
  q: trim, remove commas and parentheses, max 100 chars.
  currency: trim, uppercase, remove non A-Z chars, max 10 chars.
  Enum params: validated against allowed set — invalid values treated as absent.
  deadline param: only 'upcoming' is accepted; any other value treated as absent.
  Invalid filters never crash the page; they are silently dropped before the query.

Supabase query strategy:
  Single query with { count: 'exact' } and .limit(201).
  .eq('content_status', 'published') always applied (belt-and-suspenders + planner hint).
  .order('deadline', { ascending: true, nullsFirst: false }) then .order('name', { ascending: true }).
  Filters chained conditionally: if (param) query = query.eq/ilike/or/gte(...).
  q search uses .or('name.ilike.%q%,provider_name.ilike.%q%').
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.

Result UI:
  Card layout. Each card shows: name (link to /scholarships/[slug]),
  provider_name, scholarship_type badge, provider_type badge, funding_type badge,
  application_type badge, deadline badge, amount range (right-aligned).
  Result count shown above results. Over-200 notice when more than 200 match.
  Selected filter values preserved after form submit.
  Clear filters link shown when any filter is active.

noindex behavior:
  Filtered URLs (/scholarships?...) render <meta name="robots" content="noindex, follow">.
  Unfiltered /scholarships has no robots meta tag and remains indexable.
  Uses existing noindex prop support from Phase 10 (BaseLayout + PublicLayout).

Empty states:
  No filters + no rows → "No scholarships have been published yet."
  Filters active + no rows → "No scholarships match your filters." + clear filters link.
  Neither message reveals unpublished or hidden data.

npm run build: PASS (Cloudflare server build, 1.45s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No pagination (hard limit 200 with over-limit notice).
  No amount-based filtering (cross-currency comparison unreliable without conversion).
  No deadline_before filter.
  No junction table filters (scholarship_countries, subjects, degree_levels, etc.).
  No overview in q search (name + provider_name only).
  No AI, no saved items, no user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

Phase 10 — Public Program Search & Filter Foundation (implementation complete):

- Upgraded /programs from a basic published-program list into a server-rendered program
  discovery page with GET-form search and filters. No admin changes, no migrations,
  no new dependencies, no React, no client-side JS, no service_role.
- Modified src/layouts/BaseLayout.astro — added optional noindex?: boolean prop.
  Renders <meta name="robots" content="noindex, follow"> when true. Additive; no effect
  on existing pages that do not pass the prop.
- Modified src/layouts/PublicLayout.astro — added noindex?: boolean prop, passes through
  to BaseLayout. Additive; all existing public pages unaffected.
- Replaced src/pages/programs/index.astro — full rewrite with filter form, conditional
  Supabase query, result cards, result count, over-limit notice, and empty states.

Filters implemented (10 total, all via GET query params):
  q             — programs.title ilike '%q%'
  country       — programs.country_id = <uuid>
  city          — programs.city_id = <uuid>
  university    — programs.university_id = <uuid>
  degree_level  — programs.degree_level_id = <uuid>
  subject       — programs.primary_subject_id = <uuid>
  study_mode    — programs.study_mode = <enum>
  delivery_mode — programs.delivery_mode = <enum>
  language      — programs.language_of_instruction ilike '%language%'
  tuition_max   — programs.tuition_max_amount <= value

Enum values confirmed from migration 006 CHECK constraints:
  study_mode:    full_time, part_time, online, hybrid
  delivery_mode: on_campus, online, hybrid, distance

Validation:
  q: trim, max 100 chars. language: trim, max 80 chars.
  UUID params: regex validated — invalid values treated as absent.
  Enum params: validated against allowed set — invalid values treated as absent.
  tuition_max: parseFloat, must be finite and > 0 — invalid values treated as absent.
  Invalid filters never crash the page; they are silently dropped before the query.

Supabase query strategy:
  Single query with { count: 'exact' } and .limit(201).
  .eq('content_status', 'published') always applied (belt-and-suspenders + planner hint).
  Filters chained conditionally: if (param) query = query.eq/ilike/lte(...).
  Lookup queries (countries, cities, universities, degree_levels, subjects) run in
  Promise.all in parallel. Failed lookups default to [] — page does not crash.
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.

Result UI:
  Card layout. Each card shows: title (link to /programs/[slug]),
  university (link to /universities/[slug]), country/city, degree level badge,
  subject badge, study mode badge, delivery mode badge, language badge, tuition range.
  Result count shown above results. Over-200 notice when more than 200 match.
  Selected filter values preserved after form submit.
  Clear filters link shown when any filter is active.
  Tuition note: "Programs without tuition data may be excluded."

noindex behavior:
  Filtered URLs (/programs?...) render <meta name="robots" content="noindex, follow">.
  Unfiltered /programs has no robots meta tag and remains indexable.

Empty states:
  No filters + no rows → "No programs have been published yet."
  Filters active + no rows → "No programs match your filters." + clear filters link.
  Neither message reveals unpublished or hidden data.

npm run build: PASS (Cloudflare server build, 1.32s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No pagination (hard limit 200 with over-limit notice).
  No program_subjects junction for multi-subject filtering (primary_subject_id only).
  No city-scoped-by-country dropdown dependency (global city list for Phase 10).
  No full-text search across university names (title only via ilike).
  No media/Cloudinary.
  No AI.
  No saved items or user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

Phase 09 — Public Read-Only Content Foundation (implementation complete):

- RLS preflight confirmed on all 9 tables before any code was written.
  All public SELECT policies exist and apply to the anon role (no TO clause).
  No migrations required.
- Created src/layouts/PublicLayout.astro — wraps BaseLayout, includes PublicNav.
- Created src/components/public/PublicNav.astro — horizontal nav: DegreeWiki logo +
  links to /universities, /programs, /scholarships, /guides. Active state via Astro.url.pathname.
- Created src/pages/404.astro — clean 404 page using PublicLayout with links to all public sections.
- Modified src/layouts/BaseLayout.astro — added optional description prop →
  injects <meta name="description"> when present. Additive change; admin pages unaffected.
- Modified src/pages/index.astro — added public nav links above auth block.
- Created src/pages/universities/index.astro — published universities list (name, country, city, ranking).
- Created src/pages/universities/[slug].astro — university detail (facts + ranking + overview).
- Created src/pages/programs/index.astro — published programs list (title, university link, degree, study mode).
- Created src/pages/programs/[slug].astro — program detail (full facts + tuition + curriculum + requirements).
- Created src/pages/scholarships/index.astro — published scholarships list (name, type, provider, amount, deadline).
- Created src/pages/scholarships/[slug].astro — scholarship detail (full facts + overview + eligibility).
- Created src/pages/guides/index.astro — published articles list (card layout: category badge, date, excerpt).
- Created src/pages/guides/[slug].astro — article detail (category, date, summary, content as plain text paragraphs).

Public routes added:
  /universities          — list
  /universities/[slug]   — detail
  /programs              — list
  /programs/[slug]       — detail
  /scholarships          — list
  /scholarships/[slug]   — detail
  /guides                — list  (public name for articles)
  /guides/[slug]         — detail

Key implementation decisions:
  All queries filter content_status = 'published'. Missing or unpublished slug returns
  new Response(null, { status: 404 }). Hard LIMIT 100 on all listing pages (no pagination).
  No set:html anywhere. Article content rendered as plain-text paragraphs. english_requirements
  (confirmed real JSONB column on programs) rendered with JSON.stringify in <pre> when non-null.
  admission_requirements (TEXT) rendered as whitespace-pre-wrap paragraph.
  published_at on articles is nullable — rendered gracefully with no crash.
  All Supabase embedded joins (countries, cities, universities, degree_levels, subjects,
  article_categories) may return null if the joined row is unpublished — all handled with
  optional chaining and ?? fallbacks.

RLS preflight: PASS. All 9 tables confirmed.
npm run build: PASS (Cloudflare output, 1.42s, zero errors).
Get-ChildItem src -Recurse -File | Select-String "service_role" → 0 matches.

Exclusions (deferred):
  No search/filter/pagination UI.
  No media/Cloudinary.
  No AI.
  No saved items or user dashboard.
  No comments or report form.
  No admin page changes.
  No new dependencies.
  No migrations.
  No junction table display (scholarship_countries, article_subjects, etc.).
  No author display on articles (author_user_id join deferred).
  No rich text/markdown rendering.

Phase 08 — Articles / Guides CRUD Foundation (implementation complete):

- Deleted src/pages/admin/articles.astro (flat Phase 04 read-only stub).
  Replaced with articles/ folder to allow sub-routes (same URL /admin/articles, no breakage).
- Added src/pages/admin/articles/index.astro — list: title, slug, category name (via Map),
  content_status badge, published_at, created_at, Edit link. "+ New Article" button.
  Category names resolved client-side from a parallel article_categories fetch → Map<id, name>.
- Added src/pages/admin/articles/new.astro — create form with 5 sections and 8 fields.
- Added src/pages/admin/articles/[id].astro — edit form; loads existing record and article_categories
  in parallel, prefills all fields.
- AdminSidebar.astro: no change needed — Articles link already present at /admin/articles.
- No new validate.ts helpers needed — all existing helpers reused.
- npm run build: PASS (Cloudflare output, 6.74s, zero errors).
- Grep service_role src/: 0 matches.

Routes added:
  /admin/articles        — list with status badges, category column, published_at
  /admin/articles/new    — create form
  /admin/articles/[id]   — edit form

Fields implemented (8):
  title, slug, article_category_id (select from seeded categories),
  summary, content, content_status, indexing_status, verification_status.

Special server-side behaviors:
  author_user_id — set silently on INSERT only; not shown in UI, not modified on edit.
  published_at — set only on first transition to content_status = 'published';
                 never reset on subsequent saves or re-publishes.
  article_category_id — validated against live-loaded categories before DB write;
                        submitted as null when left empty.

Exclusions (deferred):
  No public guide/article pages.
  No SEO fields (seo_title, seo_description, seo_h1, canonical_url, og_title, og_description).
  No media fields (featured_image_id, og_image_id).
  No junction tables (article_countries, article_subjects, article_degree_levels).
  No article category CRUD.
  No delete.
  No service_role in src.

Phase 07 — Scholarships CRUD Foundation (implementation complete):

- Deleted src/pages/admin/scholarships.astro (flat Phase 04 read-only list).
  Replaced with scholarships/ folder to allow sub-routes (same URL /admin/scholarships, no breakage).
- Added src/pages/admin/scholarships/index.astro — list: name, slug, scholarship_type,
  content_status badge, deadline, created_at, Edit link. "+ New Scholarship" button.
- Added src/pages/admin/scholarships/new.astro — create form with 7 sections and 20 fields.
- Added src/pages/admin/scholarships/[id].astro — edit form; loads existing record, prefills
  all fields (numeric columns converted to strings for form state).
- AdminSidebar.astro: no change needed — Scholarships link already present at /admin/scholarships.
- No new validate.ts helpers needed — all existing helpers reused.
- npm run build: PASS (Cloudflare output, 2.75s, zero errors).
- PowerShell service_role search: 0 matches.

Fields implemented (20):
  name, slug, scholarship_type, provider_name, provider_type, funding_type, application_type,
  amount_min, amount_max, currency, coverage_notes, deadline, deadline_text,
  official_url, application_url, provider_url, overview, eligibility_summary,
  content_status, verification_status.

Fields intentionally skipped:
  indexing_status, all SEO fields, og_image_id, data_completeness_score,
  source_confidence_score, last_verified_at, next_review_due_at.
  All junction tables (scholarship_countries, scholarship_universities, scholarship_programs,
  scholarship_subjects, scholarship_degree_levels, scholarship_eligible_nationalities) — deferred.

Phase 06 — Programs CRUD Foundation (implementation complete):

- Deleted src/pages/admin/programs.astro (flat Phase 04 read-only list).
  Replaced with programs/ folder to allow sub-routes (same URL /admin/programs, no breakage).
- Added src/pages/admin/programs/index.astro — list: title, university (name via map),
  degree level code, content_status badge, created_at, Edit link. "+ New Program" button.
  Separate university and degree_level queries + Maps (no join, per Approved Decision 9).
- Added src/pages/admin/programs/new.astro — create form with 8 sections and 26 fields.
- Added src/pages/admin/programs/[id].astro — edit form; loads existing record, prefills
  all fields (numeric columns converted to strings for form state).
- Extended src/lib/admin/validate.ts with two new helpers:
  validateNumeric(value, label, { min? }) — non-empty numeric check with optional floor.
  validateUrl(value, label) — non-empty http/https URL check using new URL().
- country_id and city_id: not exposed as form inputs. Derived server-side by looking up
  the selected university in the already-loaded universities array on every POST.
- AdminSidebar.astro: no change needed — Programs link already present at /admin/programs.
- npm run build: PASS (Cloudflare output, 7.74s, zero errors).
- PowerShell service_role search: 0 matches.

Fields implemented (26):
  title, slug, university_id, degree_level_id, degree_award, primary_subject_id,
  duration_months, study_mode, delivery_mode, language_of_instruction,
  tuition_min_amount, tuition_max_amount, tuition_currency, tuition_period, tuition_notes,
  application_fee_amount, application_fee_currency, application_fee_notes,
  official_url, application_url, admission_requirements, gpa_requirements,
  curriculum_summary, career_outcomes, content_status, verification_status.

Fields intentionally skipped:
  campus_id (no campus CRUD yet), english_requirements (jsonb — deferred),
  indexing_status, all SEO fields, og_image_id, data_completeness_score,
  source_confidence_score, last_verified_at, next_review_due_at.

Phase 05 — Admin CRUD Foundation (implementation complete):

- Added src/lib/admin/validate.ts — manual validation helpers (no Zod; Zod not in package.json).
  Functions: validateRequired, validateExactLength, validateIn, validateSlug.
- Added src/lib/admin/slug.ts — toSlug() helper: lowercase, strip non-alnum, collapse hyphens.
- Added /admin/countries (new list page), /admin/countries/new, /admin/countries/[id] (edit).
  Fields: name, slug, iso2, iso3, continent, overview, content_status.
- Added /admin/cities (new list page), /admin/cities/new, /admin/cities/[id] (edit).
  Fields: name, slug, country_id (select from all countries), content_status.
  List shows joined country name.
- Moved /admin/universities from flat universities.astro → universities/index.astro
  (required to allow universities/ folder for new/edit routes; same URL, no breakage).
  Added + New University button and Edit links to the list.
  Added /admin/universities/new and /admin/universities/[id] (edit).
  Fields: name, slug, country_id, city_id (optional), official_url, overview, content_status.
- Added /admin/degree-levels (new list page), /admin/degree-levels/[id] (edit only — no create).
  Fields: name, display_order, is_active. Code field shown as read-only info, not an input.
- Added /admin/subjects (new list page), /admin/subjects/new, /admin/subjects/[id] (edit).
  Fields: name, slug, parent_subject_id (select excluding self on edit), display_order, content_status.
  Self-parent assignment blocked server-side on edit.
- Updated AdminSidebar.astro: added Countries, Cities, Degree Levels, Subjects nav links (13 total).
- All new routes enforce the existing requireSuperAdmin() guard.
- All writes use the session-authenticated Supabase server client. No service_role in src.
- No migrations. No new API endpoints. No React. No client-side JS.
- Constraint errors (code 23505) surface as user-readable field-level messages.
- POST-redirect-GET on success (no flash message system needed).
- npm run build: passed (Cloudflare output, 9.76s).
- grep service_role src/: 0 matches.

Phase 04 — Admin Dashboard Foundation (implementation complete):

- Added shared admin auth guard (src/lib/admin/guard.ts) — requireSuperAdmin() helper extracts
  the three-step gate: getUser() → redirect if anon, has_role('super_admin') RPC → 403 if not.
  Returns { type: 'ok', user, supabase } so pages reuse the same client for data queries.
- Added badge class maps (src/lib/admin/badges.ts) with static literal strings for Tailwind v4
  scanner compatibility. Maps cover content_status, import_status, batch_type, quality result,
  and account_status.
- Added AdminLayout.astro — wraps BaseLayout (no duplicate html/head/body). Two-column layout:
  fixed sidebar + main content area with topbar (email + logout).
- Added AdminSidebar.astro — 9-link nav, active link highlight via activePath prop.
- Added StatCard.astro — reusable stat card for dashboard counts.
- Replaced /admin (index.astro) with dashboard home: 6 stat cards (universities, programs,
  scholarships, articles, import batches, users) loaded via count queries.
- Added /admin/universities — table: name, slug, content_status badge, verification_status,
  data_completeness_score, created_at. 100-row limit, ordered by created_at desc.
- Added /admin/programs — table: title, slug, content_status badge, degree level code (via
  degree_levels lookup map), created_at.
- Added /admin/scholarships — table: name, slug, content_status badge, scholarship_type,
  deadline (scholarships.deadline is a real date column, confirmed), created_at.
- Added /admin/articles — table: title, slug, content_status badge, published_at
  (articles.published_at confirmed), created_at.
- Added /admin/data-quality — pass/fail/warning summary counts + table: entity_type,
  check_type, result badge, checked_at. 50-row limit.
- Added /admin/imports — table: batch_type badge, import_status badge, total_records,
  processed_count, error_count, created_at. import_batches columns confirmed from migration 010.
- Added /admin/users — table: user ID (truncated), display_name, account_status badge,
  created_at. Email omitted — not in user_profiles; auth.users requires service_role.
  Note shown in UI explaining the limitation.
- Added /admin/system — roles and permissions tables from seed data. No secrets, no env vars.
- All 9 routes enforce: anonymous → /login?redirect=..., non-super_admin → 403.
- npm run build: passed (Cloudflare output, 7.26s).
- grep service_role src/: one match — a comment in users.astro explaining why email is not
  shown. No actual service_role key usage anywhere in src/.
- No .env.local or secrets in git diff.

Phase 03 — App Foundation and Auth (complete):

- Scaffolded Astro v5 app (no app existed before this phase).
- Configured Cloudflare SSR adapter (output: server).
- Added Tailwind v4 via @tailwindcss/vite Vite plugin (not deprecated @astrojs/tailwind).
- Added src/styles/global.css with @import "tailwindcss".
- Added Supabase browser client (src/lib/supabase/client.ts) using @supabase/ssr createBrowserClient.
- Added Supabase server client (src/lib/supabase/server.ts) using @supabase/ssr createServerClient.
  Cookie reading uses raw request header parsing — AstroCookies.getAll() does not exist in Astro v5.
- Added src/middleware.ts for per-request session token refresh.
- Added /login page with email+password form and open-redirect guard on the ?redirect= param.
- Added POST /api/auth/logout endpoint — signs out and redirects to /login.
- Added /auth/callback route for future magic link / OAuth code exchange.
- Added /admin protected route: getUser() validates JWT server-side; has_role('super_admin')
  RPC confirms role. Returns 403 for non-super_admin. Redirects anonymous visitors to /login.
- Added .env.example committed with empty keys. .env.local is gitignored.
- Added dist/ and .astro/ to .gitignore.
- React not installed in Phase 03 — deferred until interactive islands are actually needed.
- No service_role key anywhere in src/. No secrets committed.
- npm run build: passed (Cloudflare output, 2.47s).
- All auth tests passed: super_admin login to /admin, student denied (403),
  anonymous /admin redirect to login, logout clears session.
- Committed as 1ad037b on branch feature/phase-03-app-foundation-auth.

Phase 02 — Supabase Cloud Dev Deployment and RLS Validation (complete):

- Provisioned Supabase cloud dev project (ap-south-1 / Mumbai, ref: hbjnrlsnrknugpkitihq).
- Pushed migrations 001–015 via `supabase db push`. Remote migration list matches local.
- Bootstrapped first super_admin (degreewiki@gmail.com) via Supabase Dashboard SQL editor.
- Verified super_admin: role_code = super_admin, permission_count = 20.
- Verified cloud grants: anon and authenticated DML grants present on all public tables.
- RLS problem check: 0 rows returned — every public table has RLS enabled and at least one policy.
- Ran 15-test RLS REST/API smoke test suite (anon key + JWTs only, no service_role):
  - anon reads active degree_levels and report_categories: PASS.
  - anon INSERT into degree_levels blocked (HTTP 401 — no anon INSERT grant, not an RLS failure): PASS.
  - anon SELECT on user_profiles returns []: PASS.
  - smoke student reads only own user_profile: PASS.
  - smoke student INSERT into student_profiles: PASS.
  - smoke student sees only own student_profile: PASS.
  - smoke student cannot read admin_activity_logs: PASS.
  - smoke student cannot INSERT into roles: PASS (HTTP 403).
  - super_admin sees all user_profiles (2 visible): PASS.
  - super_admin sees all student_profiles (1 visible): PASS.
  - super_admin reads admin_activity_logs without 403: PASS.

Phase 01 — Database Schema v1 (complete):

- Wrote and approved three-round implementation plan for Full Database Schema v1.
- Implemented migrations 001–004.
- Patched migrations 002–004 with security fixes.
- Re-verified patches via grep after a discrepancy was reported between the reviewed
  version and the files on disk. Grep confirmed all three fixes are present on disk.
- Implemented migration 005 (universities, campuses) after 001–004 were approved.
- Implemented migration 006 (programs, program_subjects, program_intakes).
- Implemented migration 007 (scholarships and all six junction tables).
- Implemented migration 008 (article_categories, articles, article junction tables, seo_page_types, seo_landing_pages).
- Implemented migration 009 (data_sources, source_snapshots, verification_events, data_quality_checks).
- Implemented migration 010 (import_batches, import_files, staging_universities, staging_programs, staging_scholarships, staging_errors).
- Implemented migration 011 (student_profiles, student_profile_subjects, student_profile_countries).
- Implemented migration 012 (ai_finder_results, ai_finder_program_matches, ai_conversations, ai_messages, ai_usage_logs).
- Security-patched migrations 011 and 012 (round 1: tightened constraints, removed unsafe browser write policies).
- Security-patched migration 012 (round 2: removed ai_finder_results_insert_own; tightened ai_conversations INSERT/UPDATE to enforce student_profile_id ownership).
- Implemented migration 013 (report_categories, user_reports, saved_items).
- Implemented migration 014 (analytics_events, search_logs, outbound_clicks).
- Security-patched migration 014 (round 1: tightened INSERT WITH CHECK to prevent user_id impersonation; added entity_type/entity_id consistency constraint on analytics_events).
- Implemented migration 015 (seed data: degree_levels, roles, permissions, role_permissions, article_categories, seo_page_types, report_categories).

## Current Architecture Decisions

- Astro.js frontend
- React islands for interactivity (React not yet installed — deferred until first interactive island)
- Tailwind CSS v4
- Supabase PostgreSQL
- Supabase Auth
- Supabase RLS
- Cloudflare Pages/Workers as primary deployment
- Vercel as fallback deployment
- Cloudinary for public images
- Supabase Storage for private/import files
- Gemini first through AI Gateway
- pgvector later for RAG
- No ChromaDB in MVP
- No separate admin app in MVP
- No Vercel-only services
- Text columns with CHECK constraints — no PostgreSQL ENUM types
- has_role() and has_permission() as RLS helper functions
- RLS enabled inline on every table — no table left open
- Anonymous student profiles and AI sessions are managed via service role (server endpoints only)
- No direct browser RLS for anonymous AI or profile data

## Active Branch

main

## Migration Files Created

supabase/migrations/001_custom_types.sql
supabase/migrations/002_auth_roles.sql
supabase/migrations/003_media.sql
supabase/migrations/004_lookup_tables.sql
supabase/migrations/005_universities_campuses.sql
supabase/migrations/006_programs.sql
supabase/migrations/007_scholarships.sql
supabase/migrations/008_articles_seo.sql
supabase/migrations/009_data_sources.sql
supabase/migrations/010_import_staging.sql
supabase/migrations/011_student_profiles.sql
supabase/migrations/012_ai_tables.sql
supabase/migrations/013_user_product.sql
supabase/migrations/014_analytics.sql
supabase/migrations/015_seed_data.sql

## Database Schema v1 — Complete

All 15 migrations are written. No migrations remain in v1.

## Bootstrap Note

The first super_admin user cannot be assigned through normal browser flows because RLS
on user_roles blocks all non-super_admin writes. The first role assignment must be done
using one of these methods:

- Supabase Dashboard SQL editor (runs as postgres, bypasses RLS)
- A local seed script executed with the service role key
- supabase db seed or a one-time SQL snippet on the connected database

After the first super_admin exists, all subsequent role assignments can be done through
the admin dashboard server endpoints.

## Known Issues / Open Questions

- Countries and subjects import source not yet confirmed (needed for post-schema data load).
- english_requirements jsonb schema example not yet documented.
- Frontend design system is not finalized.
- MCP/tooling setup is not finalized.
- T2-A (anon INSERT degree_levels) returned HTTP 401 instead of 403. This is correct behaviour:
  PostgREST returns 401 when the role has no INSERT grant at all (pre-RLS rejection), and 403
  when a grant exists but an RLS policy blocks the row. The write is blocked either way.
- /admin/users shows profile data only (display_name, account_status). Email requires a
  privileged server endpoint querying auth.users via service role — deferred to future phase.

## Next Steps

Phase 10 manual test checklist (verify before calling done):
1. GET /programs — blank form, all published programs listed, no noindex in page source.
2. GET /programs?q=science — title filter works, q field pre-filled, noindex in source.
3. GET /programs?country=<valid-uuid> — country dropdown shows selection, results filtered.
4. GET /programs?country=not-a-uuid — treated as no filter, page does not error.
5. GET /programs?study_mode=full_time — dropdown shows "Full time" selected.
6. GET /programs?study_mode=bogus — treated as no filter.
7. GET /programs?delivery_mode=on_campus — dropdown shows "On campus" selected.
8. GET /programs?tuition_max=20000 — filters correctly, note visible below input.
9. GET /programs?tuition_max=-50 — treated as no filter (field shows empty).
10. GET /programs?tuition_max=abc — treated as no filter.
11. GET /programs?language=English — results filtered, field pre-filled.
12. All 10 filters active simultaneously — combined filtering works.
13. Result count shown correctly ("N programs found.").
14. Over-200 notice appears if enough data exists.
15. Empty result with filters → "No programs match your filters." + clear filters link.
16. Empty result without filters → "No programs have been published yet."
17. Program card: title link, university link, location, degree badge, subject badge,
    mode badges, language badge, tuition range all render correctly.
18. University link goes to /universities/[slug].
19. Title link goes to /programs/[slug] (detail page — no regression).
20. Clear filters link returns to /programs.
21. Selected filter values preserved after form submit.
22. GET /programs/[slug] — detail page loads without regression.
23. GET /admin/ unauthenticated — redirects to /login (no admin regression).

Begin Phase 11 after Phase 10 manual verification passes.
