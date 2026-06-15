# DegreeWiki Product Decisions

This file stores final decisions only. Do not use this file for brainstorming.

## Product Identity

DegreeWiki is an SEO/AdSense-focused education information platform for international students.

DegreeWiki is separate from EduFriends Global.

## Main Product Principle

DegreeWiki should be:

- content-first
- database-first
- SEO-first
- source-aware
- AI-assisted

AI should support discovery and explanation, but the database should remain the source of truth.

## Naming Decisions

Use `Program`, not `Course`, in the database.

Reason:

- In some countries, “course” means a full degree.
- In others, “course” means one class/module inside a degree.
- DegreeWiki will use `programs` for full bachelor/master/PhD/foundation offerings.
- Later, individual modules can use `program_modules`.

Frontend may still use user-friendly wording such as “Find courses” or “Find degree programs.”

## Main Content Types

DegreeWiki will support:

1. Country
2. City
3. University
4. Campus
5. Degree Level
6. Subject / Field of Study
7. Program
8. Scholarship
9. Guide / Article
10. SEO Landing Page
11. Student Profile
12. AI Finder Result
13. AI Conversation

## Core Data Quality Decision

DegreeWiki’s competitive advantage should be better, fresher, source-backed education data.

Every important public entity should support:

- content status
- verification status
- data completeness score
- source confidence score
- last verified date
- next review due date
- official source URLs

## Import Decision

AI-extracted data must not go directly into live public tables.

Correct flow:

1. Collect official sources
2. Store/import raw data
3. AI extracts structured data
4. Insert into staging tables
5. Validate
6. Detect duplicates
7. Human review
8. Approve/reject/merge
9. Publish to live tables

## AI Finder Decision

AI must not invent program recommendations.

Correct flow:

1. Student profile
2. Database filtering
3. Rule-based scoring
4. Real program shortlist
5. AI explanation based only on selected database records

## AI Chatbot Decision

The chatbot should answer mostly from DegreeWiki data first.

Preferred order:

1. Rule/template response
2. Structured database query
3. RAG/vector search later
4. LLM explanation
5. Fallback/clarification

The chatbot should not freely browse the web for public MVP responses.

## Student Profile Decision

User account and student profile are different.

- Supabase Auth handles login identity.
- `user_profiles` stores app-level user data.
- `student_profiles` stores study-abroad background, goals, budget, IELTS/GPA, preferences, and constraints.

Support anonymous AI trial profiles and logged-in saved profiles.

## Scholarship Decision

Scholarships must be separate first-class entities.

Do not store scholarships only as text inside programs.

Scholarships can relate to:

- countries
- universities
- programs
- subjects
- degree levels
- eligible nationalities

## SEO Landing Page Decision

Do not generate every possible SEO page automatically.

Generate or index only approved quality pages.

SEO landing pages must pass quality checks:

- enough matching results
- useful intro content
- unique SEO title/meta
- FAQ or helpful sections
- internal links
- canonical URL
- no thin content

Thin pages should be noindexed or not generated.

## Media Decision

Cloudinary stores and delivers public images.

Supabase/PostgreSQL stores media metadata.

Supabase Storage stores private/import files.

## Auth/RLS Decision

Use Supabase Auth and Supabase RLS.

Public content is readable by everyone only when published.

Private student data is readable/writable only by the owner.

Admin data is editable only by authorized roles.

Sensitive actions must go through server endpoints.

## Deployment Decision

Primary deployment target: Cloudflare Pages/Workers.

Fallback deployment target: Vercel.

Cloudflare is chosen for SEO-heavy static delivery, cost scaling, and strong edge infrastructure.

Do not lock core data or media into Cloudflare-specific services.

## Monetization Decision

Do not apply to AdSense on day one.

First publish useful, original, trustworthy content.

Ads should never damage trust, SEO, Core Web Vitals, or application decision UX.

## Legal/Disclaimer Decision

DegreeWiki must clearly state:

- it is not an official university/government website
- data can change
- students must verify official sources before applying
- AI recommendations are assistive, not guarantees