-- ============================================================
-- Migration 007: Scholarships and Junction Tables
-- ============================================================
-- Tables: scholarships, scholarship_countries,
--         scholarship_universities, scholarship_programs,
--         scholarship_subjects, scholarship_degree_levels,
--         scholarship_eligible_nationalities
--
-- Depends on:
--   002_auth_roles        — has_role(), has_permission()
--   003_media             — media_assets (for og_image_id)
--   004_lookup_tables     — countries, degree_levels, subjects
--   005_universities_campuses — universities
--   006_programs          — programs
--
-- scholarships is a first-class public entity — not a text field
-- inside programs. A scholarship can relate to countries, universities,
-- programs, subjects, and degree levels through junction tables.
-- scholarship_eligible_nationalities records which nationalities
-- are eligible, ineligible, or preferred for each scholarship.
--
-- RLS pattern:
--   Public SELECT when content_status = 'published' (scholarships).
--   Junction tables inherit public visibility from the parent
--   scholarship via an EXISTS subquery — none have their own
--   content_status.
--   Editors (edit_content) can read all rows regardless of status.
--   INSERT/UPDATE require edit_content + publish guard on scholarships.
--   DELETE on scholarships is super_admin only.
--   DELETE on all junction tables requires edit_content.
--
-- No seed data is inserted here.
-- Do not add ai_finder_scholarship_matches here.
-- ============================================================


-- ============================================================
-- TABLE: scholarships
-- ============================================================
-- Core scholarship entity. Scholarships are stand-alone records
-- that can be linked to countries, universities, programs, subjects,
-- and degree levels through the junction tables below.
-- SEO and data quality metadata follows the universities/programs pattern.
-- ------------------------------------------------------------
CREATE TABLE public.scholarships (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text        NOT NULL UNIQUE,
  name                    text        NOT NULL,

  -- Classification
  scholarship_type        text
    CHECK (scholarship_type IN ('full', 'partial', 'merit', 'need_based', 'government', 'institutional', 'other')),
  provider_name           text,
  provider_type           text
    CHECK (provider_type IN ('government', 'university', 'private_foundation', 'corporate', 'ngo', 'other')),
  funding_type            text
    CHECK (funding_type IN ('full_tuition', 'partial_tuition', 'living_stipend', 'travel', 'research', 'full_funding', 'other')),
  application_type        text
    CHECK (application_type IN ('direct', 'university_portal', 'nomination', 'embassy', 'other')),

  -- Content
  overview                text,
  eligibility_summary     text,

  -- Amount
  amount_min              numeric,
  amount_max              numeric,
  currency                text,
  coverage_notes          text,

  -- Deadline
  deadline                date,
  deadline_text           text,

  -- URLs
  official_url            text,
  application_url         text,
  provider_url            text,

  -- Content lifecycle
  content_status          text        NOT NULL DEFAULT 'draft'
    CHECK (content_status IN ('draft', 'in_review', 'published', 'unpublished', 'archived')),
  verification_status     text        NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN (
      'unverified', 'partially_verified', 'verified',
      'source_conflict', 'outdated', 'needs_review'
    )),
  indexing_status         text        NOT NULL DEFAULT 'draft'
    CHECK (indexing_status IN ('index', 'noindex', 'draft')),

  -- Data quality scores (0–100, set by server-side logic, not triggers)
  data_completeness_score integer     NOT NULL DEFAULT 0
    CHECK (data_completeness_score >= 0 AND data_completeness_score <= 100),
  source_confidence_score integer     NOT NULL DEFAULT 0
    CHECK (source_confidence_score >= 0 AND source_confidence_score <= 100),

  last_verified_at        timestamptz,
  next_review_due_at      timestamptz,

  -- SEO / Open Graph
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

CREATE TRIGGER set_scholarships_updated_at
  BEFORE UPDATE ON public.scholarships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- slug UNIQUE constraint auto-creates an index — no additional slug index needed.
CREATE INDEX idx_scholarships_og_image_id    ON public.scholarships (og_image_id);
CREATE INDEX idx_scholarships_content_status ON public.scholarships (content_status);
CREATE INDEX idx_scholarships_deadline       ON public.scholarships (deadline);
CREATE INDEX idx_scholarships_created_at     ON public.scholarships (created_at);
CREATE INDEX idx_scholarships_updated_at     ON public.scholarships (updated_at);

-- Partial index for public listing and detail page queries.
-- Only published scholarships are returned to public visitors.
CREATE INDEX idx_scholarships_published ON public.scholarships (id, slug, name)
  WHERE content_status = 'published';

-- Composite index for deadline-filtered public browse queries.
CREATE INDEX idx_scholarships_deadline_status ON public.scholarships (deadline, content_status);

ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;

-- Public read: published scholarships only.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "scholarships_select_published" ON public.scholarships
  FOR SELECT
  USING (content_status = 'published');

-- Content editors can read all scholarships regardless of status.
-- Needed for the admin draft/review/import workflow.
CREATE POLICY "scholarships_select_editors" ON public.scholarships
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create scholarship records.
-- Setting content_status = 'published' additionally requires publish_content.
-- This is enforced in RLS — not only in server-side validation.
CREATE POLICY "scholarships_insert_editors" ON public.scholarships
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Content editors can update scholarships.
-- USING: any editor can target an existing row (including published ones).
-- WITH CHECK: the resulting row must not be 'published' without publish_content.
CREATE POLICY "scholarships_update_editors" ON public.scholarships
  FOR UPDATE TO authenticated
  USING (has_permission('edit_content'))
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Only super_admin can permanently delete a scholarship.
-- Normal retirement should use content_status = 'archived'.
-- Deletion is high-risk: it cascades to all six junction tables below.
CREATE POLICY "scholarships_delete_super_admin" ON public.scholarships
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ============================================================
-- TABLE: scholarship_countries
-- ============================================================
-- Links a scholarship to the countries it is available in.
-- A scholarship with no country rows is considered global / unrestricted.
-- ON DELETE behaviour:
--   scholarship_id CASCADE  — removing a scholarship removes its country links.
--   country_id     RESTRICT — a country cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.scholarship_countries (
  scholarship_id uuid        NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  country_id     uuid        NOT NULL REFERENCES public.countries(id)    ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scholarship_id, country_id)
);

-- PK covers (scholarship_id, country_id) with scholarship_id as leading column.
-- Index country_id for reverse lookups: all scholarships available in a country.
CREATE INDEX idx_scholarship_countries_country_id ON public.scholarship_countries (country_id);

ALTER TABLE public.scholarship_countries ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent scholarship is published.
-- Junction tables have no independent content_status; visibility
-- is inherited from the parent scholarship row.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "scholarship_countries_select_published_parent" ON public.scholarship_countries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.scholarships s
      WHERE  s.id             = scholarship_countries.scholarship_id
      AND    s.content_status = 'published'
    )
  );

-- Content editors can read all scholarship_countries regardless of parent status.
CREATE POLICY "scholarship_countries_select_editors" ON public.scholarship_countries
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create, update, and delete scholarship-country links.
-- No publish guard: this table has no content_status.
CREATE POLICY "scholarship_countries_insert_editors" ON public.scholarship_countries
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_countries_update_editors" ON public.scholarship_countries
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_countries_delete_editors" ON public.scholarship_countries
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: scholarship_universities
-- ============================================================
-- Links a scholarship to specific universities it is offered through
-- or administered by. A scholarship with no university rows may be
-- applied to independently of any particular institution.
-- ON DELETE behaviour:
--   scholarship_id CASCADE  — removing a scholarship removes its university links.
--   university_id  RESTRICT — a university cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.scholarship_universities (
  scholarship_id uuid        NOT NULL REFERENCES public.scholarships(id)  ON DELETE CASCADE,
  university_id  uuid        NOT NULL REFERENCES public.universities(id)  ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scholarship_id, university_id)
);

-- PK covers (scholarship_id, university_id) with scholarship_id as leading column.
-- Index university_id for reverse lookups: all scholarships at a university.
CREATE INDEX idx_scholarship_universities_university_id ON public.scholarship_universities (university_id);

ALTER TABLE public.scholarship_universities ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent scholarship is published.
CREATE POLICY "scholarship_universities_select_published_parent" ON public.scholarship_universities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.scholarships s
      WHERE  s.id             = scholarship_universities.scholarship_id
      AND    s.content_status = 'published'
    )
  );

-- Content editors can read all scholarship_universities regardless of parent status.
CREATE POLICY "scholarship_universities_select_editors" ON public.scholarship_universities
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

CREATE POLICY "scholarship_universities_insert_editors" ON public.scholarship_universities
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_universities_update_editors" ON public.scholarship_universities
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_universities_delete_editors" ON public.scholarship_universities
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: scholarship_programs
-- ============================================================
-- Links a scholarship to specific programs it can be applied to.
-- A scholarship with no program rows is not restricted to specific programs.
-- ON DELETE behaviour:
--   scholarship_id CASCADE  — removing a scholarship removes its program links.
--   program_id     RESTRICT — a program cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.scholarship_programs (
  scholarship_id uuid        NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  program_id     uuid        NOT NULL REFERENCES public.programs(id)     ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scholarship_id, program_id)
);

-- PK covers (scholarship_id, program_id) with scholarship_id as leading column.
-- Index program_id for reverse lookups: all scholarships for a program.
CREATE INDEX idx_scholarship_programs_program_id ON public.scholarship_programs (program_id);

ALTER TABLE public.scholarship_programs ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent scholarship is published.
CREATE POLICY "scholarship_programs_select_published_parent" ON public.scholarship_programs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.scholarships s
      WHERE  s.id             = scholarship_programs.scholarship_id
      AND    s.content_status = 'published'
    )
  );

-- Content editors can read all scholarship_programs regardless of parent status.
CREATE POLICY "scholarship_programs_select_editors" ON public.scholarship_programs
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

CREATE POLICY "scholarship_programs_insert_editors" ON public.scholarship_programs
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_programs_update_editors" ON public.scholarship_programs
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_programs_delete_editors" ON public.scholarship_programs
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: scholarship_subjects
-- ============================================================
-- Links a scholarship to the fields of study it targets.
-- A scholarship with no subject rows is not field-restricted.
-- ON DELETE behaviour:
--   scholarship_id CASCADE  — removing a scholarship removes its subject links.
--   subject_id     RESTRICT — a subject cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.scholarship_subjects (
  scholarship_id uuid        NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  subject_id     uuid        NOT NULL REFERENCES public.subjects(id)     ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scholarship_id, subject_id)
);

-- PK covers (scholarship_id, subject_id) with scholarship_id as leading column.
-- Index subject_id for reverse lookups: all scholarships in a field of study.
CREATE INDEX idx_scholarship_subjects_subject_id ON public.scholarship_subjects (subject_id);

ALTER TABLE public.scholarship_subjects ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent scholarship is published.
CREATE POLICY "scholarship_subjects_select_published_parent" ON public.scholarship_subjects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.scholarships s
      WHERE  s.id             = scholarship_subjects.scholarship_id
      AND    s.content_status = 'published'
    )
  );

-- Content editors can read all scholarship_subjects regardless of parent status.
CREATE POLICY "scholarship_subjects_select_editors" ON public.scholarship_subjects
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

CREATE POLICY "scholarship_subjects_insert_editors" ON public.scholarship_subjects
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_subjects_update_editors" ON public.scholarship_subjects
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_subjects_delete_editors" ON public.scholarship_subjects
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: scholarship_degree_levels
-- ============================================================
-- Links a scholarship to the academic qualification levels it targets.
-- A scholarship with no degree level rows is not level-restricted.
-- ON DELETE behaviour:
--   scholarship_id  CASCADE  — removing a scholarship removes its degree level links.
--   degree_level_id RESTRICT — a degree level cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.scholarship_degree_levels (
  scholarship_id  uuid        NOT NULL REFERENCES public.scholarships(id)  ON DELETE CASCADE,
  degree_level_id uuid        NOT NULL REFERENCES public.degree_levels(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scholarship_id, degree_level_id)
);

-- PK covers (scholarship_id, degree_level_id) with scholarship_id as leading column.
-- Index degree_level_id for reverse lookups: all scholarships for a degree level.
CREATE INDEX idx_scholarship_degree_levels_degree_level_id ON public.scholarship_degree_levels (degree_level_id);

ALTER TABLE public.scholarship_degree_levels ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent scholarship is published.
CREATE POLICY "scholarship_degree_levels_select_published_parent" ON public.scholarship_degree_levels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.scholarships s
      WHERE  s.id             = scholarship_degree_levels.scholarship_id
      AND    s.content_status = 'published'
    )
  );

-- Content editors can read all scholarship_degree_levels regardless of parent status.
CREATE POLICY "scholarship_degree_levels_select_editors" ON public.scholarship_degree_levels
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

CREATE POLICY "scholarship_degree_levels_insert_editors" ON public.scholarship_degree_levels
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_degree_levels_update_editors" ON public.scholarship_degree_levels
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_degree_levels_delete_editors" ON public.scholarship_degree_levels
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: scholarship_eligible_nationalities
-- ============================================================
-- Records which nationalities are eligible, ineligible, or preferred
-- for a scholarship. A scholarship with no rows here is assumed to
-- be open to all nationalities (or eligibility is undocumented).
--
-- eligibility_type values:
--   eligible   — this nationality can apply
--   ineligible — this nationality is explicitly excluded
--   preferred  — this nationality is actively encouraged / prioritised
--
-- The unique constraint on (scholarship_id, country_id, eligibility_type)
-- prevents duplicate eligibility records for the same scholarship-country
-- pair under the same type. Different types for the same pair are blocked
-- by business logic at the server layer, not at the DB level, because
-- some scholarships use 'preferred' alongside 'eligible' for the same
-- nationality to signal priority without excluding others.
--
-- ON DELETE behaviour:
--   scholarship_id CASCADE  — removing a scholarship removes its nationality rules.
--   country_id     RESTRICT — a country cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.scholarship_eligible_nationalities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id  uuid        NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  country_id      uuid        NOT NULL REFERENCES public.countries(id)    ON DELETE RESTRICT,
  eligibility_type text       NOT NULL DEFAULT 'eligible'
    CHECK (eligibility_type IN ('eligible', 'ineligible', 'preferred')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Prevents duplicate rows for the same scholarship + country + eligibility_type.
  UNIQUE (scholarship_id, country_id, eligibility_type)
);

-- scholarship_id is the most common filter (fetch all nationality rules for a scholarship).
-- country_id supports reverse lookup: all scholarships open to a given nationality.
-- eligibility_type supports filtering by type (e.g. show only 'ineligible' exclusions).
CREATE INDEX idx_scholarship_nationalities_scholarship_id   ON public.scholarship_eligible_nationalities (scholarship_id);
CREATE INDEX idx_scholarship_nationalities_country_id       ON public.scholarship_eligible_nationalities (country_id);
CREATE INDEX idx_scholarship_nationalities_eligibility_type ON public.scholarship_eligible_nationalities (eligibility_type);

ALTER TABLE public.scholarship_eligible_nationalities ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent scholarship is published.
-- Nationality eligibility rules are part of a scholarship's public detail page;
-- they must not be visible for draft or archived scholarships.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "scholarship_nationalities_select_published_parent" ON public.scholarship_eligible_nationalities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.scholarships s
      WHERE  s.id             = scholarship_eligible_nationalities.scholarship_id
      AND    s.content_status = 'published'
    )
  );

-- Content editors can read all nationality rules regardless of parent status.
CREATE POLICY "scholarship_nationalities_select_editors" ON public.scholarship_eligible_nationalities
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

CREATE POLICY "scholarship_nationalities_insert_editors" ON public.scholarship_eligible_nationalities
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_nationalities_update_editors" ON public.scholarship_eligible_nationalities
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "scholarship_nationalities_delete_editors" ON public.scholarship_eligible_nationalities
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));
