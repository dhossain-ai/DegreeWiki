-- ============================================================
-- Migration 004: Core Lookup Tables
-- ============================================================
-- Tables: degree_levels, countries, cities, subjects
--
-- These are the foundational reference tables used as FK targets
-- by universities, campuses, programs, scholarships, articles,
-- student profiles, and SEO landing pages.
--
-- All content tables in this migration use:
--   content_status  — CHECK (draft | in_review | published |
--                            unpublished | archived)
--   verification_status — CHECK against canonical values
--   indexing_status — CHECK (index | noindex | draft)
--   data_completeness_score — integer 0–100
--   source_confidence_score — integer 0–100
--
-- Scores are set by server-side logic, not database triggers.
--
-- Publishing permission enforcement:
--   edit_content    — can create/edit draft, in_review, unpublished, archived
--   publish_content — additionally required when content_status = 'published'
--   This is enforced in RLS WITH CHECK on INSERT and UPDATE, not only server-side.
-- ============================================================


-- ------------------------------------------------------------
-- degree_levels
-- Stable lookup for academic qualification levels.
-- Controlled by is_active, not content_status, because these
-- values rarely change and do not have a publishing workflow.
-- Seeded in migration 015.
-- ------------------------------------------------------------
CREATE TABLE public.degree_levels (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text    NOT NULL UNIQUE,
  name          text    NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true
);
-- code UNIQUE constraint auto-creates an index.
CREATE INDEX idx_degree_levels_display_order ON public.degree_levels (display_order);

ALTER TABLE public.degree_levels ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read active degree levels.
-- Degree levels are referenced everywhere: search filters,
-- program cards, student profiles. They must be publicly readable.
CREATE POLICY "degree_levels_select_active" ON public.degree_levels
  FOR SELECT
  USING (is_active = true);

-- Settings managers can read all degree levels (including inactive).
CREATE POLICY "degree_levels_select_managers" ON public.degree_levels
  FOR SELECT TO authenticated
  USING (has_permission('manage_settings'));

-- Only settings managers can create, update, or deactivate degree levels.
CREATE POLICY "degree_levels_all_managers" ON public.degree_levels
  FOR ALL TO authenticated
  USING     (has_permission('manage_settings'))
  WITH CHECK (has_permission('manage_settings'));


-- ------------------------------------------------------------
-- countries
-- Top-level geography entity. Public country pages are built
-- from these rows. Full SEO and data quality metadata included.
-- og_image_id references media_assets (migration 003).
-- ------------------------------------------------------------
CREATE TABLE public.countries (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2                    char(2)     NOT NULL UNIQUE,
  iso3                    char(3)     NOT NULL UNIQUE,
  name                    text        NOT NULL,
  slug                    text        NOT NULL UNIQUE,
  continent               text,
  overview                text,
  content_status          text        NOT NULL DEFAULT 'draft'
    CHECK (content_status IN ('draft', 'in_review', 'published', 'unpublished', 'archived')),
  verification_status     text        NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN (
      'unverified', 'partially_verified', 'verified',
      'source_conflict', 'outdated', 'needs_review'
    )),
  indexing_status         text        NOT NULL DEFAULT 'draft'
    CHECK (indexing_status IN ('index', 'noindex', 'draft')),
  -- Scores are integers 0–100 set by server-side logic.
  data_completeness_score integer     NOT NULL DEFAULT 0
    CHECK (data_completeness_score >= 0 AND data_completeness_score <= 100),
  source_confidence_score integer     NOT NULL DEFAULT 0
    CHECK (source_confidence_score >= 0 AND source_confidence_score <= 100),
  last_verified_at        timestamptz,
  next_review_due_at      timestamptz,
  -- FK to media_assets for the Open Graph image on the country page.
  og_image_id             uuid        REFERENCES public.media_assets(id) ON DELETE SET NULL,
  seo_title               text,
  seo_description         text,
  seo_h1                  text,
  canonical_url           text,
  og_title                text,
  og_description          text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_countries_updated_at
  BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_countries_content_status ON public.countries (content_status);
CREATE INDEX idx_countries_og_image_id    ON public.countries (og_image_id);
CREATE INDEX idx_countries_created_at     ON public.countries (created_at);
CREATE INDEX idx_countries_updated_at     ON public.countries (updated_at);
-- Partial index for the dominant public-facing query.
-- Most reads touch only published countries (browse, search, filters).
CREATE INDEX idx_countries_published ON public.countries (id, slug, name)
  WHERE content_status = 'published';

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

-- Public read: published countries only.
-- Applies to both anon and authenticated users.
CREATE POLICY "countries_select_published" ON public.countries
  FOR SELECT
  USING (content_status = 'published');

-- Content editors can read all countries regardless of status.
-- Needed for the admin draft/review workflow.
CREATE POLICY "countries_select_editors" ON public.countries
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create new country records.
-- Setting content_status = 'published' additionally requires publish_content.
-- This is enforced in RLS — not only server-side validation.
CREATE POLICY "countries_insert_editors" ON public.countries
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Content editors can update countries.
-- Setting content_status = 'published' additionally requires publish_content.
-- USING allows any editor to target an existing row (including published ones).
-- WITH CHECK prevents the new row state from being 'published' without the permission.
CREATE POLICY "countries_update_editors" ON public.countries
  FOR UPDATE TO authenticated
  USING (has_permission('edit_content'))
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Only super_admin can permanently delete a country record.
-- Normal retirement should use content_status = 'archived'.
CREATE POLICY "countries_delete_super_admin" ON public.countries
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ------------------------------------------------------------
-- cities
-- Linked to countries. Used by universities, campuses, programs,
-- and student profiles. Slug is unique within a country
-- (composite unique constraint), not globally.
-- ------------------------------------------------------------
CREATE TABLE public.cities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  slug           text        NOT NULL,
  country_id     uuid        NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  content_status text        NOT NULL DEFAULT 'draft'
    CHECK (content_status IN ('draft', 'in_review', 'published', 'unpublished', 'archived')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Slug is unique within a country, not globally.
  -- City URL pattern: /[country-slug]/cities/[city-slug]
  UNIQUE (slug, country_id)
);

CREATE TRIGGER set_cities_updated_at
  BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK index on country_id (not covered by UNIQUE constraint above)
CREATE INDEX idx_cities_country_id     ON public.cities (country_id);
CREATE INDEX idx_cities_content_status ON public.cities (content_status);
CREATE INDEX idx_cities_created_at     ON public.cities (created_at);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Public read: published cities only.
CREATE POLICY "cities_select_published" ON public.cities
  FOR SELECT
  USING (content_status = 'published');

-- Content editors can read all cities.
CREATE POLICY "cities_select_editors" ON public.cities
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create and update city records.
-- Setting content_status = 'published' additionally requires publish_content.
CREATE POLICY "cities_insert_editors" ON public.cities
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

CREATE POLICY "cities_update_editors" ON public.cities
  FOR UPDATE TO authenticated
  USING (has_permission('edit_content'))
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Only super_admin can delete a city.
CREATE POLICY "cities_delete_super_admin" ON public.cities
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ------------------------------------------------------------
-- subjects
-- Fields of study / academic disciplines.
-- Supports one level of parent hierarchy (parent_subject_id)
-- for broad categorisation in v1. Deeper trees are deferred.
-- Used by programs, scholarships, articles, and student profiles.
-- ------------------------------------------------------------
CREATE TABLE public.subjects (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  slug              text        NOT NULL UNIQUE,
  -- Self-referencing FK for one level of parent category.
  -- Example: "Machine Learning" → parent "Computer Science"
  parent_subject_id uuid        REFERENCES public.subjects(id) ON DELETE SET NULL,
  display_order     integer     NOT NULL DEFAULT 0,
  content_status    text        NOT NULL DEFAULT 'draft'
    CHECK (content_status IN ('draft', 'in_review', 'published', 'unpublished', 'archived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- slug UNIQUE constraint auto-creates an index.
CREATE INDEX idx_subjects_parent_id      ON public.subjects (parent_subject_id);
CREATE INDEX idx_subjects_content_status ON public.subjects (content_status);
CREATE INDEX idx_subjects_display_order  ON public.subjects (display_order);
CREATE INDEX idx_subjects_created_at     ON public.subjects (created_at);
-- Partial index for public subject browsing queries.
CREATE INDEX idx_subjects_published ON public.subjects (id, slug, name)
  WHERE content_status = 'published';

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Public read: published subjects only.
CREATE POLICY "subjects_select_published" ON public.subjects
  FOR SELECT
  USING (content_status = 'published');

-- Content editors can read all subjects.
CREATE POLICY "subjects_select_editors" ON public.subjects
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create and update subjects.
-- Setting content_status = 'published' additionally requires publish_content.
CREATE POLICY "subjects_insert_editors" ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

CREATE POLICY "subjects_update_editors" ON public.subjects
  FOR UPDATE TO authenticated
  USING (has_permission('edit_content'))
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Only super_admin can delete a subject.
-- Subjects are widely referenced — deletion is a high-risk action.
CREATE POLICY "subjects_delete_super_admin" ON public.subjects
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));
