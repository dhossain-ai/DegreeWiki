-- ============================================================
-- Migration 030: Contributor Review Workflow Helper
-- ============================================================
-- Functions:
--   review_contributor_application()
--
-- Depends on:
--   002_auth_roles             -- user_profiles, user_roles, roles
--   029_contributor_foundation -- contributor tables, can_manage_contributor_records()
--
-- Purpose:
--   Adds a narrow authenticated review helper so approved reviewer/admin
--   users can move contributor applications through review without using
--   the service role in app runtime code.
-- ============================================================

CREATE OR REPLACE FUNCTION public.review_contributor_application(
  target_application_id uuid,
  next_status text,
  review_note text DEFAULT NULL,
  rejection_note text DEFAULT NULL,
  scope_country_ids uuid[] DEFAULT ARRAY[]::uuid[],
  scope_university_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
  application_id uuid,
  application_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  application_row public.contributor_applications%ROWTYPE;
  profile_row public.user_profiles%ROWTYPE;
  contributor_role_id uuid;
  selected_country_id uuid;
  selected_university_id uuid;
  normalized_review_note text := NULLIF(btrim(review_note), '');
  normalized_rejection_note text := NULLIF(btrim(rejection_note), '');
  enable_public_profile boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.can_manage_contributor_records() THEN
    RAISE EXCEPTION 'insufficient permissions to review contributor applications';
  END IF;

  IF next_status NOT IN ('pending_review', 'needs_more_info', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid contributor review status %', next_status;
  END IF;

  SELECT *
  INTO application_row
  FROM public.contributor_applications
  WHERE id = target_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contributor application not found';
  END IF;

  IF application_row.user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot review your own contributor application';
  END IF;

  IF next_status = 'pending_review'
     AND application_row.status NOT IN ('draft', 'submitted', 'needs_more_info', 'rejected')
  THEN
    RAISE EXCEPTION 'cannot mark contributor application % as pending review from %', application_row.id, application_row.status;
  END IF;

  IF next_status IN ('needs_more_info', 'rejected')
     AND application_row.status NOT IN ('submitted', 'pending_review', 'needs_more_info', 'rejected')
  THEN
    RAISE EXCEPTION 'cannot set contributor application % to % from %', application_row.id, next_status, application_row.status;
  END IF;

  IF next_status = 'approved'
     AND application_row.status NOT IN ('submitted', 'pending_review', 'needs_more_info')
  THEN
    RAISE EXCEPTION 'cannot approve contributor application % from %', application_row.id, application_row.status;
  END IF;

  IF next_status = 'needs_more_info' AND normalized_review_note IS NULL THEN
    RAISE EXCEPTION 'review note is required when requesting more information';
  END IF;

  IF next_status = 'rejected' AND COALESCE(normalized_rejection_note, normalized_review_note) IS NULL THEN
    RAISE EXCEPTION 'rejection reason is required when rejecting an application';
  END IF;

  SELECT *
  INTO profile_row
  FROM public.user_profiles
  WHERE id = application_row.user_id;

  UPDATE public.contributor_applications
  SET status = next_status,
      admin_notes = normalized_review_note,
      rejection_reason = CASE
        WHEN next_status = 'rejected' THEN COALESCE(normalized_rejection_note, normalized_review_note)
        ELSE NULL
      END,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now()
  WHERE id = application_row.id
  RETURNING *
  INTO application_row;

  IF next_status = 'approved' THEN
    enable_public_profile := application_row.public_profile_requested
      AND application_row.public_attribution_consent;

    INSERT INTO public.contributor_profiles (
      user_id,
      public_display_name,
      public_role_label,
      organization_name,
      headline,
      bio,
      contributor_type,
      affiliation_status,
      public_profile_enabled,
      profile_review_status,
      approved_at,
      approved_by_user_id,
      joined_at,
      public_since,
      external_links
    )
    VALUES (
      application_row.user_id,
      profile_row.display_name,
      application_row.role_title,
      application_row.organization_name,
      application_row.headline,
      application_row.bio_draft,
      application_row.requested_contributor_type,
      'affiliation_claimed',
      enable_public_profile,
      'approved',
      now(),
      auth.uid(),
      now(),
      CASE WHEN enable_public_profile THEN now() ELSE NULL END,
      application_row.external_links
    )
    ON CONFLICT (user_id) DO UPDATE
      SET public_display_name = COALESCE(public.contributor_profiles.public_display_name, EXCLUDED.public_display_name),
          public_role_label = COALESCE(EXCLUDED.public_role_label, public.contributor_profiles.public_role_label),
          organization_name = EXCLUDED.organization_name,
          headline = EXCLUDED.headline,
          bio = EXCLUDED.bio,
          contributor_type = EXCLUDED.contributor_type,
          affiliation_status = CASE
            WHEN public.contributor_profiles.affiliation_status IN (
              'affiliation_verified', 'trusted_contributor', 'official_partner'
            )
              THEN public.contributor_profiles.affiliation_status
            ELSE 'affiliation_claimed'
          END,
          public_profile_enabled = EXCLUDED.public_profile_enabled,
          profile_review_status = 'approved',
          approved_at = now(),
          approved_by_user_id = auth.uid(),
          joined_at = COALESCE(public.contributor_profiles.joined_at, now()),
          public_since = CASE
            WHEN EXCLUDED.public_profile_enabled
              THEN COALESCE(public.contributor_profiles.public_since, now())
            ELSE NULL
          END,
          external_links = EXCLUDED.external_links;

    SELECT id
    INTO contributor_role_id
    FROM public.roles
    WHERE code = 'contributor'
    LIMIT 1;

    IF contributor_role_id IS NULL THEN
      RAISE EXCEPTION 'contributor role seed is missing';
    END IF;

    INSERT INTO public.user_roles (user_id, role_id, granted_by_user_id)
    VALUES (application_row.user_id, contributor_role_id, auth.uid())
    ON CONFLICT (user_id, role_id) DO NOTHING;

    FOREACH selected_country_id IN ARRAY COALESCE(scope_country_ids, ARRAY[]::uuid[]) LOOP
      CONTINUE WHEN selected_country_id IS NULL;

      IF EXISTS (
        SELECT 1
        FROM public.contributor_scopes
        WHERE contributor_user_id = application_row.user_id
          AND scope_type = 'country'
          AND country_id = selected_country_id
      ) THEN
        UPDATE public.contributor_scopes
        SET approved_by_user_id = auth.uid(),
            approved_at = COALESCE(approved_at, now()),
            is_active = true
        WHERE contributor_user_id = application_row.user_id
          AND scope_type = 'country'
          AND country_id = selected_country_id;
      ELSE
        INSERT INTO public.contributor_scopes (
          contributor_user_id,
          scope_type,
          country_id,
          approved_by_user_id,
          approved_at,
          is_active
        )
        VALUES (
          application_row.user_id,
          'country',
          selected_country_id,
          auth.uid(),
          now(),
          true
        );
      END IF;
    END LOOP;

    FOREACH selected_university_id IN ARRAY COALESCE(scope_university_ids, ARRAY[]::uuid[]) LOOP
      CONTINUE WHEN selected_university_id IS NULL;

      IF EXISTS (
        SELECT 1
        FROM public.contributor_scopes
        WHERE contributor_user_id = application_row.user_id
          AND scope_type = 'university'
          AND university_id = selected_university_id
      ) THEN
        UPDATE public.contributor_scopes
        SET approved_by_user_id = auth.uid(),
            approved_at = COALESCE(approved_at, now()),
            is_active = true
        WHERE contributor_user_id = application_row.user_id
          AND scope_type = 'university'
          AND university_id = selected_university_id;
      ELSE
        INSERT INTO public.contributor_scopes (
          contributor_user_id,
          scope_type,
          university_id,
          approved_by_user_id,
          approved_at,
          is_active
        )
        VALUES (
          application_row.user_id,
          'university',
          selected_university_id,
          auth.uid(),
          now(),
          true
        );
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT application_row.id, application_row.status;
END;
$$;
