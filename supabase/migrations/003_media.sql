-- ============================================================
-- Migration 003: Media Assets
-- ============================================================
-- Tables: media_assets, entity_media
--
-- Position rationale:
--   This migration runs BEFORE migration 004 (lookup tables)
--   because content tables from 004 onward include FK columns
--   such as og_image_id, logo_id, cover_image_id, and
--   featured_image_id that reference media_assets.id.
--   media_assets must exist before those columns can be declared.
--
-- Media architecture:
--   Cloudinary  — stores and delivers public image/document files.
--   This table  — stores Cloudinary metadata and controls which
--                 assets are safe for public use.
--   Supabase Storage — stores private and import files only.
--                      Those are NOT tracked in this table.
-- ============================================================


-- ------------------------------------------------------------
-- media_assets
-- One row per Cloudinary asset. An asset is only publicly
-- usable when is_public = true AND upload_status = 'ready'.
-- Both conditions must be met for public RLS SELECT to pass.
-- ------------------------------------------------------------
CREATE TABLE public.media_assets (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cloudinary_public_id text        NOT NULL UNIQUE,
  cloudinary_url       text        NOT NULL,
  alt_text             text,
  attribution          text,
  media_type           text        NOT NULL
    CHECK (media_type IN ('image', 'document')),
  -- is_public: admin must explicitly mark an asset as safe for public use.
  -- Default is false — assets are private until promoted.
  is_public            boolean     NOT NULL DEFAULT false,
  -- upload_status: only 'ready' assets are consumable.
  -- Cloudinary webhook or server job updates this after processing.
  upload_status        text        NOT NULL DEFAULT 'pending'
    CHECK (upload_status IN ('pending', 'uploading', 'ready', 'failed')),
  width                integer,
  height               integer,
  file_size_bytes      bigint,
  format               text,
  created_by_user_id   uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_media_assets_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_media_assets_created_by   ON public.media_assets (created_by_user_id);
CREATE INDEX idx_media_assets_created_at   ON public.media_assets (created_at);
CREATE INDEX idx_media_assets_updated_at   ON public.media_assets (updated_at);
-- Filtered index for the dominant public-read query pattern.
-- Avoids full table scans when serving public pages.
CREATE INDEX idx_media_assets_public_ready ON public.media_assets (id)
  WHERE is_public = true AND upload_status = 'ready';

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Public read: only assets that are explicitly public and fully uploaded.
-- Applies to both anon and authenticated users (no TO clause).
CREATE POLICY "media_assets_select_public_ready" ON public.media_assets
  FOR SELECT
  USING (is_public = true AND upload_status = 'ready');

-- Media managers can read ALL assets, including private and pending ones.
-- Needed for the admin media library UI.
CREATE POLICY "media_assets_select_managers" ON public.media_assets
  FOR SELECT TO authenticated
  USING (has_permission('manage_media'));

-- Only media managers can upload new assets.
CREATE POLICY "media_assets_insert_managers" ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_media'));

-- Only media managers can update asset metadata or promote is_public.
CREATE POLICY "media_assets_update_managers" ON public.media_assets
  FOR UPDATE TO authenticated
  USING     (has_permission('manage_media'))
  WITH CHECK (has_permission('manage_media'));

-- Only media managers can delete assets.
CREATE POLICY "media_assets_delete_managers" ON public.media_assets
  FOR DELETE TO authenticated
  USING (has_permission('manage_media'));


-- ------------------------------------------------------------
-- entity_media
-- Polymorphic join table that attaches a media asset to any
-- content entity (program, university, country, article, etc.)
-- with a named display role (logo, cover, og_image, etc.).
--
-- entity_id carries NO FK constraint because the referenced
-- table varies by entity_type. Referential integrity is
-- enforced at the application layer (server endpoints).
-- entity_type is constrained to the canonical list from 001.
--
-- Public SELECT is intentionally NOT granted in v1.
-- Reason: checking only whether the linked media_asset is public
-- and ready would still expose entity_type/entity_id pairs for
-- draft entities (e.g., a draft program with a public logo image).
-- This is a metadata-leak risk.
--
-- Public pages use direct FK columns on the entity table instead
-- (og_image_id, logo_id, cover_image_id) and read the asset through
-- the media_assets public-ready RLS policy. Gallery/multi-image
-- support via entity_media public SELECT will be added in a future
-- migration with parent-entity published checks.
-- ------------------------------------------------------------
CREATE TABLE public.entity_media (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid        NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  entity_type    text        NOT NULL
    CHECK (entity_type IN (
      'country', 'city', 'campus', 'university', 'degree_level', 'subject',
      'program', 'program_intake', 'scholarship', 'article', 'article_category',
      'seo_landing_page', 'media_asset', 'data_source', 'import_batch',
      'user_report', 'student_profile', 'ai_finder_result', 'ai_conversation'
    )),
  entity_id      uuid        NOT NULL,
  -- role: how this asset is used in the context of the entity
  role           text        NOT NULL
    CHECK (role IN ('logo', 'cover', 'og_image', 'gallery', 'thumbnail', 'featured')),
  display_order  integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- FK index on media_asset_id for cascade deletes and reverse lookups
CREATE INDEX idx_entity_media_asset_id      ON public.entity_media (media_asset_id);
-- Primary lookup: "give me all media attached to this entity"
CREATE INDEX idx_entity_media_entity        ON public.entity_media (entity_type, entity_id);
-- Ordered display within an entity context
CREATE INDEX idx_entity_media_display_order ON public.entity_media (entity_type, entity_id, display_order);

ALTER TABLE public.entity_media ENABLE ROW LEVEL SECURITY;

-- No public SELECT policy. See comment above for rationale.
-- Public pages read images via og_image_id / logo_id / cover_image_id
-- FKs on the entity table, resolved through media_assets RLS.

-- Media managers can read all entity_media records regardless of asset status.
CREATE POLICY "entity_media_select_managers" ON public.entity_media
  FOR SELECT TO authenticated
  USING (has_permission('manage_media'));

-- Only media managers can attach assets to entities.
CREATE POLICY "entity_media_insert_managers" ON public.entity_media
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('manage_media'));

-- Only media managers can update role or display_order.
CREATE POLICY "entity_media_update_managers" ON public.entity_media
  FOR UPDATE TO authenticated
  USING     (has_permission('manage_media'))
  WITH CHECK (has_permission('manage_media'));

-- Only media managers can detach assets from entities.
CREATE POLICY "entity_media_delete_managers" ON public.entity_media
  FOR DELETE TO authenticated
  USING (has_permission('manage_media'));
