# DegreeWiki AI Deployment Checklist

Use this checklist before and after deploying any Cloudflare-first production build that includes
AI Finder, Google sign-in, or admin AI/media functionality.

---

## 1. Purpose

DegreeWiki's production launch target is `https://degreewiki.com` on Astro SSR with the
Cloudflare adapter. The launch-critical repo hardening items are:

- Cloudflare must provide a KV binding named `SESSION`
- production env names must match the current runtime
- Supabase Auth and Google OAuth must point at the apex domain
- `www.degreewiki.com` should redirect to `https://degreewiki.com`
- Google-created users must remain non-admin by default

For AI specifically, if the required server-only secrets are absent, all AI calls fail closed.
Rule-based matches still render, but the AI summary section is not shown.

---

## 2. Server-Only Secrets

These must be set as encrypted Cloudflare secrets, not plain environment variables.
They must never use the `PUBLIC_` prefix. Never commit real values to the repository.

| Secret | Required | Purpose |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for AI persistence/quota | Rate-limit checks, AI usage logging, saved-result persistence |
| `GEMINI_API_KEY` | Yes when `AI_PROVIDER=gemini` | Authenticates calls to the Gemini REST API |
| `OPENROUTER_API_KEY` | Yes when `AI_PROVIDER=openrouter` | Authenticates calls to OpenRouter |
| `AI_GATEWAY_MASTER_KEY` | Required only for DB-managed AI Gateway provider accounts | Base64-encoded 32-byte AES key used to decrypt DB-stored provider API keys |
| `AI_GATEWAY_ACTIVE_KEY_VERSION` | Required only for DB-managed AI Gateway provider accounts | Active encryption key version label used for DB-stored provider credentials |
| `CLOUDINARY_API_KEY` | Required only if admin media upload/import is enabled | Cloudinary server-side signing/auth |
| `CLOUDINARY_API_SECRET` | Required only if admin media upload/import is enabled | Cloudinary server-side signing secret |

Google OAuth client credentials belong in the Supabase Auth Google provider configuration, not in
the app runtime env examples.

---

## 3. Runtime Environment Variables

Set public/runtime vars in the Cloudflare Pages dashboard. Keep secrets in Cloudflare secrets.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PUBLIC_SUPABASE_URL` | Yes | — | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Yes | — | Supabase anon key |
| `PUBLIC_SITE_URL` | Yes for production | `https://degreewiki.com` | Canonical site URL. Production should use the apex domain. |
| `PUBLIC_CLOUDINARY_CLOUD_NAME` | Optional / conditional | — | Needed only when Cloudinary-backed media flows are enabled |
| `AI_PROVIDER` | No | `gemini` | Active provider name: `gemini` or `openrouter` |
| `AI_MODEL` | No | `gemini-2.5-flash` | Model string passed to provider |
| `AI_GATEWAY_ENV_FALLBACK_ENABLED` | No | `false` | Enables env-based provider fallback when DB routing fails |
| `AI_RATE_LIMIT_USER_DAILY` | No | `20` | Legacy combined daily fallback for logged-in successful AI calls when no matching DB policy exists |
| `AI_RATE_LIMIT_ANON_DAILY` | No | `5` | Legacy combined daily fallback for future anonymous provider-backed AI when no matching DB policy exists |
| `CLOUDINARY_UPLOAD_FOLDER` | Optional / conditional | `degreewiki` | Root upload folder for Cloudinary admin flows |
| `CLOUDINARY_SIGNATURE_ALGORITHM` | Optional / conditional | `sha256` | Use `sha1` only if the Cloudinary account still requires it |

---

## 3A. Local Development Notes

### How env vars reach server code in local dev

`src/lib/ai/env.ts` reads env vars from three sources in priority order:

1. **`locals.runtime.env`** — populated by `getPlatformProxy` (wrangler) from `.dev.vars`
   and `wrangler.toml [vars]`. This is the most reliable path.
2. **`import.meta.env`** — injected by Astro's Vite SSR transform from `.env.local`.
   Works when running `astro dev`; may not apply in all Cloudflare adapter configurations.
3. **`process.env`** — Node.js process environment. Last-resort fallback for `astro dev`;
   Vite does not populate this from `.env.local`, so it only helps if a key is set
   in the system environment before Astro starts.

### Recommended setup for `npm run dev`

Use **both** `.env.local` and `.dev.vars` so all three sources are covered:

- `.env.local` — public/runtime values such as `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
  `PUBLIC_SITE_URL`, and optional public Cloudinary name
- `.dev.vars` — server-only keys only, with no `PUBLIC_*` entries

See `.dev.vars.example` for the full list of required keys.

```bash
# .env.local
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
PUBLIC_SITE_URL=http://localhost:4321

# .dev.vars
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
AI_RATE_LIMIT_ANON_DAILY=5
AI_RATE_LIMIT_USER_DAILY=20
```

### Local AI testing with OpenRouter

When Gemini is rate-limited (HTTP 429) or unavailable, you can route AI calls through
OpenRouter for local development/testing without changing any Fit Finder, AI Advisor, or
matching logic. The same safety prompts, static routing, rate limits, and guardrails apply.

```bash
# .dev.vars (or .env.local) — local OpenRouter testing
AI_PROVIDER=openrouter
AI_MODEL=openrouter/free
OPENROUTER_API_KEY=your_openrouter_key_here
```

- `OPENROUTER_API_KEY` is server-only — never use the `PUBLIC_` prefix.
- The OpenRouter provider calls OpenRouter's OpenAI-compatible chat-completions endpoint
  server-side only. The API key, prompt body, and full response body are never logged.
- Set `AI_MODEL` to any valid OpenRouter model id. Free OpenRouter models have **strict
  rate limits** and are intended for development/testing, **not production reliability**.
- If OpenRouter quota fails (429), the UI shows the same safe fallback note as Gemini, and
  in DEV the result page surfaces a safe `provider`/`category` diagnostic (no secrets, no
  prompt or response text).
- To switch back to Gemini, set `AI_PROVIDER=gemini` and `AI_MODEL=gemini-2.5-flash`.

A minimal `wrangler.toml` must exist in the project root (already tracked in git) so
`getPlatformProxy` can locate `.dev.vars`.

- Never use the `PUBLIC_` prefix for Gemini or service-role secrets.
- Never commit `.env.local`, `.dev.vars`, or `.dev.vars.*`.
- After creating or modifying `.env.local` or `.dev.vars`, restart the dev server.

### DEV diagnostic log

In `astro dev`, each request to `/fit-finder/result` logs a presence check for all AI
env keys to the server console. Keys show `true` (set) or `false` (missing) per source.
No values are printed. Use this to confirm which source is providing each key.

### Important — Saved-result and chat persistence in local dev

`SUPABASE_SERVICE_ROLE_KEY` is required for Fit Finder result persistence
(`persistFinderResult`) and AI chat message persistence (`persistChatTurn`).
If it is absent, both functions return silently without inserting rows. Rule-based
matches and the AI summary will still render correctly, but no `ai_finder_results`
row will be created and `/fit-finder/results` will appear empty.

---

## 4. Cloudflare Runtime Setup

DegreeWiki is Cloudflare-first for launch. Keep the Cloudflare adapter and server output.

### 4A. Required `SESSION` KV binding

Astro's Cloudflare adapter enables sessions and expects a KV binding named `SESSION`.
The build can succeed without it, but production must provide a real KV namespace binding with
that exact variable name.

Cloudflare Pages dashboard steps:

1. In Cloudflare, go to Workers & Pages.
2. Open the DegreeWiki Pages project.
3. Go to Settings > Bindings.
4. Add a KV namespace binding.
5. Set Variable name to `SESSION`.
6. Select the real KV namespace to use for Astro sessions.
7. Save the binding and redeploy the project.

Wrangler/CLI-assisted namespace creation:

```bash
npx wrangler kv namespace create SESSION
npx wrangler kv namespace create SESSION --preview
```

Those commands create real namespaces and return real IDs. Do not commit those IDs to git until
you intentionally decide to manage Cloudflare bindings in `wrangler.toml`.

### 4B. Secrets and vars

Use the command matching your deployment target. Enter the real value when prompted. Do not pass
secret values as command-line arguments.

**Cloudflare Pages:**
```bash
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler pages secret put GEMINI_API_KEY
npx wrangler pages secret put OPENROUTER_API_KEY
npx wrangler pages secret put AI_GATEWAY_MASTER_KEY
npx wrangler pages secret put AI_GATEWAY_ACTIVE_KEY_VERSION
npx wrangler pages secret put CLOUDINARY_API_KEY
npx wrangler pages secret put CLOUDINARY_API_SECRET
```

List configured secret names only:
```bash
npx wrangler pages secret list
```

Set public/runtime vars in the Cloudflare Pages dashboard for the production environment:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_SITE_URL`
- `PUBLIC_CLOUDINARY_CLOUD_NAME`
- `AI_PROVIDER`
- `AI_MODEL`
- `AI_RATE_LIMIT_USER_DAILY`
- `AI_RATE_LIMIT_ANON_DAILY`
- `AI_GATEWAY_ENV_FALLBACK_ENABLED`
- `CLOUDINARY_UPLOAD_FOLDER`
- `CLOUDINARY_SIGNATURE_ALGORITHM`

## 5. Auth and Domain Setup

Production auth host policy for first launch:

- canonical site URL: `https://degreewiki.com`
- `https://www.degreewiki.com` should redirect to `https://degreewiki.com`
- do not introduce `auth.degreewiki.com` for first launch
- keep localhost auth working for development

Supabase Auth settings:

- Site URL: `https://degreewiki.com`
- Redirect URLs:
  - `http://localhost:4321/**`
  - `https://degreewiki.com/**`

Only add `https://www.degreewiki.com/**` if you intentionally decide to serve auth from `www`
instead of redirecting it to the apex domain.

Because login/signup build the callback URL from the current request host, every hostname that
serves `/login`, `/signup`, or `/auth/callback` must also be allowlisted in Supabase Redirect URLs.

## 6. Google OAuth Production Checklist

Google remains configured through Supabase Auth, not the app runtime env.

- Authorized JavaScript origins:
  - `http://localhost:4321`
  - `https://degreewiki.com`
- Authorized redirect URI:
  - `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
- Rotate the Google OAuth client secret before production launch if an older secret was exposed in
  a screenshot or other non-secret-safe context.

Launch policy note:

- Google-created users must remain non-admin by default.
- The app audit found no app-side admin grant path.
- Non-admin default is acceptable for launch.
- If future features require explicit role membership instead of non-admin default behavior, add a
  follow-up task for explicit `student` role assignment on signup.

---

## 7. Supabase Prerequisites

Confirm these exist before deploying AI features.

- [ ] `ai_provider_accounts` table exists; RLS enabled; no public access
- [ ] `ai_models` table exists; RLS enabled; no public access
- [ ] `ai_routing_policies` table exists; RLS enabled; no public access
- [ ] `ai_provider_health` table exists; RLS enabled; no public access
- [ ] `ai_gateway_call_logs` table exists; RLS enabled
  - Readable only by `view_ai_logs`, `manage_ai_settings`, or `super_admin`
  - No authenticated browser INSERT/UPDATE/DELETE policies
- [ ] `ai_usage_limit_policies` table exists; RLS enabled
  - Readable and mutable only by `manage_ai_settings` or `super_admin`
  - Table may start empty intentionally; this keeps env fallback active until admins add rows
- [ ] `ai_usage_logs` table exists; RLS enabled; service role can INSERT
  - Additive columns exist: `use_case`, `audience_tier`, `anonymous_session_id`
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

## 8. Build Verification

- [ ] `npm run build` passes with zero errors
- [ ] Output is a Cloudflare server (SSR) build, not static
- [ ] Cloudflare production has a KV binding named `SESSION`
- [ ] No `PUBLIC_` prefix on `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` anywhere in source

---

## 9. Security Grep Checks

Run these in PowerShell from the project root before deploying. All checks must pass.

```powershell
# Browser-facing files should return 0 matches
Get-ChildItem -Path src/pages,src/components,src/layouts -Recurse -File |
  Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE"

# Must return 0 matches
Get-ChildItem -Path src/pages,src/components,src/layouts -Recurse -File |
  Select-String -Pattern "createServiceClient"

# Must return 0 matches
Get-ChildItem -Path src -Recurse -File |
  Select-String -Pattern "PUBLIC_SUPABASE_SERVICE|PUBLIC_.*SERVICE"

# Must return only the AI API routes (callAI): src/pages/api/ai/chat.ts and
# src/pages/api/ai/finder-summary.ts. No Gemini/OpenAI in pages/components, and
# (since Phase 54A) no callAI in any .astro page — the finder summary is async.
Get-ChildItem -Path src/pages,src/components -Recurse -File |
  Select-String -Pattern "callAI|Gemini|OpenAI"

# Must return 0 matches
Get-ChildItem -Path src/pages/fit-finder/results -Recurse -File |
  Select-String -Pattern "callAI|getAIEnv|SUPABASE_SERVICE_ROLE_KEY|createServiceClient"
```

---

## 10. Post-Deploy Smoke Tests

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

**Test 4 — Valid profile, AI available (async summary, Phase 54A):**
- Sign in as a user with a valid profile (at least one scoring signal).
- Visit `/fit-finder/result`.
- Expected: Rule-based matches shown immediately; green "Your matches have been
  saved." banner; purple AI summary card initially shows "Preparing your
  personalized explanation…", then updates in place (no full page reload) once
  `POST /api/ai/finder-summary` returns. The summary is plain text — no Markdown
  tables, `<br>`, `**` markers, or HTML.
- Verify Supabase: new row in `ai_finder_results` with `result_status = 'complete'`
  (created with `ai_explanation = null`, then updated with the summary).
- Verify Supabase: rows in `ai_finder_program_matches` for that result UUID.
- Verify Supabase: `ai_usage_logs` row with `session_type = 'finder'` written by
  the summary endpoint when the provider was actually called.

**Test 4b — Cached summary on refresh (no repeat provider call):**
- After Test 4, refresh `/fit-finder/result` within 60s (same result reused).
- Expected: the cached `ai_explanation` renders immediately server-side; the
  client does not call the provider (any `/api/ai/finder-summary` call returns
  `cached: true` without a provider request).
- Open `/fit-finder/results/[id]` for that result: stored summary renders; the
  summary provider is never called from this page.

**Test 5 — AI unavailable (async, no retry loop):**
- Trigger AI unavailability via `AI_RATE_LIMIT_USER_DAILY=1` then a second run, or
  with `GEMINI_API_KEY`/`OPENROUTER_API_KEY` absent/invalid.
- Expected: rule-based matches render normally; the AI card replaces the
  placeholder with: "AI summary is unavailable right now. Your rule-based matches
  are still shown." `/api/ai/finder-summary` returns 503 `ai_unavailable`.
- The result row is NOT marked `failed`. The client fetches once — no retry loop.
- No 500 error, no stack trace, no internal details or secrets exposed.

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

## 11. Rate-Limit Test

To verify the legacy env fallback without waiting for the daily window:

1. Make sure no matching DB usage-limit policy exists for the test route.
2. Temporarily set `AI_RATE_LIMIT_USER_DAILY=1` in Cloudflare Pages env vars (not a secret).
3. Run the Fit Finder once — AI summary should appear.
4. Run it again — AI summary should be absent; gray unavailable note should appear.
5. Reset `AI_RATE_LIMIT_USER_DAILY` to the desired limit (e.g., `20`).

The daily count resets at UTC midnight. To reset immediately for testing, delete rows
from `ai_usage_logs` for the test user in the Supabase dashboard.

To verify a DB-backed policy:

1. Create a row in `/admin/ai-gateway?tab=limits`, for example
   `chat_answer + authenticated_free + daily = 1`.
2. Make one successful provider-backed call on that surface.
3. Repeat the same provider-backed call.
4. Expected: the second call is blocked even if the env fallback is higher.
5. Disable or delete the policy row to return that combination to legacy env fallback behavior.

---

## 12. AI Usage Log Verification

After a successful AI summary run, check the Supabase dashboard:

```sql
SELECT user_id, anonymous_session_id, session_type, use_case, audience_tier,
       tokens_used, model_used, created_at
FROM ai_usage_logs
ORDER BY created_at DESC
LIMIT 10;
```

Expected for a successful Fit Finder run:
- `session_type = 'finder'`
- `use_case = 'fit_finder_summary'`
- `audience_tier = 'authenticated_free'` for the normal signed-in product flow
- `tokens_used > 0`
- `model_used` matches the configured `AI_MODEL` value
- `cost_estimate_usd = null` (cost map deferred)

If no row appears after a successful AI summary, `SUPABASE_SERVICE_ROLE_KEY` may be
misconfigured — the usage log is written fire-and-forget after a successful AI call.

Static/preset note:
- Hardcoded site-chat responses and reviewed preset `ai_static_answers` responses do not create
  quota rows because they do not call providers.

## 12A. Gateway Call Log Verification

After a successful routed AI call, verify `ai_gateway_call_logs` contains an attempt row for:

- `use_case = 'fit_finder_summary'` for Fit Finder summaries
- `use_case = 'chat_answer'` for saved-result chat LLM turns
- `use_case = 'admin_article_draft'` for admin article drafting and SEO suggestions

Expected:
- `status = 'success'` or `env_fallback_success`
- no prompt or response body stored
- provider/model metadata present when a DB provider candidate was used
- `was_fallback = true` only when a later candidate or env fallback was used

---

## 12B. Admin AI Gateway Setup Checklist

Use `/admin/ai-gateway` for routine AI Gateway configuration after deployment.

- [ ] Admin user has `manage_ai_settings`
- [ ] Provider account created with `adapter_type = openai_compatible`
- [ ] API key saved successfully and only masked metadata is visible in the UI
- [ ] Model row created and linked to the intended provider account
- [ ] Routing policy row created for the intended use case and priority
- [ ] Limits tab loads at `/admin/ai-gateway?tab=limits`
- [ ] Suggested starter rows are visible in the Limits tab but are not auto-seeded
- [ ] Creating a usage-limit policy row succeeds with no raw DB error exposure
- [ ] Disabling a usage-limit policy row returns that tuple to legacy env fallback behavior
- [ ] If using the article assistant, an active `admin_article_draft` routing policy exists
- [ ] Health table loads and reset action clears failures/error/cooldown without wiping timestamps
- [ ] Preset admin test succeeds or returns a safe coarse failure without exposing secrets

Current support note:
- DB-managed provider accounts support `openai_compatible` only
- Gemini/OpenRouter remain env-fallback only in this phase

Admin test safety note:
- Admin tests are preset-only
- No real student data is used
- Admin tests do not poison production provider health/cooldown
- Admin tests do not consume AI usage quota

Article assistant note:
- `/api/admin/articles/ai-assist` stays admin-only
- If no active `admin_article_draft` route exists, the editor should show a safe setup message
- AI suggestions are review-only and are not persisted until the admin uses the normal article save flow

---

## 13. Saved-Result Persistence Verification

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

## 14. Expected Behavior by Failure Mode

| Failure mode | AI summary | Rule-based matches | Persistence | User sees |
|---|---|---|---|---|
| DB routing has no active candidate, env fallback enabled | Not shown if env fallback also fails | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| DB provider decrypt/master-key failure, env fallback enabled | Depends on env fallback | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| `GEMINI_API_KEY` absent | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| `SUPABASE_SERVICE_ROLE_KEY` absent | Not shown | Renders normally | Not attempted | Gray unavailable note |
| Both secrets absent | Not shown | Renders normally | Not attempted | Gray unavailable note |
| Rate limit exceeded | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| Gemini API error | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| OpenRouter API error / quota (429) | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note (DEV: safe provider/category diagnostic) |
| Unknown `AI_PROVIDER` | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note (DEV: warns supported providers) |
| Output guardrail tripped | Not shown | Renders normally | Attempted (ai_explanation=null) | Gray unavailable note |
| Persistence fails (match insert) | Shown if generated | Renders normally | result_status=failed | Matches shown; no save banner |
| Supabase program query error | N/A | Not rendered | Not attempted | Error state with retry guidance |

---

## 15. Rollback Notes

The AI Finder feature degrades gracefully — removing or invalidating either AI secret
immediately disables AI summaries without breaking rule-based matches or saved-result pages.

To fully disable AI:
- Remove `GEMINI_API_KEY` from Cloudflare secrets. All AI calls will return fallback.
  Rule-based matches, persistence, and saved-result viewing remain fully functional.

To disable both AI and persistence:
- Also remove `SUPABASE_SERVICE_ROLE_KEY`. Rate-limit check fails closed, AI is not called,
  persistence is skipped. The result page still shows rule-based matches normally.

No migrations are required to enable or disable AI. No code changes are needed.

---

## 16. Phase 69D Public Chatbot Verification

- [ ] Public chatbot launcher appears on `/`, `/programs*`, `/universities*`,
      `/scholarships*`, and `/guides*`
- [ ] Launcher does not appear on `/admin*`, `/login`, `/signup`, `/fit-finder*`,
      `/privacy`, `/terms`, or `/disclaimer`
- [ ] Opening the widget does not require an AI call on page load
- [ ] Anonymous greeting/help/program/scholarship/guide/login questions return static responses only
- [ ] Anonymous free-form questions return a static sign-in / Fit Finder prompt only
- [ ] Logged-in in-scope questions route through `use_case = 'chat_answer'`
- [ ] Logged-in rate-limit exhaustion returns a safe fallback with no raw provider error
- [ ] Logged-in clear chat removes only the global site-chat conversation
- [ ] Saved-result chat on `/fit-finder/results/[id]` still behaves as before
- [ ] Global site chat does not attach the latest Finder result, matched programs, RAG, or internet content

### 14A. Site Chat Persistence Check

After a logged-in site chat turn, verify:

- `ai_conversations.session_type = 'chat'`
- `ai_conversations.ai_finder_result_id IS NULL`
- `ai_messages` rows exist for the returned conversation
- `ai_usage_logs` gains a `session_type = 'chat'` row only for AI-backed logged-in turns

Static anonymous turns should not create chat rows or usage-log rows.

### 14B. Preset Knowledge Base Verification

- [ ] `ai_static_answers` table exists with RLS enabled
- [ ] Anonymous and authenticated published-row reads work
- [ ] Draft and archived rows are not returned to anonymous/public site-chat lookup
- [ ] `/admin/ai-knowledge` loads for a user with `manage_ai_settings`
- [ ] A published preset answer is returned before anonymous fallback or logged-in AI
- [ ] Imported JSON rows always land as `draft`
- [ ] Preset answers render as plain text only with no Markdown or HTML rendering
