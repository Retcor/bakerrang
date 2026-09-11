# Step 3.4 Planning — Header / Navigation / Footer Editor

READ-ONLY ARCHITECTURE / PLANNING AUDIT ONLY.

Do NOT modify files.
Do NOT deploy.
Do NOT mutate Firestore.
Do NOT mutate GCP.
Do NOT modify Git state.
Do NOT create commits.

Step 3.3 Multi-Page Sites has passed final audit and is considered COMPLETE.

Step 3 remains intentionally developed on the existing Step3 branch / PR.

Before planning, establish the ACTUAL current repository state. Do not assume the
user has already committed Step 3.3 unless Git proves it.

---

# Product goal

Step 3.4 should turn the site's global shell into an operator-configurable:

- Header
- Page Navigation
- Footer

appropriate for polished local-business marketing sites.

A site should be able to support something like:

HEADER
[Logo / Business Name]    Home  About  Services  Gallery  Contact    [Call Now]

PAGE CONTENT
...

FOOTER
Business identity / short supporting content
Page links
Contact/business information where appropriate
Social links
Copyright

The exact MVP should be determined from the existing architecture and components.

The goal is NOT to create an unrestricted visual page builder.

---

# Current architectural invariants from Step 3.3

Treat these as established unless actual source proves otherwise:

WORKING:

tenants/{tenantId}/site/config
pageOrder: ['home', '<uuid>', ...]

tenants/{tenantId}/site/config/pages/home
tenants/{tenantId}/site/config/pages/{pageId}

PUBLISHED:

tenants/{tenantId}/site/config/published/current

containing one coherent:

siteDefinition.pages[]

Page rules:

- `pageOrder` is membership/editor order, NOT public navigation
- Home id is `home`
- non-Home Page ids are UUIDs
- Page identity is independent from slug
- public routing uses slug
- Portal/Preview identity uses pageId
- Hero is Home-only
- Contact/BusinessHours are singleton per Page

Other established global data:

- Branding
- Theme
- Business Profile
- Business Hours
- Social Profiles
- Custom CSS
- Media Library
- working/published site model

Do NOT undo these decisions.

---

# Scope boundary

Step 3.4 OWNS:

- global Header configuration
- global public Page navigation
- navigation item identity
- navigation ordering
- inclusion/exclusion of Pages from navigation
- optional operator-facing navigation labels if justified
- resolving navigation page IDs to current Page slugs
- Header branding presentation controls if appropriately small
- optional Header CTA if justified
- responsive/mobile navigation behavior
- global Footer configuration
- Footer page links if part of the recommended model
- Footer use of existing Branding/Profile/Social data
- Portal editors for these global shell features
- Preview/published behavior
- validation/referential integrity
- accessibility
- stable Custom CSS hooks

Step 3.4 DOES NOT own:

- SEO title/description
- OpenGraph/social sharing metadata
- canonical URL editing
- redirects/history
- page duplication
- page visibility
- per-page Theme
- per-page Header/Footer variants
- mega menus
- arbitrary nested navigation trees unless absolutely justified
- CMS-rich footer layout builder
- blog/category navigation
- multilingual navigation
- arbitrary HTML
- arbitrary JavaScript
- arbitrary embeds

Those belong later or outside the current product.

---

# 1. Establish Git / baseline

Inspect:

git status
git log --oneline --decorate -10
git diff
git diff --cached
git diff --stat

Report:

- branch
- HEAD
- whether Step 3.3 is committed
- current working-tree changes
- staged documents
- unrelated changes

Run baseline:

Server tests
Server lint
Portal tests
Renderer tests
UI tests
Platform typecheck
Platform lint

Do not alter Git.

---

# 2. Audit current SiteShell completely

Read the actual SiteShell and all helpers it uses.

Determine exactly what it currently renders for:

- branding/logo
- business/site name
- section-level navigation
- active-page anchors
- Home link
- mobile behavior
- Contact behavior
- social links, if any
- footer, if any
- Theme application
- Custom CSS hooks

Produce the current conceptual markup tree.

Example only:

SiteShell
header
brand
nav
main
page content
footer

Do not assume the current shell already matches that.

---

# 3. Audit current navigation behavior after Step 3.3

Step 3.3 intentionally did NOT create cross-page navigation.

Current navigation reportedly derives from:

activePage.sections

and uses same-document section anchors.

Confirm actual behavior.

Questions:

- Which section types currently become nav items?
- How are labels derived?
- Is Hero excluded?
- Are hidden sections excluded?
- Are repeated section types distinguishable?
- Does the nav appear on every Page?
- What happens on an empty Page?
- Is this navigation desktop only?
- How does mobile navigation work today?
- Is `aria-current` used anywhere?

Determine what needs to be retired vs retained once explicit Page navigation exists.

---

# 4. Decide what public navigation should represent

Now that Multi-Page exists, public navigation should primarily navigate PAGES.

Strong direction:

navigation entries reference immutable:

pageId

NOT:

slug
href
title text

The renderer resolves:

pageId
→ Page in the current SiteDefinition
→ current Page slug
→ public href

This must preserve:

Working Preview:
uses working title/slug

Published site:
uses published title/slug

Changing a working slug must not alter live navigation before Publish.

Confirm and recommend.

---

# 5. Navigation item schema

Design an exact durable navigation item model.

Strong candidate:

interface NavigationItem {
id: string
pageId: string
label?: string
}

Where:

- `id` = stable server-generated item UUID
- `pageId` = immutable Page reference
- `label?` = optional navigation-specific operator label
- if label absent, renderer uses Page title

Evaluate whether item `id` is needed.

Potential benefits:

- stable editor identity
- reorder
- Custom CSS hooks
- future audit/revision history
- future extensions

If no item id is needed, explain why.

Do NOT use Page slug as persisted link identity.

---

# 6. Navigation label semantics

Decide whether navigation should support:

optional custom label

Example:

Page title:
Residential Shower Door Installation

Navigation label:
Services

Strong preference:

YES, optional custom label is useful.

Possible behavior:

label absent/blank
→ use Page title

label set
→ use custom label

Changing Page title should update the nav display automatically only when custom
label is absent.

Do not add a `navigationLabel` property directly to SitePage if NavigationItem can
own it more cleanly.

Explain.

---

# 7. Page inclusion model

Do NOT add:

page.includeInNavigation

unless there is a compelling architectural reason.

Preferred model:

a Page is in public navigation iff a NavigationItem references its pageId.

This naturally supports:

- Page exists but not in menu
- custom order
- future multiple menus
- pageOrder independent from nav order

Evaluate and recommend explicitly.

---

# 8. Navigation ordering

Navigation item array order should likely be authoritative for the public menu.

Do NOT derive public menu order from:

config.pageOrder

except possibly as an initial suggestion/default.

Step 3.3 deliberately kept pageOrder distinct from public navigation.

Confirm.

Portal should use:

Move Up
Move Down

No drag-only interface.

---

# 9. Home navigation item

Decide whether Home:

- is always in Header nav
- may be removed from Header nav
- must be first
- can be reordered

Strong likely direction:

Home may be included or excluded like any other Page and may be reordered.

The logo/site-name itself will already link Home.

That may make an explicit Home menu item optional.

Recommend based on common local-business UX.

Do NOT conflate:

Home existence

with:

Home navigation inclusion.

---

# 10. Duplicate Page references

Can the Header navigation contain the same Page twice?

Strong preference:

NO for the MVP.

One pageId at most once per navigation collection.

This avoids strange menus and simplifies editing.

If footer has a separate navigation collection, the same Page can of course appear
once in Header and once in Footer.

Recommend and validate server-side.

---

# 11. Header vs Footer navigation data

Evaluate these models:

A.
one shared navigation list used by both Header and Footer

B.
Header navigation and Footer navigation are independent lists

C.
Header navigation is editable; Footer can optionally reuse Header navigation

Strong likely candidate:

C.

For example:

header.navigation.items: [...]

footer:
navigationMode: 'header' | 'custom' | 'none'
navigationItems?: [...]

But do not over-model if unnecessary.

Determine actual product value versus complexity.

A local-business footer commonly contains a subset/repetition of page links.

Give a decisive recommendation.

---

# 12. Nested navigation

Explicitly evaluate:

- flat Page menu
- one-level dropdown
- arbitrary nested tree

Strong preference for Step 3.4:

FLAT navigation only.

Reasons:

- current sites are modest
- ≤25 Pages
- mobile behavior simpler
- accessibility simpler
- no hierarchy in Page routing
- no parent/child Page model exists

Do not create menu hierarchy before Page hierarchy exists.

Recommend flat unless actual requirements strongly justify otherwise.

---

# 13. Section-anchor navigation

Current SiteShell has section-level anchors.

Decide whether Step 3.4 should support explicit navigation items pointing to:

A. Pages only
B. Pages + Page sections
C. arbitrary anchor strings

Strong likely direction:

Header public navigation = Pages only.

Possible Header CTA can handle action links separately.

Section-anchor menus become unnecessary once sites have actual Pages.

If keeping section anchors adds useful one-page-site support, design it deliberately
rather than keeping implicit auto-nav behavior accidentally.

Important product question:

A tenant may still choose to have a one-page site.

Should the new Navigation Editor support:

"Services" → Home page, specific Services section

using stable:

pageId + sectionId

instead of a raw anchor?

Evaluate carefully.

This may be useful enough to support now.

If included, use structured references:

type:'page'
pageId

or:

type:'section'
pageId
sectionId

Never store raw `#section-...` strings.

Give a decisive recommendation.

---

# 14. External navigation links

Evaluate whether Header navigation needs arbitrary external URL items.

Examples:

Book Appointment
Customer Portal
Online Store

We already have safe LinkAction semantics for:

email
phone
url

But public navigation is principally site structure.

Possible choices:

- Pages only in 3.4
- Page + external URL
- Page + section + external

Strong preference:

keep main nav structured around Page/section references;
use Header CTA for external/phone/email actions.

This avoids turning nav into a general link builder.

Recommend.

---

# 15. Header CTA

A prominent local-business Header CTA is high-value.

Examples:

Call Now
Get a Quote
Book Online
Email Us

Evaluate adding:

interface HeaderAction {
buttonLabel: string
action: LinkAction
}

or optional paired:

buttonLabel?
action?

Reuse existing:

LinkAction
validateLinkAction
contactHref
SectionActionFields concepts

No `leadForm` in Header CTA.

Lead capture remains through Contact sections.

Strong recommendation:

include one optional Header CTA in 3.4 if it can reuse the existing safe action
pipeline cleanly.

No fabricated default URL/action.

Default absent.

---

# 16. Header branding controls

Audit current header branding behavior.

Determine whether operators need controls such as:

- show logo
- show site name
- logo + site name
- site name only

Avoid making Branding fields duplicate Header settings.

Branding owns the actual:

logoMediaId
siteName

Header may own PRESENTATION toggles.

Potential model:

brandDisplay:
'logo'
'name'
'logoAndName'

But if current fallback behavior is already good, fewer controls may be better.

Recommend exact MVP.

---

# 17. Header layout controls

Evaluate whether Step 3.4 should support several header layouts.

Examples:

- logo left / nav right
- centered
- stacked

Strong preference:

one polished responsive layout for now.

Theme/Custom CSS already provide styling escape hatches.

Do NOT add:

headerLayout
navAlignment
desktopMenuStyle
dozens of presentation enums

unless current design system already naturally supports them.

3.4 is about functional shell editing, not a visual-layout matrix.

---

# 18. Sticky header

Evaluate whether a:

stickyHeader: boolean

setting is worth adding.

It is common but not necessary for MVP.

Strong preference:

defer unless trivial and genuinely valuable.

Do not turn 3.4 into appearance-controls expansion.

---

# 19. Footer product goal

Audit whether a footer exists today.

Recommend a practical local-business footer.

Potential content:

- Branding logo/site name
- optional short footer text/tagline
- navigation links
- business contact information
- social links
- copyright

Avoid arbitrary footer columns/layout builder.

Determine which fields should be stored versus projected from existing global data.

---

# 20. Footer content should reuse existing data

Prefer projection/reuse for:

Branding:
siteName/logo

Business Profile:
phone/email/address if available

Social Profiles:
social links

Do NOT duplicate those values inside footer configuration.

Footer config should mostly determine:

what to display

and perhaps:

small footer-specific text

not copy global business data.

Audit actual BusinessProfile fields first.

---

# 21. Footer contact information

Determine which existing profile fields are suitable.

Possible:

phone
email
address

If BusinessProfile does not contain reliable global contact fields, do not invent
a duplicate Footer contact record without discussion.

Report actual available fields.

Strong principle:

one authoritative business datum, multiple render locations.

---

# 22. Footer social links

Social Profiles already exist globally.

Likely footer config should support:

showSocialLinks: boolean

rather than duplicating URLs.

Determine if social links currently render elsewhere.

Use existing sanitization/link behavior.

---

# 23. Footer short text

A small optional:

text/tagline

may be useful:

"Serving the greater Dayton area since 1998."

Evaluate:

footerText?: string

with reasonable plain-text length.

No rich HTML.

No markdown.

No WYSIWYG.

If unnecessary, defer.

---

# 24. Copyright

Recommend behavior.

Possible:

automatic:

© CURRENT_YEAR Site Name

with optional:

showCopyright: boolean

Avoid persisting a literal current year that becomes stale.

Potential custom copyright text may be unnecessary.

No JS required merely to get year if server-rendered.

Recommend.

---

# 25. Header/Footer schema location

Determine exact global schema ownership.

Strong likely direction:

SiteDefinition gains global:

header
footer

or:

siteChrome
navigation

These originate from:

site/config

and are captured into:

published/current.siteDefinition

They are NOT Page fields.

They are NOT sections.

Do not model Header/Footer as special SiteSections.

Explain why.

---

# 26. Proposed schema

Based on audit, propose exact TypeScript schema.

One plausible direction ONLY:

interface SiteHeader {
brandDisplay: 'logoAndName' | 'logo' | 'name'
navigation: {
items: NavigationItem[]
}
buttonLabel?: string
action?: LinkAction
}

interface NavigationItem {
id: string
pageId: string
label?: string
}

interface SiteFooter {
showBranding: boolean
showNavigation: boolean
navigationMode: 'header' | 'custom' | 'none'
navigationItems?: NavigationItem[]
showSocialLinks: boolean
showBusinessContact: boolean
text?: string
showCopyright: boolean
}

DO NOT accept this blindly.

Audit current source and recommend the smallest durable schema.

---

# 27. Defaults

Defaults matter because existing sites have no Header/Footer config yet.

Design defaults that make current sites render sensibly without migration.

Strong requirements:

- no fabricated external URL
- no fabricated CTA
- no fake business text
- no data rewrite required

Potential Header default:

brand display using existing current behavior
navigation empty

Potential Footer default:

branding visible
social links if profile has them?
copyright visible

But determine compatibility with the CURRENT public appearance.

Existing sites/test data should not unexpectedly lose every shell element simply
because config is absent.

---

# 28. Migration / compatibility

Aim for natural default normalization:

missing header/footer config
→ canonical defaults at read time

without write repair.

No migration job if avoidable.

Do not mutate marketing sites during implementation.

No unrelated BakerRang data touched.

Determine whether current auto section nav should remain as compatibility fallback
when Header config is absent.

Important:

Do NOT permanently keep two nav systems.

Since no real customer marketing sites exist, a clean default can intentionally
change test-site behavior if the architecture is better.

Recommend whether:

missing nav config → empty Page nav

or:

missing nav config → derive from Pages/pageOrder

or:

some other safe default.

---

# 29. Initial navigation experience

When an operator first opens Navigation Editor after 3.4, what should they see?

Options:

A. empty nav; operator adds Pages
B. automatically populate working Header nav from all existing Pages
C. read-time default derives all Pages but doesn't persist
D. one-time explicit "Add all Pages" action

Strong preference may be:

new sites default Header navigation to all Pages once created

but we need to avoid nav order being secretly coupled to pageOrder.

A useful Portal feature may be:

"Add page"

with available Pages.

Claude should recommend the cleanest model.

---

# 30. Page creation after navigation exists

When the operator creates a new Page in PagesManager:

Should it automatically enter Header navigation?

Strong preference:

NO.

Page creation and public navigation inclusion should remain separate.

Otherwise pageOrder effectively leaks into nav behavior.

Operator adds it deliberately in Header/Navigation editor.

Recommend explicitly.

---

# 31. Page deletion referential integrity — CRITICAL

If NavigationItem references:

pageId = X

and Page X is deleted from WORKING, we must not leave broken references.

Evaluate two approaches:

A. reject Page deletion until operator removes all Header/Footer nav references

B. Page deletion transaction automatically prunes references to that page from
working Header/Footer configuration

Strong preference:

B is likely better UX and keeps config referentially valid.

But assess auditability/surprise.

Requirements either way:

- published site remains unchanged until Publish
- next Publish cannot contain broken Page references
- no silent broken public href
- Page deletion and shell config mutation must be transactional/coherent

Recommend decisively.

---

# 32. Page slug changes

Because nav persists:

pageId

a slug change should require ZERO navigation mutation.

Preview:

Page ref resolves to new working slug

Public live:

published Header nav continues resolving to old published slug until Publish

After Publish:

same nav item resolves to new slug

This is a core invariant.

Explicitly test it.

---

# 33. Page title changes

If nav item has no custom label:

working Preview should display new working Page title.

Live public nav remains old title until Publish.

After Publish:
new title.

If custom label exists:
Page title change does not alter nav label.

No nav config mutation should be required.

---

# 34. Navigation reference validation

Server must validate every nav reference before saving/publishing.

For Page references:

pageId must exist in working pageOrder.

If section references are supported:

pageId exists
sectionId exists on that Page
section not hidden? Decide semantics.

Do not allow cross-tenant references.

Do not allow raw document paths.

Do not rely on Portal validation.

---

# 35. Publish referential integrity

Publish already reads:

config + all Pages

in one transaction.

This is ideal for validating Header/Footer references coherently.

During Publish:

- Header/Footer config read from config
- every referenced Page is in the same transaction read set
- validate refs against working SiteDefinition
- write coherent published snapshot

A concurrent Page deletion/title/slug change should force Publish retry via config
or Page read-set as appropriate.

Explain exact behavior.

---

# 36. Media references in Header/Footer

Header/footer may use:

global branding logo

which already uses branding.mediaId.

Avoid adding new raw media references unless necessary.

If Footer supports separate logo/image:

strong preference NO in 3.4.

One authoritative branding asset.

If no new media shape is introduced, say so.

If one is required, media deletion scanners must be extended accordingly.

---

# 37. Header/Footer Custom CSS hooks

Design stable hooks.

Potential:

data-br-header
data-br-nav
data-br-nav-item="<navigation-item-id>"
data-br-footer
data-br-footer-nav

Prefer stable IDs where relevant.

Do not use nav label or Page slug as the only item identity.

Existing:

data-br-site
data-br-page
data-br-section
data-br-section-id

remain.

Document supported hooks in Step3.1 Advanced Styling docs.

Avoid undocumented accidental DOM classes becoming API.

---

# 38. Nav item DOM identity

Do not create HTML `id` attributes from labels.

If NavigationItem has UUID id:

React key = item.id

Potential CSS hook:

data-br-nav-item=item.id

ARIA/current semantics derive from target page.

No duplicate DOM id concerns.

---

# 39. Active-page semantics

For a Page nav item whose pageId == activePage.id:

set:

aria-current="page"

and style active state through existing Theme tokens.

Do not derive active state from pathname/string comparison if Page identity is
already available.

This is especially important across preview/shared/custom route shapes.

---

# 40. Header responsive behavior

Audit existing mobile header behavior.

Requirements:

- usable at narrow phone widths
- logo/site name doesn't overflow badly
- menu remains keyboard usable
- CTA does not make header impossible to fit
- navigation can collapse appropriately

Determine whether to use:

A. CSS-only `<details>/<summary>`
B. small Client Component menu state
C. existing UI behavior

Prefer minimal runtime JavaScript if possible, but accessibility and quality matter
more than dogmatically avoiding it.

If Client Component is needed:

keep it isolated to navigation toggle state.

Do not turn SiteShell into an SPA.

---

# 41. Mobile menu accessibility

If collapsible:

- actual button or semantic summary
- accessible name
- expanded state
- keyboard support
- Escape handling if appropriate
- focus behavior
- no hover-only interaction
- CTA reachable
- active Page understandable

Audit chosen technique.

---

# 42. Desktop navigation accessibility

Use semantic:

<header>
<nav aria-label="Primary">
<a ...>

Footer:

<footer>
<nav aria-label="Footer"> if applicable

Current page:

aria-current="page"

External CTA:

safe target/rel

No clickable divs.

---

# 43. Footer accessibility

Social links:

discernible accessible labels

Icons:
decorative SVG handling where appropriate

Phone/email:
real tel/mailto

Address:
plain semantic content or appropriate link only if existing data supports it

Contrast:
existing Theme resolver/tokens

---

# 44. Theme usage

Do NOT add new Theme schema fields.

Header/footer should consume existing:

colors
surface/border/text
spacing
corners
content width
fonts

If a small fixed Header/Footer styling treatment is needed, use CSS/Tailwind based
on existing variables.

Custom CSS remains the advanced override.

No:

headerColor
footerColor
navTextColor
mobileMenuColor

in Theme during 3.4.

---

# 45. SiteShell responsibility

Decide whether SiteShell remains the right renderer owner for:

Header
Nav
Footer

Strong likely answer:
yes.

Potential structure:

SiteShell
SiteHeader
main
SiteFooter

Consider extracting:

SiteHeader
SiteNavigation
SiteFooter

from SiteShell for maintainability/testing.

Do not make architectural extraction for its own sake if current code is tiny.

Recommend based on actual size.

---

# 46. Shared site-components vs renderer ownership

Determine where these should live:

- Header presentation
- Footer presentation
- nav item renderer
- mobile toggle behavior

Prefer provider-independent UI/presentation in:

site-components

while renderer owns:

route-context-specific href building
LeadForm/app concerns

But public link generation may be simple enough to pass resolved hrefs into shared
components.

Do not let site-components import Next app/router internals if avoidable.

Recommend explicit boundary.

---

# 47. Href resolution

Design one canonical resolver for Page nav refs.

Conceptually:

pageHref(siteContext, targetPage)

Must work under:

custom domain:
/about

shared tenant host:
/site/:tenantId/about

Preview:
/preview/:tenantId/page/<pageId>  ?

Important Preview question:

When clicking navigation in Preview, should nav links point to:

working preview Pages by pageId

rather than public slugs.

Strong answer likely YES.

Preview navigation must remain within authenticated/tokenized working Preview and
must not escape to the live public site.

Audit current Preview token delivery/routing and design exact behavior.

This is important.

---

# 48. Preview navigation — CRITICAL

Step 3.3 established:

Preview identity = pageId

Therefore Header nav in Preview must resolve:

NavigationItem.pageId
→ preview route for THAT pageId

NOT:
working slug → public path

Otherwise clicking Preview navigation could leave Preview and show published
content.

Define and test:

Preview Home item
Preview Page A
Preview Page B

all stay in Preview context.

CTA LinkAction can still behave normally because it is an external/action link.

---

# 49. Shared-host public navigation

For:

/site/:tenantId

Header Page links must resolve to:

/site/:tenantId/<slug>

and Home to:

/site/:tenantId

Custom domain:

/<slug>

Home:
/

Centralize this.

Do not scatter route string building across Header components.

---

# 50. Footer link resolution

If Footer links reference Pages, reuse the SAME resolver.

No parallel slug construction.

Preview Footer links should also remain in Preview context.

---

# 51. Portal navigation editor UX

Design the operator experience.

Potential Website navigation:

Overview

Site Setup
Branding
Theme
Business Profile
Business Hours
Social Profiles

Site Structure
Pages
Header & Navigation
Footer

Advanced
Custom CSS

Exact labels may vary.

Avoid one giant Header/Footer screen if two focused editors are clearer.

Recommend exact Portal navigation placement.

---

# 52. Header editor

Potential controls, based on final schema:

Brand presentation
Navigation items
Header CTA

Need:

- working values
- explicit Save
- shared dirty guard
- Preview
- validation

Navigation item controls:

Add Page
Remove
Move Up
Move Down
custom label

Maybe "Add Page" dialog lists Pages not yet present.

Do NOT show raw UUID.

Show:

Page title
/slug

---

# 53. Add navigation Page workflow

Preferred:

Add Navigation Item
→ choose from existing Pages not already present

No free-form pageId input.

Page list derives from:

working site.pages

After selection:

server/client item identity rules applied according to architecture.

If server should mint nav item UUID:

Add item may need a server mutation.

Alternative:
HeaderEditor saves entire configuration and server resolves/mints missing item IDs.

Evaluate against existing explicit Save/dirty-editor patterns.

Strong preference:

Header/Footer config editors behave like Theme/Branding:

edit working form locally
Save entire global config

But stable server IDs complicate new row creation.

Determine best pattern.

---

# 54. Server-generated nav item IDs

If nav item IDs are required and Header editor saves a full list:

possible model:

new client rows omit id
server matches existing ids and mints ids for new items on save

This resembles nested section item handling.

Reuse:

resolveItemIds-like concept

if appropriate.

Do NOT trust arbitrary client-created canonical UUIDs if established convention is
server-side identity minting.

Recommend.

---

# 55. Header save granularity

Options:

A. full Header config save
B. CRUD routes per nav item
C. hybrid

Strong likely preference:
full Header config save, since Header is a modest global settings object and the
Portal already uses Save/dirty patterns.

But ensure concurrent editing semantics are acceptable.

Use existing server config mutation transaction.

No need for navigation-item CRUD routes unless real benefits exist.

---

# 56. Footer editor UX

Based on final schema, likely:

Branding display toggle
Footer text
Page links / reuse Header nav
Social links toggle
Business contact toggle
Copyright toggle

Reuse existing Page picker/reordering UI if footer has custom Page links.

Do not implement footer columns.

No arbitrary widgets.

---

# 57. Header/Footer working/published semantics

Edits save to WORKING config.

Preview:
working Header/Footer immediately after Save

Public:
unchanged until Publish Site

Publish:
captures Header/Footer + Pages atomically in the same SiteDefinition snapshot

No separate "Publish Header".

No footer-specific publish.

---

# 58. Dirty navigation guard

Header and Footer editors must use the SAME shared Portal dirty guard as:

Theme
Page Settings
section editors

Test:

modify config
navigate away

Keep editing:
preserves values

Discard:
navigates

Save:
resets baseline

server validation error:
draft remains and remains dirty

No autosave.

---

# 59. Navigation editing and Page deletion concurrency

Scenario:

Operator A edits Header nav locally with Page B reference.

Operator B deletes Page B.

Operator A Saves Header.

Server must reject stale reference.

Portal should show a clear validation error and preserve draft.

Do not silently persist invalid pageId.

This is why server referential validation matters.

---

# 60. Navigation editing and slug-change concurrency

If Page B slug changes while Header editor is open:

nav reference remains valid because pageId is stable.

Saving Header should not care about stale displayed slug.

After server response, Portal re-renders current working Page metadata.

Good.

Test if practical.

---

# 61. Published nav + Page deletion

Working:

Header nav references Page B
Page B exists

Public published:
Page B/nav item exists

Delete Page B working.

Depending on §31 decision:

working nav ref auto-pruned OR deletion blocked.

Before Publish:
public Page B + nav still work from previous snapshot.

After Publish:
both Page and nav item gone.

Must be coherent.

---

# 62. Header CTA validation

If included:

buttonLabel/action both present or both absent.

Reuse LinkAction:

email
phone
url

No leadForm.

URL:
http/https only

No fabricated defaults.

Renderer omits CTA if absent.

Portal should not allow half-configured CTA save.

---

# 63. Footer external actions

Avoid adding a second generic action builder unless genuinely necessary.

Phone/email/social should come from global profile/social data.

Footer Page links should be structured Page references.

No arbitrary footer HTML links unless product needs it.

---

# 64. Site title/logo fallback

Audit current behavior when:

logo absent
siteName absent/blank
both present

Schema may require siteName.

Header brand presentation must always have a sensible accessible Home link.

If operator selects "logo only" but no logo exists:

Portal should prevent/normalize/fallback.

Define server invariant.

Avoid invisible brand/home link.

---

# 65. Media deletion interaction

If Header/Footer merely reference global branding logo, existing Branding media
scanner should already protect it.

Confirm.

If any new mediaId field is introduced:
audit all media seams and transaction races exactly as prior Steps.

Strong preference:
no new media shape in 3.4.

---

# 66. Public renderer tests

Plan direct coverage for:

Header branding
Header Page nav
navigation custom label
active page aria-current
Page slug resolution
shared-host links
custom-domain links
Preview pageId links
mobile menu semantics
optional Header CTA
Footer branding
Footer Page nav
Footer social/contact projection
copyright
Theme hooks
Custom CSS hooks

No screenshot testing required.

---

# 67. Working/published navigation matrix

Explicitly test:

Pages:
Home
Services /services

Working Header:
Home
Services

Before Publish:
public previous nav remains

Publish:
public nav contains Services link

Working slug:
/services → /what-we-do

Preview nav:
resolves working Page correctly

Public:
still /services

Publish:
public nav href becomes /what-we-do

No navigation config rewrite occurred.

---

# 68. Page-title/custom-label matrix

Nav item without custom label:
Page title "Services"
→ nav "Services"

Change working Page title:
"Installation"

Preview:
"Installation"

Public before Publish:
"Services"

Public after Publish:
"Installation"

Nav item WITH custom label:
"What We Do"

Page title changes:
nav stays "What We Do"

Test.

---

# 69. Preview matrix

Header and Footer navigation from Preview must stay inside Preview.

From preview Home:

click Services
→ preview Services by pageId

From preview Services:

click Home
→ preview Home/pageId

No live/public escape.

No slug-based Preview identity.

---

# 70. Page deletion tests

Based on chosen prune/reject strategy.

If auto-prune:

Header item removed
Footer custom item removed
other items retain ids/order
published untouched
next Publish coherent

If reject:

clear 409/400
Portal explains Page is used by navigation
operator can resolve

Choose and test thoroughly.

---

# 71. Server validation tests

Plan tests for:

default Header/Footer
nav item pageId exists
duplicate pageId
invalid custom label
unknown nav item id
nested item id minting
Header CTA pairing/action
Footer config fields
invalid enum/toggle fields
unknown fields
Page delete integrity
slug change doesn't invalidate refs
page title changes don't invalidate refs
25 Pages behavior doesn't affect menu validation

Centralized validation.

No route-local validation.

---

# 72. Portal tests

Direct tests for:

Header editor seed/save/dirty
Footer editor seed/save/dirty
Page picker
Page exclusion
custom label
Move Up/Down
Home optional inclusion
duplicate Page disabled
Header CTA
Footer toggles
Preview
server validation error
stale Page reference
dirty navigation
working/server authoritative state

Avoid only broad shell tests.

---

# 73. Accessibility tests

At minimum verify:

semantic nav landmark
aria-labels
aria-current page
mobile toggle
keyboard controls in Portal
accessible page-picker/dialog
CTA link
footer nav landmark
social accessible labels

No color-only active indication.

---

# 74. SiteShell / renderer test boundary

If components are extracted:

test presentation components directly where appropriate

and retain at least one integration render through:

PublicPage → SiteShell

for:

working/public route context
active Page
navigation href resolution
Footer

Avoid testing only implementation helpers.

---

# 75. No client navigation router

Do NOT add:

React Router
client-side route state
SPA transitions

Normal `<a>` navigation is appropriate.

Next public pages remain server-rendered.

Mobile toggle may be the only client behavior if required.

---

# 76. Sitemap interaction

Navigation inclusion must NOT determine sitemap inclusion.

All published Pages remain in sitemap according to Step 3.3.

A Page omitted from Header nav is still a valid public Page and sitemap entry.

Important separation.

---

# 77. SEO boundary

3.5 will add SEO/Social Sharing controls.

Navigation label is NOT:

SEO title

Footer text is NOT:

meta description

Do not add any metadata fields in 3.4.

---

# 78. Templates compatibility

3.6 Templates/Site Presets may need starter:

Header
Navigation
Footer

Ensure schema is easy to instantiate as part of a full site preset.

No implementation now.

---

# 79. Revision history compatibility

3.7 revisions must restore coherent:

Pages
Header/Nav
Footer
Theme/etc.

Because published snapshot embeds all global config and Pages, Header/Footer config
should also be embedded in that same SiteDefinition.

Do not create independent published Header/Footer documents.

---

# 80. Custom CSS compatibility

Add supported stable hooks only.

Potential docs:

[data-br-header]
[data-br-navigation]
[data-br-navigation-item="<uuid>"]
[data-br-footer]
[data-br-footer-navigation]

Retain:

[data-br-site]
[data-br-page]

Check Theme variables are still inline at data-br-site and document cascade
correctly.

Do not regress Step 3.1 guidance.

---

# 81. Performance

Navigation/Footer should add negligible data.

Assess:

- public payload impact
- published snapshot impact
- Page lookup per nav item
- avoid O(items × pages) if trivial Map can be used
- no extra Firestore read needed because SiteDefinition already contains Pages

No premature complexity.

---

# 82. Security

Audit proposed model:

- Page refs tenant-local only
- server validates referenced Page membership
- custom labels plain text
- footer text plain text
- Header CTA uses safe LinkAction
- no javascript:/data:
- social links use existing safe model
- no raw href from Page slug without canonical resolver
- Portal mutations require existing platform-admin/CSRF protections

No new auth model.

---

# 83. Config mutation transaction

Determine how Header/Footer saves fit current `site/config` transaction model.

Important concurrency:

Header save vs:
- Page delete
- Page title change
- Page slug change
- Publish

If save validates Page refs, the transaction should read necessary Page docs or
working SiteDefinition so stale refs cannot commit.

Explain exact read/write set.

---

# 84. Publish concurrency

Because Header/Footer live in config:

Header save changes config version.

Publish reads config.

Therefore concurrent Header/Footer save should force Publish retry.

Confirm current transaction semantics.

Add direct test if useful.

This should preserve coherent:

header config + page slugs + pages

in one snapshot.

---

# 85. Media-deletion race

If no new media refs:
media-deletion architecture should not require change.

If header/footer depends only on existing branding Media IDs:
existing branding scan should protect them.

Confirm no accidental weakening.

No need to expand Page-document reads merely because 3.4 exists; they already
happen.

---

# 86. Existing section-level SiteShell nav

Give a decisive migration plan.

Questions:

- remove it entirely?
- retain as one-page fallback?
- expose section entries through new structured nav model?
- keep only when no explicit Header nav exists?

Avoid permanent hidden dual behavior.

Strong preference:
explicit new Header navigation becomes sole nav source after 3.4.

If one-page sites need section links, model them as explicit structured nav items
rather than automatic scanning.

But only include section-target items if worth the added complexity.

Make a recommendation.

---

# 87. Recommended MVP

After auditing actual code, give a concise definitive Step 3.4 MVP.

A likely shape could be:

Header:
- brand presentation
- flat navigation
- optional page-specific custom labels
- optional CTA

Navigation:
- explicit Page references by immutable pageId
- independent ordering
- omit/include
- active-page state
- responsive mobile menu

Footer:
- Branding display
- optional short text
- Header-nav reuse or simple custom Page list
- existing social links
- existing business contact info where available
- automatic copyright

But adjust based on source.

Do not implement speculative features simply because listed here.

---

# 88. Implementation slicing

Decide whether Step 3.4 should be:

one cohesive slice

or:

3.4a schema/server/renderer
3.4b Portal

Given Step 3.3 benefited from that split, consider whether the same risk profile
exists here.

Header/Nav/Footer referential integrity + Preview routing are architectural enough
that a two-slice approach may again be useful.

Recommend based on actual work size.

---

# 89. Likely file impact

Identify expected files in:

server/domain
server/services
server/routes
server/test

site-schema

site-components

site-renderer
SiteShell
route/link helpers
tests

Portal
BusinessWebsite
navigation
HeaderEditor/FooterEditor
API helpers
tests

docs

Do not modify anything during planning.

---

# 90. Classifier expectation

Estimate changed-path classifier.

Likely:

api=true
portal=true
renderer=true
client=false
unknown=[]

depending on actual schema/shared package changes.

No CI architecture change.

---

# 91. Operator decisions

Only surface product-level choices genuinely requiring sign-off.

Make a recommendation for each.

Likely candidates:

- Page-only nav vs Page+section nav
- Header CTA inclusion
- Footer nav reuse vs custom
- Page deletion auto-prunes menu vs blocks deletion
- brand display options
- Footer short text
- mobile menu strategy if it materially affects product behavior

Do not ask for implementation details Claude can resolve.

---

# 92. Final output

Return:

1. Git/baseline state
2. current SiteShell structure
3. current navigation behavior
4. current footer behavior
5. current Branding/Profile/Social data available
6. problems to solve
7. recommended Header schema
8. recommended NavigationItem schema
9. item identity strategy
10. navigation target types
11. Page-only vs Page+section decision
12. external-nav-link decision
13. custom-label semantics
14. Home inclusion semantics
15. duplicate Page-ref rule
16. navigation ordering model
17. Header CTA decision/schema
18. Header brand-display decision
19. Header layout/sticky decision
20. mobile menu strategy
21. Footer schema
22. Footer navigation strategy
23. Footer Branding behavior
24. Footer contact projection
25. Footer social behavior
26. Footer short-text decision
27. copyright behavior
28. global config storage location
29. working/published behavior
30. missing-config defaults
31. migration requirements
32. initial navigation/default UX
33. behavior when a new Page is created
34. Page deletion referential-integrity strategy
35. slug-change behavior
36. title/custom-label behavior
37. server validation
38. nav item nested-id handling
39. config transaction behavior
40. Publish transaction behavior
41. Preview navigation behavior
42. custom-domain href behavior
43. shared-host href behavior
44. SiteShell/component architecture
45. shared package/renderer boundary
46. active-page accessibility
47. mobile accessibility
48. Footer accessibility
49. Theme result
50. Custom CSS hooks
51. media-reference impact
52. sitemap independence
53. SEO boundary
54. Templates/revision-history compatibility
55. security analysis
56. performance analysis
57. server test plan
58. renderer test plan
59. Portal test plan
60. accessibility test plan
61. likely files changed
62. classifier impact
63. implementation slicing
64. operator decisions
65. whether Step 3.4 is ready to implement

Explicitly answer:

Should NavigationItems reference pageId rather than slug?

Should navigation order remain separate from pageOrder?

Should Page inclusion be represented by menu membership rather than a field on
SitePage?

Should navigation support custom operator labels?

Should the same Page be allowed twice in one Header menu?

Should Header navigation support section anchors in 3.4?

Should Header navigation support arbitrary external URLs in 3.4?

Should Header have one optional LinkAction CTA?

Can Header CTA use leadForm?
Expected: NO.

Should Header expose multiple layout/style variants?
Expected likely: NO.

Should Header/Footer be global SiteDefinition data rather than sections?

Should Footer reuse Header navigation, have custom navigation, or both?

Should Footer duplicate contact/social data?
Expected: NO — project existing global data.

Should Footer support a small custom text field?

Should copyright year be automatic?

Should deleting a Page automatically prune navigation references or block deletion?

Does changing a Page slug require modifying navigation config?
Expected: NO.

Does changing a Page title affect menu text when no custom label exists?

Should Preview Header/Footer navigation stay entirely inside Preview using pageIds?
Expected: YES.

Should navigation inclusion affect sitemap inclusion?
Expected: NO.

Should 3.4 remove the old automatic section-derived SiteShell navigation?

If one-page section links are needed, should they be explicit structured
pageId+sectionId references rather than implicit section scanning?

Does 3.4 require new Theme fields?
Expected: NO.

Does 3.4 require new media-reference shapes?
Expected likely: NO.

Does 3.4 require any third-party dependency?
Expected: NO.

Does 3.4 require a Firestore migration?
Expected likely: NO, use missing-config defaults.

Can Header/Footer be published coherently in the existing single SiteDefinition
snapshot?

Can Step 3.5 SEO build cleanly on this model?

Can Step 3.6 Templates instantiate this shell configuration?

Can Step 3.7 revision history restore Header/Nav/Footer coherently?