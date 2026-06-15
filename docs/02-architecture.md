# DegreeWiki Technical Architecture

## Architecture Goal

Build DegreeWiki simple enough for MVP, but structured enough to grow.

Core rule:

DegreeWiki should be hosting-portable, database-first, and Cloudflare-compatible.

## Primary Stack

Frontend:
- Astro.js

Interactive UI:
- React islands inside Astro

Styling:
- Tailwind CSS

Database:
- Supabase PostgreSQL

Authentication:
- Supabase Auth

Authorization:
- Supabase RLS
- custom roles/permissions tables

Deployment:
- Cloudflare Pages/Workers

Fallback Deployment:
- Vercel

Media:
- Cloudinary for public images
- Supabase Storage for private/import files

AI:
- Gemini first
- Internal AI Gateway abstraction
- More LLM providers later

Vector/RAG:
- Supabase pgvector later
- No ChromaDB in MVP

## Rendering Strategy

Public SEO pages should be pre-rendered/static where possible:

- country pages
- university pages
- program pages
- scholarship pages
- guide/article pages
- subject pages
- degree pages
- SEO landing pages

Dynamic/server-rendered pages:

- program search
- scholarship search
- AI Finder
- AI result pages
- AI conversations
- dashboard
- admin
- import/staging tools
- auth callbacks
- analytics endpoints
- report wrong info endpoints

## Astro Rules

Use Astro for pages.

Use React only for interactive islands:

- search filters
- save buttons
- comparison UI
- AI Finder form
- AI chat interface
- dashboard widgets
- admin forms
- import review tables
- media library

Do not build the whole public site as a React SPA.

## Cloudflare Runtime Rules

Build for Cloudflare compatibility from the beginning.

Prefer standard Web APIs:

- fetch
- Request
- Response
- URL
- FormData
- Blob
- crypto.subtle

Avoid Node-only runtime APIs:

- fs
- path
- child_process
- sharp
- puppeteer
- long-running Node scripts inside request handlers

Enable `nodejs_compat` only if needed, but do not rely on it as the main design.

## Cloudflare Deployment Rules

Use Astro Cloudflare adapter for server-rendered/dynamic routes.

Pre-render public SEO pages where possible.

Use `export const prerender = true` for static routes that do not need runtime SSR.

Do not use Vercel-only services:

- Vercel Blob
- Vercel KV
- Vercel Postgres
- Vercel Edge Config
- Vercel-specific image optimization

## Database Architecture

Supabase PostgreSQL is the source of truth.

Use clear plural table names:

- countries
- cities
- universities
- campuses
- degree_levels
- subjects
- programs
- program_intakes
- scholarships
- articles
- seo_landing_pages
- student_profiles
- ai_finder_results
- ai_conversations
- data_sources
- import_batches
- media_assets
- saved_items
- analytics_events

## API Layer

Use Astro server endpoints for sensitive actions.

Examples:

- /api/ai/finder
- /api/ai/chat
- /api/admin/import
- /api/admin/publish
- /api/admin/cloudinary-signature
- /api/reports
- /api/analytics/event
- /api/save-item
- /api/cron/daily-maintenance

Do not let the browser directly do sensitive writes such as:

- calling LLM APIs
- using Supabase service role key
- publishing content
- approving imports
- changing roles
- signed Cloudinary uploads
- cron jobs
- email sending

## Supabase Client Usage

Direct Supabase browser client is allowed only for safe RLS-protected actions:

- read published public content
- read own saved items
- read own profile
- update own student profile
- read own AI results

Server endpoints required for:

- AI calls
- admin publishing
- import approval
- bulk import
- Cloudinary signed upload
- role management
- analytics sanitization
- scheduled jobs
- notification generation
- email sending later

## AI Architecture

Use internal AI Gateway.

Suggested structure:

src/lib/ai/
- gateway.ts
- providers/gemini.ts
- providers/openrouter.ts later
- routing/intent-router.ts
- prompts/
- safety/
- usage/

Do not hardcode business logic around one LLM provider.

## AI Finder Architecture

Correct flow:

1. Student Profile
2. Database filtering
3. Rule-based scoring
4. Shortlist real programs
5. LLM explains results using safe context

AI must not invent:

- programs
- universities
- tuition
- deadlines
- scholarships
- admission requirements

## Search Architecture

MVP search should use PostgreSQL filters and indexes.

Later:

- PostgreSQL full-text search
- trigram search
- materialized views
- pgvector
- external search engine only if needed

## Media Architecture

Cloudinary:
- public images
- transformations
- responsive delivery
- logos
- covers
- article featured images
- OG images

Supabase Storage:
- import CSV/JSON
- raw source files
- temporary admin files
- private files

PostgreSQL:
- media metadata
- entity-media relationships
- alt text
- attribution
- Cloudinary IDs

## Cron / Scheduled Jobs

Use Cloudflare Cron Triggers.

Jobs may include:

- cleanup anonymous AI results
- generate deadline alerts
- aggregate analytics
- mark outdated verification records
- refresh sitemap data
- process lightweight import jobs

Heavy jobs must be chunked and store progress in the database.

## Repository Structure

Recommended:

src/
  components/
  layouts/
  lib/
  pages/
  styles/

supabase/
  migrations/
  seed.sql

scripts/
  import/
  maintenance/

docs/
  phases/
  prompts/
  archive/

public/

## Environment Variables

Public:

- PUBLIC_SUPABASE_URL
- PUBLIC_SUPABASE_ANON_KEY
- PUBLIC_SITE_URL
- PUBLIC_SITE_NAME

Private:

- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_DB_URL
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- GEMINI_API_KEY
- CRON_SECRET
- ADMIN_SETUP_SECRET

Never expose service role keys, AI keys, Cloudinary secrets, or cron secrets to the browser.