-- ============================================================
-- Migration 006: Programs, Program Subjects, Program Intakes
-- ============================================================
-- Tables: programs, program_subjects, program_intakes
--
-- Depends on:
--   002_auth_roles    — has_role(), has_permission(), user_profiles
--   003_media         — media_assets (for og_image_id)
--   004_lookup_tables — countries, cities, degree_levels, subjects
--   005_universities_campuses — universities, campuses
--
-- programs is the core searchable entity on DegreeWiki.
-- program_subjects links programs to their fields of study;
-- program_intakes stores application windows and deadlines.
--
-- RLS pattern:
--   Public SELECT when content_status = 'published' (programs),
--   or when the parent program is published (child tables).
--   Editors (edit_content) can read all rows regardless of status.
--   INSERT/UPDATE require edit_content + publish guard where applicable.
--   DELETE on programs is super_admin only (high-risk: cascades to children).
--   DELETE on program_subjects and program_intakes requires edit_content.
--
-- No seed data is inserted here.
-- Do not add program_modules, scholarships, or AI tables here.
-- ============================================================


-- ============================================================
-- TABLE: programs
-- ============================================================
-- Core public-facing entity. Every program belongs to one university
-- and one degree level. Geography (country, city) is denormalised
-- from the university for efficient filtering without joins.
-- campus_id is optional — many universities have a single unnamed campus.
-- primary_subject_id is the dominant field of study; a full list
-- of subjects is stored in program_subjects (many-to-many).
-- SEO and data quality metadata mirrors the universities pattern.
-- ------------------------------------------------------------
CREATE TABLE public.programs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text        NOT NULL UNIQUE,
  title                   text        NOT NULL,

  -- University / campus
  university_id           uuid        NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
  campus_id               uuid        REFERENCES public.campuses(id)              ON DELETE SET NULL,

  -- Geography (denormalised for search filtering without multi-join)
  country_id              uuid        NOT NULL REFERENCES public.countries(id)    ON DELETE RESTRICT,
  city_id                 uuid        REFERENCES public.cities(id)               ON DELETE SET NULL,

  -- Academic classification
  degree_level_id         uuid        NOT NULL REFERENCES public.degree_levels(id) ON DELETE RESTRICT,
  degree_award            text,
  primary_subject_id      uuid        REFERENCES public.subjects(id)             ON DELETE SET NULL,

  -- Program structure
  duration_months         integer,
  study_mode              text
    CHECK (study_mode IN ('full_time', 'part_time', 'online', 'hybrid')),
  delivery_mode           text
    CHECK (delivery_mode IN ('on_campus', 'online', 'hybrid', 'distance')),
  language_of_instruction text,

  -- Tuition
  tuition_min_amount      numeric,
  tuition_max_amount      numeric,
  tuition_currency        text,
  tuition_period          text
    CHECK (tuition_period IN ('per_year', 'per_semester', 'total', 'per_credit')),
  tuition_notes           text,

  -- Application fees
  application_fee_amount   numeric,
  application_fee_currency text,
  application_fee_notes    text,

  -- URLs
  application_url         text,
  official_url            text,

  -- Admissions / requirements
  admission_requirements  text,
  -- Flexible JSONB store for structured English test requirements.
  -- Example: {"ielts": {"min_overall": 6.5}, "toefl": {"min_overall": 90}}
  english_requirements    jsonb,
  gpa_requirements        text,

  -- Curriculum / outcomes
  curriculum_summary      text,
  career_outcomes         text,

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

CREATE TRIGGER set_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- slug UNIQUE constraint auto-creates an index — no additional slug index needed.

-- Single-column FK and filter indexes
CREATE INDEX idx_programs_university_id           ON public.programs (university_id);
CREATE INDEX idx_programs_campus_id               ON public.programs (campus_id);
CREATE INDEX idx_programs_country_id              ON public.programs (country_id);
CREATE INDEX idx_programs_city_id                 ON public.programs (city_id);
CREATE INDEX idx_programs_degree_level_id         ON public.programs (degree_level_id);
CREATE INDEX idx_programs_primary_subject_id      ON public.programs (primary_subject_id);
CREATE INDEX idx_programs_og_image_id             ON public.programs (og_image_id);
CREATE INDEX idx_programs_content_status          ON public.programs (content_status);
CREATE INDEX idx_programs_language_of_instruction ON public.programs (language_of_instruction);
CREATE INDEX idx_programs_study_mode              ON public.programs (study_mode);
CREATE INDEX idx_programs_created_at              ON public.programs (created_at);
CREATE INDEX idx_programs_updated_at              ON public.programs (updated_at);

-- Partial index for the dominant public query (listing and detail pages).
-- Only published programs are returned to public visitors; this index
-- keeps those reads fast without scanning draft/archived rows.
CREATE INDEX idx_programs_published ON public.programs (id, slug, title)
  WHERE content_status = 'published';

-- Composite indexes for the most common multi-column filter combinations.
-- search / browse patterns: filter by geography + status, level + status, etc.
CREATE INDEX idx_programs_country_status       ON public.programs (country_id, content_status);
CREATE INDEX idx_programs_degree_level_status  ON public.programs (degree_level_id, content_status);
CREATE INDEX idx_programs_university_status    ON public.programs (university_id, content_status);
CREATE INDEX idx_programs_language_status      ON public.programs (language_of_instruction, content_status);
CREATE INDEX idx_programs_study_mode_status    ON public.programs (study_mode, content_status);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Public read: published programs only.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "programs_select_published" ON public.programs
  FOR SELECT
  USING (content_status = 'published');

-- Content editors can read all programs regardless of status.
-- Needed for the admin draft/review/import workflow.
CREATE POLICY "programs_select_editors" ON public.programs
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create program records.
-- Setting content_status = 'published' additionally requires publish_content.
-- This is enforced in RLS — not only in server-side validation.
CREATE POLICY "programs_insert_editors" ON public.programs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Content editors can update programs.
-- USING: any editor can target an existing row (including published ones).
-- WITH CHECK: the resulting row must not be 'published' without publish_content.
CREATE POLICY "programs_update_editors" ON public.programs
  FOR UPDATE TO authenticated
  USING (has_permission('edit_content'))
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Only super_admin can permanently delete a program.
-- Programs cascade to program_subjects and program_intakes on delete.
-- Normal retirement should use content_status = 'archived'.
CREATE POLICY "programs_delete_super_admin" ON public.programs
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ============================================================
-- TABLE: program_subjects
-- ============================================================
-- Junction table linking programs to their fields of study.
-- A program may cover multiple subjects; one is marked is_primary.
-- primary_subject_id on programs is a convenience FK that mirrors
-- the is_primary = true row here. Both must be kept in sync by
-- server-side logic (there is no DB-level constraint enforcing it).
--
-- ON DELETE behaviour:
--   program_id  CASCADE  — removing a program removes its subject links.
--   subject_id  RESTRICT — a subject cannot be deleted while programs reference it.
-- ------------------------------------------------------------
CREATE TABLE public.program_subjects (
  program_id    uuid        NOT NULL REFERENCES public.programs(id)  ON DELETE CASCADE,
  subject_id    uuid        NOT NULL REFERENCES public.subjects(id)  ON DELETE RESTRICT,
  is_primary    boolean     NOT NULL DEFAULT false,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id, subject_id)
);

-- PK covers (program_id, subject_id) with program_id as the leading column,
-- which serves FK lookups on program_id. Index subject_id for reverse lookups.
CREATE INDEX idx_program_subjects_subject_id    ON public.program_subjects (subject_id);
CREATE INDEX idx_program_subjects_display_order ON public.program_subjects (display_order);

ALTER TABLE public.program_subjects ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent program is published.
-- program_subjects has no independent content_status; visibility
-- is inherited from the parent program, matching the campuses pattern.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "program_subjects_select_published_parent" ON public.program_subjects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.programs p
      WHERE  p.id             = program_subjects.program_id
      AND    p.content_status = 'published'
    )
  );

-- Content editors can read all program_subjects regardless of parent status.
CREATE POLICY "program_subjects_select_editors" ON public.program_subjects
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create, update, and delete program-subject links.
-- No publish guard: program_subjects has no content_status.
-- Publishing control is enforced on the parent programs row.
CREATE POLICY "program_subjects_insert_editors" ON public.program_subjects
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "program_subjects_update_editors" ON public.program_subjects
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "program_subjects_delete_editors" ON public.program_subjects
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: program_intakes
-- ============================================================
-- Stores application windows and deadline information for a program.
-- A program may have multiple intakes per year (e.g. September, January).
-- deadline_status is a cached/computed field maintained by server-side logic
-- or a scheduled job — it is not computed by a DB trigger.
-- is_rolling = true means there is no fixed deadline; deadline_status
-- should be set to 'rolling' for these rows.
-- ------------------------------------------------------------
CREATE TABLE public.program_intakes (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id               uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  intake_name              text,
  intake_month             integer
    CHECK (intake_month >= 1 AND intake_month <= 12),
  intake_year              integer,
  application_open_date    date,
  application_deadline_date date,
  deadline_text            text,
  deadline_status          text
    CHECK (deadline_status IN ('open', 'closing_soon', 'closed', 'rolling')),
  is_rolling               boolean     NOT NULL DEFAULT false,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_program_intakes_updated_at
  BEFORE UPDATE ON public.program_intakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_program_intakes_program_id        ON public.program_intakes (program_id);
CREATE INDEX idx_program_intakes_deadline_date     ON public.program_intakes (application_deadline_date);
CREATE INDEX idx_program_intakes_deadline_status   ON public.program_intakes (deadline_status);
CREATE INDEX idx_program_intakes_created_at        ON public.program_intakes (created_at);
CREATE INDEX idx_program_intakes_updated_at        ON public.program_intakes (updated_at);
-- Composite index for the most common intake query: deadlines for a given program.
CREATE INDEX idx_program_intakes_program_deadline  ON public.program_intakes (program_id, application_deadline_date);

ALTER TABLE public.program_intakes ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent program is published.
-- Intake data (deadlines, fees) is part of the program's public page;
-- it must not be visible for draft or archived programs.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "program_intakes_select_published_parent" ON public.program_intakes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.programs p
      WHERE  p.id             = program_intakes.program_id
      AND    p.content_status = 'published'
    )
  );

-- Content editors can read all intakes regardless of parent status.
CREATE POLICY "program_intakes_select_editors" ON public.program_intakes
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create, update, and delete intake records.
-- No publish guard: program_intakes has no content_status.
-- Publishing control is enforced on the parent programs row.
CREATE POLICY "program_intakes_insert_editors" ON public.program_intakes
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "program_intakes_update_editors" ON public.program_intakes
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "program_intakes_delete_editors" ON public.program_intakes
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));
