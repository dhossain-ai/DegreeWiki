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