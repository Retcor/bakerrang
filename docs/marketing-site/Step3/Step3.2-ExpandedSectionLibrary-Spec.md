# Step 3.2 Planning — Expanded Section Library

Planning/read-only only.

Do NOT modify files.
Do NOT deploy.
Do NOT mutate Firestore.
Do NOT mutate GCP.
Do NOT modify Git state.
Do NOT create commits.

Step 3 is currently being kept in one branch / PR.

Completed within Step 3:

3.0 Site Editor V2 / Section Architecture
3.1 Theme & Global Styling Controls

Step 3.2 now expands the actual library of content sections that operators can add
to marketing sites.

This should build directly on the architecture established in 3.0 and 3.1.

Do NOT redesign section identity, publishing, Theme, or media architecture unless
you discover a genuine defect.

---

# Current authoritative section architecture

Canonical section envelope:

{
id: string,
type: SectionType,
hidden: boolean,
content: SectionContent
}

Section IDs:

- opaque
- server-generated UUIDs
- stable
- never inferred from section type

Existing singleton types:

- hero
- contact
- businessHours

Existing repeatable types:

- about
- services
- gallery
- testimonials
- faq

Hero:

- required
- index 0
- visible
- cannot move
- cannot remove
- cannot duplicate
- cannot hide

All Section Manager commands target exact sectionId.

Working / published:

- Portal edits WORKING
- Preview reads WORKING
- public renderer reads PUBLISHED
- Publish snapshots working state

Media:

- section content stores provider-neutral media IDs
- URLs/dimensions are hydrated at read time
- hidden sections still protect referenced media
- section duplication preserves media references but re-mints nested item IDs
- media deletion safety depends on all section media references being scanned

Theme:

- all public sections inherit global semantic Theme tokens
- public components consume existing `--site-*` variables
- do not introduce section-specific Theme models in 3.2

Custom CSS stable hooks:

[data-br-section="<type>"]
[data-br-section-id="<section-id>"]

---

# Step 3.2 product goal

Expand the section library so operators can build substantially richer local
business websites using BakerRang without Custom CSS or developer involvement.

The new sections should:

- solve common real marketing-site needs
- work across many business types
- inherit Theme automatically
- fit the existing Section Manager
- be repeatable where useful
- support exact-instance editing
- remain simple enough for nontechnical operators
- have clear content models
- remain responsive and accessible
- avoid specialized third-party integrations for now

We do NOT need dozens of sections.

Prefer approximately 4–6 strong additions over a large catalog of mediocre or
overlapping section types.

---

# 1. Audit the current section library

Inspect the actual current implementation after Steps 3.0 and 3.1.

For every existing section:

- content schema
- defaults
- server validation
- Portal editor
- renderer component
- summary behavior
- media references
- hydration
- duplication behavior
- Theme usage
- accessibility characteristics

Existing:

Hero
About
Services
Gallery
Testimonials
FAQ
Business Hours
Contact

Identify the important content/layout gaps in the existing library.

Do not recommend a new section merely because page builders commonly have one.

Think specifically about reusable LOCAL-BUSINESS marketing sites.

---

# 2. Recommend the initial expanded section set

Recommend the exact Step 3.2 batch.

Strong candidates to evaluate include:

## Image + Text / Feature section

A versatile split-content block:

- heading
- body
- image
- image position left/right
- optional CTA

Useful for:

- company story
- featured service
- craftsmanship
- facility
- differentiators

This may be more valuable than adding many niche types.

---

## Process / Steps

Example:

How It Works

1. Request a quote
2. We measure
3. We install

Potential fields:

heading
intro
steps[]

Each step:
id
title
description

Possibly optional icon later, but avoid an icon-system dependency unless already
available.

---

## Stats / Highlights

Example:

25+
Years Experience

1,200+
Projects Completed

Potential:

heading
intro
items[]

Each:
id
value
label

Do not attempt dynamic counters/animation unless trivial and accessible.

---

## CTA / Callout Banner

A simple conversion-oriented section:

heading
body
button label
action

Potential actions should reuse existing safe contactHref/action semantics where
possible.

Useful anywhere in a page, unlike Hero.

Determine whether this overlaps too much with Contact.

---

## Logo Cloud / Trusted By

Potential:

heading
logos[]

Each:
id
mediaId
alt text / label

Useful for:

- manufacturers
- certifications
- partners
- customers
- associations

Media-safe and broadly reusable.

---

## Before / After

Potential:

heading
intro
pairs[]

Each:
id
beforeMediaId
afterMediaId
caption?

Highly useful for contractors, installers, cleaners, remodelers, landscapers,
detailers, etc.

But it creates more complex media behavior.

Evaluate whether its value justifies Step 3.2 inclusion.

---

## Team / People

Potential:

heading
intro
members[]

Each:
id
name
role
bio?
photoMediaId?

Useful but less universal.

Evaluate whether this belongs now or in a later section-library expansion.

---

## Service Area

Potential:

heading
intro
areas[]

Could list:

cities
counties
zip/service regions

Do NOT add Google Maps integration in this step.

Evaluate whether this adds enough value beyond a generic text/list section.

---

# 3. Sections that should probably NOT be in 3.2

Explicitly evaluate and likely defer:

- pricing tables
- ecommerce/product grids
- calendars
- appointment scheduling
- maps requiring external APIs
- social-feed embeds
- arbitrary embeds
- YouTube/video embeds
- forms beyond the existing Contact/lead system
- raw HTML
- rich arbitrary HTML editor
- blog/news feed
- dynamic database-driven lists
- carousels requiring complex JS
- animations
- custom code blocks

These may come later if product needs justify them.

Do not let 3.2 become an integrations project.

---

# 4. Avoid overlapping section types

One important design question:

Should BakerRang have several narrowly-specific content sections:

About
Feature
Story
Why Us
Service Area

or a smaller number of flexible primitives?

Prefer reusable but opinionated sections.

For example:

`contentSplit`

could cover many cases without needing:

story
feature
imageText
aboutWithImage
whyUs

But do NOT make content models so generic that Portal labels become meaningless.

Recommend the right balance.

---

# 5. Exact proposed section names/types

For every recommended addition provide:

- internal `SectionType`
- operator-facing label
- short Add-dialog description
- repeatable vs singleton
- primary use case

Example conceptual table:

| Type | Label | Repeatable | Purpose |
|---|---|---:|---|
| contentSplit | Image & Text | yes | Flexible image/text storytelling |
| process | Process | yes | Numbered steps |
| stats | Highlights | yes | Metrics/trust signals |
| cta | Call to Action | yes | Conversion banner |

Use names that will age well.

Avoid names tied to one industry.

---

# 6. Content schema for every proposed section

Design the precise TypeScript/schema shape.

Follow existing conventions.

Every nested repeatable item should have an opaque item ID where appropriate.

Example:

{
id: string,
type: 'process',
hidden: boolean,
content: {
heading?: string,
intro?: string,
items: [
{
id: string,
title: string,
description?: string
}
]
}
}

Determine:

- required fields
- optional fields
- max lengths
- max item counts if justified
- empty-state validity
- nested item identity

Do NOT use arbitrary rich HTML unless there is already a safe rich-text model.

Prefer plain text / existing textarea semantics.

---

# 7. Default content

For every new section type define server-owned defaults.

The Portal must NOT construct canonical section defaults.

Defaults should make the new editor immediately understandable but should not
publish fake business claims.

Good:

heading: "How it works"

Bad:

"Serving customers for over 25 years"

Do not fabricate testimonials, stats, customer logos, etc.

Determine which sections may validly start with zero items.

---

# 8. Multiplicity

Strong default:

new 3.2 sections should be repeatable unless there is a clear domain reason to
make them singleton.

Do not expand the singleton list unnecessarily.

Explain the multiplicity decision for each new type.

Backend must remain authoritative.

Portal registry metadata only controls UX affordances.

---

# 9. Section Manager integration

The new section types must appear naturally in the existing Homepage Section
Manager.

Audit the current:

sectionDefinitions

registry.

For every new section include:

- label
- description
- editor
- summary
- singleton UX hint
- duplicable
- Add availability

No custom one-off manager logic per new section unless genuinely required.

A new type should ideally require:

schema
default
validator
editor
renderer
registry metadata
media hooks if relevant
tests

not manager architecture changes.

---

# 10. Add-dialog organization

With 8 existing section types + new additions, the Add Section dialog may start
becoming crowded.

Audit the current Add dialog.

Determine whether 3.2 should introduce lightweight grouping such as:

Content
About
Image & Text
Services
Process

Media
Gallery
Before & After
Logos

Trust
Testimonials
Highlights
FAQ

Conversion
Contact
Call to Action

Business
Business Hours

This is conceptual.

Do NOT introduce a complicated searchable marketplace unless needed.

Recommend whether:

A. flat list is still fine
B. simple groups help
C. search is already warranted

Prefer the simplest usable design.

---

# 11. Renderer architecture

For every new type determine:

- renderer component
- use of existing `SiteSection` primitive
- Theme token usage
- responsive behavior
- section DOM hooks
- semantic HTML

New components should inherit existing global Theme automatically.

Do NOT add new Theme settings merely for these sections.

Avoid dynamic Tailwind class generation from stored content.

---

# 12. Image + Text layout

If recommended, design this carefully.

Potential content:

heading
body
mediaId?
mediaAlt?
imagePosition: 'left' | 'right'
action?

Questions:

- should image be optional?
- should image position be stored content/config?
- should CTA reuse ContactHref/action model?
- how should mobile stacking behave?
- should image always stack before text on mobile or follow semantic ordering?

Avoid arbitrary percentages/column widths.

Keep layout opinionated.

---

# 13. CTA action model

If adding CTA or CTA fields to Image & Text:

Reuse existing safe action semantics where possible.

Audit existing:

contact action
hero CTA
contactHref utility
server validation

Do not create a second incompatible URL/phone/email action representation.

Recommend whether a shared safe Action schema should now be extracted.

If extracting it is beneficial, keep the change narrow.

Do NOT refactor unrelated code merely for elegance.

---

# 14. Process / Steps

If recommended:

Determine:

- min/max step count
- nested item IDs
- numbering generated by renderer vs stored
- heading/intro
- item title/description
- add/remove/reorder UX inside editor

Strong preference:

step number should derive from array order.

Do not persist "1", "2", "3".

Use existing nested-list editor patterns where possible.

---

# 15. Stats / Highlights

If recommended:

Potential item:

{
id,
value,
label
}

Questions:

- allow arbitrary value text such as "25+", "24/7", "1,200"?
- prohibit HTML?
- max length?
- optional description?
- numeric semantics unnecessary?

Prefer display strings over attempting a numeric model.

No animated counting.

Keep it accessible and server-rendered.

---

# 16. Logo Cloud

If recommended:

Potential item:

{
id,
mediaId,
alt
}

Audit whether media metadata already includes usable alt/title semantics.

Decide whether operator-supplied label/alt is required.

Important accessibility issue:

Logo images need meaningful alt text when they convey identity.

If decorative, empty alt may be acceptable, but Portal UX should make this
intentional.

No external logo URLs.

Media Library only.

---

# 17. Before / After

If recommended, pay particular attention to media safety.

Potential pair:

{
id,
beforeMediaId,
afterMediaId,
caption?
}

Questions:

- require both images before item is valid?
- allow incomplete pair while editing?
- side-by-side vs stacked rendering
- mobile behavior
- alt text strategy
- does the current media picker support selecting two refs cleanly?

Do NOT implement a draggable before/after slider unless there is compelling value.

A static responsive pair is sufficient.

---

# 18. Media reference scanning — LOAD-BEARING

Any new media-bearing section MUST be added to ALL relevant media logic.

Audit:

collectSiteMediaIds
collectMediaLocations
hydrateSiteMedia
requireTenantMediaInTransaction
duplication/reference behavior
media deletion race tests

For each proposed section identify every media path.

Examples:

contentSplit:
content.mediaId

logoCloud:
content.items[].mediaId

beforeAfter:
content.items[].beforeMediaId
content.items[].afterMediaId

Hidden sections must continue protecting media.

Repeated same-type sections must all be scanned.

Duplicate must preserve media IDs while re-minting nested item IDs.

No media-reference path may be missed.

This is one of the most important parts of 3.2.

---

# 19. Media editor UX

Audit current Media Library selector/upload flow used by:

Hero
Gallery
About/etc.

Recommend reuse.

Do not introduce a second media-upload subsystem.

For multi-image nested editors:

- choose existing media
- upload if current editor already supports it
- remove reference
- replace reference

should follow current patterns.

---

# 20. Nested item IDs

Existing Services/Gallery/etc. already have nested items.

Audit existing nested ID behavior.

For every new nested array:

- server owns default IDs if creating defaults
- Portal may create new nested-item IDs only if that is ALREADY the established
  safe convention for content editing
- duplication must re-mint nested IDs
- IDs must not be array indices
- renderer React keys should use item IDs

Determine and document the current convention.

Do not accidentally change unrelated existing behavior.

---

# 21. Duplication

All recommended repeatable new section types should likely be duplicable.

Verify duplication:

- section receives new UUID
- nested items receive new IDs
- media references are preserved
- content order preserved
- returned exact section ID still works through the existing manager flow

No new duplication endpoint.

---

# 22. Section summaries

Design the Section Manager summary function for each new type.

Examples:

Image & Text:
heading, truncated
fallback "Image & text"

Process:
"4 steps"

Highlights:
"3 highlights"

Call to Action:
heading, truncated

Logos:
"6 logos"

Before & After:
"3 comparisons"

Summaries:

- client-side
- cheap
- no extra request
- useful with duplicate instances
- gracefully handle defaults

Provide exact summary rules.

---

# 23. Portal editor UX

For every proposed section design the editor.

Reuse existing:

WebsiteEditorShell
Field
Input
Textarea
Select
media selectors
nested row controls

Avoid custom editing frameworks.

For each editor specify:

- fields
- nested-item controls
- validation/error display
- media selection
- local dirty behavior
- Save behavior
- exact `sectionId` targeting

No editor may find its target by type.

---

# 24. Rich text question

Evaluate whether any new section needs formatted text.

Strong preference for Step 3.2:

NO general rich-text editor.

Existing textareas may be sufficient.

If formatted paragraphs/lists are genuinely necessary, explain exactly why and
whether a safe Markdown/subset model is preferable.

Do not introduce arbitrary HTML storage.

This can become its own future capability if needed.

---

# 25. Accessibility

For every proposed renderer component specify:

- semantic heading structure
- list semantics
- alt text
- link/button semantics
- keyboard behavior
- color independence
- responsive reading order

Examples:

Process:
`ol` may be semantically appropriate.

Stats:
`dl` may be appropriate.

Logo Cloud:
meaningful alt.

Before/After:
labels must distinguish Before and After.

Do not use visual layout alone to convey meaning.

---

# 26. SEO / content semantics

Do not implement Step 3.5 SEO controls.

But use sensible HTML:

section headings
lists
figures/captions
links

Avoid rendering important content only through CSS pseudo-elements.

No structured-data/JSON-LD expansion in this step unless already trivial and
existing.

---

# 27. Theme inheritance

Audit every new component against current Theme tokens.

Use existing:

background
surface
text
muted
border
primary/accent
radius
content width
section spacing
heading/body fonts

Do NOT request new Theme fields to make new sections look good.

If a section cannot look good under the existing Theme system, explain whether
that reveals a genuine Theme gap or poor section design.

---

# 28. Custom CSS hooks

Every new section automatically needs:

data-br-section="<newType>"
data-br-section-id="<uuid>"

via the existing SiteSection primitive.

Verify no custom DOM ID scheme is introduced.

Determine whether any useful internal:

data-br-role

hooks should be added.

Use them sparingly for meaningful stable sub-elements, not every div.

If added, document them appropriately.

---

# 29. Server validation

Extend the centralized section validation cleanly.

For each content type define:

- string limits
- array validation
- enum validation
- item-id validation
- media-id validation
- safe CTA/action validation

Do not accept unknown arbitrary fields if current conventions reject them.

Avoid separate per-route validation implementations.

---

# 30. Defaults registry

Audit current:

sectionDefaults.js

or equivalent.

New types should integrate into the existing centralized default creation path.

No `if` jungle spread across routes.

Determine whether the current architecture handles 4–6 additional types cleanly
or whether a small type→factory registry refactor is justified.

Do not refactor solely for style if the current switch is manageable.

---

# 31. Shared schema design

Update:

SectionType
SiteSection union
content interfaces
type guards if necessary

Evaluate whether every new type needs a dedicated type guard.

Avoid bringing back type-as-identity.

Type guards are for dispatch/narrowing only.

---

# 32. Existing section cleanup opportunities

While auditing, note obvious architectural inconsistencies that make adding new
types unnecessarily hard.

Examples:

- duplicated editor patterns
- duplicated nested-list controls
- duplicated CTA validation
- duplicated media lookup

Do NOT automatically include refactors in 3.2.

Classify each as:

A. necessary for 3.2
B. worthwhile tiny extraction
C. defer

Keep scope disciplined.

---

# 33. Add-dialog discoverability

New section names must make sense to normal operators.

Potential operator-facing names should avoid internal jargon.

Examples:

Good:
Image & Text
Steps
Highlights
Call to Action
Logos
Before & After

Potentially poor:
Content Split
Metric Grid
Conversion Block
Brand Cloud

Internal type may be technical; UI label should be plain.

Recommend final labels/descriptions.

---

# 34. Section ordering defaults

Current Add likely inserts according to existing command semantics.

Determine whether new section types need any special default location.

Strong preference:

NO type-specific automatic placement.

Add according to current Section Manager behavior.

Hero remains pinned.

Operator controls order.

---

# 35. Contact/CTA overlap

If recommending a CTA section, clearly distinguish it from Contact.

Contact currently may include:

lead form
email
phone
URL action

CTA may simply be:

heading
body
button

Questions:

- is this enough differentiated value?
- could Contact serve the same need?
- should CTA link to Contact section?
- should CTA support URL/phone/email safely?

If overlap is too high, do not add CTA merely to hit a section-count target.

---

# 36. About/Image & Text overlap

Similarly evaluate existing About.

If About already supports:

image
heading
body
CTA

then a new Image & Text section may be redundant.

Inspect actual current About content before recommending.

Possibilities:

A. About is already the reusable image/text section → rename operator-facing
label later, no new type needed
B. About is sufficiently domain-specific → add a flexible Image & Text type
C. enhance About instead of adding a type

Recommend based on actual code.

Do not blindly create duplicates.

---

# 37. Services/Process overlap

Services is a grid of offerings.

Process is sequential.

If Process is recommended, ensure its renderer/editor communicates sequence
rather than appearing as another Services grid.

---

# 38. Gallery/Before-After overlap

Before & After should only be added if its paired semantic model adds real value
over Gallery.

If static side-by-side pairs provide strong local-business value, say so.

If the result would just be another gallery layout, defer it.

---

# 39. Potential first batch size

Recommend ONE of:

A. 3 new sections
B. 4 new sections
C. 5 new sections
D. 6 new sections

Do not assume more is better.

Consider implementation/test surface.

A strong likely batch might be:

- Image & Text
- Steps
- Highlights
- Call to Action
- Before & After

But adjust based on the actual existing About/Contact capabilities.

Explain why each selected type earns its place.

Also provide a "deferred candidates" list.

---

# 40. Implementation slicing

Determine whether 3.2 should be:

A. one implementation pass

B. two slices

Potential split:

3.2a
non-media sections:
- Steps
- Highlights
- CTA

3.2b
media-heavy:
- Image & Text
- Logos
- Before & After

This might reduce risk because media scanners are load-bearing.

However, if the current patterns make all types straightforward, one cohesive
implementation may be reasonable.

Recommend based on actual code.

---

# 41. Test strategy — schema/server

For every new section:

- defaults valid
- valid content accepted
- malformed content rejected
- unknown fields behavior
- nested IDs
- enum validation
- multiplicity
- add
- edit
- move
- hide/show
- duplicate
- delete
- publish
- working/published isolation

Do not duplicate generic instance-command tests unnecessarily if centralized
behavior already covers all types.

Add type-specific tests where content/media behavior differs.

---

# 42. Test strategy — media

For EVERY media-bearing new section:

- media refs collected
- hydration
- hidden ref protection
- repeated-section refs
- duplicate preserves refs
- deletion blocked while referenced
- removal allows deletion only when no other refs
- race test coverage where the general transactional seam already covers it

Be explicit about which existing race tests can remain generic and which require
a new case.

This is required before merge.

---

# 43. Test strategy — Portal

For each editor:

- exact sectionId
- seed from correct instance
- dirty detection
- save exact id
- field validation UX
- nested add/remove/reorder
- media selection where relevant

Section Manager:

- new types appear in Add
- label/description
- summary
- repeated instances independent
- duplicate availability
- exact new section ID after Add/Duplicate

Do not retest every generic manager action once per type unless useful.

---

# 44. Test strategy — renderer

For each new type:

- renders
- hidden omission remains generic
- repeated instances render separately
- semantic structure
- Theme classes/tokens
- media hydration
- accessible text/alt/labels
- responsive class intent

Avoid screenshot tests unless already established.

---

# 45. Data transition

Adding new section types should ideally require NO transition.

Existing working/published sites simply have none of the new types.

Confirm.

If changing existing About/Contact schema is recommended, identify whether that
creates a transition requirement.

Because no real customer marketing sites exist, a narrow breaking change is
possible — but do not create one without clear value.

---

# 46. Security

Check new content for:

- URL validation
- phone/email validation
- media ID validation
- HTML injection
- CSS injection
- arbitrary embed risk

No arbitrary external resource URLs for images.

Use Media Library IDs.

No iframe/embed section in 3.2.

---

# 47. Performance

New sections should remain SSR-friendly.

Avoid:

- heavy client-side JS
- animation libraries
- carousel libraries
- external embeds
- layout measurement JS

Static responsive HTML/CSS should be sufficient.

The public site should not become dependent on React client behavior just to
render marketing content.

---

# 48. Files likely to change

Provide exact likely files by category:

schema
server defaults/validation
media
routes/services if required
Portal registry
Portal editors
renderer
site-components
tests
docs

Identify whether the Section Manager itself should need meaningful modification.

Strong preferred answer:

very little.

If adding a type requires changing manager architecture, investigate why.

---

# 49. Classifier/deployment impact

Estimate expected classifier:

API
Portal
Renderer

likely all true because this affects:

schema
server
Portal
renderer

Client must remain false.

Unknown must remain empty.

No infrastructure.

---

# 50. Baseline

Run current deterministic baseline.

Important:

Step 3 is still being maintained in one branch / PR.

Report current:

HEAD
git status summary
server tests
Portal tests
renderer tests
UI tests
typecheck
lint

Do NOT mutate Git.

Do NOT criticize the fact that Step 3 is one branch/PR; that is an intentional
operator decision.

Just plan against the current branch state.

---

# 51. Final recommended Step 3.2 scope

Give a decisive recommendation.

Example:

Implement:
1. Image & Text
2. Steps
3. Highlights
4. Call to Action
5. Before & After

Defer:
- Logos
- Team
- Service Area
- Pricing
- Video

OR a different set based on actual architecture.

Do not return "all are useful."

Rank them.

We want a real implementation scope.

---

# 52. Output

Return:

1. current section-library audit
2. important gaps
3. recommended Step 3.2 batch size
4. exact selected section types
5. deferred candidates
6. rationale for each selected type
7. internal type + UI label table
8. multiplicity decisions
9. exact content schema for every selected type
10. server-owned defaults
11. validation rules
12. Section Manager metadata/summaries
13. Add-dialog organization recommendation
14. Portal editor design for each
15. renderer design for each
16. Theme integration
17. Custom CSS/data-role hooks
18. CTA/action-model reuse decision
19. nested-item identity strategy
20. media-reference map for every media-bearing type
21. media scanner/hydration changes
22. media deletion safety implications
23. duplication behavior
24. accessibility semantics
25. responsive behavior
26. security considerations
27. data-transition requirement
28. backend changes
29. schema changes
30. Portal changes
31. renderer/site-component changes
32. necessary refactors vs deferred cleanup
33. deterministic server test plan
34. media/race test plan
35. Portal test plan
36. renderer test plan
37. likely files changed
38. classifier/deployment impact
39. recommended implementation slicing
40. current baseline results
41. blockers/operator decisions
42. whether Step 3.2 is ready to implement

Explicitly answer:

How many new sections should Step 3.2 add?

Which exact sections?

Why does each earn its place?

Is existing About already sufficient as a generic Image & Text section?

Is existing Contact sufficient instead of adding a CTA section?

Should Before & After be included now?

Should Logo Cloud be included now?

Should Team be included now?

Should Service Area be included now?

Does any proposed section require a new Theme field?

Expected: NO unless a genuine architectural gap is discovered.

Does any proposed section require a third-party dependency?

Expected: NO.

Does any proposed section require client-side runtime JS to render?

Strong expected answer: NO.

Will existing sites require a data transition?

Strong expected answer: NO.

Can the existing Section Manager support all selected new types without an
architectural rewrite?

Expected: YES.