# DegreeWiki Current Status

Last updated: 2026-06-14

## Current Phase

Project setup and documentation foundation.

Next major phase:

Full Database Schema v1.

## Current Task

Create initial project docs inside the GitHub repo so Claude Code, Codex, Gemini/Antigravity, OpenRouter models, and other AI coding tools can work with controlled context.

## Last Completed Planning Work

Completed major brainstorming/planning for:

- product feature model
- country content type
- university content type
- program/course content type
- subject/field of study
- degree level
- city/location/campus
- scholarship
- guide/article
- SEO landing page
- student profile
- AI Finder Result
- AI Conversation
- AI orchestration / intent routing / RAG
- data source / verification
- import / staging / review
- auth / user roles / permissions / Supabase RLS
- media / Cloudinary asset system
- user reports / data correction
- saved items / user dashboard
- notifications / deadline alerts
- analytics / event tracking
- monetization / AdSense settings
- legal pages / privacy / terms / disclaimer
- technical architecture / stack decisions
- Cloudflare-first deployment
- AI co-engineering workflow

## Current Architecture Decisions

- Astro.js frontend
- React islands for interactivity
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase RLS
- Cloudflare Pages/Workers as primary deployment
- Vercel as fallback deployment
- Cloudinary for public images
- Supabase Storage for private/import files
- Gemini first through AI Gateway
- pgvector later for RAG
- No ChromaDB in MVP
- No separate admin app in MVP
- No Vercel-only services

## Current Repo Task

Create these docs:

- docs/00-project-overview.md
- docs/01-product-decisions.md
- docs/02-architecture.md
- docs/03-database-plan.md
- docs/04-ai-system.md
- docs/05-coding-standards.md
- docs/06-status.md
- docs/07-task-log.md
- docs/phases/phase-01-database-schema-v1.md
- docs/prompts/prompt-template-implementation.md
- docs/prompts/prompt-template-review.md

## Active Branch

main

Update this after creating a feature branch.

Recommended first feature branch:

feature/project-docs

## Known Issues / Open Questions

- Full Database Schema v1 is not written yet.
- Exact enum names need final confirmation.
- Exact MVP table list needs final confirmation.
- Admin dashboard implementation details are not finalized.
- Frontend design system is not finalized.
- MCP/tooling setup is not finalized.

## Next Steps

1. Create docs folder and core docs.
2. Commit docs foundation.
3. Start Full Database Schema v1 phase.
4. Ask coding AI for schema plan only.
5. Review schema plan with ChatGPT.
6. Approve/revise.
7. Implement migrations.
8. Review generated SQL carefully.