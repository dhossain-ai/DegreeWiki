# DegreeWiki AI System

## Purpose

This file defines how DegreeWiki uses AI in the product and in development.

## Core AI Product Principle

DegreeWiki is not AI-first. DegreeWiki is database-first and AI-assisted.

AI should explain, summarise, classify, and guide.

AI must not invent factual education data.

## Database-First Rule

This rule applies to every AI feature without exception:

1. The database chooses candidates (SQL filter on real rows).
2. Rule/scoring code ranks candidates (server-side logic, no LLM).
3. The LLM explains candidates (natural-language summary only).

The LLM must not invent programs, scholarships, tuition fees, deadlines,
admission requirements, visa outcomes, official policies, or guarantees.

The caller must retrieve real database records and pass them as AIContext
before calling callAI(). The gateway enforces this via the required AIContext
parameter — it cannot be null or omitted.

## AI Finder Rule

Correct AI Finder flow:

1. Student completes profile.
2. System filters real programs from DegreeWiki database.
3. Rule-based scoring ranks programs.
4. System creates program shortlist.
5. AI explains why the shortlisted programs may fit.
6. AI provides warnings and next steps.

The LLM must not independently invent recommended programs.

## AI Chatbot Rule

The chatbot should answer from DegreeWiki context first.

Preferred order:

1. Static/rule-based response
2. Reviewed preset Q&A
3. Structured database query
4. Existing articles/guides
5. RAG/vector search later
6. LLM explanation
7. Fallback/clarification

## AI Orchestration Pipeline

For each user message:

1. Normalise message.
2. Detect intent.
3. Extract entities:
   - country
   - subject
   - degree level
   - university
   - budget
   - deadline
   - scholarship
4. Check rate limit.
5. Route request.
6. Retrieve relevant DegreeWiki data.
7. Build AIContext from retrieved records.
8. Call callAI() with AIContext — only if needed.
9. Run output guardrails on LLM response.
10. Save message, retrieved context, model usage.
11. Return answer.

## Common Intents

- greeting
- program_search
- university_search
- scholarship_search
- country_info
- subject_info
- eligibility_check
- program_comparison
- cost_question
- deadline_question
- visa_general_info
- application_roadmap
- finder_followup
- general_study_abroad

## Safe Scope

The chatbot can help with:

- program discovery
- country comparison
- scholarship guidance
- admission requirement explanation
- deadline/intake explanation
- document checklist
- profile-based fit explanation
- study-abroad planning

The chatbot must avoid:

- guaranteed admission claims
- guaranteed scholarship claims
- visa approval predictions
- fake document advice
- fraud
- plagiarism
- legal/immigration guarantees
- financial advice outside study planning

## Safe Wording

Use:

"Based on available DegreeWiki data..."

"This appears to be a stronger fit..."

"Please confirm final details on the official university or scholarship website."

Do not use:

"You will be accepted."

"You are eligible for sure."

"This visa will be approved."

## AI Gateway Architecture (Phase 25)

The AI module lives in src/lib/ai/ and is server-only.

### Directory Structure

```
src/lib/ai/
  types.ts              shared types: AIRequest, AIResponse, AIContext,
                        AIPrompt, AIProviderConfig, AIProviderResponse,
                        AIUsageEntry, AIGuardrailResult, AIRuntimeEnv,
                        StudentProfileSummary, AISessionType, AIRole
  env.ts                getAIEnv(locals) — extracts AIRuntimeEnv from
                        Cloudflare Workers locals.runtime.env safely;
                        includes gateway encryption/env-fallback keys
  gateway.ts            callAI() — single entry point for all LLM calls;
                        keeps app-level guardrails and quota checks, then
                        delegates provider execution to router.ts
  router.ts             DB-backed use-case router for existing AI calls;
                        loads routing candidates, skips cooldown/inactive
                        providers, logs attempts, and applies env fallback
  call-logs.ts          writes ai_gateway_call_logs and updates
                        ai_provider_health for success/failure tracking
  admin/
    crypto.ts           AES-GCM encryption/decryption helpers for provider
                        API keys using AI_GATEWAY_MASTER_KEY
    store.ts            service-role helpers to load provider accounts,
                        models, routing policies, and health rows
  providers/
    interface.ts        AIProvider interface contract
    gemini.ts           Gemini REST implementation (live in Phase 23)
    openai-compatible.ts reusable adapter for OpenAI-compatible providers
  prompts/
    finder-summary.ts   buildFinderPrompt() for AI Finder explanation
    chat-answer.ts      buildChatPrompt() for chatbot responses
  safety/
    guardrails.ts       checkInput() and checkOutput() — first-pass safety
  usage/
    logging.ts          writeUsageLog(entry, serviceClient) — live in Phase 25;
                        inserts into ai_usage_logs; fire-and-forget, never throws
    limits.ts           checkRateLimit(userId, sessionType, opts) — live in Phase 25;
                        fail-closed daily per-user limit via ai_usage_logs count

src/lib/supabase/
  server.ts             createClient(cookies, request) — SSR client, anon key + RLS
  service.ts            createServiceClient(key) — service role client, no cookies;
                        SERVER-ONLY; used only by AI logging/rate-limit code
```

### callAI() Contract

```
callAI(request: AIRequest, env: AIRuntimeEnv): Promise<AIResponse>
```

- Input guardrails run first (checkInput).
- Service client created from env.SUPABASE_SERVICE_ROLE_KEY (null if absent).
- Rate limit checked second (checkRateLimit).
- Runtime order is:
    DB usage policy for `use_case + audience_tier`
    → legacy env fallback
    → conservative fail-closed fallback if authoritative counting is unavailable.
- Prompt built: buildFinderPrompt for finder sessions, buildChatPrompt for chat,
  or a caller-provided prompt override for admin-only article assist.
- Use-case routed through router.ts:
    fit_finder_summary for saved Fit Finder summaries
    chat_answer for saved-result AI chat
    admin_article_draft for admin article drafting and SEO suggestions
- router.ts tries DB-backed routing policies first, logs every attempt to
  ai_gateway_call_logs, applies provider health cooldowns, and only then
  uses env fallback when AI_GATEWAY_ENV_FALLBACK_ENABLED=true.
- Output guardrails run on provider response (checkOutput) before returning.
- writeUsageLog() called fire-and-forget after output guardrail passes.
- Successful usage-log rows now include `session_type`, `use_case`, `audience_tier`,
  and optional `anonymous_session_id` metadata.
- Every failure path returns a valid AIResponse — callAI never throws.
- callAI must only be called from server endpoints.

### Phase 69B Behaviour — DB-Backed Gateway Foundation

The AI gateway now supports a DB-backed provider foundation while preserving the
existing env-based fallback path.

Gateway tables:
- ai_provider_accounts
- ai_models
- ai_routing_policies
- ai_provider_health
- ai_gateway_call_logs

Current live product routing:
- Fit Finder async summary → use_case = fit_finder_summary
- Saved-result chat LLM path → use_case = chat_answer
- Static saved-result chat responses still bypass AI entirely

Current live admin routing:
- Admin article assistant → use_case = admin_article_draft

Provider keys:
- Stored encrypted in ai_provider_accounts only
- Encrypted with AES-GCM using AI_GATEWAY_MASTER_KEY
- IV stored separately as base64
- Key version stored in api_key_key_version using AI_GATEWAY_ACTIVE_KEY_VERSION
- Only last4/fingerprint metadata is stored alongside ciphertext
- Decrypted keys are never returned to browser code and never logged

Fallback rules:
- App-level validation, context checks, static chat routing, and DegreeWiki quota checks
  happen before provider fallback.
- DB routing falls across provider/model candidates only for recoverable provider failures.
- If DB routing has no usable candidate, or every candidate fails, env fallback may run
  when AI_GATEWAY_ENV_FALLBACK_ENABLED=true and the use-case policy allows it.

### Phase 69C Behaviour — Admin AI Gateway Dashboard

Phase 69C adds an admin-only dashboard at `/admin/ai-gateway` for users with
`manage_ai_settings`.

What admins can manage:
- Provider accounts
- Models
- Routing policies
- Provider/model health rows
- Preset-only provider/model tests

Current DB-managed provider support:
- `openai_compatible` only

Planned but not DB-managed yet:
- `gemini`
- `openrouter_legacy`
- `disabled`

Important boundary:
- Gemini and OpenRouter remain env-fallback providers for now.
- The admin dashboard must not imply that DB-managed Gemini/OpenRouter accounts are live.

Provider key handling rules:
- Admin create/replace flows accept plaintext keys only in the request body.
- Keys are encrypted immediately server-side with `encryptProviderApiKey()`.
- The browser never receives decrypted keys or ciphertext.
- The UI shows masked metadata only: last4, fingerprint metadata, key version, and whether a key exists.

Admin testing rules:
- Tests are preset-only and use no real student private data.
- Tests do not store full prompt/response bodies in gateway logs.
- Tests do not mutate production provider health/cooldown state.

Current live product routing remains limited to:
- `fit_finder_summary`
- `chat_answer`

Current live admin routing also includes:
- `admin_article_draft`

The admin dashboard does not expand public chatbot scope or change the existing
`/api/ai/finder-summary` or `/api/ai/chat` contracts.

### Phase 70C Behaviour — Admin Article AI Assistant

Phase 70C adds an admin-only article assistant at `/api/admin/articles/ai-assist`
and inside the shared article editor form.

Route and prompt rules:
- Uses `use_case = 'admin_article_draft'`
- Uses an article-specific prompt, not the Fit Finder or site-chat prompts
- Returns plain-text suggestions only
- No HTML rendering, Markdown rendering, `innerHTML`, or `set:html`

Allowed actions:
- outline
- seo_title
- seo_description
- summary
- faq
- risk_check

Safety boundaries:
- No auto-save
- No auto-publish
- No full article generation
- No automatic body replace action
- No new suggestion persistence table
- No invented tuition, deadlines, admission requirements, scholarship details, or visa rules
- No fake citations, live verification claims, or guarantees

Quota/logging note:
- The admin article assistant now keeps `session_type = 'chat'` for compatibility but writes
  `use_case = 'admin_article_draft'` and `audience_tier = 'admin'` into new `ai_usage_logs` rows.
- Gateway call logs remain metadata-only and do not store article bodies or AI suggestions.

### Phase 71A Behaviour — AI Usage Limits Admin

Phase 71A adds DB-backed AI usage limit policies plus an admin Limits tab inside
`/admin/ai-gateway`.

New table:
- `ai_usage_limit_policies`

Additive `ai_usage_logs` metadata:
- `use_case`
- `audience_tier`
- `anonymous_session_id`

Resolution order:
1. enabled DB policy rows for the current `use_case + audience_tier`
2. legacy env fallback using the existing combined daily counting behavior
3. conservative fail-closed fallback if authoritative counting is unavailable

Audience tier mapping in this phase:
- anonymous provider-backed calls → `anonymous`
- signed-in non-admin product users → `authenticated_free`
- admin/super_admin editorial calls → `admin`
- `paid_basic` and `paid_pro` remain reserved for future billing/subscription work

Important rollout rule:
- The migration does not seed active policy rows.
- An empty `ai_usage_limit_policies` table means env fallback remains active.
- Older `ai_usage_logs` rows are not backfilled, so historic `chat` rows cannot be perfectly
  split retroactively by use case.

Exclusions:
- hardcoded/static site-chat answers do not count
- reviewed preset `ai_static_answers` answers do not count
- AI Gateway admin tests do not count
- `ai_gateway_call_logs` remains separate from quota logs

### Phase 25 Behaviour — Usage Logging and Rate Limits

#### Server-Only Supabase Service Client

src/lib/supabase/service.ts exports createServiceClient(serviceRoleKey: string).

Uses @supabase/supabase-js createClient with persistSession: false and
autoRefreshToken: false — no cookies, no session side effects.

The service key is read from locals.runtime.env via getAIEnv() (same pattern as
GEMINI_API_KEY). It is never hardcoded, never logged, never passed to client code,
and never uses the PUBLIC_ prefix.

The client is created once inside callAI() per request and passed into
checkRateLimit and writeUsageLog. It is never stored at module scope.

#### Rate Limit Algorithm

checkRateLimit({ userId, anonymousSessionId, useCase, audienceTier, sessionType }, { serviceClient, env }):

1. Resolve audience tier:
   - explicit override from caller when needed (for example admin article assistant)
   - otherwise `authenticated_free` for signed-in users
   - otherwise `anonymous`
2. If `serviceClient` is missing, fail closed with `service_unavailable`.
3. Try enabled DB policy rows for the current `use_case + audience_tier`.
4. For each DB policy row, count matching `ai_usage_logs` rows by:
   - `use_case`
   - `audience_tier`
   - `user_id` or `anonymous_session_id`
   - current UTC day or month depending on policy period
5. If any enabled DB policy is exhausted, deny with `limit_exceeded`.
6. If no matching DB policy exists, or DB policy lookup/counting fails, fall back to the
   legacy env-based combined daily counting behavior.
7. Legacy env fallback still counts broadly by successful `ai_usage_logs` rows on the current UTC
   day, preserving pre-Phase-71A behavior until admins create DB rows.

Fallback messages in callAI:
  limit_exceeded → "You have reached today's AI usage limit. Your rule-based
                    matches are still available."
  service_unavailable → "AI is temporarily unavailable."

The Fit Finder result page treats any fallbackUsed=true response the same way:
the AI section is not rendered, rule-based matches render normally.

#### Usage Logging

writeUsageLog(entry, serviceClient):

Inserts one row into ai_usage_logs after a successful AI call (after output
guardrail passes). Called fire-and-forget — a logging failure never affects
the AI response.

Fields written:
  user_id           — auth user UUID (same as user_profiles.id FK)
  anonymous_session_id — reserved for future anonymous provider-backed flows
  session_type      — 'finder' or 'chat'
  use_case          — fit_finder_summary | chat_answer | admin_article_draft | future use-case
  audience_tier     — anonymous | authenticated_free | admin | paid_basic | paid_pro
  tokens_used       — promptTokens + completionTokens from provider
  model_used        — model string from provider response
  cost_estimate_usd — null (Phase 25; cost map deferred to later phase)

Fields never written:
  Prompt text, AI response text, profile UUID, user email, session token,
  additional_notes, raw admission/English/GPA requirements.

If serviceClient is null, writeUsageLog returns immediately (no-op).
Insert errors are logged server-side via console.error and never re-thrown.

### getAIEnv Helper

```
getAIEnv(locals: Record<string, unknown>): AIRuntimeEnv
```

Extracts AI env vars from Cloudflare Workers `locals.runtime.env`.
When those bindings are absent in local Astro server development, the helper
may safely fall back to server-only `import.meta.env` values. Call once per
server endpoint, pass result to `callAI()`.

In `@astrojs/cloudflare`, Cloudflare secrets and bindings are available at
`locals.runtime.env` — that remains the primary production path. A safe cast
is required because `src/env.d.ts` does not exist in this project.

Usage in a server endpoint:
```
import { getAIEnv } from '../lib/ai/env'
const aiEnv = getAIEnv(Astro.locals as Record<string, unknown>)
const response = await callAI(request, aiEnv)
```

### Gemini REST Provider

GeminiProvider.complete() calls:
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}
```

Request body:
- system_instruction.parts[0].text = prompt.system
- contents[0].role = 'user', parts[0].text = prompt.user
- generationConfig.temperature = config.temperature ?? 0.2
- generationConfig.maxOutputTokens = config.maxOutputTokens ?? 2048

Response parsing:
- text: all candidates[0].content.parts[].text joined
- promptTokens: usageMetadata.promptTokenCount ?? 0
- completionTokens: usageMetadata.candidatesTokenCount ?? 0
- modelUsed: response.modelVersion ?? config.model

Error handling:
- non-ok HTTP status → throws with status code only (no response body logged)
- empty candidates → throws controlled error
- finishReason SAFETY or RECITATION → throws controlled error
- missing text → throws controlled error
All throws are caught by callAI(), which returns a safe fallback.

## LLM Provider Strategy

Use AI Gateway abstraction (src/lib/ai/gateway.ts).

Do not hardcode product logic to one LLM provider.

Initial provider:

- Gemini (REST API via fetch, no SDK dependency)

Future providers:

- OpenRouter
- Qwen
- DeepSeek
- OpenAI
- other low-cost models

Providers must implement AIProvider interface (src/lib/ai/providers/interface.ts).

All provider implementations must use fetch() only. No Node http/https modules.
This is required for Cloudflare Workers compatibility.

## Server-Only Secret Rules

AI API keys must never use the `PUBLIC_` prefix.

Environment variables for the AI module:

```
# Required secrets — server-only, never exposed with PUBLIC_
AI_GATEWAY_MASTER_KEY       # Base64-encoded 32-byte AES key for DB-stored provider
                            # credential encryption/decryption.
AI_GATEWAY_ACTIVE_KEY_VERSION
                            # Active encryption key version label, e.g. v1.
GEMINI_API_KEY             # Server/worker only. Required for AI to run.
                            # Production Cloudflare: set in the Cloudflare dashboard
                            # or via wrangler secret (see docs/08-ai-deployment-checklist.md).
SUPABASE_SERVICE_ROLE_KEY  # Server/worker only. Required for AI to run.
                            # Used for rate-limit checks, usage logging, and saved-result
                            # persistence. If absent, all AI calls fail closed.
                            # Never use the PUBLIC_ prefix.
                            # Production Cloudflare: set in the Cloudflare dashboard
                            # or via wrangler secret (see docs/08-ai-deployment-checklist.md).

# Optional server/runtime env vars — set in Cloudflare Pages dashboard or wrangler.toml
AI_PROVIDER             # Active provider name: gemini | openrouter (default: gemini)
AI_MODEL                # Model string passed to provider (default: gemini-2.5-flash)
AI_GATEWAY_ENV_FALLBACK_ENABLED
                        # true | false. Allows env-based fallback after DB routing fails.
AI_RATE_LIMIT_ANON_DAILY    # Max AI calls per anonymous session per day (default 5, not yet enforced)
AI_RATE_LIMIT_USER_DAILY    # Max AI calls per logged-in user per day (default 20)
```

In Cloudflare Workers, env vars are accessed via `locals.runtime.env`
(typed as `AIRuntimeEnv`). In local Astro server development, the same
server-only names may be provided via `.env.local` and read through the
`getAIEnv()` fallback in `src/lib/ai/env.ts`.

Never access AI env vars via `import.meta.env.PUBLIC_*` — that would expose
them to the browser.

## Prompt Safety Boundaries

Every prompt sent to an LLM must open with the system prompt defined in
finder-summary.ts or chat-answer.ts. These system prompts enforce:

1. Use only provided DegreeWiki database context.
2. Do not invent facts.
3. Do not guarantee admission, scholarship, or visa outcomes.
4. Advise users to verify with official sources.
5. State clearly when database context is insufficient.

User input is placed in the user turn only. It must never be interpolated
into the system turn to prevent prompt injection.

## Guardrails

src/lib/ai/safety/guardrails.ts provides two first-pass helpers:

checkInput(text)   — blocks prohibited user input before calling the LLM
checkOutput(text)  — blocks prohibited content in LLM output before returning

These are deterministic regex checks, not a complete safety system.
They catch clearly prohibited content using conservative, exact phrase matching.

Blocked input patterns:
- fake recommendation letters
- document/certificate forgery
- essay ghostwriting
- immigration fraud
- visa fraud

Blocked output patterns:
- "guaranteed admission"
- "guaranteed scholarship"
- "visa will be approved"
- "100% acceptance"
- definitive admission/eligibility claims

Semantic moderation, intent classification, and ML-based safety are deferred.

## Usage Logging (Phase 19+)

writeUsageLog() in src/lib/ai/usage/logging.ts is a server-only helper.

It will write to the ai_usage_logs table via Supabase service role client.

Phase 18: function is defined but body is a no-op placeholder.

ai_usage_logs schema (migration 012):
  user_id (null for anonymous)
  session_type (finder | chat)
  tokens_used
  model_used
  cost_estimate_usd
  created_at

cost_estimate_usd will be computed from a per-model rate map in Phase 19.

## Rate Limits (Phase 19+)

checkRateLimit() in src/lib/ai/usage/limits.ts is a server-only helper.

Phase 18: function is defined, always returns { allowed: true, remaining: 99 }.

Phase 19 implementation will query ai_usage_logs for today's count per
user_id or session_token and compare against env var limits:
  AI_RATE_LIMIT_ANON_DAILY (default 5)
  AI_RATE_LIMIT_USER_DAILY (default 20)

No external rate-limit service is used — limits are enforced via the existing
ai_usage_logs table (migration 012).

## RAG Strategy

MVP:

- structured database queries
- direct context from selected records
- simple FAQ/template responses

MVP-plus:

- ai_search_text fields
- embeddings for programs/articles/scholarships
- Supabase pgvector

Later:

- content_chunks
- vector search
- citations
- retrieved context tracking

Do not start with ChromaDB unless Supabase pgvector is not enough.

## AI Usage Limits

Current admin-managed quota model:

- policies may be set per `use_case`
- policies may be set per `audience_tier`
- policies may be set per `period` (`daily` or `monthly`)
- empty policy table means legacy env fallback remains active

Current audience tiers:

- `anonymous`
- `authenticated_free`
- `admin`
- `paid_basic` reserved for later
- `paid_pro` reserved for later

## Cloudflare Workers Compatibility

The entire src/lib/ai/ module is Cloudflare Workers compatible:

- Uses fetch() for all external calls — no Node http/https
- No dynamic require()
- No fs/path usage
- No process.env access (uses locals.runtime.env)
- No npm AI SDKs in Phase 18

## AI Development Workflow

For AI coding tools:

1. Ask for plan only.
2. Review plan with ChatGPT.
3. Approve or revise.
4. Let AI implement.
5. Ask for summary.
6. Review summary with ChatGPT.
7. Fix issues.
8. Update docs/06-status.md.
9. Append to docs/07-task-log.md.

Coding agents should not silently change architecture.

## AI Production Readiness (Phase 28)

### Fail-Closed Behavior by Missing Secret

Every condition that prevents an authoritative AI call returns a safe fallback.
Rule-based matches always render. The AI section is absent (with a subtle user note).

| Condition | Effect |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` absent | `serviceClient = null` → rate limit returns `service_unavailable` → AI not called |
| `GEMINI_API_KEY` absent | `resolveProvider()` throws → `callAI` catches → fallback |
| Both secrets absent | Same as `SUPABASE_SERVICE_ROLE_KEY` absent path |
| Rate limit exceeded | `checkRateLimit` returns `limit_exceeded` → AI not called |
| Gemini API error (network, 4xx, 5xx) | Provider throws → `callAI` catches → fallback |
| Output guardrail tripped | `checkOutput` fails → fallback with `guardrailTripped: true` |

In all fallback cases: `aiResponse.fallbackUsed = true` or `guardrailTripped = true`.
The result page sets `aiUnavailable = true` and shows:
"AI summary is unavailable right now. Your rule-based matches are still shown."

### Cloudflare Secret Setup

Use the command matching your deployment target. Do not commit real values.

**Cloudflare Pages:**
```bash
npx wrangler pages secret put GEMINI_API_KEY
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
```

**Cloudflare Workers:**
```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Plain env vars (`AI_PROVIDER`, `AI_MODEL`, `AI_RATE_LIMIT_USER_DAILY`, `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL`) are set in the Cloudflare Pages dashboard
or `wrangler.toml` — not as encrypted secrets.

### Production Verification Steps

After deploying with all secrets set, run a Fit Finder session as a logged-in user with a
valid profile and at least one published program in the database. Then verify in the Supabase
dashboard:

1. **AI usage log**: `ai_usage_logs` has a new row with `session_type = 'finder'` and
   `tokens_used > 0`. If this row is absent, `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY`
   may be missing or misconfigured.

2. **Saved result**: `ai_finder_results` has a new row with `result_status = 'complete'`
   and `shortlist_count > 0`.

3. **Match rows**: `ai_finder_program_matches` has rows linked to that result UUID,
   ordered by `rank` ascending.

4. **Saved result page loads**: `/fit-finder/results/{result_id}` renders for the owner.

5. **Non-owner 404**: Loading the same URL while signed in as a different user returns 404.

6. **AI unavailable note**: Remove `GEMINI_API_KEY` (or set an invalid value), run the
   Fit Finder again. The AI section should be absent and the gray note should appear.
   Rule-based matches must render normally.

### Local Dev Notes

For local Astro server development, server-only AI env vars may be placed in
`.env.local` and are read through the server-only `getAIEnv()` fallback. Do not
use any `PUBLIC_` prefix for Gemini or service-role keys, and do not commit
`.env.local`.

For local Cloudflare / `wrangler pages dev` testing, AI runtime env vars are read
from `locals.runtime.env`. Use `.dev.vars` (gitignored) to set secrets locally:

```
GEMINI_API_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
```

Never prefix secrets with `PUBLIC_`. Never commit `.env.local`, `.dev.vars`, or any
file containing real secret values. See `docs/08-ai-deployment-checklist.md` for the
full checklist.

## Phase 69D Behaviour — Public Chatbot Shell + Logged-In Site Chat

Phase 69D adds a public chatbot shell through `PublicLayout` on a narrow allowlist of
public routes only:

- `/`
- `/programs*`
- `/universities*`
- `/scholarships*`
- `/guides*`

It does not render on admin, auth, Fit Finder, saved-result, or policy/legal pages.

Behaviour rules:

- Anonymous visitors get static routing only. No AI call, no DB persistence, no personalized chat.
- Logged-in users use a separate global site-chat API path:
  `site-chat-session`, `site-chat`, and `site-chat-clear`.
- Logged-in AI turns still use `use_case = 'chat_answer'` and the existing AI Gateway,
  guardrails, and `ai_usage_logs` quota checks.
- Global site chat is stored in `ai_conversations` / `ai_messages` with
  `session_type = 'chat'` and `ai_finder_result_id = null`.
- Saved-result chat remains a separate surface bound to `ai_finder_result_id`; Phase 69D
  does not attach the latest Finder result or matched programs to global site chat.
- Phase 69D does not add RAG, vector search, internet browsing, admin data access, or
  student-profile context beyond authentication state.

## Phase 69E Behaviour — Static Knowledge Base / Preset Q&A Admin

Phase 69E adds a reviewed preset-answer layer for site chat through
`ai_static_answers` and `/admin/ai-knowledge`.

Behaviour rules:

- hardcoded safety/refusal routes still win first
- published preset answers are checked next
- anonymous non-matches still return the static sign-in / Fit Finder prompt
- logged-in non-matches may still use `chat_answer` through the existing AI Gateway
- preset answers are plain text only
- no Markdown rendering, no HTML rendering, no embeddings, no RAG, and no live AI generation
  at request time for preset answers

Admin rules:

- `manage_ai_settings` controls access to the AI Knowledge Base admin surface
- JSON import validates shape first and always imports rows as `draft`
- publish remains a separate reviewed action

## Phase 69G Behaviour — Public Chatbot UX Polish

Phase 69G keeps the Phase 69D/69E routing order and adds UI-facing metadata for the
public site chat widget.

Route order remains:

1. hardcoded safety/refusal routes
2. published preset answers
3. anonymous login-required notice
4. logged-in AI through `chat_answer`

Site-chat response metadata:

- `answer_source = "knowledge_base"` for preset DB answers and general static/help/navigation answers
- `answer_source = "safety_notice"` for refusal/guarantee/out-of-scope safety answers
- `answer_source = "assistant"` for logged-in AI answers
- `answer_source = "system_notice"` for anonymous login-required notices and operational status/error responses

Persistence rules:

- Site-chat assistant/static turns store source metadata in `ai_messages.context_used`
- `GET /api/ai/site-chat-session` restores source metadata for prior assistant turns
- Older turns without explicit metadata are inferred conservatively for badge display only

Rendering rules:

- Site-chat remains plain text only
- no Markdown rendering
- no HTML rendering
- no `innerHTML`
- no `set:html`
- browser code renders user/assistant content with `textContent` only
