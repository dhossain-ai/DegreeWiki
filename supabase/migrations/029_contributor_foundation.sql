-- ============================================================
-- Migration 029: Contributor Foundation
-- ============================================================
-- Tables:
--   contributor_applications
--   contributor_profiles
--   contributor_scopes
--   contributor_profile_subjects
--   contributor_submissions
--   contributor_submission_sources
--
-- Depends on:
--   001_custom_types        — update_updated_at_column()
--   002_auth_roles          — roles, user_profiles, has_role(), has_permission()
--   003_media               — media_assets
--   004_lookup_tables       — countries, subjects
--   005_universities_campuses — universities
--
-- Purpose:
--   Adds the contributor foundation used for application review,
--   approved contributor profiles, approved contributor scope, and
--   future reviewed correction/confirmation submissions.
--
-- Security rules:
--   Contributors use the existing shared auth system.
--   The new contributor role receives NO admin permissions.
--   Contributors never write directly to live public content tables.
--   Review and approval remain with admin/reviewer users.
-- ============================================================


-- ============================================================
-- ROLE SEED
-- ============================================================
-- Contributor is a non-admin role. No rows are inserted into
-- role_permissions for this role in this migration.
-- ============================================================
INSERT INTO public.roles (code, name, description)
VALUES (
  'contributor',
  'Contributor',
  'Approved contributor account for reviewed corrections, confirmations, source-backed evidence, and expertise submissions.'
)
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description;


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
-- Reviewer/admin management for contributor foundation records.
-- Uses the existing security-definer helpers from migration 002.
-- edit_content covers current content_admin and reviewer roles.
-- manage_users is included for future user-management workflows.
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_contributor_records()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    public.has_permission('edit_content')
    OR public.has_permission('manage_users')
    OR public.has_role('super_admin');
$$;


-- ============================================================
-- TABLE: contributor_applications
-- ============================================================
CREATE TABLE public.contributor_applications (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status                      text        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'submitted', 'pending_review', 'needs_more_info',
      'approved', 'rejected', 'withdrawn', 'suspended'
    )),
  requested_contributor_type  text
    CHECK (requested_contributor_type IN (
      'student', 'alumni', 'professor', 'university_staff',
      'counselor', 'education_expert', 'other'
    )),
  headline                    text,
  organization_name           text,
  role_title                  text,
  country_expertise_text      text,
  university_expertise_text   text,
  subject_expertise_text      text,
  bio_draft                   text,
  motivation                  text,
  public_profile_requested    boolean     NOT NULL DEFAULT false,
  public_attribution_consent  boolean     NOT NULL DEFAULT false,
  external_links              jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(external_links) = 'array'),
  proof_storage_path          text,
  proof_file_name             text,
  proof_mime_type             text,
  proof_uploaded_at           timestamptz,
  admin_notes                 text,
  rejection_reason            text,
  reviewed_by_user_id         uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at                 timestamptz,
  submitted_at                timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_contributor_applications_updated_at
  BEFORE UPDATE ON public.contributor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contributor_applications_user_status
  ON public.contributor_applications (user_id, status);
CREATE INDEX idx_contributor_applications_reviewed_by
  ON public.contributor_applications (reviewed_by_user_id);
CREATE INDEX idx_contributor_applications_created_at
  ON public.contributor_applications (created_at);
CREATE INDEX idx_contributor_applications_updated_at
  ON public.contributor_applications (updated_at);

ALTER TABLE public.contributor_applications ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- TABLE: contributor_profiles
-- ============================================================
CREATE TABLE public.contributor_profiles (
  user_id                      uuid        PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  slug                         text UNIQUE,
  public_display_name          text,
  public_role_label            text,
  organization_name           text,
  headline                    text,
  bio                         text,
  contributor_type            text
    CHECK (contributor_type IN (
      'student', 'alumni', 'professor', 'university_staff',
      'counselor', 'education_expert', 'other'
    )),
  affiliation_status          text        NOT NULL DEFAULT 'unverified'
    CHECK (affiliation_status IN (
      'unverified', 'email_verified', 'affiliation_claimed',
      'affiliation_verified', 'trusted_contributor',
      'official_partner', 'suspended'
    )),
  public_profile_enabled      boolean     NOT NULL DEFAULT false,
  profile_review_status       text        NOT NULL DEFAULT 'pending_review'
    CHECK (profile_review_status IN (
      'pending_review', 'approved', 'rejected', 'disabled', 'suspended'
    )),
  approved_at                 timestamptz,
  approved_by_user_id         uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  joined_at                   timestamptz,
  public_since                timestamptz,
  approved_contribution_count integer     NOT NULL DEFAULT 0
    CHECK (approved_contribution_count >= 0),
  external_links              jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(external_links) = 'array'),
  avatar_source               text        NOT NULL DEFAULT 'default_initials'
    CHECK (avatar_source IN ('google', 'uploaded', 'default_initials')),
  avatar_url                  text,
  avatar_media_asset_id       uuid        REFERENCES public.media_assets(id) ON DELETE SET NULL,
  public_avatar_enabled       boolean     NOT NULL DEFAULT false,
  avatar_review_status        text        NOT NULL DEFAULT 'not_needed'
    CHECK (avatar_review_status IN ('not_needed', 'pending_review', 'approved', 'rejected')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_contributor_profiles_updated_at
  BEFORE UPDATE ON public.contributor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contributor_profiles_review_visibility
  ON public.contributor_profiles (profile_review_status, public_profile_enabled);
CREATE INDEX idx_contributor_profiles_public_since
  ON public.contributor_profiles (public_since);
CREATE INDEX idx_contributor_profiles_avatar_media_asset_id
  ON public.contributor_profiles (avatar_media_asset_id);

ALTER TABLE public.contributor_profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- TABLE: contributor_scopes
-- ============================================================
CREATE TABLE public.contributor_scopes (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_user_id  uuid        NOT NULL REFERENCES public.contributor_profiles(user_id) ON DELETE CASCADE,
  scope_type           text        NOT NULL
    CHECK (scope_type IN ('country', 'university', 'subject')),
  country_id           uuid        REFERENCES public.countries(id)    ON DELETE CASCADE,
  university_id        uuid        REFERENCES public.universities(id) ON DELETE CASCADE,
  subject_id           uuid        REFERENCES public.subjects(id)     ON DELETE CASCADE,
  notes                text,
  approved_by_user_id  uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at          timestamptz,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_contributor_scopes_shape
    CHECK (
      (scope_type = 'country' AND country_id IS NOT NULL AND university_id IS NULL AND subject_id IS NULL)
      OR
      (scope_type = 'university' AND country_id IS NULL AND university_id IS NOT NULL AND subject_id IS NULL)
      OR
      (scope_type = 'subject' AND country_id IS NULL AND university_id IS NULL AND subject_id IS NOT NULL)
    )
);

CREATE TRIGGER set_contributor_scopes_updated_at
  BEFORE UPDATE ON public.contributor_scopes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contributor_scopes_contributor_user_id
  ON public.contributor_scopes (contributor_user_id);
CREATE INDEX idx_contributor_scopes_country_id
  ON public.contributor_scopes (country_id);
CREATE INDEX idx_contributor_scopes_university_id
  ON public.contributor_scopes (university_id);
CREATE INDEX idx_contributor_scopes_subject_id
  ON public.contributor_scopes (subject_id);
CREATE UNIQUE INDEX idx_contributor_scopes_country_unique
  ON public.contributor_scopes (contributor_user_id, country_id)
  WHERE scope_type = 'country';
CREATE UNIQUE INDEX idx_contributor_scopes_university_unique
  ON public.contributor_scopes (contributor_user_id, university_id)
  WHERE scope_type = 'university';
CREATE UNIQUE INDEX idx_contributor_scopes_subject_unique
  ON public.contributor_scopes (contributor_user_id, subject_id)
  WHERE scope_type = 'subject';

ALTER TABLE public.contributor_scopes ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- TABLE: contributor_profile_subjects
-- ============================================================
CREATE TABLE public.contributor_profile_subjects (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_user_id  uuid        NOT NULL REFERENCES public.contributor_profiles(user_id) ON DELETE CASCADE,
  subject_id           uuid        NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  expertise_level      text,
  display_order        integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contributor_user_id, subject_id)
);

CREATE INDEX idx_contributor_profile_subjects_contributor_user_id
  ON public.contributor_profile_subjects (contributor_user_id);
CREATE INDEX idx_contributor_profile_subjects_subject_id
  ON public.contributor_profile_subjects (subject_id);

ALTER TABLE public.contributor_profile_subjects ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- TABLE: contributor_submissions
-- ============================================================
CREATE TABLE public.contributor_submissions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_user_id     uuid        NOT NULL REFERENCES public.contributor_profiles(user_id) ON DELETE CASCADE,
  submission_type         text        NOT NULL
    CHECK (submission_type IN (
      'correction', 'confirmation', 'source_addition',
      'active_status_confirmation', 'missing_information', 'outdated_information'
    )),
  target_entity_type      text        NOT NULL
    CHECK (target_entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article',
      'article_category', 'seo_landing_page', 'data_source'
    )),
  target_entity_id        uuid        NOT NULL,
  target_field            text,
  current_value_snapshot  jsonb,
  proposed_value          jsonb,
  summary                 text        NOT NULL,
  explanation             text,
  status                  text        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'submitted', 'pending_review', 'approved',
      'rejected', 'needs_more_info', 'withdrawn'
    )),
  reviewed_by_user_id     uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  review_notes            text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_contributor_submissions_updated_at
  BEFORE UPDATE ON public.contributor_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contributor_submissions_user_status
  ON public.contributor_submissions (contributor_user_id, status);
CREATE INDEX idx_contributor_submissions_target_entity
  ON public.contributor_submissions (target_entity_type, target_entity_id);
CREATE INDEX idx_contributor_submissions_reviewed_by
  ON public.contributor_submissions (reviewed_by_user_id);
CREATE INDEX idx_contributor_submissions_created_at
  ON public.contributor_submissions (created_at);
CREATE INDEX idx_contributor_submissions_updated_at
  ON public.contributor_submissions (updated_at);

ALTER TABLE public.contributor_submissions ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- TABLE: contributor_submission_sources
-- ============================================================
CREATE TABLE public.contributor_submission_sources (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_submission_id  uuid        NOT NULL REFERENCES public.contributor_submissions(id) ON DELETE CASCADE,
  source_url                 text        NOT NULL,
  source_title               text,
  source_type                text,
  source_note                text,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contributor_submission_sources_submission_id
  ON public.contributor_submission_sources (contributor_submission_id);

ALTER TABLE public.contributor_submission_sources ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- OWNER UPDATE GUARDS
-- ============================================================
-- Owner edits are intentionally narrow so future application or
-- contributor submission endpoints can reuse the tables safely
-- without letting owners self-approve or self-review.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_contributor_application_owner_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.user_id = auth.uid() AND NOT public.can_manage_contributor_records() THEN
    IF OLD.status NOT IN ('draft', 'needs_more_info') THEN
      RAISE EXCEPTION 'contributor application is locked';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'cannot reassign contributor application owner';
    END IF;

    IF NEW.reviewed_by_user_id IS DISTINCT FROM OLD.reviewed_by_user_id
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
      OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
    THEN
      RAISE EXCEPTION 'owner cannot modify contributor application review fields';
    END IF;

    IF NEW.status NOT IN ('draft', 'submitted', 'needs_more_info', 'withdrawn') THEN
      RAISE EXCEPTION 'owner cannot set contributor application status to %', NEW.status;
    END IF;

    IF NEW.status = 'submitted' AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at = COALESCE(OLD.submitted_at, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_contributor_application_owner_update
  BEFORE UPDATE ON public.contributor_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contributor_application_owner_update();

CREATE OR REPLACE FUNCTION public.enforce_contributor_submission_owner_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.contributor_user_id = auth.uid() AND NOT public.can_manage_contributor_records() THEN
    IF OLD.status NOT IN ('draft', 'needs_more_info') THEN
      RAISE EXCEPTION 'contributor submission is locked';
    END IF;

    IF NEW.contributor_user_id IS DISTINCT FROM OLD.contributor_user_id THEN
      RAISE EXCEPTION 'cannot reassign contributor submission owner';
    END IF;

    IF NEW.reviewed_by_user_id IS DISTINCT FROM OLD.reviewed_by_user_id
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
    THEN
      RAISE EXCEPTION 'owner cannot modify contributor submission review fields';
    END IF;

    IF NEW.status NOT IN ('draft', 'submitted', 'needs_more_info', 'withdrawn') THEN
      RAISE EXCEPTION 'owner cannot set contributor submission status to %', NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_contributor_submission_owner_update
  BEFORE UPDATE ON public.contributor_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contributor_submission_owner_update();


-- ============================================================
-- RLS: contributor_applications
-- ============================================================
CREATE POLICY "contributor_applications_select_own" ON public.contributor_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contributor_applications_insert_own" ON public.contributor_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND reviewed_by_user_id IS NULL
    AND reviewed_at IS NULL
  );

CREATE POLICY "contributor_applications_update_own" ON public.contributor_applications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('draft', 'needs_more_info')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'submitted', 'needs_more_info', 'withdrawn')
  );

CREATE POLICY "contributor_applications_select_managers" ON public.contributor_applications
  FOR SELECT TO authenticated
  USING (public.can_manage_contributor_records());

CREATE POLICY "contributor_applications_update_managers" ON public.contributor_applications
  FOR UPDATE TO authenticated
  USING (public.can_manage_contributor_records())
  WITH CHECK (public.can_manage_contributor_records());


-- ============================================================
-- RLS: contributor_profiles
-- ============================================================
-- Public contributor profile reads are intentionally deferred.
-- RLS is row-level, not column-level, and later public exposure
-- needs stricter gating for avatar, external-link, and other
-- profile-field visibility through a safe public view or route.

CREATE POLICY "contributor_profiles_select_own" ON public.contributor_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contributor_profiles_all_managers" ON public.contributor_profiles
  FOR ALL TO authenticated
  USING (public.can_manage_contributor_records())
  WITH CHECK (public.can_manage_contributor_records());


-- ============================================================
-- RLS: contributor_scopes
-- ============================================================
CREATE POLICY "contributor_scopes_select_own" ON public.contributor_scopes
  FOR SELECT TO authenticated
  USING (contributor_user_id = auth.uid());

CREATE POLICY "contributor_scopes_all_managers" ON public.contributor_scopes
  FOR ALL TO authenticated
  USING (public.can_manage_contributor_records())
  WITH CHECK (public.can_manage_contributor_records());


-- ============================================================
-- RLS: contributor_profile_subjects
-- ============================================================
CREATE POLICY "contributor_profile_subjects_select_own" ON public.contributor_profile_subjects
  FOR SELECT TO authenticated
  USING (contributor_user_id = auth.uid());

CREATE POLICY "contributor_profile_subjects_all_managers" ON public.contributor_profile_subjects
  FOR ALL TO authenticated
  USING (public.can_manage_contributor_records())
  WITH CHECK (public.can_manage_contributor_records());


-- ============================================================
-- RLS: contributor_submissions
-- ============================================================
CREATE POLICY "contributor_submissions_select_own" ON public.contributor_submissions
  FOR SELECT TO authenticated
  USING (contributor_user_id = auth.uid());

CREATE POLICY "contributor_submissions_insert_own" ON public.contributor_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    contributor_user_id = auth.uid()
    AND has_role('contributor')
    AND status IN ('draft', 'submitted')
    AND reviewed_by_user_id IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.contributor_profiles cp
      WHERE cp.user_id = contributor_submissions.contributor_user_id
        AND cp.profile_review_status = 'approved'
    )
  );

CREATE POLICY "contributor_submissions_update_own" ON public.contributor_submissions
  FOR UPDATE TO authenticated
  USING (
    contributor_user_id = auth.uid()
    AND has_role('contributor')
    AND status IN ('draft', 'needs_more_info')
  )
  WITH CHECK (
    contributor_user_id = auth.uid()
    AND has_role('contributor')
    AND status IN ('draft', 'submitted', 'needs_more_info', 'withdrawn')
  );

CREATE POLICY "contributor_submissions_select_managers" ON public.contributor_submissions
  FOR SELECT TO authenticated
  USING (public.can_manage_contributor_records());

CREATE POLICY "contributor_submissions_update_managers" ON public.contributor_submissions
  FOR UPDATE TO authenticated
  USING (public.can_manage_contributor_records())
  WITH CHECK (public.can_manage_contributor_records());


-- ============================================================
-- RLS: contributor_submission_sources
-- ============================================================
CREATE POLICY "contributor_submission_sources_select_own" ON public.contributor_submission_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contributor_submissions cs
      WHERE cs.id = contributor_submission_sources.contributor_submission_id
        AND cs.contributor_user_id = auth.uid()
    )
  );

CREATE POLICY "contributor_submission_sources_insert_own" ON public.contributor_submission_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contributor_submissions cs
      WHERE cs.id = contributor_submission_sources.contributor_submission_id
        AND cs.contributor_user_id = auth.uid()
        AND cs.status IN ('draft', 'needs_more_info')
        AND has_role('contributor')
    )
  );

CREATE POLICY "contributor_submission_sources_update_own" ON public.contributor_submission_sources
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contributor_submissions cs
      WHERE cs.id = contributor_submission_sources.contributor_submission_id
        AND cs.contributor_user_id = auth.uid()
        AND cs.status IN ('draft', 'needs_more_info')
        AND has_role('contributor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contributor_submissions cs
      WHERE cs.id = contributor_submission_sources.contributor_submission_id
        AND cs.contributor_user_id = auth.uid()
        AND cs.status IN ('draft', 'needs_more_info')
        AND has_role('contributor')
    )
  );

CREATE POLICY "contributor_submission_sources_delete_own" ON public.contributor_submission_sources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contributor_submissions cs
      WHERE cs.id = contributor_submission_sources.contributor_submission_id
        AND cs.contributor_user_id = auth.uid()
        AND cs.status IN ('draft', 'needs_more_info')
        AND has_role('contributor')
    )
  );

CREATE POLICY "contributor_submission_sources_all_managers" ON public.contributor_submission_sources
  FOR ALL TO authenticated
  USING (public.can_manage_contributor_records())
  WITH CHECK (public.can_manage_contributor_records());
