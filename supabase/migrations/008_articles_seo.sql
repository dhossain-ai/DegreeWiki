-- ============================================================
-- Migration 008: Articles, Article Categories, Article Junctions,
--                SEO Page Types, SEO Landing Pages
-- ============================================================
-- Tables:
--   article_categories
--   articles
--   article_countries
--   article_subjects
--   article_degree_levels
--   seo_page_types
--   seo_landing_pages
--
-- Depends on:
--   002_auth_roles        — has_role(), has_permission(), user_profiles
--   003_media             — media_assets (for featured_image_id, og_image_id)
--   004_lookup_tables     — countries, subjects, degree_levels
--   005_universities_campuses — universities (for seo_landing_pages.university_id)
--
-- RLS pattern:
--   article_categories and seo_page_types are configuration/lookup tables.
--     Public SELECT: always (anon and authenticated).
--     INSERT/UPDATE/DELETE: require manage_settings.
--
--   articles is a first-class published content entity.
--     Public SELECT when content_status = 'published'.
--     Editors (edit_content) can read all rows.
--     INSERT/UPDATE require edit_content + publish guard.
--     DELETE: super_admin only.
--
--   Article junction tables (article_countries, article_subjects,
--   article_degree_levels) have no content_status of their own.
--     Public SELECT only when the parent article is published
--     (checked via EXISTS subquery against articles).
--     Editors (edit_content) can read all rows.
--     INSERT/UPDATE/DELETE require edit_content.
--
--   seo_landing_pages is a published content entity with a stricter
--   public visibility rule: content_status = 'published' AND
--   indexing_status = 'index'. Thin or noindex pages are never
--   returned to public visitors even when published.
--     Editors (edit_content) can read all rows.
--     INSERT/UPDATE require edit_content + publish guard.
--     DELETE: super_admin only.
--
-- No seed data is inserted here. article_categories and seo_page_types
-- seed rows belong in migration 015.
-- Do not add article_universities, article_programs, or article_scholarships
-- in this migration.
-- ============================================================


-- ============================================================
-- TABLE: article_categories
-- ============================================================
-- Hierarchical category tree for articles/guides.
-- A category can have a parent (self-referential FK) to support
-- nested categories such as:
--   Study Abroad → Country Guides → UK
-- parent_category_id = NULL means a top-level category.
-- display_order controls the sort order within a parent group.
-- ------------------------------------------------------------
CREATE TABLE public.article_categories (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  slug               text        NOT NULL UNIQUE,
  parent_category_id uuid        REFERENCES public.article_categories(id) ON DELETE SET NULL,
  display_order      integer     NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_article_categories_updated_at
  BEFORE UPDATE ON public.article_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- slug UNIQUE constraint auto-creates an index — no additional slug index needed.
CREATE INDEX idx_article_categories_parent_category_id ON public.article_categories (parent_category_id);
CREATE INDEX idx_article_categories_display_order      ON public.article_categories (display_order);
CREATE INDEX idx_article_categories_created_at         ON public.article_categories (created_at);
CREATE INDEX idx_article_categories_updated_at         ON public.article_categories (updated_at);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

-- Public read: all categories are visible to both anon and authenticated users.
-- Categories are configuration/reference data — no publishing workflow.
CREATE POLICY "article_categories_select_public" ON public.article_categories
  FOR SELECT
  USING (true);

-- Site administrators can create article categories.
-- Category management is a settings-level operation, not content editing.
CREATE POLICY "article_categories_insert_settings" ON public.article_categories
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_settings'));

-- Site administrators can update article categories.
CREATE POLICY "article_categories_update_settings" ON public.article_categories
  FOR UPDATE TO authenticated
  USING     (has_permission('manage_settings'))
  WITH CHECK (has_permission('manage_settings'));

-- Site administrators can delete article categories.
-- Deletion is safe here: ON DELETE SET NULL on parent_category_id prevents
-- orphaning child categories; FK RESTRICT on articles (article_category_id)
-- prevents deleting a category that still has articles attached.
CREATE POLICY "article_categories_delete_settings" ON public.article_categories
  FOR DELETE TO authenticated
  USING (has_permission('manage_settings'));


-- ============================================================
-- TABLE: articles
-- ============================================================
-- Guide/article content entity. Articles are the primary long-form
-- content type on DegreeWiki (study-abroad guides, country guides,
-- subject guides, scholarship guides, etc.).
--
-- Two media FK columns serve distinct image roles:
--   featured_image_id — displayed on the article page itself
--   og_image_id       — Open Graph image for social/search sharing
--
-- verification_status and data quality scores follow the same
-- pattern as universities, programs, and scholarships so that
-- DegreeWiki can surface data confidence signals to readers.
--
-- indexing_status controls the Googlebot crawl directive:
--   index   — allow indexing (only meaningful when published)
--   noindex — suppress indexing (thin or duplicate content)
--   draft   — default; treated as noindex until explicitly set
--
-- published_at is set by server-side logic when content_status
-- transitions to 'published'; it is not updated on re-publish.
-- ------------------------------------------------------------
CREATE TABLE public.articles (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text        NOT NULL UNIQUE,
  title                   text        NOT NULL,
  summary                 text,
  content                 text,

  -- Authorship and categorisation
  author_user_id          uuid        REFERENCES public.user_profiles(id)       ON DELETE SET NULL,
  article_category_id     uuid        REFERENCES public.article_categories(id)  ON DELETE RESTRICT,

  -- Media
  featured_image_id       uuid        REFERENCES public.media_assets(id)        ON DELETE SET NULL,
  og_image_id             uuid        REFERENCES public.media_assets(id)        ON DELETE SET NULL,

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

  -- Data quality scores (0–100, maintained by server-side logic)
  data_completeness_score integer     NOT NULL DEFAULT 0
    CHECK (data_completeness_score >= 0 AND data_completeness_score <= 100),
  source_confidence_score integer     NOT NULL DEFAULT 0
    CHECK (source_confidence_score >= 0 AND source_confidence_score <= 100),

  -- Publication timestamp (set once on first publish; not reset on re-publish)
  published_at            timestamptz,

  -- SEO / Open Graph
  seo_title               text,
  seo_description         text,
  seo_h1                  text,
  canonical_url           text,
  og_title                text,
  og_description          text,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- slug UNIQUE constraint auto-creates an index — no additional slug index needed.
CREATE INDEX idx_articles_author_user_id      ON public.articles (author_user_id);
CREATE INDEX idx_articles_article_category_id ON public.articles (article_category_id);
CREATE INDEX idx_articles_featured_image_id   ON public.articles (featured_image_id);
CREATE INDEX idx_articles_og_image_id         ON public.articles (og_image_id);
CREATE INDEX idx_articles_content_status      ON public.articles (content_status);
CREATE INDEX idx_articles_indexing_status     ON public.articles (indexing_status);
CREATE INDEX idx_articles_published_at        ON public.articles (published_at);
CREATE INDEX idx_articles_created_at          ON public.articles (created_at);
CREATE INDEX idx_articles_updated_at          ON public.articles (updated_at);

-- Partial index for the dominant public query pattern.
-- Only published articles are returned to public visitors.
CREATE INDEX idx_articles_published ON public.articles (id, slug, title)
  WHERE content_status = 'published';

-- GIN full-text foundation index on title + summary.
-- Supports full-text search within the articles table.
-- Concatenates summary with a fallback to '' so that articles
-- with no summary are still indexed on title alone.
CREATE INDEX idx_articles_fts ON public.articles
  USING gin(to_tsvector('english', title || ' ' || coalesce(summary, '')));

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Public read: published articles only.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "articles_select_published" ON public.articles
  FOR SELECT
  USING (content_status = 'published');

-- Content editors can read all articles regardless of status.
-- Needed for the admin draft/review workflow.
CREATE POLICY "articles_select_editors" ON public.articles
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create article records.
-- Setting content_status = 'published' additionally requires publish_content.
-- This is enforced in RLS — not only in server-side validation.
CREATE POLICY "articles_insert_editors" ON public.articles
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Content editors can update articles.
-- USING: any editor can target an existing row (including published ones).
-- WITH CHECK: the resulting row must not be 'published' without publish_content.
CREATE POLICY "articles_update_editors" ON public.articles
  FOR UPDATE TO authenticated
  USING (has_permission('edit_content'))
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Only super_admin can permanently delete an article.
-- Normal retirement should use content_status = 'archived'.
-- Deletion cascades to article_countries, article_subjects, article_degree_levels.
CREATE POLICY "articles_delete_super_admin" ON public.articles
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ============================================================
-- TABLE: article_countries
-- ============================================================
-- Links an article to the countries it covers or is relevant to.
-- Used to filter articles by destination country on country pages
-- and in search.
-- ON DELETE behaviour:
--   article_id CASCADE  — removing an article removes its country links.
--   country_id RESTRICT — a country cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.article_countries (
  article_id  uuid        NOT NULL REFERENCES public.articles(id)  ON DELETE CASCADE,
  country_id  uuid        NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, country_id)
);

-- PK covers (article_id, country_id) with article_id as leading column.
-- Index country_id for reverse lookups: all articles related to a country.
CREATE INDEX idx_article_countries_country_id ON public.article_countries (country_id);

ALTER TABLE public.article_countries ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent article is published.
-- Junction tables have no independent content_status; visibility
-- is inherited from the parent article row.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "article_countries_select_published_parent" ON public.article_countries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.articles a
      WHERE  a.id             = article_countries.article_id
      AND    a.content_status = 'published'
    )
  );

-- Content editors can read all article_countries regardless of parent status.
CREATE POLICY "article_countries_select_editors" ON public.article_countries
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create, update, and delete article-country links.
-- No publish guard: this table has no content_status.
CREATE POLICY "article_countries_insert_editors" ON public.article_countries
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "article_countries_update_editors" ON public.article_countries
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "article_countries_delete_editors" ON public.article_countries
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: article_subjects
-- ============================================================
-- Links an article to the fields of study it covers or is relevant to.
-- Used to surface articles on subject/field-of-study pages and to
-- filter article search results.
-- ON DELETE behaviour:
--   article_id CASCADE  — removing an article removes its subject links.
--   subject_id RESTRICT — a subject cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.article_subjects (
  article_id uuid        NOT NULL REFERENCES public.articles(id)  ON DELETE CASCADE,
  subject_id uuid        NOT NULL REFERENCES public.subjects(id)  ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, subject_id)
);

-- PK covers (article_id, subject_id) with article_id as leading column.
-- Index subject_id for reverse lookups: all articles related to a subject.
CREATE INDEX idx_article_subjects_subject_id ON public.article_subjects (subject_id);

ALTER TABLE public.article_subjects ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent article is published.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "article_subjects_select_published_parent" ON public.article_subjects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.articles a
      WHERE  a.id             = article_subjects.article_id
      AND    a.content_status = 'published'
    )
  );

-- Content editors can read all article_subjects regardless of parent status.
CREATE POLICY "article_subjects_select_editors" ON public.article_subjects
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

CREATE POLICY "article_subjects_insert_editors" ON public.article_subjects
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "article_subjects_update_editors" ON public.article_subjects
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "article_subjects_delete_editors" ON public.article_subjects
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: article_degree_levels
-- ============================================================
-- Links an article to the academic levels it covers or is relevant to.
-- Useful for surfacing articles on degree-level pages and for
-- personalized article recommendations in the AI Finder flow.
-- ON DELETE behaviour:
--   article_id      CASCADE  — removing an article removes its degree level links.
--   degree_level_id RESTRICT — a degree level cannot be deleted while referenced here.
-- ------------------------------------------------------------
CREATE TABLE public.article_degree_levels (
  article_id      uuid        NOT NULL REFERENCES public.articles(id)      ON DELETE CASCADE,
  degree_level_id uuid        NOT NULL REFERENCES public.degree_levels(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, degree_level_id)
);

-- PK covers (article_id, degree_level_id) with article_id as leading column.
-- Index degree_level_id for reverse lookups: all articles for a degree level.
CREATE INDEX idx_article_degree_levels_degree_level_id ON public.article_degree_levels (degree_level_id);

ALTER TABLE public.article_degree_levels ENABLE ROW LEVEL SECURITY;

-- Public read: only when the parent article is published.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "article_degree_levels_select_published_parent" ON public.article_degree_levels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.articles a
      WHERE  a.id             = article_degree_levels.article_id
      AND    a.content_status = 'published'
    )
  );

-- Content editors can read all article_degree_levels regardless of parent status.
CREATE POLICY "article_degree_levels_select_editors" ON public.article_degree_levels
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

CREATE POLICY "article_degree_levels_insert_editors" ON public.article_degree_levels
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "article_degree_levels_update_editors" ON public.article_degree_levels
  FOR UPDATE TO authenticated
  USING     (has_permission('edit_content'))
  WITH CHECK (has_permission('edit_content'));

CREATE POLICY "article_degree_levels_delete_editors" ON public.article_degree_levels
  FOR DELETE TO authenticated
  USING (has_permission('edit_content'));


-- ============================================================
-- TABLE: seo_page_types
-- ============================================================
-- Configuration table that classifies the kinds of SEO landing pages
-- DegreeWiki generates or manages. Examples:
--   code: country_degree       name: Programs by Country and Degree
--   code: subject_country      name: Programs by Subject and Country
--   code: scholarship_country  name: Scholarships by Country
--
-- url_pattern is a human-readable pattern template to document
-- the URL structure (e.g. "/programs/{country}/{degree}") — not
-- used directly for routing, but useful for admin documentation.
--
-- code must be unique (used as a stable identifier in server logic).
-- Rows are inserted by seed migration 015.
-- ------------------------------------------------------------
CREATE TABLE public.seo_page_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  url_pattern text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_seo_page_types_updated_at
  BEFORE UPDATE ON public.seo_page_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- code UNIQUE constraint auto-creates an index — no additional code index needed.
CREATE INDEX idx_seo_page_types_created_at ON public.seo_page_types (created_at);
CREATE INDEX idx_seo_page_types_updated_at ON public.seo_page_types (updated_at);

ALTER TABLE public.seo_page_types ENABLE ROW LEVEL SECURITY;

-- Public read: all SEO page types are visible to both anon and authenticated users.
-- Page type configuration is reference data with no publishing workflow.
CREATE POLICY "seo_page_types_select_public" ON public.seo_page_types
  FOR SELECT
  USING (true);

-- Site administrators can create SEO page type definitions.
CREATE POLICY "seo_page_types_insert_settings" ON public.seo_page_types
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_settings'));

-- Site administrators can update SEO page type definitions.
CREATE POLICY "seo_page_types_update_settings" ON public.seo_page_types
  FOR UPDATE TO authenticated
  USING     (has_permission('manage_settings'))
  WITH CHECK (has_permission('manage_settings'));

-- Site administrators can delete SEO page type definitions.
-- Deletion is blocked if any seo_landing_pages reference this type (FK RESTRICT).
CREATE POLICY "seo_page_types_delete_settings" ON public.seo_page_types
  FOR DELETE TO authenticated
  USING (has_permission('manage_settings'));


-- ============================================================
-- TABLE: seo_landing_pages
-- ============================================================
-- SEO-optimised landing pages that aggregate program/scholarship
-- results for specific facet combinations — e.g.
--   /study-in-germany/masters-programs
--   /study-computer-science-abroad
--   /scholarships-for-international-students-in-uk
--
-- Facet FK columns (country_id, subject_id, degree_level_id,
-- university_id) are all optional; the combination in use is
-- determined by the seo_page_type_id.
--
-- Public visibility requires BOTH:
--   content_status = 'published'  — content is approved and live
--   indexing_status = 'index'     — page has enough quality to index
-- A published page with indexing_status = 'noindex' is served but
-- suppressed from Google; it does not appear in public API reads.
-- This prevents thin pages from leaking through even when published.
--
-- intro_content provides an editable text block rendered above
-- the aggregated program/scholarship listings on the landing page.
-- ------------------------------------------------------------
CREATE TABLE public.seo_landing_pages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seo_page_type_id uuid        NOT NULL REFERENCES public.seo_page_types(id)   ON DELETE RESTRICT,
  slug             text        NOT NULL UNIQUE,
  title            text        NOT NULL,
  intro_content    text,

  -- Content lifecycle
  content_status   text        NOT NULL DEFAULT 'draft'
    CHECK (content_status IN ('draft', 'in_review', 'published', 'unpublished', 'archived')),
  indexing_status  text        NOT NULL DEFAULT 'draft'
    CHECK (indexing_status IN ('index', 'noindex', 'draft')),

  -- Facet foreign keys (all optional; combination determined by page type)
  country_id       uuid        REFERENCES public.countries(id)      ON DELETE SET NULL,
  subject_id       uuid        REFERENCES public.subjects(id)       ON DELETE SET NULL,
  degree_level_id  uuid        REFERENCES public.degree_levels(id)  ON DELETE SET NULL,
  university_id    uuid        REFERENCES public.universities(id)   ON DELETE SET NULL,

  -- Media
  og_image_id      uuid        REFERENCES public.media_assets(id)   ON DELETE SET NULL,

  -- SEO / Open Graph
  seo_title        text,
  seo_description  text,
  seo_h1           text,
  canonical_url    text,
  og_title         text,
  og_description   text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_seo_landing_pages_updated_at
  BEFORE UPDATE ON public.seo_landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- slug UNIQUE constraint auto-creates an index — no additional slug index needed.
CREATE INDEX idx_seo_landing_pages_seo_page_type_id ON public.seo_landing_pages (seo_page_type_id);
CREATE INDEX idx_seo_landing_pages_country_id       ON public.seo_landing_pages (country_id);
CREATE INDEX idx_seo_landing_pages_subject_id       ON public.seo_landing_pages (subject_id);
CREATE INDEX idx_seo_landing_pages_degree_level_id  ON public.seo_landing_pages (degree_level_id);
CREATE INDEX idx_seo_landing_pages_university_id    ON public.seo_landing_pages (university_id);
CREATE INDEX idx_seo_landing_pages_og_image_id      ON public.seo_landing_pages (og_image_id);
CREATE INDEX idx_seo_landing_pages_content_status   ON public.seo_landing_pages (content_status);
CREATE INDEX idx_seo_landing_pages_indexing_status  ON public.seo_landing_pages (indexing_status);
CREATE INDEX idx_seo_landing_pages_created_at       ON public.seo_landing_pages (created_at);
CREATE INDEX idx_seo_landing_pages_updated_at       ON public.seo_landing_pages (updated_at);

-- Partial index for the dominant public query: pages that are
-- both published and indexable. This is the only set returned
-- to public visitors and to the sitemap generator.
CREATE INDEX idx_seo_landing_pages_published_index ON public.seo_landing_pages (id, slug, title)
  WHERE content_status = 'published' AND indexing_status = 'index';

-- Composite indexes for the three main browse/filter axes.
-- page-type + status: used when listing all pages of a given type in admin.
CREATE INDEX idx_seo_landing_pages_type_status ON public.seo_landing_pages
  (seo_page_type_id, content_status, indexing_status);

-- country + degree + status: dominant public search pattern for program landing pages.
CREATE INDEX idx_seo_landing_pages_country_degree_status ON public.seo_landing_pages
  (country_id, degree_level_id, content_status);

-- subject + degree + status: dominant pattern for subject-focused landing pages.
CREATE INDEX idx_seo_landing_pages_subject_degree_status ON public.seo_landing_pages
  (subject_id, degree_level_id, content_status);

ALTER TABLE public.seo_landing_pages ENABLE ROW LEVEL SECURITY;

-- Public read: only when content_status = 'published' AND indexing_status = 'index'.
-- Both conditions are required — a published but noindex page must not be
-- returned to public visitors or the sitemap generator.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "seo_landing_pages_select_published" ON public.seo_landing_pages
  FOR SELECT
  USING (
    content_status  = 'published'
    AND indexing_status = 'index'
  );

-- Content editors can read all SEO landing pages regardless of status.
-- Needed for admin draft, review, and quality-check workflows.
CREATE POLICY "seo_landing_pages_select_editors" ON public.seo_landing_pages
  FOR SELECT TO authenticated
  USING (has_permission('edit_content'));

-- Content editors can create SEO landing page records.
-- Setting content_status = 'published' additionally requires publish_content.
-- This is enforced in RLS — not only in server-side validation.
CREATE POLICY "seo_landing_pages_insert_editors" ON public.seo_landing_pages
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Content editors can update SEO landing pages.
-- USING: any editor can target an existing row (including published ones).
-- WITH CHECK: the resulting row must not be 'published' without publish_content.
CREATE POLICY "seo_landing_pages_update_editors" ON public.seo_landing_pages
  FOR UPDATE TO authenticated
  USING (has_permission('edit_content'))
  WITH CHECK (
    has_permission('edit_content')
    AND (
      content_status <> 'published'
      OR has_permission('publish_content')
    )
  );

-- Only super_admin can permanently delete an SEO landing page.
-- Normal retirement should use content_status = 'archived'.
CREATE POLICY "seo_landing_pages_delete_super_admin" ON public.seo_landing_pages
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));
