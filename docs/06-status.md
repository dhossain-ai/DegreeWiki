# DegreeWiki Current Status

> AI agent reading rule:
> Read this active status file first for current context. Do not read archived status/history files unless the current task explicitly needs older phase details. For old phase details, use `docs/archive/README.md` to choose the smallest relevant archive file.

Last updated: 2026-06-22

## Current Phase

Phase 58C - Import Templates + Preview + AI Research Workflow - complete.
This phase makes the JSON-based import workflow significantly easier to use with AI-researched data. Added JSON templates (with field notes and .json download) and copyable AI/Perplexity research prompts for all 4 entity types, surfaced in a collapsible "Templates & AI Prompts" panel on the batch detail page. Bulk JSON import now shows a live client-side preview (valid/invalid status, item count, sample names) before submission. Manual program staging form now has a university dropdown/selector when staged universities are available in the batch. `set_match_scholarship_id` and `set_match_article_id` server actions added, unblocking the update-existing merge paths for those entity types. Quality checks now auto-run after every successful bulk import (non-fatal, includes quality result in the redirect banner). Import method guidance panel added above the import forms. No migrations, no new dependencies, no CSV/file-upload support.

Current branch / git status note:
- Branch: `main`
- Working tree has uncommitted changes (Phase 58C).

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
- Import CSV/file upload deferred to Phase 60.
- Nested university+programs pack import not supported by current parser; each entity type must be imported separately.

## Immediate Next Phases

- Phase 60: CSV/file upload import pipeline (intentionally deferred from Phase 58C).
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
