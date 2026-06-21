# DegreeWiki Current Status

> AI agent reading rule:
> Read this active status file first for current context. Do not read archived status/history files unless the current task explicitly needs older phase details. For old phase details, use `docs/archive/README.md` to choose the smallest relevant archive file.

Last updated: 2026-06-22

## Current Phase

Phase 57A - Cloudinary / Media Asset Foundation - complete.
This phase added the admin media library, signed direct upload, URL import, MediaImage component, and the 022 migration extending media_assets/entity_media.
Entity image attachment (country/university/scholarship/article forms and public page rendering) is deferred to Phase 57B.

Current branch / git status note:
- Branch: `main`
- Worktree was clean before Phase 57A. All Phase 57A changes are uncommitted and ready for review.

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
- Entity image attachment (FK columns → form pickers → public rendering) is deferred to Phase 57B.

## Last Completed Phases

- Phase 57A: Cloudinary/media asset foundation; migration 022, admin media library, signed upload, URL import, MediaImage component.
- Phase 56C: repo docs compaction complete; exact snapshots were taken, archive files were created, and the active docs were rewritten.
- Phase 56B: admin-role QA and navigation hardening; shared 403 helper plus filtered sidebar links.
- Phase 56A: auth role routing fix; admin users route to `/admin`, student users route to `/account`.
- Phase 55F: public directory and detail page redesign completion.
- Phase 55E: program discovery redesign bundle.
- Phase 55D: homepage visual QA and responsive polish.
- Phase 55C: homepage redesign implementation.

## Known Active Issues

- Entity image slots (cover_image_id for cities/subjects, logo_id/cover_image_id for scholarships) are not yet in the schema — deferred to Phase 57B.
- Admin entity forms (countries, universities, articles, etc.) do not yet have image pickers — deferred to Phase 57B.
- Sidebar filtering improves clarity but does not replace route-level permission checks.
- Dashboard count cards are not fully permission-tailored yet.

## Immediate Next Phases

- Phase 57B: entity image attachment — add missing FK columns, MediaPicker component, image slots in admin forms, image rendering on public entity pages.
- Continue admin permission boundary hardening.

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
