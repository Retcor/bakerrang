# Implement Step 1.27c — Business Hours

Implement only Step 1.27c of the BakerRang Step 1.27 roadmap.

This slice adds canonical Business Hours data, an optional composable homepage Business Hours section, the Portal Business Hours editor, public rendering, and LocalBusiness opening-hours structured data.

Do NOT implement Social Links yet.

Use the approved Step 1.27 Claude plan as the architectural reference, with the decisions in this assignment taking precedence.

---

# Goal

Add structured canonical Business Hours to:

```text
BusinessProfile.businessHours
```

and allow the operator to optionally display those canonical hours as a composable homepage section.

Business Hours must support:

- canonical structured business data
- working/published lifecycle
- Step 1.25 Preview
- optional Home.sections presentation
- Step 1.26 Theme
- LocalBusiness JSON-LD
- mobile-friendly Portal editing

There must be only one source of truth for the weekly schedule.

Do NOT copy actual hours into the Home section payload.

---

# 1. Canonical Data Model

Add canonical Business Hours to the shared schema under `BusinessProfile`.

Use:

```ts
export type WeekdayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type DayHours =
  | {
      closed: true
    }
  | {
      open: string
      close: string
    }

export interface BusinessHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}
```

Then:

```ts
export interface BusinessProfile {
  // existing fields...

  businessHours?: BusinessHours
}
```

## Important decision

`businessHours` itself is optional.

Meaning:

```text
businessHours missing
  = business hours have not been configured
```

But once `businessHours` exists, all seven weekdays must be explicitly represented.

Do NOT use:

```ts
Partial<Record<WeekdayKey, DayHours>>
```

for canonical configured hours.

This avoids ambiguity between:

```text
closed
```

and:

```text
not configured / accidentally omitted
```

---

# 2. V1 Hours Semantics

V1 supports one interval per day.

Each day is either:

```ts
{ closed: true }
```

or:

```ts
{
  open: '09:00',
  close: '17:00'
}
```

Use zero-padded 24-hour time internally:

```text
HH:MM
```

Examples:

```text
08:30
09:00
17:00
23:30
```

Do NOT support in V1:

- split hours
- multiple periods per day
- overnight hours
- holiday exceptions
- date-specific closures
- appointment schedules
- timezone editing
- "Open now"
- "Closed now"
- today's-hours highlighting

Those require additional data semantics and remain out of scope.

---

# 3. Business Hours Validation

Create a focused Business Hours validator/normalizer.

Server validation is authoritative.

Required weekday keys:

```text
monday
tuesday
wednesday
thursday
friday
saturday
sunday
```

When Business Hours are configured, all seven must exist exactly once.

For open days:

```text
open
close
```

must match:

```regex
^([01]\d|2[0-3]):[0-5]\d$
```

Require:

```text
close > open
```

for V1.

Examples rejected:

```text
09:00 -> 09:00
17:00 -> 09:00
22:00 -> 02:00
```

Overnight business hours are deliberately unsupported in V1.

For closed days, accept only the closed shape.

Reject malformed hybrids such as:

```json
{
  "closed": true,
  "open": "09:00",
  "close": "17:00"
}
```

Unknown weekday keys must be rejected.

Unknown fields must not become canonical state.

---

# 4. Read-Time Normalization

Business Hours must be backwards-compatible.

Old BusinessProfile values without `businessHours` remain valid.

For stored Business Hours data:

- valid complete Business Hours -> return normalized value
- malformed Business Hours -> fail safely on read by omitting `businessHours`
- partial Business Hours -> treat as malformed/incomplete and omit the entire `businessHours`

Do NOT invent "Closed" for missing stored weekdays.

Missing stored days mean the stored object is incomplete, not that the business intentionally declared itself closed.

This is different from write behavior:

```text
writes = strict 400
reads = sanitize safely
```

Old published snapshots without hours must continue rendering normally.

No Firestore migration.

---

# 5. Business Hours Home Section

Add an optional canonical Home section:

```ts
export interface BusinessHoursContent {
  heading?: string
  intro?: string
}

export interface BusinessHoursSection {
  id: 'businessHours'
  type: 'businessHours'
  content: BusinessHoursContent
}
```

Add it to `SiteSection`.

Add:

```text
isBusinessHoursSection
```

following existing conventions.

Canonical identity:

```text
id   = businessHours
type = businessHours
```

Maximum instances:

```text
1
```

The section stores only presentation-specific content:

```text
heading
intro
```

It must NOT store:

- weekday schedules
- open times
- close times
- duplicate BusinessProfile data

Public rendering reads the schedule from:

```text
site.businessProfile.businessHours
```

---

# 6. Business Hours Section Validation

Section presentation limits:

```text
heading
  optional
  max 120

intro
  optional
  max 300
```

If heading is omitted, public rendering should use a sensible default:

```text
Business Hours
```

Unknown presentation fields must not persist.

---

# 7. Focused Mutation Architecture — IMPORTANT

Do NOT make the new Business Hours editor call the existing whole-profile mutation by sending a merged copy of BusinessProfile.

The existing general Business Profile endpoint currently replaces the entire profile.

That creates an unnecessary stale-state overwrite risk for focused Hours editing.

Instead create a dedicated Business Hours mutation.

Recommended route:

```text
PUT /tenants/:tenantId/site/business-hours
```

Use a focused payload approximately:

```ts
interface BusinessHoursUpdateInput {
  businessHours: BusinessHours | null

  homepage: {
    enabled: boolean
    heading?: string
    intro?: string
  }
}
```

Exact naming may follow current conventions, but preserve this architecture.

This endpoint/service is allowed to modify only:

```text
config.businessProfile.businessHours
```

and the optional canonical:

```text
Home.sections.businessHours
```

It must preserve every other BusinessProfile field exactly as stored.

Specifically, it must not overwrite or stale-write:

- description
- phone
- email
- address
- serviceAreas
- socialImageMediaId
- future socialLinks
- any unrelated profile state

Do NOT require the Portal to resend those fields.

---

# 8. Atomic Working-State Update

The Business Hours mutation should update the relevant WORKING state atomically.

It may need to update both:

```text
config.businessProfile.businessHours
```

and:

```text
home.sections
```

Use an appropriate Firestore transaction consistent with the existing site-service architecture.

Required states:

## Configure hours + show homepage section

```text
businessHours = full 7-day schedule
homepage.enabled = true

result:
  canonical hours stored
  businessHours Home section exists
```

## Configure hours + do not show homepage section

```text
businessHours = full schedule
homepage.enabled = false

result:
  canonical hours stored
  no businessHours Home section
```

This allows canonical hours to exist for structured data without requiring homepage presentation.

## Remove all configured hours

Allow:

```text
businessHours = null
```

When removing canonical hours:

- remove `businessHours` from BusinessProfile
- the homepage Business Hours section MUST also be removed

Do not allow a Home Business Hours section to survive without canonical hours.

Treat this atomically rather than leaving a dangling section.

---

# 9. Section Creation / Position

If:

```text
homepage.enabled = true
```

and a Business Hours section does not exist, create it.

Initial insertion:

```text
before Contact
```

If Contact does not exist:

```text
append
```

If Business Hours already exists:

- update heading/intro in place
- preserve its current manually configured Home-section position

Do not automatically reposition it on every Hours save.

The section must also participate in generic Manage Sections:

- Move Up
- Move Down
- Remove

If the operator removes Business Hours through Manage Sections:

- remove only the presentation section
- preserve canonical `BusinessProfile.businessHours`
- structured data may continue using the canonical hours

When the Business Hours editor is next opened, its:

```text
Show on homepage
```

toggle should reflect that the section is absent.

---

# 10. Canonical Section Invariants

Add `businessHours` to the existing canonical Home-section machinery.

Preserve:

- Hero-first invariant
- `id === type`
- max-one section
- composition ordering
- generic removal/reorder behavior

Server enforcement is authoritative.

Do not build a second composition list.

---

# 11. Portal Business Hours Editor

Add a focused Business Hours editor under the Site Foundation area.

Conceptually:

```text
Site Foundation

Branding
Theme
Business Profile
Business Hours
Manage Sections
```

Do NOT add Social Profiles yet.

The Business Hours editor should seed from:

```text
site.businessProfile?.businessHours
```

and detect whether a canonical:

```text
businessHours
```

Home section currently exists.

---

# 12. Weekly Editor UX

Design a compact weekly schedule editor.

Conceptually:

```text
Monday      Open      9:00 AM    to    5:00 PM
Tuesday     Open      9:00 AM    to    5:00 PM
Wednesday   Open      9:00 AM    to    5:00 PM
Thursday    Open      9:00 AM    to    5:00 PM
Friday      Open      9:00 AM    to    5:00 PM
Saturday    Closed
Sunday      Closed
```

Each day needs:

- Open/Closed state
- opening time when Open
- closing time when Open

Use styled existing Portal primitives where possible.

`Input type="time"` is acceptable if it integrates cleanly with the Portal styling.

Do not build a custom clock picker.

---

# 13. Initial Editor Defaults

When Business Hours are not yet configured, provide reasonable editable defaults but do not persist until Save.

For example:

```text
Monday-Friday
  Open
  09:00 - 17:00

Saturday-Sunday
  Closed
```

This is only editor initialization convenience.

It must not make hours canonical until the operator presses Save.

If a different simple default pattern better matches existing form conventions, use it consistently.

---

# 14. Copy Weekday Helper

Add a small convenience action:

```text
Copy Monday to weekdays
```

When invoked, copy Monday's current:

```text
Open/Closed
open
close
```

state to:

```text
Tuesday
Wednesday
Thursday
Friday
```

Do not automatically affect Saturday/Sunday.

This action updates local form state only.

It does not persist until Save.

Keep this helper small and accessible.

---

# 15. Mobile Editor UX

At narrow widths, do not force seven rows into a compressed desktop grid.

Each day may stack approximately:

```text
Monday
[Open / Closed]

[09:00] to [17:00]
```

Then next day.

Requirements:

- no horizontal overflow
- touch-friendly controls
- readable day labels
- disabled time controls when Closed
- clear open/closed state
- Save remains easily reachable

Verify around:

```text
375px
768px
desktop
```

---

# 16. Homepage Presentation Controls

The Business Hours editor should include:

```text
Show business hours on homepage
```

When enabled, allow optional:

```text
Section heading
Intro
```

Example:

```text
Show business hours on homepage  [x]

Heading
Business Hours

Intro
We're available throughout the week...
```

When disabled:

- canonical hours remain saved
- homepage Business Hours section is absent

The default heading need not be persisted if blank; public rendering may use:

```text
Business Hours
```

Do not create a second editor merely for the section heading/intro.

The Business Hours editor is the focused owner of the entire Business Hours feature.

---

# 17. Portal Save Behavior

Save should call only the new focused Business Hours endpoint.

Do NOT call:

```text
PUT /site/profile
```

with a copied/merged BusinessProfile.

On success:

```text
updated SiteDefinition
    -> BusinessWebsite state
    -> existing saved / Republish messaging
```

Use the current Preview button in the Publishing card.

No Business-Hours-specific Preview implementation.

---

# 18. Public Business Hours Component

Create a Theme-native Business Hours component in `@bakerrang/site-components`.

Use:

- SiteSection
- SiteContainer
- SectionHeading
- Theme typography
- Theme colors
- Theme width
- Theme spacing
- Theme corner treatment as appropriate

Do not add Business-Hours-specific Theme settings.

---

# 19. Public Hours Display

Display all seven days in deterministic Monday -> Sunday order.

Example:

```text
Monday       9:00 AM – 5:00 PM
Tuesday      9:00 AM – 5:00 PM
Wednesday    9:00 AM – 5:00 PM
Thursday     9:00 AM – 5:00 PM
Friday       9:00 AM – 5:00 PM
Saturday     Closed
Sunday       Closed
```

Use a pure helper to convert canonical:

```text
HH:MM
```

to readable display time.

Expected examples:

```text
00:00 -> 12:00 AM
09:00 -> 9:00 AM
12:00 -> 12:00 PM
13:30 -> 1:30 PM
23:45 -> 11:45 PM
```

Do not depend on the browser timezone for formatting.

These are local wall-clock business hours, not timestamps.

Avoid `Date` conversions that introduce timezone behavior if a pure formatter is simpler.

---

# 20. Public Semantics

Use suitable semantic markup such as:

- a definition list
- or a simple accessible table

Choose whichever fits the existing site design better.

Requirements:

- weekday names are clear
- open/close ranges are clear
- Closed is clear
- mobile rendering is clean
- no misleading "Open now" state
- no "Today" highlight

Without a business timezone, do not infer current availability.

---

# 21. Renderer Wiring

Add:

```text
businessHours
```

handling to `SectionRenderer`.

The section presentation comes from:

```text
BusinessHoursSection.content
```

The actual schedule comes from:

```text
site.businessProfile?.businessHours
```

Thread the canonical hours through the existing renderer path without introducing a new API request.

No direct Firestore access.

No Business Hours public fetch endpoint.

If a malformed/corrupt SiteDefinition somehow contains a Business Hours section but no valid canonical hours, render safely without throwing.

The normal mutation architecture should prevent this state.

---

# 22. Navigation

When the Business Hours Home section exists, include a section-derived navigation entry.

Recommended label:

```text
Hours
```

Anchor:

```text
#businessHours
```

or the existing normalized anchor convention if kebab-case is required.

Follow existing navigation architecture exactly.

Do not create a separate nav config.

If the section is removed, the Hours navigation entry must disappear.

Canonical hours alone should NOT create homepage navigation.

Only the Home section controls presentation/navigation.

---

# 23. LocalBusiness Structured Data

Extend the existing LocalBusiness JSON-LD generator using canonical:

```text
BusinessProfile.businessHours
```

only.

Do not read section content to generate structured data.

For each open day emit an `OpeningHoursSpecification`.

Conceptually:

```json
{
  "@type": "OpeningHoursSpecification",
  "dayOfWeek": "https://schema.org/Monday",
  "opens": "09:00",
  "closes": "17:00"
}
```

Use a fixed weekday -> schema.org day mapping.

Closed days should be omitted from `openingHoursSpecification`.

If there are no open days, omit `openingHoursSpecification` entirely.

Do not emit malformed data.

Do not change the existing LocalBusiness emission gate except as absolutely necessary.

Hours should augment an existing valid LocalBusiness object; they should not independently cause a structured-data block to appear if the current core-identity gate says not to emit one.

---

# 24. SEO / Preview Behavior

Do NOT add Business-Hours-specific SEO architecture.

Existing behavior remains:

```text
Preview
  -> WORKING BusinessProfile
  -> noindex / no canonical

Public/shared/custom
  -> PUBLISHED BusinessProfile
```

Therefore structured opening hours should naturally follow:

```text
WORKING hours
  -> Preview structured data

PUBLISHED hours
  -> public structured data
```

Do not modify canonical URLs, robots, preview tokens, or custom-domain resolution.

---

# 25. Working / Published Lifecycle

Required behavior:

```text
Published Business Hours A

Edit WORKING hours -> B

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

This applies to both:

- rendered Business Hours section
- LocalBusiness openingHoursSpecification

No Business-Hours-specific publish code should be necessary.

Use the existing SiteDefinition snapshot flow.

---

# 26. Manage Sections Interaction

If Business Hours presentation is enabled, Manage Sections should show:

```text
Business Hours
```

or:

```text
Hours
```

using a clear readable label.

Existing controls should:

- Move Up
- Move Down
- Remove

Removing the section must NOT delete canonical BusinessProfile hours.

After removal:

```text
site.businessProfile.businessHours
  remains configured

Home.sections businessHours
  absent

structured data
  still uses canonical hours

homepage section/nav
  absent
```

Re-enabling:

```text
Show business hours on homepage
```

in the Hours editor should recreate the canonical presentation section.

---

# 27. Remove Hours Entirely

Provide a clear way to remove canonical Business Hours if practical within the existing editor UX.

For example:

```text
Remove business hours
```

with the existing confirmation-dialog pattern.

If canonical hours are removed:

- `businessProfile.businessHours` is removed
- Business Hours Home section is also removed atomically
- Hours navigation disappears
- structured opening-hours data disappears

Do not leave presentation state pointing to missing canonical data.

If implementing this destructive action would significantly enlarge the slice, the focused endpoint must still support:

```text
businessHours: null
```

even if the Portal removal control is deferred.

Report the decision.

---

# 28. BusinessProfile Compatibility

This is critical.

The focused Business Hours mutation must preserve all unrelated BusinessProfile fields.

Write a test beginning with a profile containing values such as:

```text
description
phone
email
address
serviceAreas
socialImageMediaId
```

Then update Business Hours.

Verify every unrelated value remains unchanged.

Also test the inverse:

- update general Business Profile after Business Hours has been configured

The existing Business Profile editor/endpoint must not erase `businessHours`.

Because the general Business Profile mutation currently replaces the whole profile, update its compatibility behavior as necessary so older editor payloads that omit the new `businessHours` field preserve stored Business Hours.

This is analogous to the legacy Branding compatibility work from Step 1.26.

Do NOT require every existing general-profile caller to know about the newly-added field merely to avoid deleting it.

This requirement is important.

---

# 29. General Business Profile Endpoint Transition

Inspect the current:

```text
PUT /tenants/:tenantId/site/profile
```

behavior.

Once `businessHours` becomes part of BusinessProfile, identity/details-only Business Profile saves must preserve stored `businessHours` when the payload omits it.

Do not introduce dual-write state.

The focused Business Hours endpoint is authoritative for Business Hours updates.

The general profile endpoint may continue to support existing profile fields, but omitted `businessHours` must mean:

```text
preserve existing stored businessHours
```

not:

```text
delete businessHours
```

Deletion occurs only through the focused Business Hours mutation.

Add deterministic regression coverage.

---

# 30. Validation / Security

Business Hours input is data, not CSS or HTML.

Still ensure:

- fixed weekday allowlist
- strict time format
- strict open/closed union shape
- no arbitrary unknown persisted properties
- strings are bounded if section heading/intro are present
- server is authoritative

No user input should become executable HTML.

Public strings render through normal React escaping.

---

# 31. Tests — Server

Cover at minimum:

## Canonical Hours validation

- valid seven-day schedule
- all closed schedule
- missing weekday rejected
- extra weekday rejected
- malformed time rejected
- invalid open/close ordering rejected
- equal times rejected
- overnight interval rejected
- malformed union shape rejected
- unknown fields not persisted

## Read normalization

- no hours remains no hours
- complete valid hours normalize
- malformed stored hours omitted safely
- partial stored hours omitted safely
- old snapshots without hours remain valid

## Focused mutation

- updates only `businessProfile.businessHours`
- preserves description
- preserves phone
- preserves email
- preserves address
- preserves serviceAreas
- preserves socialImageMediaId
- does not rewrite unrelated profile state

## General profile compatibility

- Business Hours exist
- perform existing identity/details BusinessProfile save omitting hours
- Business Hours remain intact

## Section behavior

- showOnHomepage creates canonical section
- section stores no schedule data
- initial insertion before Contact
- Contact absent -> append
- editing preserves manual Home position
- showOnHomepage false removes section but preserves canonical hours
- generic Manage Sections removal preserves canonical hours
- re-enable recreates section
- businessHours null removes canonical data + section atomically
- single-instance/canonical identity enforced

## Lifecycle

- publish A
- edit hours B
- working/Preview B
- published A
- republish
- published B

---

# 32. Tests — Renderer

Cover:

- seven-day display order
- open day formatting
- closed day rendering
- 24h -> 12h formatter edge cases
- Theme-native component structure
- section heading default
- intro optional
- businessHours section dispatch
- section present + hours present
- defensive section present + hours missing does not throw
- navigation appears only when section exists
- canonical hours without section produce no homepage nav
- structured data maps open days correctly
- closed days omitted from openingHoursSpecification
- no canonical hours -> structured field omitted
- malformed normalized state -> no malformed JSON-LD
- existing LocalBusiness gate unchanged

---

# 33. Tests — Portal

Cover:

- unconfigured initial state
- seven-day default form state does not persist automatically
- existing hours load correctly
- open/closed toggles
- open/close times
- Closed disables/hides relevant time editing
- Copy Monday to weekdays
- homepage display toggle
- heading/intro
- Save calls focused Business Hours endpoint only
- Save does NOT call whole-profile endpoint
- validation errors
- mobile-friendly structure where practical
- returned SiteDefinition updates parent state
- existing Preview action remains present
- Manage Sections label present when section exists
- removal/re-enable behavior as applicable

If a Remove Business Hours action is implemented:

- confirmation behavior
- focused null mutation
- section removed in returned state

---

# 34. Regression

Verify no semantic regression to:

- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Contact
- Leads
- Branding
- Theme
- Business Profile existing fields
- Preview authorization
- custom domains
- publish/unpublish
- media hydration
- existing LocalBusiness fields

---

# 35. Automated Verification

Run:

- all backend tests
- Portal tests
- UI tests
- renderer tests
- platform typecheck
- platform lint
- touched server-file lint
- Portal production build
- renderer production build
- `git diff --check`

Report unrelated global lint failures separately.

---

# 36. Explicitly Out of Scope

Do NOT implement:

- Social Links
- `sameAs`
- FAQ JSON-LD
- split business hours
- overnight business hours
- holiday exceptions
- timezone UI
- "Open now"
- today's-hours highlight
- appointment booking
- arbitrary hours text
- custom CSS
- section-background variants
- arbitrary HTML
- drag/drop
- inline editing
- production deployment

---

# 37. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. final Business Hours schema
4. canonical/read-normalization behavior
5. focused mutation architecture
6. BusinessProfile compatibility behavior
7. Home-section behavior
8. Portal Business Hours editor
9. public rendering
10. LocalBusiness structured-data changes
11. tests added/updated
12. complete automated verification results
13. manual DEV verification still required
14. any deviations and why