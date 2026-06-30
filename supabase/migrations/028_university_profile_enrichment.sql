-- ============================================================
-- Migration 028: University Profile Enrichment
-- ============================================================
-- Adds additive, nullable profile-enrichment columns to
-- public.universities for richer admin editing and public
-- university pages.
--
-- Scope:
-- - Additive only
-- - Nullable columns only
-- - No defaults
-- - No RLS changes
-- - No new indexes
-- - No ranking-provider-specific columns
-- - No university-wide tuition or application-fee columns
-- ============================================================

ALTER TABLE public.universities
  -- ----------------------------------------------------------
  -- Basic profile fields
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS native_name text,
  ADD COLUMN IF NOT EXISTS institution_type text,
  ADD COLUMN IF NOT EXISTS ownership_type text,
  ADD COLUMN IF NOT EXISTS campus_summary text,

  -- ----------------------------------------------------------
  -- Admissions and application
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS admission_overview text,
  ADD COLUMN IF NOT EXISTS application_overview text,
  ADD COLUMN IF NOT EXISTS application_portal_url text,
  ADD COLUMN IF NOT EXISTS international_admissions_url text,
  ADD COLUMN IF NOT EXISTS admission_email text,

  -- ----------------------------------------------------------
  -- Student support and life
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS language_requirement_overview text,
  ADD COLUMN IF NOT EXISTS scholarship_overview text,
  ADD COLUMN IF NOT EXISTS housing_overview text,
  ADD COLUMN IF NOT EXISTS student_life_overview text,
  ADD COLUMN IF NOT EXISTS international_student_overview text,
  ADD COLUMN IF NOT EXISTS career_support_overview text,

  -- ----------------------------------------------------------
  -- Rankings
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS ranking_source_url text;
