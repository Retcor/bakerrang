# Site Tools Rail — Visual Refinement Spec (Phase 4.0f)

**Companion to** [`site-tools-rail.html`](./site-tools-rail.html) (interactive comp; review-only state switcher at
top: Launcher · Site tools · Theme · Branding · SEO & social · Header & nav · Footer, plus Desktop/Mobile).

**Status:** design/planning only. No production code in this pass. The 4.0f architecture is LOCKED and preserved:
toolbar owns Save/Publish; Theme/Header/Footer live-preview into the iframe; Branding/SEO preview on Save;
dirty/discard unchanged; Templates & Revision History behavior unchanged; More settings opens the legacy flow.

**Mode:** Operate (a builder tool). Density, scanability, native controls and the real editing scene lead; brand
lives in precise detail, not decoration. Tokens are the portal's own (`packages/ui/src/styles/tokens-portal.css`).

---

## 0. What's actually wrong today (root causes, from the 4.0f source)

1. **Viewport-keyed grids inside a 21 rem rail.** The tool bodies were lifted out of the card layout unchanged, so
   they still use `sm:grid-cols-2` / `sm:grid-cols-3`. Those breakpoints key off **viewport** width, not the rail —
   on a desktop the viewport is wide, so two or three columns get crammed into a ~336 px rail. This is the single
   biggest cause of the "squashed" feel (Theme colours, Theme presets, Branding media, Header brand-display, Footer
   toggles, Footer/Header nav-mode, Header CTA).
2. **No independent rail scroll for an open tool.** In `WebsiteEditorCanvas`, `railOverride` is dropped straight into
   the flex-column `<aside>` with **no scroll container** (only the *default* rail has `flex-1 overflow-y-auto`). A
   tall tool therefore grows the whole page instead of scrolling within the rail, and the Back header scrolls away.
3. **Bulky nav cards.** `NavigationItemsEditor` renders each item as a bordered card with an always-visible label
   input and a full-width Up / Down / Remove button row (~110 px per item). Seven pages ≈ a wall of cards.
4. **A permanently-open launcher block.** The default rail pins a bottom block with three stacked sections (Site
   tools ×5 with subtitles, Full-screen tools ×2, More settings) — ~330–360 px of *always-present* chrome that
   pushes Pages/Sections/inspector editing up and off short viewports.

---

## 1. Recommended launcher interaction

**Recommendation: one compact "Site tools" launcher → a focused Site Tools menu (progressive disclosure).**
See comp states `Launcher` and `Site tools`.

- The default rail footer becomes a **single 52 px "Site tools" row** (icon + label + one-line subtitle + chevron).
  That reclaims the ~330–360 px the three-section block consumed and returns it to Pages/Sections/inspector — the
  common case (editing sections) gets the whole rail height back.
- Tapping it opens a **Site Tools menu as a rail override** (same override slot the tools already use), grouped:
  - **Design & content** — Branding, Theme, Header & navigation, Footer, SEO & social
  - **Full-screen tools** — Templates, Revision history
  - **More settings** (single row → existing legacy flow)
- Picking a tool opens that tool in the rail. Its Back control returns to the **Site Tools menu**; the menu's Back
  returns to section editing. This finally makes the existing "← Site tools" label literally true (today it returns
  to Overview, so the label already promises a destination this design supplies).

**Why not the alternatives:**
- *Collapsible inline groups* — still spends permanent header rows on group labels and keeps all tools in the
  scroll flow competing with sections; smaller space win, and the brief warns against picking collapse by default.
- *Keep it inline, just restyle* — does not solve the vertical-crowding problem the brief calls out.

Progressive disclosure wins on the exact metric the brief sets: **most rail height preserved for section editing,
tools still one obvious tap away.** Discoverability is a single, labelled, always-present entry — Templates and
Revision History remain reachable inside the menu (their canvas-takeover is out of scope here).

**This is the one genuine interaction change in the whole task** (adds a navigation layer + a Back target). It is
explicitly in-scope — the brief asks to redesign the launcher interaction — but flag it for sign-off. Everything
else below is visual/layout only. See §6.

---

## 2. Reusable Site Tool rail anatomy

Every tool (and both menus) uses one shell — a flex column that fills the rail height:

```
┌─ tool (flex column, height:100%, min-h-0) ──────────────┐
│  tool-head   ← STICKY, blur, border-b                   │
│    ‹ Back (to Site tools / Editing)                     │  ~68–80 px
│    <h2> Tool title </h2>                                │
│    <p>  one-line description </p>                       │
├─────────────────────────────────────────────────────────┤
│  tool-body   ← flex-1, min-h-0, overflow-y-auto         │
│    · group (kicker label + full-width controls)         │  scrolls
│    · group …                                            │  independently
│    · [inline secondary action, e.g. "Preview Home"]     │
└─────────────────────────────────────────────────────────┘
        Save is NOT here — it lives in the fixed toolbar.
```

Rules (all five tools obey them):
- **Persistent compact Back header**, sticky at the top of the rail; easy to reach at any scroll position.
- **Tool title + short description**, no uppercase kicker above the title (the rail drops the card's `SITE SETUP`
  eyebrow — the heading carries itself).
- **Full-width, rail-native controls.** No `sm:`/`xl:` multi-column grids inside the rail. The primitives:
  - **Segmented control** for 2–3 mutually-exclusive short options (Brand display, Corner style, Content width,
    Section spacing, CTA destination-ish enums).
  - **Stacked option rows** (radio dot + label + sub) when options need a one-line description (Footer nav mode).
  - **Toggle switch rows** for booleans (Footer visibility flags, Header "Show CTA", SEO noindex).
  - **Single-column stacked** inputs/selects/textarea; counters right-aligned under the field.
  - **Color rows** — one per line: swatch + name + hex, hairline between (not a 2-col grid).
  - **Preset / menu / media-chip rows** — full-width horizontal rows, never nested bordered cards.
- **No nested desktop cards, no horizontal overflow, no side-by-side controls that cramp.**
- **Groups** are separated by a small uppercase kicker + generous top margin (more space above a group label than
  below it), not by boxing each group in a card.

---

## 3. Scrolling behavior (explicit)

The builder is a fixed-height app shell; the **page never scrolls to reveal tool content**.

- Toolbar: fixed. Preview canvas: its own `overflow-auto`, stays visible and dominant.
- Rail `<aside>` is already `flex min-h-0 flex-col`. **Whatever fills the override slot must be `flex-1 min-h-0`
  with its own sticky header + `flex-1 overflow-y-auto` body.** That is the load-bearing change: today the override
  has no scroll region, so tall tools grow the page and the Back header scrolls off.
- Result (proven in the comp, Header & navigation state): with 7 nav rows + CTA config the **rail body scrolls
  internally**, the Back header stays pinned, and the toolbar Save + preview never move. Scroll to the bottom
  reveals the CTA fields and "Preview Home" without the page moving.
- **Themed scroll surfaces:** custom thin scrollbar tinted from `--border-strong`, focus rings from `--focus`,
  selection from `--brand-subtle`. (Cheap "built, not assembled" signal; the comp ships them.)
- **Narrow / mobile builder:** below the `lg` grid breakpoint the rail is a **full-width overlay** over the canvas
  (comp `Mobile` + Header state). Same contract: sticky Back header, `overflow-y-auto` body, toolbar keeps Save +
  Publish (viewport toggle and inline Preview drop out, as the toolbar already does at `sm`). The tool must remain
  usable at constrained **height** as well as width — the internal scroll is what guarantees that.

---

## 4. Per-tool layout decisions

### Theme (baseline already approved — refined for consistency)
- Presets: `sm:grid-cols-2 xl:grid-cols-3` cards → **full-width preset rows** (colour-chip trio + name + font pair +
  "Apply"). Keeps the confirm-on-dirty behavior.
- Colours: `sm:grid-cols-2` → **stacked colour rows** (swatch + name + hex, hairline between). Low-contrast warning
  unchanged.
- Heading/Body font: `sm:grid-cols-2` → **stacked selects**.
- Corner style / Content width / Section spacing: keep as **full-width segmented controls** (already 3-up; formalize
  as the shared segmented primitive).
- Drop the card's `SITE SETUP` kicker (rail shell owns the header). Theme sample block stays.

### Branding
- Site name: full-width input + counter.
- Logo / Favicon: **current selection as a compact chip row** (thumb + filename + dimensions + Remove), an
  immediate **Upload** control, and **"Recent uploads (n)" behind a `<details>`** with a 3-up *small-square* thumb
  grid — replaces the always-open `sm:grid-cols-3` media wall. Immediate-upload behavior and persistence unchanged.

### SEO & social
- Replace the wrapping **button row** (Site Defaults + one button per page) with a **full-width "Editing" context
  `<Select>`** (Site defaults / each page). Everything else preserved: separate SiteDefaults vs PageSeo forms,
  their validation and counters, the social-image picker (behind "Choose from Media Library"), and the external
  **Preview** action (still gated on not-dirty).

### Header & navigation (the focus case)
- Brand display: `sm:grid-cols-3` radios → **segmented control**.
- Navigation: `NavigationItemsEditor` → **dense list** (see §5). "Add page" as a compact header action; the picker
  dialog is unchanged.
- CTA: "Show a header CTA" as a **toggle row**; when on, **stacked** Button label / Destination select / value
  (was `sm:grid-cols-2`). Validation unchanged. "Preview Home" as an inline secondary action at the body end.

### Footer
- Content flags: `sm:grid-cols-2` checkboxes → **full-width toggle rows**.
- Navigation mode: `sm:grid-cols-3` radios → **stacked option rows** with one-line descriptions.
- Custom navigation reuses the dense `NavigationItemsEditor`. Footer text = full-width textarea + counter. Live
  preview + Preview Home unchanged.

---

## 5. Navigation list — the dense row pattern (`NavigationItemsEditor`)

Replaces the ~110 px card with a **~46 px row** inside one bordered list (hairline dividers, not per-item borders):

```
[ ▲ ]  Page title   /slug            [✎ edit]  [✕ remove]
[ ▼ ]
        └ (edit label expands an inline input row only when ✎ is toggled)
```

- **Reorder stays button-based** — a compact stacked ▲/▼ pair (first row's ▲ and last row's ▼ disabled). No
  drag-and-drop is introduced (not justified for a 3–8 item menu; DnD implies a grip affordance and touch handling
  the current model doesn't need).
- **Display-label editing is revealed on demand** (✎ toggle → inline input), instead of an always-visible input on
  every row. This is the main density win. *(Minor interaction change — see §6; trivially reversible to
  always-shown if preferred.)*
- Title + slug share one line; a custom label shows inline as `"What we do" · /slug`. Unavailable/deleted pages
  keep their existing warning treatment. "Add all" / "Add page" and the picker dialog are unchanged.

---

## 6. Visual/layout changes vs behavior changes

**Visual / layout only — no data, API, Save/Publish, dirty/discard, live-preview, or validation change:**
- The Site Tool rail shell (sticky Back header + independently scrolling body); `WebsiteEditorShell` rail branch.
- Wrapping `railOverride` in a `flex-1 min-h-0 flex-col` scroll container in `WebsiteEditorCanvas`.
- Every per-tool re-layout in §4 (segmented / stacked / toggle / color-row / preset-row primitives replacing
  `sm:`/`xl:` grids). Same state, same submit payloads.
- Dense `NavigationItemsEditor` rows (structure/CSS only; same `onChange`/`normalizeNavigationItems`).
- Themed scrollbars/focus/selection.

**Behavior / interaction changes (call out for approval):**
1. **Launcher → Site Tools menu (progressive disclosure).** Adds one navigation layer and changes the tool Back
   target to the menu. *Explicitly requested by the brief;* this is the intended redesign, but it is a real
   interaction delta, so confirm the Back-to-menu semantics before build.
2. **Nav display-label behind an ✎ toggle** (was always visible). A disclosure change only — no data change,
   reversible. Flagged for awareness; keep always-shown if the team prefers zero interaction delta.

No other behavior changes. No usability blocker was found that would force one.

---

## 7. Codex change list (from the current 4.0f implementation)

Grounded in the files as they stand today. Structure/markup/CSS only unless a line says otherwise.

1. **`WebsiteEditorCanvas.tsx`**
   - Give the override slot a scroll context: render `railOverride` inside
     `<div className="flex min-h-0 flex-1 flex-col overflow-hidden">…</div>` (so any override owns sticky-header +
     scroll-body). *(structural)*
   - Replace the always-open bottom launcher block (the `Site tools` / `Full-screen tools` / `More settings`
     `<section>`s) with a single **"Site tools" launcher button** in the default rail footer that opens the new
     menu (new `siteToolsMenuOpen`-style state, mirroring `moreSettingsOpen`). *(interaction — §6.1)*
2. **`WebsiteEditorShell.tsx` (rail branch, lines ~66–76)** — rebuild as
   `form.flex.min-h-0.flex-1.flex-col` → `header.sticky.top-0` (Back + title + description) →
   `div.flex-1.min-h-0.overflow-y-auto` (children + error). Drop the card-only `group`/`Site setup` eyebrow in
   rail chrome. *(structural)*
3. **New `SiteToolsPanel.tsx`** — a rail-override menu (model it on the existing `MoreSettingsPanel.tsx`):
   `flex-1 min-h-0` shell, Back → section editing, grouped rows for `launcherGroup === 'siteTools'` and
   `'fullScreenTools'` from `websiteEditors.ts`, plus a **More settings** row that opens the existing
   `MoreSettingsPanel` flow. Rows = icon + label + `launcherSubtitle` + chevron.
4. **Tool Back targets** — for the five site tools, `onBack` should return to the Site Tools menu (open it) rather
   than `selectEditor('overview')`, so "← Site tools" is accurate. *(interaction — §6.1)*
5. **`NavigationItemsEditor.tsx`** — replace the card `<li>` with the dense row (§5): one bordered `<ol>`,
   hairline dividers, stacked ▲/▼ reorder (reuse the existing `move`), title+slug line, ✎-toggled inline label
   input, ✕ remove. Keep `normalizeNavigationItems`, the picker `Dialog`, and "Add all"/"Add page".
6. **`ThemeEditor.tsx`** — presets → full-width rows; colours → stacked color rows; fonts → stacked; keep the three
   `ThemeChoices` as the shared segmented control; drop rail eyebrow. No change to submit/validation/preview.
7. **`BrandingEditor.tsx`** — current logo/favicon → compact chip row; recent media `sm:grid-cols-3` → `<details>`
   "Recent uploads" with small-square 3-up thumbs; keep immediate upload + remove behavior.
8. **`SeoEditor.tsx`** — swap the `contextButtons` button row for a full-width **context `<Select>`**; keep
   `SiteDefaultsForm` / `PageSeoForm` split, validation, counters, image picker, and Preview.
9. **`FooterEditor.tsx`** — content checkboxes → toggle rows; nav-mode radios → stacked option rows; custom nav via
   the dense `NavigationItemsEditor`. No behavior change.
10. **`HeaderEditor.tsx`** — brand-display radios → segmented; CTA block `sm:grid-cols-2` → stacked; nav via dense
    `NavigationItemsEditor`. Validation/live-preview unchanged.
11. **Shared primitives** — add to `@bakerrang/ui` (or a local `websiteEditors` helper) a **SegmentedControl**,
    **ToggleRow**, and **OptionRow** so all five tools and future tools share one rail vocabulary. `Select`,
    `Input`, `Textarea`, `FileInput`, `Field`, `Button`, `StatusMessage` are reused as-is.

**Not touched:** global Portal navigation, the toolbar (Save/Publish), the preview canvas + iframe, Templates &
Revision History behavior, `MoreSettingsPanel` flow, the underlying site/SEO/branding/header/footer APIs and data
model, and all dirty/discard/confirm dialogs in `BusinessWebsite.tsx`.
