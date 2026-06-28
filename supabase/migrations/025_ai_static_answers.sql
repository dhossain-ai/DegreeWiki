-- ============================================================
-- Migration 025: Static AI Knowledge Base Answers
-- ============================================================
-- Purpose:
--   Add a reviewed preset-answer table for public/site chat so common
--   questions can be answered deterministically before any AI call.
--
-- Notes:
--   - Answers are plain text only.
--   - Published rows may be read by anonymous and authenticated clients.
--   - Admin CRUD is limited to manage_ai_settings or super_admin.
--   - No service-role requirement for normal admin CRUD or site-chat lookup.
-- ============================================================

CREATE TABLE public.ai_static_answers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question            text        NOT NULL,
  question_normalized text        NOT NULL,
  answer              text        NOT NULL,
  category            text        NOT NULL,
  keywords_json       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  aliases_json        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  intent_code         text,
  audience            text        NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'anonymous', 'authenticated')),
  locale              text        NOT NULL DEFAULT 'en'
    CHECK (locale <> ''),
  status              text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  priority            integer     NOT NULL DEFAULT 100
    CHECK (priority > 0),
  match_type          text        NOT NULL DEFAULT 'hybrid'
    CHECK (match_type IN ('exact', 'keyword', 'hybrid')),
  source_note         text,
  reviewed_by_user_id uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  created_by_user_id  uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  updated_by_user_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_ai_static_answers_question_length
    CHECK (char_length(question) BETWEEN 3 AND 300),
  CONSTRAINT chk_ai_static_answers_answer_length
    CHECK (char_length(answer) BETWEEN 20 AND 3000),
  CONSTRAINT chk_ai_static_answers_category_length
    CHECK (char_length(category) BETWEEN 2 AND 80)
);

CREATE UNIQUE INDEX idx_ai_static_answers_locale_audience_question_active
  ON public.ai_static_answers (locale, audience, question_normalized)
  WHERE status <> 'archived';

CREATE INDEX idx_ai_static_answers_status_locale_priority
  ON public.ai_static_answers (status, locale, priority);

CREATE INDEX idx_ai_static_answers_category_status
  ON public.ai_static_answers (category, status);

CREATE INDEX idx_ai_static_answers_question_normalized
  ON public.ai_static_answers (question_normalized);

CREATE TRIGGER set_ai_static_answers_updated_at
  BEFORE UPDATE ON public.ai_static_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ai_static_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_static_answers_select_published_anon" ON public.ai_static_answers
  FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "ai_static_answers_select_published_authenticated" ON public.ai_static_answers
  FOR SELECT TO authenticated
  USING (status = 'published');

CREATE POLICY "ai_static_answers_select_manage_ai_settings" ON public.ai_static_answers
  FOR SELECT TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_static_answers_insert_manage_ai_settings" ON public.ai_static_answers
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_static_answers_update_manage_ai_settings" ON public.ai_static_answers
  FOR UPDATE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'))
  WITH CHECK (has_permission('manage_ai_settings') OR has_role('super_admin'));

CREATE POLICY "ai_static_answers_delete_manage_ai_settings" ON public.ai_static_answers
  FOR DELETE TO authenticated
  USING (has_permission('manage_ai_settings') OR has_role('super_admin'));
