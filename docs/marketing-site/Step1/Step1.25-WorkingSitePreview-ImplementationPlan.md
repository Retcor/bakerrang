# Implement Step 1.25 — Working-Site Preview

Implement the approved Step 1.25 Working-Site Preview plan.

Use Claude's Step 1.25 plan as the primary technical reference, with the
decisions and corrections below taking precedence.

## Goal

Allow an authenticated Portal operator to preview the tenant's SAVED WORKING
site before publishing.

The preview must reuse the existing site renderer while preserving strict
working/published isolation.

Do not enable public draft mode and do not change the existing published/custom
domain behavior.

---

## Approved architecture

Use a short-lived, tenant-scoped HMAC preview token.

Flow:

Portal
-> authenticated POST mint endpoint
-> short-lived preview token
-> sites renderer `/preview/{tenantId}?token=...`
-> renderer server sends token to API via Authorization header
-> API validates token
-> API returns WORKING site definition
-> existing renderer/site-components render it

Custom domains remain PUBLISHED-only.

`ALLOW_DRAFT_PUBLIC_SITES` must remain false and must not participate in preview.

---

## Preview token

Create a pure preview-token service.

Token should contain only:

- tenantId
- issued-at
- expiry

Use:

- HMAC-SHA256
- base64url
- timingSafeEqual
- generic 401 response for malformed/tampered/expired tokens
- 15-minute TTL

### Signing secret

Use:

`PREVIEW_TOKEN_SECRET`

Do NOT normally reuse SESSION_SECRET.

Treat PREVIEW_TOKEN_SECRET as required for deployed/production-style operation.

Tests should inject an explicit test secret rather than depending on process
state where practical.

Update `.env.example`.

---

## Authorization

Mint endpoint:

`POST /tenants/:tenantId/site/preview-token`

Authorization must match the existing authenticated working-site read:

- OWNER
- ADMIN
- STAFF
- PLATFORM_ADMIN bypass

Existing auth, tenant limiter, and CSRF behavior remain in force.

Consume endpoint:

`GET /public/preview/:tenantId`

Requirements:

- bearer token REQUIRED
- read token only from:
  `Authorization: Bearer <token>`
- DO NOT support token query parameters on the API endpoint
- validate token before Firestore access
- token tenantId must exactly match route tenantId
- invalid/missing/expired/wrong-tenant token -> generic 401
- valid token but missing working site -> 404
- successful response -> WORKING SiteDefinition from existing `getSite`

This endpoint must remain independent of `ALLOW_DRAFT_PUBLIC_SITES`.

Add a reasonable preview read limiter as planned.

---

## Renderer preview routes

Create:

`/preview/[tenantId]`

and:

`/preview/[tenantId]/contact`

Requirements:

- `force-dynamic`
- host MUST match `SITE_PUBLIC_ORIGIN`
- any other host -> notFound()
- custom domains can therefore never render Preview
- token comes from renderer URL query string
- renderer forwards it to API using Authorization: Bearer
- API fetch uses `cache: 'no-store'`
- Preview must never calculate or execute custom-domain redirects

Reuse:

PublicHome
-> SectionRenderer
-> SiteShell / existing site-components

Do not duplicate renderer logic.

---

## Preview metadata/security

Every preview page must:

- robots: noindex, nofollow
- emit no canonical
- emit no OpenGraph URL
- use no-store behavior
- use referrer policy `no-referrer`

Add the appropriate Next metadata/referrer configuration so the token-bearing
preview URL is not propagated as a Referer.

Existing robots.txt behavior should remain unchanged if `/preview/` is already
disallowed by the current policy.

---

## Preview frame

Wrap preview content in a clear but lightweight banner:

`Preview — not published`

It should remain visible/obvious on desktop and mobile.

A Close action is fine.

Do NOT implement:
- desktop/mobile framing controls
- inline editing
- visual builder behavior

---

## Contact / lead safety

Preview Contact should visually render the real working form.

Pass a preview flag down through the existing render path.

When `preview === true`:

- fields render normally
- submit action makes NO network request
- show a message such as:
  `This is a preview — the form isn't active.`

The existing public lead endpoint must remain unchanged and still authorize
only against the PUBLISHED site.

No preview lead-writing API is permitted.

---

## Portal Preview action

Add:

`Preview changes`

to the Website Publishing card beside Publish/Republish.

Preview represents SAVED working state, not unsaved form buffers.

### Popup handling

Do NOT await token minting and then call `window.open()`.

On direct user click:

1. immediately call `window.open('about:blank', '_blank', 'noopener,noreferrer')`
2. asynchronously mint the preview token
3. if successful, navigate the opened tab/window to the preview URL
4. if minting fails, close the temporary preview window and show an error
5. if `window.open()` was blocked initially, mint as normal and surface a
   clickable fallback preview link

Each click should mint a fresh token.

Never-published working sites can still be previewed.

Do not show Preview if the working site has not been initialized.

---

## Portal build configuration

Add:

`NEXT_PUBLIC_SITE_PREVIEW_ORIGIN`

Local example:

`http://localhost:3002`

DEV deployment value:

`https://sites-dev.bakerrang.com`

Because this is a NEXT_PUBLIC value, update the Portal Dockerfile so it is a
build argument available during `next build`.

The Dockerfile must support:

`--build-arg NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=...`

Do not rely solely on runtime Cloud Run env configuration.

Preserve the existing build args:

- NEXT_PUBLIC_API_BASE_URL
- CUSTOM_DOMAIN_IPV4_ADDRESS
- optional CUSTOM_DOMAIN_CNAME_TARGET

Update deployment/runbook documentation where appropriate.

---

## Tests

Server tests must cover at minimum:

- sign/verify
- expiration
- tampering
- malformed token
- wrong version
- missing preview secret behavior
- valid working-site read
- invalid/expired/missing bearer token
- token for tenant A cannot read tenant B
- valid token + no site -> 404
- preview works while ALLOW_DRAFT_PUBLIC_SITES=false
- mint authorization
- public `/public/sites/:id` remains published-only

Renderer tests:

- preview host gate
- working preview fetch result mapping
- noindex/nofollow
- no canonical
- no-referrer metadata
- no custom-domain redirect path
- Contact link preserves preview token
- preview LeadForm never invokes submitLead
- normal published LeadForm behavior remains unchanged

Portal tests:

- Preview action visibility
- synchronous window opening behavior
- successful token mint navigates opened window
- mint error closes temporary window
- blocked popup exposes fallback link
- correct preview origin/tenant URL generated

Run all existing backend, Portal/UI, and renderer tests.

Run:

- platform typecheck
- platform lint
- Portal production build
- renderer production build

---

## Explicitly untouched

Do not modify the semantics of:

- public published site endpoint
- getPublishedSiteDefinition
- draftPreviewEnabled
- custom-domain resolution
- publish/unpublish
- public lead creation
- site-schema
- public site-components

Do not implement:

- theme controls
- custom CSS
- About/FAQ/Hours/Social
- arbitrary pages
- inline editing
- drag-and-drop
- production deployment

---

## Return

Provide:

1. files created
2. files modified
3. preview authorization/data flow implemented
4. security decisions
5. tests added
6. complete verification results
7. deployment/config changes required for DEV
8. any deviations and why