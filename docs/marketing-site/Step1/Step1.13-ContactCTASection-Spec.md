# Claude Code Assignment — Step 1.13 Contact / CTA Section

DO NOT modify code.

Step 1.12 is complete and manually verified against bakerrang-dev.

We now want the next visible website capability:

CONTACT / CTA SECTION

This is the first section whose content includes a visitor action, not just
display text.

Do NOT build lead capture or CRM yet.

============================================================
1. GOAL
   ============================================================

Add a reusable Home-page Contact/CTA section that can render something like:

Ready to Start Your Project?

Contact us today to discuss your project.

[ Request an Estimate ]

The button must perform a real modeled action.

For this milestone, evaluate supporting:

EMAIL
PHONE
EXTERNAL URL

Do NOT create an internal lead-form action yet because that form does not
exist.

============================================================
2. INSPECT CURRENT FOUNDATION
   ============================================================

Inspect actual:

server/services/siteService.js
server/routes/tenants.js
server/test/siteService.test.js
server/test/tenantRoutes.test.js

platform/packages/site-schema/src/index.ts
platform/packages/site-components

platform/apps/site-renderer/components/SectionRenderer.tsx

platform/apps/portal/app/businesses/BusinessWebsite.tsx
platform/apps/portal/app/businesses/HeroEditor.tsx
platform/apps/portal/app/businesses/ServicesEditor.tsx
platform/apps/portal/lib/site.ts

Document:

- mutateWorkingHome
- requireHeroIndex
- isHeroSection
- isServicesSection
- findHomePage
- current section insertion patterns
- Hero PATCH semantics
- Services PUT semantics

Determine which existing pattern Contact most naturally resembles.

============================================================
3. SHARED CONTACT SCHEMA
   ============================================================

Evaluate a minimal contract conceptually similar to:

type ContactAction =
| {
type: 'email'
value: string
}
| {
type: 'phone'
value: string
}
| {
type: 'url'
value: string
}

interface ContactContent {
title: string
text?: string
buttonLabel: string
action: ContactAction
}

interface ContactSection {
id: string
type: 'contact'
content: ContactContent
}

Then widen:

SiteSection =
HeroSection
| ServicesSection
| ContactSection

Inspect whether a discriminated action union is the cleanest actual fit.

Do NOT add:

multiple buttons
secondary CTA
icons
images
form configuration
lead form IDs
tracking IDs

yet.

============================================================
4. ACTION SEMANTICS
   ============================================================

Evaluate exact rendering behavior.

EMAIL:
button should navigate using a safe mailto: destination.

PHONE:
button should navigate using tel:.

URL:
button should use a normal external/internal URL as appropriate.

Determine:

- whether links should use <a>
- whether Button supports an asChild/link pattern
- whether a simple styled anchor is cleaner
- safe target/rel behavior for external URLs
- whether URL actions should permit relative URLs or only absolute URLs

Do NOT invent browser-side JS navigation if ordinary links work.

============================================================
5. VALIDATION
   ============================================================

Recommend exact constraints consistent with existing conventions.

Likely:

title:
- required string
- trimmed
- 1..150

text:
- optional string
- trimmed
- max 500
- blank => absent

buttonLabel:
- required string
- trimmed
- 1..80

action:
- required object
- supported type only
- type-specific value validation

EMAIL:
- validate sufficiently to reject obvious invalid values
- do not build a standards-complete email parser

PHONE:
- preserve useful formatting if appropriate but reject blank/obviously invalid
- determine whether normalized storage is beneficial or unnecessary now

URL:
- determine acceptable protocols
- reject dangerous schemes such as javascript:
- decide whether http/https only is safest for this milestone

Return exact error messages matching codebase style.

============================================================
6. EDITING SEMANTICS
   ============================================================

Contact is a single object, so evaluate whether it should use:

PATCH

like Hero

or:

PUT

as complete Contact-section state.

My initial preference is PUT because the editor owns the complete Contact
content object and all its fields are presented together.

However, inspect the actual patterns and recommend the clearest semantics.

Do not choose PATCH merely because Hero uses PATCH.

============================================================
7. ROUTE
   ============================================================

Plan a section-specific endpoint, likely:

PUT /tenants/:tenantId/site/pages/home/sections/contact

PLATFORM_ADMIN only.

Do NOT introduce a generic:

/sections/:sectionId

route yet.

Reuse:

authentication
CSRF
tenant limiter
platform admin middleware

============================================================
8. WORKING MUTATION FOUNDATION
   ============================================================

Reuse:

mutateWorkingHome

The Contact mutator should own only Contact-specific:

validation
identity/invariant logic
insert/update behavior
content transformation

Do not duplicate the Firestore transaction envelope.

============================================================
9. CONTACT IDENTITY / CORRUPTION INVARIANT
   ============================================================

Use canonical reserved identity:

id === 'contact'
type === 'contact'

Since Services established reserved-identity validation, evaluate whether
Contact should use the same strict corruption rule:

any section where:
id === 'contact'
OR
type === 'contact'

must resolve to exactly one canonical Contact section or fail.

Do not silently create duplicates or repair malformed data.

============================================================
10. INSERTION POSITION
    ============================================================

Determine the initial insertion policy.

Current conceptual Home:

Hero
Services

Preferred Contact placement:

LAST section on Home

because CTA/contact generally belongs near the end.

If Services is absent:

Hero
Contact

If future sections exist:

Contact should likely append after current sections.

Inspect actual current section-order assumptions and recommend the smallest
policy.

Do NOT create a general section-ordering framework.

============================================================
11. UPDATE POSITION
    ============================================================

If Contact already exists:

preserve its existing section-array position.

Do not move it on every save.

Insertion policy applies only when first added.

============================================================
12. CONTENT PRESERVATION
    ============================================================

For an existing Contact section:

preserve unknown future section-level/content-level metadata where safe.

Overwrite only editor-owned Contact fields.

Do NOT merge arbitrary request fields.

Clarify whether action should be treated as a fully editor-owned replacement
object.

Likely yes.

============================================================
13. SHARED CONTACT COMPONENT
    ============================================================

Add a generic shared Contact/CTA component in:

@bakerrang/site-components

Render:

title
optional text
button/link

Keep styling neutral and reusable.

No business-specific wording.

No form.

No tracking.

Ensure safe handling of malformed/unsupported action values even though the
server validates them.

============================================================
14. SECTION RENDERER
    ============================================================

Extend SectionRenderer:

hero
services
contact

Unknown types remain safely ignored.

Use discriminated-union narrowing.

============================================================
15. TYPE GUARDS
    ============================================================

Add:

isContactSection

to site-schema if consistent with Step 1.12:

id === 'contact'
type === 'contact'

Use it in portal code where concrete ContactContent access requires narrowing.

Do not create generic casting helpers.

============================================================
16. PORTAL UX
    ============================================================

Extend Manage Website.

If Contact absent:

[ Add Contact ]

If present:

[ Edit Contact ]

Use the already-loaded working SiteDefinition.

No extra GET.

Keep editor modes mutually exclusive.

Current editor modes:

hero
services
null

Extend cleanly for:

contact

Do not build an editor registry yet unless the current code has now reached a
concrete point where a tiny typed representation is obviously simpler.
Prefer a simple union.

============================================================
17. CONTACT EDITOR
    ============================================================

Plan:

ContactEditor.tsx

Fields:

Section Heading
Supporting Text
Button Label
Action Type
Action Value

Action Type options:

Email
Phone
Website URL

Action Value input changes label/help appropriately.

Examples:

Email:
hello@example.com

Phone:
801-555-1234

URL:
https://example.com/contact

Controls:

Cancel
Save Changes

No lead-form option.

No second CTA.

============================================================
18. INITIAL ADD FLOW
    ============================================================

When Contact doesn't exist:

open an in-memory unsaved editor.

Use only neutral defaults.

Potential defaults:

title = "Contact Us"
buttonLabel = "Contact Us"

But evaluate whether even those are desirable.

Do NOT fabricate business-specific claims such as:

"Free estimates"
"Call today"
"24/7 service"

No Firestore write until Save.

============================================================
19. PORTAL API
    ============================================================

Extend:

portal/lib/site.ts

with minimal Contact request types and operation.

Likely:

upsertHomeContact(tenantId, input)

using:

PUT /tenants/.../site/pages/home/sections/contact

Reuse apiSend.

No new network layer.

============================================================
20. SAVE FEEDBACK
    ============================================================

Reuse existing behavior:

DRAFT:
Changes saved.

PUBLISHED:
Saved to the working site. Republish to change the public site.

No persistent dirty state.

============================================================
21. SNAPSHOT ISOLATION
    ============================================================

Mandatory lifecycle test:

Working Home initially has Hero + Services.

Add Contact.

Publish.

Normal public:
Contact visible.

Edit working Contact.

Normal public before Republish:
old Contact still visible.

Authenticated getSite:
new Contact.

DEV preview:
new Contact.

Republish.

Normal public:
new Contact.

No publication code changes should be required because Home.sections is
already snapshotted generically.

============================================================
22. ACTION TESTS
    ============================================================

Backend tests should cover:

valid email action
invalid email action

valid phone action
invalid/blank phone action

valid http URL
valid https URL
dangerous/unsupported URL scheme rejected

unsupported action type rejected

action missing
action malformed
value trimming/normalization as chosen

Also verify action object does not accept arbitrary client fields into stored
content.

============================================================
23. SECTION TESTS
    ============================================================

Cover:

missing site
missing Home
title validation
text trim/blank/remove
buttonLabel validation
Contact inserted at chosen initial position
existing Contact position preserved
reserved identity corruption detection
section/content metadata preservation
working timestamps
status unchanged
published/current unchanged during save
preview behavior
republish behavior
route PLATFORM_ADMIN only

Use existing node:test/FakeDb.

============================================================
24. UI / RENDERER SECURITY
    ============================================================

This milestone introduces user-editable link destinations.

Explicitly inspect for:

javascript:
data:
vbscript:
other unsafe URL schemes

The rendered anchor destination must come only from validated canonical action
data.

Do not dangerouslySetInnerHTML.

React text escaping remains sufficient for text fields.

============================================================
25. MANUAL DEV E2E
    ============================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev
ALLOW_DRAFT_PUBLIC_SITES=false

Use PUBLISHED test site.

Add Contact.

Test at least:

Email or URL action.

Save.

Normal renderer:
old published site.

Preview:
Contact appears and action works.

Disable preview:
Contact disappears/old snapshot returns.

Republish:
Contact public.

Edit Contact text/action.

Normal renderer:
old Contact.

Preview:
new Contact.

Republish:
new Contact public.

Confirm only bakerrang-dev changed.

============================================================
26. FUTURE LEAD FORM
    ============================================================

Explicitly document how a future Step 1.14 internal contact/lead form action
could extend the action union without breaking current content.

Example possibility:

{
type: 'leadForm'
}

But DO NOT implement it now.

Determine whether the current action design leaves a clean extension point.

============================================================
27. OUT OF SCOPE
    ============================================================

Do not plan:

lead persistence
contact form submission
CRM
spam protection
CAPTCHA
email notifications
SMS
generic section API
generic editor registry
multiple CTA buttons
images
icons
analytics tracking
domains
SEO
visual redesign

============================================================
DELIVERABLE
============================================================

Return:

1. Current relevant section/editing architecture.
2. Recommended Contact schema.
3. Exact action union.
4. Action validation/security design.
5. PATCH vs PUT decision.
6. Firestore mutation strategy.
7. Contact invariant handling.
8. Initial insertion policy.
9. Existing-position policy.
10. Content preservation semantics.
11. Shared Contact component design.
12. Files to add.
13. Files to modify.
14. PUT/PATCH route + authorization.
15. Portal ContactEditor.
16. Initial Add Contact UX.
17. Tests.
18. Mandatory snapshot-isolation test.
19. Renderer/security behavior.
20. Verification commands.
21. Manual DEV E2E.
22. Future lead-form compatibility.
23. Concrete risks.
24. Anything this teaches us about generalized section editing.
25. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.