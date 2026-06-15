-- ============================================================
-- Migration 009: Data Sources, Source Snapshots,
--                Verification Events, Data Quality Checks
-- ============================================================
-- Tables:
--   data_sources
--   source_snapshots
--   verification_events
--   data_quality_checks
--
-- Depends on:
--   001_custom_types  — update_updated_at_column(), entity_type canonical list
--   002_auth_roles    — has_role(), has_permission(), user_profiles
--
-- Purpose:
--   These tables are internal data-quality and provenance tracking
--   tables. They are NOT public content. They are never readable by
--   anonymous visitors or authenticated students. Access is restricted
--   to users with the view_data_quality or manage_data_sources
--   permission, or the super_admin role.
--
-- Polymorphic entity references:
--   data_sources, verification_events, and data_quality_checks all
--   reference entities via entity_type + entity_id rather than FK
--   columns. This allows one table to serve all entity types without
--   requiring separate source/verification tables per entity.
--   entity_id carries NO FK constraint — enforcing referential
--   integrity across all entity tables in a single polymorphic FK
--   is not supported by PostgreSQL. Application logic must validate
--   that entity_id exists in the correct table for the given entity_type.
--
-- Raw source files:
--   Raw HTML, PDF, and CSV source files captured during source
--   checking belong in Supabase Storage, not directly in PostgreSQL.
--   source_snapshots.storage_path stores the path to the file in
--   Storage. Extracted text is stored in extracted_text for search
--   and AI use without bloating the database with binary content.
--
-- RLS summary:
--   No public SELECT on any table in this migration.
--   SELECT:          view_data_quality OR manage_data_sources OR super_admin
--   INSERT/UPDATE/DELETE (data_sources):
--                    manage_data_sources OR super_admin
--   INSERT (verification_events):
--                    manage_data_sources OR edit_content OR super_admin
--                    (editors may record verification events while editing)
--   No UPDATE on verification_events — append-only by design.
--   DELETE (verification_events): super_admin only.
--   INSERT (data_quality_checks):
--                    manage_data_sources OR edit_content OR super_admin
--   UPDATE (data_quality_checks):
--                    manage_data_sources OR super_admin
--   DELETE (data_quality_checks): super_admin only.
--
-- Not implemented here (deferred to later migrations):
--   entity_field_sources, broken_link_checks, source_change_detections,
--   import/staging tables.
-- ============================================================


-- ============================================================
-- SHARED ENTITY_TYPE CHECK EXPRESSION
-- ============================================================
-- The entity_type CHECK constraint is identical on every table
-- that uses polymorphic entity references. The canonical list
-- is documented in migration 001_custom_types.sql.
-- Any additions to this list require updating EVERY CHECK
-- constraint that references it, in a new migration.
-- ============================================================


-- ------------------------------------------------------------
-- data_sources
-- Entity-source link table.
-- Each row attaches one source URL to one specific entity.
-- Multiple sources may be attached to the same entity with
-- different source_type or purpose — no unique constraint on
-- (entity_type, entity_id, source_url) is applied here.
-- Deduplication is handled by application logic.
--
-- entity_id is polymorphic — no FK constraint.
-- See migration header for rationale.
-- ------------------------------------------------------------
CREATE TABLE public.data_sources (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic entity reference (no FK on entity_id — see header comment)
  entity_type         text        NOT NULL
    CHECK (entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id           uuid        NOT NULL,

  -- Source location
  source_url          text        NOT NULL,
  source_title        text,
  source_domain       text,

  -- Source classification
  source_type         text        NOT NULL DEFAULT 'third_party'
    CHECK (source_type IN (
      'official_university', 'government', 'third_party', 'aggregator', 'user_submitted'
    )),
  confidence_level    text        NOT NULL DEFAULT 'unknown'
    CHECK (confidence_level IN ('high', 'medium', 'low', 'unknown')),
  source_status       text        NOT NULL DEFAULT 'active'
    CHECK (source_status IN ('active', 'broken', 'redirected', 'archived')),

  is_primary_source   boolean     NOT NULL DEFAULT false,

  -- Link health tracking
  last_checked_at     timestamptz,
  next_check_due_at   timestamptz,

  -- User who last verified/checked this source (nullable — can be system-checked)
  checked_by_user_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_data_sources_updated_at
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Composite index for the primary access pattern: look up all sources for an entity
CREATE INDEX idx_data_sources_entity         ON public.data_sources (entity_type, entity_id);
CREATE INDEX idx_data_sources_source_domain  ON public.data_sources (source_domain);
CREATE INDEX idx_data_sources_source_type    ON public.data_sources (source_type);
CREATE INDEX idx_data_sources_confidence     ON public.data_sources (confidence_level);
CREATE INDEX idx_data_sources_source_status  ON public.data_sources (source_status);
CREATE INDEX idx_data_sources_is_primary     ON public.data_sources (is_primary_source);
CREATE INDEX idx_data_sources_checked_by     ON public.data_sources (checked_by_user_id);
CREATE INDEX idx_data_sources_last_checked   ON public.data_sources (last_checked_at);
CREATE INDEX idx_data_sources_next_check     ON public.data_sources (next_check_due_at);
CREATE INDEX idx_data_sources_created_at     ON public.data_sources (created_at);
CREATE INDEX idx_data_sources_updated_at     ON public.data_sources (updated_at);

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

-- SELECT: users with view_data_quality, manage_data_sources, or super_admin role
CREATE POLICY "data_sources_select_permitted" ON public.data_sources
  FOR SELECT TO authenticated
  USING (
    has_permission('view_data_quality')
    OR has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- INSERT: manage_data_sources or super_admin
CREATE POLICY "data_sources_insert_permitted" ON public.data_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- UPDATE: manage_data_sources or super_admin
CREATE POLICY "data_sources_update_permitted" ON public.data_sources
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- DELETE: manage_data_sources or super_admin
CREATE POLICY "data_sources_delete_permitted" ON public.data_sources
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  );


-- ------------------------------------------------------------
-- source_snapshots
-- Point-in-time snapshot of a source at a specific fetch/check.
-- Stores metadata and the path to the raw file in Supabase Storage.
--
-- Raw HTML and PDF files belong in Supabase Storage, NOT here.
-- storage_path holds the Storage path (e.g. "source-snapshots/abc.html").
-- extracted_text holds cleaned text for search/AI use without
-- storing binary content directly in PostgreSQL.
-- ------------------------------------------------------------
CREATE TABLE public.source_snapshots (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK to the source this snapshot belongs to
  data_source_id        uuid        NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,

  -- Supabase Storage path for the raw file (HTML, PDF, etc.)
  -- Raw binary files live in Storage — only the path is stored here.
  storage_path          text,
  snapshot_url          text,

  fetched_at            timestamptz NOT NULL DEFAULT now(),
  snapshot_status       text        NOT NULL DEFAULT 'pending'
    CHECK (snapshot_status IN ('pending', 'stored', 'failed')),

  -- Content fingerprint for change detection
  content_hash          text,

  -- Cleaned text extracted from the snapshot for AI/search use
  extracted_text        text,
  extraction_method     text,
  extracted_by_ai_model text,
  extraction_notes      text,

  created_at            timestamptz NOT NULL DEFAULT now()
  -- No updated_at: snapshots are written once and not updated in place.
  -- A re-fetch creates a new row rather than modifying an existing snapshot.
);

CREATE INDEX idx_source_snapshots_data_source_id  ON public.source_snapshots (data_source_id);
CREATE INDEX idx_source_snapshots_fetched_at       ON public.source_snapshots (fetched_at);
CREATE INDEX idx_source_snapshots_snapshot_status  ON public.source_snapshots (snapshot_status);
CREATE INDEX idx_source_snapshots_content_hash     ON public.source_snapshots (content_hash);
CREATE INDEX idx_source_snapshots_created_at       ON public.source_snapshots (created_at);

ALTER TABLE public.source_snapshots ENABLE ROW LEVEL SECURITY;

-- SELECT: users with view_data_quality, manage_data_sources, or super_admin role
CREATE POLICY "source_snapshots_select_permitted" ON public.source_snapshots
  FOR SELECT TO authenticated
  USING (
    has_permission('view_data_quality')
    OR has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- INSERT: manage_data_sources or super_admin
-- (snapshot creation is triggered by server-side jobs, not manual UI writes)
CREATE POLICY "source_snapshots_insert_permitted" ON public.source_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- UPDATE: manage_data_sources or super_admin
-- (status updates, e.g. marking a failed snapshot after re-inspection)
CREATE POLICY "source_snapshots_update_permitted" ON public.source_snapshots
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- DELETE: manage_data_sources or super_admin
CREATE POLICY "source_snapshots_delete_permitted" ON public.source_snapshots
  FOR DELETE TO authenticated
  USING (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  );


-- ------------------------------------------------------------
-- verification_events
-- Append-only audit trail of verification actions and status changes.
--
-- Every time a user or automated process verifies, flags, or
-- updates the verification status of an entity, a new row is
-- inserted here. Existing rows are NEVER updated or deleted
-- (except by super_admin in an emergency).
--
-- entity_id is polymorphic — no FK constraint.
-- See migration header for rationale.
--
-- editors (edit_content) may INSERT verification events because
-- they record verification findings inline while editing content.
-- ------------------------------------------------------------
CREATE TABLE public.verification_events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic entity reference (no FK on entity_id — see header comment)
  entity_type          text        NOT NULL
    CHECK (entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id            uuid        NOT NULL,

  -- Optional link to the source that was consulted during this verification
  data_source_id       uuid        REFERENCES public.data_sources(id) ON DELETE SET NULL,

  -- User who performed the verification (nullable — can be system/automated)
  verified_by_user_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  verification_status  text        NOT NULL
    CHECK (verification_status IN (
      'unverified', 'partially_verified', 'verified',
      'source_conflict', 'outdated', 'needs_review'
    )),

  notes                text,
  verified_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_events_entity          ON public.verification_events (entity_type, entity_id);
CREATE INDEX idx_verification_events_data_source_id  ON public.verification_events (data_source_id);
CREATE INDEX idx_verification_events_verified_by     ON public.verification_events (verified_by_user_id);
CREATE INDEX idx_verification_events_status          ON public.verification_events (verification_status);
CREATE INDEX idx_verification_events_verified_at     ON public.verification_events (verified_at);
CREATE INDEX idx_verification_events_created_at      ON public.verification_events (created_at);

ALTER TABLE public.verification_events ENABLE ROW LEVEL SECURITY;

-- SELECT: view_data_quality, manage_data_sources, or super_admin
CREATE POLICY "verification_events_select_permitted" ON public.verification_events
  FOR SELECT TO authenticated
  USING (
    has_permission('view_data_quality')
    OR has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- INSERT: manage_data_sources, edit_content, or super_admin.
-- Editors may record verification events while working on content.
CREATE POLICY "verification_events_insert_permitted" ON public.verification_events
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_data_sources')
    OR has_permission('edit_content')
    OR has_role('super_admin')
  );

-- No UPDATE policy for authenticated clients.
-- Verification events are append-only. Corrections are made by
-- inserting a new event with updated status, not editing old ones.

-- DELETE: super_admin only — emergency correction or data purge.
CREATE POLICY "verification_events_delete_super_admin" ON public.verification_events
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ------------------------------------------------------------
-- data_quality_checks
-- Stores automated or manual data-quality check results for any entity.
--
-- Each row represents the result of one check_type run against one
-- entity at a specific point in time. Re-running the same check
-- creates a new row; old rows are not overwritten. Historical
-- check results accumulate for trend analysis.
--
-- entity_id is polymorphic — no FK constraint.
-- See migration header for rationale.
-- ------------------------------------------------------------
CREATE TABLE public.data_quality_checks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic entity reference (no FK on entity_id — see header comment)
  entity_type  text        NOT NULL
    CHECK (entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id    uuid        NOT NULL,

  -- What was checked. Examples:
  --   url_reachable, tuition_present, deadline_present, image_present,
  --   source_missing, seo_missing_description, duplicate_candidate
  check_type   text        NOT NULL,

  result       text        NOT NULL
    CHECK (result IN ('pass', 'fail', 'warning')),

  -- Flexible payload for check-specific detail (field values, diffs, counts, etc.)
  details      jsonb,

  checked_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
  -- No updated_at: each re-run inserts a new row. Old results are historical records.
);

CREATE INDEX idx_data_quality_checks_entity      ON public.data_quality_checks (entity_type, entity_id);
CREATE INDEX idx_data_quality_checks_check_type  ON public.data_quality_checks (check_type);
CREATE INDEX idx_data_quality_checks_result      ON public.data_quality_checks (result);
CREATE INDEX idx_data_quality_checks_checked_at  ON public.data_quality_checks (checked_at);
CREATE INDEX idx_data_quality_checks_created_at  ON public.data_quality_checks (created_at);

ALTER TABLE public.data_quality_checks ENABLE ROW LEVEL SECURITY;

-- SELECT: view_data_quality, manage_data_sources, or super_admin
CREATE POLICY "data_quality_checks_select_permitted" ON public.data_quality_checks
  FOR SELECT TO authenticated
  USING (
    has_permission('view_data_quality')
    OR has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- INSERT: manage_data_sources, edit_content, or super_admin.
-- Editors and import tools may create quality checks as part of content workflows.
CREATE POLICY "data_quality_checks_insert_permitted" ON public.data_quality_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission('manage_data_sources')
    OR has_permission('edit_content')
    OR has_role('super_admin')
  );

-- UPDATE: manage_data_sources or super_admin only.
-- (Correcting a check result or enriching the details payload.)
CREATE POLICY "data_quality_checks_update_permitted" ON public.data_quality_checks
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_data_sources')
    OR has_role('super_admin')
  );

-- DELETE: super_admin only
CREATE POLICY "data_quality_checks_delete_super_admin" ON public.data_quality_checks
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));
