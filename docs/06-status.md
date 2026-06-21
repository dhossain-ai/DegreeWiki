# DegreeWiki Current Status

> AI agent reading rule:
> Read this active status file first for current context. Do not read archived status/history files unless the current task explicitly needs older phase details. For old phase details, use `docs/archive/README.md` to choose the smallest relevant archive file.

Last updated: 2026-06-21

## Current Phase

Phase 56C - Repo Docs Compaction - complete.
This phase archived the large status/task-log history, added an archive index, and rewrote the active docs into compact entry points.

Current branch / git status note:
- Branch: `main`
- The worktree was already dirty before this phase, with unrelated admin UI/source changes still pending in the repo.
- This phase only changed docs and archive files.

## Current Product Summary

- DegreeWiki is an Astro + Supabase app for public degree discovery, student dashboards, admin workflows, source verification, and AI-assisted Fit Finder guidance.
- The current product direction favors role-aware auth routing, server-side enforcement, token-driven public UI, and fail-closed AI behavior.

## Current Stack

- Astro SSR application with Cloudflare-oriented deployment output.
- Supabase Auth, RPC checks, and row-level security for auth and data boundaries.
- Server-side cookie/session handling through `@supabase/ssr`.
- Public UI built from Astro components and design tokens.
- Fit Finder AI runtime that can fall back to rule-based results when AI is unavailable.

## Safety Rules

- This phase is docs-only.
- Do not change source code, migrations, package files, or dependency state unless a later task explicitly asks for that.
- Keep RLS and Supabase permissions as the final enforcement layer.
- Avoid service-role access in page code.
- Keep public/admin routing logic role-aware and server-side.
- When a question involves old history, open `docs/archive/README.md` first and then the smallest relevant archive file.

## Current Architecture Decisions

- Admin access is role-based, not email-based.
- `/admin`, `/account`, and `/dashboard` resolve through shared auth helpers instead of page-local redirect logic.
- Admin sidebar navigation is permission-filtered for clarity, but direct route access still depends on admin-role admission plus RLS/permissions.
- Public pages use the locked design system and token-based UI components.
- Fit Finder AI remains fail-closed and can show rule-based matches without an AI summary.
- Docs are now split into compact active files plus archive files for older history.

## Last Completed Phases

- Phase 56C: repo docs compaction complete; exact snapshots were taken, archive files were created, and the active docs were rewritten.
- Phase 56B: admin-role QA and navigation hardening; shared 403 helper plus filtered sidebar links.
- Phase 56A: auth role routing fix; admin users route to `/admin`, student users route to `/account`.
- Phase 55F: public directory and detail page redesign completion.
- Phase 55E: program discovery redesign bundle.
- Phase 55D: homepage visual QA and responsive polish.
- Phase 55C: homepage redesign implementation.
- Phase 55B: public design system foundation.
- Phase 55A: locked design reference files and normalized public direction docs.

## Known Active Issues

- The worktree is still dirty with unrelated admin/source changes that predate this docs phase.
- Sidebar filtering improves clarity but does not replace route-level permission checks.
- Some admin URLs can still be opened directly by admin-role users unless the page logic or RLS blocks the action.
- Dashboard count cards are not fully permission-tailored yet.
- In-page action visibility still needs section-by-section hardening.

## Immediate Next Phases

- Verify this compaction pass with line counts, git status, and archive checks.
- Resume product hardening with admin route permission boundaries and in-page permission gating.
- Keep using the compact active docs for day-to-day context and only open archive files when a task needs older phase detail.

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
