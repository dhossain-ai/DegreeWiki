# DegreeWiki Public UI Direction

## Phase

Phase 55A — Design Reference Lock

---

## Product identity

DegreeWiki is a source-backed study-abroad search portal for international students. It helps users search, compare, and act on bachelor's programmes, master's programmes, universities, scholarships, destinations, study guides, and AI best-fit recommendations.

The product must feel like a mature, trustworthy education-search portal — the kind an international student would cite when advising a friend. It is not a SaaS tool, not an agency marketing site, not an AI dashboard, and not a directory dump. Every UI decision should reinforce: credible, structured, and student-first.

---

## Locked design references

The following files are the approved final design reference artifacts for Phase 55B implementation:

- `docs/design/degreewiki-homepage-reference.html`
- `docs/design/degreewiki-program-card-reference.html`

> **Status as of Phase 55A amendment:** Both reference files are present in the repository. They were normalized from the original design zip artifacts (`DegreeWiki.dc.html` → `degreewiki-homepage-reference.html`; `ProgramCard.dc.html` → `degreewiki-program-card-reference.html`). `support.js` is retained alongside them as both HTML files reference it. Phase 55B may proceed.

---

## Benchmark blend

Each benchmark contributes a specific quality — not a look.

| Benchmark | Contribution |
|-----------|-------------|
| **Mastersportal** | Core education-search structure: filter rail, programme card grid, listing hierarchy |
| **Linear** | UI polish and spacing: tight typographic rhythm, restrained use of color, purposeful white space |
| **Google Flights** | Search/filter clarity: active filter chips, sort control, results count, compact toolbar |
| **Stripe** | Trust and hierarchy: confident typography, strong primary action, professional tone |
| **TopUniversities** | Education portal maturity: subject and destination taxonomy, institutional credibility signals |
| **DAAD** | Clarity and seriousness: information density without clutter, government-grade trust |
| **Airbnb** | Listing/card UX: save state, compare state, clear call to action, card hover interaction |

**Critical constraint:** These benchmarks set the quality bar. Do not copy their visual style, color palette, illustration treatment, or layout patterns directly. DegreeWiki has its own visual identity.

---

## Core design principle

DegreeWiki should feel like a mature education search portal, not a SaaS dashboard, agency site, or AI product. The UI is data-first, not decoration-first. Structure communicates trust. Every screen should answer: "what am I looking at, and what do I do next?"

---

## Visual language

### Color tokens (established in Phase 55)

| Role | Token | Value |
|------|-------|-------|
| Page background (canvas) | `--color-canvas` | `#faf8f3` (warm off-white) |
| Card/surface | `--color-surface` | `#ffffff` |
| Primary ink / navy | `--color-ink` | `#0b1f3a` |
| Primary action blue | `--color-primary` | `#1d4ed8` |
| Primary hover | `--color-primary-hover` | `#1e40af` |
| Verified / scholarship green | `--color-verified` | `#047857` |
| Deadline / warning amber | `--color-deadline` | `#b45309` |
| Border / edge | `--color-edge` | `#e2e8f0` |
| Muted text | `--color-muted` | `#64748b` |

Supporting tones visible in the design reference:

- Slate hierarchy: `#334155`, `#475569`, `#64748b`, `#94a3b8`
- Borders: `#e2e8f0`, `#cbd5e1`, `#eef2f7`
- Light blue surfaces: `#eff4ff`, `#dbe4ff`
- Verified green surface: `#ecfdf5`
- Deadline amber surface: `#fffbeb`

### Typography direction

The design reference uses IBM Plex Sans for body/UI and IBM Plex Mono for code/metadata. Type scale should be structured, not expressive. No display fonts, no script fonts, no heavy geometric sans.

Typography principles:
- Strong navy heading hierarchy (`#0b1f3a`)
- Muted supporting text (`#64748b`)
- Monospace for codes, identifiers, and compact data fields
- Clear size contrast between headings, labels, and body copy

### Surface and spacing

- White cards (`#ffffff`) on warm canvas background (`#faf8f3`)
- Thin border treatment (`1px solid #e2e8f0`)
- Soft box shadows (not dramatic elevation)
- Restrained border radius (not pill-shaped, not sharp-cornered)
- Breathing room: generous padding inside cards, structured vertical rhythm in sections

---

## Homepage direction

The homepage serves two audiences: students exploring options and students ready to search. The structure should be scannable top-to-bottom without requiring a scroll.

### Approved section order (locked from reference)

1. **Header** — DegreeWiki logo, primary nav links, Saved, Sign in, Get started CTA
2. **Hero** — Single H1 product statement, no stock photography, no illustration clutter
3. **Main search module** — Primary keyword/degree/destination search entry
4. **Fit Finder panel** — Guided CTA to the AI recommendation flow
5. **Featured programmes** — Curated programme card grid (not raw database dump)
6. **Browse by study goal** — Subject/field navigation chips or cards
7. **Popular study destinations** — Destination cards with country and programme counts
8. **Scholarships and funding** — Scholarship row list with deadline and amount
9. **Fit Finder CTA** — Secondary CTA to the finder flow
10. **Study-abroad guides** — Guide cards with category and date
11. **Footer** — Standard links, legal, trust signals

### Homepage principles

- One H1 per page, in the hero section
- No carousel, no auto-playing content
- No stock photography in the hero
- Programme cards on the homepage use the same card anatomy as listing pages
- The search module is the most prominent UI element above the fold
- Section headings use the SectionHeader component (eyebrow + heading + optional view-all link)

---

## Search and listing direction

The search/listing page is where most user time is spent. It must load fast, filter cleanly, and present results that reward comparison.

### Approved layout structure (locked from reference)

1. **Compact search toolbar** — keyword + quick filters at the top of the results page
2. **Two-column layout** — filter rail left, results right
3. **Left filter rail** — sticky, collapsible on mobile
4. **Filter groups** — Degree level, Subject/field, Destination/country, Language of instruction
5. **Tuition range** — min/max slider or input pair
6. **Verified toggle** — show only source-verified programmes
7. **Scholarship toggle** — show only programmes with available scholarships
8. **Results count** — "N programmes found" above the results
9. **Sort control** — relevance, tuition, deadline, alphabetical
10. **Active filter chips** — dismissible chips for each active filter
11. **Programme result cards** — vertically stacked, full-width in results column
12. **Sticky compare tray** — bottom of viewport when 2+ cards are in compare state

### Listing principles

- Filter state is always visible (active chips)
- Results count updates on filter change
- No infinite scroll in MVP — pagination preferred
- Empty state is clear and suggests broadening filters
- Loading state does not flash layout (skeleton preferred over spinner)

---

## Programme card direction

The programme card is the core public UI record. It reads as structured education data, not a marketing tile. Every field on the card must earn its place.

### Card anatomy (locked from reference)

1. **University monogram / logo block** — initials or logo mark, constrained size
2. **Degree badge** — e.g. MSc, BSc, MA — uses the `level` badge variant
3. **Subject / field label** — secondary label, muted text
4. **Programme title** — primary card heading, strong navy, 2-line clamp
5. **University name** — linked, standard weight
6. **Country code and location** — flag emoji + city/country
7. **Duration** — e.g. "2 years"
8. **Language** — e.g. "English"
9. **Start intake** — e.g. "September 2026"
10. **Next deadline** — uses deadline amber color when within 60 days
11. **Scholarship availability badge** — green `verified` badge variant when present
12. **Verified / source-checked status** — "Source verified" indicator
13. **Tuition summary** — e.g. "€12,000 / year" or "Tuition not listed"
14. **View details button** — primary action, links to programme detail page
15. **Save button / state** — outline/icon when unsaved; filled/active when saved
16. **Compare button / state** — outline when inactive; blue ring selection when in compare

### Card interaction states

- **Default:** white surface, thin border (`#e2e8f0`), soft shadow
- **Hover:** slight upward lift (`translateY(-2px)`), deeper shadow, darker border (`#cbd5e1`)
- **Compare selected:** blue ring / selection outline (`#1d4ed8`)
- **Saved state:** filled save icon / active indicator

### Card principles

- Programme title is the primary heading — not the university name
- Tuition data must never be presented without a source qualifier
- Missing data fields show as "Not listed" or are omitted — never show "null" or empty
- Badges are earned indicators (verified, scholarship) — not decorative labels
- The card should be scannable in under 3 seconds: degree → title → university → location → deadline → tuition

---

## Trust and verification direction

DegreeWiki is source-backed. The verification layer is a core product differentiator. The UI must make this legible without making it feel bureaucratic.

### Trust signals to surface

- **Verified badge** — shown on cards when `verification_status` is `partially_verified` or `verified`; uses green color
- **Source indicator** — "Information from official university source" — shown on detail pages via SourceBox
- **Last verified date** — shown on detail pages when `last_verified_at` is set
- **Scholarship availability** — shown as a positive signal (green), not just metadata

### Trust principles

- Never show unverified data as if it is verified
- Source attribution appears on detail pages, not cards (too verbose for cards)
- "Partially verified" is an honest state — do not hide it or inflate it to "verified"
- Tuition figures that are estimates or ranges must be labeled as such
- AI-generated content (Fit Finder summaries) is clearly labeled as AI-generated

---

## Responsive direction

The design is mobile-first in implementation, but the reference design is anchored to desktop. Mobile adaptation should not compromise the desktop experience.

### Breakpoint behavior

- **Mobile (< 768px):** single-column layout; filter rail collapses to a modal/drawer; cards stack vertically; nav collapses to hamburger
- **Tablet (768px–1024px):** narrow two-column; filter rail may be narrower; cards remain full-width in results column
- **Desktop (> 1024px):** full two-column search layout as shown in the reference

### Mobile principles

- Search is always accessible above the fold on mobile
- Filter drawer shows active filter count in trigger button
- Programme cards on mobile show the four most critical fields: title, university, deadline, tuition — other fields collapse
- Tap targets meet 44px minimum
- Compare tray adapts to mobile: fixed bottom bar with scrollable compare list

---

## Accessibility direction

Accessibility is not a phase — it is a baseline requirement for all Phase 55B+ work.

### Minimum requirements

- All interactive elements reachable and operable via keyboard
- Focus indicators visible at all times (`:focus-visible` rule established in Phase 55 global CSS)
- Color is never the sole means of conveying information (verified status uses both color and text/icon)
- Images have `alt` text; decorative images use `alt=""`
- Heading hierarchy is logical per page (one H1, structured H2/H3 nesting)
- Form inputs are labeled (explicit `<label for>` association)
- Filter interactions announce state changes to screen readers (`aria-live` where needed)
- Save/compare toggle buttons have accessible names that reflect current state ("Save programme" / "Remove from saved")

### WCAG target

WCAG 2.1 AA as the minimum. Strive for AAA on contrast ratios (navy `#0b1f3a` on white already exceeds AA).

---

## What not to do

These are explicit prohibitions for all Phase 55B+ frontend work:

- **Do not redesign from scratch.** Use the locked design references.
- **Do not make DegreeWiki look like a SaaS landing page.** No gradient hero backgrounds, no floating feature cards, no testimonial carousels, no "get started for free" hero copy.
- **Do not make DegreeWiki look like an agency site.** No illustrated mascots, no decorative blob shapes, no oversized hero photography.
- **Do not make DegreeWiki look like an AI dashboard.** No dark theme by default, no graph panels, no "powered by AI" branding on every surface.
- **Do not copy a benchmark site.** The blend is for quality direction, not visual cloning.
- **Do not use purple as a semantic color.** Purple is not in the approved token set. Any existing purple badge use should be replaced with the neutral or level variant.
- **Do not add decorative elements** (illustrations, icons-as-decoration, gradient fills) that are not in the reference.
- **Do not introduce new dependencies** for UI components — the Phase 55 primitive set (Container, Section, SectionHeader, Button, Badge, Card) and public card components are the building blocks.
- **Do not change the design token values** defined in Phase 55 without a documented reason and explicit approval.

---

## Handoff to Phase 55B

Phase 55B should create the public design system implementation based on this direction and the locked design reference files. It should not begin until:

1. `docs/design/degreewiki-homepage-reference.html` is present in the repository
2. `docs/design/degreewiki-program-card-reference.html` is present in the repository
3. Phase 55A is marked complete in `docs/06-status.md`

### Phase 55B scope

- Implement the homepage (`src/pages/index.astro`) by composing Phase 55 components according to the homepage section order above
- Wire real data queries for each section (featured programmes, destinations, scholarships, guides)
- Apply the programme card anatomy to `src/components/public/cards/ProgramCard.astro`
- Implement card save/compare interaction states
- Implement the search/listing two-column layout with filter rail

### Phase 55B must not

- Change the Tailwind token values without explicit approval
- Add new npm dependencies without explicit approval
- Change the database schema or RLS policies
- Change the AI pipeline, auth flow, or admin area

---

## Non-goals for Phase 55A

The following are explicitly out of scope for Phase 55A:

- No changes to any `src/` files (pages, components, layouts, styles, lib)
- No changes to Tailwind config or CSS tokens
- No new npm dependencies
- No database schema changes or migrations
- No RLS changes
- No AI pipeline changes
- No auth or admin changes
- No Cloudflare/Vercel deployment changes
- No recreation of the locked design reference HTML files from memory (they must come from the approved design artifacts)
