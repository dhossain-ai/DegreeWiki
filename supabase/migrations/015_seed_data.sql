-- ============================================================
-- Migration 015: Seed Data
-- ============================================================
-- Populates stable lookup and permission data required for the
-- application to function after the schema is deployed.
--
-- This migration is IDEMPOTENT.
-- Every INSERT uses ON CONFLICT ... DO UPDATE or DO NOTHING.
-- Running this migration multiple times is safe.
--
-- What IS seeded here:
--   degree_levels      — 7 academic qualification levels
--   roles              — 5 MVP application roles
--   permissions        — 20 named permission codes
--   role_permissions   — permission map for all 5 roles
--   article_categories — 7 starter guide categories
--   seo_page_types     — 6 SEO landing page type definitions
--   report_categories  — 6 user report classification codes
--
-- What is NOT seeded here:
--   countries, subjects, universities, programs, scholarships,
--   articles, seo_landing_pages, analytics rows, user rows.
--
-- BOOTSTRAP NOTE:
--   The first super_admin user cannot be assigned here because
--   auth.users is environment-specific (each Supabase project has
--   its own auth.users table). The first super_admin role
--   assignment must be done AFTER a real user has signed up,
--   using one of these methods:
--
--     1. Supabase Dashboard → SQL Editor:
--          INSERT INTO public.user_roles (user_id, role_id)
--          SELECT '<your-user-uuid>',
--                 (SELECT id FROM public.roles WHERE code = 'super_admin');
--
--     2. A local seed script executed with SUPABASE_SERVICE_ROLE_KEY.
--
--     3. supabase db seed with a conditional local-only seed file.
--
--   After the first super_admin exists, all subsequent role
--   assignments can be made through the admin dashboard server
--   endpoints, which use the service role.
-- ============================================================


-- ============================================================
-- degree_levels
-- ============================================================
-- Stable academic qualification levels used across programs,
-- student profiles, scholarships, and SEO landing pages.
-- display_order controls the sort order in dropdowns and filters.
-- ============================================================
INSERT INTO public.degree_levels (code, name, display_order, is_active)
VALUES
  ('bachelor',    'Bachelor''s Degree',  1, true),
  ('master',      'Master''s Degree',    2, true),
  ('phd',         'PhD / Doctorate',     3, true),
  ('foundation',  'Foundation Year',     4, true),
  ('diploma',     'Diploma',             5, true),
  ('certificate', 'Certificate',         6, true),
  ('associate',   'Associate''s Degree', 7, true)
ON CONFLICT (code) DO UPDATE
  SET name          = EXCLUDED.name,
      display_order = EXCLUDED.display_order,
      is_active     = EXCLUDED.is_active;


-- ============================================================
-- roles
-- ============================================================
-- The five MVP application roles.
--
--   student              — standard student account, no admin access
--   content_admin        — manages content, media, and editorial data
--   reviewer             — reviews content for publication and data quality
--   data_import_manager  — manages data imports and staging pipeline
--   super_admin          — full platform access
-- ============================================================
INSERT INTO public.roles (code, name, description)
VALUES
  (
    'student',
    'Student',
    'Standard user account for students browsing, saving programs, and using AI Finder.'
  ),
  (
    'content_admin',
    'Content Admin',
    'Can create and edit content including programs, universities, scholarships, articles, media, and SEO pages.'
  ),
  (
    'reviewer',
    'Reviewer',
    'Can review and publish content, manage data sources, and handle user-submitted reports.'
  ),
  (
    'data_import_manager',
    'Data Import Manager',
    'Can manage data imports, approve or reject staging records, and review data quality.'
  ),
  (
    'super_admin',
    'Super Admin',
    'Full access to all platform features, settings, roles, and administrative functions.'
  )
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description;


-- ============================================================
-- permissions
-- ============================================================
-- Named permission codes checked by has_permission() in RLS
-- policies and server endpoints.
-- ============================================================
INSERT INTO public.permissions (code, name, description)
VALUES
  (
    'edit_content',
    'Edit Content',
    'Create and edit draft, in-review, unpublished, and archived content records.'
  ),
  (
    'publish_content',
    'Publish Content',
    'Set content_status to published, making it visible to the public.'
  ),
  (
    'manage_imports',
    'Manage Imports',
    'Create import batches, upload import files, and manage the staging pipeline.'
  ),
  (
    'manage_media',
    'Manage Media',
    'Upload, update, and delete media assets in the media library.'
  ),
  (
    'manage_reports',
    'Manage Reports',
    'Read and update user-submitted content reports and correction requests.'
  ),
  (
    'view_analytics',
    'View Analytics',
    'Read analytics events, search logs, and outbound click data.'
  ),
  (
    'view_ai_logs',
    'View AI Logs',
    'Read AI usage logs including token counts, model used, and cost estimates.'
  ),
  (
    'view_data_quality',
    'View Data Quality',
    'Read data sources, verification events, and data quality check results.'
  ),
  (
    'manage_data_sources',
    'Manage Data Sources',
    'Create, update, and delete data sources, snapshots, and verification events.'
  ),
  (
    'manage_settings',
    'Manage Settings',
    'Update configuration and lookup tables: degree levels, report categories, SEO page types, article categories.'
  ),
  (
    'manage_users',
    'Manage Users',
    'View and update user account status and profile information.'
  ),
  (
    'manage_roles',
    'Manage Roles',
    'Assign and revoke roles from user accounts.'
  ),
  (
    'view_admin_logs',
    'View Admin Logs',
    'Read the admin activity audit log.'
  ),
  (
    'approve_import',
    'Approve Import',
    'Approve staged records for promotion to live tables.'
  ),
  (
    'reject_import',
    'Reject Import',
    'Reject staged records and mark them as not to be published.'
  ),
  (
    'manage_scholarships',
    'Manage Scholarships',
    'Create and edit scholarship records and scholarship junction data.'
  ),
  (
    'manage_universities',
    'Manage Universities',
    'Create and edit university and campus records.'
  ),
  (
    'manage_programs',
    'Manage Programs',
    'Create and edit program records, subjects, and intake data.'
  ),
  (
    'manage_articles',
    'Manage Articles',
    'Create and edit guide and article content.'
  ),
  (
    'manage_seo_pages',
    'Manage SEO Pages',
    'Create and edit SEO landing pages.'
  )
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description;


-- ============================================================
-- role_permissions
-- ============================================================
-- Maps permissions to roles.
--
--   student              — no admin permissions
--   content_admin        — edit_content, manage_media, manage_programs,
--                          manage_universities, manage_scholarships,
--                          manage_articles, manage_seo_pages
--   reviewer             — edit_content, publish_content,
--                          view_data_quality, manage_data_sources,
--                          manage_reports
--   data_import_manager  — manage_imports, approve_import,
--                          reject_import, view_data_quality,
--                          manage_data_sources
--   super_admin          — all permissions
--
-- ON CONFLICT DO NOTHING ensures this block is safe to re-run.
-- ============================================================

-- content_admin permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles       r
JOIN   public.permissions p ON p.code IN (
         'edit_content',
         'manage_media',
         'manage_programs',
         'manage_universities',
         'manage_scholarships',
         'manage_articles',
         'manage_seo_pages'
       )
WHERE  r.code = 'content_admin'
ON CONFLICT DO NOTHING;

-- reviewer permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles       r
JOIN   public.permissions p ON p.code IN (
         'edit_content',
         'publish_content',
         'view_data_quality',
         'manage_data_sources',
         'manage_reports'
       )
WHERE  r.code = 'reviewer'
ON CONFLICT DO NOTHING;

-- data_import_manager permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles       r
JOIN   public.permissions p ON p.code IN (
         'manage_imports',
         'approve_import',
         'reject_import',
         'view_data_quality',
         'manage_data_sources'
       )
WHERE  r.code = 'data_import_manager'
ON CONFLICT DO NOTHING;

-- super_admin receives all defined permissions.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles       r
CROSS  JOIN public.permissions p
WHERE  r.code = 'super_admin'
ON CONFLICT DO NOTHING;

-- student role: no admin permissions — no rows inserted.


-- ============================================================
-- article_categories
-- ============================================================
-- Starter guide categories for the articles/guides section.
-- display_order controls sort order in the category navigation.
-- ============================================================
INSERT INTO public.article_categories (name, slug, display_order)
VALUES
  ('Country Guides',     'country-guides',     1),
  ('University Guides',  'university-guides',  2),
  ('Program Guides',     'program-guides',     3),
  ('Scholarship Guides', 'scholarship-guides', 4),
  ('Application Advice', 'application-advice', 5),
  ('Visa and Work',      'visa-and-work',      6),
  ('Student Life',       'student-life',       7)
ON CONFLICT (slug) DO UPDATE
  SET name          = EXCLUDED.name,
      display_order = EXCLUDED.display_order;


-- ============================================================
-- seo_page_types
-- ============================================================
-- Defines the template types for programmatically generated
-- SEO landing pages. url_pattern uses [brackets] for dynamic
-- path segments.
-- ============================================================
INSERT INTO public.seo_page_types (code, name, description, url_pattern)
VALUES
  (
    'country_degree',
    'Programs by Country and Degree',
    'SEO landing page listing programs in a specific country at a specific degree level.',
    '/programs/[country]/[degree]'
  ),
  (
    'subject_degree',
    'Programs by Subject and Degree',
    'SEO landing page listing programs in a specific subject at a specific degree level.',
    '/programs/[subject]/[degree]'
  ),
  (
    'country_subject_degree',
    'Programs by Country, Subject, and Degree',
    'SEO landing page listing programs in a specific country, subject, and degree level combination.',
    '/programs/[country]/[subject]/[degree]'
  ),
  (
    'scholarship_country',
    'Scholarships by Country',
    'SEO landing page listing scholarships available in a specific country.',
    '/scholarships/[country]'
  ),
  (
    'scholarship_degree',
    'Scholarships by Degree Level',
    'SEO landing page listing scholarships available for a specific degree level.',
    '/scholarships/[degree]'
  ),
  (
    'attribute_degree',
    'Programs by Attribute and Degree',
    'SEO landing page listing programs filtered by a specific attribute and degree level.',
    '/programs/[attribute]/[degree]'
  )
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      url_pattern = EXCLUDED.url_pattern;


-- ============================================================
-- report_categories
-- ============================================================
-- Classification codes for user-submitted content reports.
-- ============================================================
INSERT INTO public.report_categories (code, name, description, is_active)
VALUES
  (
    'wrong_information',
    'Wrong Information',
    'The information shown is factually incorrect.',
    true
  ),
  (
    'broken_link',
    'Broken Link',
    'A link on this page is broken or leads to a 404 error.',
    true
  ),
  (
    'outdated_information',
    'Outdated Information',
    'The information shown is no longer current or up to date.',
    true
  ),
  (
    'duplicate_record',
    'Duplicate Record',
    'This entry appears to be a duplicate of another record on the platform.',
    true
  ),
  (
    'missing_information',
    'Missing Information',
    'Important information is missing from this page.',
    true
  ),
  (
    'other',
    'Other',
    'Another issue not covered by the categories above.',
    true
  )
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active   = EXCLUDED.is_active;
