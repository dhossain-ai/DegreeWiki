# DegreeWiki Current Status

Last updated: 2026-06-16

## Current Phase

Phase 06 — Programs CRUD Foundation — implementation complete, pending manual verification.

Programs list/new/edit built with server-side Astro form POST handling. country_id and
city_id derived from selected university on every save. 26 fields across 8 form sections.
Two new validate.ts helpers (validateNumeric, validateUrl). No migrations, no service_role
in src, no secrets committed. npm run build passed (Cloudflare output, 7.74s).

## Last Completed Work

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

feature/phase-05-admin-crud-foundation

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

1. Manually verify all new admin routes: anonymous redirect, student 403, super_admin access.
2. Test create/edit for countries, cities, universities, subjects.
3. Test degree levels list and edit.
4. Verify duplicate slug / required field validation shows inline errors.
5. Merge feature/phase-05-admin-crud-foundation to main after manual verification.
6. Load countries and subjects data through the new admin forms.
7. Begin Phase 06: TBD (programs CRUD, public SEO pages, or articles).
