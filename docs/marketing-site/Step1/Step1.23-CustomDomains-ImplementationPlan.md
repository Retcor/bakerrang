Implement Step 1.23 — Custom Domains.

Claude Code inspected the shipped repository and produced an approved
implementation plan.

Follow Claude's plan, with the corrections below taking precedence.

Do NOT expand scope.

============================================================
GOAL
============================================================

Allow one verified custom hostname to serve a tenant's existing PUBLISHED
website through the shared site-renderer.

Example:

Shared:
https://sites.bakerrang.com/site/tenant-123

Custom:
https://example.com/

Contact:
https://example.com/contact

Domain routing is infrastructure state.

It MUST NOT be stored in:

SiteDefinition
published/current
branding
BusinessProfile
Home.sections

Changing domain lifecycle state must not require republishing.

============================================================
1. CLOUD ARCHITECTURE
   ============================================================

Production target:

Global external Application Load Balancer
↓
Serverless NEG
↓
single shared site-renderer Cloud Run service

TLS:

Google-managed Certificate Manager.

Do NOT use direct Cloud Run Domain Mapping as the product architecture.

Do NOT implement Google Cloud provisioning in Step 1.23.

Infrastructure is operator-managed V1.

Do NOT implement:

gcloud automation
Terraform generation
Certificate Manager API calls
Load Balancer API calls
DNS-provider integrations

============================================================
2. IMPORTANT LOAD BALANCER CORRECTION
   ============================================================

Do NOT make "one URL-map host rule per BakerRang domain" an application
requirement.

The shared LB may route its default backend to the site-renderer for all
hostnames reaching the frontend.

The BakerRang ACTIVE domain registry remains the application routing and
authorization boundary.

Per-domain infrastructure responsibility in V1 is primarily:

- DNS points at the platform LB
- the HTTPS frontend has valid certificate coverage for the hostname
- operator verifies HTTPS is working
- PLATFORM_ADMIN activates the domain

If the existing real LB setup requires another host-rule step, document it,
but do not make host-rule creation part of application state.

============================================================
3. DOMAIN STORAGE
   ============================================================

Use:

siteDomains/{normalizedHostname}

as the authoritative domain record.

Persist roughly:

{
hostname,
tenantId,
status,
verificationToken,

createdAt,
createdByUserId,
updatedAt,

verifiedAt?,
verifiedByUserId?,

activatedAt?,
activatedByUserId?,

disabledAt?,
disabledByUserId?
}

Allowed states:

PENDING_VERIFICATION
VERIFIED
ACTIVE
DISABLED

No domain information in SiteDefinition.

============================================================
4. TRANSACTIONAL TENANT INDEX — REQUIRED
   ============================================================

Exactly one custom hostname per tenant must be a REAL transactional invariant.

Do NOT rely on:

siteDomains.where('tenantId', '==', tenantId)

outside a transaction to enforce that invariant.

Add a tiny deterministic secondary index:

tenantSiteDomains/{tenantId}

containing only:

{
hostname
}

This is a lookup/index pointer, NOT a second authoritative copy of domain
status/configuration.

Authoritative lifecycle data remains only in:

siteDomains/{hostname}

Registration transaction reads:

tenantSiteDomains/{tenantId}
siteDomains/{normalizedHostname}

before any writes.

Rules:

If hostname belongs to another tenant:
409

If tenant pointer already references a DIFFERENT hostname:
409 with clear message requiring removal of existing domain first.

If same tenant + same hostname already exists:
return current record unchanged.

If neither exists:
create authoritative domain doc
create tenant pointer

Both atomically.

This prevents:

tenant A and tenant B claiming same hostname

AND

one tenant concurrently registering two different hostnames.

============================================================
5. NO IMPLICIT DOMAIN REPLACEMENT
   ============================================================

PUT must NOT silently replace an existing different hostname.

Do not:

delete old active domain
create new pending domain

as one "replace" save.

If the tenant already owns another hostname:

409:
Remove the existing custom domain before adding another.

Removal is an explicit operation.

This keeps V1 lifecycle understandable.

============================================================
6. SAME-HOST PUT IS IDEMPOTENT
   ============================================================

If the tenant PUTs the SAME normalized hostname it already owns:

return the current domain.

Do NOT:

rotate the token
reset VERIFIED
reset ACTIVE
reset DISABLED
take the site offline

merely because the editor saved the same hostname again.

Fresh token is generated only for genuinely new registrations and the explicit
disable/reverification lifecycle defined below.

============================================================
7. HOSTNAME INPUT VALIDATION
   ============================================================

Admin registration input is a HOSTNAME.

Reject:

https://example.com
http://example.com
example.com/path
example.com?x=y
example.com:443
user@example.com
*.example.com
localhost
IPv4 addresses
IPv6 addresses
single-label names
whitespace

Do NOT strip a port from admin registration input.

Use:

domainToASCII()

for IDN normalization.

Then validate DNS labels:

- total hostname <= 253 ASCII characters
- at least two labels
- each label 1..63 chars
- chars appropriate for ASCII DNS hostname labels
- no leading/trailing hyphen
- final label must be valid but DO NOT require letters-only,
  because punycode TLDs such as xn--... must remain valid

Normalize:

case → lowercase
single terminal dot → removed if accepted
IDN → ASCII/punycode

Return canonical normalized ASCII hostname.

============================================================
8. REQUEST HOST NORMALIZATION
   ============================================================

Request Host parsing is a separate helper from registration validation.

For an incoming HTTP Host header it MAY:

- lowercase
- strip a development/request port
- strip a terminal dot
- normalize IDN if appropriate

Then validate.

Do not accidentally make registration accept ports just because HTTP Host may
contain one.

============================================================
9. TRUSTED REQUEST HEADER
   ============================================================

Use the HTTP:

Host

header as the primary public requested hostname.

The Google external Application Load Balancer preserves the client's Host
header to the backend.

Do NOT prefer arbitrary incoming:

X-Forwarded-Host

over Host.

If X-Forwarded-Host is ever supported later, it must be tied to a deliberate
trusted proxy/header configuration.

For Step 1.23:

Host is the lookup input.

It remains UNTRUSTED until the API resolves it to an ACTIVE registry record.

============================================================
10. OWNERSHIP VERIFICATION
    ============================================================

For new registration generate:

randomBytes(32).toString('hex')

TXT name:

_bakerrang-verification.{hostname}

TXT expected value:

verificationToken

Use an injectable DNS resolver around:

node:dns/promises resolveTxt

Tests must not hit live DNS.

Flatten chunked TXT records.

Support multiple records.

Expected controlled behavior:

record/token matches
→ VERIFIED

record absent / ENOTFOUND / ENODATA
→ controlled retryable 409

record exists but token mismatches
→ controlled 422

temporary DNS resolver failure/timeout/SERVFAIL
→ controlled retryable 409

Do not expose raw resolver exceptions.

============================================================
11. DISABLE / REACTIVATE SECURITY
    ============================================================

Do NOT allow:

DISABLED → ACTIVE

without fresh ownership verification.

When disabling ACTIVE:

- status = DISABLED
- routing stops immediately
- rotate to a fresh verificationToken
- clear the current verification state/timestamp used for activation
- retain ordinary audit history fields if useful

To reactivate:

DISABLED
↓ Verify TXT using the NEW token
VERIFIED
↓ Activate
ACTIVE

Activation accepts:

VERIFIED

only.

This makes the state machine unambiguous and avoids treating old DNS ownership
proof as permanent.

============================================================
12. REMOVE
    ============================================================

DELETE must atomically:

delete siteDomains/{hostname}
delete tenantSiteDomains/{tenantId}

Routing stops immediately.

No published content mutation.

The hostname is now globally available to register again.

Any new registration gets a NEW verification token and must verify again.

============================================================
13. AUTHORIZATION
    ============================================================

Domain administration remains:

PLATFORM_ADMIN only.

OWNER:
403

ADMIN:
403

STAFF:
403

Unauthenticated:
401

No public mutation endpoint.

============================================================
14. AUTHENTICATED DOMAIN API
    ============================================================

Implement the narrow domain lifecycle contract:

GET
/tenants/:tenantId/site/domain

PUT
/tenants/:tenantId/site/domain

POST
/tenants/:tenantId/site/domain/verify

POST
/tenants/:tenantId/site/domain/activate

POST
/tenants/:tenantId/site/domain/disable

DELETE
/tenants/:tenantId/site/domain

GET resolves the tenant pointer then authoritative hostname record.

PUT creates only when no different domain exists.

Commands perform explicit lifecycle transitions.

============================================================
15. PUBLIC DOMAIN RESOLUTION
    ============================================================

Anonymous:

GET /public/domains/:hostname

ACTIVE only.

Otherwise:
404

Return ONLY:

{
tenantId,
canonicalHost
}

canonicalHost MUST come from the stored normalized ACTIVE registry record.

Do not expose:

verificationToken
status
actor ids
timestamps
certificate state
GCP resource names

Also expose tenant → ACTIVE hostname lookup for shared-route redirect as
needed, e.g.:

GET /public/sites/:tenantId/domain

{
canonicalHost: string | null
}

Use the deterministic tenant pointer rather than a Firestore collection query.

============================================================
16. CANONICAL HOST SOURCE — REQUIRED
    ============================================================

The renderer must NOT construct its canonical hostname from the raw request
Host merely because lookup succeeded.

Flow:

request Host
↓ normalize
public API lookup
↓
{ tenantId, canonicalHost }
↓
canonical base:
https://{canonicalHost}

The returned ACTIVE registry canonicalHost is the trusted source after lookup.

Request Host remains only the lookup key.

============================================================
17. RENDERER/FIRESTORE BOUNDARY
    ============================================================

Renderer must remain Firestore-free.

Custom request:

browser
↓
site-renderer
↓
Express public domain API
↓
Firestore domain registry
↓
tenantId/canonicalHost
↓
existing public SiteDefinition API
↓
PUBLISHED site

No Firestore SDK in site-renderer.

============================================================
18. CUSTOM ROOT ROUTES
    ============================================================

Repurpose current renderer root:

/

for ACTIVE custom domains.

Add:

/contact

Custom request:

Host
↓
normalize request host
↓
resolve ACTIVE domain via API
↓
tenantId + canonicalHost
↓
get public site
↓
require site.status === 'PUBLISHED'
↓
render

Unknown/inactive host:
404.

Custom domain must NEVER expose DRAFT/working content.

============================================================
19. SHARED RENDER HELPERS
    ============================================================

Avoid duplicating the current:

/site/[tenantId]

rendering implementation.

Extract reusable server-side Home/Contact rendering pieces only where needed.

Both shared and custom routes render the same:

branding
Hero
Services
Gallery
Testimonials
Contact
section ordering
SiteShell

No visual redesign.

============================================================
20. SITE SHELL PATHING
    ============================================================

Remove hardcoded assumptions that internal navigation always starts with:

/site/{tenantId}

Pass an explicit site base path or equivalent.

Shared:

sitePath = /site/{tenantId}

Custom:

sitePath = ''

Expected custom links:

Home:
/

Section:
#services

Contact:
/contact

Custom-domain users must not bounce to the shared hostname merely by clicking
site navigation.

No content schema changes.

============================================================
21. LEAD FORM
    ============================================================

Custom:

https://example.com/contact

must submit a lead for the tenant resolved SERVER-SIDE from the ACTIVE domain.

Continue passing the resolved tenantId to the existing LeadForm machinery.

Existing public lead endpoint must still validate:

published Contact section exists
action is leadForm

Do not weaken lead validation.

============================================================
22. SHARED URL REDIRECT
    ============================================================

When a tenant has an ACTIVE custom hostname:

normal published:

/site/{tenantId}

should permanently redirect to:

https://canonicalHost/

and:

/site/{tenantId}/contact

to:

https://canonicalHost/contact

Preview/DRAFT MUST NOT redirect.

Domainless tenant:
shared route renders normally.

Destination comes ONLY from the ACTIVE registry lookup.

No request-controlled redirect destination.

============================================================
23. NEXT.JS REDIRECT API — REQUIRED CORRECTION
    ============================================================

Use Next.js App Router:

permanentRedirect(...)

for the permanent shared → custom redirect.

Do NOT attempt:

redirect(url, 308)

Use the correct framework API that produces the permanent redirect.

Absolute custom-domain URLs are expected.

============================================================
24. resolveSiteBaseUrl
    ============================================================

Preserve Step 1.22 architecture.

Domain is NOT persisted in SiteDefinition.

Evolve the URL helper so it may receive a TRUSTED active canonicalHost.

If active:

https://{canonicalHost}

Otherwise:

shared SITE_PUBLIC_ORIGIN/site/{tenantId}

No /site/{tenantId} suffix on a custom domain.

============================================================
25. INDEXING HELPERS — REQUIRED CORRECTION
    ============================================================

Separate the concepts:

environment says public indexing is enabled

from:

shared public origin is valid.

Conceptually create/retain helpers similar to:

indexingEnvironmentEnabled(env)

resolveSharedPublicOrigin(env)

Shared public site indexability requires:

indexingEnvironmentEnabled
AND
valid shared origin

Custom public site indexability requires:

indexingEnvironmentEnabled
AND
ACTIVE trusted canonicalHost

Do not make an ACTIVE custom domain's indexing policy depend on
SITE_PUBLIC_ORIGIN merely as an implementation accident.

Preview remains noindex.

Contact remains noindex according to existing policy.

============================================================
26. METADATA
    ============================================================

Custom Home:

title/site description unchanged

canonical:
https://canonicalHost/

OpenGraph URL:
custom canonical

JSON-LD LocalBusiness.url:
custom canonical

existing BusinessProfile values unchanged

social image unchanged

No domain state becomes BusinessProfile data.

============================================================
27. ROBOTS.TXT
    ============================================================

Replace host-blind robots metadata route if necessary with a host-aware route
handler.

Policy:

indexing env disabled:
Disallow: /

ACTIVE trusted custom domain + indexing enabled:
Allow: /
Sitemap: https://canonicalHost/sitemap.xml

shared SITE_PUBLIC_ORIGIN host + indexing enabled:
allow shared /site/ behavior appropriate for domainless tenants

unknown/inactive/raw run.app host:
Disallow: /

Request Host must first match trusted platform/shared origin or ACTIVE registry.

============================================================
28. SITEMAP
    ============================================================

Implement:

/sitemap.xml

for ACTIVE custom domains only.

Home URL only:

https://canonicalHost/

Contact is noindex:
do not include it.

Shared host:
no platform-wide sitemap.

Unknown/inactive host:
404.

No tenant enumeration.

============================================================
29. RAW CLOUD RUN HOST
    ============================================================

Root requests to unregistered hostnames, including the direct run.app host:

404

or fail closed where robots applies.

Do not make run.app a tenant canonical.

Shared /site/{tenantId} behavior is tied to the configured shared public
origin.

============================================================
30. PORTAL
    ============================================================

Add Custom Domain management under Manage Website.

States:

No domain:
hostname field + Add Domain

PENDING_VERIFICATION:
TXT instructions
Verify
Remove

VERIFIED:
routing instructions
Activate
Remove

ACTIVE:
live URL
Disable
Remove

DISABLED:
show new ownership TXT verification instructions
Verify
Remove

After successful Verify from DISABLED:
state becomes VERIFIED
Activate is available again.

Do NOT show a direct Reactivate button that bypasses fresh verification.

Friendly controlled errors:

already in use
tenant already has another domain
TXT not visible yet
TXT mismatch
temporary DNS failure
verified
active

============================================================
31. DNS ROUTING ENVIRONMENT
    ============================================================

Do not use a variable named CUSTOM_DOMAIN_A_RECORD_IP while describing it as
both A and AAAA.

Use something clearer such as:

CUSTOM_DOMAIN_IPV4_ADDRESS

for the platform LB IPv4 address.

Optional:

CUSTOM_DOMAIN_CNAME_TARGET

for subdomains if the platform actually has a suitable hostname.

Do not advertise IPv6/AAAA unless there is an explicit IPv6 platform value.

These are platform environment values, not Firestore tenant data.

============================================================
32. CERTIFICATE / OPERATOR PROCEDURE
    ============================================================

Application does not provision certificates.

Document the V1 sequence roughly:

1. PLATFORM_ADMIN registers hostname.
2. Customer creates BakerRang ownership TXT.
3. PLATFORM_ADMIN verifies.
4. Operator configures Certificate Manager coverage for that hostname on the
   shared global HTTPS load balancer.
5. Customer points hostname at the shared LB:
   A -> CUSTOM_DOMAIN_IPV4_ADDRESS
   or configured subdomain CNAME strategy.
6. Wait until HTTPS/certificate is ready.
7. PLATFORM_ADMIN activates.
8. Test / and /contact.
9. Normal shared URL permanently redirects to custom domain.

Do not require a distinct URL-map host rule per tenant unless the real
deployed LB configuration actually needs one.

No certificate IDs/resource names are persisted in tenant CMS data.

============================================================
33. SNAPSHOT ISOLATION
    ============================================================

Mandatory.

Publish site.

Capture published/current.

Register/verify/activate domain.

Assert published/current is unchanged.

Disable domain.

Assert snapshot unchanged.

Remove domain.

Assert snapshot unchanged.

Domain lifecycle is immediate routing state independent of CMS publication.

============================================================
34. LEGACY TENANTS
    ============================================================

Tenants with no:

siteDomains
tenantSiteDomains

must work exactly as before.

Shared:

/site/{tenantId}

renders.

No migration.

No domain record seeded.

Existing SiteDefinition contract unchanged.

============================================================
35. BACKEND TESTS
    ============================================================

Add focused tests for at least:

hostname validation:
- lowercase normalization
- trailing dot
- IDN → punycode
- punycode TLD support
- registration rejects port
- URL/path/query/userinfo/wildcard/IP/localhost rejected

request-host helper:
- accepts/strips request port
- normalizes appropriately

registration:
- new tenant+host creates domain + pointer atomically
- different tenant same host -> 409
- same tenant second different hostname -> 409
- same tenant same hostname -> idempotent, no token/status reset
- concurrent invariant represented by transaction tests where feasible

verification:
- random token
- correct TXT
- chunked TXT
- multiple TXT
- missing
- mismatch
- transient resolver failure

activation:
- only VERIFIED -> ACTIVE

disable:
- ACTIVE -> DISABLED
- routing immediately stops
- token rotated
- previous verification invalidated
- cannot directly activate DISABLED

reverification:
- DISABLED + new TXT -> VERIFIED
- then activate

remove:
- domain + tenant pointer removed atomically
- fresh registration requires fresh token

public resolution:
- ACTIVE -> {tenantId, canonicalHost}
- all other states -> 404
- no sensitive fields

tenant canonical lookup:
- pointer + ACTIVE record
- inactive returns null

snapshot isolation

authorization:
PLATFORM_ADMIN success
OWNER/ADMIN/STAFF 403
anonymous 401

============================================================
36. RENDERER TESTS
    ============================================================

Cover:

Host rather than arbitrary X-Forwarded-Host precedence.

Host normalization.

Custom root:
- ACTIVE host resolves correct tenant
- PUBLISHED only
- unknown host 404
- DRAFT cannot escape

Custom contact:
- correct tenant
- leadForm eligibility
- correct lead tenant

Navigation:
- custom links remain on custom host/path

Shared redirect:
- permanentRedirect path behavior
- Home -> custom /
- Contact -> custom /contact
- preview does not redirect
- domainless does not redirect

Canonical:
- custom uses API-returned canonicalHost
- not raw Host
- no /site/{tenantId}

OG/JSON-LD custom URLs

Indexing:
- env disabled fail closed
- custom ACTIVE + env enabled works without depending on shared-origin validity
- shared indexing still requires valid shared origin

robots

custom-domain sitemap Home only

raw run.app/unknown root fails closed

============================================================
37. PUBLIC DATA SANITIZATION
    ============================================================

Anonymous domain response may expose only intentional routing facts.

No:

verificationToken
status
createdByUserId
verifiedByUserId
activatedByUserId
disabledByUserId
GCP cert name
LB resource
internal Firestore metadata

============================================================
38. FILE BOUNDARY
    ============================================================

Claude's proposed file set is generally approved.

Expected additions include:

server/domain/siteDomain.js
server/services/siteDomainService.js
server/test/siteDomainService.test.js
public route tests

renderer:
lib/requestHost.ts
lib/domains.ts
shared PublicHome/PublicContact helpers
custom app/contact/page.tsx
host-aware robots route
host-aware sitemap route

portal:
CustomDomainEditor.tsx
domain API client

Expected modifications:

tenant routes
public sites routes
BusinessWebsite
SiteShell path behavior
shared site Home/Contact routes
siteUrl/SEO helpers
env examples
appropriate tests

Do NOT modify site-schema for domain data.

Do NOT modify:

section content contracts
BusinessProfile schema
Branding schema
Media persistence
published SiteDefinition structure
lead data model

============================================================
39. GOOGLE CLOUD PROVISIONING
    ============================================================

Do NOT implement actual GCP resource mutations.

No:

load-balancer SDK
Certificate Manager SDK
Terraform
gcloud subprocesses

Application V1 stops at:

verified domain registry
manual infra instructions
manual activation

============================================================
40. NO ALIASES
    ============================================================

Exactly one primary custom hostname per tenant in Step 1.23.

Do not implement:

www + apex alias pair
wildcards
multiple domains
redirect aliases

Document that www/apex forwarding is currently an external/operator concern.

============================================================
41. VERIFY
    ============================================================

Backend:

cd server
npm test
npm run lint

Renderer:

cd platform/apps/site-renderer
npm test

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

All prior Steps 1.2–1.22 remain green.

============================================================
42. MANUAL DEV E2E
    ============================================================

Plan for the eventual live check:

1. Domainless existing DEV tenant still works at shared URL.

2. Register a controlled test hostname.

3. Inspect:
   siteDomains/{hostname}
   tenantSiteDomains/{tenantId}

4. Confirm TXT token/instructions.

5. Verify ownership using controlled DNS or the testable resolver seam where
   appropriate.

6. Confirm VERIFIED.

7. Configure operator-managed test LB/cert/DNS as appropriate.

8. Activate.

9. Request custom /.

10. Confirm PUBLISHED tenant site renders.

11. Working Preview edits remain only on shared preview.

12. Republish and custom site updates.

13. Custom:
    canonical
    OG URL
    JSON-LD URL
    robots
    sitemap

14. /contact and Lead Form work for correct tenant.

15. Shared normal route permanently redirects to custom.

16. Preview does not redirect.

17. Disable.

18. Custom routing stops immediately.

19. Confirm new verification token is required before reactivation.

20. Shared URL resumes normal published rendering/canonical.

21. Remove.

22. Both registry + tenant pointer disappear.

23. Published snapshot bytes did not change throughout domain lifecycle.

24. Only bakerrang-dev domain records were modified.

============================================================
43. REPORT
    ============================================================

Return:

1. Files added.
2. Files modified.
3. Domain model.
4. Tenant pointer/index model.
5. Transactional uniqueness behavior.
6. Registration idempotency.
7. Hostname validation.
8. Request-host validation.
9. Host-header trust model.
10. DNS verification.
11. Disable/reverification behavior.
12. Authorization.
13. Public resolution contract.
14. CanonicalHost trust chain.
15. Renderer custom routing.
16. Shared rendering reuse.
17. SiteShell path changes.
18. Lead routing.
19. Shared permanent redirect behavior.
20. URL resolver changes.
21. Indexing helper changes.
22. robots.
23. sitemap.
24. SEO/OG/JSON-LD behavior.
25. Snapshot isolation.
26. Legacy compatibility.
27. Portal UX.
28. Infrastructure env values.
29. Operator onboarding sequence.
30. Tests/results.
31. Build/lint results.
32. Deviations.
33. Risks.
34. Manual DEV verification performed, if any.

Do not implement future automation or aliases.

------- Further changes requred after Claude audit ------------------

Narrow security correction for Step 1.23 — custom-domain CORS only.

Do not change domain lifecycle, renderer routing, SEO, portal UX, or
infrastructure behavior.

============================================================
PROBLEM
============================================================

The current app-wide CORS callback allows ACTIVE custom-domain origins across
the entire API.

That creates two problems:

1. An ACTIVE customer domain becomes a credentialed CORS-trusted origin for
   unrelated authenticated endpoints such as /tenants/* and /vault/*.

2. Any request carrying a structurally-valid non-allowlisted Origin can cause
   an unauthenticated Firestore domain lookup before route-level limiting,
   even when the request is unrelated to custom-domain lead submission.

Custom-domain CORS exists only to support lead submission from:

https://customer-domain.com/contact

to the public lead endpoint.

============================================================
1. KEEP STATIC FIRST-PARTY CORS BEHAVIOR
   ============================================================

Existing first-party configured origins such as:

CLIENT_DOMAIN
PORTAL_DOMAIN
SITE_RENDERER_DOMAIN
CHATBOT_ORIGIN

must continue to work as they do today.

Do not weaken or broaden them.

Do not use:

Access-Control-Allow-Origin: *

with credentials.

============================================================
2. CUSTOM-DOMAIN CORS MUST BE ROUTE-SCOPED
   ============================================================

ACTIVE custom-domain resolution must occur ONLY for the public lead endpoint:

POST /public/sites/:tenantId/leads

and its corresponding CORS preflight.

Do NOT make ACTIVE custom-domain origins trusted for all:

/public/*

unless the actual Express routing structure makes that unavoidable.

Preferred behavior is the narrowest exact lead route.

Requests to unrelated paths such as:

/tenants/*
/vault/*
other authenticated APIs
unrelated /public/* endpoints

must NOT trigger a custom-domain Firestore lookup merely because they contain
an Origin header.

============================================================
3. BIND CUSTOM ORIGIN TO THE TARGET TENANT
   ============================================================

When the request Origin is not one of the static first-party origins:

1. Parse the Origin safely.
2. Require the existing custom-domain constraints:
    - valid URL
    - HTTPS in production
    - no unexpected port in production
    - no path/query/hash/userinfo
3. Normalize the hostname.
4. Resolve it through the ACTIVE site-domain registry.
5. Require the resolved domain's tenantId to equal the tenantId in:

   /public/sites/:tenantId/leads

Only then allow that Origin.

Example:

Origin:
https://tenant-a.com

ACTIVE registry:
tenant-a.com -> tenant-a

POST:
/public/sites/tenant-a/leads

=> allowed

But:

Origin:
https://tenant-a.com

POST:
/public/sites/tenant-b/leads

=> custom-domain CORS denied

Even though the lead endpoint itself remains public, keep browser CORS
authorization tenant-consistent.

============================================================
4. IMPLEMENTATION SHAPE
   ============================================================

Inspect the existing Express/CORS structure and choose the smallest safe
implementation.

Acceptable approaches include:

- route-scoped CORS middleware on the public lead route, or
- a request-aware CORS options delegate that evaluates custom domains only
  when the request path/method is the lead endpoint/preflight.

Do NOT keep an app-wide custom-domain Firestore lookup branch.

The static first-party allowlist may remain app-wide.

If route-scoped CORS is used, ensure OPTIONS/preflight works correctly.

Do not duplicate broad CORS logic unnecessarily.

============================================================
5. KEEP EXISTING CUSTOM-DOMAIN VALIDATION
   ============================================================

Preserve the existing behavior already audited as correct:

- ACTIVE domains only
- HTTPS required in production
- HTTP only if deliberately allowed outside production
- malformed origin rejected
- port rejected in production
- path/query/hash/userinfo rejected
- canonicalHost/registry match required
- inactive/PENDING/VERIFIED/DISABLED domain rejected
- Firestore error fails closed

============================================================
6. NO FIRESTORE AMPLIFICATION ON UNRELATED ROUTES
   ============================================================

A request such as:

GET /tenants/abc
Origin: https://random-example.com

must perform NO custom-domain resolution.

Likewise arbitrary Origin headers sent to unrelated API routes must not cause
siteDomains lookups.

Only the lead endpoint/preflight should invoke ACTIVE custom-domain lookup.

============================================================
7. TESTS
   ============================================================

Update server/test/cors.test.js or the appropriate existing tests.

Add explicit coverage for:

A. ACTIVE custom origin + matching tenant lead POST
-> Access-Control-Allow-Origin set to that exact origin

B. ACTIVE custom origin + DIFFERENT tenant lead POST
-> custom-domain CORS denied

C. ACTIVE custom origin + authenticated /tenants/* request
-> no Access-Control-Allow-Origin for that custom origin

D. arbitrary non-allowlisted Origin + unrelated route
-> no custom-domain resolution is called

E. PENDING custom domain + lead POST
-> denied

F. VERIFIED-but-not-ACTIVE + lead POST
-> denied

G. DISABLED + lead POST
-> denied

H. removed/unknown domain + lead POST
-> denied

I. production HTTP custom origin
-> denied

J. malformed/path/query/port cases remain denied

K. first-party static allowlisted origins continue to behave exactly as before

L. OPTIONS/preflight for valid custom-domain lead route succeeds

M. preflight for mismatched tenant/custom-domain pairing is denied

If there is already a resolver stub/call-count seam, assert that unrelated
routes cause ZERO custom-domain resolver calls.

============================================================
8. SCOPE
   ============================================================

Expected files should be limited roughly to:

server/app.js
server/config/origins.js
server/routes/publicSites.js
server/test/cors.test.js

Use fewer files if possible.

Do not modify:

siteDomain lifecycle
siteDomainService registration/verification
renderer
portal
SiteDefinition
lead model
SEO
robots
sitemap
Google Cloud runbook

No new dependency.

============================================================
9. VERIFY
   ============================================================

Run:

cd server
npm test

Run scoped StandardJS on every backend file changed by this correction.

Also run:

cd platform
npm run typecheck
npm run lint
npm run build

No need to fix unrelated pre-existing full-server lint violations.

============================================================
10. REPORT
    ============================================================

Return:

# IMPLEMENTATION_REPORT

Include:

Files modified
CORS architecture after correction
Exact route receiving custom-domain CORS
Tenant-origin binding behavior
How preflight is handled
How unrelated routes avoid Firestore resolution
Tests added/updated
Backend test result
Scoped StandardJS result
Platform typecheck/lint/build results
Deviations
Risks