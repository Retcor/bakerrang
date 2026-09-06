# Step 3.1 — Theme Presets & Theme Cleanup

Implement Step 3.1 as ONE focused implementation pass.

Claude's planning audit found that the core Theme architecture is already mature
and should NOT be rebuilt.

Step 3.1 therefore consists of:

1. Theme presets
2. removal of vestigial Branding color fields/fallback
3. advanced Theme/Custom-CSS documentation
4. narrowly-scoped Theme accessibility/test polish

Do NOT redesign the Theme architecture.

Do NOT deploy.
Do NOT mutate Firestore/GCP.
Do NOT modify infrastructure.
Do NOT perform broad data migrations.

---

# 0. Verify the CURRENT repository first

The Claude planning session used a stale Portal test baseline.

The most recent authoritative Step 3.0 verification was:

Server:
331 passed
0 failed
0 skipped

Portal:
89 passed
0 failed

Renderer:
60 passed

UI:
9 passed

Platform typecheck:
passed

Platform lint:
passed

Server lint:
passed

Before implementation:

- inspect git status
- inspect current HEAD/log
- run/confirm the relevant baseline
- inspect the actual current Theme files

If the current checkout materially differs from the architecture described below,
report it before making architectural assumptions.

Do NOT restore an older Step 3.0 state.

---

# 1. Preserve the existing Theme architecture

The existing canonical Theme model is already approved.

Current conceptual shape:

theme: {
colors: {
primary,
accent,
background,
text
},
headingFont,
bodyFont,
cornerStyle,
contentWidth,
sectionSpacing
}

Keep this model.

Do NOT add:

- surface color input
- border color input
- muted text input
- button foreground input
- buttonStyle
- surfaceStyle
- darkMode
- arbitrary font strings
- font URLs
- arbitrary CSS values
- per-section Theme settings

The existing resolver already derives:

- primary foreground
- accent foreground
- surface
- border
- muted text
- radius tokens
- spacing tokens
- content-width token
- font tokens

Keep that behavior.

---

# 2. Do not refactor the renderer unnecessarily

The existing Theme system already uses:

resolveSiteTheme(theme)

to map schema fields to `--site-*` CSS variables on the SiteShell root.

Keep:

- CSS-variable runtime theming
- static Tailwind/component classes
- SiteShell as the Theme application root
- public Home and Contact sharing the same Theme
- renderer Firestore-free

Do NOT introduce:

- dynamic Tailwind class generation
- generated per-tenant CSS files
- runtime Google Fonts
- theme-specific component branches

No public-site component rewrite should be necessary for the primary 3.1 work.

---

# 3. Keep the existing font strategy

Do NOT add fonts.

Do NOT change the current `next/font` loading architecture.

The current curated fonts are already loaded/self-hosted at build time and
selected per tenant through Theme CSS variables.

Use ONLY the existing SiteFont enum/options.

No arbitrary font-family strings.

No remote font URLs.

No runtime Google Fonts requests.

---

# 4. Add Theme presets

Add five curated presets:

- Modern
- Classic
- Bold
- Friendly
- Midnight

Presets are PORTAL UX conveniences only.

They populate the EXISTING Theme fields.

Do NOT add a persisted field such as:

preset
presetId
themeName

After applying a preset, the operator may freely change any individual control.

Once customized, the Theme is just a normal Theme object.

---

# 5. Preset definitions

Store presets in a small Portal-side constant/module, likely alongside existing
Theme utilities.

Use the actual current `SiteFont`, `CornerStyle`, `ContentWidth`, and
`SectionSpacing` enum values.

Do not add a backend preset registry.

Conceptual personalities:

## Modern

Use the current DEFAULT_SITE_THEME exactly.

This should remain the safe neutral/default look.

Prefer referencing/cloning the existing default rather than duplicating its
literal values unnecessarily.

## Classic

Personality:

- warm neutral background
- restrained earthy primary/accent
- serif-forward heading
- readable serif or complementary body font using existing font options
- soft corners
- comfortable spacing
- standard/narrow-ish content width if appropriate

Prefer existing fonts corresponding to the current Playfair/Source-Serif-style
options if available.

## Bold

Personality:

- high contrast
- strong primary color
- strong sans heading
- neutral sans body
- square or restrained corners
- spacious sections
- wider/standard content

Prefer existing Montserrat/Inter-style options if available.

## Friendly

Personality:

- warm/light background
- approachable primary/accent
- rounded shape
- comfortable spacing
- friendly sans typography

Prefer existing Poppins/Work-Sans-style options if available.

## Midnight

Personality:

- dark background
- light text
- strong contrasting primary/accent
- demonstrates the existing dark-aware derived surface system
- clean sans typography
- square or soft corners
- spacious sections

Use ONLY existing font options.

---

# 6. Exact preset values

Choose exact valid token values during implementation.

Requirements:

Colors must be canonical hex:

#rrggbb

and pass the existing server Theme validation.

For EVERY preset, add deterministic tests proving representative contrast behavior
is acceptable.

At minimum verify:

text vs background >= 4.5:1

and the existing resolver produces readable:

primary foreground vs primary
accent foreground vs accent
muted vs its intended surfaces/background

Do not choose colors solely because they look good in the Portal sample.

Use the existing Theme contrast helpers/resolver rather than introducing a large
color library.

Report the final exact preset objects in the implementation report.

---

# 7. Preset Portal UX

Add a small:

"Start from a preset"

area near the top of ThemeEditor.

Use existing Portal/UI primitives.

Prefer a simple responsive collection of preset choices/cards/buttons showing:

- preset name
- short personality description
- small color swatches
- font pairing label if useful

Do NOT build a theme marketplace/gallery.

Five presets is enough.

Clicking Apply should populate the local Theme form.

It must NOT immediately call the server.

Applying a preset:

local form
→ dirty
→ operator may customize
→ Save
→ WORKING Theme

Live remains unchanged until Publish.

---

# 8. Preset overwrite behavior

If the Theme form currently has unsaved modifications and the operator applies a
preset that would replace them:

use the existing ConfirmDialog.

Example:

Apply "Classic" theme?

This will replace your unsaved Theme choices. You can continue editing before
saving.

If the form is clean, no confirmation is necessary.

Do not over-confirm actions that are still only local/unpersisted.

---

# 9. Reset behavior

Keep existing Reset to defaults.

Reset remains:

local form only
→ dirty
→ Save required
→ Publish required for live

If Reset would overwrite other currently-unsaved Theme edits, use the same
confirmation behavior as preset application if that fits the current UX cleanly.

Do NOT create a backend reset endpoint.

---

# 10. Theme sample

Keep the existing illustrative Theme preview/sample.

Do NOT build WYSIWYG.

Enhance only if cheap and useful.

The sample may show:

- background
- surface/card
- heading
- body
- primary button
- accent
- border/muted treatment

so presets visibly communicate their personality.

Do not duplicate the full real website.

The real Preview Changes flow remains authoritative.

---

# 11. Branding/Theme ownership cleanup

This is an approved breaking cleanup.

Branding should own identity/media:

- site name if currently part of Branding
- logo
- favicon
- other identity assets already there

Theme owns presentation:

- primary color
- accent color
- background
- text
- fonts
- shape
- spacing
- width

Remove vestigial Branding:

primaryColor
accentColor

from the application model.

Inspect and remove them where present from:

- SiteBranding TypeScript schema/type
- server Branding validator/normalizer
- response shaping
- Portal types/helpers if any
- tests/fixtures
- documentation

There should be no live Branding UI for these already, so do not add/remove
unrelated controls.

---

# 12. Remove Theme fallback to Branding colors

Current Theme normalization reportedly includes a fallback from:

branding.primaryColor
branding.accentColor

Remove that fallback.

Theme is authoritative for all colors.

Theme normalization/defaulting should now derive only from:

- stored Theme
- DEFAULT_SITE_THEME

not Branding.

No Theme code should need to inspect Branding to determine its primary/accent
colors.

Add tests proving this separation.

---

# 13. Existing stored branding color fields

Do NOT automatically mutate Firestore.

There are no real customer marketing sites, so permanent backward compatibility
is unnecessary.

If old test-site config documents still contain:

branding.primaryColor
branding.accentColor

they may simply become ignored inert fields after the application cleanup unless
the current full-state Branding write naturally removes them.

Do not build migration machinery just to remove two harmless stale test fields.

Document the optional narrow cleanup procedure if desired:

tenants/{tenantId}/site/config

for explicitly selected marketing test tenants only.

Never perform broad database cleanup.

Do NOT touch:

- sections
- media
- leads
- members
- legacy BakerRang vault/password/budget/etc. data

If removal of the fallback would cause a current Theme to lose its only actual
color values, report that before implementation rather than silently changing
appearance.

---

# 14. Advanced styling documentation

Add a concise advanced-styling document for Custom CSS.

Document the actual supported hooks used by the current renderer.

Include:

[data-br-site]

[data-br-section="<type>"]

[data-br-section-id="<section-id>"]

Explain:

- `data-br-section` is the preferred type-level styling hook
- `data-br-section-id` targets one specific current section instance
- instance IDs are opaque and should not be treated as meaningful names
- recreated/duplicated sections receive different IDs

Document the intentional Theme CSS-variable surface.

Use the ACTUAL existing variable names from resolveSiteTheme.

Likely variables include things such as:

--site-primary
--site-primary-fg
--site-accent
--site-accent-fg
--site-bg
--site-fg
--site-surface
--site-border
--site-muted
--site-heading-font
--site-body-font
--site-radius
--site-radius-large
--site-content-width
--site-section-space
--site-section-space-lg
--site-hero-space
--site-hero-space-lg

VERIFY the real list.

Do not document nonexistent variables.

Explain Custom CSS precedence:

base component styles
→ Theme variables
→ Custom CSS overrides

Do not rename the variables to `--br-*`.

The existing `--site-*` prefix is already established.

---

# 15. Custom CSS stability wording

Be careful about promising an eternal public API.

Describe these as the supported advanced styling hooks for the current BakerRang
site system.

Do not imply raw generated utility classes are stable.

Operators should prefer:

data-br-* attributes
and documented `--site-*` variables

over generated class names or DOM structure selectors.

---

# 16. Accessibility

Do NOT build a new accessibility engine.

Keep existing behavior:

- derived foregrounds
- accessible muted colors
- contrast warning
- fixed/design-system focus treatment

Add tests for the new preset palette.

If the current contrast warning only covers text/background, that is acceptable
provided the resolver's derived button/accent foreground tests prove sufficient
contrast.

Do NOT add meaningless warnings for combinations that the resolver already
automatically corrects.

Inspect public Contact inputs and verify their Theme-derived surface/border/text
tokens remain distinguishable for representative:

- light preset
- Midnight/dark preset

Use deterministic token/style assertions where practical.

No screenshot tests required.

---

# 17. No buttonStyle in Step 3.1

Explicit decision:

DEFER buttonStyle.

Current buttons derive from:

primary color
derived foreground
cornerStyle

That is enough for now.

Do NOT add:

solid / outline / soft

yet.

---

# 18. No surfaceStyle in Step 3.1

Explicit decision:

DEFER surfaceStyle / card-style personality.

Do not restyle all public components merely to create another Theme option.

This can be reconsidered later with expanded sections/templates.

---

# 19. No explicit light/dark setting

Do NOT add:

mode: light | dark

The existing model already supports dark sites through:

background
text
derived dark-aware surfaces

Midnight should demonstrate this.

No separate dark-mode branch.

---

# 20. Working / published behavior

Preserve exactly:

Theme form edit
→ local only

Save
→ working site/config theme

Preview
→ working Theme

Live site
→ published Theme

Publish
→ Theme becomes public

Applying presets/reset does NOT bypass Save.

Saving Theme does NOT automatically Publish.

---

# 21. Dirty-navigation behavior

Preset application must participate naturally in the existing ThemeEditor
dirty-value system.

Verify:

manual color edit
preset apply
font edit
corner change
spacing change
width change
reset

all correctly mark the editor dirty.

Leaving without Save must trigger the existing Step 3.0 dirty guard.

Do not add a second navigation guard.

---

# 22. Backend/API

Keep the existing full-state:

PUT /tenants/:tenantId/site/theme

unless the actual current code differs.

Presets use the same endpoint after Save.

Do not add:

/theme/preset
/theme/colors
/theme/font

etc.

No new backend API is needed for presets.

Backend changes should be limited to the Branding color cleanup/fallback removal
and associated tests.

---

# 23. Security

Normal Theme fields remain constrained.

Do not allow:

- CSS expressions
- url(...)
- var(...)
- arbitrary font strings
- remote stylesheets
- arbitrary URLs
- HTML

Presets contain only valid normal Theme values.

Custom CSS remains the separate existing advanced trust boundary.

No new dependency should be needed.

---

# 24. Tests — presets

Add Portal tests covering:

- all five preset choices render
- each preset populates the expected Theme fields
- preset application is local only
- applying marks Theme dirty
- manual customization after preset works
- Save sends the resulting normal Theme object through existing Theme API
- preset identity is NOT stored
- preset overwrite confirmation when current form is dirty
- canceling confirmation retains current unsaved form
- Reset/default semantics remain correct
- dirty-navigation guard remains active

Avoid implementation-detail-only tests.

---

# 25. Tests — preset validity/contrast

Add deterministic tests for every preset.

Verify:

- valid Theme schema values
- all colors canonical
- font enums valid
- cornerStyle valid
- contentWidth valid
- sectionSpacing valid
- text/background contrast acceptable
- derived foregrounds readable
- dark preset exercises dark surface derivation

Prefer using existing Theme helpers/resolver.

Do not create a second color algorithm in tests.

---

# 26. Tests — Branding cleanup

Add/update tests proving:

- Branding no longer exposes primaryColor
- Branding no longer exposes accentColor
- Branding validation does not treat these as canonical fields
- Theme no longer inherits primary/accent from Branding
- DEFAULT_SITE_THEME supplies defaults where Theme values are absent
- Branding logo/favicon behavior remains unchanged

Update existing fixtures that still treat Branding colors as active model fields.

---

# 27. Tests — existing Theme behavior

Do not regress existing tests covering:

- valid Theme update
- invalid hex
- invalid font
- invalid enum
- working/published isolation
- Theme CSS variables
- styling hooks
- Preview/public behavior

Run all existing suites.

---

# 28. No public component redesign

Unless required to fix an actual Theme-token bug discovered during implementation:

do NOT change:

- Hero layout
- Services layout
- Gallery layout
- Testimonials layout
- FAQ layout
- Contact layout
- section architecture

Step 3.1 is not a visual redesign of each component.

The existing tokens are the abstraction.

---

# 29. Classifier expectations

Report actual classifier output.

Presets themselves should be Portal-only.

Branding/schema cleanup may cause:

api
portal
renderer

depending on the current classifier's shared-package rules.

Client must remain false.

Unknown must remain empty.

Do not change classifier rules merely to influence deployment.

---

# 30. Validation

Run:

Server:
- full tests
- lint

Platform:
- Portal tests
- Renderer tests
- UI tests
- typecheck
- lint

CI:
- classifier/workflow tests
- changed-path classifier

Quality:
- git diff --check
- credential/secret scan

No deploy.
No Firestore mutation.
No GCP mutation.

---

# 31. Final report

Return:

1. current baseline actually observed
2. files created
3. files modified/deleted
4. final five preset names
5. exact Theme object for every preset
6. preset UI implementation
7. preset overwrite/reset behavior
8. confirmation no preset id is persisted
9. Branding color fields removed
10. Theme fallback cleanup
11. any old stored-field compatibility consequence
12. advanced styling documentation added
13. exact documented data-br hooks
14. exact documented --site-* variables
15. accessibility/contrast test results
16. working/published behavior
17. dirty-state behavior
18. backend/API changes
19. dependencies added, if any
20. server test totals
21. Portal test totals
22. Renderer/UI test totals
23. skipped count
24. typecheck/lint
25. classifier/workflow result
26. git diff --check
27. secret scan
28. deployment targets implied by classifier
29. confirmation no deploy/cloud/data mutation occurred
30. blockers
31. whether Step 3.1 is ready for post-implementation audit

Explicitly answer:

Does Theme still use only the existing semantic token model?
Expected: YES.

Are surface/border/muted colors still derived?
Expected: YES.

Are arbitrary fonts/font URLs allowed?
Expected: NO.

Is a preset ID persisted?
Expected: NO.

Can the operator customize a preset after applying it?
Expected: YES.

Does Branding still own primary/accent colors?
Expected: NO.

Does Theme still fall back to Branding colors?
Expected: NO.

Was buttonStyle added?
Expected: NO.

Was surfaceStyle added?
Expected: NO.

Was explicit dark mode added?
Expected: NO.

Does Midnight use the existing dark-aware Theme derivation?
Expected: YES.

Were any unrelated BakerRang data or cloud resources mutated?
Expected: NO.