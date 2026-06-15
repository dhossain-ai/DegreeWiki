-- ============================================================
-- Migration 002: Auth, Roles, and Admin Logs
-- ============================================================
-- Tables:    user_profiles, roles, user_roles, permissions,
--            role_permissions, admin_activity_logs
-- Functions: handle_new_user() trigger, has_role(), has_permission()
--
-- Order rationale:
--   Tables are created first, with only simple RLS policies that
--   do not reference has_role() or has_permission(). The helper
--   functions are defined after all their dependent tables exist.
--   Permission-based policies are added last, after the functions.
--
--   This avoids a "function does not exist" error at policy
--   creation time while ensuring no table is left unprotected.
-- ============================================================


-- ============================================================
-- TABLES
-- ============================================================

-- ------------------------------------------------------------
-- user_profiles
-- App-level user data linked to Supabase Auth users (auth.users).
-- A row is auto-created here by the handle_new_user() trigger
-- when a user signs up. Direct browser writes are not allowed.
-- All profile updates go through server endpoints.
-- ------------------------------------------------------------
CREATE TABLE public.user_profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text,
  avatar_url     text,
  account_status text        NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'disabled', 'suspended', 'deleted', 'pending_review')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_profiles_account_status ON public.user_profiles (account_status);
CREATE INDEX idx_user_profiles_created_at     ON public.user_profiles (created_at);
CREATE INDEX idx_user_profiles_updated_at     ON public.user_profiles (updated_at);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can always read their own profile row
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- NOTE: The super_admin SELECT ALL policy is added below after has_role() exists.
-- No INSERT / UPDATE / DELETE policies for browser clients.
-- Profile creation: handled by the handle_new_user trigger.
-- Profile updates:  handled by server endpoints using service role.


-- ------------------------------------------------------------
-- roles
-- Named application roles.
-- Seeded in migration 015 with the five MVP roles:
--   student, content_admin, reviewer,
--   data_import_manager, super_admin
-- ------------------------------------------------------------
CREATE TABLE public.roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- code UNIQUE constraint auto-creates an index — no additional index needed.

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can see the list of roles.
-- Needed so the application can display a user's role in the UI.
CREATE POLICY "roles_select_authenticated" ON public.roles
  FOR SELECT TO authenticated
  USING (true);

-- NOTE: Write policy (super_admin only) is added below after has_role() exists.


-- ------------------------------------------------------------
-- user_roles
-- Assigns one or more roles to a user.
-- A user may hold multiple roles simultaneously.
-- All changes are made by super_admin via server endpoints.
-- ------------------------------------------------------------
CREATE TABLE public.user_roles (
  user_id            uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id            uuid        NOT NULL REFERENCES public.roles(id)         ON DELETE RESTRICT,
  granted_at         timestamptz NOT NULL DEFAULT now(),
  granted_by_user_id uuid        REFERENCES public.user_profiles(id)         ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);
-- PK index covers (user_id, role_id). Add indexes for the other FK columns.
CREATE INDEX idx_user_roles_role_id     ON public.user_roles (role_id);
CREATE INDEX idx_user_roles_granted_by  ON public.user_roles (granted_by_user_id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can see their own role assignments.
-- Needed so the client knows which UI features to show.
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- NOTE: Super-admin ALL policy is added below after has_role() exists.


-- ------------------------------------------------------------
-- permissions
-- Named permission codes used throughout the application.
-- Examples: edit_content, publish_content, manage_imports.
-- Seeded in migration 015.
-- ------------------------------------------------------------
CREATE TABLE public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text
);
-- code UNIQUE constraint auto-creates an index.

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the permissions list.
-- Needed so the client can verify what the current user can do
-- without a round-trip to the server for every UI decision.
CREATE POLICY "permissions_select_authenticated" ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

-- NOTE: Write policy (super_admin only) is added below after has_role() exists.


-- ------------------------------------------------------------
-- role_permissions
-- Maps permissions to roles.
-- A role may hold many permissions.
-- Seeded in migration 015 with the MVP permission map.
-- ------------------------------------------------------------
CREATE TABLE public.role_permissions (
  role_id       uuid NOT NULL REFERENCES public.roles(id)       ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE RESTRICT,
  PRIMARY KEY (role_id, permission_id)
);
-- PK covers (role_id, permission_id). Index permission_id for reverse lookups.
CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions (permission_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read role-permission mappings.
-- This is required so has_permission() can resolve permissions
-- for the calling user through their assigned roles.
CREATE POLICY "role_permissions_select_authenticated" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (true);

-- NOTE: Write policy (super_admin only) is added below after has_role() exists.


-- ------------------------------------------------------------
-- admin_activity_logs
-- Append-only audit trail for all admin actions.
-- Written ONLY by server endpoints using the service role.
-- INSERT from browser/authenticated clients is intentionally blocked.
-- Readable only by users with the view_admin_logs permission.
-- No UPDATE or DELETE is ever permitted — audit logs are immutable.
-- ------------------------------------------------------------
CREATE TABLE public.admin_activity_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action_type  text        NOT NULL,
  entity_type  text
    CHECK (entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id    uuid,
  before_state jsonb,
  after_state  jsonb,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_logs_user_id    ON public.admin_activity_logs (user_id);
CREATE INDEX idx_admin_logs_entity     ON public.admin_activity_logs (entity_type, entity_id);
CREATE INDEX idx_admin_logs_created_at ON public.admin_activity_logs (created_at);

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
-- No policies yet — deny all until has_permission() is defined below.


-- ============================================================
-- TRIGGER: auto-create user_profiles row on new auth sign-up
-- ============================================================
-- Runs as SECURITY DEFINER (postgres role) so it can INSERT into
-- user_profiles regardless of RLS. Only inserts the id — all
-- other profile fields are set later via server endpoints.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
-- Defined after all dependent tables exist.
--
-- Both functions are SECURITY DEFINER so they run as the
-- function owner (postgres), bypassing RLS on user_roles,
-- roles, role_permissions, and permissions when resolving
-- the calling user's access. This prevents infinite recursion
-- when these tables themselves have RLS policies.
--
-- SET search_path = '' requires fully qualified table names
-- (public.*) to prevent search_path injection attacks.
-- ------------------------------------------------------------

-- Returns true if the current authenticated user holds the named role.
-- Returns false for unauthenticated requests (auth.uid() is null).
CREATE OR REPLACE FUNCTION public.has_role(role_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.user_roles ur
    JOIN   public.roles r ON r.id = ur.role_id
    WHERE  ur.user_id = auth.uid()
    AND    r.code     = role_code
  );
$$;

-- Returns true if the current authenticated user holds the named
-- permission through ANY of their assigned roles.
-- Returns false for unauthenticated requests.
CREATE OR REPLACE FUNCTION public.has_permission(permission_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.user_roles       ur
    JOIN   public.role_permissions rp ON rp.role_id       = ur.role_id
    JOIN   public.permissions      p  ON p.id             = rp.permission_id
    WHERE  ur.user_id = auth.uid()
    AND    p.code     = permission_code
  );
$$;


-- ============================================================
-- RLS POLICIES THAT REQUIRE has_role() / has_permission()
-- Added here, after the helper functions are defined.
-- ============================================================

-- user_profiles: super_admin can read all profiles
CREATE POLICY "user_profiles_select_super_admin" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (has_role('super_admin'));

-- roles: only super_admin can create, update, or delete roles
CREATE POLICY "roles_all_super_admin" ON public.roles
  FOR ALL TO authenticated
  USING     (has_role('super_admin'))
  WITH CHECK (has_role('super_admin'));

-- user_roles: super_admin can read and manage all role assignments
CREATE POLICY "user_roles_all_super_admin" ON public.user_roles
  FOR ALL TO authenticated
  USING     (has_role('super_admin'))
  WITH CHECK (has_role('super_admin'));

-- permissions: only super_admin can create, update, or delete permissions
CREATE POLICY "permissions_all_super_admin" ON public.permissions
  FOR ALL TO authenticated
  USING     (has_role('super_admin'))
  WITH CHECK (has_role('super_admin'));

-- role_permissions: only super_admin can manage the permission map
CREATE POLICY "role_permissions_all_super_admin" ON public.role_permissions
  FOR ALL TO authenticated
  USING     (has_role('super_admin'))
  WITH CHECK (has_role('super_admin'));

-- admin_activity_logs: SELECT requires view_admin_logs permission.
-- No INSERT policy for authenticated clients — all writes use the service role
-- through server endpoints. The service role bypasses RLS by default.
-- No UPDATE or DELETE policies — audit logs are immutable.
CREATE POLICY "admin_logs_select_permitted" ON public.admin_activity_logs
  FOR SELECT TO authenticated
  USING (has_permission('view_admin_logs'));
