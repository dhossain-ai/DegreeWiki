# DegreeWiki Current Status

Last updated: 2026-06-15

## Current Phase

Phase 03 — App Foundation and Auth — COMPLETE.

Astro v5 app scaffolded with Cloudflare SSR adapter. Supabase browser and server clients added. Login/logout implemented. /admin protected route confirmed: super_admin access granted, student account denied (403), anonymous visitor redirected to /login. npm run build passed. No service_role in src. No secrets committed (2026-06-15).

## Last Completed Work

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
- React islands for interactivity
- Tailwind CSS
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

feature/phase-03-app-foundation-auth

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
- Admin dashboard implementation details are not finalized.
- Frontend design system is not finalized.
- MCP/tooling setup is not finalized.
- T2-A (anon INSERT degree_levels) returned HTTP 401 instead of 403. This is correct behaviour:
  PostgREST returns 401 when the role has no INSERT grant at all (pre-RLS rejection), and 403
  when a grant exists but an RLS policy blocks the row. The write is blocked either way.

## Next Steps

1. Merge feature/phase-03-app-foundation-auth to main.
2. Load countries and subjects via import batch.
3. Begin Phase 04: admin CRUD, public SEO pages, or React islands (TBD).
