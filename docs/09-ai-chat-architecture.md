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

### Page route

```
src/pages/fit-finder/results/[id]/chat.astro
```

- SSR, `noindex={true}`, Astro dynamic route
- Param: `id` = UUID of the `ai_finder_results` row
- Uses `PublicLayout`
- Requires authentication (redirect to `/login?redirect=/fit-finder/results/{id}/chat` if not logged in)
- UUID format validated before any DB query

### POST handler strategy — same-page POST (preferred for MVP)

The Astro page handles both GET and POST in its frontmatter, consistent with the pattern
already used in `/fit-finder/results/index.astro`.

- GET: load conversation history, render message list + input form
- POST: process one new user message, persist, redirect (PRG pattern)

No separate API endpoint file. No JSON responses. No streaming. Server renders the updated
conversation on redirect.

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

The existing `/privacy` page covers AI usage logging and saved results (updated Phase 28).
It does NOT yet mention stored chat sessions or chat message content.

**The privacy page MUST be updated before or in the same phase as chat launches publicly.**
Proposed addition:
> "Chat sessions: If you use the AI chat feature on a saved Fit Finder result, your questions
> and AI responses are stored in your account until you delete them. You can delete a chat
> session at any time from the saved result page."

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

### Phase 33 — Prompt hardening for saved-result chat

- Update `src/lib/ai/prompts/chat-answer.ts` with context-bound system prompt
- Add session type parameter to select between generic and result-scoped prompt
- Tests: verify refusal behavior for out-of-scope questions

### Phase 34 — Chat route MVP

- Create `src/pages/fit-finder/results/[id]/chat.astro`
- SSR GET + POST handler
- Entry point on `/fit-finder/results/[id]`
- Service-client message persistence via a new `src/lib/ai/chat/persist.ts`
- Privacy page update bundled in this phase
- Full security grep validation

### Phase 35 (optional) — Provider native multi-turn upgrade

- Update `GeminiProvider.complete()` to accept `messages: Array<{role, content}>` and
  use Gemini's `contents[]` multi-turn format natively
- Refactor multi-turn packing out of the prompt layer

### Later phases (deferred)

- Per-session-type rate limits (`AI_RATE_LIMIT_CHAT_USER_DAILY`)
- Cost estimate map for `cost_estimate_usd`
- Conversation management on the account page
- Conversation delete button on the chat page

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
