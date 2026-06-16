# DegreeWiki Current Status

Last updated: 2026-06-17

## Current Phase

Phase 21 — TBD.

Phase 20 — Rule-Based Program Matching Engine — complete.

## Last Completed Work

Phase 20 — Rule-Based Program Matching Engine (complete):

- Replaced the /fit-finder/result placeholder with a deterministic server-rendered
  program matching page.
- The page now uses the logged-in user's latest saved non-anonymous student profile,
  loads owned subject and country preferences through existing RLS, queries a capped
  set of published programs, scores them in Astro server code, and renders ranked
  possible matches.

Route enhanced:
  /fit-finder/result — noindex SSR page showing possible program matches for
  logged-in users with usable saved preferences.

Files modified:
  src/pages/fit-finder/result.astro
  docs/06-status.md
  docs/07-task-log.md

Access behavior:
  Anonymous users see sign-in/save guidance with links to /login?redirect=/fit-finder
  and /fit-finder. No profile query is made for anonymous users.
  Logged-in users without a saved profile see "No saved Fit Finder profile yet."
  Logged-in users with sparse profiles are prompted to add degree, subject, country,
  or budget preferences.
  Logged-in users with usable profiles see transient ranked results.

Candidate query strategy:
  Uses the existing Supabase SSR client and supabase.auth.getUser().
  Loads only the latest own student_profiles row where user_id = auth.uid()
  through the authenticated session and is_anonymous=false.
  Queries only programs where content_status='published', limited to 200 rows,
  with display joins for universities, countries, cities, degree_levels, and subjects.
  Fetches program_subjects for the candidate program IDs in one batch. If that query
  fails, scoring continues with primary_subject_id only and shows a page-level note.

Scoring signals:
  target_degree_level_id match — 35 points.
  preferred subject match — 30 points for primary_subject_id, 24 points through
  program_subjects.
  preferred country match — 25 points.
  budget fit — 10 points when max tuition is within saved budget and currency matches;
  5 points when tuition may partially fit.
  Active possible points include only signals the user saved. Profiles with zero
  possible points show a refine-profile state instead of arbitrary matches.

Result display:
  Shows match score percentage, program link, university link when available,
  country/city, degree level, subject, tuition range, deterministic match reasons,
  conservative warnings, official-source reminder, and official_url link when available.
  Wording avoids guaranteed admission, eligibility, scholarship, or visa claims.

Explicit exclusions:
  Transient SSR only.
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
  No React or client-side JS.
  No admin changes.
  No anonymous persistence.
  No profile IDs in URLs or rendered output.

Validation results:
  npm run build: PASS (Cloudflare server build, 1.54s, zero errors).
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.
  Get-ChildItem -Path src/pages/fit-finder -Recurse -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder_results|ai_finder_program_matches|ai_usage_logs" → 0 matches.

Phase 19 — Fit Finder / Student Profile Input Foundation (complete):

- Added a public server-rendered Fit Finder input foundation.
  The route collects schema-backed student profile preferences for future matching,
  but does not run AI, does not run program matching, does not create chatbot UI,
  and does not write AI Finder result rows.

Routes added:
  /fit-finder — public SSR form for student profile preferences.
  /fit-finder/result — noindex placeholder confirmation page.

Files created:
  src/pages/fit-finder/index.astro
  src/pages/fit-finder/result.astro

Files modified:
  src/components/public/PublicNav.astro — added Fit Finder link.
  docs/06-status.md
  docs/07-task-log.md

Schema/RLS findings used:
  student_profiles supports logged-in rows with user_id set, is_anonymous=false,
  and session_token=NULL.
  student_profile_subjects and student_profile_countries are writable for logged-in
  users only when the parent profile belongs to auth.uid().
  Anonymous profile rows are supported by schema, but direct anonymous browser RLS
  is intentionally omitted. Anonymous persistence is deferred because it requires
  a security-reviewed privileged server endpoint.

Form fields implemented:
  current_country_id, target_degree_level_id, budget_min, budget_max,
  budget_currency, gpa, english_score_type, english_score,
  work_experience_years, study_start_preference, additional_notes.
  Junction inputs: student_profile_subjects[] and student_profile_countries[].

Lookup data:
  countries: id, name.
  degree_levels: id, name, display_order.
  subjects: id, name.
  Lookup query failures log server-side and default to [] so the page remains functional.

Validation:
  Server-side only. UUID values must match UUID shape and exist in loaded lookup data.
  Numeric fields must be non-negative. work_experience_years must be a non-negative
  integer. budget_max must be greater than or equal to budget_min when both are set.
  Short text fields are trimmed/capped; budget_currency is normalized uppercase.
  Invalid submissions re-render the form with entered values preserved.

Logged-in persistence:
  Uses the existing Supabase SSR client and supabase.auth.getUser().
  POST creates or updates exactly one non-anonymous profile selected by user_id and
  is_anonymous=false. The profile UUID is never accepted from the form, rendered to
  the page, placed in hidden inputs, or included in the result URL.
  Subject and country junction rows are replaced after the profile save using the
  RLS-protected parent profile id.

Anonymous behavior:
  GET /fit-finder renders for everyone.
  POST /fit-finder while logged out does not save anything, does not create cookies,
  and does not create anonymous student_profiles rows. The form re-renders with a
  sign-in required message linking to /login?redirect=/fit-finder.

Result placeholder:
  /fit-finder/result uses PublicLayout, noindex=true, and shows:
  "Your preferences have been saved. Program matching will be added in the next phase."
  Links point to /programs and /fit-finder.

Exclusions:
  No AI calls.
  No matching engine.
  No chatbot.
  No ai_finder_results writes.
  No ai_finder_program_matches writes.
  No anonymous session_token cookies.
  No service_role usage.
  No migrations.
  No new dependencies.
  No React or client-side JS.
  No admin changes.
  No src/lib/ai changes.

Validation results:
  npm run build: PASS (Cloudflare server build, 1.48s, zero errors).
  Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role|SERVICE_ROLE|SUPABASE_SERVICE" → 0 matches.
  Get-ChildItem -Path src/pages/fit-finder -Recurse -File | Select-String -Pattern "callAI|Gemini|OpenAI|ai_finder_results|ai_finder_program_matches" → 0 matches.

Phase 18 — AI Gateway + AI Safety Architecture (implementation complete):

- Created server-only AI foundation in src/lib/ai/.
  No public chatbot UI, no Fit Finder UI, no live LLM calls, no external API calls,
  no public AI endpoint, no migrations, no new dependencies, no service_role, no React,
  no client-side JS, no admin changes.

src/lib/ai/ structure:
  types.ts — all shared types: AIRequest, AIResponse, AIContext, AIPrompt,
    AIProviderConfig, AIProviderResponse, AIUsageEntry, AIGuardrailResult,
    AIRuntimeEnv, StudentProfileSummary, AISessionType, AIRole.
  gateway.ts — callAI() entry point: runs input guardrails, rate limit check,
    then returns controlled fallback (no live provider in Phase 18).
    TODO Phase 19 block marks provider resolution, prompt build, output
    guardrails, and usage logging steps.
  providers/interface.ts — AIProvider interface: complete(prompt, config).
    All implementations must use fetch() only (Cloudflare Workers compatible).
  providers/gemini.ts — GeminiProvider stub. Throws "Gemini provider is not
    enabled in Phase 18." No fetch calls.
  prompts/finder-summary.ts — buildFinderPrompt(context): builds system +
    user prompt for AI Finder explanation. System prompt enforces database-first
    rule, no invented facts, no guarantees, verify-official-sources disclaimer.
  prompts/chat-answer.ts — buildChatPrompt(userMessage, context): builds
    system + user prompt for chatbot. Same safety boundaries.
  safety/guardrails.ts — checkInput() and checkOutput(): deterministic
    first-pass regex guardrails. Blocks fake documents, essay ghostwriting,
    immigration fraud, visa fraud (input). Blocks guaranteed admission/
    scholarship/visa claims (output). Conservative exact-phrase matching.
  usage/logging.ts — writeUsageLog() placeholder. No database writes in
    Phase 18. TODO Phase 19 marker for service role wiring.
  usage/limits.ts — checkRateLimit() placeholder. Always returns allowed.
    TODO Phase 19 marker for ai_usage_logs query enforcement.

Files created (9):
  src/lib/ai/types.ts
  src/lib/ai/gateway.ts
  src/lib/ai/providers/interface.ts
  src/lib/ai/providers/gemini.ts
  src/lib/ai/prompts/finder-summary.ts
  src/lib/ai/prompts/chat-answer.ts
  src/lib/ai/safety/guardrails.ts
  src/lib/ai/usage/logging.ts
  src/lib/ai/usage/limits.ts

Files modified (3):
  .env.example (added GEMINI_API_KEY, AI_PROVIDER, AI_MODEL, rate limit vars
    with server-only annotations)
  docs/04-ai-system.md (replaced structural sketch with finalized Phase 18
    architecture: gateway, provider abstraction, safety rules, prompt boundaries,
    env strategy, rate-limit/logging future plans, Cloudflare compatibility)
  docs/06-status.md (this file)

src/env.d.ts: does not exist in this project — not created or modified.
  AI env vars typed via AIRuntimeEnv interface in src/lib/ai/types.ts instead.

npm run build: PASS (Cloudflare server build, 1.75s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.
Get-ChildItem -Path src/lib/ai -Recurse -File | Select-String -Pattern "PUBLIC_" → 2 matches,
  both are comments warning against PUBLIC_ usage, not actual misuse.

Exclusions (deferred to Phase 19+):
  No public chatbot UI.
  No Fit Finder UI.
  No live LLM calls.
  No external AI API calls.
  No public AI endpoint.
  No migrations.
  No new npm dependencies.
  No service_role.
  No React or client-side JS.
  No admin changes.
  No src/pages/api/ai/health.ts (removed from scope).
  No providers/openrouter.ts (removed from scope).
  No src/env.d.ts (does not exist; AIRuntimeEnv in types.ts covers AI vars).
  No wrangler.toml changes.

Phase 17 — Source / Verification Display Foundation (implementation complete):

- Added a lightweight Source & Verification box to all four public detail pages.
  No admin changes, no migrations, no new dependencies, no React, no client-side JS,
  no AI, no service_role, no set:html, no schema.org structured data.
  Internal source/data-quality tables (data_sources, source_snapshots, verification_events,
  data_quality_checks) intentionally not queried — all are admin-only per RLS.

Files created (1):
  src/components/public/SourceBox.astro

Files modified (4):
  src/pages/programs/[slug].astro
  src/pages/scholarships/[slug].astro
  src/pages/universities/[slug].astro
  src/pages/guides/[slug].astro

SourceBox component:
  Shared Astro component with props: verificationStatus, lastVerifiedAt, officialUrl,
  sourceConfidenceScore. Renders a small bordered gray box (border-gray-200, bg-gray-50).
  Status line: verified → "Verified by DegreeWiki", partially_verified → "Partially verified",
  source_conflict → "Source conflict under review", outdated → "May need updating",
  needs_review → "Needs review", unverified → "Not yet verified", null/unknown → omitted.
  Last verified line: shown only when lastVerifiedAt is non-null.
  Source confidence: shown only when sourceConfidenceScore > 0.
    ≥75 → High, ≥40 → Medium, 1–39 → Low.
  Official source link: shown only when officialUrl is non-null; opens in _blank.
  Disclaimer: always shown — "Always confirm important details — including deadlines, fees,
    and eligibility requirements — directly with the official university, scholarship provider,
    or government/source website before applying."
  Placement: after main content/CTA sections, before existing "Last updated" line and back link.
  Existing near-title verification badge unchanged.

Entity-level fields used per entity:
  programs:      verification_status (existing), last_verified_at (added), source_confidence_score (added)
                 official_url (existing, passed as officialUrl)
  scholarships:  verification_status (existing), last_verified_at (added), source_confidence_score (added)
                 official_url ?? provider_url (existing, passed as officialUrl)
  universities:  verification_status (existing), last_verified_at (added), source_confidence_score (added)
                 official_url (existing, passed as officialUrl)
  articles:      verification_status (existing), source_confidence_score (added)
                 lastVerifiedAt=null (articles table has no last_verified_at column)
                 officialUrl=null (articles have no official URL field)

Source table decision:
  data_sources, source_snapshots, verification_events, data_quality_checks —
  intentionally NOT queried in public pages. All four tables have RLS policies that
  block anonymous and regular authenticated user access. These are internal admin-only
  data-quality tables. Only entity row fields are used.

npm run build: PASS (Cloudflare server build, 1.55s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No list/search page changes.
  No admin CRUD changes.
  No migrations.
  No new npm dependencies.
  No React or client-side JS.
  No data_sources/verification_events/data_quality_checks queries in public pages.
  No data_completeness_score display (internal metric, not shown publicly).
  No schema.org structured data.
  No report form, saved items, or user dashboard.

Phase 16 — Public Detail Page Polish (implementation complete):

- Polished all four public detail pages (programs, scholarships, universities, guides).
  No admin changes, no migrations, no new dependencies, no React, no client-side JS,
  no AI, no service_role, no set:html, no markdown renderer.

Files changed (4 source files):
  src/pages/programs/[slug].astro
  src/pages/scholarships/[slug].astro
  src/pages/universities/[slug].astro
  src/pages/guides/[slug].astro

Route improvements:

  programs/[slug]:
    - Added verification_status and updated_at to Supabase select.
    - Added secondary program_intakes query (runs after 404 check; defaults to [] on error).
    - Renders "Intakes & Deadlines" section when program_intakes rows exist; omitted when empty.
    - Intake rows show intake_name, open date, deadline date, deadline_text, deadline_status badge
      (open/closing_soon/closed/rolling), is_rolling flag, and notes.
    - Replaced JSON.stringify/pre block for english_requirements with a readable <ul> list:
      Object.entries() over the JSONB — test name uppercased, nested properties joined as
      "key: value · key: value". Falls back to plain text notice if shape is unexpected.
    - Removed official_url and application_url from key facts <dl>; moved to CTA block.
    - CTA block: "Apply Now ↗" (application_url, blue filled) + "Official Program Page ↗"
      (official_url, border ghost). Shown only when at least one URL exists.
    - Section order: Key Facts → Admission Requirements → English Requirements →
      Tuition Notes → Application Fee → Intakes & Deadlines → Curriculum → Career Outcomes
      → CTA block → Last updated → Back link.
    - Added bottom back link (second ← All Programs above the footer area).

  scholarships/[slug]:
    - Added verification_status and updated_at to Supabase select.
    - Fixed deadline_text condition: now renders whenever s.deadline_text exists,
      even when s.deadline (structured date) is null. Previously only rendered when both were set.
    - Removed official_url, application_url, provider_url from key facts <dl>; moved to CTA block.
    - CTA block: "Apply Now ↗" (application_url, blue filled), "Official Scholarship Page ↗"
      (official_url, border ghost), "Provider Website ↗" (provider_url, border ghost).
      Shown only when at least one URL exists.
    - Added bottom back link.

  universities/[slug]:
    - Added verification_status and updated_at to Supabase select.
    - Removed official_url from key facts <dl>; moved to CTA block.
    - CTA block: "Visit Official Website ↗" (official_url, border ghost).
    - Added "Browse Programs at [name] →" text link → /programs?university={u.id}.
    - Added bottom back link.

  guides/[slug]:
    - Added verification_status and updated_at to Supabase select.
    - Changed article_categories(name, slug) to article_categories(id, name, slug).
    - Category badge is now a clickable link → /guides?category={id} when category id exists.
      Falls back to non-linked span if category exists but id is absent.
    - Added bottom back link.

Verification badge strategy (all four pages):
  verified → "Verified" (green: bg-green-50 text-green-700 border-green-200)
  partially_verified → "Partially Verified" (yellow: bg-yellow-50 text-yellow-700 border-yellow-200)
  source_conflict/outdated/needs_review → "Under Review" (orange: bg-orange-50 text-orange-700 border-orange-200)
  unverified → no badge rendered
  All class strings are complete literals in a static lookup object — safe for Tailwind v4 scanner.
  Placement: small badge row immediately below h1, above key facts dl.

Last updated strategy (all four pages):
  updated_at queried from DB, formatted with toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }).
  Rendered as small muted gray text "Last updated: Month D, YYYY" near the bottom of the page,
  above the bottom back link. Omitted entirely when updated_at is null.

CTA strategy:
  URL fields removed from key facts <dl>. A dedicated CTA block replaces them.
  Primary CTAs (application_url) use blue filled button style.
  Secondary CTAs (official_url, provider_url) use border ghost button style.
  All CTAs use target="_blank" rel="noopener noreferrer".
  CTA block omitted entirely when no URLs are present on a record.

English requirements (programs):
  Previous: JSON.stringify in <pre> — unreadable to users.
  New: Object.entries() over JSONB → <ul> with test name (IELTS, TOEFL) and detail string.
  Fallback to plain text notice when JSONB shape is non-object or empty.
  No set:html. No <pre>. No raw JSON visible to users.

Intakes (programs):
  Separate Supabase query after 404 check: program_intakes for this program.id.
  Ordered by application_deadline_date ASC nulls last, limit 10.
  Defaults to [] on error — page never crashes.
  Section shown only when rows exist.

SEO/404 preservation:
  All four pages preserve Phase 15 canonical/ogTitle/ogDesc computation unchanged.
  PublicLayout call signature unchanged. All existing 404 behavior preserved.
  content_status='published' filter preserved on all queries.

npm run build: PASS (Cloudflare server build, 1.49s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No list/search page changes.
  No admin CRUD changes.
  No migrations.
  No new dependencies.
  No React or client-side JS.
  No markdown renderer.
  No media/Cloudinary.
  No junction table display (scholarship_countries, article_subjects, etc.).
  No indexing_status noindex behavior on detail pages.
  No author display on articles.
  No pagination.

Phase 15 — Basic SEO System (implementation complete):

- Added basic SEO infrastructure layer for DegreeWiki's public routes.
  No admin changes, no migrations, no new dependencies, no React, no client-side JS,
  no service_role, no AI, no schema.org structured data.

Files created:
  public/robots.txt — static robots file: allows public crawling, disallows /admin/, /login,
    /auth/, /api/, points Sitemap to https://degreewiki.com/sitemap.xml.
  src/lib/site.ts — exports SITE_URL constant using PUBLIC_SITE_URL env var with fallback
    to 'https://degreewiki.com'. Trailing slash stripped. Consistent with PUBLIC_* env pattern.
  src/pages/sitemap.xml.ts — dynamic Astro API endpoint. Queries all 4 content tables in
    parallel via existing createClient(context.cookies, context.request) with anon key / RLS.
    Includes static URLs (/, /programs, /scholarships, /universities, /guides) plus detail URLs
    filtered to content_status='published' AND indexing_status='index'. updated_at date used
    as lastmod for detail URLs; omitted for static URLs. All loc/lastmod values XML-escaped.
    Returns Content-Type: application/xml; charset=utf-8 with Cache-Control: public, max-age=3600.
    Per-table error isolation: failed tables log to console.error and default to [] — sitemap
    never crashes, static URLs always returned.

Files modified:
  .env.example — added PUBLIC_SITE_URL= line.
  src/layouts/BaseLayout.astro — added canonical, ogTitle, ogDescription, ogType, ogUrl props.
    Renders <link rel="canonical"> when canonical provided. Renders og:site_name, og:type,
    og:title, og:description (if available), og:url (if available). Renders twitter:card=summary,
    twitter:title, twitter:description (if available). All OG/Twitter props have sensible
    fallbacks to title/description. No og:image, no twitter:image, no twitter:site.
    Existing noindex behavior unchanged.
  src/layouts/PublicLayout.astro — passes all new SEO props through to BaseLayout.
  src/pages/index.astro — added SITE_URL import; added canonical={SITE_URL + '/'} to PublicLayout.
  src/pages/programs/index.astro — added SITE_URL import; added canonical={SITE_URL + '/programs'}.
    Canonical always points to clean path regardless of active filters. noindex behavior unchanged.
  src/pages/scholarships/index.astro — same pattern, canonical={SITE_URL + '/scholarships'}.
  src/pages/universities/index.astro — same pattern, canonical={SITE_URL + '/universities'}.
  src/pages/guides/index.astro — same pattern, canonical={SITE_URL + '/guides'}.
  src/pages/programs/[slug].astro — added SITE_URL import; added canonical_url, og_title,
    og_description to Supabase select; computes canonical = canonical_url || SITE_URL+'/programs/'+slug,
    ogTitle = og_title || pageTitle, ogDesc = og_description || pageDesc; passes to PublicLayout.
  src/pages/scholarships/[slug].astro — same pattern.
  src/pages/universities/[slug].astro — same pattern.
  src/pages/guides/[slug].astro — same pattern.

Sitemap indexing behavior:
  All 4 content tables (programs, scholarships, universities, articles) require
  content_status='published' AND indexing_status='index' to appear in the sitemap.
  indexing_status defaults to 'draft' on all tables — records must be explicitly set to 'index'
  by an admin before appearing in the sitemap. This is intentional: it gives the admin explicit
  crawl-inclusion control per record.

Canonical strategy:
  List pages and homepage: SITE_URL + clean path (no query params).
  Filtered list pages: canonical still points to the clean path (/programs not /programs?q=...).
  Detail pages: db.canonical_url if set, otherwise SITE_URL + '/[type]/' + slug.

OG/Twitter strategy:
  ogTitle falls back to title (including — DegreeWiki suffix) when DB og_title is absent.
  ogDescription falls back to description (which itself falls back to seo_description/summary).
  og:type is 'website' for all pages in Phase 15.
  og:image and twitter:image deferred (Cloudinary integration pending).

Environment variable:
  PUBLIC_SITE_URL added to .env.example. Set in .env.local for dev, Cloudflare Pages
  dashboard for production. Falls back to 'https://degreewiki.com' if unset.

npm run build: PASS (Cloudflare server build, 1.42s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No og:image or twitter:image (Cloudinary not yet integrated).
  No twitter:site handle.
  No schema.org / JSON-LD structured data.
  No RSS feed.
  No hreflang.
  No og:type="article" for guides (requires article:published_time metadata — deferred).
  No sitemap index (single sitemap file for now).
  No admin CRUD changes.
  No migrations.
  No new npm dependencies.

## Last Completed Work

Phase 14 — Public Home Page Foundation (implementation complete):

- Upgraded / from a bare auth-placeholder page into a real public-facing homepage.
  Uses PublicLayout (gains PublicNav automatically). No admin changes, no migrations,
  no new dependencies, no React, no client-side JS, no service_role.
- Replaced src/pages/index.astro — full rewrite with hero, discovery cards, start-here block,
  latest programs/scholarships/guides sections, and secondary auth/admin row.

Homepage sections implemented:

  Hero: product name, subtitle for international students, two CTA buttons
    (Browse Programs → /programs, Find Scholarships → /scholarships).
  Discovery cards: four equal cards linking to /programs, /scholarships, /universities, /guides,
    each with a title and one-line description.
  Start here block: four goal-framed plain-link prompts using section index pages (no pre-filtered URLs).
  Latest programs: 3 most-recently created published programs with title, university name,
    degree level badge. Section omitted when no rows.
  Latest scholarships: 3 most-recently created published scholarships with name, provider name,
    deadline badge. Section omitted when no rows.
  Latest guides: 3 most-recently published articles with category badge, date, title, summary.
    Section omitted when no rows.
  Auth/admin row: visually secondary footer row — signed-in shows email, Admin dashboard link,
    Logout form; signed-out shows Sign in link.

Supabase query strategy:
  Four queries in Promise.all: auth.getUser(), programs limit 3 created_at DESC,
  scholarships limit 3 created_at DESC, articles limit 3 published_at DESC nulls last.
  All content queries include .eq('content_status', 'published').
  All failures default to [] — homepage never crashes.
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.
  No service_role. No new dependencies. No migrations.

SEO/meta:
  title: "DegreeWiki — Find Degrees, Scholarships & University Guides"
  description: "Discover university programs, scholarships, and study-abroad guides for international students."
  No noindex — homepage is fully indexable.

npm run build: PASS (Cloudflare server build, 1.36s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No search bar, autocomplete, or global search.
  No personalized homepage, saved items, or user dashboard.
  No AI features.
  No sitemap, robots.txt, canonical, OpenGraph, or structured data (future SEO phase).
  No latest universities section (no published_at column; created_at ordering is misleading).
  No admin CRUD changes.
  No public search/detail page changes.
  No PublicNav, BaseLayout, or PublicLayout changes.


Phase 13 — Public Guides Search / Category Foundation (implementation complete):

- Upgraded /guides from a basic published-guide list into a server-rendered guide discovery
  page with GET-form search and category filter. No admin changes, no migrations, no new
  dependencies, no React, no client-side JS, no service_role.
- Replaced src/pages/guides/index.astro — full rewrite with filter form, conditional Supabase
  query, result cards, result count, over-limit notice, and empty states.

Filters implemented (2 total, all via GET query params):
  q        — articles.title ilike '%q%' OR articles.summary ilike '%q%'
  category — articles.article_category_id = <uuid>

Filters deferred (column does not exist in current schema — no migration added):
  article_type — not a column on articles table in schema v1

Validation:
  q: trim, remove commas and parentheses, max 100 chars. Empty string → absent.
  category: UUID regex validated — invalid values treated as absent.
  Invalid filters never crash the page; they are silently dropped before the query.

Supabase query strategy:
  Single query with { count: 'exact' } and .limit(201).
  .eq('content_status', 'published') always applied (belt-and-suspenders + planner hint).
  .order('published_at', { ascending: false, nullsFirst: false }) then .order('title', { ascending: true }).
  q search uses .or('title.ilike.%q%,summary.ilike.%q%').
  category filter uses .eq('article_category_id', categoryId).
  Lookup query (article_categories) runs in parallel: select id, name, ordered by display_order then name.
  Failed lookups default to [] — page does not crash.
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.

Result UI:
  Card layout. Each card shows: category badge (if set), published_at date (if set),
  title linked to /guides/[slug], summary (if set).
  Result count shown above results. Over-200 notice when more than 200 match.
  Selected filter values preserved after form submit.
  Clear filters link shown when any filter is active.

noindex behavior:
  Filtered URLs (/guides?...) render <meta name="robots" content="noindex, follow">.
  Unfiltered /guides has no robots meta tag and remains indexable.
  Uses existing noindex prop support from Phase 10 (BaseLayout + PublicLayout).

Empty states:
  No filters + no rows → "No guides have been published yet."
  Filters active + no rows → "No guides match your filters." + clear filters link.
  Neither message reveals unpublished or hidden data.

npm run build: PASS (Cloudflare server build, 1.56s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No article_type filter (column absent from schema v1).
  No article junction table filters (article_countries, article_subjects, article_degree_levels).
  No updated_at display.
  No markdown rendering (no set:html).
  No indexing_status behavior changes.
  No pagination (hard limit 200 with over-limit notice).
  No AI, no saved items, no user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

Phase 12 — Public University Search & Filter Foundation (implementation complete):

- Upgraded /universities from a basic published-university list into a server-rendered
  university discovery page with GET-form search and filters. No admin changes, no migrations,
  no new dependencies, no React, no client-side JS, no service_role.
- Replaced src/pages/universities/index.astro — full rewrite with filter form, conditional
  Supabase query, result cards, result count, over-limit notice, and empty states.

Filters implemented (3 total, all via GET query params):
  q       — universities.name ilike '%q%'
  country — universities.country_id = <uuid>
  city    — universities.city_id = <uuid>

Filters deferred (columns do not exist in current schema — no migration added):
  institution_type — not a column on universities table in schema v1
  ownership_type   — not a column on universities table in schema v1
  short_name       — not a column on universities table in schema v1

Validation:
  q: trim, max 100 chars. Empty string → absent.
  country/city: UUID regex validated — invalid values treated as absent.
  Invalid filters never crash the page; they are silently dropped before the query.

Supabase query strategy:
  Single query with { count: 'exact' } and .limit(201).
  .eq('content_status', 'published') always applied (belt-and-suspenders + planner hint).
  .order('name', { ascending: true }).
  Filters chained conditionally: if (q) ilike, if (countryId) eq, if (cityId) eq.
  Lookup queries (countries, cities) run in Promise.all in parallel.
  Failed lookups default to [] — page does not crash.
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.

Result UI:
  Card layout. Each card shows: name (link to /universities/[slug]),
  country/city location line, ranking_summary (truncated, if set),
  official_url as "Official site ↗" link (if set, right-aligned).
  Result count shown above results. Over-200 notice when more than 200 match.
  Selected filter values preserved after form submit.
  Clear filters link shown when any filter is active.

noindex behavior:
  Filtered URLs (/universities?...) render <meta name="robots" content="noindex, follow">.
  Unfiltered /universities has no robots meta tag and remains indexable.
  Uses existing noindex prop support from Phase 10 (BaseLayout + PublicLayout).

Empty states:
  No filters + no rows → "No universities have been published yet."
  Filters active + no rows → "No universities match your filters." + clear filters link.
  Neither message reveals unpublished or hidden data.

npm run build: PASS (Cloudflare server build, 1.48s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No institution_type or ownership_type filters (columns absent from schema v1).
  No short_name display (column absent from schema v1).
  No pagination (hard limit 200 with over-limit notice).
  No city-scoped-by-country cascade (global city dropdown for Phase 12).
  No cross-table name search (country/city name search deferred).
  No AI, no saved items, no user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

Phase 11 — Public Scholarship Search & Filter Foundation (implementation complete):

- Upgraded /scholarships from a basic published-scholarship list into a server-rendered
  scholarship discovery page with GET-form search and filters. No admin changes, no migrations,
  no new dependencies, no React, no client-side JS, no service_role.
- Replaced src/pages/scholarships/index.astro — full rewrite with filter form, conditional
  Supabase query, result cards, result count, over-limit notice, and empty states.

Filters implemented (7 total, all via GET query params):
  q               — scholarships.name ilike '%q%' OR provider_name ilike '%q%'
  scholarship_type — scholarships.scholarship_type = <enum>
  provider_type    — scholarships.provider_type = <enum>
  funding_type     — scholarships.funding_type = <enum>
  application_type — scholarships.application_type = <enum>
  currency         — scholarships.currency ilike '%currency%'
  deadline         — deadline=upcoming → scholarships.deadline >= today (UTC date-only ISO)

Enum values confirmed from migration 007 CHECK constraints:
  scholarship_type: full, partial, merit, need_based, government, institutional, other
  provider_type:    government, university, private_foundation, corporate, ngo, other
  funding_type:     full_tuition, partial_tuition, living_stipend, travel, research, full_funding, other
  application_type: direct, university_portal, nomination, embassy, other

Validation:
  q: trim, remove commas and parentheses, max 100 chars.
  currency: trim, uppercase, remove non A-Z chars, max 10 chars.
  Enum params: validated against allowed set — invalid values treated as absent.
  deadline param: only 'upcoming' is accepted; any other value treated as absent.
  Invalid filters never crash the page; they are silently dropped before the query.

Supabase query strategy:
  Single query with { count: 'exact' } and .limit(201).
  .eq('content_status', 'published') always applied (belt-and-suspenders + planner hint).
  .order('deadline', { ascending: true, nullsFirst: false }) then .order('name', { ascending: true }).
  Filters chained conditionally: if (param) query = query.eq/ilike/or/gte(...).
  q search uses .or('name.ilike.%q%,provider_name.ilike.%q%').
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.

Result UI:
  Card layout. Each card shows: name (link to /scholarships/[slug]),
  provider_name, scholarship_type badge, provider_type badge, funding_type badge,
  application_type badge, deadline badge, amount range (right-aligned).
  Result count shown above results. Over-200 notice when more than 200 match.
  Selected filter values preserved after form submit.
  Clear filters link shown when any filter is active.

noindex behavior:
  Filtered URLs (/scholarships?...) render <meta name="robots" content="noindex, follow">.
  Unfiltered /scholarships has no robots meta tag and remains indexable.
  Uses existing noindex prop support from Phase 10 (BaseLayout + PublicLayout).

Empty states:
  No filters + no rows → "No scholarships have been published yet."
  Filters active + no rows → "No scholarships match your filters." + clear filters link.
  Neither message reveals unpublished or hidden data.

npm run build: PASS (Cloudflare server build, 1.45s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No pagination (hard limit 200 with over-limit notice).
  No amount-based filtering (cross-currency comparison unreliable without conversion).
  No deadline_before filter.
  No junction table filters (scholarship_countries, subjects, degree_levels, etc.).
  No overview in q search (name + provider_name only).
  No AI, no saved items, no user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

Phase 10 — Public Program Search & Filter Foundation (implementation complete):

- Upgraded /programs from a basic published-program list into a server-rendered program
  discovery page with GET-form search and filters. No admin changes, no migrations,
  no new dependencies, no React, no client-side JS, no service_role.
- Modified src/layouts/BaseLayout.astro — added optional noindex?: boolean prop.
  Renders <meta name="robots" content="noindex, follow"> when true. Additive; no effect
  on existing pages that do not pass the prop.
- Modified src/layouts/PublicLayout.astro — added noindex?: boolean prop, passes through
  to BaseLayout. Additive; all existing public pages unaffected.
- Replaced src/pages/programs/index.astro — full rewrite with filter form, conditional
  Supabase query, result cards, result count, over-limit notice, and empty states.

Filters implemented (10 total, all via GET query params):
  q             — programs.title ilike '%q%'
  country       — programs.country_id = <uuid>
  city          — programs.city_id = <uuid>
  university    — programs.university_id = <uuid>
  degree_level  — programs.degree_level_id = <uuid>
  subject       — programs.primary_subject_id = <uuid>
  study_mode    — programs.study_mode = <enum>
  delivery_mode — programs.delivery_mode = <enum>
  language      — programs.language_of_instruction ilike '%language%'
  tuition_max   — programs.tuition_max_amount <= value

Enum values confirmed from migration 006 CHECK constraints:
  study_mode:    full_time, part_time, online, hybrid
  delivery_mode: on_campus, online, hybrid, distance

Validation:
  q: trim, max 100 chars. language: trim, max 80 chars.
  UUID params: regex validated — invalid values treated as absent.
  Enum params: validated against allowed set — invalid values treated as absent.
  tuition_max: parseFloat, must be finite and > 0 — invalid values treated as absent.
  Invalid filters never crash the page; they are silently dropped before the query.

Supabase query strategy:
  Single query with { count: 'exact' } and .limit(201).
  .eq('content_status', 'published') always applied (belt-and-suspenders + planner hint).
  Filters chained conditionally: if (param) query = query.eq/ilike/lte(...).
  Lookup queries (countries, cities, universities, degree_levels, subjects) run in
  Promise.all in parallel. Failed lookups default to [] — page does not crash.
  Uses existing createClient(Astro.cookies, Astro.request) — anon key, RLS enforced.

Result UI:
  Card layout. Each card shows: title (link to /programs/[slug]),
  university (link to /universities/[slug]), country/city, degree level badge,
  subject badge, study mode badge, delivery mode badge, language badge, tuition range.
  Result count shown above results. Over-200 notice when more than 200 match.
  Selected filter values preserved after form submit.
  Clear filters link shown when any filter is active.
  Tuition note: "Programs without tuition data may be excluded."

noindex behavior:
  Filtered URLs (/programs?...) render <meta name="robots" content="noindex, follow">.
  Unfiltered /programs has no robots meta tag and remains indexable.

Empty states:
  No filters + no rows → "No programs have been published yet."
  Filters active + no rows → "No programs match your filters." + clear filters link.
  Neither message reveals unpublished or hidden data.

npm run build: PASS (Cloudflare server build, 1.32s, zero errors).
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role" → 0 matches.

Exclusions (deferred):
  No pagination (hard limit 200 with over-limit notice).
  No program_subjects junction for multi-subject filtering (primary_subject_id only).
  No city-scoped-by-country dropdown dependency (global city list for Phase 10).
  No full-text search across university names (title only via ilike).
  No media/Cloudinary.
  No AI.
  No saved items or user dashboard.
  No admin page changes.
  No new dependencies.
  No migrations.
  No SEO landing pages for filter combinations.

Phase 09 — Public Read-Only Content Foundation (implementation complete):

- RLS preflight confirmed on all 9 tables before any code was written.
  All public SELECT policies exist and apply to the anon role (no TO clause).
  No migrations required.
- Created src/layouts/PublicLayout.astro — wraps BaseLayout, includes PublicNav.
- Created src/components/public/PublicNav.astro — horizontal nav: DegreeWiki logo +
  links to /universities, /programs, /scholarships, /guides. Active state via Astro.url.pathname.
- Created src/pages/404.astro — clean 404 page using PublicLayout with links to all public sections.
- Modified src/layouts/BaseLayout.astro — added optional description prop →
  injects <meta name="description"> when present. Additive change; admin pages unaffected.
- Modified src/pages/index.astro — added public nav links above auth block.
- Created src/pages/universities/index.astro — published universities list (name, country, city, ranking).
- Created src/pages/universities/[slug].astro — university detail (facts + ranking + overview).
- Created src/pages/programs/index.astro — published programs list (title, university link, degree, study mode).
- Created src/pages/programs/[slug].astro — program detail (full facts + tuition + curriculum + requirements).
- Created src/pages/scholarships/index.astro — published scholarships list (name, type, provider, amount, deadline).
- Created src/pages/scholarships/[slug].astro — scholarship detail (full facts + overview + eligibility).
- Created src/pages/guides/index.astro — published articles list (card layout: category badge, date, excerpt).
- Created src/pages/guides/[slug].astro — article detail (category, date, summary, content as plain text paragraphs).

Public routes added:
  /universities          — list
  /universities/[slug]   — detail
  /programs              — list
  /programs/[slug]       — detail
  /scholarships          — list
  /scholarships/[slug]   — detail
  /guides                — list  (public name for articles)
  /guides/[slug]         — detail

Key implementation decisions:
  All queries filter content_status = 'published'. Missing or unpublished slug returns
  new Response(null, { status: 404 }). Hard LIMIT 100 on all listing pages (no pagination).
  No set:html anywhere. Article content rendered as plain-text paragraphs. english_requirements
  (confirmed real JSONB column on programs) rendered with JSON.stringify in <pre> when non-null.
  admission_requirements (TEXT) rendered as whitespace-pre-wrap paragraph.
  published_at on articles is nullable — rendered gracefully with no crash.
  All Supabase embedded joins (countries, cities, universities, degree_levels, subjects,
  article_categories) may return null if the joined row is unpublished — all handled with
  optional chaining and ?? fallbacks.

RLS preflight: PASS. All 9 tables confirmed.
npm run build: PASS (Cloudflare output, 1.42s, zero errors).
Get-ChildItem src -Recurse -File | Select-String "service_role" → 0 matches.

Exclusions (deferred):
  No search/filter/pagination UI.
  No media/Cloudinary.
  No AI.
  No saved items or user dashboard.
  No comments or report form.
  No admin page changes.
  No new dependencies.
  No migrations.
  No junction table display (scholarship_countries, article_subjects, etc.).
  No author display on articles (author_user_id join deferred).
  No rich text/markdown rendering.

Phase 08 — Articles / Guides CRUD Foundation (implementation complete):

- Deleted src/pages/admin/articles.astro (flat Phase 04 read-only stub).
  Replaced with articles/ folder to allow sub-routes (same URL /admin/articles, no breakage).
- Added src/pages/admin/articles/index.astro — list: title, slug, category name (via Map),
  content_status badge, published_at, created_at, Edit link. "+ New Article" button.
  Category names resolved client-side from a parallel article_categories fetch → Map<id, name>.
- Added src/pages/admin/articles/new.astro — create form with 5 sections and 8 fields.
- Added src/pages/admin/articles/[id].astro — edit form; loads existing record and article_categories
  in parallel, prefills all fields.
- AdminSidebar.astro: no change needed — Articles link already present at /admin/articles.
- No new validate.ts helpers needed — all existing helpers reused.
- npm run build: PASS (Cloudflare output, 6.74s, zero errors).
- Grep service_role src/: 0 matches.

Routes added:
  /admin/articles        — list with status badges, category column, published_at
  /admin/articles/new    — create form
  /admin/articles/[id]   — edit form

Fields implemented (8):
  title, slug, article_category_id (select from seeded categories),
  summary, content, content_status, indexing_status, verification_status.

Special server-side behaviors:
  author_user_id — set silently on INSERT only; not shown in UI, not modified on edit.
  published_at — set only on first transition to content_status = 'published';
                 never reset on subsequent saves or re-publishes.
  article_category_id — validated against live-loaded categories before DB write;
                        submitted as null when left empty.

Exclusions (deferred):
  No public guide/article pages.
  No SEO fields (seo_title, seo_description, seo_h1, canonical_url, og_title, og_description).
  No media fields (featured_image_id, og_image_id).
  No junction tables (article_countries, article_subjects, article_degree_levels).
  No article category CRUD.
  No delete.
  No service_role in src.

Phase 07 — Scholarships CRUD Foundation (implementation complete):

- Deleted src/pages/admin/scholarships.astro (flat Phase 04 read-only list).
  Replaced with scholarships/ folder to allow sub-routes (same URL /admin/scholarships, no breakage).
- Added src/pages/admin/scholarships/index.astro — list: name, slug, scholarship_type,
  content_status badge, deadline, created_at, Edit link. "+ New Scholarship" button.
- Added src/pages/admin/scholarships/new.astro — create form with 7 sections and 20 fields.
- Added src/pages/admin/scholarships/[id].astro — edit form; loads existing record, prefills
  all fields (numeric columns converted to strings for form state).
- AdminSidebar.astro: no change needed — Scholarships link already present at /admin/scholarships.
- No new validate.ts helpers needed — all existing helpers reused.
- npm run build: PASS (Cloudflare output, 2.75s, zero errors).
- PowerShell service_role search: 0 matches.

Fields implemented (20):
  name, slug, scholarship_type, provider_name, provider_type, funding_type, application_type,
  amount_min, amount_max, currency, coverage_notes, deadline, deadline_text,
  official_url, application_url, provider_url, overview, eligibility_summary,
  content_status, verification_status.

Fields intentionally skipped:
  indexing_status, all SEO fields, og_image_id, data_completeness_score,
  source_confidence_score, last_verified_at, next_review_due_at.
  All junction tables (scholarship_countries, scholarship_universities, scholarship_programs,
  scholarship_subjects, scholarship_degree_levels, scholarship_eligible_nationalities) — deferred.

Phase 06 — Programs CRUD Foundation (implementation complete):

- Deleted src/pages/admin/programs.astro (flat Phase 04 read-only list).
  Replaced with programs/ folder to allow sub-routes (same URL /admin/programs, no breakage).
- Added src/pages/admin/programs/index.astro — list: title, university (name via map),
  degree level code, content_status badge, created_at, Edit link. "+ New Program" button.
  Separate university and degree_level queries + Maps (no join, per Approved Decision 9).
- Added src/pages/admin/programs/new.astro — create form with 8 sections and 26 fields.
- Added src/pages/admin/programs/[id].astro — edit form; loads existing record, prefills
  all fields (numeric columns converted to strings for form state).
- Extended src/lib/admin/validate.ts with two new helpers:
  validateNumeric(value, label, { min? }) — non-empty numeric check with optional floor.
  validateUrl(value, label) — non-empty http/https URL check using new URL().
- country_id and city_id: not exposed as form inputs. Derived server-side by looking up
  the selected university in the already-loaded universities array on every POST.
- AdminSidebar.astro: no change needed — Programs link already present at /admin/programs.
- npm run build: PASS (Cloudflare output, 7.74s, zero errors).
- PowerShell service_role search: 0 matches.

Fields implemented (26):
  title, slug, university_id, degree_level_id, degree_award, primary_subject_id,
  duration_months, study_mode, delivery_mode, language_of_instruction,
  tuition_min_amount, tuition_max_amount, tuition_currency, tuition_period, tuition_notes,
  application_fee_amount, application_fee_currency, application_fee_notes,
  official_url, application_url, admission_requirements, gpa_requirements,
  curriculum_summary, career_outcomes, content_status, verification_status.

Fields intentionally skipped:
  campus_id (no campus CRUD yet), english_requirements (jsonb — deferred),
  indexing_status, all SEO fields, og_image_id, data_completeness_score,
  source_confidence_score, last_verified_at, next_review_due_at.

Phase 05 — Admin CRUD Foundation (implementation complete):

- Added src/lib/admin/validate.ts — manual validation helpers (no Zod; Zod not in package.json).
  Functions: validateRequired, validateExactLength, validateIn, validateSlug.
- Added src/lib/admin/slug.ts — toSlug() helper: lowercase, strip non-alnum, collapse hyphens.
- Added /admin/countries (new list page), /admin/countries/new, /admin/countries/[id] (edit).
  Fields: name, slug, iso2, iso3, continent, overview, content_status.
- Added /admin/cities (new list page), /admin/cities/new, /admin/cities/[id] (edit).
  Fields: name, slug, country_id (select from all countries), content_status.
  List shows joined country name.
- Moved /admin/universities from flat universities.astro → universities/index.astro
  (required to allow universities/ folder for new/edit routes; same URL, no breakage).
  Added + New University button and Edit links to the list.
  Added /admin/universities/new and /admin/universities/[id] (edit).
  Fields: name, slug, country_id, city_id (optional), official_url, overview, content_status.
- Added /admin/degree-levels (new list page), /admin/degree-levels/[id] (edit only — no create).
  Fields: name, display_order, is_active. Code field shown as read-only info, not an input.
- Added /admin/subjects (new list page), /admin/subjects/new, /admin/subjects/[id] (edit).
  Fields: name, slug, parent_subject_id (select excluding self on edit), display_order, content_status.
  Self-parent assignment blocked server-side on edit.
- Updated AdminSidebar.astro: added Countries, Cities, Degree Levels, Subjects nav links (13 total).
- All new routes enforce the existing requireSuperAdmin() guard.
- All writes use the session-authenticated Supabase server client. No service_role in src.
- No migrations. No new API endpoints. No React. No client-side JS.
- Constraint errors (code 23505) surface as user-readable field-level messages.
- POST-redirect-GET on success (no flash message system needed).
- npm run build: passed (Cloudflare output, 9.76s).
- grep service_role src/: 0 matches.

Phase 04 — Admin Dashboard Foundation (implementation complete):

- Added shared admin auth guard (src/lib/admin/guard.ts) — requireSuperAdmin() helper extracts
  the three-step gate: getUser() → redirect if anon, has_role('super_admin') RPC → 403 if not.
  Returns { type: 'ok', user, supabase } so pages reuse the same client for data queries.
- Added badge class maps (src/lib/admin/badges.ts) with static literal strings for Tailwind v4
  scanner compatibility. Maps cover content_status, import_status, batch_type, quality result,
  and account_status.
- Added AdminLayout.astro — wraps BaseLayout (no duplicate html/head/body). Two-column layout:
  fixed sidebar + main content area with topbar (email + logout).
- Added AdminSidebar.astro — 9-link nav, active link highlight via activePath prop.
- Added StatCard.astro — reusable stat card for dashboard counts.
- Replaced /admin (index.astro) with dashboard home: 6 stat cards (universities, programs,
  scholarships, articles, import batches, users) loaded via count queries.
- Added /admin/universities — table: name, slug, content_status badge, verification_status,
  data_completeness_score, created_at. 100-row limit, ordered by created_at desc.
- Added /admin/programs — table: title, slug, content_status badge, degree level code (via
  degree_levels lookup map), created_at.
- Added /admin/scholarships — table: name, slug, content_status badge, scholarship_type,
  deadline (scholarships.deadline is a real date column, confirmed), created_at.
- Added /admin/articles — table: title, slug, content_status badge, published_at
  (articles.published_at confirmed), created_at.
- Added /admin/data-quality — pass/fail/warning summary counts + table: entity_type,
  check_type, result badge, checked_at. 50-row limit.
- Added /admin/imports — table: batch_type badge, import_status badge, total_records,
  processed_count, error_count, created_at. import_batches columns confirmed from migration 010.
- Added /admin/users — table: user ID (truncated), display_name, account_status badge,
  created_at. Email omitted — not in user_profiles; auth.users requires service_role.
  Note shown in UI explaining the limitation.
- Added /admin/system — roles and permissions tables from seed data. No secrets, no env vars.
- All 9 routes enforce: anonymous → /login?redirect=..., non-super_admin → 403.
- npm run build: passed (Cloudflare output, 7.26s).
- grep service_role src/: one match — a comment in users.astro explaining why email is not
  shown. No actual service_role key usage anywhere in src/.
- No .env.local or secrets in git diff.

Phase 03 — App Foundation and Auth (complete):

- Scaffolded Astro v5 app (no app existed before this phase).
- Configured Cloudflare SSR adapter (output: server).
- Added Tailwind v4 via @tailwindcss/vite Vite plugin (not deprecated @astrojs/tailwind).
- Added src/styles/global.css with @import "tailwindcss".
- Added Supabase browser client (src/lib/supabase/client.ts) using @supabase/ssr createBrowserClient.
- Added Supabase server client (src/lib/supabase/server.ts) using @supabase/ssr createServerClient.
  Cookie reading uses raw request header parsing — AstroCookies.getAll() does not exist in Astro v5.
- Added src/middleware.ts for per-request session token refresh.
- Added /login page with email+password form and open-redirect guard on the ?redirect= param.
- Added POST /api/auth/logout endpoint — signs out and redirects to /login.
- Added /auth/callback route for future magic link / OAuth code exchange.
- Added /admin protected route: getUser() validates JWT server-side; has_role('super_admin')
  RPC confirms role. Returns 403 for non-super_admin. Redirects anonymous visitors to /login.
- Added .env.example committed with empty keys. .env.local is gitignored.
- Added dist/ and .astro/ to .gitignore.
- React not installed in Phase 03 — deferred until interactive islands are actually needed.
- No service_role key anywhere in src/. No secrets committed.
- npm run build: passed (Cloudflare output, 2.47s).
- All auth tests passed: super_admin login to /admin, student denied (403),
  anonymous /admin redirect to login, logout clears session.
- Committed as 1ad037b on branch feature/phase-03-app-foundation-auth.

Phase 02 — Supabase Cloud Dev Deployment and RLS Validation (complete):

- Provisioned Supabase cloud dev project (ap-south-1 / Mumbai, ref: hbjnrlsnrknugpkitihq).
- Pushed migrations 001–015 via `supabase db push`. Remote migration list matches local.
- Bootstrapped first super_admin (degreewiki@gmail.com) via Supabase Dashboard SQL editor.
- Verified super_admin: role_code = super_admin, permission_count = 20.
- Verified cloud grants: anon and authenticated DML grants present on all public tables.
- RLS problem check: 0 rows returned — every public table has RLS enabled and at least one policy.
- Ran 15-test RLS REST/API smoke test suite (anon key + JWTs only, no service_role):
  - anon reads active degree_levels and report_categories: PASS.
  - anon INSERT into degree_levels blocked (HTTP 401 — no anon INSERT grant, not an RLS failure): PASS.
  - anon SELECT on user_profiles returns []: PASS.
  - smoke student reads only own user_profile: PASS.
  - smoke student INSERT into student_profiles: PASS.
  - smoke student sees only own student_profile: PASS.
  - smoke student cannot read admin_activity_logs: PASS.
  - smoke student cannot INSERT into roles: PASS (HTTP 403).
  - super_admin sees all user_profiles (2 visible): PASS.
  - super_admin sees all student_profiles (1 visible): PASS.
  - super_admin reads admin_activity_logs without 403: PASS.

Phase 01 — Database Schema v1 (complete):

- Wrote and approved three-round implementation plan for Full Database Schema v1.
- Implemented migrations 001–004.
- Patched migrations 002–004 with security fixes.
- Re-verified patches via grep after a discrepancy was reported between the reviewed
  version and the files on disk. Grep confirmed all three fixes are present on disk.
- Implemented migration 005 (universities, campuses) after 001–004 were approved.
- Implemented migration 006 (programs, program_subjects, program_intakes).
- Implemented migration 007 (scholarships and all six junction tables).
- Implemented migration 008 (article_categories, articles, article junction tables, seo_page_types, seo_landing_pages).
- Implemented migration 009 (data_sources, source_snapshots, verification_events, data_quality_checks).
- Implemented migration 010 (import_batches, import_files, staging_universities, staging_programs, staging_scholarships, staging_errors).
- Implemented migration 011 (student_profiles, student_profile_subjects, student_profile_countries).
- Implemented migration 012 (ai_finder_results, ai_finder_program_matches, ai_conversations, ai_messages, ai_usage_logs).
- Security-patched migrations 011 and 012 (round 1: tightened constraints, removed unsafe browser write policies).
- Security-patched migration 012 (round 2: removed ai_finder_results_insert_own; tightened ai_conversations INSERT/UPDATE to enforce student_profile_id ownership).
- Implemented migration 013 (report_categories, user_reports, saved_items).
- Implemented migration 014 (analytics_events, search_logs, outbound_clicks).
- Security-patched migration 014 (round 1: tightened INSERT WITH CHECK to prevent user_id impersonation; added entity_type/entity_id consistency constraint on analytics_events).
- Implemented migration 015 (seed data: degree_levels, roles, permissions, role_permissions, article_categories, seo_page_types, report_categories).

## Current Architecture Decisions

- Astro.js frontend
- React islands for interactivity (React not yet installed — deferred until first interactive island)
- Tailwind CSS v4
- Supabase PostgreSQL
- Supabase Auth
- Supabase RLS
- Cloudflare Pages/Workers as primary deployment
- Vercel as fallback deployment
- Cloudinary for public images
- Supabase Storage for private/import files
- Gemini first through AI Gateway
- pgvector later for RAG
- No ChromaDB in MVP
- No separate admin app in MVP
- No Vercel-only services
- Text columns with CHECK constraints — no PostgreSQL ENUM types
- has_role() and has_permission() as RLS helper functions
- RLS enabled inline on every table — no table left open
- Anonymous student profiles and AI sessions are managed via service role (server endpoints only)
- No direct browser RLS for anonymous AI or profile data

## Active Branch

main

## Migration Files Created

supabase/migrations/001_custom_types.sql
supabase/migrations/002_auth_roles.sql
supabase/migrations/003_media.sql
supabase/migrations/004_lookup_tables.sql
supabase/migrations/005_universities_campuses.sql
supabase/migrations/006_programs.sql
supabase/migrations/007_scholarships.sql
supabase/migrations/008_articles_seo.sql
supabase/migrations/009_data_sources.sql
supabase/migrations/010_import_staging.sql
supabase/migrations/011_student_profiles.sql
supabase/migrations/012_ai_tables.sql
supabase/migrations/013_user_product.sql
supabase/migrations/014_analytics.sql
supabase/migrations/015_seed_data.sql

## Database Schema v1 — Complete

All 15 migrations are written. No migrations remain in v1.

## Bootstrap Note

The first super_admin user cannot be assigned through normal browser flows because RLS
on user_roles blocks all non-super_admin writes. The first role assignment must be done
using one of these methods:

- Supabase Dashboard SQL editor (runs as postgres, bypasses RLS)
- A local seed script executed with the service role key
- supabase db seed or a one-time SQL snippet on the connected database

After the first super_admin exists, all subsequent role assignments can be done through
the admin dashboard server endpoints.

## Known Issues / Open Questions

- Countries and subjects import source not yet confirmed (needed for post-schema data load).
- english_requirements jsonb schema example not yet documented.
- Frontend design system is not finalized.
- MCP/tooling setup is not finalized.
- T2-A (anon INSERT degree_levels) returned HTTP 401 instead of 403. This is correct behaviour:
  PostgREST returns 401 when the role has no INSERT grant at all (pre-RLS rejection), and 403
  when a grant exists but an RLS policy blocks the row. The write is blocked either way.
- /admin/users shows profile data only (display_name, account_status). Email requires a
  privileged server endpoint querying auth.users via service role — deferred to future phase.

## Next Steps

Phase 10 manual test checklist (verify before calling done):
1. GET /programs — blank form, all published programs listed, no noindex in page source.
2. GET /programs?q=science — title filter works, q field pre-filled, noindex in source.
3. GET /programs?country=<valid-uuid> — country dropdown shows selection, results filtered.
4. GET /programs?country=not-a-uuid — treated as no filter, page does not error.
5. GET /programs?study_mode=full_time — dropdown shows "Full time" selected.
6. GET /programs?study_mode=bogus — treated as no filter.
7. GET /programs?delivery_mode=on_campus — dropdown shows "On campus" selected.
8. GET /programs?tuition_max=20000 — filters correctly, note visible below input.
9. GET /programs?tuition_max=-50 — treated as no filter (field shows empty).
10. GET /programs?tuition_max=abc — treated as no filter.
11. GET /programs?language=English — results filtered, field pre-filled.
12. All 10 filters active simultaneously — combined filtering works.
13. Result count shown correctly ("N programs found.").
14. Over-200 notice appears if enough data exists.
15. Empty result with filters → "No programs match your filters." + clear filters link.
16. Empty result without filters → "No programs have been published yet."
17. Program card: title link, university link, location, degree badge, subject badge,
    mode badges, language badge, tuition range all render correctly.
18. University link goes to /universities/[slug].
19. Title link goes to /programs/[slug] (detail page — no regression).
20. Clear filters link returns to /programs.
21. Selected filter values preserved after form submit.
22. GET /programs/[slug] — detail page loads without regression.
23. GET /admin/ unauthenticated — redirects to /login (no admin regression).

Begin Phase 11 after Phase 10 manual verification passes.
