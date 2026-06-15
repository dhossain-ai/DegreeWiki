-- ============================================================
-- Migration 014: Analytics Tables
-- ============================================================
-- Tables:
--   analytics_events
--   search_logs
--   outbound_clicks
--
-- Depends on:
--   002_auth_roles — has_role(), has_permission(), user_profiles
--
-- All three tables are append-only event logs.
--
-- INSERT:
--   Allowed for anon and authenticated clients, but user_id cannot be
--   forged. The WITH CHECK constraint enforces:
--     - Anonymous clients must insert with user_id = NULL.
--     - Authenticated clients may insert with user_id = NULL (unlinked)
--       or user_id = auth.uid() (linked to their own account).
--     - No client can insert a row attributed to another user's id.
--   Browser clients send events directly; the Supabase anon key
--   is used in public pages where no auth session exists.
--
-- SELECT:
--   Requires has_permission('view_analytics') OR has_role('super_admin').
--   Regular authenticated users cannot read analytics data.
--
-- UPDATE / DELETE:
--   No policies exist. Analytics events are immutable after insertion.
--   Purging old data is done via the service role through cron jobs.
--
-- Sensitive data rules:
--   Do not store passwords, tokens, or private PII in properties/filters.
--   user_id FK is set to NULL on user deletion (ON DELETE SET NULL).
--   Session IDs are transient identifiers, not personal data.
--
-- No page_views table in this migration.
-- ============================================================


-- ============================================================
-- TABLE: analytics_events
-- ============================================================
-- Generic product analytics event log.
-- Records user interaction events such as program views, search
-- clicks, AI Finder starts, scholarship link clicks, and more.
--
-- entity_type is nullable — events not tied to a specific entity
-- (e.g. homepage_load) leave entity_type and entity_id as NULL.
-- The chk_analytics_events_entity constraint enforces that entity_type
-- and entity_id are either both NULL or both set — a partially-filled
-- pair (type without id, or id without type) is rejected at the DB level.
-- ============================================================
CREATE TABLE public.analytics_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,
  entity_type text
    CHECK (entity_type IS NULL OR entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id   uuid,
  -- entity_type and entity_id must be either both NULL or both set.
  CONSTRAINT chk_analytics_events_entity CHECK (
    (entity_type IS NULL AND entity_id IS NULL)
    OR
    (entity_type IS NOT NULL AND entity_id IS NOT NULL)
  ),
  user_id     uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  session_id  text,
  properties  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- No updated_at — analytics events are never modified after insertion.

CREATE INDEX idx_analytics_events_event_type         ON public.analytics_events (event_type);
CREATE INDEX idx_analytics_events_entity             ON public.analytics_events (entity_type, entity_id);
CREATE INDEX idx_analytics_events_user_id            ON public.analytics_events (user_id);
CREATE INDEX idx_analytics_events_session_id         ON public.analytics_events (session_id);
CREATE INDEX idx_analytics_events_created_at         ON public.analytics_events (created_at);
-- Composite index for the most common admin analytics query: events of a given
-- type within a date range.
CREATE INDEX idx_analytics_events_event_type_created ON public.analytics_events (event_type, created_at);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Any visitor (anon or authenticated) can log an analytics event.
-- user_id must be NULL (anonymous event) or match the caller's own auth.uid().
-- This prevents a browser client from forging analytics attributed to another user.
-- Anonymous events on public pages must be inserted with user_id = NULL.
CREATE POLICY "analytics_events_insert_all" ON public.analytics_events
  FOR INSERT
  WITH CHECK (
    user_id IS NULL
    OR user_id = auth.uid()
  );

-- Only admins with view_analytics or super_admin can read event data.
-- Authenticated users without this permission cannot read their own rows.
CREATE POLICY "analytics_events_select_admin" ON public.analytics_events
  FOR SELECT TO authenticated
  USING (
    has_permission('view_analytics')
    OR has_role('super_admin')
  );

-- No UPDATE or DELETE policies. Events are immutable.


-- ============================================================
-- TABLE: search_logs
-- ============================================================
-- Logs search queries and filter combinations entered by users.
-- Used to identify common searches, zero-result queries, and
-- popular filter patterns for product and SEO improvements.
--
-- result_count = 0 rows can be queried to find gaps in content
-- coverage (e.g. searches that return no programs or scholarships).
-- ============================================================
CREATE TABLE public.search_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  query        text,
  filters      jsonb,
  result_count integer,
  user_id      uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  session_id   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- No updated_at — search log entries are never modified.

CREATE INDEX idx_search_logs_user_id      ON public.search_logs (user_id);
CREATE INDEX idx_search_logs_session_id   ON public.search_logs (session_id);
CREATE INDEX idx_search_logs_result_count ON public.search_logs (result_count);
CREATE INDEX idx_search_logs_created_at   ON public.search_logs (created_at);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Any visitor (anon or authenticated) can log a search.
-- user_id must be NULL or the caller's own auth.uid() — cannot impersonate another user.
CREATE POLICY "search_logs_insert_all" ON public.search_logs
  FOR INSERT
  WITH CHECK (
    user_id IS NULL
    OR user_id = auth.uid()
  );

-- Only admins with view_analytics or super_admin can read search logs.
CREATE POLICY "search_logs_select_admin" ON public.search_logs
  FOR SELECT TO authenticated
  USING (
    has_permission('view_analytics')
    OR has_role('super_admin')
  );

-- No UPDATE or DELETE policies.


-- ============================================================
-- TABLE: outbound_clicks
-- ============================================================
-- Tracks clicks on external links from DegreeWiki pages.
-- Captures the entity the user was viewing when they clicked,
-- the destination URL, and the type of link clicked.
--
-- click_type values:
--   official_site — university or program official website
--   apply         — application portal link
--   scholarship   — scholarship provider or application link
--   source        — data source or reference link
--   brochure      — downloadable prospectus or PDF
--   other         — any other outbound destination
-- ============================================================
CREATE TABLE public.outbound_clicks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text        NOT NULL
    CHECK (entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id       uuid        NOT NULL,
  destination_url text        NOT NULL,
  click_type      text        NOT NULL
    CHECK (click_type IN ('official_site', 'apply', 'scholarship', 'source', 'brochure', 'other')),
  user_id         uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  session_id      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- No updated_at — click log entries are never modified.

CREATE INDEX idx_outbound_clicks_entity     ON public.outbound_clicks (entity_type, entity_id);
CREATE INDEX idx_outbound_clicks_click_type ON public.outbound_clicks (click_type);
CREATE INDEX idx_outbound_clicks_user_id    ON public.outbound_clicks (user_id);
CREATE INDEX idx_outbound_clicks_session_id ON public.outbound_clicks (session_id);
CREATE INDEX idx_outbound_clicks_created_at ON public.outbound_clicks (created_at);

ALTER TABLE public.outbound_clicks ENABLE ROW LEVEL SECURITY;

-- Any visitor (anon or authenticated) can log an outbound click.
-- user_id must be NULL or the caller's own auth.uid() — cannot impersonate another user.
CREATE POLICY "outbound_clicks_insert_all" ON public.outbound_clicks
  FOR INSERT
  WITH CHECK (
    user_id IS NULL
    OR user_id = auth.uid()
  );

-- Only admins with view_analytics or super_admin can read click data.
CREATE POLICY "outbound_clicks_select_admin" ON public.outbound_clicks
  FOR SELECT TO authenticated
  USING (
    has_permission('view_analytics')
    OR has_role('super_admin')
  );

-- No UPDATE or DELETE policies.
