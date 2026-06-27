# DegreeWiki Status Archive

> Split archive for Phase 21-30. Use the narrowest matching range first.
> Older phases beyond this range live in the next archive file.

Phase 30 — Account/Profile Area Foundation — complete.


Phase 29 — Fit Finder History Polish — complete.


Phase 28 — AI Finder Production Hardening — complete.


Phase 27 — Saved Finder Results Management — complete.


Phase 26 — AI Finder Result Persistence — complete.

## Last Completed Work


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


