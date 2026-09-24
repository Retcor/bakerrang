---
name: BakerRang Consumer Ecosystem
description: A charcoal-and-gold maker's workbench index for a family of small, sharp consumer tools.
colors:
  gold: "#FFD500"
  gold-hover: "#F0C400"
  gold-press: "#DDBA00"
  gold-text: "#FFD500"
  ink-on-gold: "#1a1a1a"
  bg: "#161514"
  bg-2: "#1c1b1a"
  plane: "#201f1d"
  plane-2: "#262523"
  line: "rgba(255,255,255,0.10)"
  line-strong: "rgba(255,255,255,0.18)"
  ink: "#f2efe9"
  ink-2: "#c3bfb6"
  ink-3: "#928d83"
  danger: "#E88A8A"
  danger-deep: "#C0362B"
  accent-story: "#F08A5D"
  accent-poly: "#58C0C9"
  accent-sign: "#B79CE0"
  accent-budget: "#7FB0E8"
  accent-wow: "#D69A4C"
  accent-pass: "#AEB8C2"
  accent-account: "#A5A59C"
  desk: "#161514"
  desk-2: "#1c1b1a"
  page: "#1f1c19"
  page-2: "#282420"
  page-line: "rgba(255,238,215,0.09)"
  page-ink: "#ece4d8"
  page-ink-2: "#c2b8aa"
  page-ink-3: "#978d80"
  page-dim: "#8a8174"
typography:
  display:
    fontFamily: "Archivo Expanded, Archivo, sans-serif"
    fontSize: "clamp(2.6rem, 6.2vw, 5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Archivo Expanded, Archivo, sans-serif"
    fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Archivo Expanded, Archivo, sans-serif"
    fontSize: "1.18rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Archivo, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.14em"
  story-body:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(16.5px, calc(var(--h) * 0.0265), 21.5px)"
    fontWeight: 400
    lineHeight: 1.62
    fontVariation: "'opsz' 16"
  story-title:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "calc(var(--h) * 0.052)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.015em"
    fontVariation: "'opsz' 60"
  masthead:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(2.3rem, 5vw, 3.3rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 72"
  folio:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "13px"
    fontWeight: 500
    fontFeature: "'onum'"
rounded:
  control-inner: "3px"
  control: "4px"
  panel: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "22px"
  gutter: "clamp(1rem, 4vw, 2.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink-on-gold}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
    textColor: "{colors.ink-on-gold}"
  button-primary-active:
    backgroundColor: "{colors.gold-press}"
    textColor: "{colors.ink-on-gold}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.plane}"
    textColor: "{colors.ink}"
  chip:
    backgroundColor: "{colors.bg-2}"
    textColor: "{colors.ink-2}"
    rounded: "3px"
    padding: "3px 8px"
  directory-row:
    backgroundColor: "{colors.plane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "1.05rem 1rem"
  vault:
    backgroundColor: "{colors.plane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "1.5rem 1.4rem"
  leaf:
    backgroundColor: "{colors.page}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.panel}"
    padding: "clamp(28px, 5vw, 64px) clamp(20px, 5vw, 68px)"
  spread:
    backgroundColor: "{colors.page}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.panel}"
    height: "min(820px, calc(100dvh - 152px), calc((100vw - 200px) / 1.42))"
  plate:
    backgroundColor: "{colors.page-2}"
    rounded: "{rounded.control-inner}"
    width: "min(100%, calc(var(--h) * 0.66))"
  contents-entry:
    backgroundColor: "transparent"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.control}"
    padding: "16px 10px"
  contents-entry-hover:
    backgroundColor: "{colors.page-2}"
    textColor: "{colors.page-ink}"
  reading-bar:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.ink-2}"
    height: "56px"
---

# Design System: BakerRang Consumer Ecosystem

## Overview

**Creative North Star: "The Maker's Workbench Index"**

BakerRang's consumer front door is a matched tool kit laid out as a printed directory: a workshop
of small, sharp tools from one maker, indexed with editorial and signage discipline. It is warm and
distinctive but modern and restrained — not literal skeuomorphism. There is no wood, no pegboard, no
screws, no taped labels. The workbench character comes entirely from precision: exact alignment,
hairline rules, tactile-but-quiet controls, small machined radii, and one shared drawing hand across
every tool emblem so the set reads as a matched kit rather than a grab-bag of stock icons.

This is the **shared consumer world**, reused across the launcher and every future per-product app.
Family resemblance lives in the foundations documented here — charcoal ground, reserved gold,
Archivo/Archivo Expanded, flat planes and 1px rules — while each product keeps its own muted accent
and its own drawn emblem. It is deliberately distinct from the platform's "Business Workshop" world;
do not cross-pollinate tokens between the two. Dark is the signature, default front-door look; a
fully designed warm light mode is a first-class peer, not an afterthought.

The world explicitly refuses the category default: the AI-app hero-over-a-uniform-grid-of-cards. It
rejects glassmorphism, ambient gradients, interchangeable cards, card-in-card nesting,
pills-everywhere, oversized vague heroes, repetitive icon+heading+subtitle blocks, and stat-grid
dashboards. Depth is real but quiet — offset+blur shadows, never blur/glass.

**Key Characteristics:**
- Charcoal ground with gold reserved to the brand mark and the single primary action.
- Directory/index rows with distinct drawn SVG emblems, never a uniform card grid.
- Archivo Expanded signage headings over Archivo body, tight and confident.
- Flat planes separated by 1px rules and restrained real shadows; no glass, no gradients.
- Per-tool muted accent, one shared emblem stroke weight; a matched tool kit.
- Small machined radii (4px controls, 8px panels); light/dark/system all first-class.

## Colors

A charcoal ground carrying warm off-white ink, with a single saturated gold held in reserve and a
palette of muted per-tool accents that appear only on each tool's own drawn emblem and hover.

### Primary
- **Signal Gold** (`#FFD500`): The reserved brand accent. Used as a *fill* on the BakerRang logo
  mark and the single primary action (Sign in / Open your tools), plus `::selection` and the focus
  ring. Hover `#F0C400`, press `#DDBA00`. It may additionally carry **one rare, intentional
  brand-emphasis moment** per surface (the masthead accentword). Never a broad surface fill, never a
  decorative wash.
- **Gold Text** (`#FFD500` on dark; `#8a6300` deep-gold on light): The legible-per-theme accent for
  accent *text*, icon strokes, the focus outline, and the sanctioned brand-emphasis headline word.
  On light backgrounds bright gold is illegible, so accent text shifts to deep amber — a separate
  token from the gold fill on purpose.
- **Danger** (`#E88A8A`): The one semantic warning color, for destructive actions only (e.g. Sign
  out); never decorative.
- **Ink on Gold** (`#1a1a1a`): The dark text/glyph color placed on any gold fill. Text on gold is
  always this dark ink, never white.

### Secondary (per-tool accents)
Each product owns one muted accent, applied only to its drawn emblem tile and its hover affordances
(the row arrow, chip border on hover, vault border). Never used as confetti, never neon. Dark-mode
values (light-mode values in parens):
- **Story** `#F08A5D` (`#C25A34`) · **Polyglot** `#58C0C9` (`#1f7d86`) · **Sign** `#B79CE0`
  (`#6E4FB4`) · **Budget** `#7FB0E8` (`#235f9e`) · **WoW** `#D69A4C` (`#8a5c15`) · **Passwords**
  `#AEB8C2` (`#4d5867`) · **Account** `#A5A59C` (`#63625a`). *(Six tool accents + Account; the
  retired Supermarket accent has been removed.)*

### Neutral
- **Ground** (`#161514` dark / `#efece6` light): The page background; the charcoal is the world.
- **Ground 2** (`#1c1b1a` / `#e7e3db`): Recessed bands (ecosystem strip) and emblem tile fills.
- **Plane** (`#201f1d` / `#ffffff`): Raised surfaces — bench, hovered rows, vault, popovers, menus.
- **Plane 2** (`#262523` / `#f6f4ef`): The nested step above Plane (segmented-control active pill,
  menu-item hover, switcher cell hover).
- **Line** (`rgba(255,255,255,0.10)` / `rgba(20,18,16,0.12)`): The default hairline rule and border.
- **Line Strong** (`rgba(255,255,255,0.18)` / `rgba(20,18,16,0.22)`): Stronger dividers, ghost-button
  and avatar borders, scrollbar thumb.
- **Ink / Ink-2 / Ink-3** (`#f2efe9` / `#c3bfb6` / `#928d83` on dark): Primary text, secondary/body
  copy, and muted labels/captions respectively.

### Named Rules
**The Reserved Gold Rule.** Gold is reserved for BakerRang identity, the primary action/focus, and
**rare intentional brand emphasis** — never general decoration. On the launcher that brand-emphasis
use is the masthead accentword ("Variety of Tools."), set in `--gold-text` (bright gold on dark,
deep amber `#8a6300` on light). Beyond the logo mark, the single primary button, `::selection`,
focus, and that one deliberate headline moment, gold does not appear; two competing gold fills, or
gold as a wash, is still wrong.

**The Dark-Ink-on-Gold Rule.** Any element sitting on a gold fill uses `#1a1a1a` ink, never white.

**The One-Accent-Per-Tool Rule.** A product's accent appears only on its own emblem and hover state.
Accents never mix on one surface and never tint text, backgrounds, or borders wider than 1px.

## Typography

**Display Font:** Archivo Expanded (with Archivo, sans-serif fallback)
**Body Font:** Archivo (with system-ui, sans-serif fallback)

**Character:** An industrial-editorial grotesque system. Archivo Expanded, heavy and tightly tracked,
does signage and naming; Archivo carries all body and UI text, set slightly tight (`-0.01em`) for a
precise, engineered feel. Strong scale and weight steps do the structural work that decoration does
not.

### Hierarchy
- **Display** (800, `clamp(2.6rem, 6.2vw, 5rem)`, line-height 0.98, tracking `-0.035em`): Archivo
  Expanded. The masthead statement of what BakerRang is.
- **Headline** (800, `clamp(1.9rem, 3.4vw, 2.8rem)`): Archivo Expanded. Section mastheads ("What's on
  the bench").
- **Title** (700, `1.18rem`, tracking `-0.02em`; flagship rows `1.34rem`, vault `1.3rem`): Archivo
  Expanded. Tool names in directory rows and the vault.
- **Body** (400, `16px`, line-height 1.55, tracking `-0.01em`): Archivo. Leads, descriptions, copy.
  Leads cap around 46ch; section subheads around 34ch.
- **Label** (700, `0.82rem`, uppercase, tracking `0.14em`): Archivo. Group titles with a trailing
  1px rule. Smaller eyebrow labels (bench label, `pop__head`) run 11px, uppercase, tracking
  `0.08–0.12em`, in Ink-3.

### Named Rules
**The Expanded-for-Naming Rule.** Archivo Expanded is reserved for the wordmark, mastheads, and tool
names. Body, descriptions, chips, and controls are always plain Archivo; never set a paragraph in the
expanded face.

*Scoped exception:* inside Story Book content only, **The Literata-for-Story Rule** (see Product
layer: Story Book) sets story text, story titles and Story Book mastheads in Literata. The rule above
is otherwise unchanged, and it still governs every Story Book control and the "Story Book" wordmark.

## Layout

A single centered column, max-width 1200px, with a fluid gutter (`clamp(1rem, 4vw, 2.5rem)`). The
masthead is a two-column grid (`1.05fr .95fr`): copy + primary action on the left, the signature
"bench" collection object on the right. The tools directory is grouped by job ("Make & learn",
"Manage day to day", "Play", "Keep safe", "Your account"), each group a stack of full-width rows
rather than a card grid. A recessed three-up ecosystem band sits on Ground-2 between rules.

Rhythm is built from an 8px-derived spacing set (4 / 8 / 16 / 22px) plus fluid section padding
(`clamp` values). Responsive: at 900px the masthead and ecosystem band collapse to one column (the
bench moves below the copy) and the section head left-aligns; at 640px the top-bar sign-in becomes a
compact "Sign in" label, theme-control labels hide to icons, rows tighten their emblem column, and
the vault drops its trailing arrow; at 430px the wordmark hides entirely and the BakerRang logo mark
carries the brand alone.

## Elevation & Depth

Hybrid, but quiet: surfaces are flat charcoal planes separated by 1px rules, with **restrained real
shadows** (offset + blur) used structurally on genuinely raised objects — never glass, never blur,
never ambient gradients. Depth is read primarily from the tonal step between Ground → Plane → Plane-2
and from hairline rules, with shadow as a secondary cue on the bench, the vault, popovers, and
hovered rows.

### Shadow Vocabulary
- **Resting elevation** (`box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.35)` dark /
  `0 1px 2px rgba(30,26,20,.10), 0 12px 28px rgba(30,26,20,.10)` light): The bench, the vault,
  popovers/menus, and the review chrome.
- **Contact shadow** (`box-shadow: 0 1px 2px rgba(0,0,0,.4)` dark / `…,.10` light): The
  segmented-control active pill and the subtle lift a directory row gains on hover.

### Named Rules
**The No-Glass Rule.** Depth is tonal planes + 1px rules + offset/blur shadow. Never
`backdrop-filter`, translucency-as-material, or gradient fills to fake elevation.

**The Flat-At-Rest Rule.** Directory rows are borderless (with only a bottom hairline) until hovered,
when they gain a Plane background, a full 1px border, a 2px translateX nudge, and the contact shadow.

## Shapes

Small machined radii throughout: **4px on controls** (buttons, icon buttons, avatar, chips at 3px,
segmented control, emblem tiles) and **8px on panels** (bench, directory rows, vault, popovers).
Nothing is pill-shaped and nothing is sharp-cornered — the radius is a consistent, engineered detail.
Borders are hairline (1px `--line`) by default, stepping to `--line-strong` for stronger dividers and
the vault; emblem tiles use a `color-mix` tint of the tool accent for fill (~12–14%) and border
(~30–34%). Drawn SVG emblems all share one 1.75 stroke weight so the six tools read as one matched
kit. No colored border ever exceeds 1px.

## Components

### Buttons
- **Shape:** Machined 4px radius (`--r`); 10px/16px padding, Archivo 600/14px, `-0.01em` tracking.
- **Primary (gold):** Signal Gold fill with Ink-on-Gold text; hover `#F0C400`, active `#DDBA00` plus
  a 1px translateY press. This is the *only* gold fill on the surface. The Google mark inside it is
  drawn in Ink-on-Gold, not full color.
- **Ghost / secondary:** Transparent with a `--line-strong` border and Ink text; hover fills to Plane.
- **Small:** 7px/12px padding, 13px text (`.btn--sm`).

### Chips
- **Style:** Ground-2 background, Ink-2 text, 1px `--line-strong` border, 3px radius, 11px/600 Archivo.
- **Variants:** A static metadata pair chip (tabular-nums, e.g. "EN ⇄ ES") and an actionable
  `chip--go` (e.g. "Instant mode") whose border and text take the row's accent on hover.

### Directory Rows (signature)
- **Character:** A printed-index entry, not a card. `60px emblem / 1fr / auto` grid.
- **Corner / border:** 8px radius; transparent border with only a bottom hairline at rest (last row in
  a group drops it).
- **Hover:** Plane background, full 1px border, +2px translateX, contact shadow; the trailing arrow and
  its motion take the tool accent.
- **Emblem tile:** 52px (flagship 58px), 4px radius, accent `color-mix` fill + border, accent-stroked
  drawn SVG. Flagship rows (`row--lg`, the Make & learn tools) sit taller with larger names.

### Vault (signature, high-trust)
- **Character:** A distinct, sturdier module for the zero-knowledge Passwords product — visibly more
  serious than a row. `64px / 1fr / auto` grid, 8px radius, Plane background, `--line-strong` border,
  resting shadow, always present (not hover-summoned).
- **Detail:** Passwords accent (`#AEB8C2`), a `Zero-knowledge` secure tag (accent text + accent 1px
  border) beside the Expanded name, and a masked `••••••••` dot string in the accent.

### Segmented Control (theme)
- **Style:** Inline Plane track, 1px `--line`, 4px radius, 3px inner padding; buttons are 600/12px
  Ink-3. The pressed segment (`aria-pressed="true"`) gets a Plane-2 pill, Ink text, and the contact
  shadow. Carries light / dark / system with inline icons; labels collapse to icon-only at 640px.

### Navigation (top bar + menus)
- **Top bar:** Sticky, Ground background, 64px tall (58px on mobile), single bottom hairline. Left =
  BakerRang logo mark + Expanded wordmark; right = theme control and either the gold Sign in (signed out) or
  the waffle app-switcher + avatar menu (signed in).
- **App switcher:** A 3-column grid popover of tool cells, each a drawn accent emblem over an
  Archivo 600/11.5px label; cell hover fills to Plane-2.
- **Menus / popovers:** Plane background, `--line-strong` border, 8px radius, resting shadow; items
  are 500/14px Ink-2 filling to Plane-2 on hover, with a `pop__danger` red variant for Sign out.
- **Avatar / icon button:** 38px, 4px radius, Plane background with a 1px border that strengthens on
  hover; the focus ring is the gold 2px outline with 3px offset.

## Do's and Don'ts

### Do:
- **Do** keep gold to the brand mark and the single primary action (plus `::selection` and focus). One
  gold fill per surface, maximum.
- **Do** use dark ink (`#1a1a1a`) on every gold fill, never white.
- **Do** give each product one muted accent, expressed only on its drawn emblem and hover.
- **Do** build tool lists as full-width directory rows grouped by job, with drawn emblems.
- **Do** convey depth with tonal planes + 1px rules + restrained offset/blur shadow.
- **Do** treat dark as the signature default and light as a fully designed peer; support system too.
- **Do** hide the wordmark below 430px and let the BakerRang logo mark carry the brand.
- **Do** draw every icon as an SVG on the shared 1.75 stroke weight.

### Don't:
- **Don't** use glassmorphism, `backdrop-filter`, ambient/arbitrary gradients, or translucency-as-material.
- **Don't** render tools as a uniform grid of icon+title+subtitle cards, or nest card-in-card.
- **Don't** spread pills everywhere, build stat-grid dashboards, or ship oversized vague heroes.
- **Don't** color a card border wider than 1px, or tint text/backgrounds with a tool accent.
- **Don't** use emoji as icons or a system display face; use drawn SVG and Archivo Expanded.
- **Don't** let the launcher become a dashboard/widget console — it is a front door and index.
- **Don't** introduce literal skeuomorphism (wood, pegboard, screws, taped labels).

## Product layer: Story Book

Applies **only** inside the Story Book app (`web/apps/storybook`, storybook.bakerrang.com).
Everything above still holds there. Story Book adds a **reading layer**: the story is read as an
open book laid on the shared desk. Book-ness comes from proportion, gutter, folio, running head and
serif text, never from texture. There is no leather, no paper grain, no page curl. Evidence:
`web/.impeccable/mocks/storybook-comp.html`. Direction: `web/.impeccable/surfaces/storybook.md`.

### Colors

- **Desk** (`#161514` dark / `#e6e1d8` light) and **Desk 2** (`#1c1b1a` / `#ddd7cc`): the ground the
  pages lie on. In dark mode the desk *is* the world Ground. In light mode Story Book deliberately
  darkens it from the world's `#efece6` to a warmer, deeper `#e6e1d8` so a white page reads as a
  sheet. **Story Book only.** The launcher and every other app keep `#efece6`.
- **Page** (`#1f1c19` / `#ffffff`): the page plane of the leaf and the spread. It is a tonal step
  above the dark desk and pure white on the light desk.
- **Page 2** (`#282420` / `#f7f4ee`): recessed fills on the page, such as plate, thumbnail and
  slot backgrounds, contents-entry hover, skeleton bars, and the ghost-button hover in end matter.
- **Page Line** (`rgba(255,238,215,0.09)` / `rgba(40,30,20,0.11)`): hairlines drawn on the page:
  the gutter, the contents rule and entry dividers, plate rings, and the step list.
- **Page Ink / Page Ink 2 / Page Ink 3** (`#ece4d8` / `#c2b8aa` / `#978d80` dark;
  `#221e19` / `#51493f` / `#756b5f` light): story text, secondary text (first lines, captions) and
  muted text (folios, running heads, meta, placeholders).
- **Page Dim** (`#8a8174` / `#8c8274`): the colour of the not-yet-spoken text while a page is read
  aloud. The current chunk returns to Page Ink.

**The Reading Layer Rule.** Pages are a product-scoped tonal plane over the shared desk. Only the
leaf (library contents) and the spread (reader, compose, welcome) carry Page colours and Page Ink.
Chrome stays on the world's desk, plane and ink tokens: bars, menus, dialogs, turn buttons and the
page rule. A control that sits *on* the page swaps its hairline and hover to Page Line and Page 2.

**The Ember Marker Rule.** Story Ember (`#F08A5D` dark / `#C25A34` light) has exactly three roles:
the drawn Story Book emblem (including the emblem in the empty and compose-idle states), the ribbon
"you stopped here" marker, and hover affordances. It never sets text, never fills a surface or a
button, and never draws a border wider than 1px. The 9x22px ribbon is the only solid ember mark.

**The One Gold Action Still Rule.** Gold remains one primary action per surface. Examples are
"Begin a new story", "Write the story", "Sign in with Google" and "Try again". On phones the
library's gold action moves into a fixed bottom bar. It moves; it is never duplicated. Focus on the
compose field is a `--gold-text` underline, which is the world's focus role and not a second action.

### Typography

**Story Font:** Literata (Georgia, serif fallback), self-hosted OFL with the optical-size axis.
Weights are roman 400/500/600 and italic 400. The font ships inside `apps/storybook`.

**The Literata-for-Story Rule.** This is a named, explicit exception to The Expanded-for-Naming
Rule, and it applies to Story Book content only. Literata sets:
- story text;
- story titles: the recto heading, contents-entry titles, the inline rename field, the quoted title
  in the delete dialog, and the italic running title in the reading bar;
- Story Book mastheads: the "Stories" contents title, the welcome headline, the compose heading and
  the not-found heading.

The app wordmark "Story Book" stays Archivo Expanded. Every control, button, menu, label, meta line,
byline, step and running head stays Archivo. Literata never appears outside Story Book content.

- **Masthead** (600, `clamp(2.3rem, 5vw, 3.3rem)`, lh 1, `-0.02em`, opsz 72): the contents title.
  The welcome headline uses the same face at `h x 0.07` (34px on phone).
- **Story Title** (600, `h x 0.052`, lh 1.08, `-0.015em`, opsz 60; 30px on phone): the recto
  heading on page one and the compose heading.
- **Story Body** (400, `clamp(16.5px, h x 0.0265, 21.5px)`, lh 1.62, opsz 16; 19px on phone):
  recto story text. Hyphenated with `text-wrap: pretty`, sized to fit the recto measure.
- **Contents entry:** the title is 600 `1.22rem` (`1.1rem` on phone, clamped to 2 lines). The first
  line is 400 `1rem` Literata in Page Ink 2 and is hidden on phone. Meta is Archivo 500 13px,
  tabular, in Page Ink 3.
- **Folio** (500, 13px, old-style numerals, Page Ink 3): at the foot of each page, aligned to the
  outer edge, and centred on phone.
- **Running head:** the world Label style (Archivo 600, 11px, `0.14em`, uppercase, Page Ink 3)
  carrying the story's title. On the recto it is right-aligned. It is blank on page one and hidden
  on phone.
- **Italic Literata** is used for the reading-bar running title, the quoted idea, the compose
  placeholder, the typographic plate numeral and the "The end" mark.

### Layout

- **Reading bar:** 56px, sticky, on the desk with a hairline. It holds ← Stories, the running title
  (centred, italic Literata), Read aloud, the story menu, the switcher and the avatar. The direction
  contract said 52px, but the built value is 56px and the build wins.
- **App bar:** the library, compose and welcome screens use a 60px bar.
- **Reader stage:** a `76px / 1fr / 76px` grid. The page-turn buttons are 48px, 4px radius, and sit
  in the desk margins.
- **Spread:** height-fitted to the viewport (≤ 820px) at a ~1.42:1 ratio (width = `h x 1.42`),
  laid out as verso `1fr` / gutter `1px` / recto `1fr`. Page padding is proportional to height
  (`7.5% / 7% / 5.5%` of `h`). The verso plate is square at up to `h x 0.66`. A segmented page rule
  sits under the spread (34px segments, 3px bars, the current segment in Ink).
- **Library:** a single contents leaf, max 860px, centred on the desk.
- **Below 1000px:** the spread becomes one column. The plate goes full-bleed, then the text; the
  gutter, running heads and page rule drop out. The body takes the page colour, so the page becomes
  the screen. The reading bar hides on scroll, and a fixed bottom **page bar** (‹ folio › · Read
  aloud) appears with 48px turn targets inside the safe-area insets.
- **Below 640px:** the library leaf goes full-bleed and the gold action moves to the fixed bottom
  bar.

### Elevation & Depth

The leaf and the spread lie on the desk with the world's resting shadow and lose it when they go
full-bleed on phone. Plates, thumbnails and slots are outlined by a 1px Page Line ring
(`box-shadow: 0 0 0 1px`), not a drop shadow.

**The Rule-Not-Fold Gutter Rule.** The gutter is a single 1px Page Line rule. There is no fold
shading, no gradient, no page curl and no spine.

### Shapes

The spread and the leaf use the 8px panel radius. Plates, thumbnails, generation slots and
skeleton bars use the 3px inner radius. Contents entries and in-page status boxes use the 4px
control radius. On phone the spread and the plate go to 0 radius because they are full-bleed.

### Components

- **Spread:** the flagship reading object, described in Layout. The verso holds the plate and the
  recto holds the text, each with a running head and folio. Page turns slide the page content 14px
  over `.26s` (reduced motion is honoured; the running head stays still).
- **Plate:** a square picture with a 3px radius and a Page Line ring on Page 2. If a page's picture
  fails, the **typographic plate** replaces the broken image: a large italic Literata folio at
  `h x 0.22`, opsz 72 and 50% opacity, the title in italic, and a short Archivo caption.
- **Contents Entry:** a table-of-contents line on the leaf, laid out as a `64px / 1fr / auto` grid
  (52px on phone). It shows a thumbnail, the Literata title, a dotted leader to the Archivo meta
  (pages · date), and the first line beneath. There is a Page Line divider at rest; hover fills to
  Page 2. The whole row is one link, with a kebab menu above it. Rename happens inline in the same
  row.
- **Ribbon:** a 9x22px Story Ember bookmark with a notched foot, hanging from the top edge of an
  entry's thumbnail when a story was left mid-way.
- **Compose recto:** the idea field is a Literata textarea with only a bottom hairline, which turns
  into a gold-text underline on focus. Generation is shown as a stepped list (a spinner, then
  done/error) plus a row of square page slots on the verso that fill as each real picture arrives.
- **Narration:** while a page is read aloud, spoken chunks advance, so the unread text is Page Dim
  and the current chunk is Page Ink.

### Do's and Don'ts (Story Book)

- **Do** set story text, story titles and Story Book mastheads in Literata. Keep every control and
  the "Story Book" wordmark in Archivo / Archivo Expanded.
- **Do** keep the light desk `#e6e1d8` scoped to Story Book.
- **Do** draw the gutter as a 1px rule and outline plates with a 1px ring.
- **Don't** use Story Ember as text, as a surface or button fill, or as a wide border. Its only
  roles are the emblem, the ribbon and hover.
- **Don't** add a second gold action to a Story Book surface, including inline rename.
- **Don't** fake the book with texture, fold shading, curls or leather. Proportion, folio, running
  head and serif carry the book.
- **Don't** let Literata or the page tokens leak into the launcher or other consumer apps.
