# Implement Step 1.28b — Custom CSS Storage, Read Finalization, Renderer Injection & Preview Isolation

Implement ONLY Step 1.28b of BakerRang Step 1.28.

Step 1.28a is complete and audited.

Existing foundation includes:

- `css-tree` server runtime dependency
- `server/domain/customCss.js`
- strict Custom CSS validation
- safe stored-CSS normalization
- AST selector scoping to `[data-br-site]`
- all external/resource-loading CSS rejected
- style-breakout-safe scoped serialization
- stable public `data-br-*` styling hooks

This slice makes Custom CSS an actual SiteDefinition capability.

Implement:

1. canonical raw Custom CSS storage
2. focused mutation API
3. dedicated SiteDefinition read-finalization seam
4. transient scoped CSS delivery
5. Renderer `<style>` injection
6. Preview stacking isolation
7. lifecycle / cross-tenant / regression tests

Do NOT implement the Portal Custom CSS editor yet.

That belongs to Step 1.28c.

---

# 1. Canonical vs Scoped CSS — IMPORTANT

Do NOT use one field to mean two different things.

Canonical SiteDefinition data:

```ts
customCss?: string
```

This is the operator-authored, raw, validated CSS.

Transient read-time data:

```ts
scopedCustomCss?: string
```

This is the server-generated, safe, selector-scoped CSS intended for renderer injection.

Conceptually:

```text
customCss
  = canonical/editable/publishable

scopedCustomCss
  = derived/read-time/browser-safe
```

This distinction is required.

Do NOT replace:

```text
customCss
```

with its scoped version during ordinary reads.

The future Portal editor in Step 1.28c must be able to load the exact canonical CSS the operator wrote.

---

# 2. Shared Schema

Extend the shared site schema approximately as:

```ts
export interface SiteDefinition {
  status: SiteStatus
  branding: SiteBranding
  theme: SiteTheme

  customCss?: string

  /**
   * Read-time only. Derived by the API from customCss.
   * Never persisted as canonical site state.
   */
  scopedCustomCss?: string

  businessProfile?: BusinessProfile
  pages: SitePage[]
}
```

Use existing naming/comment conventions.

Do not put Custom CSS in:

- BusinessProfile
- Theme
- Home.sections
- Branding

It is a site-level presentation concern.

---

# 3. Canonical Storage

Persist canonical raw CSS at:

```text
config.customCss
```

or the exact equivalent dictated by the existing config document.

Only validated raw CSS may be written.

Do NOT persist:

```text
scopedCustomCss
```

Do NOT persist selector-rewritten output.

Do NOT migrate existing sites.

Absence of `customCss` is valid.

---

# 4. SiteDefinition Creation

Update the canonical SiteDefinition creation/normalization path so:

```text
config.customCss
    ↓
SiteDefinition.customCss
```

passes through unchanged as raw canonical data.

This includes:

- WORKING SiteDefinition
- PUBLISHED snapshot creation
- old snapshot normalization

Do NOT scope CSS while building the canonical snapshot.

Published snapshots should contain:

```text
customCss
```

but never:

```text
scopedCustomCss
```

---

# 5. Dedicated Read-Finalization Seam

Do NOT teach:

```text
mediaService
```

about Custom CSS.

Introduce or formalize a dedicated SiteDefinition read-finalization step.

Conceptually:

```js
async function finalizeSiteDefinitionRead(tenantId, definition) {
  const hydrated = await hydrateSiteMedia(tenantId, definition)
  const scopedCustomCss = normalizeStoredCustomCss(definition.customCss)

  return {
    ...hydrated,
    ...(scopedCustomCss ? { scopedCustomCss } : {})
  }
}
```

Exact structure may differ.

The architectural requirement is:

```text
canonical SiteDefinition
       ↓
dedicated read finalizer
       ├── media hydration
       └── Custom CSS safe normalization/scoping
       ↓
delivered SiteDefinition
```

Do not import CSS-domain semantics into `mediaService`.

Avoid duplicating this finalization at numerous callers if a clean centralized seam exists.

---

# 6. Safe Read Behavior

`normalizeStoredCustomCss()` from Step 1.28a is authoritative for stored CSS safety.

Required:

```text
no customCss
  -> no scopedCustomCss

valid customCss
  -> canonical customCss retained
  -> scopedCustomCss added

malformed customCss
  -> canonical raw value may remain available to authenticated editing reads
  -> scopedCustomCss MUST be omitted
  -> site still renders

unsafe resource-bearing stored CSS
  -> scopedCustomCss omitted
  -> no renderer injection
```

A manually-corrupted Firestore field must never break a public request.

The renderer must NEVER fall back to injecting raw:

```text
customCss
```

when `scopedCustomCss` is absent.

Fail closed.

---

# 7. Focused Mutation API

Add:

```text
PUT /tenants/:tenantId/site/custom-css
```

Use the current site-content editing authorization policy.

Conceptual payload:

```ts
{
  customCss: string | null
}
```

Semantics:

```text
valid nonblank string
  -> validate strictly
  -> store raw validated CSS

null
  -> remove canonical customCss

empty / whitespace-only
  -> canonical removal
```

Use the same endpoint for save and clear.

No DELETE route.

---

# 8. Authoritative Write Validation

The focused mutation MUST invoke the strict Step 1.28a Custom CSS validator before persistence.

Do not trust:

- Portal/client validation
- browser parsing
- previously scoped CSS

Only raw operator CSS goes into the validator.

Invalid CSS returns the normal 400-style response with the actionable validation message from the domain layer.

Do not expose parser stack traces.

---

# 9. Focused Mutation Preservation

The Custom CSS mutation is allowed to alter only:

```text
config.customCss
updatedAt
```

It must preserve all other site config state.

Explicitly preserve:

```text
branding
theme
businessProfile
businessHours
socialLinks
future/unknown config fields
```

It must not touch:

```text
Home.sections
published/current
domain state
lead state
```

Use the same raw-object spread philosophy as the focused Hours/Social mutations.

Add a future/unknown-field preservation regression test.

---

# 10. General Mutation Compatibility

Once `config.customCss` exists, every existing ordinary mutation must continue preserving it.

Audit at least:

```text
Theme save
Branding save
Business Profile save
Business Hours save
Social Profiles save
About save
FAQ save
section composition
publish/unpublish lifecycle
```

No existing editor should need to resend `customCss`.

Add targeted regression tests where actual mutation semantics make data-loss plausible.

Do not create unnecessary repetitive tests for paths that provably never touch config.

---

# 11. Clear Semantics

When:

```text
customCss = null
```

or blank input resolves to removal:

```text
delete config.customCss
```

Do not persist:

```text
customCss: null
customCss: ""
```

unless an existing canonical convention strongly requires it.

Returned working SiteDefinition should have neither:

```text
customCss
scopedCustomCss
```

after successful removal.

---

# 12. Working / Published Lifecycle

Required lifecycle:

```text
Published raw CSS A

Save WORKING raw CSS B

Authenticated working read:
  customCss = B
  scopedCustomCss = scoped(B)

Preview:
  inject scoped(B)

Shared/custom published:
  still inject scoped(A)

Republish:

Shared/custom:
  inject scoped(B)
```

Then:

```text
Clear WORKING CSS

Preview:
  no Custom CSS

public:
  still A/B published CSS

Republish:

public:
  no Custom CSS
```

No Custom-CSS-specific publish mechanism.

No Custom-CSS-specific preview token mechanism.

Use the existing snapshot boundary.

---

# 13. Publish Snapshot Integrity

This is important.

`publishSite` must snapshot canonical:

```text
customCss
```

only.

It must NOT snapshot:

```text
scopedCustomCss
```

or another hydrated/read-time derivative.

Prove this with a deterministic test.

After publishing, inspect the stored snapshot object in FakeDb or equivalent and assert the transient scoped field is absent.

This mirrors the provider-neutral media principle.

---

# 14. Renderer Injection

The Renderer must consume ONLY:

```text
site.scopedCustomCss
```

Never:

```text
site.customCss
```

for browser injection.

Add a small component or SiteShell behavior such as:

```tsx
{site.scopedCustomCss ? (
  <style id="br-custom-css">{site.scopedCustomCss}</style>
) : null}
```

Use normal JSX.

Do NOT use:

```text
dangerouslySetInnerHTML
```

Step 1.28a already guarantees the scoped output contains no literal `<`.

---

# 15. Injection Position / Cascade

The Custom CSS `<style>` must be server-rendered and present on first paint.

No client fetch.

No hydration-time injection.

It must follow the normal Theme/site CSS in cascade/source order so custom rules can override ordinary element properties when specificity allows.

Do NOT refactor Theme variables.

Theme remains inline on `[data-br-site]`.

`--site-*` overriding remains unsupported V1 behavior.

---

# 16. Style Element Ownership

Give the style node a stable renderer-owned identifier:

```text
id="br-custom-css"
```

Do NOT expose it as a documented Custom CSS hook.

It is implementation infrastructure, not part of `data-br-*` API.

Only one Custom CSS style block should exist per rendered tenant document.

---

# 17. Home + Contact

Custom CSS is site-level.

Confirm the same `scopedCustomCss` is applied for:

```text
/
```

and:

```text
/contact
```

where those routes use the same SiteDefinition/SiteShell.

Do not create separate CSS per page in V1.

---

# 18. Preview Isolation — IMPORTANT

Custom CSS can style:

```text
[data-br-site]
```

itself.

Therefore merely putting:

```text
isolation:isolate
```

on `[data-br-site]` is NOT sufficient, because tenant CSS could set:

```css
[data-br-site] {
  position: fixed;
  z-index: 999999;
}
```

and raise the tenant root relative to Preview chrome.

Instead, PreviewFrame must own a wrapper OUTSIDE the tenant CSS scope.

Conceptually:

```tsx
<div data-preview-frame>
  <div data-preview-banner className="relative z-50">
    Preview — not published
  </div>

  <div
    data-preview-site-layer
    className="relative z-0 isolate"
  >
    {tenantSite}
  </div>
</div>
```

The important properties are:

```text
Preview banner
  renderer-owned
  outside [data-br-site]
  higher stacking layer

Preview tenant wrapper
  renderer-owned
  outside [data-br-site]
  creates stacking context
  lower than banner

[data-br-site]
  descendant of wrapper
  fully tenant-styleable
```

Tenant CSS cannot target the parent wrapper because all selectors are scoped at/inside `[data-br-site]`.

---

# 19. Do NOT Change Fixed-Position Semantics

Do NOT use these as the primary Preview containment mechanism:

```text
transform: translateZ(0)
contain: layout paint
```

because they can change:

```text
position: fixed
layout
paint containment
```

relative to the published site.

The goal is:

```text
Preview has public-like layout semantics
+
renderer-owned banner always remains above tenant content
```

Use stacking-context layering, not layout containment.

---

# 20. Hostile CSS Preview Test

Test valid CSS such as:

```css
* {
  opacity: .5;
}
```

Expected:

```text
tenant descendants dim
Preview banner unaffected
```

Also test:

```css
[data-br-site] {
  position: fixed;
  inset: 0;
  z-index: 999999;
}

[data-br-site] * {
  display: none;
}
```

The tenant site may destroy its own appearance.

That is allowed.

But Preview banner must remain in a higher renderer-owned stacking context and remain reachable.

A DOM/class structural test may be combined with manual browser verification later.

Do not attempt to stop operators from ruining their own site.

---

# 21. Raw CSS Must Never Reach Browser as CSS

Add a security regression proving:

```text
customCss = raw canonical CSS
scopedCustomCss = safe derived CSS
```

and Renderer uses only the latter.

A deliberately unscoped canonical rule such as:

```css
body {
  color: red;
}
```

should arrive at Renderer injection as equivalent to:

```css
[data-br-site] {
  color: red;
}
```

The raw:

```css
body { ... }
```

must not be the injected style payload.

---

# 22. Corrupt Stored CSS

Seed a working/published site manually with invalid or prohibited stored CSS.

Examples:

```css
@import "https://example.com/foo.css";
```

or malformed CSS.

Required public behavior:

```text
site renders
no br-custom-css style emitted
no external fetch construct reaches browser
```

Do not mutate the stored Firestore bytes during read.

---

# 23. Cross-Tenant Isolation

Add an explicit two-tenant regression.

Conceptually:

```text
Tenant A:
  customCss = h1 { color:red }

Tenant B:
  customCss = h1 { color:blue }
```

Finalize/read both independently.

Verify:

```text
A.scopedCustomCss contains only A CSS
B.scopedCustomCss contains only B CSS
```

No global mutable CSS cache/state.

Publishing A must not alter B.

No stylesheet file should be generated/shared globally.

---

# 24. Public API / Sanitized Data

Renderer remains Firestore-free.

Expected:

```text
Renderer
   ↓
existing sanitized API
   ↓
SiteDefinition
   ↓
scopedCustomCss
```

No renderer parser.

No renderer Firestore call.

No renderer-side selector rewriting.

All security transformation stays server-authoritative.

---

# 25. Public Raw customCss

Evaluate the existing API response architecture.

If using the shared SiteDefinition response means public/preview responses also contain:

```text
customCss
```

raw as inert JSON alongside:

```text
scopedCustomCss
```

that is not itself a browser-security issue, because Renderer MUST ignore raw customCss.

However, if there is already a clean sanitized-public-response seam that can omit canonical authoring-only fields without duplicating architecture, prefer omitting raw customCss from anonymous public responses.

Do NOT create a large new DTO architecture solely for this concern.

The hard requirement is:

```text
raw customCss must never be injected
```

The future authenticated Portal working read must retain raw customCss for editing.

Report the chosen behavior.

---

# 26. Read Finalizer Ordering

Ensure finalization is deterministic.

A reasonable order is:

```text
canonical definition
   ↓
hydrate provider-neutral media
   ↓
derive scopedCustomCss
   ↓
return finalized read
```

or derive CSS before media if there is no semantic dependency.

Neither should mutate the canonical input object in ways that pollute snapshots.

Avoid accidentally running the scoped CSS through validation multiple unnecessary times within one read if the domain API can make this clean.

The 20 KB bound means minor duplication is not a blocker, but keep ownership clear.

---

# 27. Read Finalizer Reuse

Identify all read paths that must return finalized tenant data.

At minimum inspect:

```text
authenticated working getSite
Preview get
shared published get
custom-domain published get
possibly contact route's site retrieval
```

Ensure no path bypasses CSS finalization and accidentally lacks:

```text
scopedCustomCss
```

when valid Custom CSS exists.

Likewise, no path should inject raw CSS as a fallback.

---

# 28. Renderer Tests

Add deterministic coverage for:

```text
no CSS -> no #br-custom-css

valid CSS:
  #br-custom-css emitted
  uses scopedCustomCss

raw customCss alone:
  NOT injected

scoped selectors:
  present in style node

Home:
  CSS applied/injected

Contact:
  CSS applied/injected

malformed stored CSS:
  no style node

Preview:
  site CSS emitted
  Preview banner outside data-br-site
  renderer-owned stacking wrapper outside data-br-site
  banner stacking layer > tenant layer

public:
  no Preview wrapper/banner behavior

shared/custom:
  same published scoped CSS behavior
```

Do not rely on giant snapshots.

---

# 29. Server Tests

Add deterministic coverage for:

## Mutation

```text
valid save
null removal
empty removal
whitespace removal
invalid CSS -> 400
20KB enforcement via existing domain
unknown request fields ignored
```

## Preservation

```text
branding preserved
theme preserved
businessProfile preserved
businessHours preserved
socialLinks preserved
future config field preserved
home sections untouched
```

## Canonical vs transient

```text
stored config has raw customCss
working read has raw customCss + scopedCustomCss
published stored snapshot has raw customCss only
published read has raw customCss + scopedCustomCss
```

## Safe read

```text
invalid stored raw CSS
  -> raw canonical remains unchanged in storage
  -> scopedCustomCss omitted
  -> read succeeds
```

## Lifecycle

```text
publish A
edit WORKING B
working read B
public A
republish
public B

clear WORKING
working no CSS
public still B
republish
public no CSS
```

## Cross-tenant

```text
A CSS != B CSS
no mixing
```

---

# 30. Route Authorization

Test:

```text
PUT /tenants/:tenantId/site/custom-css
```

uses the existing site-content policy.

No anonymous write.

No broadened tenant-role behavior.

Reuse current:

```text
auth
CSRF
platformAdmin
tenant limiter
error handling
```

or exact existing route conventions.

---

# 31. Theme Independence

Regression-test:

```text
save Custom CSS
  -> Theme unchanged

save Theme
  -> Custom CSS unchanged

clear Custom CSS
  -> Theme unchanged

reset/change Theme
  -> Custom CSS unchanged
```

Do not refactor Theme.

Do not make Theme editor aware of Custom CSS.

---

# 32. BusinessProfile / Sections Independence

Verify representative operations after Custom CSS exists:

```text
Business Profile save
Business Hours save/remove
Social save/remove
About save
FAQ save
Manage Sections reorder
```

Custom CSS must remain untouched.

Likewise Custom CSS save must not affect them.

Target code paths with data-loss risk; do not add dozens of redundant tests.

---

# 33. No External Fetch Regression

Because the server-generated:

```text
scopedCustomCss
```

is the ONLY browser-injected value, no rejected resource construct may reach `<style>`.

Add a regression using manually-corrupted stored:

```css
[data-br-site] {
  background: url("https://example.com/tracker.png");
}
```

Safe-read normalization must result in:

```text
no scopedCustomCss
```

not "best effort" CSS with the bad declaration stripped.

Fail the whole stylesheet closed.

---

# 34. Renderer Security

No:

```text
dangerouslySetInnerHTML
eval
new Function
DOMParser
client CSS parser
```

for Custom CSS.

Use normal JSX `<style>` child.

The Step 1.28a scoped serializer guarantees no literal `<`.

Add a regression proving a canonical valid string containing:

```css
content: "</style><script>alert(1)</script>";
```

produces safe scoped CSS and does not create script markup in renderer output.

---

# 35. No CSP Redesign

Renderer currently has no CSP.

Do not add or weaken CSP in this slice.

Do not add:

```text
unsafe-inline
```

headers.

Custom CSS inline style behavior works under current renderer configuration.

CSP can be handled separately if/when the renderer receives one.

---

# 36. No Portal Editor Yet

There must still be NO:

```text
CustomCssEditor
Website Custom CSS button
textarea
byte counter
stable-selector help UI
```

Those are Step 1.28c.

The only user-visible public effect of 1.28b is that stored CSS can now render if written through the API.

---

# 37. No Favicon Work

Do not touch:

```text
/favicon.ico
favicon metadata
tenant favicon
Branding favicon
```

Still deferred.

---

# 38. Automated Verification

Run:

- full backend tests
- Portal tests
- Renderer tests
- shared UI tests
- platform-wide typecheck
- platform lint
- touched server lint
- Portal production build
- Renderer production build
- `git diff --check`

Report global unrelated server lint separately.

---

# 39. Explicitly Out of Scope

Do NOT implement:

- Portal Custom CSS editor
- syntax highlighting
- Monaco / CodeMirror
- Theme variable refactor
- @layer
- @property
- @container
- external resources
- custom fonts through CSS
- section-level CSS
- arbitrary HTML
- arbitrary JavaScript
- favicon configuration
- production deployment

---

# 40. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. final SiteDefinition raw/scoped field model
4. focused API/mutation behavior
5. read-finalization architecture
6. canonical snapshot behavior
7. Renderer injection behavior
8. Preview stacking-isolation behavior
9. corrupt-storage fail-closed behavior
10. cross-tenant isolation
11. lifecycle behavior
12. Theme/profile/section preservation
13. tests added/updated
14. complete verification results
15. any deviations and why
16. anything that must be addressed before Step 1.28c