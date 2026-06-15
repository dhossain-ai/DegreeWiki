-- ============================================================
-- Migration 010: Import Batches and Staging Tables
-- ============================================================
-- Tables:
--   import_batches
--   import_files
--   staging_universities
--   staging_programs
--   staging_scholarships
--   staging_errors
--
-- Depends on:
--   001_custom_types  — update_updated_at_column(), import_status values
--   002_auth_roles    — has_role(), has_permission(), user_profiles
--   005_universities_campuses — universities
--   006_programs      — programs
--   007_scholarships  — scholarships
--   009_data_sources  — data_sources
--
-- Purpose:
--   These tables support the AI/CSV/manual import and review workflow.
--   Raw or AI-extracted data enters staging tables and must pass
--   validation and human review before being promoted to live tables.
--
--   AI-extracted data must never go directly into live public tables.
--   Correct flow:
--     1. Collect official sources
--     2. Upload raw files / trigger AI extraction
--     3. Insert extracted records into staging_* tables
--     4. Validate and detect duplicates
--     5. Human admin reviews and approves/rejects
--     6. Approved records are promoted to live tables (future migration)
--
-- File storage:
--   Actual import files (CSV, JSON, HTML, PDF) live in Supabase Storage,
--   not in PostgreSQL. import_files.storage_path and
--   import_batches.storage_path store the Storage paths only.
--
-- RLS summary:
--   No public SELECT on any table in this migration.
--   All tables are admin-only.
--   SELECT/INSERT/UPDATE/DELETE:
--     has_permission('manage_imports') OR has_role('super_admin')
-- ============================================================


-- ============================================================
-- TABLE: import_batches
-- ============================================================
-- Tracks one CSV/JSON/AI/manual import batch.
-- Each batch represents a single import event tied to a data source.
-- Files within the batch are tracked in import_files.
-- ------------------------------------------------------------
CREATE TABLE public.import_batches (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id      uuid        REFERENCES public.data_sources(id) ON DELETE SET NULL,
  created_by_user_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  batch_type          text        NOT NULL
    CHECK (batch_type IN ('universities', 'programs', 'scholarships', 'mixed')),

  import_status       text        NOT NULL DEFAULT 'pending'
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error'
    )),

  total_records       integer     NOT NULL DEFAULT 0,
  processed_count     integer     NOT NULL DEFAULT 0,
  error_count         integer     NOT NULL DEFAULT 0,

  notes               text,

  -- Path to the primary source file or archive in Supabase Storage.
  -- Individual files within the batch are tracked in import_files.
  storage_path        text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_import_batches_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_import_batches_data_source_id     ON public.import_batches (data_source_id);
CREATE INDEX idx_import_batches_created_by_user_id ON public.import_batches (created_by_user_id);
CREATE INDEX idx_import_batches_batch_type         ON public.import_batches (batch_type);
CREATE INDEX idx_import_batches_import_status      ON public.import_batches (import_status);
CREATE INDEX idx_import_batches_created_at         ON public.import_batches (created_at);
CREATE INDEX idx_import_batches_updated_at         ON public.import_batches (updated_at);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- No public SELECT — admin-only table.
CREATE POLICY "import_batches_select_permitted" ON public.import_batches
  FOR SELECT TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "import_batches_insert_permitted" ON public.import_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "import_batches_update_permitted" ON public.import_batches
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "import_batches_delete_permitted" ON public.import_batches
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );


-- ============================================================
-- TABLE: import_files
-- ============================================================
-- Files attached to an import batch.
-- Actual files live in Supabase Storage; this table stores metadata
-- and the Storage path only.
-- ------------------------------------------------------------
CREATE TABLE public.import_files (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id   uuid        NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,

  -- Path to the file in Supabase Storage (not the raw binary content).
  storage_path      text        NOT NULL,

  file_type         text        NOT NULL
    CHECK (file_type IN ('csv', 'json', 'html', 'pdf', 'txt', 'other')),

  file_size_bytes   bigint,

  import_status     text        NOT NULL DEFAULT 'pending'
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error'
    )),

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_files_import_batch_id ON public.import_files (import_batch_id);
CREATE INDEX idx_import_files_file_type       ON public.import_files (file_type);
CREATE INDEX idx_import_files_import_status   ON public.import_files (import_status);
CREATE INDEX idx_import_files_created_at      ON public.import_files (created_at);

ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_files_select_permitted" ON public.import_files
  FOR SELECT TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "import_files_insert_permitted" ON public.import_files
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "import_files_update_permitted" ON public.import_files
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "import_files_delete_permitted" ON public.import_files
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );


-- ============================================================
-- TABLE: staging_universities
-- ============================================================
-- AI/CSV/manual extracted university records waiting for
-- validation and review before entering the live universities table.
--
-- AI-extracted data must be reviewed before publishing.
-- match_university_id is set when a probable duplicate of an
-- existing university is detected during deduplication.
-- ------------------------------------------------------------
CREATE TABLE public.staging_universities (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id       uuid        NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,

  -- Raw extracted data as originally received from AI or CSV.
  raw_data              jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Structured fields extracted from raw_data for display and matching.
  extracted_name        text,
  extracted_country_code text,
  extracted_official_url text,

  -- FK to an existing university if this record is likely a duplicate.
  match_university_id   uuid        REFERENCES public.universities(id) ON DELETE SET NULL,

  import_status         text        NOT NULL DEFAULT 'pending'
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error'
    )),

  -- Self-reference: if this record is a duplicate of another staging row.
  duplicate_of_id       uuid        REFERENCES public.staging_universities(id) ON DELETE SET NULL,

  review_notes          text,
  reviewed_by_user_id   uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_staging_universities_updated_at
  BEFORE UPDATE ON public.staging_universities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staging_universities_import_batch_id     ON public.staging_universities (import_batch_id);
CREATE INDEX idx_staging_universities_match_university_id ON public.staging_universities (match_university_id);
CREATE INDEX idx_staging_universities_import_status       ON public.staging_universities (import_status);
CREATE INDEX idx_staging_universities_duplicate_of_id     ON public.staging_universities (duplicate_of_id);
CREATE INDEX idx_staging_universities_reviewed_by         ON public.staging_universities (reviewed_by_user_id);
CREATE INDEX idx_staging_universities_created_at          ON public.staging_universities (created_at);
CREATE INDEX idx_staging_universities_updated_at          ON public.staging_universities (updated_at);
-- Composite index for the most common admin queue filter: batch + status
CREATE INDEX idx_staging_universities_batch_status        ON public.staging_universities (import_batch_id, import_status);

ALTER TABLE public.staging_universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staging_universities_select_permitted" ON public.staging_universities
  FOR SELECT TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_universities_insert_permitted" ON public.staging_universities
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_universities_update_permitted" ON public.staging_universities
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_universities_delete_permitted" ON public.staging_universities
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );


-- ============================================================
-- TABLE: staging_programs
-- ============================================================
-- AI/CSV/manual extracted program records waiting for review
-- before entering the live programs table.
--
-- AI-extracted data must be reviewed before publishing.
-- staging_university_id links to a staging row (not yet a live
-- university) when the program's university is also being imported
-- in the same batch.
-- ------------------------------------------------------------
CREATE TABLE public.staging_programs (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id           uuid        NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,

  -- Optional link to a university staging row in the same batch.
  staging_university_id     uuid        REFERENCES public.staging_universities(id) ON DELETE SET NULL,

  raw_data                  jsonb       NOT NULL DEFAULT '{}'::jsonb,

  extracted_title           text,
  extracted_degree_level_code text,
  extracted_language        text,
  extracted_tuition_amount  numeric,
  extracted_deadline        text,

  -- FK to an existing program if this record is likely a duplicate.
  match_program_id          uuid        REFERENCES public.programs(id) ON DELETE SET NULL,

  import_status             text        NOT NULL DEFAULT 'pending'
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error'
    )),

  duplicate_of_id           uuid        REFERENCES public.staging_programs(id) ON DELETE SET NULL,

  review_notes              text,
  reviewed_by_user_id       uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at               timestamptz,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_staging_programs_updated_at
  BEFORE UPDATE ON public.staging_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staging_programs_import_batch_id     ON public.staging_programs (import_batch_id);
CREATE INDEX idx_staging_programs_staging_university_id ON public.staging_programs (staging_university_id);
CREATE INDEX idx_staging_programs_match_program_id    ON public.staging_programs (match_program_id);
CREATE INDEX idx_staging_programs_import_status       ON public.staging_programs (import_status);
CREATE INDEX idx_staging_programs_duplicate_of_id     ON public.staging_programs (duplicate_of_id);
CREATE INDEX idx_staging_programs_reviewed_by         ON public.staging_programs (reviewed_by_user_id);
CREATE INDEX idx_staging_programs_created_at          ON public.staging_programs (created_at);
CREATE INDEX idx_staging_programs_updated_at          ON public.staging_programs (updated_at);
CREATE INDEX idx_staging_programs_batch_status        ON public.staging_programs (import_batch_id, import_status);

ALTER TABLE public.staging_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staging_programs_select_permitted" ON public.staging_programs
  FOR SELECT TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_programs_insert_permitted" ON public.staging_programs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_programs_update_permitted" ON public.staging_programs
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_programs_delete_permitted" ON public.staging_programs
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );


-- ============================================================
-- TABLE: staging_scholarships
-- ============================================================
-- AI/CSV/manual extracted scholarship records waiting for review
-- before entering the live scholarships table.
--
-- AI-extracted data must be reviewed before publishing.
-- ------------------------------------------------------------
CREATE TABLE public.staging_scholarships (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id         uuid        NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,

  raw_data                jsonb       NOT NULL DEFAULT '{}'::jsonb,

  extracted_name          text,
  extracted_amount        numeric,
  extracted_deadline      text,

  -- FK to an existing scholarship if this record is likely a duplicate.
  match_scholarship_id    uuid        REFERENCES public.scholarships(id) ON DELETE SET NULL,

  import_status           text        NOT NULL DEFAULT 'pending'
    CHECK (import_status IN (
      'pending', 'processing', 'validated', 'duplicate_detected',
      'needs_review', 'approved', 'rejected', 'error'
    )),

  duplicate_of_id         uuid        REFERENCES public.staging_scholarships(id) ON DELETE SET NULL,

  review_notes            text,
  reviewed_by_user_id     uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_staging_scholarships_updated_at
  BEFORE UPDATE ON public.staging_scholarships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staging_scholarships_import_batch_id    ON public.staging_scholarships (import_batch_id);
CREATE INDEX idx_staging_scholarships_match_scholarship_id ON public.staging_scholarships (match_scholarship_id);
CREATE INDEX idx_staging_scholarships_import_status      ON public.staging_scholarships (import_status);
CREATE INDEX idx_staging_scholarships_duplicate_of_id    ON public.staging_scholarships (duplicate_of_id);
CREATE INDEX idx_staging_scholarships_reviewed_by        ON public.staging_scholarships (reviewed_by_user_id);
CREATE INDEX idx_staging_scholarships_created_at         ON public.staging_scholarships (created_at);
CREATE INDEX idx_staging_scholarships_updated_at         ON public.staging_scholarships (updated_at);
CREATE INDEX idx_staging_scholarships_batch_status       ON public.staging_scholarships (import_batch_id, import_status);

ALTER TABLE public.staging_scholarships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staging_scholarships_select_permitted" ON public.staging_scholarships
  FOR SELECT TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_scholarships_insert_permitted" ON public.staging_scholarships
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_scholarships_update_permitted" ON public.staging_scholarships
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_scholarships_delete_permitted" ON public.staging_scholarships
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );


-- ============================================================
-- TABLE: staging_errors
-- ============================================================
-- Stores errors from validation and import processing.
-- Records which staging row triggered the error and what failed.
-- This table is append-only in practice; errors are not edited,
-- they are resolved by fixing and re-processing the source row.
-- ------------------------------------------------------------
CREATE TABLE public.staging_errors (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id   uuid        NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,

  -- Which staging table the error originated from.
  staging_table     text        NOT NULL
    CHECK (staging_table IN (
      'staging_universities', 'staging_programs', 'staging_scholarships',
      'import_files', 'import_batches'
    )),

  -- The id of the row in staging_table that triggered the error.
  -- No FK constraint — staging_row_id may reference any of the above
  -- tables depending on staging_table. Application must validate.
  staging_row_id    uuid,

  error_type        text        NOT NULL,
  error_message     text        NOT NULL,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staging_errors_import_batch_id ON public.staging_errors (import_batch_id);
CREATE INDEX idx_staging_errors_staging_table   ON public.staging_errors (staging_table);
CREATE INDEX idx_staging_errors_staging_row_id  ON public.staging_errors (staging_row_id);
CREATE INDEX idx_staging_errors_error_type      ON public.staging_errors (error_type);
CREATE INDEX idx_staging_errors_created_at      ON public.staging_errors (created_at);

ALTER TABLE public.staging_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staging_errors_select_permitted" ON public.staging_errors
  FOR SELECT TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_errors_insert_permitted" ON public.staging_errors
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_errors_update_permitted" ON public.staging_errors
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );

CREATE POLICY "staging_errors_delete_permitted" ON public.staging_errors
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_imports')
    OR has_role('super_admin')
  );
