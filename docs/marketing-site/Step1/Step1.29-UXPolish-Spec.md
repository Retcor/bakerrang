# Planning Task — Step 1.29: Website Editing UX Polish

We are continuing the BakerRang multi-tenant local-business website platform.

Do NOT implement anything.

Inspect the actual current Portal code after completed Steps 1.24–1.28 and produce a detailed implementation plan for:

# Step 1.29 — Website Editing UX Polish

This is a UX/information-architecture/polish step.

It should make the existing Website workspace feel like a cohesive polished SaaS editing experience before Step 1.30 DEV Product Readiness.

Do NOT add major new CMS capabilities.

---

# 1. Product Context

The Website workspace now supports a substantial set of capabilities.

## Site foundation / identity / styling

- Branding
- Theme
- Business Profile
- Business Hours
- Social Profiles
- Custom CSS
- Manage Sections

## Homepage content

- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Contact

## Workflow

- WORKING site state
- Preview Changes
- Publish / Republish
- PUBLISHED snapshot
- custom domains
- public renderer

The individual capabilities work.

Step 1.29 should improve how they fit together.

---

# 2. Visual Direction

BakerRang Portal already has the Step 1.24 visual foundation:

- polished SaaS direction
- light workspace
- dark charcoal navigation
- yellow used selectively
- mobile-first/responsive
- BakerRang branding
- Inter
- existing shared UI components

Preserve that direction.

Do NOT redesign the entire Portal.

This step concerns primarily the Website editing workspace.

---

# 3. Core Goal

The operator should immediately understand:

```text
Where am I?
What part of the website am I editing?
Are my changes saved?
Are my saved changes published?
How do I Preview?
How do I Republish?
How do I move to another editor?
```

The current collection of individual editors should feel like one website-management product.

---

# 4. Inspect the Actual Current UX

Before recommending changes, inspect:

- `BusinessWebsite.tsx`
- Website-related Portal route/page
- all Website editor components
- existing editor selection/navigation
- current Site Foundation layout
- current Homepage Content layout
- Custom CSS Advanced placement
- Manage Sections
- Preview controls
- Publish / Republish controls
- current status/success/error messages
- dirty-state handling inside editors
- mobile behavior
- shared `@bakerrang/ui` components
- Portal shell/layout/navigation from Step 1.24

Do not infer the current UI only from roadmap descriptions.

Describe the actual current interaction model first.

---

# 5. Information Architecture

Evaluate whether the Website workspace should clearly organize capabilities into groups such as:

```text
Website

Overview / status

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

Publishing
  Preview
  Publish / Republish
```

This is conceptual.

Inspect the actual UX and recommend the best hierarchy.

Do NOT mechanically use these exact labels if the existing UI suggests something better.

---

# 6. Editor Navigation

Evaluate the current editor-switching model.

Determine whether the workspace would benefit from a persistent Website editor navigation surface.

Potential desktop concepts:

```text
Website navigation rail/sidebar
+
editor workspace
```

or:

```text
categorized editor menu
+
main editor panel
```

Potential mobile concepts:

```text
compact section picker
drawer
categorized menu
```

Do not create a second Portal-level sidebar that competes with the main Portal navigation.

The Website editor navigation should clearly be subordinate to the Portal shell.

---

# 7. Desktop Workspace

Evaluate whether desktop would be improved by a structure conceptually like:

```text
┌─────────────────────────────────────────────────────────┐
│ Website                  Saved · Changes not published  │
│                          [Preview] [Republish]           │
├────────────────┬────────────────────────────────────────┤
│ Website menu   │ Current editor                         │
│                │                                        │
│ Site setup     │                                        │
│ Branding       │                                        │
│ Theme          │                                        │
│ ...            │                                        │
│                │                                        │
│ Homepage       │                                        │
│ Hero           │                                        │
│ About          │                                        │
│ ...            │                                        │
│                │                                        │
│ Advanced       │                                        │
│ Custom CSS     │                                        │
└────────────────┴────────────────────────────────────────┘
```

Do NOT assume this is automatically correct.

Inspect the current implementation and recommend whether this is materially better than the current card/button approach.

Avoid excessive nested chrome.

---

# 8. Tablet / Mobile Navigation

375px and 768px remain first-class.

Do not simply squeeze a desktop editor rail into mobile.

Recommend an explicit responsive interaction.

Potential patterns include:

```text
Website
[Currently editing: About ▼]

editor...
```

or a compact drawer/menu.

Requirements:

- easy switching between editors
- current editor obvious
- Preview/Publish accessible
- no horizontal scrolling
- no tiny hit targets
- no permanently open second sidebar taking most of the screen

---

# 9. Current Editor Context

When editing something like FAQ, the operator should clearly know:

```text
Website > Homepage > FAQ
```

or equivalent.

Evaluate:

- title hierarchy
- breadcrumb-like context
- descriptive subtitle
- current-navigation active state

Do not add redundant labels everywhere.

---

# 10. Editor Entry Cards vs Navigation

Inspect whether current editor cards/buttons should:

- remain
- be reduced
- become an Overview/home screen
- be replaced by persistent categorized navigation
- be used only when no editor is selected

Avoid having both a large grid of cards AND a permanent editor navigation showing the exact same choices unless there is a useful distinction.

---

# 11. Website Overview / Landing State

Evaluate whether opening Website with no specific editor selected should show a useful Overview rather than a wall of buttons.

Potential useful information:

```text
Site status
Working changes / published state
Primary domain
Last publication state/date if already available
Preview
Republish
section count / configured content summary
```

Do NOT invent new backend data just to populate a dashboard.

Use only information already present in the current SiteDefinition/domain state unless a tiny derived value is trivial.

No analytics.

No traffic data.

No lead stats unless already naturally part of the Website workspace.

---

# 12. Editing vs Publishing Mental Model

One of the primary UX goals is making the existing lifecycle obvious:

```text
Edit
  ↓
Save
  ↓
Working site updated
  ↓
Preview
  ↓
Republish
  ↓
Public site updated
```

Inspect current wording/status.

Recommend a consistent model for:

```text
Saved
Unsaved
Published
Changes not published
Publishing
Published successfully
```

Avoid technically-oriented language like:

```text
WORKING snapshot
PUBLISHED snapshot
```

in normal operator UI unless useful in advanced contexts.

---

# 13. Global Saved vs Published State

Determine what the Portal can reliably know today.

Can it tell:

```text
working definition differs from published
```

from existing state?

If yes, recommend a clear global status such as:

```text
Changes not published
```

If not, do NOT invent unreliable client-side comparisons.

Inspect actual schema/service fields and determine the authoritative signal.

If a small backend field such as publication timestamps/revision markers already exists, use it.

If reliable dirty-vs-published determination would require meaningful backend architecture changes, identify that as a decision instead of sneaking it into UX polish.

---

# 14. Local Unsaved State

Editors currently have their own local form state.

Evaluate consistency across:

- Branding
- Theme
- Business Profile
- Business Hours
- Social Profiles
- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Contact
- Custom CSS

Look for differences such as:

```text
Save Website
Save
Save Changes
Update
```

or inconsistent success messaging.

Recommend a consistent convention.

Do NOT unnecessarily refactor every editor if the differences are justified.

---

# 15. Switching Away with Unsaved Changes

Inspect actual current behavior.

Determine whether an operator can:

```text
edit content
switch to another editor
lose unsaved changes
```

If yes, assess whether Step 1.29 should introduce a **shared unsaved-change guard**.

Potential behavior:

```text
You have unsaved changes.
Discard and switch?
```

But do NOT implement thirteen separate bespoke guards.

If recommended, design a small reusable editor-dirty contract.

Consider:

- switching Website editors
- browser navigation
- Portal navigation
- refreshing/closing tab

Do not over-engineer browser `beforeunload` behavior unless useful.

---

# 16. Persistent Preview / Publish Actions

Preview and Republish are central workflow actions.

Evaluate whether they should remain visible while editing, perhaps in a workspace header or sticky action area.

Requirements:

- Preview easily reachable from any editor
- Publish/Republish easily reachable
- not duplicated excessively
- mobile accessible
- don't obscure editor content
- no giant sticky footer consuming viewport space

Reuse existing Preview popup/token behavior.

Do NOT create another Preview implementation.

---

# 17. Publish Confirmation / Feedback

Inspect current Publish behavior and confirmation UX.

Evaluate:

- button label: Publish vs Republish
- destructive/non-destructive confirmation
- loading state
- success state
- failure state
- whether operator can clearly tell public site updated

Do not add version history/rollback.

That is outside this step.

---

# 18. Manage Sections UX

Manage Sections is now increasingly important because it controls:

- homepage presence
- ordering
- navigation ordering

Inspect its current UX after About/FAQ/Hours additions.

Evaluate whether it clearly communicates:

```text
drag/reorder? or move controls
visible on homepage
navigation follows this order
removing a section does not always delete canonical business data
```

Important Business Hours nuance:

```text
Removing Hours from homepage
  ≠ deleting canonical business hours
```

Do not change this architecture.

Improve wording if needed.

---

# 19. Homepage Editor Relationship to Manage Sections

When an operator edits:

```text
About
FAQ
Services
etc.
```

evaluate whether the UI should provide a lightweight indication:

```text
Shown on homepage
```

or:

```text
Not currently shown — add through Manage Sections
```

Do not duplicate full Manage Sections controls inside every editor unless there is a compelling UX reason.

Avoid creating multiple authorities for section presence/order.

`Home.sections` remains authoritative.

---

# 20. Business Hours UX Distinction

Business Hours has two concepts:

```text
canonical business schedule
+
optional homepage Hours section
```

Inspect whether the Portal communicates this clearly.

Avoid language suggesting removing the homepage Hours presentation deletes canonical schedule unless the dedicated removal action actually does.

The editor should make the distinction understandable without explaining the underlying architecture.

---

# 21. Social Profiles Distinction

Social Profiles are:

```text
business identity / Footer
```

not homepage composition.

Ensure information architecture doesn't accidentally group them as a Home section.

No Social Manage Sections entry.

---

# 22. Custom CSS Positioning

Custom CSS should remain clearly Advanced.

Do not let it dominate the normal editing experience.

Evaluate whether the stable-selector reference and warning should remain fully visible or become collapsible for a cleaner workspace.

Do not change the security model.

No syntax highlighting dependency.

---

# 23. Repeated Editor Chrome

Inspect the editors for repeated:

- titles
- descriptions
- cards
- borders
- Save rows
- status messages
- spacing
- headings

Determine whether a shared editor-shell primitive could reduce visual inconsistency.

Conceptually:

```tsx
<WebsiteEditorShell
  title=""
  description=""
  actions={...}
>
```

or similar.

Only recommend this if it materially simplifies consistency.

Do not perform a giant component abstraction exercise merely for DRYness.

---

# 24. Form Layout Consistency

Inspect field spacing and layout across editors.

Recommend consistent conventions for:

- field labels
- help text
- required indicators
- two-column desktop fields
- single-column mobile fields
- destructive controls
- Save actions
- image/media controls

Use existing `@bakerrang/ui`.

Do not create another form system.

---

# 25. Save Action Placement

Evaluate whether Save buttons should consistently be:

```text
bottom of editor
```

or perhaps:

```text
bottom + sticky action affordance for very long editors
```

Long editors such as:

- FAQ
- Services
- Business Hours
- Custom CSS

may require substantial scrolling.

Recommend a simple V1 pattern.

Avoid both top and bottom duplicated Save buttons unless justified.

---

# 26. Long Editor Usability

Inspect particularly:

- Services
- Gallery
- Testimonials
- FAQ
- Business Hours
- Custom CSS

Evaluate whether long editors have unnecessary nested cards/padding or poor scrolling.

Potential improvements:

- clearer item headers
- collapsible item editing
- compact move/remove actions
- sticky save area
- less vertical whitespace

Do NOT turn this into inline visual site editing.

---

# 27. Reordering Controls

Several editors use Move Up / Move Down.

Maintain the decision:

```text
No drag-and-drop required.
```

Assess consistency of:

- button size
- iconography/text
- disabled states
- mobile layout
- ordering affordance

Do not add a drag/drop library during UX polish.

---

# 28. Destructive Actions

Review actions such as:

- Remove section
- Remove Hours
- Remove Social row
- Clear Custom CSS
- remove Gallery media
- etc.

Determine which require confirmation and which can remain local-before-Save.

Create consistent semantics:

```text
local form removal
  -> reversible until Save
  -> usually no modal

immediate canonical destructive API action
  -> confirmation may be warranted
```

Do not add confirmation dialogs mechanically to everything.

---

# 29. Status Messages

Inspect use of:

```text
Saved
Error
Republish
Removed
Cleared locally
```

Recommend consistent wording and placement.

Avoid status messages accumulating indefinitely or pushing content around excessively.

If a shared pattern already exists, reuse it.

---

# 30. Loading States

Inspect Website initial loading and editor transitions.

Avoid:

- full-screen flicker
- stale editor contents
- buttons enabled while a conflicting request is in progress
- layout jumps

Do not add a complex caching layer.

Use the existing state architecture.

---

# 31. Error States

Evaluate:

- site failed to load
- save failed
- Preview token failed
- Publish failed
- media upload failed

The operator should know what failed and retain their work where possible.

Do not redesign global error infrastructure unless necessary.

---

# 32. Accessibility

Audit the Website workspace UX for obvious issues:

- active navigation state semantics
- buttons vs links
- focus-visible
- keyboard editor navigation
- mobile drawer/picker accessibility if recommended
- heading hierarchy
- form labels
- status messages
- disabled controls
- touch targets

Use semantic HTML.

No need for a full WCAG certification effort here.

---

# 33. Responsive Behavior

Plan explicit layouts for:

```text
>= large desktop
~768px tablet
375px mobile
```

Do not rely on "Tailwind responsive" as the complete answer.

Describe:

- editor navigation behavior
- workspace header behavior
- Preview/Publish actions
- editor content width
- Save actions
- Manage Sections layout

---

# 34. Content Width

The main Portal workspace should remain comfortably readable on large monitors.

Evaluate whether Website editors currently stretch excessively wide.

Recommend useful maximum widths for:

```text
form editors
Custom CSS
Manage Sections
overview
```

Do not hardcode arbitrary widths everywhere.

Prefer shared layout primitives.

---

# 35. Website Workspace State Architecture

Inspect how `BusinessWebsite` currently owns:

- SiteDefinition
- selected editor
- Preview
- publish state
- child callbacks

Determine whether Step 1.29 should keep this architecture or perform a small refactor.

Avoid:

- introducing Redux/Zustand unnecessarily
- moving state globally
- adding new backend state solely for frontend navigation

Prefer a modest local/context architecture if needed.

---

# 36. URL / Deep-Linking

Evaluate whether editor selection currently exists only in component state.

Would URLs such as:

```text
/businesses/:id/website?editor=faq
```

or route segments materially improve:

- refresh behavior
- browser back/forward
- bookmarking
- sharing internal operator links

Do not add routing complexity just because it is theoretically cleaner.

Assess actual value and implementation cost.

If recommended, determine whether Step 1.29 is the right time.

---

# 37. Browser Back / Forward

If editor switching stays purely local-state driven, evaluate whether browser Back behavior is surprising.

Again, do not force URL state if the benefit is small.

Call this out explicitly.

---

# 38. Section Preview Shortcuts

Evaluate whether editor screens should have a lightweight:

```text
Preview changes
```

shortcut through the global Website action area.

Do not add section-specific Preview rendering or anchor synchronization unless trivial.

No embedded preview.

---

# 39. Custom Domain Visibility

The Website workspace already supports custom domains from Step 1.23.

Inspect where domain management currently appears.

Determine whether Website Overview should show the active public URL/domain as context.

Do NOT redesign custom-domain management in this step.

A useful link/status may be appropriate.

---

# 40. Publish vs Domain

Ensure the UI does not imply that publishing and domain activation are the same operation.

Publishing updates site content.

Domain management controls where the published site is reachable.

Keep the mental models separate.

---

# 41. Existing Portal Navigation

Do not conflict with the global Portal sidebar/drawer from Step 1.24.

Website editing navigation is a child workspace.

Explicitly inspect:

- desktop global sidebar
- tablet behavior
- mobile drawer/top bar

and recommend a nested Website experience that remains clear.

---

# 42. Performance

This is primarily a UX step.

Do not introduce:

- heavy editor libraries
- drag/drop frameworks
- giant client bundles
- polling
- unnecessary API fetches on every editor switch

Editor switches should mostly use the already-loaded SiteDefinition.

---

# 43. No Renderer Changes Unless Necessary

Step 1.29 is Portal-focused.

Do not redesign public website components.

Renderer changes should occur only if a real Preview/editor workflow defect requires one.

No visual editing overlays.

No editing controls embedded in public pages.

---

# 44. No Major Backend Feature Work

Likewise, avoid new backend architecture.

Small additions are acceptable only if required to expose an already-existing authoritative state for UX, for example a publication status that is already available but not returned.

Do NOT add:

- revision history
- draft versions
- collaborative editing
- autosave service
- page-builder state
- analytics

If the desired UX would require significant backend work, identify it rather than silently expanding Step 1.29.

---

# 45. Preserve Existing Architecture

Must remain true:

```text
Home.sections
  = sole homepage composition/order/nav authority

BusinessProfile
  = canonical business identity / Hours / Social

Theme
  = standard visual configuration

Custom CSS
  = advanced escape hatch

WORKING
  = editable state

Preview
  = WORKING renderer

PUBLISHED
  = public snapshot
```

UX polish must not create competing sources of truth.

---

# 46. Favicon

The known:

```text
/favicon.ico -> 404
```

remains intentionally deferred.

Desired future behavior is tenant-configurable published-site favicon.

Do NOT solve favicon as part of 1.29 unless you find that it is explicitly already scheduled inside product-readiness scope and recommend moving it there.

For this planning task, treat it as outside Step 1.29.

---

# 47. Explicit Scope Exclusions

Do NOT include:

- new site section types
- arbitrary pages
- visual page builder
- inline public-site editing
- drag-and-drop
- autosave
- collaborative editing
- revision history
- rollback
- analytics
- lead-management redesign
- domain architecture redesign
- Theme V2
- Custom CSS expansion
- CSS syntax highlighting framework
- favicon implementation
- production deployment

---

# 48. Step 1.30 Boundary

Remember Step 1.30 is:

```text
DEV Product Readiness
```

Do not absorb all readiness work into 1.29.

1.29 should make Website editing coherent and pleasant.

1.30 can handle final product-wide:

- missing states
- deployment/readiness checks
- operational configuration
- final cross-feature QA
- deferred small launch blockers

Explicitly identify items you believe belong in 1.30 instead of 1.29.

---

# 49. Testing Strategy

Plan tests for whatever UX architecture you recommend.

Likely areas:

```text
desktop Website navigation
mobile Website navigation
active editor state
editor switching
unsaved-change behavior if added
Preview action
Publish/Republish action
published/working status
editor saved-state propagation
Manage Sections entry
Advanced/Custom CSS entry
responsive layout
accessibility semantics
```

Avoid screenshot tests unless the repo already uses them.

Prefer deterministic component tests.

---

# 50. Manual DEV Verification

Produce a concrete browser verification checklist at:

```text
desktop
768px
375px
```

At minimum cover:

- Website entry/overview
- editor switching
- current editor indication
- Save
- failed Save
- Preview
- Republish
- long editor
- Manage Sections
- Custom CSS Advanced area
- mobile editor navigation
- no horizontal overflow
- global Portal navigation remains usable

---

# 51. Implementation Slicing

Recommend whether 1.29 should be:

```text
one contained implementation
```

or small slices, potentially something like:

```text
1.29a workspace navigation/layout
1.29b editor shell/save/status consistency
1.29c responsive/accessibility/polish
```

Do not slice merely for ceremony.

Prefer the smallest sequence that is easy to review and live-test.

---

# 52. Human Decisions

Identify only genuinely product-level decisions.

Examples might include:

```text
persistent editor subnav vs overview/cards
URL-backed editor selection vs local state
unsaved-change guard
sticky Save behavior
```

For each decision:

- explain what the current code does
- give 2–3 practical choices
- recommend one

Do not ask the human to decide trivial implementation details.

---

# 53. Output

Return:

1. Current Website UX findings
2. Biggest usability problems, ranked
3. Recommended Website information architecture
4. Desktop workspace design
5. Tablet/mobile workspace design
6. Editor navigation recommendation
7. Overview/landing-state recommendation
8. Editing/Preview/Publish workflow recommendation
9. Saved vs published status recommendation
10. Unsaved-change strategy
11. Editor shell/form consistency recommendation
12. Manage Sections UX recommendation
13. Business Hours/Social/Custom CSS positioning
14. Long-editor/save-action strategy
15. Accessibility recommendations
16. Responsive recommendations
17. State-management implications
18. URL/deep-linking recommendation
19. Exact files likely modified/created
20. Backend/renderer changes, if any and why
21. Testing plan
22. Manual DEV verification plan
23. Recommended implementation slices
24. Human decisions genuinely required
25. Items explicitly deferred to Step 1.30

Favor a coherent, restrained SaaS editing workspace over adding more capabilities.