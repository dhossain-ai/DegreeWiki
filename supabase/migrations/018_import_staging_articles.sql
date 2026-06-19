-- ============================================================
-- Migration 018: Article Staging Table
-- ============================================================
-- Tables added:
--   staging_articles
--
-- Constraint changes:
--   import_batches.batch_type  — adds 'articles'
--   staging_errors.staging_table — adds 'staging_articles'
--
-- Depends on:
--   001_custom_types  — update_updated_at_column()
--   002_auth_roles    — has_role(), has_permission(), user_profiles
--   008_articles_seo  — articles
--   010_import_staging — import_batches, staging_errors
--
-- Purpose:
--   Completes the import staging foundation by adding article-type
--   staging support to match the existing staging_universities,
--   staging_programs, and staging_scholarships tables.
--
--   Constraint name assumption:
--     PostgreSQL auto-generates unnamed inline CHECK constraint names as
--     {table}_{column}_check. The constraints altered here were defined
--     inline (no explicit name) in migration 010, so their auto-generated
--     names are:
--       import_batches_batch_type_check
--       staging_errors_staging_table_check
--     If this migration fails on DROP CONSTRAINT, verify the constraint
--     names against the live schema with:
--       SELECT constraint_name FROM information_schema.table_constraints
--       WHERE table_name IN ('import_batches', 'staging_errors')
--         AND constraint_type = 'CHECK';
--
-- RLS summary:
--   No public SELECT on any table in this migration.
--   All tables are admin-only.
--   SELECT/INSERT/UPDATE/DELETE:
--     has_permission('manage_imports') OR has_role('super_admin')
-- ============================================================


-- ============================================================
-- 1. Extend import_batches.batch_type to include 'articles'
-- ============================================================
ALTER TABLE public.import_batches
  DROP CONSTRAINT import_batches_batch_type_check,
  ADD CONSTRAINT import_batches_batch_type_check
    CHECK (batch_type IN ('universities', 'programs', 'scholarships', 'articles', 'mixed'));


-- ============================================================
-- 2. Extend staging_errors.staging_table to include 'staging_articles'
-- ============================================================
ALTER TABLE public.staging_errors
  DROP CONSTRAINT staging_errors_staging_table_check,
  ADD CONSTRAINT staging_errors_staging_table_check
    CHECK (staging_table IN (
      'staging_universities', 'staging_programs', 'staging_scholarships',
      'staging_articles', 'import_files', 'import_batches'
    ));


-- ============================================================
-- 3. TABLE: staging_articles
-- ============================================================
-- AI/CSV/manual extracted article records waiting for validation
-- and review before entering the live articles table.
--
-- AI-extracted data must be reviewed before publishing.
-- match_article_id is set when a probable duplicate of an
-- existing article is detected during deduplication.
-- ------------------------------------------------------------
CREATE TABLE public.staging_articles (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id       uuid        NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,

  -- Raw extracted data as originally received from AI or CSV.
  raw_data              jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Structured fields extracted from raw_data for display and matching.
  extracted_title       text,
  extracted_slug        text,
  extracted_category    text,
  extracted_content     text,

  -- FK to an existing article if this record is likely a duplicate.
  match_article_id      uuid        REFERENCES public.articles(id) ON DELETE SET NULL,

  import_status         text        NOT NULL DEFAULT 'pending'
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error'
    )),

  -- Self-reference: if this record is a duplicate of another staging row.
  duplicate_of_id       uuid        REFERENCES public.staging_articles(id) ON DELETE SET NULL,

  review_notes          text,
  reviewed_by_user_id   uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_staging_articles_updated_at
  BEFORE UPDATE ON public.staging_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staging_articles_import_batch_id  ON public.staging_articles (import_batch_id);
CREATE INDEX idx_staging_articles_match_article_id ON public.staging_articles (match_article_id);
CREATE INDEX idx_staging_articles_import_status    ON public.staging_articles (import_status);
CREATE INDEX idx_staging_articles_duplicate_of_id  ON public.staging_articles (duplicate_of_id);
CREATE INDEX idx_staging_articles_reviewed_by      ON public.staging_articles (reviewed_by_user_id);
CREATE INDEX idx_staging_articles_created_at       ON public.staging_articles (created_at);
CREATE INDEX idx_staging_articles_updated_at       ON public.staging_articles (updated_at);
-- Composite index for the most common admin queue filter: batch + status
CREATE INDEX idx_staging_articles_batch_status     ON public.staging_articles (import_batch_id, import_status);

ALTER TABLE public.staging_articles ENABLE ROW LEVEL SECURITY;

-- No public SELECT — admin-only table.
CREATE POLICY "staging_articles_select_permitted" ON public.staging_articles
  FOR SELECT TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_articles_insert_permitted" ON public.staging_articles
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_articles_update_permitted" ON public.staging_articles
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_articles_delete_permitted" ON public.staging_articles
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );
