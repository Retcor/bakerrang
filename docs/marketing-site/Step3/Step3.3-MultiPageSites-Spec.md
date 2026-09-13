# Step 3.3 Planning — Multi-Page Sites

Planning / read-only only.

Do NOT modify files.
Do NOT deploy.
Do NOT mutate Firestore.
Do NOT mutate GCP.
Do NOT modify Git state.
Do NOT create commits.

Step 3 is intentionally being maintained in one branch / PR.

Completed:

3.0 Site Editor V2 / Section Architecture
3.1 Theme & Global Styling Controls
3.2 Expanded Section Library

Current section library includes:

- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Business Hours
- Contact
- Steps / Process
- Highlights / Stats
- Call to Action
- Logos

Step 3.3 now introduces MULTI-PAGE marketing sites.

This is an architectural step.

Do NOT casually redesign:

- section identity
- Theme
- media storage
- working/published semantics
- auth
- tenancy
- Custom CSS
- SiteShell
- generic section instance commands

unless the actual current implementation requires a narrow change.

---

# Product goal

After Step 3.3, an operator should be able to build a site such as:

Home
About
Services
Gallery
FAQ
Contact

with each page having its own independent section composition.

Public routes should render the correct published page.

Portal Preview should render the correct working page.

The page system should be ready for Step 3.4 Header / Navigation / Footer, but
3.3 should NOT become a full navigation/header/footer editor.

---

# Strong scope boundary

Step 3.3 OWNS:

- page identity
- page storage
- page CRUD
- page titles
- page slugs
- page ordering metadata if needed
- per-page section composition
- Portal page manager
- exact-page editing
- working/public rendering
- public routing
- preview routing
- publish behavior
- media/reference scanning across every page

Step 3.3 does NOT own:

- editable header
- editable footer
- editable nav menus
- nested/dropdown nav
- SEO metadata controls
- arbitrary route hierarchy
- blog routing
- redirects management
- multilingual URLs

Those belong later unless a tiny prerequisite is unavoidable.

---

# 1. Establish current Git/baseline state

Inspect:

git status
git log --oneline --decorate -10
git diff
git diff --cached

Report:

- branch
- HEAD
- committed 3.0/3.1 state
- current 3.2 state
- whether 3.2 has been committed
- unrelated working-tree changes

Run the deterministic baseline:

Server tests
Portal tests
Renderer tests
UI tests
Platform typecheck
Server/platform lint

Do NOT alter the intentional Step3 branch/PR workflow.

---

# 2. Audit the CURRENT page/site storage architecture

This is foundational.

Inspect exact Firestore paths and schemas for:

working site config
working Home
published snapshot
public sanitized site response
Preview response

Known historical working Home path was:

tenants/{tenantId}/site/config/pages/home

Do not assume that is still the complete architecture.

Determine exactly:

- what lives in `site/config`
- what lives in `site/config/pages/home`
- whether any other page documents already exist
- how Home is loaded
- how Home is written
- how Publish gathers Home
- how published/current stores page content
- whether published/current embeds Home or references it
- how public API shapes the site
- how renderer receives it

Produce exact path/schema diagrams.

---

# 3. Audit the current renderer route model

Inspect actual Next.js routing.

Identify current routes including:

/
tenant/domain route handling
/contact
preview routes
custom-domain resolution
any slug route already present

Especially determine the current meaning of `/contact`.

Questions:

- Is `/contact` a special renderer page today?
- Does it render the Contact section?
- Does it use SiteShell?
- Is Contact simultaneously a Homepage section and a special page?
- How does it obtain working vs published content?
- Does Hero/Contact CTA link to `/contact`?
- Are any tests or content models dependent on `/contact` being reserved?

This MUST be resolved before designing generic pages.

---

# 4. Decide the long-term Page identity model

Pages need immutable identity independent of slug/title.

Strong preference:

Page identity != slug.

A rename:

"Services" → "What We Do"

or slug change:

/services → /our-services

must not create a new logical Page.

Evaluate:

A. server-generated UUID page IDs
B. special fixed Home ID + UUIDs for all other pages
C. document ID == slug
D. another model based on current architecture

Avoid document-id-equals-slug unless there is a compelling reason.

Recommend the durable model.

---

# 5. Home special handling

Home is inherently special because it owns `/`.

Determine whether:

- Home keeps stable special id/document id `home`
- Home gets a UUID but a `kind:'home'`
- Home remains outside generic pages
- all pages become uniform with one `isHome` invariant

Strong requirements:

- exactly one Home
- Home cannot be deleted
- Home cannot change its public route from `/`
- Home likely should not have an editable slug
- Home remains identifiable without relying on title text

Do not create a fragile `slug === ''` identity rule if avoidable.

Recommend the clean invariant.

---

# 6. Page schema

Design exact long-term Page shape.

Likely concepts:

{
id: string
title: string
slug: string
sections: SiteSection[]
}

Potential additional fields to evaluate:

hidden?
status?
includeInNavigation?
navigationLabel?
sortOrder?

Be disciplined.

If a field belongs to 3.4 navigation, DO NOT put it into 3.3 merely because it
might someday be useful.

Possible exception:

a page ordering value/list may be needed for Portal organization and future nav
order.

Explain the boundary carefully.

---

# 7. Page ordering

Operators need a manageable page list.

Determine whether page order should be persisted in 3.3.

Options:

A. pages array in config defines canonical order
B. each page has `order`
C. no persisted order yet; deterministic created/title order
D. separate page-order metadata

Future 3.4 navigation may want a different order from Portal page management.

Avoid accidentally equating:

site page order

with:

navigation menu configuration

unless that coupling is intentionally desired.

Recommend the smallest durable solution.

---

# 8. Slug model

For non-Home pages define strict slug behavior.

Evaluate canonical format:

- lowercase
- ASCII?
- `a-z0-9-`
- no leading/trailing hyphen
- no consecutive hyphens if easy
- max length

Determine whether Portal should:

- auto-suggest slug from title on create
- continue auto-changing it when title changes
- stop auto-syncing after initial creation

Strong preference:

Generate/suggest initially, then treat slug as an explicit editable URL field.

Do not silently change established URLs whenever a page title changes.

---

# 9. Slug uniqueness

Uniqueness must be server-authoritative and transaction-safe.

Within one tenant:

- duplicate slugs rejected
- case variants cannot collide
- Home route collision impossible

Determine how uniqueness is enforced based on storage model.

Avoid client-only uniqueness checks.

If page documents are separate Firestore docs, analyze transaction requirements.

---

# 10. Reserved slugs — IMPORTANT

Audit all renderer/platform routes that may collide with tenant pages.

Potential examples:

contact
preview
api
admin
_next
favicon.ico
robots.txt
sitemap.xml

Do not blindly reserve everything.

Identify ACTUAL tenant-facing route namespace.

Determine which slug values must be prohibited.

Pay special attention to current `/contact`.

Recommend exact reserved-slug set with rationale.

---

# 11. Contact route decision — CRITICAL

Based on the audit, recommend what happens to the current special `/contact`.

Possible outcomes:

A. keep `/contact` reserved/special in 3.3
B. convert Contact into a normal Page architecture
C. support both temporarily
D. another clean model

We want to avoid permanent duplicate concepts such as:

Contact section
special Contact page
user-created Contact page

unless each has a clear purpose.

The existing `contact` SECTION can remain a section type.

But determine whether the special renderer PAGE still earns its place once
generic pages exist.

Consider migration/data compatibility.

There are no real customer marketing sites, so a narrow breaking cleanup is
allowed if it materially improves architecture.

Do not preserve a bad special-case forever merely for test data.

---

# 12. Page CRUD invariants

Design commands for:

Create Page
Rename/update Page
Change slug
Reorder Page
Delete Page

Potential future:

Duplicate Page

Decide whether Page duplication belongs in 3.3.

Strong preference:
include only if it is cheap and clean.

For every command define:

- page ID semantics
- server transaction
- Home restrictions
- slug uniqueness
- response shape
- exact created pageId returned

Create Page should return:

{
site: ...,
pageId: ...
}

or equivalent exact identity.

Do NOT infer created page IDs client-side with set differences.

Reuse the 3.0b lesson.

---

# 13. Page deletion

Non-Home pages should likely be deletable.

Verify deletion implications:

- page sections disappear from WORKING
- published remains unchanged until Publish
- media referenced only by deleted working page may still be protected by
  published page until next Publish
- media referenced elsewhere remains protected
- Portal route to deleted page gracefully returns to manager
- deleting a Page must not accidentally delete Media Library objects

No automatic media deletion.

---

# 14. Page duplication

Evaluate whether to include.

If included:

- new Page UUID
- unique new slug required/generated
- every section gets a NEW section UUID
- every nested item gets a NEW item UUID
- media IDs remain shared references
- content order preserved
- Home cannot be duplicated as another Home

This is valuable but can add test surface.

Recommend include/defer decisively.

---

# 15. Per-page section composition

Existing section commands currently operate on Home.

Audit:

mutateWorkingHome
updateSectionContent
addSection
removeSection
moveSection
duplicateSection
visibility

Multi-page requires those commands to target a Page.

Recommend how to generalize them.

Likely direction:

mutateWorkingPage(tenantId, pageId, ...)

rather than duplicating Home-specific methods.

Do NOT leave a parallel full Home command stack plus a separate generic Page
stack if a clean generalization is feasible.

However:

avoid a giant rewrite.

Recommend the smallest safe refactor.

---

# 16. Hero rule under multi-page

Current Hero invariant:

- exactly one
- index 0
- visible
- non-removable
- non-movable
- non-duplicable
- non-hideable

This was originally a HOME invariant.

Decide whether Hero should be:

A. Home-only
B. required on every Page
C. optional on non-Home pages
D. allowed repeatable somehow

Strong likely direction:

Hero remains Home-only.

For other pages, operators can start with About/CTA/etc., and 3.4 can later add
page headers if needed.

But inspect actual design/components before deciding.

If Hero is Home-only:

- Add dialog must omit/disable it on non-Home pages
- composition validator must enforce Hero only on Home
- generic page commands need page-kind awareness

Recommend explicitly.

---

# 17. Contact and Business Hours multiplicity across pages

Current singleton semantics were site/Home-centric.

Once sections exist on multiple Pages, define whether singleton means:

A. at most one per PAGE
B. at most one across the ENTIRE SITE

This is a major architectural question.

Current singleton types:

hero
contact
businessHours

Evaluate each individually.

Likely:

Hero:
site/Home-only

Contact:
possibly one per page or site-wide?

Business Hours:
projection of global business profile; could logically appear on multiple pages.

The old singleton constraint may have meant "one on Home" rather than "one
anywhere in site."

Do NOT carry singleton semantics forward blindly.

Recommend:

- page-scoped multiplicity
- site-scoped multiplicity
- Home-only restrictions

for each current singleton type.

This may justify changing the singleton model into explicit section-placement
rules.

---

# 18. Business Hours projection

Business Hours content is projected from global business-profile data.

Verify how it behaves when placed on a page.

Should it be allowed on:

Home
Contact page
About page
multiple pages

Since content is global/projection-based, multiple placements may be perfectly
valid.

Determine whether it should remain singleton PER PAGE or become repeatable across
site pages.

Do not duplicate business-hour storage.

---

# 19. Contact section under multi-page

Similarly determine whether Contact should be allowed on multiple pages.

A business may reasonably have:

Home Contact CTA/form
Contact Page Contact form

If `contact` remains globally singleton, Multi-Page may become awkward.

Evaluate changing Contact singleton semantics to:

at most one Contact section PER PAGE

or another rule.

Preserve lead handling.

---

# 20. Section ID uniqueness scope

Current section IDs are UUIDs.

Determine whether uniqueness is:

- effectively global
- site-wide
- page-local

Keep UUIDs.

Do not introduce IDs like:

services-1

Page moves/copies should not collide.

If sections can later move between pages, page-local identity must still be safe.

---

# 21. Moving sections between pages

Decide whether Step 3.3 includes:

Move section to another page

or:

Copy section to another page

This is useful but not required for basic Multi-Page.

Evaluate UX/implementation/test complexity.

Strong preference:

Defer cross-page move/copy unless it is very cheap.

Page-local add/edit/reorder is sufficient MVP.

Do not overgrow 3.3.

---

# 22. Working storage design

Recommend exact Firestore structure.

Potential shape:

tenants/{tenantId}/site/config
pageOrder: [...]

tenants/{tenantId}/site/config/pages/{pageId}
id
title
slug
sections

or another layout.

Important:

Firestore subcollections are NOT included automatically when reading a parent
document.

Publishing needs an atomic/coherent snapshot.

Analyze:

- number of reads
- transaction limits
- future number of pages
- publish transaction behavior
- consistency
- testability

Do not choose document-per-page without accounting for Publish.

---

# 23. Published snapshot design — CRITICAL

Today:

tenants/{tenantId}/site/config/published/current

must represent one coherent public version.

Design how all Pages appear in published state.

Strong candidates:

A. embed all published pages inside `published/current`
B. separate published page documents + generation/revision pointer
C. another snapshot model

For normal local-business sites, page counts/content should be modest.

Evaluate Firestore 1 MiB document limit.

Media contents store IDs, not bytes, so estimate realistic scale.

Prefer simplicity if safe.

The public renderer should not see a mixture of pages from different publish
operations.

Atomic publish semantics matter.

---

# 24. Firestore document-size risk

If embedding all pages in one published snapshot:

estimate practical limits.

Consider:

- number of pages
- number of sections
- nested Services/Gallery/FAQ/etc.
- Custom CSS
- theme/config

Determine whether a reasonable product limit is enough to stay safely below
Firestore's document limit.

If a page-count/section-count/content limit is needed, recommend it.

Do not create arbitrary low caps without technical justification.

---

# 25. Working-state consistency

If each working page is a separate document:

page create/update/delete/reorder may span:

site config
page docs

Design transactions carefully.

Questions:

- does config contain page metadata?
- can metadata and page doc drift?
- can an orphan page doc exist?
- can a page list reference missing page?

Prefer one authoritative representation.

Recommend integrity validation/recovery strategy.

---

# 26. Public sanitized SiteDefinition

Audit current public API type.

Determine whether `SiteDefinition` should evolve to:

{
...
pages: [...]
}

or:

{
...
page: ...
}

depending on endpoint/routing model.

Possible API strategies:

A. one public endpoint returns entire published site including all pages
B. endpoint accepts slug and returns one hydrated page + global site config
C. hybrid

Evaluate:

- response size
- renderer requests
- media hydration
- custom domains
- preview
- future sitemap
- caching

Renderer remains Firestore-free.

No direct Firestore access from Next.js.

Recommend exact API shape.

---

# 27. Per-page API vs whole-site API

This needs a clear decision.

For a local business site with perhaps 5–15 pages, whole-site payload may still
be acceptable.

But per-page API can avoid hydrating media for unused pages.

Analyze actual current API and caching behavior.

Requirements:

- public route can determine 404 cleanly
- Preview route can render working page
- SiteShell gets global Theme/Branding/Profile
- page content gets hydrated safely
- media deletion scanner still scans all stored pages independently from public
  hydration behavior

Recommend the simpler scalable choice.

---

# 28. Renderer routing

Design public routes.

Likely:

/                     → Home
/:slug                → non-Home Page

But inspect custom-domain/tenant-routing architecture carefully.

If tenant identifier is currently in the URL internally, account for it.

Avoid catch-all routing that collides with Next/static routes.

Determine exact files/routes likely required.

---

# 29. 404 behavior

Unknown published slug should produce a proper not-found response.

Verify:

- HTTP 404 where supported
- no fallback to Home
- no leaking working/unpublished Page existence
- Portal Preview of a deleted/nonexistent page handles gracefully

No redirect to `/`.

---

# 30. Preview routing

Portal Preview must target a specific page.

Design exact URL/query model.

Current preview may already use special host/query semantics.

Potential:

preview URL + pageId

or slug.

Strong preference:

Use immutable pageId internally for Portal/editor navigation.

Public-like preview URL may display slug, but don't make slug the only identity.

Changing an unsaved slug should not break Portal's ability to preview the Page.

Determine actual clean approach.

---

# 31. Portal editor navigation

Current Portal has a Homepage manager/editor.

Design the Multi-Page UX.

Potential:

Website
Pages
Home
About
Services
Contact

Click page:
→ Page Section Manager

Need:

- Page list
- Add Page
- Rename/edit Page settings
- Delete Page
- reorder if included
- edit sections
- Preview
- Publish

Do not implement Header/Nav/Footer.

The Pages UI may later feed 3.4.

Recommend exact conceptual UX.

---

# 32. Page manager vs Section manager

Strongly prefer reuse.

The current HomepageSectionManager should probably become something like:

PageSectionManager

rather than clone:

HomepageSectionManager
ServicesPageSectionManager
AboutPageSectionManager

Audit how Home-specific the current manager really is.

Recommend:

- rename/generalize existing manager
- wrapper for Home if needed
- no duplicate manager logic

Identify exact Home-only behaviors that must remain conditional.

---

# 33. Portal URL identity

Current:

?editor=homepage
?editor=homepage&sectionId=<uuid>

needs evolution.

Design stable Portal routing/query semantics.

Potential:

?editor=page&pageId=<uuid>
?editor=page&pageId=<uuid>&sectionId=<uuid>

Home can use its stable pageId too.

Avoid title/slug in editor identity.

Determine backwards compatibility requirement for old `editor=homepage`.

Since Step 3 is still unreleased to real customers, a clean internal break may be
acceptable.

Do not keep permanent duplicate routes solely for current test state.

---

# 34. Page settings editor

Design fields:

Page title
Slug

Potential:
navigation label — DEFER 3.4
SEO title/description — DEFER 3.5

Home:
title may be editable for Portal/display?
slug hidden/read-only `/`

Decide whether page title has any public rendering effect automatically.

Important:

Do not automatically render a page title outside sections unless explicitly part
of renderer design.

Title may currently be metadata/Portal/nav label only.

Clarify semantics.

---

# 35. Creating a Page

Define default section composition.

Options:

A. empty sections
B. one About section
C. another neutral Page Heading section
D. Hero-like section

Strong preference:

Do not fabricate content.

But completely empty Page may render awkwardly.

Evaluate current renderer/SiteSection components.

A neutral starter:

About with heading matching page title?

would duplicate title into content and couple metadata to content.

Recommend clean behavior.

Possibly:
new page starts with zero sections and Portal immediately opens Add Section.

If composition validator currently requires nonempty sections, decide whether
non-Home Pages may have zero.

---

# 36. Empty Page validity

Should a non-Home page with zero sections be valid WORKING content?

Likely yes.

Should it be publishable?

Evaluate.

Publishing an empty page could produce a blank SiteShell.

Options:

- allow it
- block publish
- render a minimal page shell

Avoid complex page-level publish validation unless needed.

Recommend pragmatic behavior.

---

# 37. Page visibility / draft concept

Do NOT automatically introduce a second page-level draft/visibility system.

Working/published already provides draft semantics.

A new Page created in WORKING is not public until Publish.

Question:

After it has been published once, how does an operator temporarily remove it
without deleting it?

Potential `hidden` page flag.

Determine whether this belongs in 3.3.

If adding page visibility:

- hidden working page omitted on next Publish
- Preview may still render it
- future nav excludes it

But this could become another useful dimension.

Recommend include/defer.

---

# 38. Deleting a previously published Page

Working deletion + Publish should remove it from public routes.

Before Publish:

- old published Page remains live

After Publish:

- route returns 404

Ensure published snapshot replacement naturally removes stale pages.

No orphan public page docs if using separate storage.

---

# 39. Slug change and old URLs

If:

/services

becomes:

/our-services

after Publish, should `/services` redirect?

Step 3.3 likely should NOT implement redirect history.

Recommend:

old URL → 404

until a future Redirect/SEO capability.

Warn operator in Portal if appropriate.

Do not build redirect infrastructure now.

---

# 40. Slug changes in working vs published

Working slug change should NOT immediately change live route.

Preview should use working slug/page identity.

Public old published slug remains live until Publish.

After Publish:

new slug becomes live
old slug disappears

Explicitly test this.

---

# 41. Page title vs slug independence

Changing title must not automatically mutate an established slug.

Creation UX may propose:

"About Us" → `about-us`

After creation, title and slug are separate fields.

Test.

---

# 42. Page count limits

Determine whether to enforce a practical maximum.

Potential local-business expectation:

5–20 pages.

We want to avoid:

- accidentally 1000 pages
- Firestore snapshot-size risk
- Portal unusability

But don't add arbitrary caps prematurely.

If recommending a cap, justify it from:

published snapshot size
performance
UX

Potential 25/50 page cap could be reasonable.

Audit actual content limits first.

---

# 43. Section count across pages

Current system intentionally has no arbitrary section-count cap.

With multiple pages, determine whether this remains safe.

Do not invent a low cap merely because page count grows.

Firestore snapshot limits may change that decision.

Provide estimated upper-bound reasoning.

---

# 44. Media scanners — CRITICAL

Today media logic scans Home sections.

Multi-Page means EVERY working and published page must be included.

Audit ALL media-reference seams:

sectionMediaIds
collectSiteMediaIds
collectMediaLocations
hydrateSiteMedia
requireTenantMediaInTransaction
deletion markers/race logic
published reference scans
pending hydration behavior

Refactor so scanners operate over:

all pages
all sections
hidden sections
repeated sections

Do NOT create a "Home + other pages" duplicated scanner.

Prefer one canonical page iteration.

Produce exact affected functions.

---

# 45. Media deletion race with multi-page

This is load-bearing.

Scenarios:

Media deletion transaction checks entire site.

Concurrent writer updates Page B to reference media while deletion is underway.

Expected:
Firestore conflict/retry prevents deletion.

Verify whether current transaction read set can include all page docs.

If pages are separate working documents, the race architecture becomes more
complex because deletion must read every relevant page document inside its
transaction.

Analyze carefully.

This may strongly influence storage design.

Do NOT approve a page-per-doc architecture that breaks race-safe media deletion.

---

# 46. Firestore transactional read scalability

Current media deletion/reference validation may read:

working Home
published current

With many Page documents it might need:

config
N working page docs
published snapshot

Evaluate:

- Firestore transaction document-read behavior
- realistic page count
- performance/cost
- contention
- correctness

Consider whether working pages should remain embedded/aggregated in a way that
keeps transaction-safe scanning tractable.

This architecture choice matters more than theoretical normalization elegance.

---

# 47. Media validation on page writes

When updating Page X with media references:

requireTenantMediaInTransaction

must validate media within the same write transaction.

This should only need:

Page X content media IDs
media docs

But deletion race safety must ensure deleting media conflicts with any Page write
that starts referencing it.

Explain exactly how the transaction conflict works under the proposed storage
model.

---

# 48. Site publish race / atomicity

Publishing multiple pages must capture one coherent working state.

If working Pages are multiple Firestore documents:

- how do we prevent Page A from being captured before concurrent edit while Page
  B is captured after?
- does Publish run in a transaction reading all page docs?
- is that acceptable for realistic count?

If pages are embedded in one document:

- simpler atomicity
- document-size concerns

Compare explicitly.

---

# 49. SiteDefinition/public hydration

Media hydration should hydrate only relevant page(s) if possible without altering
stored schema.

If the API returns the whole site, all page media may hydrate at once.

Estimate cost.

If it returns one page, global site config should still remain coherent with the
published snapshot.

Recommend.

---

# 50. Page-level Custom CSS hooks

Existing hooks:

[data-br-site]
[data-br-section]
[data-br-section-id]

Determine whether multi-page needs:

data-br-page
data-br-page-id
data-br-page-slug

A stable immutable page-ID hook could be useful.

Potential:

data-br-page="<page-id>"

or:

data-br-page-id="<uuid>"

Do not expose slug as the only stable styling hook because slug is editable.

Recommend exact hooks if useful.

Update advanced styling docs only if genuinely supported.

---

# 51. DOM IDs / anchors

Section anchors currently:

section-${section.id}

With UUID sections globally unique, this remains safe across pages.

Verify.

Do not create:

about-services

from mutable titles/slugs.

---

# 52. Header/navigation dependency boundary

3.4 will add actual editable Header/Nav/Footer.

3.3 may need only a TEMPORARY/simple way to navigate pages for manual testing.

Avoid adding a throwaway public nav that must immediately be replaced.

Options:

A. no generated nav yet; pages reachable by direct URL/Portal Preview
B. minimal automatically-generated nav in SiteShell
C. implement the underlying nav model now but editor later

Strong preference:
A unless usability becomes impossible.

We can manually/publicly visit `/about`, `/services`, etc.

Do not accidentally implement half of 3.4.

---

# 53. Existing SiteShell

Audit whether SiteShell assumes Home/Contact only.

Generalize only enough to wrap any Page.

Theme/global branding should apply across every Page automatically.

No route-specific Theme application.

---

# 54. Favicon/branding

Global Branding remains site-wide.

Multi-page must not create per-page logo/favicon.

No changes.

---

# 55. Theme

Theme remains site-wide.

No per-page Theme fields.

No page color override.

Custom CSS remains escape hatch.

---

# 56. Business profile / socials

Remain site-wide.

No page-local duplication.

Renderer components continue using global data projections where required.

---

# 57. Lead form behavior

If Contact sections can exist on more than one page:

lead submissions should continue functioning without requiring a new endpoint.

Evaluate whether lead source should record:

pageId
pageSlug

Currently source may simply be WEBSITE.

Do NOT expand lead schema automatically.

If page attribution would be useful, classify:

necessary
tiny worthwhile enhancement
defer

Keep scope disciplined.

---

# 58. Canonical URLs / SEO boundary

Canonical/public URL infrastructure exists separately from CMS content.

Do NOT add SEO editor fields in 3.3.

But public page routing should produce stable URLs suitable for 3.5.

Determine whether metadata generation currently assumes Home/Contact.

Identify prerequisite changes only.

---

# 59. Sitemap / robots

Do not implement full SEO controls.

If a sitemap already exists, determine whether adding Pages requires it to enumerate
them for correctness.

If no sitemap exists, defer to 3.5.

Distinguish existing-feature regression from new SEO scope.

---

# 60. Portal Publish UX

Current Publish likely publishes whole site.

Keep one site-wide Publish action.

Do NOT add per-page publishing.

Publishing should snapshot:

global config
all Pages
Theme
Custom CSS
etc.

One public site version.

Explain any impact on current UI.

---

# 61. Unsaved page editor and Publish/Preview

Existing dirty guard must still work.

If current Page editor has unsaved local form changes:

- navigating to another Page should warn
- Preview should not pretend unsaved form is working state
- Publish should remain disabled/guarded according to current conventions

Reuse the existing Step 3.0 guard.

No second dirty system.

---

# 62. Page CRUD and unsaved state

Creating/deleting/reordering pages are server mutations, not unsaved local editor
form changes.

Determine UI feedback/loading.

One mutation at a time.
Server response authoritative.
No optimistic identity inference.

Reuse Section Manager philosophy.

---

# 63. Concurrency

Consider:

operator A edits Page A
operator B edits Page B

Separate page documents may reduce conflicts.

Embedded-all-pages may increase transaction contention.

Compare this against:

media deletion race correctness
publish atomicity
document-size

Recommend based on realistic BakerRang use, not theoretical maximum concurrency.

Remember these are local-business sites with relatively modest operator traffic.

---

# 64. Page names and duplicate titles

Titles need not be unique if slugs are unique.

Decide whether Portal should warn/disallow duplicate titles.

Strong preference:
allow duplicate titles technically; slug is route key.

But duplicates may confuse operators.

Recommend.

---

# 65. Slug normalization function

Design one authoritative server helper, e.g.:

normalizePageSlug
validatePageSlug

Portal can mirror for UX, but server owns acceptance.

Avoid separate subtly different regexes.

Specify:

input
normalized form
error behavior

Determine whether server should normalize or require canonical input.

Strong preference:
Portal suggests canonical; server validates canonical, rather than silently
rewriting surprising user input.

---

# 66. Reserved route tests

Add deterministic tests for every reserved slug.

Especially `/contact` based on the decision in §11.

Do not rely on Next.js runtime accidentally winning a route collision.

---

# 67. Page-manager accessibility

Portal Page list:

- accessible buttons
- current Page state
- Add Page dialog
- Delete confirmation
- reorder controls usable by keyboard
- no drag-only UI

Use the same always-visible Move Up / Move Down philosophy used for sections.

Do not require drag and drop.

---

# 68. Page settings destructive actions

Home:

- cannot delete
- cannot change route
- likely cannot reorder before itself if it is pinned first

Non-Home:

- delete with confirm
- slug edits with clear public URL implication

Determine whether Home should be permanently index 0 in Portal ordering.

Likely yes.

---

# 69. Page manager summaries

For each page card/list entry show useful compact metadata:

Title
/public-slug
section count

Potential:
draft/new indicator — working/published comparison may be expensive.

Do not add complex per-page publish state.

Recommend minimal UI.

---

# 70. Add Page default slug generation

Portal may locally derive:

"Frequently Asked Questions"
→ `frequently-asked-questions`

for the creation form.

Server validates uniqueness.

If collision:

`faq` already exists

Do NOT automatically append `-2` server-side without user visibility unless current
UX conventions favor that.

Recommend clear conflict error.

---

# 71. Deleting Home

Must be impossible server-side.

Not merely hidden in UI.

Test.

---

# 72. Renaming Home

Clarify meaning.

Home page title metadata can likely change.

Public route remains `/`.

If Home title isn't rendered anywhere until navigation/SEO, it may be a Portal
organizational label only.

Recommend whether to fix its title to "Home" for now.

Simpler may be:

Home title fixed "Home" until 3.4/3.5.

Evaluate.

---

# 73. Initial page batch on existing sites

Data transition question:

Current site has only `pages/home`.

If new schema adds page metadata/index:

existing marketing test sites may need a narrow transition.

However there are still no real customer marketing sites.

Determine whether a migration is actually necessary.

Prefer compatibility that naturally interprets current Home as the initial page if
it does not permanently complicate the architecture.

But do NOT create heavy legacy machinery.

Explicitly list any Firestore paths affected.

Never touch unrelated legacy BakerRang data.

---

# 74. Transition strategy if required

If required, make it narrowly scoped.

Possible:

site/config gains:
pages/order/metadata

existing:
site/config/pages/home
is retained

or reshape existing marketing site docs.

Published/current may need reshaping too.

Do NOT perform transition during planning/implementation.

Provide exact post-deploy sequence.

---

# 75. MAIN/test-site rollout implications

No real customer marketing sites currently exist.

Therefore a short test-site incompatibility window can be acceptable if a cleaner
model requires it.

But avoid unnecessary outage if natural compatibility is simple.

Legacy BakerRang application data remains protected and unrelated.

No broad Firestore deletion/recreation.

---

# 76. Page schema validation tests

Plan tests for:

- valid create
- duplicate slug
- invalid slug
- reserved slug
- title limits
- slug limits
- Home invariants
- delete
- reorder
- rename
- slug change
- exact created pageId
- unknown pageId
- tenant isolation

---

# 77. Page composition tests

For non-Home Page:

- add section
- edit section
- move section
- hide
- duplicate
- remove

Repeated sections independent.

Home Hero invariant still enforced.

Non-Home Hero rule tested based on decision.

Contact/BusinessHours placement rules tested.

---

# 78. Working/published tests

Explicit matrix:

Create Page in working
→ public does not see it

Publish
→ public route exists

Rename title in working
→ live unchanged

Change slug in working
→ old live route still exists

Publish
→ new route exists, old route 404

Delete page in working
→ live still exists

Publish
→ live route 404

Preview:
→ working version throughout

---

# 79. Multi-page publish tests

Test a single publish containing:

Home
Page A
Page B

All three must come from one coherent working state.

No stale page left behind.

Deletion should remove old published page.

---

# 80. Media tests — MUST BE STRONG

At minimum:

working Page A media protects
working Page B media protects
hidden section on Page B protects
published Page B media protects
same media on two pages protects
deleting one page doesn't free media referenced by another
page deletion + published state interaction
page duplication if implemented
concurrent page write vs media delete transaction

Reuse actual transaction/FakeDb semantics.

No mocked-sequential race-only tests.

---

# 81. Portal tests

Plan direct tests for:

Page manager
Create Page dialog
Slug validation/conflict UX
Delete confirm
Reorder
Home restrictions
exact pageId routing
Page Section Manager
two pages edited independently
section editors target correct page + section
dirty navigation between pages
Preview target
Publish behavior

Avoid relying solely on broad manager tests.

---

# 82. Renderer tests

Test:

Home `/`
Page slug route
unknown slug 404
published vs working
Theme on every page
Custom CSS hooks
repeated sections
Contact/CTA links
media hydration
special `/contact` outcome

No screenshot tests required.

---

# 83. API tests

Depending on public API strategy:

- page lookup by slug
- home lookup
- unknown page
- sanitized content
- working preview authorization/guarding
- no working leakage through public endpoint
- slug uniqueness

Renderer remains API-only.

---

# 84. Custom-domain tests

Ensure generic page slugs work under:

tenant platform host
custom business domain

Do not bake tenant ID into canonical public slug.

Audit existing host resolution.

---

# 85. Performance

Estimate:

- page-fetch requests
- payload size
- media hydration cost
- Firestore reads
- publish transaction reads
- media deletion transaction reads

Use realistic local-business-site scale.

Do not optimize for millions of pages.

But avoid an obvious O(N pages × N media) pattern on every public request if easy
to avoid.

---

# 86. Security

Check:

- slug path traversal impossible
- no arbitrary route injection
- no `..`
- no encoded slash if relevant
- tenant isolation
- auth on page mutations
- CSRF
- public only receives published
- Preview only receives authorized working data through existing model
- section HTML safety unchanged

No page URL may become a way to access another tenant.

---

# 87. No new dependencies unless justified

Strong preference:

No new dependency.

Slug generation/validation can be a tiny local helper.

Page manager uses existing Portal primitives.

No drag-and-drop library.

No router library.

---

# 88. Implementation slicing

Determine whether 3.3 should be one slice or multiple.

Likely safer:

3.3a Page data model + backend + public API
3.3b Portal page management + section generalization
3.3c renderer routing / integration

But dependencies may favor:

3.3a foundation
3.3b UX/routing

Recommend a concrete split only if it reduces audit/risk.

Do not split merely for ceremony.

---

# 89. Existing roadmap boundary

Upcoming:

3.4 Header / Navigation / Footer Editor
3.5 SEO / Social Sharing Controls
3.6 Templates / Site Presets
3.7 Published Site Revision History
...

Ensure 3.3 makes 3.4/3.5 easier without implementing them prematurely.

Especially:

- stable page IDs for nav entries
- stable slugs for SEO
- coherent published page collection

---

# 90. Architecture decision matrix

For the central storage question, explicitly compare at least:

Option A:
all working Pages embedded in one config/site document

Option B:
working page-per-document + one coherent published snapshot

Option C:
page-per-document working and page-per-document published with generation pointer

Compare:

- Firestore 1 MiB limit
- write contention
- publish atomicity
- media deletion race safety
- media validation transaction
- page CRUD
- renderer API
- future revision history
- complexity
- local-business realistic scale

Give a decisive recommendation.

This is probably the most important decision in 3.3.

---

# 91. Revision-history compatibility

Step 3.7 will add published revision history/restore.

Do not implement it now.

But evaluate whether the proposed published page model allows a future revision to
represent the entire site coherently.

A revision should eventually be able to restore:

global config
all pages
page ordering
sections

Avoid an architecture that makes coherent restore unnecessarily difficult.

---

# 92. Templates compatibility

Step 3.6 Templates will likely need to instantiate:

global Theme
Pages
section compositions
starter content

Ensure stable Page/Section schema supports that.

No implementation now.

---

# 93. Final recommended 3.3 MVP

Give a decisive scope.

Strong candidate:

- stable page IDs
- Home + non-Home pages
- title + slug
- create/edit/reorder/delete non-Home pages
- generic Page Section Manager
- per-page section compositions
- Home-only Hero
- page-scoped Contact/BusinessHours if appropriate
- `/` + `/:slug`
- working Preview
- site-wide Publish
- media safety across all pages
- no nav editor
- no redirects
- no nested routes
- no page duplication unless very cheap
- no page-level hide unless strongly justified

Adjust based on actual code.

---

# 94. Blockers / operator decisions

Only surface decisions genuinely requiring product input.

Do not ask me to decide implementation details Claude can resolve from the code.

Likely operator-level decisions may include:

- whether current special `/contact` should survive
- whether Page duplication belongs in 3.3
- whether empty pages can publish
- maximum page count if needed

For each, make a recommendation rather than just listing options.

---

# 95. Output

Return:

1. current Git/baseline state
2. current working-page storage diagram
3. current published-site storage diagram
4. current public API shape
5. current renderer routes
6. exact current `/contact` behavior
7. problems with current Home-only architecture
8. recommended Page identity model
9. Home invariant
10. exact Page schema
11. page-order model
12. slug format
13. slug uniqueness mechanism
14. reserved-slug set
15. `/contact` decision
16. Page CRUD commands/contracts
17. Page duplication decision
18. page deletion behavior
19. generic page-section mutation strategy
20. Hero placement rule
21. Contact placement/multiplicity rule
22. BusinessHours placement/multiplicity rule
23. section-ID/nested-ID behavior
24. cross-page move/copy decision
25. working Firestore model
26. published snapshot model
27. Firestore size analysis
28. transaction/concurrency analysis
29. publish atomicity
30. media-deletion race analysis
31. public API strategy
32. Preview API/routing strategy
33. public renderer routing
34. 404 behavior
35. Portal Pages UX
36. Portal editor URL model
37. Page settings UX
38. Add Page defaults
39. empty Page behavior
40. page visibility decision
41. slug-change behavior
42. page-count limits
43. media-scanner refactor
44. exact media functions affected
45. SiteShell changes
46. Theme/Branding/global-data result
47. Custom CSS page hooks
48. Header/Nav/Footer boundary
49. lead-form implications
50. SEO/canonical prerequisite changes
51. data-transition requirements
52. rollout sequence if transition required
53. schema/server test plan
54. media/race test plan
55. Portal test plan
56. renderer/API test plan
57. security analysis
58. performance analysis
59. likely files changed
60. classifier/deployment impact
61. implementation slicing
62. future 3.4/3.5/3.6/3.7 compatibility
63. blockers/operator decisions
64. whether Step 3.3 is ready to implement

Explicitly answer:

Should Page identity be separate from slug?

What should identify Home?

Should Home remain the only page allowed to contain Hero?

Are Contact and Business Hours singletons per SITE or per PAGE after Multi-Page?

Should the existing special `/contact` renderer route survive 3.3?

Should page duplication be included now?

Should page-level visibility be included now?

Should cross-page section move/copy be included now?

Should working Pages be embedded or separate Firestore documents?

Should published Pages be embedded in one coherent snapshot or stored separately?

Can the proposed media-deletion transaction remain race-safe across multiple
Pages?

Can Publish remain atomic/coherent across all Pages?

Will page slug changes affect the live site before Publish?

Will title changes automatically change an established slug?

Will old slugs redirect?

Should 3.3 create an automatic public navigation?

Does 3.3 require any new Theme fields?

Does 3.3 require any third-party dependency?

Does 3.3 require a data transition?

Can 3.4 Header/Nav/Footer cleanly consume the proposed Page model?