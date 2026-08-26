# Claude Code Assignment — Step 1.21 Public Website Design System + Tenant Branding

DO NOT modify code.

Steps 1.7–1.20 are complete and manually verified.

The BakerRang platform now has a working CMS/public-site engine with:

Hero
Services
Gallery
Testimonials
Contact

Media upload
Working/published snapshots
Section composition/order/removal
Lead capture
Basic CRM

The next milestone deliberately shifts from CMS mechanics to:

PUBLIC WEBSITE DESIGN SYSTEM + TENANT BRANDING

This should make public sites look coherent and intentional while preserving
the existing content model and architecture.

============================================================
1. GOAL
   ============================================================

Design the smallest correct public-site visual system that gives every tenant:

- consistent typography
- consistent spacing
- consistent content width
- consistent buttons/links
- coherent section rhythm
- responsive layout
- a real site header
- a real site footer
- tenant-specific brand colors
- tenant-specific business/site identity

without introducing a full visual page builder or arbitrary per-section style
controls.

This milestone should establish the reusable design foundation for future
public-site work.

============================================================
2. IMPORTANT PRODUCT DIRECTION
   ============================================================

The platform is for local businesses.

The visual system should support sites for businesses such as:

contractors
installers
landscapers
cleaners
painters
service companies
small professional businesses

The result should feel:

professional
trustworthy
modern
clear
conversion-oriented

NOT:

generic SaaS dashboard
experimental portfolio
flashy startup landing page
over-animated agency template

This is the public CUSTOMER-FACING website, not the BakerRang admin portal.

============================================================
3. INSPECT CURRENT IMPLEMENTATION
   ============================================================

Inspect actual shipped code:

platform/apps/site-renderer/*
platform/packages/site-components/*
platform/packages/site-schema/*
platform/packages/ui/*

Current:

Hero
Services
Gallery
Testimonials
Contact
SectionRenderer
site/[tenantId]/page.tsx
contact lead-form page

Inspect:

global CSS
Tailwind usage/config
CSS modules if any
shared tokens
font setup
layout.tsx
metadata usage
current component markup
current responsive behavior
current Button/Container primitives
current public page wrappers

Also inspect server site model:

server/services/siteService.js
tenant model
site config
current public API response

Determine what site/business identity data currently exists and what would be
needed for branding.

============================================================
4. CURRENT BRANDING READINESS
   ============================================================

Document whether the platform currently stores any of:

business display name
site name
logo media
primary color
secondary color
accent color
font choice
phone/address
header navigation config
footer content

Do NOT assume fields exist.

Identify which existing tenant/site fields can be reused safely.

============================================================
5. PRIMARY ARCHITECTURAL QUESTION — WHERE BRANDING LIVES
   ============================================================

Evaluate the correct persistence location for tenant/site-wide branding.

Potential:

tenants/{tenantId}/site/config

or another site-level document.

Possible branding model:

branding: {
siteName,
primaryColor,
accentColor,
logoMediaId?
}

Do NOT put branding separately on each section.

Branding is site-wide.

Recommend exact storage location and schema.

============================================================
6. MINIMAL BRANDING CONTRACT
   ============================================================

Determine the smallest V1 branding model.

My initial preference:

siteName / business display name
primaryColor
accentColor
logoMediaId? (optional)

Possibly:

backgroundStyle?
textColor?

But avoid excessive controls.

Do NOT implement arbitrary:

per-section colors
per-section fonts
custom CSS
hex controls everywhere
theme JSON blobs
visual builder settings

Recommend exact fields.

============================================================
7. COLOR MODEL
   ============================================================

Evaluate whether tenants should choose:

A. primary color only, with system-derived shades

B. primary + accent

C. primary + secondary + accent

Prefer a small controlled model.

The design system should derive the rest:

foreground
muted foreground
background
surface
border
hover states
button contrast

Do not ask users to configure 15 design tokens.

============================================================
8. COLOR VALIDATION
   ============================================================

If storing colors:

define canonical format.

Potential:

#RRGGBB only

Validate server-side.

Reject:

named colors
rgb()
hsl()
CSS variables
javascript:
arbitrary CSS values

No user-controlled raw CSS.

Determine exact validation.

============================================================
9. COLOR CONTRAST / ACCESSIBILITY
   ============================================================

This matters.

If a tenant chooses a light/dark primary color, CTA text must remain readable.

Evaluate whether V1 should:

- derive black/white foreground based on luminance
- reject colors that cannot produce accessible contrast
- use a known contrast helper

Recommend the smallest reliable approach.

Do not let tenant configuration create unreadable buttons.

============================================================
10. BRANDING DEFAULTS
    ============================================================

A site must look good even before branding is configured.

Define platform defaults.

Do NOT invent random colors per tenant.

Potential neutral/default brand:

professional dark/slate + restrained accent

Choose based on current design tokens/code.

If BakerRang-specific yellow/black exists in portal/shared UI, evaluate whether
that should remain BakerRang admin branding rather than becoming every client
site's default.

Likely:
public-client defaults should be neutral and not branded as BakerRang.

============================================================
11. LOGO DECISION
    ============================================================

Step 1.18 already provides tenant Media.

Evaluate optional site logo:

branding.logoMediaId

If supported:

must reference same-tenant Media
immutable Media model
hydrated like Gallery
no duplicated object metadata
contextual alt text considerations

Potential branding fields:

logoMediaId?
logoAltText?

or use siteName as alt.

Determine whether logo belongs in 1.21 or should be deferred.

My preference:
include optional logo if media reuse is clean.

============================================================
12. SECOND MEDIA CONSUMER
    ============================================================

If Logo uses Media, this becomes the second actual Media consumer.

Step 1.19 deliberately did not trigger media generalization.

Now evaluate whether Step 1.21 legitimately justifies generalizing:

Gallery-specific media validation
Gallery-specific hydration

into a small reusable tenant-media-reference operation.

Potential consumers now:

Gallery items
Brand logo

Do NOT build a generic asset pipeline.

Extract only what two actual consumers now share.

============================================================
13. SITE HEADER
    ============================================================

Public sites currently need a real header.

Design a shared:

SiteHeader

Potential contents:

logo or siteName
navigation
primary Contact CTA

Keep V1 simple.

Navigation should likely derive from sections currently present.

Example:

Services
Gallery
Testimonials
Contact

Hero does not need nav item.

Determine whether navigation should be:

derived automatically from current Home.sections

or persisted separately.

My preference:

derive it.

Avoid another navigation configuration model yet.

============================================================
14. NAVIGATION LABELS
    ============================================================

If nav is derived:

Services -> Services
Gallery -> Gallery / Projects?
Testimonials -> Testimonials
Contact -> Contact

Evaluate whether using section content.title is better than fixed labels.

Potentially:

nav label = section.content.title

But long/custom section headings may make poor nav labels.

Recommend smallest robust V1.

Do not add editable nav-label fields unless actually necessary.

============================================================
15. NAVIGATION LINKS
    ============================================================

Public Home sections should have stable anchor ids.

Potential:

#services
#gallery
#testimonials
#contact

Hero:
#top

Ensure ids are canonical and derived from section identity, not arbitrary
user-entered strings.

Header navigation should scroll/link to these anchors.

============================================================
16. CONTACT CTA IN HEADER
    ============================================================

Evaluate whether header should display:

Contact

as a CTA when Contact section exists.

Potential behavior:

Contact exists:
show CTA to #contact

No Contact:
no CTA

Do NOT duplicate Contact action semantics into the Header in V1 unless needed.

Avoid making header directly execute phone/email/leadForm logic if a simple
scroll-to-contact is cleaner.

============================================================
17. MOBILE HEADER
    ============================================================

Need responsive navigation.

Evaluate minimal V1:

desktop nav links
mobile menu button
simple expanded menu

No animation framework.

No complex offcanvas dependency.

Accessibility:

button
aria-expanded
keyboard usable

Determine whether a small client component is required.

============================================================
18. SITE FOOTER
    ============================================================

Add a real shared footer.

Potential:

site/business name
copyright
simple navigation links
Powered by BakerRang? maybe not yet
contact link

Evaluate exact V1.

Do NOT invent business address/social links if not stored.

Avoid displaying unavailable data.

============================================================
19. "POWERED BY BAKERRANG"
    ============================================================

Evaluate whether public sites should show:

Powered by BakerRang

in footer.

This may be useful for free sites / platform discovery, but it is a product
decision.

Recommend:
include
exclude
or defer

Do not assume.

============================================================
20. PAGE SHELL
    ============================================================

Design a reusable public shell:

SiteShell
SiteHeader
main
SiteFooter

The Home page and Lead Form page should share site-wide branding/header/footer
where appropriate.

Determine whether Contact lead-form page should use the same branded shell.

My preference:
YES.

It should feel like part of the business website, not an isolated app screen.

============================================================
21. CONTACT LEAD FORM PAGE DESIGN
    ============================================================

The existing:

/site/[tenantId]/contact

page should receive the new public design system.

Do NOT alter lead submission semantics.

Only presentation/shell.

Ensure errors/success/form controls use public-site styles.

============================================================
22. DESIGN TOKENS
    ============================================================

Define public-site design tokens.

Potential CSS variables:

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

Do not expose all tokens to the tenant.

Tenant branding populates a small subset.

The system derives/owns the rest.

============================================================
23. TOKEN PLACEMENT
    ============================================================

Determine where public tokens live.

Potential:

@bakerrang/site-components/styles.css

or site-renderer globals

Avoid coupling public-site tokens to portal/admin UI tokens if they serve
different products.

Evaluate whether `@bakerrang/ui/tokens.css` should remain portal-focused.

Prefer clear separation if appropriate.

============================================================
24. TYPOGRAPHY
    ============================================================

Choose a restrained public typography system.

Determine:

font family strategy
base font size
heading scale
line height
max line lengths

Do NOT introduce a user-selectable font picker yet unless strongly justified.

Potential:

system font stack

or one bundled/Google font if existing deployment supports it.

Avoid runtime dependence on external font APIs if unnecessary.

============================================================
25. SECTION RHYTHM
    ============================================================

Establish shared section layout:

consistent vertical spacing
content max-width
section title spacing
responsive horizontal padding

Avoid each section inventing its own unrelated padding.

Potential shared primitive:

SiteSection
SectionHeading
SiteContainer

Evaluate whether existing Container is suitable or whether site-components
needs its own primitives.

============================================================
26. HERO DESIGN
    ============================================================

Redesign Hero visually using the new system.

Current content:

title
subtitle?
ctaLabel?

Inspect current Hero CTA behavior.

Do not invent a broken CTA destination.

If Hero currently stores ctaLabel without action/target, determine how it is
actually rendered and whether it should remain.

Potential V1 visual treatment:

strong headline
supporting copy
CTA scrolls to Contact if Contact exists

BUT:
do not change persisted Hero semantics without explicit design.

Recommend whether Hero content contract needs any change.

Prefer NO schema change if possible.

============================================================
27. SERVICES DESIGN
    ============================================================

Redesign Services visually:

clear section heading
cards/list
readable descriptions
responsive grid

No icons unless data model supports them.

Do not invent icon mappings from service names.

============================================================
28. GALLERY DESIGN
    ============================================================

Use existing Gallery media/dimensions.

Improve:

grid consistency
aspect treatment
spacing
border/radius
responsive columns

No lightbox/carousel in 1.21 unless essential.

Avoid cropping important content destructively.

Determine:

object-fit
aspect-ratio strategy

============================================================
29. TESTIMONIALS DESIGN
    ============================================================

Improve manually-curated Testimonials:

quote treatment
customer attribution
card/column layout
responsive readability

No stars.

No fake review UI.

Keep distinction from future provider Reviews.

============================================================
30. CONTACT DESIGN
    ============================================================

Improve Contact section:

section heading/text
strong action styling
clear hierarchy

Support all current action types:

email
phone
url
leadForm

Do NOT change action behavior.

Ensure accessible anchors/buttons.

============================================================
31. SECTION BACKGROUND VARIATION
    ============================================================

Evaluate whether alternating subtle backgrounds improve visual rhythm.

Possible approach:

some sections use surface background

But order is user-controlled now, so styling based purely on section type may
cause odd adjacent backgrounds.

Potentially use index-based alternating surfaces.

Evaluate carefully.

Avoid persisted style settings.

============================================================
32. SITE-WIDE CSS VS COMPONENT CSS
    ============================================================

Determine the smallest maintainable styling architecture.

Potential:

CSS variables + CSS modules
global public CSS
Tailwind utility classes
existing project convention

Do not introduce a second styling framework.

Use what the repo already supports.

============================================================
33. BRANDING API / CMS
    ============================================================

If branding is persisted, design endpoint.

Potential:

PUT /tenants/:tenantId/site/branding

or:

PATCH /tenants/:tenantId/site/config/branding

PLATFORM_ADMIN only.

Determine exact route.

Full-state or PATCH semantics?

Prefer a narrow explicit contract.

============================================================
34. BRANDING WORKING / PUBLISHED SEMANTICS
    ============================================================

Critical decision:

Does branding participate in working/published lifecycle?

My preference:

YES.

Changing brand colors/logo should behave like content:

Save Branding:
working only

Preview:
new branding

Normal public:
old branding

Republish:
new branding

This avoids colors changing publicly before content approval.

Evaluate how to model this.

Potential challenge:

current published snapshot stores SiteDefinition with status/pages only.

Should branding become part of:

SiteDefinition

so publish snapshots it automatically?

This may be the cleanest approach.

Inspect actual schema/service.

============================================================
35. SITEDEFINITION BRANDING
    ============================================================

Evaluate widening:

SiteDefinition

to include:

branding

Potential:

interface SiteBranding {
siteName: string
primaryColor: string
accentColor: string
logoMediaId?: string
logoSrc?: string
logoWidth?: number
logoHeight?: number
}

Resolved-only Media fields should not persist, similar Gallery.

Determine persisted vs hydrated representation carefully.

Do NOT store public URLs in snapshots.

============================================================
36. BRANDING DEFAULT INITIALIZATION
    ============================================================

When site is initialized:

Should branding document/field be seeded immediately?

Potential siteName:
tenant.name

Colors:
platform defaults

Or should missing branding resolve to defaults without persisting them?

Evaluate backward compatibility and minimal writes.

Existing DEV sites have no branding.

No migration should be required merely to render them.

Prefer backwards-compatible defaulting.

============================================================
37. TENANT BUSINESS NAME VS SITE NAME
    ============================================================

Important distinction.

Tenant already has:

name

Hero title is independent.

Evaluate whether branding.siteName should:

default to tenant.name

but become independently editable.

This allows:

tenant internal business name
public site display name

to diverge later.

Recommend exact semantics.

============================================================
38. BRANDING EDITOR
    ============================================================

Portal needs simple:

Branding

or:

Site Settings

editor.

Potential:

Site Name
Primary Color
Accent Color
Logo

[Save] [Cancel]

No live visual theme builder required.

Could provide small swatches/previews.

Do NOT build a full branding studio.

============================================================
39. COLOR INPUT UX
    ============================================================

Evaluate:

native <input type="color">
plus text field?

Need server-valid #RRGGBB.

Avoid inaccessible UI.

Recommend minimal usable editor.

============================================================
40. LOGO PICKER UX
    ============================================================

If logo supported:

reuse existing Media infrastructure.

This would likely justify extracting a small reusable:

MediaPicker

because Gallery already selects Media.

But Gallery needs multiple selection/order while Logo needs one.

Evaluate whether a shared low-level:

MediaGrid / MediaSelector

is enough.

Do not extract a giant generic MediaManager.

============================================================
41. LOGO UPLOAD
    ============================================================

Should Branding editor allow uploading a logo directly?

Potentially reuse:

POST /tenants/:tenantId/media

Do not create a logo-specific binary endpoint.

If inline upload duplicates Gallery upload logic, evaluate extracting small
reusable upload UI.

Only if actual duplication justifies it.

============================================================
42. LOGO SHAPE / DIMENSIONS
    ============================================================

Do not add image cropping.

Header should handle:

wide logos
square logos

gracefully.

Use constrained max-height/max-width with intrinsic dimensions.

No destructive stretch.

============================================================
43. BRANDING MEDIA VALIDATION
    ============================================================

If branding.logoMediaId supplied:

must exist under same tenant Media.

Use a generalized same-tenant Media validation helper if now justified.

No cross-tenant logo.

No arbitrary external logo URL.

============================================================
44. BRANDING MEDIA HYDRATION
    ============================================================

If branding contains logoMediaId:

authenticated working getSite
preview public
published public

must hydrate logo:

logoSrc
logoWidth
logoHeight

without persisting storage provider fields.

Potentially combine logo + Gallery media IDs into ONE batched `getAll`.

This is the first real second Media consumer.

Evaluate a small generalization of current Gallery-only hydration.

Avoid N+1.

============================================================
45. PUBLIC API SANITIZATION
    ============================================================

Anonymous SiteDefinition may expose:

branding:
siteName
primaryColor
accentColor
logoMediaId?
logoSrc?
logoWidth?
logoHeight?

Do NOT expose:

objectName
createdByUserId
bucket
originalFilename
sizeBytes

Keep public response minimal.

============================================================
46. BRANDING CORRUPTION / DEFAULTS
    ============================================================

Define behavior if stored branding is missing/malformed.

For existing sites:
missing must fall back safely to platform defaults.

For malformed:
prefer fail-safe defaulting for presentation, but do not silently persist
repairs.

Mutation endpoint validates writes strictly.

Determine exact sanitizer/default behavior.

============================================================
47. PUBLISH SNAPSHOT
    ============================================================

If branding becomes part of SiteDefinition:

publish should snapshot working branding alongside pages.

No external URL in persisted snapshot.

Working branding changes should not mutate published/current.

Automated tests must prove this.

============================================================
48. SECTION COMPOSITION INTEGRATION
    ============================================================

Header nav must derive from the ACTUAL ordered Home.sections after Step 1.20.

If user order is:

Hero
Testimonials
Gallery
Services
Contact

header nav should ideally follow that same optional-section order.

No second nav order model.

Removing a section should remove its nav item automatically after publish.

Preview uses working composition.

============================================================
49. NAV + PUBLISHED SNAPSHOT
    ============================================================

Normal public header navigation must correspond to published composition,
not working composition.

Preview header navigation must correspond to working composition.

No renderer-side peek at working data for published site.

============================================================
50. LEAD FORM PAGE NAVIGATION
    ============================================================

The dedicated contact form route may not have Home section anchors available
in the same current page context.

Evaluate header behavior there.

Options:

links back to:

/site/{tenantId}/#services

etc.

Contact form header can still use site branding.

Do not produce broken "#services" anchors on the separate contact page.

============================================================
51. RESPONSIVENESS
    ============================================================

Explicitly evaluate:

mobile
tablet
desktop

Header
Hero
Services
Gallery
Testimonials
Contact
Lead Form
Footer

Avoid horizontal overflow.

Touch targets reasonable.

No pixel-perfect device matrix needed.

============================================================
52. ACCESSIBILITY
    ============================================================

At minimum:

semantic landmarks
one meaningful h1
logical h2 sections
alt text preserved
keyboard nav
mobile menu accessible
focus styles
color contrast
button/link semantics
form labels

Do not make accessibility an afterthought of theme colors.

============================================================
53. SEO / METADATA BOUNDARY
    ============================================================

Do NOT turn 1.21 into the full SEO milestone.

However, if siteName naturally improves:

<title>

or basic page metadata with almost zero new architecture, identify it.

Do NOT add:

JSON-LD
local business schema
OpenGraph media
robots/sitemap
SEO editor

unless necessary for design system.

Those belong later.

============================================================
54. PORTAL DESIGN
    ============================================================

This milestone is PUBLIC website design.

Do NOT redesign the whole admin portal.

Only add the minimal Branding/Site Settings editor required.

Existing portal UI can stay functional/neutral.

============================================================
55. DESIGN PREVIEW
    ============================================================

Existing DEV Preview already provides the best true site preview.

Do NOT build a live embedded iframe/theme preview inside the portal unless
clearly trivial.

Save Branding:
use Preview to evaluate result.

============================================================
56. DEFAULT SAMPLE / SHOWCASE
    ============================================================

Consider whether tests/dev can use the existing tenant content.

Do NOT add fake production content.

No template marketplace.

============================================================
57. TESTS — BRANDING VALIDATION
    ============================================================

If branding is implemented:

siteName validation
color validation
logo media ownership
unknown fields dropped
client-resolved media fields ignored
same-tenant logo accepted
foreign/missing logo rejected

============================================================
58. TESTS — BRANDING SNAPSHOT ISOLATION
    ============================================================

Critical:

working branding A

publish

normal public A

edit working branding B

normal public remains A

preview B

republish

normal public B

Same principle as section content.

============================================================
59. TESTS — BRANDING HYDRATION
    ============================================================

If logo:

working getSite hydrates it

preview hydrates it

published hydrates it

provider-specific fields never persist

public metadata sanitized

Gallery + Logo media resolved in one bounded/batched operation if generalized

============================================================
60. TESTS — HEADER NAV
    ============================================================

Given published Home composition:

Hero
Testimonials
Gallery
Contact

header navigation reflects:

Testimonials
Gallery
Contact

in that order.

Remove Gallery working:
preview nav omits Gallery
normal published nav retains it until republish
republish removes it.

No second navigation config.

============================================================
61. TESTS — PUBLIC SHELL
    ============================================================

Where current frontend testing permits:

header renders site identity
footer renders
page sections stay in authoritative order
lead-form route uses branding shell

Do not add a heavyweight React test suite just for this.

Typecheck/lint/build/manual E2E is acceptable.

============================================================
62. TESTS — BACKWARD COMPATIBILITY
    ============================================================

Existing sites with no branding fields must still render using defaults.

No migration required.

Existing published snapshots without branding must remain valid.

This is mandatory.

============================================================
63. MANUAL DEV E2E
    ============================================================

Plan a realistic walkthrough:

1. Existing DEV business/site.

2. Open Manage Website / Branding.

3. Set:
   site name
   primary color
   accent color
   optional logo if included.

4. Save.

5. Normal public:
   old branding.

6. Preview:
   new branding.

7. Verify:
   header
   nav
   hero
   services
   gallery
   testimonials
   contact
   footer
   lead form page
   mobile layout.

8. Republish.

9. Normal public:
   new branding.

10. Reorder sections in working layout.

11. Preview header nav follows working order.

12. Normal published header still follows published order.

13. Republish.

14. Normal nav updates.

15. Remove section:
    nav entry disappears only after publish.

16. If logo:
    Firestore persists mediaId, not GCS URL.
    Public API hydrates safe URL/dimensions.
    Gallery still works.

17. Existing sites with missing branding:
    default theme still renders.

18. Confirm Lead submission behavior unchanged.

19. Confirm only bakerrang-dev / existing DEV bucket changed.

============================================================
64. OUT OF SCOPE
    ============================================================

Do NOT implement:

custom domains
full SEO
Google Business Profile
external reviews
analytics
theme marketplace
per-section style controls
custom CSS
font picker
background image controls
video hero
animation system
page templates
dark mode toggle
multiple pages
portal redesign
drag/drop
arbitrary navigation editor
social media configuration

============================================================
65. ARCHITECTURAL PRINCIPLE
    ============================================================

This milestone should establish:

small tenant branding contract
->
working/published lifecycle
->
public SiteDefinition
->
CSS design tokens
->
shared SiteShell
->
header/footer
->
existing sections styled consistently

while preserving:

Home.sections
as the sole page composition/order model.

No design configuration should duplicate content/composition state.

============================================================
DELIVERABLE
============================================================

Return:

1. Current public design readiness.
2. Current styling architecture.
3. Current tenant/site identity data.
4. Exact branding persistence location.
5. Exact branding schema.
6. Color model.
7. Color validation.
8. Contrast strategy.
9. Default theme.
10. Logo decision.
11. Media-generalization decision.
12. Branding working/published semantics.
13. SiteDefinition changes.
14. Backward-compatibility strategy.
15. Branding endpoint.
16. Branding authorization.
17. Branding editor UX.
18. Public design-token architecture.
19. Typography system.
20. Spacing/layout system.
21. Site shell.
22. Header design.
23. Nav derivation.
24. Mobile nav design.
25. Footer design.
26. Lead-form page integration.
27. Hero design.
28. Services design.
29. Gallery design.
30. Testimonials design.
31. Contact design.
32. Section-background rhythm.
33. Accessibility considerations.
34. Files to add.
35. Files to modify.
36. Files explicitly unchanged.
37. Backend tests.
38. Platform checks.
39. Manual DEV E2E.
40. Concrete risks.
41. What is intentionally deferred.
42. Recommended Step 1.22.
43. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

Do not modify code.