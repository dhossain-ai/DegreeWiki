-- ============================================================
-- Migration 027: Country Profile Enrichment
-- ============================================================
-- Adds structured destination-profile content columns to
-- public.countries for richer public destination pages and
-- future admin country editing.
--
-- Scope:
-- - Additive only
-- - Nullable columns only
-- - No defaults for new content fields
-- - No RLS changes
-- - No new indexes
-- - No universities/import/frontend changes in this phase
-- ============================================================

ALTER TABLE public.countries
  -- ----------------------------------------------------------
  -- Basic destination facts
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS capital_city_name text,
  ADD COLUMN IF NOT EXISTS currency_code text,
  ADD COLUMN IF NOT EXISTS currency_name text,
  ADD COLUMN IF NOT EXISTS official_language_names text[],
  ADD COLUMN IF NOT EXISTS common_study_language_names text[],
  ADD COLUMN IF NOT EXISTS popular_student_city_names text[],

  -- ----------------------------------------------------------
  -- Editorial overview fields
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS tuition_overview text,
  ADD COLUMN IF NOT EXISTS living_cost_overview text,
  ADD COLUMN IF NOT EXISTS admission_overview text,
  ADD COLUMN IF NOT EXISTS visa_overview text,
  ADD COLUMN IF NOT EXISTS student_work_rights_overview text,
  ADD COLUMN IF NOT EXISTS post_study_work_overview text,
  ADD COLUMN IF NOT EXISTS scholarship_overview text,
  ADD COLUMN IF NOT EXISTS university_system_overview text,
  ADD COLUMN IF NOT EXISTS required_documents_overview text,
  ADD COLUMN IF NOT EXISTS intake_overview text,

  -- ----------------------------------------------------------
  -- Structured cost fields
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS tuition_min_annual numeric(12,2),
  ADD COLUMN IF NOT EXISTS tuition_max_annual numeric(12,2),
  ADD COLUMN IF NOT EXISTS tuition_currency text,
  ADD COLUMN IF NOT EXISTS living_cost_min_monthly numeric(12,2),
  ADD COLUMN IF NOT EXISTS living_cost_max_monthly numeric(12,2),
  ADD COLUMN IF NOT EXISTS living_cost_currency text,

  -- ----------------------------------------------------------
  -- Work and post-study fields
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS student_work_allowed boolean,
  ADD COLUMN IF NOT EXISTS student_work_hours_text text,
  ADD COLUMN IF NOT EXISTS post_study_work_available boolean,
  ADD COLUMN IF NOT EXISTS post_study_work_duration_text text,

  -- ----------------------------------------------------------
  -- Official source URLs
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS official_education_url text,
  ADD COLUMN IF NOT EXISTS official_visa_url text,

  -- ----------------------------------------------------------
  -- FAQ content
  -- Intended shape:
  -- [{"question":"...","answer":"..."}]
  -- ----------------------------------------------------------
  ADD COLUMN IF NOT EXISTS faq_json jsonb;

COMMENT ON COLUMN public.countries.faq_json IS
  'Intended shape: [{"question":"...","answer":"..."}]';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'countries_tuition_min_annual_nonnegative'
  ) THEN
    ALTER TABLE public.countries
      ADD CONSTRAINT countries_tuition_min_annual_nonnegative
      CHECK (tuition_min_annual IS NULL OR tuition_min_annual >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'countries_tuition_max_annual_nonnegative'
  ) THEN
    ALTER TABLE public.countries
      ADD CONSTRAINT countries_tuition_max_annual_nonnegative
      CHECK (tuition_max_annual IS NULL OR tuition_max_annual >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'countries_tuition_annual_range'
  ) THEN
    ALTER TABLE public.countries
      ADD CONSTRAINT countries_tuition_annual_range
      CHECK (
        tuition_min_annual IS NULL
        OR tuition_max_annual IS NULL
        OR tuition_max_annual >= tuition_min_annual
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'countries_living_cost_min_monthly_nonnegative'
  ) THEN
    ALTER TABLE public.countries
      ADD CONSTRAINT countries_living_cost_min_monthly_nonnegative
      CHECK (living_cost_min_monthly IS NULL OR living_cost_min_monthly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'countries_living_cost_max_monthly_nonnegative'
  ) THEN
    ALTER TABLE public.countries
      ADD CONSTRAINT countries_living_cost_max_monthly_nonnegative
      CHECK (living_cost_max_monthly IS NULL OR living_cost_max_monthly >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'countries_living_cost_monthly_range'
  ) THEN
    ALTER TABLE public.countries
      ADD CONSTRAINT countries_living_cost_monthly_range
      CHECK (
        living_cost_min_monthly IS NULL
        OR living_cost_max_monthly IS NULL
        OR living_cost_max_monthly >= living_cost_min_monthly
      );
  END IF;
END $$;
