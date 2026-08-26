# Step 1.29c — Final Website UX / Responsive Polish — Implementation Plan

**Status:** PLAN (no code changes). Deliberately small, presentation-only polish pass.
**Precedes:** Step 1.30 — DEV Product Readiness. **Follows:** 1.29a + 1.29b (both audited APPROVED).
**Scope:** Portal visual/interaction consistency only. No new CMS capabilities, no architecture,
routing, publication-state, dirty-state, navigation-guard, drag/drop, autosave, icon-library, or
server/renderer changes (§22). Resolves exactly the four live-DEV issues (A–D).

All findings below were read from the actual code after 1.29a/1.29b.

---

## 1. Current-code findings for the four issues

### A. Navigation group headings look too much like items
[`WebsiteEditorNavigation.tsx`](../../platform/apps/portal/app/businesses/WebsiteEditorNavigation.tsx)
renders each group as `<section aria-labelledby><h3 …>` with
`className="px-3 text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle"`, and each editor as a
`<button className="… text-sm font-semibold text-fg-muted …">`. Semantically the headings are already
correct (`<h3>` in an `aria-labelledby` section), but **visually** the heading (`font-bold`,
`text-fg-subtle`) sits at the same `px-3` left edge as the items and is close in weight/color to the
`font-semibold text-fg-muted` item labels, with no separator and only `mt-5` above each group — so the
eye reads them as a first, un-highlighted menu row.

### B. Business Hours mobile action row wraps awkwardly
[`WebsiteEditorShell.tsx`](../../platform/apps/portal/app/businesses/WebsiteEditorShell.tsx) action row:
```
<div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t … px-5 py-3 …">
  <div className="flex min-w-0 flex-wrap gap-2">{secondaryActions}</div>
  <div className="ml-auto flex flex-wrap gap-2"> Cancel  Save </div>
</div>
```
Business Hours passes a long-labelled destructive secondary action
(`Remove business hours`, [BusinessHoursEditor.tsx](../../platform/apps/portal/app/businesses/BusinessHoursEditor.tsx)).
At ~375px, `flex-wrap` + `justify-between` + `ml-auto` lets the secondary button and the Cancel/Save
group wrap independently, producing an unbalanced, accidental-looking stack. The behavior is correct;
the layout just reads as unintentional.

### C. Reorder/remove controls are inconsistent across editors
Three different inline icon definitions plus text buttons exist; there is **no shared icon module or
row-action component**. See the matrix in §7.

### D. Manage Sections remove/reorder icons render smaller than FAQ
[`SectionCompositionEditor.tsx`](../../platform/apps/portal/app/businesses/SectionCompositionEditor.tsx)
defines its own `UpIcon`/`DownIcon` at `className="size-4"` and `TrashIcon` at
`className="size-5 sm:size-4"`. FAQ's icons are `size-5`. So on desktop (`sm:`) Manage Sections icons
shrink to `size-4` (1rem) vs FAQ's `size-5` (1.25rem) — the "too small" effect. It is purely the
icon `size-*` classes (same 20×20 viewBox), not padding or button size.

---

## 2. Exact cause of navigation header ambiguity (A)

The `<h3>` group label uses `font-bold` + `text-fg-subtle` at `text-xs`, left-aligned at the same
`px-3` as items, with no separator and modest `mt-5` spacing. `font-bold` gives it as much visual
weight as the `font-semibold` items, and the shared left edge removes any "this is a label, not a row"
cue. Semantics are already fine; only the visual weight/spacing/separation is insufficient.

---

## 3. Recommended navigation group-header treatment (A)

Keep the existing semantic structure (`<section aria-labelledby>` + `<h3 id>`; the mobile Dialog reuses
the same `NavigationItems`, so one change covers both). Adjust the `<h3>` styling so it reads as a
quiet section label and never competes with the active (yellow `bg-accent text-accent-fg`) item:

- **Lighter weight, smaller, more tracking, muted color:**
  `mt-6 px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-fg-subtle`
  (down from `font-bold text-xs`, up on tracking, more top space).
- **Subtle separator for groups after the first:** add `border-t border-border pt-5` to the second and
  later group `<section>`s (not the first, and not the standalone Overview button), giving a hairline
  rule that visually detaches labels from the list above.
- Leave items exactly as they are; the active-editor accent stays the strongest affordance (satisfies
  the "active treatment is good — keep it" and "don't make headings louder than active" constraints).

Do **not** make headings interactive or collapsible (§4). This is a few Tailwind class edits in one
component.

---

## 4. Exact cause of Business Hours mobile action wrapping (B)

The shell action row is a single `flex flex-wrap … justify-between` line. With a long secondary label,
`flex-wrap` breaks the row unpredictably and `justify-between`/`ml-auto` scatter the two button groups.
There is no explicit mobile stacking rule — it relies on accidental wrapping (exactly what §5 says to
avoid).

---

## 5. Recommended responsive action-layout solution (B)

Fix it **once, generically, in `WebsiteEditorShell`** (other long-secondary editors would hit the same
issue), with an explicit stack-then-row rule rather than free wrapping. Replace the action row with:

```
<div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6" data-testid="website-editor-actions">
  {secondaryActions ? <div className="flex flex-wrap gap-2">{secondaryActions}</div> : null}
  <div className="flex flex-wrap justify-end gap-2 sm:ml-auto">
    <Button … onCancel>Cancel</Button>
    <Button … submit>Save</Button>
  </div>
</div>
```

Behavior (matches the prompt's Option A):
- **Mobile (<sm):** column — secondary (`Remove business hours`) on its own row on top, then
  `Cancel`/`Save` right-aligned on their own row. Intentional, no random wrap.
- **Desktop (≥sm):** unchanged — secondary left, `Cancel`/`Save` right (`sm:ml-auto`, space-between).
- Conditionally render the secondary region so editors with no secondary action don't leave an empty
  flex child.

This is CSS-only; **no shell API change is required** — the existing `secondaryActions` prop is enough
(see §6).

---

## 6. Shared action-layout semantics (§6)

Keep `Cancel`/`Save` as the shell's fixed primary actions and the existing `secondaryActions` slot for
destructive/secondary controls. Do **not** add a `primaryActions` prop or a toolbar framework — the
only editor with a secondary action today is Business Hours, and the responsive regions in §5 already
give it a deliberate layout. Minimal API delta = none; layout delta = the class change above.

---

## 7. Reorder/remove control inventory & consistency matrix (§7)

| Editor | Reorder (up/down) | Remove | Current treatment | Icon source / sizes |
|---|---|---|---|---|
| **FAQ** | yes | yes | **icon-only** (reference) | inline `ArrowIcon`+`TrashIcon`, `size-5`, `min-h-11 min-w-11 px-3`, secondary/secondary/danger |
| **Social Profiles** | yes | yes | **icon-only** (already matches FAQ) | inline `ArrowIcon`+`TrashIcon`, `size-5`, identical classes |
| **Testimonials** | yes | yes | **text buttons** | `Move Up`/`Move Down`/`Remove`, `size="sm"` secondary |
| **Gallery** | yes | yes | **text buttons** | `Move Up`/`Move Down`/`Remove`, `size="sm"` secondary |
| **Services** | **no reorder** | yes | **text button** | `Remove`, `size="sm"` secondary |
| **Manage Sections** | yes (hero fixed) | yes | **icon+text hybrid** | inline `UpIcon`/`DownIcon` `size-4`, `TrashIcon` `size-5 sm:size-4`, `w-11 px-0 sm:w-auto sm:px-3` + `hidden sm:inline` text |
| Business Hours | n/a (per-day rows, no move/remove) | n/a | — | — |

Notes: FAQ and Social are already the desired pattern (identical duplicated icons). Testimonials/Gallery
use text. Services has only Remove and **no reorder** — adding reorder would be a new capability
(out of scope §22); only its Remove is standardized. Manage Sections is the hybrid that also causes
issue D.

---

## 8. Recommended standard row-action pattern (§8)

Adopt **FAQ's icon pattern** as the standard for all reorderable/removable editor rows:
- Move up → icon `<button>`, Move down → icon `<button>`, Remove → danger icon `<button>`.
- `min-h-11 min-w-11 px-3` touch targets, `focus-visible` (inherited from shared `Button`),
  `variant="secondary"` for moves and `variant="danger"` for remove, icons at `size-5`.
- Disabled states: move-up disabled at first movable index, move-down at last, remove disabled where the
  editor already enforces a minimum (FAQ keeps ≥1) — behavior unchanged (§13).
- Accessible `aria-label` remains **contextual** (§12): "Move service up", "Move testimonial down",
  "Remove homepage section", etc. — never a bare "Delete".

---

## 9. Shared row-action component recommendation (§11)

**Recommended: yes** — create one Portal-local component; the semantics genuinely repeat across five
editors. Proposed:

```tsx
// app/businesses/RowActions.tsx  (+ shared icons)
<RowActions
  moveUp={{ label: 'Move service up', onClick, disabled }}      // omit to hide (Services)
  moveDown={{ label: 'Move service down', onClick, disabled }}  // omit to hide
  remove={{ label: 'Remove service', onClick, disabled }}
/>
```

- Renders the three icon buttons with one canonical icon set (`ArrowIcon` up/down + `TrashIcon`),
  consistent `size-5`, `min-h-11 min-w-11 px-3`, variants, and ordering.
- Optional move buttons (Services renders remove-only; Manage Sections passes all three).
- Keeps per-editor concerns in the editor: Manage Sections still renders its **"Fixed"** badge for the
  hero row and owns its move-guard logic (cannot move above hero) — it just passes computed
  `disabled`/handlers to `RowActions`.
- Consolidate the duplicated inline icons into the component (or a tiny `app/businesses/rowIcons.tsx`)
  so FAQ/Social stop hand-rolling their own. **No new icon dependency** (§9) — reuse the existing FAQ
  SVGs verbatim as the canonical source.

This is the "one place to fix styling" that directly closes C and D; it is warranted by real shared
semantics, not DRY-for-its-own-sake.

---

## 10. Exact Manage Sections delete-icon discrepancy & fix (§10)

Cause: `TrashIcon` is `className="size-5 sm:size-4"` and `UpIcon`/`DownIcon` are `size-4`, so at desktop
they render 1rem vs FAQ's 1.25rem. Fix: adopt `RowActions` (icons fixed at `size-5`) — which drops the
`sm:size-4` shrink and the size-4 arrows. If, instead, `RowActions` is not adopted, the minimal direct
fix is to set all three Manage Sections icons to `size-5` and remove `sm:size-4`. Do **not** add padding
to fake the size (§10). Recommended path: `RowActions` (fixes it structurally and unifies C).

Decision to resolve during implementation: Manage Sections currently shows **text labels on desktop**
(`hidden sm:inline`). The user prefers FAQ's **icon-only** approach, so `RowActions` should be
**icon-only at all widths**, dropping Manage Sections' desktop text labels for consistency. (This is the
intended standardization; call it out in review since it slightly changes Manage Sections' desktop look.)

---

## 11. Accessibility considerations (§19)

- Preserve `<section aria-labelledby><h3 id>` group semantics; the restyle is visual only.
- Keep `aria-current="page"` on the active editor button (unchanged).
- All controls stay real `<button>`s with contextual `aria-label`s (§12); `RowActions` requires a
  `label` per action so names stay accurate ("Remove testimonial", not "Delete").
- Maintain `min-h-11 min-w-11` (~44px) targets and shared `Button` `focus-visible` rings.
- Preserve disabled semantics on first/last move and minimum-item remove.
- Icons keep `aria-hidden`; the accessible name comes from the button `aria-label`.

---

## 12. Responsive considerations (§18)

- **Navigation:** headings clearly subordinate at all widths; active accent strongest; mobile Dialog
  inherits the same treatment.
- **Business Hours actions:** deliberate column stack <sm (Remove above right-aligned Cancel/Save),
  space-between row ≥sm; no accidental wrap.
- **Row actions:** icon-only buttons are more compact than the old text buttons → less wrapping in
  Testimonials/Gallery rows at 375px; verify no overlap with labels, no card height bloat, no
  horizontal overflow, targets stay ≥44px.

---

## 13. Exact files to modify / create (§21, §13)

**Create:**
- `platform/apps/portal/app/businesses/RowActions.tsx` — shared icon row-action component + canonical
  `ArrowIcon`/`TrashIcon` (or a sibling `rowIcons.tsx`).
- `platform/apps/portal/app/businesses/test/RowActions.test.tsx` — labels, disabled states, icon size.

**Modify:**
- `WebsiteEditorNavigation.tsx` — group-heading restyle (A).
- `WebsiteEditorShell.tsx` — responsive action-row layout (B).
- `FaqEditor.tsx`, `SocialProfilesEditor.tsx` — swap inline icons for `RowActions` (behavior identical).
- `TestimonialsEditor.tsx`, `GalleryEditor.tsx` — text → `RowActions` icon controls (C).
- `ServicesEditor.tsx` — Remove text → `RowActions` remove-only (C).
- `SectionCompositionEditor.tsx` — hybrid → `RowActions` icon-only, keep "Fixed" badge + move-guard (C, D).

**Tests to update (assert current markup — will change):**
- `BusinessPolish.test.tsx` — asserts Manage Sections remove `w-11 bg-danger` + svg `size-5 sm:size-4`
  → update to the standardized icon size/classes.
- `FaqEditor.test.tsx`, `SocialProfilesEditor.test.tsx` — keep the same `aria-label`s and `min-h-11`
  (should stay green if `RowActions` preserves them; verify).
- `BusinessHoursEditor.test.tsx` — check the action-region assertions still hold under the new shell
  layout.

**No server or renderer files.** (§21)

---

## 14. Tests to add / update (§20)

- **Navigation:** group labels render as non-interactive `heading`s (not button/link);
  active editor remains a button with `aria-current="page"`. (Add to the navigation/workspace test.)
- **Shell action layout:** Business Hours' destructive action renders in the secondary region and
  Cancel/Save remain the primary actions (assert structural classes/`data-testid`, not pixel wrapping).
- **RowActions:** move-up/down contextual `aria-label`s; remove `aria-label`; disabled reorder at
  first/last; icon dimensions consistent (`size-5`); Manage Sections uses the same pattern/dimensions
  as FAQ.
- Keep tests structural — no jsdom pixel-wrap assertions, no giant snapshots.

---

## 15. Manual DEV verification checklist (§18)

At **desktop / 768px / 375px**:
- **Navigation:** group headings read as quiet labels (not clickable), separated from items; active
  editor remains the strongest (yellow) affordance; mobile Dialog matches.
- **Business Hours:** at 375px, `Remove business hours` sits on its own row above right-aligned
  `Cancel`/`Save`; at desktop, Remove left / Cancel-Save right; no awkward wrap.
- **Row actions (FAQ, Social, Testimonials, Gallery, Services, Manage Sections):** consistent icon
  buttons; move-up disabled on first, move-down on last; remove disabled where a minimum applies;
  ~44px targets; no overflow or overlap; Manage Sections trash icon now matches FAQ size.
- **Regression (§16):** reorder/remove an item → status shows "Unsaved changes"; move back to original
  order → clean (value-based dirty); Cancel while dirty → discard guard; Save → authoritative remount;
  ordering/IDs/payloads unchanged.

---

## 16. Scope items explicitly deferred to Step 1.30

- Adding reorder (Move Up/Down) to **Services** (currently order = request order only) — a capability
  change, not polish.
- Any broader navigation, empty/error-state, or cross-feature readiness work.
- Favicon, Domain, Custom CSS, renderer, and publication/dirty/guard architecture — untouched here.

---

## 17. One contained Codex pass?

**Yes — a single contained implementation pass.** The four issues are small, localized, and share one
enabler (`RowActions`). Suggested internal order: (1) `RowActions` + shared icons, (2) adopt across the
six editors, (3) nav heading restyle, (4) shell action-row responsive fix, (5) update/added tests. No
fourth 1.29 slice is warranted (§23); anything larger belongs in 1.30.

---

### Behavior invariants preserved (§15, §16)
Item/section ordering, canonical IDs, dirty-state comparisons, Save/remount behavior, API payloads,
validation, section-removal semantics, and the Business Hours canonical-vs-presentation distinction are
all untouched. This slice is presentation-only apart from the additive, behavior-neutral `RowActions`
component.
