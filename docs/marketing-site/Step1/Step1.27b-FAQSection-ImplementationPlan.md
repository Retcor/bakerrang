# Implement Step 1.27b — FAQ Section

Implement only Step 1.27b of the BakerRang Step 1.27 roadmap.

This slice adds the new composable FAQ homepage section.

Do NOT implement Business Hours, Social Links, FAQ JSON-LD, or their related structured-data changes yet.

Use the approved Step 1.27 Claude plan as the architectural reference, with the decisions in this assignment taking precedence.

---

# Goal

Add a canonical, single-instance FAQ Home section with an ordered list of FAQ entries.

FAQ must participate fully in the existing:

- `Home.sections` composition model
- WORKING site state
- Step 1.25 Preview
- Publish snapshot lifecycle
- public/custom-domain renderer
- Step 1.26 Theme system
- Portal Website workspace

Required lifecycle:

```text
Published site A

Add/edit FAQ in WORKING state

Preview
  -> FAQ B visible

Shared/custom public site
  -> still A

Republish

Shared/custom public site
  -> FAQ B visible
```

Do not create any new Preview or publishing architecture.

---

# 1. FAQ Schema

Add an FAQ section to the shared site schema.

Use approximately:

```ts
export interface FaqItem {
  id: string
  question: string
  answer: string
}

export interface FaqContent {
  heading: string
  intro?: string
  items: FaqItem[]
}

export interface FaqSection {
  id: 'faq'
  type: 'faq'
  content: FaqContent
}
```

Add it to `SiteSection`.

Add an `isFaqSection` type guard following existing schema conventions.

Canonical identity:

```text
id   = faq
type = faq
```

Only one FAQ section may exist on Home.

FAQ item order is the order of `content.items`.

Do not add:

- HTML fields
- Markdown
- rich text
- presentation/style fields
- FAQ structured-data fields

---

# 2. FAQ Validation

Server validation is authoritative.

Use these limits:

```text
heading
  required
  1..120 characters

intro
  optional
  max 300 characters

items
  required
  1..20 entries

question
  required
  1..200 characters

answer
  required
  1..1000 characters
```

Required text values must reject whitespace-only values.

Unknown payload fields must not become persisted arbitrary state.

No HTML parsing or unsafe content handling is necessary; normal React escaping remains authoritative.

---

# 3. FAQ Item Identity

Each persisted FAQ item must have a stable server-authoritative ID.

Follow the established Services / Testimonials child-item identity conventions where practical.

Requirements:

## New item

If the incoming item represents a new FAQ entry:

- generate its persisted ID server-side using the existing UUID pattern

## Existing item

If an incoming item contains an existing persisted FAQ ID:

- retain that ID
- allow question/answer edits
- allow reordering

## Invalid IDs

Reject:

- unknown supplied persisted IDs
- duplicate supplied IDs in one mutation
- malformed identity state

Do not trust a Portal-generated temporary key as a persisted FAQ ID.

The Portal may use temporary React-only keys while editing unsaved new rows, but those must not become canonical state.

---

# 4. Composition

Extend the existing canonical Home-section machinery to include:

```text
faq
```

FAQ is:

```text
max instances = 1
```

When first created, insert FAQ:

```text
before Contact
```

If Contact does not exist, append FAQ at the end of Home sections.

If FAQ already exists, update it in place without changing its current manually configured composition position.

Do not automatically add FAQ to existing sites.

Existing sites must remain visually unchanged until the operator explicitly creates FAQ.

Preserve:

- Hero-first invariant
- existing canonical identity rules
- composition ordering
- section removal/reordering behavior

---

# 5. Working-Site Mutation

Add an FAQ upsert using the existing `mutateWorkingHome()` architecture.

Conceptually:

```text
upsertHomeFaq(...)
```

Requirements:

1. validate FAQ section content
2. validate FAQ item identities
3. generate IDs for new entries
4. retain valid IDs for existing entries
5. enforce single-instance canonical FAQ identity
6. mutate WORKING Home only
7. preserve current section position when editing existing FAQ
8. return updated hydrated `SiteDefinition`

Do not create a separate FAQ document or hidden secondary FAQ store.

FAQ lives entirely within the canonical Home section.

---

# 6. API Route

Add the focused FAQ section mutation endpoint consistent with existing section endpoints:

```text
PUT /tenants/:tenantId/site/pages/home/sections/faq
```

Authorization must match the current site-content editing policy.

Do not broaden permissions.

Reuse existing:

- authentication
- CSRF
- authorization
- tenant/platform limits
- error handling

No public FAQ write endpoint.

---

# 7. Public FAQ Component

Create a Theme-native FAQ component in `@bakerrang/site-components`.

Use the existing site primitives:

- `SiteSection`
- `SiteContainer`
- `SectionHeading`
- Theme typography
- Theme content width
- Theme section spacing
- Theme colors
- Theme corner treatment

Do not add FAQ-specific arbitrary color or font configuration.

---

# 8. FAQ Disclosure UX

Use native:

```html
<details>
  <summary>Question</summary>
  Answer
</details>
```

for V1.

All FAQ entries should be collapsed initially.

Reasons:

- semantic
- keyboard accessible
- zero custom JS state
- no dependency
- works well with progressive enhancement

Style the disclosure so it looks intentional within the BakerRang public Theme.

Requirements:

- question is visibly interactive
- clear focus-visible state
- pointer/cursor affordance where appropriate
- Theme-aware border/radius
- sufficient spacing
- answer has readable line height
- mobile layout remains clean

Do not replace `<summary>` with a nested `<button>`; `<summary>` itself is the disclosure control.

Avoid invalid interactive nesting.

---

# 9. FAQ Answer Rendering

FAQ answers remain plain text.

Do NOT render arbitrary HTML.

For V1, a normal text block is sufficient.

If an answer contains line breaks, handle them consistently and safely.

Do not introduce the About paragraph helper unless reuse is genuinely clean and semantically appropriate.

No Markdown parser.

No `dangerouslySetInnerHTML`.

---

# 10. FAQ JSON-LD — OUT OF SCOPE

Do NOT emit `FAQPage` JSON-LD in Step 1.27b.

This is an intentional V1 scope decision.

Do not alter:

- LocalBusiness JSON-LD
- canonical metadata
- robots behavior
- Preview SEO behavior

Business Hours and Social Links will extend structured business data in later 1.27 slices.

---

# 11. Renderer Wiring

Add FAQ handling to the existing `SectionRenderer`.

No FAQ page.

No renderer-specific FAQ fetch.

The renderer already receives the complete `SiteDefinition`.

Ensure FAQ participates in the existing section anchor/navigation model.

Expected navigation label:

```text
FAQ
```

Expected anchor:

```text
#faq
```

Do not create a separate navigation configuration system.

FAQ should appear/disappear in navigation based solely on whether it exists in `Home.sections`.

Existing navigation behavior for:

- About
- Services
- Gallery
- Testimonials
- Contact

must remain unchanged.

---

# 12. Portal FAQ Editor

Create `FaqEditor` following the current Portal editor patterns.

Controls:

```text
Heading
Intro (optional)

FAQ entries:
  Question
  Answer
  Move Up
  Move Down
  Remove

Add Question

Save FAQ
```

Use shared `@bakerrang/ui` components.

Do not use raw unstyled form controls where existing primitives are available.

---

# 13. FAQ Item Editor UX

Each FAQ row should contain:

```text
Question Input
Answer Textarea
Ordering/removal actions
```

Required row actions:

- Move Up
- Move Down
- Remove

Do NOT implement drag-and-drop.

## Mobile behavior

Do not repeat the old Manage Sections issue where action text crushed content.

Use compact accessible icon controls for FAQ row actions where appropriate.

For example:

```text
↑
↓
trash
```

Requirements:

- usable touch targets
- `aria-label="Move question up"`
- `aria-label="Move question down"`
- `aria-label="Remove question"`
- first item's Move Up disabled
- last item's Move Down disabled
- disabled state visually obvious
- controls must not overlap question text/input

Desktop may show icons or descriptive text if the layout remains clean.

Prefer reuse of an existing compact icon-button pattern rather than introducing another control system.

Do not add a large icon dependency solely for these actions.

---

# 14. Adding FAQ Items

Provide an:

```text
Add Question
```

action.

The editor must support creating multiple unsaved rows before Save.

New rows may have temporary client-only keys for React list rendering.

Those temporary keys must never be sent as authoritative persisted item IDs unless the server contract explicitly recognizes them as new-item markers.

Prefer an explicit client model separating:

```text
persisted id
temporary UI key
```

if necessary.

Do not generate authoritative FAQ IDs in the browser.

---

# 15. Removing FAQ Items

Removing a FAQ item in the editor changes local form state.

It is persisted only when `Save FAQ` succeeds.

At least one FAQ item is required.

If the operator removes all but one entry, the final Remove action should either:

- be disabled, or
- client validation should prevent saving zero items

Prefer the clearer UX of preventing/reminding before an invalid save while retaining server validation as authority.

Removing the entire FAQ section itself is handled through Manage Sections, not by deleting all FAQ items.

---

# 16. Reordering FAQ Items

Reordering FAQ child entries is separate from reordering the FAQ section itself.

FAQ item order:

```text
content.items array
```

FAQ section order:

```text
Home.sections
```

Do not conflate them.

When FAQ items are reordered and saved:

- existing IDs stay attached to the same question
- only item array order changes
- FAQ section's Home position does not change

When the FAQ section is moved in Manage Sections:

- item order remains unchanged

Test both independently.

---

# 17. Portal Website Workspace

Add FAQ to the Homepage Content area.

Conceptually:

```text
Homepage Content

Hero
About
Services
Gallery
Testimonials
FAQ
Contact
```

Do not add Business Hours or Social Profiles yet.

Add FAQ to `EditorMode`.

Update Manage Sections labels to show:

```text
FAQ
```

for the canonical FAQ section.

Do not redesign the Website workspace.

---

# 18. Remove / Re-add FAQ Section

FAQ must participate in the existing generic Manage Sections removal semantics.

Removing FAQ should:

- remove it from `Home.sections`
- remove it from public rendering
- remove it from section-derived navigation
- affect WORKING only until Republish
- not leave a hidden FAQ content record elsewhere

Re-adding FAQ through the FAQ editor/upsert creates a fresh canonical FAQ section.

The freshly recreated FAQ may receive new child IDs, which is acceptable because the prior section was removed.

---

# 19. Accessibility

Audit the resulting public FAQ markup carefully.

Native `<details>/<summary>` already provides disclosure semantics.

Ensure:

- summary is keyboard-focusable using native behavior
- visible focus is not suppressed
- summary has sufficient contrast
- answer content remains associated with its disclosure
- no duplicate IDs are required for native disclosure
- no inaccessible click-only custom div behavior is introduced

Do not add ARIA attributes redundantly if native details/summary already provides the semantics.

---

# 20. Theme Integration

FAQ must consume Step 1.26 Theme.

Verify it responds to:

- selected heading font
- selected body font
- selected text/background colors
- Theme corner style
- Theme content width
- Theme section spacing

Do not introduce FAQ-specific Theme fields.

Per-section background variants remain deferred.

---

# 21. Working / Preview / Published Lifecycle

Required behavior:

```text
Published FAQ A

Edit WORKING FAQ -> B

Preview
  -> B

shared published site
  -> A

custom domain
  -> A

Republish

shared/custom
  -> B
```

FAQ must use the existing:

```text
Home.sections
    -> SiteDefinition
    -> existing publish snapshot
```

path.

Do not add:

- FAQ-specific Preview code
- FAQ-specific publish code
- new public FAQ endpoint

---

# 22. Backwards Compatibility

No Firestore migration.

Required:

```text
old site with no FAQ
  -> unchanged

old published snapshot with no FAQ
  -> unchanged

new WORKING FAQ
  -> Preview only

Republish
  -> public FAQ
```

Do not modify existing section data formats.

---

# 23. Tests

## Server

Cover at minimum:

- valid FAQ creation
- required heading
- intro max
- item count minimum
- item count maximum
- question required/max
- answer required/max
- whitespace-only values rejected
- unknown fields not persisted
- server-generated IDs for new FAQ items
- existing item IDs retained on edit
- unknown item ID rejected
- duplicate item ID rejected
- item reorder preserves identity
- canonical `id === type === faq`
- max-one FAQ invariant
- first creation inserts before Contact
- no Contact -> FAQ appends
- editing FAQ preserves manually configured Home-section position
- FAQ item reorder does not change Home-section position
- Home-section reorder does not change FAQ item order
- removal/re-add behavior
- WORKING vs PUBLISHED isolation
- Republish promotes FAQ
- old snapshots with no FAQ remain valid

## Renderer / site-components

Cover:

- FAQ heading
- optional intro absent/present
- correct number/order of FAQ entries
- native `<details>`
- native `<summary>`
- initially collapsed
- answer content
- safe text escaping
- no `dangerouslySetInnerHTML`
- Theme-aware classes/primitives
- SectionRenderer dispatch
- FAQ navigation label/anchor
- no FAQ -> no FAQ nav

## Portal

Cover:

- absent FAQ create state
- existing FAQ edit state
- Add Question
- Question editing
- Answer editing
- Remove Question
- Move Up
- Move Down
- first Move Up disabled
- last Move Down disabled
- item identity preserved across reorder
- zero-items cannot successfully save
- validation errors
- Save API payload
- `onSaved(updatedSiteDefinition)`
- Website workspace exposes FAQ
- Manage Sections label
- Preview action remains present

---

# 24. Regression

Verify existing behavior remains semantically unchanged for:

- Hero
- About
- Services
- Gallery
- Testimonials
- Contact
- Leads
- Branding
- Theme
- Preview
- custom domains
- publish/unpublish
- media hydration
- SEO / JSON-LD

This slice should be additive.

---

# 25. Automated Verification

Run:

- all backend tests
- Portal tests
- UI tests
- renderer tests
- platform typecheck
- platform lint
- server lint
- Portal production build
- renderer production build
- `git diff --check`

Existing unrelated lint warnings may be reported separately but this slice must introduce none.

---

# 26. Explicitly Out of Scope

Do NOT implement:

- Business Hours
- Social Links
- `openingHoursSpecification`
- `sameAs`
- FAQ JSON-LD
- FAQ page
- custom CSS
- section-background variants
- rich text
- Markdown
- arbitrary HTML
- drag-and-drop
- inline editing
- arbitrary pages
- production deployment

---

# 27. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. final FAQ schema
4. item identity behavior
5. validation behavior
6. composition behavior
7. public disclosure/accessibility behavior
8. Portal FAQ editor behavior
9. tests added/updated
10. complete automated verification results
11. manual DEV verification still required
12. any deviations and why