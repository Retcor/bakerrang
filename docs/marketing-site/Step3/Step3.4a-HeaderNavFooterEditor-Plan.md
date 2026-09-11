# Step 3.4a — Header / Navigation / Footer Foundation
## Schema + Server + Renderer

Implement ONLY Step 3.4a.

Portal Header/Footer editors are Step 3.4b and must NOT be implemented yet.

Step 3 remains on the existing Step3 branch / PR.

Expected baseline from Claude:

Branch:
Step3

HEAD:
d5668ac
"Step 3.3 - Add multi-page marketing sites"

Server:
347 pass

Portal:
109 pass

Renderer:
63 pass

UI:
9 pass

Typecheck/lint:
clean

The only pre-existing working-tree change should be the Step 3.4 Plan/Spec doc.

Verify actual state first.

Do NOT reset/discard the Step 3.4 spec.
Do NOT deploy.
Do NOT mutate Firestore/GCP.
Do NOT perform a data transition.
Do NOT modify infrastructure.
Do NOT add dependencies.

---

# 1. Core Step 3.4 architecture

Header, Navigation, and Footer are GLOBAL SITE CONFIG.

They are:

- stored on `site/config`
- represented on `SiteDefinition`
- captured inside the existing single `published/current.siteDefinition`
- applied to every Page

They are NOT:

- SiteSections
- Page fields
- per-page overrides
- separate published documents

Working config saves immediately to WORKING.

Preview uses working Header/Footer.

Public remains unchanged until Publish Site.

---

# 2. IMPORTANT correction: NavigationItem has NO separate UUID

Use:

interface NavigationItem {
pageId: string
label?: string
}

Do NOT add:

id: string

to NavigationItem.

Reason:

- the same Page is forbidden from appearing twice in one navigation collection
- `pageId` is immutable and unique within the menu
- `pageId` is sufficient for React identity, reordering, pruning, and CSS hooks
- a second synthetic identity layer adds unnecessary server/client complexity

Header and Footer are separate collections, so the same pageId may appear once
in each.

If future navigation supports non-Page targets or duplicate targets, item identity
can be revisited then.

Do NOT implement nested nav-item UUID minting.

---

# 3. Navigation schema

Use page-only targets.

Conceptually:

interface NavigationItem {
pageId: string
label?: string
}

No:

slug
href
sectionId
externalUrl
type discriminator

Navigation resolves Page hrefs at render time from the current SiteDefinition.

Navigation ordering is the array order.

It is completely independent from:

config.pageOrder

A Page is included in Header navigation iff its pageId appears in:

header.navigation.items

Do NOT add:

includeInNavigation

to SitePage.

---

# 4. Header schema

Implement conceptually:

interface SiteHeader {
brandDisplay: 'logo' | 'logoAndName' | 'name'

navigation: {
items: NavigationItem[]
}

cta?: {
buttonLabel: string
action: LinkAction
}
}

Adjust exact naming only if existing schema conventions strongly favor another
shape.

Header CTA:

- optional
- both buttonLabel + action present or CTA absent
- LinkAction only:
  email
  phone
  url
- NO leadForm
- URL remains http/https only
- no fabricated default

Reuse existing LinkAction validation semantics.

---

# 5. Header brandDisplay — IMPORTANT

Default:

brandDisplay = 'logo'

This intentionally preserves today's effective header behavior.

Rendering:

`logo`:
- logo exists → render logo
- logo missing → render site name fallback

`logoAndName`:
- logo exists → render logo + site name
- logo missing → render site name

`name`:
- render site name only

There must always be a visible/accessibly-labelled Home brand link.

Never create an invisible Home link because logo data is absent.

Do NOT default to `logoAndName`.

---

# 6. Header navigation semantics

Navigation is flat.

Pages only.

No:

- nested menu
- dropdown hierarchy
- section anchors
- arbitrary external menu links
- nav groups
- mega menu

A Header Page item:

pageId
optional label

Label resolution:

custom nonblank label
→ custom label

otherwise
→ target Page title from the CURRENT SiteDefinition

Therefore:

Working Preview:
uses working Page title

Published:
uses published Page title

Changing a Page title requires NO nav config mutation.

---

# 7. Home navigation semantics

Home may:

- be absent from Header navigation
- be present
- move anywhere in Header menu order

Do NOT force Home first.

Do NOT automatically include Home.

The brand itself always links to Home.

Home existence and Home menu membership are separate concepts.

---

# 8. Duplicate refs

Within ONE navigation collection:

same pageId may appear at most once.

Reject duplicates server-side.

Examples:

Header:
home, services, contact
→ valid

Header:
services, services
→ invalid

Footer custom:
services
Header:
services
→ valid, because different navigation collections

---

# 9. Footer schema

Implement conceptually:

interface SiteFooter {
showBranding: boolean

navigationMode:
| 'header'
| 'custom'
| 'none'

navigationItems?: NavigationItem[]

showBusinessContact: boolean
showSocialLinks: boolean

text?: string

showCopyright: boolean
}

Defaults:

showBranding: true
navigationMode: 'header'
showBusinessContact: false
showSocialLinks: true
showCopyright: true

No footer text by default.

Footer text:

- optional
- trimmed
- blank → absent
- plain text only
- max 200 chars
- no HTML
- no markdown

---

# 10. Footer navigation

Modes:

header:
reuse the Header's navigation items

custom:
use `footer.navigationItems`

none:
render no footer Page navigation

For custom navigation:

same NavigationItem rules:
- Page refs only
- optional labels
- array-order authoritative
- no duplicate pageId

Do NOT copy Header items into Footer config when mode=header.

Renderer should resolve the Header collection directly.

---

# 11. Footer data projection

Do NOT duplicate global business data.

When:

showBusinessContact=true

project available values from:

businessProfile

such as:

phone
email
address

Render only values actually present.

Phone:
real `tel:` link

Email:
real `mailto:` link

Address:
semantic text using existing PostalAddress data

Do not persist copies in footer config.

---

# 12. Footer social profiles

When:

showSocialLinks=true

reuse the existing:

businessProfile.socialLinks

and existing safe URL/filter behavior.

Do NOT duplicate social URLs into Footer config.

Preserve accessible platform labels.

---

# 13. Footer branding

When:

showBranding=true

project Branding.

Use the site's existing:

siteName
logo

Recommended presentation:

- show logo when available
- also show site name in a sensible branding block
- without logo, show site name

Do NOT add a second Footer-specific logo field.

No new media reference.

---

# 14. Copyright

When:

showCopyright=true

render dynamically/server-side:

© CURRENT_YEAR Site Name

Do NOT persist the year.

Do NOT add editable copyright text in 3.4.

---

# 15. Missing config compatibility

Existing sites have no:

header
footer

Normalize on READ.

No write repair.

No migration.

Canonical defaults:

header:
{
brandDisplay: 'logo',
navigation: {
items: []
}
}

footer:
{
showBranding: true,
navigationMode: 'header',
showBusinessContact: false,
showSocialLinks: true,
showCopyright: true
}

No CTA.
No footer text.

Normalize both:

working SiteDefinition
published SiteDefinition

consistently.

Do NOT mutate Firestore just because fields are absent.

---

# 16. Deliberate removal of old automatic section navigation

The current SiteShell auto-builds navigation from:

activePage.sections

REMOVE that behavior completely.

Do NOT keep it as:

- compatibility fallback
- "when header navigation is empty"
- one-page mode
- hidden secondary nav behavior

After 3.4a, explicit Header navigation is the ONLY primary navigation source.

This is a deliberate test-site behavior break.

No real customer marketing sites exist.

Do NOT permanently maintain two navigation systems.

Section-target navigation is deferred.

---

# 17. No section targets in Step 3.4

Do NOT introduce:

{
pageId,
sectionId
}

navigation targets.

Do NOT persist raw:

#section-...

If explicit section-target navigation is added later, it must be a structured
reference with lifecycle validation.

Not Step 3.4.

---

# 18. No arbitrary external navigation items

Header/Footer Page menus may NOT store:

href
url
email
phone

External/action behavior belongs to Header CTA.

Do not turn NavigationItem into a general link-builder.

---

# 19. Header/Footer server validation

Centralize validation.

No route-local ad-hoc validation.

Header:

- exact expected object shape
- brandDisplay enum
- navigation object
- items array
- each pageId is a non-empty string and belongs to config.pageOrder
- no duplicate pageIds
- label optional, trimmed, blank→absent, plain string, max 60
- CTA optional
- CTA buttonLabel 1..60 when present
- CTA LinkAction valid
- CTA leadForm rejected
- unknown fields handled according to existing strict config conventions

Footer:

- exact expected shape
- all toggles boolean
- navigationMode enum
- custom navigation uses same Page-ref validator
- text optional <=200
- unknown fields rejected/normalized consistently

If `navigationMode !== 'custom'`, prefer canonical output without
`navigationItems`, unless current normalization convention warrants retaining it.

---

# 20. Navigation Page-reference validation

Every persisted pageId must exist in:

config.pageOrder

That is sufficient identity/membership validation.

Do NOT validate against:

slug
title

No cross-tenant refs.
No raw Firestore paths.

Because pageOrder is authoritative, validation may use config.pageOrder directly.

Do NOT add extra Page-document reads merely to validate identity unless existing
service architecture requires them for integrity.

---

# 21. Header/Footer save transactions

Implement working config mutations, likely:

updateSiteHeader
updateSiteFooter

or equivalent.

Preferred transaction shape:

read:
site/config

validate:
navigation pageIds against config.pageOrder

write:
site/config with updated header/footer + normal updatedAt/publication state fields

There is no need to read every Page document solely to validate page membership.

A concurrent Page DELETE mutates config.pageOrder:
→ config version conflict
→ header/footer transaction retries
→ stale deleted pageId becomes invalid
→ save rejects cleanly

A Page slug/title change does not require nav mutation because refs remain pageId.

Follow existing config transaction/status conventions.

---

# 22. Page deletion auto-prune — LOAD-BEARING

Extend existing deletePage transaction.

When deleting Page X from WORKING:

- remove X from config.pageOrder
- delete Page X working document
- remove every Header navigation item with pageId X
- remove every Footer custom navigation item with pageId X
- preserve all other nav item order/labels
- preserve published/current unchanged

Do NOT block Page deletion merely because navigation references it.

Do NOT delete Header/Footer config entirely.

If footer mode='header', pruning Header is naturally sufficient for rendered
Footer, but also sanitize any stored custom list if one exists.

Test:

working:
Header = Home, B, C
Footer custom = B, C

published:
old snapshot still includes B

delete B working

result:
Header = Home, C
Footer custom = C
Page B removed working
published snapshot BYTE-UNCHANGED

next Publish:
Page B absent
nav refs to B absent
public coherent

---

# 23. New Page creation

Creating a Page does NOT modify Header/Footer navigation.

No automatic menu inclusion.

No pageOrder→navigation coupling.

Portal 3.4b may offer explicit "Add all pages", but backend does nothing
automatically.

---

# 24. Slug changes

Navigation persists pageId.

Changing:

services
→ what-we-do

must require ZERO Header/Footer mutation.

Working Preview:
nav resolves new working slug/context

Public before Publish:
published nav still resolves old published slug

After Publish:
same nav ref resolves new published slug

Test directly.

---

# 25. Page title changes

No custom nav label:

Page title drives rendered menu label from current SiteDefinition.

Working Preview sees new title.
Live stays old until Publish.
After Publish live sees new title.

Custom nav label:

always wins.

No Header/Footer config mutation on title changes.

Test both.

---

# 26. Publish behavior

Header/Footer are in config.

Existing Publish already transactionally reads:

config
all Pages

and writes one coherent:

published/current.siteDefinition

Ensure:

toSiteDefinition

includes normalized:

header
footer

Publish snapshot therefore captures:

Header
Footer
Pages
slugs
titles
Theme
Branding
etc.

coherently.

No separate Header/Footer Publish.

---

# 27. Publish concurrency

Because Header/Footer save writes config:

Publish reads config.

Concurrent Header/Footer save during Publish:

→ config version conflict
→ Publish retries
→ final snapshot coherent

Add a deterministic FakeDb interleave test if practical:

Publish begins
Header save commits during Publish
Publish retries
published snapshot contains new Header config

This is valuable but should reuse existing transaction-test machinery.

---

# 28. Renderer page navigation resolution

Persisted menu items only know:

pageId
optional label

Renderer resolves those against the CURRENT SiteDefinition.

Create one canonical resolver.

Do NOT scatter href construction.

Resolved model can conceptually be:

interface ResolvedNavigationItem {
pageId: string
label: string
href: string
current: boolean
}

Map Pages by id once if convenient.

Do not mutate stored Header/Footer data.

---

# 29. Custom-domain hrefs

For custom-domain public context:

Home pageId:
/

Non-Home:
/<slug>

Navigation Page ref resolution uses current PUBLISHED SiteDefinition.

---

# 30. Shared-host hrefs

For shared host:

Home:
/site/<tenantId>

Non-Home:
/site/<tenantId>/<slug>

Central resolver only.

---

# 31. Preview hrefs — CRITICAL

Preview MUST remain entirely inside Preview.

Resolve navigation by immutable pageId:

Home:
/preview/<tenantId>

Non-Home:
/preview/<tenantId>/page/<pageId>

NOT working slug.

Existing PreviewQueryPreserver reportedly carries the preview token to links.

Confirm/test:

Preview Home
→ click Services
→ Preview Services by pageId with token retained

Preview Services
→ click Home
→ Preview Home with token retained

No navigation click may escape into public/published content.

---

# 32. Nav context

The current single sitePath string is no longer sufficient.

Introduce/extend a small renderer-only navigation context abstraction.

Conceptually:

{
kind: 'customDomain' | 'sharedHost' | 'preview'
tenantId?
}

or equivalent.

The renderer owns:

Page ID → route href

Shared `site-components` must NOT import:

Next router
Next request context
preview-token logic

Pass resolved navigation data into components.

---

# 33. Component boundaries

Keep:

SiteShell

as shell owner.

Existing:

SiteHeader
SiteFooter

are already extracted.

Use them.

Preferred boundary:

Renderer:
- resolves nav refs
- route context
- pageId→href
- current Page detection
- Preview route behavior

site-components:
- renders header/footer presentation
- mobile menu state
- links already supplied
- Theme styling

No provider/framework routing logic inside site-components.

---

# 34. aria-current

For each Page nav item:

current = target.pageId === activePage.id

SiteHeader and SiteFooter:

aria-current="page"

when current.

Derive from Page identity, NOT pathname string comparison.

This must work identically for:

custom domain
shared host
Preview

---

# 35. Custom labels

Renderer:

label =
item.label?.trim()
|| targetPage.title

Unknown/missing page target should never exist in valid saved/published config.

If a malformed legacy/published snapshot somehow contains one:

fail safely / omit invalid item according to existing normalization philosophy.

Do NOT construct a broken href.

Server is authoritative for working saves.

---

# 36. Header CTA rendering

Optional.

Render only when valid CTA exists.

Use existing safe LinkAction / contactHref semantics.

Email:
mailto

Phone:
tel

URL:
http/https
external target/rel according to current behavior

No leadForm.

No fabricated action.

CTA must also appear in the mobile menu or remain reachable at mobile width.

---

# 37. Mobile Header behavior

Keep existing small client-side toggle.

No router dependency.

No SPA.

Retain:

real button
accessible name
aria-expanded
aria-controls

Add:

Escape closes menu

and reasonable focus return to toggle.

Ensure Page links and Header CTA are keyboard reachable.

Do not overbuild a focus-trap modal unless actual structure requires it.

---

# 38. Footer resolved navigation

Header mode:

resolve Header navigation items once/reuse result.

Custom mode:

resolve Footer navigation items with same resolver.

None:

no Footer nav.

Preview Footer links must stay inside Preview exactly like Header links.

No parallel URL-builder.

---

# 39. Footer contact rendering

When enabled and data exists:

phone:
<a href="tel:...">

email:
<a href="mailto:...">

address:
semantic text

Reuse existing phone/email safety helpers where available.

No duplicated business data.

If no contact values exist:
render no empty contact block.

---

# 40. Social links

Preserve existing:

safe URL validation/filtering
accessible platform labels

Footer toggle only determines whether that projected block appears.

No new persisted URLs.

---

# 41. Custom CSS hooks

Preserve existing stable hooks:

data-br-site
data-br-page
data-br-section
data-br-section-id
existing documented data-br-role hooks

Add deliberate stable navigation hooks.

Because NavigationItem has NO synthetic id:

use immutable Page ID.

Recommended:

data-br-navigation

Header nav container.

Each Header item:
data-br-navigation-item="<pageId>"

Footer:
data-br-footer-navigation

Each Footer item may also use:
data-br-navigation-item="<pageId>"

Parent hook disambiguates Header vs Footer.

Do NOT derive hook values from:

label
slug

Retain existing `data-br-role="header"` / `"footer"` if already public/documented.

Document the supported new hooks in:

Step3.1-AdvancedStyling.md

Do not regress the CSS-variable cascade guidance.

---

# 42. Theme

NO SiteTheme schema changes.

Use existing Theme tokens only.

No:

headerColor
footerColor
navColor
mobileMenuColor
headerLayout
footerLayout

Custom CSS is the advanced escape hatch.

---

# 43. Media

No new media-reference shape.

Header/Footer use existing Branding logo data.

Confirm existing Branding media:

- hydrates correctly
- protects media deletion

Do NOT change media scanner architecture unless a real bug is found.

---

# 44. Sitemap independence

Do not modify sitemap membership based on Header/Footer nav inclusion.

Every published Page remains sitemap-eligible under Step 3.3 rules.

A Page omitted from Header may still:

- resolve publicly
- appear in sitemap

Navigation != page existence != SEO.

---

# 45. SEO boundary

No:

seoTitle
metaDescription
OG fields
canonical editor
redirects

Step 3.5.

Navigation label is NOT SEO title.

Footer text is NOT metadata.

---

# 46. Existing automatic section-nav removal tests

Update renderer/component tests so they prove:

- Header no longer derives links from activePage.sections
- repeated/visible sections do not auto-enter Header
- Contact section is no longer auto-promoted to a Header CTA
- an empty explicit Header navigation means no Page menu items
- Header CTA only appears from explicit Header CTA config

Do not retain stale section-nav expectations.

---

# 47. Schema tests

Add tests for:

missing Header normalization
missing Footer normalization

Header:
- valid brandDisplay
- invalid brandDisplay
- valid page refs
- unknown page ref
- duplicate page ref
- custom label
- label max
- blank label normalization
- CTA valid
- CTA absent
- half CTA invalid
- leadForm invalid

Footer:
- booleans
- navigationMode enum
- custom refs
- duplicate custom refs
- invalid page ref
- text max
- blank text normalization
- unknown-field handling

No nav item UUID tests because NavigationItem has no id.

---

# 48. Page deletion tests

LOAD-BEARING.

Test auto-prune as described.

Also test:

Header only ref
Footer custom only ref
both
unrelated items remain exact order
labels preserved
published byte-identical
next Publish coherent

No media deletion.

---

# 49. Save concurrency test

Test stale Header editor/API save equivalent at server level:

Header save validates Page B from config.pageOrder.

Concurrent delete Page B changes config before save commit.

Expected:
transaction retries
Page B missing
Header save rejects invalid reference

No stale nav ref can commit.

---

# 50. Publish/navigation coherence test

Test:

Page Services:
slug services
title Services

Header:
{pageId: servicesId}

Publish.

Snapshot:
Header still stores pageId
Page stores slug/title

Renderer resolution:
label Services
href /services

Working change:
slug what-we-do
title Installation

No Header config change.

Preview:
Installation
preview Page-ID href

Public old snapshot:
Services
/services

Publish.

Public:
Installation
/what-we-do

Header persisted reference remained same pageId.

This is a central Step 3.4 invariant.

---

# 51. Renderer tests

Direct coverage for:

Header:
- brand logo mode
- logo missing fallback
- logoAndName
- name
- Page navigation
- custom label
- current aria-current
- no section-auto-nav
- optional CTA
- CTA absent
- mobile menu semantics

Route contexts:
- custom-domain hrefs
- shared-host hrefs
- Preview pageId hrefs
- Preview token preservation

Footer:
- Header-nav reuse
- custom nav
- none
- branding
- contact projection
- social toggle
- text
- copyright
- aria-current
- Preview links

At least one integration render:

PublicPage
→ SiteShell
→ Header/Footer

---

# 52. Accessibility tests

Verify:

Header:
<header>
<nav aria-label="Primary">

Current Page:
aria-current="page"

Mobile toggle:
button
accessible label
aria-expanded
aria-controls

Escape:
closes

CTA:
real link

Footer:
<footer>
<nav aria-label="Footer">

Social:
accessible labels

No clickable divs.
No color-only state.

---

# 53. No Portal 3.4 editor implementation

DO NOT add:

HeaderEditor
FooterEditor
navigation picker UI
Portal nav entries for Header/Footer

Those are Step 3.4b.

Minimal shared schema/API typing changes that are required to keep Portal compiling
are allowed.

Do not build the operator UI yet.

---

# 54. Full verification

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

Production:
- Renderer build
- Portal build if shared-schema changes warrant it

CI:
- classifier/workflow tests
- changed-path classifier

Quality:
- git diff --check
- secret/credential-pattern scan

Expected full Step3 classifier:

api=true
portal=true
renderer=true
client=false
unknown=[]

0 failures.
0 skipped.

No deploy.
No cloud/data mutation.

---

# 55. Final report

Return:

1. actual baseline
2. files created
3. files modified/deleted
4. exact Header schema
5. exact NavigationItem schema
6. confirmation no nav item UUID
7. exact Footer schema
8. defaults
9. missing-config normalization
10. working storage
11. published behavior
12. Header save transaction
13. Footer save transaction
14. Page-ref validation
15. duplicate-ref validation
16. Page delete auto-prune
17. stale-save/delete race
18. slug-change nav behavior
19. title/custom-label behavior
20. Publish coherence
21. Publish/header race if tested
22. section-auto-nav retirement
23. custom-domain resolver
24. shared-host resolver
25. Preview resolver
26. Preview-token preservation
27. SiteShell component boundary
28. Header branding behavior
29. Header CTA behavior
30. mobile menu behavior
31. aria-current
32. Footer Header-nav reuse
33. Footer custom nav
34. Footer contact projection
35. Footer social projection
36. Footer text
37. copyright
38. Custom CSS hooks
39. Theme impact
40. media impact
41. sitemap result
42. SEO boundary
43. server tests
44. renderer tests
45. Portal/UI tests
46. skipped count
47. typecheck/lint
48. production builds
49. classifier/workflow
50. git diff --check
51. secret scan
52. confirmation no deploy/cloud/data mutation
53. blockers
54. whether Step 3.4a is ready for post-implementation audit

Explicitly answer:

Does NavigationItem contain ONLY pageId + optional label?

Is pageId the navigation identity?

Can the same Page appear twice in Header navigation?
Expected: NO.

Can the same Page appear once in Header and once in Footer custom nav?
Expected: YES.

Is navigation ordering completely separate from pageOrder?

Does creating a Page modify navigation?
Expected: NO.

Does deleting a Page auto-prune working Header/Footer refs?

Does published navigation remain unchanged until Publish?

Does changing a slug require navigation mutation?
Expected: NO.

Does changing a title require navigation mutation?
Expected: NO.

Does no-custom-label display the current snapshot's Page title?

Does a custom label remain stable across title changes?

Does Header default to `brandDisplay='logo'`?

Does logo mode fall back to site name when logo is absent?

Can Header CTA use leadForm?
Expected: NO.

Does Footer duplicate business/social data?
Expected: NO.

Does Footer default to reuse Header navigation?

Is old section-derived navigation completely gone?

Were section-target nav items added?
Expected: NO.

Were arbitrary external nav items added?
Expected: NO.

Does Preview navigation stay entirely inside Preview using pageId?

Does Preview preserve its token across navigation?

Does current-page state derive from pageId?

Were any new Theme fields added?
Expected: NO.

Were any new media-reference shapes added?
Expected: NO.

Were any dependencies added?
Expected: NO.

Was any Firestore migration required/performed?
Expected: NO.

Can Header/Footer still publish atomically in the existing SiteDefinition snapshot?

Were any tests skipped?
Expected: NO.

Was anything deployed or mutated in Firestore/GCP?
Expected: NO.