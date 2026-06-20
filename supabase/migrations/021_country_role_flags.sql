-- ============================================================
-- Migration 021: Country Role Flags
-- ============================================================
-- Adds is_origin_enabled and is_destination_enabled to countries.
--
-- is_origin_enabled:      country can appear in "Where are you from?"
--                         (Fit Finder origin / student current country)
-- is_destination_enabled: country can appear in "Where do you want to study?"
--                         and public destination filters
--                         (programs, universities, Fit Finder destination)
--
-- A country may be both origin and destination.
-- Defaults to false so new rows do not appear in dropdowns until
-- an admin explicitly enables the relevant role(s).
--
-- Backfill: all currently published countries become both origin
-- and destination (Finland and any other published rows are live
-- public content and should remain fully visible).
--
-- RLS unchanged.
-- ============================================================

ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS is_origin_enabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_destination_enabled boolean NOT NULL DEFAULT false;

-- Backfill: published countries are already live public content.
-- Mark them as both origin and destination so existing behaviour
-- (Finland appearing in both dropdowns) is preserved.
UPDATE public.countries
  SET
    is_origin_enabled      = true,
    is_destination_enabled = true
  WHERE content_status = 'published';

-- Partial index for origin-enabled countries (Fit Finder origin query).
CREATE INDEX IF NOT EXISTS idx_countries_origin_enabled
  ON public.countries (id, name)
  WHERE is_origin_enabled = true;

-- Partial index for destination-enabled countries (Fit Finder destination,
-- programs filter, universities filter).
CREATE INDEX IF NOT EXISTS idx_countries_destination_enabled
  ON public.countries (id, name)
  WHERE is_destination_enabled = true;
