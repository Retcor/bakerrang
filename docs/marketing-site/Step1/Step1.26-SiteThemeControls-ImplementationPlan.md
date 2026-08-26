# Implement Step 1.26 — Site Theme & Styling Controls V1

Implement Step 1.26 for the BakerRang multi-tenant marketing-site platform.

Use Claude's Step 1.26 implementation plan as the primary technical reference, with the decisions and corrections in this assignment taking precedence.

## Goal

Add a controlled V1 tenant website theme system.

The operator should be able to configure:

- Primary color
- Accent color
- Page/background color
- Primary text color
- Heading font
- Body font
- Corner style
- Content width
- Section spacing

Theme changes participate in the existing lifecycle:

1. Edit Theme in Portal.
2. Save to WORKING site.
3. Preview changes using Step 1.25.
4. Public/shared/custom-domain site remains unchanged.
5. Republish.
6. Published site receives the new Theme.

Do not create a new Preview mechanism.

---

# 1. Theme Schema

Add a strongly typed Theme sibling to `SiteDefinition`.

Use approximately:

```ts
export type SiteFont =
  | 'inter'
  | 'poppins'
  | 'montserrat'
  | 'workSans'
  | 'lora'
  | 'merriweather'
  | 'playfair'
  | 'sourceSerif'

export type CornerStyle = 'rounded' | 'soft' | 'square'

export type ContentWidth = 'narrow' | 'standard' | 'wide'

export type SectionSpacing = 'compact' | 'comfortable' | 'spacious'

export interface SiteThemeColors {
  primary: string
  accent: string
  background: string
  text: string
}

export interface SiteTheme {
  colors: SiteThemeColors
  headingFont: SiteFont
  bodyFont: SiteFont
  cornerStyle: CornerStyle
  contentWidth: ContentWidth
  sectionSpacing: SectionSpacing
}
```

Use `cornerStyle`, NOT `buttonStyle`.

The control affects the site's overall shape language, including appropriate buttons, inputs, cards and panels.

Do not expose a separate arbitrary radius value.

`SiteDefinition.theme` should always be present in API responses after read-time normalization/defaulting.

---

# 2. Branding vs Theme

Branding remains identity:

- siteName
- logoMediaId
- hydrated logo information

Theme owns presentation:

- primary color
- accent color
- background color
- text color
- fonts
- corner style
- content width
- section spacing

The existing Branding editor should no longer present primary/accent color controls.

## Legacy color compatibility — IMPORTANT

Existing sites store colors under:

```text
branding.primaryColor
branding.accentColor
```

Do NOT migrate Firestore.

Theme read behavior should resolve colors in this order:

```text
config.theme.colors.primary
    -> config.branding.primaryColor
    -> default primary

config.theme.colors.accent
    -> config.branding.accentColor
    -> default accent
```

Background/text/default enums come from Theme if present, otherwise defaults.

### Critical compatibility case

Do not allow the slimmed Branding editor to erase existing legacy colors.

If an existing site has no stored Theme yet and Branding contains custom primary/accent colors, saving siteName/logo through the new Branding editor must preserve those legacy color fields.

Update `updateSiteBranding()` / branding validation behavior accordingly.

Omitted legacy `primaryColor` and `accentColor` values must NOT be interpreted as "delete these fields."

This allows old tenants to retain their colors until Theme is explicitly saved.

Once Theme exists, Theme is authoritative for rendering.

Legacy branding color fields may remain stored and returned for backwards compatibility but the renderer must use `theme.colors`.

Do not introduce dual-write synchronization between Branding and Theme.

---

# 3. Defaults

Use defaults intended to preserve the existing renderer's appearance as closely as practical:

```text
colors.primary     #334155
colors.accent      #0f766e
colors.background  #f8fafc
colors.text        #172033

headingFont        inter
bodyFont           inter

cornerStyle        soft
contentWidth       standard
sectionSpacing     comfortable
```

Preset mappings:

## Content width

```text
narrow      60rem
standard    72rem
wide        84rem
```

## Section spacing

Approximately:

```text
compact
  mobile  3rem
  desktop 4.5rem

comfortable
  mobile  4rem
  desktop 6rem

spacious
  mobile  6rem
  desktop 8rem
```

## Corner style

Use semantic radius mappings.

For example:

```text
rounded
  normal controls ~0.75rem
  large/card       ~1rem

soft
  normal controls ~0.375rem
  large/card       ~0.75rem

square
  normal controls 0
  large/card       minimal or 0
```

Use reasonable values that preserve the current default appearance closely.

Do not use "pixel identical" or build-byte equality as a verification requirement.

---

# 4. Server Theme Domain

Create a dedicated server theme domain module.

It should own:

- DEFAULT_SITE_THEME
- allowed font values
- allowed corner-style values
- allowed content-width values
- allowed section-spacing values
- hex validation
- read-time theme normalization
- write validation

## Colors

Accept only:

```text
#RRGGBB
```

Normalize valid colors to lowercase.

Reject:

- rgb()
- rgba()
- hsl()
- var()
- url()
- arbitrary CSS
- malformed hex

Unknown input fields should not become persisted arbitrary Theme fields.

## Enums

Reject values outside the approved sets.

The server remains authoritative.

---

# 5. Read-Time Compatibility

Use the existing read-time normalization architecture rather than migrating Firestore.

Working site reads must always receive a full Theme.

Old published snapshots without Theme must also normalize to a full Theme.

For old snapshots/config:

```text
legacy Branding colors
    -> seed Theme primary/accent

missing Theme fields
    -> V1 defaults
```

Publish should require no special Theme code beyond the normal SiteDefinition snapshot flow.

Required isolation:

```text
Publish Theme A
     ↓
Edit WORKING Theme to B
     ↓
Preview = B
Published/shared/custom = A
     ↓
Republish
     ↓
Published/shared/custom = B
```

---

# 6. Theme Update API

Add a Theme mutation equivalent to the existing Branding mutation.

Route:

```text
PUT /tenants/:tenantId/site/theme
```

Keep the authorization policy aligned with the current site CMS/Branding editing policy.

Do not broaden permissions as part of this step.

The service should:

1. validate and normalize Theme input
2. update only the WORKING site config
3. preserve published snapshot isolation
4. return the updated hydrated SiteDefinition

Do not change publish/unpublish APIs.

Do not change Preview APIs.

---

# 7. Renderer Architecture

Reuse and extend the existing scoped `--site-*` theme system.

Desired flow:

```text
SiteDefinition.theme
      ↓
resolveSiteTheme(theme)
      ↓
safe CSS custom-property map
      ↓
.site-shell
      ↓
existing site components
```

Tenant theme values must remain scoped under `.site-shell`.

Do not reuse Portal SaaS tokens.

Do not allow tenant Theme variables to leak to renderer application chrome outside the tenant site.

Do not generate Tailwind classes dynamically from tenant values.

Use static CSS utilities backed by CSS variables.

---

# 8. Renderer Theme Resolver

Create a pure renderer/site-components Theme resolver.

It should produce safe scoped values for:

- primary
- primary foreground
- accent
- accent foreground
- background
- text
- surface
- border
- muted text
- control radius
- large/card radius
- content max width
- section spacing
- heading font
- body font

Only known-safe values derived from validated Theme fields should be emitted.

## Derived foregrounds

Continue using the existing contrast-aware primary/accent foreground calculation.

Primary/accent buttons should automatically get a readable dark or light foreground.

## Surface / Border / Muted

Derive these rather than asking the operator to configure them.

Implement small deterministic color helpers without adding a dependency.

### Muted text accessibility

Do NOT assume a fixed color-mix ratio guarantees readable muted text.

After deriving the initial muted tone, calculate its contrast against the selected background/surface.

If necessary, move the muted color toward the primary text color until it meets an appropriate normal-text contrast threshold.

The resolver should produce stable results for both light and dark Theme combinations.

Borders do not need text-level WCAG contrast.

---

# 9. Site Component Integration

Extend `site-theme.css` and the existing site primitives instead of replacing the architecture.

Add static semantic CSS-variable-backed utilities for:

- content width
- section spacing
- normal radius
- large/card radius
- heading font
- body font

Replace current fixed utilities where appropriate.

Examples:

```text
SiteContainer
  max-w-6xl
    -> theme-aware content width

SiteSection
  fixed py-*
    -> theme-aware section spacing

Hero
  slightly larger themed section spacing

Buttons / inputs
  fixed rounded-*
    -> normal theme radius

Cards / panels
  fixed rounded-xl/2xl
    -> large theme radius

Headings
  -> heading font

.site-shell
  -> body font
```

Do not change component behavior or public component APIs unless actually required for Theme plumbing.

---

# 10. Content Width Scope

The selected content width should apply consistently anywhere the shared tenant `SiteContainer` is used, including:

- header
- footer
- Hero/content sections
- public site content

Do not create separate header/footer width controls.

---

# 11. Section Spacing Scope

Section spacing should apply to:

- normal sections
- Hero, with an appropriate Hero-specific larger/scaled treatment

Do NOT use the section-spacing setting to arbitrarily retune:

- header height
- footer padding
- navigation controls

Those can remain intentional component-level values.

---

# 12. Fonts

Use the approved curated list:

```text
Inter
Poppins
Montserrat
Work Sans
Lora
Merriweather
Playfair Display
Source Serif 4
```

Map these to the schema keys:

```text
inter
poppins
montserrat
workSans
lora
merriweather
playfair
sourceSerif
```

Use `next/font/google` in the renderer so these are self-hosted by the built application.

No tenant-provided font URLs.

No arbitrary font uploads.

No runtime Google Fonts calls.

## Loading strategy

Set:

```text
preload: false
```

for the curated tenant font families.

Do not preload Inter globally just because it is the default, since a tenant choosing two other fonts should not unnecessarily download Inter through a preload.

Use `display: 'swap'` and sensible fallback stacks.

Attach the required font CSS-variable classes at the renderer application root.

The browser should then fetch font resources actually used by the selected Theme.

## Portal font selector

Use readable plain font names in the dropdown/select.

Do NOT rely on native `<option>` elements rendering reliably in their own font across browsers.

Instead, show the selected heading/body fonts in the Theme editor's local preview panel.

---

# 13. Portal Theme Editor

Add Theme under the Website Design/Site Foundation area alongside Branding.

Use the Portal design system from Step 1.24.

Controls:

## Colors

Four fields:

- Primary
- Accent
- Background
- Text

Use:

- color picker
- synchronized hex input

Validate `#RRGGBB` client-side for UX while retaining authoritative server validation.

## Fonts

Two selects:

- Heading font
- Body font

Use readable family names.

## Corner Style

Three choices:

- Rounded
- Soft
- Square

Explain or visually demonstrate that this changes the overall site corner treatment, not just one button.

## Content Width

- Narrow
- Standard
- Wide

## Section Spacing

- Compact
- Comfortable
- Spacious

## Reset

Provide `Reset to defaults`.

Reset should update the form only.

It does not persist until `Save Theme` is pressed.

## Save

`Save Theme` updates WORKING Theme.

Use the existing saved/Republish messaging.

## Preview

Do NOT create a new Preview button/architecture.

The existing Publishing-card `Preview changes` action from Step 1.25 already renders the saved WORKING Theme.

Editor copy may remind the operator to Save, then use Preview changes.

---

# 14. Theme Editor Local Preview

A small local Theme sample is appropriate.

It may show:

- selected page/background color
- heading sample using heading font
- body sample using body font
- primary button
- accent element
- card/panel
- selected corner treatment

This is only a quick form-level sanity preview.

It is NOT the actual website Preview.

The Step 1.25 renderer Preview remains authoritative.

---

# 15. Contrast UX

Compute text/background contrast in the Portal Theme editor.

If the selected text/background contrast is under 4.5:1, show a non-blocking warning such as:

```text
This text may be difficult to read on the selected background.
```

Do NOT prevent Save solely because the combination has poor contrast.

The operator may intentionally choose a combination for reasons not captured by this simple check.

Primary/accent foreground colors remain renderer-derived and should remain readable automatically.

---

# 16. Branding Editor Transition

Remove Primary Color and Accent Color controls from the Branding editor.

Branding should now edit identity only:

- site name
- logo

Do not change existing logo/media behavior.

Ensure the backend compatibility handling described earlier prevents a Branding save from deleting the site's legacy colors before Theme has been persisted.

---

# 17. Section Backgrounds — DEFERRED

Do NOT implement per-section appearance/background controls in Step 1.26.

Do not add:

```text
appearance: default | muted | accent | dark
```

to section schemas yet.

This is intentionally deferred until the global Theme system is proven.

Keep the architecture extensible so section-background variants can consume Theme-derived tokens later without adding arbitrary new colors.

---

# 18. Backwards Compatibility

No Firestore migration.

Required behaviors:

- existing site with no Theme renders correctly
- existing legacy Branding colors seed Theme primary/accent
- old published snapshot with no Theme renders correctly
- partial/malformed stored Theme does not crash rendering; normalize/default safely on reads
- saving Branding identity does not erase old legacy colors
- Theme save does not alter the existing published snapshot
- Republish copies Theme into the published snapshot

---

# 19. Tests

## Server

Cover:

- DEFAULT_SITE_THEME shape
- valid Theme validation
- invalid colors
- each invalid enum
- lowercase normalization
- unknown fields not persisted
- no Theme -> defaults
- no Theme + legacy Branding colors -> seeded primary/accent
- partial Theme -> full normalized Theme
- Branding save preserves omitted legacy color fields
- Theme update persists only WORKING Theme
- publish A -> edit Theme B -> public remains A
- Preview/working reads B
- republish -> public B
- old published snapshot without Theme -> valid normalized Theme
- route authz and invalid input behavior

## Renderer

Cover:

- default Theme -> expected default CSS variables
- custom colors -> expected variables
- foreground contrast
- muted text contrast behavior
- light background Theme
- dark background Theme
- cornerStyle mappings
- contentWidth mappings
- sectionSpacing mappings
- font enum mappings
- emitted style object contains only expected safe CSS variables/values
- old/default sites render successfully
- Preview fetch/render gets WORKING Theme
- published routes get PUBLISHED Theme

Do not use byte-identical or pixel-identical builds as a deterministic test requirement.

## Portal

Cover:

- ThemeEditor loads current values
- color controls synchronize
- invalid hex rejected client-side
- Save sends expected Theme
- `onSaved` receives result
- font selections
- corner/content-width/spacing selections
- Reset changes form but does not persist automatically
- low-contrast warning appears
- warning does not prevent Save
- Branding editor no longer shows color inputs
- existing Preview changes action remains available

---

# 20. Automated Verification

Run all existing:

- backend tests
- Portal tests
- UI tests
- renderer tests

Run:

- server lint
- platform typecheck
- platform lint
- Portal production build
- renderer production build

Verify:

- Portal tokens remain isolated
- tenant Theme tokens remain renderer/site-shell scoped
- no runtime Tailwind generation
- no public/custom-domain/preview architecture regressions

---

# 21. Manual Verification Still Required

After implementation, DEV verification will include:

1. Open an existing tenant with legacy Branding colors and no stored Theme.
2. Confirm Theme editor initially reflects those existing colors.
3. Save Branding name/logo only and confirm colors do not change.
4. Change Theme colors/fonts/corner style/width/spacing.
5. Save Theme.
6. Preview changes.
7. Confirm Preview shows the new Theme.
8. Confirm `custom-dev.bakerrang.com` still shows the old published Theme.
9. Check Preview on mobile.
10. Republish.
11. Confirm custom domain now uses the new Theme.
12. Confirm selected fonts load correctly.
13. Confirm dark and light color combinations remain usable.

---

# 22. Explicit Scope Exclusions

Do NOT implement:

- per-section background variants
- custom CSS
- arbitrary font uploads
- tenant-supplied font URLs
- per-element styling
- arbitrary numeric radius
- arbitrary numeric width
- arbitrary numeric spacing
- gradients/effects system
- animations system
- header/footer builder
- arbitrary page layouts
- drag-and-drop
- inline site editing
- About
- FAQ
- Business Hours
- Social Links
- arbitrary pages
- production deployment

Those remain future roadmap work.

---

# 23. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. final Theme schema
4. legacy Branding compatibility behavior
5. renderer Theme/CSS-variable architecture
6. font loading strategy
7. Portal Theme-editor behavior
8. tests added/updated
9. complete automated verification results
10. manual DEV verification still required
11. any deviations and why