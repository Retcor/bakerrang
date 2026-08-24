# Implement Step 1.28a — Stable Styling Hooks + Custom CSS Parser/Scoper Foundation

Implement ONLY Step 1.28a of BakerRang Step 1.28.

This slice creates:

1. the stable public `data-br-*` styling-hook API
2. the server-side Custom CSS parser / validator / selector scoper
3. deterministic tests for both

Do NOT add Custom CSS storage, API mutation, renderer `<style>` injection, Preview CSS application, or Portal Custom CSS UI yet.

Those belong to later 1.28 slices.

Use Claude's Step 1.28 plan as the architectural reference, with the decisions and corrections in this assignment taking precedence.

---

# 1. V1 Policy Decisions

Lock these decisions:

```text
Parser                     css-tree

Max Custom CSS             20 KB UTF-8

Canonical future storage   raw validated CSS
Scoping timing             read-time, not write-time

Allowed:
  ordinary style rules
  CSS custom properties
  normal declarations
  pseudo-classes
  pseudo-elements
  :is()
  :where()
  :not()
  :has()
  :nth-child()
  @media
  @supports
  @keyframes
  animation / transition

Rejected in V1:
  @import
  @font-face
  @layer
  @property
  @namespace
  @page
  @document
  @charset
  @container
  any other at-rule not explicitly allowed

External/resource loading:
  ALL url() prohibited
  ALL image-set/resource-loading functions prohibited
  no scheme is allowed
  no data:
  no blob:
  no https:
  no fragment url(#...)
```

Theme `--site-*` variable overriding is NOT a supported V1 feature.

Do not change Step 1.26 Theme architecture in this slice.

---

# 2. Add css-tree

Add `css-tree` as a server runtime dependency.

Use its AST parser/walker/generator as the authoritative CSS parser.

Do NOT validate Custom CSS with:

- regex
- substring scanning
- `includes('@import')`
- other text-only heuristics

Comments and quoted strings must be parsed correctly so inert text does not trigger false positives.

---

# 3. New Custom CSS Domain Module

Create:

```text
server/domain/customCss.js
```

or the equivalent consistent server location.

The module should own:

```text
parse
validation
resource-policy enforcement
selector scoping
safe normalization
```

But no persistence yet.

Provide clean entry points conceptually equivalent to:

```js
validateCustomCss(rawCss)
normalizeStoredCustomCss(rawCss)
scopeCustomCss(rawCss)
```

Exact API may be adjusted if a smaller design is cleaner.

---

# 4. Strict Write Validation

`validateCustomCss()` should:

1. require a string
2. accept whitespace-only as canonical absence only if the future update validator handles that separately; otherwise clearly define behavior
3. enforce 20 KB UTF-8 before parsing
4. parse with source positions
5. reject malformed CSS
6. reject unsupported at-rules
7. reject every external/resource-loading construct
8. return validated raw CSS, NOT scoped CSS

No database write exists in this slice.

---

# 5. Safe Read Normalization

Provide a safe normalization API for future storage/read integration.

Conceptually:

```js
normalizeStoredCustomCss(rawCss)
```

should:

- never throw
- return `undefined` for non-string/malformed/unsafe CSS
- otherwise return a deterministic scoped CSS representation

This prepares Step 1.28b.

No SiteDefinition wiring yet.

---

# 6. At-Rule Allowlist

Explicitly allow only:

```text
@media
@supports
@keyframes
```

Reject all other at-rules in V1.

This includes:

```text
@import
@font-face
@layer
@property
@namespace
@page
@document
@charset
@container
```

Return actionable validation errors.

When positions are available, include a useful line number.

Do not expose parser stack traces.

---

# 7. Resource-Loading Policy

Custom CSS must not cause visitor browsers to load operator-controlled resources.

Reject every AST `Url` node wherever it occurs.

Also explicitly inspect resource-producing CSS functions that can encode resources without a normal `url()` token.

At minimum evaluate/reject:

```text
image-set(...)
-webkit-image-set(...)
image(...)
src(...)
```

and any equivalent resource-loading function recognized by css-tree.

Do not assume searching for AST `Url` nodes alone catches every standards-valid external image syntax.

If another function can cause an external fetch without a `Url` AST node, reject it.

This policy applies anywhere in CSS:

- declarations
- at-rule preludes
- nested functions
- supports expressions
- etc.

---

# 8. No False Positives

These must NOT be rejected merely because they contain text resembling prohibited syntax:

```css
/* @import "https://example.com/foo.css"; */

.notice::before {
  content: "@import and url(https://example.com/x)";
}
```

They are inert strings/comments.

Use the AST, not text scanning.

---

# 9. Stable Site Root

Add:

```html
data-br-site
```

to the canonical public SiteShell root.

Conceptually:

```html
<div class="site-shell ..." data-br-site>
```

This becomes the Custom CSS scope boundary.

Do not change Theme behavior.

Do not inject Custom CSS yet.

---

# 10. Stable Hook Contract

`data-br-*` is now public API for future Custom CSS.

Internal Tailwind/classes remain explicitly unsupported implementation details.

Add a concise developer comment where appropriate:

```text
data-br-* attributes are stable public Custom CSS hooks.
Do not rename/remove casually.
```

Do not add version suffixes.

Keep the hook set small.

---

# 11. Stable Global Roles

Add stable hooks for appropriate canonical elements:

```text
data-br-site

data-br-role="header"
data-br-role="nav"
data-br-role="main"
data-br-role="footer"
data-br-role="social"

data-br-role="section-heading"
data-br-role="card"
data-br-role="button"
data-br-role="form"
data-br-role="input"
```

Only add a role where the semantic concept genuinely applies.

Do NOT sprinkle `data-br-role` onto every div.

---

# 12. Stable Section Hooks

All public Home sections should expose:

```text
data-br-section="<type>"
```

for:

```text
hero
about
services
gallery
testimonials
faq
businessHours
contact
```

Also expose:

```text
data-br-section-id="<canonical id>"
```

where the architecture cleanly supports it.

Even though current sections are single-instance, retaining section-id gives us room for future section identity without changing the Custom CSS API.

Hero may require direct wiring because it does not use exactly the same primitive as all other sections.

---

# 13. Cards

Use:

```text
data-br-role="card"
```

on repeating visual units where "card" is genuinely a reusable semantic styling concept.

At minimum inspect:

- Services
- Gallery
- Testimonials
- FAQ

Do not force the hook onto elements that are not actually card-like.

---

# 14. Buttons

Expose:

```text
data-br-role="button"
```

on public tenant-site CTAs/actions where useful.

Inspect:

- Hero CTA
- Contact CTA
- lead form submit
- other current public action controls

Do not add it to Preview controls or Portal controls.

Stable hooks are PUBLIC SITE only.

---

# 15. Forms / Inputs

Expose:

```text
data-br-role="form"
```

on the tenant public Lead Form.

Expose:

```text
data-br-role="input"
```

on its user-editable fields.

This hook work must NOT change:

- form submission
- validation
- honeypot behavior
- rate limits
- Preview lead no-op behavior
- request payload

Attributes are styling hooks only.

---

# 16. Main / Contact Page

Ensure both:

```text
Home
Contact
```

public rendering receive the same:

```text
data-br-site
data-br-role="main"
header/footer hooks
```

where applicable.

Custom CSS will be site-level in 1.28b, not Homepage-only.

---

# 17. Selector Scoping

Implement AST-based selector transformation.

Scope root:

```css
[data-br-site]
```

General rule:

```css
.foo
```

becomes:

```css
[data-br-site] .foo
```

Comma lists:

```css
h1, .foo, #bar:hover
```

become each independently scoped.

---

# 18. Root-Like Selector Handling — IMPORTANT CORRECTION

Do NOT handle only selectors that are exactly:

```css
html
body
:root
```

Handle root-like LEADING COMPOUNDS correctly.

Examples:

```css
body.foo .card
```

must become conceptually:

```css
[data-br-site].foo .card
```

NOT:

```css
[data-br-site] body.foo .card
```

Likewise:

```css
html.dark h1
```

should become conceptually:

```css
[data-br-site].dark h1
```

and:

```css
:root[data-layout="wide"] button
```

should become conceptually:

```css
[data-br-site][data-layout="wide"] button
```

For:

```css
body > main
```

produce:

```css
[data-br-site] > main
```

Preserve compatible classes/attributes/pseudo-classes attached to the root-like compound.

Implement this through the selector AST.

Do not use string replacements.

---

# 19. :root / html / body

At the start of a complex selector:

```text
:root
html
body
```

represent the tenant site root for Custom CSS purposes.

Normalize that leading root-like compound to:

```text
[data-br-site]
```

while preserving compatible qualifiers.

If `html/body/:root` appears later in a selector in a way that cannot make sense inside the scoped subtree, validation may reject the selector rather than generating an impossible or scope-escaping selector.

Choose deterministic behavior and test it.

---

# 20. Universal Selector

For:

```css
* {
  opacity: .5;
}
```

scope so the rule applies only within the tenant site.

It is acceptable for this to include or exclude the `[data-br-site]` root itself as long as the behavior is deliberate and documented.

Prefer:

```css
[data-br-site] *
```

for bare `*`, matching the approved plan.

---

# 21. Already-Scoped Selectors

If a selector already starts at:

```css
[data-br-site]
```

do not double-prefix it.

Example:

```css
[data-br-site] h1
```

must remain:

```css
[data-br-site] h1
```

This should be based on AST structure, not substring matching.

---

# 22. Pseudo Selectors

Preserve valid advanced selectors:

```css
:hover
:focus-visible
:nth-child(...)
:not(...)
:is(...)
:where(...)
:has(...)
::before
::after
```

Examples:

```css
.card:hover
```

becomes:

```css
[data-br-site] .card:hover
```

Do not strip or rewrite nested selector semantics unnecessarily.

---

# 23. Nested At-Rules

Rules nested inside:

```text
@media
@supports
```

must have their selectors scoped recursively.

Example:

```css
@media (max-width: 640px) {
  h1 {
    font-size: 2rem;
  }
}
```

must generate scoped `h1`.

---

# 24. Keyframes

Allow:

```css
@keyframes fadeIn { ... }
```

Do NOT attempt to scope:

```text
from
to
0%
50%
100%
```

as DOM selectors.

Do not rename keyframe names in V1.

Ensure the AST traversal can distinguish keyframe inner rules from element rules.

No Custom CSS persistence exists yet, so collision behavior is only a documented V1 policy at this point.

---

# 25. Style-Breakout Defensive Serialization

The future renderer will place the scoped CSS in a `<style>` element.

Prepare the generated/scoped representation so literal malicious content cannot break out of a raw-text style context.

Test a valid CSS string such as:

```css
[data-x]::before {
  content: "</style><script>alert(1)</script>";
}
```

The generated scoped CSS must contain no literal sequence capable of closing the style element.

Claude proposed replacing literal `<` in generated CSS with a valid CSS escape such as:

```text
\3c 
```

Use this strategy if it remains semantically valid after css-tree generation.

Do not use HTML encoding inside CSS in a way that changes the CSS value.

Add a deterministic assertion/test that the scoped output contains no literal `<`.

No renderer injection occurs in this slice.

---

# 26. Error Messages

Strict validation errors should be useful.

Prefer messages such as:

```text
Line 3: @import is not supported.
Line 8: Custom CSS cannot load external resources with url().
Line 14: Unexpected closing brace.
Custom CSS exceeds 20 KB.
```

Do not expose internal parser dumps or stack traces.

Column is optional; line is desirable when parser position exists.

---

# 27. Rule Count Bound

Use:

```text
20 KB UTF-8 maximum
```

as the primary complexity bound.

A cheap secondary rule-count cap may be added around:

```text
2000 rules
```

if it can be implemented cleanly through the AST.

Do not add elaborate nesting-depth/selector-length/declaration-count machinery.

If 20 KB naturally makes 2000 rules unrealistic, explain and omit the redundant guard rather than implementing complexity for its own sake.

---

# 28. NO Theme Refactor

Do not move existing Theme variables out of inline styles.

Do not add Custom CSS override support for:

```text
--site-*
```

as a documented feature.

Custom CSS can override concrete CSS properties on stable hooks.

Theme architecture remains unchanged in 1.28a.

---

# 29. NO Preview Containment Yet

Do not implement Preview isolation/stacking changes in this slice.

That belongs to 1.28b when Custom CSS is actually applied.

However, the later implementation must NOT use:

```text
transform: translateZ(0)
contain: layout paint
```

as the primary Preview isolation mechanism because those change fixed-position/layout behavior compared with the published site.

The planned 1.28b approach should instead use a dedicated stacking context:

```text
tenant Preview site layer
  -> isolation: isolate / controlled z-index

Preview banner
  -> sibling in higher renderer-owned stacking layer
```

so descendant high-z-index/fixed tenant content cannot cover the Preview banner while retaining public-like layout semantics.

No code for this yet.

---

# 30. No Read-Finalization Integration Yet

Do NOT wire Custom CSS into:

```text
hydrateSiteMedia()
```

in this slice.

Later 1.28b should use a dedicated SiteDefinition read-finalization seam rather than making mediaService own CSS semantics.

The domain normalizer created now should simply be ready for that future integration.

---

# 31. Tests — Custom CSS Domain

Add deterministic tests for:

## Valid

```text
simple selector
multiple selectors
CSS custom property
:hover
::before
:is()
:where()
:not()
:has()
:nth-child()
@media
@supports
@keyframes
animation usage
```

## Invalid

```text
malformed CSS
over 20 KB
@import
@font-face
@layer
@property
@namespace
@page
@document
@charset
@container
unknown at-rule
url(https://...)
url(data:...)
url(#fragment)
image-set(...)
-webkit-image-set(...)
other identified resource-loading functions
```

## False-positive protection

```text
@import in comment
url(...) text in comment
@import in quoted content string
url(...) in quoted content string
```

## Scoping

```text
h1
h1, p
:root
html
body
body.foo .card
html.dark h1
:root[data-layout="wide"] button
body > main
*
.card:hover
.card::before
:not(...)
:is(...)
:where(...)
:has(...)
[data-br-site] h1
@media nested rule
@supports nested rule
@keyframes from/to/% unaffected
```

## Breakout

```text
content:"</style><script>..."
```

Scoped output must contain no literal `<`.

---

# 32. Tests — Stable Hook Contract

Add renderer/site-component tests confirming promised hooks exist.

At minimum prove:

```text
data-br-site

header
nav
main
footer
social

section hooks:
hero
about
services
gallery
testimonials
faq
businessHours
contact

section-heading
card
button
form
input
```

Only assert a hook on a component where that role exists.

Do not make tests brittle by snapshotting huge DOM trees.

Target stable attributes.

---

# 33. Regression

Run existing suites and ensure hook-only markup changes do not alter behavior for:

- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Business Hours
- Contact
- Lead Form
- Social Footer
- Theme
- Preview
- navigation

Attributes must be behavior-neutral.

---

# 34. Automated Verification

Run:

- backend tests
- renderer tests
- Portal tests
- UI tests
- platform typecheck
- platform lint
- touched server lint
- Portal production build
- renderer production build
- `git diff --check`

No Portal UI changes are expected, but regression suites should remain green.

---

# 35. Explicitly Out of Scope

Do NOT implement in 1.28a:

- `SiteDefinition.customCss`
- Firestore customCss storage
- Custom CSS mutation endpoint
- Portal Custom CSS editor
- renderer `<style>` injection
- Preview Custom CSS application
- Preview containment
- Theme variable refactor
- favicon work
- arbitrary JS
- arbitrary HTML
- external resources
- @layer
- @property
- @container
- production deployment

---

# 36. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. css-tree dependency change
4. final allowed/rejected CSS policy
5. resource-loading detection
6. selector-scoping behavior
7. root-like selector normalization
8. stable `data-br-*` hook contract
9. breakout-defense behavior
10. tests added/updated
11. complete verification results
12. deviations and why
13. anything that must be addressed before 1.28b