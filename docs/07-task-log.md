# DegreeWiki Task Log

This file is append-only.

Every AI coding session must add a new entry.

## 2026-06-16 - Phase 10: Public Program Search & Filter Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Upgrade /programs from a basic published-program list into a server-rendered program
discovery page with GET-form search and filters.
No admin changes, no migrations, no new dependencies, no React, no client-side JS,
no AI, no saved items, no service_role.

---

### Files Changed

src/layouts/BaseLayout.astro (modified):
  Added optional noindex?: boolean prop to Props interface.
  Renders <meta name="robots" content="noindex, follow"> when noindex is true.
  Additive change — no effect on any existing page that does not pass the prop.

src/layouts/PublicLayout.astro (modified):
  Added noindex?: boolean prop to Props interface.
  Passes noindex through to BaseLayout.
  Additive change — all existing public and admin pages unaffected.

src/pages/programs/index.astro (full replacement):
  Previous version: single Supabase query, 4-column table, LIMIT 100, no filters.
  New version: GET filter form, 10 conditional filters, parallel lookup queries,
  card result list, result count, over-limit notice, two empty states, noindex logic.

---

### Enum Values Confirmed

From supabase/migrations/006_programs.sql CHECK constraints:

  study_mode:    full_time | part_time | online | hybrid
  delivery_mode: on_campus | online | hybrid | distance
  tuition_period: per_year | per_semester | total | per_credit
    (used in tuition display only — not a filter)

---

### Query Params Implemented

  q             — programs.title ilike '%q%'
  country       — programs.country_id = <uuid>
  city          — programs.city_id = <uuid>
  university    — programs.university_id = <uuid>
  degree_level  — programs.degree_level_id = <uuid>
  subject       — programs.primary_subject_id = <uuid>
  study_mode    — programs.study_mode = <enum>
  delivery_mode — programs.delivery_mode = <enum>
  language      — programs.language_of_instruction ilike '%language%'
  tuition_max   — programs.tuition_max_amount <= value

---

### Validation Behavior

  q:             trim(), slice(0, 100). Empty string → undefined (filter absent).
  language:      trim(), slice(0, 80). Empty string → undefined (filter absent).
  UUID params:   validated against /^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i.
                 Non-matching values → undefined (filter absent, no crash).
  study_mode:    validated against ['full_time','part_time','online','hybrid'].
                 Unknown value → undefined (filter absent).
  delivery_mode: validated against ['on_campus','online','hybrid','distance'].
                 Unknown value → undefined (filter absent).
  tuition_max:   parseFloat(). Must be isFinite && > 0.
                 NaN, negative, zero → undefined (filter absent).
  All failures are silent — no error messages, no crashes, filter treated as absent.

---

### Supabase Query Strategy

Programs query:
  supabase.from('programs').select(..., { count: 'exact' })
    .eq('content_status', 'published')
    .order('title')
    .limit(201)
  Filters chained conditionally after the base query:
    if (q)              query = query.ilike('title', `%${q}%`)
    if (countryId)      query = query.eq('country_id', countryId)
    if (cityId)         query = query.eq('city_id', cityId)
    if (universityId)   query = query.eq('university_id', universityId)
    if (degreeLevelId)  query = query.eq('degree_level_id', degreeLevelId)
    if (subjectId)      query = query.eq('primary_subject_id', subjectId)
    if (studyMode)      query = query.eq('study_mode', studyMode)
    if (deliveryMode)   query = query.eq('delivery_mode', deliveryMode)
    if (language)       query = query.ilike('language_of_instruction', `%${language}%`)
    if (tuitionMax != null) query = query.lte('tuition_max_amount', tuitionMax)

  { count: 'exact' } returns total count alongside data (no second round-trip).
  .limit(201) fetches one extra row to detect over-limit without a second query.
  allRows.slice(0, 200) used for rendering; overLimit = (count ?? allRows.length) > 200.

Lookup queries (parallel via Promise.all):
  countries:     .select('id, name').order('name')
  cities:        .select('id, name').order('name')
  universities:  .select('id, name, slug').order('name')
  degree_levels: .select('id, name').order('display_order')
  subjects:      .select('id, name').order('name')
  All use the anon client — RLS limits each to published/active rows automatically.
  Failed lookups default to [] (data ?? []) — page does not crash on lookup error.

Client: createClient(Astro.cookies, Astro.request) throughout. Anon key only. No service_role.

---

### Noindex Behavior

  hasFilters = true when any of the 10 params resolves to a valid, non-empty value.
  <PublicLayout noindex={hasFilters}> passes through to BaseLayout.
  BaseLayout renders <meta name="robots" content="noindex, follow"> when noindex=true.
  GET /programs (no params) → no robots meta tag, page is indexable.
  GET /programs?<any-filter> → noindex, follow tag present in <head>.
  All other public pages (universities, guides, scholarships, detail pages) are
  unaffected — they never pass the noindex prop.
  All admin pages are unaffected — they use AdminLayout, not PublicLayout.

---

### Build Result

npm run build: PASS
Output: Cloudflare server build, 1.32s, zero errors, zero warnings.

---

### service_role Search Result

Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role"
→ (no output) — 0 matches across all src/ files.

---

### Manual Test Checklist

- GET /programs — blank form, all published programs listed alphabetically,
  no noindex tag in page source
- GET /programs?q=science — title filter works, q field pre-filled,
  noindex, follow present in page source
- GET /programs?country=<valid-uuid> — country dropdown shows selection, results filtered
- GET /programs?country=not-a-uuid — treated as no filter, page renders without error
- GET /programs?study_mode=full_time — dropdown shows "Full time" selected
- GET /programs?study_mode=bogus — treated as no filter, all programs shown
- GET /programs?delivery_mode=on_campus — dropdown shows "On campus" selected
- GET /programs?tuition_max=20000 — filters correctly; note visible below input field
- GET /programs?tuition_max=-50 — treated as no filter, tuition_max field empty
- GET /programs?tuition_max=abc — treated as no filter
- GET /programs?language=English — results filtered, language field pre-filled
- All 10 filters active simultaneously — combined filtering works, clear link visible
- Result count shows "N programs found." correctly
- Over-200 notice appears when matching programs exceed 200
- Empty result with filters → "No programs match your filters." + clear filters link
- Empty result without filters → "No programs have been published yet."
- Program card: title link, university link, country/city, degree badge, subject badge,
  study mode badge, delivery badge, language badge, tuition range all render correctly
- University link goes to /universities/[slug]
- Title link goes to /programs/[slug] (detail page loads without regression)
- Clear filters link returns to plain /programs
- Selected filter values preserved after form submit
- GET /programs/[slug] — detail page unaffected (no regression)
- GET /admin/ unauthenticated — redirects to /login (no admin regression)

---

### Explicit Exclusions

- No React or client-side JavaScript of any kind.
- No migrations (none required — all filter columns already exist with indexes).
- No service_role in src/ (0 matches confirmed by PowerShell search).
- No AI features.
- No saved items or user dashboard.
- No SEO landing pages for filter combinations.
- No admin page changes (zero admin files touched).
- No new npm dependencies.
- No pagination UI (hard limit 200 with over-limit notice).
- No program_subjects junction for multi-subject filtering (primary_subject_id only).
- No city-scoped-by-country dropdown dependency (global city list, deferred to Phase 11).
- No cross-table full-text search (title ilike only — university name search deferred).
- No /programs/[slug].astro changes.

---

## 2026-06-16 - Phase 09: Public Read-Only Content Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Add safe public read-only pages for universities, programs, scholarships, and guides/articles.
No admin changes, no migrations, no service_role, no React, no client-side JS, no new dependencies.

---

### Preflight: Schema Columns and RLS Verification

Confirmed actual columns from migrations 004–008 before writing any code.

universities (migration 005):
  id, name, slug (UNIQUE), country_id, city_id, official_url, founded_year, student_count,
  ranking_summary, overview, content_status, verification_status, indexing_status,
  data_completeness_score, source_confidence_score, last_verified_at, next_review_due_at,
  logo_id, cover_image_id, og_image_id, seo_title, seo_description, seo_h1, canonical_url,
  og_title, og_description, created_at, updated_at.

programs (migration 006):
  id, slug (UNIQUE), title, university_id, campus_id, country_id, city_id, degree_level_id,
  degree_award, primary_subject_id, duration_months, study_mode, delivery_mode,
  language_of_instruction, tuition_min_amount, tuition_max_amount, tuition_currency,
  tuition_period, tuition_notes, application_fee_amount, application_fee_currency,
  application_fee_notes, application_url, official_url, admission_requirements (TEXT),
  english_requirements (JSONB — confirmed real column), gpa_requirements,
  curriculum_summary, career_outcomes, content_status, verification_status, indexing_status,
  data_completeness_score, source_confidence_score, last_verified_at, next_review_due_at,
  og_image_id, seo_title, seo_description, seo_h1, canonical_url, og_title, og_description,
  created_at, updated_at.

scholarships (migration 007):
  id, slug (UNIQUE), name, scholarship_type, provider_name, provider_type, funding_type,
  application_type, overview, eligibility_summary, amount_min, amount_max, currency,
  coverage_notes, deadline (date), deadline_text, official_url, application_url, provider_url,
  content_status, verification_status, indexing_status, data_completeness_score,
  source_confidence_score, last_verified_at, next_review_due_at, og_image_id,
  seo_title, seo_description, seo_h1, canonical_url, og_title, og_description,
  created_at, updated_at.

articles (migration 008):
  id, slug (UNIQUE), title, summary, content, author_user_id, article_category_id,
  featured_image_id, og_image_id, content_status, verification_status, indexing_status,
  data_completeness_score, source_confidence_score, published_at (nullable),
  seo_title, seo_description, seo_h1, canonical_url, og_title, og_description,
  created_at, updated_at.

article_categories (migration 008):
  id, name, slug (UNIQUE), parent_category_id (self-ref), display_order,
  created_at, updated_at.

countries (migration 004):
  id, iso2, iso3, name, slug, continent, overview, content_status, verification_status,
  indexing_status, data_completeness_score, source_confidence_score, last_verified_at,
  next_review_due_at, og_image_id, seo_title, seo_description, seo_h1, canonical_url,
  og_title, og_description, created_at, updated_at.

cities (migration 004):
  id, name, slug, country_id, content_status, created_at, updated_at.
  Note: slug is unique within a country (composite UNIQUE), not globally.

degree_levels (migration 004):
  id, code (UNIQUE), name, display_order, is_active.
  No content_status column — uses is_active boolean instead.

subjects (migration 004):
  id, name, slug (UNIQUE), parent_subject_id (self-ref), display_order, content_status,
  created_at, updated_at.

Confirmed RLS public SELECT policies (all PASS — no stop condition triggered):

  universities       → universities_select_published      USING (content_status = 'published')  no TO clause
  programs           → programs_select_published           USING (content_status = 'published')  no TO clause
  scholarships       → scholarships_select_published       USING (content_status = 'published')  no TO clause
  articles           → articles_select_published           USING (content_status = 'published')  no TO clause
  article_categories → article_categories_select_public   USING (true)                          no TO clause
  countries          → countries_select_published          USING (content_status = 'published')  no TO clause
  cities             → cities_select_published             USING (content_status = 'published')  no TO clause
  degree_levels      → degree_levels_select_active         USING (is_active = true)              no TO clause
  subjects           → subjects_select_published           USING (content_status = 'published')  no TO clause

No migrations needed. Implementation proceeded.

---

### Files Created

src/components/public/PublicNav.astro:
  Horizontal nav bar. Site name on left, four nav links on right.
  Active link detection via Astro.url.pathname.startsWith(link.href).
  Links: /universities, /programs, /scholarships, /guides.

src/layouts/PublicLayout.astro:
  Wraps BaseLayout. Includes PublicNav above <main>. Passes title + description through.

src/pages/404.astro:
  PublicLayout-based 404 page. Centered layout: large 404 number, h1, links to all public sections.

src/pages/universities/index.astro:
  Fetches published universities. Embedded joins: countries(name), cities(name).
  Table columns: University (link to detail), Country, City, Ranking.
  Empty state: "No results yet." LIMIT 100.

src/pages/universities/[slug].astro:
  Fetches single published university by slug. Returns 404 if not found or not published.
  Facts grid (dl): Country, City, Founded, Students, Official Website.
  Prose sections: Rankings, Overview.
  Back link: ← All Universities.
  SEO: title from seo_title ?? name; description from seo_description ?? ranking_summary.

src/pages/programs/index.astro:
  Fetches published programs. Embedded joins: universities(name, slug), degree_levels(name).
  Table columns: Program (link), University (link to /universities/[slug]), Degree Level, Study Mode.
  LIMIT 100.

src/pages/programs/[slug].astro:
  Fetches single published program by slug. Returns 404 if not found or not published.
  Embedded joins: universities(name, slug), degree_levels(name), subjects(name),
  countries(name), cities(name).
  Facts grid: Degree Level, Degree Award, Subject, Country, City, Study Mode, Delivery, Language,
  Duration, Tuition, GPA Requirement, Official Page, Apply.
  Prose sections: Tuition Notes, Application Fee, Curriculum, Career Outcomes,
  Admission Requirements, English Requirements.
  admission_requirements (TEXT): rendered as whitespace-pre-wrap paragraph.
  english_requirements (JSONB): rendered with JSON.stringify(null, 2) in <pre> block
  only when non-null and Object.keys().length > 0.
  SEO: title from seo_title ?? title; description from seo_description.

src/pages/scholarships/index.astro:
  Fetches published scholarships.
  Table columns: Scholarship (link), Type (formatted label), Provider, Funding (amount range), Deadline.
  LIMIT 100.

src/pages/scholarships/[slug].astro:
  Fetches single published scholarship by slug. Returns 404 if not found or not published.
  Facts grid: Type, Funding Type, Provider, Provider Type, How to Apply, Amount, Deadline,
  Official Page, Apply, Provider Website.
  Prose sections: Overview, Eligibility, What's Covered, Deadline Notes.
  deadline rendered as formatted date (en-US locale) with fallback to deadline_text.
  SEO: title from seo_title ?? name; description from seo_description ?? eligibility_summary.

src/pages/guides/index.astro:
  Fetches published articles ordered by published_at DESC. Embedded join: article_categories(name).
  Card layout: category badge, date, title (link to detail), summary excerpt.
  LIMIT 100.

src/pages/guides/[slug].astro:
  Fetches single published article by slug. Returns 404 if not found or not published.
  Embedded join: article_categories(name, slug).
  Category badge + published date above h1.
  summary rendered as blockquote-style aside.
  content split on \n\n → array of <p> paragraphs. Plain text only. No set:html.
  published_at nullable — rendered gracefully; no date shown if null.
  SEO: title from seo_title ?? title; description from seo_description ?? summary.

---

### Files Modified

src/layouts/BaseLayout.astro:
  Added optional description?: string prop.
  Injects <meta name="description" content={description} /> when present.
  Additive change — AdminLayout never passes description, no effect on admin pages.

src/pages/index.astro:
  Added publicLinks nav row (Universities, Programs, Scholarships, Guides)
  above the auth-conditional block. Visible to all visitors.

---

### Routes Created

  /universities          → src/pages/universities/index.astro      (list, no auth)
  /universities/[slug]   → src/pages/universities/[slug].astro     (detail, no auth)
  /programs              → src/pages/programs/index.astro           (list, no auth)
  /programs/[slug]       → src/pages/programs/[slug].astro         (detail, no auth)
  /scholarships          → src/pages/scholarships/index.astro      (list, no auth)
  /scholarships/[slug]   → src/pages/scholarships/[slug].astro     (detail, no auth)
  /guides                → src/pages/guides/index.astro             (list, no auth)
  /guides/[slug]         → src/pages/guides/[slug].astro           (detail, no auth)
  /404                   → src/pages/404.astro                      (error page, no auth)

---

### Columns Actually Used Per Page

universities list:    id, name, slug, ranking_summary, countries(name), cities(name)
universities detail:  + official_url, founded_year, student_count, overview,
                        seo_title, seo_description

programs list:        id, title, slug, study_mode,
                      universities(name, slug), degree_levels(name)
programs detail:      + degree_award, duration_months, delivery_mode,
                        language_of_instruction, tuition_min_amount, tuition_max_amount,
                        tuition_currency, tuition_period, tuition_notes,
                        application_fee_amount, application_fee_currency,
                        application_fee_notes, application_url, official_url,
                        admission_requirements, english_requirements, gpa_requirements,
                        curriculum_summary, career_outcomes, seo_title, seo_description,
                        subjects(name), countries(name), cities(name)

scholarships list:    id, name, slug, scholarship_type, provider_name, funding_type,
                      amount_min, amount_max, currency, deadline
scholarships detail:  + provider_type, application_type, overview, eligibility_summary,
                        coverage_notes, deadline_text, official_url, application_url,
                        provider_url, seo_title, seo_description

guides list:          id, title, slug, summary, published_at, article_categories(name)
guides detail:        + content, seo_title, seo_description, article_categories(name, slug)

---

### RLS / Public Filtering Strategy

Every query against a content table includes .eq('content_status', 'published').
Lookup tables (countries, cities, degree_levels, subjects, article_categories) are reached
only as embedded joins on published parent rows — never queried independently on public pages.

Embedded joins that fail RLS (e.g. city is draft) return null for that nested object.
All templates handle nulls with optional chaining (?.) and ?? fallbacks or conditional rendering.

Missing or unpublished slug → return new Response(null, { status: 404 }).
Returns a true HTTP 404 with empty body. The 404.astro page is served by Astro/Cloudflare
for route-not-found cases (no matching .astro file).

---

### Build Result

npm run build: PASS
Output: Cloudflare server build, 1.42s, zero errors, zero warnings.

---

### service_role Search Result

Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "service_role"
→ (no output) — 0 matches across all src/ files.

---

### Manual Test Checklist

- GET /universities → 200, table with published rows or "No results yet."
- GET /universities/[published-slug] → 200, name, country, city, overview visible
- GET /universities/[draft-slug] → 404 response
- GET /universities/does-not-exist → 404 response
- GET /programs → 200, university link renders as anchor to /universities/[slug]
- GET /programs/[published-slug] → 200, tuition, curriculum, admission requirements visible
- GET /programs/[slug-with-english-requirements] → JSON block visible in <pre>
- GET /scholarships → 200, deadline column and amount range visible
- GET /scholarships/[published-slug] → 200, eligibility summary and URLs present
- GET /guides → 200, card list with category badge and date
- GET /guides/[published-slug] → 200, content rendered as plain text paragraphs, no HTML tags
- GET /guides/[slug-with-null-published-at] → 200, no date shown, no crash
- Any list page with no published records → 200, "No results yet." message
- GET /404 → 404 page renders with links to all public sections
- GET /admin/ unauthenticated → redirects to /login (no admin regression)
- GET / authenticated → shows email, admin link, and public nav links
- GET / unauthenticated → shows "Sign in" link and public nav links
- <title> on detail page → seo_title if set, else name/title
- <meta name="description"> → present when seo_description or fallback exists
- All 8 public routes accessible without auth (no redirect to /login)

---

### Explicit Exclusions

- No search, filter, or sort UI.
- No pagination controls (hard LIMIT 100 on all listing pages).
- No media or Cloudinary work (logo_id, cover_image_id, featured_image_id ignored).
- No AI features.
- No saved items, user dashboard, or student profile.
- No comments or report-wrong-info form.
- No admin page changes (zero admin files touched).
- No new npm dependencies.
- No migrations.
- No junction table display (scholarship_countries, article_subjects, etc.).
- No author name display on articles (author_user_id join deferred).
- No rich text or markdown rendering for article content.
- No og: tags, structured data, sitemap, or robots.txt.
- No /countries, /cities, /subjects, or /degree-levels public routes.

---

## 2026-06-16 - Phase 08: Articles / Guides CRUD Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Add safe admin create/edit forms for articles/guides through server-side Astro form POST handling.
No migrations, no service_role, no React, no client-side JS.

Pre-implementation column verification:
- articles: id, slug, title, summary, content, author_user_id, article_category_id,
  featured_image_id, og_image_id, content_status, verification_status, indexing_status,
  data_completeness_score, source_confidence_score, published_at,
  seo_title, seo_description, seo_h1, canonical_url, og_title, og_description,
  created_at, updated_at (migration 008).
- article_categories: id, name, slug, parent_category_id, display_order, created_at, updated_at.
  7 rows seeded in migration 015:
  Country Guides, University Guides, Program Guides, Scholarship Guides,
  Application Advice, Visa and Work, Student Life.
- Junction tables confirmed (all deferred): article_countries, article_subjects, article_degree_levels.
- Existing src/pages/admin/articles.astro was a read-only stub (no create/edit, no New button).
  AdminSidebar already listed /admin/articles — no sidebar change needed.

Completed:

src/pages/admin/articles.astro DELETED.
Reason: cannot have both articles.astro (file) and articles/ (folder) in the same directory.
Same URL /admin/articles retained via articles/index.astro.

src/pages/admin/articles/index.astro (replaces stub):
- Two parallel Supabase queries: articles list + article_categories (for name lookup).
- Category names resolved via Map<id, name> (no join, per approved plan).
- List table: title, slug, category name, content_status badge, published_at, created_at, Edit link.
- "+ New Article" button (top-right).
- Empty state with link to create first article.

src/pages/admin/articles/new.astro (create form):
- 8 fields across 5 sections: Identity, Categorisation, Content, Publishing, Verification.
- article_categories loaded via separate query; validCategoryIds Set used for server-side validation.
- author_user_id set to user.id on INSERT only; not shown in form.
- published_at set to new Date().toISOString() on INSERT only if content_status === 'published'.
- POST-redirect-GET to /admin/articles on success.
- 23505 → "An article with this slug already exists."

src/pages/admin/articles/[id].astro (edit form):
- article record and article_categories loaded in parallel (Promise.all).
- 404 if article not found.
- published_at logic: isFirstPublish = (values.content_status === 'published' && record.published_at === null).
  Only then is published_at: new Date().toISOString() included in the UPDATE payload.
  Subsequent saves and re-publishes do not modify published_at.
- author_user_id NOT included in update payload — never overwritten.
- Same validation and form structure as new.astro.
- Uses .update().eq('id', id).
- Page title: "Edit {record.title}".
- Button text: "Save Changes".

src/lib/admin/validate.ts: NO CHANGES — all existing helpers sufficient.
  validateRequired, validateSlug, validateIn all reused.

Validation behavior:
- Required: title, slug, content_status, indexing_status, verification_status.
- Slug auto-generated from title via toSlug() if blank on POST.
- Slug format: ^[a-z0-9]+(?:-[a-z0-9]+)*$.
- content_status: required + validateIn against 5 enum values.
- indexing_status: required + validateIn against 3 values (draft|index|noindex).
- verification_status: required + validateIn against 6 enum values.
- article_category_id: optional; if non-empty, validated against validCategoryIds Set
  (loaded from article_categories before POST handling). Submitted as null when empty.
- summary, content: optional; no length or format validation.
- Form values preserved on validation failure.
- Constraint errors (code 23505) surface as human-readable messages.

Important decisions:
- published_at set only once — on first transition to content_status = 'published'.
  Not a DB trigger. Not reset on re-publish. record.published_at read from the initial
  SELECT to detect whether this is a first publish (null → 'published').
- author_user_id set silently on INSERT using user.id from the guard result.
  Not displayed in the form. Not touched on UPDATE.
- article_category_id validated server-side against the live Set of loaded category IDs.
  Empty string submitted as null (|| null pattern, consistent with Phase 06/07).
- SEO fields (seo_title, seo_description, seo_h1, canonical_url, og_title, og_description) — deferred.
- Media fields (featured_image_id, og_image_id) — deferred (no upload capability).
- Junction tables (article_countries, article_subjects, article_degree_levels) — deferred.
- data_completeness_score, source_confidence_score — server-computed; not in form.
- Guard: requireSuperAdmin (consistent with all Phase 05–07 admin pages).
- No new guard functions, no new validate.ts helpers, no new npm dependencies.
- No public guide/article pages added.
- No delete added.

Fields intentionally skipped:
- author_user_id (auto-set on insert, never shown)
- featured_image_id, og_image_id (no media upload)
- data_completeness_score, source_confidence_score (server-set)
- published_at (server-set, not a form field)
- seo_title, seo_description, seo_h1, canonical_url, og_title, og_description (deferred)
- All three junction tables (deferred)

Build result:
npm run build: PASS (Cloudflare output, 6.74s, zero errors)

service_role search:
Grep "service_role" in src/ → 0 matches

Git status:
- deleted: src/pages/admin/articles.astro
- untracked: src/pages/admin/articles/
- modified: docs/06-status.md
- modified: docs/07-task-log.md

Files created:
- src/pages/admin/articles/index.astro
- src/pages/admin/articles/new.astro
- src/pages/admin/articles/[id].astro

Files modified:
- docs/06-status.md
- docs/07-task-log.md

Files deleted:
- src/pages/admin/articles.astro (replaced by articles/index.astro)

Manual test checklist:
- Visit /admin/articles while logged out → redirect to /login
- Visit /admin/articles as non-super-admin → 403 Forbidden
- Visit /admin/articles as super_admin → list renders with "+ New Article" button
- Empty list shows "No articles found. Add the first one." link
- Submit empty create form → errors on Title, Slug, Status
- Enter title only, leave slug blank → slug auto-generated from title
- Create duplicate slug → server error "An article with this slug already exists."
- Create without category → row in list shows — in category column
- Create with category → category name appears in list
- Create with content_status = published → published_at set in DB, date shown in list
- Create with content_status = draft → published_at is null, — in list
- Click Edit → form pre-populated with all saved values
- Change title, save → list shows updated title
- Edit published article, change title only → published_at unchanged
- Edit draft article, change to published → published_at set for first time
- Edit already-published article, change to unpublished then back to published → published_at not reset
- Category dropdown shows all 7 seeded categories on create and edit forms
- Visit /admin/articles/nonexistent-uuid → 404

Next:
- Manually verify all three article routes against the test checklist above.
- Verify author_user_id is set correctly in Supabase after create.
- Verify published_at behavior on first publish and re-publish.
- Merge feature/phase-08-articles-crud-foundation to main after manual verification.
- Begin Phase 09: TBD (SEO fields, junction table editors, or public guide pages).

---

## 2026-06-16 - Phase 07: Scholarships CRUD Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Add safe admin create/edit forms for scholarships through server-side Astro form POST handling.
No migrations, no service_role, no React, no client-side JS.

Pre-implementation column verification:
- scholarships: id, slug, name, scholarship_type, provider_name, provider_type, funding_type,
  application_type, overview, eligibility_summary, amount_min, amount_max, currency,
  coverage_notes, deadline, deadline_text, official_url, application_url, provider_url,
  content_status, verification_status, indexing_status, data_completeness_score,
  source_confidence_score, last_verified_at, next_review_due_at, og_image_id,
  seo_title, seo_description, seo_h1, canonical_url, og_title, og_description,
  created_at, updated_at (migration 007).
  No funding_period, funding_percentage, or covers_* boolean columns exist.
  eligibility_summary is the actual column (not eligibility_overview).
  amount_min/amount_max/currency are actual column names (not funding_amount_min etc).

Instruction field name mismatches resolved:
  funding_amount_min → amount_min; funding_amount_max → amount_max;
  funding_currency → currency; eligibility_overview → eligibility_summary.
  funding_period, funding_percentage, covers_* → do not exist, omitted.

Relationship tables: all six are many-to-many junction tables.
  scholarship_countries, scholarship_universities, scholarship_programs,
  scholarship_subjects, scholarship_degree_levels, scholarship_eligible_nationalities.
  All deferred to Phase 08 — no direct FK on scholarships row, no simple editor possible.

Completed:

src/pages/admin/scholarships.astro DELETED.
Reason: cannot have both scholarships.astro (file) and scholarships/ (folder) in the same directory.
Same URL /admin/scholarships retained via scholarships/index.astro.

src/pages/admin/scholarships/index.astro (migrated + enhanced):
- List table: name, slug, scholarship_type, content_status badge, deadline, created_at, Edit link.
- "+ New Scholarship" button.
- Empty state with link to create first scholarship.

src/pages/admin/scholarships/new.astro (create form):
- 20 fields across 7 sections: Identity, Classification, Funding, Deadline, URLs, Content, Verification.
- scholarship_type is required (per approved constraints).
- provider_type, funding_type, application_type optional but validated against DB enum if provided.
- amount_min, amount_max: optional non-negative numeric; cross-field max >= min check.
- deadline: <input type="date">; server-side isNaN(new Date(value).getTime()) check.
- deadline_text: free-text fallback for deadline.
- official_url, application_url, provider_url: optional http/https URL validation.
- coverage_notes: textarea.
- currency: free-text input with placeholder "EUR, USD, GBP".
- No dropdown dependencies — no related entity selects needed.
- POST-redirect-GET to /admin/scholarships on success.
- 23505 → "A scholarship with this slug already exists."

src/pages/admin/scholarships/[id].astro (edit form):
- Loads existing record with explicit select of all 20 form fields.
- 404 if scholarship not found.
- Numeric columns converted to strings for form state prefill (String(record.X) or '').
- Same validation and form structure as new.astro.
- Uses .update().eq('id', id).
- Page title: "Edit {record.name}".
- Button text: "Save Changes".

src/lib/admin/validate.ts: NO CHANGES — all existing helpers sufficient.
  validateRequired, validateSlug, validateIn, validateNumeric, validateUrl all reused.

Validation behavior:
- Required: name, slug, scholarship_type, content_status, verification_status.
- Slug auto-generated from name via toSlug() if blank on POST.
- Slug format: ^[a-z0-9]+(?:-[a-z0-9]+)*$.
- scholarship_type: required + validateIn against 7 enum values.
- provider_type, funding_type, application_type: optional; validateIn only if non-empty.
- amount_min, amount_max: validateNumeric(min:0). Cross-field: max >= min.
- deadline: if non-empty, isNaN(new Date(value).getTime()) check.
- official_url, application_url, provider_url: validateUrl (http/https only; empty = null = valid).
- content_status: required + validateIn against 5 enum values.
- verification_status: required + validateIn against 6 enum values.
- Form values preserved on validation failure.
- Constraint errors (code 23505) surface as human-readable messages.

Fields intentionally skipped:
- indexing_status (premature for manual data entry phase)
- All SEO fields (seo_title, seo_h1, canonical_url, og_title, og_description)
- og_image_id (no media upload)
- data_completeness_score, source_confidence_score (server-set fields)
- last_verified_at, next_review_due_at
- All six junction tables (deferred to Phase 08)

Build result:
npm run build: PASS (Cloudflare output, 2.75s, zero errors)

PowerShell service_role search:
Get-ChildItem src -Recurse -File | Select-String -Pattern "service_role" → 0 matches

Git status:
- deleted: src/pages/admin/scholarships.astro
- untracked: src/pages/admin/scholarships/
- modified: docs/06-status.md
- modified: docs/07-task-log.md

Files created:
- src/pages/admin/scholarships/index.astro
- src/pages/admin/scholarships/new.astro
- src/pages/admin/scholarships/[id].astro

Files modified:
- docs/06-status.md
- docs/07-task-log.md

Files deleted:
- src/pages/admin/scholarships.astro (replaced by scholarships/index.astro)

Next:
- Manually verify all three scholarship routes: anonymous redirect, student 403, super_admin access.
- Test scholarship create: required field errors, slug auto-gen, duplicate slug, numeric errors,
  amount_max < amount_min error, invalid URL error, invalid date, successful create.
- Verify created scholarship row has correct field values in Supabase.
- Test scholarship edit: prefill, save changes, 404 on nonexistent ID.
- Merge feature/phase-07-scholarships-crud-foundation to main after manual verification.

---

## 2026-06-16 - Phase 06: Programs CRUD Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Add safe admin create/edit forms for programs through server-side Astro form POST handling.
No migrations, no service_role, no React, no client-side JS.

Pre-implementation column verification:
- programs: id, slug, title, university_id, campus_id, country_id, city_id, degree_level_id,
  degree_award, primary_subject_id, duration_months, study_mode, delivery_mode,
  language_of_instruction, tuition_min_amount, tuition_max_amount, tuition_currency,
  tuition_period, tuition_notes, application_fee_amount, application_fee_currency,
  application_fee_notes, application_url, official_url, admission_requirements,
  english_requirements (jsonb), gpa_requirements, curriculum_summary, career_outcomes,
  content_status, verification_status, indexing_status, data_completeness_score,
  source_confidence_score, last_verified_at, next_review_due_at, og_image_id,
  seo_title, seo_description, seo_h1, canonical_url, og_title, og_description,
  created_at, updated_at (migration 006).
  No overview column. No duration_text column. No official_program_url column.
  No admission_requirements_text column. english_requirements is jsonb, not text.

Plan name mismatches resolved:
  duration_text → duration_months (integer); official_program_url → official_url;
  admission_requirements_text → admission_requirements; english_requirements_text → jsonb, skipped.

Completed:

src/pages/admin/programs.astro DELETED.
Reason: cannot have both programs.astro (file) and programs/ (folder) in the same directory.
Same URL /admin/programs retained via programs/index.astro.

src/pages/admin/programs/index.astro (migrated + enhanced):
- List table: title, university name (from map), degree level code (from map),
  content_status badge, created_at, Edit link.
- Separate query + Map for university names (no join — per Approved Decision 9).
- Separate query + Map for degree level codes (same pattern as Phase 04 flat page).
- "+ New Program" button.

src/pages/admin/programs/new.astro (create form):
- 26 fields across 8 sections: Identity, Academic Details, Tuition, Application Fees,
  URLs, Admissions, Content, Verification.
- country_id and city_id NOT exposed as dropdowns. Derived server-side from the
  universities array (already loaded for dropdown) on every POST by finding
  universities.find(u => u.id === values.university_id).
- Warning banner shown if universities list is empty.
- POST-redirect-GET to /admin/programs on success.
- 23505 → "A program with this slug already exists."

src/pages/admin/programs/[id].astro (edit form):
- Loads existing record with explicit select of all 26 form fields.
- 404 if program not found.
- Numeric columns converted to strings for form state prefill (String(record.X) or '').
- Same validation and form structure as new.astro.
- Uses .update().eq('id', id).
- Page title: "Edit {record.title}".
- Button text: "Save Changes".

src/lib/admin/validate.ts (extended):
- Added validateNumeric(value, label, { min? }): non-empty numeric check, optional min floor.
- Added validateUrl(value, label): non-empty http/https URL check using new URL() constructor.

Validation behavior:
- Required: title, slug, university_id, degree_level_id, content_status, verification_status.
- Slug auto-generated from title via toSlug() if blank on POST.
- Slug format: ^[a-z0-9]+(?:-[a-z0-9]+)*$.
- Enum fields validated with validateIn against DB CHECK constraint values.
- Optional enum fields (study_mode, delivery_mode, tuition_period): only validated if non-empty.
- duration_months: if non-empty, must be positive integer (isFinite, >=1, isInteger check).
- tuition_min_amount, tuition_max_amount: validateNumeric(min:0). Cross-field: max >= min.
- application_fee_amount: validateNumeric(min:0).
- official_url, application_url: validateUrl (http/https only; empty = null = valid).
- University existence check: universities.find() after university_id required check.
- Form values preserved on validation failure.
- Constraint errors (code 23505) surface as user-readable messages.

Derived country/city behavior:
- On every POST (create or edit), universities array is loaded before the handler runs.
- After validation passes, university is found: const uni = universities.find(u => u.id === values.university_id)!
- country_id = uni.country_id (NOT NULL in universities table).
- city_id = uni.city_id ?? null (nullable in universities table).
- Both written to programs row. Never exposed as form inputs.

Fields intentionally skipped:
- campus_id (no campus CRUD yet, nullable — programs insert fine without it)
- english_requirements (jsonb — no plain-text fallback, deferred to future phase)
- indexing_status (premature for manual data entry phase)
- All SEO fields (seo_title, seo_h1, canonical_url, og_title, og_description)
- og_image_id (no media upload)
- data_completeness_score, source_confidence_score (server-set fields)
- last_verified_at, next_review_due_at

Build result:
npm run build: PASS (Cloudflare output, 7.74s, zero errors)

PowerShell service_role search:
Get-ChildItem src -Recurse -File | Select-String -Pattern "service_role" → 0 matches

Git status:
- modified: src/lib/admin/validate.ts
- modified: docs/06-status.md
- modified: docs/07-task-log.md
- deleted: src/pages/admin/programs.astro
- untracked: src/pages/admin/programs/

Files created:
- src/pages/admin/programs/index.astro
- src/pages/admin/programs/new.astro
- src/pages/admin/programs/[id].astro

Files modified:
- src/lib/admin/validate.ts
- docs/06-status.md
- docs/07-task-log.md

Files deleted:
- src/pages/admin/programs.astro (replaced by programs/index.astro)

Next:
- Manually verify all three program routes: anonymous redirect, student 403, super_admin access.
- Test program create: required field errors, slug auto-gen, duplicate slug, numeric errors,
  tuition max < min error, invalid URL error, successful create.
- Verify created program row has correct country_id and city_id from university.
- Test program edit: prefill, save changes, 404 on nonexistent ID.
- Merge feature/phase-06-programs-crud-foundation to main after manual verification.

---

## 2026-06-16 - Phase 05: Admin CRUD Foundation for Core Content

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Add safe admin create/edit forms for countries, cities, universities, degree levels (edit only),
and subjects through server-side Astro form POST handling. No migrations, no service_role,
no React, no client-side JS.

Pre-implementation column verification:
- countries: id, iso2, iso3, name, slug, continent, overview, content_status (migration 004)
  No currency_code, region, or timezone columns exist.
- cities: id, name, slug, country_id, content_status (migration 004)
  No region_or_state or timezone columns exist.
- universities: id, name, slug, country_id, city_id, official_url, overview, content_status (migration 005)
  No institution_type or ownership_type columns exist.
- degree_levels: id, code, name, display_order, is_active (migration 004)
  No plural_name or description_short columns exist. code is seeded and must not be editable.
- subjects: id, name, slug, parent_subject_id, display_order, content_status (migration 004)
  No summary or description column exists.

Zod check: not in package.json. Manual validation helpers used instead.

Completed:

New utility files:

src/lib/admin/validate.ts:
- FormErrors type alias (Record<string, string>)
- validateRequired, validateExactLength, validateIn, validateSlug functions
- No external dependencies

src/lib/admin/slug.ts:
- toSlug(str): lowercase, strip non-alnum, collapse whitespace/hyphens

Countries (new — no existing file):

src/pages/admin/countries/index.astro:
- List table: name, slug, iso2, iso3, content_status badge, created_at, Edit link
- + New Country button

src/pages/admin/countries/new.astro:
- Fields: name, slug (auto-generated if blank), iso2 (2 chars), iso3 (3 chars),
  continent, overview, content_status select
- Validation: name required, iso2 exact 2 chars, iso3 exact 3 chars, slug format
- ISO2/ISO3 uppercased server-side before insert
- 23505 → "A country with this slug, ISO2, or ISO3 already exists."
- POST-redirect-GET to /admin/countries on success

src/pages/admin/countries/[id].astro (edit):
- Loads existing row by id, 404 if not found
- Same fields and validation as new
- POST-redirect-GET to /admin/countries on success

Cities (new — no existing file):

src/pages/admin/cities/index.astro:
- List table: name, slug, joined country name, content_status badge, created_at, Edit link
- Uses .select('id, name, slug, content_status, created_at, countries(name)')

src/pages/admin/cities/new.astro:
- Fields: name, slug, country_id (select from all countries, ordered by name), content_status
- Warning shown if no countries exist yet
- 23505 → "A city with this slug already exists in that country."

src/pages/admin/cities/[id].astro (edit):
- Same fields, prefilled from DB

Universities (moved flat file + new routes):

src/pages/admin/universities.astro DELETED.
Reason: cannot have both universities.astro (file) and universities/ (folder) in the same
directory. File system and Astro routing both require one or the other.

src/pages/admin/universities/index.astro (moved from flat, import paths updated):
- Same list columns as Phase 04, plus Edit link column and + New University button

src/pages/admin/universities/new.astro:
- Fields: name, slug, country_id (required), city_id (optional select), official_url,
  overview, content_status
- Loads countries and cities in parallel for dropdowns
- 23505 → "A university with this slug already exists."

src/pages/admin/universities/[id].astro (edit):
- Same fields, prefilled from DB

Degree Levels (new — edit only):

src/pages/admin/degree-levels/index.astro:
- List table: code (read-only display), name, display_order, is_active badge
- Note shown: "Seeded values — edit only, no create or delete"

src/pages/admin/degree-levels/[id].astro (edit):
- code shown as read-only info box (not an input — never sent in the update payload)
- Fields: name, display_order, is_active (select: active/inactive with description)
- Warning shown that deactivating affects all program search filters
- Validation: name required, display_order non-negative integer

Subjects (new — no existing file):

src/pages/admin/subjects/index.astro:
- List table: name, slug, parent subject name, display_order, content_status, Edit link
- Uses self-join alias: .select('..., parent:parent_subject_id(name)')
- 200-row limit (subject lists can be larger than country/city lists)

src/pages/admin/subjects/new.astro:
- Fields: name, slug, parent_subject_id (select all subjects), display_order, content_status

src/pages/admin/subjects/[id].astro (edit):
- Parent dropdown excludes self (.neq('id', id))
- Server-side self-parent check: if parent_subject_id === id → validation error
- "A subject cannot be its own parent."

Sidebar (updated):

src/components/admin/AdminSidebar.astro:
- Added Countries, Cities, Degree Levels, Subjects links
- Nav now has 13 links total (was 9)
- Link order: Dashboard, Countries, Cities, Universities, Degree Levels, Subjects,
  Programs, Scholarships, Articles, Data Quality, Imports, Users, System

Fields omitted because columns do not exist:
- Countries: no currency_code, no region — omitted
- Cities: no region_or_state, no timezone — omitted
- Universities: no institution_type, no ownership_type — omitted
- Subjects: no description/summary — omitted
- Degree Levels: no plural_name, no description_short — omitted

Validation behavior:
- Required fields: name (all), iso2/iso3 (countries), country_id (cities/universities)
- Slug: required, must match ^[a-z0-9]+(?:-[a-z0-9]+)*$ — auto-generated from name if blank
- content_status: must be one of draft|in_review|published|unpublished|archived
- display_order: non-negative integer (degree levels, subjects)
- 23505 unique constraint violations surface as human-readable server error messages
- Form values preserved on validation failure so user does not lose input

Build result:
npm run build: PASS (Cloudflare output, 9.76s, zero errors)

PowerShell service_role search:
Get-ChildItem src -Recurse -File | Select-String -Pattern "service_role" → 0 matches

Git status:
- modified: src/components/admin/AdminSidebar.astro
- deleted: src/pages/admin/universities.astro
- untracked: src/lib/admin/slug.ts, src/lib/admin/validate.ts,
  src/pages/admin/cities/, src/pages/admin/countries/,
  src/pages/admin/degree-levels/, src/pages/admin/subjects/,
  src/pages/admin/universities/

Files created:
- src/lib/admin/validate.ts
- src/lib/admin/slug.ts
- src/pages/admin/countries/index.astro
- src/pages/admin/countries/new.astro
- src/pages/admin/countries/[id].astro
- src/pages/admin/cities/index.astro
- src/pages/admin/cities/new.astro
- src/pages/admin/cities/[id].astro
- src/pages/admin/universities/index.astro
- src/pages/admin/universities/new.astro
- src/pages/admin/universities/[id].astro
- src/pages/admin/degree-levels/index.astro
- src/pages/admin/degree-levels/[id].astro
- src/pages/admin/subjects/index.astro
- src/pages/admin/subjects/new.astro
- src/pages/admin/subjects/[id].astro

Files modified:
- src/components/admin/AdminSidebar.astro
- docs/06-status.md
- docs/07-task-log.md

Files deleted:
- src/pages/admin/universities.astro (replaced by universities/index.astro)

Next:
- Manually verify all new routes: anonymous redirect, student 403, super_admin access.
- Test create/edit for each entity.
- Verify validation errors display inline.
- Merge feature/phase-05-admin-crud-foundation to main after verification.

---

## 2026-06-14 - Project Docs Foundation

Tool:
Manual / ChatGPT-assisted

Goal:
Create operational repo docs so multiple AI coding tools can work with controlled context.

Completed:
- Created planned docs structure.
- Added project overview.
- Added final product decisions.
- Added technical architecture.
- Added database plan summary.
- Added AI system rules.
- Added coding standards.
- Added current status file.

Important Decisions:
- ChatGPT Project Sources remain long-term strategic memory.
- Repo docs are compact operational memory.
- AI coding tools should read only task-specific context.
- Every AI coding session must update status and task log.

Next:
- Create Full Database Schema v1 phase doc.
- Ask coding AI for schema plan only.
- Review plan with ChatGPT before implementation.

---

## 2026-06-15 - Database Schema v1 Planning and Migrations 001–004

Tool:
Claude Code (claude-sonnet-4-6) — plan only, then implementation

Goal:
Produce an approved implementation plan for Full Database Schema v1, then implement the first four migrations.

Planning work:
- Produced initial implementation plan (15 migrations, RLS strategy, index strategy, seed strategy).
- Revised plan twice based on ChatGPT review feedback.
- Key corrections applied across revisions:
  - content_status values corrected: draft, in_review, published, unpublished, archived
  - has_role() and has_permission() moved to migration 002 (after their dependent tables)
  - RLS made inline — no separate RLS migrations
  - media_assets moved to migration 003 (before content tables that reference it)
  - data_sources strengthened with entity_type, entity_id, confidence_level, source_status fields
  - programs fields improved: tuition_min/max, language_of_instruction, improved intakes
  - scholarships strengthened with provider_name, provider_type, funding_type, application_type, application_url, provider_url
  - scholarship_eligible_nationalities added to v1
  - data_completeness_score and source_confidence_score locked as integer 0–100
  - user_profiles.content_status replaced with account_status
  - media_assets.is_public and upload_status added; public SELECT requires both
  - entity_type canonical list locked at 19 values
  - Anonymous user_reports and AI data go through server endpoints, not browser RLS
  - admin_activity_logs moved into migration 002

Implementation completed (migrations 001–004):

001_custom_types.sql:
- Enables pgcrypto extension
- Defines update_updated_at_column() shared trigger function
- Documents all 18 canonical value sets as SQL comments
- No tables, no RLS, no helper functions

002_auth_roles.sql:
- Tables: user_profiles, roles, user_roles, permissions, role_permissions, admin_activity_logs
- Trigger: handle_new_user() — auto-creates user_profiles row on auth sign-up
- Functions: has_role(role_code text), has_permission(permission_code text) — SECURITY DEFINER, SET search_path = ''
- RLS on all 6 tables
- 9 indexes
- 12 policies (7 simple + 5 permission/role-based added after functions)

003_media.sql:
- Tables: media_assets, entity_media
- RLS on both tables
- 7 indexes including filtered index on media_assets WHERE is_public = true AND upload_status = 'ready'
- 10 policies
- entity_media uses polymorphic entity_type + entity_id (no FK on entity_id)

004_lookup_tables.sql:
- Tables: degree_levels, countries, cities, subjects
- RLS on all 4 tables
- 14 indexes including two partial indexes (countries and subjects WHERE content_status = 'published')
- 17 policies

Important Decisions Made:
- RLS policies that depend on has_role()/has_permission() are added in two passes within migration 002: basic policies first (before functions), permission-based policies after functions are defined.
- No table is ever left without at least one policy after RLS is enabled.
- Public read policies have no TO clause (applies to both anon and authenticated).
- All write and admin-access policies use TO authenticated.
- DELETE on content tables (countries, cities, subjects) restricted to super_admin; editors should use archived status instead.
- degree_levels uses is_active boolean instead of content_status — no publishing workflow needed for stable lookup values.

Files created:
- supabase/migrations/001_custom_types.sql
- supabase/migrations/002_auth_roles.sql
- supabase/migrations/003_media.sql
- supabase/migrations/004_lookup_tables.sql
- docs/06-status.md (updated)
- docs/07-task-log.md (updated)

Next:
- Review migrations 001–004 with ChatGPT.
- Approve or revise.
- Implement migrations 005–015.

---

## 2026-06-15 - Security Patch: Migrations 002–004

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Apply four security fixes to migrations 002–004 identified during review.

Changes made:

002_auth_roles.sql:
- Removed admin_logs_insert_permitted policy.
  admin_activity_logs INSERT is now blocked for all browser/authenticated clients.
  All writes must use the service role through server endpoints.
- Updated admin_activity_logs comment to document service-role-only INSERT.

003_media.sql:
- Removed entity_media_select_public policy.
  Reason: checking only media_asset public status would expose entity_type/entity_id
  pairs for draft entities (metadata leak risk).
  Public pages should use og_image_id / logo_id / cover_image_id FK columns directly
  and resolve assets through media_assets public-ready RLS policy.
  Gallery-aware public SELECT with parent-entity published checks deferred to future migration.
- Updated entity_media comment to document the decision and the safer pattern.

004_lookup_tables.sql:
- Updated INSERT and UPDATE WITH CHECK on countries, cities, and subjects (6 policies total)
  to enforce publish_content permission at the RLS level.
  Pattern applied:
    has_permission('edit_content')
    AND (content_status <> 'published' OR has_permission('publish_content'))
  Previously this was only validated server-side. Now enforced in RLS.
- Updated file header comment and inline comments to reflect RLS enforcement.

Validation:
- Supabase CLI and psql not available in this environment.
- Static read-through of all three patched files confirms:
  - handle_new_user() uses public.user_profiles (search_path = '')
  - has_role() uses public.user_roles, public.roles (search_path = '')
  - has_permission() uses public.user_roles, public.role_permissions, public.permissions (search_path = '')
  - RLS is enabled on all 12 tables across migrations 001–004
  - admin_logs_insert_permitted policy is gone
  - entity_media_select_public policy is gone
  - All 6 publish_content guard WITH CHECK clauses are correct
- Deploy to Supabase Dashboard for live validation before proceeding to migration 005.

Bootstrap note added to docs/06-status.md:
- First super_admin must be assigned via Supabase SQL editor or service role seed script.
  Normal browser users cannot assign roles before a super_admin exists.

Files changed:
- supabase/migrations/002_auth_roles.sql
- supabase/migrations/003_media.sql
- supabase/migrations/004_lookup_tables.sql
- docs/06-status.md
- docs/07-task-log.md

Next:
- Deploy migrations 001–004 to Supabase.
- Verify RLS policies in Supabase Dashboard (test anon vs authenticated vs service role).
- Bootstrap first super_admin.
- Approve to continue with migration 005.

---

## 2026-06-15 - Grep Re-Verification of Migrations 002–004

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Re-verify the security patch after a report that reviewed files did not match the patch
summary. The user uploaded files that appeared to still contain the old policies.

Action taken:
- Read the actual on-disk content of 002_auth_roles.sql, 003_media.sql, 004_lookup_tables.sql.
- Ran the three grep commands requested by the user.

Grep results (proof):

grep -n "admin_logs_insert_permitted" supabase/migrations/002_auth_roles.sql
  → No output. Exit code 1. Policy does not exist in file.

grep -n "entity_media_select_public" supabase/migrations/003_media.sql
  → No output. Exit code 1. Policy does not exist in file.

grep -n "content_status <> 'published'" supabase/migrations/004_lookup_tables.sql
  → 6 matches: lines 142, 157, 217, 228, 292, 303.
    All six INSERT/UPDATE WITH CHECK clauses carry the publish guard.

Conclusion:
The files on disk are correctly patched. The discrepancy was between the version reviewed
by the user and the actual disk state. No additional changes to migration files were needed.

Files changed this session:
- docs/06-status.md (updated to note grep re-verification)
- docs/07-task-log.md (this entry)

Next:
- Deploy migrations 001–004 to Supabase.
- Verify RLS policies in Supabase Dashboard.
- Bootstrap first super_admin.
- Approve to continue with migration 005.

---

## 2026-06-15 - Migration 005: Universities and Campuses

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Implement migration 005_universities_campuses.sql. Migrations 001–004 were externally
approved. Do not modify them. Do not implement migration 006 or any other migration.

Completed:

supabase/migrations/005_universities_campuses.sql created.

universities table:
- id (uuid pk gen_random_uuid), name, slug (UNIQUE), country_id (FK→countries ON DELETE RESTRICT), city_id (FK→cities ON DELETE SET NULL)
- official_url, founded_year, student_count, ranking_summary, overview
- content_status text NOT NULL DEFAULT 'draft' CHECK(draft|in_review|published|unpublished|archived)
- verification_status text NOT NULL DEFAULT 'unverified' CHECK(unverified|partially_verified|verified|source_conflict|outdated|needs_review)
- indexing_status text NOT NULL DEFAULT 'draft' CHECK(index|noindex|draft)
- data_completeness_score integer NOT NULL DEFAULT 0 CHECK(0–100)
- source_confidence_score integer NOT NULL DEFAULT 0 CHECK(0–100)
- last_verified_at, next_review_due_at
- logo_id (FK→media_assets ON DELETE SET NULL)
- cover_image_id (FK→media_assets ON DELETE SET NULL)
- og_image_id (FK→media_assets ON DELETE SET NULL)
- seo_title, seo_description, seo_h1, canonical_url, og_title, og_description
- created_at, updated_at + trigger (set_universities_updated_at)

universities indexes (9 total):
- idx_universities_country_id, idx_universities_city_id
- idx_universities_logo_id, idx_universities_cover_image_id, idx_universities_og_image_id
- idx_universities_content_status, idx_universities_created_at, idx_universities_updated_at
- idx_universities_published — partial WHERE content_status = 'published' on (id, slug, name)
- (slug UNIQUE constraint auto-creates its own index)

universities RLS (5 policies):
- universities_select_published — USING(content_status = 'published'), no TO clause
- universities_select_editors — TO authenticated, USING(has_permission('edit_content'))
- universities_insert_editors — WITH CHECK: edit_content AND (content_status <> 'published' OR publish_content)
- universities_update_editors — USING: edit_content, WITH CHECK: same publish guard
- universities_delete_super_admin — USING(has_role('super_admin'))

campuses table:
- id (uuid pk gen_random_uuid), university_id (FK→universities ON DELETE RESTRICT — NOT CASCADE)
- name, slug, UNIQUE(university_id, slug)
- country_id (FK→countries ON DELETE RESTRICT), city_id (FK→cities ON DELETE SET NULL)
- is_main_campus boolean NOT NULL DEFAULT false
- address
- created_at, updated_at + trigger (set_campuses_updated_at)
- No content_status — campus visibility follows parent university

campuses indexes (5 total):
- idx_campuses_university_id, idx_campuses_country_id, idx_campuses_city_id
- idx_campuses_created_at, idx_campuses_updated_at
- (UNIQUE (university_id, slug) constraint auto-creates a composite index)

campuses RLS (5 policies):
- campuses_select_published_parent — USING(EXISTS(SELECT 1 FROM universities u WHERE u.id=campuses.university_id AND u.content_status='published')), no TO clause
- campuses_select_editors — TO authenticated, USING(has_permission('edit_content'))
- campuses_insert_editors — WITH CHECK(has_permission('edit_content')) [no publish guard — no content_status]
- campuses_update_editors — USING and WITH CHECK both has_permission('edit_content')
- campuses_delete_super_admin — USING(has_role('super_admin'))

Important Decisions Made:
- campuses ON DELETE RESTRICT (not CASCADE) — campus deletion must be explicit, not cascaded from university deletion.
- No publish guard on campuses INSERT/UPDATE because campuses have no content_status. The guard cannot meaningfully apply.
- Parent-published EXISTS check in campuses SELECT mirrors the pattern for other child tables with no independent content_status.
- No entity_media public SELECT added. Pattern unchanged from 003.
- No program tables, no seeding, no migration 006.

Files created:
- supabase/migrations/005_universities_campuses.sql

Files updated:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review migration 005 (optionally with ChatGPT).
- Approve to continue.
- Implement migration 006 (programs, program_subjects, program_intakes).

---

## 2026-06-15 - Migration 006: Programs, Program Subjects, Program Intakes

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Implement migration 006_programs.sql. Migrations 001–005 were externally approved.
Do not modify them. Do not implement migration 007 or any other migration.

Completed:

supabase/migrations/006_programs.sql created.

programs table:
- id (uuid pk gen_random_uuid), slug (UNIQUE), title
- university_id (FK→universities ON DELETE RESTRICT, NOT NULL)
- campus_id (FK→campuses ON DELETE SET NULL, nullable)
- country_id (FK→countries ON DELETE RESTRICT, NOT NULL) — denormalised from university for efficient filtering
- city_id (FK→cities ON DELETE SET NULL, nullable)
- degree_level_id (FK→degree_levels ON DELETE RESTRICT, NOT NULL)
- degree_award, primary_subject_id (FK→subjects ON DELETE SET NULL)
- duration_months, study_mode CHECK(full_time|part_time|online|hybrid)
- delivery_mode CHECK(on_campus|online|hybrid|distance)
- language_of_instruction
- tuition_min_amount, tuition_max_amount, tuition_currency
- tuition_period CHECK(per_year|per_semester|total|per_credit), tuition_notes
- application_fee_amount, application_fee_currency, application_fee_notes
- application_url, official_url
- admission_requirements, english_requirements (jsonb), gpa_requirements
- curriculum_summary, career_outcomes
- content_status NOT NULL DEFAULT 'draft' CHECK(draft|in_review|published|unpublished|archived)
- verification_status NOT NULL DEFAULT 'unverified' CHECK(6 canonical values)
- indexing_status NOT NULL DEFAULT 'draft' CHECK(index|noindex|draft)
- data_completeness_score integer NOT NULL DEFAULT 0 CHECK(0–100)
- source_confidence_score integer NOT NULL DEFAULT 0 CHECK(0–100)
- last_verified_at, next_review_due_at
- og_image_id (FK→media_assets ON DELETE SET NULL)
- seo_title, seo_description, seo_h1, canonical_url, og_title, og_description
- created_at, updated_at + trigger (set_programs_updated_at)

programs indexes (19 total):
- idx_programs_university_id, idx_programs_campus_id
- idx_programs_country_id, idx_programs_city_id
- idx_programs_degree_level_id, idx_programs_primary_subject_id
- idx_programs_og_image_id, idx_programs_content_status
- idx_programs_language_of_instruction, idx_programs_study_mode
- idx_programs_created_at, idx_programs_updated_at
- idx_programs_published — partial WHERE content_status = 'published' on (id, slug, title)
- idx_programs_country_status — composite (country_id, content_status)
- idx_programs_degree_level_status — composite (degree_level_id, content_status)
- idx_programs_university_status — composite (university_id, content_status)
- idx_programs_language_status — composite (language_of_instruction, content_status)
- idx_programs_study_mode_status — composite (study_mode, content_status)
- (slug UNIQUE constraint auto-creates its own index)

programs RLS (5 policies):
- programs_select_published — USING(content_status = 'published'), no TO clause
- programs_select_editors — TO authenticated, USING(has_permission('edit_content'))
- programs_insert_editors — WITH CHECK: edit_content AND (content_status <> 'published' OR publish_content)
- programs_update_editors — USING: edit_content, WITH CHECK: same publish guard
- programs_delete_super_admin — USING(has_role('super_admin'))

program_subjects table:
- program_id (FK→programs ON DELETE CASCADE, NOT NULL)
- subject_id (FK→subjects ON DELETE RESTRICT, NOT NULL)
- is_primary boolean NOT NULL DEFAULT false
- display_order integer NOT NULL DEFAULT 0
- created_at timestamptz NOT NULL DEFAULT now()
- primary key (program_id, subject_id)
- No updated_at (join table — changes are delete+reinsert, not in-place edits)

program_subjects indexes (2 total):
- idx_program_subjects_subject_id (for reverse lookups: all programs in a subject)
- idx_program_subjects_display_order
- (PK covers program_id as leading column)

program_subjects RLS (5 policies):
- program_subjects_select_published_parent — EXISTS check on parent program
- program_subjects_select_editors — TO authenticated, USING(has_permission('edit_content'))
- program_subjects_insert_editors, _update_editors, _delete_editors — all require edit_content
- No publish guard (no content_status on this table; parent program controls it)

program_intakes table:
- id (uuid pk gen_random_uuid)
- program_id (FK→programs ON DELETE CASCADE, NOT NULL)
- intake_name, intake_month CHECK(1–12), intake_year
- application_open_date date, application_deadline_date date
- deadline_text, deadline_status CHECK(open|closing_soon|closed|rolling)
- is_rolling boolean NOT NULL DEFAULT false
- notes
- created_at, updated_at + trigger (set_program_intakes_updated_at)

program_intakes indexes (6 total):
- idx_program_intakes_program_id
- idx_program_intakes_deadline_date
- idx_program_intakes_deadline_status
- idx_program_intakes_created_at
- idx_program_intakes_updated_at
- idx_program_intakes_program_deadline — composite (program_id, application_deadline_date)

program_intakes RLS (5 policies):
- program_intakes_select_published_parent — EXISTS check on parent program
- program_intakes_select_editors — TO authenticated, USING(has_permission('edit_content'))
- program_intakes_insert_editors, _update_editors, _delete_editors — all require edit_content
- No publish guard (no content_status on this table)

Important Decisions Made:
- country_id and city_id are denormalised onto programs (not derived from university at query time).
  Reason: programs are filtered heavily by country/city — avoiding a join improves search performance.
  Server-side logic must keep them in sync with the parent university on insert/update.
- english_requirements stored as jsonb (not separate columns) to accommodate varied test structures
  (IELTS, TOEFL, PTE, Duolingo, Cambridge, etc.) without schema changes per new test type.
- primary_subject_id on programs is a convenience FK. The authoritative subject list is
  program_subjects. Server-side logic must keep them consistent.
- DELETE on programs: super_admin only. Cascade to program_subjects and program_intakes on delete.
- DELETE on program_subjects and program_intakes: edit_content (editors manage child records).
- No publish guard on child tables — they have no content_status; parent program controls visibility.
- Partial index (idx_programs_published) mirrors the countries/subjects/universities pattern.
- Five composite indexes added for the dominant search filter combinations.
- deadline_status is a cached field maintained by server-side logic, not a DB trigger.

Files created:
- supabase/migrations/006_programs.sql

Files updated:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review migration 006 (optionally with ChatGPT).
- Approve to continue.
- Implement migration 007 (scholarships and junction tables).

---

## 2026-06-15 - Migration 007: Scholarships and Junction Tables

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Implement migration 007_scholarships.sql. Migrations 001–006 were externally approved.
Do not modify them. Do not implement migration 008 or any other migration.

Completed:

supabase/migrations/007_scholarships.sql created.

scholarships table:
- id (uuid pk gen_random_uuid), slug (UNIQUE), name
- scholarship_type CHECK(full|partial|merit|need_based|government|institutional|other)
- provider_name, provider_type CHECK(government|university|private_foundation|corporate|ngo|other)
- funding_type CHECK(full_tuition|partial_tuition|living_stipend|travel|research|full_funding|other)
- application_type CHECK(direct|university_portal|nomination|embassy|other)
- overview, eligibility_summary
- amount_min, amount_max, currency, coverage_notes
- deadline (date), deadline_text
- official_url, application_url, provider_url
- content_status NOT NULL DEFAULT 'draft' CHECK(draft|in_review|published|unpublished|archived)
- verification_status NOT NULL DEFAULT 'unverified' CHECK(6 canonical values)
- indexing_status NOT NULL DEFAULT 'draft' CHECK(index|noindex|draft)
- data_completeness_score integer NOT NULL DEFAULT 0 CHECK(0–100)
- source_confidence_score integer NOT NULL DEFAULT 0 CHECK(0–100)
- last_verified_at, next_review_due_at
- og_image_id (FK→media_assets ON DELETE SET NULL)
- seo_title, seo_description, seo_h1, canonical_url, og_title, og_description
- created_at, updated_at + trigger (set_scholarships_updated_at)

scholarships indexes (8 total):
- idx_scholarships_og_image_id, idx_scholarships_content_status
- idx_scholarships_deadline, idx_scholarships_created_at, idx_scholarships_updated_at
- idx_scholarships_published — partial WHERE content_status = 'published' on (id, slug, name)
- idx_scholarships_deadline_status — composite (deadline, content_status)
- (slug UNIQUE constraint auto-creates its own index)

scholarships RLS (5 policies):
- scholarships_select_published — USING(content_status = 'published'), no TO clause
- scholarships_select_editors — TO authenticated, USING(has_permission('edit_content'))
- scholarships_insert_editors — WITH CHECK: edit_content AND (not published OR publish_content)
- scholarships_update_editors — USING: edit_content, WITH CHECK: same publish guard
- scholarships_delete_super_admin — USING(has_role('super_admin'))

scholarship_countries (junction):
- PK (scholarship_id, country_id), scholarship_id CASCADE, country_id RESTRICT
- idx_scholarship_countries_country_id
- 5 RLS policies: parent-published EXISTS + editor SELECT + insert/update/delete edit_content

scholarship_universities (junction):
- PK (scholarship_id, university_id), scholarship_id CASCADE, university_id RESTRICT
- idx_scholarship_universities_university_id
- 5 RLS policies: same pattern

scholarship_programs (junction):
- PK (scholarship_id, program_id), scholarship_id CASCADE, program_id RESTRICT
- idx_scholarship_programs_program_id
- 5 RLS policies: same pattern

scholarship_subjects (junction):
- PK (scholarship_id, subject_id), scholarship_id CASCADE, subject_id RESTRICT
- idx_scholarship_subjects_subject_id
- 5 RLS policies: same pattern

scholarship_degree_levels (junction):
- PK (scholarship_id, degree_level_id), scholarship_id CASCADE, degree_level_id RESTRICT
- idx_scholarship_degree_levels_degree_level_id
- 5 RLS policies: same pattern

scholarship_eligible_nationalities:
- id (uuid pk gen_random_uuid)
- scholarship_id (FK→scholarships CASCADE), country_id (FK→countries RESTRICT)
- eligibility_type text NOT NULL DEFAULT 'eligible' CHECK(eligible|ineligible|preferred)
- notes, created_at
- UNIQUE (scholarship_id, country_id, eligibility_type)
- idx_scholarship_nationalities_scholarship_id
- idx_scholarship_nationalities_country_id
- idx_scholarship_nationalities_eligibility_type
- 5 RLS policies: parent-published EXISTS + editor SELECT + insert/update/delete edit_content

Important Decisions Made:
- scholarship_eligible_nationalities has its own uuid PK (not a composite PK like other
  junction tables) because eligibility_type makes the natural key a three-column composite.
  The unique constraint still prevents duplicate rows per (scholarship, country, type).
- All six junction tables use CASCADE on scholarship_id — deleting a scholarship removes
  all its related links. No FK target (country, university, program, subject, degree_level)
  can be deleted while referenced here (RESTRICT).
- DELETE on scholarships restricted to super_admin — cascades to all six junction tables.
- DELETE on all junction tables: edit_content (editors manage relationship data).
- No publish guard on junction tables — they have no content_status; parent scholarship
  controls visibility through the EXISTS RLS check.
- scholarship_programs.program_id uses RESTRICT (not CASCADE) so that deleting a program
  requires explicitly unlinking its scholarships first. This prevents silent data loss
  when a program is archived and later deleted.
- No ai_finder_scholarship_matches added — deferred to migration 012.

Files created:
- supabase/migrations/007_scholarships.sql

Files updated:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review migration 007 (optionally with ChatGPT).
- Approve to continue.
- Implement migration 008 (article_categories, articles, article junctions, seo_page_types, seo_landing_pages).

---

## 2026-06-15 - Migration 008: Articles, Article Junctions, SEO Page Types, SEO Landing Pages

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Implement migration 008_articles_seo.sql. Migrations 001–007 were externally approved.
Do not modify them. Do not implement migration 009 or any other migration.

Completed:

supabase/migrations/008_articles_seo.sql created.

article_categories table:
- id (uuid pk gen_random_uuid), name, slug (UNIQUE), parent_category_id (self-ref FK ON DELETE SET NULL)
- display_order integer NOT NULL DEFAULT 0
- created_at, updated_at + trigger (set_article_categories_updated_at)
- Explicit indexes: parent_category_id, display_order, created_at, updated_at (4 total)
- slug UNIQUE constraint auto-creates its own index

article_categories RLS (4 policies):
- article_categories_select_public — USING(true), no TO clause (all visitors can read)
- article_categories_insert_settings — TO authenticated, WITH CHECK(has_permission('manage_settings'))
- article_categories_update_settings — USING + WITH CHECK both manage_settings
- article_categories_delete_settings — USING(has_permission('manage_settings'))
- Write ops use manage_settings (configuration/lookup table, not editorial content)

articles table:
- id (uuid pk gen_random_uuid), slug (UNIQUE), title, summary, content
- author_user_id (FK→user_profiles ON DELETE SET NULL)
- article_category_id (FK→article_categories ON DELETE RESTRICT)
- featured_image_id (FK→media_assets ON DELETE SET NULL)
- og_image_id (FK→media_assets ON DELETE SET NULL)
- content_status NOT NULL DEFAULT 'draft' CHECK(draft|in_review|published|unpublished|archived)
- verification_status NOT NULL DEFAULT 'unverified' CHECK(6 canonical values)
- indexing_status NOT NULL DEFAULT 'draft' CHECK(index|noindex|draft)
- data_completeness_score integer NOT NULL DEFAULT 0 CHECK(0–100)
- source_confidence_score integer NOT NULL DEFAULT 0 CHECK(0–100)
- published_at timestamptz (set by server-side logic on first publish)
- seo_title, seo_description, seo_h1, canonical_url, og_title, og_description
- created_at, updated_at + trigger (set_articles_updated_at)

articles indexes (11 total explicit):
- idx_articles_author_user_id, idx_articles_article_category_id
- idx_articles_featured_image_id, idx_articles_og_image_id
- idx_articles_content_status, idx_articles_indexing_status
- idx_articles_published_at, idx_articles_created_at, idx_articles_updated_at
- idx_articles_published — partial WHERE content_status = 'published' on (id, slug, title)
- idx_articles_fts — GIN index USING gin(to_tsvector('english', title || ' ' || coalesce(summary, '')))
- (slug UNIQUE constraint auto-creates its own index)

articles RLS (5 policies):
- articles_select_published — USING(content_status = 'published'), no TO clause
- articles_select_editors — TO authenticated, USING(has_permission('edit_content'))
- articles_insert_editors — WITH CHECK: edit_content AND (content_status <> 'published' OR publish_content)
- articles_update_editors — USING: edit_content, WITH CHECK: same publish guard
- articles_delete_super_admin — USING(has_role('super_admin'))

article_countries (junction):
- PK (article_id, country_id), article_id CASCADE, country_id RESTRICT
- idx_article_countries_country_id
- 5 RLS policies: parent-published EXISTS check + editor SELECT + insert/update/delete edit_content

article_subjects (junction):
- PK (article_id, subject_id), article_id CASCADE, subject_id RESTRICT
- idx_article_subjects_subject_id
- 5 RLS policies: same pattern (parent-published EXISTS against articles)

article_degree_levels (junction):
- PK (article_id, degree_level_id), article_id CASCADE, degree_level_id RESTRICT
- idx_article_degree_levels_degree_level_id
- 5 RLS policies: same pattern (parent-published EXISTS against articles)

seo_page_types table:
- id (uuid pk gen_random_uuid), code (UNIQUE), name, description, url_pattern
- created_at, updated_at + trigger (set_seo_page_types_updated_at)
- Explicit indexes: created_at, updated_at (2 total)
- code UNIQUE constraint auto-creates its own index

seo_page_types RLS (4 policies):
- seo_page_types_select_public — USING(true), no TO clause
- seo_page_types_insert_settings, _update_settings, _delete_settings — manage_settings

seo_landing_pages table:
- id (uuid pk gen_random_uuid), seo_page_type_id (FK→seo_page_types NOT NULL ON DELETE RESTRICT)
- slug (UNIQUE), title, intro_content
- content_status NOT NULL DEFAULT 'draft' CHECK(draft|in_review|published|unpublished|archived)
- indexing_status NOT NULL DEFAULT 'draft' CHECK(index|noindex|draft)
- Facet FKs (all optional): country_id (ON DELETE SET NULL), subject_id, degree_level_id, university_id
- og_image_id (FK→media_assets ON DELETE SET NULL)
- seo_title, seo_description, seo_h1, canonical_url, og_title, og_description
- created_at, updated_at + trigger (set_seo_landing_pages_updated_at)

seo_landing_pages indexes (14 total explicit):
- idx_seo_landing_pages_seo_page_type_id, country_id, subject_id, degree_level_id, university_id, og_image_id
- idx_seo_landing_pages_content_status, indexing_status
- idx_seo_landing_pages_created_at, updated_at
- idx_seo_landing_pages_published_index — partial WHERE content_status = 'published' AND indexing_status = 'index'
- idx_seo_landing_pages_type_status — composite (seo_page_type_id, content_status, indexing_status)
- idx_seo_landing_pages_country_degree_status — composite (country_id, degree_level_id, content_status)
- idx_seo_landing_pages_subject_degree_status — composite (subject_id, degree_level_id, content_status)
- (slug UNIQUE constraint auto-creates its own index)

seo_landing_pages RLS (5 policies):
- seo_landing_pages_select_published — USING(content_status = 'published' AND indexing_status = 'index'), no TO clause
- seo_landing_pages_select_editors — TO authenticated, USING(has_permission('edit_content'))
- seo_landing_pages_insert_editors — WITH CHECK: edit_content AND (content_status <> 'published' OR publish_content)
- seo_landing_pages_update_editors — USING: edit_content, WITH CHECK: same publish guard
- seo_landing_pages_delete_super_admin — USING(has_role('super_admin'))

Important Decisions Made:
- article_categories and seo_page_types use manage_settings (not edit_content) for write ops.
  Reason: these are configuration/lookup tables. Adding a category or page type definition is
  an admin settings action, not content editing.
- seo_landing_pages public SELECT requires BOTH content_status = 'published' AND
  indexing_status = 'index'. A published page with indexing_status = 'noindex' (thin content,
  duplicate, or quality-failed) must not appear in public API reads or the sitemap.
- Article junction tables (article_countries, article_subjects, article_degree_levels) have no
  content_status. Public SELECT uses an EXISTS check against the parent articles table where
  content_status = 'published'. This mirrors the scholarship junction pattern from migration 007.
- No article_universities, article_programs, or article_scholarships added in this migration.
  These can be added later if needed.
- No seed data in this migration. article_categories and seo_page_types seed rows belong in 015.
- published_at on articles is set by server-side logic on first publish transition. Not set by
  a DB trigger to avoid unintended resets on subsequent re-publishes.
- GIN full-text index on articles uses title || ' ' || coalesce(summary, '') — coalesce prevents
  NULL concatenation errors for articles with no summary yet.
- seo_landing_pages.seo_page_type_id uses ON DELETE RESTRICT — a page type cannot be deleted
  while any landing pages reference it, preventing orphaned pages with no type classification.

Files created:
- supabase/migrations/008_articles_seo.sql

Files updated:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review migration 008 (optionally with ChatGPT).
- Approve to continue.
- Implement migrations 009–014 (operational tables).
- Implement migration 015 (seed data).

---

## 2026-06-15 - Migration 009: Data Sources, Source Snapshots, Verification Events, Data Quality Checks

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Implement migration 009_data_sources.sql. Migrations 001–008 were externally approved.
Do not modify them. Do not implement migration 010 or any other migration.

Completed:

supabase/migrations/009_data_sources.sql created.

data_sources table:
- id (uuid pk gen_random_uuid)
- entity_type text NOT NULL CHECK (19 canonical values from migration 001)
- entity_id uuid NOT NULL (polymorphic — no FK constraint; see header comment)
- source_url text NOT NULL
- source_title, source_domain (optional text)
- source_type text NOT NULL DEFAULT 'third_party'
  CHECK(official_university|government|third_party|aggregator|user_submitted)
- confidence_level text NOT NULL DEFAULT 'unknown' CHECK(high|medium|low|unknown)
- source_status text NOT NULL DEFAULT 'active' CHECK(active|broken|redirected|archived)
- is_primary_source boolean NOT NULL DEFAULT false
- last_checked_at, next_check_due_at (timestamptz)
- checked_by_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
- notes text
- created_at, updated_at + trigger (set_data_sources_updated_at)

data_sources indexes (11 total):
- idx_data_sources_entity — composite (entity_type, entity_id)
- idx_data_sources_source_domain, source_type, confidence, source_status, is_primary
- idx_data_sources_checked_by, last_checked, next_check
- idx_data_sources_created_at, updated_at

data_sources RLS (4 policies):
- data_sources_select_permitted — view_data_quality OR manage_data_sources OR super_admin
- data_sources_insert_permitted — manage_data_sources OR super_admin
- data_sources_update_permitted — manage_data_sources OR super_admin (USING + WITH CHECK)
- data_sources_delete_permitted — manage_data_sources OR super_admin

source_snapshots table:
- id (uuid pk gen_random_uuid)
- data_source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE
- storage_path text (Supabase Storage path — raw files live in Storage, not Postgres)
- snapshot_url text
- fetched_at timestamptz NOT NULL DEFAULT now()
- snapshot_status text NOT NULL DEFAULT 'pending' CHECK(pending|stored|failed)
- content_hash text
- extracted_text text (cleaned text for AI/search use)
- extraction_method, extracted_by_ai_model, extraction_notes (text)
- created_at (no updated_at — re-fetch creates a new row, never updates existing)

source_snapshots indexes (5 total):
- idx_source_snapshots_data_source_id, fetched_at, snapshot_status, content_hash, created_at

source_snapshots RLS (4 policies):
- source_snapshots_select_permitted — view_data_quality OR manage_data_sources OR super_admin
- source_snapshots_insert_permitted — manage_data_sources OR super_admin
- source_snapshots_update_permitted — manage_data_sources OR super_admin
- source_snapshots_delete_permitted — manage_data_sources OR super_admin

verification_events table (append-only):
- id (uuid pk gen_random_uuid)
- entity_type text NOT NULL CHECK (19 canonical values)
- entity_id uuid NOT NULL (polymorphic — no FK constraint)
- data_source_id uuid REFERENCES public.data_sources(id) ON DELETE SET NULL
- verified_by_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
- verification_status text NOT NULL
  CHECK(unverified|partially_verified|verified|source_conflict|outdated|needs_review)
- notes text
- verified_at timestamptz NOT NULL DEFAULT now()
- created_at timestamptz NOT NULL DEFAULT now()
- No updated_at — rows are never updated

verification_events indexes (6 total):
- idx_verification_events_entity — composite (entity_type, entity_id)
- idx_verification_events_data_source_id, verified_by, status, verified_at, created_at

verification_events RLS (3 policies):
- verification_events_select_permitted — view_data_quality OR manage_data_sources OR super_admin
- verification_events_insert_permitted — manage_data_sources OR edit_content OR super_admin
  (editors may record verification findings while editing content)
- No UPDATE policy — append-only by design; corrections create a new event row
- verification_events_delete_super_admin — super_admin only (emergency purge)

data_quality_checks table:
- id (uuid pk gen_random_uuid)
- entity_type text NOT NULL CHECK (19 canonical values)
- entity_id uuid NOT NULL (polymorphic — no FK constraint)
- check_type text NOT NULL (free-form: url_reachable, tuition_present, etc.)
- result text NOT NULL CHECK(pass|fail|warning)
- details jsonb (check-specific payload)
- checked_at timestamptz NOT NULL DEFAULT now()
- created_at timestamptz NOT NULL DEFAULT now()
- No updated_at — re-runs create new rows; old rows are historical records

data_quality_checks indexes (5 total):
- idx_data_quality_checks_entity — composite (entity_type, entity_id)
- idx_data_quality_checks_check_type, result, checked_at, created_at

data_quality_checks RLS (4 policies):
- data_quality_checks_select_permitted — view_data_quality OR manage_data_sources OR super_admin
- data_quality_checks_insert_permitted — manage_data_sources OR edit_content OR super_admin
- data_quality_checks_update_permitted — manage_data_sources OR super_admin (USING + WITH CHECK)
- data_quality_checks_delete_super_admin — super_admin only

Important Decisions Made:
- entity_id is polymorphic on all four tables (no FK constraint). PostgreSQL cannot enforce
  a single FK across all entity tables simultaneously. Application logic must validate
  that entity_id exists in the correct table for the given entity_type.
- Raw source files (HTML, PDF) belong in Supabase Storage. source_snapshots.storage_path
  holds the Storage path only. extracted_text stores cleaned text for AI/search use.
- verification_events is intentionally append-only. No UPDATE policy is created for
  authenticated clients. Corrections are made by inserting a new event with updated status.
- source_snapshots has no updated_at column. Each re-fetch creates a new snapshot row
  rather than overwriting an existing one. Historical snapshots are retained for diffing.
- data_quality_checks similarly accumulates rows — historical results are kept for trend
  analysis. Re-running a check adds a new row; old rows are not modified.
- No unique constraint on (entity_type, entity_id, source_url) in data_sources.
  The same URL may be attached with different source_type or purpose. Deduplication
  is handled by application logic.
- All four tables share the same SELECT permission gate:
  view_data_quality OR manage_data_sources OR super_admin.
  The view_data_quality permission is read-only access for reviewers/auditors
  who need to see source data but cannot modify it.
- INSERT on verification_events and data_quality_checks also allows edit_content.
  Reason: editors create verification events and quality check records inline
  while working on content, before source management staff reviews them.
- No public SELECT policies on any table in this migration.

Files created:
- supabase/migrations/009_data_sources.sql

Files updated:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review migration 009 (optionally with ChatGPT).
- Approve to continue.
- Implement migration 010 (import_batches, import_files, staging tables).

---

## 2026-06-15 - Migration 010: Import Batches and Staging Tables

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Implement migration 010_import_staging.sql. Migrations 001–009 were externally approved.
Do not modify them. Do not implement migration 011 or any other migration.

Completed:

supabase/migrations/010_import_staging.sql created.

import_batches table:
- id (uuid pk gen_random_uuid)
- data_source_id (FK→data_sources ON DELETE SET NULL, nullable)
- created_by_user_id (FK→user_profiles ON DELETE SET NULL, nullable)
- batch_type text NOT NULL CHECK(universities|programs|scholarships|mixed)
- import_status text NOT NULL DEFAULT 'pending' CHECK(8 canonical import_status values)
- total_records, processed_count, error_count integer NOT NULL DEFAULT 0
- notes text, storage_path text (Supabase Storage path — raw files live in Storage, not Postgres)
- created_at, updated_at + trigger (set_import_batches_updated_at)
- 6 indexes: data_source_id, created_by_user_id, batch_type, import_status, created_at, updated_at

import_files table:
- id (uuid pk gen_random_uuid)
- import_batch_id (FK→import_batches ON DELETE CASCADE, NOT NULL)
- storage_path text NOT NULL (Supabase Storage path)
- file_type text NOT NULL CHECK(csv|json|html|pdf|txt|other)
- file_size_bytes bigint (nullable)
- import_status text NOT NULL DEFAULT 'pending' CHECK(8 canonical import_status values)
- created_at (no updated_at — file metadata is not edited in place)
- 4 indexes: import_batch_id, file_type, import_status, created_at

staging_universities table:
- id (uuid pk gen_random_uuid)
- import_batch_id (FK→import_batches ON DELETE CASCADE, NOT NULL)
- raw_data jsonb NOT NULL DEFAULT '{}'
- extracted_name, extracted_country_code, extracted_official_url (text, nullable)
- match_university_id (FK→universities ON DELETE SET NULL, nullable)
- import_status text NOT NULL DEFAULT 'pending' CHECK(8 canonical values)
- duplicate_of_id (self-ref FK→staging_universities ON DELETE SET NULL, nullable)
- review_notes text, reviewed_by_user_id (FK→user_profiles), reviewed_at timestamptz
- created_at, updated_at + trigger (set_staging_universities_updated_at)
- 8 indexes: import_batch_id, match_university_id, import_status, duplicate_of_id,
  reviewed_by_user_id, created_at, updated_at
- 1 composite index: (import_batch_id, import_status) for admin queue filters

staging_programs table:
- id (uuid pk gen_random_uuid)
- import_batch_id (FK→import_batches ON DELETE CASCADE, NOT NULL)
- staging_university_id (FK→staging_universities ON DELETE SET NULL, nullable)
- raw_data jsonb NOT NULL DEFAULT '{}'
- extracted_title, extracted_degree_level_code, extracted_language,
  extracted_tuition_amount (numeric), extracted_deadline (text)
- match_program_id (FK→programs ON DELETE SET NULL, nullable)
- import_status, duplicate_of_id (self-ref), review_notes,
  reviewed_by_user_id, reviewed_at, created_at, updated_at + trigger
- 8 indexes + 1 composite index (import_batch_id, import_status)

staging_scholarships table:
- id (uuid pk gen_random_uuid)
- import_batch_id (FK→import_batches ON DELETE CASCADE, NOT NULL)
- raw_data jsonb NOT NULL DEFAULT '{}'
- extracted_name, extracted_amount (numeric), extracted_deadline (text)
- match_scholarship_id (FK→scholarships ON DELETE SET NULL, nullable)
- import_status, duplicate_of_id (self-ref), review_notes,
  reviewed_by_user_id, reviewed_at, created_at, updated_at + trigger
- 7 indexes + 1 composite index (import_batch_id, import_status)

staging_errors table:
- id (uuid pk gen_random_uuid)
- import_batch_id (FK→import_batches ON DELETE CASCADE, NOT NULL)
- staging_table text NOT NULL CHECK(staging_universities|staging_programs|
  staging_scholarships|import_files|import_batches)
- staging_row_id uuid (nullable, polymorphic — no FK; validated by application)
- error_type text NOT NULL, error_message text NOT NULL
- created_at (append-only in practice; errors are not edited)
- 5 indexes: import_batch_id, staging_table, staging_row_id, error_type, created_at

RLS summary (all 6 tables):
- RLS enabled immediately on every table.
- No public SELECT on any table — admin-only workflow.
- SELECT/INSERT/UPDATE/DELETE all require:
  has_permission('manage_imports') OR has_role('super_admin')
- 4 policies per table × 6 tables = 24 RLS policies total.

Important Decisions Made:
- import_files has no updated_at — file metadata is created once on upload and not
  edited in place. If a file is replaced, a new row is created.
- staging_programs.staging_university_id links to a staging row (not a live university)
  when the program's university is also being imported in the same batch. This allows
  batch imports that include both universities and their programs together.
- staging_errors.staging_row_id is polymorphic (no FK constraint) because it may
  reference any of the five staging table types depending on staging_table. Application
  logic must validate the reference. This mirrors the pattern used in migration 009
  for polymorphic entity_type + entity_id references.
- No approval functions written. No data promotion to live tables in this migration.
  Data promotion (staging → live tables) is deferred to a future server endpoint task.
- No staging_review_actions table. Deferred to a future migration.
- No staging_articles table. Deferred; articles are manual-only for MVP.
- All storage paths reference Supabase Storage. No binary content is stored in Postgres.
- 4 updated_at triggers created (import_batches, staging_universities, staging_programs,
  staging_scholarships). import_files and staging_errors have no updated_at.

Files created:
- supabase/migrations/010_import_staging.sql

Files updated:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review migration 010 (optionally with ChatGPT).
- Approve to continue.
- Implement migration 011 (student_profiles, student_profile_subjects, student_profile_countries).

---

## 2026-06-15 - Migrations 011 and 012: Student Profiles and AI Tables

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Implement migration 011_student_profiles.sql and migration 012_ai_tables.sql.
Migrations 001–010 were externally approved. Do not modify them.
Do not implement migration 013 or any other migration.

Completed:

supabase/migrations/011_student_profiles.sql created.

student_profiles table:
- id (uuid pk gen_random_uuid)
- user_id (FK→user_profiles ON DELETE CASCADE, nullable for anonymous rows)
- is_anonymous boolean NOT NULL DEFAULT false
- session_token text (server-side only; not exposed via browser RLS)
- current_country_id (FK→countries ON DELETE SET NULL)
- target_degree_level_id (FK→degree_levels ON DELETE SET NULL)
- budget_min, budget_max (numeric), budget_currency (text)
- gpa (numeric), english_score_type (text), english_score (numeric)
- work_experience_years (integer), study_start_preference (text)
- additional_notes (text), expires_at (timestamptz — anonymous only)
- created_at, updated_at + trigger (set_student_profiles_updated_at)
- 8 CHECK constraints: logged-in profiles must have user_id; anonymous profiles must have
  session_token and expires_at; budget/gpa/score/experience values must be >= 0 when set.
- 9 indexes: user_id, is_anonymous, session_token, current_country_id,
  target_degree_level_id, expires_at, created_at, updated_at
- 1 partial index on (expires_at) WHERE is_anonymous = true AND expires_at IS NOT NULL
  (for cleanup cron jobs)

student_profiles RLS (6 policies):
- student_profiles_select_own — user_id = auth.uid()
- student_profiles_insert_own — user_id = auth.uid() AND is_anonymous = false
  (anonymous rows created only via service role / server endpoints)
- student_profiles_update_own — USING + WITH CHECK user_id = auth.uid()
- student_profiles_delete_own — user_id = auth.uid()
- student_profiles_select_super_admin — super_admin can read all
- student_profiles_delete_super_admin — super_admin can delete any

student_profile_subjects table:
- PK (student_profile_id, subject_id)
- student_profile_id (FK→student_profiles ON DELETE CASCADE)
- subject_id (FK→subjects ON DELETE RESTRICT)
- preference_rank integer NOT NULL DEFAULT 0
- created_at (no updated_at — changes are delete+reinsert)
- 2 indexes: subject_id, preference_rank

student_profile_subjects RLS (6 policies):
- select/insert/update/delete_own — all use EXISTS check on parent student_profiles.user_id = auth.uid()
- select_super_admin, delete_super_admin

student_profile_countries table:
- PK (student_profile_id, country_id)
- student_profile_id (FK→student_profiles ON DELETE CASCADE)
- country_id (FK→countries ON DELETE RESTRICT)
- preference_rank integer NOT NULL DEFAULT 0
- created_at (no updated_at)
- 2 indexes: country_id, preference_rank

student_profile_countries RLS (6 policies):
- same EXISTS pattern as student_profile_subjects
- select_super_admin, delete_super_admin

supabase/migrations/012_ai_tables.sql created.

ai_finder_results table:
- id (uuid pk gen_random_uuid)
- student_profile_id (FK→student_profiles ON DELETE CASCADE, NOT NULL)
- result_status text NOT NULL DEFAULT 'pending' CHECK(pending|complete|failed)
- shortlist_count integer NOT NULL DEFAULT 0
- ai_explanation text, ai_model_used text
- prompt_token_count, completion_token_count integer NOT NULL DEFAULT 0
- created_at, expires_at
- 4 indexes: student_profile_id, result_status, created_at, expires_at
- 1 partial index on (expires_at) WHERE expires_at IS NOT NULL (cleanup cron)

ai_finder_results RLS (5 policies):
- select_own — EXISTS check: parent student_profiles.user_id = auth.uid()
- insert_own — EXISTS check: parent profile owned AND is_anonymous = false
  (anonymous results created via service role only)
- delete_own — EXISTS check: parent profile.user_id = auth.uid()
- No UPDATE policy — server updates via service role
- select_super_admin, delete_super_admin

ai_finder_program_matches table:
- id (uuid pk gen_random_uuid)
- ai_finder_result_id (FK→ai_finder_results ON DELETE CASCADE, NOT NULL)
- program_id (FK→programs ON DELETE RESTRICT, NOT NULL)
  RESTRICT prevents silent data loss if a program is deleted
- rank integer NOT NULL, score numeric
- match_reasons jsonb, warnings jsonb
- created_at
- UNIQUE (ai_finder_result_id, program_id) — each program once per result
- UNIQUE (ai_finder_result_id, rank) — each rank unique per result
- 5 indexes: ai_finder_result_id, program_id, rank, score, created_at

ai_finder_program_matches RLS (5 policies):
- select/insert/delete_own — all use two-table JOIN EXISTS:
  ai_finder_results JOIN student_profiles WHERE student_profiles.user_id = auth.uid()
- select_super_admin, delete_super_admin

ai_conversations table:
- id (uuid pk gen_random_uuid)
- user_id (FK→user_profiles ON DELETE CASCADE, nullable for anonymous)
- student_profile_id (FK→student_profiles ON DELETE SET NULL, nullable)
- session_type text NOT NULL CHECK(finder|chat)
- title text, created_at, last_message_at, expires_at
- CHECK: user_id IS NOT NULL OR expires_at IS NOT NULL
  (anonymous conversations must be temporary)
- 6 indexes: user_id, student_profile_id, session_type, created_at,
  last_message_at, expires_at
- 1 partial index on (expires_at) WHERE expires_at IS NOT NULL

ai_conversations RLS (6 policies):
- select/insert/update/delete_own — user_id = auth.uid()
- select_super_admin, delete_super_admin

ai_messages table:
- id (uuid pk gen_random_uuid)
- ai_conversation_id (FK→ai_conversations ON DELETE CASCADE, NOT NULL)
- role text NOT NULL CHECK(user|assistant|system)
- content text NOT NULL
- context_used jsonb (DegreeWiki records injected into LLM prompt)
- ai_model_used text
- prompt_token_count, completion_token_count integer NOT NULL DEFAULT 0
- created_at (no updated_at — messages are never edited)
- 3 indexes: ai_conversation_id, role, created_at

ai_messages RLS (5 policies):
- select/insert/delete_own — all use EXISTS check on parent ai_conversations.user_id = auth.uid()
- No UPDATE policy — messages are append-only by design
- select_super_admin, delete_super_admin

ai_usage_logs table:
- id (uuid pk gen_random_uuid)
- user_id (FK→user_profiles ON DELETE SET NULL, nullable for anonymous)
- session_type text NOT NULL CHECK(finder|chat)
- tokens_used integer NOT NULL DEFAULT 0
- model_used text, cost_estimate_usd numeric
- created_at (no updated_at — rows never modified)
- 4 indexes: user_id, session_type, model_used, created_at

ai_usage_logs RLS (1 policy):
- select_permitted — has_permission('view_ai_logs') OR has_role('super_admin')
- No INSERT policy — all writes via service role through server endpoints
- No UPDATE or DELETE policies — immutable audit log

Important Decisions Made:
- Anonymous student profiles, finder results, and conversations have no direct browser RLS
  policies. All anonymous access goes through server endpoints using the service role.
  This prevents session_token or expires_at from being inspectable/guessable by browsers.
- ai_finder_program_matches.program_id uses ON DELETE RESTRICT. Deleting a program while
  it is still referenced in a Finder result must be an explicit operation, not a silent cascade.
- ai_usage_logs has no authenticated INSERT policy. The service role (used by server
  endpoints) bypasses RLS, making a policy unnecessary. Adding one would create a security
  risk by allowing authenticated clients to write cost records.
- ai_messages has no UPDATE policy. Chat messages are immutable after creation. Corrections
  require sending a new message, not editing a prior one.
- No ai_finder_scholarship_matches table — deferred to future migration.
- No pgvector, embeddings, or RAG tables — deferred to MVP-plus phase.
- last_message_at on ai_conversations is updated by server-side logic (service role), not
  a DB trigger, to avoid trigger overhead on every message insert.

Files created:
- supabase/migrations/011_student_profiles.sql
- supabase/migrations/012_ai_tables.sql

Files updated:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review migrations 011 and 012 (optionally with ChatGPT).
- Approve to continue.
- Implement migrations 013 (report_categories, user_reports, saved_items)
  and 014 (analytics_events, search_logs, outbound_clicks).

---

## 2026-06-15 - Security Patch: Migrations 011 and 012

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Apply 8 security and integrity patches to migrations 011 and 012 as identified during
external review. Do not create migration 013.

Changes made:

011_student_profiles.sql:

1. Replaced three loose owner constraints with one strict combined constraint:
   chk_student_profiles_owner_mode
   - Logged-in mode: is_anonymous = false, user_id NOT NULL, session_token NULL.
   - Anonymous mode: is_anonymous = true, user_id NULL, session_token NOT NULL, expires_at NOT NULL.
   - Prevents any hybrid or mixed state at the database level.

2. Tightened student_profiles UPDATE WITH CHECK:
   Added: AND is_anonymous = false AND session_token IS NULL
   Prevents a logged-in user from converting a normal profile into an anonymous one
   via an UPDATE.

3. Replaced plain session_token index with a unique partial index:
   CREATE UNIQUE INDEX idx_student_profiles_session_token_unique
     ON public.student_profiles (session_token)
     WHERE is_anonymous = true AND session_token IS NOT NULL;
   Enforces that no two anonymous sessions share the same token.
   Added comment: future security pass may store session_token_hash instead of raw token.

012_ai_tables.sql:

4. Removed ai_finder_program_matches_insert_own policy.
   Reason: browser clients must not be able to fabricate program match rows.
   Program matches are generated by the server scoring engine and written via service role.

5. Removed ai_finder_program_matches_delete_own policy.
   Reason: same as above. Match cleanup goes through server endpoints.

6. Removed ai_messages_insert_own policy.
   Reason: browser INSERT would allow clients to write arbitrary role values
   (including 'assistant' and 'system') and bypass cost tracking in ai_usage_logs.
   All message rows are written via service role through server endpoints.

7. Removed ai_messages_delete_own policy.
   Reason: message deletion should not be browser-driven. Service role manages cleanup.

8. Replaced chk_conversation_not_permanent_if_anonymous with chk_ai_conversations_owner_context:
   Old: CHECK (user_id IS NOT NULL OR expires_at IS NOT NULL)
   New: CHECK (
          user_id IS NOT NULL
          OR (
            student_profile_id IS NOT NULL
            AND expires_at IS NOT NULL
          )
        )
   Reason: anonymous conversations must be tied to a student profile so the server
   can verify ownership via the linked profile's session_token. A floating anonymous
   conversation with only expires_at is not verifiable without a profile link.

9. Tightened ai_conversations INSERT/UPDATE policy comments to make explicit that
   WITH CHECK (user_id = auth.uid()) prevents null user_id inserts from browser clients.
   Anonymous conversations are created exclusively via server endpoints.

Grep verification (all passed):

grep -n "ai_finder_program_matches_insert_own" supabase/migrations/012_ai_tables.sql
  → No output. Exit code 1. Policy does not exist.

grep -n "ai_messages_insert_own" supabase/migrations/012_ai_tables.sql
  → No output. Exit code 1. Policy does not exist.

grep -n "chk_student_profiles_owner_mode" supabase/migrations/011_student_profiles.sql
  → Line 93. Constraint present.

grep -n "idx_student_profiles_session_token_unique" supabase/migrations/011_student_profiles.sql
  → Line 131. Unique partial index present.

grep -n "chk_ai_conversations_owner_context" supabase/migrations/012_ai_tables.sql
  → Line 264. Constraint present.

Files changed:
- supabase/migrations/011_student_profiles.sql
- supabase/migrations/012_ai_tables.sql
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review patched migrations 011 and 012 (optionally with ChatGPT).
- Approve to continue.
- Implement migration 013 (report_categories, user_reports, saved_items).

---

## 2026-06-15 - Security Patch Round 2: Migration 012

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Apply three additional security patches to migration 012_ai_tables.sql identified during
external review of the round-1 patched file. Migration 011 is approved unchanged.
Do not create migration 013.

Changes made:

012_ai_tables.sql:

1. Removed ai_finder_results_insert_own policy.
   Reason: browser clients must not be able to fabricate ai_explanation, ai_model_used,
   token counts, or result_status. The server endpoint must run database filtering,
   rule-based scoring, and the LLM call before any result row is persisted.
   Logged-in users retain SELECT and DELETE on their own results.
   INSERT is now service-role/server-only.

2. Tightened ai_conversations_insert_own WITH CHECK.
   Old: WITH CHECK (user_id = auth.uid())
   New: WITH CHECK (
          user_id = auth.uid()
          AND (
            student_profile_id IS NULL
            OR EXISTS (
              SELECT 1 FROM public.student_profiles sp
              WHERE sp.id      = ai_conversations.student_profile_id
                AND sp.user_id = auth.uid()
                AND sp.is_anonymous = false
            )
          )
        )
   Reason: the previous policy allowed a logged-in user to create a conversation that
   references another user's student_profile_id (UUID guessing attack). The new check
   requires student_profile_id — when set — to belong to auth.uid() and to be a
   non-anonymous profile.

3. Tightened ai_conversations_update_own WITH CHECK with the same student_profile_id
   ownership guard as INSERT.
   USING remains: user_id = auth.uid()

4. Updated all relevant comments (table header, RLS summary, individual policy comments)
   to accurately describe the new access model.

Grep verification (all passed):

grep -n "ai_finder_results_insert_own" supabase/migrations/012_ai_tables.sql
  → No output. Exit code 1. Policy does not exist.

grep -n "student_profile_id IS NULL" supabase/migrations/012_ai_tables.sql
  → Lines 316, 336. Two matches — INSERT WITH CHECK and UPDATE WITH CHECK.

grep -n "sp.is_anonymous = false" supabase/migrations/012_ai_tables.sql
  → Lines 321, 341. Two matches — inside the EXISTS subquery in both policies.

Files changed:
- supabase/migrations/012_ai_tables.sql
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review patched migration 012 (optionally with ChatGPT).
- Approve to continue.
- Implement migration 013 (report_categories, user_reports, saved_items).

---

## 2026-06-15 - Migrations 013–015: User Product, Analytics, and Seed Data

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Implement the final three Database Schema v1 migrations. Migrations 001–012 were
externally approved. Do not modify them. Do not create migration 016.

Completed:

supabase/migrations/013_user_product.sql created.

report_categories table:
- id (uuid pk gen_random_uuid), code (UNIQUE), name, description
- is_active boolean NOT NULL DEFAULT true
- created_at, updated_at + trigger (set_report_categories_updated_at)
- Indexes: is_active, created_at, updated_at (code UNIQUE auto-creates its own index)
- RLS: public/authenticated SELECT when is_active = true; settings managers SELECT all;
  INSERT/UPDATE/DELETE require manage_settings (5 policies)

user_reports table:
- id (uuid pk gen_random_uuid)
- reporter_user_id (FK→user_profiles ON DELETE SET NULL, nullable)
- entity_type text NOT NULL CHECK (19 canonical entity_type values)
- entity_id uuid NOT NULL (polymorphic — no FK)
- report_category_id (FK→report_categories ON DELETE RESTRICT, NOT NULL)
- description text NOT NULL
- report_status text NOT NULL DEFAULT 'open' CHECK(open|under_review|resolved|dismissed)
- admin_notes text
- resolved_by_user_id (FK→user_profiles ON DELETE SET NULL)
- resolved_at timestamptz
- created_at, updated_at + trigger (set_user_reports_updated_at)
- Indexes: reporter_user_id, (entity_type, entity_id), report_category_id,
  report_status, resolved_by_user_id, created_at, updated_at (7 indexes)
- RLS:
  - user_reports_insert_own — authenticated INSERT where reporter_user_id = auth.uid()
  - user_reports_select_own — authenticated SELECT where reporter_user_id = auth.uid()
  - No UPDATE/DELETE for browser clients
  - user_reports_select_admin — manage_reports OR super_admin
  - user_reports_update_admin — manage_reports OR super_admin (USING + WITH CHECK)
  - user_reports_delete_super_admin — super_admin only (6 policies)
  - Anonymous reports go through service role via server endpoints; no anon browser policies

saved_items table:
- id (uuid pk gen_random_uuid)
- user_id (FK→user_profiles ON DELETE CASCADE, NOT NULL)
- entity_type text NOT NULL CHECK (19 canonical values)
- entity_id uuid NOT NULL
- notes text
- created_at, updated_at + trigger (set_saved_items_updated_at)
- UNIQUE (user_id, entity_type, entity_id) — prevents duplicate saves
- Indexes: (entity_type, entity_id), created_at, updated_at
  (user_id leading column covered by UNIQUE constraint)
- RLS:
  - saved_items_select/insert/update/delete_own — user_id = auth.uid() (4 policies)
  - saved_items_select_super_admin, _delete_super_admin (2 policies)

supabase/migrations/014_analytics.sql created.

All three analytics tables are append-only. No updated_at columns.
Browser INSERT is unrestricted (anon + authenticated, WITH CHECK (true)).
SELECT requires view_analytics OR super_admin. No UPDATE/DELETE policies.

analytics_events table:
- id (uuid pk gen_random_uuid), event_type text NOT NULL
- entity_type text nullable CHECK (entity_type IS NULL OR entity_type IN (...))
- entity_id uuid, user_id (FK→user_profiles ON DELETE SET NULL), session_id text
- properties jsonb, created_at timestamptz NOT NULL DEFAULT now()
- Indexes: event_type, (entity_type, entity_id), user_id, session_id, created_at,
  composite (event_type, created_at) — 6 indexes

search_logs table:
- id (uuid pk gen_random_uuid), query text, filters jsonb, result_count integer
- user_id (FK→user_profiles ON DELETE SET NULL), session_id text
- created_at timestamptz NOT NULL DEFAULT now()
- Indexes: user_id, session_id, result_count, created_at — 4 indexes

outbound_clicks table:
- id (uuid pk gen_random_uuid)
- entity_type text NOT NULL CHECK (19 canonical values)
- entity_id uuid NOT NULL, destination_url text NOT NULL
- click_type text NOT NULL CHECK(official_site|apply|scholarship|source|brochure|other)
- user_id (FK→user_profiles ON DELETE SET NULL), session_id text
- created_at timestamptz NOT NULL DEFAULT now()
- Indexes: (entity_type, entity_id), click_type, user_id, session_id, created_at — 5 indexes

supabase/migrations/015_seed_data.sql created.

Seed migration is fully idempotent. Every INSERT uses ON CONFLICT DO UPDATE or DO NOTHING.

degree_levels seeded (7 rows):
- bachelor (1), master (2), phd (3), foundation (4),
  diploma (5), certificate (6), associate (7)
- ON CONFLICT (code) DO UPDATE

roles seeded (5 rows):
- student, content_admin, reviewer, data_import_manager, super_admin
- ON CONFLICT (code) DO UPDATE

permissions seeded (20 rows):
- edit_content, publish_content, manage_imports, manage_media, manage_reports,
  view_analytics, view_ai_logs, view_data_quality, manage_data_sources,
  manage_settings, manage_users, manage_roles, view_admin_logs,
  approve_import, reject_import, manage_scholarships, manage_universities,
  manage_programs, manage_articles, manage_seo_pages
- ON CONFLICT (code) DO UPDATE

role_permissions seeded (INSERT SELECT, ON CONFLICT DO NOTHING):
- content_admin (7): edit_content, manage_media, manage_programs,
  manage_universities, manage_scholarships, manage_articles, manage_seo_pages
- reviewer (5): edit_content, publish_content, view_data_quality,
  manage_data_sources, manage_reports
- data_import_manager (5): manage_imports, approve_import, reject_import,
  view_data_quality, manage_data_sources
- super_admin: CROSS JOIN all 20 permissions
- student: no permissions inserted

article_categories seeded (7 rows):
- country-guides, university-guides, program-guides, scholarship-guides,
  application-advice, visa-and-work, student-life
- ON CONFLICT (slug) DO UPDATE

seo_page_types seeded (6 rows):
- country_degree, subject_degree, country_subject_degree,
  scholarship_country, scholarship_degree, attribute_degree
- ON CONFLICT (code) DO UPDATE

report_categories seeded (6 rows):
- wrong_information, broken_link, outdated_information,
  duplicate_record, missing_information, other
- ON CONFLICT (code) DO UPDATE

Not seeded: countries, subjects, universities, programs, scholarships,
articles, seo_landing_pages, analytics rows, user rows.

Bootstrap note included in migration 015 header comment:
- The first super_admin role assignment must be done manually after a real auth
  user is created — via Supabase Dashboard SQL editor or service role script.

Important Decisions Made:
- Anonymous reports have no anon browser RLS policy on user_reports. Anonymous
  submissions are gated at the server endpoint layer (service role only).
  This prevents report spam and ensures entity validation happens server-side.
- analytics_events.entity_type uses IS NULL OR ... in the CHECK constraint
  to allow event types that are not tied to a specific entity (e.g. page loads).
- outbound_clicks.entity_type is NOT NULL (required) — every click must be
  attributed to an entity for analytics to be meaningful.
- The UNIQUE (user_id, entity_type, entity_id) constraint on saved_items auto-
  creates an index with user_id as the leading column. No separate user_id index
  is created — it would be redundant.
- No page_views table added — deferred per task requirements.
- No migration 016 created.
- Database Schema v1 is now complete across all 15 migrations.

Files created:
- supabase/migrations/013_user_product.sql
- supabase/migrations/014_analytics.sql
- supabase/migrations/015_seed_data.sql

Files updated:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Review migrations 013–015 (optionally with ChatGPT).
- Approve to continue.
- Deploy migrations 001–015 to Supabase.
- Verify RLS policies in Supabase Dashboard.
- Bootstrap first super_admin via SQL editor.
- Load countries and subjects via import batch.

---

## 2026-06-15 - Security Patch: Migration 014

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Apply security patch to migration 014_analytics.sql as identified during external review.
Migrations 013 and 015 are approved unchanged. Do not create new migrations.

Problem identified:
All three analytics INSERT policies used WITH CHECK (true), which allowed any browser
client (anon or authenticated) to insert rows with an arbitrary user_id value. A malicious
client could forge analytics attributed to another user's UUID.

Changes made:

014_analytics.sql:

1. Updated file header comment.
   Old: "Allowed for anon and authenticated clients with no restriction."
   New: Explains that user_id cannot be forged. Anonymous events must use user_id = NULL.
   Authenticated clients may use NULL or their own auth.uid(). No impersonation allowed.

2. Added chk_analytics_events_entity CHECK constraint on analytics_events.
   Enforces that entity_type and entity_id are either both NULL or both set.
   A partially-filled pair (entity_type without entity_id, or vice versa) is rejected.
   Updated table comment to document this constraint.

3. Replaced analytics_events_insert_all WITH CHECK (true)
   with WITH CHECK (user_id IS NULL OR user_id = auth.uid())
   Updated inline comment to explain the rule.

4. Replaced search_logs_insert_all WITH CHECK (true)
   with WITH CHECK (user_id IS NULL OR user_id = auth.uid())
   Updated inline comment.

5. Replaced outbound_clicks_insert_all WITH CHECK (true)
   with WITH CHECK (user_id IS NULL OR user_id = auth.uid())
   Updated inline comment.

SELECT policies unchanged: view_analytics OR super_admin required.
No UPDATE or DELETE policies added.

Grep verification (both passed):

grep -n "WITH CHECK (true)" supabase/migrations/014_analytics.sql
  → No output. Exit code 1. No unguarded WITH CHECK (true) remains.

grep -n "user_id IS NULL" supabase/migrations/014_analytics.sql
  → Lines 97, 147, 210. Three matches — one per INSERT policy.

Files changed:
- supabase/migrations/014_analytics.sql
- docs/06-status.md
- docs/07-task-log.md

Next:
- Deploy migrations 001–015 to Supabase.
- Verify RLS policies in Supabase Dashboard.
- Bootstrap first super_admin via SQL editor.
- Load countries and subjects via import batch.
- Begin Phase 02: frontend / API layer.

---

## 2026-06-15 - Final Validation Pass: Schema v1 Migrations 001–015

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Final static validation of all 15 Schema v1 migration files after external approval.
Supabase CLI not available — live db reset not performed.

File count check:
- 15 migration files present: 001–015 ✓
- All named correctly (NNN_slug.sql) ✓
- No migration after 015 ✓

CREATE POLICY counts by file:
- 002_auth_roles.sql: 11
- 003_media.sql: 9
- 004_lookup_tables.sql: 18
- 005_universities_campuses.sql: 10
- 006_programs.sql: 15
- 007_scholarships.sql: 35
- 008_articles_seo.sql: 33
- 009_data_sources.sql: 15
- 010_import_staging.sql: 24
- 011_student_profiles.sql: 18
- 012_ai_tables.sql: 17
- 013_user_product.sql: 16
- 014_analytics.sql: 6
- 001_custom_types.sql, 015_seed_data.sql: 0 each (no tables, expected)
- Total: 227 policies across 13 files ✓

ENABLE ROW LEVEL SECURITY counts:
- 55 RLS-enabled tables across 13 files ✓
- 001_custom_types.sql, 015_seed_data.sql: 0 each (expected) ✓

Unsafe pattern checks (all clean):
- WITH CHECK (true): NOT FOUND ✓
- TO anon: NOT FOUND ✓
- admin_logs_insert_permitted: NOT FOUND ✓
- entity_media_select_public: NOT FOUND ✓
- ai_messages_insert_own: NOT FOUND ✓
- ai_finder_results_insert_own: NOT FOUND ✓
- ai_finder_program_matches_insert_own: NOT FOUND ✓

Docs updated:
- docs/06-status.md updated: now states "Schema v1 migrations 001–015 complete and
  approved. Pending live Supabase validation."
- docs/07-task-log.md: this entry is the final entry.

Conclusion:
All 15 migrations pass static validation. No unsafe patterns detected.
Live deploy and RLS verification require Supabase Dashboard or a machine with the CLI.

Files changed:
- docs/06-status.md
- docs/07-task-log.md

---

## 2026-06-15 - Local Supabase Validation: All 15 Migrations Pass

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Install Supabase CLI and validate all 15 Schema v1 migrations locally via `supabase db reset`.

Actions taken:

1. Confirmed Supabase CLI was not installed and not in PATH.
2. Installed via `npm install -g supabase` (Node 25 / npm 11 already present).
3. Added `C:\Users\mdsha\AppData\Roaming\npm` to user PATH permanently
   (npm global bin was missing from PATH — supabase.cmd was present but unreachable).
4. Confirmed Supabase CLI 2.106.0 operational.
5. Confirmed Docker 29.5.2 running.
6. Ran `supabase start` — Docker images pulled, all 15 migrations applied automatically.
7. Ran `supabase db reset` — clean pass, zero errors:
   - 001_custom_types.sql ✓ (pgcrypto NOTICE: already exists, skipping — expected)
   - 002_auth_roles.sql ✓
   - 003_media.sql ✓
   - 004_lookup_tables.sql ✓
   - 005_universities_campuses.sql ✓
   - 006_programs.sql ✓
   - 007_scholarships.sql ✓
   - 008_articles_seo.sql ✓
   - 009_data_sources.sql ✓
   - 010_import_staging.sql ✓
   - 011_student_profiles.sql ✓
   - 012_ai_tables.sql ✓
   - 013_user_product.sql ✓
   - 014_analytics.sql ✓
   - 015_seed_data.sql ✓

No migration files were modified. Zero SQL errors.

Warning noted (non-blocking):
- "no files matched pattern: supabase/seed.sql" — no seed.sql exists; 015_seed_data.sql
  is a migration, not a seed file. This warning is expected and safe to ignore.
- Analytics on Windows requires Docker daemon exposed on tcp://localhost:2375 — only
  affects the analytics/logflare service in Studio UI, not the database or migrations.

Local Studio available at: http://127.0.0.1:54323
Local DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres

Files changed:
- docs/06-status.md (updated: CLI installed, validation passed, next steps revised)
- docs/07-task-log.md (this entry)

Next:
- Bootstrap first super_admin locally via Supabase Studio SQL editor or psql.
- Deploy migrations 001–015 to live Supabase project via `supabase db push` or Dashboard.
- Verify RLS policies on live project.
- Load countries and subjects.
- Begin Phase 02: frontend / API layer.

---

## 2026-06-15 - Phase 02: Supabase Cloud Dev Deployment and RLS Validation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Deploy Schema v1 migrations 001–015 to Supabase cloud dev project, bootstrap the first
super_admin, verify cloud grants, and validate all RLS policies via REST/API smoke tests.

Actions taken:

1. Provisioned Supabase cloud dev project in ap-south-1 / Mumbai.
   Project ref: hbjnrlsnrknugpkitihq.

2. Pushed migrations 001–015 via `supabase db push`.
   Remote migration list confirmed to match local migration list exactly.

3. Bootstrapped first super_admin (degreewiki@gmail.com) via Supabase Dashboard SQL editor.
   Verification query confirmed: role_code = super_admin, permission_count = 20.

4. Cloud grant check:
   - anon and authenticated DML grants exist on all public tables.
   - Migration 016 not created (no grant migration needed).

5. RLS problem check:
   - Query for tables missing RLS or missing at least one policy returned 0 rows.
   - All 55 RLS-enabled tables in public schema are correctly configured.

6. Ran 15-test RLS REST/API smoke test suite using anon key and JWTs only.
   No service_role key used. No migrations created. No schema modified.

Smoke test results (all 15 completed, no critical stop triggered):

S1  smoke-student sign-in                      PASS
S2  super_admin sign-in                        PASS
T1-A anon read degree_levels                   PASS  7 rows
T1-B anon read report_categories               PASS  6 rows
T2-A anon INSERT degree_levels                 PASS  HTTP 401 (no anon INSERT grant — pre-RLS rejection)
T2-B anon SELECT user_profiles                 PASS  []
T3-A student SELECT user_profiles              PASS  own row only
T3-B student_profile exists check              PASS  not found — will insert
T3-C student INSERT student_profile            PASS  created
T3-D student SELECT student_profiles           PASS  own row only
T4-A student SELECT admin_activity_logs        PASS  []
T4-B student INSERT roles                      PASS  HTTP 403
T5-A super_admin SELECT user_profiles          PASS  2 profiles visible
T5-B super_admin SELECT student_profiles       PASS  1 profile visible
T5-C super_admin SELECT admin_activity_logs    PASS  HTTP 200 (0 rows, no entries yet)

Notable finding on T2-A:
anon INSERT into degree_levels returned HTTP 401, not 403. This is correct PostgREST
behaviour: 401 = no INSERT grant on the role (rejected before RLS is evaluated);
403 = grant exists but RLS blocks the row. The write is blocked either way. Not a bug.

Important Decisions Made:
- No migration 016 created (anon/authenticated grants already present in cloud).
- No service_role key used at any point during smoke testing.
- Smoke test student_profile INSERT body uses only user_id + is_anonymous = false,
  satisfying the chk_student_profiles_owner_mode CHECK constraint without any other fields.
- T5-D (super_admin INSERT into roles) skipped for Phase 02 — read/access behaviour only.

Files changed:
- docs/06-status.md
- docs/07-task-log.md

Next:
- Load countries and subjects via import batch.
- Begin Phase 03: frontend / API layer (Astro.js, React islands, Supabase client).

---

## 2026-06-15 - Phase 04: Admin Dashboard Foundation

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Build a minimal admin dashboard shell and read-only admin data views using the Phase 03
super_admin gate. No CRUD, no migrations, no schema changes, no service_role in src.

Column verification performed before writing queries:
- scholarships.deadline: confirmed as `date` (migration 007)
- data_quality_checks.result: confirmed as text CHECK(pass|fail|warning) (migration 009)
- data_quality_checks.checked_at: confirmed (migration 009)
- articles.published_at: confirmed as timestamptz nullable (migration 008)
- import_batches.batch_type: confirmed as text CHECK(universities|programs|scholarships|mixed) (migration 010)
- import_batches.import_status: confirmed with 8 canonical values (migration 010)
- user_profiles columns: id, display_name, avatar_url, account_status, created_at, updated_at (migration 002)
  No email column — email lives in auth.users, requires service_role to query directly.
- permissions columns: id, code, name, description (migration 002)

Completed:

New lib files:

src/lib/admin/guard.ts:
- Exports requireSuperAdmin(cookies, request, requestPath): Promise<GuardResult>
- Runs getUser() then has_role('super_admin') RPC on the same server client
- Returns { type: 'redirect', to } | { type: 'forbidden' } | { type: 'ok', user, supabase }
- Pages handle redirect/forbidden; guard returns the supabase client to avoid creating it twice

src/lib/admin/badges.ts:
- Static Record<string, string> maps for badge Tailwind classes
- All values are literal strings — Tailwind v4 scanner can find them all
- Maps: CONTENT_STATUS_BADGE, IMPORT_STATUS_BADGE, BATCH_TYPE_BADGE, QUALITY_RESULT_BADGE,
  ACCOUNT_STATUS_BADGE, FALLBACK_BADGE

New layout and components:

src/layouts/AdminLayout.astro:
- Wraps BaseLayout (no duplicate html/head/body tags)
- Two-column flex layout: AdminSidebar (fixed width) + main content area
- Topbar in content area: shows userEmail prop + logout form button
- Accepts: title, activePath, userEmail props

src/components/admin/AdminSidebar.astro:
- Static nav list with 9 links: Dashboard, Universities, Programs, Scholarships,
  Articles, Data Quality, Imports, Users, System
- Active link highlighted via static ternary strings (Tailwind v4 compatible)

src/components/admin/StatCard.astro:
- Accepts: label, value, subLabel (optional)
- Simple white card with label/value display

Pages modified:

src/pages/admin/index.astro (replaced):
- Now renders AdminLayout with 6 StatCards
- Parallel count queries: universities, programs, scholarships, articles, import_batches, user_profiles
- Uses { count: 'exact', head: true } HEAD queries

Pages added:

src/pages/admin/universities.astro:
- Columns: name, slug, content_status badge, verification_status, data_completeness_score, created_at
- Ordered by created_at desc, limit 100
- Empty state + error state handled

src/pages/admin/programs.astro:
- Columns: title, slug, content_status badge, degree level code, created_at
- degree_levels looked up separately via parallel query + Map to avoid join complexity
- Ordered by created_at desc, limit 100

src/pages/admin/scholarships.astro:
- Columns: name, slug, content_status badge, scholarship_type, deadline, created_at
- scholarships.deadline is a real date column (confirmed from migration 007)

src/pages/admin/articles.astro:
- Columns: title, slug, content_status badge, published_at, created_at
- articles.published_at is nullable timestamptz (confirmed from migration 008)
- Shows '—' when published_at is null

src/pages/admin/data-quality.astro:
- Summary counts: pass, fail, warning (computed from recent 50 rows)
- Columns: entity_type, check_type, result badge, checked_at
- Ordered by checked_at desc, limit 50

src/pages/admin/imports.astro:
- Columns: batch_type badge, import_status badge, total_records, processed_count,
  error_count (red if > 0), created_at
- Ordered by created_at desc, limit 100

src/pages/admin/users.astro:
- Columns: user ID (first 8 chars truncated), display_name, account_status badge, created_at
- Queries user_profiles only — email not available without service_role
- UI note explains the email limitation

src/pages/admin/system.astro:
- Two-column grid: Roles table (code, name) + Permissions table (code, name)
- Queries roles and permissions tables from seed data
- No secrets, no env vars, no raw headers shown

Access guard (all 9 routes):
- Anonymous → /login?redirect=${encodeURIComponent(requestPath)}
- Non-super_admin → 403 Forbidden: super_admin role required.
- super_admin → page renders

Validation:

npm run build: PASS (Cloudflare adapter, 7.26s, zero errors)

grep -R "service_role" src/:
- One match: a comment in users.astro explaining why email is not shown.
  No actual service_role key usage anywhere in src/.

git ls-files --others --exclude-standard | grep -E "\.env|secret|key":
- No output. No secret files untracked.

git status:
- src/pages/admin/index.astro: modified
- src/components/, src/layouts/AdminLayout.astro, src/lib/admin/,
  src/pages/admin/*.astro (8 new): untracked

Important Decisions Made:
- requireSuperAdmin() returns the supabase client to avoid creating two server clients per page.
  The client already has the session baked in from getUser(); reusing it is correct.
- Badge class maps use static literal string values only. No dynamic class construction.
  Ternary expressions in AdminSidebar also use only static string literals.
- AdminLayout wraps BaseLayout — the html/head/body tags are owned by BaseLayout.
  AdminLayout does not create its own shell, preventing nested document tags.
- user_profiles has no email column. /admin/users is limited to display_name and account_status.
  This is a deliberate RLS-safe limitation noted inline in the UI.
- degree_levels lookup on the programs page uses a parallel query + Map rather than a PostgREST
  join to avoid TypeScript complexity with untyped join shapes.
- /admin/system shows only roles and permissions — both are safe lookup/seed tables.
  No env vars, no tokens, no headers are exposed.
- All list pages limit to 100 rows ordered by created_at desc. No pagination in Phase 04.

Files created:
- src/lib/admin/guard.ts
- src/lib/admin/badges.ts
- src/layouts/AdminLayout.astro
- src/components/admin/AdminSidebar.astro
- src/components/admin/StatCard.astro
- src/pages/admin/universities.astro
- src/pages/admin/programs.astro
- src/pages/admin/scholarships.astro
- src/pages/admin/articles.astro
- src/pages/admin/data-quality.astro
- src/pages/admin/imports.astro
- src/pages/admin/users.astro
- src/pages/admin/system.astro

Files modified:
- src/pages/admin/index.astro (complete rewrite)
- docs/06-status.md
- docs/07-task-log.md

Next:
- Manually verify all 9 routes: anonymous redirect, student 403, super_admin access.
- Verify logout works from the new admin layout topbar.
- Merge feature/phase-04-admin-dashboard-foundation to main.
- Load countries and subjects via import batch.
- Begin Phase 05: admin CRUD or public SEO pages (TBD).

---

## 2026-06-15 - Phase 03: App Foundation and Auth

Tool:
Claude Code (claude-sonnet-4-6)

Goal:
Scaffold Astro app, add Supabase browser/server clients, implement login/logout,
add /admin protected by super_admin role check.

Completed:

Astro app scaffolded from scratch (no app existed before this phase).

package.json:
- astro ^5, @astrojs/cloudflare ^12, @supabase/supabase-js ^2, @supabase/ssr ^0.5
- tailwindcss ^4, @tailwindcss/vite ^4
- No React — deferred until interactive islands are actually needed.

astro.config.mjs:
- output: 'server' (full SSR — required for Cloudflare Pages and for cookie-based auth)
- adapter: cloudflare()
- vite.plugins: [tailwindcss()] via @tailwindcss/vite

src/styles/global.css:
- @import "tailwindcss" (Tailwind v4 CSS-first approach)

src/layouts/BaseLayout.astro:
- Minimal HTML shell, imports global.css, accepts title prop.

src/lib/supabase/client.ts:
- createBrowserClient() from @supabase/ssr using PUBLIC_ env vars.
- For future React islands or browser-side code.

src/lib/supabase/server.ts:
- createServerClient() from @supabase/ssr.
- Accepts (cookies: AstroCookies, request: Request).
- Reads cookies from raw request header — AstroCookies.getAll() does not exist in Astro v5.
- Writes outgoing cookies via cookies.set().

src/middleware.ts:
- Runs on every request.
- Creates a server Supabase client and calls getUser() to refresh expired tokens.
- Writes updated cookies back before the page renders.
- Does not redirect — auth guard logic stays in individual pages.

src/pages/index.astro:
- Home page. Shows "Sign in" link when logged out; shows email + Admin/Logout when logged in.

src/pages/login.astro:
- Email + password form. Server-side POST handling via Astro.request.formData().
- Redirects already-authenticated users to /admin on GET.
- Open-redirect guard on ?redirect= param (only accepts same-origin paths starting with /).
- Error message displayed inline on failed login.

src/pages/auth/callback.astro:
- Handles ?code= param from magic links / OAuth (infrastructure; not triggered in Phase 03).
- Calls exchangeCodeForSession(code) and redirects to /.

src/pages/api/auth/logout.ts:
- POST endpoint. Calls supabase.auth.signOut(), redirects to /login.

src/pages/admin/index.astro:
- getUser() validates JWT with a live Supabase network call (not getSession() from cookies).
- Unauthenticated: redirect to /login?redirect=/admin.
- has_role() RPC called with { role_code: 'super_admin' } — parameter name confirmed
  from migration 002_auth_roles.sql (SECURITY DEFINER function).
- Non-super_admin: 403 response.
- super_admin: renders admin page showing email and access confirmation.

.env.example:
- Committed with empty PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.
- .env.local is gitignored — never committed.

.gitignore:
- Added dist/ and .astro/ (Astro build output and generated types).

Technical note — AstroCookies.getAll() absent in Astro v5:
  The @supabase/ssr cookie adapter requires a getAll() method. Astro v5 AstroCookies
  only exposes get/has/set/delete. The fix: parse incoming cookies from the raw
  request.headers.get('cookie') string in both middleware and the server client factory.
  The setAll() callback continues to use cookies.set() normally.

Test results:
- npm install: 347 packages, no fatal errors.
- npm run dev: Astro v5.18.2 ready in ~2.4s, no runtime errors.
- GET /: 200, home page renders.
- GET /login: 200, form renders.
- GET /admin (unauthenticated): 302 → /login?redirect=/admin.
- GET /auth/callback (no code): 302 → /.
- POST /login (wrong credentials): 200 with "Invalid login credentials" inline.
- super_admin login → /admin: PASS (manual).
- Non-super_admin → /admin: 403 Forbidden (manual).
- Logout: session cleared, redirected to /login (manual).
- npm run build: Complete in 2.47s, Cloudflare adapter output.
- grep service_role src/: zero matches.
- .env.local not in git status.

Important Decisions Made:
- getUser() used for admin auth check, not getSession().
  getSession() reads from cookies and is not authoritative for authorization.
  getUser() makes a live network call to Supabase to validate the JWT.
- React not installed in Phase 03. No @astrojs/react, react, react-dom.
  Added when the first interactive island is actually needed.
- @astrojs/tailwind not used — deprecated. Tailwind v4 via @tailwindcss/vite.
- No SUPABASE_SERVICE_ROLE_KEY referenced anywhere in this phase.
- output: 'server' — all routes are SSR by default. prerender = true added to
  individual pages later when static rendering is appropriate.
- Cloudflare adapter generates Cloudflare Pages/Workers-compatible output.
  No Vercel-only services used.

Files created:
- .env.example
- astro.config.mjs
- package.json
- package-lock.json
- tsconfig.json
- public/favicon.svg
- src/layouts/BaseLayout.astro
- src/lib/supabase/client.ts
- src/lib/supabase/server.ts
- src/middleware.ts
- src/pages/index.astro
- src/pages/login.astro
- src/pages/auth/callback.astro
- src/pages/api/auth/logout.ts
- src/pages/admin/index.astro
- src/styles/global.css

Files updated:
- .gitignore (added dist/, .astro/)
- docs/06-status.md
- docs/07-task-log.md

Commit: 1ad037b on feature/phase-03-app-foundation-auth

Next:
- Merge feature/phase-03-app-foundation-auth to main.
- Load countries and subjects via import batch.
- Begin Phase 04: admin CRUD, public SEO pages, or React islands (TBD).
