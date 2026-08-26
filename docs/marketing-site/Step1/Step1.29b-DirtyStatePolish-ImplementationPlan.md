# Implement Step 1.29b — Editor Shell, Dirty State & Unsaved-Change Protection

Implement ONLY Step 1.29b of BakerRang Step 1.29.

Step 1.29a is complete and independently audited APPROVED.

The Website workspace now has:

- persistent grouped Website navigation
- responsive mobile/tablet navigation
- Overview
- `?editor=` selection via centralized `selectEditor`
- persistent Preview and Publish/Republish actions
- authoritative server-derived `hasUnpublishedChanges`
- `lastPublishedAt`
- successful saves remain in the active editor

Step 1.29b should make all Website editors behave like parts of one editing product.

Implement:

1. shared Website editor chrome
2. consistent titles/descriptions/errors/actions
3. local dirty-state reporting
4. centralized unsaved-change guard
5. refresh/close protection
6. unsaved-state interaction with Preview/Publish
7. post-save authoritative editor re-seeding
8. consistent widths and sticky Save actions
9. targeted form/accessibility consistency

Do NOT perform the final visual/accessibility/long-list polish pass yet.
That belongs to Step 1.29c.

---

# 1. Important 1.29a Audit Finding

Claude found one Low-severity consequence of the new stay-in-editor behavior:

Editors used to unmount after every save.

Now they remain mounted, while most editors initialize local form state only once from:

```text
site
```

This can cause:

## Multi-item editors

```text
Services
Gallery
Testimonials
FAQ
```

New rows may initially have no server-generated IDs.

After Save:

```text
server returns canonical rows with IDs
```

but the mounted editor still holds its pre-save id-less rows.

A second Save can therefore mint replacement IDs.

No content loss occurs, but internal identity churn is undesirable.

## Custom CSS

Its initial dirty baseline remains the original mount value after Save, so the editor can still appear dirty / Save-enabled after an otherwise successful save.

Fix this in Step 1.29b.

---

# 2. Post-Save Authoritative Re-Seed — REQUIRED

Do NOT add thirteen different site-prop synchronization effects unless truly necessary.

Preferred architecture:

```text
BusinessWebsite
  owns editorSessionRevision

successful editor save
  ↓
setSite(returnedDefinition)
setEditorDirty(false)
increment editorSessionRevision
  ↓
active editor component remounts
  ↓
local state re-seeds from returned authoritative SiteDefinition
```

Conceptually:

```tsx
<ActiveEditor
  key={`${editor}:${editorSessionRevision}`}
  ...
/>
```

Exact implementation may differ.

Important:

- URL remains `?editor=current`
- operator remains in the same editor
- workspace/navigation do not remount
- only the active editor session resets
- editor now receives server-assigned IDs / normalized data
- dirty baseline resets naturally
- success feedback remains visible

Add a regression test for this.

---

# 3. Shared `WebsiteEditorShell`

Create a Portal-local shared primitive:

```text
WebsiteEditorShell.tsx
```

Its purpose is UX consistency, not domain abstraction.

It should supply the common editor chrome:

```text
group/context
title
description
top-level error
editor body
sticky action row
Cancel
Save
optional secondary/destructive actions
consistent content width
```

The existing editor still owns:

- local form state
- validation
- API request
- submit handler
- domain-specific controls

Do NOT move all form logic into the shell.

---

# 4. Reuse `websiteEditors.ts`

Step 1.29a created a single editor metadata source.

Reuse it for:

```text
group
label/title
description
```

Do not introduce another list of Website editor names.

A shell API conceptually like:

```tsx
<WebsiteEditorShell
  editor="faq"
  ...
>
```

is preferable to retyping:

```text
Homepage
FAQ
Answer common questions...
```

inside every editor.

Exact API is up to implementation.

---

# 5. Editor Context

The shell should make the active editor obvious.

Prefer restrained context such as:

```text
Homepage
FAQ
Answer common questions on the homepage.
```

rather than excessive chrome.

The Portal page already says:

```text
Website
```

so a full repetitive breadcrumb:

```text
Website > Homepage > FAQ
```

is optional.

Avoid duplicate identical `<h2>` headings.

Editors that currently render their own heading/description should relinquish that chrome to the shared shell.

---

# 6. Standard Save Label

Standardize the primary editor action to:

```text
Save
```

and while pending:

```text
Saving…
```

The editor title already supplies context.

Do not keep:

```text
Save FAQ
Save About
Save Theme
Save Layout
Save Custom CSS
...
```

as thirteen variants.

Domain-specific destructive actions keep their own labels.

---

# 7. Standard Cancel

Use:

```text
Cancel
```

consistently.

Cancel continues routing through the centralized Website:

```text
selectEditor(null)
```

boundary.

The new unsaved guard will intercept it when necessary.

---

# 8. Top-Level Error Slot

The shared shell should render top-level editor errors consistently using:

```text
StatusMessage tone="error"
```

or the existing equivalent.

Fix the known weaker error presentation in:

```text
Business Hours
Manage Sections
```

Do not eliminate useful field-specific validation text.

Distinguish:

```text
top-level request/form failure
vs
field/item-specific validation
```

---

# 9. Editor Widths

Do not allow every form to stretch to the full ~80rem Website pane.

Provide two restrained shell widths, conceptually:

```text
form
wide
```

Suggested intent:

```text
form
  normal textual/config forms
  roughly 44–48rem

wide
  list-heavy / schedule / composition / code editors
  roughly 60–64rem
```

Use existing spacing/layout conventions rather than scattering arbitrary `max-w-*` values throughout editors.

Likely wide editors include:

```text
Business Hours
Social Profiles
Services
Gallery
Testimonials
FAQ
Manage Sections
Custom CSS
```

Use judgment based on actual layouts.

---

# 10. Sticky Editor Action Row

Use ONE Save location.

For long editors, the shell action row should remain conveniently reachable using a restrained sticky-bottom treatment.

Conceptually:

```text
editor contents
...
────────────────────────
Cancel              Save
```

Requirements:

- sticky within normal page scrolling
- subtle surface/backdrop/border
- does not cover the final form fields
- works at desktop / 768 / 375
- actions wrap if needed
- no giant mobile footer
- no duplicate Save at top and bottom

Do not interfere with the Portal shell.

---

# 11. Secondary / Destructive Actions

The shell must support domain-specific secondary actions without forcing them into the same primary Save semantics.

Examples:

```text
Remove Business Hours
Clear Custom CSS
media removal
other existing destructive controls
```

Preserve existing backend semantics and confirmations.

General principle:

```text
local reversible form change
  -> no immediate destructive modal necessarily

immediate canonical destructive request
  -> preserve existing confirmation where appropriate
```

Do not mechanically add confirmation dialogs everywhere.

---

# 12. Dirty-State Contract

Extend the common editor contract with something conceptually equivalent to:

```ts
onDirtyChange(dirty: boolean): void
```

Each editor calculates whether its current local editing state differs from its current authoritative seed.

The workspace owns the aggregate/current:

```text
editorDirty
```

state.

Do not create a global state store.

---

# 13. Dirty Computation

Dirty state should be meaningful, not simply:

```text
the user touched a field once
```

where reasonably practical.

Prefer comparing the normalized state that would actually be saved:

```text
initial editor payload
vs
current editor payload
```

This means if a user changes:

```text
Acme -> Acme2 -> Acme
```

the editor can return to:

```text
dirty = false
```

when practical.

Do not serialize the entire SiteDefinition.

Compare only the editor's owned form state.

---

# 14. Small Shared Dirty Helper

A small helper/hook is encouraged if it reduces boilerplate.

Conceptually:

```text
useWebsiteEditorDirty(...)
```

or similar.

It may:

- report `dirty` through `onDirtyChange`
- clear the reported state on unmount

But it should NOT attempt to understand every editor's fields.

Individual editors still define their own comparable state/payload.

---

# 15. Dynamic / Multi-Item Editors

Pay special attention to:

```text
Services
Gallery
Testimonials
FAQ
Social Profiles
Business Hours
Manage Sections
```

Dirty comparisons must preserve ordering semantics.

For list data:

```text
item order matters
```

Use stable normalized representations.

Do not mutate arrays merely to compare them.

Temporary client keys that are not part of the actual save payload should not create permanent false dirty state.

---

# 16. Media Editors

Inspect Gallery/About/etc. carefully.

Do not classify purely transient:

```text
upload progress
request state
temporary file object
```

as canonical dirty content unless it actually changes what would be saved.

Existing upload behavior must remain unchanged.

---

# 17. Missing Sections / Defaults

Do NOT assume:

```text
dirty === false
```

means Save should always be disabled.

Some editors may represent an absent section with useful initial defaults and existing save semantics may allow creation.

Dirty state primarily drives:

```text
unsaved-change warning
workspace status
Preview/Publish safety
```

Do not casually break creation flows by globally requiring `dirty` before Save.

Custom CSS may retain its existing no-dirty Save disabling if appropriate.

Preserve each editor's existing validity/save eligibility unless intentionally standardized without changing capability.

---

# 18. Workspace Unsaved State

When the active editor reports:

```text
dirty = true
```

the persistent Website workspace should clearly indicate:

```text
Unsaved changes
```

Recommended status precedence:

```text
if active editor dirty:
    Unsaved changes

else if site.status === DRAFT:
    Draft

else if site.hasUnpublishedChanges:
    Changes not published

else:
    Published
```

This creates the intended lifecycle:

```text
Published
  ↓ edit
Unsaved changes
  ↓ Save
Changes not published
  ↓ Republish
Published
```

For Draft:

```text
Draft
  ↓ edit
Unsaved changes
  ↓ Save
Draft
  ↓ Publish
Published
```

Use plain operator-facing language.

---

# 19. Preview While Dirty — IMPORTANT

The existing Preview renders the SAVED WORKING site.

It does NOT know about unsaved local textarea/form state.

Therefore, while:

```text
editorDirty === true
```

do NOT allow the operator to click Preview and reasonably assume those local edits are present.

Disable or otherwise block the persistent:

```text
Preview
```

action.

Provide concise explanation:

```text
Save or discard your changes before previewing.
```

Do not create a live/local Preview mechanism.

---

# 20. Publish / Republish While Dirty — IMPORTANT

Likewise, while:

```text
editorDirty === true
```

disable/block:

```text
Publish
Republish
```

because those actions publish the last saved working state, not the local editor contents.

Use concise explanation:

```text
Save or discard your changes before publishing.
```

Do not auto-save before publishing.

Do not silently publish stale working data while unsaved local edits are visible.

---

# 21. Defense in Event Handlers

Do not rely only on disabled button styling.

The Preview and Publish handlers themselves should safely refuse execution while:

```text
editorDirty
```

in case they are invoked programmatically or state changes at an awkward moment.

No token mint/publish request should occur.

---

# 22. Centralized Editor-Switch Guard

Step 1.29a intentionally centralized editor navigation at:

```text
selectEditor
```

Use this boundary.

When:

```text
editorDirty === false
```

selection proceeds normally.

When:

```text
editorDirty === true
```

and requested pane differs from current pane:

show existing:

```text
ConfirmDialog
```

with plain copy such as:

```text
Discard unsaved changes?

Your changes in FAQ haven't been saved.
```

Actions:

```text
Keep editing
Discard changes
```

On Keep:

```text
stay in current editor
URL unchanged
local form state untouched
```

On Discard:

```text
clear dirty state
perform requested navigation
```

---

# 23. Guard Applies To

At minimum the single guard must cover:

```text
desktop editor navigation
mobile editor navigation
Cancel -> Overview
Overview/navigation shortcuts that change Website pane
```

All of those should already route through:

```text
selectEditor
```

Do NOT create separate dialogs per navigation surface.

---

# 24. Do Not Guard Same-Editor Selection

If the active editor is:

```text
FAQ
```

and something attempts:

```text
selectEditor('faq')
```

do not prompt.

No meaningful navigation is occurring.

---

# 25. Pending Navigation Target

Implement the confirm flow robustly.

Conceptually:

```text
request navigation -> Theme
dirty
  ↓
store pending destination Theme
show confirm

Discard
  ↓
navigate Theme

Keep editing
  ↓
clear pending destination
stay FAQ
```

Do not navigate before confirmation.

Mobile dialog should close appropriately without losing the pending destination.

---

# 26. Browser Refresh / Tab Close

Add a single:

```text
beforeunload
```

guard while:

```text
editorDirty
```

Use the browser-standard mechanism.

Do not attempt custom confirmation text; browsers ignore it.

Register it only while dirty and remove it when clean/unmounted.

Test listener behavior where practical.

---

# 27. Portal-Level Navigation Away

The operator can also click:

```text
Overview
Website
Leads
Domain
All businesses
```

in the surrounding Portal shell.

Inspect the actual `BusinessWorkspace` / `AppShell` structure.

If there is a CLEAN architectural seam to allow `BusinessWebsite` to register an unsaved-navigation guard with the surrounding Business workspace, implement a small scoped integration.

Preferred idea:

```text
BusinessWorkspace
  provides a navigation-guard callback/context

BusinessWebsite
  registers current dirty state

contextNav links
  ask guard before leaving
```

Do NOT:

- add Redux/Zustand
- add a generic application-wide navigation framework
- add document-level anchor click interception
- monkey-patch history/router internals

If clean integration would require invasive Portal-shell changes, defer Portal-level link interception to 1.29c and report it explicitly.

The following remain REQUIRED regardless:

```text
Website editor switch guard
Cancel guard
beforeunload
```

---

# 28. Browser Back

Do NOT introduce brittle history-stack hacks merely to trap browser Back.

Because editor switching uses:

```text
router.replace
```

editor changes themselves do not fill browser history.

If Next App Router offers no clean blocking primitive for a Back transition away from Website, document that limitation rather than using pushState/popstate tricks.

This is not a blocker for 1.29b.

---

# 29. Post-Save Remount

On successful editor Save:

```text
setSite(returnedDefinition)
setEditorDirty(false)
increment active-editor session revision
```

The active editor remounts using the returned authoritative SiteDefinition.

This resolves:

```text
server-assigned FAQ/Services/etc. IDs
canonical normalization
Custom CSS dirty baseline
other one-time local state seeds
```

The operator stays on the same editor and same query parameter.

---

# 30. Verify Multi-Save Identity Stability

Add a focused regression with one of:

```text
FAQ
Services
Testimonials
```

Example:

```text
open FAQ
add question without server id
Save
server response contains generated id
editor remounts

edit answer
Save again

second request includes the returned server id
```

The ID must not churn simply because the editor stayed open.

---

# 31. Verify Custom CSS Dirty Reset

Regression:

```text
open Custom CSS
edit
Save
server returns canonical site

editor remounts / resets baseline
dirty = false
workspace no longer says Unsaved changes
```

If Custom CSS normally disables Save when clean:

```text
Save returns disabled
```

after the successful save.

---

# 32. Shared Editor Chrome Migration

Move all Website editors onto `WebsiteEditorShell`:

```text
Branding
Theme
Business Profile
Business Hours
Social Profiles

Hero
About
Services
Gallery
Testimonials
FAQ
Contact
Manage Sections

Custom CSS
```

Preserve their domain logic.

This slice should be mostly changing their surrounding presentation + dirty reporting.

---

# 33. Do Not Rewrite API Logic

For each editor preserve:

- focused endpoint choice
- payload semantics
- existing validation
- media behavior
- confirmation semantics
- server-returned SiteDefinition flow

Do not consolidate APIs merely because the forms now look alike.

---

# 34. `Field` Adoption

The shared UI `Field` primitive already exists.

Use it where current editors hand-roll basic label/help/error markup and conversion is straightforward.

Known examples worth inspecting:

```text
FAQ
Business Hours
```

Do NOT force every unusual compound field into `Field`.

This is an accessibility/consistency cleanup, not a complete form-system rewrite.

---

# 35. Reordering Controls

Keep:

```text
Move Up
Move Down
```

No drag/drop.

As editors are touched, normalize obvious inconsistent sizes/disabled states using the existing 44px-ish controls.

Do not spend this slice redesigning list items.

Long-editor compactness gets its final pass in 1.29c.

---

# 36. Manage Sections Copy

Clarify its architecture in operator language.

Explain approximately:

```text
These sections appear on your homepage.

Their order also controls homepage navigation order.
```

For removing a presentation section:

```text
Removing a homepage section does not necessarily delete reusable business information.
```

Be particularly careful with Business Hours:

```text
Remove Hours from homepage
  != Remove Business Hours schedule
```

Do not change the actual architecture.

---

# 37. Business Hours Copy

Preserve the existing distinction:

```text
weekly business schedule
+
optional homepage Hours section
```

Make this understandable without exposing implementation terms like:

```text
BusinessProfile
Home.sections
```

Do not change current removal semantics.

---

# 38. Social Profiles

Keep Social Profiles under:

```text
Site setup
```

No homepage visibility indicator.

No Manage Sections integration.

---

# 39. Custom CSS

Keep Custom CSS under:

```text
Advanced
```

Preserve:

- server-authoritative validation
- resource policy
- stable-selector reference
- raw-vs-scoped behavior
- Clear semantics

Only migrate its editor chrome/dirty state.

Do not touch the audited Custom CSS security implementation.

---

# 40. Success Feedback

Keep centralized Website success messaging rather than introducing a separate success banner in every form.

Recommended:

For published working edits:

```text
Saved. Republish to update the public site.
```

For Draft:

```text
Changes saved.
```

The workspace status simultaneously changes appropriately.

Do not render duplicate success messages in shell + workspace.

---

# 41. Failed Save

When an editor save fails:

```text
dirty remains true
local contents remain intact
top-level error shown in shell
active editor remains selected
Preview/Publish remain blocked
```

No remount.

No navigation.

---

# 42. Publish After Save

Regression:

```text
Published
edit FAQ
  -> Unsaved changes
  -> Preview/Republish blocked

Save
  -> editor remounts
  -> Changes not published
  -> Preview/Republish enabled

Republish
  -> Published
```

This is the central 1.29 mental model.

---

# 43. Width / Overflow

Verify all migrated forms at:

```text
desktop
768px
375px
```

No shell width should cause:

```text
page-level horizontal scrolling
```

Dynamic list rows/actions may wrap.

Custom CSS code/reference should remain contained.

---

# 44. Accessibility

Shared shell must provide:

- one clear editor heading
- sensible heading hierarchy
- labelled form controls
- error `role`/live semantics via `StatusMessage`
- keyboard-accessible Cancel/Save
- focus-visible from UI primitives
- disabled Preview/Publish communicated semantically
- ConfirmDialog focus management inherited from existing UI
- touch targets remain adequate

Do not perform a formal WCAG audit yet.

---

# 45. Tests — Shared Shell

Add deterministic tests proving:

```text
editor metadata title/group/description shown
top-level error uses danger StatusMessage
one Save button
uniform Save label
Saving… state
Cancel
sticky action row structure
form / wide width modes
secondary action slot
```

Avoid giant snapshots.

---

# 46. Tests — Dirty Navigation

Cover:

```text
clean FAQ -> Theme
  no confirmation

dirty FAQ -> Theme
  confirmation

Keep editing
  stays FAQ
  URL unchanged
  form value retained

Discard
  navigates Theme
  query param updates

dirty Cancel
  confirmation before Overview
```

Desktop and mobile selection must route through the same guard.

---

# 47. Tests — Dirty Header Actions

Cover:

```text
dirty editor
  status = Unsaved changes
  Preview blocked
  Publish/Republish blocked
  no preview token request
  no publish request

save succeeds
  dirty clears
  publication status returns to Changes not published / Draft
  Preview enabled
  Publish enabled
```

---

# 48. Tests — `beforeunload`

Verify when practical:

```text
clean
  no unload protection

dirty
  beforeunload protection active

save/discard
  listener no longer blocks
```

No custom browser prompt wording.

---

# 49. Tests — Post-Save Canonical Re-Seed

Required material tests:

```text
multi-item server IDs survive second save

Custom CSS baseline resets after save

returned SiteDefinition becomes new editor seed
```

This directly closes Claude's 1.29a L1 finding.

---

# 50. Tests — Editor Migration

Do not write thirteen giant editor tests just to prove the shell exists.

Use:

- shared shell tests
- representative editor component tests
- a lightweight contract/source test if consistent with this repo

But materially prove:

```text
all Website editors use the common shell
all have uniform primary Save text
known Business Hours / Manage Sections error inconsistency is gone
```

---

# 51. Existing Regression Suites

Preserve behavior/tests for:

- Branding
- Theme
- Business Profile
- Business Hours
- Social Profiles
- Custom CSS
- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Contact
- Manage Sections
- Preview
- Publish/Republish
- Overview
- Domain context

Do not weaken tests simply to complete the refactor.

---

# 52. Backend / Renderer

Expected:

```text
NO server changes
NO renderer changes
```

Step 1.29b should be Portal-only.

If a genuine blocker requires backend/renderer changes, report it before making architectural changes.

Do not touch:

```text
hasUnpublishedChanges derivation
Custom CSS server security
public renderer
Preview renderer
Theme renderer
```

---

# 53. Favicon

Still out of scope.

Do not touch:

```text
/favicon.ico
favicon metadata
tenant favicon
```

---

# 54. Explicitly Out of Scope

Do NOT implement:

- autosave
- drag-and-drop
- visual site editor
- page builder
- inline Preview
- revision history
- rollback
- collaboration
- renderer changes
- Theme V2
- Custom CSS expansion
- favicon
- production deployment

Do not build a generic application-wide navigation-blocking framework.

---

# 55. Full Verification

Run:

- Backend tests
- Portal tests
- Renderer tests
- Shared UI tests
- platform-wide typecheck
- platform lint
- Portal production build
- Renderer production build
- `git diff --check`

No server files should be touched; touched-server StandardJS is unnecessary if that remains true.

Report unrelated warnings separately.

---

# 56. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. WebsiteEditorShell architecture
4. dirty-state contract
5. unsaved status behavior
6. Preview/Publish behavior while dirty
7. editor-switch/Cancel guard
8. Portal-level navigation guard behavior, if cleanly implemented
9. beforeunload behavior
10. post-save remount/re-seed behavior
11. resolution of FAQ/Services/etc. ID churn
12. resolution of Custom CSS dirty baseline
13. Save/error/action consistency
14. width/sticky-action behavior
15. Manage Sections / Hours copy changes
16. tests added/updated
17. full verification results
18. deviations and why
19. anything remaining for Step 1.29c