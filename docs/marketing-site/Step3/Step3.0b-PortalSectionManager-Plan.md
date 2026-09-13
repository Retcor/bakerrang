This is a read-only planning task. Let me ground the plan in the actual current Portal code. I already have `siteService.js`, `tenants.js`, `lib/site.ts`, `BusinessWebsite.tsx` (diff), and the editors' section-resolution lines from the 3.0a audit. Let me read the remaining Portal structure.

I now have a complete picture of the current Portal. Let me confirm the baseline is green for this planning step (tree unchanged since the 3.0a audit, but I'll verify fresh).

Baseline is green (typecheck clean; portal 16 files, renderer 60, ui 9 pass; server 330/338 with the 8 obsolete skips from 3.0a). I now have the full current Portal grounded in code. Here is the Step 3.0b plan.

---

# Step 3.0b — Portal Section Manager: Implementation Plan

**Scope note:** Planning/read-only. No files changed, no deploy, no Firestore/GCP/Git mutation. Everything below is a recommendation grounded in the current working tree.

---

## 1. Current post-3.0a Portal architecture

The homepage editing surface is a **pane router** in [BusinessWebsite.tsx](platform/apps/portal/app/businesses/BusinessWebsite.tsx):

- **Pane selection is URL-driven** via `?editor=<paneId>`. Absent → Overview. `parseWebsiteEditor` validates against the registry.
- **Registry** [websiteEditors.ts](platform/apps/portal/app/businesses/websiteEditors.ts): three groups — `Site setup` (branding, theme, businessProfile, businessHours, socialProfiles), `Homepage` (**hero, about, services, gallery, testimonials, faq, contact, + `sections` = "Manage Sections"**), `Advanced` (customCss).
- **`WebsiteEditorNavigation`** renders the registry grouped, desktop sidebar + mobile `Dialog`. Fully data-driven off `websiteEditors`.
- **`ActiveWebsiteEditor`** is a `switch(editor)` that mounts one editor component per pane, with the **temporary 3.0a bridge** at the top (lines 57-62): if `>1` instance of the pane's type exists, it renders a `StatusMessage` refusing to guess.
- **Each section editor** derives its instance internally via `findHomePage(site)?.sections.find(isXSection)` and saves via `upsert*(tenantId, section?.id, input)` → `saveSectionContent` in [lib/site.ts](platform/apps/portal/lib/site.ts) (which creates-then-adopts when no id).
- **`SectionCompositionEditor`** = a **staging** editor: builds a local `rows` array, lets you reorder/remove locally, and on Submit diffs and applies sequential `removeSection`/`moveSection` calls. No add, no duplicate, no hide, no edit.
- **Dirty/nav guard:** `editorDirty` (reported by the active editor via `onDirtyChange`) drives (a) `beforeunload`, (b) `useBusinessNavigationGuard` (route-level), and (c) an in-app `pendingPane` + `ConfirmDialog` when switching panes. On save, `handleEditorSaved` sets `site` from the returned `SiteDefinition`, clears dirty, and bumps `editorSessionRevision` (which remounts the editor via `key`).
- **`WebsiteEditorShell`** wraps each editor in a `<form>` with a header (label/description/group looked up from `websiteEditorById`) + Cancel/Save + JSON-based dirty tracking.
- **`RowActions`** = reusable up/down/trash icon buttons with `aria-label`s.
- **Overview** (`WebsiteOverview`) shows Publication status + a Homepage card listing section labels (already `section.type`-based post-3.0a).
- **UI primitives available** ([packages/ui](platform/packages/ui/src)): `Button, Badge, Card, ConfirmDialog, Dialog, EmptyState, Field, Input, Select, StatusMessage, Textarea`. **There is no menu/dropdown/popover primitive.**
- **Backend commands** (all ID-targeted, transactional, return full `SiteDefinition`): `addSection(afterSectionId?)`, `removeSection`, `moveSection(up|down)`, `duplicateSection`, `setSectionVisibility`, `updateSectionContent`, plus `updateBusinessHours(…, sectionId)` for the projection.

## 2. Temporary bridge behavior that 3.0b must retire

1. **`ActiveWebsiteEditor` ambiguity guard** (BusinessWebsite.tsx:57-62) — the `StatusMessage` for `>1` instance. Once the manager passes an explicit `sectionId`, this becomes dead and is deleted.
2. **`.find(isXSection)` sole-instance discovery** inside all 8 editors — replaced by resolving the explicit `sectionId` prop.
3. **`saveSectionContent`'s create-then-adopt** (`.filter(type).at(-1)`) in lib/site.ts — the "create on first save" behavior moves into the manager's explicit Add flow; content editors will always receive a real id.
4. **The `sections` "Manage Sections" pane + `SectionCompositionEditor`** — superseded by the live manager (retire/replace).
5. **Fixed Homepage type nav entries** (hero…contact) — removed from top-level navigation.

## 3. Recommended final Website navigation tree

Collapse the seven fixed Homepage type panes **and** "Manage Sections" into a single **Homepage** entry that opens the Section Manager:

```
Website
  Overview
  ── Site setup ──
  Branding
  Theme
  Business Profile
  Business Hours        (weekly schedule — canonical)
  Social Profiles
  ── Homepage ──
  Homepage              → Section Manager → exact-instance editor
  ── Advanced ──
  Custom CSS
```

Registry change: replace the 8 `group:'Homepage'` entries with **one** `{ id:'homepage', label:'Homepage', group:'Homepage', description:'Add, arrange, and edit the sections on your homepage.' }`. The nav component needs **no structural change** — it's already data-driven; it just renders one Homepage item. **Business Hours wording:** the Site-setup pane owns the *weekly schedule*; the Homepage manager owns *whether Hours appears as a section*. Label the Site-setup pane description "Set your weekly hours" (schedule) and let the manager card handle homepage presence (see §14).

## 4. Section Manager component architecture

**Replace, don't rename** — `SectionCompositionEditor`'s responsibility (staged reorder/remove-on-save) is materially different from the new live manager. New components:

- **`HomepageSectionManager.tsx`** — the pane. Owns the section list, the one-mutation-at-a-time pending model, delete-confirm dialog, add-dialog open state, and the error surface. Reads `site` + `tenantId` + callbacks (`onSaved(site)`, `onEditSection(sectionId)`).
- **`SectionCard.tsx`** — one card: type label, summary, visible/hidden badge, and actions (Edit, ↑, ↓, and kebab/inline Duplicate/Hide/Delete). Pure/presentational; receives the section, its move-boundary flags, `pending` flags, and action callbacks.
- **`AddSectionDialog.tsx`** — the Add chooser (uses `Dialog`), derives addable types from composition + registry.
- **`sectionDefinitions.ts`** — the metadata registry (§18).

Keep it to these. Fold the delete-confirm into the manager (reuse `ConfirmDialog`), and the per-card action menu into `SectionCard` (reuse `Dialog` as an action sheet — see §4/§23). Avoid a separate "summary" component per type; summaries are pure functions in the registry.

## 5. Section-card UX

Visual hierarchy (mobile-first, stacked; no hover-only affordances):

```
┌──────────────────────────────────────────┐
│ Gallery                    [Hidden]        │   ← type label (semibold) + status badge
│ 6 images                                   │   ← summary (muted)
│                                            │
│ [↑] [↓]            [Edit]      [⋮]         │   ← reorder | primary | menu
└──────────────────────────────────────────┘
```

- **Always-visible:** type label, summary, status badge, **↑ ↓** (reorder is a primary composition action — keep it out of the menu), **Edit** (primary button).
- **Kebab `⋮`** (non-Hero only) opens an action sheet: **Duplicate** (only duplicable types), **Hide/Show** (toggles by state), **Delete**. Implement the sheet with the existing `Dialog` (already focus-trapped, Escape-closing, mobile-friendly) rather than inventing a popover primitive.
- **Hero card:** shows a **`Pinned`** badge instead of ↑ ↓ and kebab; only **Edit** is available. No invalid actions rendered.
- **Status:** `Visible` (subtle/neutral badge) vs **`Hidden`** (`Badge tone="warning"`), plus the whole card visually subdued when hidden (reduced opacity/`bg-surface-muted`) — **never color alone**; the text badge is the source of truth.
- On narrow widths, actions wrap to their own row beneath the summary; buttons keep the existing `min-h-11 min-w-11` touch targets from `RowActions`.

## 6. Section summary rules table

Cheap, client-side, no extra request (everything is already in `site`). Truncate long text at ~40 chars with ellipsis.

| Type | Summary rule | Empty/default fallback |
|---|---|---|
| hero | `content.title` (truncated) | `"Headline & call to action"` |
| about | `content.heading` (truncated) | `"About section"` |
| services | `${n} service${n===1?'':'s'}` from `items.length` | `"No services yet"` |
| gallery | `${n} image${n===1?'':'s'}` from `items.length` | `"No images yet"` (empty gallery is a valid default) |
| testimonials | `${n} testimonial${n===1?'':'s'}` | `"No testimonials yet"` |
| faq | `${n} question${n===1?'':'s'}` | `"No questions yet"` |
| businessHours | `${openDays} day${…} a week` from `site.businessProfile.businessHours` (count non-`closed`) | `"Weekly business hours"` |
| contact | by `content.action.type`: leadForm→`"Lead form"`, email→`"Email contact"`, phone→`"Phone contact"`, url→`"Link button"` | `"Contact call to action"` |

Each rule is a `summary(section, site) => string` in the registry. Guard array access (`Array.isArray(content?.items)`).

## 7. Add Section flow

`+ Add Section` (a `Button` under the list) → **`Dialog`** chooser (not a bare menu — needs descriptions + disabled states + mobile behavior; Dialog already handles focus/Escape/scroll-lock):

1. Chooser lists each addable type as a row with **label + description** (from the registry). **Singleton-exhausted types (hero always; contact/businessHours when present) are shown disabled with a one-line reason**, not hidden — this teaches the model without a vanishing menu. Business Hours when the schedule is unconfigured is disabled with "Set your weekly hours first" + a link to the Business Hours pane.
2. Choosing a type calls `addSection(tenantId, type)` (server mints the id and default content — **no client-side id or default content**).
3. On success: `onSaved(returnedSite)` updates parent state; the manager **identifies the new section by set-diff** of ids (before vs after — see §12) and **auto-opens it in its editor** (`onEditSection(newId)`), with focus moved into the editor.
4. Loading: the chosen row shows a spinner and the chooser disables all rows; the dialog **stays open on error** and shows the error inline (`StatusMessage`), so the operator can retry or pick another type. On success the dialog closes.

## 8. Edit exact-instance flow

Selection identity flows as a **`sectionId` string**, not a resolved object:

```
SectionCard (Edit) → HomepageSectionManager onEditSection(id)
  → BusinessWebsite sets URL ?editor=homepage&sectionId=<uuid>
  → ActiveWebsiteEditor reads sectionId, mounts the type's editor with sectionId prop
  → editor resolves sections.find(s => s.id === sectionId) for seed values
  → save → updateSectionContent(tenantId, 'home', sectionId, input)  (unchanged route)
```

**Pass `sectionId` (string), not the section object**, because: (a) the server contract is already `sectionId`-targeted, so the id is the real identity; (b) after any `onSaved` the parent holds a fresh `SiteDefinition`, and the editor should re-resolve from *current* state by id rather than hold a stale snapshot object; (c) it keeps the URL shareable/restorable. The editor still reads the full section from `site` by id for its seed values.

Two-Gallery correctness falls out automatically: Edit on Gallery B passes B's id; the editor seeds from B and saves to B. **The 3.0a ambiguity `StatusMessage` is deleted** — explicit selection makes it unreachable.

## 9. Editor presentation / navigation flow — **Option A (replace)**

**Recommend A: the manager list is replaced by the instance editor, with a "← Back to Homepage sections" affordance.** Rationale:

- The prompt's stated preference, and it's the smallest polished approach — no drawer/split-pane/route system to build.
- It **eliminates whole classes of dirty-state complexity**: while an editor is open the cards aren't visible, so "click Edit on another card / click Add while dirty" **cannot happen**. The only dirty transitions are editor→back-to-list and editor→other-pane, both already covered by the existing guard.
- It reuses the existing `?editor=` mechanism: `?editor=homepage` = list; `?editor=homepage&sectionId=<uuid>` = editor. Back clears `sectionId`.

`ActiveWebsiteEditor` becomes: if `editor==='homepage'` and `sectionId` present → render that instance's editor; else → render `HomepageSectionManager`.

## 10. Dirty-state handling

Keep the existing machinery; extend the selection state minimally.

- **Where state lives:** `selectedSectionId` is derived from the URL (`searchParams.get('sectionId')`), same pattern as `editor`. The **manager list carries no dirty state** — its actions persist immediately to WORKING. Dirty exists **only inside an instance content editor** (unsaved form fields), reported via the existing `onDirtyChange`.
- **manager → editor (open):** no guard needed (list isn't dirty).
- **editor → back to list / → other pane / browser nav:** existing `pendingPane` + `ConfirmDialog` + `useBusinessNavigationGuard` + `beforeunload` all apply unchanged; the discard target just clears/sets `sectionId`.
- **"Edit another card / Add while dirty":** structurally impossible under Option A — no regression, no silent discard.
- The `ConfirmDialog` description should name the section being edited (e.g. "Your changes in **Gallery** haven't been saved.") — reuse the registry label + summary for duplicate disambiguation.

## 11. Reorder UX

Use `moveSection(tenantId, sectionId, 'up'|'down')`; **always-visible ↑ ↓** (primary composition action, per the stated preference).

- Move the exact instance; **`setSite(returnedSite)`** — no optimistic reorder (avoids rollback complexity).
- **Disable ↑** when the section is at index 1 (Hero pinned at 0); **disable ↓** at the last index. Hero has no ↑ ↓ (shows `Pinned`).
- Hidden sections and duplicate same-type instances reorder normally (they're just instances by id).
- While any card mutation is in flight, **all** action buttons disable (one-mutation-at-a-time, §21) and the active button shows a spinner — prevents double-submit. Error leaves ordering intact (server response is authoritative; on error we don't mutate `site`).

## 12. Duplication UX

Use `duplicateSection(tenantId, sectionId)`.

- **Available** for about/services/gallery/testimonials/faq; **omitted** from the kebab for hero/contact/businessHours (registry `duplicable:false`).
- Persists immediately; server inserts the copy **immediately after the source** and returns the full `SiteDefinition`.
- **Identify the new id by set-diff, not array position:** `newId = returned ids − previous ids` (exactly one). This is robust regardless of ordering and needs **no backend change**. (Position-after-source also works but set-diff is safer and reused by Add.)
- **Recommend auto-opening the duplicate for editing** — the operator duplicates in order to change it; opening it (and focusing its first field) is the natural next step. It also gives immediate visual confirmation of which instance is the copy.
- **No backend change required.** *(Optional, flagged: if a future step wants zero client-side diffing, the six commands could return `{ siteDefinition, sectionId }` for add/duplicate. Not needed for 3.0b — do not do it now.)*

## 13. Hide / Show UX

Use `setSectionVisibility(tenantId, sectionId, hidden)`.

- Visible card's menu shows **Hide**; hidden card's menu shows **Show** and the card shows a **`Hidden`** badge + subdued styling.
- `setSite(returnedSite)`; the hidden card **stays in the manager, stays editable, keeps its order**.
- Preview omits hidden (renderer already filters `!hidden`); live site unchanged until Publish.
- **Hero cannot hide** — no Hide action rendered on the Hero card (backend also rejects with 400 as defense).

## 14. Business Hours UX

Business Hours is a **projection** of `businessProfile.businessHours`; keep the schedule out of the section editor.

- **Add chooser:** show "Business Hours" **disabled** when `site.businessProfile?.businessHours` is absent, with "Set your weekly hours first" + a link to the Business Hours pane; enabled otherwise. Selecting it calls `addSection('businessHours')` (backend 400s if unconfigured — the disabled state front-runs that).
- **Edit** opens a **minimal homepage-presentation editor** (heading/intro only) via `updateSectionContent(businessHours, sectionId, {heading?, intro?})` — this path already validates only heading/intro and **never touches the schedule**. The weekly schedule stays exclusively in the Site-setup Business Hours pane.
- **Delete** = `removeSection` — removes the homepage card, **keeps** `businessProfile.businessHours` (backend already does this; surface it in the confirm copy).
- **Hide** allowed (not Hero); **Duplicate** forbidden (singleton).
- **Summary** derives open-day count from `businessProfile.businessHours` (cheap, already loaded).
- **Reconciliation decision (flag):** the current Site-setup `BusinessHoursEditor` also carries a "show on homepage" toggle (via `updateBusinessHours` `homepage.enabled`). With the manager owning presence, keep **one** control: recommend the Site-setup pane becomes **schedule-only** and the manager owns add/remove. This is a Portal-only simplification (no backend change) but it does alter `BusinessHoursEditor` — call it out explicitly in the build.

## 15. Contact UX

Contact stays singleton.

- **Add** available only when Contact is absent (else disabled in the chooser).
- **Edit** opens the existing `ContactEditor` (by sectionId).
- **Hide** allowed; **Delete** allowed (`removeSection`); **Duplicate** forbidden.
- **Hero CTA implication:** the Hero's "contact" button only renders when a **visible** Contact exists (renderer derives `heroContactHref` from the first visible Contact). If the operator hides/deletes Contact, add a **non-blocking inline note** on the Contact card ("Hiding Contact also removes the Hero's contact button") — informational only. **No "primary contact" concept, no backend change.**

## 16. Preview / Publish placement

Keep the existing Preview/Publish header on the Website surface (it already sits above the pane and is visible from the manager). Do **not** add an iframe/WYSIWYG.

- Preview/Publish remain where they are (top-right header). They already reflect WORKING order/visibility/duplicates and are disabled while `editorDirty` with an explanatory tooltip — keep that.
- **Terminology (§16 requirement):** composition actions (add/move/hide/delete/duplicate) persist to WORKING immediately, so avoid the word "saved" implying "live." Recommend a persistent, subtle line in the manager: *"Changes are saved to your working site. Publish to update the public site."* Keep the existing "Changes not published" status badge (`hasUnpublishedChanges`) as the working-vs-live signal. No autosave/auto-publish invented.

## 17. Addability rules

Derive in the Portal (**Option A** — small shared metadata + current composition), backend stays authoritative:

| Type | Addable when |
|---|---|
| hero | never (required singleton always present) |
| contact | absent |
| businessHours | absent **and** `businessProfile.businessHours` configured (else disabled w/ reason) |
| about, services, gallery, testimonials, faq | always |

`singleton` flag comes from the registry; "already present" from `composition counts`. The chooser disables rather than hides exhausted types. The backend still enforces (409 singleton / 400 businessHours-precondition) — the Portal filter is UX only.

## 18. Section metadata / registry strategy

Introduce a **portal-local `sectionDefinitions` registry** — the pragmatic boundary:

```ts
sectionDefinitions: Record<SectionType, {
  label: string
  description: string          // reused for Add chooser + editor header
  editor: ComponentType<SectionEditorProps>
  singleton: boolean           // UX affordance only
  duplicable: boolean          // UX affordance only
  summary: (section, site) => string
  icon?: ReactNode
}>
```

- It **supports UX**, it is **not** a second rule engine — multiplicity/command validity stay enforced by the backend (the Portal reads back the server's `SiteDefinition` and never overrides a 409/400).
- It replaces the scattered `switch` arms in `ActiveWebsiteEditor`, the `homepageSectionLabels`/`sectionLabels` maps, and the fixed registry entries.
- **`WebsiteEditorShell` must be decoupled** from `websiteEditors` for section editors: today it looks up `websiteEditorById.get(editor)` for its header and returns `null` if missing — after we remove the homepage type entries, that lookup fails. Fix: let the shell accept an explicit `heading`/`eyebrow`/`description` (section editors pass them from `sectionDefinitions`; site-setup editors keep the registry lookup). This is the one shared-component change.
- *(Optional future-friendly note, non-blocking):* `singleton`/`duplicable` could later be hoisted into `@bakerrang/site-schema` so server and portal share one source. Not required for 3.0b; keep it portal-local now to avoid a schema/server touch.

## 19. Overview cleanup

- Homepage card's section list already uses `section.type` (post-3.0a) — **reuse the counts**; make the card a **link/button that opens the Section Manager** (`?editor=homepage`).
- Remove any "Manage Sections" phrasing tied to the retired pane.
- Keep Publication card + Preview/Publish + active-domain card. **Do not** build an analytics dashboard.

## 20. Loading / error model

- **One section mutation at a time.** A single `pendingAction: { sectionId, action } | null` in the manager; while set, **all** card actions disable and the specific button shows a spinner. Prevents double-click/double-submit without per-card bookkeeping complexity.
- **Server response is authoritative** — every success does `setSite(returned)`; **no optimistic reordering/visibility**.
- **Errors** use the existing conventions (`ApiError`, `StatusMessage tone="error"`), mapped to plain language:
    - 400 invalid move / stale id ("That section is no longer available — refreshing." → refetch `getSite`), 409 singleton conflict ("A [type] section already exists."), network ("Please try again."), 5xx never shown raw (the route handler already masks to a generic message).
    - **Refetch after stale/conflict:** on 400 "Unknown section id" or a 409 from a concurrent change, call `getSite` to resync the manager (covers "section deleted in another tab"). Add-dialog errors keep the dialog open.

## 21. (folded into §20)

Covered above: single global pending, authoritative server state, no optimistic reorder, double-submit prevented.

## 22. Error handling (specifics)

- **stale section id / deleted-in-another-tab:** 400 → resync via `getSite`, show a brief "This section changed — we refreshed the list."
- **singleton conflict:** 409 → "A [type] section already exists." (shouldn't happen given the disabled chooser, but handled).
- **invalid move:** 400 → leave ordering intact, brief inline error.
- **network:** generic retry message; no state mutation.
- **concurrent fresh state:** always adopt the returned/ refetched `SiteDefinition`.
- Never expose raw 5xx (route handler masks; Portal shows generic).

## 23. Accessibility plan

- **Add Section** is a real `<button>`; chooser is the existing `Dialog` (focus trap, Escape, restore focus, scroll lock — already implemented).
- **Move ↑/↓ accessible names include section context and order** to disambiguate duplicates: e.g. `"Move Gallery (2 of 2) up"` / `"Move Gallery up"` when unique. Same for Edit/Duplicate/Hide/Delete (`"Delete Services section"`, and with an ordinal when duplicated).
- **Disabled boundaries** use the real `disabled` attribute (↑ at top, ↓ at bottom, Hero actions absent) so AT announces them correctly.
- **Kebab menu:** implement as a `Dialog` action sheet → keyboard-navigable and Escape-closable for free; each action is a labeled `<button>`. (Avoids hand-rolling a focus-managed popover.)
- **Visible/Hidden is textual** (`Badge` text), never color-only.
- **Confirm dialog** focus handling comes from `ConfirmDialog`/`Dialog`.
- **Focus after mutation:** after delete → return focus to the manager (Add button or the neighbor card); after duplicate/add → focus into the opened editor's first field; after back-from-editor → focus the edited card.
- **No drag-and-drop anywhere** — all reordering is button-based.
- Icons carry `aria-label` (the `RowActions` pattern already does this).

## 24. Responsive / mobile plan

- **Stacked cards**, full-width, no tables. Current Portal already uses `flex-wrap` + `min-h-11` touch targets and a mobile `Dialog` nav.
- Card actions wrap to a second row under the summary at narrow widths; ↑ ↓ and Edit stay reachable; kebab opens the `Dialog` sheet (full-usable on touch, no hover).
- Add chooser is a `Dialog` (already mobile-friendly, max-h + scroll).
- **No hover-dependent interaction** anywhere.

## 25. Files likely to change

**New:**
- `HomepageSectionManager.tsx`, `SectionCard.tsx`, `AddSectionDialog.tsx`, `sectionDefinitions.ts` (+ summary fns), and their tests.

**Modified:**
- [websiteEditors.ts](platform/apps/portal/app/businesses/websiteEditors.ts) — remove 8 Homepage entries + `sections`; add one `homepage` entry.
- [BusinessWebsite.tsx](platform/apps/portal/app/businesses/BusinessWebsite.tsx) — `selectedSectionId` from URL; `ActiveWebsiteEditor` routes homepage→manager or instance editor; delete the bridge guard; wire manager callbacks; Overview Homepage card → manager.
- [WebsiteEditorShell.tsx](platform/apps/portal/app/businesses/WebsiteEditorShell.tsx) — accept explicit heading/eyebrow/description (decouple from `websiteEditors`).
- All 8 section editors (`Hero/About/Services/Gallery/Testimonials/Faq/Contact/BusinessHours`) — accept `sectionId` prop; resolve by id (drop `.find(isXSection)`); BusinessHours edit → heading/intro via `updateSectionContent`.
- [BusinessHoursEditor.tsx](platform/apps/portal/app/businesses/BusinessHoursEditor.tsx) — reconcile the homepage toggle (schedule-only in Site-setup; §14).
- [lib/site.ts](platform/apps/portal/lib/site.ts) — add a `newSectionId(before, after)` diff helper; simplify/retire `saveSectionContent`'s create-then-adopt (editors now always pass a real id).
- [WebsiteEditorNavigation.tsx](platform/apps/portal/app/businesses/WebsiteEditorNavigation.tsx) — no structural change (data-driven); verify one Homepage item renders.
- **Retire** [SectionCompositionEditor.tsx](platform/apps/portal/app/businesses/SectionCompositionEditor.tsx) (delete; its move/remove logic is superseded).
- Tests: new manager/add tests; update `BusinessWebsiteWorkspace.test.tsx` and each editor test to pass explicit `sectionId`.

## 26. Backend changes required

**None.** All six instance commands exist and return the full `SiteDefinition`; new-section identity is resolved by set-diff. *(Optional, explicitly non-blocking: add/duplicate could return `{siteDefinition, sectionId}` to avoid client diffing — do not implement in 3.0b.)* Do not touch routes, validation, or data shapes.

## 27. Deterministic test plan

**HomepageSectionManager** (vitest + testing-library, mock `../../lib/site` + `next/navigation`, per existing pattern):
- renders sections in order; Hero shows `Pinned`, no move/hide/delete/duplicate; two Galleries render independently with distinguishable accessible names.
- summaries correct per type; `Hidden` badge shown; hidden card still editable.
- Add chooser disables hero always, contact/businessHours when present, businessHours when schedule absent; Add calls `addSection(type)`, then opens the **set-diff'd** new id.
- Edit calls `onEditSection(exactId)`; **two Galleries → editing the second sends the second id** to `updateSectionContent`.
- Move Up/Down call `moveSection(exactId, dir)`; boundary buttons disabled (Hero pinned, top/bottom).
- Duplicate calls `duplicateSection(exactSourceId)`; the copy appears; auto-open targets the copy's id.
- Hide/Show call `setSectionVisibility(exactId, bool)`.
- Delete confirmation names the section; confirms with `removeSection(exactId)`; **media-retention copy present**; focus returns to the manager.
- server error surfaced; double-click prevented (second click no-ops while pending); keyboard nav for the action sheet + confirm dialog.

**Editors:**
- each receives an explicit `sectionId` and resolves that instance; save sends that id; **no `.find(type)` ambiguity path remains** (assert the retired `StatusMessage` is gone).

**BusinessHours:** schedule stays in Site-setup; homepage card Edit updates heading/intro only; Delete keeps `businessProfile.businessHours`.

**Integration (`BusinessWebsiteWorkspace`):** parent `SiteDefinition` updates from mutation responses; manager reflects new order/state without full reload; dirty guard preserved; Preview still works. No screenshot tests (project doesn't use them).

## 28. Recommended implementation slicing

**One cohesive slice.** Nav restructure, the manager, exact-instance editing, and add/move/hide/duplicate/delete are mutually dependent — you cannot remove the 3.0a bridge without the manager, and the manager is inert without exact-instance editing. Accessibility, responsive behavior, and tests are part of the same pass, not a follow-on roadmap step. Internal build order: (1) `sectionDefinitions` + shell decoupling + editors take `sectionId`; (2) manager list + reorder/hide/delete; (3) Add + duplicate + auto-open; (4) nav/Overview cleanup + delete `SectionCompositionEditor` + remove bridge; (5) tests + a11y/responsive polish.

## 29. Blockers / readiness

**No blockers. Step 3.0b is ready to implement.** The 3.0a backend is complete and provides every command the manager needs; no backend change is required; baseline is green (typecheck clean; portal/renderer/ui tests pass). Two decisions to confirm during the build (neither blocks planning): (a) the **Business Hours homepage-toggle reconciliation** (§14 — recommend schedule-only Site-setup pane), and (b) confirming the **`Dialog`-as-action-sheet** approach for the kebab rather than a new popover primitive (recommended, since no menu primitive exists and Dialog already meets the a11y bar).