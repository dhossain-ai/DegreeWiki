# DegreeWiki Task Log Archive: Phase 31-38

Extracted from the 2026-06-21 pre-compaction snapshot. Covers AI chat architecture, saved-result chat, and static-boundary work.

## 2026-06-19 - Phase 37: AI Chat Routing + Static Response Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add a deterministic routing layer to POST /api/ai/chat so obvious messages (greetings,
thanks, capability questions, guarantee requests, out-of-scope requests) are handled with
static responses before any LLM or rate-limit call. Static turns are persisted to chat
history. No schema changes, no new dependencies, no UI changes, no service role expansion.

---

### Files Created

src/lib/ai/chat/router.ts:
  Exports StaticCategory, ChatRouteDecision types.
  Exports STATIC_RESPONSES (Record<StaticCategory, string>) with bounded, non-guarantee wording.
  Exports routeChatMessage(message: string): ChatRouteDecision.
  Six regex-driven pattern groups: greeting, thanks, help, guarantee, out_of_scope (new programs
  + off-topic + prompt-override attempts), llm fallthrough.
  Guarantee patterns require explicit admission/visa/scholarship terms — avoids over-matching.
  New-program patterns require a search/find verb or outside/beyond qualifier — normal comparison
  questions ("which program should I choose?") fall through to LLM.

---

### Files Modified

src/lib/ai/chat/persist.ts:
  Added STATIC_PROMPT_TEMPLATE_VERSION constant ('static-v1').
  Added PersistStaticTurnParams interface.
  Added persistStaticTurn(params, env): Promise<boolean> helper.
  Builds minimal ContextUsedSnapshot: chatMode='saved_result', programsUsed=[],
  warningsIncluded=false, missingTuitionCount=0, ai_model_used='static', zero tokens.
  Writes user + assistant rows to ai_messages; updates last_message_at (best-effort).
  Does NOT write to ai_usage_logs. Fail-safe — returns false on error, never throws.

src/pages/api/ai/chat.ts:
  Imports routeChatMessage, STATIC_RESPONSES from router.ts.
  Imports persistStaticTurn from persist.ts.
  Updated POST flow: after auth, calls routeChatMessage(message).
  Static path: SSR/RLS ownership check (.select('id').eq('id', resultId).maybeSingle()),
    404 if not found; getOrCreateConversation; persistStaticTurn; return { ok: true, answer, conversation_id }.
  LLM path: unchanged (rate limit → loadChatContext → getOrCreateConversation → callAI →
    persistChatTurn → return).
  Static path skips: rate-limit check, loadChatContext, callAI, usage logging.

docs/09-ai-chat-architecture.md: Phase 37 section added; old Phase 37 (multi-turn) renamed Phase 38.
docs/06-status.md: Updated current phase to Phase 37.
docs/07-task-log.md: This entry.

---

### Checks

npm run build: see below.
npm run check: command does not exist in this project.

Security greps (all 0 matches):
  service_role in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  callAI in pages/components: 0 matches.
  PUBLIC service key in src: 0 matches.
  innerHTML/set:html in ai components: 0 matches.

---

### Deviations from plan

None.

---


## 2026-06-19 - Phase 38: Program + Scholarship Advisor Boundary Plan

Tool:
Claude (claude-sonnet-4-6)

Goal:
Define safe future product boundaries for a Program Page AI Advisor and a Scholarship Page
AI Advisor before any implementation begins. Docs only — no src changes, no migrations,
no API routes, no UI, no AI prompt changes, no router changes, no dependencies.

---

### Files Created

None.

---

### Files Modified

docs/09-ai-chat-architecture.md:
  Replaced Phase 38 stub (optional multi-turn upgrade) with a pointer to the boundary spec.
  Renamed deferred multi-turn upgrade to Phase 39.
  Added Program Page AI Advisor and Scholarship Page AI Advisor to the Later phases list.
  Appended Section 18: Phase 38 boundary specification (five subsections):
    18.1 Program Page AI Advisor — allowed answers, context, login requirement, conversation
         anchor requirement (future ai_conversations.program_id migration), refusals,
         missing/unverified data behavior.
    18.2 Scholarship Page AI Advisor — allowed answers, context, login requirement,
         conversation anchor requirement (future ai_conversations.scholarship_id migration),
         refusals, missing/unverified data behavior.
    18.3 Shared AI safety rules — applies to both advisors without exception. No guarantees,
         no invented facts, no out-of-scope data, checkInput/checkOutput required, static
         routing required before LLM, user input never in system prompt.
    18.4 Required future schema, API, and helper needs — program_id and scholarship_id
         migration specs, dedicated API endpoints (/api/ai/program-chat,
         /api/ai/scholarship-chat), context loaders, persist helpers, prompt template
         chatMode extensions. Explicitly states neither advisor should reuse saved-result
         chat by stuffing context into ai_finder_result_id.
    18.5 Deferral decisions — what must wait for Data Source + Verification foundation,
         Import/Staging/data-quality foundation, Student Profile improvements, and
         chat context schema expansion.

docs/06-status.md:
  Added Phase 38 as current phase (complete, docs only).

docs/07-task-log.md:
  This entry.

---

### Checks

No build step required — docs only.
No src changes — no security greps required.

---

### Deviations from plan

None. docs/04-ai-system.md was reviewed and required no changes.
Anonymous user phrasing corrected per approval: framed as future design only,
not as a currently implemented feature.

---


## 2026-06-18 - Phase 36: Saved Result Chat Completion Bundle

Tool:
Claude (claude-sonnet-4-6)

Goal:
Make saved-result chat feel complete and persistent: load prior chat history from the DB,
render it server-side on the result detail page, polish chat UX (empty state, suggested
questions, scroll to latest, clear button), and add a safe clear/reset endpoint.
No schema changes, no new dependencies, no service role in pages/components/layouts.

---

### Files Created

src/pages/api/ai/chat-clear.ts:
  Authenticated POST endpoint for /api/ai/chat-clear.
  Accepts { ai_finder_result_id: uuid }.
  Uses SSR Supabase client only (no service role).
  Verifies result ownership via RLS (ai_finder_results_select_own) before deleting.
  Deletes ai_conversations row for (user, result); ai_messages cascade via FK.
  Returns { ok: true } on success or when no conversation exists.
  Returns 404 not_found when result not found/not owned.

### Files Modified

src/pages/fit-finder/results/[id].astro:
  Added two server-side DB queries after existing match queries:
    - SELECT ai_conversations by ai_finder_result_id (RLS-scoped, SSR client).
    - SELECT ai_messages by ai_conversation_id, role in (user, assistant),
      ordered by created_at ASC, limit 40.
  Passes initialMessages array (role, content only) to SavedResultChat.

src/components/ai/SavedResultChat.astro:
  New prop: initialMessages: Array<{ role, content }>.
  Server-side renders prior messages into transcript div using Astro text interpolation.
  New empty state with 4 static suggested question chips (fills textarea on click, no auto-submit).
  Clear chat button (hidden until messages exist, disabled during fetch).
  Scrolls to last message on initial load when history present.
  Scrolls new turns into view after append.
  Client clear flow: POST /api/ai/chat-clear, then replaceChildren() to clear transcript DOM.
  setBusy() disables both Ask and Clear during any pending fetch.
  No innerHTML, no set:html, no service role, no callAI.

docs/09-ai-chat-architecture.md: Phase 36 section added.
docs/06-status.md: Updated current phase to Phase 36.
docs/07-task-log.md: This entry.

---

### Checks

npm run build: passed, zero errors.
npm run check: command does not exist in this project.

Security greps (all 0 matches):
  service_role in pages/components/layouts: 0 matches.
  createServiceClient in pages/components/layouts: 0 matches.
  callAI in pages/components: 0 matches (existing hits are pre-approved API endpoint and result.astro).
  PUBLIC service key in src: 0 matches.
  innerHTML/set:html in chat component: 0 matches.

---

### Deviations from plan

None.

---


## 2026-06-18 - Phase 35: Saved Result Chat UI Foundation

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add first user-facing saved-result chat UI on the saved Fit Finder result detail page.
UI calls Phase 34's /api/ai/chat endpoint. No new route, no streaming, no history loading,
no schema changes, no new dependencies, no React.

---

### Files Created

src/components/ai/SavedResultChat.astro:
  Astro component. Props: resultId (server-embedded UUID).
  Renders heading, disclaimer, transcript div, status div, labeled textarea, submit button.
  Inline script via define:vars={{ resultId }}:
    Client-side message validation (empty / >1000 chars blocked before fetch).
    Disables submit + changes text to "Asking..." during fetch.
    POST /api/ai/chat with { ai_finder_result_id: resultId, message }.
    On success (ok: true): appends user + assistant turns via DOM textContent (no innerHTML).
    On error: maps data.error to safe user-facing string; displays in status area.
    Clears textarea on success. Re-enables button in finally.
  No innerHTML. No set:html. No React. No external dependencies.

---

### Files Modified

src/pages/fit-finder/results/[id].astro:
  Added import SavedResultChat.
  Mounted below match list:
    result.result_status === 'complete' && matches.length > 0
  No other logic changes. No callAI added to this file.

docs/09-ai-chat-architecture.md:
  Phase 35 section updated from "Chat page MVP (planned)" to
  "Saved Result Chat UI Foundation (complete)" with full boundary documentation.
  Phase 36 retains the optional multi-turn upgrade description.

docs/06-status.md:
  Phase 35 completion entry prepended.

docs/07-task-log.md:
  This entry.

---

### Key Decisions

define:vars used to pass resultId (server UUID) to the inline script. Astro serializes
  it as a JS string literal. Safe because resultId matches UUID regex and cannot
  contain HTML/JS injection content.

Transcript uses DOM createElement + textContent only. No innerHTML on any path.

Error mapping uses data.error (not data.code) — matching the actual Phase 34 API shape.
  message_rejected shows data.answer (safe AI-generated rejection text) when present.

Chat section not shown for result_status !== 'complete' or matches.length === 0.

No chat history loaded from ai_messages. Transcript is session-only (cleared on reload).
  History loading deferred to a future phase.

---

### Validation

npm run build: PASS (Cloudflare server build, zero errors).
service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts: 0 matches.
createServiceClient in pages/components/layouts: 0 matches.
callAI in pages/components: chat.ts + result.astro only (not in new files).
PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.
innerHTML|set:html in src/components/ai: 0 matches.

---


## 2026-06-18 - Phase 34: Saved Result Chat API Endpoint Foundation

Tool:
Claude (claude-sonnet-4-6)

Goal:
Create the server-side JSON API endpoint for saved-result-bound AI chat.
Wire Phase 33 helpers (loadChatContext, getOrCreateConversation, persistChatTurn)
into a complete authenticated POST handler. No chat UI, no chat page, no migrations,
no new dependencies, no service-key expansion in pages/components/layouts.

---

### Files Created

src/pages/api/ai/chat.ts:
  Authenticated POST handler for /api/ai/chat.
  Method guard (POST only via Astro named export).
  JSON body parsing with safe try/catch — 400 on failure.
  Validates ai_finder_result_id (UUID regex) and message (1–1000 chars trimmed).
  Creates authenticated SSR Supabase client: createClient(cookies, request).
  getUser() — 401 if no user.
  getAIEnv(locals) for Cloudflare Worker bindings.
  checkAIRateLimit(user.id, 'chat', aiEnv) — 429 on limit_exceeded; 503 on unavailable.
  loadChatContext(resultId, supabase) — RLS-scoped, no privileged access. 404 if null.
  getOrCreateConversation({ userId, finderResultId }, aiEnv) — 500 if null.
  Builds AIContext from chatContext.programs (allowlisted public fields only).
  callAI({ sessionType: 'chat', chatMode: 'saved_result', userMessage, context,
    userId, conversationId }, aiEnv).
  guardrailTripped → 400 message_rejected with aiResponse.text as answer.
  fallbackUsed (non-guardrail) → 503 ai_unavailable.
  Builds ContextUsedSnapshot: chatMode, promptTemplateVersion, safetyPolicyVersion,
    aiFinderResultId, conversationId, programsUsed, warningsIncluded, missingTuitionCount.
  persistChatTurn(...) — failure logged server-side; answer still returned (200).
  Returns { ok: true, answer: aiResponse.text, conversation_id: conversationId }.
  No service-key strings in this file. No createServiceClient import.
  All privileged operations delegated to approved src/lib/ helpers.

### Files Modified

src/lib/ai/usage/limits.ts:
  Added import: AIRuntimeEnv from ../types; createServiceClient from ../../supabase/service.
  Added checkAIRateLimit(userId, sessionType, env: AIRuntimeEnv): Promise<RateLimitResult>.
  Wraps checkRateLimit with internal service-client creation from env.SUPABASE_SERVICE_ROLE_KEY
  and dailyLimit extraction from env.AI_RATE_LIMIT_USER_DAILY.
  Allows API routes to pre-check rate limits without reading service-role secrets directly.

docs/09-ai-chat-architecture.md:
  Section 7: added Phase 34 update note; renamed page-route subsection as deferred;
  replaced "same-page POST (preferred for MVP)" with JSON API endpoint description.
  Section 16: replaced Phase 34 (Chat route MVP) with Phase 34 complete entry;
  added Phase 35 (Chat page MVP planned) and renumbered Phase 36 (multi-turn upgrade).

docs/06-status.md:
  Updated Current Phase to Phase 34.
  Added Phase 34 entry with files, security boundary, and validation results.

docs/07-task-log.md:
  This entry.

### Corrections applied to original plan

1. No service-role access directly in the API route. Added checkAIRateLimit helper to
   src/lib/ai/usage/limits.ts so the API route never reads SUPABASE_SERVICE_ROLE_KEY.
2. Initial file-level comments mentioned forbidden strings — rewritten to avoid grep matches.
3. Rate limit pre-check uses checkAIRateLimit: returns 429 for limit_exceeded, 503 for
   service_unavailable (lets callAI handle service issues consistently).

### Validation

npm run build: PASS (Cloudflare server build, zero errors).
service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts: 0 matches.
createServiceClient in src/pages,src/components,src/layouts: 0 matches.
callAI in src/pages,src/components: chat.ts (import + call) + result.astro (unchanged).
PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/: 0 matches.

### Explicit Exclusions

No chat UI. No chat page (src/pages/fit-finder/results/[id]/chat.astro not created).
No migration. No new npm dependency. No React. No client-side JS. No anonymous chat.
No service-key usage in pages/components/layouts.
No AI answers outside saved-result context (chatMode enforced; programs from RLS query only).
No changes to gateway.ts, types.ts, persist.ts, context.ts, guardrails.ts, logging.ts,
  providers, env.ts, or any src/pages/fit-finder/* file.

---


## 2026-06-18 - Phase 33: Context-Bound Chat Prompt + Server Helper Foundation

Tool:
Claude (claude-sonnet-4-6)

Goal:
Prepare server-only foundations for saved-result-bound AI chat.
No chat UI, no public route, no API endpoint, no live user-facing chat.
Deliverables: context loader helper, persistence helper, hardened prompt, type additions,
guardrail additions, gateway wiring, documentation.

---

### Files Created

src/lib/ai/chat/context.ts:
  Server-only RLS-scoped context loader. No service role.
  loadChatContext(resultId, supabase) accepts authenticated SSR client.
  RLS enforces ownership. Returns null on missing/non-owned/non-complete result.
  Builds ChatResultProgram[] from explicit allowlist. Top 10 programs max.

src/lib/ai/chat/persist.ts:
  Server-only service-role persistence helper.
  getOrCreateConversation — finds or creates ai_conversations row, handles 23505 race.
  persistChatTurn — inserts user + assistant ai_messages rows, updates last_message_at.
  Never called from pages/components/layouts (Phase 34 route will call these).

---

### Files Modified

src/lib/ai/types.ts:
  Added ChatResultProgram, ChatResultContext, ContextUsedSnapshot.
  Added chatMode?: 'saved_result' to AIRequest.

src/lib/ai/gateway.ts:
  Passes request.chatMode to buildChatPrompt in the chat branch (one-line change).

src/lib/ai/prompts/chat-answer.ts:
  Replaced with hardened buildChatPrompt(userMessage, context, chatMode?).
  chatMode === 'saved_result': 12-rule context-bound system prompt.
    Human-readable program block format (not raw JSON). Anti-injection rule 12.
  chatMode undefined: original generic prompt preserved (backward-compatible).
  Exports CHAT_SAVED_RESULT_PROMPT_VERSION for ContextUsedSnapshot audit.

src/lib/ai/safety/guardrails.ts:
  Input patterns added: ignore/disregard previous instructions (prompt injection).
  Output patterns added: scholarship certainty, eligibility confirmation variants.
  Exports GUARDRAILS_VERSION = 'guardrails-v2' for ContextUsedSnapshot audit.

src/lib/supabase/service.ts:
  Comment updated to list all approved server-only AI operations.

docs/09-ai-chat-architecture.md:
  Phase 33 entry added to Section 16 with full helper/prompt boundary documentation.

docs/06-status.md:
  Phase 33 completion entry added.

docs/07-task-log.md:
  This entry.

---

### Key Facts Confirmed

result_status 'complete' — from migration 012 CHECK constraint + existing page code.
ai_messages FK column: ai_conversation_id (not conversation_id).
ai_conversations.session_type CHECK ('finder'|'chat') — uses 'chat'.
ai_conversations.last_message_at: timestamptz, nullable.
No ai_messages.updated_at column (append-only by design).

---

### Validation

npm run build: PASS (Cloudflare server build, zero errors).
service_role|SERVICE_ROLE|SUPABASE_SERVICE in pages/components/layouts → 0.
createServiceClient in pages/components/layouts → 0.
chat/context|chat/persist in pages/components/layouts → 0.
callAI in pages/components → 2 matches, both in fit-finder/result.astro (unchanged).
PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/ → 0.
No migration added. No new dependencies. No chat route. No API endpoint.

---


## 2026-06-18 - Phase 32: AI Chat Schema Foundation

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add the missing database schema and RLS foundation required for future saved-result-bound
AI chat. Migration-only phase — no chat UI, no chat route, no API endpoint, no AI calls,
no source app behavior changes.

---

### Files Created

supabase/migrations/016_ai_chat_schema.sql:

  Migration adding ai_finder_result_id to ai_conversations plus RLS policy updates.

  Step 1 — ADD COLUMN IF NOT EXISTS:
    ai_conversations.ai_finder_result_id uuid (nullable)
    REFERENCES public.ai_finder_results(id) ON DELETE CASCADE.
    Nullable: existing rows and future generic chat sessions receive NULL.
    ON DELETE CASCADE: deleting the parent ai_finder_results row cascades to
      ai_conversations, which cascades further to ai_messages via the existing
      ai_conversation_id ON DELETE CASCADE FK.

  Step 2 — Lookup index:
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_finder_result_id
      ON public.ai_conversations (ai_finder_result_id);

  Step 3 — Partial unique index:
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conversations_unique_user_finder_result
      ON public.ai_conversations (user_id, ai_finder_result_id)
      WHERE ai_finder_result_id IS NOT NULL;
    Enforces one conversation per (user_id, ai_finder_result_id) pair when the result
    link is set. NULL rows excluded from uniqueness — no constraint on generic conversations.

  Step 4 — RLS policy update (ai_conversations_insert_own):
    DROP POLICY IF EXISTS then CREATE POLICY with extended WITH CHECK:
    Clause 1 (unchanged): user_id = auth.uid().
    Clause 2 (unchanged): student_profile_id ownership — if set, must belong to
      auth.uid() with is_anonymous = false.
    Clause 3 (new): ai_finder_result_id ownership — if set, the linked
      ai_finder_results row must belong to auth.uid() via the student_profiles
      join chain (afr.student_profile_id → sp.user_id = auth.uid()).
    Clause 4 (new, cross-field consistency): if both student_profile_id and
      ai_finder_result_id are set, ai_finder_results.student_profile_id must
      equal ai_conversations.student_profile_id. Prevents a conversation from
      declaring one profile but linking to a result owned by a different profile.
      Implemented as a RLS subquery; cannot use a table CHECK constraint because
      PostgreSQL CHECK constraints do not support subqueries.

  Step 4 — RLS policy update (ai_conversations_update_own):
    DROP POLICY IF EXISTS then CREATE POLICY.
    USING (user_id = auth.uid()) — unchanged.
    WITH CHECK — identical to the new ai_conversations_insert_own WITH CHECK.

  Unchanged policies: ai_conversations_select_own, ai_conversations_delete_own,
    ai_conversations_select_super_admin, ai_conversations_delete_super_admin.
  Unchanged tables/RLS: ai_messages, ai_finder_results, ai_finder_program_matches,
    ai_usage_logs.

  Idempotency: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
    CREATE UNIQUE INDEX IF NOT EXISTS, DROP POLICY IF EXISTS — all safe for
    supabase db reset replay.

---

### Files Modified

docs/09-ai-chat-architecture.md:
  Section 6 "Required Future Migration" retitled and updated to "Schema Foundation —
    Completed in Phase 32". Documents the exact column, FK, indexes, and RLS changes
    applied in migration 016. Documents the cross-field consistency check and why it is
    a RLS subquery rather than a table CHECK constraint. Notes that chat UI/route/API
    remain future work.
  Section 10 (persistence): updated reference from "required migration" to "Phase 32
    migration" and updated unique constraint reference to the partial unique index name.
  Section 16 (future phases): Phase 32 entry updated from planned to complete with
    specific migration and index names listed.

docs/06-status.md:
  Current phase updated from "Phase 32 — TBD" to "Phase 33 — TBD".
  Phase 32 added to phase list.
  Phase 32 completion block added to Last Completed Work section.

docs/07-task-log.md (this file):
  Phase 32 entry appended.

---

### Validation Results

supabase db reset:
  PASS — migrations 001–016 applied successfully.

npm run build:
  PASS (Cloudflare server build, zero errors).

Schema verification:
  ai_conversations.ai_finder_result_id: exists, nullable uuid — PASS.
  FK REFERENCES ai_finder_results(id) ON DELETE CASCADE: present — PASS.
  idx_ai_conversations_finder_result_id: present — PASS.
  idx_ai_conversations_unique_user_finder_result: present,
    partial WHERE ai_finder_result_id IS NOT NULL — PASS.
  ai_conversations_insert_own: includes ai_finder_result_id ownership check
    and cross-field consistency check — PASS.
  ai_conversations_update_own: includes ai_finder_result_id ownership check
    and cross-field consistency check — PASS.

Security greps:
  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts
    → 0 matches — PASS.
  createServiceClient in src/pages,src/components,src/layouts
    → 0 matches — PASS.
  callAI in src/pages,src/components
    → 2 matches only in src/pages/fit-finder/result.astro (unchanged) — PASS.

Route/API absence:
  src/pages/fit-finder/results/[id]/chat.astro → does not exist — PASS.
  src/pages/api/fit-finder → does not exist — PASS.

---

### Explicit Exclusions

No chat UI. No chat route. No chat API endpoint. No AI calls. No callAI.
No getAIEnv. No service_role reference in pages/components/layouts.
No createServiceClient in pages/components/layouts.
No src/lib/ai/* changes. No src/pages/* changes. No src/components/* changes.
No src/layouts/* changes. No package.json changes. No new npm dependencies.
No new migrations beyond 016. No service_role expansion. No admin UI.
No public sharing. No matching algorithm changes. No AI gateway/provider/prompt/
rate-limit/logging changes.

---

### Risks / Deviations

Deviation from Phase 31 plan — unique index form:
  Phase 31 plan mentioned both a table UNIQUE constraint (ADD CONSTRAINT form, noted in
  docs/09-ai-chat-architecture.md) and a partial unique index as the preferred approach.
  Phase 32 implemented the partial unique index form only, as approved. The architecture
  doc Section 6 was updated to reflect the implemented form.

Cross-field consistency check — added per implementation correction:
  Phase 31 plan deferred the cross-field student_profile_id ↔ ai_finder_result_id
  consistency check as optional. The approved implementation scope (Phase 32 correction)
  required it. Both INSERT and UPDATE WITH CHECK include the subquery that verifies
  ai_finder_results.student_profile_id = ai_conversations.student_profile_id when both
  fields are set. Note: this is a RLS subquery, not a table CHECK constraint, because
  PostgreSQL CHECK constraints cannot use subqueries.

No risks or unexpected deviations encountered.

---


## 2026-06-18 - Phase 31: AI Chat Architecture Plan

Tool:
Claude (claude-sonnet-4-6)

Goal:
Design the AI chat architecture before any chatbot implementation. Produce a clear
architecture and implementation plan for a future context-bound AI chat feature.
Docs-only phase — no source code changes, no routes, no migrations, no AI calls.

---

### Files Created

docs/09-ai-chat-architecture.md:

  17-section architecture document for the future AI chat feature.

  Section 1 — Purpose:
    Context-bound AI chat on saved Fit Finder results. User asks follow-up questions
    about the programs already matched in a specific saved result. AI answers from
    saved result context only.

  Section 2 — Non-goals:
    No global chatbot. No anonymous chat. No shared sessions. No AI-driven discovery.
    No streaming. No WebSocket. No React. No RAG/embeddings in MVP.

  Section 3 — Core product rule:
    Database chooses → rules rank → AI explains and answers within approved context.
    Applies to chat exactly as it applies to Finder. Chat AI does not select or rank programs.

  Section 4 — First supported chat surface:
    Future route: /fit-finder/results/[id]/chat. Bound to one ai_finder_results row.
    RLS verifies ownership via student_profiles.user_id = auth.uid().
    Entry point on result detail page only when result_status='complete' + matches exist.

  Section 5 — Current architecture findings:
    callAI already dispatches to buildChatPrompt for sessionType='chat' (gateway.ts:84-86).
    buildChatPrompt too generic — lacks saved-result scope constraints and refusal rules.
    ai_usage_logs.session_type supports 'chat' already.
    checkRateLimit ignores sessionType (_sessionType unused) — counts all types together.
    ai_messages has no browser INSERT policy — service-role-only writes (correct).
    ai_conversations has NO ai_finder_result_id column — critical gap identified.

  Section 6 — Required future migration:
    ADD COLUMN ai_finder_result_id uuid REFERENCES ai_finder_results(id) ON DELETE CASCADE.
    ADD CONSTRAINT uq_ai_conversations_user_result UNIQUE (user_id, ai_finder_result_id).
    UPDATE ai_conversations INSERT + UPDATE RLS WITH CHECK to validate result ownership.
    Migration deferred to a future implementation phase.

  Section 7 — Future route/API architecture:
    Page: src/pages/fit-finder/results/[id]/chat.astro (SSR, noindex).
    POST handler: same-page (consistent with results/index.astro pattern).
    No separate API file. No JSON responses. No streaming. PRG pattern on POST.
    Full POST flow documented: auth gate → UUID validate → load result (RLS) →
    load matches → validate message → load/create conversation → load history →
    build context → callAI → persist → redirect.

  Section 8 — Context construction:
    SSR client (RLS enforced) loads result + matches.
    Context: top 10 matched programs (not all 20), compact per-program shape.
    Per-program: rank, title, university, country/city, tuitionSummary, officialUrl,
      matchReasons, warnings. No internal UUIDs, no raw scores, no secrets.
    Multi-turn: pack last 10 pairs into user prompt field for Gemini MVP.
    Future: upgrade GeminiProvider to use native contents[] multi-turn format.

  Section 9 — Prompt contract:
    Future system prompt for chat-answer.ts. Key rules:
      Only discuss programs in this saved result.
      Refuse questions about programs not in the list.
      Refuse requests to rank new programs.
      Never guarantee admission/scholarship/visa/job outcomes.
      Cite programs by title + university only (never UUID).
      Remind users to verify at official URLs.

  Section 10 — Chat persistence:
    One conversation per (user, ai_finder_result_id) pair.
    ai_conversations INSERT via SSR client (RLS WITH CHECK after migration).
    ai_messages INSERT via service-role client (server-only).
    User message: role='user', content, context_used=null, token counts=0.
    Assistant message: role='assistant', content, context_used=compact snapshot,
      ai_model_used, prompt/completion token counts.
    If callAI returns fallbackUsed=true: no rows written.
    Cascade: parent result delete → conversation delete → message delete.

  Section 11 — context_used decision:
    Store compact public-field snapshot per assistant turn for audit.
    Include: rank, title, university, country/city, tuitionSummary, officialUrl,
      matchReasons, warnings.
    Exclude: internal UUIDs, raw scores, full records, system prompt, service keys.

  Section 12 — Rate limit/logging:
    session_type='chat' used in ai_usage_logs (no code change needed).
    Finder + chat share combined daily user limit in MVP.
    No remaining-count display in chat UI for MVP.
    On limit hit: safe message shown; AI not called; no message rows written.

  Section 13 — Safety layers:
    Layer 1: RLS ownership check (database).
    Layer 2: Context construction allowlist (server).
    Layer 3: Prompt refusal rules (prompt).
    Layer 4: checkInput/checkOutput guardrails (deterministic regex, existing).

  Section 14 — Privacy/data retention:
    ai_messages.content stores question text and AI responses.
    context_used stores compact public snapshot.
    No system prompt text stored.
    Retention: until user deletes or parent result is deleted (CASCADE).
    Privacy page MUST be updated before or with chat launch.

  Section 15 — UX boundaries:
    Chat available: complete results only, logged-in only.
    Scope disclaimer required above input.
    Refusal message for out-of-scope questions.
    No share. No anonymous chat. No UUIDs in UI.

  Section 16 — Future implementation phases:
    Phase 32+: migration (ai_finder_result_id + RLS).
    Phase 33+: prompt hardening (chat-answer.ts update).
    Phase 34+: chat route MVP + privacy page update.
    Phase 35+ (optional): native Gemini multi-turn upgrade.
    Later: per-session-type rate limits, cost estimates, conversation management.

  Section 17 — Test checklist for future implementation:
    Build, security greps, route verification, access control, chat flow,
    rate limit, refusal behavior, privacy, data boundary checks.

---

### Files Modified

docs/06-status.md — Phase 31 completion entry; current phase updated to Phase 32.
docs/07-task-log.md — this entry.

---

### Architecture Decisions

SSR POST handler (same-page) preferred over separate API endpoint for MVP.
  Consistent with existing results pages. No JSON. PRG pattern. No streaming.

One conversation per (user, saved result) via unique constraint after migration.
  Prevents duplicate threads. NULL in ai_finder_result_id exempted by PostgreSQL UNIQUE.

context_used stores compact public snapshot, not full raw records.
  Keeps storage bounded. Excludes internal IDs. Sufficient for audit.

Combined daily rate limit (finder + chat) in MVP.
  Simple. No per-type tracking needed yet. Future env var can split if needed.

Top 10 matched programs in initial context (not all 20).
  Prevents token overflow. Can be raised if testing proves 20 is safe.

Multi-turn packing into user field for Gemini MVP.
  Avoids immediate provider API change. Native multi-turn deferred to later phase.

---

### Key Schema Finding

ai_conversations has NO ai_finder_result_id column (confirmed in migration 012).
A conversation cannot be uniquely linked to one saved ai_finder_results row using
the existing schema. student_profile_id is insufficient (one profile → many results).

---

### Future Migration Requirement

NOT included in Phase 31. Required before any chat implementation:

ALTER TABLE public.ai_conversations
  ADD COLUMN ai_finder_result_id uuid
    REFERENCES public.ai_finder_results(id) ON DELETE CASCADE;

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT uq_ai_conversations_user_result
    UNIQUE (user_id, ai_finder_result_id);

UPDATE ai_conversations INSERT and UPDATE RLS WITH CHECK to validate that a
linked ai_finder_result_id belongs to auth.uid() via the student_profiles join.

---

### Explicit Exclusions

No src/pages route created or modified.
No src/components file created or modified.
No src/layouts file created or modified.
No src/lib/ai/* file created or modified.
No supabase/migrations/* file created or modified.
No callAI call. No getAIEnv call. No createServiceClient in pages/components/layouts.
No service_role reference in pages/components/layouts.
No chat route: src/pages/fit-finder/results/[id]/chat.astro (not created).
No chat API: src/pages/api/fit-finder (not created).
No new npm dependencies. No package.json changes.
No React or client-side JS. No admin UI. No public sharing. No matching changes.
No migrations. No AI provider changes. No guardrail changes.
No prompt changes (chat-answer.ts unchanged).
No rate-limit algorithm changes (limits.ts unchanged).
No persistence changes (persist.ts unchanged).

---

### Build Result

npm run build: PASS (Cloudflare server build, zero errors).

---

### Safety Grep Results

service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts:
  → 0 matches (expected, unchanged from Phase 30).

createServiceClient in src/pages,src/components,src/layouts:
  → 0 matches (expected, unchanged from Phase 30).

callAI in src/pages,src/components:
  → 2 matches, both in src/pages/fit-finder/result.astro
    (import line + invocation line, unchanged from Phase 30).

---

### Route/File Absence Checks

src/pages/fit-finder/results/[id]/chat.astro → False (does not exist, correct).
src/pages/api/fit-finder → False (does not exist, correct).
docs/09-ai-chat-architecture.md → True (created in this phase).

---

### Future Implementation Notes

The architecture document (docs/09-ai-chat-architecture.md) is the authoritative
reference for any future chat implementation. All future chat phases should read
this document before planning.

Key open questions for ChatGPT review (from Phase 31 plan):
  1. ai_conversations.ai_finder_result_id: ON DELETE CASCADE vs SET NULL.
  2. Multi-turn prompt format: pack into user field vs native Gemini contents[] upgrade.
  3. Browser vs service-role ai_conversations INSERT for result-scoped chat.
  4. context_used storage: compact snapshot (chosen) vs program IDs only (rejected).
  5. One conversation per result (chosen) vs new conversation per session (rejected).
  6. Rate limit remaining count: expose in chat UI or suppress in MVP (suppressed).
  7. Privacy page timing: update before chat launch (required, bundled with Phase 34+).


