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

## Staged-to-Production Merge Rules (Phase 42 Planning — NOT YET IMPLEMENTED)

These rules document the intended future merge implementation.
No production merge code exists yet. Do not implement until a dedicated merge phase is approved.

### Preconditions before any staged row may be merged

- `import_status` must be `approved`.
- Actor must have `super_admin` role.
- All required production fields must be present on the staged row (entity-specific, see below).
- `duplicate_of_id` must be null or admin must have explicitly confirmed intent to proceed.
- No unresolved `staging_errors` of type `validation_error` for the row (warnings acceptable).
- `data_source_id` on the parent `import_batches` row should be linked where possible.

### Merge modes

**Create:** insert a new production record when no matching production row exists.
**Update:** patch an existing production record only when `match_*_id` is set,
confirmed by the admin, and a second `confirm_overwrite=true` field is submitted.
Without explicit overwrite confirmation, the merge endpoint must refuse to update.

### Entity-specific future rules

**Universities**
- Safe to write: `name`, `official_url`, `country_id`.
- Never overwrite `slug` if the university is already live and indexed.
- Set `verification_status = 'pending'` on create; do not touch `is_verified`.
- Do not overwrite `name` on update without explicit confirmation.

**Programs**
- Safe to write: `title`, `degree_level_id`, `language`, `tuition_amount`, `application_deadline`.
- Must link to a `university_id` via `match_university_id`; reject if university not found.
- Never overwrite existing `tuition_amount` without explicit confirmation.
- Set `content_status = 'draft'` on create; require separate publish action.

**Scholarships**
- Safe to write: `name`, `amount_min`, `amount_max`, `currency`, `deadline`.
- Never overwrite `eligibility_summary` if a richer value already exists in production.
- Set `content_status = 'draft'` on create.

**Articles**
- Safe to write: `title`, `slug`, `category`, `content` for new records only.
- Never overwrite published `content` without explicit admin confirmation.
- Set `content_status = 'draft'` on create.

### verification_status and source_confidence defaults

- All merged records start with `verification_status = 'pending'` (or equivalent low-trust value).
- `source_confidence` should reflect the import source type (manual = medium, AI = low).
- A separate verification workflow promotes records to higher confidence after human review.

### verification_events

- Not written automatically on merge.
- A super admin should create a verification_event manually after confirming data accuracy.
- Automated verification_events are deferred to a future verification pipeline phase.

### Why bulk merge is deferred

Bulk merge removes the per-record confirmation step that prevents destructive overwrites,
especially in update mode. The risk is too high until duplicate resolution is deterministic
and a field-level source tracking system is in place. Bulk merge will only be considered
after the single-record merge workflow is proven stable in production.

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