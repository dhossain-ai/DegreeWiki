# DegreeWiki Task Log Archive: Phase 21-30

Extracted from the 2026-06-21 pre-compaction snapshot. Covers Fit Finder, persistence, account/profile hardening, and the standalone Phase 28 tail entry.

## 2026-06-18 - Phase 30: Account/Profile Area Foundation

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add a simple authenticated account hub at /account. Logged-in users get one central
destination for their DegreeWiki tools and privacy/account links. Anonymous users
redirect to login. No AI calls, no service_role, no schema changes, no matching changes,
no new dependencies, no React, no client-side JS.

---

### Files Created

src/pages/account.astro:

  Auth gate:
    createClient(Astro.cookies, Astro.request) from src/lib/supabase/server.ts.
    supabase.auth.getUser(). If no user → redirect to /login?redirect=/account.

  RLS-safe queries (Promise.all after auth gate):
    Query 1: student_profiles
      .select('id').eq('is_anonymous', false).limit(1)
      profileExists = (data?.length ?? 0) > 0
      On error: console.error server-only; profileExists = false.
      id field never rendered to HTML.

    Query 2: ai_finder_results
      .select('id', { count: 'exact', head: true })
      savedCount = count ?? 0
      On error: console.error server-only; savedCount = 0.
      No result IDs or content rendered.

  Rendered content:
    PublicLayout with noindex={true}, title "Account — DegreeWiki".
    H1: "Account".
    Signed-in email (user.email) shown if non-null/undefined; omitted otherwise.
    user.id not rendered. student_profile_id not rendered. No UUIDs in HTML.

  Sections:
    Fit Finder:
      /fit-finder — "Preferences saved" or "Not set up yet"
      /fit-finder/results — "N saved result[s]"
      /fit-finder/result — Run Fit Finder
    Browse:
      /programs — Browse programs
    Privacy & trust:
      /privacy, /terms, /disclaimer
    Account:
      POST form → /api/auth/logout with "Sign out" button

  Style: max-w-2xl card list layout consistent with existing public pages.
  No client-side JS. No React. No AI imports.

---

### Files Modified

src/pages/index.astro:

  Added "Account" link to /account in the logged-in auth row only.
  Link appears between "Signed in as [email]" and "Admin dashboard".
  No new auth query; homepage already calls supabase.auth.getUser().
  Anonymous auth row (Sign in link) unchanged.

docs/06-status.md — Phase 30 completion entry; current phase updated to Phase 31.
docs/07-task-log.md — this entry.

---

### Account Route Behavior

GET /account (anonymous) → redirect to /login?redirect=/account.
GET /account (logged-in) → renders account hub with email, summary signals, links.
No POST handler on /account. Sign-out is a form POST to /api/auth/logout (existing endpoint).

---

### Profile/Account Data Shown

- user.email — displayed to session owner only; not in title/meta/OG.
- profileExists boolean — drives "Preferences saved" / "Not set up yet" label.
- savedCount integer — drives "N saved result[s]" label.
- No UUIDs, no user_id, no student_profile_id, no token counts, no model names.
- No ai_usage_logs query. No service keys exposed.

---

### Homepage Navigation Change

src/pages/index.astro: added <a href="/account">Account</a> in the logged-in auth row.
Location: between "Signed in as [email]" span and "Admin dashboard" link.
Visible only when user is truthy. Anonymous row unchanged.
No new queries added to homepage.

---

### Query Strategy

All queries use createClient(Astro.cookies, Astro.request) — SSR anon key, RLS-enforced.
Auth gate fires before any DB query.
Two content queries run in Promise.all after auth gate passes:
  student_profiles: SELECT id, is_anonymous=false, limit 1 → profileExists.
  ai_finder_results: SELECT id count head:true → savedCount.
No user_id filter in page code; RLS handles ownership in both queries.
No service_role. No service client. No joins beyond what RLS requires.
On query error: safe fallback values; console.error server-side; page still renders.

---

### RLS/Security Behavior

/account is noindex (not crawled, not indexed, not in sitemap).
Auth gate: anonymous users never reach DB queries or rendered content.
student_profiles RLS (user_id = auth.uid()) — SELECT scoped to session owner.
ai_finder_results RLS (EXISTS student_profiles.user_id = auth.uid()) — count scoped
  to session owner; if user has no student profile, count returns 0.
user.email displayed only after auth gate passes; not exposed in title/meta/og tags.
No UUID, user_id, student_profile_id, or session token rendered in HTML.
No AI calls, no callAI import, no getAIEnv import, no service key references.
Sign-out via POST to existing /api/auth/logout (no new endpoint created).

---

### Explicit Exclusions

No AI calls. No callAI. No getAIEnv. No Gemini/OpenAI references in /account.
No service_role. No createServiceClient. No migrations. No new dependencies.
No React or client-side JS. No admin UI. No public sharing.
No /account/profile sub-route. No /account/fit-finder sub-route.
No matching algorithm changes. No persistence changes (no INSERT/UPDATE).
No AI gateway, provider, prompt, logging, or rate-limit changes.
No changes to PublicNav, PublicLayout, fit-finder pages, or src/lib/ai/* files.
No ai_usage_logs query. No token counts, model usage, or cost fields shown.

---

### Build Result

npm run build: PASS (Cloudflare server build, 9.87s, zero errors).

---

### Safety Grep Results

service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts:
  → 0 matches (expected).

createServiceClient in src/pages,src/components,src/layouts:
  → 0 matches (expected).

callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient|Gemini|OpenAI
  in src/pages/account.astro:
  → 0 matches (expected).

callAI in src/pages,src/components:
  → 2 matches, both in src/pages/fit-finder/result.astro
    (import line + invocation line, unchanged from Phase 29).

---

### Manual Test Checklist

[ ] Anonymous GET /account → redirects to /login?redirect=/account.
[ ] POST login with valid credentials from /login?redirect=/account → lands on /account.
[ ] /account loads with "Account" heading.
[ ] User email displays if available; no UUID visible in page source.
[ ] Profile status: "Preferences saved" (if profile exists) or "Not set up yet".
[ ] Fit Finder preferences link (/fit-finder) → works.
[ ] Saved results link (/fit-finder/results) → works.
[ ] Saved results count displays correct integer.
[ ] Run Fit Finder link (/fit-finder/result) → works.
[ ] Browse programs link (/programs) → works.
[ ] Privacy policy link (/privacy) → works.
[ ] Terms link (/terms) → works.
[ ] Disclaimer link (/disclaimer) → works.
[ ] Sign out button → POST /api/auth/logout → redirects to /login; session cleared.
[ ] After sign-out, GET /account → redirects to /login?redirect=/account.
[ ] Homepage logged-in auth row shows "Account" link.
[ ] Homepage anonymous row (Sign in) does not show Account link.
[ ] No AI call triggered from /account load.
[ ] Existing Fit Finder pages still work.

---


## 2026-06-18 - Phase 29: Fit Finder History Polish

Tool:
Claude (claude-sonnet-4-6)

Goal:
Polish the saved Fit Finder results/history experience — improved list cards with top-program
preview, clearer AI/no-AI status badges, better empty state, and lightweight navigation links
between Fit Finder flow pages. No AI calls, no service_role, no schema changes, no matching
changes, no new dependencies, no React, no client-side JS.

---

### Files Modified

src/pages/fit-finder/results/index.astro:

  Added TopProgram type:
    { title, slug, universityName, universitySlug, countryName, cityName }

  Added top-program preview query (after main results list loads):
    Uses SSR client (createClient). Queries ai_finder_program_matches, filters rank=1,
    ai_finder_result_id IN (result IDs from main query). Joins programs(title, slug,
    universities(name, slug), countries(name), cities(name)). RLS
    ai_finder_program_matches_select_own enforces ownership via grandparent join
    (ai_finder_results → student_profiles.user_id = auth.uid()).
    Builds Map<string, TopProgram> keyed by ai_finder_result_id.
    On error: console.error server-side only; previews Map stays empty; list renders
    normally without previews; no user-facing error banner.

  Added getCardBadge() helper function:
    Returns 'failed' | 'incomplete' | 'ai' | 'no-ai' based on result_status and
    ai_explanation presence.

  Card template updated:
    Header row: date + badge pill(s).
      ai → purple "AI summary" pill (bg-purple-50 text-purple-700 border-purple-100)
      no-ai → gray "No AI summary" pill (bg-gray-100 text-gray-500 border-gray-200)
      incomplete → yellow "Incomplete" pill (bg-yellow-50 text-yellow-800 border-yellow-200)
      failed → red "Failed" pill (bg-red-50 text-red-700 border-red-200)
    Program count: unchanged.
    Top match preview block (new, shown when previews.get(r.id) exists):
      program title in text-sm font-medium text-gray-800
      university name · country, city in text-xs text-gray-500
      Both lines omitted when no preview for this result.
    Actions: unchanged (View result link, Delete form button).

  Top action row: added "Browse programs" → /programs as third CTA.

  Empty state improved:
    Title: "No saved Fit Finder results yet."
    Body: "Results are saved automatically after you run Fit Finder. Your matched programs
      and any AI summary are stored so you can review them later."
    Three CTAs: Run Fit Finder, Update preferences, Browse programs.

  Delete handler: unchanged (POST, UUID validation, SSR client delete, RLS, cascade).

src/pages/fit-finder/results/[id].astro:
  Added status/AI badge row below h1, next to "Saved on [date]" text:
    complete + ai_explanation → purple "AI summary" pill
    complete + no ai_explanation → gray "No AI summary" pill
    pending → yellow "Incomplete" pill
    failed → red "Failed" pill
  Existing failed warning paragraph kept below badge row unchanged.
  No logic changes. No new imports. No new queries.

src/pages/fit-finder/index.astro:
  Added "View saved results →" plain text link in submit button row.
  Rendered only when user is truthy (user variable already available from
  Promise.all supabase.auth.getUser() call at page top).
  Styled as text-sm text-gray-500 hover:text-gray-700 — unobtrusive.

src/pages/fit-finder/result.astro:
  Added "View all saved results →" plain text link in action buttons row.
  Rendered only when user is truthy AND pageState === 'ready'.
  Not shown in no_matches, sparse_profile, error, no_profile, or anonymous states.
  Styled as text-sm text-gray-500 hover:text-gray-700 — unobtrusive.
  No changes to matching logic, AI call block, persistence, or dedupe behavior.

---

### Query Strategy

Top-program preview uses a second SSR client query (not nested select on ai_finder_results):
  Rationale: PostgREST nested select on a one-to-many (ai_finder_results →
  ai_finder_program_matches) would return an array per result requiring client-side
  filter for rank=1. Two-query approach is explicit, type-safe, and consistent with
  existing patterns in [id].astro.
  Query runs only when pageState === 'list' and results.length > 0.
  RLS is the authoritative ownership check — no page-level user_id filter needed.

---

### Empty/Navigation Improvements

  /fit-finder/results empty state: improved title, two-sentence explanation, three CTAs.
  /fit-finder/results top action row: added Browse programs as third CTA.
  /fit-finder: added View saved results link for logged-in users (simple, no counts).
  /fit-finder/result ready state: added View all saved results link for logged-in users.

---

### Delete Behavior

  Unchanged from Phase 27:
  POST to /fit-finder/results, UUID regex validation, SSR client delete on ai_finder_results,
  RLS ai_finder_results_delete_own (student_profiles.user_id = auth.uid()),
  ON DELETE CASCADE removes ai_finder_program_matches automatically.
  No JS confirmation. No user_id or student_profile_id in forms.
  Non-owner UUID: RLS no-ops (0 rows affected); redirect to list; no disclosure.

---

### RLS/Security Behavior

  All reads use SSR client (createClient). No service_role, no createServiceClient.
  ai_finder_results SELECT: RLS scopes to auth.uid() through student_profiles.
  ai_finder_program_matches SELECT (preview): RLS scopes via grandparent join.
  No user_id, student_profile_id, prompt text, or AI internals rendered to page.
  ai_model_used selected in results/index.astro for server logic (badge detection)
    but never rendered to HTML.
  Delete form contains only result UUID (hidden id field).

---

### Explicit Exclusions

  No AI calls. No callAI import in saved-results routes. No getAIEnv in saved-results routes.
  No service_role. No createServiceClient. No migrations. No new dependencies.
  No React or client-side JS. No admin UI. No public sharing. No matching algorithm changes.
  No persistence logic changes. No rate-limit changes. No prompt changes.
  No chatbot. No new AI endpoint. No Gemini/OpenAI code in results routes.
  No changes to src/lib/ai/*, src/lib/supabase/service.ts, supabase/migrations/*.
  No changes to package.json or admin pages.

---

### Build Result

  npm run build: PASS (Cloudflare server build, 3.52s, zero errors).

---

### Safety Grep Results

  service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
  createServiceClient in src/pages,src/components,src/layouts → 0 matches.
  callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient|Gemini|OpenAI in
    src/pages/fit-finder/results → 0 matches.
  callAI in src/pages,src/components → 2 matches, both in src/pages/fit-finder/result.astro
    (import line and invocation line only; unchanged from Phase 28).

---

### Manual Test Checklist

- [ ] Anonymous /fit-finder/results redirects to /login?redirect=/fit-finder/results
- [ ] Logged-in empty state shows "No saved Fit Finder results yet." with 3 CTAs
- [ ] Logged-in saved-results list shows results newest first
- [ ] Each card shows date, program count, and correct badge
- [ ] Complete result with AI explanation shows purple "AI summary" badge
- [ ] Complete result without AI explanation shows gray "No AI summary" badge
- [ ] Failed result shows red "Failed" badge
- [ ] Pending/incomplete result shows yellow "Incomplete" badge
- [ ] Top-program preview appears when rank-1 match exists (title, university, location)
- [ ] Card renders normally when preview is absent or preview query fails
- [ ] "View result" navigates to /fit-finder/results/[id]
- [ ] Delete from list works (POST, redirect, result removed)
- [ ] User B cannot see User A results (RLS)
- [ ] /fit-finder/results/[id] shows status/AI badge near saved date
- [ ] /fit-finder/results/[id] "Back to saved results" link works
- [ ] /fit-finder/results/[id] delete form still works
- [ ] /fit-finder logged-in page shows "View saved results →" link
- [ ] /fit-finder logged-out page does not show "View saved results →" link
- [ ] /fit-finder/result ready state shows "View all saved results →" link for logged-in users
- [ ] /fit-finder/result no_matches state does not show "View all saved results →" link
- [ ] /fit-finder/result anonymous/no_profile/sparse_profile/error states do not show that link
- [ ] No AI calls fired from any saved-results route

---


## 2026-06-18 - Phase 27: Saved Finder Results Management

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add a private /fit-finder/results list page and owner-only delete flow for logged-in users.
No AI calls, no service_role, no service client, no public sharing, no anonymous persistence,
no migrations, no new dependencies, no React, no client-side JS, no admin changes, no
matching algorithm changes.

---

### Files Created

src/pages/fit-finder/results/index.astro (new):
  List page and POST delete handler. Uses PublicLayout, noindex=true.
  Anonymous users: redirect to /login?redirect=/fit-finder/results (runs before any query).
  POST handler (runs before GET render):
    Reads 'id' field from formData. Validates against UUID regex — invalid → sets deleteError.
    Calls supabase.from('ai_finder_results').delete().eq('id', rawId) via SSR client.
    RLS ai_finder_results_delete_own enforces ownership server-side.
    On DB error: sets deleteError string, falls through to re-render list.
    On success: Astro.redirect('/fit-finder/results') (PRG pattern).
    Non-owner UUID: RLS no-ops delete (0 rows affected, no error); redirects to list.
    Never accepts user_id or student_profile_id from form.
  GET handler:
    Queries ai_finder_results via SSR client: id, created_at, result_status, shortlist_count,
    ai_explanation (presence only), ai_model_used. No explicit user filter — RLS SELECT
    policy (ai_finder_results_select_own) scopes results to auth.uid() through student_profiles.
    Orders by created_at DESC. Sets pageState to 'list', 'empty', or 'error'.
  Template:
    Page actions: Run Fit Finder again (→ /fit-finder/result), Update preferences (→ /fit-finder).
    deleteError banner shown when delete failed.
    Empty state: heading + "Run the Fit Finder and your results will be saved automatically."
      with Run Fit Finder and Update preferences CTAs.
    Error state: generic message + Run Fit Finder link.
    List state: cards sorted newest first. Each card shows: date saved, result_status badge
      (only when non-complete), "AI summary" badge when ai_explanation is non-null,
      program count, View result link (→ /fit-finder/results/{id}), Delete form button.
  Security: no service client, no callAI, no getAIEnv, no SUPABASE_SERVICE_ROLE_KEY,
    no createServiceClient, no profile ID or user ID in forms.

---

### Files Modified

src/pages/fit-finder/results/[id].astro:
  Added "← Back to saved results" link (href="/fit-finder/results") in a max-w-3xl div
    above the h1 heading. Styled as small muted gray text.
  Added "Delete this result" form (method="post", action="/fit-finder/results",
    hidden input name="id" value={result.id}, button text "Delete this result") in the
    action buttons row alongside existing Update/Run/Browse links.
  No logic changes. No AI calls. No service client. No new imports.

docs/06-status.md:
  Marked Phase 27 complete. Added Phase 27 to Last Completed Work section.
  Updated current phase to Phase 28.

docs/07-task-log.md:
  Added this entry.

---

### List Route Behavior

GET /fit-finder/results:
  Anonymous → redirect to /login?redirect=/fit-finder/results.
  Logged-in + no rows → empty state with CTAs.
  Logged-in + query error → error state with Run Fit Finder link.
  Logged-in + rows → list of result cards, newest first.
  RLS ensures only the current user's rows are returned.
  No service client used.

POST /fit-finder/results:
  Anonymous → redirect to /login?redirect=/fit-finder/results.
  Invalid/missing UUID → sets deleteError, re-renders list.
  Valid UUID, owned by user → deletes row, CASCADE removes ai_finder_program_matches,
    redirects to /fit-finder/results.
  Valid UUID, not owned by user → RLS no-ops delete, redirect to list (no disclosure).
  DB error on delete → sets deleteError, re-renders list.

---

### Delete Behavior

- Server-side POST only; no client JS.
- Only 'id' (result UUID) accepted from form; no user_id or student_profile_id.
- UUID regex validation before query.
- Deletion via SSR client: supabase.from('ai_finder_results').delete().eq('id', rawId).
- RLS ai_finder_results_delete_own enforces ownership via student_profiles.user_id = auth.uid().
- ai_finder_program_matches removed automatically by Postgres ON DELETE CASCADE.
- No explicit match-row deletion in page code.
- POST-Redirect-GET pattern: successful delete redirects to prevent re-submission.

---

### RLS/Ownership Behavior

- ai_finder_results SELECT: ai_finder_results_select_own — EXISTS(SELECT 1 FROM
  student_profiles sp WHERE sp.id = afr.student_profile_id AND sp.user_id = auth.uid()).
  Plain .select() returns only current user's rows; no page-level user filter needed.
- ai_finder_results DELETE: ai_finder_results_delete_own — same EXISTS check.
  Non-owner UUID: 0 rows affected, no error; page redirects or shows nothing different.
- ai_finder_program_matches: no explicit delete policy for authenticated users (intentional).
  Cascade handles removal when parent row is deleted.
- Anonymous access: blocked before any query by redirect to login.
- Non-owner detail access: existing 404 behavior in [id].astro unchanged.
- No service_role bypass anywhere in Phase 27 files.

---

### Detail Page Changes ([id].astro)

- Added "← Back to saved results" link above heading (href="/fit-finder/results").
- Added "Delete this result" form in action buttons row:
  method="post", action="/fit-finder/results", hidden id=result.id.
  Submits to index.astro POST handler which enforces RLS and redirects.
- No changes to query logic, ownership checks, 404 handling, AI display, or imports.

---

### Explicit Exclusions

- No AI calls (callAI, getAIEnv, Gemini, OpenAI not imported or used).
- No service_role, SERVICE_ROLE, SUPABASE_SERVICE_ROLE_KEY in pages/components/layouts.
- No createServiceClient in pages/components/layouts.
- No public sharing or shareable links.
- No anonymous persistence.
- No migrations.
- No new npm dependencies.
- No React or client-side JS.
- No admin page changes.
- No matching algorithm changes (result.astro, persist.ts untouched).
- No student_profile_id or user_id in forms.

---

### Build Result

npm run build: PASS (Cloudflare server build, 1.88s, zero errors, zero warnings in src).

---

### Safety Grep Results

Get-ChildItem -Path src/pages,src/components,src/layouts -Recurse -File |
  Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE"
→ 0 matches.

Get-ChildItem -Path src/pages,src/components,src/layouts -Recurse -File |
  Select-String -Pattern "createServiceClient"
→ 0 matches.

Get-ChildItem -Path src/pages,src/components -Recurse -File |
  Select-String -Pattern "callAI|Gemini|OpenAI"
→ callAI appears in src/pages/fit-finder/result.astro only (import + invocation,
  unchanged from Phase 26). No Gemini or OpenAI matches anywhere.

Get-ChildItem -Path src/pages/fit-finder/results -Recurse -File |
  Select-String -Pattern "callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient"
→ 0 matches.

---

### Manual Test Checklist

- [ ] Anonymous /fit-finder/results redirects to /login?redirect=/fit-finder/results.
- [ ] Logged-in user with no saved results sees empty state.
- [ ] Logged-in user with saved results sees own results list, newest first.
- [ ] Each result card shows date, count, AI badge (if applicable), View result link, Delete button.
- [ ] View result link navigates to /fit-finder/results/[id] and loads correctly.
- [ ] Detail page shows "← Back to saved results" link.
- [ ] Detail page shows "Delete this result" button.
- [ ] Delete from list page removes result and redirects back to list.
- [ ] Delete from detail page removes result and redirects to list.
- [ ] Deleted result URL returns 404.
- [ ] User B's result UUID submitted in delete form by User A: no disclosure, User A's list unchanged.
- [ ] User B's result UUID in URL: 404 (existing behavior).
- [ ] /fit-finder/result (live Fit Finder) still works without regression.

---


## 2026-06-18 - Phase 26: AI Finder Result Persistence

Tool:
Claude (claude-sonnet-4-6)

Goal:
Persist each logged-in user's Fit Finder run in the existing ai_finder_results and
ai_finder_program_matches tables. Add a private saved-result route at
/fit-finder/results/[id]. No chatbot, no public share links, no anonymous persistence,
no matching algorithm changes, no AI prompt changes, no migrations, no new dependencies,
no React, no client-side JS, no admin changes.

---

### Files Created

src/lib/ai/finder/persist.ts (new):
  Server-only persistence helper. Exports persistFinderResult(input, env: AIRuntimeEnv).
  Imports AIRuntimeEnv from ../types and createServiceClient from ../../supabase/service.
  Extracts SUPABASE_SERVICE_ROLE_KEY from env internally — key string never appears in
  calling pages. Returns null immediately if key is absent. Creates service client,
  inserts ai_finder_results row with result_status='complete', then batch-inserts
  ai_finder_program_matches. If match insert fails: updates result_status='failed' and
  returns null. Returns result UUID on success, null on any failure. Never throws.

src/pages/fit-finder/results/[id].astro (new):
  Private saved-result page. SSR, noindex=true. Anonymous users redirect to
  /login?redirect=/fit-finder/results/{id}. Validates params.id against UUID regex
  (invalid → 404). Uses SSR client for all reads — no service client, no callAI,
  no getAIEnv. Queries ai_finder_results by id; RLS (student_profiles.user_id = auth.uid())
  enforces ownership — null result means not found or non-owner, both return 404 (no
  information leak). Queries ai_finder_program_matches with programs FK join (universities,
  countries, cities, degree_levels, subjects, tuition fields, official_url) ordered by rank.
  Renders: heading, saved date, result_status='failed' warning if applicable, blue
  disclaimer box, stale-data note, optional AI explanation (purple box), action buttons
  (Update preferences / Run Fit Finder again / Browse all programs), match cards with
  rank badge (#N), stored match_reasons and warnings (jsonb parsed back to string[]),
  current program data from FK join. Does not re-run matching or call AI.

---

### Files Modified

src/pages/fit-finder/result.astro:
  Added import: persistFinderResult from ../../lib/ai/finder/persist.
  Added variables: savedResultId (string | null = null), persistAttempted (bool = false).
  Hoisted getAIEnv(Astro.locals) call outside AI try/catch to top of the
    `pageState === 'ready' && matches.length > 0` block so aiEnv is available for
    both the AI call and the persist call.
  Added variables: aiModelUsed, promptTokenCount, completionTokenCount (captured from
    aiResponse when AI call succeeds, for persistence).
  After AI try/catch: added persist try/catch block:
    1. Dedupe check via SSR client: query ai_finder_results WHERE student_profile_id =
       profile.id AND result_status='complete' AND created_at >= (now - 60s); if found,
       set savedResultId = existing id, skip persist.
    2. If no recent result: set persistAttempted = true, call persistFinderResult(input, aiEnv).
       aiEnv is passed whole — SUPABASE_SERVICE_ROLE_KEY is extracted inside persist.ts,
       never referenced in the page.
    3. savedResultId = returned UUID or null.
  Persist try/catch is outer; any exception is silent — never affects match rendering.
  Template: after action buttons, added:
    - Green banner with "Your matches have been saved. View saved result →" link when
      savedResultId is non-null.
    - Muted "Results could not be saved this time." text when persistAttempted && !savedResultId.
    - No note when service key is absent (persistAttempted stays false).

---

### Persistence Strategy

ai_finder_results row inserted:
  student_profile_id   = profile.id
  result_status        = 'complete'
  shortlist_count      = matches.length (max 20)
  ai_explanation       = aiExplanation (null when AI unavailable)
  ai_model_used        = aiModelUsed (null when AI unavailable)
  prompt_token_count   = promptTokenCount (0 when AI unavailable)
  completion_token_count = completionTokenCount (0 when AI unavailable)
  expires_at           = null (logged-in user; permanent)

ai_finder_program_matches rows (one per top match, up to 20):
  ai_finder_result_id  = inserted result id
  program_id           = match.program.id (FK → programs, RESTRICT)
  rank                 = index + 1 (1-based)
  score                = match.points
  match_reasons        = match.reasons (jsonb string array)
  warnings             = match.warnings (jsonb string array)

Not persisted:
  prompt text, raw AI model response, user email, session token, additional_notes,
  raw admission_requirements, english_requirements, gpa_requirements, profile scoring
  signal IDs (degree level id, subject ids, country ids, budget values).

---

### Dedupe Strategy

60-second window via SSR client. Before calling persistFinderResult, result.astro queries
ai_finder_results for the current profile_id with result_status='complete' and
created_at >= (now - 60 seconds). If found, reuses that result's UUID and skips the
persist call. If not found, proceeds with persistence. Prevents duplicate rows on page
refresh without suppressing intentional re-runs after profile updates or long sessions.
RLS enforces the dedupe query is scoped to the current user's own results.

---

### Saved-Result Route

/fit-finder/results/[id]:
  Auth: anonymous → redirect to /login?redirect=... UUID validation: invalid format → 404.
  Ownership: ai_finder_results SELECT RLS uses EXISTS on student_profiles.user_id = auth.uid().
    Non-owner access returns the same 404 as a missing result. No separate ownership check
    needed in page code — RLS handles it. No information leak about other users' results.
  Program data: fetched via ai_finder_program_matches → programs FK join (current DB state).
    Match scores and reasons are from stored jsonb (historical). Stale-data note shown.
  No service client, no AI calls, no matching engine.

---

### RLS / Ownership Behavior

ai_finder_results INSERT: no authenticated policy → service client only (inside persist.ts).
ai_finder_results SELECT: authenticated RLS (student_profiles.user_id = auth.uid()) →
  SSR client works for dedupe check and [id].astro reads.
ai_finder_program_matches INSERT: no authenticated policy → service client only (inside persist.ts).
ai_finder_program_matches SELECT: authenticated RLS (via parent result owner chain) →
  SSR client works for [id].astro reads.
Non-owner access to [id].astro: RLS returns null → page returns 404.
Anonymous access to [id].astro: SSR client has no session → redirect to login.

---

### Data Not Persisted

Prompt text. Raw AI model response text (only post-guardrail ai_explanation stored).
User email. Session token. additional_notes. Raw admission_requirements,
english_requirements, gpa_requirements. Profile scoring signal IDs (degree_level_id,
preferred subject UUIDs, preferred country UUIDs, budget_min, budget_max, budget_currency).
Program display details other than program_id FK and match scoring data.

---

### Failure Behavior

Service key absent: persistFinderResult returns null immediately; persistAttempted stays
  false; no failure note shown; transient matches render normally.
ai_finder_results INSERT fails: returns null; persistAttempted=true; muted failure note shown;
  matches still render.
ai_finder_program_matches INSERT fails: updates result_status='failed'; returns null;
  same failure note; matches still render.
Dedupe check fails (exception): outer catch; persistAttempted stays false; no persist
  attempt; no failure note; matches still render.
Any unexpected persist error: outer try/catch; savedResultId=null; persistAttempted depends
  on where the exception occurred.
Saved-result page: result_status='failed' shows yellow "may be incomplete" banner; renders
  whatever match rows exist.
All failures: transient /fit-finder/result page continues to render matches and AI summary.

---

### Explicit Exclusions

No public share links.
No anonymous persistence.
No automatic redirect to saved result.
No chatbot.
No free-form prompt.
No migrations (schema supported this already).
No new npm dependencies.
No React or client-side JS.
No admin UI for viewing user results.
No AI calls on the saved-result view page.
No re-running matching on the saved-result view page.
No email, session token, additional_notes, or raw requirements stored.
No prompt text or raw model response text beyond ai_explanation.
No matching algorithm changes.
No AI prompt changes.
No admin page changes.
No src/lib/ai/gateway.ts changes.
No src/lib/ai/env.ts changes.
No src/lib/ai/types.ts changes.
No src/lib/ai/prompts/* changes.
No src/lib/ai/safety/* changes.
No src/lib/ai/providers/* changes.
No src/lib/ai/usage/* changes.
No supabase/migrations/* changes.

---

### Build Result

npm run build: PASS (Cloudflare server build, 1.58s, zero errors).

---

### Safety Grep Results

service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts
  → 0 matches.

PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/
  → 0 matches.

createServiceClient in src/pages,src/components,src/layouts
  → 0 matches.

callAI in src/pages,src/components
  → 2 matches, both in src/pages/fit-finder/result.astro (import + invocation, unchanged
    from Phase 25).

callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient in src/pages/fit-finder/results
  → 0 matches.

ai_finder_results|ai_finder_program_matches in src/pages
  → src/pages/fit-finder/result.astro (dedupe check — SSR client read only)
  → src/pages/fit-finder/results/[id].astro (saved-result reads only).

---

### Manual Test Checklist

Persistence:
  [ ] Logged-in user with profile + matches → /fit-finder/result → green "Your matches
      have been saved. View saved result →" link appears.
  [ ] Click "View saved result →" → /fit-finder/results/{uuid} renders with match list,
      rank badges, reasons, warnings, program details from FK join.
  [ ] Refresh /fit-finder/result within 60 seconds → same saved result link shown
      (no new row created — dedupe fired).
  [ ] Visit /fit-finder/result after 60 seconds → new row created, new link shown.
  [ ] With SUPABASE_SERVICE_ROLE_KEY absent → transient matches render, no save link,
      no failure note, no error.
  [ ] With DB unavailable during persist → transient matches render, muted failure note,
      no crash.

Ownership isolation:
  [ ] User A visits /fit-finder/results/{A-uuid} → 200, sees their result.
  [ ] User B visits /fit-finder/results/{A-uuid} → 404.
  [ ] Anonymous visits /fit-finder/results/{any-uuid} → redirect to /login?redirect=...
  [ ] /fit-finder/results/not-a-uuid → 404.
  [ ] /fit-finder/results/00000000-0000-0000-0000-000000000000 (valid UUID, wrong id) → 404.

AI explanation persistence:
  [ ] When AI explanation generated → ai_explanation stored in DB, shown on saved-result page.
  [ ] When AI unavailable → ai_explanation null in DB, no AI section on saved-result page.

Saved-result page:
  [ ] result_status='failed' row → yellow "may be incomplete" banner shown.
  [ ] Stale-data note always visible.
  [ ] Action buttons: Update preferences, Run Fit Finder again, Browse all programs.
  [ ] Program links point to /programs/[slug], university links to /universities/[slug].
  [ ] noindex confirmed in page source.

Regression:
  [ ] /fit-finder/result transient matches still render correctly (scores, reasons, warnings).
  [ ] AI explanation still renders on /fit-finder/result when available.
  [ ] Anonymous, no_profile, sparse_profile, error, no_matches states: no regression.
  [ ] No profile ID or service key in any rendered HTML.

---


## 2026-06-18 - Phase 25: AI Usage Logging + Rate Limit Enforcement

Tool:
Claude (claude-sonnet-4-6)

Goal:
Activate server-only AI usage logging and daily per-user rate-limit enforcement.
Replace writeUsageLog and checkRateLimit stubs with real implementations backed
by ai_usage_logs via a narrow service role Supabase client. No chatbot, no
free-form prompt, no new public pages, no AI finder result persistence, no
migrations, no new dependencies, no React, no client-side JS.

---

### user_profiles FK Verification

Inspected supabase/migrations/002_auth_roles.sql line 31:
  CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ...
  )

And supabase/migrations/012_ai_tables.sql:
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL

Chain confirmed:
  auth.users.id (UUID) ← public.user_profiles.id (same UUID, PK/FK)
    ← ai_usage_logs.user_id (FK)

user.id from supabase.auth.getUser() is the correct value to use as userId
in AIRequest and to store in ai_usage_logs.user_id. Implementation proceeded.

---

### Files Created

src/lib/supabase/service.ts (new):
  Server-only service role Supabase client factory. Exports
  createServiceClient(serviceRoleKey: string). Uses @supabase/supabase-js
  createClient with persistSession: false, autoRefreshToken: false.
  No cookies, no auth side effects. Key passed as parameter — never hardcoded
  or logged. Must never be imported from browser code, client components,
  Astro client scripts, or layouts.

---

### Files Modified

src/lib/ai/types.ts:
  AIUsageEntry — added costEstimateUsd?: number | null.
  AIRuntimeEnv — added SUPABASE_SERVICE_ROLE_KEY?: string with server-only comment.

src/lib/ai/env.ts:
  Added SUPABASE_SERVICE_ROLE_KEY: raw['SUPABASE_SERVICE_ROLE_KEY'] to returned
  AIRuntimeEnv object, alongside other AI runtime vars.

src/lib/ai/usage/limits.ts:
  Replaced always-allowed stub with real fail-closed rate limit implementation.
  New exported interfaces: RateLimitResult (added reason field), RateLimitOpts.
  New signature: checkRateLimit(userId, _sessionType, opts: RateLimitOpts).
  Algorithm:
    userId null → { allowed: false, reason: 'service_unavailable' }
    serviceClient null → { allowed: false, reason: 'service_unavailable' }
    PostgREST count: ai_usage_logs where user_id = userId AND
      created_at >= UTC day start (Date.UTC of today midnight).
    Query error → { allowed: false, reason: 'service_unavailable' }
    count >= dailyLimit → { allowed: false, reason: 'limit_exceeded' }
    Otherwise → { allowed: true, remaining: dailyLimit - count }
  Counts across all session_type values (not per-type).

src/lib/ai/usage/logging.ts:
  Replaced no-op stub with real insert via service client.
  New signature: writeUsageLog(entry: AIUsageEntry, serviceClient: SupabaseClient | null).
  If serviceClient null → return (no-op, safe).
  Inserts: user_id, session_type, tokens_used, model_used, cost_estimate_usd.
  Insert error → console.error only, never throws.
  Fire-and-forget contract preserved.

src/lib/ai/gateway.ts:
  Added import: createServiceClient from '../supabase/service'.
  In callAI(), after input guardrail (Step 1):
    Creates serviceClient from env.SUPABASE_SERVICE_ROLE_KEY (null if absent).
    Parses dailyLimit from env.AI_RATE_LIMIT_USER_DAILY with default 20.
  Step 2 (rate limit) now passes { serviceClient, dailyLimit } to checkRateLimit.
  Rate limit fallback messages:
    'limit_exceeded' → "You have reached today's AI usage limit. Your rule-based
      matches are still available."
    other → "AI is temporarily unavailable."
  Step 7 (writeUsageLog) now passes serviceClient as second arg.
  costEstimateUsd: null passed in entry (cost map deferred).
  Comment updated from "no-op stub" to real description.

.env.example:
  Added SUPABASE_SERVICE_ROLE_KEY= with strict server-only annotation explaining
  it bypasses RLS, must never use PUBLIC_ prefix, set via wrangler secret.
  AI_RATE_LIMIT comment updated to Phase 25+.

---

### Not Modified

src/pages/fit-finder/result.astro — no changes required; existing try/catch
  and fallbackUsed guard already handle all rate-limit and logging fallback paths.
src/pages/fit-finder/index.astro
src/lib/ai/providers/gemini.ts
src/lib/ai/prompts/*
src/lib/ai/safety/guardrails.ts
src/lib/supabase/server.ts
src/lib/supabase/client.ts
src/pages/ (all public routes)
src/pages/admin/*
src/components/*
src/layouts/*
supabase/migrations/*
package.json
astro.config.mjs

---

### Service Client Strategy

createServiceClient(key) in src/lib/supabase/service.ts uses @supabase/supabase-js
(already a direct dependency in package.json). Key is received as a function
parameter, never module-level. Service key comes from locals.runtime.env via
getAIEnv — same Cloudflare Workers pattern as GEMINI_API_KEY. createServiceClient
is called once inside callAI() per request. The resulting client is passed into
checkRateLimit and writeUsageLog, then discarded.

---

### Env Strategy

SUPABASE_SERVICE_ROLE_KEY is read from locals.runtime.env, never from
import.meta.env.PUBLIC_*. It has no PUBLIC_ prefix. It is documented in
.env.example with a server-only annotation. In Cloudflare Workers production
it must be set via: wrangler secret put SUPABASE_SERVICE_ROLE_KEY

---

### Rate-Limit Behaviour

Fail-closed: Gemini is never called unless checkRateLimit returns allowed=true.
  No service key → Gemini not called.
  Anonymous user → Gemini not called.
  Query error → Gemini not called.
  Limit exceeded → Gemini not called.
Fallback text is user-friendly and does not reveal internal service key/infra details.
Fit Finder result page: rule-based matches always render; AI section silently absent
  when fallbackUsed=true.

---

### Usage Logging Behaviour

Logged (ai_usage_logs):
  user_id (auth UUID), session_type, tokens_used, model_used, cost_estimate_usd (null).
Not logged:
  Prompt text, AI response text, profile UUID, user email, session token,
  additional_notes, raw admission/English/GPA requirements, internal UUIDs.
Failure handling: console.error on insert error; function never throws.
Call site: fire-and-forget writeUsageLog(...).catch(() => {}) after Step 6
  output guardrail passes. Guardrail-tripped and provider-failure paths are
  not logged (tokens_used not available or unreliable in those paths).

---

### Fail-Closed Behaviour

Without SUPABASE_SERVICE_ROLE_KEY in Cloudflare Workers env:
  serviceClient = null.
  checkRateLimit returns { allowed: false, reason: 'service_unavailable' }.
  callAI returns { text: 'AI is temporarily unavailable.', fallbackUsed: true }.
  Gemini is never called. writeUsageLog returns immediately (no-op).
  Rule-based matches on /fit-finder/result render normally.

This is intentional: if usage tracking is not wired, AI should not silently
run unchecked and unlogged.

---

### Explicit Exclusions

No ai_finder_results insert.
No ai_finder_program_matches insert.
No chatbot UI.
No free-form user prompt.
No new public pages.
No admin UI for viewing usage logs.
No React or client-side JS.
No migrations.
No new npm dependencies.
No matching algorithm changes.
No prompt text or model response text logged.
No cost estimate map (costEstimateUsd: null for Phase 25).
No anonymous rate limiting (no anonymous AI calls exist yet).
No src/pages/fit-finder/result.astro changes.
No src/lib/ai/providers/* changes.
No src/lib/ai/prompts/* changes.
No src/lib/ai/safety/guardrails.ts changes.

---

### Docs Updated

docs/04-ai-system.md — replaced Phase 23 architecture section with Phase 25:
  updated directory structure, callAI() contract, Phase 25 behaviour, service
  client strategy, rate-limit algorithm, usage logging fields, fail-closed
  behaviour, what is and is not logged, cost_estimate_usd note.
docs/06-status.md — Phase 25 completion entry added; current phase set to Phase 26.
docs/07-task-log.md — this entry.

---

### Build Result

npm run build: PASS (Cloudflare server build, 2.27s, zero errors).

---

### Safety Grep Results

service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts
  → 0 matches.

PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/
  → 0 matches.

callAI in src/pages,src/components
  → 2 matches, both in src/pages/fit-finder/result.astro
    (import line and invocation line only).

ai_usage_logs in src/pages
  → 0 matches.

---

### Manual Test Checklist

With GEMINI_API_KEY + SUPABASE_SERVICE_ROLE_KEY configured:
  [ ] /fit-finder/result logged-in user with matches → AI summary renders.
  [ ] After AI render: 1 new row in ai_usage_logs with correct user_id,
      session_type='finder', non-zero tokens_used, model_used set,
      cost_estimate_usd null.
  [ ] No prompt text or response text in ai_usage_logs row.

Rate limit test (set AI_RATE_LIMIT_USER_DAILY=1):
  [ ] First /fit-finder/result load → AI summary renders, 1 row logged.
  [ ] Second load → no AI section rendered; rule-based matches still render.
  [ ] No error state, no broken layout on rate-limited load.

Without SUPABASE_SERVICE_ROLE_KEY:
  [ ] /fit-finder/result → no AI section rendered; rule-based matches render normally.
  [ ] No error state or broken layout.
  [ ] No Gemini call made (GEMINI_API_KEY not consumed).

Anonymous user:
  [ ] /fit-finder/result → sign-in state renders, no AI call attempted.

---


## 2026-06-18 - Phase 24: AI Finder Explanation MVP

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add optional AI explanation section to /fit-finder/result. AI explains the top 3
already-computed rule-based matches using only the matched program context and saved
preference summary. Rule-based matches remain the source of truth. No chatbot, no
free-form prompt, no AI DB writes, no service_role, no migrations, no new dependencies,
no React, no client-side JS.

---

### Files Changed

Modified:
  src/pages/fit-finder/result.astro
  docs/06-status.md
  docs/07-task-log.md

---

### AI Context Payload

Shape passed to callAI():
  sessionType: 'finder'
  userMessage: 'Explain the shortlisted programs for this student.'
  context.source: 'programs'
  context.records: top 3 matches from matches.slice(0, 3), each containing:
    title, university, country, city, degreeLevel, subject,
    tuitionRange (formatted string), officialUrl, matchPercentage,
    matchReasons (string[]), warnings (string[])
  context.studentProfile:
    degreeLevel (name), targetCountries (names[]), subjects (names[]),
    budgetMin, budgetMax, currency
  userId: user.id (server-side only, for future rate-limit use)

---

### Data Minimization

Excluded from AI context:
  profile ID, user ID, email, session token, additional_notes,
  raw admission_requirements, raw english_requirements, raw gpa_requirements,
  internal UUIDs (program/university/country/city IDs),
  study_mode, delivery_mode, language_of_instruction raw enum values

---

### callAI Integration

Added to src/pages/fit-finder/result.astro frontmatter:
  imports: callAI, getAIEnv, AIContext type
  variable: let aiExplanation: string | null = null
  AI call block: runs after matches are scored/sorted, inside
    if (pageState === 'ready' && matches.length > 0) guard
  No AI call for: anonymous, no_profile, sparse_profile, error, no_matches states
  Entire block wrapped in try/catch — AI failure never breaks rule-based matches

---

### Fallback Behavior

  Missing GEMINI_API_KEY → resolveProvider throws → callAI returns fallbackUsed=true
    → aiExplanation stays null → AI section not rendered
  Provider/network error → callAI catches and returns fallbackUsed=true → same
  Output guardrail trip → callAI returns guardrailTripped=true → same
  Empty text → guard (!aiResponse.fallbackUsed && !aiResponse.guardrailTripped
    && text.trim().length > 0) prevents setting aiExplanation
  Outer try/catch → any unexpected error silently suppressed

---

### Rendering Strategy

  AI section renders only when aiExplanation !== null
  Placed: between action buttons and match cards (in 'ready' state only)
  Visual: bg-purple-50 border-purple-100 rounded-md
  Label: "AI summary" (h2, text-sm font-semibold text-purple-900)
  Disclaimer: rendered above AI text in text-xs text-purple-700
  Body: aiExplanation.split(/\n\n+/).map(para => <p>{para}</p>)
  No set:html. Astro default HTML escaping. No markdown renderer.

---

### Explicit Exclusions

  No ai_finder_results insert
  No ai_finder_program_matches insert
  No ai_usage_logs write (writeUsageLog remains no-op stub)
  No service_role
  No migrations
  No new npm dependencies
  No React or client-side JS
  No chatbot UI
  No free-form user prompt
  No src/lib/ai/* changes
  No src/pages/fit-finder/index.astro changes
  No admin changes
  No matching algorithm changes
  No profile ID in rendered HTML

---

### Build Result

  npm run build: PASS (Cloudflare server build, 1.81s, zero errors)

---

### Safety Grep Results

  service_role/SERVICE_ROLE/SUPABASE_SERVICE in src → 0 matches
  PUBLIC_GEMINI/PUBLIC_AI in src → 0 matches
  callAI in src/pages,src/components → 2 matches, both in
    src/pages/fit-finder/result.astro (import + invocation only)
  ai_finder_results/ai_finder_program_matches/ai_usage_logs in fit-finder → 0 matches

---

### Manual Test Checklist

With GEMINI_API_KEY set:
  [ ] Logged-in user with saved profile + matches → AI section renders with
      "AI summary" heading and disclaimer
  [ ] AI text renders as plain paragraphs, no raw HTML or markdown visible
  [ ] Disclaimer text is correct and visible
  [ ] Match cards still render correctly (no regression)
  [ ] No profile ID or user ID in page source
  [ ] No API key in page source or response headers

Without GEMINI_API_KEY:
  [ ] /fit-finder/result renders rule-based matches normally
  [ ] No AI section visible
  [ ] No error message or broken layout

State regression:
  [ ] Anonymous user → sign-in state renders, no AI call
  [ ] No profile → "No saved profile" state renders
  [ ] Sparse profile → "Add more preferences" state renders
  [ ] No matches → "No preference matches found" state renders, no AI section

---


## 2026-06-18 - Phase 23: AI Runtime Env + Provider Wiring

Tool:
Claude (claude-sonnet-4-6)

Goal:
Wire server-only AI runtime env extraction, implement Gemini REST provider behind
the existing AIProvider interface, and connect the gateway to resolve and call a
live provider. No public AI surface, no Fit Finder AI output, no chatbot, no AI
database writes, no service_role, no migrations, no new dependencies, no React,
no client-side JS.

---

### Files Changed

Created:
  src/lib/ai/env.ts

Modified:
  src/lib/ai/providers/gemini.ts
  src/lib/ai/gateway.ts
  .env.example
  docs/04-ai-system.md
  docs/06-status.md
  docs/07-task-log.md

Not modified:
  src/lib/ai/types.ts
  src/lib/ai/providers/interface.ts
  src/lib/ai/prompts/finder-summary.ts
  src/lib/ai/prompts/chat-answer.ts
  src/lib/ai/safety/guardrails.ts
  src/lib/ai/usage/logging.ts
  src/lib/ai/usage/limits.ts
  src/pages/fit-finder/*
  src/pages/admin/*
  src/pages/ (all public routes)
  src/components/*
  package.json
  astro.config.mjs

---

### Runtime Env Strategy

In @astrojs/cloudflare, Cloudflare secrets and bindings are available at
locals.runtime.env — not import.meta.env and not process.env. src/env.d.ts
does not exist in this project, so a safe cast is required.

getAIEnv(locals) in src/lib/ai/env.ts performs the cast once and returns a
typed AIRuntimeEnv object. Future server endpoints that call callAI() import
getAIEnv and pass Astro.locals cast as Record<string, unknown>. This keeps
the unsafe cast in one place.

AI env vars extracted:
  AI_PROVIDER              (active provider name)
  AI_MODEL                 (model string)
  GEMINI_API_KEY           (server-only secret — never PUBLIC_ prefix)
  AI_RATE_LIMIT_ANON_DAILY (rate limit — deferred)
  AI_RATE_LIMIT_USER_DAILY (rate limit — deferred)

---

### Provider Strategy

resolveProvider(env) added inside gateway.ts (not a separate file — one provider,
no premature abstraction). Reads env.AI_PROVIDER (default: gemini). For gemini:
checks env.GEMINI_API_KEY — throws if absent (no key value in error message).
callAI() catches resolveProvider errors and returns a safe fallback AIResponse.

Unknown provider name → throws → caught by callAI → safe fallback.

---

### Gemini REST Provider

Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}

Request shape:
  system_instruction.parts[0].text = prompt.system
  contents[0] = { role: 'user', parts: [{ text: prompt.user }] }
  generationConfig.temperature = config.temperature ?? 0.2
  generationConfig.maxOutputTokens = config.maxOutputTokens ?? 2048

Response parsing:
  text = candidates[0].content.parts[].text joined (all parts, not just first)
  promptTokens = usageMetadata.promptTokenCount ?? 0
  completionTokens = usageMetadata.candidatesTokenCount ?? 0
  modelUsed = response.modelVersion ?? config.model

Error handling in provider (all throw — caught by gateway):
  HTTP !ok → throws "Gemini API returned status {N}" (no response body)
  empty candidates → throws controlled message
  finishReason SAFETY or RECITATION → throws with finishReason
  missing/empty text → throws controlled message

---

### Gateway Behavior

callAI(request, env) now executes all 8 steps:
  1. checkInput guardrail (unchanged)
  2. checkRateLimit (unchanged stub)
  3. resolveProvider — try/catch → fallback on misconfiguration
  4. buildFinderPrompt or buildChatPrompt based on sessionType
  5. provider.complete() — try/catch → fallback on provider error
  6. checkOutput guardrail — guardrailTripped=true on failure, no blocked text returned
  7. writeUsageLog() fire-and-forget no-op
  8. return AIResponse with provider text and token counts

Every failure path returns a valid AIResponse — callAI never throws to its caller.

---

### Model Decision

Default changed from gemini-2.0-flash to gemini-2.5-flash (gemini-2.0-flash is shut
down). Applied in:
  gateway.ts fallback default: env.AI_MODEL ?? 'gemini-2.5-flash'
  .env.example: AI_MODEL=gemini-2.5-flash
  docs/04-ai-system.md: updated example

---

### Usage Logging (deferred)

writeUsageLog() in usage/logging.ts remains a no-op stub. Writing to ai_usage_logs
requires service_role (table RLS design requires privileged write per Phase 18 notes).
Gateway calls it correctly as fire-and-forget; when Phase 24+ wires logging, only
logging.ts changes.

### Rate Limiting (deferred)

checkRateLimit() in usage/limits.ts remains always-allowed stub. Enforcement requires
querying ai_usage_logs, which is deferred with usage logging. Gateway short-circuit on
!allowed is live and correct.

---

### Explicit Exclusions

No public AI endpoint.
No smoke/test endpoint.
No Fit Finder AI output.
No chatbot.
No ai_usage_logs writes.
No rate-limit enforcement.
No service_role.
No migrations.
No new npm dependencies.
No React or client-side JS.
No public page changes.
No admin UI changes.
No src/pages/api/ai/smoke.ts.

---

### Build Result

npm run build: PASS (Cloudflare server build, 2.14s, zero errors).

---

### Safety Grep Results

PUBLIC_GEMINI|PUBLIC_AI in src/ → 0 matches.
service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/ → 0 matches.
callAI in src/pages/, src/components/ → 0 matches.
src/pages/api/ai/smoke.ts → does not exist.

---

### Manual Test Checklist (for future smoke verification with real GEMINI_API_KEY)

1. Set GEMINI_API_KEY in .env.local and confirm npm run dev starts without error.
2. Create a temporary server-only script or admin endpoint to call callAI() with
   a fixed AIRequest and log the AIResponse — verify text is non-empty and
   fallbackUsed is false.
3. Remove GEMINI_API_KEY from .env.local — confirm callAI returns fallbackUsed=true
   and "AI is not available at this time." without crashing.
4. Set AI_PROVIDER=unknown — confirm callAI returns fallbackUsed=true.
5. Confirm /fit-finder/result still works as before (no AI output, no regression).
6. Confirm all public pages load without error (no callAI import in any page).

---


## 2026-06-17 - Phase 22: Legal / Trust / Disclaimer Pages Foundation

Tool:
Claude (claude-sonnet-4-6)

Goal:
Add plain-language legal/trust/disclaimer pages and a public footer before live AI features
are enabled. No AI calls, no database writes, no service_role, no migrations, no new
dependencies, no React, no client-side JS, no admin changes, no auth changes.

---

### Files Changed

Created:
  src/components/public/PublicFooter.astro
  src/pages/about.astro
  src/pages/privacy.astro
  src/pages/terms.astro
  src/pages/disclaimer.astro

Modified:
  src/layouts/PublicLayout.astro
  src/pages/sitemap.xml.ts
  docs/06-status.md
  docs/07-task-log.md

Not modified:
  src/components/public/PublicNav.astro
  src/lib/ai/*
  src/pages/fit-finder/*
  src/pages/admin/*
  supabase/migrations/*
  package.json

---

### Pages Added

  /about      PublicLayout. Sections: what DegreeWiki is, what it is not, data accuracy,
              Fit Finder explanation, AI features (future), corrections placeholder.
  /privacy    PublicLayout. Sections: what data we collect, what we do not collect,
              AI features (future), third-party services (Supabase/Cloudflare/Cloudinary),
              cookies, data deletion, changes to statement.
  /terms      PublicLayout. Sections: about DegreeWiki, information accuracy, not professional
              advice, Fit Finder and AI features, acceptable use, accounts, limitation of
              liability, changes.
  /disclaimer PublicLayout. Sections: independence, data accuracy, Fit Finder match scores,
              AI features, no guarantees.

All four pages: static Astro only, canonical prop set via SITE_URL, no noindex, no database
queries, no Supabase client, no auth.

---

### Footer Strategy

New component: src/components/public/PublicFooter.astro
  - Minimal border-t footer below <main> in PublicLayout.
  - Shows © {year} DegreeWiki + About / Privacy / Terms / Disclaimer links.
  - Year evaluated at SSR time: new Date().getFullYear().
  - Quiet styling: text-xs text-gray-400 with hover:text-gray-600.
  - Added to PublicLayout via import + render below <main>; appears on every public page.
  - Legal links not added to PublicNav.

---

### Sitemap Update

src/pages/sitemap.xml.ts STATIC_PATHS updated:
  Before: ['/', '/programs', '/scholarships', '/universities', '/guides']
  After:  ['/', '/programs', '/scholarships', '/universities', '/guides', '/about', '/privacy', '/terms', '/disclaimer']

---

### Legal/Trust Wording Decisions

- Plain language throughout; no legalese, no GDPR/CCPA compliance assertions.
- No lawyer-review claims.
- DegreeWiki described as "an education information platform" not an official source.
- Explicitly states DegreeWiki is not: a university, scholarship provider, government agency,
  legal advisor, financial advisor, or admissions assessor.
- Data accuracy caveat on all pages: program details, tuition, deadlines, admission requirements,
  scholarship eligibility, visa policies "can change without notice."
- Official source reminder consistent across all pages: "Always confirm important details
  directly with the official university, scholarship provider, or government website."
- No guarantees stated explicitly: admission, scholarships, visa approval, employment, salary,
  outcomes.
- Fit Finder wording: "preference alignment" / "preference match" — consistent with Phase 21
  result page. Explicitly states scores are not admission/scholarship/visa/eligibility assessments.
- AI wording: "based on available DegreeWiki context" — future-safe; not restricted to
  "database content" to allow for prompt-level context in future phases.
- No invented contact email address; uses placeholder:
  "A public contact and correction channel will be added before launch."
- Cross-page links at bottom of each page for easy navigation between legal pages.

---

### Privacy Wording Decisions

- Acknowledges Supabase Auth as account data provider; Cloudflare as CDN/delivery.
- Fit Finder preferences stored for logged-in users only; not shared publicly.
- Session cookies: functional only; no advertising or tracking cookies currently.
- Future AI usage logs: scoped to rate limiting/cost management; not shared with third parties.
- No GDPR/CCPA compliance claims.
- No overpromised security; "makes a reasonable effort."
- States the privacy statement "will be expanded as the platform grows."
- Data deletion: placeholder wording without inventing an email address.

---

### Explicit Exclusions

  No AI calls. No callAI import. No Gemini/OpenAI. No chatbot.
  No ai_finder_results, ai_finder_program_matches, or ai_usage_logs.
  No service_role. No migrations. No new dependencies. No React or client-side JS.
  No admin changes. No auth changes. No Fit Finder logic changes. No AI gateway changes.
  No cookie banner. No consent management. No analytics. No payment/subscription terms.
  No PublicNav changes.

---

### Build Result

  npm run build: PASS (Cloudflare server build, 1.97s, zero errors).

### service_role Search Result

  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.

### AI Usage Search Result

  Get-ChildItem -Path src/pages/about.astro,src/pages/privacy.astro,src/pages/terms.astro,src/pages/disclaimer.astro -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder" → 0 matches.

---

### Manual Test Checklist

  [ ] GET /about — renders, PublicNav visible, PublicFooter visible with 4 legal links
  [ ] GET /privacy — renders, footer visible
  [ ] GET /terms — renders, footer visible
  [ ] GET /disclaimer — renders, footer visible
  [ ] GET / (homepage) — footer now visible at bottom; auth row still shows; no regression
  [ ] GET /programs — footer visible; filter form no regression
  [ ] GET /fit-finder — footer visible; profile form no regression
  [ ] GET /fit-finder/result — footer visible; match results no regression
  [ ] GET /sitemap.xml — /about, /privacy, /terms, /disclaimer in static URL section
  [ ] /disclaimer: explicitly states match scores are not admission/scholarship/visa assessments
  [ ] /privacy: mentions session cookies, Supabase, Cloudflare, no ad trackers
  [ ] No page claims GDPR/CCPA compliance
  [ ] No page says "lawyer reviewed"
  [ ] No page guarantees admission, scholarship, visa, employment, or salary

---


## 2026-06-17 - Phase 21: Fit Finder Results UX Polish + Matching Safety Review

Tool:
Claude (claude-sonnet-4-6)

Goal:
Polish /fit-finder/result UX and safety wording. Add saved-preferences summary,
score explanation, stronger caveats, improved empty/sparse states, and warning
consolidation. Fix stale copy in /fit-finder. No scoring algorithm changes, no AI,
no writes, no service_role, no migrations, no new dependencies, no React.

---

### Files Changed

Modified:
  src/pages/fit-finder/result.astro
  src/pages/fit-finder/index.astro
  docs/06-status.md
  docs/07-task-log.md

Not modified:
  src/lib/ai/*
  supabase/migrations/*
  src/pages/admin/*
  package.json
  src/lib/supabase/server.ts

---

### Algorithm Preserved

Scoring weights unchanged:
  DEGREE_POINTS = 35
  SUBJECT_PRIMARY_POINTS = 30
  SUBJECT_SECONDARY_POINTS = 24
  SUBJECT_POSSIBLE_POINTS = 30
  COUNTRY_POINTS = 25
  BUDGET_POINTS = 10
  BUDGET_PARTIAL_POINTS = 5

possiblePoints computation unchanged.
Candidate cap 200 unchanged.
Top result cap 20 unchanged.
Deterministic sort unchanged (points DESC, percentage DESC, reasons.length DESC, title ASC).

---

### UX Changes

Preference summary:
  New compact panel shown in ready and no_matches states.
  Shows only the four scoring signals: target degree level name, country names,
  subject names, budget summary. Non-scoring fields excluded.
  Names fetched via PostgREST joins on existing queries (no extra round-trips):
    student_profiles: added degree_levels(name)
    student_profile_subjects: added subjects(name)
    student_profile_countries: added countries(name)
  If fewer than 2 signals present, a soft hint encourages adding more.

Score explanation:
  Blue info box (bg-blue-50) rendered once per page in ready/no_matches states.
  Explains preference-alignment semantics and explicitly disclaims admission,
  eligibility, scholarship, and visa claims.

Score badge label:
  Changed from "match score" to "preference match" on each result card.

Degree reason:
  Now includes degree level name when available:
  "Matches your target degree level: Master's."
  Falls back to generic wording when name join returns null.

Warning consolidation:
  Merged admission_requirements/gpa_requirements and english_requirements warnings
  into one: "Admission and language requirements must be verified with the official source."
  Tuition warnings unchanged.

No-match state:
  Now shows count of published programs checked.
  Single-signal profile: suggests adding more preferences.
  Multi-signal profile: suggests broadening subject/country choices.

Sparse-profile state:
  Now lists specific missing signals (target degree level, subjects of interest,
  preferred countries, budget) so user knows exactly what to add.

Stale copy fix (index.astro):
  "Program matching will be added in the next phase."
  → "Save your study preferences to see possible program matches based on your inputs."

---

### Preference Summary Behavior

Displayed signals: target degree level, preferred countries, preferred subjects, budget.
Not displayed: gpa, english_score, work_experience_years, current_country_id,
  study_start_preference, additional_notes.
Location: below blue info box, above action buttons, in ready and no_matches states only.
Graceful handling: if a join returns null for a name, that row is omitted from the list.

---

### Score / Caveat Wording

Info box text (exact):
  Para 1: "Match scores show how many of your saved preferences a program aligned
  with. A higher score means more of your preferences were matched — it does not
  indicate your chances of admission, eligibility, or scholarship likelihood."
  Para 2: "These are rule-based preference matches only. Match scores do not assess
  your eligibility, academic qualifications, admission chances, scholarship prospects,
  or visa outcomes. Always verify fees, deadlines, admission requirements, and
  eligibility directly with the official university source before applying."

Card footer (unchanged):
  "Confirm fees, deadlines, admission requirements, and eligibility directly with
  the official source." + optional Official program page link.

---

### Explicit Exclusions

No AI calls.
No callAI import.
No Gemini/OpenAI references.
No chatbot.
No ai_finder_results writes.
No ai_finder_program_matches writes.
No ai_usage_logs writes.
No service_role.
No migrations.
No new npm dependencies.
No React or client-side JS.
No admin changes.
No anonymous persistence.
No profile IDs in rendered HTML or URLs.

---

### Build Result

npm run build: PASS (Cloudflare server build, 5.14s, zero errors).

### service_role Search Result

Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.

### AI Usage Search Result

Get-ChildItem -Path src/pages/fit-finder -Recurse -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder_results|ai_finder_program_matches|ai_usage_logs" → 0 matches.

### Manual Test Checklist

1. npm run build: PASS.
2. service_role grep: 0 matches.
3. AI usage grep: 0 matches.
4. Logged out → anonymous state renders, no profile query.
5. Logged in, no profile → "No saved Fit Finder profile yet." state renders.
6. Logged in, sparse profile → lists specific missing signals.
7. Logged in, full profile → preferences summary shows degree level name, country names, subject names, budget.
8. Fewer than 2 signals → "Adding more preferences" hint shown.
9. Degree match reason includes level name when available.
10. Warning consolidation: single warning for admission/language requirements.
11. No-match: candidate count shown, targeted guidance shown.
12. Score badge label: "preference match" (not "match score").
13. Blue info box visible in ready and no_matches states.
14. index.astro stale text no longer visible.
15. Profile UUID not present in rendered HTML.
16. Scoring unchanged: same programs, same order, same percentages as Phase 20.

---


## Phase 28 — AI Finder Production Hardening

Date: 2026-06-18

### Summary

Hardened AI Finder operational readiness: added a user-facing AI unavailable note,
updated stale privacy copy, documented AI env/secret requirements, and created a
deployment checklist. No new AI surfaces, no chatbot, no migrations, no dependencies.

### UX Hardening

src/pages/fit-finder/result.astro:
  Added let aiUnavailable = false near other AI variables.
  Set aiUnavailable = true inside the pageState === 'ready' && matches.length > 0 block:
    - When callAI returns fallbackUsed=true (rate limit, missing key, provider error)
    - When callAI returns guardrailTripped=true (output safety block)
    - When the outer catch fires (unexpected exception)
  Not set for anonymous, no_profile, sparse_profile, error, or no_matches states.
  Template: renders subtle gray note after AI explanation block:
    "AI summary is unavailable right now. Your rule-based matches are still shown."
  Only shown when !aiExplanation && aiUnavailable. Does not expose rate-limit reason,
  API key state, provider name, model name, daily limit, or error details.

### Privacy Copy Update

src/pages/privacy.astro:
  Changed section heading "AI features (future)" to "AI features".
  Updated body from future tense to present tense.
  Added: AI usage logged server-side (user ID, session type, model, token count).
  Added: Fit Finder match results saved to account for later review.
  Added: Data used for rate limiting, cost management, saved results.
  Added: AI context sent to Google Gemini; data not sold or used for advertising.

### Docs Changes

docs/04-ai-system.md:
  Updated "Server-Only Secret Rules" env vars block:
    - Added SUPABASE_SERVICE_ROLE_KEY as required secret with usage explanation
    - Separated required secrets (wrangler secret) from optional env vars (Pages dashboard)
  Added "AI Production Readiness (Phase 28)" section:
    - Fail-closed behavior table (by missing secret, rate limit, provider error, guardrail)
    - Cloudflare Pages and Workers secret setup commands
    - Production verification steps for ai_usage_logs, ai_finder_results,
      ai_finder_program_matches, owner access, non-owner 404, AI unavailable note
    - Local dev notes (.dev.vars pattern, no PUBLIC_ prefix, no commit)

docs/08-ai-deployment-checklist.md (new):
  13 sections covering: purpose, required secrets, required env vars, Cloudflare setup
  commands (Pages and Workers variants), Supabase prerequisites, build verification,
  security grep checks, post-deploy smoke tests (9 cases), rate-limit test procedure,
  AI usage log verification SQL, saved-result persistence verification SQL, expected
  behavior by failure mode table, rollback notes.

### Files Created

- docs/08-ai-deployment-checklist.md

### Files Modified

- src/pages/fit-finder/result.astro
- src/pages/privacy.astro
- docs/04-ai-system.md
- docs/06-status.md
- docs/07-task-log.md

### Explicit Exclusions

No chatbot. No new AI surfaces or endpoints. No free-form prompt. No migrations.
No new dependencies. No React or client-side JS. No admin UI.
No service-role usage outside approved lib paths. No matching algorithm changes.
No AI prompt changes (finder-summary.ts, chat-answer.ts unchanged).
No rate-limit algorithm changes (limits.ts unchanged).
No persistence strategy changes (persist.ts unchanged).
No changes to gateway.ts, env.ts, gemini.ts, logging.ts, service.ts.
No changes to results/index.astro or results/[id].astro.
No changes to disclaimer.astro or terms.astro.
No migrations.

### Security / Service-Role Boundary

service_role|SERVICE_ROLE|SUPABASE_SERVICE in src/pages,src/components,src/layouts → 0 matches.
createServiceClient in src/pages,src/components,src/layouts → 0 matches.
PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE in src/ → 0 matches.
callAI only in src/pages/fit-finder/result.astro (import + invocation).
"Gemini" in src/pages/privacy.astro is informational copy text only, not a code import.
callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient in
  src/pages/fit-finder/results → 0 matches.

### Build Result

npm run build: PASS (Cloudflare server build, 10.18s, zero errors).

### Manual Smoke-Test Checklist

1. Anonymous user at /fit-finder/result → "Save your Fit Finder preferences" state; no AI note.
2. No saved profile → "No saved Fit Finder profile yet." state; no AI note.
3. Sparse profile → "Add more preferences" state; missing signals listed; no AI note.
4. Valid profile + AI available → rule matches + purple AI summary + green save banner.
5. AI unavailable (rate-limited or key absent) → rule matches + gray note; no AI section.
6. no_matches state → match count shown; "No preference matches found"; no AI note.
7. Page refresh within 60s → same saved result UUID reused; no duplicate row.
8. Saved results list → list, delete, redirect.
9. Saved result detail → stored matches; stored AI summary if present; non-owner 404.

