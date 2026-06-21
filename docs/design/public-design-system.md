# DegreeWiki Public Design System

## Phase

Phase 55B — Public Design System Foundation

---

## Overview

This document describes the token set and component primitives established in Phase 55 and 55B. Phase 55C (homepage redesign) and later public-page work should use these primitives — not raw Tailwind utilities or inline styles.

---

## Token direction

All tokens are defined in `src/styles/global.css` as Tailwind v4 `@theme` CSS variables. Every `--color-*` variable generates `bg-*`, `text-*`, `border-*` Tailwind utilities automatically.

### Color tokens

| Token | Value | Use |
|-------|-------|-----|
| `canvas` | `#faf8f3` | Warm off-white page background |
| `surface` | `#ffffff` | Card and panel backgrounds |
| `ink` | `#0b1f3a` | Primary text, headings, dark surfaces (nav logo, footer) |
| `ink-secondary` | `#334155` | University names, secondary text |
| `ink-tertiary` | `#475569` | Nav links, supporting body text |
| `muted` | `#64748b` | Metadata, labels, captions |
| `slate-light` | `#94a3b8` | Data-cell labels, placeholder text |
| `primary` | `#1d4ed8` | Academic blue — CTAs, links, active state |
| `primary-hover` | `#1e40af` | Primary button hover |
| `primary-surface` | `#eff4ff` | Light blue background — level badges, filter chips |
| `primary-border` | `#dbe4ff` | Border for primary-surface elements |
| `verified` | `#047857` | Green — verified status, scholarship availability |
| `verified-surface` | `#ecfdf5` | Light green background |
| `verified-border` | `#a7f3d0` | Green border |
| `deadline` | `#b45309` | Amber — deadline urgency only |
| `deadline-surface` | `#fffbeb` | Light amber background |
| `deadline-border` | `#fcd9a5` | Amber border |
| `edge` | `#e2e8f0` | Standard card / component border |
| `edge-subtle` | `#eef2f7` | Inner dividers, data-row separators |

### Font tokens

| Token | Value | Use |
|-------|-------|-----|
| `font-sans` | IBM Plex Sans, system-ui... | All body and UI text |
| `font-mono` | IBM Plex Mono, ui-monospace... | Monogram marks, code, compact labels |

IBM Plex Sans and IBM Plex Mono are loaded from Google Fonts via `<link>` tags in `src/layouts/BaseLayout.astro`. The `body { font-family: var(--font-sans); }` base style ensures all text uses IBM Plex Sans by default.

---

## Component primitives

All primitives live in `src/components/ui/`. They are Astro components with typed props.

### Container

`src/components/ui/Container.astro`

Page-width shell. Accepts `width` prop:

| Width | Max-width | Use |
|-------|-----------|-----|
| `narrow` | 48rem (768px) | Articles, single-column forms |
| `default` | 64rem (1024px) | Standard page content |
| `wide` | 1200px | Reference-matched homepage / listing pages |
| `xl` | 80rem (1280px) | Reserved for very wide layouts |

**Phase 55C:** Use `width="wide"` for all homepage and listing-page sections to match the 1200px reference.

### Section

`src/components/ui/Section.astro`

Semantic `<section>` with Container and vertical rhythm (`py-10 sm:py-12`). Accepts `tone` (`canvas` / `surface`) and `width`.

### SectionHeader

`src/components/ui/SectionHeader.astro`

Eyebrow label + heading (h2/h3) + optional "View all →" link. Always use this for section headings — never raw `<h2>` inside sections.

### Button

`src/components/ui/Button.astro`

Renders `<a>` when `href` is provided, `<button>` otherwise.

| Variant | Use |
|---------|-----|
| `primary` | Main CTA — "Get started", "Search", "Find my matches" |
| `secondary` | Outline — secondary actions |
| `ghost` | Subtle — filter controls, secondary links styled as button |
| `soft` | Light blue fill — "More filters", secondary CTAs on white surfaces |

| Size | Use |
|------|-----|
| `sm` | Navigation, compact contexts |
| `md` | Default |
| `lg` | Hero CTAs |

### Badge

`src/components/ui/Badge.astro`

Inline data label. Default shape is `rounded-md` (rectangular). Pass `class="rounded-full"` override for pill/chip shape.

| Variant | Use |
|---------|-----|
| `level` | Degree level — MSc, BSc, MA (blue, bordered, uppercase) |
| `verified` | Verified source status (green border, white bg) |
| `scholarship` | Scholarship availability (green border, green bg) |
| `deadline` | Deadline urgency (amber, bordered) |
| `neutral` | Neutral descriptor labels |
| `info` | Informational inline tags |

**Note:** `verified` and `scholarship` use the same green color system but `verified` has white (`surface`) background while `scholarship` has `verified-surface` background — matching the reference.

### Card

`src/components/ui/Card.astro`

White surface with thin border and hover state. Renders `<a>` when `href` is provided. Used as the base for DestinationCard, GuideCard.

---

## Public card components

### ProgramCard (full anatomy)

`src/components/public/cards/ProgramCard.astro`

The primary program listing card. Matches the Phase 55A locked design reference anatomy exactly.

**Required props:** `href`, `title`

**Optional extended props** (all default to null/false):

| Prop | Type | Description |
|------|------|-------------|
| `monogram` | string | University initials (auto-computed from `universityName` if omitted) |
| `degreeLevel` | string | Abbreviated level badge, e.g. "MSc" |
| `field` | string | Subject/field label |
| `universityName` | string | University display name |
| `universityHref` | string | University detail page URL |
| `countryCode` | string | ISO country code, e.g. "NL" |
| `location` | string | City + country, e.g. "Amsterdam, Netherlands" |
| `duration` | string | e.g. "24 months" |
| `language` | string | e.g. "English" |
| `intake` | string | Start date, e.g. "Sep 2026" |
| `deadline` | string | e.g. "15 Oct 2026" |
| `deadlineSoon` | boolean | Colors deadline text amber |
| `deadlineNote` | string | Short urgency note shown as amber badge |
| `scholarshipAvailable` | boolean | Shows green scholarship badge |
| `verified` | boolean | Shows verified checkmark badge |
| `sourceChecked` | string | Shows "Source checked · date" indicator |
| `tuitionDisplay` | string | Formatted tuition, e.g. "€15,300" |
| `tuitionPer` | string | Period label, default "per year" |
| `saved` | boolean | Renders Save button in active/filled state |
| `comparing` | boolean | Renders Compare button active + adds blue ring to card |

**Save/Compare interactivity:** The buttons render with correct visual state from props but have no `onclick` handlers in Phase 55B. JavaScript interactivity for save/compare will be wired in Phase 55C.

**Interaction states (CSS-only):**
- Default: `border-edge` + soft shadow
- Hover: `translateY(-2px)` + deeper shadow + `border-[#cbd5e1]`
- Compare selected: `border-primary` + blue glow ring

### DestinationCard

`src/components/public/cards/DestinationCard.astro`

Country/destination card with optional program/scholarship counts.

### ScholarshipRow

`src/components/public/cards/ScholarshipRow.astro`

Scholarship list row with name, provider/amount, and deadline badge.

### GuideCard

`src/components/public/cards/GuideCard.astro`

Study guide card with category badge, date, and 2-line title.

---

## Search / filter UI

### SearchField

`src/components/public/SearchField.astro`

Labeled input or select field. Use for search toolbar fields and filter inputs.

### SearchChip

`src/components/public/SearchChip.astro`

Link-based quick-filter chip. Use for subject/destination quick picks below the search bar.

### FitFinderMiniPanel

`src/components/public/FitFinderMiniPanel.astro`

Static navy-surface panel linking to the Fit Finder flow. Link-driven, no JS/island.

---

## Public layout shell

### PublicLayout

`src/layouts/PublicLayout.astro`

Wraps all public pages: `bg-canvas text-ink` with flex-col min-h-screen. Includes PublicNav and PublicFooter.

### PublicNav

`src/components/public/PublicNav.astro`

Sticky header with:
- Navy square logo mark (IBM Plex Mono "D")
- Primary nav links (hidden on mobile)
- Sign in / Get started for logged-out users
- Dashboard / Sign out for logged-in users
- 66px fixed height, backdrop blur, `bg-white/92`

### PublicFooter

`src/components/public/PublicFooter.astro`

Dark navy (`bg-ink`) multi-column footer with:
- Logo + tagline + "Program data re-checked weekly" trust badge
- Explore / Learn / Account link columns
- Copyright + Privacy / Terms / Disclaimer bottom row

---

## Usage rules

1. Always import from `src/components/ui/` or `src/components/public/` — never re-implement primitives inline.
2. Always use `SectionHeader` for section headings — not raw `<h2>`.
3. Always use `Container width="wide"` for homepage and listing-page sections (1200px reference width).
4. Never use arbitrary colors not in the token set — if a color is needed, add it to `global.css @theme`.
5. Never use purple as a semantic color — it is not in the design system.
6. Never add decorative illustrations, blob shapes, or heavy icons not in the reference.
7. Badge `level` variant is for degree levels only (uppercase, blue). Do not repurpose it for other labels.
8. Badge `verified` and `scholarship` are semantic signals — only use them when data supports the claim.
9. The `deadline` color token (amber) is reserved for deadline urgency only — not for generic warnings.
10. Save/Compare buttons in ProgramCard are visual placeholders until Phase 55C wires JS interactivity.

---

## What not to do

- Do not redesign from scratch — use the locked design references.
- Do not make public pages look like a SaaS dashboard, agency site, or AI product.
- Do not introduce new npm dependencies for UI (primitives are Astro-native).
- Do not add `onClick` handlers or client-side state to ProgramCard until Phase 55C.
- Do not use `set:html` or `innerHTML` in any component.
- Do not change token values without a documented reason.
- Do not use arbitrary pixel values that are not in the reference — prefer token-based utilities.

---

## What Phase 55C should do

Phase 55C (Homepage Redesign Implementation) should:

1. Rewrite `src/pages/index.astro` to compose the Phase 55B components:
   - Hero section with H1 and main search module
   - FitFinderMiniPanel (full-width version)
   - Featured programs section using `ProgramCard` with real data
   - Browse by study goal section using subject chips
   - Popular destinations section using `DestinationCard`
   - Scholarships section using `ScholarshipRow`
   - Secondary Fit Finder CTA
   - Study guides section using `GuideCard`
2. Wire real database queries for each homepage section.
3. Use `Section width="wide"` for all sections (1200px container).
4. Add JavaScript interactivity to Save/Compare buttons on ProgramCard.
5. Implement the two-column search/listing layout (filter rail + results column).
