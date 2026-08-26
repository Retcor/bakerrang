# Implement Step 1.29a — Website Workspace, Overview & Navigation

Implement ONLY Step 1.29a of BakerRang Step 1.29.

Step 1.29 is Website Editing UX Polish.

This slice replaces the current Website landing-card / editor-takeover interaction with a coherent Website workspace.

Implement:

1. authoritative published-vs-working status
2. persistent Website workspace header
3. Overview default
4. grouped Website editor navigation
5. responsive tablet/mobile editor navigation
6. URL-backed editor selection
7. preservation of existing Preview / Publish flows

Do NOT implement the shared editor-shell / dirty-state system yet.
That belongs to Step 1.29b.

Do NOT redesign individual editor forms in this slice.

---

# 1. Current Problem

Today `BusinessWebsite` behaves approximately:

```text
Website landing
  -> grid of editor buttons
  -> Publishing card

select editor

entire landing disappears
  -> one editor
  -> Cancel returns to grid

save
  -> shared SiteDefinition updated
  -> operator is returned to grid
```

This causes:

- no persistent Website navigation
- Preview/Publish disappear while editing
- weak current-editor context
- repeated back-and-forth through the landing grid

Step 1.29a replaces that model.

---

# 2. Final Workspace Information Architecture

Use this conceptual hierarchy:

```text
Overview

Site setup
  Branding
  Theme
  Business Profile
  Business Hours
  Social Profiles

Homepage
  Hero
  About
  Services
  Gallery
  Testimonials
  FAQ
  Contact
  Manage Sections

Advanced
  Custom CSS
```

Important architecture:

```text
Social Profiles
  -> Site setup
  -> NOT Homepage

Manage Sections
  -> Homepage

Custom CSS
  -> Advanced
```

Do not create duplicate entries.

---

# 3. Single Editor Configuration

Create a small portal-local configuration module if useful, conceptually:

```ts
websiteEditors.ts
```

containing the authoritative editor metadata:

```ts
id
label
group
description
```

Potential editor IDs:

```text
branding
theme
businessProfile
businessHours
socialProfiles

hero
about
services
gallery
testimonials
faq
contact
sections

customCss
```

Use one source of truth for:

- desktop menu labels
- mobile menu labels
- active editor title/context
- query-param parsing

Do not duplicate large switch tables for labels/groups across components.

The actual editor-component rendering switch may remain in `BusinessWebsite` for now.

---

# 4. URL-Backed Editor Selection

Use:

```text
?editor=<id>
```

Examples:

```text
/businesses/:tenantId/website
/businesses/:tenantId/website?editor=faq
/businesses/:tenantId/website?editor=theme
```

No `editor` query param means:

```text
Overview
```

Use Next App Router APIs already appropriate for this client component.

IMPORTANT:

Use:

```text
router.replace(...)
```

for normal editor switches.

Do NOT use `router.push()` for every editor click.

Reason:

```text
refresh/bookmark/deep-link
  -> useful

Theme -> FAQ -> About creating browser history entries
  -> undesirable
```

Preserve unrelated query parameters if any exist.

Invalid/unknown editor values must fail safely to Overview.

Do not throw.

Do not create a server route per editor.

---

# 5. Overview Is the Default

Remove the existing wall of editor-entry cards as the default Website landing.

When no editor is selected, render:

```text
Website Overview
```

The persistent navigation remains present.

Do NOT also display a second full editor grid in the Overview.

A few purposeful shortcuts are acceptable, but do not duplicate every navigation item.

---

# 6. Persistent Website Workspace Header

Add a Website workspace header that remains visible while:

```text
Overview
Branding
Theme
FAQ
Custom CSS
any other editor
```

It should contain conceptually:

```text
Website

[status]

[Preview]
[Publish / Republish]
```

Do NOT include editor-specific Save here.

Save belongs to the individual editor until 1.29b introduces the shared editor shell.

Do NOT duplicate Preview/Publish inside every editor.

---

# 7. Reuse Existing Preview Flow Exactly

The existing Preview implementation is already correct.

Preserve:

```text
window.open('about:blank', '_blank')
opener = null
mint preview token
navigate popup
fallback link if popup blocked
```

Do not create:

- a second Preview component with different behavior
- embedded iframe Preview
- inline preview
- CSS-specific preview
- alternate token flow

Refactor only enough to place the existing action into the persistent header.

Existing Preview tests should continue to prove the same behavior.

---

# 8. Preserve Existing Publish Flow

Move/reuse the existing:

```text
Publish
Republish
```

action in the persistent workspace header.

Required:

```text
DRAFT
  -> Publish

PUBLISHED
  -> Republish
```

Keep existing:

- request behavior
- loading state
- error behavior
- returned SiteDefinition update
- publish semantics

No new publishing mechanism.

---

# 9. Unpublish Placement

Do NOT make Unpublish one of the primary persistent header actions.

Unpublish is a less-common secondary action.

Place it on:

```text
Overview
```

when the site is published, or another clearly secondary Overview affordance.

Preserve its current backend behavior.

Do not redesign unpublishing.

---

# 10. Authoritative `hasUnpublishedChanges`

The Portal currently cannot know whether a published site's working state has newer edits.

Add a small authoritative server-derived read field.

Preferred shared shape:

```ts
interface SiteDefinition {
    // existing
    hasUnpublishedChanges?: boolean
    lastPublishedAt?: <existing project timestamp representation>
}
```

Use the existing timestamp representation already used by this project.

Do not invent a new timestamp serialization convention.

No migration.

No new collection.

No new endpoint.

---

# 11. Server Derivation

The server already stores working timestamps conceptually equivalent to:

```text
config.updatedAt
home.updatedAt
config.lastPublishedAt
```

Derive:

```text
hasUnpublishedChanges
```

server-side.

Conceptually:

```text
DRAFT
  -> false

PUBLISHED and latest working update > authoritative last publish
  -> true

PUBLISHED and no newer working edit
  -> false
```

Use both config and home working timestamps because changes can occur in either domain.

Do NOT compute this by JSON-diffing entire SiteDefinitions.

Do NOT make the Portal infer this independently.

---

# 12. Legacy / Missing Timestamp Safety

Do not incorrectly show:

```text
Changes not published
```

when the server cannot prove that state.

If a legacy/corrupt PUBLISHED record lacks an authoritative usable publication timestamp:

```text
hasUnpublishedChanges = false
```

or another conservative non-alarming result consistent with existing storage semantics.

Do NOT silently migrate data in this slice.

Document the chosen fallback.

---

# 13. Publication State Must Update on Mutations

Because existing site mutations return a SiteDefinition, ensure the derived field is correct when definitions are returned.

Required lifecycle:

```text
Publish
  -> hasUnpublishedChanges = false

Save later working edit
  -> returned SiteDefinition hasUnpublishedChanges = true

Republish
  -> false

Another edit
  -> true
```

DRAFT remains Draft rather than "Changes not published".

Add deterministic server tests.

---

# 14. Status Vocabulary

Use plain operator-facing states:

```text
Draft
Published
Changes not published
```

Do NOT display internal lifecycle language such as:

```text
WORKING snapshot
PUBLISHED snapshot
```

Recommended:

```text
status === DRAFT
  -> Draft

status === PUBLISHED && hasUnpublishedChanges
  -> Changes not published

status === PUBLISHED && !hasUnpublishedChanges
  -> Published
```

Use existing `Badge` styling appropriately.

Do not invent five new badge variants.

---

# 15. `lastPublishedAt`

Expose `lastPublishedAt` if it can be surfaced cleanly from existing authoritative data.

Use it on Overview only if it is a reliable value.

Example:

```text
Last published Aug 23, 2026
```

Use the project's normal locale/date formatting conventions.

If existing data lacks it, omit the line.

Do not show fake/epoch dates.

---

# 16. Desktop Workspace

At `lg+`, use a subordinate Website workspace layout conceptually:

```text
Portal shell
└── Website page
    ├── persistent Website header
    └── workspace
        ├── light Website editor menu
        └── Overview / active editor pane
```

A reasonable grid:

```text
lg:grid-cols-[16rem_minmax(0,1fr)]
```

or equivalent based on the actual Portal width.

The Website navigation must NOT look like a second global dark sidebar.

Use a light/subtle in-page surface.

No excessive nested Cards.

---

# 17. Desktop Editor Navigation

Use semantic navigation markup.

Grouped labels:

```text
Site setup
Homepage
Advanced
```

Provide:

```text
Overview
```

as the first navigation item.

For the active item:

```text
aria-current="page"
```

and clear visual active state.

Use existing BakerRang yellow selectively.

Touch/click targets should remain at least approximately 44px high.

Editor switching should use the already-loaded SiteDefinition.

Do NOT refetch `getSite` on every editor switch.

---

# 18. Active Editor Context

Even before Step 1.29b introduces the full shared editor shell, the workspace should clearly identify the active pane.

Render a small context header above the active editor using the editor metadata:

```text
Homepage
FAQ
Answer common questions on the homepage.
```

or equivalent.

Do not duplicate an editor's own title awkwardly if it already renders one.

If unavoidable in this intermediate slice, prefer one clear workspace heading over two identical headings.

Step 1.29b will normalize individual editor chrome.

---

# 19. Tablet / Mobile Navigation — REQUIRED IN 1.29a

Do NOT leave mobile navigation for a later slice.

Below `lg`, replace the desktop editor menu with a compact control conceptually:

```text
Currently editing
FAQ                 [Change]
```

or:

```text
FAQ ▾
```

Selecting it opens a grouped Website-editor menu.

Use existing Portal/UI dialog primitives and proven focus-trap behavior.

Do not build a custom modal engine.

Requirements:

```text
375px usable
768px usable
current editor obvious
Overview selectable
all editor groups reachable
no horizontal page overflow
44px-ish touch targets
Esc works where Dialog already supports it
focus managed
```

Do not show a permanent 16rem editor rail on tablet/mobile.

---

# 20. Workspace Header Responsiveness

The persistent Website header must work at:

```text
desktop
768px
375px
```

At narrow widths:

```text
status
Preview
Publish/Republish
```

may wrap cleanly.

Do not force all controls onto one line.

Avoid a giant sticky footer.

---

# 21. Sticky Header

The Website workspace header may be sticky if it works naturally with the existing Portal shell.

Inspect the actual global mobile header dimensions.

Use the correct responsive top offset so the Website header does not hide behind the global Portal top bar.

Do not hardcode a random offset without inspecting the shell.

If sticky positioning creates awkward nested behavior, a non-sticky header is acceptable in this slice; correctness is more important than forcing stickiness.

Report the decision.

---

# 22. Overview Content

Build the Overview only from existing/authoritative data.

Include:

```text
site publication status
homepage section summary
last published, when available
Preview
Publish/Republish
secondary Unpublish when published
```

The persistent header already has Preview/Publish, so Overview should not create a giant duplicate Publishing card.

A small site-status summary is enough.

---

# 23. Homepage Summary

Derive from:

```text
Home.sections
```

only.

Show something useful such as:

```text
7 homepage sections configured
Hero · About · Services · Gallery · FAQ · Hours · Contact
```

Use current canonical section labels.

Do not create a second source of section presence/order.

Social Profiles must NOT appear as a Homepage section.

---

# 24. Public Domain Context

Use the existing `getSiteDomain` helper if appropriate.

Overview may show the active custom domain when one exists.

Requirements:

```text
read-only context
link to Domain workspace/page
no domain editing here
no domain architecture change
```

Domain lookup failure must NOT fail the Website workspace.

Treat it as secondary information.

If there is no active custom domain, do not invent one.

Do not add another domain endpoint.

---

# 25. Save Behavior Change — IMPORTANT

The current:

```js
handleEditorSaved(...)
```

returns the operator to the landing grid.

That behavior must change.

After a successful editor save:

```text
update shared SiteDefinition
show canonical save feedback
STAY in the current editor
```

Do NOT remove the `?editor=` parameter.

Do NOT return to Overview automatically.

The operator can:

```text
continue editing
Preview
Republish
select another editor
```

from the persistent workspace.

This is intentional product behavior.

---

# 26. Canonical Save Feedback

Reuse the existing useful phrasing.

For a published site after a working save:

```text
Saved to the working site. Republish to change the public site.
```

If `hasUnpublishedChanges` now gives us better terminology, a slightly more operator-friendly equivalent is acceptable:

```text
Saved. Republish to update the public site.
```

For Draft:

```text
Changes saved.
```

Keep one centralized workspace feedback area.

Do not add duplicate success messages above and below the editor.

Step 1.29b will normalize editor-local error/save chrome further.

---

# 27. Do NOT Add Unsaved Guard Yet

Step 1.29b will introduce the shared dirty-state contract and discard guard.

Do NOT add bespoke dirty logic to every editor in this slice.

For 1.29a:

- existing editor local-state behavior may remain
- editor navigation works
- known silent-discard behavior remains temporarily

Do not create a partial guard that only works for some editors.

The query-param implementation must be structured so Step 1.29b can intercept editor-switch intent cleanly.

For example, route all editor switches through one workspace function rather than calling `router.replace` throughout the component tree.

---

# 28. Do NOT Refactor All Editors Yet

Do not yet standardize:

- Save labels
- editor form wrappers
- error slots
- `Field` usage
- sticky Save footer
- dirty computation
- breadcrumbs inside every editor

Those are Step 1.29b.

Only make minimal compatibility changes required by the new workspace.

---

# 29. Existing Editor Cancel

Existing editors still call:

```text
onCancel
```

For this slice, Cancel should navigate back to:

```text
Overview
```

by removing `?editor=` via the centralized editor-selection function.

Step 1.29b will add dirty confirmation.

---

# 30. BusinessWebsite State

Keep `BusinessWebsite` as the local owner of:

```text
site
pending operation
error
preview fallback
feedback
selected editor / URL sync
```

A modest extraction such as:

```text
WebsiteWorkspace
WebsiteEditorMenu
WebsiteOverview
websiteEditors.ts
```

is encouraged if it makes `BusinessWebsite` substantially clearer.

Do NOT add:

```text
Redux
Zustand
global Website state
new caching system
```

---

# 31. No Duplicate Fetch Per Editor

Initial Website entry may continue:

```text
getSite
```

once.

Editor switching must not make additional site reads merely because `?editor=` changed.

Use the existing loaded:

```text
site
```

as editor seed.

A successful editor mutation returns the new definition and updates it centrally.

---

# 32. Domain Fetch

If Overview loads custom-domain context:

- issue it independently
- do not block the primary SiteDefinition loading state
- cache/retain it during editor switching
- do not refetch it each time the Overview is selected

One fetch per Website workspace mount is sufficient.

---

# 33. Error Behavior

Preserve current:

```text
site load failure
preview failure
publish failure
unpublish failure
```

semantics.

Workspace-level failures should be visible without destroying the active editor.

Do not clear local editor contents because Preview or Publish fails.

Do not redesign editor-specific validation errors yet.

---

# 34. Loading Behavior

Initial Website load should remain coherent.

Do not briefly render:

```text
Overview with empty site
```

before the site fetch completes.

Editor query parameters should resolve after/alongside loading without causing obvious flicker.

No skeleton framework required.

---

# 35. No Renderer Changes

Step 1.29a is Portal-focused.

Do NOT modify:

```text
site-renderer
Preview renderer
public site components
Custom CSS delivery
Theme renderer
```

Preview continues to open the existing renderer normally.

---

# 36. Backend Changes Are Limited

Backend work is allowed ONLY for:

```text
hasUnpublishedChanges
lastPublishedAt
```

on the existing SiteDefinition/read path.

No:

- new endpoint
- migration
- revision system
- diff engine
- publish history
- analytics
- collaboration state

---

# 37. Publication Signal Tests — Server

Add deterministic tests proving:

```text
new DRAFT
  -> hasUnpublishedChanges false

publish
  -> status PUBLISHED
  -> hasUnpublishedChanges false

working config mutation after publish
  -> true

Republish
  -> false

working home-section mutation after publish
  -> true
```

Also test missing/legacy publish timestamp behavior according to the conservative fallback chosen.

If `lastPublishedAt` is exposed:

```text
publish sets it
working edit does not change it
republish advances it
```

Use deterministic FakeDb time facilities/patterns already in the repo.

---

# 38. Published Snapshot Semantics

Do NOT persist:

```text
hasUnpublishedChanges
```

as canonical site state.

It is a derived read field.

`lastPublishedAt` should remain whatever canonical/storage behavior already exists.

Do not add the boolean to published snapshots as authoritative persisted data.

Public renderer may receive the derived field harmlessly through SiteDefinition, but it must not use it.

---

# 39. Portal Workspace Tests

Add deterministic tests for:

```text
Website opens to Overview with no ?editor

?editor=faq
  -> FAQ pane selected

invalid ?editor
  -> Overview safely

desktop menu:
  editor groups present
  active item aria-current

editor switch:
  changes URL using replace behavior
  no additional getSite fetch

successful editor save:
  shared SiteDefinition updated
  current editor remains selected

Cancel:
  returns to Overview

persistent Preview:
  available while editor selected
  exact existing popup/token behavior preserved

Publish/Republish:
  available while editor selected
  returned definition updates status

status:
  Draft
  Published
  Changes not published

Manage Sections under Homepage

Social Profiles under Site setup

Custom CSS under Advanced

Overview:
  homepage summary derives from sections
  secondary Unpublish only when published
```

Do not snapshot giant DOM trees.

---

# 40. Responsive Navigation Tests

Using the repo's existing component-test conventions, prove structurally:

```text
desktop editor nav exists
mobile/tablet selector exists below lg
mobile selector opens grouped menu/dialog
active editor shown
selection closes menu
```

Do not add screenshot infrastructure.

---

# 41. Domain Overview Tests

If active-domain context is implemented:

```text
active domain shown
link goes to existing Domain page
missing domain handled cleanly
domain fetch failure does not fail Website
```

Do not over-test external DNS state.

---

# 42. Existing Preview Regression

Preserve/rework existing `BusinessWebsitePreview` tests rather than deleting coverage.

Still prove:

```text
popup opened before async token call
opener cleared
token minted
popup navigated
blocked popup fallback
```

Moving the button into a persistent header must not weaken this coverage.

---

# 43. Existing Feature Access Regression

All current editors must remain reachable:

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

No feature removal.

---

# 44. Responsive Manual Targets

The implementation itself should be designed for:

```text
desktop
768px
375px
```

No horizontal overflow from:

```text
editor menu
workspace actions
section labels
domain text
```

Do not defer a fundamentally unusable mobile workspace to 1.29c.

1.29c may polish it further.

---

# 45. Full Verification

Run:

- backend tests
- Portal tests
- Renderer tests
- shared UI tests
- platform-wide typecheck
- platform lint
- touched server lint
- Portal production build
- Renderer production build
- `git diff --check`

No renderer behavior changes are expected, but its regression suite/build must stay green.

Report unrelated legacy lint/warnings separately.

---

# 46. Explicitly Out of Scope

Do NOT implement in 1.29a:

- WebsiteEditorShell across all editors
- uniform Save labels
- shared error slot
- sticky editor Save bar
- dirty-state computation across all editors
- unsaved-change ConfirmDialog
- beforeunload
- long-editor compaction
- widespread Field refactor
- drag/drop
- autosave
- page builder
- visual site editing
- renderer changes
- Theme changes
- Custom CSS changes
- favicon
- production deployment

---

# 47. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. publication-status derivation
4. legacy timestamp fallback
5. final Website navigation hierarchy
6. desktop workspace behavior
7. tablet/mobile navigation behavior
8. URL query-param behavior
9. Overview content
10. Preview/Publish reuse
11. successful-save stay-in-editor behavior
12. domain-context behavior
13. tests added/updated
14. full verification results
15. deviations and why
16. anything that must be resolved before Step 1.29b