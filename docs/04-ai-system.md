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
2. Structured database query
3. Existing articles/guides
4. RAG/vector search later
5. LLM explanation
6. Fallback/clarification

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

## AI Gateway Architecture (Phase 18)

The AI module lives in src/lib/ai/ and is server-only.

### Directory Structure

```
src/lib/ai/
  types.ts              shared types: AIRequest, AIResponse, AIContext,
                        AIPrompt, AIProviderConfig, AIProviderResponse,
                        AIUsageEntry, AIGuardrailResult, AIRuntimeEnv,
                        StudentProfileSummary, AISessionType, AIRole
  gateway.ts            callAI() — single entry point for all LLM calls
  providers/
    interface.ts        AIProvider interface contract
    gemini.ts           Gemini implementation (stub in Phase 18)
  prompts/
    finder-summary.ts   buildFinderPrompt() for AI Finder explanation
    chat-answer.ts      buildChatPrompt() for chatbot responses
  safety/
    guardrails.ts       checkInput() and checkOutput() — first-pass safety
  usage/
    logging.ts          writeUsageLog() — placeholder, wired in Phase 19
    limits.ts           checkRateLimit() — placeholder, enforced in Phase 19
```

### callAI() Contract

```
callAI(request: AIRequest, env: AIRuntimeEnv): Promise<AIResponse>
```

- Input guardrails run first (checkInput).
- Rate limit is checked second (checkRateLimit).
- AIContext.records must be pre-fetched by the caller — never empty by accident.
- Provider is resolved from env.AI_PROVIDER.
- Output guardrails run on provider response (checkOutput) in Phase 19+.
- Usage is logged to ai_usage_logs in Phase 19+.
- callAI must only be called from server endpoints.

### Phase 18 Behaviour

No live provider is enabled in Phase 18.

callAI() returns a controlled fallback response instead of calling any external API.

The Gemini provider stub throws "Gemini provider is not enabled in Phase 18."
if instantiated directly.

No external API calls are made. No ai_usage_logs rows are written.

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

AI API keys must never use the PUBLIC_ prefix.

Environment variables for the AI module:

```
GEMINI_API_KEY          # Server/worker only. Set via: wrangler secret put GEMINI_API_KEY
AI_PROVIDER             # Active provider name: gemini | openrouter
AI_MODEL                # Model string passed to provider, e.g. gemini-2.0-flash
AI_RATE_LIMIT_ANON_DAILY    # Max AI calls per anonymous session per day (default 5)
AI_RATE_LIMIT_USER_DAILY    # Max AI calls per logged-in user per day (default 20)
```

In Cloudflare Workers, env vars are accessed via locals.runtime.env (typed as AIRuntimeEnv).

Never access AI env vars via import.meta.env.PUBLIC_* — that would expose them to the browser.

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

Anonymous users:

- very limited daily AI usage
- temporary profile/results
- expiry cleanup

Logged-in users:

- higher daily usage
- saved profiles/results
- saved conversations

Paid users later:

- higher usage
- deeper recommendations
- more conversations

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
