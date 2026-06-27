# DegreeWiki AI Chat Architecture

Phase 31 — docs-only architecture plan.
No chat routes, API endpoints, AI calls, or schema changes are included in this phase.
This document defines the architecture to be implemented in a future phase.

---

## 1. Purpose

This document defines the architecture for a context-bound AI chat feature on DegreeWiki.
The first supported chat surface is a follow-up chat on a saved Fit Finder result.

The chat allows a logged-in user to ask questions about the programs matched and saved in
a specific Fit Finder result. The AI answers using only the context of that saved result —
it does not search for new programs, re-rank results, or answer broad study-abroad questions.

---

## 2. Non-Goals

- No global "ask anything" chatbot
- No chat widget embedded in public pages
- No anonymous chat
- No shared/public chat sessions
- No AI-driven program discovery (database chooses, rules rank — always)
- No immigration legal advice
- No admission eligibility guarantees
- No scholarship award predictions
- No visa outcome predictions
- No ranking of programs outside the saved result
- No streaming responses in MVP
- No WebSocket
- No React or client-side JS
- No RAG/embeddings (deferred to a later phase if ever needed)

---

## 3. Core Product Rule

This rule applies to every AI feature on DegreeWiki without exception:

1. **Database chooses candidates.** SQL filters on real published rows — the LLM never selects programs.
2. **Rules rank candidates.** Server-side scoring logic, deterministic — the LLM never reorders results.
3. **AI explains and answers only inside approved context.** The LLM receives only pre-fetched,
   RLS-verified database records. It summarises and answers questions about those records.
   It must not invent facts, invent programs, or guarantee outcomes.

For chat:
- The database already chose the programs (when the Fit Finder ran).
- The rules already ranked them (score stored in `ai_finder_program_matches.rank`).
- Chat AI explains and answers questions about those already-chosen, already-ranked programs only.

---

## 4. First Supported Chat Surface

**Future route:** `/fit-finder/results/[id]/chat`

- Bound to one specific saved Fit Finder result (identified by `id` UUID in the route).
- The `id` param maps to an `ai_finder_results` row. RLS verifies ownership via
  `student_profiles.user_id = auth.uid()` before any data or AI call is allowed.
- Chat can only answer using the programs stored in `ai_finder_program_matches` for
  that result and current public program/university fields from the DB.
- Chat cannot answer questions about programs not in the saved result.
- No global chatbot. No "Ask DegreeWiki anything" interface.

**Entry point on the result page:**
A "Ask questions about this result" link or button on `/fit-finder/results/[id]`.
Shown only when `result_status === 'complete'` and the result has at least one matched program.
Not shown for `failed` or `pending` results.

---

## 5. Current Architecture Findings

Inspected in Phase 31 (2026-06-18):

### callAI already supports sessionType='chat'

`src/lib/ai/gateway.ts` already dispatches to `buildChatPrompt` when `request.sessionType === 'chat'`
(gateway.ts line 84–86). This code path is live but never called yet.

`src/lib/ai/types.ts`: `AISessionType = 'finder' | 'chat'` — both values exist.
`AIRequest.conversationId?: string` — already present, unused today.

### buildChatPrompt exists but is too generic for saved-result chat

`src/lib/ai/prompts/chat-answer.ts` builds a prompt from `userMessage` and `AIContext.records`.
The system prompt instructs the model to "answer using only DegreeWiki database context" but:
- Does not scope the conversation to one specific saved result.
- Does not instruct the model to refuse questions about programs outside the context.
- Does not instruct the model to cite programs by title rather than UUID.
- Passes records as raw `JSON.stringify` — may include internal fields.

A future update to `chat-answer.ts` is required for saved-result chat to work safely.

### ai_usage_logs supports session_type='chat'

`supabase/migrations/012_ai_tables.sql`: `ai_usage_logs.session_type CHECK ('finder' | 'chat')`.
`src/lib/ai/usage/logging.ts` already accepts `session_type: 'chat'`.
No changes needed to the logging infrastructure.

### Rate limit counts finder + chat in one user daily bucket

`src/lib/ai/usage/limits.ts`: `_sessionType` parameter is currently ignored.
The daily count query counts ALL session types for the user.
Chat calls will count against the same daily budget as finder calls in MVP.
Separate per-session-type limits are a future enhancement.

### ai_messages exists and is service-role-only for INSERT

`ai_messages` table: authenticated users have SELECT (own conversations) but NO browser INSERT.
All message writes are server-only via service role — correct and consistent with the
finder persistence pattern.

### ai_conversations exists but lacks ai_finder_result_id

`ai_conversations` has `student_profile_id` (optional FK) but NO `ai_finder_result_id` column.
A student profile can have many saved results — `student_profile_id` alone does not
uniquely identify which saved result a conversation is about.

**A future migration is required.** See Section 6.

---

## 6. Schema Foundation — Completed in Phase 32

The schema blocker identified in Phase 31 was resolved in Phase 32 via
`supabase/migrations/016_ai_chat_schema.sql`. The migration is additive and contains
no chat UI, route, API, or AI calls.

### Column added to ai_conversations

```sql
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS ai_finder_result_id uuid
    REFERENCES public.ai_finder_results(id) ON DELETE CASCADE;
```

`ON DELETE CASCADE`: deleting the parent `ai_finder_results` row cascades to the bound
`ai_conversations` row, which cascades further to all `ai_messages` rows via the existing
`ai_conversation_id ON DELETE CASCADE` FK. The chat has no meaning without its result.

The column is **nullable**: existing conversations and future generic chat sessions do not
require a linked saved result.

### Lookup index

```sql
CREATE INDEX IF NOT EXISTS idx_ai_conversations_finder_result_id
  ON public.ai_conversations (ai_finder_result_id);
```

### Partial unique index (one conversation per user + saved result)

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conversations_unique_user_finder_result
  ON public.ai_conversations (user_id, ai_finder_result_id)
  WHERE ai_finder_result_id IS NOT NULL;
```

Enforces one persistent conversation thread per `(user_id, ai_finder_result_id)` pair
when `ai_finder_result_id IS NOT NULL`. NULL rows (generic or anonymous conversations)
are excluded from the uniqueness constraint. The explicit `WHERE` clause makes the intent
unambiguous rather than relying on PostgreSQL's implicit NULL handling in UNIQUE constraints.

### RLS policies updated

`ai_conversations_insert_own` and `ai_conversations_update_own` were dropped and recreated
with three new conditions in the WITH CHECK clause:

**Condition 1 — ai_finder_result_id ownership:**
If `ai_finder_result_id` is set, the referenced `ai_finder_results` row must belong to
`auth.uid()` via `ai_finder_results.student_profile_id → student_profiles.user_id = auth.uid()`.
Prevents linking a conversation to another user's saved result by guessing its UUID.

**Condition 2 — Cross-field consistency:**
If both `student_profile_id` and `ai_finder_result_id` are set, the referenced result's
`student_profile_id` must equal the conversation's `student_profile_id`. Prevents a
conversation from declaring one profile but linking to a result owned by a different profile.
Implemented as a RLS subquery — not a table CHECK constraint because PostgreSQL CHECK
constraints cannot use subqueries.

**Condition 3 — student_profile_id ownership (unchanged from Phase 12):**
If `student_profile_id` is set, it must belong to `auth.uid()` with `is_anonymous = false`.

```sql
-- Applies to both ai_conversations_insert_own and ai_conversations_update_own WITH CHECK:
user_id = auth.uid()
AND (
  student_profile_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.id           = ai_conversations.student_profile_id
      AND sp.user_id      = auth.uid()
      AND sp.is_anonymous = false
  )
)
AND (
  ai_finder_result_id IS NULL
  OR EXISTS (
    SELECT 1
    FROM   public.ai_finder_results afr
    JOIN   public.student_profiles  sp ON sp.id = afr.student_profile_id
    WHERE  afr.id     = ai_conversations.ai_finder_result_id
      AND  sp.user_id = auth.uid()
  )
)
AND (
  student_profile_id IS NULL
  OR ai_finder_result_id IS NULL
  OR EXISTS (
    SELECT 1
    FROM   public.ai_finder_results afr
    WHERE  afr.id                 = ai_conversations.ai_finder_result_id
      AND  afr.student_profile_id = ai_conversations.student_profile_id
  )
)
```

`ai_conversations_select_own`, `ai_conversations_delete_own`, and both super_admin
policies are unchanged. `ai_messages` schema and RLS are unchanged.

**Chat UI, chat route, chat API, and AI calls remain future work.** See Section 16.

---

## 7. Future Route and API Architecture

> **Phase 34 update (2026-06-18):** Phase 34 implemented a JSON API endpoint
> (`src/pages/api/ai/chat.ts`) instead of the same-page POST approach described below.
> The `chat.astro` page route with PRG is deferred to a later phase.
> See Section 16 Phase 34 for the implemented endpoint contract and security design.

### Page route (planned — deferred to Phase 35+)

```
src/pages/fit-finder/results/[id]/chat.astro
```

- SSR, `noindex={true}`, Astro dynamic route
- Param: `id` = UUID of the `ai_finder_results` row
- Uses `PublicLayout`
- Requires authentication (redirect to `/login?redirect=/fit-finder/results/{id}/chat` if not logged in)
- UUID format validated before any DB query

### POST handler strategy — JSON API endpoint (Phase 34, implemented)

Phase 34 implemented `src/pages/api/ai/chat.ts` as a standalone JSON API endpoint
rather than a same-page POST handler. This is more composable: the future `chat.astro`
page can fetch this endpoint and render the response without coupling form submission
to AI execution in one Astro page file.

The same-page POST with PRG redirect (originally described here as preferred for MVP)
is superseded for the API layer. The chat page UI remains deferred to Phase 35+.

**No client-side streaming in MVP.**
**No WebSocket.**
**No React.**
**No open global chat widget.**

### POST flow

```
POST /fit-finder/results/[id]/chat
  ↓ authenticate user → redirect to /login if not
  ↓ validate id as UUID → 404 if invalid
  ↓ load ai_finder_results row via SSR client (RLS: student_profiles.user_id = auth.uid())
    → 404 if not found or not owner
    → 404 if result_status !== 'complete'
  ↓ load ai_finder_program_matches with program join (RLS: owner via parent result)
    → 404 if no matches
  ↓ validate userMessage: non-empty, max 1000 characters, trim
  ↓ load or create ai_conversations row for (user, ai_finder_result_id)
  ↓ load last 10 message pairs (20 rows) from ai_messages for this conversation
  ↓ build AIContext from saved result context (see Section 8)
  ↓ pack prior turns into prompt (see Section 8)
  ↓ callAI({ sessionType: 'chat', userMessage, context, userId, conversationId }, aiEnv)
    ← callAI handles: input guardrails → rate limit → provider → output guardrails → usage log
  ↓ if fallbackUsed=true: show safe error, do not persist
  ↓ persist user message via service client → ai_messages
  ↓ persist assistant message via service client → ai_messages (with context_used snapshot)
  ↓ update ai_conversations.last_message_at via service client
  ↓ redirect (PRG) to GET /fit-finder/results/[id]/chat
```

---

## 8. Context Construction Strategy

### What enters AIContext.records

The server constructs `AIContext` from data loaded via the SSR client (RLS enforced):

```typescript
context = {
  source: 'programs',
  records: topMatchedPrograms,   // top 10 matched programs (see below)
  studentProfile: {
    degreeLevel: result.degreeLevel,
    subjects:        savedProfile.subjects,
    targetCountries: savedProfile.targetCountries,
    budgetMin:       savedProfile.budgetMin,
    budgetMax:       savedProfile.budgetMax,
    currency:        savedProfile.currency,
  }
}
```

### Per-program record shape (selective — internal IDs excluded)

```json
{
  "rank": 1,
  "title": "MSc Computer Science",
  "university": "University of Edinburgh",
  "country": "United Kingdom",
  "city": "Edinburgh",
  "degreeLevel": "Master",
  "subject": "Computer Science",
  "tuitionSummary": "GBP 28,000 per year",
  "officialUrl": "https://...",
  "matchReasons": ["Matches your target degree level: Master", "Preferred subject match"],
  "warnings": ["Admission and language requirements must be verified with the official source"]
}
```

### Fields explicitly excluded from AI context

| Field | Reason |
|---|---|
| `program_id` (UUID) | Internal ID — never sent to LLM |
| `ai_finder_result_id` (UUID) | Internal ID |
| `student_profile_id` (UUID) | Internal ID |
| `user_id` | Never sent outside server boundary |
| Raw `score` numeric | Use rank and match reasons instead |
| `study_mode`, `delivery_mode` raw enums | Include only if non-null and human-readable |
| `ai_model_used`, `prompt_token_count`, `completion_token_count` | Internal operational data |
| SUPABASE_SERVICE_ROLE_KEY or any secret | Never |
| Prompt template text | Never echoed to LLM context |

### Context size limit

Limit initial context to **top 10 matched programs** for MVP. The full 20-program shortlist
risks exceeding safe prompt token budgets and adds little value for typical chat questions.
If future testing shows 20 is consistently safe under token limits, this cap can be raised.

### Multi-turn prompt packing

The Gemini REST API's `contents` array supports multi-turn natively. For MVP, prior turns
are packed into the `user` field in a structured plain-text format:

```
[Prior conversation — last 10 turns]
User: {message1}
Assistant: {response1}
...

[Saved result context]
{JSON program records}

[Current question]
User: {currentMessage}
```

**Turn limit:** Load the last 10 message pairs (20 rows) from `ai_messages` ordered by
`created_at` descending, then reversed for chronological order in prompt.
Older messages are not loaded. No summarization of truncated history in MVP.

**Future improvement:** Upgrade `GeminiProvider.complete()` to accept a `messages` array
and use the Gemini `contents[]` multi-turn format natively. Defer to a later phase.

---

## 9. Prompt Contract

### Future system prompt for saved-result chat (to be implemented in chat-answer.ts)

```
You are a study-abroad assistant for DegreeWiki.
You are answering questions about ONE specific saved Fit Finder result.

CONTEXT RULES:
1. The programs available to you are listed below. These are the ONLY programs you may discuss.
2. If the user asks about any program not in this list, say:
   "I can only answer questions about the programs in this saved Fit Finder result."
3. If the user asks to rank new programs, compare programs outside this list, or find
   better programs, say:
   "Program matching is done by the DegreeWiki database. I can only explain the programs
   already matched in this saved result."

SAFETY RULES:
4. Never invent, guess, or estimate any program name, university name, tuition fee,
   scholarship amount, deadline, admission requirement, visa outcome, or official policy.
5. Never claim or imply guaranteed admission, guaranteed scholarships, or visa approval.
6. Never provide immigration legal advice or financial investment advice.
7. If asked about visa outcomes, admission guarantees, or scholarship eligibility, say:
   "I cannot provide guarantees or official advice. Please verify directly with the
   institution or a qualified advisor."

FORMAT RULES:
8. Refer to programs by their title and university name only. Never reveal internal IDs.
9. When relevant, remind users to verify details at the official program URL listed.
10. Use safe phrasing: "Based on the DegreeWiki data for this result..." or
    "According to the information saved in this result..."
    Never use definitive eligibility claims.
11. If the provided context does not contain enough information to answer, say:
    "I don't have enough information in this saved result to answer that accurately.
    Please verify directly with the institution."
```

**User input** is placed in the user turn only. It must never be interpolated into the system turn.

---

## 10. Chat Persistence Strategy

### One conversation per user + saved result

After the Phase 32 migration added `ai_finder_result_id` to `ai_conversations`, each
(user, saved result) pair has at most one conversation thread (enforced by the partial
unique index `idx_ai_conversations_unique_user_finder_result`).

### Conversation row creation

The SSR client (RLS-authenticated, anon key) can INSERT an `ai_conversations` row when:
- `user_id = auth.uid()`
- `ai_finder_result_id` belongs to a result owned by `auth.uid()` (RLS WITH CHECK)

On the first POST for a result, the server checks for an existing conversation. If none
exists, it inserts one. If the unique constraint fires (race condition), the server reads
the existing row.

### Message rows (service-role-only)

All `ai_messages` writes go through the service-role client (no browser INSERT policy).
The server endpoint:
1. Writes the user message row
2. Calls `callAI`
3. Writes the assistant message row with `context_used` snapshot
4. Updates `ai_conversations.last_message_at`

If `callAI` returns `fallbackUsed=true`, no message rows are written — the user sees
an error and the conversation state is not changed.

**User message row:**
```
role:                   'user'
content:                userMessage (trimmed)
context_used:           null
ai_model_used:          null
prompt_token_count:     0
completion_token_count: 0
```

**Assistant message row:**
```
role:                   'assistant'
content:                aiResponse.text
context_used:           compact snapshot (see Section 11)
ai_model_used:          aiResponse.modelUsed
prompt_token_count:     aiResponse.promptTokens
completion_token_count: aiResponse.completionTokens
```

### Conversation lifecycle

- No automatic expiry for logged-in conversations (`expires_at = null`)
- Deleting the parent `ai_finder_results` row cascades via the future FK
  `ai_conversations.ai_finder_result_id ON DELETE CASCADE`
  → `ai_conversations` row deleted
  → `ai_messages` rows deleted (via existing `ai_conversation_id ON DELETE CASCADE`)
- User can explicitly delete the conversation (future DELETE button on the chat page)
- No raw system prompt text is ever stored

---

## 11. context_used Decision

`ai_messages.context_used` (jsonb) stores a compact snapshot of the public context
supplied to the AI for each assistant turn. This enables future audit and debugging.

### Store (compact snapshot)

```json
[
  {
    "rank": 1,
    "title": "MSc Computer Science",
    "university": "University of Edinburgh",
    "country": "United Kingdom",
    "city": "Edinburgh",
    "tuitionSummary": "GBP 28,000 per year",
    "officialUrl": "https://...",
    "matchReasons": ["..."],
    "warnings": ["..."]
  }
]
```

### Do not store

- Full raw program records from the DB (unnecessary duplication)
- Internal UUIDs (`program_id`, `ai_finder_result_id`, `student_profile_id`)
- Exact raw score numeric values
- System prompt text
- Prior conversation turns (those are in `ai_messages` rows already)
- Service keys, user IDs, emails

This keeps `context_used` small, auditable, and free of internal identifiers.

---

## 12. Rate Limit and Logging Strategy

### Rate limiting

Chat uses `session_type: 'chat'`. The current `checkRateLimit` implementation counts
all session types in one daily bucket per user.

**For MVP:** Chat and Finder calls share the same combined daily limit
(`AI_RATE_LIMIT_USER_DAILY`, default 20). No separate per-session-type limit.

**Future enhancement:** Add `AI_RATE_LIMIT_CHAT_USER_DAILY` env var and a separate
daily count for chat. Requires a code change in `src/lib/ai/usage/limits.ts`.

**No remaining-count display in chat UI for MVP.** The `remaining` value returned by
`checkRateLimit` is not exposed to the browser.

When the rate limit is hit, `callAI` returns `fallbackUsed: true`. The chat page should
show a safe user-facing message: "You have reached today's AI usage limit. Please try
again tomorrow. Your saved result and program matches are still available."

### Usage logging

`writeUsageLog` (inside `callAI`, fire-and-forget) logs:
```
user_id:           auth user UUID
session_type:      'chat'
tokens_used:       promptTokens + completionTokens
model_used:        provider model string
cost_estimate_usd: null (deferred)
```

Never logged: prompt text, AI response text, question content, conversation ID,
program IDs, or any context record content.

---

## 13. Safety Layers

Chat has four independent safety layers. All four must pass on every turn.

### Layer 1 — RLS ownership check (database)

The server cannot load the saved result or program matches unless the SSR client's
session proves `student_profiles.user_id = auth.uid()`. A user cannot chat about
another user's saved result — the query returns no data, and the server returns 404.

### Layer 2 — Context construction allowlist (server)

The server builds `AIContext` from an explicit allowlist of fields. Internal UUIDs,
raw scores, service keys, profile IDs, and model internals are never included.
The LLM can only see what the server explicitly passes.

### Layer 3 — Prompt refusal rules (prompt)

The system prompt (see Section 9) instructs the model to refuse:
- Questions about programs not in the saved result
- Requests to rank or discover new programs
- Admission/visa/scholarship guarantees
- Out-of-scope legal or financial advice

This is not foolproof (prompt injection is possible) but provides a strong first line.

### Layer 4 — Input and output guardrails (deterministic)

`checkInput(userMessage)` — existing patterns: blocks fraud, forgery, ghostwriting.
`checkOutput(text)` — existing patterns: blocks guaranteed admission/scholarship/visa language.
No changes to `guardrails.ts` needed for MVP. Chat-specific output patterns can be added
in a future hardening phase.

### What chat must never produce

- "You are guaranteed admission to..."
- "You will receive the scholarship"
- "Your visa will be approved"
- Any invented program name or tuition figure not in the saved result
- Any internal UUID, model name, token count, or system prompt excerpt

---

## 14. Privacy and Data Retention

### What is stored

- `ai_conversations`: session metadata (user_id, finder_result_id, session_type, timestamps)
- `ai_messages.content`: actual question text and AI response text — this IS stored
- `ai_messages.context_used`: compact public-field snapshot of context used for that turn
- `ai_usage_logs`: token counts, model, session type — no message content

### What is NOT stored

- System prompt template text
- Internal UUIDs from context records
- User email, session token
- Student profile fields beyond the student profile summary
- Raw score values

### Retention

- Chat history persists until the user deletes it or the parent saved result is deleted
- No automatic expiry for logged-in conversations
- Deleting the parent `ai_finder_results` row cascades to the conversation and all messages

### Privacy page requirement

The existing `/privacy` page now covers stored chat sessions and message content for
saved-result AI chat and future AI chat surfaces.

---

## 15. UX Boundaries

### When chat is available

- Only on `result_status === 'complete'` saved results with at least one matched program
- Only for logged-in users
- Not available for `failed` or `pending` results

### Scope disclaimer (required above input)

> "This chat is scoped to the programs in this saved result. Ask questions about these
> programs — I cannot search for new programs or advise on admission decisions."

### What the chat can help with

- Questions about specific programs in the saved result (tuition, location, degree level)
- Clarification on match reasons or warnings for a listed program
- Explaining what a match reason or field value means
- Pointing to official URLs already in the result data
- General context about study modes, delivery formats listed for these programs

### What the chat explicitly refuses (with safe fallback message)

- Questions about programs not in this saved result
- Requests to find better programs or re-rank results
- Admission eligibility assessments
- Visa approval predictions
- Scholarship award predictions
- Medical, legal, or financial advice
- Immigration law beyond general disclaimers

### Refusal message

> "I can only answer questions about the programs in this saved Fit Finder result.
> For broader program discovery, use the Fit Finder or browse all programs."

### Other UX constraints

- Programs are referenced by title and university name only — never by UUID
- AI model name, token counts, and internal IDs are never shown to the user
- No "share conversation" feature
- No anonymous chat
- No chat on the `/fit-finder/results` list page — only on individual result detail

---

## 16. Future Implementation Phases

These phases are not scheduled. They follow from this architecture document.

### Phase 32 — AI Chat Schema Foundation (complete)

- `supabase/migrations/016_ai_chat_schema.sql` applied.
- Added `ai_finder_result_id uuid` (nullable) to `ai_conversations`, FK ON DELETE CASCADE.
- Added lookup index `idx_ai_conversations_finder_result_id`.
- Added partial unique index `idx_ai_conversations_unique_user_finder_result`
  on `(user_id, ai_finder_result_id) WHERE ai_finder_result_id IS NOT NULL`.
- Updated INSERT/UPDATE RLS WITH CHECK on `ai_conversations`:
  ai_finder_result_id ownership validation via student_profiles join chain.
  Cross-field consistency check when both student_profile_id and ai_finder_result_id are set.
- No chat UI, no chat route, no API endpoint, no AI calls, no src/ changes.

### Phase 33 — Context-Bound Chat Prompt + Server Helper Foundation (complete)

Server-only helper and prompt hardening phase. No chat route, no API endpoint, no chat UI,
no live user-facing chat, no migrations, no new dependencies.

#### Helper boundary

**`src/lib/ai/chat/context.ts`** — RLS-scoped context loader (no service role).
- `loadChatContext(resultId, supabase): Promise<ChatResultContext | null>`
- Accepts the caller's authenticated SSR Supabase client; RLS enforces ownership.
- Returns null if result is not found, not owned by the user, or `result_status !== 'complete'`.
- Limits to top 10 matched programs (`MAX_PROGRAMS_IN_CONTEXT`).
- Builds `ChatResultProgram[]` from an explicit allowlist: rank, title, university, country,
  city, degreeLevel, subject, tuitionSummary, officialUrl, matchReasons, warnings.
- Internal UUIDs (program_id, ai_finder_result_id, student_profile_id, score) are excluded.
- The Phase 34 route calls this function before building AIContext and calling callAI().

**`src/lib/ai/chat/persist.ts`** — service-role message persistence helper.
- `getOrCreateConversation(params, env): Promise<string | null>`
  Finds or creates the one `ai_conversations` row for `(userId, finderResultId)`.
  Handles unique-constraint race via retry-SELECT on error code `23505`.
- `persistChatTurn(params, env): Promise<boolean>`
  Inserts user message row, then assistant message row with `context_used` snapshot,
  then updates `ai_conversations.last_message_at` (best-effort).
  Returns false if either message INSERT fails.
  Must only be called when `callAI()` returned `fallbackUsed: false`.
- Confirmed exact column names from migration 012/016:
  `ai_conversation_id` (FK), `role`, `content`, `context_used`, `ai_model_used`,
  `prompt_token_count`, `completion_token_count`.
  `ai_conversations.session_type` CHECK `('finder'|'chat')` — uses `'chat'`.
  `ai_conversations.last_message_at` — updated after each turn.

#### Type additions (`src/lib/ai/types.ts`)

- `ChatResultProgram` — LLM-facing compact program shape (no internal UUIDs).
- `ChatResultContext` — server-side context for one saved-result chat session.
  Contains `resultId` (server-only, never sent to LLM) and `programs: ChatResultProgram[]`.
- `ContextUsedSnapshot` — audit record stored in `ai_messages.context_used` (jsonb).
  Contains: `chatMode`, `promptTemplateVersion`, `safetyPolicyVersion`,
  `aiFinderResultId`, `conversationId`, `programsUsed` (rank/title/university),
  `warningsIncluded`, `missingTuitionCount`.
  Internal IDs appear here for DB-side audit only — never in the LLM prompt.
- `AIRequest.chatMode?: 'saved_result'` — signals saved-result mode to the gateway.

#### Prompt hardening (`src/lib/ai/prompts/chat-answer.ts`)

- `buildChatPrompt(userMessage, context, chatMode?)` — backward-compatible.
- `chatMode === 'saved_result'`: uses 12-rule `SAVED_RESULT_SYSTEM_PROMPT`.
  Program context formatted as human-readable structured block (not raw JSON)
  to prevent internal field leakage and improve model readability.
  Rule 12 explicitly instructs the model to decline prompt injection attempts.
- `chatMode` undefined: preserves original generic behavior.
- User input placed only in the user turn — never interpolated into system prompt.
- Exports `CHAT_SAVED_RESULT_PROMPT_VERSION = 'chat-saved-result-v1'` for audit.

#### Gateway wiring (`src/lib/ai/gateway.ts`)

One-line change: passes `request.chatMode` to `buildChatPrompt` in the chat branch.

#### Guardrail hardening (`src/lib/ai/safety/guardrails.ts`)

Input patterns added (checked before any LLM call):
- `ignore (all) (previous|prior|your) (instructions|rules|context|guidelines|constraints)`
- `disregard (all) (previous|prior|your) (instructions|rules|context|guidelines|constraints)`

Output patterns added (checked after LLM response):
- `you will (receive|get|be awarded) the scholarship`
- `i can confirm (your) (eligibility|admission|acceptance)`

Exports `GUARDRAILS_VERSION = 'guardrails-v2'` for audit.

#### `result_status` confirmed

Value `'complete'` confirmed from migration 012 and existing page code.
CHECK constraint: `('pending', 'complete', 'failed')`. Used exactly as `'complete'`.

#### Files created (2)

- `src/lib/ai/chat/context.ts`
- `src/lib/ai/chat/persist.ts`

#### Files modified (5)

- `src/lib/ai/types.ts` — new types + `chatMode` on `AIRequest`
- `src/lib/ai/gateway.ts` — pass `chatMode` to `buildChatPrompt`
- `src/lib/ai/prompts/chat-answer.ts` — hardened saved-result prompt
- `src/lib/ai/safety/guardrails.ts` — new input + output patterns
- `src/lib/supabase/service.ts` — comment updated to reflect approved scope

#### Explicit exclusions

No chat route. No API endpoint. No chat UI. No live AI chat calls.
No callAI caller beyond existing fit-finder/result.astro.
No service_role in pages/components/layouts.
No createServiceClient in pages/components/layouts.
No migrations. No new npm dependencies. No React. No client-side JS.
No changes to providers, env.ts, logging.ts, limits.ts, finder/persist.ts.
No changes to any src/pages/* or src/components/* or src/layouts/* files.

### Phase 34 — Saved Result Chat API Endpoint Foundation (complete)

JSON API endpoint for saved-result-bound AI chat. No chat UI, no chat page, no migrations,
no new dependencies, no service-key expansion in pages/components/layouts.

#### Files created (1)

- `src/pages/api/ai/chat.ts` — authenticated POST handler for `/api/ai/chat`

#### Files modified (1 in src)

- `src/lib/ai/usage/limits.ts` — added `checkAIRateLimit(userId, sessionType, env)`
  wrapper that encapsulates service-client creation from `AIRuntimeEnv` internally.
  API routes call this helper rather than reading service-role secrets directly.

#### Endpoint contract

```
POST /api/ai/chat
Content-Type: application/json
{ "ai_finder_result_id": "uuid", "message": "user question (1–1000 chars)" }
```

Success (HTTP 200):
```json
{ "ok": true, "answer": "assistant text", "conversation_id": "uuid" }
```

Errors: 400 (invalid_body, invalid_request, invalid_message, message_rejected),
401 (unauthenticated), 404 (not_found), 429 (rate_limit_exceeded),
503 (ai_unavailable), 500 (internal_error).

Never returned: user_id, student_profile_id, ai_finder_result_id, model name,
token counts, prompt text, or raw provider error details.

#### Endpoint flow

1. Parse JSON body — 400 on failure.
2. Validate `ai_finder_result_id` (UUID regex) and `message` (1–1000 chars trimmed).
3. `createClient(cookies, request)` → `getUser()` — 401 if no user.
4. `getAIEnv(locals)` to extract Cloudflare Worker bindings.
5. `checkAIRateLimit(user.id, 'chat', aiEnv)` — 429 on limit_exceeded; 503 on unavailable.
6. `loadChatContext(resultId, supabase)` — RLS-scoped, no privileged access. 404 if null.
7. `getOrCreateConversation({ userId, finderResultId }, aiEnv)` — 500 if null.
8. Build `AIContext` from `chatContext.programs` (allowlisted public fields only, no UUIDs).
9. `callAI({ sessionType: 'chat', chatMode: 'saved_result', ... }, aiEnv)`.
10. `guardrailTripped` → 400 message_rejected with safe answer text.
11. `fallbackUsed` → 503 ai_unavailable.
12. Build `ContextUsedSnapshot` audit record.
13. `persistChatTurn(...)` — failure logged server-side; answer still returned (200).
14. Return `{ ok: true, answer, conversation_id }`.

#### Security boundary

- Authenticated: `getUser()` before any data or AI operation.
- Context loaded via RLS: `loadChatContext` uses SSR client — no privileged access.
- No client-controlled program IDs: programs come only from `loadChatContext`.
- Only `conversation_id` in response — no internal UUIDs or model internals.
- No raw AI provider errors: all failures return structured safe responses.
- Input guardrail and system prompt rule 12 handle prompt injection attempts.
- `src/pages/api/ai/chat.ts` contains no service-key strings and no privileged imports.
  All service-role operations remain inside `src/lib/` as before.

#### Rate limiting approach

- `checkAIRateLimit` pre-checks before context load → clean 429/503 HTTP status.
- `callAI` also checks internally (idempotent, fail-closed double-check).
- Chat and finder share the same combined `AI_RATE_LIMIT_USER_DAILY` daily limit.
- Limitation: a concurrent race at the rate limit boundary may return 503 instead of
  429 (rate limit hit after pre-check passed but before callAI runs). Acceptable for MVP.

#### Persistence degradation

- `getOrCreateConversation` null → 500, no AI call.
- AI fallback → no persistChatTurn call.
- `persistChatTurn` returns false → server-side log only; answer still returned (200).
- Usage logging inside `callAI` is fire-and-forget; failure silently ignored.

### Phase 35 — Saved Result Chat UI Foundation (complete)

Minimal client-side chat UI embedded on the saved result detail page. No new route,
no streaming, no chat history loading, no migrations, no new dependencies, no React.

#### Files created (1)

- `src/components/ai/SavedResultChat.astro` — Astro component. Props: `resultId: string`.
  Renders: "Ask about this result" heading, scope disclaimer, transcript area (initially
  hidden), error/status area (initially hidden), labeled textarea, submit button.
  Inline script via `define:vars={{ resultId }}`:
    - Reads trimmed message from textarea.
    - Blocks empty and >1000 char messages client-side.
    - Disables button and shows "Asking..." while in flight.
    - POST to `/api/ai/chat` with `{ ai_finder_result_id: resultId, message }`.
    - On `ok: true`: appends user + assistant turns to transcript using DOM text nodes.
    - On error: maps `data.error` to a safe user-facing string; shows in status area.
    - Clears textarea on successful send. Re-enables button in `finally`.
    - No `innerHTML`. No `set:html`. No React. No external dependencies.

#### Files modified (1 in src)

- `src/pages/fit-finder/results/[id].astro` — imports `SavedResultChat`; mounts it below
  the match list, conditionally: `result.result_status === 'complete' && matches.length > 0`.

#### Error mapping (data.error)

| `data.error` | User-facing message |
|---|---|
| `invalid_message` | "Please enter a valid question between 1 and 1000 characters." |
| `message_rejected` | `data.answer` if present, else safe generic rejection |
| `unauthenticated` | "Please sign in again to continue." |
| `not_found` | "This result is not available. It may have been deleted or is no longer accessible." |
| `rate_limit_exceeded` | "You've reached today's AI usage limit. Please try again tomorrow." |
| `ai_unavailable` | "AI is temporarily unavailable. Please try again in a few minutes." |
| `internal_error` | "Something went wrong. Please try again." |
| (any other) | "Something went wrong. Please try again." |

#### Safety boundary

- Client sends only `ai_finder_result_id` (server-embedded UUID) and `message` (user text).
- No program IDs, user IDs, or context records in page HTML.
- No model name, token counts, or system prompt text exposed.
- No `service_role`, `createServiceClient`, or `callAI` in component or `[id].astro`.
- Transcript uses DOM `textContent` — no HTML injection possible.
- Scope disclaimer rendered on every page load above the input.

#### Session and history

- Transcript is in-memory only (page session). Cleared on reload.
- No chat history loading in this phase.
- Server persists messages via Phase 34 endpoint as before.

### Phase 36 — Saved Result Chat Completion Bundle (complete)

History loading, UX polish, and clear/reset support. No schema changes, no new dependencies,
no service role in pages/components/layouts.

#### Files created (1)

- `src/pages/api/ai/chat-clear.ts` — authenticated POST endpoint for `/api/ai/chat-clear`.
  Body: `{ ai_finder_result_id: uuid }`.
  Uses SSR Supabase client only (no service role).
  Verifies result ownership via RLS before deleting.
  Deletes `ai_conversations` row; `ai_messages` cascade via FK ON DELETE CASCADE.
  Returns `{ ok: true }` when no conversation exists (no-op success).

#### Files modified (3 in src)

- `src/pages/fit-finder/results/[id].astro` — after existing DB queries, loads
  `ai_conversations` by `ai_finder_result_id` and `ai_messages` (role, content, created_at ASC,
  limit 40) via SSR client (RLS-scoped). Passes `initialMessages` to `SavedResultChat`.

- `src/components/ai/SavedResultChat.astro` — new `initialMessages` prop; prior messages
  rendered server-side via Astro text interpolation (no innerHTML, no set:html).
  Empty state with 4 static suggested questions (fills textarea on click, no auto-submit).
  Clear chat button (hidden until messages exist, disabled during any pending fetch).
  Scrolls to last message on initial load; scrolls new turns into view after append.
  Client clear flow: POST `/api/ai/chat-clear`, then `replaceChildren()` to reset DOM.

#### Clear/reset endpoint security boundary

- No service role: SSR client handles both the ownership check and the delete.
- Ownership is double-enforced: explicit RLS on `ai_finder_results` SELECT, then
  `user_id = auth.uid()` filter on the DELETE (consistent with RLS delete policy).
- Missing conversation is a no-op success — idempotent.
- No internal UUIDs returned. No model names or token counts.

### Phase 37 — AI Chat Routing + Static Response Bundle (complete)

Lightweight deterministic routing layer inserted before `/api/ai/chat` calls the AI provider.
Obvious low-value messages are handled with static responses, which are still persisted to
chat history so reloads show the full conversation. No schema changes, no new dependencies,
no UI changes, no service role in pages/components/layouts.

#### Router (`src/lib/ai/chat/router.ts`)

New helper exports:
- `StaticCategory`: `'greeting' | 'thanks' | 'help' | 'guarantee' | 'out_of_scope'`
- `ChatRouteDecision`: `{ route: 'static'; category: StaticCategory } | { route: 'llm' }`
- `STATIC_RESPONSES`: Record mapping each `StaticCategory` to its bounded, non-guarantee response text
- `routeChatMessage(message: string): ChatRouteDecision`

Decision order (deterministic, case-insensitive):
1. `greeting` — standalone `hi`/`hello`/`hey` only
2. `thanks` — standalone `thanks`/`thank you`/etc only
3. `help` — "what can you do", "how can you help", "what can I ask you"
4. `guarantee` — outcome certainty requests; requires admission/visa/scholarship term alongside guarantee wording
5. `out_of_scope` — new program searches (requires search verb or outside/beyond qualifier); off-topic requests (jokes, coding, medical/investment advice); prompt-override attempts not caught by existing input guardrails
6. `llm` — all other messages (normal saved-result follow-up questions)

Pattern safety:
- Guarantee regex requires explicit terms (`admission`, `visa`, `scholarship`) — "will I get a response?" does not match.
- New-program regex requires a search/find verb or explicit "outside/beyond" qualifier — "which program should I choose?" and "tell me more about these programs" do not match and go to LLM.

#### Static turn persistence (`src/lib/ai/chat/persist.ts`)

New `PersistStaticTurnParams` interface and `persistStaticTurn(params, env)` helper:
- Inserts user message row (`role = 'user'`, zero tokens, no model)
- Inserts assistant message row (`ai_model_used = 'static'`, zero tokens, `context_used` snapshot)
- Updates `ai_conversations.last_message_at` (best-effort)
- Minimal `context_used` snapshot: `promptTemplateVersion = 'static-v1'`, `programsUsed = []`,
  `warningsIncluded = false`, `missingTuitionCount = 0`, current `GUARDRAILS_VERSION`
- Does **not** write to `ai_usage_logs` — no provider was called
- Fail-safe: returns `false` on any DB error, never throws

#### Endpoint integration (`src/pages/api/ai/chat.ts`)

Updated `POST /api/ai/chat` flow:

```
parse request
validate message + result_id (unchanged)
auth user (unchanged)
routeChatMessage(message)

if static:
  verify ai_finder_result ownership via SSR/RLS (.select('id') .maybeSingle())
  → 404 if not found or not owned
  getOrCreateConversation
  → 500 if null
  persistStaticTurn (fail-safe; 200 returned regardless)
  return { ok: true, answer: STATIC_RESPONSES[category], conversation_id }

if llm:
  checkAIRateLimit (unchanged)
  loadChatContext (unchanged — also verifies ownership + result_status)
  getOrCreateConversation (unchanged)
  callAI (unchanged)
  guardrailTripped → 400 message_rejected (unchanged)
  fallbackUsed → 503 ai_unavailable (unchanged)
  persistChatTurn (unchanged)
  return { ok: true, answer, conversation_id } (unchanged)
```

Static path skips: rate-limit check, full context load, AI provider call, usage logging.
Rate limit is intentionally skipped for static turns — they are cheap and provider-free.
Ownership is verified separately (SSR/RLS `.select('id')`) before `getOrCreateConversation`.

### Phase 69B — DB-Backed AI Gateway Foundation (complete)

The saved-result chat LLM path now routes through the shared AI gateway foundation used by
Fit Finder summaries.

What changed:
- `callAI()` still handles input guardrails and DegreeWiki quota checks first.
- The LLM path now runs through DB-backed provider/model routing with `use_case = 'chat_answer'`.
- Every provider attempt is logged to `ai_gateway_call_logs`.
- Repeated recoverable provider failures update `ai_provider_health` and can trigger cooldown.
- Env fallback remains available when `AI_GATEWAY_ENV_FALLBACK_ENABLED=true`.

What did not change:
- Static saved-result chat responses still do not call AI.
- Chat remains bound to `ai_finder_result_id`.
- Prompt context remains limited to saved-result programs only.
- `ai_usage_logs` remains the quota ledger.
- The `/api/ai/chat` response contract is unchanged.

### Phase 69C — Admin AI Gateway Dashboard (complete)

Phase 69C adds the admin management and test surface for the shared AI gateway:
- `/admin/ai-gateway`
- admin-only API endpoints under `src/pages/api/admin/ai-gateway/`

What this phase adds:
- provider account management for DB-backed `openai_compatible` providers
- model management
- routing policy management
- provider/model health visibility and reset
- preset-only admin provider/model tests

What this phase does not change:
- no public chatbot expansion
- no new public chat route
- no change to `/api/ai/chat` request/response contract
- no DB-managed Gemini/OpenRouter provider accounts yet

Gemini and OpenRouter remain env-fallback only in this phase.

#### Files created (1)

- `src/lib/ai/chat/router.ts`

#### Files modified (2 in src)

- `src/lib/ai/chat/persist.ts` — added `PersistStaticTurnParams`, `persistStaticTurn`
- `src/pages/api/ai/chat.ts` — imported and wired `routeChatMessage`, `STATIC_RESPONSES`, `persistStaticTurn`

#### Explicit exclusions

No schema changes. No UI changes. No new npm dependencies. No React. No streaming.
No service_role in pages/components/layouts. No createServiceClient in pages/components/layouts.
No callAI in UI or page components. No ai_usage_logs writes for static turns.
No program-page AI. No scholarship-page AI. No RAG/vector search.

### Phase 38 — Program + Scholarship Advisor Boundaries (docs-only)

Boundary planning for two future AI advisor surfaces. No implementation in this phase.
No src changes, no migrations, no API routes, no UI, no prompt changes, no dependencies.

See Section 18 for the full boundary specification.

### Phase 39 (optional) — Provider native multi-turn upgrade

- Update `GeminiProvider.complete()` to accept `messages: Array<{role, content}>` and
  use Gemini's `contents[]` multi-turn format natively
- Refactor multi-turn packing out of the prompt layer

### Later phases (deferred)

- Per-session-type rate limits (`AI_RATE_LIMIT_CHAT_USER_DAILY`)
- Cost estimate map for `cost_estimate_usd`
- Conversation management on the account page
- Conversation delete button on the chat page
- Program Page AI Advisor (requires schema migration + new prompt template + new API endpoint)
- Scholarship Page AI Advisor (requires schema migration + new prompt template + new API endpoint)

---

## 17. Test Checklist for Future Implementation

Run after implementing the chat route. All checks must pass before merging.

### Build

- [ ] `npm run build` passes with zero errors (Cloudflare server build)

### Security greps

```powershell
# Must return 0 matches
Get-ChildItem -Path src/pages,src/components,src/layouts -Recurse -File |
  Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE"

# Must return 0 matches
Get-ChildItem -Path src/pages,src/components,src/layouts -Recurse -File |
  Select-String -Pattern "createServiceClient"

# callAI must only appear in approved server pages (fit-finder/result.astro + new chat.astro)
Get-ChildItem -Path src/pages,src/components -Recurse -File |
  Select-String -Pattern "callAI"

# No PUBLIC_ on service keys
Get-ChildItem -Path src -Recurse -File |
  Select-String -Pattern "PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE"
```

### Route verification

- [ ] `src/pages/fit-finder/results/[id]/chat.astro` exists
- [ ] No global chat route at `src/pages/chat.astro`
- [ ] No open AI endpoint at `src/pages/api/chat.ts`

### Access control

- [ ] Anonymous GET `/fit-finder/results/{id}/chat` → redirect to `/login?redirect=...`
- [ ] Logged-in GET with another user's result UUID → 404 (no data leaked)
- [ ] Logged-in GET with invalid UUID → 404
- [ ] Logged-in GET for `result_status !== 'complete'` → 404 or redirect to result page

### Chat flow

- [ ] First message on a fresh result → `ai_conversations` row created with correct `ai_finder_result_id`
- [ ] User message persisted in `ai_messages` with `role = 'user'`
- [ ] Assistant message persisted in `ai_messages` with `role = 'assistant'`
- [ ] `ai_conversations.last_message_at` updated after each turn
- [ ] `ai_usage_logs` has new row with `session_type = 'chat'` and `tokens_used > 0`
- [ ] Duplicate submission (page refresh on POST) → PRG redirect prevents double insert

### Rate limit

- [ ] After hitting daily limit, chat shows safe message; no AI call made
- [ ] Rule-based result detail page unaffected when chat rate limit is hit

### Refusal behavior

- [ ] Asking about a program not in the result → safe refusal message
- [ ] Asking for guaranteed admission → safe refusal (output guardrail or prompt refusal)
- [ ] Asking for visa advice → safe refusal message

### Privacy

- [ ] `src/pages/privacy.astro` updated to mention stored chat sessions
- [ ] Chat session delete removes rows from `ai_messages` (CASCADE)
- [ ] Parent result delete cascades to conversation (CASCADE via FK)

### Data boundary

- [ ] No internal UUID visible in rendered HTML or AI responses
- [ ] No model name, token count, or system prompt text shown to user
- [ ] `context_used` in `ai_messages` contains only compact public fields (verified in DB)

---

## 18. Phase 38 — Program + Scholarship Advisor Boundary Specification

Documented in Phase 38 (2026-06-19). Docs only — no implementation included.

This section defines the safe product boundaries for two future AI advisor surfaces:
the Program Page AI Advisor and the Scholarship Page AI Advisor. Neither is built yet.
Both must satisfy the core product rule in Section 3 without exception.

---

### 18.1 Program Page AI Advisor

#### Allowed answers

- Questions about the specific program on the page: degree level, subject, tuition summary,
  location, city, study mode, delivery mode, intake dates — using only fields already stored
  in that program's DB row.
- What a field value means (e.g. what "full-time" means, what a degree level label means).
- Where to find official information — the `official_url` field only.
- If the user is logged in and has a saved Fit Finder result that includes this program:
  the advisor may surface relevant match reasons and warnings from that result as additional
  context. This is enrichment only — it does not re-run the finder, re-score, or re-rank.

#### Context the advisor may use

- The single program row (allowlisted public fields only; no internal UUIDs in the LLM prompt).
- The linked university row (name, country, city).
- The linked subject and degree level.
- Optionally, match reasons and warnings from a relevant saved Fit Finder result (if the user
  is logged in and such a result exists). These are passed as pre-fetched DB values, not derived
  by the LLM.

Fields excluded from LLM context (same exclusion rule as saved-result chat):
internal UUIDs, raw scores, service keys, profile IDs, model internals, system prompt text.

#### Login requirement

Logged-in users only for profile-personalised commentary (e.g. "how does this fit my profile").
Future anonymous users may be allowed to ask basic factual questions about a program, but
implementation should include abuse controls and rate limits. This is not implemented in Phase 38.

#### Student Profile requirement

Not required. The advisor works on program data alone.
If the user has no profile and asks a personalised question, the advisor responds:
"Run Fit Finder first to get a personalised comparison."

#### Conversation anchor (future schema requirement)

Conversations must be bound to `program_id`, not to `ai_finder_result_id`.
A future migration must add `program_id uuid` (nullable, FK to `programs`) to `ai_conversations`,
with a partial unique index on `(user_id, program_id) WHERE program_id IS NOT NULL`.

Do not reuse saved-result chat by stuffing program context into `ai_finder_result_id`.
That would corrupt the conversation anchor semantics and break cascade logic.

#### What the advisor must refuse

- Admission eligibility predictions ("Will I get in?", "Am I eligible?").
- Visa outcome predictions.
- Scholarship award predictions.
- Claims about tuition, deadlines, or requirements not present in the DB row.
- Comparisons to programs not in DegreeWiki data.
- Rankings against external universities or programs.
- Any invented fact not traceable to a DB field passed in context.

#### When data is missing or unverified

- If a requested field is null in the DB: "This detail is not currently available in
  DegreeWiki's data. Please verify directly at the official program page."
- No advisor may claim data is verified or current until `verified_at`, `source_confidence`,
  or equivalent source/verification fields exist on the program row. Those fields do not exist
  yet. Until they do, the advisor must not imply its data is authoritative or up to date.

---

### 18.2 Scholarship Page AI Advisor

#### Allowed answers

- Questions about the specific scholarship on the page: amount range, currency, eligibility
  summary, application deadline — using only fields stored in the DB for that scholarship row.
- Which degree levels, subjects, countries, or universities the scholarship is associated with,
  via junction table data (once those tables are populated — currently deferred from Phase 07).
- Where to find the official application — the `official_url` field only.
- If the user is logged in and has a student profile: whether the scholarship's
  `eligibility_summary` appears relevant to their profile fields (nationality, degree level,
  subject). This is a soft, non-binding commentary — not an eligibility determination.

#### Context the advisor may use

- The single scholarship row (allowlisted public fields only; no internal UUIDs in the LLM prompt).
- Associated junction data (subject, university, country, degree level) — once populated.
- If the user is logged in: relevant student profile fields (degree level, subject, nationality)
  for soft relevance commentary only.

#### Login requirement

Logged-in users only for profile-based relevance commentary.
Future anonymous users may be allowed to ask basic factual questions about a scholarship, but
implementation should include abuse controls and rate limits. This is not implemented in Phase 38.

#### Student Profile requirement

Not required. Works on scholarship data alone.
Profile-based relevance commentary requires a logged-in user with a saved profile.

#### Conversation anchor (future schema requirement)

Conversations must be bound to `scholarship_id`, not to `ai_finder_result_id`.
A future migration must add `scholarship_id uuid` (nullable, FK to `scholarships`) to
`ai_conversations`, with a partial unique index on
`(user_id, scholarship_id) WHERE scholarship_id IS NOT NULL`.

Do not reuse saved-result chat by stuffing scholarship context into `ai_finder_result_id`.
That would corrupt the conversation anchor semantics and break cascade logic.

#### What the advisor must refuse

- "Will I receive this scholarship?" — never.
- Eligibility guarantees or definitive eligibility determinations.
- Award predictions based on GPA, nationality, or any other criterion.
- Claims about amounts, deadlines, or requirements not in the DB row.
- Advice about how to write winning applications beyond directing to official guidance.
- Any invented fact not traceable to a DB field passed in context.

#### When eligibility data is missing or unverified

- If `eligibility_summary` is null or junction tables are empty: "Detailed eligibility
  information is not yet available in DegreeWiki. Please verify directly at [official_url]."
- No advisor may claim scholarship data is verified or current until source/verification
  fields exist on the scholarship row. Until they do, the advisor must not imply its data
  is authoritative or up to date.

---

### 18.3 Shared AI Safety Rules (both advisors)

These apply without exception to both the Program Page AI Advisor and the
Scholarship Page AI Advisor, identical to existing saved-result chat safety rules.

- No admission guarantees.
- No visa guarantees.
- No scholarship award guarantees.
- No official, legal, or immigration advice.
- No invented facts — every claim must trace to a DB field passed in context.
- No searching outside DegreeWiki data. No web browsing. No external lookups.
- Always direct users to verify important details with official sources.
- `checkInput()` (existing guardrail) applies before any LLM call.
- `checkOutput()` (existing guardrail) applies before returning any LLM response.
- System prompt must scope the LLM to the specific program or scholarship context,
  analogous to the 12-rule `SAVED_RESULT_SYSTEM_PROMPT` in `chat-answer.ts`.
- Static routing (analogous to `routeChatMessage` in `router.ts`) must be extended or
  replicated to handle greetings, thanks, guarantee requests, and out-of-scope messages
  on the new surfaces before any LLM call is made.
- User input placed only in the user turn — never interpolated into the system prompt.

Safe wording required:
- "Based on the DegreeWiki data for this program/scholarship..."
- "Please verify this detail at the official source before making any decisions."

Prohibited wording:
- "You will be admitted."
- "You are eligible for this scholarship."
- "Your visa will be approved."
- Any language implying certainty of outcome.

---

### 18.4 Required Future Schema, API, and Helper Needs

These are not built in Phase 38. Listed here to prevent ad-hoc decisions later.

#### Schema migrations (future)

| Migration | Change |
|---|---|
| Program advisor migration | Add `program_id uuid` (nullable, FK `programs.id` ON DELETE CASCADE) to `ai_conversations`. Add partial unique index `(user_id, program_id) WHERE program_id IS NOT NULL`. Update RLS INSERT/UPDATE WITH CHECK to validate `program_id` ownership. |
| Scholarship advisor migration | Add `scholarship_id uuid` (nullable, FK `scholarships.id` ON DELETE CASCADE) to `ai_conversations`. Add partial unique index `(user_id, scholarship_id) WHERE scholarship_id IS NOT NULL`. Update RLS INSERT/UPDATE WITH CHECK to validate `scholarship_id` ownership. |

Both columns are nullable so existing conversations and future generic sessions are unaffected.
The existing partial unique index for `ai_finder_result_id` is unchanged.

#### API endpoints (future)

- `POST /api/ai/program-chat` — new endpoint bound to `program_id`, analogous to `/api/ai/chat`.
  Must not reuse `/api/ai/chat` by adding a mode switch that accepts `program_id` instead of
  `ai_finder_result_id`. A dedicated endpoint keeps the ownership verification paths clean.
- `POST /api/ai/scholarship-chat` — new endpoint bound to `scholarship_id`.

#### Helpers (future, analogous to existing chat helpers)

- `src/lib/ai/program/context.ts` — RLS-scoped program context loader.
  Allowlists public fields; excludes internal UUIDs; returns null if program is not published.
- `src/lib/ai/scholarship/context.ts` — RLS-scoped scholarship context loader.
  Allowlists public fields; excludes internal UUIDs; returns null if scholarship is not published.
- `src/lib/ai/program/persist.ts` — service-role message persistence for program chat.
- `src/lib/ai/scholarship/persist.ts` — service-role message persistence for scholarship chat.
- Prompt templates in `chat-answer.ts` — new `chatMode` values:
  `'program_page'` and `'scholarship_page'` with their own scoped system prompts.

---

### 18.5 Deferral Decisions

#### Defer until Data Source + Verification foundation exists

- Any advisor commentary implying data is "verified", "current", or "accurate".
  No `verified_at`, `source_confidence`, or `last_verified` fields exist on programs or
  scholarships yet. The advisor must not imply data quality it cannot confirm.
- Scholarship eligibility advice that depends on precise, verified eligibility criteria.
- Program admission requirement accuracy claims (GPA cutoffs, language requirements are
  sparse or unverified on most current rows).

#### Defer until Import/Staging/data-quality foundation exists

- Scholarship junction table population (subject, country, university, degree level
  associations were deferred in Phase 07). The scholarship advisor cannot surface meaningful
  eligibility context until these are populated.
- Program field completeness. Tuition, deadline, and intake fields are sparse on current data.
  An advisor built before data is populated will produce low-value responses.

#### Defer until Student Profile support improves

- Profile-based fit commentary for logged-in users beyond the current `student_profiles` fields.
  Matching scholarship eligibility criteria to student nationality, funding needs, and academic
  background requires profile fields that may not yet be reliably populated.

#### Defer until chat context schema expands

- All actual implementation of Program Page AI Advisor.
  Blocked on: `ai_conversations.program_id` migration, new context loader, new API endpoint,
  new prompt template, new UI component.
- All actual implementation of Scholarship Page AI Advisor.
  Blocked on: `ai_conversations.scholarship_id` migration, new context loader, new API endpoint,
  new prompt template, new UI component, and junction table population.
