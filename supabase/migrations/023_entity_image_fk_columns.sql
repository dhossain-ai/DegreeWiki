-- ============================================================
-- Migration 023: Entity Image FK Columns
-- ============================================================
-- Adds missing direct image FK columns to countries, cities,
-- subjects, and scholarships. These reference media_assets and
-- use ON DELETE SET NULL, consistent with migrations 004/005/007/008.
--
-- Already-existing image FK columns (not touched here):
--   countries.og_image_id          — 004_lookup_tables.sql
--   universities.logo_id           — 005_universities_campuses.sql
--   universities.cover_image_id    — 005_universities_campuses.sql
--   universities.og_image_id       — 005_universities_campuses.sql
--   scholarships.og_image_id       — 007_scholarships.sql
--   articles.featured_image_id     — 008_articles_seo.sql
--   articles.og_image_id           — 008_articles_seo.sql
--
-- All statements are ADDITIVE and IDEMPOTENT (IF NOT EXISTS).
-- No tables, policies, or existing columns are modified.
-- No RLS changes.
-- ============================================================


-- ------------------------------------------------------------
-- countries: add cover_image_id
-- ------------------------------------------------------------
ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS cover_image_id uuid
    REFERENCES public.media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_countries_cover_image_id
  ON public.countries (cover_image_id);


-- ------------------------------------------------------------
-- cities: add cover_image_id and og_image_id
-- ------------------------------------------------------------
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS cover_image_id uuid
    REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS og_image_id uuid
    REFERENCES public.media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cities_cover_image_id
  ON public.cities (cover_image_id);

CREATE INDEX IF NOT EXISTS idx_cities_og_image_id
  ON public.cities (og_image_id);


-- ------------------------------------------------------------
-- subjects: add cover_image_id and og_image_id
-- ------------------------------------------------------------
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS cover_image_id uuid
    REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS og_image_id uuid
    REFERENCES public.media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_cover_image_id
  ON public.subjects (cover_image_id);

CREATE INDEX IF NOT EXISTS idx_subjects_og_image_id
  ON public.subjects (og_image_id);


-- ------------------------------------------------------------
-- scholarships: add logo_id and cover_image_id
-- ------------------------------------------------------------
ALTER TABLE public.scholarships
  ADD COLUMN IF NOT EXISTS logo_id uuid
    REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cover_image_id uuid
    REFERENCES public.media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scholarships_logo_id
  ON public.scholarships (logo_id);

CREATE INDEX IF NOT EXISTS idx_scholarships_cover_image_id
  ON public.scholarships (cover_image_id);
