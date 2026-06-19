-- ============================================================
-- Migration 020: Add 'merged' to staging import_status checks
-- ============================================================
-- Tables altered:
--   staging_universities
--   staging_programs
--   staging_scholarships
--   staging_articles
--
-- Constraint names (set explicitly by migration 019):
--   staging_universities_import_status_check
--   staging_programs_import_status_check
--   staging_scholarships_import_status_check
--   staging_articles_import_status_check
--
-- Final allowed import_status values on all four tables:
--   pending, processing, validated, duplicate_detected,
--   needs_review, approved, rejected, error, skipped, merged
--
-- 'merged' means the staged row was successfully promoted to a
-- production table by the one-by-one merge workflow (Phase 43).
-- It is a terminal state: merged rows are not re-mergeable.
--
-- Depends on:
--   019_add_skipped_status
-- ============================================================


-- ============================================================
-- 1. staging_universities
-- ============================================================
ALTER TABLE public.staging_universities
  DROP CONSTRAINT staging_universities_import_status_check,
  ADD CONSTRAINT staging_universities_import_status_check
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error', 'skipped', 'merged'
    ));


-- ============================================================
-- 2. staging_programs
-- ============================================================
ALTER TABLE public.staging_programs
  DROP CONSTRAINT staging_programs_import_status_check,
  ADD CONSTRAINT staging_programs_import_status_check
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error', 'skipped', 'merged'
    ));


-- ============================================================
-- 3. staging_scholarships
-- ============================================================
ALTER TABLE public.staging_scholarships
  DROP CONSTRAINT staging_scholarships_import_status_check,
  ADD CONSTRAINT staging_scholarships_import_status_check
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error', 'skipped', 'merged'
    ));


-- ============================================================
-- 4. staging_articles
-- ============================================================
ALTER TABLE public.staging_articles
  DROP CONSTRAINT staging_articles_import_status_check,
  ADD CONSTRAINT staging_articles_import_status_check
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error', 'skipped', 'merged'
    ));
