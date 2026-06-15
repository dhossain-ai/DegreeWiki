-- ============================================================
-- Migration 011: Student Profiles
-- ============================================================
-- Tables:
--   student_profiles
--   student_profile_subjects
--   student_profile_countries
--
-- Depends on:
--   001_custom_types  — update_updated_at_column()
--   002_auth_roles    — has_role(), has_permission(), user_profiles
--   004_lookup_tables — countries, degree_levels, subjects
--
-- Purpose:
--   Student profiles store personalisation input for the Best-Fit
--   Finder and future student dashboard. A profile may be owned by
--   a logged-in user (user_id set, is_anonymous = false) or created
--   anonymously for a trial session (is_anonymous = true, session_token
--   set, expires_at set).
--
-- Anonymous profile handling:
--   Anonymous rows are NOT accessible through browser RLS.
--   All anonymous profile reads and writes go through server endpoints
--   using the Supabase service role, which bypasses RLS.
--   Direct anon-tier RLS policies are intentionally omitted.
--
-- Data sensitivity:
--   Do not store documents, passport data, bank statements, or files.
--   Store only study preferences and academic background numbers.
--
-- RLS summary:
--   student_profiles:
--     Logged-in SELECT/DELETE — own rows (user_id = auth.uid()).
--     Logged-in INSERT — own rows, is_anonymous = false only.
--     Logged-in UPDATE — own rows; WITH CHECK prevents conversion to anonymous
--       (is_anonymous = false AND session_token IS NULL enforced in WITH CHECK).
--     super_admin SELECT/DELETE for support/moderation.
--     No anon-tier policy — anonymous access via service role only.
--   student_profile_subjects / student_profile_countries:
--     Logged-in SELECT/INSERT/UPDATE/DELETE — only when parent profile.user_id = auth.uid().
--     super_admin SELECT/DELETE for support/moderation.
--     No anon-tier policy.
-- ============================================================


-- ============================================================
-- TABLE: student_profiles
-- ============================================================
-- Central record for a student's study-abroad preferences and
-- academic background, used as input to the AI Best-Fit Finder.
-- ------------------------------------------------------------
CREATE TABLE public.student_profiles (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Null for anonymous profiles. Non-null for logged-in users.
  user_id                  uuid        REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  is_anonymous             boolean     NOT NULL DEFAULT false,

  -- Server-side token used to identify anonymous sessions.
  -- Never exposed to browser RLS. Managed via service role only.
  session_token            text,

  -- Study preferences
  current_country_id       uuid        REFERENCES public.countries(id)     ON DELETE SET NULL,
  target_degree_level_id   uuid        REFERENCES public.degree_levels(id)  ON DELETE SET NULL,

  -- Budget range in the student's preferred currency
  budget_min               numeric,
  budget_max               numeric,
  budget_currency          text,

  -- Academic background
  gpa                      numeric,
  english_score_type       text,   -- e.g. IELTS, TOEFL, PTE, Duolingo
  english_score            numeric,
  work_experience_years    integer,

  study_start_preference   text,   -- e.g. "Sep 2025", "Anytime"
  additional_notes         text,

  -- Set only for anonymous profiles; triggers cleanup cron job.
  expires_at               timestamptz,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  -- Owner-mode constraint: logged-in and anonymous profiles are strictly separated.
  --   Logged-in: user_id set, is_anonymous = false, session_token NULL.
  --   Anonymous:  user_id NULL,  is_anonymous = true,  session_token set, expires_at set.
  -- This prevents mixing: a logged-in profile cannot have a session_token, and an
  -- anonymous profile cannot have a user_id or be created without an expiry.
  CONSTRAINT chk_student_profiles_owner_mode
    CHECK (
      (
        is_anonymous = false
        AND user_id IS NOT NULL
        AND session_token IS NULL
      )
      OR
      (
        is_anonymous = true
        AND user_id IS NULL
        AND session_token IS NOT NULL
        AND expires_at IS NOT NULL
      )
    ),
  CONSTRAINT chk_budget_min_non_negative
    CHECK (budget_min     IS NULL OR budget_min     >= 0),
  CONSTRAINT chk_budget_max_non_negative
    CHECK (budget_max     IS NULL OR budget_max     >= 0),
  CONSTRAINT chk_gpa_non_negative
    CHECK (gpa            IS NULL OR gpa            >= 0),
  CONSTRAINT chk_english_score_non_negative
    CHECK (english_score  IS NULL OR english_score  >= 0),
  CONSTRAINT chk_work_experience_non_negative
    CHECK (work_experience_years IS NULL OR work_experience_years >= 0)
);

CREATE TRIGGER set_student_profiles_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_student_profiles_user_id               ON public.student_profiles (user_id);
CREATE INDEX idx_student_profiles_is_anonymous          ON public.student_profiles (is_anonymous);
-- Unique partial index on session_token for anonymous profiles only.
-- Enforces that two anonymous sessions cannot share the same token.
-- NOTE: In a future security hardening pass, consider storing session_token_hash
-- (e.g. SHA-256 hex) instead of the raw token to prevent token leakage from
-- database dumps or log files.
CREATE UNIQUE INDEX idx_student_profiles_session_token_unique
  ON public.student_profiles (session_token)
  WHERE is_anonymous = true AND session_token IS NOT NULL;
CREATE INDEX idx_student_profiles_current_country_id    ON public.student_profiles (current_country_id);
CREATE INDEX idx_student_profiles_target_degree_level_id ON public.student_profiles (target_degree_level_id);
CREATE INDEX idx_student_profiles_expires_at            ON public.student_profiles (expires_at);
CREATE INDEX idx_student_profiles_created_at            ON public.student_profiles (created_at);
CREATE INDEX idx_student_profiles_updated_at            ON public.student_profiles (updated_at);
-- Used by cleanup cron job to find expired anonymous profiles.
CREATE INDEX idx_student_profiles_anon_expires          ON public.student_profiles (expires_at)
  WHERE is_anonymous = true AND expires_at IS NOT NULL;

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- Logged-in users can read their own profiles.
CREATE POLICY "student_profiles_select_own" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Logged-in users can create only non-anonymous profiles for themselves.
CREATE POLICY "student_profiles_insert_own" ON public.student_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_anonymous = false
  );

-- Logged-in users can update only their own non-anonymous profiles.
-- WITH CHECK prevents a logged-in user from converting a normal profile into an
-- anonymous one by flipping is_anonymous or setting session_token.
CREATE POLICY "student_profiles_update_own" ON public.student_profiles
  FOR UPDATE TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND is_anonymous = false
    AND session_token IS NULL
  );

-- Logged-in users can delete their own profiles.
CREATE POLICY "student_profiles_delete_own" ON public.student_profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- super_admin can read all profiles for support and moderation.
CREATE POLICY "student_profiles_select_super_admin" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (has_role('super_admin'));

-- super_admin can delete any profile for support and moderation.
CREATE POLICY "student_profiles_delete_super_admin" ON public.student_profiles
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ============================================================
-- TABLE: student_profile_subjects
-- ============================================================
-- Subject preferences associated with a student profile.
-- Used by the Best-Fit Finder to filter programs by field of study.
-- ------------------------------------------------------------
CREATE TABLE public.student_profile_subjects (
  student_profile_id  uuid        NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  subject_id          uuid        NOT NULL REFERENCES public.subjects(id)          ON DELETE RESTRICT,
  preference_rank     integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_profile_id, subject_id)
);

-- PK covers (student_profile_id, subject_id). Index additional columns.
CREATE INDEX idx_student_profile_subjects_subject_id      ON public.student_profile_subjects (subject_id);
CREATE INDEX idx_student_profile_subjects_preference_rank ON public.student_profile_subjects (preference_rank);

ALTER TABLE public.student_profile_subjects ENABLE ROW LEVEL SECURITY;

-- Logged-in users can read subject preferences on their own profiles.
CREATE POLICY "student_profile_subjects_select_own" ON public.student_profile_subjects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_subjects.student_profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- Logged-in users can add subject preferences to their own profiles.
CREATE POLICY "student_profile_subjects_insert_own" ON public.student_profile_subjects
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_subjects.student_profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- Logged-in users can update subject preferences on their own profiles.
CREATE POLICY "student_profile_subjects_update_own" ON public.student_profile_subjects
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_subjects.student_profile_id
        AND sp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_subjects.student_profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- Logged-in users can remove subject preferences from their own profiles.
CREATE POLICY "student_profile_subjects_delete_own" ON public.student_profile_subjects
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_subjects.student_profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- super_admin can read and delete subject preferences for moderation.
CREATE POLICY "student_profile_subjects_select_super_admin" ON public.student_profile_subjects
  FOR SELECT TO authenticated
  USING (has_role('super_admin'));

CREATE POLICY "student_profile_subjects_delete_super_admin" ON public.student_profile_subjects
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));


-- ============================================================
-- TABLE: student_profile_countries
-- ============================================================
-- Target country preferences associated with a student profile.
-- Used by the Best-Fit Finder to filter programs by country.
-- ------------------------------------------------------------
CREATE TABLE public.student_profile_countries (
  student_profile_id  uuid        NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  country_id          uuid        NOT NULL REFERENCES public.countries(id)         ON DELETE RESTRICT,
  preference_rank     integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_profile_id, country_id)
);

CREATE INDEX idx_student_profile_countries_country_id      ON public.student_profile_countries (country_id);
CREATE INDEX idx_student_profile_countries_preference_rank ON public.student_profile_countries (preference_rank);

ALTER TABLE public.student_profile_countries ENABLE ROW LEVEL SECURITY;

-- Logged-in users can read country preferences on their own profiles.
CREATE POLICY "student_profile_countries_select_own" ON public.student_profile_countries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_countries.student_profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- Logged-in users can add country preferences to their own profiles.
CREATE POLICY "student_profile_countries_insert_own" ON public.student_profile_countries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_countries.student_profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- Logged-in users can update country preferences on their own profiles.
CREATE POLICY "student_profile_countries_update_own" ON public.student_profile_countries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_countries.student_profile_id
        AND sp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_countries.student_profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- Logged-in users can remove country preferences from their own profiles.
CREATE POLICY "student_profile_countries_delete_own" ON public.student_profile_countries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.id = student_profile_countries.student_profile_id
        AND sp.user_id = auth.uid()
    )
  );

-- super_admin can read and delete country preferences for moderation.
CREATE POLICY "student_profile_countries_select_super_admin" ON public.student_profile_countries
  FOR SELECT TO authenticated
  USING (has_role('super_admin'));

CREATE POLICY "student_profile_countries_delete_super_admin" ON public.student_profile_countries
  FOR DELETE TO authenticated
  USING (has_role('super_admin'));
