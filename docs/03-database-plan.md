# DegreeWiki Database Plan

## Purpose

This file summarizes the planned database areas. Detailed SQL will be created in schema phases.

## Database Principles

- PostgreSQL is the source of truth.
- Use Supabase Auth for identity.
- Use Supabase RLS for row-level security.
- Use UUID primary keys.
- Use clear plural table names.
- Store structured data for filtering and AI matching.
- Store markdown/text for rich explanations.
- Track source, verification, and review status for important public data.
- Do not insert AI-extracted data directly into live public tables.

## Core Public Content Tables

Planned core tables:

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
- articles
- article_categories
- article_countries
- article_subjects
- article_degree_levels
- seo_landing_pages
- seo_page_types

## Program Data

Programs are the core searchable entity.

Important program data:

- title
- slug
- university
- country
- city
- campus
- degree level
- degree award
- subjects
- duration
- study mode
- delivery mode
- language
- tuition
- application fee
- intakes
- deadlines
- admission requirements
- English requirements
- GPA/background requirements
- documents
- curriculum/modules
- career outcomes
- scholarships
- official URLs
- verification status

## Auth/Admin Tables

Planned tables:

- user_profiles
- roles
- user_roles
- permissions
- role_permissions
- admin_activity_logs

MVP roles:

- student
- content_admin
- reviewer
- data_import_manager
- super_admin

## Student/AI Tables

Planned tables:

- student_profiles
- student_profile_subjects
- student_profile_countries
- ai_finder_results
- ai_finder_program_matches
- ai_finder_scholarship_matches
- ai_conversations
- ai_messages
- ai_usage_logs
- ai_rate_limits

## Data Source / Verification Tables

Planned tables:

- data_sources
- source_snapshots
- verification_events
- data_quality_checks

Later:

- entity_field_sources
- broken_link_checks
- source_change_detections

## Import / Staging Tables

Planned tables:

- import_batches
- import_files
- staging_universities
- staging_programs
- staging_scholarships
- staging_articles
- staging_errors
- staging_review_actions

Import flow:

1. raw CSV/JSON/source
2. import batch
3. staging rows
4. validation
5. duplicate detection
6. admin review
7. approve/reject/merge
8. publish to live tables

## Staged-to-Production Merge Rules (Phase 43 MVP — Implemented)

Phase 43 implemented one-by-one create-new merge for approved staged rows.
The implementation lives in `src/lib/admin/importMerge.ts`.
The UI lives in `src/pages/admin/imports/[id].astro`.

### Implemented: Phase 43 MVP

Supported entity types:
- universities (create-new only)
- scholarships (create-new only)
- articles (create-new only)

Deferred entity types:
- programs (requires university_id, degree_level_id, country_id FKs not available in staging)

Deferred modes:
- update-existing (all types) — match columns exist, implementation deferred to Phase 44
- bulk merge — deferred indefinitely until single-record workflow is stable
- auto-merge — never

### Merge eligibility (enforced server-side in importMerge.ts)

- `import_status` must be `approved` (re-read from DB at merge time).
- Entity type must be in allowlist: universities, scholarships, articles.
- Row id and batch id must be valid UUIDs.
- Staged row must belong to the current batch (`import_batch_id` match).
- Batch type must match entity type or be `mixed`.
- Confirmation checkbox must be present in POST (`confirm=yes`).
- Required fields must be non-null (entity-specific).
- Production slug must not already exist (uniqueness checked before insert).

### Field mapping (create-new)

**Universities:**
- `name` ← `extracted_name` (required)
- `slug` ← slugified from `extracted_name` (server-generated)
- `country_id` ← looked up from `countries.iso2` using `extracted_country_code` (required; blocks if unresolved)
- `official_url` ← `extracted_official_url` (optional, included if non-empty)
- Defaults: `content_status='draft'`, `verification_status='unverified'`, `indexing_status='draft'`

**Scholarships:**
- `name` ← `extracted_name` (required)
- `slug` ← slugified from `extracted_name` (server-generated)
- `amount_min` ← `extracted_amount` (optional; currency not mapped — no currency in staging)
- `deadline_text` ← `extracted_deadline` (optional; stored as text, no date parsing)
- Defaults: `content_status='draft'`, `verification_status='unverified'`, `indexing_status='draft'`

**Articles:**
- `title` ← `extracted_title` (required)
- `slug` ← `extracted_slug` re-read from DB and validated against strict regex (required)
- `content` ← `extracted_content` (optional, included if non-empty)
- `article_category_id` — deferred; category FK lookup ambiguous (text name vs slug)
- Defaults: `content_status='draft'`, `verification_status='unverified'`, `indexing_status='draft'`

### Post-merge behavior

After successful insert:
- Staging row `import_status` set to `'merged'` (terminal, non-reversible).
- Relevant match column set to the new production id:
  - universities → `match_university_id`
  - scholarships → `match_scholarship_id`
  - articles → `match_article_id`
- `review_notes` left unchanged.
- `verification_events` not written (deferred).
- `data_sources` not linked (deferred).
- `import_batch` counts not updated (deferred).

### Deferred to Phase 44+

- update-existing mode (match columns already exist in staging schema)
- programs merge (needs university_id + degree_level_id + country_id FK resolution)
- duplicate resolution workflow
- verification_events write on merge
- data_sources linkage on merge
- article category FK mapping
- scholarship currency mapping
- field-level source tracking
- bulk merge

### Why bulk merge remains deferred

Bulk merge removes per-record confirmation, preventing destructive overwrite detection.
Risk too high until duplicate resolution is deterministic and field-level source tracking exists.

### verification_events

Not written automatically on merge.
Super admin should create a verification_event manually after confirming data accuracy.
Automated verification_events deferred to a future verification pipeline phase.

## Media Tables

Planned tables:

- media_assets
- entity_media

Cloudinary stores public images.
PostgreSQL stores metadata.
Supabase Storage stores private/import files.

## User Reports Tables

Planned tables:

- user_reports
- report_categories

Later:

- user_report_comments
- user_report_attachments

## Saved Items Tables

Planned tables:

- saved_items

Later:

- saved_collections
- saved_searches
- saved_program_details
- saved_scholarship_details

## Notification Tables

Later:

- notification_preferences
- deadline_alerts
- notification_logs
- email_notification_logs

## Analytics Tables

Planned MVP tables:

- analytics_events
- search_logs
- outbound_clicks

Track useful product events only.

## Monetization Tables

Later:

- ad_slots
- ad_placements
- page_ad_settings
- monetization_settings

## Legal Tables

Later or MVP-lite:

- legal_pages
- legal_page_versions
- consent_events
- privacy_requests
- contact_messages

## Common Fields for Public Content

Most public content entities should include:

- id
- slug
- name/title
- summary
- content_status
- verification_status
- data_completeness_score
- source_confidence_score
- last_verified_at
- last_content_reviewed_at
- next_review_due_at
- seo_title
- seo_description
- seo_h1
- canonical_url
- og_title
- og_description
- og_image_id
- indexing_status
- created_at
- updated_at

## Common Status Values

content_status:

- draft
- published
- needs_review
- outdated
- archived

verification_status:

- unverified
- partially_verified
- verified
- source_conflict
- outdated
- needs_review

indexing_status:

- index
- noindex
- draft