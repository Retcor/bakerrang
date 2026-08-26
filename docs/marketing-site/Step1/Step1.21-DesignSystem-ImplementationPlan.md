Implement Step 1.21 — Public Website Design System + Tenant Branding.

Claude Code inspected the shipped repository and produced an approved plan.

Follow Claude's plan, with the corrections below taking precedence.

Do not expand scope.

================================================================
GOAL
================================================================

Introduce the first deliberate public-site visual system plus tenant branding.

Implement:

- tenant site name
- primary color
- accent color
- optional tenant Media logo
- working/published branding lifecycle
- public CSS token system
- branded site shell
- header/navigation
- mobile navigation
- footer
- visual redesign of Hero/Services/Gallery/Testimonials/Contact
- branded Lead Form page

Do NOT implement:

custom domains
full SEO
Google Business Profile
external reviews
analytics
theme marketplace
font picker
per-section styling
custom CSS
page builder
multiple pages
portal redesign
animation framework

================================================================
1. BRANDING MODEL
   ================================================================

Persist on:

tenants/{tenantId}/site/config

branding:

{
siteName,
primaryColor,
accentColor,
logoMediaId?
}

No per-section branding.

No:

font
secondaryColor
background config
custom CSS
raw style strings

================================================================
2. SHARED SITE BRANDING TYPE
   ================================================================

Add SiteBranding:

{
siteName: string
primaryColor: string
accentColor: string
logoMediaId?: string

// read-time only
logoSrc?: string
logoWidth?: number
logoHeight?: number
}

SiteDefinition should expose branding in server/API responses.

Persisted branding must NEVER contain:

logoSrc
logoWidth
logoHeight
objectName
bucket
public GCS URL

================================================================
3. BRANDING LIFECYCLE
   ================================================================

Branding participates fully in the existing working/published model.

Save Branding:
WORKING only

Preview:
working branding

Normal public:
published branding

Republish:
promotes working branding

published/current must contain the provider-neutral branding snapshot:

siteName
primaryColor
accentColor
logoMediaId?

No resolved logo URL/dimensions persisted.

Do not create another branding publication mechanism.

================================================================
4. BRANDING ENDPOINT
   ================================================================

Add:

PUT /tenants/:tenantId/site/branding

PLATFORM_ADMIN only.

Full-state input:

{
siteName,
primaryColor,
accentColor,
logoMediaId?
}

Return hydrated working SiteDefinition.

No public branding mutation route.

No CMS permission broadening.

================================================================
5. SITE NAME
   ================================================================

Validation:

required string
trim
1..80

Do NOT modify tenant.name when branding changes.

Public siteName is independently editable.

================================================================
6. INITIAL SITE NAME — REQUIRED CORRECTION
   ================================================================

Existing tenant names may exceed the new 80-character public siteName limit.

Do NOT assume:

tenant.name.length <= 80

When initializing a NEW site derive the default safely:

tenant.name.trim().slice(0, 80)

Persist that as branding.siteName.

Do NOT modify or truncate tenant.name itself.

Legacy/read-time fallback from Hero title may likewise produce a safe
max-80-character SiteBranding value, but must NOT persist a repair.

================================================================
7. COLORS
   ================================================================

Persist exactly:

#RRGGBB

case-insensitive input
normalize lowercase

Reject:

#fff
named colors
rgb()
hsl()
var()
CSS expressions
javascript:
non-string values

No user-controlled arbitrary CSS.

================================================================
8. PRIMARY + ACCENT BOTH HAVE REAL SEMANTICS
   ================================================================

Primary Color and Accent Color must BOTH visibly affect the public theme.

Primary:

use for the dominant brand action/emphasis, such as:

primary CTA
primary action/button treatment
strong header brand treatment where appropriate

Accent:

use as a restrained secondary brand element, for example:

Hero eyebrow/accent treatment
SectionHeading marker/rule
selected decorative emphasis
link hover/focus accent

Exact visual choice is implementation-driven, but Accent Color must not be a
dead setting.

Do NOT expose a Branding editor control whose value is never consumed.

Keep system-owned:

background
surface
foreground
muted
border

neutral and readable.

================================================================
9. CONTRAST FOREGROUND
   ================================================================

Derive readable foreground for tenant-controlled fill colors using proper WCAG
relative luminance.

Return whichever of:

#ffffff
#111827

provides better contrast.

Do not trust the tenant to configure text color.

Do not persist derived foreground colors.

Do not reject otherwise valid primary/accent values merely because one
foreground choice is poor; derive the better foreground.

Keep this a pure tested/helper function where practical.

================================================================
10. DEFAULT THEME
    ================================================================

Use a neutral professional public default.

Do NOT use BakerRang yellow/black as every customer's theme.

Defaults may follow Claude's proposed slate values.

Existing legacy sites with no branding must render cleanly using defaults.

No migration required.

================================================================
11. INITIALIZATION
    ================================================================

New site initialization should write branding with:

safe siteName derived from tenant.name
default primary
default accent

No logo.

Existing sites must NOT require migration.

================================================================
12. LEGACY WORKING SITE BACKWARD COMPATIBILITY
    ================================================================

If config.branding is missing:

return a valid SiteBranding at READ TIME.

Suggested siteName fallback:

canonical Hero title if valid
otherwise "Website"

Bound to siteName max length.

Default colors.

Do NOT persist the fallback.

Malformed stored colors likewise default safely for presentation without a
write-back repair.

================================================================
13. PRE-1.21 PUBLISHED SNAPSHOT COMPATIBILITY
    ================================================================

This is critical.

Existing published/current.siteDefinition documents do NOT contain branding.

Normal public requests for those snapshots must still work.

Default branding must be computed from the PUBLISHED SNAPSHOT data itself.

Do NOT derive a published site's fallback name/color from the current working
site in a way that could leak working changes into normal public traffic.

No migration.

No persisted repair.

Explicit automated test required.

================================================================
14. LOGO
    ================================================================

Support optional:

branding.logoMediaId

Logo must reference existing same-tenant immutable Media.

No arbitrary external URL.

No separate logo binary endpoint.

Upload continues to use:

POST /tenants/:tenantId/media

Logo alternative text:

branding.siteName

No separate logoAltText field in V1.

================================================================
15. MEDIA GENERALIZATION
    ================================================================

Logo is now the second real Media consumer after Gallery.

Make only the smallest justified generalization.

Generalize same-tenant Media validation from Gallery-specific logic into a
reusable operation such as:

requireTenantMedia

Update Gallery to use it without changing Gallery behavior.

Do NOT build a generic asset framework.

================================================================
16. MEDIA HYDRATION
    ================================================================

Extend existing SiteDefinition Media hydration to resolve BOTH:

Gallery mediaIds
branding.logoMediaId

Collect all required ids and perform ONE batched Firestore getAll operation.

No N+1.

Hydrated Branding may contain:

logoSrc
logoWidth
logoHeight

Internal Media fields must never escape.

Missing/malformed Logo Media:

omit hydrated logo fields
render siteName fallback

Do not crash the site.

================================================================
17. EXISTING LOGO OUTSIDE MEDIA RECENT-50 — REQUIRED
    ================================================================

Media library remains bounded.

If branding.logoMediaId references Media that is older than the most recent 50
library records:

BrandingEditor must still:

display the current hydrated logo
preserve the current logo when editing unrelated branding fields
allow Remove Logo

Absence from the recent Media picker MUST NOT mean the current logo is removed.

The already-hydrated SiteBranding is authoritative for the current selection.

Test/manually verify this behavior where practical.

================================================================
18. BRANDING EDITOR
    ================================================================

Add:

BrandingEditor.tsx

Use already-loaded SiteDefinition.

No extra site GET just to open.

Fields:

Site Name

Primary Color:
native color input + #RRGGBB text field

Accent Color:
native color input + #RRGGBB text field

Logo:
optional Media selection
inline upload may reuse existing Media upload endpoint
Remove Logo

Save
Cancel

No embedded site preview.

Existing Preview remains the authoritative preview.

================================================================
19. PUBLIC SITE TOKEN LAYER
    ================================================================

Create a public-site token stylesheet owned by:

@bakerrang/site-components

NOT by the portal UI.

Conceptual contract:

--site-primary
--site-primary-foreground

--site-accent
--site-accent-foreground

--site-background
--site-surface
--site-foreground
--site-muted
--site-muted-foreground
--site-border

--site-radius
--site-content-width
--site-section-space
--site-font-sans

Tenant branding overrides only the intended brand subset.

System controls all remaining tokens.

No raw tenant CSS.

================================================================
20. TAILWIND INTEGRATION
    ================================================================

Keep the existing Tailwind v4 architecture.

Do NOT introduce:

CSS modules as a new system
styled-components
another CSS framework

Map public utility colors/tokens onto --site-* variables.

Production build MUST prove custom-property indirection works.

If Tailwind's generated variables do not cascade as expected, use Claude's
fallback of overriding the generated --color-* properties from SiteShell while
keeping --site-* as the documented theme contract.

Do not ship an unverified dev-only token arrangement.

================================================================
21. ACCENT UTILITY / CONSUMPTION
    ================================================================

Because primary and accent are separate settings, create an intentional way for
components to consume BOTH.

Do not map every existing "accent" utility to primary and then leave
--site-accent unused.

For example, introduce a public-site-specific Tailwind token/utility for the
secondary accent or use var(--site-accent) directly in a restrained shared
primitive.

Keep naming clear.

================================================================
22. SITE PRIMITIVES
    ================================================================

Add public primitives as appropriate:

SiteContainer
SiteSection
SectionHeading

These own:

content width
horizontal padding
vertical section rhythm
section headings
canonical anchors

Public sections should stop independently inventing page-level padding and
background structure.

Do not change portal primitives.

================================================================
23. SITE SHELL
    ================================================================

Add:

SiteShell

Conceptually:

SiteHeader
main
SiteFooter

Use on:

Home page
Contact Lead Form page

SiteShell owns tenant CSS-variable overrides.

Home and Contact Form should visibly belong to the same business site.

================================================================
24. SERVER/CLIENT BOUNDARY — REQUIRED CORRECTION
    ================================================================

SiteHeader needs client state only for the mobile menu.

Do NOT pass the complete Home page / SiteDefinition into the client Header just
to derive navigation.

SiteShell is a server component.

Derive a small navigation/display model SERVER-SIDE first.

Conceptual:

NavItem {
id
label
href
}

Then pass to SiteHeader:

siteName
logo display fields
navItems
contactCtaHref if applicable

Do not serialize Gallery/Services/Testimonials/Contact content across the
client boundary merely to generate navigation.

SiteFooter can consume the same server-derived navigation model.

================================================================
25. NAVIGATION SOURCE
    ================================================================

Derive navigation exclusively from the ACTUAL ordered Home.sections supplied by
the current SiteDefinition.

No persisted navigation config.

No second order model.

Normal public:

published Home composition

Preview:

working Home composition

Therefore nav automatically follows working/published lifecycle.

================================================================
26. NAV LABELS
    ================================================================

Use stable system labels for V1:

Services
Gallery
Testimonials
Contact

Do not use arbitrary section title text as nav labels.

Do not add editable navigation labels.

Hero has no ordinary nav entry.

================================================================
27. CONTACT HEADER DUPLICATION — REQUIRED CORRECTION
    ================================================================

When Contact exists, the header should NOT render both:

Contact
[Contact]

Represent Contact ONCE.

Preferred desktop behavior:

ordinary nav:
Services
Gallery
Testimonials

primary CTA:
Contact

For mobile:
Contact also appears exactly once, either as the CTA-styled item or the normal
menu item — not both.

Footer may include a normal Contact link.

If Contact does not exist:

no Contact nav
no Contact CTA

================================================================
28. NAV ANCHORS
    ================================================================

Canonical Home anchors:

#services
#gallery
#testimonials
#contact

Hero:

#top

Anchors derive from canonical section identity, never user-entered text.

On Home:

href="#services"

On Contact Form page:

href="/site/{tenantId}#services"

Do not emit broken same-page anchors on the separate Contact page.

================================================================
29. MOBILE NAV
    ================================================================

Use a small client component.

Requirements:

real button
aria-expanded
aria-controls
aria-label
keyboard operable
visible focus state
closes when navigation link selected

No animation framework.

No offcanvas dependency.

No unnecessary focus-trap framework for a simple inline expanded menu.

================================================================
30. HEADER IDENTITY
    ================================================================

Header displays:

hydrated Logo when available

otherwise:
siteName wordmark/text

Logo:

intrinsic dimensions if available
constrained maximum height/width
preserve aspect ratio
no stretching
no cropping required

Logo alt:

siteName

================================================================
31. CONTACT HEADER CTA
    ================================================================

When Contact exists:

Header Contact CTA points to the Contact SECTION.

Home:

#contact

Contact Form route:

/site/{tenantId}#contact

It must NOT directly reproduce:

phone
email
URL
leadForm

Contact section remains the owner of the actual business action semantics.

================================================================
32. FOOTER
    ================================================================

Add a simple public footer:

siteName
copyright/current year
derived navigation
Contact once if present

No:

invented address
social links
provider information

Do NOT add "Powered by BakerRang" in 1.21.

Defer that to a product/plan decision.

================================================================
33. HERO
    ================================================================

Visual redesign only.

No Hero schema change.

Use:

strong h1
subtitle
existing content

Existing ctaLabel:

if present AND Contact exists:
render functional link to #contact

if Contact absent:
hide CTA

Do NOT render a dead button.

Do not invent a target/action field.

Hero owns the sole h1.

================================================================
34. SERVICES
    ================================================================

Use shared section primitives.

Responsive readable cards/grid.

No invented icons.

No content-schema changes.

================================================================
35. GALLERY
    ================================================================

Use shared section primitives.

Responsive consistent grid.

Preserve:
alt
width
height
loading=lazy

Use reasonable crop/aspect treatment such as 4:3 + object-cover if visually
appropriate.

No lightbox.

No carousel.

No new Media behavior.

================================================================
36. TESTIMONIALS
    ================================================================

Use shared section primitives.

Maintain:

figure
blockquote
figcaption

No stars.

No fake review-provider appearance.

Responsive readable layout.

================================================================
37. CONTACT
    ================================================================

Use shared section primitives.

Keep all existing action semantics:

email
phone
url
leadForm

Presentation may improve.

Behavior must not change.

================================================================
38. SECTION RHYTHM
    ================================================================

Do not persist section style choices.

Prefer uniform site background + consistent section spacing/dividers/surfaces
that remain coherent under arbitrary section reordering.

Do NOT implement index-alternating backgrounds in 1.21.

Composition is user-controlled and some sections may render null.

================================================================
39. LEAD FORM PAGE
    ================================================================

Wrap the dedicated:

/site/[tenantId]/contact

page in SiteShell.

Use same:

branding
header
footer
typography
public form control styling

Do NOT alter Lead POST behavior.

Do NOT alter honeypot/rate limiting/eligibility/public boundary.

This is presentation only.

================================================================
40. BASIC METADATA
    ================================================================

It is acceptable to replace placeholder page title with:

branding.siteName

because this is effectively free once SiteDefinition branding exists.

Do NOT expand into:

SEO description editor
canonical
OpenGraph
JSON-LD
sitemap
robots

Those belong later.

If generateMetadata would force significant duplicated API/data plumbing,
prefer the smallest correct implementation rather than expanding Step 1.21.

================================================================
41. BRANDING SNAPSHOT TEST
    ================================================================

Required:

working branding A

publish

normal public:
A

edit working branding B

preview:
B

normal public:
A

published/current bytes unchanged

republish

normal public:
B

Provider-specific logo hydration fields must never be persisted in snapshot.

================================================================
42. LOGO HYDRATION TEST
    ================================================================

Logo + Gallery should resolve in the same batched media hydration operation.

Working getSite:
logo hydrated

Preview:
logo hydrated

Published:
logo hydrated

Stored working config:
mediaId only

Stored published snapshot:
mediaId only

Public response:
safe logo src/dimensions only

No internal Media metadata.

================================================================
43. LEGACY TEST
    ================================================================

Existing site with:

no config.branding

must still render valid branding.

Existing pre-1.21 published snapshot with:

no SiteDefinition.branding

must still render valid branding based solely on that published snapshot /
safe defaults.

No write repair.

No migration.

================================================================
44. AUTHORIZATION
    ================================================================

Branding PUT:

PLATFORM_ADMIN allowed

OWNER 403
ADMIN 403
STAFF 403
unauthenticated 401

No public mutation route.

================================================================
45. EXISTING FEATURES UNCHANGED
    ================================================================

Do not change behavior of:

section composition
Hero persistence
Services persistence
Gallery persistence
Testimonials persistence
Contact actions
Media immutability
Media upload
Lead capture
Lead Inbox
Lead Status
Lead Notes
publish/unpublish

All previous tests remain green.

================================================================
46. EXPECTED FILES
    ================================================================

Claude's proposed files are generally approved.

Add:

site-theme.css
SiteShell
SiteHeader
SiteFooter
branding helper
BrandingEditor
branding tests

Public primitives may be separate files if cleaner.

Modify:

siteService
mediaService
tenant routes/tests
site schema
site-components exports
renderer globals/layout/Home/Contact page
SectionRenderer
five public section components
portal site API
BusinessWebsite

Do not add unrelated infrastructure.

================================================================
47. VERIFY
    ================================================================

Backend:

cd server
npm test

repo-appropriate StandardJS/syntax checks

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

Production build is particularly important because of Tailwind v4 CSS-variable
theme behavior.

================================================================
48. MANUAL DEV E2E
    ================================================================

Use:

FIRESTORE_PROJECT_ID=bakerrang-dev
MEDIA_BUCKET_NAME=<existing DEV bucket>

1. Open Branding.

2. Verify current/default values.

3. Set distinctive Primary and Accent colors.

4. Save.

5. Verify BOTH colors visibly influence different intentional parts of Preview.

6. Normal public still uses previous branding.

7. Preview uses new:
   header
   nav
   Hero
   Services
   Gallery
   Testimonials
   Contact
   footer.

8. Verify Lead Form page uses same shell/theme.

9. Verify mobile nav:
   accessible button
   no duplicated Contact
   no overflow.

10. Republish.

11. Normal public receives branding.

12. Reorder working sections.

13. Preview nav follows working order.

14. Normal nav retains published order.

15. Republish.

16. Normal nav updates.

17. Remove section.

18. Preview nav removes entry.

19. Normal public keeps entry until republish.

20. Test logo:
    choose/upload tenant Media
    save branding
    persisted config has logoMediaId only
    preview shows logo
    republish promotes logo.

21. If practical, seed/use a logo older than recent-50 media results:
    Branding editor still shows/preserves/removes the current logo.

22. Remove logo:
    header falls back to siteName.

23. Existing site/snapshot lacking branding:
    default theme renders.

24. Hero CTA:
    with Contact -> functional
    without Contact -> hidden.

25. Contact page header nav points back to:
    /site/{tenantId}#...

26. Lead submission remains unchanged.

27. Confirm only bakerrang-dev + existing DEV bucket changed.

================================================================
49. DEFER
    ================================================================

Do NOT implement:

full SEO
custom domains
LocalBusiness JSON-LD
OpenGraph
robots
sitemap
provider reviews
analytics
font picker
theme templates
social links
custom CSS
per-section themes
background images
animations
page templates
multi-page CMS
portal redesign

================================================================
50. FINAL REPORT
    ================================================================

Report:

1. Files added.
2. Files modified.
3. Branding model.
4. Initialization/default behavior.
5. Legacy snapshot behavior.
6. Branding endpoint/auth.
7. Color validation.
8. Primary/accent consumption.
9. Contrast helper.
10. Logo Media reuse.
11. Media generalization.
12. Batch hydration.
13. Existing-logo-outside-recent-50 behavior.
14. Working/published lifecycle.
15. Public token system.
16. Site primitives.
17. Site shell.
18. Server/client header boundary.
19. Navigation derivation.
20. Contact deduplication.
21. Mobile nav.
22. Footer.
23. Hero CTA behavior.
24. Section redesigns.
25. Lead Form page.
26. Basic metadata.
27. Accessibility.
28. Tests.
29. Backend result.
30. Platform build/lint/typecheck.
31. Manual DEV verification if performed.
32. Deviations.
33. Anything influencing Step 1.22.

Do not implement beyond Step 1.21.