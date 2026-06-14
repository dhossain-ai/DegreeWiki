# Phase 01: Full Database Schema v1

## Purpose

Design and implement the first production-grade Supabase/PostgreSQL schema for DegreeWiki.

The schema must support the MVP without blocking future growth.

## Scope

This phase should define:

- core content tables
- lookup tables
- relationships
- indexes
- common status fields
- SEO fields
- verification fields
- auth/admin tables
- student/AI foundation tables
- import/staging foundation
- media metadata
- user reports
- saved items
- analytics foundation
- RLS policies

## MVP Core Tables

Required MVP core content tables:

- countries
- cities
- universities
- campuses
- degree_levels
- subjects
- programs
- program_subjects
- program_intakes
- scholarships
- scholarship_countries
- scholarship_universities
- scholarship_programs
- scholarship_subjects
- scholarship_degree_levels
- article_categories
- articles
- seo_page_types
- seo_landing_pages

## Auth/Admin Tables

Required:

- user_profiles
- roles
- user_roles
- permissions
- role_permissions
- admin_activity_logs

## AI / Student Tables

Required foundation:

- student_profiles
- student_profile_subjects
- student_profile_countries
- ai_finder_results
- ai_finder_program_matches
- ai_conversations
- ai_messages
- ai_usage_logs

## Data Quality / Import Tables

Required foundation:

- data_sources
- source_snapshots
- verification_events
- data_quality_checks
- import_batches
- import_files
- staging_programs
- staging_universities
- staging_scholarships
- staging_errors

## Media Tables

Required:

- media_assets
- entity_media

## User / Product Tables

Required foundation:

- user_reports
- report_categories
- saved_items
- analytics_events
- search_logs
- outbound_clicks

## Common Requirements

Use UUID primary keys.

Use timestamps:

- created_at
- updated_at

Use soft delete only where appropriate:

- deleted_at

Use these common status concepts:

- content_status
- verification_status
- indexing_status

Important public entities should include:

- seo_title
- seo_description
- seo_h1
- canonical_url
- og_title
- og_description
- og_image_id
- data_completeness_score
- source_confidence_score
- last_verified_at
- next_review_due_at

## RLS Requirements

Enable RLS on all user/private/admin-sensitive tables.

Public read:

- only published public content

Student access:

- users can read/write only their own private data

Admin access:

- content admins can edit drafts
- reviewers can publish
- data import managers can manage staging/imports
- super admins can manage everything

Sensitive tables must not be publicly writable.

## Do Not Do In This Phase

Do not build frontend UI.

Do not build full admin dashboard.

Do not implement paid subscriptions.

Do not implement full AI chatbot.

Do not implement ChromaDB.

Do not implement external search engine.

Do not create Vercel-specific services.

## Expected Output

The coding AI should first produce a plan only.

The plan must include:

- tables to create
- enums/check constraints
- relationships
- indexes
- RLS policy strategy
- seed data strategy
- migration files expected
- risks/assumptions

After approval, implementation should create:

- Supabase migration SQL
- seed data for lookup tables
- optional database types generation command
- updated docs/06-status.md
- appended docs/07-task-log.md

## Acceptance Criteria

- Schema supports MVP content model.
- Programs can be filtered by country, city, university, degree level, subject, tuition, language, deadline, and scholarship relation.
- Scholarships can relate to countries, universities, programs, subjects, and degree levels.
- Articles can relate to countries, subjects, degree levels, and scholarships.
- AI Finder can store profile snapshot, matched programs, scores, warnings, and AI explanation.
- AI Conversation can store messages and context.
- Import data can enter staging before live publishing.
- Verification/source tracking exists.
- RLS is enabled for private/sensitive tables.
- Public data can be read only when published.