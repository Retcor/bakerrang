# Implement Step 1.27d — Social Links

Implement only Step 1.27d of the BakerRang Step 1.27 roadmap.

This slice adds canonical Social Links to BusinessProfile, a focused Social Links mutation, Portal editing, Footer rendering, and LocalBusiness `sameAs` structured data.

Do NOT implement any favicon work, generic links, social embeds/feeds, or other unrelated features.

Use the approved Step 1.27 Claude plan as the architectural reference, with the decisions in this assignment taking precedence.

---

# Goal

Add canonical structured social profiles under:

```text
BusinessProfile.socialLinks
```

and render them in the public site Footer.

Social Links must support:

- one canonical source of social-profile truth
- working/published lifecycle
- Step 1.25 Preview
- focused Portal editing
- safe external links
- restrained Footer presentation
- LocalBusiness `sameAs`
- backwards compatibility with existing BusinessProfile saves

There is NO dedicated Social homepage section in V1.

Do not add anything to `Home.sections`.

---

# 1. Canonical Schema

Add to the shared schema:

```ts
export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'x'

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export interface BusinessProfile {
  // existing fields...
  socialLinks?: SocialLink[]
}
```

`socialLinks` itself is optional.

Meaning:

```text
missing
  = no social profiles configured
```

When present, it must be a valid ordered list of supported social platforms.

Do NOT add:

- generic/custom platform
- arbitrary labels
- icon names
- HTML
- embed markup
- usernames separate from URLs

V1 stores canonical profile URLs only.

---

# 2. Supported Platforms

Supported V1 platform enum:

```text
facebook
instagram
linkedin
youtube
tiktok
x
```

Use user-facing labels:

```text
Facebook
Instagram
LinkedIn
YouTube
TikTok
X
```

Do not expand the list unless the existing code already has a strongly justified reusable enum.

No arbitrary/generic social link in V1.

---

# 3. Social Link Validation

Server validation is authoritative.

For each item:

```text
platform
  required
  must be one of the supported enum values

url
  required
  max 300 characters
  must parse as a valid URL
  must use HTTPS
```

Reject:

```text
http://...
javascript:...
data:...
mailto:...
ftp:...
relative URLs
```

Require:

```text
https://...
```

Duplicate platform entries must be rejected.

There may be at most one entry per supported platform.

Maximum number of links therefore equals the enum size.

Unknown fields must not become canonical persisted state.

Whitespace-only URLs must be rejected.

Normalize only where safe and predictable.

Do not silently rewrite hostnames or paths unless existing URL validation conventions already do so.

---

# 4. Read-Time Sanitization

Reads must be backwards-compatible and tolerant of malformed historical/manual Firestore data.

Required behavior:

```text
no socialLinks
  -> socialLinks absent

valid socialLinks
  -> normalized valid entries returned

malformed entries
  -> safely omitted
```

If the entire value is not an array, omit `socialLinks`.

For an array:

- invalid platform -> drop that entry
- invalid/non-HTTPS URL -> drop that entry
- duplicate platform -> keep at most one deterministically, or omit duplicate entries according to the cleanest existing read-normalization convention

Writes remain strict; reads remain safe.

Do NOT throw on malformed stored social data.

No Firestore migration.

Old published snapshots without Social Links must continue rendering normally.

---

# 5. Focused Mutation Architecture — IMPORTANT

Do NOT use the whole-profile endpoint from the Social Links editor.

Create a focused mutation endpoint.

Recommended route:

```text
PUT /tenants/:tenantId/site/social-links
```

Payload approximately:

```ts
interface SocialLinksUpdateInput {
  socialLinks: SocialLink[] | null
}
```

Exact naming may follow existing conventions.

The mutation is allowed to modify only:

```text
config.businessProfile.socialLinks
```

It must preserve all unrelated BusinessProfile fields exactly as currently stored.

Specifically preserve:

- description
- phone
- email
- address
- serviceAreas
- socialImageMediaId
- businessHours
- unknown/future-compatible fields that the focused mutation should not destroy

Do NOT require the Portal to resend unrelated profile data.

---

# 6. Removing Social Links

Support:

```text
socialLinks: null
```

Meaning:

```text
remove canonical socialLinks from BusinessProfile
```

After removal:

- Footer social icons disappear
- LocalBusiness `sameAs` disappears
- unrelated BusinessProfile data remains untouched

An empty array may either normalize to removal or be rejected, but choose one clear contract.

Prefer:

```text
[] -> remove / canonical absence
```

only if that aligns cleanly with existing focused-mutation conventions.

Otherwise use explicit `null`.

Document and test the final behavior.

---

# 7. General Business Profile Compatibility — CRITICAL

The general Business Profile save must not erase configured Social Links.

Once `socialLinks` exists, a normal save through:

```text
PUT /tenants/:tenantId/site/profile
```

that omits `socialLinks` must preserve stored Social Links.

Required scenario:

```text
Stored BusinessProfile:
  description
  phone
  email
  address
  serviceAreas
  socialImageMediaId
  businessHours
  socialLinks

General Business Profile editor submits existing legacy/detail fields
but omits socialLinks

Result:
  socialLinks preserved
  businessHours preserved
```

Do not require the existing Business Profile editor to resend Social Links.

Deletion of Social Links should occur only through the focused Social Links mutation.

This should extend the same compatibility strategy established in Step 1.27c for Business Hours.

Add deterministic regression coverage for both:

```text
businessHours
socialLinks
```

being preserved by general profile saves.

---

# 8. Business Hours Compatibility

The focused Social Links mutation must also preserve:

```text
businessHours
```

exactly.

Likewise, the focused Business Hours mutation must preserve:

```text
socialLinks
```

once this field exists.

Add a cross-feature regression test.

This is important because both fields are canonical BusinessProfile subdomains with independent focused editors.

Expected:

```text
update Hours
  -> Social Links unchanged

update Social Links
  -> Hours unchanged
```

---

# 9. Portal Social Profiles Editor

Add a focused Social Profiles editor under Site Foundation.

Conceptually:

```text
Site Foundation

Branding
Theme
Business Profile
Business Hours
Social Profiles
Manage Sections
```

No Social entry in Homepage Content because Social is not a Home section in V1.

The editor should seed from:

```text
site.businessProfile?.socialLinks
```

---

# 10. Social Editor UX

Use an ordered list of configured social profiles.

Example:

```text
Instagram
https://instagram.com/example
[Remove]

Facebook
https://facebook.com/example
[Remove]

LinkedIn
https://linkedin.com/company/example
[Remove]
```

Provide:

```text
Add Social Profile
```

When adding a profile:

- choose from only platforms not already configured
- then enter the HTTPS URL

Prevent duplicate platform selection in the UI.

Server still remains authoritative.

---

# 11. Ordering

Canonical `socialLinks` array order should control Footer rendering order.

Portal must support reordering configured social links.

Use compact accessible Move Up / Move Down controls, following the same pattern already established for FAQ items and Manage Sections.

Do NOT add drag-and-drop.

Requirements:

- first Move Up disabled
- last Move Down disabled
- accessible labels
- touch-friendly controls
- mobile-safe layout

Example:

```text
Instagram
[ URL input ]
[↑] [↓] [trash]
```

Reordering should preserve platform/url identity.

No server-generated child IDs are required because platform itself is unique and canonical.

---

# 12. Add Behavior

When no social links exist, show a clean empty state with:

```text
Add Social Profile
```

The platform selector should list only unconfigured platforms.

Once all six platforms are configured:

```text
Add Social Profile
```

should be disabled or unavailable.

Do not expose raw enum values to the operator.

Use proper labels.

---

# 13. Remove Behavior

Removing a row changes local editor state.

Persist only on Save.

Provide a separate:

```text
Remove Social Profiles
```

action only if it materially improves UX.

It is acceptable for Save with zero configured rows to send the canonical removal contract if the implementation is clear.

Prefer the simplest understandable workflow.

No confirmation is necessary for removing one local row before Save.

If a dedicated destructive remove-all control is added, use existing confirmation patterns.

---

# 14. Portal Validation

Mirror server rules for UX.

Show useful row-specific errors:

```text
Instagram URL must use HTTPS.
```

or equivalent.

Client validation should catch:

- missing URL
- invalid URL
- non-HTTPS URL
- duplicate platform state if somehow created locally
- URL length

Server remains authoritative.

Do not silently accept invalid external links.

---

# 15. Portal Save Behavior

Save must call only the focused Social Links endpoint.

Do NOT call the whole-profile endpoint.

On success:

```text
updated SiteDefinition
    -> BusinessWebsite state
    -> existing saved / Republish messaging
```

Use the normal Publishing Preview action.

No Social-specific Preview mechanism.

---

# 16. Mobile Editor UX

Verify structure around:

```text
375px
768px
desktop
```

At narrow widths, rows should stack cleanly:

```text
Instagram
URL input

[↑] [↓] [remove]
```

Requirements:

- no horizontal overflow
- platform label remains readable
- URL field gets useful width
- controls do not crush the field
- touch targets remain comfortable
- Save remains reachable

---

# 17. Public Footer Rendering

Render configured social links in the public `SiteFooter`.

Footer-only in V1.

Do NOT also render Social Links automatically in:

- header
- Contact
- About
- dedicated homepage section

Keep presentation restrained.

The Footer should render nothing extra when no social links are configured.

No awkward empty social container.

---

# 18. Social Icons

Use lightweight inline SVG icons or an already-existing lightweight icon mechanism.

Do NOT add a large dependency solely for six social icons.

Each platform should have a recognizable icon.

Accessibility:

```text
aria-label="Instagram"
aria-label="Facebook"
...
```

If visible text labels already provide sufficient accessible naming, avoid redundant ARIA.

Do not expose icon implementation details to CMS data.

CMS stores:

```text
platform
url
```

only.

---

# 19. External Link Safety

Public social links should use:

```html
target="_blank"
rel="noopener noreferrer"
```

or the equivalent safe external-link behavior already used in site components.

All URLs have already been server validated as HTTPS.

Do not allow:

```text
javascript:
data:
mailto:
```

Footer rendering must use normal React escaping.

---

# 20. Theme Integration

Social Footer presentation must fit the existing Step 1.26 Theme.

Use existing Footer colors/typography/layout as the source of truth.

Do not introduce:

- social-specific tenant colors
- icon color CMS fields
- per-platform color customization
- new Theme schema fields

Icons may inherit current Footer text color.

Hover/focus treatment should be subtle and accessible.

---

# 21. Footer Layout

Inspect the current Footer.

Add social links without making it cluttered.

Conceptually:

```text
Business Name          navigation links

                       social icons
```

or another restrained layout matching the existing Footer structure.

Requirements:

- desktop balanced
- mobile wraps/stacks cleanly
- navigation remains usable
- social links do not dominate
- no raw URLs printed visibly

No Footer redesign beyond what is necessary.

---

# 22. Renderer Data Flow

The Footer should receive Social Links from:

```text
site.businessProfile?.socialLinks
```

through the existing SiteShell/PublicHome renderer path.

Do not add a new API request.

Do not access Firestore.

Do not derive Social Links from Home.sections.

No renderer-side mutation.

---

# 23. LocalBusiness `sameAs`

Extend existing LocalBusiness JSON-LD using canonical:

```text
BusinessProfile.socialLinks
```

only.

Conceptually:

```json
{
  "sameAs": [
    "https://instagram.com/example",
    "https://facebook.com/example"
  ]
}
```

Preserve canonical array order unless the current SEO helper intentionally normalizes order.

Do NOT include platform names in `sameAs`, only URLs.

Do not read Footer/component state.

---

# 24. LocalBusiness Emission Gate

Do NOT broaden the existing LocalBusiness emission gate.

Social Links should augment LocalBusiness only when the existing core identity rules already cause the block to be emitted.

Required:

```text
valid socialLinks
but no phone/email/address/serviceAreas
  -> do NOT create LocalBusiness block solely because socialLinks exist
```

This mirrors the Business Hours behavior established in Step 1.27c.

Add a regression test.

---

# 25. Structured Data Safety

`sameAs` should include only valid sanitized canonical Social Links.

Required:

```text
missing socialLinks
  -> sameAs omitted

empty/removed socialLinks
  -> sameAs omitted

malformed stored social entries
  -> invalid entries omitted

no valid entries remain
  -> sameAs omitted
```

No malformed URL should enter JSON-LD.

---

# 26. Working / Published Lifecycle

Required lifecycle:

```text
Published Social Links A

Edit WORKING links -> B

Preview
  -> Footer B
  -> JSON-LD sameAs B

shared published site
  -> Footer A
  -> JSON-LD sameAs A

custom domain
  -> A

Republish

shared/custom
  -> B
```

Use the existing BusinessProfile snapshot lifecycle.

No Social-specific publish/Preview code.

---

# 27. Backwards Compatibility

No Firestore migration.

Required:

```text
old site with no socialLinks
  -> unchanged

old snapshot with no socialLinks
  -> unchanged

malformed stored data
  -> safely omitted

new working socialLinks
  -> Preview only until publish
```

Existing public Footer without Social Links should look essentially unchanged.

---

# 28. Interaction With Business Hours

Test a profile containing both:

```text
businessHours
socialLinks
```

Required independence:

```text
Social update
  -> Business Hours unchanged

Business Hours update
  -> Social Links unchanged

General Business Profile update
  -> both preserved when omitted
```

This is a key architectural regression test.

---

# 29. API Route

Add a focused route consistent with the Business Hours pattern:

```text
PUT /tenants/:tenantId/site/social-links
```

Authorization must match the current site-content editing policy.

Reuse existing:

- auth
- CSRF
- tenant/platform authorization
- error handling
- rate limiting conventions

No public write route.

---

# 30. BusinessProfile Domain Evolution

Extend the existing BusinessProfile validation/response behavior with Social Links.

Be careful to distinguish:

```text
strict write validation
```

from:

```text
safe read sanitization
```

General Business Profile endpoint omission semantics:

```text
businessHours omitted -> preserve existing
socialLinks omitted   -> preserve existing
```

Do not accidentally alter existing clear/remove behavior for:

- description
- phone
- email
- address
- serviceAreas
- socialImageMediaId

---

# 31. Tests — Server

Cover at minimum:

## Validation

- one valid link
- all six valid platforms
- unsupported platform rejected
- duplicate platform rejected
- missing URL rejected
- malformed URL rejected
- HTTP rejected
- javascript rejected
- data rejected
- mailto rejected
- URL over max rejected
- unknown fields not persisted

## Read sanitization

- no socialLinks
- valid socialLinks
- malformed non-array value omitted
- invalid entries omitted safely
- duplicate malformed stored platform handled deterministically
- old snapshots unaffected

## Focused mutation

- only socialLinks changes
- description preserved
- phone preserved
- email preserved
- address preserved
- serviceAreas preserved
- socialImageMediaId preserved
- businessHours preserved
- future/unknown stored profile field preserved

## General profile compatibility

- stored businessHours + socialLinks
- general Business Profile save omits both
- both remain unchanged

## Cross-focused mutation

- update Hours with Social Links present -> Social Links remain
- update Social Links with Hours present -> Hours remain

## Lifecycle

- publish A
- edit links B
- working/Preview B
- public A
- republish
- public B

---

# 32. Tests — Renderer

Cover:

- Footer renders configured social links
- Footer renders nothing social-specific when absent
- correct platform order
- correct URLs
- target blank
- rel noopener noreferrer
- accessible labels
- recognizable platform mapping
- mobile-safe structural output where practical
- no raw URLs shown visibly

## JSON-LD

- sameAs includes canonical URLs
- array order deterministic
- absent socialLinks -> omitted
- removed socialLinks -> omitted
- malformed sanitized state -> omitted
- existing LocalBusiness gate unchanged
- socialLinks alone do not create LocalBusiness JSON-LD

---

# 33. Tests — Portal

Cover:

- empty editor state
- existing social links load
- Add Social Profile
- supported platform labels
- already-configured platforms unavailable
- all six configured -> cannot add seventh
- URL editing
- HTTPS validation
- Move Up
- Move Down
- Remove
- first Up disabled
- last Down disabled
- Save uses focused endpoint
- Save does not use whole-profile endpoint
- returned SiteDefinition propagates
- Preview action remains present
- mobile-safe row structure where practical

If save-with-zero removes socialLinks:

- cover canonical removal behavior

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
- Business Hours
- existing BusinessProfile fields
- Preview
- custom domains
- publish/unpublish
- media hydration
- openingHoursSpecification
- canonical URLs

The only intended SEO addition is:

```text
sameAs
```

---

# 35. Explicitly Out of Scope

Do NOT implement:

- favicon configuration
- hardcoded favicon patch
- generic custom social link
- website link
- email link
- phone link
- social feeds
- embedded posts
- OAuth/social login
- follower counts
- platform-specific brand colors
- dedicated Social section
- Contact social links
- Header social links
- FAQ JSON-LD
- custom CSS
- arbitrary HTML
- drag-and-drop
- production deployment

---

# 36. Automated Verification

Run:

- all backend tests
- Portal tests
- renderer tests
- shared UI tests
- platform typecheck
- platform lint
- touched server-file lint
- Portal production build
- renderer production build
- `git diff --check`

Report unrelated global server lint failures separately.

---

# 37. Return

Return a concise implementation report containing:

1. files created
2. files modified
3. final Social Links schema
4. validation/read-normalization behavior
5. focused mutation architecture
6. BusinessProfile compatibility behavior
7. Business Hours interoperability
8. Portal Social Profiles editor
9. Footer rendering
10. LocalBusiness sameAs behavior
11. tests added/updated
12. complete automated verification results
13. manual DEV verification still required
14. deviations and why