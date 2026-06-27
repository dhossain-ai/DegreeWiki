-- ============================================================
-- Migration 024: AI Gateway Foundation
-- ============================================================
-- Purpose:
--   Add the DB-backed AI gateway foundation used to route existing
--   Fit Finder summaries and saved-result chat through provider/model
--   policies while preserving env fallback and existing ai_usage_logs.
--
-- Tables:
--   ai_provider_accounts
--   ai_models
--   ai_routing_policies
--   ai_provider_health
--   ai_gateway_call_logs
--
-- Seed:
--   manage_ai_settings permission
--   grant manage_ai_settings to super_admin
--
-- Notes:
--   - No provider credentials are stored in plaintext.
--   - No public or student access to AI gateway configuration.
--   - ai_gateway_call_logs stores metadata only, never full prompts/responses.
--   - ai_usage_logs remains unchanged and continues to act as the quota ledger.
-- ============================================================

-- ============================================================
-- Permission seed
-- ============================================================
INSERT INTO public.permissions (code, name, description)
VALUES (
  'manage_ai_settings',
  'Manage AI Settings',
  'Manage AI provider accounts, models, routing policies, and provider health settings.'
)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'manage_ai_settings'
WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;


-- ============================================================
-- TABLE: ai_provider_accounts
-- ============================================================
CREATE TABLE public.ai_provider_accounts (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code           text        NOT NULL,
  display_name            text        NOT NULL,
  adapter_type            text        NOT NULL
    CHECK (adapter_type IN ('openai_compatible')),
  base_url                text,
  endpoint_path           text,
  auth_type               text        NOT NULL DEFAULT 'bearer'
    CHECK (auth_type IN ('bearer')),
  api_key_ciphertext      text        NOT NULL,
  api_key_iv              text        NOT NULL,
  api_key_key_version     text        NOT NULL,
  api_key_last4           text,
  api_key_fingerprint     text,
  timeout_ms              integer     NOT NULL DEFAULT 30000
    CHECK (timeout_ms BETWEEN 1000 AND 120000),
  is_active               boolean     NOT NULL DEFAULT true,
  privacy_level           text        NOT NULL DEFAULT 'standard'
    CHECK (privacy_level IN ('standard', 'restricted')),
  allows_student_data     boolean     NOT NULL DEFAULT false,
  allows_chat             boolean     NOT NULL DEFAULT false,
  allows_fit_finder       boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_provider_accounts_provider_code UNIQUE (provider_code)
);

CREATE TRIGGER set_ai_provider_accounts_updated_at
  BEFORE UPDATE ON public.ai_provider_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_provider_accounts_active ON public.ai_provider_accounts (is_active);
CREATE INDEX idx_ai_provider_accounts_privacy ON public.ai_provider_accounts (privacy_level);

ALTER TABLE public.ai_provider_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_provider_accounts_select_manage_ai_settings" ON public.ai_provider_accounts
  FOR SELECT TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_provider_accounts_insert_manage_ai_settings" ON public.ai_provider_accounts
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_provider_accounts_update_manage_ai_settings" ON public.ai_provider_accounts
  FOR UPDATE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'))
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_provider_accounts_delete_manage_ai_settings" ON public.ai_provider_accounts
  FOR DELETE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));


-- ============================================================
-- TABLE: ai_models
-- ============================================================
CREATE TABLE public.ai_models (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_account_id     uuid        NOT NULL REFERENCES public.ai_provider_accounts(id) ON DELETE CASCADE,
  model_name              text        NOT NULL,
  display_name            text        NOT NULL,
  is_active               boolean     NOT NULL DEFAULT true,
  supports_text           boolean     NOT NULL DEFAULT true,
  supports_json_mode      boolean     NOT NULL DEFAULT false,
  supports_streaming      boolean     NOT NULL DEFAULT false,
  supports_tool_calling   boolean     NOT NULL DEFAULT false,
  max_output_tokens       integer,
  input_cost_per_million  numeric,
  output_cost_per_million numeric,
  cost_tier               text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_models_provider_model UNIQUE (provider_account_id, model_name),
  CONSTRAINT chk_ai_models_max_output_tokens
    CHECK (max_output_tokens IS NULL OR max_output_tokens > 0)
);

CREATE TRIGGER set_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_models_provider_active ON public.ai_models (provider_account_id, is_active);

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_models_select_manage_ai_settings" ON public.ai_models
  FOR SELECT TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_models_insert_manage_ai_settings" ON public.ai_models
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_models_update_manage_ai_settings" ON public.ai_models
  FOR UPDATE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'))
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_models_delete_manage_ai_settings" ON public.ai_models
  FOR DELETE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));


-- ============================================================
-- TABLE: ai_routing_policies
-- ============================================================
CREATE TABLE public.ai_routing_policies (
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
  model_id            uuid        NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  priority            integer     NOT NULL CHECK (priority > 0),
  is_active           boolean     NOT NULL DEFAULT true,
  fallback_enabled    boolean     NOT NULL DEFAULT true,
  max_attempts        integer     NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
  timeout_ms          integer     CHECK (timeout_ms IS NULL OR timeout_ms BETWEEN 1000 AND 120000),
  allow_env_fallback  boolean     NOT NULL DEFAULT false,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_routing_policies_use_case_priority UNIQUE (use_case, priority),
  CONSTRAINT uq_ai_routing_policies_use_case_model UNIQUE (use_case, model_id)
);

CREATE TRIGGER set_ai_routing_policies_updated_at
  BEFORE UPDATE ON public.ai_routing_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_routing_policies_use_case_active
  ON public.ai_routing_policies (use_case, is_active, priority);

ALTER TABLE public.ai_routing_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_routing_policies_select_manage_ai_settings" ON public.ai_routing_policies
  FOR SELECT TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_routing_policies_insert_manage_ai_settings" ON public.ai_routing_policies
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_routing_policies_update_manage_ai_settings" ON public.ai_routing_policies
  FOR UPDATE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'))
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_routing_policies_delete_manage_ai_settings" ON public.ai_routing_policies
  FOR DELETE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));


-- ============================================================
-- TABLE: ai_provider_health
-- ============================================================
CREATE TABLE public.ai_provider_health (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_account_id   uuid        NOT NULL REFERENCES public.ai_provider_accounts(id) ON DELETE CASCADE,
  model_id              uuid        NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  consecutive_failures  integer     NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_success_at       timestamptz,
  last_failure_at       timestamptz,
  last_error_type       text,
  cooldown_until        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ai_provider_health_provider_model UNIQUE (provider_account_id, model_id)
);

CREATE TRIGGER set_ai_provider_health_updated_at
  BEFORE UPDATE ON public.ai_provider_health
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_provider_health_cooldown
  ON public.ai_provider_health (provider_account_id, cooldown_until);

ALTER TABLE public.ai_provider_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_provider_health_select_manage_ai_settings" ON public.ai_provider_health
  FOR SELECT TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_provider_health_insert_manage_ai_settings" ON public.ai_provider_health
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_provider_health_update_manage_ai_settings" ON public.ai_provider_health
  FOR UPDATE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'))
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_provider_health_delete_manage_ai_settings" ON public.ai_provider_health
  FOR DELETE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));


-- ============================================================
-- TABLE: ai_gateway_call_logs
-- ============================================================
CREATE TABLE public.ai_gateway_call_logs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case                text        NOT NULL
    CHECK (use_case IN (
      'fit_finder_summary',
      'chat_answer',
      'intent_detection',
      'subject_mapping',
      'program_comparison',
      'scholarship_explanation',
      'admin_article_draft'
    )),
  provider_account_id     uuid        REFERENCES public.ai_provider_accounts(id) ON DELETE SET NULL,
  model_id                uuid        REFERENCES public.ai_models(id) ON DELETE SET NULL,
  provider_code           text,
  model_name              text,
  status                  text        NOT NULL
    CHECK (status IN (
      'success',
      'failure',
      'skipped_cooldown',
      'skipped_inactive',
      'blocked_by_policy',
      'env_fallback_success',
      'env_fallback_failure'
    )),
  normalized_error_type   text
    CHECK (normalized_error_type IS NULL OR normalized_error_type IN (
      'rate_limit',
      'quota_exceeded',
      'timeout',
      'provider_unavailable',
      'provider_5xx',
      'network_error',
      'invalid_provider_response',
      'auth_error',
      'bad_request',
      'model_not_found',
      'policy_refusal',
      'unknown_error'
    )),
  provider_http_status    integer,
  latency_ms              integer,
  prompt_tokens           integer,
  completion_tokens       integer,
  total_tokens            integer,
  estimated_cost_usd      numeric,
  was_fallback            boolean     NOT NULL DEFAULT false,
  fallback_attempt_number integer     NOT NULL DEFAULT 0 CHECK (fallback_attempt_number >= 0),
  fallback_from_call_id   uuid        REFERENCES public.ai_gateway_call_logs(id) ON DELETE SET NULL,
  user_id                 uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  anonymous_session_id    text,
  ai_finder_result_id     uuid        REFERENCES public.ai_finder_results(id) ON DELETE SET NULL,
  ai_conversation_id      uuid        REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  ai_message_id           uuid        REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_gateway_call_logs_created_at
  ON public.ai_gateway_call_logs (created_at);
CREATE INDEX idx_ai_gateway_call_logs_use_case
  ON public.ai_gateway_call_logs (use_case, created_at);
CREATE INDEX idx_ai_gateway_call_logs_provider_model
  ON public.ai_gateway_call_logs (provider_account_id, model_id, created_at);
CREATE INDEX idx_ai_gateway_call_logs_user
  ON public.ai_gateway_call_logs (user_id, created_at);

ALTER TABLE public.ai_gateway_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_gateway_call_logs_select_permitted" ON public.ai_gateway_call_logs
  FOR SELECT TO authenticated
  USING (
    has_permission('view_ai_logs')
    OR has_permission('manage_ai_settings')
    OR has_role('super_admin')
  );

-- No authenticated INSERT/UPDATE/DELETE policies.
-- Service role writes logs server-side.
