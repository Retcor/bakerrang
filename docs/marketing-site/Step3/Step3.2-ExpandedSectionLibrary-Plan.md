# Step 3.2 — Expanded Section Library

Implement Step 3.2 as ONE cohesive implementation slice.

Step 3 remains intentionally on the existing `Step3` branch / PR.

Current approved branch state from planning:

HEAD:
d2c9165

Branch:
Step3

Commit:
"Phase 3: add instance-based site editor and theme presets"

Current baseline:

Server:
331 passed / 0 failed / 0 skipped

Portal:
93 passed / 0 failed / 0 skipped

Renderer:
61 passed / 0 failed / 0 skipped

UI:
9 passed

Typecheck:
clean

Lint:
clean

The only pre-3.2 working-tree change should be the Step 3.2 planning/spec
documentation.

Verify the current tree before implementation.

Do NOT reset, rewrite, or discard existing Step 3 work.

Do NOT deploy.
Do NOT mutate Firestore/GCP.
Do NOT modify infrastructure.
Do NOT perform a data migration.

---

# 1. Step 3.2 scope

Add FOUR new repeatable section types:

1. process
   UI label: Steps

2. stats
   UI label: Highlights

3. cta
   UI label: Call to Action

4. logos
   UI label: Logos

Also enhance the existing repeatable:

about

with:

- image position
- optional link button

Do NOT add:

- Before & After
- Team
- Service Area
- pricing
- video/embed
- maps
- rich text
- arbitrary HTML
- new forms
- third-party integrations

Before & After is intentionally deferred.

---

# 2. Preserve the section architecture

Canonical envelope remains:

{
id: string,
type: SectionType,
hidden: boolean,
content: SectionContent
}

Do not change:

- UUID section identity
- working/published model
- generic instance mutation routes
- Hero invariants
- existing singleton set
- media transaction architecture
- Theme architecture
- renderer Firestore boundary

Singleton remains EXACTLY:

hero
contact
businessHours

All four new types are repeatable and duplicable.

About remains repeatable and duplicable.

---

# 3. Shared safe LinkAction

Extract/refactor the existing contact action model narrowly.

Create/use:

type LinkAction =
| { type: 'email'; value: string }
| { type: 'phone'; value: string }
| { type: 'url'; value: string }

ContactAction becomes conceptually:

type ContactAction =
| LinkAction
| { type: 'leadForm' }

Runtime Contact behavior must remain unchanged.

Extract server validation such that:

validateLinkAction

owns:

email
phone
url

and:

validateContactAction

adds:

leadForm

Do NOT create a second URL/email/phone representation.

Reuse the existing `contactHref` rendering utility.

CTA and About MUST NOT accept:

leadForm

Lead capture remains exclusive to Contact.

---

# 4. Steps / process schema

Add:

interface ProcessStep {
id: string
title: string
description?: string
}

interface ProcessContent {
heading?: string
intro?: string
items: ProcessStep[]
}

interface ProcessSection {
id: string
type: 'process'
hidden: boolean
content: ProcessContent
}

Validation:

heading:
optional, max 120

intro:
optional, max 300

items:
1..8

item.title:
required, 1..80

item.description:
optional, max 300

Nested item IDs:

- stable
- non-index
- unique
- existing update semantics
- duplicated section re-mints them

No stored step number.

Renderer derives numbering from array order.

Server default:

{
heading: 'How it works',
items: [
{
id: <server UUID>,
title: 'Add your first step'
}
]
}

Do not fabricate business claims.

---

# 5. Highlights / stats schema

Add:

interface StatItem {
id: string
value: string
label: string
}

interface StatsContent {
heading?: string
intro?: string
items: StatItem[]
}

interface StatsSection {
id: string
type: 'stats'
hidden: boolean
content: StatsContent
}

`value` is DISPLAY TEXT, not a numeric field.

Valid examples:

25+
24/7
1,200+
Same Day

No number parsing.
No animation.

Validation:

heading:
optional, max 120

intro:
optional, max 300

items:
1..8

value:
required, 1..16

label:
required, 1..60

Default:

{
heading: 'Highlights',
items: [
{
id: <server UUID>,
value: '—',
label: 'Add a highlight'
}
]
}

The em dash is intentionally a placeholder rather than a fabricated metric.

---

# 6. Call to Action schema — IMPORTANT CORRECTION

Do NOT use `https://example.com` as a canonical default.

Use:

interface CtaContent {
heading: string
body?: string
buttonLabel?: string
action?: LinkAction
}

interface CtaSection {
id: string
type: 'cta'
hidden: boolean
content: CtaContent
}

Validation:

heading:
required, 1..120

body:
optional, max 300

buttonLabel/action:
BOTH PRESENT or BOTH ABSENT

When present:

buttonLabel:
1..60

action:
validateLinkAction

Reject:

buttonLabel without action
action without buttonLabel
leadForm action

Server default:

{
heading: 'Ready to get started?'
}

This is intentionally valid WITHOUT a button.

Do not invent an external URL merely to satisfy defaults.

Renderer:

- always renders heading/body
- renders button only when buttonLabel + action are both present
- uses contactHref(action)
- email/phone behave normally
- external http/https URLs use the same safe target/rel conventions as existing
  Contact links

---

# 7. Logos schema

Add:

interface LogoItem {
id: string
mediaId: string
altText: string

// read-time hydration only
src?: string
width?: number
height?: number
}

interface LogosContent {
heading?: string
items: LogoItem[]
}

interface LogosSection {
id: string
type: 'logos'
hidden: boolean
content: LogosContent
}

Validation:

heading:
optional, max 120

items:
0..24

mediaId:
required

altText:
required, 1..250

item ids:
unique

media refs:
validate using existing tenant-media behavior

If current Gallery permits repeated references to the same media item, do not
invent a stricter logos-only media uniqueness rule without justification.

If Gallery currently rejects duplicate media IDs, mirror it.

Default:

{
heading: 'Trusted by',
items: []
}

No fabricated logos.

No external image URLs.

Media Library only.

---

# 8. About enhancement — IMPORTANT CORRECTION

Existing About already serves the Image & Text use case.

Do NOT add a new `contentSplit` / `imageText` section.

Extend About with:

imagePosition?: 'left' | 'right'
buttonLabel?: string
action?: LinkAction

Existing fields remain:

eyebrow?
heading
body
imageMediaId?
imageAlt?

read-time image hydration fields remain unchanged.

Validation:

imagePosition:
optional, left|right

buttonLabel/action:
BOTH PRESENT or BOTH ABSENT

buttonLabel:
1..60 when present

action:
validateLinkAction

No leadForm.

No default CTA/button.

No default schema change required for existing About documents.

IMPORTANT:

Inspect the CURRENT About renderer layout.

When `imagePosition` is ABSENT, rendering must preserve the existing About visual
layout exactly.

Choose the default interpretation of the absent field based on actual existing
markup.

Do not cause existing About sections to flip sides merely because Step 3.2
deployed.

Portal may show that existing orientation as the selected default.

---

# 9. About mobile behavior

Keep layout opinionated.

Desktop:
imagePosition determines image left/right.

Mobile:
use one consistent readable stacked order.

Do not expose:

column percentages
arbitrary widths
breakpoints

Use existing static responsive classes.

Explain final mobile order in implementation report.

---

# 10. Shared Portal action fields

Extract a small reusable Portal component from the existing Contact action UI.

Example responsibility:

SectionActionFields

It should support:

- email
- phone
- URL
- optionally leadForm when caller explicitly allows it

Use it for:

Contact
CTA
About

Button-label input may remain owned by each editor if cleaner.

Do not create a form framework.

Preserve Contact behavior.

---

# 11. Do NOT extract NestedRowsEditor

Explicit decision:

DEFER the optional generic NestedRowsEditor abstraction.

Process/Stats/Logos may follow existing editor row patterns.

Do not refactor Services/Gallery/Testimonials/FAQ just to reduce duplication in
this step.

Keep Step 3.2 focused.

---

# 12. Server defaults registry

Add the four new types to the existing centralized default path.

Server remains responsible for canonical defaults and section IDs.

Portal does NOT construct default section content.

Extend the existing switch/registry cleanly.

Do not perform a broad defaults-system rewrite unless the current code genuinely
cannot handle four more cases.

---

# 13. Centralized server validation

Add per-content validators through the existing `contentValidators` architecture.

Do NOT add route-local validation.

Extend all relevant nested-item ID handling for:

process
stats
logos

CTA has no nested items.

About's existing media/item behavior remains unchanged.

Unknown-field behavior should remain consistent with existing sections.

---

# 14. Nested IDs

Follow the current established behavior.

For Process/Stats/Logos:

- default items receive server UUIDs
- updates resolve/reconcile IDs using existing `resolveItemIds`
- unknown client-supplied nested IDs rejected according to existing convention
- new nested rows may receive IDs through the existing trusted mechanism
- duplication re-mints nested IDs
- renderer React keys use item.id

Do not use array indices as identity.

---

# 15. Media safety — LOAD-BEARING

Logos introduces:

content.items[].mediaId

Add this path to EVERY relevant media-reference seam.

At minimum audit and update:

siteService:
- sectionMediaIds

mediaService:
- collectSiteMediaIds
- collectMediaLocations
- hydrateSiteMedia

Also inspect every other media helper rather than assuming those four are the
only relevant locations.

Mirror Gallery semantics wherever appropriate.

Requirements:

- every Logos instance scanned
- repeated Logos sections scanned
- hidden Logos sections scanned
- working refs protected
- published refs protected
- hydrated read response gets src/width/height
- stored content remains media IDs, not provider URLs
- section duplication preserves media IDs
- nested item IDs are re-minted

NO media reference may be skipped.

---

# 16. Media deletion transaction safety

Do not alter the established transactional architecture.

Logos content changes must still flow through:

mutateWorkingHome

and relevant:

requireTenantMediaInTransaction

behavior.

Media deletion must be blocked while a logo is referenced by:

- visible working section
- hidden working section
- published site
- either of multiple Logos sections
- a duplicated Logos section

Removal of one reference must not allow deletion while another reference remains.

Add a focused deletion-gap/race test for Logos.

Do not duplicate the entire race suite unnecessarily.

---

# 17. Portal Section Manager integration

Extend the existing `sectionDefinitions` registry.

Add:

process
label: Steps
singleton: false
duplicable: true

stats
label: Highlights
singleton: false
duplicable: true

cta
label: Call to Action
singleton: false
duplicable: true

logos
label: Logos
singleton: false
duplicable: true

All use exact-instance editing.

No manager command should need architectural changes.

No type-as-identity.

---

# 18. Manager summaries

Implement:

Process:
"<n> step" / "<n> steps"
fallback "Steps"

Stats:
"<n> highlight" / "<n> highlights"
fallback "Highlights"

CTA:
truncated heading
fallback "Call to action"

Logos:
"No logos yet"
or
"<n> logo" / "<n> logos"

About:
existing heading summary

Cheap, client-side, no backend request.

---

# 19. Add Section grouping

Implement lightweight Add-dialog grouping.

No search.

No marketplace.

Add a UI-only group/category metadata field to sectionDefinitions.

Recommended grouping:

Core
- Hero

Content
- About
- Steps
- Services

Media
- Gallery
- Logos

Trust
- Testimonials
- Highlights
- FAQ

Conversion
- Contact
- Call to Action

Business
- Business Hours

Hero may remain displayed disabled according to the existing singleton UX.

Do NOT add a special Header architecture.

If a slightly different grouping fits the current dialog implementation more
naturally, keep it simple and report it.

Group metadata is Portal UX only.

Backend does not know about groups.

---

# 20. Process editor

Create ProcessEditor.

Fields:

heading
intro

Nested rows:

title
description

Actions:

Add step
Move up
Move down
Delete

Numbering derives from row order and is not editable.

Use explicit `sectionId`.

Save through existing content-update API.

Dirty state through existing WebsiteEditorShell behavior.

---

# 21. Stats editor

Create StatsEditor.

Fields:

heading
intro

Nested rows:

value
label

Actions:

Add highlight
Move
Delete

`value` remains plain display text.

Use explicit sectionId.

No numeric controls.

---

# 22. CTA editor

Create CtaEditor.

Fields:

heading
body
button label
action type
action value

Allow a valid local editing state where no button/action has yet been configured.

UI should make buttonLabel/action pairing clear.

Action options:

Email
Phone
URL

NO Lead Form.

Use shared SectionActionFields where appropriate.

Save exact sectionId.

---

# 23. Logos editor

Create LogosEditor.

Fields:

heading

Nested media rows using the existing Gallery/Media Library workflow.

Each row:

media
alt text

Support:

choose existing media
upload through existing media system if Gallery supports it
replace
remove row
move
delete

Do NOT add another uploader/media selector.

Alt text is required before a configured logo item can save.

Use exact sectionId.

---

# 24. About editor

Enhance AboutEditor with:

Image position:
Left
Right

Optional button:

buttonLabel
action type
action value

Only display image-position control when appropriate if that makes the UX cleaner.

CTA/button is optional.

No leadForm.

Preserve existing exact-sectionId editing.

---

# 25. Renderer — Steps

Add a themed SSR/static component.

Use SiteSection.

Semantic structure:

heading
intro
<ol>
  <li>...</li>
</ol>

Numbers derived from order.

No animation.
No client JS.

Use existing Theme classes/tokens only.

Responsive columns/stacking may use static CSS.

---

# 26. Renderer — Highlights

Use semantic markup such as:

<dl>

with correctly associated value/label elements.

Do not convey metrics purely through pseudo-elements.

No animation/count-up JS.

Use Theme tokens only.

---

# 27. Renderer — Call to Action

Use SiteSection.

Render:

heading
body
optional real <a>

Button only exists when valid buttonLabel + action exist.

Reuse:

contactHref

Do not duplicate URL construction.

Follow existing safe external-link behavior.

No lead form.

---

# 28. Renderer — Logos

Use SiteSection.

Responsive CSS-only logo grid.

Use hydrated media metadata.

Each image uses required:

altText

No carousel.

No JS.

No external image URLs.

Use Theme:

surface
border
radius
spacing

without introducing new Theme properties.

Zero items may render null/empty according to existing Gallery-like convention.

---

# 29. Renderer — About enhancement

Support left/right desktop placement.

Preserve legacy visual orientation when imagePosition is omitted.

Render optional button via:

contactHref(action)

Use existing Theme button treatment.

No new Theme fields.

No client JS.

---

# 30. Custom CSS hooks

All new sections get automatically:

data-br-section="process"
data-br-section="stats"
data-br-section="cta"
data-br-section="logos"

and:

data-br-section-id="<uuid>"

through SiteSection.

Add `data-br-role` only for meaningful stable targets.

Reasonable examples:

cta-button
logo

Do not annotate every wrapper div.

If new supported roles are added, update:

docs/marketing-site/Step3/Step3.1-AdvancedStyling.md

accurately.

Preserve the previously-corrected inline Theme-variable cascade guidance.

---

# 31. No new Theme controls

Do NOT modify the SiteTheme schema.

No section requires:

new color
new radius
new spacing
layout Theme field
button style
surface style

All four new components + enhanced About inherit existing Theme semantics.

---

# 32. No rich text

All text remains plain text.

No:

Markdown
HTML
rich-text editor
HTML sanitizer expansion

Textarea semantics are enough for Step 3.2.

---

# 33. No data transition

Existing sites require no transition.

New section types are simply absent.

About additions are optional.

Existing About content must remain valid.

Do NOT add migration compatibility machinery.

Do NOT mutate any current site data during implementation.

---

# 34. Accessibility

Verify:

Process:
- ordered list semantics

Stats:
- programmatic value/label association

CTA:
- real anchor
- discernible buttonLabel
- keyboard/focus treatment inherited correctly

Logos:
- meaningful required alt

About:
- existing image alt behavior preserved
- button is real anchor

Repeated section headings should not create invalid DOM IDs.

Do not rely on color alone.

---

# 35. Security

Validate actions through the existing safe model.

Reject:

javascript:
data:
arbitrary schemes

No external media URL fields.

No iframe/embed.

No arbitrary HTML.

No arbitrary CSS fields.

Media remains tenant Media Library IDs.

---

# 36. Duplication

Generic duplicate behavior must work for all four types.

Verify:

Process:
new section ID + new step IDs

Stats:
new section ID + new highlight IDs

CTA:
new section ID

Logos:
new section ID + new logo-item IDs,
same media references

About:
existing generic duplication continues working

Add/Duplicate continue returning the exact new sectionId.

No set-diff inference.

---

# 37. Server tests

Add type-specific tests without duplicating generic architecture coverage.

At minimum:

Process:
- default valid
- content validation
- limits
- nested IDs

Stats:
- default valid
- arbitrary display values
- limits
- nested IDs

CTA:
- default valid with no action
- paired buttonLabel/action
- rejects half-configured button
- email/phone/url valid
- rejects leadForm
- rejects unsafe URL

Logos:
- empty default valid
- media validation
- alt required
- nested IDs
- hydration/reference semantics

About:
- imagePosition validation
- buttonLabel/action pair
- existing missing fields remain valid
- default/absent imagePosition preserves compatibility

Also verify all four remain repeatable.

---

# 38. Media tests

Logos MUST have direct coverage for:

- collected media reference
- hydrated src/width/height
- hidden section protects media
- repeated Logos sections scanned
- duplicate preserves media refs
- duplicate re-mints nested item IDs
- deleting one Logos section does not free media still referenced elsewhere
- published ref protects media
- deletion-gap race with Logos content update/reference

Use the existing race-test architecture.

Do not weaken existing Gallery/media tests.

---

# 39. Portal tests

Test:

Add dialog:
- new types visible
- grouping
- labels/descriptions
- repeatable types remain addable

ProcessEditor:
- exact ID
- seed
- add/remove/reorder steps
- save exact ID

StatsEditor:
- exact ID
- rows
- save exact ID

CtaEditor:
- exact ID
- optional button
- action validation UX
- no leadForm
- save

LogosEditor:
- exact ID
- Media Library flow
- alt
- rows
- save

AboutEditor:
- imagePosition
- optional button/action
- existing section behavior

Manager:
- summaries
- repeated instances remain independent
- Add/Duplicate still open server-returned exact ID

Do not retest every generic manager command once per new type.

---

# 40. Renderer tests

For each new section:

- correct dispatch
- repeated instances render
- semantic markup
- Theme classes/tokens
- Custom CSS section hooks

Specifically:

Process:
<ol> semantics

Stats:
<dl> semantics

CTA:
optional link behavior
safe href

Logos:
hydrated media
alt text
empty behavior

About:
left/right desktop behavior
missing imagePosition preserves previous/default layout
optional CTA

Generic hidden behavior need not be duplicated four times if already centrally
covered.

---

# 41. Avoid unrelated refactors

Do NOT:

- generalize the whole validator architecture
- generalize all media scanners
- build NestedRowsEditor
- refactor all existing editors
- change section-manager architecture
- change publish model
- change Theme
- change media storage model

The narrow SectionActionFields / LinkAction extraction is approved because the
new functionality directly needs it.

---

# 42. Full validation

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
- secret/credential scan

No deployment.
No Firestore/GCP mutation.

Expected classifier:

api=true
portal=true
renderer=true
client=false
unknown=[]

Do not modify classifier rules to obtain this result.

---

# 43. Final report

Return:

1. current baseline observed
2. files created
3. files modified/deleted
4. four new section types
5. final exact schemas
6. enhanced About schema
7. LinkAction extraction
8. CTA safe-default implementation
9. server defaults
10. validation rules
11. Add-dialog grouping
12. sectionDefinitions metadata
13. manager summaries
14. Process editor/result
15. Stats editor/result
16. CTA editor/result
17. Logos editor/result
18. About enhancement/result
19. renderer components
20. accessibility semantics
21. Theme integration
22. custom CSS hooks added
23. media-reference changes
24. media deletion-safety result
25. duplication behavior
26. data-transition result
27. dependencies added
28. server tests/results
29. Portal tests/results
30. Renderer/UI tests/results
31. media/race tests
32. skipped counts
33. typecheck/lint
34. classifier/workflow result
35. git diff --check
36. secret scan
37. confirmation no deploy/cloud/data mutation
38. blockers
39. whether Step 3.2 is ready for post-implementation audit

Explicitly answer:

Were exactly four new section types added?
Expected: YES.

Was About enhanced instead of adding Image & Text?
Expected: YES.

Can existing About sections still render identically when `imagePosition` is
absent?
Expected: YES.

Can About render a button with an operator-supplied label?
Expected: YES.

Does CTA default contain a fake external URL?
Expected: NO.

Can CTA exist validly without a configured button?
Expected: YES.

Does CTA permit leadForm?
Expected: NO.

Does CTA reuse the existing safe action/href semantics?
Expected: YES.

Is Logos the only NEW media-reference shape?
Expected: YES.

Do hidden Logos sections protect media?
Expected: YES and TESTED.

Do repeated Logos sections protect all media?
Expected: YES and TESTED.

Does duplicated Logos preserve media refs while re-minting item IDs?
Expected: YES and TESTED.

Did any new Theme fields get added?
Expected: NO.

Was Before & After added?
Expected: NO.

Was NestedRowsEditor added?
Expected: NO.

Was any third-party dependency added?
Expected: NO.

Does any new public section require client-side runtime JS?
Expected: NO.

Is a data transition required?
Expected: NO.

Was the existing Section Manager architecture rewritten?
Expected: NO.