-- ============================================================
-- Migration 026: AI Usage Limit Policies
-- ============================================================
-- Purpose:
--   Add DB-backed AI usage limit policies and richer quota-log metadata
--   while preserving the existing env/code fallback behavior until admins
--   create policy rows.
--
-- Tables:
--   ai_usage_limit_policies
--
-- Additive changes:
--   ai_usage_logs.use_case
--   ai_usage_logs.audience_tier
--   ai_usage_logs.anonymous_session_id
--
-- Notes:
--   - No backfill of old ai_usage_logs rows.
--   - No seeded active policies. The table starts empty on purpose.
-- ============================================================

CREATE TABLE public.ai_usage_limit_policies (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case            text        NOT NULL
    CHECK (use_case IN (
      'fit_finder_summary',
      'chat_answer',
      'intent_detection',
      'subject_mapping',
      'program_comparison',
      'scholarship_explanation',
      'admin_article_draft'
    )),
  audience_tier       text        NOT NULL
    CHECK (audience_tier IN (
      'anonymous',
      'authenticated_free',
      'admin',
      'paid_basic',
      'paid_pro'
    )),
  period              text        NOT NULL DEFAULT 'daily'
    CHECK (period IN ('daily', 'monthly')),
  max_calls           integer     NOT NULL
    CHECK (max_calls BETWEEN 0 AND 100000),
  max_tokens          integer
    CHECK (max_tokens IS NULL OR max_tokens >= 0),
  is_enabled          boolean     NOT NULL DEFAULT true,
  notes               text,
  created_by_user_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by_user_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_usage_limit_policies_tuple UNIQUE (use_case, audience_tier, period)
);

CREATE TRIGGER set_ai_usage_limit_policies_updated_at
  BEFORE UPDATE ON public.ai_usage_limit_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_usage_limit_policies_enabled_lookup
  ON public.ai_usage_limit_policies (is_enabled, use_case, audience_tier, period);

ALTER TABLE public.ai_usage_limit_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_limit_policies_select_manage_ai_settings" ON public.ai_usage_limit_policies
  FOR SELECT TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_usage_limit_policies_insert_manage_ai_settings" ON public.ai_usage_limit_policies
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_usage_limit_policies_update_manage_ai_settings" ON public.ai_usage_limit_policies
  FOR UPDATE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'))
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_usage_limit_policies_delete_manage_ai_settings" ON public.ai_usage_limit_policies
  FOR DELETE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));

ALTER TABLE public.ai_usage_logs
  ADD COLUMN use_case text
    CHECK (use_case IS NULL OR use_case IN (
      'fit_finder_summary',
      'chat_answer',
      'intent_detection',
      'subject_mapping',
      'program_comparison',
      'scholarship_explanation',
      'admin_article_draft'
    )),
  ADD COLUMN audience_tier text
    CHECK (audience_tier IS NULL OR audience_tier IN (
      'anonymous',
      'authenticated_free',
      'admin',
      'paid_basic',
      'paid_pro'
    )),
  ADD COLUMN anonymous_session_id text;

CREATE INDEX idx_ai_usage_logs_user_use_case_audience_created_at
  ON public.ai_usage_logs (user_id, use_case, audience_tier, created_at DESC);

CREATE INDEX idx_ai_usage_logs_anon_use_case_audience_created_at
  ON public.ai_usage_logs (anonymous_session_id, use_case, audience_tier, created_at DESC);
