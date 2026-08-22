# Planning Task — Step 1.26: Site Theme & Styling Controls V1

We are continuing the BakerRang multi-tenant marketing-site platform.

Do NOT implement anything. Produce a detailed implementation plan only.

## Goal

Add a controlled V1 theme/styling system for tenant public websites.

The operator should be able to customize the site's overall visual identity without turning BakerRang into a full page builder.

Theme changes must participate in the existing WORKING vs PUBLISHED model:

1. Edit theme settings in the Portal.
2. Save to WORKING site state.
3. Preview changes using the existing Step 1.25 Preview feature.
4. Republish when satisfied.
5. Public/custom-domain sites change only after publish.

## Product Direction

We want useful customization, but NOT "the kitchen sink."

Initial controls should cover approximately the following.

### Colors

- Primary / brand color
- Secondary or accent color if the existing renderer architecture justifies it
- Page/background color
- Primary text color

Avoid exposing dozens of low-level color tokens.

Derive secondary states where possible:

- hover
- active
- muted backgrounds
- borders
- button foreground

Do not require the user to configure every derived color manually.

### Typography

- Heading font
- Body font

Prefer a curated list of supported fonts.

Do NOT support arbitrary font uploads in this step.

The plan must address how fonts are loaded efficiently and safely in Next.js / the public renderer.

### Buttons

Provide a small Button Style control, for example:

- Rounded
- Soft / moderately rounded
- Square / minimal radius

Do not expose per-button styling.

### Shape / Radius

Determine whether button/card radius should be:

- one global theme control, or
- derived from the selected button/style preset

Prefer the simpler UX.

### Content Width

Provide a small set of options such as:

- Narrow
- Standard
- Wide

Avoid arbitrary pixel input.

### Section Spacing

Provide a small set such as:

- Compact
- Comfortable
- Spacious

This should affect vertical section rhythm consistently.

### Section Backgrounds

Provide a controlled mechanism for sections to choose from theme-aware styles such as:

- Default
- Muted
- Accent
- Dark

Do NOT expose arbitrary background colors on every section in V1 unless the existing architecture strongly suggests otherwise.

The plan should determine whether this belongs in Step 1.26 globally or whether per-section selection should be introduced incrementally.

## Existing Architecture to Inspect

Please inspect the actual current code before planning.

Relevant areas include:

- `platform/apps/portal`
- `platform/apps/site-renderer`
- `platform/packages/site-components`
- `platform/packages/site-schema`
- backend site definition/service/routes
- existing Branding editor/model
- current `site-theme.css`
- existing `SiteShell`
- existing renderer CSS variables
- working/published snapshot implementation
- Step 1.25 Preview flow

Important known constraint:

The Portal and renderer have intentionally isolated design systems.

Do NOT mix Portal SaaS tokens with tenant website theme tokens.

Tenant website styling belongs to the public-site theme architecture.

## Current Branding vs New Theme Model

Inspect the existing Branding model carefully.

Determine:

- what branding fields already exist
- which fields should remain Branding
- which styling fields should become a new Theme model
- whether Branding and Theme should be separate sibling objects in `SiteDefinition`
- whether any existing field should be migrated or simply read with backwards-compatible defaults

Prefer clear separation such as:

### Branding
- site name
- logo
- identity/content-related brand fields

### Theme
- colors
- typography
- shape
- spacing
- layout/presentation

Do not mix structured business identity into presentation settings.

## Schema Requirements

The theme must be represented in the shared site schema and survive:

```text
WORKING
  -> Preview
  -> Publish snapshot
  -> Public renderer
````

Plan a strongly typed V1 theme structure.

Prefer constrained enums/presets where appropriate rather than arbitrary strings.

For example, conceptually:

```ts
theme: {
  colors: {
    primary: string
    background: string
    text: string
  }

  typography: {
    headingFont: ...
    bodyFont: ...
  }

  buttonStyle: ...
  contentWidth: ...
  sectionSpacing: ...
}
```

Do NOT blindly adopt that exact shape; inspect the existing architecture and recommend the cleanest model.

## Validation

Plan server-side validation for all theme input.

For colors:

* determine acceptable format
* normalize consistently
* reject malformed values

Consider accessibility:

* do not promise that arbitrary color combinations are always accessible
* determine whether the Portal should warn or prevent obviously unreadable combinations
* at minimum ensure generated button foreground/derived colors remain usable

Do not build a large accessibility analysis engine in this step.

## Backwards Compatibility

Existing tenants without a theme must continue rendering exactly or nearly exactly as they do today using explicit default theme values.

Avoid a Firestore migration if read-time/default behavior is sufficient.

Published snapshots created before Step 1.26 must remain renderable.

## Renderer Architecture

The renderer should apply the theme using a scoped CSS-variable system around the tenant site.

Prefer something conceptually like:

```text
SiteDefinition.theme
      ↓
theme resolver
      ↓
validated CSS variables / classes
      ↓
SiteShell
      ↓
all site-components
```

Avoid:

* inline arbitrary CSS from normal theme controls
* generated Tailwind class names that require runtime compilation
* leaking tenant theme variables outside the site shell
* Portal token reuse

Inspect `site-theme.css` and determine how to evolve the existing `--site-*` variables rather than replacing the architecture unnecessarily.

## Font Architecture

This needs special attention.

We want curated tenant-selectable fonts.

Plan how fonts should work with:

* Next.js renderer
* server rendering
* build-time availability
* no arbitrary external user URLs
* performance

Recommend an initial curated font list.

Keep it small, perhaps around 6–10 useful families covering:

* clean sans
* modern sans
* geometric sans
* traditional serif
* modern serif

Do not add dozens of fonts.

## Portal UX

Add Theme/Design controls to the Website workspace.

The UX should fit the polished Portal created in Step 1.24.

Likely structure:

```text
Website
  Content
  ...
  Design
    Branding
    Theme
```

Theme editing should include an obvious:

```text
Preview changes
```

workflow using the existing Step 1.25 Preview feature.

Do not create a separate preview implementation.

Consider:

* color input UX
* optional hex entry
* font dropdowns with readable names
* preset/select controls for width/spacing/button style
* clear Save behavior
* reset/default behavior

Do not implement live inline visual editing.

## Section Backgrounds

Inspect the existing section composition/schema.

Determine the smallest clean architecture for allowing sections to use theme-aware background variants.

If introduced in 1.26, preserve section ordering/removal behavior.

Prefer a field such as a constrained style variant over raw CSS.

Example concept only:

```ts
appearance: 'default' | 'muted' | 'accent' | 'dark'
```

Determine whether all section types should support it or whether some should retain fixed presentation.

## Preview Integration

No new preview architecture is required.

Confirm that because Preview reads the WORKING `SiteDefinition`, theme changes will automatically appear there once the renderer consumes the theme.

Required behavior:

* save theme
* Preview shows theme immediately
* shared/custom public routes remain on old theme
* Republish updates public/custom site

## Testing

Plan deterministic coverage for the following.

### Schema / Server

* defaults for old sites
* valid theme mutation
* invalid colors/enums rejected
* working theme isolated from published snapshot
* publish copies theme
* old snapshots still render

### Renderer

* theme -> expected CSS variables/classes
* default theme remains stable
* font selection mapping
* width/spacing/button-style variants
* section background variants if included
* no unsafe arbitrary CSS injection
* Preview uses working theme
* public renderer uses published theme

### Portal

* Theme editor renders current/default values
* changes save correctly
* validation errors
* preset controls
* Preview action remains usable

Also include manual DEV verification at:

* desktop
* mobile
* shared renderer
* custom-dev domain
* Preview

## Scope Exclusions

Do NOT implement:

* custom CSS (Step 1.28)
* arbitrary font uploads
* per-element controls
* animations
* gradients/effects system
* arbitrary spacing numeric inputs
* arbitrary page layouts
* header/footer builder
* drag-and-drop
* inline site editing
* About
* FAQ
* Business Hours
* Social Links
* arbitrary pages
* production deployment

## Output

Return:

1. Current-state findings
2. Recommended Theme schema
3. Branding vs Theme boundary
4. Default theme values
5. Font strategy and proposed curated fonts
6. Renderer/CSS-variable architecture
7. Portal Theme-editor UX
8. Section-background recommendation
9. API/schema/service changes
10. Exact files likely created/modified
11. Backwards-compatibility strategy
12. Security/validation considerations
13. Testing plan
14. Incremental implementation sequence
15. Human decisions genuinely required

Favor constrained, extensible V1 design over a large styling system.