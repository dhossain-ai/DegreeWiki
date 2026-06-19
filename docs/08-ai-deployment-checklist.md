# DegreeWiki AI Deployment Checklist

Use this checklist before and after deploying any build that includes AI Finder functionality.

---

## 1. Purpose

The AI Finder depends on two server-only secrets and several optional env vars. If either
required secret is absent, all AI calls fail closed — rule-based matches still render, but
the AI summary section is not shown. This checklist confirms the secrets are set, the build
is clean, and AI behavior is working as expected in production.

---

## 2. Required Secrets

These must be set as encrypted Cloudflare secrets, not plain environment variables.
They must never use the `PUBLIC_` prefix. Never commit real values to the repository.

| Secret | Purpose |
|---|---|
| `GEMINI_API_KEY` | Authenticates calls to the Gemini REST API |
| `SUPABASE_SERVICE_ROLE_KEY` | Rate-limit checks, AI usage logging, saved-result persistence |

---

## 3. Required Environment Variables

Set these in the Cloudflare Pages dashboard (or `wrangler.toml`), not as secrets.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PUBLIC_SUPABASE_URL` | Yes | — | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Yes | — | Supabase anon key |
| `PUBLIC_SITE_URL` | No | `https://degreewiki.com` | Canonical site URL |
| `AI_PROVIDER` | No | `gemini` | Active provider name |
| `AI_MODEL` | No | `gemini-2.5-flash` | Model string passed to provider |
| `AI_RATE_LIMIT_USER_DAILY` | No | `20` | Max AI calls per logged-in user per day |
| `AI_RATE_LIMIT_ANON_DAILY` | No | `5` | Reserved; anonymous AI not yet enforced |

---

## 3A. Local Development Notes

- `astro dev`: server-only AI env vars may be placed in `.env.local`; `src/lib/ai/env.ts`
  falls back to server-only `import.meta.env` only when Cloudflare runtime bindings are absent.
- `wrangler pages dev`: use `.dev.vars` for `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- Never use the `PUBLIC_` prefix for Gemini or service-role secrets.
- Never commit `.env.local`, `.dev.vars`, or `.dev.vars.*`.

Example `.dev.vars`:

```bash
GEMINI_API_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
```

---

## 4. Cloudflare Setup Commands

Use the command matching your deployment target. Enter the real value when prompted.
Do not pass values as command-line arguments.

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

To list currently set secrets (values are not shown):
```bash
npx wrangler pages secret list   # Pages
npx wrangler secret list         # Workers
```

---

## 5. Supabase Prerequisites

Confirm these exist before deploying AI features.

- [ ] `ai_usage_logs` table exists; RLS enabled; service role can INSERT
- [ ] `ai_finder_results` table exists; RLS enabled
  - Service role can INSERT and UPDATE
  - Authenticated user SELECT policy: `EXISTS (SELECT 1 FROM student_profiles WHERE student_profiles.id = ai_finder_results.student_profile_id AND student_profiles.user_id = auth.uid())`
  - Authenticated user DELETE policy: same EXISTS check
- [ ] `ai_finder_program_matches` table exists; RLS enabled
  - Service role can INSERT
  - Authenticated user SELECT policy enforced via parent result ownership
  - `ON DELETE CASCADE` from `ai_finder_results.id` configured
- [ ] `student_profiles` RLS: users can SELECT/UPDATE their own rows (`user_id = auth.uid()`)

---

## 6. Build Verification

- [ ] `npm run build` passes with zero errors
- [ ] Output is a Cloudflare server (SSR) build, not static
- [ ] No `PUBLIC_` prefix on `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` anywhere in source

---

## 7. Security Grep Checks

Run these in PowerShell from the project root before deploying. All checks must pass.

```powershell
# Must return 0 matches
Get-ChildItem -Path src/pages,src/components,src/layouts -Recurse -File |
  Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE"

# Must return 0 matches
Get-ChildItem -Path src/pages,src/components,src/layouts -Recurse -File |
  Select-String -Pattern "createServiceClient"

# Must return 0 matches
Get-ChildItem -Path src -Recurse -File |
  Select-String -Pattern "PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE"

# Must return only src/pages/fit-finder/result.astro (callAI); no Gemini/OpenAI in pages/components
Get-ChildItem -Path src/pages,src/components -Recurse -File |
  Select-String -Pattern "callAI|Gemini|OpenAI"

# Must return 0 matches
Get-ChildItem -Path src/pages/fit-finder/results -Recurse -File |
  Select-String -Pattern "callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient"
```

---

## 8. Post-Deploy Smoke Tests

Run these manually after deployment. Requires at least one published program in the database.

**Test 1 — Anonymous user:**
- Visit `/fit-finder/result` without signing in.
- Expected: "Save your Fit Finder preferences" state; sign-in link; no AI call; no error.

**Test 2 — No saved profile:**
- Sign in as a user with no saved Fit Finder profile.
- Visit `/fit-finder/result`.
- Expected: "No saved Fit Finder profile yet." state.

**Test 3 — Sparse profile:**
- Sign in as a user with a profile that has no scoring signals (no degree level, no subjects, no countries, no budget).
- Visit `/fit-finder/result`.
- Expected: "Add more preferences" state with missing signals listed; no AI note.

**Test 4 — Valid profile, AI available:**
- Sign in as a user with a valid profile (at least one scoring signal).
- Visit `/fit-finder/result`.
- Expected: Rule-based matches shown; purple AI summary section visible; green "Your matches have been saved." banner with "View saved result →" link.
- Verify Supabase: new row in `ai_usage_logs` with `session_type = 'finder'`.
- Verify Supabase: new row in `ai_finder_results` with `result_status = 'complete'`.
- Verify Supabase: rows in `ai_finder_program_matches` for that result UUID.

**Test 5 — AI unavailable note:**
- Trigger AI unavailability by temporarily setting `AI_RATE_LIMIT_USER_DAILY=1` and running the Fit Finder twice, or by testing with `GEMINI_API_KEY` absent/invalid.
- Second run or invalid-key run: rule-based matches render normally; gray note visible:
  "AI summary is unavailable right now. Your rule-based matches are still shown."
- No 500 error. No stack trace. No internal details exposed.

**Test 6 — no_matches state:**
- Sign in as a user whose preferences match no published programs.
- Expected: "No preference matches found" state; no AI summary section; no AI unavailable note.

**Test 7 — Page refresh deduplication:**
- Run Fit Finder, note the saved result UUID from the green banner.
- Immediately refresh the page.
- Expected: Same saved result UUID shown (no duplicate row in `ai_finder_results`).

**Test 8 — Saved results list:**
- Visit `/fit-finder/results`.
- Expected: List shows saved results with dates, match counts, "AI summary" chip when applicable.
- Delete a result; confirm it is removed from the list.

**Test 9 — Saved result detail:**
- Click "View saved result" link from a completed result.
- Expected: Program matches shown with stored reasons and warnings; AI explanation rendered if it was saved.
- Non-owner or non-existent UUID: expected 404.

---

## 9. Rate-Limit Test

To verify rate-limit enforcement without waiting for the daily window:

1. Temporarily set `AI_RATE_LIMIT_USER_DAILY=1` in Cloudflare Pages env vars (not a secret).
2. Run the Fit Finder once — AI summary should appear.
3. Run it again — AI summary should be absent; gray unavailable note should appear.
4. Reset `AI_RATE_LIMIT_USER_DAILY` to the desired limit (e.g., `20`).

The daily count resets at UTC midnight. To reset immediately for testing, delete rows
from `ai_usage_logs` for the test user in the Supabase dashboard.

---

## 10. AI Usage Log Verification

After a successful AI summary run, check the Supabase dashboard:

```sql
SELECT user_id, session_type, tokens_used, model_used, created_at
FROM ai_usage_logs
ORDER BY created_at DESC
LIMIT 10;
```

Expected for a successful Fit Finder run:
- `session_type = 'finder'`
- `tokens_used > 0`
- `model_used` matches the configured `AI_MODEL` value
- `cost_estimate_usd = null` (cost map deferred)

If no row appears after a successful AI summary, `SUPABASE_SERVICE_ROLE_KEY` may be
misconfigured — the usage log is written fire-and-forget after a successful AI call.

---

## 11. Saved-Result Persistence Verification

After a Fit Finder run with a valid profile:

```sql
-- Check for the result row
SELECT id, result_status, shortlist_count, ai_explanation IS NOT NULL AS has_ai,
       ai_model_used, created_at
FROM ai_finder_results
ORDER BY created_at DESC
LIMIT 5;

-- Check for match rows for the most recent result
SELECT afpm.rank, afpm.score, p.title
FROM ai_finder_program_matches afpm
JOIN programs p ON p.id = afpm.program_id
WHERE afpm.ai_finder_result_id = '<result_uuid>'
ORDER BY afpm.rank;
```

Expected:
- `result_status = 'complete'`
- `shortlist_count` matches the number of match cards shown on the result page
- Match rows exist, ordered by rank
- If AI was unavailable: `ai_explanation = null`, `ai_model_used = null` — this is correct

If `result_status = 'failed'`, the match insert failed after the result row was created.
Check server logs for `ai_finder_program_matches insert failed`.

---

## 12. Expected Behavior by Failure Mode

| Failure mode | AI summary | Rule-based matches | Persistence | User sees |
|---|---|---|---|---|
| `GEMINI_API_KEY` absent | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| `SUPABASE_SERVICE_ROLE_KEY` absent | Not shown | Renders normally | Not attempted | Gray unavailable note |
| Both secrets absent | Not shown | Renders normally | Not attempted | Gray unavailable note |
| Rate limit exceeded | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| Gemini API error | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| Output guardrail tripped | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| Persistence fails (match insert) | Shown if generated | Renders normally | result_status=failed | Matches shown; no save banner |
| Supabase program query error | N/A | Not rendered | Not attempted | Error state with retry guidance |

---

## 13. Rollback Notes

The AI Finder feature degrades gracefully — removing or invalidating either AI secret
immediately disables AI summaries without breaking rule-based matches or saved-result pages.

To fully disable AI:
- Remove `GEMINI_API_KEY` from Cloudflare secrets. All AI calls will return fallback.
  Rule-based matches, persistence, and saved-result viewing remain fully functional.

To disable both AI and persistence:
- Also remove `SUPABASE_SERVICE_ROLE_KEY`. Rate-limit check fails closed, AI is not called,
  persistence is skipped. The result page still shows rule-based matches normally.

No migrations are required to enable or disable AI. No code changes are needed.
