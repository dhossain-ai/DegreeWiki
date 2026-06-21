# DegreeWiki Task Log Archive: Phase 51-54

Extracted from the 2026-06-21 pre-compaction snapshot. Covers student dashboard, Fit Finder runtime, and AI summary work.

## 2026-06-21 - Phase 54A: AI Summary Formatting + Async Result UX

Tool:
Claude Opus 4.8 (Claude Code)

Task:
Make Fit Finder results render rule-based matches immediately, then generate the
AI summary asynchronously, cache it in ai_finder_results.ai_explanation, and
render it safely as plain text. Stop the provider being called on every page
refresh.

Changes:

- src/lib/ai/prompts/finder-summary.ts: added strict plain-text OUTPUT FORMAT
  rules (no Markdown/HTML/tables/pipes/headings/emphasis, "- " lists only,
  ~180-word cap, verification reminder, preferred structure).
- src/lib/ai/finder/sanitize.ts (new): sanitizeAIExplanation() — converts <br>
  to newlines, strips HTML tags, drops Markdown table separator rows, flattens
  obvious pipe table rows, removes leading heading markers and ** __ ` markers,
  normalizes blank lines, trims, caps length. No dependencies.
- src/lib/ai/finder/persist.ts: persistFinderResult now stores a null summary
  (summary is async); added updateFinderSummary() — service-role write of
  ai_explanation/ai_model_used/token counts. Never touches result_status, so a
  summary failure never marks a valid result failed. Sanitizes before write.
- src/pages/api/ai/finder-summary.ts (new): POST { finder_result_id }. RLS
  ownership check; returns cached ai_explanation without a provider call;
  otherwise loads top-3 matches + optional profile summary, calls callAI,
  sanitizes, stores via updateFinderSummary, returns it. Provider failure →
  503 ai_unavailable (DEV-only safe failure detail), result not marked failed.
- src/pages/fit-finder/result.astro: removed the blocking callAI from
  frontmatter; only persists/reuses the result row. Reused recent result shows
  its cached summary immediately. Otherwise an AI card shows "Preparing your
  personalized explanation…" and vanilla JS fetches /api/ai/finder-summary once
  (no retry loop), rendering with textContent only.
- src/pages/fit-finder/results/[id].astro: stored summary sanitized defensively
  before safe text interpolation; added a "no AI summary" note. Provider never
  called from this page. AI Advisor chat unchanged.

No schema migration. No set:html. No innerHTML. No RLS/admin/security changes.

Build Result:
npm run build: PASS (Cloudflare server build, ~9.9s, zero errors).
No npm run check script exists in package.json.


## 2026-06-21 - Phase 52: Country Role Flags + Fit Finder AI Pipeline Reliability

Tool:
Claude Sonnet 4.6 (Claude Code)

Task:
Add country role flags (is_origin_enabled, is_destination_enabled) to the
countries table. Seed 18 origin-only countries. Update admin country forms with
role toggles. Split Fit Finder origin/destination country queries. Update public
destination filters. Improve Fit Finder wording. Add dev-only persist warning.

Changes:

Migration 021_country_role_flags.sql:
- ADD COLUMN IF NOT EXISTS is_origin_enabled boolean NOT NULL DEFAULT false
- ADD COLUMN IF NOT EXISTS is_destination_enabled boolean NOT NULL DEFAULT false
- Backfill: UPDATE countries SET is_origin_enabled=true, is_destination_enabled=true
  WHERE content_status='published'
- CREATE INDEX IF NOT EXISTS idx_countries_origin_enabled
- CREATE INDEX IF NOT EXISTS idx_countries_destination_enabled
- No RLS change.

data/starter/countries.phase52.json:
- 18 origin-only rows (Bangladesh, India, Nepal, Pakistan, Sri Lanka, Nigeria,
  Ghana, Kenya, Vietnam, Philippines, Indonesia, Malaysia, China, Turkey, Egypt,
  Morocco, South Korea, Japan).
- is_origin_enabled=true, is_destination_enabled=false, content_status=published,
  indexing_status=noindex. For admin manual creation via /admin/countries/new.

Admin country forms:
- new.astro and [id].astro: "Country roles" fieldset with two checkboxes.
  Values parsed from form, included in INSERT/UPDATE.
- index.astro: Role badge column (Origin/Destination/Both/None).

Fit Finder split:
- fit-finder/index.astro: originCountries query (is_origin_enabled=true) for
  "Where are you from?"; destinationCountries query (is_destination_enabled=true)
  for "Countries you want to study in". Validation uses correct set per field.
- Labels/helpers updated: degree level, budget (per academic year), English score
  (IELTS/TOEFL/PTE example). Coverage note refined.

Public destination filters:
- programs/index.astro: country filter .eq('is_destination_enabled', true).
- universities/index.astro: same.
- Scholarships public page: no country filter exists — no change needed.

Dev-only persist warning:
- fit-finder/result.astro: yellow note when import.meta.env.DEV && pageState===
  'ready' && matches.length > 0 && savedResultId===null.
  Not visible in production.

Outcome:
- npm run build: PASS
- No service-role in pages/components/layouts.
- No RLS weakening. No admin guard change. No new dependencies.
- No matching algorithm change. No AI chat change.


## 2026-06-21 - Phase 51C: Fit Finder UX + No-Match Clarity Fix

Tool:
Claude Sonnet 4.6 (Claude Code)

Goal:
Replace Ctrl/Shift native multi-selects with checkbox groups, rename confusing
labels, add a data coverage note, improve no-match copy, and document the
local-dev persist requirement. No schema migration, no matching algorithm changes,
no AI chat behavior changes.

---

### Code Changes

**src/pages/fit-finder/index.astro:**

Replaced `<select multiple size="6">` for target countries with a scrollable
checkbox group (`max-h-52 overflow-y-auto` bordered container, one labeled checkbox
per country). Replaced `<select multiple size="8">` for subjects with same pattern.
Field names `student_profile_countries` and `student_profile_subjects` unchanged —
`form.getAll()` behavior identical. `isSelected()` helper drives `checked` attribute.
Selected state persists after validation failure and on GET load of saved preferences.

Label + helper text changes:
- "Current country" → "Your current country" + "Where you live right now."
- Target degree level: added hint "Choose the degree level you want to study next."
- "Target countries" → "Countries you want to study in" + "Select every destination
  you are open to."
- "Subjects of interest" → "What do you want to study?" + "Select one or more subject
  areas."

Added data coverage note as a calm blue info bar above the form sections:
"DegreeWiki currently has the strongest starter data for Finland master's programmes.
More countries, bachelor's programmes, and scholarships are being added."

**src/pages/fit-finder/result.astro:**

Improved no-match state (`pageState === 'no_matches'`):
- Heading: "No strong matches found for your preferences"
- Candidate count note (when candidatesChecked > 0)
- Zero-candidate message (when candidatesChecked === 0, no published programmes yet)
- Conditional degree-level note using existing `degreeLevelName` variable: shown when
  `degreeLevelName && candidatesChecked > 0`, states limited coverage for that level
  and suggests trying a different degree level
- Actionable bullet list: Finland country tip, broaden subjects, try different degree
  level, remove budget filter
- Data coverage footnote: "starter data is strongest for Finland master's programmes"
- No changes to scoring, AI call, or persist logic

**docs/08-ai-deployment-checklist.md:**

Added "Important — Saved-result and chat persistence in local dev" note under
section 3A explaining that `SUPABASE_SERVICE_ROLE_KEY` must be in `.env.local` or
`.dev.vars` for `persistFinderResult` and `persistChatTurn` to insert rows. Without
it, result display still works but `/fit-finder/results` appears empty.

---

### Checks

npm run build: PASS (Cloudflare server build, Server built in 4.20s, zero errors).
npm run check: no `check` script defined — not run.
service_role|SERVICE_ROLE|createServiceClient|PUBLIC_GEMINI|PUBLIC_.*API_KEY
  in src/pages: 0 matches.

---

### Decisions

- Zero-match results are not persisted in this phase (deferred as approved).
- No multi-step wizard implemented (deferred as approved).
- No matching/scoring logic changed.
- No AI chat behavior changed.
- No schema migration.
- No RLS weakening.
- No admin access changes.
- No new npm dependencies.

---


## 2026-06-20 - Phase 51B: Student Dashboard + AI Entry Bundle

Tool:
Codex (GPT-5)

Goal:
Upgrade `/account` into a real student dashboard landing page, surface the
existing saved-result AI advisor without adding any new chat route, tighten the
saved-results AI entry copy, and clean up local AI env guidance. No schema
migration, no new dependencies, no service-role usage in pages/components/layouts,
and no admin/RLS weakening.

---

### Code Changes

**src/pages/account.astro:**
Reworked `/account` into a student dashboard while keeping the route unchanged.
Still requires login and still uses the normal SSR Supabase client.

Added:
- `Student Dashboard` header and signed-in email display
- primary `Run Fit Finder` action card
- three status cards:
  - Fit Finder profile status
  - saved results count
  - AI advisor availability
- latest-result card showing:
  - created date
  - matched-program count
  - AI summary badge state
  - latest top-program preview when available
  - `View latest result`
  - conditional `Open AI advisor` / `Continue AI chat`
- browse/support links and the existing sign-out form

Server-side dashboard queries now load:
- own non-anonymous `student_profiles` existence
- own `ai_finder_results` count
- latest own saved result
- rank-1 program preview for the latest result
- existing conversation/message history for that latest result through SSR/RLS

`Continue AI chat` is shown only when prior `ai_messages` rows exist for the
latest result conversation. Otherwise the dashboard uses safe `Ask AI about your
latest result` / `Open AI advisor` wording.

**src/components/ai/SavedResultChat.astro:**
Updated chat heading/copy so the saved-result page clearly surfaces the existing
chat as `DegreeWiki AI Advisor`.

Added:
- heading: `DegreeWiki AI Advisor`
- helper copy: `Ask follow-up questions about this saved Fit Finder result.`
- stronger safety note clarifying the chat is DegreeWiki-context-bound and not
  an admission, visa, or scholarship guarantee

No API behavior changes.

**src/pages/fit-finder/results/index.astro:**
Added `Open AI advisor` action for complete saved results with matched programs,
reusing the same `/fit-finder/results/[id]` detail page.

**src/components/public/PublicNav.astro:**
Changed the logged-in label from `Account` to `Dashboard` while keeping
`href="/account"`. No public admin link was added.

**src/lib/ai/env.ts:**
Kept Cloudflare `locals.runtime.env` as the primary path, but added a safe
server-only fallback to `import.meta.env` when runtime bindings are absent.
This supports local Astro server development without exposing secrets to client code.

**.gitignore:**
Added:
- `.dev.vars`
- `.dev.vars.*`

**.env.example, docs/04-ai-system.md, docs/08-ai-deployment-checklist.md:**
Updated env guidance to document:
- never use `PUBLIC_` for Gemini or service-role secrets
- local Astro server development may use server-only `.env.local`
- Cloudflare / `wrangler pages dev` should use `.dev.vars`
- never commit `.env.local` or `.dev.vars`

### Scope / Boundary Notes

- `/account` was reused; no `/dashboard` route was created.
- AI entry remains saved-result-bound.
- No global chatbot.
- No program-page AI chat.
- No open-ended general chatbot.
- No schema migration.
- No new dependencies.
- No changes to `src/lib/admin/guard.ts`.

### Validation

- `npm run build`: PASS.
- `npm run check`: repo does not currently define a `check` script.
- `service_role|SERVICE_ROLE|SUPABASE_SERVICE|createServiceClient|PUBLIC_GEMINI|PUBLIC_.*GEMINI|PUBLIC_.*API_KEY`
  in `src/pages`, `src/components`, `src/layouts`: 0 matches.
- `PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE|PUBLIC_.*GEMINI|PUBLIC_.*API_KEY`
  in `src/`: 0 matches.

### Manual Verification

Performed:
- `GET /account` while logged out → `302 /login?redirect=/account`.
- `GET /` while logged out → `200`; `Sign in` and `Get started` visible.
- Confirmed no public `Admin dashboard` text on the homepage response.

Not performed:
- live signed-in dashboard rendering with a real student account
- live latest-result/AI-advisor states against real user data
- live saved-result detail page rendering with an authenticated result owner
- live logout click-through in a signed-in browser session

---


## 2026-06-20 - Phase 51A: Student Signup + Account Entry Flow

Tool:
Codex (GPT-5)

Goal:
Implement a proper student signup flow, clean auth entry behavior, and public
account navigation using the existing `/account` route as the single student
destination. No schema migration, no new dependencies, no admin-gate changes,
and no service-role usage in pages/components/layouts.

---

### Code Changes

**src/lib/auth/redirect.ts:**
Added shared `sanitizeAuthRedirect()` with fallback `/account`. It accepts only
internal paths beginning with a single `/` and rejects empty, external, and
protocol-relative redirect values.

**src/pages/signup.astro:**
Added new signup page with:
- email, password, confirm-password fields
- required-field validation
- 8-character minimum password validation
- password mismatch validation
- safe generic error handling for Supabase signup
- success split:
  - active session → redirect to sanitized target or `/account`
  - no active session → show check-email message and `/login` link
- student-focused copy and approved sensitive-data warning

**src/pages/login.astro:**
Updated login flow so:
- default redirect is `/account` instead of `/admin`
- already-authenticated visits redirect to sanitized target or `/account`
- `/signup` link is shown with the current safe redirect preserved
- raw provider errors are replaced with safe messages only
- optional `?auth=error` banner handles callback failures safely

**src/pages/auth/callback.astro:**
Updated callback handling to:
- exchange the auth code as before
- redirect to sanitized `?redirect=` target after success
- redirect to `/login?auth=error` on callback failure without exposing raw error text
- fall back to `/account` when no redirect is provided

**src/components/public/PublicNav.astro:**
Made the shared public nav auth-aware using the existing SSR Supabase client:
- logged-out users see `Sign in` and `Get started`
- signed-in users see `Account` and `Sign out`
- sign-out uses the existing POST `/api/auth/logout` route
- no public `Admin dashboard` link is shown

**src/pages/index.astro:**
Removed the old homepage-only auth/admin row because the shared nav now handles
public auth entry globally. This also removes the misleading public `Admin dashboard`
link for normal students.

### Reuse / Scope Notes

- Reused the existing `/account` route unchanged as the single student post-auth destination.
- `/account` still requires login and still tolerates users with no `student_profiles` row.
- No duplicate dashboard route was added.
- No schema migration was created.
- `src/lib/admin/guard.ts` was left unchanged.

### Validation

- `npm run build`: PASS.
- `npm run check`: repo does not currently define a `check` script.
- `astro check` was not installed/runnable without adding `@astrojs/check`; this was not added because Phase 51A forbids new dependencies.
- `createServiceClient|SUPABASE_SERVICE_ROLE_KEY|PUBLIC_SUPABASE_SERVICE|service_role` in `src/pages`, `src/components`, `src/layouts`: 0 matches.

### Manual Verification

Used the local dev server and HTTP requests for a focused anonymous/manual pass:

- `GET /signup` → 200; heading, login link, and sensitive-data warning present.
- `POST /signup` with empty fields → safe validation message; no raw provider text.
- `POST /signup` with mismatched passwords → safe validation message.
- `POST /login` with bogus credentials → safe `Invalid email or password.` message; no raw provider text.
- `GET /account` while logged out → `302 /login?redirect=/account`.
- `GET /admin` while logged out → `302 /login?redirect=%2Fadmin` (existing admin gate unchanged).
- `GET /auth/callback` with no code → `302 /account`.
- `GET /login?redirect=//evil.com` → signup link falls back to `/account`; unsafe redirect not reflected.
- `GET /` → public signup entry present; no `Admin dashboard` link visible.

Not performed:
- real successful signup/login redirect with a live account
- email-confirmation completion path with a live mailbox
- logged-in logout/account-nav checks
- confirmed admin login with a real admin user

---


