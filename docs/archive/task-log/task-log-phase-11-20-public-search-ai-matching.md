# DegreeWiki Task Log Archive: Phase 11-20

Extracted from the 2026-06-21 pre-compaction snapshot. Covers public search, SEO, and early AI/matching work.

## 2026-06-17 - Phase 20: Rule-Based Program Matching Engine

Tool:
Codex

Goal:
Enhance /fit-finder/result from a placeholder into a deterministic server-rendered
program matching page. Use the logged-in user's saved Fit Finder profile, score and
rank published programs with rules, and render possible matches. No AI, no chatbot,
no AI result writes, no service_role, no migrations, no dependencies, no React, no
client-side JS, no admin changes, and no anonymous persistence.

---

### Files Changed

Modified:
  src/pages/fit-finder/result.astro
  docs/06-status.md
  docs/07-task-log.md

Not modified:
  src/lib/ai/*
  supabase/migrations/*
  src/pages/admin/*
  package.json
  src/lib/supabase/server.ts

---

### RLS / Access Behavior

The route uses the existing Supabase SSR client and supabase.auth.getUser().

Anonymous /fit-finder/result:
  Shows sign-in/save guidance with links to /login?redirect=/fit-finder and /fit-finder.
  Does not query student_profiles or profile preference tables.

Logged-in user without a saved profile:
  Selects the latest own non-anonymous student_profiles row by user_id and
  is_anonymous=false. If none exists, shows "No saved Fit Finder profile yet."
  and links to /fit-finder.

Logged-in user with a saved profile:
  Loads only the latest own non-anonymous profile.
  Loads student_profile_subjects and student_profile_countries for that profile id.
  Existing RLS enforces parent profile ownership.
  The profile id is never accepted from URL/form input, rendered into the page,
  or placed in a URL.

Program access:
  Queries only programs where content_status='published'.
  Uses public published-content RLS for programs and related display joins.
  Draft, in_review, unpublished, and archived programs are not queried for matching.

---

### Candidate Query Strategy

The route performs a broad capped candidate query rather than strict hard filters.

Program candidate query:
  programs.select(...)
    .eq('content_status', 'published')
    .order('title')
    .limit(200)

Selected program fields:
  id, title, slug, university_id, country_id, city_id, degree_level_id,
  primary_subject_id, study_mode, delivery_mode, language_of_instruction,
  tuition_min_amount, tuition_max_amount, tuition_currency, tuition_period,
  official_url, admission_requirements, english_requirements, gpa_requirements,
  verification_status, source_confidence_score

Display joins:
  universities(id, name, slug)
  countries(name)
  cities(name)
  degree_levels(name)
  subjects(name)

Program subjects:
  Fetches program_subjects for all candidate program IDs in one batch:
    program_id, subject_id, is_primary, display_order
  If that query fails, the page logs the error, continues using primary_subject_id
  only for subject scoring, and renders a page-level note explaining the deviation.

---

### Scoring Algorithm

Active possible points include only signals the user saved:
  target_degree_level_id present: +35 possible
  at least one preferred subject: +30 possible
  at least one preferred country: +25 possible
  budget_max + budget_currency present: +10 possible

If possible points equals 0:
  The page shows the sparse-profile/refine-preferences state and does not rank
  arbitrary programs.

Candidate scoring:
  Degree level match:
    program.degree_level_id === profile.target_degree_level_id => +35

  Country match:
    program.country_id in saved preferred countries => +25

  Subject match:
    program.primary_subject_id in saved preferred subjects => +30
    otherwise any matching program_subjects.subject_id => +24

  Budget:
    budget signal requires profile.budget_max and profile.budget_currency.
    Program tuition currency must match the saved budget currency.
    tuition_max_amount <= budget_max => +10
    tuition_min_amount <= budget_max when max is missing or above budget => +5
    Missing tuition, currency mismatch, or above-budget tuition produces warnings
    rather than eligibility/fit claims.

Percentage:
  Math.round(points / possiblePoints * 100)

Filtering and ranking:
  Only programs with points > 0 are displayed.
  Sort order: points desc, percentage desc, reasons count desc, title asc.
  Renders top 20 matches.

---

### Match Reasons / Warnings

Reasons are deterministic and field-backed:
  Matches your target degree level.
  In one of your preferred countries.
  Matches one of your preferred subjects.
  Tuition appears within your saved budget.
  Tuition may partially fit your saved budget.

Warnings are conservative:
  Tuition data is missing; confirm costs with the university.
  Tuition currency differs from your saved budget currency.
  Tuition may be above your saved budget.
  Admission requirements should be verified with the official program source.
  English requirements should be verified with the official program source.

The page does not claim admission chance, eligibility, scholarship likelihood,
or visa outcomes.

---

### Result Page UX

/fit-finder/result remains noindex.

Logged-in usable-profile state:
  Heading: Possible program matches.
  Subtext: Based on your saved Fit Finder preferences.
  Disclaimer: These are rule-based matches, not admission guarantees.
  Links:
    Update preferences -> /fit-finder
    Browse all programs -> /programs

Each match card shows:
  match score percentage
  title linked to /programs/[slug]
  university linked to /universities/[slug] when available
  country/city
  degree level
  subject
  study mode, delivery mode, language when available
  tuition range when available
  match reasons
  warnings
  official-source reminder
  official_url link when available

Empty states:
  Anonymous: sign-in/save guidance.
  No saved profile: link to /fit-finder.
  Sparse profile: asks user to add degree/country/subject/budget preferences.
  No scored matches: suggests updating preferences or browsing all programs.
  Query error: logs server-side and shows a generic user-facing message.

---

### Explicit Exclusions

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
No React.
No client-side JS.
No admin changes.
No anonymous persistence.
No src/lib/ai changes.
No profile IDs in URLs or rendered output.
No additional_notes display.

---

### Validation Results

npm run build:
  PASS (Cloudflare server build, 1.54s, zero errors)

service_role search:
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE"
  Result: 0 matches

AI usage search:
  Get-ChildItem -Path src/pages/fit-finder -Recurse -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder_results|ai_finder_program_matches|ai_usage_logs"
  Result: 0 matches

---

### Manual Test Checklist

1. GET /fit-finder/result anonymous -> sign-in/save guidance renders.
2. Anonymous result page links to /login?redirect=/fit-finder and /fit-finder.
3. Logged-in user without student profile -> "No saved Fit Finder profile yet."
4. Logged-in sparse profile -> refine-preferences state renders.
5. Logged-in profile with target degree -> matching published programs can score degree points.
6. Logged-in profile with preferred countries -> matching published programs can score country points.
7. Logged-in profile with preferred subjects -> primary_subject_id can score 30 points.
8. Logged-in profile with preferred subjects -> program_subjects can score 24 points.
9. Matching continues if program_subjects query fails, using primary_subject_id only.
10. budget_max + budget_currency within tuition max -> budget reason and +10 points.
11. budget_max + budget_currency overlapping tuition min -> partial budget reason and warning.
12. Missing tuition -> warning only, no budget points.
13. Currency mismatch -> warning only, no budget points.
14. No programs with points > 0 -> no scored matches state renders.
15. Result cards link to /programs/[slug].
16. University links point to /universities/[slug] when the joined university is visible.
17. Draft/in_review/unpublished/archived programs do not appear.
18. No profile id appears in the URL or rendered page.
19. No additional_notes content appears on the result page.
20. /fit-finder save flow still redirects to /fit-finder/result.

---


## 2026-06-17 - Phase 19: Fit Finder / Student Profile Input Foundation

Tool:
Codex

Goal:
Create the first public Fit Finder input foundation for DegreeWiki. Store structured
student preferences for logged-in users only. No AI calls, no matching engine, no
chatbot, no AI Finder result writes, no migrations, no new dependencies, no React,
no client-side JS, no admin changes, and no service_role.

---

### Files Changed

Created:
  src/pages/fit-finder/index.astro
  src/pages/fit-finder/result.astro

Modified:
  src/components/public/PublicNav.astro
  docs/06-status.md
  docs/07-task-log.md

Not modified:
  src/lib/ai/*
  supabase/migrations/*
  src/pages/admin/*
  package.json
  src/lib/supabase/server.ts

---

### Schema / RLS Findings

Migration 011 confirmed:
  student_profiles stores schema-backed student preferences and supports two owner modes:
    logged-in: user_id set, is_anonymous=false, session_token NULL
    anonymous: user_id NULL, is_anonymous=true, session_token set, expires_at set

Logged-in writes are supported by existing authenticated RLS:
  student_profiles INSERT/UPDATE require user_id = auth.uid(), is_anonymous=false,
  and session_token NULL.
  student_profile_subjects and student_profile_countries allow logged-in users to
  insert/update/delete rows only when the parent student_profiles row belongs to auth.uid().

Anonymous rows are intentionally not browser-accessible through RLS. Anonymous persistence
is deferred to a later security-reviewed phase because it requires a privileged server path.

---

### Routes Added

/fit-finder:
  Public SSR form. GET renders for everyone. POST validates server-side.
  Logged-in users can save preferences. Anonymous users see a sign-in required message
  and no data is saved.

/fit-finder/result:
  PublicLayout page with noindex=true. Generic placeholder only:
  "Your preferences have been saved. Program matching will be added in the next phase."
  Links to /programs and /fit-finder.

---

### Form Fields Implemented

student_profiles fields:
  current_country_id
  target_degree_level_id
  budget_min
  budget_max
  budget_currency
  gpa
  english_score_type
  english_score
  work_experience_years
  study_start_preference
  additional_notes

Junction fields:
  student_profile_subjects[]
  student_profile_countries[]

Lookup data:
  countries: id, name
  degree_levels: id, name, display_order
  subjects: id, name

The route does not collect name, email, phone, passport details, documents, address,
date of birth, visa data, or financial documents.

---

### Validation Behavior

Validation is server-side only.

Rules:
  UUID fields must match UUID shape and exist in loaded lookup lists.
  budget_min and budget_max must be non-negative when provided.
  budget_max must be greater than or equal to budget_min when both are provided.
  gpa must be non-negative when provided.
  english_score must be non-negative when provided.
  work_experience_years must be a non-negative whole number when provided.
  budget_currency is trimmed, uppercased, and capped.
  english_score_type and study_start_preference are trimmed and capped.
  additional_notes is trimmed/capped and the UI warns against sensitive personal data.

Invalid submissions re-render /fit-finder with errors and entered values preserved.
Lookup query failures log server-side and default to [] so the page remains renderable.

---

### Logged-In Insert / Update Strategy

The route uses the existing Supabase SSR client and supabase.auth.getUser().

On valid logged-in POST:
  1. Select the newest existing student_profiles row for user_id = user.id and is_anonymous=false.
  2. Update that row if it exists, otherwise insert a new row with:
       user_id = user.id
       is_anonymous = false
       session_token = null
  3. Do not accept profile_id from the form.
  4. Do not expose the profile UUID in the URL, hidden inputs, or rendered page.
  5. Replace student_profile_subjects rows for that profile and assign preference_rank
     from posted order.
  6. Replace student_profile_countries rows for that profile and assign preference_rank
     from posted order.
  7. Redirect to /fit-finder/result.

All writes go through existing RLS with the authenticated user session.

---

### Anonymous Behavior

GET /fit-finder renders the same form for anonymous users.

POST /fit-finder while logged out:
  Does not save.
  Does not create a session_token.
  Does not create cookies.
  Does not create student_profiles rows.
  Re-renders the form with a sign-in required message linking to /login?redirect=/fit-finder.

Anonymous persistence is deferred because the existing schema intentionally requires a
security-reviewed privileged server path for anonymous profile rows.

---

### Explicit Exclusions

No AI calls.
No matching engine.
No chatbot.
No ai_finder_results writes.
No ai_finder_program_matches writes.
No src/lib/ai imports.
No migrations.
No new dependencies.
No React.
No client-side JS.
No admin changes.
No service_role.

---

### Validation Results

npm run build:
  PASS (Cloudflare server build, 1.48s, zero errors)

service_role search:
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE"
  Result: 0 matches

AI usage grep:
  Get-ChildItem -Path src/pages/fit-finder -Recurse -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder_results|ai_finder_program_matches"
  Result: 0 matches

---

### Manual Test Checklist

1. GET /fit-finder anonymous — form renders.
2. POST /fit-finder anonymous — no save; sign-in required message appears.
3. Sign-in link points to /login?redirect=/fit-finder.
4. GET /fit-finder logged in — form renders.
5. POST valid logged-in form — profile saves and redirects to /fit-finder/result.
6. POST valid logged-in form a second time — existing profile updates instead of creating a new one.
7. Selected subjects replace prior student_profile_subjects rows.
8. Selected countries replace prior student_profile_countries rows.
9. Invalid UUID submission re-renders with an error and no save.
10. Negative budget/GPA/English score/work experience values re-render with errors.
11. budget_max lower than budget_min re-renders with an error.
12. /fit-finder/result renders noindex placeholder with links to /programs and /fit-finder.
13. Public nav shows Fit Finder and existing links still work.
14. No profile UUID appears in the URL, hidden inputs, or rendered result page.

---


## 2026-06-17 - Phase 18: AI Gateway + AI Safety Architecture

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Create the first safe AI foundation for DegreeWiki: server-only AI gateway architecture,
provider abstraction, safety/guardrail system, system prompt boundaries, typed request/
response contracts, usage logging and rate-limit placeholders, and updated AI docs.
No public chatbot UI, no Fit Finder UI, no live LLM calls, no external API calls,
no public AI endpoint, no migrations, no new dependencies, no service_role.

---

### AI Schema Inspected

Migration 012 (ai_tables.sql) — all five AI tables confirmed present and correct:
  ai_finder_results       — one record per Finder run, server-only write RLS
  ai_finder_program_matches — ranked real programs inside a Finder result (FK to programs)
  ai_conversations        — chat session, logged-in RLS + anonymous via service role
  ai_messages             — individual messages, server-only write RLS
  ai_usage_logs           — immutable cost/token audit log, service role only

Migration 011 (student_profiles.sql) — confirmed:
  student_profiles        — preferences + anonymous session_token + expires_at
  student_profile_subjects
  student_profile_countries

No migrations needed. All AI tables were already in place.

---

### Files Created

src/lib/ai/types.ts
src/lib/ai/gateway.ts
src/lib/ai/providers/interface.ts
src/lib/ai/providers/gemini.ts
src/lib/ai/prompts/finder-summary.ts
src/lib/ai/prompts/chat-answer.ts
src/lib/ai/safety/guardrails.ts
src/lib/ai/usage/logging.ts
src/lib/ai/usage/limits.ts

### Files Modified

.env.example — added GEMINI_API_KEY, AI_PROVIDER, AI_MODEL, AI_RATE_LIMIT_ANON_DAILY,
  AI_RATE_LIMIT_USER_DAILY with server-only annotations
docs/04-ai-system.md — replaced structural sketch with finalized Phase 18 architecture
docs/06-status.md — Phase 18 entry added, current phase set to Phase 19
docs/07-task-log.md — this entry

### Files NOT Modified

src/env.d.ts — does not exist in this project. AIRuntimeEnv interface in types.ts
  covers AI env var typing for the AI module. No wrangler.toml changes.
wrangler.toml — not modified per scope.
package.json — not modified. No new dependencies.
Supabase migrations — not modified.
Public pages — not modified.
Admin pages — not modified.

---

### AI Architecture Decisions

Database-first rule enforced via type:
  AIContext is a required parameter to callAI(). It cannot be null or omitted.
  Caller must retrieve real database records before calling the gateway.
  The LLM receives only records in AIContext.records — it cannot access the DB directly.

Gateway (gateway.ts):
  Single server-only entry point for all LLM calls.
  Order: checkInput → checkRateLimit → (Phase 19: provider call) → fallback.
  Phase 18: returns controlled fallback "AI provider is not enabled in this phase."
  TODO Phase 19 block marks exact steps: provider resolution, prompt build,
  output guardrails, usage logging.

Provider strategy:
  AIProvider interface (providers/interface.ts) defines the contract.
  All implementations must use fetch() only — no Node http/https. Cloudflare compatible.
  GeminiProvider stub (providers/gemini.ts) throws on complete() — no fetch calls in Phase 18.
  No OpenRouter stub in Phase 18 (deferred per scope).

Prompt boundaries:
  finder-summary.ts and chat-answer.ts both embed a hardcoded system prompt.
  System prompt rules: use only DegreeWiki context, do not invent facts,
  do not guarantee admission/scholarship/visa outcomes, advise official source verification,
  state when context is insufficient.
  User input goes in the user turn only — never interpolated into the system turn.

Guardrails (safety/guardrails.ts):
  checkInput(): deterministic regex — blocks fake documents, essay ghostwriting,
    immigration fraud, visa fraud before any LLM call.
  checkOutput(): deterministic regex — blocks guaranteed admission/scholarship/visa
    claims in LLM output before returning to caller.
  Conservative exact-phrase matching. Not a complete safety system.
  Semantic moderation deferred.

Usage logging (usage/logging.ts):
  writeUsageLog() defined with full AIUsageEntry signature.
  Phase 18: no-op body. No service role import.
  TODO Phase 19: insert into ai_usage_logs via service role client.

Rate limiting (usage/limits.ts):
  checkRateLimit() defined with (userId, sessionType) signature.
  Phase 18: always returns { allowed: true, remaining: 99 }.
  TODO Phase 19: query ai_usage_logs for today's count, enforce env var limits.

Env strategy:
  GEMINI_API_KEY and all AI vars are server-only. No PUBLIC_ prefix.
  Cloudflare Workers: accessed via locals.runtime.env.
  AIRuntimeEnv interface in types.ts covers typing for the AI module.
  src/env.d.ts does not exist — not created per scope rule.
  wrangler.toml not modified — GEMINI_API_KEY should be set via:
    wrangler secret put GEMINI_API_KEY

---

### Explicit Exclusions

No public chatbot UI.
No Fit Finder UI.
No live LLM calls.
No external AI API calls.
No public AI endpoint (health.ts removed from scope).
No migrations.
No new npm dependencies.
No service_role usage anywhere in Phase 18.
No React or client-side JS.
No admin changes.
No src/pages/api/ai/health.ts.
No providers/openrouter.ts.
No src/env.d.ts creation.
No wrangler.toml changes.

---

### Build Result

npm run build: PASS
  Cloudflare server build, 1.75s, zero errors, zero warnings relevant to new code.

### service_role Search Result

Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role"
  → 0 matches.

### PUBLIC_ Misuse Search Result

Get-ChildItem -Path src/lib/ai -Recurse -File | Select-String -Pattern "PUBLIC_"
  → 2 matches: both are comments in types.ts and gemini.ts explicitly warning
    against using PUBLIC_ for AI secrets. No actual PUBLIC_ usage.

---

### Manual Test Checklist

The following can be verified locally after setting GEMINI_API_KEY in .env.local:

[ ] npm run build passes with zero errors.
[ ] service_role search: 0 matches in src/.
[ ] PUBLIC_ misuse search: 0 actual uses (only warning comments) in src/lib/ai/.
[ ] src/lib/ai/ directory created with all 9 files present.
[ ] types.ts exports: AISessionType, AIRole, StudentProfileSummary, AIContext,
    AIRequest, AIResponse, AIPrompt, AIProviderConfig, AIProviderResponse,
    AIUsageEntry, AIGuardrailResult, AIRuntimeEnv.
[ ] gateway.ts imports resolve cleanly (no circular deps).
[ ] guardrails.ts checkInput("fake recommendation letter") returns { passed: false }.
[ ] guardrails.ts checkOutput("guaranteed admission") returns { passed: false }.
[ ] guardrails.ts checkInput("which universities are in Germany?") returns { passed: true }.
[ ] .env.example contains GEMINI_API_KEY, AI_PROVIDER, AI_MODEL, rate limit vars.
[ ] No GEMINI_API_KEY or AI provider secret is prefixed with PUBLIC_.
[ ] docs/04-ai-system.md shows finalized structure (not the old sketch).
[ ] No public AI page is accessible at any route.

---


## 2026-06-16 - Phase 17: Source / Verification Display Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Add a lightweight Source & Verification display box to all four public detail pages using
existing entity row fields only. No admin changes, no migrations, no new dependencies,
no React, no client-side JS, no AI, no service_role, no set:html, no schema.org data.

---

### Files Changed

src/components/public/SourceBox.astro (created)
src/pages/programs/[slug].astro (modified)
src/pages/scholarships/[slug].astro (modified)
src/pages/universities/[slug].astro (modified)
src/pages/guides/[slug].astro (modified)

---

### Source Table Decision

data_sources, source_snapshots, verification_events, and data_quality_checks are
intentionally NOT queried in any public page. All four tables (migration 009) have
RLS policies that block anonymous and regular authenticated user access — SELECT
requires view_data_quality, manage_data_sources, or super_admin. These tables contain
internal admin-only provenance and data-quality data. Only entity row columns are used.

---

### Fields Used Per Entity

programs:
  verification_status (existing), last_verified_at (added to SELECT),
  source_confidence_score (added to SELECT), official_url (existing, passed as officialUrl).

scholarships:
  verification_status (existing), last_verified_at (added to SELECT),
  source_confidence_score (added to SELECT),
  official_url ?? provider_url (existing, passed as officialUrl).

universities:
  verification_status (existing), last_verified_at (added to SELECT),
  source_confidence_score (added to SELECT), official_url (existing, passed as officialUrl).

articles (guides):
  verification_status (existing), source_confidence_score (added to SELECT).
  lastVerifiedAt=null — articles table (migration 008) has no last_verified_at column.
  officialUrl=null — articles have no official URL field.

data_completeness_score: NOT fetched and NOT displayed — internal editorial metric.

---

### SourceBox Component Behavior

File: src/components/public/SourceBox.astro

Props:
  verificationStatus: string | null
  lastVerifiedAt: string | null       (pre-formatted display string from formatDate())
  officialUrl: string | null
  sourceConfidenceScore: number | null

Status line mapping (omitted when null/unknown):
  verified           → "Verified by DegreeWiki"
  partially_verified → "Partially verified"
  source_conflict    → "Source conflict under review"
  outdated           → "May need updating"
  needs_review       → "Needs review"
  unverified         → "Not yet verified"

Last verified line: shown only when lastVerifiedAt is non-null.
Source confidence line: shown only when sourceConfidenceScore > 0.
  ≥75 → High, ≥40 → Medium, 1–39 → Low.
Official source link: shown only when officialUrl is non-null; target="_blank" rel="noopener noreferrer".
Disclaimer: always shown — "Always confirm important details — including deadlines, fees,
  and eligibility requirements — directly with the official university, scholarship provider,
  or government/source website before applying."
No set:html used anywhere.

---

### Page Integration Summary

All four pages:
  SourceBox rendered after main content/CTA sections, before the "Last updated" line
  and the bottom back-navigation link.
  Existing near-title verification badge (green/yellow/orange badge map) unchanged.
  Existing "Last updated:" line position unchanged.
  The `lastVerifiedAt` value is computed from formatDate(entity.last_verified_at)
  in each page's frontmatter before being passed to SourceBox.

---

### Public Wording / Disclaimer

Status labels use plain English, not internal enum values.
Source confidence signal uses plain High/Medium/Low text — no score integers exposed.
Disclaimer is factual, non-alarming, and consistent with standard educational publishing practice.
Official source link uses the generic label "Official source ↗" on all entities
to keep the component entity-type-agnostic.

---

### SEO / 404 Preservation

Phase 15 canonical/ogTitle/ogDesc computation and PublicLayout call signature: unchanged on all pages.
content_status='published' filter preserved on all entity queries.
All four pages still return new Response(null, { status: 404 }) when entity not found.
SourceBox is rendered in the template body, after the 404 guard — never reached for 404 paths.
No new Supabase queries introduced.

---

### Build Result

npm run build: PASS (Cloudflare server build, 1.55s, zero errors, zero warnings).

---

### service_role Result

Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

---

### Manual Test Checklist

1. GET /programs/[published-slug] → SourceBox renders; heading "Source & Verification" visible.
2. Programs: verified entity → "Status: Verified by DegreeWiki" line visible.
3. Programs: unverified entity → "Status: Not yet verified" line visible.
4. Programs: entity with last_verified_at set → "Last verified: [date]" line visible.
5. Programs: entity with last_verified_at null → no "Last verified" line.
6. Programs: entity with source_confidence_score=0 → no "Source confidence" line.
7. Programs: entity with source_confidence_score=80 → "Source confidence: High".
8. Programs: entity with official_url set → "Official source ↗" link visible, opens in new tab.
9. Programs: entity with official_url=null → no "Official source" link.
10. Programs: disclaimer always visible in SourceBox regardless of entity state.
11. GET /scholarships/[published-slug] → SourceBox renders; provider_url used as fallback
    when official_url is null.
12. GET /universities/[published-slug] → SourceBox renders.
13. GET /guides/[published-slug] → SourceBox renders; no "Last verified" line;
    no "Official source" link; disclaimer present.
14. All pages: existing near-title verification badge unchanged (green/yellow/orange).
15. All pages: "Last updated:" line still present below SourceBox.
16. All pages: back links still present.
17. GET /programs/nonexistent-slug → 404 (no regression).
18. GET /scholarships/nonexistent-slug → 404 (no regression).
19. GET /universities/nonexistent-slug → 404 (no regression).
20. GET /guides/nonexistent-slug → 404 (no regression).
21. View page source on any detail page → <link rel="canonical"> correct (SEO not regressed).
22. GET /admin/ unauthenticated → redirects to /login (no admin regression).

---

### Explicit Exclusions

No list/search page changes.
No admin CRUD changes.
No migrations.
No new npm dependencies.
No React or client-side JS.
No AI.
No data_sources, source_snapshots, verification_events, or data_quality_checks queries in public pages.
No data_completeness_score displayed publicly.
No schema.org / JSON-LD structured data.
No report form, saved items, or user dashboard.
No media/Cloudinary work.
No markdown renderer or set:html.
No service_role in src/ (0 matches confirmed).

---


## 2026-06-16 - Phase 16: Public Detail Page Polish

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Polish all four public detail pages (programs, scholarships, universities, guides/articles)
for improved readability, usability, and trustworthiness. No migrations, no new dependencies,
no React, no client-side JS, no AI, no service_role, no set:html, no markdown renderer.

---

### Files Changed

src/pages/programs/[slug].astro (modified)
src/pages/scholarships/[slug].astro (modified)
src/pages/universities/[slug].astro (modified)
src/pages/guides/[slug].astro (modified)

---

### Route Improvements

programs/[slug]:
  - Added verification_status, updated_at to Supabase select.
  - Added secondary program_intakes query after 404 check (defaults to [] on error).
  - Intakes section renders when rows exist; omitted when empty. Shows intake_name,
    open date, deadline date, deadline_text, deadline_status badge, is_rolling, notes.
  - Intake status badges: open (green), closing_soon (orange), closed (gray), rolling (blue).
  - Replaced JSON.stringify/<pre> block for english_requirements with a readable <ul>:
    Object.entries() over JSONB — test name uppercased, properties joined as "key: value".
    Falls back to plain notice if JSONB shape is unexpected.
  - Removed official_url/application_url from key facts <dl>; moved to CTA block.
  - CTA block: "Apply Now ↗" (blue filled) + "Official Program Page ↗" (border ghost).
  - Section order: Key Facts → Admission Requirements → English Requirements →
    Tuition Notes → Application Fee → Intakes & Deadlines → Curriculum → Career Outcomes
    → CTA block → Last updated → Back link.
  - Added bottom back link (← All Programs).

scholarships/[slug]:
  - Added verification_status, updated_at to Supabase select.
  - Fixed deadline_text condition: now renders whenever s.deadline_text exists,
    even when s.deadline (structured date) is null.
  - Removed official_url/application_url/provider_url from key facts <dl>; moved to CTA block.
  - CTA block: "Apply Now ↗" (blue), "Official Scholarship Page ↗" (ghost),
    "Provider Website ↗" (ghost).
  - Added bottom back link.

universities/[slug]:
  - Added verification_status, updated_at to Supabase select.
  - Removed official_url from key facts <dl>; moved to CTA block.
  - CTA block: "Visit Official Website ↗" (border ghost).
  - Added "Browse Programs at [name] →" link → /programs?university={u.id}.
  - Added bottom back link.

guides/[slug]:
  - Added verification_status, updated_at to Supabase select.
  - Changed article_categories(name, slug) → article_categories(id, name, slug).
  - Category badge is now a link → /guides?category={id} when category id exists.
    Falls back to non-linked span if id absent.
  - Added bottom back link.

---

### Verification / Updated_at Behavior

Verification badge (programs, scholarships, universities, articles):
  verified → "Verified" (green badge)
  partially_verified → "Partially Verified" (yellow badge)
  source_conflict/outdated/needs_review → "Under Review" (orange badge)
  unverified → no badge rendered
  All Tailwind class strings are complete literals in a static lookup object.
  Placement: below h1, above key facts dl.

Last updated (all four pages):
  updated_at queried and formatted as "Last updated: Month D, YYYY".
  Rendered in small muted gray text near the page bottom, above back link.
  Omitted when updated_at is null.

---

### CTA Strategy

URL fields moved out of key facts <dl> into dedicated CTA blocks.
Primary CTA (apply): blue filled button. Secondary CTAs (official, provider): border ghost buttons.
All CTA links use target="_blank" rel="noopener noreferrer".
CTA block omitted entirely when no URLs exist on a record.

---

### Text / JSON Formatting

english_requirements (programs): previously JSON.stringify in <pre>; now <ul> with human-readable
test names and properties. Fallback to plain notice on unexpected shape. No set:html.

Text columns (curriculum, overview, eligibility, etc.): whitespace-pre-wrap preserved.
Date fields: toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }).

---

### Intakes Query Behavior

Secondary query: program_intakes by program.id, ASC by deadline, limit 10.
Runs only after main program query returns a row (after 404 check).
Defaults to [] on error — never crashes the page.
Section shown only when at least one row is returned.

---

### SEO / 404 Preservation

Phase 15 canonical/ogTitle/ogDesc computation and PublicLayout call signature: unchanged.
content_status='published' filter preserved on all queries.
404 behavior: all four pages return new Response(null, { status: 404 }) when entity not found.
program_intakes query only runs after the 404 check passes.

---

### Build Result

npm run build: PASS (Cloudflare server adapter, 1.49s, zero errors, zero warnings).

---

### service_role Result

Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

---

### Manual Test Checklist

1. GET /programs/[published-slug] → 200, h1 renders, dl has no Official Page or Apply rows.
2. Programs CTA block visible below Career Outcomes when official_url or application_url exist.
3. Programs CTA block absent when both URLs are null.
4. Programs english_requirements: <ul> list renders (not <pre>); fallback notice when null.
5. Programs intakes section: renders when rows exist; absent when no rows.
6. Verification badge: verified → green, unverified → no badge, partially_verified → yellow.
7. "Last updated:" line appears at bottom of all four page types.
8. GET /scholarships/[published-slug] → 200, dl has no URL rows; CTA block shows.
9. Scholarship deadline_text shows when deadline_text set but deadline (date) is null.
10. GET /universities/[published-slug] → 200; "Browse Programs at [name] →" link present.
11. Universities CTA shows "Visit Official Website ↗" when official_url exists.
12. GET /guides/[published-slug] → 200; category badge is an <a> tag linking to /guides?category=<uuid>.
13. GET /programs/nonexistent-slug → 404.
14. GET /scholarships/nonexistent-slug → 404.
15. GET /universities/nonexistent-slug → 404.
16. GET /guides/nonexistent-slug → 404.
17. Page source: <link rel="canonical"> correct on all detail pages (SEO not regressed).
18. GET /admin/ unauthenticated → redirects to /login.

---

### Explicit Exclusions

No list/search page changes.
No admin CRUD changes.
No migrations.
No new npm dependencies.
No React or client-side JS.
No markdown renderer or set:html.
No media/Cloudinary.
No junction table display (scholarship_countries, article_subjects, etc.).
No indexing_status noindex behavior on detail pages.
No author display on articles.
No comments, report form, saved items, or user dashboard.
No schema.org structured data.

---


## 2026-06-16 - Phase 15: Basic SEO System

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Add basic SEO infrastructure layer: robots.txt, dynamic sitemap.xml, SITE_URL helper,
canonical URL support, and OpenGraph/Twitter metadata in BaseLayout/PublicLayout.
Public page metadata cleanup for detail and list pages.
No admin changes, no migrations, no new dependencies, no React, no client-side JS,
no AI, no service_role.

---

### Files Created

public/robots.txt (new):
  Static robots file served by Cloudflare from public/.
  User-agent: * Allow: / Disallow: /admin/ /login /auth/ /api/
  Sitemap: https://degreewiki.com/sitemap.xml (hardcoded; static file has no env access).

src/lib/site.ts (new):
  Exports SITE_URL = (import.meta.env.PUBLIC_SITE_URL ?? 'https://degreewiki.com').replace(/\/$/, '')
  Consistent with existing PUBLIC_* env var convention.

src/pages/sitemap.xml.ts (new):
  Astro API endpoint (GET export). Returns application/xml; charset=utf-8 with Cache-Control: public, max-age=3600.
  Uses createClient(context.cookies, context.request) — anon key, RLS enforced, no service_role.
  Queries 4 tables in Promise.all: programs, scholarships, universities, articles.
  Filter per table: content_status='published' AND indexing_status='index'.
  Selects only: slug, updated_at.
  Static URLs always included: /, /programs, /scholarships, /universities, /guides (no lastmod).
  Detail URLs: /[type]/[slug] with updated_at date (YYYY-MM-DD) as lastmod.
  Articles mapped to /guides/[slug].
  XML-escaping applied to all loc and lastmod values via escXml() helper.
  Per-table error isolation: error → console.error, defaults to [] for that table only.
  Sitemap never returns a 500; always includes static URLs.

---

### Files Modified

.env.example:
  Added PUBLIC_SITE_URL= line.

src/layouts/BaseLayout.astro:
  Added props: canonical?, ogTitle?, ogDescription?, ogType?, ogUrl?
  Renders <link rel="canonical"> only when canonical is provided.
  New head tags: og:site_name, og:type (default 'website'), og:title (fallback to title),
    og:description (only if ogDescription ?? description is set),
    og:url (only if ogUrl ?? canonical is set).
  Twitter tags: twitter:card=summary, twitter:title, twitter:description (if available).
  No og:image, no twitter:image, no twitter:site.
  All props optional; existing title/description/noindex behavior unchanged.
  Admin pages (AdminLayout → BaseLayout) unaffected — all new props default to undefined.

src/layouts/PublicLayout.astro:
  Added same 5 new props to interface; passes all through to BaseLayout.

src/pages/index.astro:
  Added import SITE_URL from lib/site.
  Added canonical={SITE_URL + '/'} to PublicLayout call.
  OG title/description derived via BaseLayout fallbacks (no explicit ogTitle/ogDescription needed).

src/pages/programs/index.astro:
  Added import SITE_URL.
  Added canonical={SITE_URL + '/programs'} to PublicLayout.
  Canonical always points to clean base path — filtered URLs keep noindex={hasFilters} (existing).

src/pages/scholarships/index.astro:
  Same pattern as programs. canonical={SITE_URL + '/scholarships'}.

src/pages/universities/index.astro:
  Same pattern. canonical={SITE_URL + '/universities'}.

src/pages/guides/index.astro:
  Same pattern. canonical={SITE_URL + '/guides'}.

src/pages/programs/[slug].astro:
  Added import SITE_URL.
  Added canonical_url, og_title, og_description to Supabase .select().
  Computed: canonical = p.canonical_url || SITE_URL+'/programs/'+slug
            ogTitle   = p.og_title || pageTitle
            ogDesc    = p.og_description || pageDesc
  PublicLayout call updated with canonical, ogTitle, ogDescription props.

src/pages/scholarships/[slug].astro:
  Same pattern. canonical = s.canonical_url || SITE_URL+'/scholarships/'+slug.

src/pages/universities/[slug].astro:
  Same pattern. canonical = u.canonical_url || SITE_URL+'/universities/'+slug.

src/pages/guides/[slug].astro:
  Same pattern. canonical = a.canonical_url || SITE_URL+'/guides/'+slug.

---

### robots Strategy

Static public/robots.txt. Cloudflare serves directly from public/.
Allows all user agents. Disallows /admin/, /login, /auth/, /api/.
Sitemap URL hardcoded to production (static files cannot read env vars).

---

### sitemap Strategy

Dynamic SSR endpoint — required because published record slugs are only known at request time.
@astrojs/sitemap not used (generates static list; cannot query DB for published+index slugs).
4 parallel Supabase queries, anon key, RLS enforced.
Uniform filter: content_status='published' AND indexing_status='index' on all 4 tables.
All records default to indexing_status='draft' — admin must explicitly set 'index' per record
before it appears in the sitemap. This is intentional.
If no records have indexing_status='index', sitemap returns only the 5 static URLs. Not an error.

---

### Canonical Strategy

List/index pages: SITE_URL + path (no trailing slash except homepage which uses '/').
Filtered list pages: same clean canonical — query params stripped. noindex meta unchanged.
Detail pages: DB canonical_url if present, else SITE_URL + '/[type]/' + slug.
Canonical rendered in BaseLayout as <link rel="canonical"> only when prop provided.
Admin pages: canonical not passed → no canonical tag rendered. Correct.

---

### OG/Twitter Strategy

og:site_name = DegreeWiki (always).
og:type = 'website' for all pages in Phase 15.
og:title fallback chain: ogTitle prop → title prop → 'DegreeWiki'.
og:description rendered only when ogDescription ?? description is truthy.
og:url rendered only when ogUrl ?? canonical is truthy.
twitter:card = summary. twitter:title same as og:title. twitter:description same logic.
No og:image or twitter:image (Cloudinary integration pending).
No twitter:site (no handle confirmed).
Detail pages: og_title, og_description queried from DB; fallback to pageTitle/pageDesc.
List pages: no explicit ogTitle/ogDescription passed; BaseLayout uses title/description fallbacks.

---

### Indexing/noindex Behavior

robots.txt: coarse-grained path-level directives for crawlers.
sitemap.xml: only content_status='published' AND indexing_status='index' rows.
noindex meta: filtered list pages still emit <meta name="robots" content="noindex, follow"> via existing noindex prop. Unchanged.
Clean canonical on filtered pages: canonical always points to the unfiltered URL even when noindex is true.

---

### Environment Variable Update

PUBLIC_SITE_URL added to .env.example (empty).
Set PUBLIC_SITE_URL=http://localhost:4321 in local .env.local (not committed).
Set PUBLIC_SITE_URL=https://degreewiki.com in Cloudflare Pages dashboard for production.
SITE_URL constant falls back to 'https://degreewiki.com' if env var absent — safe for CI builds.

---

### Build Result

npm run build: PASS (Cloudflare server build, 1.42s, zero errors, zero warnings relevant to Phase 15).

---

### service_role Search Result

Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

---

### Manual Test Checklist

1. GET /robots.txt — file exists, correct text/plain content, Disallow rules present, Sitemap line present.
2. GET /sitemap.xml — 200 OK, Content-Type application/xml, valid XML, <urlset> root,
   5 static URLs present (/, /programs, /scholarships, /universities, /guides).
3. Detail URLs appear in sitemap only for records with content_status='published' AND indexing_status='index'.
   If no such records exist, sitemap returns only 5 static URLs — not an error.
4. View source on homepage (/) — <link rel="canonical"> present, og:site_name, og:type, og:title,
   og:url, twitter:card, twitter:title all present.
5. View source on /programs (no filters) — <link rel="canonical" href="...degreewiki.com/programs">,
   no noindex meta tag.
6. View source on /programs?q=test — canonical still points to .../programs (clean path),
   <meta name="robots" content="noindex, follow"> still present.
7. View source on a published program detail page — canonical tag, og:title, og:description
   (if description set), og:url, twitter tags all present.
8. View source on /admin — no canonical tag rendered (admin pages unaffected).
9. npm run build second run — still passes.

---

### Explicit Exclusions

No og:image or twitter:image (Cloudinary pending).
No twitter:site handle.
No schema.org / JSON-LD structured data.
No RSS feed or <link rel="alternate">.
No hreflang / alternate language links.
No og:type="article" for guides (deferred — requires article:published_time).
No sitemap index file.
No admin CRUD changes.
No migrations.
No new npm dependencies.
No SEO landing page generation.

---


## 2026-06-16 - Phase 14: Public Home Page Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Upgrade / from a bare auth-placeholder page into a real public-facing homepage with hero,
discovery cards, start-here block, and latest content sections.
No admin changes, no migrations, no new dependencies, no React, no client-side JS,
no AI, no saved items, no service_role.

---

### Files Changed

src/pages/index.astro (full replacement):
  Previous version: BaseLayout, inline nav list duplicating PublicNav, auth state check, bare links.
  New version: PublicLayout, hero, discovery cards, start-here block, latest programs/scholarships/guides
  sections (conditional), secondary auth/admin row.

---

### Homepage Sections

1. Hero
   Container: max-w-3xl, centered, py-16. White background with bottom border.
   h1: "DegreeWiki"
   Subtitle: "Find university programs, scholarships, and study-abroad guides for international students."
   CTA buttons: "Browse Programs" → /programs (primary blue), "Find Scholarships" → /scholarships (outlined).

2. Discovery cards
   Grid: 1 col mobile → 2 col sm → 4 col lg. max-w-5xl, py-12.
   Section heading: "Explore".
   Four cards (block <a> links): Programs /programs, Scholarships /scholarships,
   Universities /universities, Guides /guides. Each has title + one-line description.
   Hover: bg-gray-50, border-blue-300.

3. Start here block
   bg-gray-50 rounded panel. Section heading: "Start here".
   Four goal-framed plain links (plain section index URLs, no pre-filtered params):
     I want to study abroad → /programs
     I'm looking for scholarships → /scholarships
     I want to compare universities → /universities
     I need application advice → /guides

4. Latest programs (conditional — omitted when 0 rows)
   3-column grid. Section heading "Latest programs" + "Browse all programs →" link to /programs.
   Each card: title (blue, line-clamp-2) → /programs/[slug], university name, degree level badge.

5. Latest scholarships (conditional — omitted when 0 rows)
   3-column grid. Section heading "Latest scholarships" + "View all scholarships →" link.
   Each card: name (blue, line-clamp-2) → /scholarships/[slug], provider name, deadline badge (amber).

6. Latest guides (conditional — omitted when 0 rows)
   3-column grid. Section heading "Latest guides" + "View all guides →" link to /guides.
   Each card: category badge + published date, title (blue, line-clamp-2) → /guides/[slug], summary.

7. Auth/admin secondary row
   border-t border-gray-100, text-xs, text-gray-400.
   Signed in: email (gray-600), Admin dashboard link (blue-400), Logout form (red-400).
   Signed out: Sign in link (gray-400 → blue-500 on hover).

---

### Data Queries

All four queries run in Promise.all:

  supabase.auth.getUser()
  → user = authResult.data.user

  supabase.from('programs')
    .select('id, title, slug, universities(name), degree_levels(name)')
    .eq('content_status', 'published')
    .order('created_at', { ascending: false })
    .limit(3)
  → latestPrograms = latestProgramsData ?? []

  supabase.from('scholarships')
    .select('id, name, slug, provider_name, deadline, deadline_text')
    .eq('content_status', 'published')
    .order('created_at', { ascending: false })
    .limit(3)
  → latestScholarships = latestScholarshipsData ?? []

  supabase.from('articles')
    .select('id, title, slug, summary, published_at, article_categories(name)')
    .eq('content_status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(3)
  → latestGuides = latestGuidesData ?? []

Client: createClient(Astro.cookies, Astro.request). Anon key only. No service_role.
All errors default to []. Homepage never crashes due to a failed query.

Helper functions:
  formatDate(d) — published_at → "Month Day, Year" (en-US locale). Returns null if d is null.
  formatDeadline(d, dt) — deadline date → "Mon Day, Year"; falls back to deadline_text; null if both absent.

---

### Auth/Admin Link Behavior

supabase.auth.getUser() result used only for the secondary footer row.
Signed in: renders "Signed in as {email}" + Admin dashboard link + Logout form (POST /api/auth/logout).
Signed out: renders "Sign in" link → /login.
Inline nav list from the old index.astro removed — PublicLayout provides PublicNav automatically.
No duplicate nav links.

---

### SEO/Meta Behavior

title:       "DegreeWiki — Find Degrees, Scholarships & University Guides"
description: "Discover university programs, scholarships, and study-abroad guides for international students."
noindex:     not passed — homepage is fully indexable.
BaseLayout renders <meta name="description"> when description prop is set (behavior from Phase 09).
No canonical, OpenGraph, robots.txt, sitemap, or structured data added.

---

### Build Result

  npm run build: PASS
  Cloudflare server build, 1.36s, zero errors, zero warnings (Sharp warning is pre-existing).

---

### service_role Result

  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

---

### Manual Test Checklist

1. GET / — page loads, PublicNav appears (DegreeWiki logo + 4 nav links), no duplicate nav.
2. Hero visible: "DegreeWiki" h1, subtitle, two CTA buttons.
3. "Browse Programs" button → /programs.
4. "Find Scholarships" button → /scholarships.
5. Discovery cards visible: Programs, Scholarships, Universities, Guides, all with descriptions.
6. Programs card → /programs. Scholarships → /scholarships. Universities → /universities. Guides → /guides.
7. "Start here" block visible with all four goal links.
8. Start here: "I want to study abroad" → /programs.
9. Start here: "I'm looking for scholarships" → /scholarships.
10. Start here: "I want to compare universities" → /universities.
11. Start here: "I need application advice" → /guides.
12. Latest programs section: if published programs exist, 3 cards show title, university, degree badge.
13. Program card title link → /programs/[slug].
14. "Browse all programs →" link → /programs.
15. Latest scholarships section: if published scholarships exist, 3 cards show name, provider, deadline badge.
16. Scholarship card name link → /scholarships/[slug].
17. "View all scholarships →" link → /scholarships.
18. Latest guides section: if published guides exist, 3 cards show category, date, title, summary.
19. Guide card title link → /guides/[slug].
20. "View all guides →" link → /guides.
21. Empty database: hero, discovery cards, start-here block all render; latest sections absent (no "no content" messages).
22. Card with null university/degree/provider/deadline — optional fields absent with no crash.
23. Card with null published_at on article — no date shown, no crash.
24. Auth signed-out: small "Sign in" link visible in footer row, no admin link.
25. Auth signed-in: "Signed in as {email}" + "Admin dashboard" link + "Logout" button visible.
26. Logout button submits POST to /api/auth/logout.
27. Admin dashboard link → /admin.
28. <title> in page source = "DegreeWiki — Find Degrees, Scholarships & University Guides".
29. <meta name="description"> present with correct content.
30. No <meta name="robots"> tag on homepage.
31. GET /programs — no regression.
32. GET /scholarships — no regression.
33. GET /universities — no regression.
34. GET /guides — no regression.
35. GET /admin/ unauthenticated — still redirects to /login (no admin regression).

---

### Explicit Exclusions

- No search bar, autocomplete, or global search.
- No personalized homepage, saved items, or user dashboard.
- No AI features.
- No sitemap, robots.txt, canonical, OpenGraph, or structured data (future SEO phase).
- No latest universities section (no published_at on universities; created_at ordering unsuitable for homepage).
- No React or client-side JavaScript of any kind.
- No migrations.
- No service_role in src/ (0 matches confirmed).
- No new npm dependencies.
- No PublicNav.astro changes.
- No BaseLayout.astro changes.
- No PublicLayout.astro changes.
- No public search/detail page changes.
- No admin page changes.

---


## 2026-06-16 - Phase 13: Public Guides Search / Category Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Upgrade /guides from a basic published-guide list into a server-rendered guide discovery
page with GET-form search and category filter.
No admin changes, no migrations, no new dependencies, no React, no client-side JS,
no AI, no saved items, no service_role.

---

### Files Changed

src/pages/guides/index.astro (full replacement):
  Previous version: single Supabase query, card list, LIMIT 100, no filters, no search.
  New version: GET filter form, 2 conditional filters, card result list, result count,
  over-limit notice, two empty states, noindex logic, category lookup query.

---

### Schema Findings

articles table (migration 008) confirmed columns available for filtering:
  title (text) — searchable via ilike
  summary (text, nullable) — searchable via ilike in .or()
  article_category_id (uuid FK → article_categories) — filterable by UUID

Column NOT present in schema v1 — no migration added:
  article_type — does not exist

GIN index confirmed: idx_articles_fts on to_tsvector('english', title || ' ' || coalesce(summary, ''))
  Used ilike/.or() for consistency with existing project pattern; GIN available for future optimisation.

article_categories table (migration 008):
  id, name, slug, parent_category_id (self-ref), display_order, created_at, updated_at.
  RLS: article_categories_select_public USING (true) — public anon SELECT always allowed.
  Dropdown ordered by display_order ASC, then name ASC.

---

### Query Params Implemented

  q        — articles.title ilike '%q%' OR articles.summary ilike '%q%'
             via .or('title.ilike.%q%,summary.ilike.%q%')
  category — articles.article_category_id = <uuid>

---

### Validation Behavior

  q:       trim(), replace(/[,()]/g, ''), slice(0, 100). Empty string → undefined (filter absent).
           Commas and parentheses removed to prevent breaking .or() string syntax.
  category: UUID regex (/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i). Invalid → undefined (filter absent).
  All failures are silent — no error messages, no crashes, filter treated as absent.

---

### Supabase Query Strategy

Lookup query (category dropdown):
  supabase.from('article_categories').select('id, name')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
  RLS USING (true) — all categories always visible to anon. Failed lookup defaults to [].

Articles main query:
  supabase.from('articles')
    .select('id, title, slug, summary, published_at, article_categories(id, name)',
            { count: 'exact' })
    .eq('content_status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('title', { ascending: true })
    .limit(201)
  Filters chained conditionally:
    if (q)          query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
    if (categoryId) query = query.eq('article_category_id', categoryId)
  overLimit = (count ?? allRows.length) > 200
  rows = allRows.slice(0, 200)

Client: createClient(Astro.cookies, Astro.request). Anon key only. No service_role.

---

### Noindex Behavior

  hasFilters = !!(q || categoryId)
  <PublicLayout noindex={hasFilters}>
  Filtered URLs (/guides?...) → <meta name="robots" content="noindex, follow">
  Unfiltered /guides → no robots meta tag, remains indexable.
  Uses existing noindex prop from Phase 10 (BaseLayout + PublicLayout). No layout changes needed.

---

### Build Result

  npm run build: PASS
  Cloudflare server build, 1.56s, zero errors, zero warnings (Sharp warning is pre-existing).

---

### service_role Result

  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

---

### Manual Test Checklist

1. GET /guides — blank form, all published guides listed (published_at DESC nulls last then title ASC), no noindex in source.
2. GET /guides?q=visa — title/summary filter works, q field pre-filled, noindex in source.
3. GET /guides?q=test%2Ccomma — comma stripped from q before query, no crash.
4. GET /guides?q=test%28paren%29 — parentheses stripped from q before query, no crash.
5. GET /guides?category=<valid-uuid> — category dropdown shows selection, results filtered.
6. GET /guides?category=not-a-uuid — treated as no filter, page renders without error.
7. GET /guides?q=visa&category=<uuid> — combined filters AND-chained correctly.
8. GET /guides?q=&category= — empty params treated as absent, full list shown, no noindex.
9. Result count shown correctly ("N guides found.").
10. Over-200 notice appears when matching guides exceed 200.
11. Empty result with filters → "No guides match your filters." + clear filters link.
12. Empty result without filters → "No guides have been published yet."
13. Guide card: category badge, published_at date, title link, summary all render correctly.
14. Card with no category — no badge shown (no empty space).
15. Card with no published_at — no date shown (no crash).
16. Card with no summary — no summary line shown.
17. Title link goes to /guides/[slug] (detail page — no regression).
18. Clear filters link returns to /guides.
19. Selected filter values preserved after form submit.
20. GET /guides/[slug] — detail page loads without regression (no changes made).
21. GET /programs — no regression.
22. GET /scholarships — no regression.
23. GET /universities — no regression.
24. GET /admin/ unauthenticated — redirects to /login (no admin regression).

---

### Explicit Exclusions

- No article_type filter — column does not exist in schema v1.
- No article junction table filters (article_countries, article_subjects, article_degree_levels).
- No updated_at display on cards.
- No markdown rendering (no set:html).
- No indexing_status behavior changes.
- No React or client-side JavaScript of any kind.
- No migrations (none required — all filter columns already exist with indexes).
- No service_role in src/ (0 matches confirmed by PowerShell search).
- No AI features.
- No saved items or user dashboard.
- No SEO landing pages for filter combinations.
- No admin page changes (zero admin files touched).
- No new npm dependencies.
- No pagination UI (hard limit 200 with over-limit notice).
- No /guides/[slug].astro changes.

---


## 2026-06-16 - Phase 12: Public University Search & Filter Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Upgrade /universities from a basic published-university list into a server-rendered university
discovery page with GET-form search and filters.
No admin changes, no migrations, no new dependencies, no React, no client-side JS,
no AI, no saved items, no service_role.

---

### Files Changed

src/pages/universities/index.astro (full replacement):
  Previous version: single Supabase query, 4-column table, LIMIT 100, no filters, no search.
  New version: GET filter form, 3 conditional filters, card result list, result count,
  over-limit notice, two empty states, noindex logic, parallel lookup queries.

---

### Schema Finding

universities table (migration 005) confirmed columns available for filtering:
  name (text) — searchable via ilike
  country_id (uuid FK → countries) — filterable by UUID
  city_id (uuid FK → cities) — filterable by UUID, nullable

Columns NOT present in schema v1 — no migration added:
  institution_type — does not exist
  ownership_type   — does not exist
  short_name       — does not exist

---

### Query Params Implemented

  q       — universities.name ilike '%q%' (name only; city/country name search deferred)
  country — universities.country_id = <uuid>
  city    — universities.city_id = <uuid>

---

### Validation Behavior

  q:       trim(), slice(0, 100). Empty string → undefined (filter absent).
  country: UUID regex (/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i). Invalid → undefined (filter absent).
  city:    same UUID regex as country.
  All failures are silent — no error messages, no crashes, filter treated as absent.

---

### Supabase Query Strategy

Lookup queries (parallel Promise.all):
  supabase.from('countries').select('id, name').order('name')
  supabase.from('cities').select('id, name').order('name')
  RLS enforces published-only for both. Failed lookups default to [].

Universities main query:
  supabase.from('universities')
    .select('id, name, slug, official_url, ranking_summary, countries(name), cities(name)',
            { count: 'exact' })
    .eq('content_status', 'published')
    .order('name')
    .limit(201)
  Filters chained conditionally:
    if (q)         query = query.ilike('name', `%${q}%`)
    if (countryId) query = query.eq('country_id', countryId)
    if (cityId)    query = query.eq('city_id', cityId)
  overLimit = (count ?? allRows.length) > 200
  rows = allRows.slice(0, 200)

---

### noindex Behavior

  hasFilters = !!(q || countryId || cityId)
  <PublicLayout noindex={hasFilters}>
  Filtered URLs (/universities?...) → <meta name="robots" content="noindex, follow">
  Unfiltered /universities → no robots meta tag, remains indexable.
  Uses existing noindex prop from Phase 10 (BaseLayout + PublicLayout).

---

### Build Result

  npm run build: PASS
  Cloudflare server build, 1.48s, zero errors, zero warnings (Sharp warning is pre-existing).

---

### service_role Result

  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

---

### Manual Test Checklist

1. GET /universities — blank form, all published universities listed, no noindex in source.
2. GET /universities?q=mit — name filter works, q field pre-filled, noindex in source.
3. GET /universities?country=<valid-uuid> — country dropdown shows selection, results filtered.
4. GET /universities?city=<valid-uuid> — city dropdown shows selection, results filtered.
5. GET /universities?country=not-a-uuid — treated as no filter, page does not error.
6. GET /universities?q=&country=&city= — all empty params treated as absent, full list shown.
7. GET /universities?q=xyz&country=<uuid> — combined filters AND-chained correctly.
8. Result count shown correctly ("N universities found.").
9. Over-200 notice appears if enough data exists.
10. Empty result with filters → "No universities match your filters." + clear filters link.
11. Empty result without filters → "No universities have been published yet."
12. University card: name link, location (country/city), ranking_summary, official_url link all render correctly.
13. name link goes to /universities/[slug] (detail page — no regression).
14. official_url opens in new tab with rel="noopener noreferrer".
15. Clear filters link returns to /universities.
16. Selected filter values preserved after form submit.
17. GET /universities/[slug] — detail page loads without regression.
18. GET /programs — no regression.
19. GET /scholarships — no regression.
20. GET /admin/ unauthenticated — redirects to /login (no admin regression).

---

### Explicit Exclusions

  institution_type filter — column does not exist in schema v1.
  ownership_type filter   — column does not exist in schema v1.
  short_name display      — column does not exist in schema v1.
  No city-scoped-by-country cascade (global city dropdown).
  No cross-table name search (country/city name via ilike).
  No pagination (hard limit 200 with over-limit notice).
  No AI, no saved items, no user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

---


## 2026-06-16 - Phase 11: Public Scholarship Search & Filter Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Upgrade /scholarships from a basic published-scholarship list into a server-rendered scholarship
discovery page with GET-form search and filters.
No admin changes, no migrations, no new dependencies, no React, no client-side JS,
no AI, no saved items, no service_role.

---

### Files Changed

src/pages/scholarships/index.astro (full replacement):
  Previous version: single Supabase query, 5-column table, LIMIT 100, no filters, no search.
  New version: GET filter form, 7 conditional filters, card result list, result count,
  over-limit notice, two empty states, noindex logic.

---

### Enum Values Confirmed

From supabase/migrations/007_scholarships.sql CHECK constraints:

  scholarship_type: full | partial | merit | need_based | government | institutional | other
  provider_type:    government | university | private_foundation | corporate | ngo | other
  funding_type:     full_tuition | partial_tuition | living_stipend | travel | research | full_funding | other
  application_type: direct | university_portal | nomination | embassy | other

---

### Query Params Implemented

  q               — scholarships.name ilike '%q%' OR provider_name ilike '%q%'
                    (overview excluded per approved scope)
  scholarship_type — scholarships.scholarship_type = <enum>
  provider_type    — scholarships.provider_type = <enum>
  funding_type     — scholarships.funding_type = <enum>
  application_type — scholarships.application_type = <enum>
  currency         — scholarships.currency ilike '%currency%'
  deadline         — deadline=upcoming → scholarships.deadline >= today (UTC YYYY-MM-DD)

---

### Validation Behavior

  q:             trim(), replace(/[,()]/g, ''), slice(0, 100). Empty string → undefined.
                 Commas and parentheses removed to prevent breaking .or() string syntax.
  currency:      trim(), toUpperCase(), replace(/[^A-Z]/g, ''), slice(0, 10). Empty → undefined.
  scholarship_type, provider_type, funding_type, application_type:
                 validated against allowlist arrays. Unknown value → undefined (filter absent).
  deadline:      only the exact string 'upcoming' is accepted; anything else → filter absent.
  All failures are silent — no error messages, no crashes, filter treated as absent.

---

### Supabase Query Strategy

Scholarships query:
  supabase.from('scholarships').select(..., { count: 'exact' })
    .eq('content_status', 'published')
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('name',     { ascending: true })
    .limit(201)
  Filters chained conditionally after the base query:
    if (q)               query = query.or(`name.ilike.%${q}%,provider_name.ilike.%${q}%`)
    if (scholarshipType) query = query.eq('scholarship_type', scholarshipType)
    if (providerType)    query = query.eq('provider_type', providerType)
    if (fundingType)     query = query.eq('funding_type', fundingType)
    if (applicationType) query = query.eq('application_type', applicationType)
    if (currency)        query = query.ilike('currency', `%${currency}%`)
    if (upcomingOnly)    query = query.gte('deadline', todayISO)

  { count: 'exact' } returns total count alongside data (no second round-trip).
  .limit(201) fetches one extra row to detect over-limit without a second query.
  allRows.slice(0, 200) used for rendering; overLimit = (count ?? allRows.length) > 200.
  todayISO derived server-side: UTC full year + zero-padded month + zero-padded day.
  nullsFirst: false supported by Supabase JS v2 — no deviation required.
  Multi-column .or() syntax confirmed compatible with Supabase PostgREST client.

Client: createClient(Astro.cookies, Astro.request) throughout. Anon key only. No service_role.
No lookup queries needed — all filter options are static enum values, not DB-driven.

---

### Noindex Behavior

  hasFilters = true when any of the 7 params resolves to a valid, non-empty value.
  <PublicLayout noindex={hasFilters}> passes through to BaseLayout.
  BaseLayout renders <meta name="robots" content="noindex, follow"> when noindex=true.
  GET /scholarships (no params) → no robots meta tag, page is indexable.
  GET /scholarships?<any-filter> → noindex, follow tag present in <head>.
  Uses existing noindex prop wired in Phase 10 — no layout changes needed.
  All other public pages unaffected. All admin pages unaffected.

---

### Build Result

npm run build: PASS
Output: Cloudflare server build, 1.45s, zero errors, zero warnings.

---

### service_role Search Result

Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role"
→ (no output) — 0 matches across all src/ files.

---

### Manual Test Checklist

- GET /scholarships — blank form, all published scholarships listed (deadline ASC nulls last
  then name ASC), no noindex tag in page source
- GET /scholarships?q=merit — name/provider_name filter works, q field pre-filled,
  noindex, follow present in page source
- GET /scholarships?q=test%2Ccomma — comma stripped from q before query, no crash
- GET /scholarships?scholarship_type=full — type dropdown shows "Full" selected, results filtered
- GET /scholarships?scholarship_type=bogus — treated as no filter, all scholarships shown
- GET /scholarships?provider_type=government — dropdown shows "Government" selected
- GET /scholarships?funding_type=full_tuition — dropdown shows "Full Tuition" selected
- GET /scholarships?application_type=direct — dropdown shows "Direct" selected
- GET /scholarships?currency=USD — currency field pre-filled with "USD", results filtered
- GET /scholarships?currency=usd123! — sanitized to "USD" (uppercase, non-alpha removed)
- GET /scholarships?deadline=upcoming — dropdown shows "Upcoming only", deadline filter applied
- GET /scholarships?deadline=bogus — treated as no filter (upcomingOnly = false)
- All 7 filters active simultaneously — combined filtering works, clear link visible
- Result count shows "N scholarships found." correctly
- Over-200 notice appears when matching scholarships exceed 200
- Empty result with filters → "No scholarships match your filters." + clear filters link
- Empty result without filters → "No scholarships have been published yet."
- Scholarship card: name link, provider_name, scholarship_type badge (blue), provider_type
  badge (purple), funding_type badge (green), application_type badge (gray),
  deadline badge (amber), amount range (right-aligned) all render correctly
- Card with no provider_name — no empty line shown
- Card with no deadline and no deadline_text — no deadline badge shown
- Card with no amount fields — no amount shown
- Name link goes to /scholarships/[slug] (detail page — no regression)
- Clear filters link returns to plain /scholarships
- Selected filter values preserved after form submit
- GET /scholarships/[slug] — detail page loads without regression (no changes made)
- GET /programs — programs page unaffected (no regression)
- GET /admin/ unauthenticated — redirects to /login (no admin regression)

---

### Explicit Exclusions

- No React or client-side JavaScript of any kind.
- No migrations (none required — all filter columns already exist with indexes).
- No service_role in src/ (0 matches confirmed by PowerShell search).
- No AI features.
- No saved items or user dashboard.
- No SEO landing pages for filter combinations.
- No admin page changes (zero admin files touched).
- No new npm dependencies.
- No pagination UI (hard limit 200 with over-limit notice).
- No overview in q search (name + provider_name only, per approved scope).
- No amount-based filters (cross-currency comparison unreliable without conversion).
- No deadline_before filter.
- No junction table filters (scholarship_countries, scholarship_subjects, etc.).
- No /scholarships/[slug].astro changes.

---


