# Planning Task — Step 1.28: Advanced Custom CSS

We are continuing the BakerRang multi-tenant local-business website platform.

Do NOT implement anything.

Inspect the actual current code after completed Steps 1.24–1.27 and produce a detailed implementation plan for Step 1.28.

Step 1.28 introduces an **advanced tenant-level Custom CSS escape hatch** for public websites.

The feature must be useful to an experienced operator while remaining:

- CSS-only
- scoped to the tenant website
- bounded
- WORKING / Preview / Publish aware
- compatible with the existing Theme system
- based on documented stable styling hooks
- incapable of injecting arbitrary HTML or JavaScript
- incapable of unexpectedly styling Portal/Preview chrome
- conservative about external network-loading CSS constructs

Do not treat this as a generic code-injection feature.

---

# 1. Current Architecture to Inspect

Inspect the actual implementation before proposing changes.

Relevant areas include:

- `platform/packages/site-schema`
- `platform/packages/site-components`
- `platform/apps/site-renderer`
- `platform/apps/portal`
- `server/services/siteService.js`
- tenant site routes
- Step 1.25 Preview implementation
- Step 1.26 Theme implementation
- Step 1.27 About / FAQ / Business Hours / Social Links
- existing `.site-shell` and public Theme CSS variables
- `SiteShell`
- `SiteHeader`
- `SiteFooter`
- `SiteSection`
- `SiteContainer`
- `SectionHeading`
- `SectionRenderer`
- public renderer layouts
- Preview banner/frame
- published/custom-domain paths
- Content Security Policy / security headers if any exist
- existing dependencies that could safely parse CSS

Do not assume a new dependency is required until you inspect what is already installed.

---

# 2. Product Intent

Custom CSS is an **advanced override**, not the primary design system.

Normal operators should continue to use:

```text
Theme
  colors
  fonts
  corner style
  content width
  section spacing
```

Custom CSS exists for cases Theme intentionally does not expose.

Examples:

```css
[data-br-section="hero"] h1 {
  letter-spacing: -0.04em;
}

[data-br-section="services"] [data-br-role="card"] {
  border-width: 2px;
}
```

The exact hooks are conceptual only.

The plan must define the supported/stable styling surface.

Do NOT expand Theme merely to avoid Custom CSS.

Do NOT make Custom CSS a visual page builder.

---

# 3. Canonical Storage Location

Determine the correct canonical location for tenant Custom CSS.

Potential conceptual options:

```ts
SiteDefinition.customCss?: string
```

or:

```ts
SiteDefinition.appearance?: {
  customCss?: string
}
```

or another shape that fits the existing implementation.

Inspect how Theme currently lives in SiteDefinition and recommend the cleanest location.

Requirements:

- presentation concern, not BusinessProfile
- tenant/site-level, not section-level
- one stylesheet per site in V1
- part of WORKING state
- snapshotted into PUBLISHED state
- old sites without it remain unchanged

No Firestore migration should be required.

---

# 4. Working / Published Lifecycle

Custom CSS must follow exactly:

```text
Published CSS A

Edit CSS -> WORKING B

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

No separate CSS publishing mechanism.

No special CSS Preview token mechanism.

It should ride the existing SiteDefinition snapshot lifecycle.

Confirm the cleanest service path.

---

# 5. Critical Security Reality

Do not equate:

```text
"CSS only"
```

with:

```text
"no security/privacy implications"
```

Audit and plan for CSS constructs capable of:

- external network requests
- resource loading
- escaping intended site styling scope
- affecting Preview controls
- invalid or pathological stylesheets

Examples to explicitly consider:

```css
@import url(...)
@font-face { src: url(...) }
background-image: url(...)
cursor: url(...)
list-style-image: url(...)
content: url(...)
```

Also consider:

```text
javascript:
data:
blob:
```

and other URL forms even if modern browsers would not execute some of them as script.

We want a deliberate V1 policy.

---

# 6. External Resource Policy

Recommend whether V1 should prohibit all CSS-triggered external/resource URLs.

My starting preference is conservative:

```text
NO @import
NO externally-loaded @font-face
NO arbitrary url(...)
```

Theme/media systems should remain the supported path for fonts/images.

Potentially allow fragment-only references such as:

```css
url(#some-svg-reference)
```

only if needed and demonstrably safe.

Do NOT blindly follow this preference if the existing implementation strongly suggests a better policy, but explain the tradeoff.

The plan must specify exactly:

- which at-rules are allowed
- which at-rules are rejected
- whether `url()` is allowed
- what URL schemes, if any, are allowed
- whether data URLs are allowed
- whether comments/string contents can confuse validation
- how validation avoids unsafe regex-only parsing

Prefer actual CSS parsing over searching strings if practical.

---

# 7. CSS Parsing / Validation

Determine how Custom CSS should be validated.

Do NOT rely on simplistic checks like:

```js
css.includes('@import')
```

if a real CSS parser is practical.

Inspect dependencies.

Potential validation stages:

```text
parse CSS
   ↓
reject unsupported constructs
   ↓
enforce size/rule limits
   ↓
scope selectors
   ↓
persist canonical CSS
```

or another architecture if cleaner.

The server must be authoritative.

Portal validation can provide immediate feedback but must not be trusted.

The plan must address malformed CSS:

```text
unclosed blocks
invalid declarations
broken at-rules
```

Recommend whether invalid CSS should:

- reject save with 400
- or allow browser-tolerated CSS

Prefer deterministic validation.

---

# 8. Site Scoping — CRITICAL

Custom CSS must affect the tenant website and not renderer/Preview chrome.

Inspect the actual renderer DOM.

Recommend a stable site root, conceptually:

```html
<div data-br-site>
  ...
</div>
```

or:

```html
<div class="site-shell" data-br-site>
```

Then determine how tenant CSS should be scoped.

Simply putting:

```html
<style>{customCss}</style>
```

in `<head>` is NOT enough if the CSS can contain:

```css
body { ... }
* { ... }
html { ... }
```

because Preview UI could also be affected.

Evaluate selector transformation such as:

```css
h1 { ... }
```

becoming:

```css
[data-br-site] h1 { ... }
```

and:

```css
:root { ... }
```

becoming:

```css
[data-br-site] { ... }
```

The plan must address:

- normal selectors
- comma-separated selectors
- `:root`
- `html`
- `body`
- universal selectors
- pseudo-elements
- nested selectors if supported by the parser
- selectors inside `@media`
- selectors inside `@supports`
- keyframes
- animation names
- selectors already containing the scope root

Do not invent a fragile string-prefix algorithm if structured selector parsing is warranted.

---

# 9. Preview Isolation

This is especially important.

Step 1.25 Preview has renderer-owned Preview UI/banner/chrome.

Custom CSS must style:

```text
tenant website
```

but not:

```text
Preview banner
Preview controls
renderer shell outside tenant content
```

Inspect the current markup and define exactly where Custom CSS scope begins and ends.

Test hostile-but-valid operator CSS such as:

```css
* {
  display: none;
}
```

Expected V1 behavior may reasonably be:

```text
tenant site disappears
Preview banner remains visible
```

because Custom CSS is powerful inside the tenant site but cannot escape it.

Likewise:

```css
position: fixed;
inset: 0;
z-index: 999999;
```

may be allowed inside the tenant scope, but evaluate whether the scoped subtree can visually cover Preview controls.

If additional Preview containment is required, recommend it.

Do not attempt to make malicious CSS harmless in every visual sense; define a sensible trust boundary.

---

# 10. Stable Styling Hooks

Tailwind/internal class names are NOT a good public Custom CSS API.

Design a small set of stable attributes/hooks that advanced users can safely target.

Possible conceptual scheme:

```html
<div data-br-site>

<header data-br-role="header">

<section
  data-br-section="hero"
  data-br-section-id="hero"
>

<h2 data-br-role="section-heading">

<div data-br-role="card">

<footer data-br-role="footer">
```

Do not copy these blindly.

Inspect all current site components and recommend the smallest useful stable API.

At minimum consider hooks for:

```text
site root
header
navigation
main
footer

Hero
About
Services
Gallery
Testimonials
FAQ
Business Hours
Contact

section heading
cards/items
buttons/CTA
forms
inputs
```

Avoid adding hundreds of attributes.

Prefer semantic categories.

---

# 11. Stable Hook Contract

The plan must explicitly distinguish:

```text
SUPPORTED STABLE HOOKS
```

from:

```text
INTERNAL IMPLEMENTATION CLASSES
```

Operators should be encouraged to target:

```text
[data-br-*]
```

or whatever stable API is chosen.

They should NOT be encouraged to depend on generated Tailwind class names.

Determine whether the Portal should show a small reference/cheat-sheet.

Do not build full documentation infrastructure in this step.

---

# 12. Theme Variable Overrides

Step 1.26 already exposes CSS variables such as conceptual:

```css
--site-primary
--site-accent
--site-background
--site-text
...
```

Inspect the actual variables.

Determine whether Custom CSS should be allowed to override Theme variables.

This may be useful:

```css
:root {
  --site-section-space: 7rem;
}
```

After scoping, conceptual result:

```css
[data-br-site] {
  --site-section-space: 7rem;
}
```

Recommend which variables, if any, should be documented as supported.

Do not promise stability for every internal variable automatically.

The Custom CSS layer should load **after** the normal Theme stylesheet so valid custom overrides win naturally.

---

# 13. CSS Cascade / Injection Location

Determine exactly where generated Custom CSS should enter the renderer.

Potential approaches:

```html
<style id="br-custom-css">
...
</style>
```

or server-rendered CSS in an existing layout.

Requirements:

- available on first render
- no client-side flash if avoidable
- WORKING CSS in Preview
- PUBLISHED CSS publicly
- no additional fetch required
- no raw HTML injection mechanism

Use React-safe style rendering.

Evaluate whether React's normal:

```tsx
<style>{css}</style>
```

is sufficient after server validation/scoping.

Do NOT use arbitrary `dangerouslySetInnerHTML` unless technically necessary and justified.

Be careful about literal:

```text
</style>
```

inside user input and how React/style text serialization behaves.

Explicitly audit this.

---

# 14. CSS Size / Complexity Limits

Custom CSS must be bounded.

Recommend a maximum UTF-8 byte size.

Possible V1 range:

```text
10 KB
20 KB
32 KB
```

Choose a sensible limit based on likely use.

Also evaluate whether to limit:

- number of rules
- selector length
- nesting depth
- declaration count

Do not over-engineer parser limits if a byte limit is sufficient.

But consider pathological CSS/browser performance.

Server must enforce the canonical size limit.

Portal should display something like:

```text
4.2 KB / 20 KB
```

if easy.

---

# 15. Allowed CSS Features

Recommend a deliberate V1 feature allowlist.

Evaluate at least:

```text
ordinary style rules
CSS custom properties
@media
@supports
@keyframes
animations
transitions
pseudo-classes
pseudo-elements
container queries
@layer
@property
@font-face
@import
@page
@namespace
```

Do not reject modern CSS arbitrarily.

But reject features that create security/privacy/escaping concerns.

For each rejected category, give the reason.

If `@keyframes` is allowed, assess whether keyframe names need transformation or isolation.

---

# 16. Selector Capabilities

Determine whether advanced selectors should remain usable:

```css
:hover
:focus-visible
:nth-child(...)
:not(...)
:is(...)
:where(...)
::before
::after
```

They are useful for advanced CSS.

Scoping/transformation must preserve them correctly.

Consider relational selector:

```css
:has(...)
```

if parser/browser support permits.

No need to prohibit a selector merely because it is powerful inside the tenant subtree.

---

# 17. Cross-Site Isolation

One renderer serves many tenants.

Confirm there is no mechanism by which Tenant A's Custom CSS could affect Tenant B.

Given one tenant site per document/request, this should naturally hold, but verify:

- CSS is read from the resolved SiteDefinition only
- no global cache mixes CSS across tenants
- no build-time global stylesheet mutation
- custom domain and shared route resolve the same tenant-specific stylesheet correctly

---

# 18. Portal Custom CSS Editor

Plan a focused advanced editor.

Likely under:

```text
Site Foundation
  Branding
  Theme
  Business Profile
  Business Hours
  Social Profiles
  Custom CSS
  Manage Sections
```

or a distinct:

```text
Advanced
  Custom CSS
```

Recommend placement.

The UX should clearly communicate:

```text
Advanced
CSS only
Changes affect Preview before publishing
Use stable BakerRang selectors
```

Do not make this look like a normal Theme control.

---

# 19. Editor Implementation

Do NOT introduce Monaco/CodeMirror unless there is a strong practical reason.

A styled monospace multiline editor may be sufficient for V1.

Evaluate:

- textarea
- monospace font
- spellcheck false
- line wrap choice
- tab handling
- character/byte counter
- validation errors
- Save
- Reset / Clear

No live keystroke persistence.

Save explicitly.

---

# 20. Validation UX

When CSS is rejected, return actionable errors.

Examples:

```text
Line 3: @import is not supported.
Line 12: External url() values are not allowed.
Line 18: Unexpected closing brace.
Custom CSS exceeds 20 KB.
```

Determine how much location information the chosen parser can provide.

Portal should surface server validation clearly.

Do not expose stack traces/parser internals.

---

# 21. Clear / Remove Custom CSS

Define canonical removal semantics.

Prefer:

```text
customCss: null
```

or empty input leading to canonical absence.

After removal:

```text
Preview
  -> no Custom CSS

public
  -> old published CSS until Republish
```

Then after Republish:

```text
public
  -> no Custom CSS
```

Use the same focused mutation endpoint if possible.

No separate delete route unless warranted.

---

# 22. Focused Mutation

Prefer a focused endpoint such as:

```text
PUT /tenants/:tenantId/site/custom-css
```

with conceptual payload:

```ts
{
  customCss: string | null
}
```

The mutation must update only the Custom CSS presentation field.

It must not require resending:

- Theme
- Branding
- BusinessProfile
- Home sections
- other SiteDefinition state

Follow the focused mutation architecture successfully established for Hours/Social.

Inspect how SiteDefinition is persisted to choose the correct working document/transaction.

---

# 23. Authorization

Use the current CMS/site-content editing authorization policy.

Do not broaden permissions.

If current site content editors are PLATFORM_ADMIN-only, Custom CSS should remain aligned with that unless the architecture clearly says otherwise.

No anonymous write path.

Reuse existing:

- authentication
- CSRF
- authorization
- standard error handling
- request limits

---

# 24. CSP / Security Headers

Inspect whether the renderer currently sends a Content Security Policy.

Adding inline:

```html
<style>
```

may interact with:

```text
style-src
```

If CSP exists, determine how tenant CSS fits without weakening script policy.

Do NOT recommend:

```text
unsafe-inline
```

globally without analyzing the current CSP.

If no CSP exists, state that accurately.

Do not invent a large CSP redesign unless required for Custom CSS.

Also check whether forbidding external CSS `url()` allows us to maintain a tighter future `img-src/font-src/connect-src` posture.

---

# 25. CSS Exfiltration / Privacy

Explicitly evaluate CSS-based network exfiltration.

Even though these are public marketing sites and Custom CSS is operator-authored, allowing arbitrary:

```css
background: url(https://tracker.example/...)
```

would cause every visitor browser to contact an arbitrary third party.

Determine whether that is acceptable product behavior.

My V1 preference is:

```text
do not allow Custom CSS to initiate external resource loads
```

This is a privacy/platform-quality boundary rather than merely XSS prevention.

Document the recommendation.

---

# 26. Content Manipulation

Custom CSS can intentionally:

- hide content
- visually reorder things
- add `::before`/`::after` text
- make buttons invisible
- alter layout drastically

That is expected for an advanced CSS escape hatch.

Do NOT try to prevent all bad design choices.

The security boundary should be closer to:

```text
can heavily restyle its own tenant site
cannot execute JS
cannot inject HTML
cannot style outside the tenant-site root
cannot initiate prohibited external resource loads
```

State this trust model clearly.

---

# 27. Forms / Lead Capture

Custom CSS will potentially style Lead Form controls.

That is acceptable.

But verify it cannot alter:

- lead submission authorization
- endpoint
- honeypot semantics
- rate limiting
- client-side preview no-op behavior

No new form behavior should be introduced.

Custom CSS is visual only.

---

# 28. Stable Hooks and Future Evolution

We need to avoid painting ourselves into a compatibility corner.

Recommend a versioning philosophy for stable hooks.

For example:

```text
data-br-* hooks are supported Custom CSS API
internal Tailwind classes are not

existing data-br-* hooks should not be renamed casually
new hooks may be added over time
```

Do NOT introduce explicit `v1` in every attribute unless genuinely useful.

Determine whether a short developer comment/test should enforce the contract.

---

# 29. Public CSS Reference in Portal

Recommend a small reference panel such as:

```text
Stable selectors

[data-br-site]
[data-br-role="header"]
[data-br-role="nav"]
[data-br-section="hero"]
[data-br-section="about"]
[data-br-section="services"]
[data-br-section="gallery"]
[data-br-section="testimonials"]
[data-br-section="faq"]
[data-br-section="businessHours"]
[data-br-section="contact"]
[data-br-role="button"]
[data-br-role="card"]
[data-br-role="form"]
```

Only recommend selectors that can be meaningfully and consistently attached.

Do not dump every DOM node into the public API.

Maybe include a small copyable example.

No full docs site.

---

# 30. Preview Workflow

The existing authoritative workflow should remain:

```text
Edit Custom CSS
Save

Preview changes
  -> inspect WORKING CSS

Republish
  -> make CSS public
```

Do not add a separate embedded CSS preview iframe or live editor preview in V1.

Step 1.25 Preview already solves this.

---

# 31. Theme / Custom CSS Interaction UX

Portal should explain:

```text
Theme is the supported design system.
Custom CSS overrides Theme and may be affected by future site changes unless stable BakerRang hooks are used.
```

Do not overly scare the user.

Recommend a concise warning.

Resetting Theme should not erase Custom CSS.

Clearing Custom CSS should not alter Theme.

Add regression tests for their independence.

---

# 32. Favicon Is NOT Part of This Step

There is a known renderer:

```text
/favicon.ico -> 404
```

We intentionally deferred it because future public-site favicon should be tenant-configurable.

Do NOT solve favicon configuration as part of Custom CSS.

Favicons are metadata/assets, not CSS.

Leave this for a later branding/readiness enhancement.

---

# 33. Backwards Compatibility

Required:

```text
old SiteDefinition with no customCss
  -> unchanged

old published snapshot
  -> unchanged

new WORKING customCss
  -> Preview only

Republish
  -> public CSS
```

No migration unless absolutely unavoidable.

Malformed historical CSS should not crash public rendering.

Determine whether read-time validation/sanitization should:

- omit invalid historical CSS
- or trust only already-validated stored CSS

Prefer safe handling against manual Firestore corruption.

---

# 34. Public Failure Behavior

If stored Custom CSS somehow becomes malformed/corrupt:

```text
public site should still render
```

Prefer omission of unusable Custom CSS over breaking the site.

Determine where read-time normalization belongs.

This should mirror the strict-write / safe-read pattern established for Hours/Social where practical.

---

# 35. Tests — Server

Plan deterministic coverage for:

## Validation

- valid simple CSS
- multiple rules
- CSS variables
- media query
- pseudo selectors
- keyframes if allowed
- malformed syntax
- byte limit
- rejected `@import`
- rejected external `url()`
- rejected `@font-face` if prohibited
- comments containing prohibited text do not false-positive
- strings containing `url(` text do not false-positive if appropriate
- unknown payload fields

## Scoping

- simple selector
- comma-separated selectors
- `:root`
- `html`
- `body`
- universal selector
- nested @media selectors
- nested @supports selectors
- pseudo-elements
- already-scoped selector behavior
- keyframes unaffected/handled correctly

## Lifecycle

- save WORKING CSS
- public remains old
- publish promotes CSS
- clear WORKING CSS
- public retains old until Republish
- republish removes CSS

## Independence

- Custom CSS save preserves Theme
- Theme save preserves Custom CSS
- profile/content mutations preserve Custom CSS

---

# 36. Tests — Renderer

Plan coverage for:

- CSS emitted only when configured
- scoped CSS reaches tenant root
- no CSS emitted when absent
- Preview CSS cannot target Preview banner via transformed selectors
- published route uses published CSS
- shared/custom route behavior is identical
- Custom CSS comes after normal Theme CSS
- stable hook attributes exist
- About/FAQ/Hours/Social/Footer hooks exist where promised
- Lead form hooks exist where promised
- malformed sanitized CSS omitted safely
- no external CSS resource behavior introduced

If CSP is involved, test appropriate response/header behavior.

---

# 37. Tests — Portal

Cover:

- empty Custom CSS state
- existing CSS loads
- monospace editor
- Save
- validation error display
- byte counter if implemented
- Clear/Reset
- saved state propagates
- existing Preview action remains authoritative
- Theme unchanged
- stable selector help/reference visible
- warning that internal classes are unsupported
- mobile editor remains usable

Do not test syntax highlighting unless we actually implement it.

---

# 38. Manual DEV Verification

Plan a concrete DEV test.

At minimum include CSS like:

```css
[data-br-section="hero"] h1 {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

[data-br-section="services"] [data-br-role="card"] {
  border-width: 3px;
}

@media (max-width: 640px) {
  [data-br-role="header"] {
    border-bottom-width: 4px;
  }
}
```

Then verify:

- Preview changes
- published/custom remains old before Republish
- mobile media query
- Theme still works
- FAQ/Hours/About/Footer remain functional
- Lead form still submits publicly
- Republish updates custom domain

Also deliberately test a rejected external load such as:

```css
[data-br-site] {
  background-image: url("https://example.com/tracker.png");
}
```

and rejected:

```css
@import "https://example.com/foo.css";
```

Test scoping with:

```css
* {
  opacity: 0.5;
}
```

and confirm Preview chrome remains unaffected.

---

# 39. Implementation Slicing

Determine whether Step 1.28 should land as one implementation or small internal slices.

Potential:

```text
1.28a — stable hooks + CSS parser/scoping foundation
1.28b — storage/API + renderer injection
1.28c — Portal editor
1.28d — security/regression audit
```

or another sequence if cleaner.

We will still close the roadmap as one Step 1.28.

Avoid an unnecessarily giant first patch.

---

# 40. Explicit Scope Exclusions

Do NOT include:

- arbitrary JavaScript
- `<script>`
- arbitrary HTML
- HTML editor
- custom head markup
- custom meta tags
- favicon configuration
- arbitrary external CSS imports
- external font loading unless explicitly justified
- custom page templates
- section-level Custom CSS fields
- per-section background controls
- visual drag/drop builder
- live inline editing
- Monaco/CodeMirror unless strongly justified
- tenant arbitrary asset hosting
- production deployment

---

# 41. Output

Return:

1. Current-state findings
2. Recommended Custom CSS canonical storage model
3. Focused mutation/API design
4. Strict-write / safe-read strategy
5. CSS parser/dependency recommendation
6. Allowed CSS feature policy
7. External resource / `url()` policy
8. Selector scoping architecture
9. Preview isolation strategy
10. Stable `data-br-*` hook design
11. Theme interaction/cascade strategy
12. Renderer injection architecture
13. CSP/security implications
14. CSS size/complexity limits
15. Portal Custom CSS editor UX
16. Clear/removal semantics
17. Working/Published/Preview lifecycle
18. Backwards compatibility
19. Exact files likely created/modified
20. Testing plan
21. Manual DEV verification plan
22. Recommended implementation slices
23. Human decisions genuinely required
24. Explicit security/trust boundary

Favor a conservative, parser-based, scoped CSS escape hatch over simply persisting arbitrary CSS and dumping it globally into `<style>`.