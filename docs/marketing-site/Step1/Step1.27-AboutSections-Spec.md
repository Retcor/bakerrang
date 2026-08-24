# Planning Task — Step 1.27: About / FAQ / Business Hours / Social Links

We are continuing the BakerRang multi-tenant marketing-site platform.

Do NOT implement anything.

Inspect the actual current code and produce a detailed implementation plan for Step 1.27.

## Goal

Expand the tenant website content model with four useful capabilities:

1. About
2. FAQ
3. Business Hours
4. Social Links

These features must integrate cleanly with the existing:

- SiteDefinition
- BusinessProfile
- Home.sections composition model
- Portal Website workspace
- Working vs Published lifecycle
- Step 1.25 Working-Site Preview
- Step 1.26 Theme system
- SEO / LocalBusiness structured data
- custom-domain/public rendering

We want these capabilities to feel like natural extensions of the current architecture, not isolated one-off features.

---

# 1. Existing Architectural Constraints

Inspect the actual implementation before deciding where data belongs.

Relevant areas include:

- `platform/packages/site-schema`
- `platform/packages/site-components`
- `platform/apps/site-renderer`
- `platform/apps/portal`
- `server/domain`
- `server/services/siteService.js`
- tenant/site routes
- existing BusinessProfile model/editor
- Hero / Services / Gallery / Testimonials / Contact sections
- Home.sections composition/order/removal
- SectionCompositionEditor
- SectionRenderer
- SEO / JSON-LD generation
- Step 1.25 Preview
- Step 1.26 Theme

Known architecture principles:

### Home composition

`Home.sections` is the authoritative source for homepage:

- composition
- ordering
- rendering
- navigation-relevant sections

Do not introduce a parallel homepage-content system.

### Working vs Published

All editable website content follows:

```text
WORKING
   -> Preview
   -> Publish snapshot
   -> Public/custom-domain renderer
```

Saving one of these new capabilities must not alter the live site until Republish.

### Renderer boundary

The renderer must continue to use sanitized API SiteDefinition data.

No direct Firestore access from the renderer.

### Business identity vs presentation/content

Existing architecture intentionally separates structured business identity from presentation.

Do not casually duplicate canonical business facts into multiple section payloads.

### Theme

Step 1.26 introduced tenant Theme controls.

New public components should consume existing Theme tokens and site primitives rather than introduce independent color/font/radius systems.

---

# 2. Primary Architecture Question

Determine the correct canonical storage location for each capability.

Do NOT assume all four should simply become homepage sections.

Analyze each independently.

## About

Likely candidate:

- a normal composable homepage section

Possible content:

- eyebrow / label
- heading
- body
- optional image

Determine the smallest useful V1.

Do not turn this into a rich-text/page-builder feature.

## FAQ

Likely candidate:

- composable homepage section

Expected content:

- heading
- optional intro
- ordered list of question/answer items

Determine sensible limits and validation.

FAQ should remain structured rather than arbitrary HTML.

## Business Hours

This is more nuanced.

Business hours are potentially a canonical business fact used by:

- website rendering
- Contact content
- footer/header later
- LocalBusiness JSON-LD
- future maps/directory integrations

Determine whether canonical hours belong in:

```text
BusinessProfile
```

rather than directly inside a homepage section.

If hours need to be optionally displayed as a homepage section, consider whether the section should reference/render canonical BusinessProfile hours rather than duplicate them.

Avoid dual sources of truth.

## Social Links

Also determine whether these are canonical structured business-profile data rather than section-specific content.

Potential future consumers include:

- header/footer
- Contact
- About
- structured metadata
- social icons
- future standalone pages

Prefer one canonical set of social profiles.

If homepage presentation needs a Social section later, determine whether it should consume canonical profile data rather than storing duplicate URLs.

---

# 3. About V1 Product Scope

Plan a useful but constrained About section.

Consider fields such as:

```ts
{
  type: 'about'
  eyebrow?: string
  heading: string
  body: string
  imageMediaId?: string
}
```

This is conceptual only.

Inspect existing Hero/Gallery/media patterns and recommend the cleanest shape.

Requirements:

- heading
- narrative text
- optional image if it fits existing media architecture cleanly
- no arbitrary HTML
- no Markdown requirement unless the current platform already has a safe pattern for it
- reasonable server-side length limits
- media hydration should reuse the existing provider-neutral media system

Determine whether body should support:

- plain multiline text only
- multiple paragraphs represented structurally

Prefer the smallest model that gives a professional About section.

Do not build a rich-text editor.

---

# 4. FAQ V1 Product Scope

Plan an FAQ section.

Conceptually:

```ts
{
  type: 'faq'
  heading: string
  intro?: string
  items: [
    {
      id: ...
      question: string
      answer: string
    }
  ]
}
```

Determine the best actual shape based on existing section conventions.

Requirements:

- ordered entries
- add/remove/reorder FAQ entries in Portal
- stable identities if needed for React/editor operations
- reasonable maximum number of FAQ entries
- question length validation
- answer length validation
- no arbitrary HTML
- public rendering should be accessible

Public FAQ UX may use:

- accordion/disclosure
- expanded cards

Recommend one for V1.

If using an accordion:

- use semantic buttons
- `aria-expanded`
- keyboard accessible
- no dependency-heavy UI library merely for accordion behavior

Consider whether FAQ structured data (`FAQPage` JSON-LD) should be emitted.

IMPORTANT:

Research is NOT requested here; base the recommendation on current architecture and implementation realities.

If FAQ schema markup would create questionable SEO value or add complexity, say so rather than assuming it must be included.

---

# 5. Business Hours Data Model

Design a structured canonical hours model.

We need to represent normal weekly business hours safely.

Possible conceptual shape:

```ts
businessHours: {
  monday: ...
  tuesday: ...
  wednesday: ...
  thursday: ...
  friday: ...
  saturday: ...
  sunday: ...
}
```

Each day may be:

```ts
{ closed: true }
```

or:

```ts
{
  open: '09:00'
  close: '17:00'
}
```

Do NOT blindly use this exact shape.

Inspect existing conventions and recommend the best schema.

The plan must address:

- closed days
- standard open/close periods
- validation that close is after open where appropriate
- 24-hour internal representation vs display formatting
- locale/display formatting
- whether split hours such as 9–12 and 13–17 are needed in V1

My preference is to keep V1 simple unless split hours are easy without significantly complicating the editor/schema.

Do NOT add:

- holiday exceptions
- date-specific closures
- timezone management UI
- appointment calendars

unless the existing architecture clearly requires them.

Determine whether timezone must be represented now for correctness or can be deferred because V1 is display-only structured hours.

---

# 6. Business Hours Presentation

If canonical hours live in BusinessProfile, determine how they should appear on the website.

Possible approaches:

### Option A

Business Hours are profile data only and Contact automatically displays them.

### Option B

Add a composable `businessHours` homepage section that reads canonical BusinessProfile hours.

### Option C

Both:
- canonical data in BusinessProfile
- optional section in Home.sections controls where/if they display

Analyze the existing composition philosophy and recommend the cleanest V1.

Avoid storing the actual weekly hours twice.

If a section exists, it should contain only presentation-specific fields such as:

```text
heading
intro
```

while consuming canonical hours from BusinessProfile.

---

# 7. Social Links Data Model

Design a constrained social-profile model.

Potential platforms include:

- Facebook
- Instagram
- LinkedIn
- YouTube
- TikTok
- X / Twitter

Possibly others if justified.

Do NOT provide an enormous arbitrary platform catalog.

Determine whether V1 should use:

### Typed platform entries

```ts
{
  platform: 'facebook'
  url: 'https://...'
}
```

or explicit optional fields such as:

```ts
{
  facebook?: string
  instagram?: string
}
```

Recommend the most extensible constrained design.

Requirements:

- validate URLs server-side
- require HTTPS where appropriate
- reject dangerous schemes
- no `javascript:`
- no arbitrary embedded HTML
- deduplicate platform entries
- deterministic ordering or explicit ordering

Determine whether arbitrary generic links should be supported in V1.

Prefer known social platforms unless there is a strong reason otherwise.

---

# 8. Social Link Presentation

Determine where social links should render initially.

Possible locations:

- SiteHeader
- Footer
- Contact section
- About section
- dedicated Social section

Do not automatically place links everywhere.

Recommend a restrained V1 experience.

My initial preference is:

- canonical social links live in BusinessProfile
- public Footer displays configured social links
- possibly Contact can display them if appropriate
- no dedicated homepage Social section yet unless the architecture strongly favors one

But inspect the current site layout and recommend what fits best.

Any icons should:

- be lightweight
- accessible
- have readable `aria-label`s
- not require a large dependency solely for six icons

External links should use appropriate safe external-link behavior.

---

# 9. BusinessProfile Evolution

Inspect the current `BusinessProfile`.

Determine whether it should evolve to include:

```text
businessHours
socialLinks
```

while retaining current fields such as:

- description
- phone
- email
- address
- service areas
- social image

Do not mix homepage About narrative with BusinessProfile unless there is a strong reason.

The existing Business Profile editor may need new grouped subsections.

Consider whether the Portal UX should become:

```text
Business Profile

Business Details
  description
  phone
  email
  address
  service areas

Business Hours
  ...

Social Profiles
  ...

Social Image
  ...
```

or whether Hours/Social should get their own editor screens/actions inside Website.

Recommend the cleanest Portal information architecture without creating excessive navigation.

---

# 10. Structured Data / SEO

Inspect the existing LocalBusiness JSON-LD implementation.

Determine how structured Business Hours can safely improve it.

If canonical hours are available, consider emitting:

```text
openingHoursSpecification
```

or the existing architecture's equivalent.

Do not duplicate structured data from section presentation state.

Social links may potentially map to:

```text
sameAs
```

in LocalBusiness structured data.

Determine whether that is appropriate.

Requirements:

- structured data must derive from canonical BusinessProfile data
- malformed/unconfigured fields must be omitted safely
- no preview canonical/indexing regression
- Preview remains noindex
- custom-domain/public canonical behavior unchanged

About content itself probably should not alter structured business identity unless existing SEO architecture warrants it.

FAQ JSON-LD should be separately evaluated rather than automatically added.

---

# 11. Home Section Composition

About and FAQ should likely participate in existing:

```text
Home.sections
```

Determine whether Business Hours also gets a section representation.

Any new composable section type must integrate with:

- SectionCompositionEditor
- add section
- remove section
- ordering
- Move Up / Move Down
- immutable/reserved section rules if relevant
- SectionRenderer
- working/published snapshot flow
- Preview
- Theme

Do not introduce special ordering state outside `Home.sections`.

Determine default insertion behavior for new sections.

Do not automatically add new sections to existing sites.

Existing sites should remain visually unchanged.

---

# 12. Section Identity / Multiplicity

For each proposed section type, decide whether Home can contain:

- zero or one
- multiple

My likely preference for V1:

```text
About            max 1
FAQ              max 1
Business Hours   max 1 if represented as a section
```

But inspect existing invariants and recommend explicitly.

The server must enforce multiplicity rules rather than relying only on Portal UI.

If a section has ordered child items such as FAQs, child identity should follow existing Gallery/Services/Testimonial patterns where possible.

---

# 13. Section Removal / Re-Addition

Inspect current remove/re-add behavior.

For new sections determine:

- what happens when removed
- whether removal deletes the content payload or simply removes the section
- how re-adding works
- whether previous content should return

Follow existing section semantics unless there is a compelling reason otherwise.

Do not create hidden orphan content unintentionally.

---

# 14. Theme Integration

All new public rendering must use Step 1.26 Theme.

Use existing:

- SiteContainer
- SiteSection
- SectionHeading
- Theme colors
- Theme typography
- Theme corner style
- Theme width
- Theme spacing

Do not add section-specific arbitrary colors.

Per-section background variants are still deferred unless this step provides an unusually strong architectural reason to revisit that decision.

Prefer not to expand scope.

---

# 15. Media Integration for About

If About supports an image:

Use the existing provider-neutral media flow.

Do not store public URLs as canonical content if existing architecture stores media IDs and hydrates URLs at read time.

Reuse:

- media upload
- media validation
- hydration
- alt-text conventions if available

Determine whether About requires:

```text
imageAlt
```

as editable content.

If the existing media object already has suitable alt metadata, inspect that before duplicating it.

---

# 16. Portal UX

Plan the Website workspace changes.

Avoid creating a cluttered wall of buttons.

Current Website editing already contains grouped site/content controls.

Recommend a clear organization such as:

```text
Site Foundation
  Branding
  Theme
  Business Profile

Homepage Content
  Hero
  About
  Services
  Gallery
  Testimonials
  FAQ
  Contact
  Manage Sections

Publishing
  Preview changes
  Republish
```

This is conceptual only.

If Hours/Social are canonical BusinessProfile data, decide whether:

- they live inside Business Profile
- or get direct shortcuts/editors

Keep mobile usability in mind.

Portal editors should use the shared Portal UI primitives introduced in Step 1.24.

No raw browser-looking controls where a reusable primitive already exists.

---

# 17. About Editor UX

Plan:

- heading
- optional eyebrow/label if justified
- multiline body
- optional image upload/select if included
- Save
- standard saved/Republish messaging

Keep the editor straightforward.

Do not add rich text.

---

# 18. FAQ Editor UX

Plan an editor that supports:

- section heading
- optional intro
- FAQ item list
- add question
- edit question
- edit answer
- remove question
- move question up/down

Mobile controls should avoid repeating the Step 1.24 issue where text action buttons crushed section titles.

Prefer compact accessible icon controls for row ordering/removal where appropriate.

Require:

- accessible labels
- usable mobile touch targets
- clear disabled first/last Move state

Do not implement drag-and-drop in V1.

---

# 19. Business Hours Editor UX

Design a compact weekly schedule editor.

It should be much faster than manually typing seven text rows.

Consider:

```text
Monday      [Open]   9:00 AM   to   5:00 PM
Tuesday     [Open]   9:00 AM   to   5:00 PM
...
Sunday      [Closed]
```

Consider convenient functionality such as:

```text
Copy Monday to weekdays
```

only if it remains small and valuable.

Do not overbuild scheduling functionality.

The plan should explicitly address mobile layout.

---

# 20. Social Links Editor UX

Plan a clear editor for supported platforms.

For each configured platform:

```text
[Instagram] [https://instagram.com/example] [Remove]
```

Add-social-profile behavior should prevent duplicate platforms.

Use readable platform labels.

Do not ask operators for raw icon names.

Validation errors should identify the problematic URL/platform clearly.

---

# 21. Public About Component

Recommend the V1 layout.

Possible shape:

```text
image       About heading
            body copy
```

with responsive stacking on mobile.

If no image exists, text should still look intentional rather than leaving an empty layout.

Use Theme primitives.

No animation requirement.

---

# 22. Public FAQ Component

Recommend an accessible responsive design.

If accordion:

- semantic disclosure behavior
- keyboard accessible
- clear focus
- respects Theme corner style
- works without layout issues on mobile

Determine whether initial items are all collapsed or first item expanded.

Prefer predictable restrained behavior.

---

# 23. Public Business Hours Component

If a composable Hours section is recommended, render canonical profile hours.

Requirements:

- clear day labels
- localized/display-friendly times
- Closed state
- visually highlight today's day only if it can be done correctly without introducing timezone ambiguity

If timezone isn't modeled, do NOT implement "Open now" or "Today" logic that could be wrong.

Do not claim the business is currently open unless the data model can support that correctly.

---

# 24. Public Social Links

If social links render in Footer or elsewhere:

Requirements:

- accessible platform names
- safe external links
- reasonable icon treatment
- works on light/dark Footer
- absent platforms render nothing
- empty social list leaves no awkward placeholder

Do not put raw URLs visibly in the Footer unless that is the best UX.

---

# 25. Limits / Validation

Recommend explicit sensible server-side limits for all new data.

Examples to determine:

## About
- eyebrow
- heading
- body

## FAQ
- max FAQ count
- question length
- answer length

## Hours
- valid day values
- valid time representation
- valid interval

## Social
- max profiles
- supported platform enum
- URL length
- allowed URL protocol
- duplicate platform rejection

Portal validation may mirror these for UX, but server remains authoritative.

---

# 26. Backwards Compatibility

Existing SiteDefinitions and published snapshots without these fields must continue rendering correctly.

Do NOT require a Firestore migration unless absolutely unavoidable.

Preferred behavior:

- no About -> no About section
- no FAQ -> no FAQ section
- no hours -> no hours displayed / structured data omitted
- no social links -> no social icons / `sameAs` omitted

Existing sites should look unchanged until the operator explicitly configures/adds these features.

---

# 27. Preview Integration

No new Preview architecture.

All saved WORKING content should automatically appear through Step 1.25 Preview.

Required lifecycle:

```text
Published state A

Edit About / FAQ / Hours / Social
Save WORKING state B

Preview
  -> B

Shared/custom public site
  -> A

Republish

Shared/custom public site
  -> B
```

Confirm how BusinessProfile hours/social changes reach Preview and published snapshots through the existing model.

---

# 28. API / Service Design

Plan the smallest consistent API surface.

For composable sections, follow existing section mutation patterns.

For canonical profile Hours/Social, determine whether:

- existing BusinessProfile update should expand to accept them
- or focused endpoints are preferable

Avoid unnecessary endpoint proliferation.

At the same time, avoid giant unrelated payload writes if existing architecture favors focused mutations.

Inspect existing code and recommend based on actual patterns.

---

# 29. Implementation Slicing

This is one roadmap step, but do NOT recommend implementing all four capabilities as one giant unreviewable patch if cleaner slices exist.

Recommend an incremental sequence such as:

```text
1.27a About
1.27b FAQ
1.27c Business Hours
1.27d Social Links
1.27e cross-feature SEO/structured-data verification
```

or another order if the architecture suggests something better.

Each slice should leave:

- tests green
- SiteDefinition valid
- Preview functioning
- published behavior stable

Determine whether BusinessProfile schema changes should land before section additions.

We will still close the roadmap at Step 1.27 once all slices pass.

---

# 30. Testing Plan

Provide deterministic coverage.

## Schema / Server

At minimum consider:

- About validation
- About media hydration if used
- FAQ validation
- FAQ child ordering
- FAQ multiplicity
- section add/remove/reorder
- hours normalization/validation
- social platform validation
- social URL validation
- duplicate social rejection
- BusinessProfile compatibility
- working/published isolation
- old snapshot compatibility
- LocalBusiness structured-data input behavior where server-driven

## Renderer

Cover:

- About with image
- About without image
- FAQ rendering
- FAQ accessibility semantics
- hours rendering
- closed days
- social link rendering
- empty optional data
- Theme integration
- mobile-safe structure
- Preview reads working content
- public reads published content
- structured data changes

## Portal

Cover:

- About editor
- FAQ add/edit/remove/reorder
- Hours editor
- Social editor
- validation errors
- mobile-friendly row controls where testable
- saved state propagation
- existing Preview action remains usable

## Regression

Confirm existing:

- Hero
- Services
- Gallery
- Testimonials
- Contact
- Leads
- Branding
- Theme
- custom domains
- Preview
- publish/unpublish

are not semantically changed.

---

# 31. Manual DEV Verification Plan

Plan concrete DEV verification after implementation.

Include:

### About
- add
- edit
- image if applicable
- reorder
- remove/re-add
- mobile Preview

### FAQ
- add multiple questions
- reorder
- remove
- accordion behavior
- keyboard behavior
- mobile

### Hours
- open days
- closed days
- formatting
- Preview
- structured data if added

### Social
- configure multiple networks
- Footer/other rendering
- external links
- structured `sameAs` if added

### Lifecycle
- WORKING new content visible in Preview
- custom-dev remains old before Republish
- Republish updates custom-dev

---

# 32. Explicit Scope Exclusions

Do NOT include:

- custom CSS
- section background variants unless absolutely required by architecture
- arbitrary rich text
- Markdown editor
- rich-text editor
- arbitrary HTML
- arbitrary pages
- dedicated About page
- dedicated FAQ page
- blog
- appointment booking
- holiday hours
- calendar exceptions
- "Open now" logic without timezone support
- social feeds
- embedded Instagram/TikTok widgets
- social authentication
- arbitrary third-party scripts
- maps integration
- drag-and-drop
- inline site editing
- production deployment

Custom CSS remains Step 1.28.

Editor UX polish remains Step 1.29.

---

# 33. Output

Return:

1. Current-state findings
2. Canonical storage recommendation for each:
    - About
    - FAQ
    - Business Hours
    - Social Links
3. Recommended schema changes
4. BusinessProfile evolution
5. Home section changes
6. About V1 design
7. FAQ V1 design
8. Business Hours V1 design
9. Social Links V1 design
10. SEO / structured-data changes
11. Renderer/component architecture
12. Portal editor UX
13. API/service changes
14. Validation and limits
15. Backwards-compatibility strategy
16. Working/published/Preview behavior
17. Exact files likely created/modified
18. Testing plan
19. Incremental implementation sequence / proposed 1.27 substeps
20. Human decisions genuinely required

Favor canonical structured data, reuse of existing composition primitives, and small incremental implementation slices over duplication or feature sprawl.