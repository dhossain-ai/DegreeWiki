# DegreeWiki Project Overview

## What is DegreeWiki?

DegreeWiki.com is an SEO-focused education information platform for international students.

It helps students discover and compare:

- bachelor programs
- master programs
- scholarships
- universities
- countries
- subjects / fields of study
- study-abroad guides
- AI-assisted best-fit program recommendations

DegreeWiki is separate from EduFriends Global.

## Product Positioning

DegreeWiki should be:

- content-first
- database-first
- SEO-first
- source-aware
- AI-assisted, not AI-dependent

The platform should compete with sites like Mastersportal and Bachelorsportal, but with stronger data quality, more complete program information, better verification, and personalized AI-assisted discovery.

## Main User Types

### Public visitors

Can browse published public content, search programs, read guides, view university/country pages, and try limited AI tools.

### Logged-in students

Can create student profiles, save programs/scholarships, save AI Finder results, use more AI requests, and later receive deadline alerts.

### Admin users

Can manage content, imports, verification, data quality, reports, media, SEO pages, and later monetization/legal settings.

## Core Content Areas

DegreeWiki will include:

- Countries
- Cities
- Universities
- Campuses
- Degree Levels
- Subjects / Fields of Study
- Programs
- Scholarships
- Guides / Articles
- SEO Landing Pages
- Student Profiles
- AI Finder Results
- AI Conversations

## Core Operational Systems

DegreeWiki also needs:

- Data Source / Verification system
- Import / Staging / Review system
- Auth, roles, permissions, and Supabase RLS
- Media / Cloudinary asset system
- User reports / correction system
- Saved items and user dashboard
- Notifications / deadline alerts later
- Analytics / event tracking
- Monetization / AdSense settings later
- Legal pages and privacy/disclaimer system

## MVP Goal

The MVP should prove:

1. DegreeWiki can publish strong SEO pages.
2. Users can search and discover programs.
3. Admin can manage core education data.
4. Data can be imported through a safe staging/review process.
5. AI Finder can recommend real programs from the database.
6. Public pages are fast, crawlable, and source-aware.

## MVP Should Include

- Astro public website
- Supabase PostgreSQL database
- Supabase Auth
- Basic admin dashboard
- Countries
- Cities
- Universities
- Degree levels
- Subjects
- Programs
- Scholarships
- Guides/articles
- SEO metadata system
- Data source tracking
- Import/staging foundation
- Basic AI Finder architecture
- Cloudinary media metadata
- User reports foundation
- Cloudflare deployment

## MVP Should Not Include Yet

- Paid subscriptions
- University partner portal
- Complex CRM
- Full application tracker
- Real-time chat infrastructure
- Separate mobile app
- Complex vector/RAG infrastructure
- Heavy external search engine
- Microservices
- ChromaDB unless pgvector becomes insufficient
- Vercel-specific services

## Core Stack

- Astro.js
- React islands inside Astro
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase RLS
- Cloudflare Pages/Workers
- Cloudinary
- Supabase Storage for private/import files
- Gemini first through AI Gateway
- pgvector later
- GitHub for source control