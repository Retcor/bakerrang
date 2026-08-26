# Implement Step 1.28c — Portal Custom CSS Editor

Implement ONLY Step 1.28c of BakerRang Step 1.28.

Steps 1.28a and 1.28b are complete and independently audited APPROVED.

The backend and renderer already support:

```text
SiteDefinition.customCss
  = canonical raw operator-authored CSS

SiteDefinition.scopedCustomCss
  = transient server-derived scoped/safe CSS

PUT /tenants/:tenantId/site/custom-css
  { customCss: string | null }

Preview
  = WORKING Custom CSS

Published/shared/custom domain
  = PUBLISHED Custom CSS

Republish
  = promotes WORKING raw Custom CSS
```

The server is authoritative for:

- syntax validation
- 20 KB UTF-8 limit
- at-rule allowlist
- resource-loading rejection
- selector scoping
- style-breakout safety

This slice adds ONLY the Portal editing experience.

Do NOT modify the CSS security architecture unless an actual integration defect requires it.

---

# 1. Goal

Add an advanced Custom CSS editor to the Website workspace.

The operator should be able to:

```text
open Custom CSS
edit canonical raw CSS
save explicitly
see server validation errors
clear CSS
Preview changes
Republish when satisfied
```

This is an advanced escape hatch, not another Theme editor.

---

# 2. Portal Placement

Add Custom CSS to the Website workspace under Site Foundation, visually separated as an advanced capability.

Recommended conceptual organization:

```text
Site Foundation

Branding
Theme
Business Profile
Business Hours
Social Profiles
Manage Sections

Advanced
Custom CSS
```

If the existing UI structure makes it cleaner to place `Advanced` immediately before Manage Sections, preserve the existing hierarchy rather than creating an awkward layout.

The important UX distinction is:

```text
Theme
  normal supported visual controls

Custom CSS
  advanced override
```

Do not make Custom CSS look like an ordinary Theme setting.

---

# 3. Editor Mode / Wiring

Add the appropriate `BusinessWebsite` editor mode, conceptually:

```ts
'customCss'
```

Wire it through the same editor-selection and saved-site state flow as existing editors.

When save succeeds:

```text
API returned SiteDefinition
        ↓
BusinessWebsite shared site state updated
        ↓
editor remains consistent
        ↓
existing Republish state/message works
```

Do not introduce a second Website state store.

Do not manually patch only `customCss` into stale local state if the existing architecture already replaces state from the returned SiteDefinition.

---

# 4. API Client

Add a focused Portal API helper for:

```text
PUT /tenants/:tenantId/site/custom-css
```

Conceptually:

```ts
interface CustomCssUpdateInput {
  customCss: string | null
}
```

Use the same auth/credentials/error helpers as the existing Website mutations.

Do NOT call:

- general site update
- Theme endpoint
- Business Profile endpoint

Custom CSS saves must use only the focused Custom CSS endpoint.

---

# 5. Canonical Editing Field — CRITICAL

The editor must load:

```text
site.customCss
```

NOT:

```text
site.scopedCustomCss
```

The operator must see exactly the canonical raw CSS they authored.

For example, if they saved:

```css
body {
  color: red;
}
```

the editor must continue to display:

```css
body {
  color: red;
}
```

NOT the server-generated:

```css
[data-br-site] {
  color: red;
}
```

`scopedCustomCss` is renderer infrastructure and must not be displayed as editable source.

Add a test specifically proving this distinction.

---

# 6. CustomCssEditor

Create:

```text
CustomCssEditor.tsx
```

following existing editor component conventions.

Use a normal multiline textarea.

Do NOT add:

- Monaco
- CodeMirror
- Ace
- syntax highlighting framework
- CSS parser
- client AST transformer

Use existing `@bakerrang/ui` primitives where appropriate.

---

# 7. Textarea UX

The editor should be:

```text
monospace
large enough for useful editing
full width
mobile safe
spellcheck=false
autoCapitalize=off
autoCorrect=off
```

Soft wrapping is acceptable for V1.

A sensible minimum height should make it feel like a code editor without becoming the entire page.

No requirement for line numbers.

No requirement for tab-key indentation logic beyond normal textarea behavior unless trivial to add without accessibility problems.

---

# 8. Explicit Save

Do NOT persist on every keystroke.

Use explicit:

```text
Save Custom CSS
```

behavior.

On Save:

```text
nonblank editor
  -> send raw string

blank/whitespace-only editor
  -> send customCss: null
```

The backend remains authoritative.

Show normal pending/saved/error state using existing Website editor patterns.

---

# 9. Clear Behavior

Provide a simple:

```text
Clear
```

action.

Preferred behavior:

```text
Clear
  -> sets textarea to empty locally
  -> marks editor dirty
  -> operator presses Save Custom CSS
  -> sends customCss:null
```

No confirmation dialog required.

Do NOT make Clear immediately mutate the server unless existing editor UX strongly favors that pattern.

Make it clear that the change is not saved until Save.

---

# 10. Byte Counter

Display the UTF-8 usage relative to:

```text
20 KB
```

Example:

```text
3.8 KB / 20 KB
```

Use actual UTF-8 byte measurement, not JS string length.

Browser implementation can use:

```ts
new TextEncoder().encode(value).length
```

or equivalent.

The counter is UX only.

Server remains authoritative.

---

# 11. Client Size Behavior

When editor contents exceed 20 KB:

- visibly indicate the limit is exceeded
- disable Save OR provide a clear local validation error
- do not knowingly send oversized content

Still retain server-side enforcement.

Do not duplicate the entire CSS security validator in TypeScript.

---

# 12. Do NOT Duplicate CSS Parsing Client-Side

Do not implement client checks for:

```text
@import
url()
@font-face
selector scoping
syntax correctness
```

using regex or substring matching.

That would create a second inconsistent security policy.

The Portal should send CSS to the authoritative server and surface its validation response.

The only client-authoritative-ish precheck needed is the byte limit for UX.

---

# 13. Server Validation Errors

When the API returns a Custom CSS validation error, surface the message directly in a normal Portal `StatusMessage`/error UI.

Examples may include:

```text
Line 3: @import is not supported.
Line 8: Custom CSS cannot load resources with url().
Line 14: Unexpected closing brace.
Custom CSS exceeds 20 KB.
```

Do not expose stack traces or raw response objects.

Do not replace the useful server message with generic:

```text
Something went wrong.
```

if the existing API helper provides a safe user-facing message.

---

# 14. Advanced Warning

Display concise explanatory copy near the editor.

Something roughly equivalent to:

```text
Custom CSS is an advanced override for styles not available through Theme.
Changes appear in Preview before they are published.
```

Also communicate:

```text
Use BakerRang's stable data-br-* selectors.
Internal Tailwind/classes are not a supported styling API.
```

Keep this concise.

Do not make it sound dangerous or unsupported.

---

# 15. Theme Relationship

Explain succinctly:

```text
Theme remains the recommended way to configure colors, fonts,
spacing and other standard site styling.

Custom CSS can override rendered styles where the normal CSS
cascade allows.
```

Do NOT claim that Custom CSS can override all Theme variables.

Current V1 intentionally does NOT support overriding the inline:

```text
--site-*
```

variables.

Avoid giving examples that imply otherwise.

---

# 16. Stable Selector Reference

Add a compact reference panel in the editor.

Document ONLY the stable public API implemented in Step 1.28a.

Include these where actually supported:

```text
[data-br-site]

[data-br-role="header"]
[data-br-role="nav"]
[data-br-role="main"]
[data-br-role="footer"]
[data-br-role="social"]

[data-br-section="hero"]
[data-br-section="about"]
[data-br-section="services"]
[data-br-section="gallery"]
[data-br-section="testimonials"]
[data-br-section="faq"]
[data-br-section="businessHours"]
[data-br-section="contact"]

[data-br-role="section-heading"]
[data-br-role="card"]
[data-br-role="button"]
[data-br-role="form"]
[data-br-role="input"]
```

If `data-br-section-id` is part of the stable contract, mention it briefly.

Do NOT document internal Tailwind classes.

---

# 17. Reference UX

Do not turn the selector reference into a huge documentation page.

Prefer:

```text
Stable selectors
[small expandable/reference panel]
```

or another compact presentation consistent with the Portal.

It should remain usable at:

```text
375px
768px
desktop
```

Long selector strings must wrap or horizontally scroll inside their own code element without causing page-level overflow.

---

# 18. Example CSS

Include one short copyable/readable example.

Use the supported stable hooks.

For example:

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

Do not include:

```text
url()
@import
@font-face
@layer
@property
@container
```

Do not suggest unsupported Theme-variable overrides.

---

# 19. Explicit Resource Policy Copy

The editor should briefly state that Custom CSS cannot load external resources.

Something concise like:

```text
For visitor privacy and security, external CSS resources such as
@import, @font-face and url(...) are not supported.
```

No need to enumerate every rejected CSS construct.

---

# 20. Preview Workflow

Reuse the existing Step 1.25 Preview flow.

Do NOT add:

- iframe inside the editor
- live side-by-side preview
- per-keystroke renderer calls
- special CSS preview token
- alternate Preview button implementation

The workflow remains:

```text
Edit CSS
Save

Preview changes
  -> existing Preview opens WORKING site

Republish
  -> existing Publish/Republish promotes it
```

Custom CSS editor should fit naturally into that model.

---

# 21. Dirty State

Inspect existing editors and follow their established dirty/save behavior.

At minimum:

```text
editing textarea
  -> local unsaved state

successful save
  -> clean state

failed save
  -> contents remain available
```

Do not lose the operator's CSS if the server rejects it.

---

# 22. Switching Editors

Inspect `BusinessWebsite` editor-mode behavior.

If switching editor modes with unsaved content currently does not warn for other editors, do not invent a Custom-CSS-only navigation guard.

If there is an existing unsaved-change convention, reuse it.

Consistency is more important than bespoke behavior here.

---

# 23. Returned SiteDefinition

After save, ensure the returned SiteDefinition updates:

```text
customCss
scopedCustomCss
```

in shared state as supplied by the server.

The editor itself should continue using only:

```text
customCss
```

as source text.

The Preview renderer will naturally consume:

```text
scopedCustomCss
```

through the existing API path.

Do not manually compute scoped CSS in Portal.

---

# 24. Clear + Published Isolation

The editor should not imply Clear instantly removes CSS from the public site.

UX wording should remain consistent with existing WORKING/PUBLISHED semantics:

```text
Saved changes are available in Preview.
Republish to update the public site.
```

After saved clear:

```text
Preview -> no CSS
public -> old published CSS
```

until Republish.

No new lifecycle logic required.

---

# 25. Mobile Layout

Explicitly verify at:

```text
375px
768px
desktop
```

The editor should:

- remain inside viewport
- textarea use available width
- actions wrap sensibly
- selector examples/reference do not create page overflow
- byte counter remains readable
- warning/reference text remains legible

Do not add desktop-only editing controls.

---

# 26. Accessibility

Ensure:

- textarea has a real label
- validation/status text is understandable
- Save/Clear are keyboard accessible
- focus-visible behavior follows UI primitives
- code/reference text has adequate semantics
- color is not the only indicator of over-limit/error state

No advanced code-editor accessibility work is needed because we are deliberately using a standard textarea.

---

# 27. Tests — API Helper

Add or extend Portal tests to prove:

```text
updateCustomCss uses:
PUT /tenants/:tenantId/site/custom-css
```

and sends:

```json
{ "customCss": "..." }
```

or:

```json
{ "customCss": null }
```

No general site/profile/theme endpoint.

---

# 28. Tests — Editor Loading

Cover:

```text
no customCss
  -> empty editor

raw customCss exists
  -> exact raw value shown

raw customCss + scopedCustomCss differ
  -> editor shows raw customCss
  -> scopedCustomCss never appears as editable source
```

This distinction is important.

---

# 29. Tests — Save

Cover:

```text
edit CSS
click Save
focused endpoint called
raw CSS submitted exactly
success updates shared site state
saved/Republish messaging appears through normal workflow
```

No client scoping.

---

# 30. Tests — Clear

Cover:

```text
existing CSS
Clear
textarea empty
Save
API receives customCss:null
returned site state has no CSS
```

If Clear requires Save, test that Clear alone does NOT issue the mutation.

---

# 31. Tests — Error Preservation

Simulate server rejection.

Example server error:

```text
Line 2: @import is not supported.
```

Verify:

```text
message visible
textarea content remains intact
site state not falsely marked saved
```

---

# 32. Tests — Byte Limit

Test UTF-8 byte semantics.

Use non-ASCII content so character count != byte count.

Verify:

```text
counter uses UTF-8 bytes
over-limit state is visible
Save prevented/disabled appropriately
```

Do not rely only on ASCII.

---

# 33. Tests — Selector Reference

Verify the reference exposes the stable contract, especially:

```text
[data-br-site]
[data-br-section="hero"]
[data-br-section="faq"]
[data-br-section="businessHours"]
[data-br-role="card"]
[data-br-role="form"]
```

Do not test every line if that makes the test brittle.

Test enough to prove the reference is the stable `data-br-*` API rather than Tailwind classes.

---

# 34. Theme Independence

Editor save/clear must not mutate Theme state.

Test at least one representative SiteDefinition containing Theme.

After Custom CSS save:

```text
theme remains unchanged
```

This should mostly fall out of returned server state, but verify Portal does not locally reconstruct/drop fields.

---

# 35. Existing Editor Regression

Ensure adding Custom CSS editor mode does not break access to:

- Branding
- Theme
- Business Profile
- Business Hours
- Social Profiles
- Manage Sections
- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Contact

No major Website navigation redesign in this step.

That belongs to Step 1.29.

---

# 36. No Custom CSS Parsing in Portal

Search the Portal diff.

There must be no:

```text
css-tree
postcss parser
CSS AST
selector rewriting
regex security validator
```

added to Portal.

Only:

```text
UTF-8 byte count
```

plus normal form behavior.

---

# 37. No Renderer / Server Redesign

1.28c should not modify:

```text
server/domain/customCss.js
selector scoping
read finalizer
Renderer style injection
Preview stacking isolation
```

unless a real integration bug is discovered.

If such a bug is found, report it rather than casually rewriting audited security code.

---

# 38. Favicon Still Out of Scope

Do not touch:

```text
/favicon.ico
favicon configuration
branding favicon
```

Still deferred.

---

# 39. Automated Verification

Run:

- backend tests
- Portal tests
- Renderer tests
- shared UI tests
- platform-wide typecheck
- platform lint
- touched server lint if any server file was necessarily touched
- Portal production build
- Renderer production build
- `git diff --check`

Ideally Step 1.28c should require no server changes.

Report unrelated existing warnings separately.

---

# 40. Manual Verification Recommendation

Do NOT deploy automatically.

Return a recommended DEV test using:

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

Also recommend testing rejected input:

```css
[data-br-site] {
  background-image: url("https://example.com/tracker.png");
}
```

and:

```css
@import "https://example.com/foo.css";
```

And hostile-but-valid scoped CSS:

```css
* {
  opacity: 0.5;
}
```

plus a high-z-index/fixed tenant rule for Preview-banner protection.

---

# 41. Explicitly Out of Scope

Do NOT implement:

- live embedded preview
- Monaco
- CodeMirror
- syntax highlighting framework
- auto-formatting
- CSS autocomplete
- external CSS resources
- Theme-variable refactor
- section-level CSS
- arbitrary HTML
- arbitrary JavaScript
- favicon configuration
- Step 1.29 Website UX overhaul
- production deployment

---

# 42. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. Website placement
4. editor/raw-field behavior
5. focused API helper
6. Save/Clear behavior
7. UTF-8 byte counter behavior
8. validation-error UX
9. stable-selector reference
10. Preview/Republish workflow integration
11. mobile/accessibility behavior
12. tests added/updated
13. full verification results
14. deviations and why
15. anything that must be addressed before Step 1.28d/security audit