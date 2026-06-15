-- ============================================================
-- Migration 013: User Product Tables
-- ============================================================
-- Tables:
--   report_categories
--   user_reports
--   saved_items
--
-- Depends on:
--   002_auth_roles — has_role(), has_permission(), user_profiles
--
-- RLS summary:
--
--   report_categories
--     Public/authenticated SELECT when is_active = true.
--     Settings managers can SELECT all (including inactive).
--     INSERT/UPDATE/DELETE require manage_settings.
--
--   user_reports
--     Authenticated users can INSERT own reports
--     (reporter_user_id = auth.uid()) and SELECT own reports.
--     No UPDATE or DELETE allowed from browser clients.
--     Anonymous reports go through server endpoints using
--     the service role only — no anon browser RLS policies.
--     Admin (manage_reports OR super_admin): SELECT + UPDATE.
--     DELETE: super_admin only.
--
--   saved_items
--     Owner-protected. Logged-in users can SELECT/INSERT/UPDATE/DELETE
--     only their own rows (user_id = auth.uid()).
--     No anonymous browser access — saving requires a logged-in account.
--     super_admin can SELECT and DELETE for support/moderation.
-- ============================================================


-- ============================================================
-- TABLE: report_categories
-- ============================================================
-- Lookup table for classifying user-submitted content reports.
-- Controlled by is_active (not content_status) — this is a
-- configuration/lookup table with no editorial publishing workflow.
-- Seeded in migration 015.
-- ============================================================
CREATE TABLE public.report_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_report_categories_updated_at
  BEFORE UPDATE ON public.report_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- code UNIQUE constraint auto-creates an index.
CREATE INDEX idx_report_categories_is_active  ON public.report_categories (is_active);
CREATE INDEX idx_report_categories_created_at ON public.report_categories (created_at);
CREATE INDEX idx_report_categories_updated_at ON public.report_categories (updated_at);

ALTER TABLE public.report_categories ENABLE ROW LEVEL SECURITY;

-- Anon and authenticated users can read active categories.
-- Needed to populate the category dropdown on the "Report an issue" form.
CREATE POLICY "report_categories_select_active" ON public.report_categories
  FOR SELECT
  USING (is_active = true);

-- Settings managers can read all categories, including inactive ones.
CREATE POLICY "report_categories_select_managers" ON public.report_categories
  FOR SELECT TO authenticated
  USING (has_permission('manage_settings'));

-- Only settings managers can create report categories.
CREATE POLICY "report_categories_insert_settings" ON public.report_categories
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_settings'));

-- Only settings managers can update report categories.
CREATE POLICY "report_categories_update_settings" ON public.report_categories
  FOR UPDATE TO authenticated
  USING     (has_permission('manage_settings'))
  WITH CHECK (has_permission('manage_settings'));

-- Only settings managers can delete report categories.
CREATE POLICY "report_categories_delete_settings" ON public.report_categories
  FOR DELETE TO authenticated
  USING (has_permission('manage_settings'));


-- ============================================================
-- TABLE: user_reports
-- ============================================================
-- Corrections and issue reports submitted by logged-in users
-- or anonymous visitors.
--
-- Logged-in users:
--   INSERT: allowed when reporter_user_id = auth.uid()
--   SELECT: own reports only (reporter_user_id = auth.uid())
--   UPDATE/DELETE: not allowed from browser
--
-- Anonymous users:
--   No direct browser RLS policies.
--   Anonymous reports are submitted through a server endpoint
--   using the service role. The endpoint validates the submission
--   and inserts with reporter_user_id = NULL.
--
-- Admin (manage_reports OR super_admin):
--   SELECT: all reports
--   UPDATE: status updates and admin notes
--   DELETE: super_admin only
--
-- entity_id is polymorphic — no FK constraint. The entity_type
-- field identifies which table owns the referenced entity.
-- Application logic must verify the reference on submission.
-- ============================================================
CREATE TABLE public.user_reports (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id    uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  entity_type         text        NOT NULL
    CHECK (entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id           uuid        NOT NULL,
  report_category_id  uuid        NOT NULL REFERENCES public.report_categories(id) ON DELETE RESTRICT,
  description         text        NOT NULL,
  report_status       text        NOT NULL DEFAULT 'open'
    CHECK (report_status IN ('open', 'under_review', 'resolved', 'dismissed')),
  admin_notes         text,
  resolved_by_user_id uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_user_reports_updated_at
  BEFORE UPDATE ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_reports_reporter_user_id    ON public.user_reports (reporter_user_id);
CREATE INDEX idx_user_reports_entity              ON public.user_reports (entity_type, entity_id);
CREATE INDEX idx_user_reports_report_category_id  ON public.user_reports (report_category_id);
CREATE INDEX idx_user_reports_report_status       ON public.user_reports (report_status);
CREATE INDEX idx_user_reports_resolved_by_user_id ON public.user_reports (resolved_by_user_id);
CREATE INDEX idx_user_reports_created_at          ON public.user_reports (created_at);
CREATE INDEX idx_user_reports_updated_at          ON public.user_reports (updated_at);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit a report for any entity.
-- reporter_user_id must be set to auth.uid() — prevents impersonation.
CREATE POLICY "user_reports_insert_own" ON public.user_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- Authenticated users can view their own submitted reports.
CREATE POLICY "user_reports_select_own" ON public.user_reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());

-- No UPDATE or DELETE policies for authenticated browser clients.
-- Users cannot modify or retract their own reports after submission.
-- All report status changes are made by admins through server endpoints.

-- Admin: manage_reports or super_admin can read all reports.
CREATE POLICY "user_reports_select_admin" ON public.user_reports
  FOR SELECT TO authenticated
  USING (
    has_permission('manage_reports')
    OR has_role('super_admin')
  );

-- Admin: manage_reports or super_admin can update report status and admin notes.
CREATE POLICY "user_reports_update_admin" ON public.user_reports
  FOR UPDATE TO authenticated
  USING (
    has_permission('manage_reports')
    OR has_role('super_admin')
  )
  WITH CHECK (
    has_permission('manage_reports')
    OR has_role('super_admin')
  );

-- Only super_admin can permanently delete a report.
CREATE POLICY "user_reports_delete_super_admin" ON public.user_reports
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ============================================================
-- TABLE: saved_items
-- ============================================================
-- Generic saved/bookmarked entities for logged-in users.
-- Users can save programs, scholarships, universities, articles,
-- and any other entity in the canonical entity_type list.
--
-- The unique constraint on (user_id, entity_type, entity_id)
-- prevents duplicate saves of the same entity by the same user.
-- The constraint auto-creates an index with user_id as the
-- leading column, covering single-user bookmark lookups.
-- A separate (entity_type, entity_id) index supports
-- reverse lookups: "which users saved this entity?"
--
-- No anonymous browser access. Saving requires a logged-in account.
-- ============================================================
CREATE TABLE public.saved_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  entity_type text        NOT NULL
    CHECK (entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id   uuid        NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Prevents saving the same entity more than once per user.
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE TRIGGER set_saved_items_updated_at
  BEFORE UPDATE ON public.saved_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- UNIQUE (user_id, entity_type, entity_id) auto-creates an index
-- covering user_id as the leading column — no separate user_id index needed.
CREATE INDEX idx_saved_items_entity     ON public.saved_items (entity_type, entity_id);
CREATE INDEX idx_saved_items_created_at ON public.saved_items (created_at);
CREATE INDEX idx_saved_items_updated_at ON public.saved_items (updated_at);

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

-- Logged-in users can view their own saved items.
CREATE POLICY "saved_items_select_own" ON public.saved_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Logged-in users can save items. user_id must be auth.uid().
CREATE POLICY "saved_items_insert_own" ON public.saved_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Logged-in users can update notes on their own saved items.
CREATE POLICY "saved_items_update_own" ON public.saved_items
  FOR UPDATE TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Logged-in users can remove their own saved items.
CREATE POLICY "saved_items_delete_own" ON public.saved_items
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- super_admin can read all saved items for support and moderation.
CREATE POLICY "saved_items_select_super_admin" ON public.saved_items
  FOR SELECT TO authenticated
  USING (has_role('super_admin'));

-- super_admin can delete any saved item.
CREATE POLICY "saved_items_delete_super_admin" ON public.saved_items
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));
