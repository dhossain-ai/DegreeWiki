# DegreeWiki Status Archive

> Split archive for Phase 01-10. Use the narrowest matching range first.
> Older phases beyond this range live in the next archive file.

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

