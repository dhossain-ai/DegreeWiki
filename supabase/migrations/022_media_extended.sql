-- ============================================================
-- Migration 022: Media Assets and Entity Media — Extended Columns
-- ============================================================
-- Extends the tables created in 003_media.sql with provenance,
-- soft-delete, and per-context override columns needed for the
-- Phase 57A admin media library.
--
-- This migration is ADDITIVE and IDEMPOTENT:
--   - Only adds columns and indexes to existing tables.
--   - No tables are created, dropped, or renamed.
--   - All ADD COLUMN statements use IF NOT EXISTS.
--   - All CREATE INDEX statements use IF NOT EXISTS.
--   - The updated_at trigger is created inside a DO block that
--     checks pg_trigger before creating (safe on re-run).
--   - The public-read policy on media_assets is dropped and
--     recreated to add the deleted_at IS NULL guard.
-- ============================================================


-- ------------------------------------------------------------
-- media_assets — Cloudinary provenance and enrichment columns
-- ------------------------------------------------------------
-- cloudinary_asset_id : Cloudinary's internal asset_id from upload response.
-- cloudinary_version  : version number used for cache-busting delivery URLs.
-- cloudinary_resource_type : 'image' for all Phase 57A assets.
-- display_name        : admin-visible friendly name for the media library.
-- caption             : editorial caption separate from alt_text.
-- folder              : Cloudinary folder path (e.g. degreewiki/universities).
-- source_type         : how the asset entered the system.
-- source_url          : original remote URL for url_import assets.
-- credit_text         : attribution / photo credit line.
-- license_type        : structured license category.
-- license_url         : link to the full license document.
-- copyright_owner     : copyright holder name.
-- is_reusable         : whether the asset appears in the admin media picker.
-- deleted_at          : soft-delete timestamp; NULL means not deleted.
-- ------------------------------------------------------------
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS cloudinary_asset_id      text,
  ADD COLUMN IF NOT EXISTS cloudinary_version       text,
  ADD COLUMN IF NOT EXISTS cloudinary_resource_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS display_name             text,
  ADD COLUMN IF NOT EXISTS caption                  text,
  ADD COLUMN IF NOT EXISTS folder                   text,
  ADD COLUMN IF NOT EXISTS source_type              text
    CHECK (source_type IN ('direct_upload', 'url_import', 'manual')),
  ADD COLUMN IF NOT EXISTS source_url               text,
  ADD COLUMN IF NOT EXISTS credit_text              text,
  ADD COLUMN IF NOT EXISTS license_type             text
    CHECK (license_type IN (
      'owned', 'cc_by', 'cc_by_sa', 'cc0',
      'royalty_free', 'editorial', 'other'
    )),
  ADD COLUMN IF NOT EXISTS license_url              text,
  ADD COLUMN IF NOT EXISTS copyright_owner          text,
  ADD COLUMN IF NOT EXISTS is_reusable              boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at               timestamptz;

CREATE INDEX IF NOT EXISTS idx_media_assets_deleted_at
  ON public.media_assets (deleted_at);

CREATE INDEX IF NOT EXISTS idx_media_assets_folder
  ON public.media_assets (folder);


-- ------------------------------------------------------------
-- media_assets — public-read policy amendment
--
-- Adds deleted_at IS NULL so soft-deleted assets are invisible
-- to public users even if they were previously marked is_public.
--
-- PostgreSQL has no ALTER POLICY … USING syntax, so the policy
-- must be dropped and recreated. This is a non-destructive DDL
-- operation: no data is affected and the brief lock is a table
-- intent lock on media_assets only.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "media_assets_select_public_ready" ON public.media_assets;

CREATE POLICY "media_assets_select_public_ready" ON public.media_assets
  FOR SELECT
  USING (is_public = true AND upload_status = 'ready' AND deleted_at IS NULL);


-- ------------------------------------------------------------
-- entity_media — override and ordering columns
--
-- is_primary        : marks the primary/featured asset for an entity+role.
-- alt_text_override : per-attachment override of the asset's alt_text.
-- caption_override  : per-attachment override of the asset's caption.
-- updated_at        : audit trail for row changes.
-- ------------------------------------------------------------
ALTER TABLE public.entity_media
  ADD COLUMN IF NOT EXISTS is_primary        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alt_text_override text,
  ADD COLUMN IF NOT EXISTS caption_override  text,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- Idempotent trigger creation.
-- Checks pg_trigger before creating to avoid a duplicate_object error
-- if this migration is ever re-applied to the same database.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_trigger
    WHERE  tgname  = 'set_entity_media_updated_at'
    AND    tgrelid = 'public.entity_media'::regclass
  ) THEN
    CREATE TRIGGER set_entity_media_updated_at
      BEFORE UPDATE ON public.entity_media
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- Unique partial index ensures only one primary asset per entity + role.
-- Using UNIQUE prevents two rows both having is_primary = true for the
-- same entity_type / entity_id / role combination at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_media_primary_unique
  ON public.entity_media (entity_type, entity_id, role)
  WHERE is_primary = true;
