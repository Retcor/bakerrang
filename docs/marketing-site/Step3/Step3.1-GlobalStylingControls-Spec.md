# Step 3.1 Planning — Theme & Global Styling Controls

Planning/read-only only.

Do NOT modify files.
Do NOT deploy.
Do NOT mutate Firestore.
Do NOT mutate GCP.
Do NOT modify Git state.
Do NOT create commits.

Step 3.0 is COMPLETE, deployed, transitioned, and manually verified.

Step 3.1 begins the visual-design portion of Phase 3.

The goal is to make BakerRang marketing sites substantially more customizable
and visually distinct through a coherent GLOBAL THEME model.

This is NOT a low-level CSS editor.
This is NOT per-section visual customization.
This is NOT a WYSIWYG page builder.

We want a constrained design system that gives operators meaningful creative
control while keeping generated sites consistent, responsive, accessible, and
easy to maintain.

---

# Phase 3 roadmap context

Completed:

3.0 Site Editor V2 / Section Architecture
- opaque section instance IDs
- multiple same-type section instances
- Add / Edit / Move / Duplicate / Hide / Delete
- exact-instance editing
- working/published isolation
- race-safe media behavior
- Portal Homepage Section Manager

Upcoming direction:

3.1 Theme & Global Styling Controls        ← NOW
3.2 Expanded Section Library
3.3 Multi-Page Sites
3.4 Header / Navigation / Footer Editor
3.5 SEO / Social Sharing Controls
3.6 Templates / Site Presets
3.7 Published Site Revision History
3.8 Lead Notifications
3.9 Audit Log
3.10 Export / Account Lifecycle

Marketing/signup remains intentionally later.

---

# Current product posture

There are still no real customer marketing sites whose current theme schema must
be preserved.

Marketing-site test data may be reset/reseeded if a cleaner theme model requires
a breaking change.

Do NOT introduce permanent compatibility machinery merely for existing marketing
test data.

However:

The MAIN Firestore project also contains real data for unrelated legacy BakerRang
applications.

Never recommend broad Firestore cleanup or database recreation.

Any marketing-site reset/migration must remain narrowly scoped to the relevant
tenant/site documents.

---

# Core Step 3.1 product goal

After Step 3.1, two sites with the same section composition/content should be
able to look materially different through Theme settings alone.

An operator should be able to control broad visual language such as:

- brand colors
- page/background colors
- typography
- button treatment
- border radius / shape language
- section spacing / density
- possibly section surface treatment

without:

- editing raw CSS
- choosing arbitrary CSS properties
- controlling individual component internals
- producing unreadable/inaccessible combinations
- needing developer knowledge

The existing Custom CSS feature remains the advanced escape hatch.

Theme settings should cover the common 80–90% use case.

---

# Important design philosophy

Prefer DESIGN TOKENS over component-specific properties.

For example, prefer concepts such as:

theme.colors.primary
theme.colors.accent
theme.colors.background
theme.colors.surface
theme.colors.text
theme.typography.headingFont
theme.typography.bodyFont
theme.shape.radius
theme.spacing.section

rather than:

heroBackgroundColor
serviceCardBorderRadius
galleryHeadingFontSize
contactButtonPadding
faqBorderColor

The sections/components should consume a shared visual system.

A new section added in Step 3.2 should naturally inherit the global Theme
without requiring dozens of new theme fields.

---

# 1. Audit current Theme architecture

Inspect the CURRENT repository after Step 3.0.

Identify:

- current theme schema in site-schema
- current Firestore theme storage
- current Theme editor in Portal
- renderer theme handling
- site-components styling patterns
- Tailwind/CSS variables/custom CSS architecture
- existing hard-coded colors/fonts/radii/spacing
- defaults
- published/working behavior
- theme hydration/read sanitization if applicable

List exact files involved.

Determine how sophisticated the existing Theme feature actually is.

Do not assume it is minimal merely because Step 3.1 is about Theme.

---

# 2. Inventory visual styling today

Audit all current public site components:

- SiteShell
- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Business Hours
- Contact
- shared primitives
- navigation/header if currently present
- buttons
- cards
- headings
- body text
- forms

Produce a useful inventory of:

- colors
- backgrounds
- typography
- border radius
- borders
- shadows
- spacing
- buttons
- layout widths
- section padding

Identify which values are:

A. already theme-driven
B. Tailwind/static design choices
C. duplicated across components
D. good candidates for global tokens
E. intentionally component-specific

We do NOT need every Tailwind class turned into a theme setting.

---

# 3. Recommend the long-term Theme model

Design the clean Theme schema we should establish before real customers exist.

Prefer a small, durable token model.

Strongly evaluate categories such as:

colors
typography
shape
spacing
buttons

Conceptually:

theme: {
colors: {
primary: "...",
accent: "...",
background: "...",
surface: "...",
text: "...",
mutedText: "...",
border: "..."
},
typography: {
headingFont: "...",
bodyFont: "...",
headingWeight: ...
},
shape: {
radius: ...
},
spacing: {
section: ...
},
buttons: {
style: ...
}
}

This is ONLY conceptual.

Inspect the existing architecture and recommend the actual model.

Avoid storing raw CSS values everywhere if semantic enums/tokens are better.

---

# 4. Color system

Determine which global color controls genuinely add value.

At minimum evaluate:

- primary / brand
- accent
- page background
- surface/card background
- main text
- muted text
- border
- button text / contrast color

But do not expose unnecessary colors if some can be derived safely.

Strongly consider whether some colors should be automatically derived from a
smaller palette.

For example:

primary
accent
background
text

could potentially derive:

surface
border
muted text
hover
focus

Analyze the tradeoff between:

A. fewer inputs + automatic derivation
B. more explicit operator control

Prefer a sensible constrained system over a Photoshop-style palette.

---

# 5. Color accessibility / contrast

This is important.

Operators should not easily create:

yellow text on white
dark gray text on black
unreadable button labels

Determine whether the Theme system should:

A. reject insufficient contrast
B. automatically choose foreground text colors
C. warn but allow
D. combine these strategies

Consider WCAG contrast guidance for:

- normal text
- large text
- button text
- links
- focus indicators

Do not build an enormous accessibility engine.

Recommend a pragmatic implementation.

If colors are derived, explain how contrast-safe foregrounds should be selected.

---

# 6. Color input UX

Audit existing UI primitives.

Determine the appropriate Portal controls:

- native color picker?
- text hex input?
- swatch picker?
- preset palette?
- combination?

Strong preference:

A practical operator should be able to:

- visually pick a color
- paste/type a hex color
- see immediate preview/swatches

Do not add a huge color-picker dependency unless needed.

Validate canonical format.

Recommend:

- accepted format
- normalized storage format
- invalid value behavior

---

# 7. Typography model

Determine what typography controls Step 3.1 should expose.

Strongly consider:

- Heading font family
- Body font family
- Heading weight/style preset

Avoid exposing:

- arbitrary font sizes for every heading
- arbitrary line heights
- letter-spacing fields everywhere

The site-components should continue owning a coherent type scale.

Theme should choose the typography personality, not micromanage every element.

---

# 8. Font source strategy — IMPORTANT

Determine how fonts should actually be supplied.

Options may include:

A. system font stacks only
B. bundled open-source fonts
C. Google Fonts runtime requests
D. Next.js font support / self-hosted subsets
E. curated enum of supported font families

Evaluate:

- privacy
- performance
- caching
- Cloud Run deployment
- renderer implementation
- dynamic tenant selection
- CSP implications if any
- build-time vs runtime availability

Strong preference:

a CURATED font list.

Do NOT allow arbitrary font URLs or arbitrary CSS font-family strings.

If dynamic use of `next/font` is incompatible with tenant-selected runtime
fonts, explain the constraint and recommend the appropriate alternative.

Do not assume Google Fonts is automatically best.

---

# 9. Font pairing UX

Consider whether Portal should expose:

Heading font
Body font

independently, or provide curated pairs/presets.

For example:

Modern
Classic
Friendly
Bold
Professional

could map to font combinations.

Determine whether Step 3.1 should support:

A. individual curated font selectors
B. curated font pair presets
C. both

Avoid overwhelming the user.

Recommend the smallest useful UX.

---

# 10. Typography scale

Audit current heading/body sizing.

Determine whether the existing responsive type scale should remain component/
design-system owned.

Strong preference:

Theme does NOT expose:

H1 px
H2 px
body px
mobile H1 px
line-height
etc.

Unless there is a compelling existing reason.

The global Theme should influence style, while responsive sizing remains
controlled by BakerRang.

Call out any hard-coded typography that should move into CSS tokens.

---

# 11. Shape / border-radius system

Evaluate exposing a global shape personality.

Possible UX:

Square
Slightly rounded
Rounded
Pill / Soft

Rather than asking the operator for:

12px

Consider how this should apply to:

- cards
- buttons
- inputs
- images
- badges

Some elements may intentionally differ.

Recommend semantic token(s), for example:

radius-sm
radius-md
radius-lg
radius-button

derived from one style preset.

Avoid per-component radius controls.

---

# 12. Button style

Determine what useful global button treatment controls belong in Step 3.1.

Possibilities:

Shape:
- square
- rounded
- pill

Treatment:
- solid
- outline
- soft

But be careful not to create incompatible combinations or overcomplicate the
schema.

Buttons must remain:

- readable
- consistent
- accessible
- hover/focus capable

Determine whether button appearance can derive mostly from:

primary color
shape preset

without a separate button-style setting.

Recommend the smallest meaningful model.

---

# 13. Section spacing / density

Evaluate a global spacing control.

Potential choices:

Compact
Comfortable
Spacious

This could influence section vertical padding and possibly component gaps.

Prefer semantic enum:

compact
comfortable
spacious

over raw pixel values.

Audit current section padding/gaps and determine whether a shared CSS variable or
component primitive can centralize it.

Do not expose arbitrary margins/padding per section in Step 3.1.

---

# 14. Surface / section treatments

Consider whether global Theme should include a concept such as:

surfaceStyle:
- flat
- cards
- elevated

or:

sectionStyle:
- clean
- separated
- soft

Only include this if it maps cleanly across existing components.

Do NOT force every section into cards just to expose a toggle.

If this belongs later, defer it.

---

# 15. Light/dark concepts

Do NOT automatically assume we need a full dark-mode system.

Analyze whether Step 3.1 should support:

A. arbitrary background/text colors only
B. a Light/Dark base mode plus brand colors
C. curated light/dark Theme presets
D. no explicit mode concept

Consider:

- site operator intent
- derived contrast
- section components
- form inputs
- navigation
- cards
- media backgrounds

Recommend the cleanest model.

We are theming the public WEBSITE, not the BakerRang Portal UI.

---

# 16. Theme presets

Determine whether Step 3.1 should include a small number of BASE THEME presets.

Examples:

Modern
Classic
Warm
Bold
Minimal

A preset could initialize:

colors
fonts
shape
spacing

while still allowing the operator to edit individual Theme controls.

This is NOT Step 3.6 Templates.

Distinguish clearly:

Theme preset:
visual design tokens

Site template:
page structure + sections + starter content + theme

If a few presets would materially improve usability, recommend them.

Do not build a large preset marketplace.

---

# 17. Theme reset/default behavior

Design:

- Reset Theme
- Restore Default
- Apply preset

Determine how reset interacts with working/published state.

Expected:

Theme edits modify WORKING
Live remains PUBLISHED
Preview reflects WORKING
Publish makes Theme live

Reset should not immediately alter the public site before Publish.

Consider whether applying a preset should require confirmation if it overwrites
current Theme values.

---

# 18. Theme storage

Inspect current storage.

Determine whether Theme belongs:

- in `site/config`
- another document
- SiteDefinition
- published snapshot

Preserve the existing working/published architecture.

Theme should snapshot naturally during publish.

Do not introduce another independent publishing mechanism.

If current Theme data is embedded in config and snapshots already, prefer that.

---

# 19. Theme API / backend

Audit current Theme mutation endpoint/service.

Determine whether the current API can support the new model cleanly.

Strong preference:

one validated Theme update

rather than one endpoint for each token.

For example:

PUT /tenants/:id/site/theme

with a complete/validated Theme object may be appropriate if that matches
existing conventions.

But inspect current code first.

Requirements:

- tenant scoped
- current site-edit auth
- working only
- validation
- no arbitrary CSS injection
- no font URL injection
- no unknown token storage
- published untouched until Publish

Determine whether partial PATCH or full-state PUT is cleaner.

---

# 20. Schema validation

Design strict validation for Theme.

At minimum:

Colors:
- valid canonical representation
- no arbitrary CSS expressions if unnecessary

Fonts:
- enum/allowlist only

Enums:
- valid shape
- valid spacing
- valid button style/preset

Unknown fields:
- reject or strip based on current conventions

Do NOT accept:

url(...)
var(...)
expression(...)
arbitrary HTML/CSS
remote font URLs

from normal Theme fields.

Custom CSS remains the explicit advanced escape hatch.

---

# 21. CSS variable/token architecture

Strongly evaluate rendering Theme through CSS custom properties.

Conceptually:

--br-color-primary
--br-color-accent
--br-color-background
--br-color-surface
--br-color-text
--br-color-muted
--br-color-border

--br-font-heading
--br-font-body

--br-radius-sm
--br-radius-md
--br-radius-lg

--br-section-padding

Then public components consume semantic variables.

Advantages to evaluate:

- tenant-specific runtime themes
- no dynamic Tailwind class generation
- simpler renderer
- future section types inherit automatically
- custom CSS can intentionally override variables

Audit whether this fits the existing site-components architecture.

Recommend naming conventions.

Do not expose raw implementation variable names to the stored schema unless
necessary.

Schema token:
theme.colors.primary

Renderer mapping:
--br-color-primary

is preferable.

---

# 22. Tailwind interaction

Inspect how site-components currently use Tailwind classes.

Important:

Tenant-selected values cannot safely be represented by dynamically-generated
Tailwind class names such as:

bg-[${tenantColor}]

if Tailwind cannot statically discover them.

Prefer inline CSS variables on the root + static Tailwind classes that reference
those variables where appropriate.

Audit current tooling/build behavior.

Recommend a robust approach.

---

# 23. Theme application root

Determine where Theme variables/classes should be applied.

Strong candidates:

SiteShell root
or
another top-level public-site wrapper

Requirements:

- applies consistently to all sections
- works in normal public rendering
- works in Preview
- works for `/contact`
- future multi-page routes can reuse it
- avoids applying theme separately in every section

Identify the exact existing component best suited for this.

---

# 24. Section/component refactor

Determine which public components must change to consume Theme tokens.

Produce a table:

Component
Current hard-coded style
Proposed token
Change required

Do not move every cosmetic detail into Theme.

Examples of likely design-system-owned details that may remain static:

- responsive grid breakpoints
- max-width
- image aspect ratios
- layout structure
- type scale ratios

Examples likely theme-driven:

- foreground/background
- fonts
- button colors
- border colors
- radius
- section vertical spacing

---

# 25. Custom CSS interaction

Custom CSS already exists.

Theme and Custom CSS need a clear precedence model.

Recommend:

base component styles
→ Theme CSS variables
→ Custom CSS override

or whatever the actual architecture supports.

Important:

Custom CSS should remain powerful enough to override Theme intentionally.

Theme changes should not erase Custom CSS.

Custom CSS should not be stored inside Theme.

Document the stable styling hooks operators should use where relevant:

[data-br-section="<type>"]
[data-br-section-id="..."]

Theme tokens/CSS variables may also become useful advanced hooks.

Determine whether exposing documented `--br-*` variables is desirable.

---

# 26. Portal Theme editor UX

Audit the existing ThemeEditor.

Recommend the new layout.

Prefer grouped controls rather than one enormous form.

Potential structure:

Theme

Colors
Brand color
Accent color
Background
Text

Typography
Heading font
Body font

Shape
Roundedness

Spacing
Section spacing

[Reset to default]

Do not overbuild tabs if a single responsive form works.

Determine whether live color swatches/previews are useful.

---

# 27. Theme preview inside Portal

Important distinction:

Do NOT build the full WYSIWYG preview system in Step 3.1.

Existing Preview already renders WORKING state in the real renderer.

Determine whether the Theme editor should include only small illustrative
previews such as:

- palette swatches
- sample heading/body
- sample button
- sample card

These could help without reproducing the actual site.

If that adds substantial complexity, rely on Preview Changes instead.

Recommend the best balance.

---

# 28. Save behavior

Determine whether Theme editor should:

A. stage all changes locally and Save
B. autosave every token change
C. combination

Strong preference:

retain the current explicit Save editing pattern unless the existing ThemeEditor
already does otherwise.

Color pickers firing network writes on every mouse movement are undesirable.

Possible UX:

local form state
→ preview swatches locally
→ Save Theme
→ working state updates
→ Preview Changes

Do not invent autosave unless clearly justified.

---

# 29. Dirty-state behavior

Theme editor should integrate with the existing Portal dirty-navigation guard.

Verify:

- changing a color marks dirty
- changing font marks dirty
- Reset/preset modifications mark dirty until saved
- leaving Theme prompts before discarding
- Publish/Preview behavior while unsaved remains consistent with current Portal

Do not regress the Step 3.0 navigation guard.

---

# 30. Working / published matrix

Explicitly document:

Theme edit before Save
Theme after Save
Preview
Live
Publish
Reset

Expected pattern:

local form edit:
Portal only

Save:
WORKING updated

Preview:
WORKING Theme rendered

Live:
still PUBLISHED Theme

Publish:
working Theme becomes live

Verify actual architecture supports this.

---

# 31. Favicon/branding separation

Existing Branding includes things such as:

logo
favicon

and potentially brand/business identity.

Decide which visual properties belong in:

Branding

versus:

Theme

Strong likely boundary:

Branding:
- logo
- favicon
- identity/media assets

Theme:
- colors
- fonts
- shape
- spacing

If the current Branding editor already owns colors, determine whether they should
move to Theme in Step 3.1.

Avoid duplicate controls.

---

# 32. Business profile separation

Theme must not absorb business content.

Keep:

name
phone
email
hours
address
social profiles

outside Theme.

Theme should describe presentation only.

---

# 33. Accessibility beyond contrast

Audit Theme effects on:

- focus ring visibility
- link distinction
- form field borders/backgrounds
- disabled controls if public form has them
- button hover/focus states
- muted text

Theme variables should not make keyboard focus invisible.

Determine which states should be automatically derived rather than operator
controlled.

---

# 34. Theme presets vs raw customization

Make a final recommendation whether 3.1 includes:

- no presets
- a small set of presets
- presets plus individual controls

If presets are included, define 3–5 useful conceptual examples, but do not spend
time designing a huge library.

Preset application should populate normal Theme tokens, not create a parallel
theme mode that components branch on.

---

# 35. Data transition

Because marketing-site data is still disposable, a breaking Theme schema is
allowed if it materially improves the model.

If current test Theme documents conflict with the recommended schema:

recommend the simplest transition.

Prefer:

- reset Theme field to new defaults
  or
- narrowly transform `site/config.theme`

Do not migrate unrelated site content if unnecessary.

Explicitly identify Firestore paths involved.

Do NOT perform transition during planning or implementation.

---

# 36. Performance

Evaluate:

- additional CSS size
- font loading
- runtime theme generation
- renderer SSR
- browser caching
- layout shift from fonts
- external font requests

The Theme system should not introduce a separate generated stylesheet per tenant
unless strongly justified.

Prefer lightweight runtime CSS variables.

---

# 37. Security

Audit Theme-related attack surface.

Normal Theme fields must not enable:

- CSS injection
- javascript URLs
- arbitrary remote stylesheets
- arbitrary font URLs
- HTML injection

Custom CSS already has a separate explicit trust model; do not accidentally
expand that trust boundary through Theme.

---

# 38. Tests

Design deterministic tests.

Schema/server:

- valid theme accepted
- invalid colors rejected
- unknown fonts rejected
- invalid enum rejected
- unknown field behavior
- working/published isolation
- publish snapshots exact theme
- tenant isolation
- Reset/default if backend-supported
- preset representation if stored server-side

Renderer/site-components:

- root receives correct CSS variables
- colors map to tokens
- heading/body font tokens
- radius mapping
- spacing mapping
- Preview uses working Theme
- public uses published Theme
- Contact page uses same Theme
- components do not need tenant-specific dynamic Tailwind classes
- no unsafe raw CSS interpolation

Portal:

- Theme editor seeds from working Theme
- color controls
- invalid value handling
- font selectors
- shape selector
- spacing selector
- preset application if included
- reset
- dirty-state detection
- Save
- server error
- working/live explanatory behavior
- no duplicate Branding color controls
- accessible labels

Accessibility:

- derived foreground remains readable for representative light/dark primaries
- focus token remains distinguishable
- contrast helper behavior if implemented

Do not add brittle visual screenshot tests unless already conventional.

---

# 39. No new dependencies without justification

Strong preference:

Use existing React/UI primitives and browser color input if sufficient.

Avoid:

- heavyweight design editor packages
- Tailwind runtime
- dynamic CSS frameworks
- huge color libraries
- huge font libraries

If a dependency would materially simplify a hard problem, justify it explicitly.

---

# 40. Future compatibility

Step 3.1 should make these easier:

3.2 Expanded Section Library
- new sections consume Theme automatically

3.3 Multi-Page
- Theme applies site-wide automatically

3.4 Header/Nav/Footer
- these components consume the same Theme

3.6 Templates
- templates may carry/apply a Theme token set

Do not implement those steps now.

---

# 41. Recommended Step 3.1 scope

Based on actual code, recommend the exact MVP.

Strong candidate scope:

Colors:
- primary
- accent
- background
- text
- derived surface/border/muted/foreground as appropriate

Typography:
- curated heading font
- curated body font

Shape:
- global radius preset

Spacing:
- section density preset

Buttons:
- derive from colors + shape unless a separate button treatment clearly earns
  its place

Optional:
- 3–5 visual Theme presets

The audit should narrow or adjust this based on current implementation.

Avoid configuration explosion.

---

# 42. Implementation slicing

Determine whether Step 3.1 should be:

A. one implementation pass

or

B. two coherent slices

Potential:

3.1a
Theme schema/tokens + renderer/site-components

3.1b
Portal Theme editor + presets/accessibility/polish

Since this touches a broad set of visual components, two slices may be safer.

But do not split merely for ceremony.

Recommend based on actual dependency structure.

---

# 43. Baseline health

Run local deterministic checks.

At minimum:

- server tests
- Portal tests
- renderer tests
- UI/site-component tests
- platform typecheck
- lint
- classifier implications

Do not deploy.
Do not mutate cloud/data.

Report current baseline.

---

# 44. Architecture regression check

Ensure the proposed Theme architecture preserves:

- renderer remains Firestore-free
- SiteDefinition/public API boundary
- working/published separation
- tenant isolation
- Custom CSS remains separate
- media model untouched
- section instance model untouched
- no changes to legacy BakerRang client/data
- no new infrastructure dependency

---

# 45. Output

Return:

1. current Theme architecture
2. current visual-style inventory
3. problems/limitations in current Theme system
4. recommended long-term Theme schema
5. exact Theme tokens
6. color model
7. contrast/accessibility strategy
8. color input/storage format
9. typography model
10. font loading/source strategy
11. recommended curated fonts/pairs
12. shape/radius model
13. button styling model
14. spacing/density model
15. light/dark recommendation
16. Theme preset recommendation
17. reset/default semantics
18. storage/publish model
19. backend/API changes
20. schema validation
21. CSS variable architecture
22. Tailwind interaction
23. root Theme application strategy
24. component refactor table
25. Custom CSS precedence/integration
26. Portal Theme editor UX
27. Theme preview recommendation
28. save/dirty-state behavior
29. working/published behavior matrix
30. Branding/Theme boundary
31. accessibility behavior
32. data-transition requirements
33. security considerations
34. performance/font considerations
35. deterministic test plan
36. dependencies required, if any
37. exact recommended Step 3.1 scope
38. implementation slicing
39. files likely to change
40. baseline test results
41. blockers/operator decisions
42. whether Step 3.1 is ready to implement

No implementation.
No deployment.
No Firestore mutation.
No GCP mutation.
No Git mutation.