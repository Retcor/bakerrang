# Implement Step 1.27a — About Section

Implement only Step 1.27a of the BakerRang Step 1.27 roadmap.

This slice adds the new composable About homepage section.

Do NOT implement FAQ, Business Hours, Social Links, or their structured-data changes yet.

Use Claude's Step 1.27 plan as the primary technical reference, with the decisions in this assignment taking precedence.

---

# Goal

Add a single-instance composable `about` Home section that participates fully in the existing:

- Home.sections composition model
- WORKING site state
- Step 1.25 Preview
- Publish snapshot lifecycle
- public/custom-domain renderer
- Step 1.26 Theme system
- provider-neutral media system

Required lifecycle:

```text
Published site A

Add/edit About in WORKING state

Preview
  -> About visible

Shared/custom public site
  -> still A

Republish

Shared/custom public site
  -> About visible
```

Do not create any new Preview or publishing architecture.

---

# 1. About Schema

Add an About section to the shared site schema.

Use approximately:

```ts
export interface AboutContent {
  eyebrow?: string
  heading: string
  body: string

  imageMediaId?: string
  imageAlt?: string

  // read-time hydrated only
  imageSrc?: string
  imageWidth?: number
  imageHeight?: number
}

export interface AboutSection {
  id: 'about'
  type: 'about'
  content: AboutContent
}
```

Add it to `SiteSection`.

Add the appropriate `isAboutSection` type guard following existing schema conventions.

The canonical section identity must be:

```text
id   = about
type = about
```

Only one About section may exist.

Do not introduce arbitrary HTML, Markdown, rich text, or presentation/style fields.

---

# 2. Validation

Server validation is authoritative.

Use these limits:

```text
eyebrow
  optional
  max 60 characters

heading
  required
  1..120 characters

body
  required
  1..2000 characters

imageMediaId
  optional

imageAlt
  required if imageMediaId exists
  max 250 characters
```

If no image exists, do not persist meaningless hydrated image properties.

Reject malformed section payloads consistently with existing site-section validation behavior.

Unknown input fields must not become arbitrary persisted state.

---

# 3. Composition

Extend the existing canonical Home-section machinery to include:

```text
about
```

Preserve all current composition invariants.

About is:

```text
max instances = 1
```

When first created, insert it:

```text
after Hero
before Services if Services exists
```

Otherwise insert immediately after Hero.

If About already exists, update it in place without changing its current composition order.

Do not automatically add About to existing sites.

Existing sites must remain unchanged until an operator explicitly creates About.

---

# 4. Working-Site Mutation

Add an About upsert using the existing `mutateWorkingHome()` architecture.

Conceptually:

```text
upsertHomeAbout(...)
```

Requirements:

1. validate input
2. verify optional About media belongs to the tenant
3. enforce canonical identity / single-instance invariants
4. mutate WORKING Home only
5. preserve current section ordering when updating an existing About
6. return the hydrated updated SiteDefinition

Follow existing Hero/Services/Gallery/Testimonial conventions where appropriate rather than creating a new mutation framework.

---

# 5. API Route

Add the focused About section endpoint consistent with existing section endpoints:

```text
PUT /tenants/:tenantId/site/pages/home/sections/about
```

Authorization must match the current site-content editing policy.

Do not broaden permissions.

Reuse existing:

- authentication
- CSRF
- tenant/platform authorization
- rate limiting
- standard error handling

No public write endpoint.

---

# 6. About Media

About may have one optional image.

Use the existing provider-neutral media architecture.

Canonical persisted content stores:

```text
imageMediaId
imageAlt
```

Do NOT persist public media URLs as canonical content.

Extend the existing site media hydration path so About image IDs resolve into:

```text
imageSrc
imageWidth
imageHeight
```

at read time.

Requirements:

- validate that selected media belongs to the tenant before saving
- use existing immutable media behavior
- if stored media cannot be resolved during a read, drop hydrated image information safely
- public rendering falls back cleanly to text-only About
- no broken image placeholder

`imageAlt` is section content and should remain stored with About because existing media records do not contain suitable alt text.

Do not modify Gallery media semantics.

---

# 7. About Body Rendering

Store About body as one plain multiline string.

Do NOT store HTML.

Do NOT implement Markdown.

However, do NOT render the entire value as a single block using only:

```css
white-space: pre-line
```

Instead, treat blank lines as paragraph boundaries.

Conceptually:

```text
"This is paragraph one.

This is paragraph two."
```

should render semantically as:

```html
<p>This is paragraph one.</p>
<p>This is paragraph two.</p>
```

Implement this with a small deterministic plain-text paragraph helper.

Preserve text escaping through normal React rendering.

Single line breaks within a paragraph may either remain normal whitespace or be preserved if the existing typography architecture strongly favors it; blank-line paragraph separation is the important requirement.

Do not create a generic rich-text parser.

---

# 8. Public About Component

Create a Theme-native About component in `@bakerrang/site-components`.

Use existing public-site primitives such as:

- SiteSection
- SiteContainer
- SectionHeading
- Theme typography
- Theme content width
- Theme section spacing
- Theme corner treatment

Do not add arbitrary About colors or separate Theme settings.

## With image

Desktop should use an intentional two-column composition such as:

```text
[ image ]    eyebrow
             heading
             paragraph
             paragraph
```

## Without image

The text should occupy a deliberate readable layout rather than leaving an empty image column.

## Mobile

Stack cleanly:

```text
image

eyebrow
heading
body
```

or another sensible responsive ordering.

The image must use:

```text
alt={imageAlt}
```

Do not add animation.

Do not introduce a large image/layout dependency.

Follow existing Gallery/media rendering conventions unless there is a compelling reason otherwise.

---

# 9. Renderer Wiring

Add About to the existing SectionRenderer.

No separate About page.

No renderer-specific data fetch.

The renderer already receives the full SiteDefinition.

Ensure the About section root participates correctly in the existing section-anchor/navigation architecture.

If current SiteHeader navigation derives links/labels from `Home.sections`, add the necessary About label/anchor support so:

```text
About
```

can be navigated to consistently.

Do not introduce a second navigation/composition data source.

Verify other section navigation remains unchanged.

---

# 10. Portal About Editor

Create an About editor following the current Portal editor patterns.

Controls:

```text
Eyebrow / label        optional
Heading                required
Body                   required multiline Textarea
About image            optional
Image alt text         required when image exists
```

Use existing `@bakerrang/ui` controls.

For media selection/upload, reuse the current polished file-input/media workflow rather than raw browser file input styling.

The editor should support:

- existing About section values
- creating About when absent
- editing About when present
- optional image
- replacing image
- removing image if existing patterns support it cleanly
- Save About

Client-side validation may mirror server limits for UX.

The server remains authoritative.

On save:

- update WORKING site state
- call the normal `onSaved(updatedSiteDefinition)`
- display the existing saved/Republish messaging

Do not create an editor-specific Preview system.

The Publishing card's existing `Preview changes` button is authoritative.

---

# 11. Website Workspace

Add About to the Homepage Content group.

Conceptually:

```text
Homepage Content

Hero
About
Services
Gallery
Testimonials
Contact
```

Do not add FAQ/Hours/Social yet.

Extend `EditorMode` only for About in this slice.

Update Manage Sections labeling so existing About sections display:

```text
About
```

and use the existing responsive reorder/remove controls.

Do not redesign the Website workspace.

---

# 12. Remove / Re-add Behavior

Follow the current Home-section composition semantics.

About must be removable through Manage Sections.

Removal should behave exactly like comparable removable canonical sections.

After removal:

- it no longer renders
- it no longer appears in navigation/composition
- public site remains unchanged until Republish

Re-adding About through the editor/upsert flow should create the canonical About section again.

Do not create a hidden secondary About content store.

---

# 13. Backwards Compatibility

No Firestore migration.

Required behavior:

```text
old site with no About
  -> unchanged

old published snapshot with no About
  -> unchanged

About added to WORKING
  -> Preview sees About
  -> public does not

Republish
  -> public sees About
```

Do not alter:

- Hero
- Services
- Gallery
- Testimonials
- Contact
- BusinessProfile
- Theme
- custom domains
- Preview authorization
- lead behavior

---

# 14. Tests

## Server

Add deterministic coverage for:

- valid About creation
- optional eyebrow
- required heading
- required body
- all length limits
- unknown fields not persisted
- image requires alt text
- alt without image handled consistently
- invalid/non-tenant media rejected
- valid media accepted
- About media hydration
- unresolved stored media degrades to text-only
- canonical `id === type === about`
- max-one About invariant
- default insertion after Hero / before Services
- existing About update preserves current composition order
- removal/re-add behavior
- WORKING vs PUBLISHED isolation
- Republish promotes About
- old snapshots with no About still read normally

## Renderer / site-components

Cover:

- About with image
- About without image
- eyebrow absent/present
- blank-line body splits into semantic paragraphs
- text is escaped normally
- image alt rendered correctly
- Theme primitives/classes are used
- responsive-safe structural output
- renderer SectionRenderer handles About
- navigation/anchor behavior includes About where applicable

## Portal

Cover:

- About editor empty/create state
- existing About values load
- body editing
- client validation
- image selection/upload integration
- imageAlt required when image exists
- save calls About API correctly
- returned SiteDefinition propagates through `onSaved`
- Website workspace exposes About
- Manage Sections shows About label
- existing Preview changes action remains available

---

# 15. Automated Verification

Run:

- all backend tests
- Portal tests
- UI tests
- renderer tests
- site-components/typecheck tests as applicable
- platform typecheck
- platform lint
- server lint
- Portal production build
- renderer production build
- `git diff --check`

Existing unrelated server lint warnings may be reported separately but must not be introduced by this slice.

---

# 16. Explicitly Out of Scope

Do NOT implement in 1.27a:

- FAQ
- Business Hours
- Social Links
- LocalBusiness hours structured data
- LocalBusiness sameAs
- FAQ JSON-LD
- custom CSS
- section background variants
- rich text
- Markdown
- arbitrary HTML
- About page
- arbitrary pages
- drag-and-drop
- inline editing
- production deployment

---

# 17. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. final About schema
4. About validation/media behavior
5. composition behavior
6. public About rendering
7. Portal About editor behavior
8. tests added/updated
9. complete automated verification results
10. manual DEV verification still required
11. any deviations and why