# DegreeWiki Current Status

> AI agent reading rule:
> Read this active status file first for current context. Do not read archived status/history files unless the current task explicitly needs older phase details. For old phase details, use `docs/archive/README.md` to choose the smallest relevant archive file.

Last updated: 2026-06-23

## Current Phase

Phase 60 - Public Article UX + SEO Rendering - complete.
This phase rewrites both article admin forms (`new.astro` and `[id].astro`) with a two-column layout (main content + sticky sidebar), surfaces the six SEO fields that were already in the schema but never wired into the forms (`seo_title`, `seo_description`, `seo_h1`, `canonical_url`, `og_title`, `og_description`), adds live word count + reading time, summary character counter, a Google-snippet SEO preview, and writing template buttons for common guide types. The edit form also shows `data_completeness_score` and `source_confidence_score` as read-only progress bars. A "Save and Publish" action button overrides status to published + index after full validation. No migration, no new dependencies, no service role in any page or component.

Current branch / git status note:
- Branch: `main`
- Working tree has untracked data directories only.

## Current Product Summary

- DegreeWiki is an Astro + Supabase app for public degree discovery, student dashboards, admin workflows, source verification, and AI-assisted Fit Finder guidance.
- The current product direction favors role-aware auth routing, server-side enforcement, token-driven public UI, and fail-closed AI behavior.

## Current Stack

- Astro SSR application with Cloudflare-oriented deployment output.
- Supabase Auth, RPC checks, and row-level security for auth and data boundaries.
- Server-side cookie/session handling through `@supabase/ssr`.
- Public UI built from Astro components and design tokens.
- Fit Finder AI runtime that can fall back to rule-based results when AI is unavailable.

## Current Architecture Decisions

- Admin access is role-based, not email-based.
- `/admin`, `/account`, and `/dashboard` resolve through shared auth helpers instead of page-local redirect logic.
- Admin sidebar navigation is permission-filtered for clarity, but direct route access still depends on admin-role admission plus RLS/permissions.
- Public pages use the locked design system and token-based UI components.
- Fit Finder AI remains fail-closed and can show rule-based matches without an AI summary.
- Docs are split into compact active files plus archive files for older history.
- Cloudinary stores and delivers media assets. Supabase stores metadata. Secrets stay server-only.
- Upload flow: server-signed direct browser → Cloudinary upload; server verifies response signature before DB insert.
- URL import: server calls Cloudinary upload API with SSRF-guarded remote URL.
- Entity image FKs now exist on all 6 admin entity tables. MediaPicker component used in all 12 admin forms.
- Public entity page image rendering is deferred to Phase 57C.

## Last Completed Phases

- Phase 60: Public article UX + SEO rendering; seo_h1 wired as H1; last_verified_at wired into SourceBox; reading time computed server-side and shown in article header; summary moved to header as lede; FitFinderMiniPanel CTA added; related articles by same category added; og:type="article" set; article:published_time/article:modified_time meta tags added to BaseLayout. No migrations, no new dependencies.
- Phase 59: Article authoring UX; two-column layout; six SEO fields surfaced (seo_title/description/h1, og_title/description, canonical_url); live word count + reading time; summary char counter; SEO search preview; writing template buttons; Save and Publish action; data quality scores read-only in edit form. No migrations, no new dependencies.
- Phase 58D: Mixed-batch nested research pack import; staged university inserted first; staged programs auto-linked to that university; rich program `raw_data` mapped during create-new program merge; research pack template/prompt and preview added. No migrations, no new dependencies.
- Phase 58E: Local direct-draft research pack import script; draft/unverified production-only writes; exact university/program duplicate matching; empty-field-only updates for draft matches; source URLs preserved in `data_sources`; markdown import report added. No migrations, no new dependencies.
- Phase 58C: Import templates + AI prompts + JSON preview + program university selector + set_match_scholarship_id + set_match_article_id + auto quality check on bulk import. No migrations, no new dependencies.
- Phase 58B: Import pipeline UX improvements; batch list lifecycle labels, batch detail summary cards, lifecycle steps, guidance banner, always-visible review buttons, programs university column, friendly error labels, batch status transition to needs_review. No migrations.
- Phase 57C: Public media rendering; article featured images, university/scholarship logos and covers, program/fit-finder university logos, og:image/twitter:image in layouts, country cover on homepage DestinationCard. No migrations. No admin changes.
- Phase 57B.1: Inline media picker UX upgrade; slot-card + native dialog modal, inline upload/import, auto-select, degreewiki:media-added event.
- Phase 57B: Entity media attachment; migration 023, MediaPicker component, image pickers in all 12 admin entity forms (6 entities × 2 pages).
- Phase 57A: Cloudinary/media asset foundation; migration 022, admin media library, signed upload, URL import, MediaImage component.
- Phase 56C: repo docs compaction complete; exact snapshots were taken, archive files were created, and the active docs were rewritten.
- Phase 56B: admin-role QA and navigation hardening; shared 403 helper plus filtered sidebar links.
- Phase 56A: auth role routing fix; admin users route to `/admin`, student users route to `/account`.

## Known Active Issues

- Country/city/subject standalone public pages do not exist — image rendering for those entities is deferred until routes are built.
- Cloudinary hard-delete (destroy API) not yet implemented.
- Sidebar filtering improves clarity but does not replace route-level permission checks.
- Dashboard count cards are not fully permission-tailored yet.
- Default site OG image not yet configured (no brand asset uploaded to Cloudinary yet).
- Import CSV/file upload deferred to Phase 61.
- Mixed-batch research pack staging import is still supported, and Phase 58E adds a separate local direct-draft production import script for trusted packs.
- Fields without production columns, such as `duration_text`, `required_documents_text`, `scholarship_notes`, `official_tuition_url`, `missing_fields`, and freeform `notes`, remain preserved in staging `raw_data`.

## Immediate Next Phases

- Phase 61: CSV/file upload import pipeline (intentionally deferred from Phase 58C/58D).
- Article junction table wiring (article_countries, article_subjects, article_degree_levels) in the admin form — deferred from Phase 59.
- Markdown/rich-text preview for article body — deferred from Phase 59.
- Continue admin permission boundary hardening.
- Add default site OG image (upload DegreeWiki brand asset to Cloudinary, wire PUBLIC_DEFAULT_OG_IMAGE_PUBLIC_ID).
- Cloudinary hard-delete (destroy API) when needed.

## Archive Map

- [Archive README](archive/README.md)
- [Status snapshot](archive/snapshots/2026-06-21-06-status-before-compaction.md)
- [Task log snapshot](archive/snapshots/2026-06-21-07-task-log-before-compaction.md)
- [Status history archive](archive/status/status-history-phase-01-56.md)
- [Task log archive, phases 01-10](archive/task-log/task-log-phase-01-10-schema-auth-admin-foundation.md)
- [Task log archive, phases 11-20](archive/task-log/task-log-phase-11-20-public-search-ai-matching.md)
- [Task log archive, phases 21-30](archive/task-log/task-log-phase-21-30-ai-finder-account-hardening.md)
- [Task log archive, phases 31-38](archive/task-log/task-log-phase-31-38-ai-chat-boundaries.md)
- [Task log archive, phases 39-44](archive/task-log/task-log-phase-39-44-source-import-staging-merge.md)
- [Task log archive, phases 45-50](archive/task-log/task-log-phase-45-50-public-data-staging-frontend.md)
- [Task log archive, phases 51-54](archive/task-log/task-log-phase-51-54-student-fit-finder-ai-runtime.md)
- [Task log archive, phases 55-56](archive/task-log/task-log-phase-55-56-public-redesign-auth-routing.md)

## How To Read Old History

- Start with `archive/README.md`.
- Pick the smallest archive file that matches the phase range or topic.
- Use the exact snapshots only when a task needs byte-for-byte pre-compaction text.
- Avoid rereading the large archive files unless the work explicitly depends on old phase detail.
