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
