Implement Step 1.13 — Contact / CTA Section.

Claude Code inspected the repository and produced an approved implementation
plan.

Follow Claude's repository findings and plan, with the corrections below
taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Add a reusable Home Contact/CTA section supporting one real visitor action:

EMAIL
PHONE
ABSOLUTE HTTP/HTTPS URL

Do NOT implement:

lead forms
lead persistence
CRM
notifications
spam protection

yet.

The section must remain part of the existing:

working copy
↓
Publish/Republish
↓
published snapshot

architecture.

================================================================
1. SHARED SCHEMA
   ================================================================

Add:

export type ContactAction =
| { type: 'email'; value: string }
| { type: 'phone'; value: string }
| { type: 'url'; value: string }

export interface ContactContent {
title: string
text?: string
buttonLabel: string
action: ContactAction
}

export interface ContactSection {
id: string
type: 'contact'
content: ContactContent
}

Widen:

SiteSection =
HeroSection
| ServicesSection
| ContactSection

Add:

isContactSection(section): section is ContactSection

Canonical identity:

id === 'contact'
&&
type === 'contact'

No secondary CTA, image, icon, form config, or tracking metadata.

================================================================
2. EDITING SEMANTICS
   ================================================================

Use full-state PUT.

Route:

PUT /tenants/:tenantId/site/pages/home/sections/contact

The request describes the complete editor-owned Contact state.

Therefore:

text omitted
-> absent

text blank
-> absent

text nonblank
-> trim + persist

action
-> fully replaced as a canonical server-owned object

Do not use Hero PATCH semantics.

================================================================
3. VALIDATION — CONTENT
   ================================================================

title:

- required string
- trim
- non-empty
- max 150

Errors:

Contact title is required

Contact title must be 150 characters or fewer

text:

- optional string
- trim
- max 500
- absent/blank => absent

Errors:

Contact text must be a string

Contact text must be 500 characters or fewer

buttonLabel:

- required string
- trim
- non-empty
- max 80

Errors:

Contact button label is required

Contact button label must be 80 characters or fewer

Ignore unrelated request fields.

================================================================
4. ACTION OBJECT
   ================================================================

action must be an object.

Supported types:

email
phone
url

Errors:

Contact action is required

Contact action type is not supported

Contact action value is required

Reconstruct the persisted action from approved fields ONLY:

{
type,
value
}

Do not spread arbitrary client action properties.

================================================================
5. EMAIL ACTION
   ================================================================

Email value:

- required string
- trim
- max 254 characters
- pragmatic validation only

Reject obvious invalid addresses.

Also reject URI delimiter/control-style content inappropriate for a plain email
address, including:

?
#
/
whitespace
control characters

We are modeling an email ADDRESS, not arbitrary mailto URI syntax.

Do NOT build an RFC-complete email parser.

Store the trimmed address.

Example stored:

{
type: 'email',
value: 'hello@example.com'
}

Renderer href:

mailto:hello@example.com

================================================================
6. PHONE ACTION
   ================================================================

Phone value:

- required string
- trim
- max 50 characters

Allow ordinary visual formatting:

spaces
(
)
-
.
optional leading +

Derive a canonical dial value by removing visual separators.

Conceptually:

const dialValue = value.replace(/[()\-.\\s]/g, '')

Validate canonical dial value against:

^\+?\d{7,15}$

If invalid:

400 Contact phone is invalid

Store the friendly trimmed display value, not necessarily the stripped value.

Example stored:

{
type: 'phone',
value: '(801) 555-1234'
}

Renderer derives:

tel:8015551234

The renderer should perform the same safe visual-separator removal before
building the href.

No extension modeling yet.

================================================================
7. URL ACTION — IMPORTANT
   ================================================================

URL value:

- required string
- trim
- max 2048 characters
- must parse using new URL(value)
- protocol must be EXACTLY:

http:
or
https:

Reject:

javascript:
data:
vbscript:
ftp:
file:
and all other schemes

Error:

Contact URL must use http or https

Absolute URLs only in Step 1.13.

Relative paths remain unsupported.

IMPORTANT:

Do NOT validate with string prefix matching.

After successful validation, store the canonical:

parsedUrl.toString()

This normalizes cases such as:

HTTPS://EXAMPLE.COM

into a safe canonical absolute URL.

================================================================
8. URL RENDERER DEFENSE-IN-DEPTH
   ================================================================

Do NOT use:

value.startsWith('http')

as the renderer's safety check.

For a URL action, defensively:

1. try new URL(value)
2. require protocol === 'http:' || protocol === 'https:'
3. return parsed.toString()
4. otherwise return null

This must work regardless of URL scheme casing.

Normal persisted data should already be canonical, but the renderer must fail
closed if old/manually-corrupted data reaches it.

================================================================
9. RUNTIME-MALFORMED ACTION SAFETY
   ================================================================

TypeScript's ContactContent type is compile-time only.

The renderer receives JSON data that could theoretically be malformed due to:

manual Firestore edits
old data
future migration bugs

Therefore the Contact component / href helper must safely handle runtime cases
such as:

action missing
action null
action not an object
missing type/value
unsupported type

without throwing.

Result:

render title/text if possible
omit CTA link

Do NOT introduce a runtime-schema framework solely for this.

A small defensive helper is sufficient.

================================================================
10. CONTACT SERVICE
    ================================================================

Add:

upsertHomeContact(tenantId, input)

Reuse:

mutateWorkingHome

Do not duplicate transaction/read/write mechanics.

Purely validate/normalize input first.

Then transform sections.

No direct Firestore transaction handle in the Contact transformation.

================================================================
11. RESERVED CONTACT IDENTITY
    ================================================================

Reserved identity:

id === 'contact'
type === 'contact'

Scan Contact-related sections using:

id === 'contact'
OR
type === 'contact'

Valid:

none
-> insert

exactly one canonical Contact
-> update

Invalid:

multiple Contact-related sections

id='contact' with wrong type

type='contact' with wrong id

Failure:

500 Home contact section invalid

No automatic repair.

No silent duplicate creation.

================================================================
12. INSERTION / POSITION
    ================================================================

When Contact does not exist:

append it as the LAST current Home section.

Examples:

Hero
Contact

or:

Hero
Services
Contact

or future:

Hero
Services
Other
Contact

Do NOT build an ordering framework.

When Contact already exists:

replace it at its existing array index.

Do not reposition it during edits.

================================================================
13. CONTENT PRESERVATION
    ================================================================

For existing Contact:

preserve unknown section-level fields.

Preserve unknown content-level fields.

Overwrite editor-owned:

title
text
buttonLabel
action

Because PUT owns these fields:

text absent/blank means delete text.

Action is replaced wholesale, never spread-merged.

Do not merge arbitrary request fields.

================================================================
14. WORKING-COPY / LIFECYCLE
    ================================================================

Reuse mutateWorkingHome.

A Contact save must update:

home.updatedAt
config.updatedAt

using the shared timestamp.

Do NOT modify:

config.status
publication audit metadata
published/current

DRAFT stays DRAFT.

PUBLISHED stays PUBLISHED.

================================================================
15. PUBLISHING
    ================================================================

No publishSite architecture change expected.

Contact is part of:

home.sections

and therefore should automatically be included in the next snapshot through
toSiteDefinition.

Verify this through tests.

Do not special-case Contact in publishing.

================================================================
16. SHARED CONTACT COMPONENT
    ================================================================

Add:

@bakerrang/site-components/Contact

Render:

title
optional text
CTA anchor

No form.

No tracking.

No business-specific copy.

No dangerouslySetInnerHTML.

React escaping remains sufficient for text.

CTA href generation:

email:
mailto:<validated email>

phone:
tel:<canonical dial value>

url:
defensively parsed http/https absolute URL

Malformed runtime action:

no CTA link

Do not crash the public page.

================================================================
17. URL TARGET BEHAVIOR
    ================================================================

Claude proposed opening URL actions in a new tab.

That is acceptable for Step 1.13.

If implemented:

target="_blank"
rel="noopener noreferrer"

must remain paired.

Email and phone actions should not use target=_blank.

Do not introduce JS navigation.

================================================================
18. SECTION RENDERER
    ================================================================

Extend SectionRenderer:

hero
services
contact

Unknown section type:

return null

Use the discriminated union.

No renderer Firestore access.

================================================================
19. PORTAL API
    ================================================================

Extend portal/lib/site.ts with minimal types:

ContactActionInput

ContactInput

and:

upsertHomeContact(tenantId, input)

using existing apiSend and:

PUT /tenants/${encodeURIComponent(tenantId)}/site/pages/home/sections/contact

No new networking layer.

================================================================
20. PORTAL CONTACT EDITOR
    ================================================================

Add:

ContactEditor.tsx

Use the already-loaded working SiteDefinition.

No additional GET.

Use:

findHomePage
isContactSection

Fields:

Section Heading
Supporting Text
Button Label
Action Type
Action Value

Action types presented as:

Email
Phone
Website URL

Action-value help/placeholder changes appropriately.

================================================================
21. PORTAL INPUT CONSTRAINTS
    ================================================================

Mirror obvious limits for UX:

title maxLength=150
text maxLength=500
buttonLabel maxLength=80

Action value:

email maxLength=254
phone maxLength=50
url maxLength=2048

Server remains authoritative.

Do not add a form framework.

================================================================
22. INITIAL ADD CONTACT
    ================================================================

When Contact is absent:

show:

Add Contact

Open editor with neutral in-memory defaults:

title = Contact Us
text = ''
buttonLabel = Contact Us
action type = email
action value = ''

These defaults are acceptable.

Do not fabricate:

free estimates
24/7
same-day service
other business claims

No Firestore write until Save succeeds.

================================================================
23. BUSINESS WEBSITE
    ================================================================

Extend:

EditorMode

to:

'hero'
| 'services'
| 'contact'
| null

No generic editor registry.

Show:

Add Contact

or:

Edit Contact

based on loaded working SiteDefinition.

Editors remain mutually exclusive.

Reuse existing saved-vs-live feedback.

================================================================
24. SAVE FEEDBACK
    ================================================================

DRAFT:

Changes saved.

PUBLISHED:

Saved to the working site. Republish to change the public site.

No persistent dirty-state tracking.

================================================================
25. REQUIRED ACTION TESTS
    ================================================================

Cover:

EMAIL:
valid email
invalid email
email >254
email with URI/query delimiters rejected where inappropriate
whitespace/control-invalid email rejected

PHONE:
valid formatted phone
canonical dial derivation
blank phone
invalid phone chars
multiple/misplaced plus rejected
fewer than 7 digits rejected
more than 15 canonical digits rejected
display value >50 rejected

URL:
valid http
valid https
uppercase/mixed-case scheme accepted and canonicalized
URL >2048 rejected
javascript rejected
data rejected
vbscript rejected
ftp rejected
relative URL rejected
malformed URL rejected

ACTION:
missing action
non-object action
unsupported type
missing/non-string value
extra client action fields dropped

================================================================
26. CONTACT SECTION TESTS
    ================================================================

Cover:

missing site

missing Home

title validation

text trim/blank/absent

button label validation

inserted last on first add

existing position preserved

reserved identity corruption handling

section metadata preservation

content metadata preservation

home/config timestamp synchronization

DRAFT status preserved

PUBLISHED status preserved

published/current unchanged during edit

preview returns working Contact

republish updates public Contact

PUT route PLATFORM_ADMIN only

Existing Hero and Services suites must remain green.

================================================================
27. SNAPSHOT LIFECYCLE TEST
    ================================================================

Mandatory:

1. Existing working Hero + Services.
2. Add Contact.
3. Publish.
4. Normal public contains Contact A.

5. Edit working Contact to Contact B.

6. Capture/compare published/current.

7. Normal public remains Contact A.

8. Authenticated getSite returns Contact B.

9. DEV preview returns Contact B.

10. published/current unchanged before Republish.

11. Republish.

12. Normal public returns Contact B.

================================================================
28. FUTURE LEAD FORM
    ================================================================

Preserve the discriminated union as a clean extension point.

Future:

{ type: 'leadForm' }

may be added later.

Do NOT add it now.

Existing email/phone/url content must remain backward compatible when the union
eventually widens.

================================================================
29. VERIFY
    ================================================================

Backend:

cd server
npm test

Run scoped StandardJS/syntax verification according to repository conventions.

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

All existing portal/renderer/schema/components must remain green.

================================================================
30. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev
ALLOW_DRAFT_PUBLIC_SITES=false

PUBLISHED site:

1. Manage Website.
2. Add Contact.
3. Configure at least one real test action.
4. Save.

Normal renderer:
old snapshot/no Contact.

5. Enable preview.
6. Contact appears.
7. Click CTA and verify the actual href behavior.

8. Disable preview.
9. Old snapshot returns.

10. Republish.
11. Contact now public.

12. Edit Contact text/action.
13. Normal renderer remains old Contact.
14. Preview shows new Contact.
15. Republish.
16. New Contact becomes public.

Test at least one second action type if convenient, particularly URL or phone.

Confirm only bakerrang-dev changed.

================================================================
31. OUT OF SCOPE
    ================================================================

Do not implement:

leadForm action
lead submission
CRM
contact form
spam protection
CAPTCHA
email notifications
SMS
generic section route
editor registry
dynamic forms
secondary CTA
icons
images
analytics tracking
domains
SEO
visual redesign

================================================================
32. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Contact schema/action union.
4. PUT semantics.
5. Exact validation behavior.
6. Email safety behavior.
7. Phone canonical dialing behavior.
8. URL canonicalization and protocol validation.
9. Runtime malformed-action defense.
10. Contact invariant handling.
11. Insertion/position behavior.
12. Content/metadata preservation.
13. Contact component behavior.
14. Portal editor.
15. Snapshot isolation.
16. Action test results.
17. Backend tests.
18. Platform typecheck/lint/build.
19. Manual DEV verification if performed.
20. Deviations and why.
21. Anything influencing Step 1.14 lead capture.

Do not implement beyond Step 1.13.