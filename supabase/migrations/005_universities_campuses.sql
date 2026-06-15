-- ============================================================
-- Migration 005: Universities and Campuses
-- ============================================================
-- Tables: universities, campuses
--
-- Depends on:
--   002_auth_roles   — has_role(), has_permission(), user_profiles
--   003_media        — media_assets (for logo_id, cover_image_id, og_image_id)
--   004_lookup_tables — countries, cities
--
-- campuses has no content_status. Its public visibility is
-- determined entirely by its parent university's content_status.
-- No seed data is inserted here. Universities and campuses are
-- loaded through the import/staging workflow (migration 010).
-- ============================================================


-- ------------------------------------------------------------
-- universities
-- Core institution entity. Every program belongs to a university.
-- Three separate media FK columns cover distinct image roles:
--   logo_id        — institution logo (used in listings, headers)
--   cover_image_id — hero/banner image for the university page
--   og_image_id    — Open Graph image for social sharing
-- All three reference media_assets and are optional.
-- ------------------------------------------------------------
CREATE TABLE public.universities (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL,
  slug                    text        NOT NULL UNIQUE,
  country_id              uuid        NOT NULL REFERENCES public.countries(id)     ON DELETE RESTRICT,
  city_id                 uuid        REFERENCES public.cities(id)                ON DELETE SET NULL,
  official_url            text,
  founded_year            integer,
  student_count           integer,
  ranking_summary         text,
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
  -- Scores are integers 0–100, set by server-side logic (not triggers).
  data_completeness_score integer     NOT NULL DEFAULT 0
    CHECK (data_completeness_score >= 0 AND data_completeness_score <= 100),
  source_confidence_score integer     NOT NULL DEFAULT 0
    CHECK (source_confidence_score >= 0 AND source_confidence_score <= 100),
  last_verified_at        timestamptz,
  next_review_due_at      timestamptz,
  logo_id                 uuid        REFERENCES public.media_assets(id) ON DELETE SET NULL,
  cover_image_id          uuid        REFERENCES public.media_assets(id) ON DELETE SET NULL,
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

CREATE TRIGGER set_universities_updated_at
  BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- slug UNIQUE constraint auto-creates an index.
CREATE INDEX idx_universities_country_id      ON public.universities (country_id);
CREATE INDEX idx_universities_city_id         ON public.universities (city_id);
CREATE INDEX idx_universities_logo_id         ON public.universities (logo_id);
CREATE INDEX idx_universities_cover_image_id  ON public.universities (cover_image_id);
CREATE INDEX idx_universities_og_image_id     ON public.universities (og_image_id);
CREATE INDEX idx_universities_content_status  ON public.universities (content_status);
CREATE INDEX idx_universities_created_at      ON public.universities (created_at);
CREATE INDEX idx_universities_updated_at      ON public.universities (updated_at);
-- Partial index for the dominant public query pattern.
-- Most reads on universities filter by content_status = 'published'.
CREATE INDEX idx_universities_published ON public.universities (id, slug, name)
  WHERE content_status = 'published';

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- Public read: published universities only.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "universities_select_published" ON public.universities
  FOR SELECT
  USING (content_status = 'published');

-- Content editors can read all universities regardless of status.
-- Needed for the admin draft/review/import workflow.
CREATE POLICY "universities_select_editors" ON public.universities
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create university records.
-- Setting content_status = 'published' additionally requires publish_content.
-- This is enforced in RLS — not only server-side validation.
CREATE POLICY "universities_insert_editors" ON public.universities
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Content editors can update universities.
-- USING: any editor can target an existing row (including published ones).
-- WITH CHECK: the resulting row must not be 'published' without publish_content.
CREATE POLICY "universities_update_editors" ON public.universities
  FOR UPDATE TO authenticated
  USING (has_permission('edit_content'))
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Only super_admin can permanently delete a university record.
-- Normal retirement should use content_status = 'archived'.
-- Deletion is high-risk: universities are referenced by programs (migration 006+).
CREATE POLICY "universities_delete_super_admin" ON public.universities
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ------------------------------------------------------------
-- campuses
-- Physical or virtual locations belonging to a university.
-- A university may have one or many campuses.
--
-- No content_status on campuses. Their public visibility follows
-- the parent university: if the university is published, its
-- campuses are publicly readable; otherwise they are not.
--
-- Slug is unique per university (composite unique constraint),
-- not globally. Campus URL pattern:
--   /universities/[university-slug]/campuses/[campus-slug]
-- ------------------------------------------------------------
CREATE TABLE public.campuses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid        NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
  name          text        NOT NULL,
  slug          text        NOT NULL,
  country_id    uuid        NOT NULL REFERENCES public.countries(id)    ON DELETE RESTRICT,
  city_id       uuid        REFERENCES public.cities(id)               ON DELETE SET NULL,
  is_main_campus boolean    NOT NULL DEFAULT false,
  address       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Slug must be unique within a university, not globally.
  UNIQUE (university_id, slug)
);

CREATE TRIGGER set_campuses_updated_at
  BEFORE UPDATE ON public.campuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The UNIQUE (university_id, slug) constraint creates a composite index
-- with university_id as the leading column, which covers FK lookups and
-- queries filtering by university_id alone. An explicit index is added
-- for clarity and to make the FK relationship self-documenting.
CREATE INDEX idx_campuses_university_id ON public.campuses (university_id);
CREATE INDEX idx_campuses_country_id    ON public.campuses (country_id);
CREATE INDEX idx_campuses_city_id       ON public.campuses (city_id);
CREATE INDEX idx_campuses_created_at    ON public.campuses (created_at);
CREATE INDEX idx_campuses_updated_at    ON public.campuses (updated_at);

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent university is published.
-- Campuses inherit visibility from their university — there is
-- no independent content_status to check on this table.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "campuses_select_published_parent" ON public.campuses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.universities u
      WHERE  u.id             = campuses.university_id
      AND    u.content_status = 'published'
    )
  );

-- Content editors can read all campuses regardless of parent status.
CREATE POLICY "campuses_select_editors" ON public.campuses
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create campus records.
-- No publish guard needed: campuses have no content_status.
CREATE POLICY "campuses_insert_editors" ON public.campuses
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

-- Content editors can update campus records.
CREATE POLICY "campuses_update_editors" ON public.campuses
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

-- Only super_admin can permanently delete a campus.
-- Campus deletion is high-risk once programs reference it (migration 006+).
CREATE POLICY "campuses_delete_super_admin" ON public.campuses
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));
