-- ============================================================
-- Migration 001: Custom Types and Shared Utilities
-- ============================================================
-- Purpose:
--   Enables required extensions, creates the shared updated_at
--   trigger function, and documents all canonical value sets
--   used as CHECK constraints throughout the schema.
--
--   No tables are created here. No RLS policies are created here.
--   No role/permission helper functions are created here —
--   those live in migration 002 after their dependent tables exist.
-- ============================================================


-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
-- gen_random_uuid() is built into PostgreSQL 14+ and available
-- in all Supabase projects without an explicit extension.
-- pgcrypto is enabled as a safe fallback for older environments.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ------------------------------------------------------------
-- Shared trigger function: auto-update updated_at on row change
-- Applied to every table that has an updated_at column.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- CANONICAL VALUE SETS
-- ============================================================
-- Every text column in the schema that represents a controlled
-- vocabulary uses a CHECK constraint against one of these sets.
--
-- IMPORTANT: Adding or removing a value from any set requires:
--   1. A new migration that updates ALL CHECK constraints
--      referencing that set across all affected tables.
--   2. A corresponding update to the Zod validation schemas
--      in the application layer.
--   3. An update to this comment block.
--
-- Do not modify values directly in a hotfix.
-- ============================================================


-- ------------------------------------------------------------
-- content_status
-- Controls public visibility of a content entity.
-- Used on: countries, cities, universities, campuses, subjects,
--          programs, scholarships, articles, seo_landing_pages
--
--   draft        — being written; not visible to the public
--   in_review    — submitted for editorial review; still hidden
--   published    — live and publicly visible
--   unpublished  — previously published, now hidden (not deleted)
--   archived     — permanently retired; not shown anywhere
--
-- NOTE: 'needs_review' and 'outdated' are NOT content statuses.
-- Those belong exclusively in verification_status below.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- verification_status
-- Tracks data accuracy against official sources.
-- Used on: countries, universities, programs, scholarships,
--          articles, cities
--
--   unverified          — no source has been confirmed
--   partially_verified  — some fields verified, others unclear
--   verified            — all key fields confirmed vs. official source
--   source_conflict     — two or more sources disagree on the data
--   outdated            — was verified but the source has since changed
--   needs_review        — flagged for re-verification by staff
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- indexing_status
-- Controls whether a page appears in search engines.
-- Used on: countries, universities, programs, scholarships,
--          articles, seo_landing_pages
--
--   index    — include in sitemap; allow crawling and indexing
--   noindex  — block indexing (thin content, low quality, etc.)
--   draft    — decision not yet made; treated as noindex
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- account_status
-- Controls user account access state.
-- Used ONLY on: user_profiles
--
--   active          — normal, fully functional account
--   disabled        — access turned off by admin
--   suspended       — temporary suspension pending review
--   deleted         — soft-deleted; data retained for purge period
--   pending_review  — awaiting manual admin review before activation
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- study_mode
-- How a student attends the program.
-- Used on: programs
--
--   full_time, part_time, online, hybrid
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- delivery_mode
-- Physical/virtual delivery method of the program.
-- Used on: programs
--
--   on_campus, online, hybrid, distance
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- scholarship_type
-- High-level category of a scholarship.
-- Used on: scholarships
--
--   full, partial, merit, need_based, government, institutional, other
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- provider_type
-- The kind of organisation funding the scholarship.
-- Used on: scholarships
--
--   government, university, private_foundation, corporate, ngo, other
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- funding_type
-- What the scholarship money covers.
-- Used on: scholarships
--
--   full_tuition, partial_tuition, living_stipend,
--   travel, research, full_funding, other
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- application_type
-- How students apply for the scholarship.
-- Used on: scholarships
--
--   direct, university_portal, nomination, embassy, other
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- import_status
-- Lifecycle state of a record in the import/staging pipeline.
-- Used on: import_batches, import_files, staging_* tables
--
--   pending             — queued, not yet started
--   processing          — currently being processed
--   validated           — passed all validation checks
--   duplicate_detected  — probable duplicate of an existing record
--   needs_review        — requires human decision before proceeding
--   approved            — admin approved; ready to publish to live tables
--   rejected            — admin rejected; will not be published
--   error               — processing failed; see staging_errors
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- ai_session_type
-- Distinguishes AI Finder sessions from open chat sessions.
-- Used on: ai_conversations, ai_usage_logs
--
--   finder, chat
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- upload_status
-- Tracks the Cloudinary upload lifecycle for a media asset.
-- Used on: media_assets
--
--   pending   — upload not yet started
--   uploading — transfer in progress
--   ready     — fully uploaded and available for public use
--   failed    — upload or Cloudinary processing failed
--
-- Public SELECT on media_assets requires:
--   is_public = true AND upload_status = 'ready'
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- report_status
-- Lifecycle state of a user-submitted content report.
-- Used on: user_reports
--
--   open, under_review, resolved, dismissed
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- source_type
-- The kind of source a data_sources record represents.
-- Used on: data_sources
--
--   official_university, government, third_party,
--   aggregator, user_submitted
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- confidence_level
-- Human/system assessment of source reliability.
-- Used on: data_sources
--
--   high, medium, low, unknown
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- eligibility_type
-- Whether a nationality is eligible for a scholarship.
-- Used on: scholarship_eligible_nationalities
--
--   eligible, ineligible, preferred
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- deadline_status
-- Current state of a program application window.
-- Used on: program_intakes
--
--   open, closing_soon, closed, rolling
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- entity_type  (CANONICAL LIST — LOCKED FOR v1)
-- ============================================================
-- Used on: entity_media, saved_items, user_reports,
--          verification_events, data_quality_checks,
--          admin_activity_logs, analytics_events
--
-- Valid values:
--   country           city              campus
--   university        degree_level      subject
--   program           program_intake    scholarship
--   article           article_category  seo_landing_page
--   media_asset       data_source       import_batch
--   user_report       student_profile   ai_finder_result
--   ai_conversation
--
-- IMPORTANT: Adding a new value requires updating the CHECK
-- constraint on EVERY table that references entity_type.
-- There is no single enum to change — each table's constraint
-- must be updated individually in a new migration.
-- ------------------------------------------------------------
