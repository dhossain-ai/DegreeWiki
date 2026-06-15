# DegreeWiki Coding Standards

## General Principles

- Prefer simple, clear code.
- Avoid overengineering.
- Keep MVP scope controlled.
- Protect user data.
- Keep Cloudflare runtime compatibility.
- Make database migrations reviewable.
- Never expose secrets to the browser.
- Keep public SEO pages fast and mostly static.
- Use TypeScript strictly.

## TypeScript

Use TypeScript strict mode.

Avoid:

- any
- unsafe type assertions
- untyped API responses
- mixing database shapes with UI shapes without mapping

Prefer:

- typed Supabase clients
- zod validation
- explicit return types for important server functions
- small reusable helper functions

## Naming

Database:

- plural table names
- snake_case columns
- stable code fields where useful
- UUID primary keys

TypeScript:

- camelCase variables
- PascalCase components/types
- kebab-case filenames for route/page components where appropriate

## Astro

Use Astro for public content pages.

Use React only for interactive islands.

Avoid building public pages as full client-side React apps.

## React

Use React for:

- admin forms
- search filters
- AI chat
- AI Finder form
- save buttons
- dashboard widgets
- comparison UI

Keep React components focused and reusable.

## Cloudflare Compatibility

Runtime code should prefer:

- fetch
- Request
- Response
- URL
- FormData
- Blob
- crypto.subtle

Avoid in runtime code:

- fs
- path
- child_process
- sharp
- puppeteer
- long-running Node-only scripts

Heavy processing should happen through:

- scripts
- chunked jobs
- Supabase Storage workflow
- external GitHub Actions where needed

## Supabase

Use Supabase Auth for identity.

Use RLS on all important tables.

Never expose:

- service role key
- database URL
- AI API keys
- Cloudinary secret
- cron secret

Direct browser Supabase writes are allowed only when RLS fully protects the action.

Sensitive actions must use server endpoints.

## Migrations

Every schema change must be a migration.

Migrations should be readable and reviewable.

Include:

- tables
- indexes
- constraints
- RLS enablement
- policies
- seed data only when appropriate

Do not make destructive migrations without explicit review.

## RLS

RLS must protect:

- student_profiles
- saved_items
- ai_finder_results
- ai_conversations
- ai_messages
- admin tables
- import/staging tables
- reports with private submitter data

Public content read policy:

- only published/indexable content should be public

Admin write policy:

- only authorized roles can create/update/publish

## Validation

Validate all API inputs.

Use zod or equivalent validation for:

- forms
- API endpoints
- AI inputs
- import files
- admin actions
- report submissions
- saved item actions

## Error Handling

Return safe errors to users.

Log useful internal errors.

Do not expose:

- stack traces
- secrets
- service role errors
- raw provider responses with sensitive data

## SEO

Every public page should support:

- title
- description
- canonical URL
- Open Graph metadata
- structured data where relevant
- breadcrumbs
- last updated/verified where relevant

Avoid thin generated pages.

## Accessibility

Use semantic HTML.

Forms must have labels.

Buttons must be buttons.

Images need alt text.

Avoid inaccessible custom UI.

## Testing Priority

Test high-risk logic first:

- RLS policies
- auth role checks
- import validation
- AI Finder scoring
- slug generation
- SEO metadata generation
- saved item ownership
- admin permissions
- Cloudflare-compatible API routes

## AI Coding Rule

AI tools must not implement beyond the approved task.

AI tools must update:

- docs/06-status.md
- docs/07-task-log.md

after each implementation session.