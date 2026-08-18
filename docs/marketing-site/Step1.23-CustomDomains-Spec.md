# Claude Code Assignment — Step 1.23 Custom Domains

DO NOT MODIFY CODE.

Steps 1.7–1.22 are complete and manually verified.

We are returning to the established BakerRang workflow:

Claude inspects + plans
↓
ChatGPT reviews the plan
↓
Codex implements the reviewed plan
↓
Claude/ChatGPT review implementation
↓
manual DEV verification

The next milestone is:

STEP 1.23 — CUSTOM DOMAINS

============================================================
1. CURRENT PLATFORM STATE
   ============================================================

The platform currently has:

- multi-tenant businesses
- authenticated Portal
- public multi-tenant site renderer
- working/published lifecycle
- Hero
- Services
- Gallery
- Testimonials
- Contact / Lead Form
- Leads
- Media
- section composition/order/removal
- tenant branding
- Business Profile
- SEO metadata
- OpenGraph/Twitter metadata
- LocalBusiness JSON-LD
- robots/indexing foundation

Current public sites are conceptually served at:

/site/{tenantId}

Step 1.22 established the principle:

public/canonical URL
≠
persisted CMS content

and introduced a renderer seam conceptually equivalent to:

resolveSiteBaseUrl(tenantId)

Today it resolves the shared platform URL:

https://<shared-renderer>/site/{tenantId}

Step 1.23 should allow that same tenant to resolve to:

https://customer-domain.com

without changing:

SiteDefinition
Business Profile
published snapshots
SEO content fields

============================================================
2. IMPORTANT CURRENT GOOGLE CLOUD FACT
   ============================================================

The deployed runtime is Google Cloud Run.

As of this planning milestone, Google documents:

- global external Application Load Balancer as the RECOMMENDED option
  for Cloud Run custom domains
- direct Cloud Run Domain Mapping as Limited Availability / Preview
- multiple custom domains can route to the same Cloud Run service through
  the load balancer approach

Do NOT casually make the product depend on Preview Cloud Run Domain Mapping.

Inspect existing BakerRang deployment assumptions and recommend the cleanest
production architecture.

Do NOT implement anything.

============================================================
3. PRIMARY PRODUCT GOAL
   ============================================================

Allow a published tenant website to be available at a customer-owned hostname.

Example:

current:
https://sites.bakerrang.com/site/tenant-123

custom:
https://utahshowerdoors.com

with:

Home:
https://utahshowerdoors.com/

Contact:
https://utahshowerdoors.com/contact

The tenant's content remains served by the SAME shared site-renderer
application.

Do NOT create:

one renderer deployment per tenant
one codebase per tenant
one Firestore database per tenant

============================================================
4. MAJOR ARCHITECTURAL PRINCIPLE
   ============================================================

Custom-domain configuration is INFRASTRUCTURE / ROUTING STATE.

It is NOT CMS content.

Therefore custom-domain data should NOT be stored inside:

working SiteDefinition
published SiteDefinition
published/current snapshot
branding
Business Profile
Home.sections

Changing or activating a domain should NOT require site republishing.

Published CONTENT and DOMAIN ROUTING have separate lifecycles.

Confirm this principle against the shipped implementation.

============================================================
5. INSPECT ACTUAL CURRENT CODE
   ============================================================

Inspect the shipped Step 1.22 code, especially:

server/services/siteService.js
server/routes/publicSites.js or actual public-site routes
server/routes/tenants.js
server/domain/businessProfile.js
server/domain/siteBranding.js
server/services/mediaService.js

platform/packages/site-schema/src/index.ts

platform/apps/site-renderer/lib/siteUrl.ts
platform/apps/site-renderer/lib/seo.ts
platform/apps/site-renderer/lib/api.ts
platform/apps/site-renderer/app/site/[tenantId]/page.tsx
platform/apps/site-renderer/app/site/[tenantId]/contact/page.tsx
platform/apps/site-renderer/app/robots.ts
platform/apps/site-renderer/components/SiteShell or actual equivalents

platform/apps/portal/app/businesses/BusinessWebsite.tsx
platform/apps/portal/lib/site.ts

Cloud Run deployment/config files
Dockerfiles
environment examples
any GCP docs/scripts in repo

Document the real state.

Do not assume filenames that differ from shipped code.

============================================================
6. CURRENT PUBLIC REQUEST FLOW
   ============================================================

Document exactly how today:

browser
↓
site-renderer
↓
Express public API
↓
Firestore

works.

Important invariant:

PUBLIC SITE RENDERER MUST NOT DIRECTLY ACCESS FIRESTORE.

That remains true in Step 1.23.

Host → tenant lookup must respect this boundary.

============================================================
7. CUSTOM DOMAIN REQUEST FLOW
   ============================================================

Design the desired request path.

Conceptually:

Browser:
GET https://utahshowerdoors.com/

        ↓

Google external HTTPS infrastructure

        ↓

shared Cloud Run site-renderer

        ↓

renderer determines incoming hostname

        ↓

renderer asks sanitized Express public API to resolve hostname

        ↓

API maps ACTIVE VERIFIED hostname → tenantId

        ↓

renderer fetches / renders the tenant's PUBLISHED SiteDefinition

The exact optimized API contract is for Claude to determine.

No renderer Firestore client.

============================================================
8. HOST HEADER IS UNTRUSTED INPUT
   ============================================================

Step 1.22 correctly avoided trusting Host as canonical identity.

Step 1.23 necessarily receives a hostname from the incoming request.

Treat it as UNTRUSTED INPUT.

It is acceptable to use it as a lookup key after:

- normalization
- validation
- lookup against server-owned ACTIVE domain registry

It is NOT acceptable to say:

request Host = canonical URL

without verifying that hostname is registered and active for that tenant.

Design this carefully.

============================================================
9. HOST / FORWARDED HEADER BEHAVIOR
   ============================================================

Inspect how the current Next.js renderer is deployed behind Cloud Run /
Google's proxy infrastructure.

Determine which request value should represent the public requested hostname:

Host
Forwarded
X-Forwarded-Host
or another appropriate value

Do not simply trust arbitrary forwarding headers.

Recommend a clear request-host helper.

The helper should normalize:

case
optional port
trailing dot where appropriate

and reject malformed hosts.

============================================================
10. DOMAIN NORMALIZATION
    ============================================================

Define an exact normalized hostname contract.

Examples:

Example.COM
->
example.com

example.com.
->
example.com

Reject concepts such as:

https://example.com
example.com/path
example.com?x=1
user@example.com
*.example.com
localhost
raw IP addresses

unless Claude finds a strong V1 reason otherwise.

Evaluate Internationalized Domain Names.

Options:

A. V1 ASCII hostnames only

B. normalize with domainToASCII / punycode

Prefer a standards-safe small solution.

Do not build a generic URL parser UI when the field is specifically a hostname.

============================================================
11. ONE PRIMARY DOMAIN VS MULTIPLE DOMAINS
    ============================================================

Evaluate V1 scope.

Potential choices:

A. exactly one custom hostname per tenant

B. one PRIMARY hostname + aliases

C. unrestricted multiple domains

Keep V1 intentionally small.

However, common real-world behavior includes:

example.com
www.example.com

Evaluate whether supporting both as primary/redirect alias is worth including
now.

Do not create a huge domain-management subsystem.

Recommend the smallest useful contract.

============================================================
12. GLOBAL DOMAIN UNIQUENESS
    ============================================================

A custom hostname must belong to at most ONE tenant.

This is a global platform invariant.

Path-based tenant isolation normally places tenant data under:

tenants/{tenantId}

but hostname uniqueness is inherently platform-global.

Evaluate a registry such as:

siteDomains/{normalizedHostname}

with fields such as:

tenantId
hostname
status
verificationToken
createdAt
updatedAt
createdByUserId
verifiedAt?
activatedAt?

This is illustrative, not mandated.

Determine the cleanest authoritative storage model.

Avoid maintaining two redundant authoritative copies unless needed.

============================================================
13. DOMAIN STATES
    ============================================================

Design a small state machine.

Potential:

PENDING_VERIFICATION
VERIFIED
ACTIVE
DISABLED

or:

PENDING
ACTIVE

with separate timestamps.

We need to distinguish at least:

- user/admin entered a hostname
- ownership proved
- domain actually safe to route publicly

Determine exact states.

Avoid excessive workflow states.

============================================================
14. OWNERSHIP VERIFICATION
    ============================================================

A tenant must not be able to claim arbitrary third-party domains.

Evaluate DNS ownership verification.

A likely flow:

1. PLATFORM_ADMIN enters hostname.

2. Server generates cryptographically-random verification token.

3. Portal instructs operator/domain owner to add a TXT record.

Example conceptually:

_bakerrang-verification.example.com
TXT
<token>

4. "Verify" asks backend to resolve DNS TXT.

5. Backend marks domain VERIFIED only when expected token is observed.

Determine:

exact TXT record name
token format/entropy
DNS lookup implementation
timeout/error behavior
multiple TXT values
DNS propagation behavior
retry semantics

No arbitrary shelling out to nslookup/dig.

Use Node facilities/library only if needed.

============================================================
15. VERIFICATION TOKEN SECURITY
    ============================================================

Verification tokens:

- must not be guessable
- are not authentication credentials
- may be visible in DNS intentionally
- should be generated server-side

Determine whether token should remain after verification or be removed from the
Firestore document.

Recommend the simplest safe model.

============================================================
16. DOMAIN TAKEOVER / REASSIGNMENT
    ============================================================

Think through:

Tenant A registers example.com but never verifies.

Can Tenant B register it?

Tenant A verifies it.

Can anyone else claim it?

Tenant removes example.com.

When can it be reused?

If DNS still points at BakerRang after removal, could another tenant steal it?

Ownership verification must protect reassignment.

Design exact uniqueness/removal semantics.

============================================================
17. CLOUD INFRASTRUCTURE ARCHITECTURE
    ============================================================

Evaluate the correct Google Cloud topology.

Expected direction may be:

Global external Application Load Balancer
↓
serverless NEG
↓
single site-renderer Cloud Run service

with:

customer DNS
TLS certificate
hostname routing

But inspect actual deployment before finalizing.

Determine:

- whether one load balancer can serve all tenant hostnames
- how TLS certificates are expected to be managed
- whether Certificate Manager is appropriate
- whether one static global IP is desirable
- apex-domain DNS behavior
- www/subdomain DNS behavior

Do NOT implement infrastructure in this planning task.

============================================================
18. INFRASTRUCTURE AUTOMATION — MAJOR SCOPE DECISION
    ============================================================

Decide whether Step 1.23 should:

A. automatically provision Google Cloud load-balancer/certificate resources

or:

B. establish application custom-domain registry/routing/verification while
infrastructure activation remains an operator step

or:

C. a narrowly defined middle ground

My preference is incremental:

do NOT introduce a large Cloud resource-provisioning engine unless it is truly
required for a usable V1.

We can tolerate operator-managed infrastructure during an early platform
milestone if the app's data model and routing architecture are correct.

But "ACTIVE" must mean something precise.

Recommend deliberately.

============================================================
19. NO CLOUD RUN PREVIEW DEPENDENCY
    ============================================================

Do not choose direct Cloud Run Domain Mapping merely because it is easier if
that makes the core product depend on the Preview/Limited Availability
feature.

If Claude believes direct mappings are still appropriate for this project,
explain why despite that status.

Otherwise use the recommended load-balancer model.

============================================================
20. DOMAIN ACTIVATION
    ============================================================

Ownership VERIFIED does not necessarily mean:

DNS points correctly
TLS is ready
load balancer accepts the hostname

Define how a domain becomes ACTIVE.

Potential V1:

PLATFORM_ADMIN manually clicks Activate after infrastructure is configured.

Potential stronger V1:

backend performs safe readiness checks.

Evaluate:

DNS target check
HTTPS reachability
certificate readiness

Avoid circular checks where the app must already route the host in order to
activate it.

Recommend exact semantics.

============================================================
21. PLATFORM ADMIN AUTHORIZATION
    ============================================================

Maintain current website-management rule:

PLATFORM_ADMIN only

for:

add domain
verify domain
activate domain
disable/remove domain

Do NOT broaden custom-domain management to:

OWNER
ADMIN
STAFF

in this milestone.

Infrastructure-sensitive operations stay platform-admin-controlled.

============================================================
22. PORTAL UX
    ============================================================

Add a small Custom Domain management UI.

Potential location:

Business
→ Manage Website
→ Custom Domain

Expected experience:

Custom Domain
example.com

Status:
Pending verification / Verified / Active

DNS ownership verification instructions

Verify button

Infrastructure/DNS routing instructions when appropriate

Activate / Disable / Remove actions as chosen

Keep it operational and understandable.

No domain registrar integration.

No DNS provider integration.

No automatic Cloud DNS assumption.

Customers may use:

Google Cloud DNS
Cloudflare
GoDaddy
Namecheap
etc.

============================================================
23. PUBLIC VS INTERNAL DOMAIN DATA
    ============================================================

Verification token and infrastructure status are INTERNAL admin data.

Do NOT expose them in anonymous SiteDefinition.

Determine what routing metadata, if any, needs to be returned to the renderer.

The public renderer likely needs only:

tenantId
normalized active hostname
possibly canonical base URL/routing mode

through a sanitized public API response.

Do not expose:

verificationToken
createdByUserId
internal status history
GCP resource names
certificate IDs

============================================================
24. PUBLIC DOMAIN RESOLUTION API
    ============================================================

Design the exact anonymous API endpoint used by the renderer.

Potential:

GET /public/domains/:hostname

returning sanitized routing information

or:

GET /public/sites/by-domain/:hostname

returning tenant + published SiteDefinition together

or another clean design.

Consider:

number of API requests
existing getPublicSite flow
request-local React cache
404 behavior
future caching

Prefer the smallest coherent contract.

Do NOT let arbitrary domain lookup expose tenant administration metadata.

============================================================
25. UNKNOWN / INACTIVE HOSTNAME
    ============================================================

If incoming hostname is:

unknown
PENDING_VERIFICATION
VERIFIED but not ACTIVE
DISABLED

the custom-domain root should NOT render a tenant site.

Expected:

404

or another fail-closed response.

Do not silently choose a tenant.

============================================================
26. CUSTOM-DOMAIN ROOT ROUTES
    ============================================================

Today:

/site/{tenantId}
/site/{tenantId}/contact

Custom domains need:

/
/contact

Inspect current Next App Router layout.

Recommend exact route structure.

Potential:

app/page.tsx
app/contact/page.tsx

that resolve host → tenant

or internal rewrites

or another clean approach.

Avoid duplicating all Home rendering logic between:

/site/[tenantId]

and:

/

Extract shared server rendering helpers/components only where genuinely useful.

============================================================
27. CUSTOM DOMAIN MUST ALWAYS SERVE PUBLISHED CONTENT
    ============================================================

Custom domains are PUBLIC.

They must NEVER expose working/DRAFT content.

Custom-domain requests should always resolve:

PUBLISHED SiteDefinition only.

DEV working preview remains through the established preview mechanism.

No:

custom-domain ?preview=true
custom-domain draft fallback

unless already securely established and explicitly required.

============================================================
28. PREVIEW
    ============================================================

Keep preview on the shared BakerRang route.

Example conceptual:

shared renderer preview
/site/{tenantId}?preview=...

Custom domain:

always public/published

This avoids draft content escaping through customer domains.

Confirm actual current preview mechanism.

============================================================
29. SHARED URL AFTER CUSTOM DOMAIN ACTIVATION
    ============================================================

Major SEO/product decision.

Once tenant has:

https://example.com

what should:

https://shared-host/site/{tenantId}

do?

Options:

A. continue rendering, but canonical = custom domain

B. permanent redirect to custom domain

C. behavior differs for preview vs normal

My preference:

normal published shared URL:
redirect to active custom domain

preview:
remain on shared URL

This reduces duplicate public URLs.

Evaluate against current preview implementation and SEO behavior.

Recommend exact HTTP status:

301
308
etc.

============================================================
30. CUSTOM DOMAIN CANONICAL URL
    ============================================================

For an ACTIVE domain:

Home canonical:

https://example.com/

Contact canonical:

https://example.com/contact

No:

/site/{tenantId}

inside the custom-domain canonical.

No canonical derived directly from unverified Host.

Use the verified ACTIVE registry.

============================================================
31. SHARED SITE CANONICAL AFTER DOMAIN ACTIVATION
    ============================================================

If shared URL is not redirected for some reason:

canonical should still prefer:

https://example.com

when that is the tenant's active custom domain.

No duplicate canonical identity.

Determine how renderer obtains active-domain routing metadata without placing it
inside published SiteDefinition.

============================================================
32. resolveSiteBaseUrl HANDOFF
    ============================================================

Step 1.22 intentionally created:

resolveSiteBaseUrl(tenantId)

or its shipped equivalent.

Inspect the implementation.

Step 1.23 should fulfill the intended handoff.

But note:

domain resolution may now depend on:

tenant routing data
request context

rather than just environment variables.

Recommend how to evolve the helper cleanly.

Do NOT put custom domain into SiteDefinition.

============================================================
33. NAVIGATION LINKS
    ============================================================

Inspect current SiteShell/Nav link generation.

On shared site:

/site/{tenantId}#services
/site/{tenantId}/contact

On custom domain:

/#services
/contact

Ensure navigation uses the site's actual rendered base path/origin.

Do NOT accidentally bounce custom-domain users back to:

sites.bakerrang.com/site/{tenantId}

============================================================
34. HERO CTA / SECTION LINKS
    ============================================================

Inspect any existing internal links such as:

#contact
/contact

Ensure custom-domain rendering works with them.

No schema changes merely for URL construction.

============================================================
35. LEAD FORM
    ============================================================

Critical regression check.

Custom domain Contact page still submits a lead to the correct tenant.

Renderer must know the resolved tenantId even though URL does not contain it.

Expected:

example.com/contact

host lookup:
example.com → tenant-123

Lead POST:
tenant-123

Do not derive tenant identity from client-submitted hidden tenant fields if
that weakens existing behavior.

Server continues to validate that published Contact leadForm is enabled.

============================================================
36. MEDIA
    ============================================================

Media URLs should continue working exactly as today.

Custom domain does not change stored media IDs.

No copy/migration of Media.

Do not proxy Media through the customer domain unless current architecture
already does so and there is a clear need.

============================================================
37. BUSINESS PROFILE / JSON-LD
    ============================================================

Existing Business Profile remains unchanged.

On custom domain, JSON-LD:

url
canonical references

should use:

https://example.com

while:

name
description
phone
email
address
serviceAreas
logo/social image

continue using existing explicit data/hydration.

No Business Profile migration.

============================================================
38. OPEN GRAPH
    ============================================================

Existing OG metadata should use the active custom-domain canonical URL.

No content changes.

No new social-image semantics.

============================================================
39. ROBOTS.TXT — REVISIT STEP 1.22
    ============================================================

Step 1.22 intentionally implemented an environment-level robots foundation.

Custom domains make host-level robots behavior meaningful.

Inspect actual:

app/robots.ts

and determine whether it can vary by request hostname.

If Next's metadata-route form is not appropriate for host-aware behavior,
recommend a route-handler alternative.

Desired conceptual behavior:

DEV / indexing disabled:
Disallow /

unknown/inactive custom host:
not publicly routed / fail closed

ACTIVE custom domain + PROD indexing enabled:
Allow /

shared host:
policy consistent with shared-path/redirect decisions

Do not break current DEV safety.

============================================================
40. SITEMAP — NOW RECONSIDER
    ============================================================

Step 1.22 deliberately deferred sitemap because a shared-host sitemap would
require platform-wide tenant enumeration.

Custom domains create a clean per-tenant boundary.

Evaluate:

https://example.com/sitemap.xml

Potential V1 sitemap:

Home only

unless other indexable pages exist.

Contact is currently noindex and should likely not be included.

Do NOT create a platform-wide shared-host sitemap.

If sitemap is now cheap/clean, include it in 1.23.

If there is still a concrete reason to defer, explain.

============================================================
41. ROBOTS → SITEMAP
    ============================================================

For ACTIVE custom domains in index-enabled PROD, robots may naturally include:

Sitemap: https://example.com/sitemap.xml

only if that sitemap actually exists.

Do not emit fake sitemap URLs.

============================================================
42. INDEXING SAFETY
    ============================================================

Maintain:

SITE_PUBLIC_INDEXING_ENABLED

or shipped equivalent.

Custom-domain presence must NOT override environment safety.

Indexing allowed only when:

environment indexing enabled
AND
domain ACTIVE / trusted
AND
page policy permits indexing

Preview remains noindex.

DEV remains fail-closed.

============================================================
43. DOMAIN API MUTATIONS
    ============================================================

Design exact authenticated endpoints.

Potential:

PUT /tenants/:tenantId/site/domain
POST /tenants/:tenantId/site/domain/verify
POST /tenants/:tenantId/site/domain/activate
POST /tenants/:tenantId/site/domain/disable
DELETE /tenants/:tenantId/site/domain

But do not create five endpoints automatically.

Recommend the smallest clear set.

Avoid generic site-config PATCH.

============================================================
44. FULL-STATE VS COMMAND ENDPOINTS
    ============================================================

Domain lifecycle differs from CMS editors.

Adding hostname may be full-state configuration.

Verify/activate/disable are COMMANDS / state transitions.

Evaluate appropriately.

Do not force everything into PUT merely because content editors use PUT.

============================================================
45. TRANSACTIONAL UNIQUENESS
    ============================================================

Registering hostname must prevent races.

Two admins cannot simultaneously assign:

example.com

to two tenants.

Use Firestore transaction/create semantics.

Document exact behavior.

Conflict should be controlled:

409

or another appropriate status.

============================================================
46. RETRIES / DNS PROPAGATION
    ============================================================

DNS verification frequently fails temporarily while records propagate.

Expected failure should be understandable and retryable.

Do not turn "TXT not visible yet" into a 500.

Potential:

409 / 422 with controlled message

or another existing API convention.

Recommend.

============================================================
47. DNS RESOLVER BEHAVIOR
    ============================================================

If using Node dns/promises:

think about:

ENOTFOUND
ENODATA
ETIMEOUT
SERVFAIL
multiple TXT chunks
multiple TXT records

Return controlled operator-facing results.

No raw network exception details leaked publicly.

============================================================
48. DOMAIN REMOVAL
    ============================================================

Define behavior when removing/disabling an ACTIVE domain.

Immediately:

host lookup must stop routing that domain to tenant

shared URL should become tenant's public route/canonical again

Content remains published.

No content mutation.

Infrastructure cleanup may be manual depending on chosen V1 scope.

Explain operator order to avoid surprises.

============================================================
49. REASSIGNMENT AFTER REMOVAL
    ============================================================

A removed hostname should require fresh ownership verification before another
tenant can activate it.

Do not transfer verification state.

No lingering verification token reuse.

============================================================
50. AUDIT FIELDS
    ============================================================

Domain infrastructure is security-sensitive enough to retain basic actor/time
fields.

Evaluate:

createdAt
createdByUserId
updatedAt
verifiedAt
verifiedByUserId?
activatedAt
activatedByUserId?

Avoid building a full event history unless needed.

============================================================
51. LOGGING
    ============================================================

Recommend server-side logs for important lifecycle actions:

domain registered
verification succeeded/failed
activated
disabled/removed

Do not log:

session cookies
OAuth tokens
other secrets

Verification tokens are public-in-DNS but still need not be spammed into logs.

No analytics subsystem.

============================================================
52. PUBLIC ROUTING CACHE
    ============================================================

Host → tenant lookup may happen frequently.

Current public site fetch is no-store/request-cached.

For V1, determine whether domain routing can also remain:

no-store/request-local cache

Prefer correctness over adding a caching subsystem.

Do NOT introduce Redis just for domain resolution.

============================================================
53. FIRESTORE READ COST
    ============================================================

A deterministic:

siteDomains/{hostname}

lookup is preferable to scanning/querying all tenants for every request.

Evaluate this in storage design.

Avoid N+1/domain enumeration.

============================================================
54. CUSTOM DOMAIN NOT IN SITE SNAPSHOT
    ============================================================

Mandatory test.

Publish site snapshot.

Activate domain.

Assert:

published/current bytes are unchanged.

Domain works immediately.

Disable domain.

Assert:

published/current still unchanged.

This proves routing state is independent from publication state.

============================================================
55. LEGACY SITES
    ============================================================

Existing tenants with no custom domain must continue to work exactly as before:

shared:
/site/{tenantId}

No migration required.

No domain doc required.

No custom-domain assumptions.

============================================================
56. DOMAIN ROUTING TESTS
    ============================================================

Cover:

normalized hostname resolves active domain

case normalization

trailing dot if supported

port removal for development where appropriate

unknown domain → 404

pending → 404

verified-but-not-active → 404

disabled → 404

active → correct tenant

No cross-tenant leak.

============================================================
57. REGISTRATION TESTS
    ============================================================

Cover:

valid hostname

malformed hostname

URL instead of hostname

IP

localhost

wildcard

duplicate registration

race-safe uniqueness

same tenant registering same hostname according to chosen idempotency

different tenant conflict

============================================================
58. VERIFICATION TESTS
    ============================================================

Cover:

token generated

correct TXT accepted

wrong TXT rejected

no TXT controlled response

multiple TXT records

chunked TXT if Node returns chunks

DNS transient error controlled

no ownership status fabricated

============================================================
59. ACTIVATION TESTS
    ============================================================

Cover chosen V1 state model.

At minimum:

cannot activate unverified

verified → active via authorized action/readiness rule

active routing works

disable active stops routing

reactivate rules explicit

============================================================
60. AUTHORIZATION TESTS
    ============================================================

Domain management:

PLATFORM_ADMIN allowed

OWNER 403
ADMIN 403
STAFF 403
anonymous 401

Anonymous host resolution:

read-only sanitized route only

No verification token leakage.

============================================================
61. ROOT RENDERER TESTS
    ============================================================

Custom hostname Home renders:

correct tenant
published content
correct branding
correct section ordering
correct navigation

No working content.

============================================================
62. CONTACT ROUTE TESTS
    ============================================================

Custom hostname:

/contact

renders only when published Contact leadForm supports it.

Correct tenant lead submission.

Contact remains noindex according to existing policy.

============================================================
63. SHARED URL REDIRECT TEST
    ============================================================

If chosen policy is redirect after activation:

normal:

/site/{tenantId}
->
custom domain

and:

/site/{tenantId}/contact
->
custom /contact

Preview must NOT redirect away from shared preview route.

Test query/fragment behavior if relevant.

Avoid open redirect.

Destination comes solely from verified domain registry.

============================================================
64. CANONICAL TESTS
    ============================================================

No domain:

shared platform canonical

Active domain:

custom-domain canonical

Unknown/inactive domain cannot influence canonical.

No canonical persisted in Firestore SiteDefinition.

============================================================
65. JSON-LD TESTS
    ============================================================

Active custom domain:

LocalBusiness.url = custom root

Existing structured business data unchanged.

No domain data becomes LocalBusiness content.

============================================================
66. ROBOTS TESTS
    ============================================================

DEV / indexing false:

Disallow

Active custom domain + indexing true:

Allow according to chosen policy

Unknown host:

fail closed

No preview indexing.

============================================================
67. SITEMAP TESTS
    ============================================================

If implemented:

custom domain only

contains absolute custom-domain Home URL

does not include noindex Contact

no platform-wide tenant enumeration

unknown/inactive host cannot expose another site's sitemap.

============================================================
68. WWW / APEX REDIRECTS
    ============================================================

If V1 supports aliases:

determine canonical behavior.

Example:

www.example.com
308
example.com

or the reverse.

Only one PRIMARY canonical hostname.

Alias mapping must also be verified/owned.

Do not create redirect loops.

============================================================
69. HTTPS
    ============================================================

Production custom domains should be HTTPS-only.

TLS termination is expected in Google Cloud infrastructure.

Application canonical URLs should use:

https

for ACTIVE production custom domains.

Do not derive scheme blindly from untrusted headers.

Determine where scheme comes from.

DEV/local tests may use http.

============================================================
70. CLOUD RUN DEFAULT URL
    ============================================================

Do not accidentally make the direct:

*.run.app

service URL a public tenant canonical.

Determine whether the renderer should reject/404 root host routing for its
raw Cloud Run hostname.

Shared BakerRang site path behavior remains through the configured public
origin.

============================================================
71. INFRASTRUCTURE CONFIGURATION DATA
    ============================================================

If the portal needs to show DNS routing instructions, decide what comes from
environment/config rather than Firestore.

Potential:

CUSTOM_DOMAIN_IPV4
CUSTOM_DOMAIN_CNAME_TARGET

But don't invent both unless architecture requires them.

Provider/infrastructure targets are platform configuration, not tenant CMS
data.

============================================================
72. NO DNS PROVIDER AUTOMATION
    ============================================================

Do NOT implement:

Cloudflare API
GoDaddy API
Namecheap API
Google Cloud DNS mutation

in this milestone.

User/admin follows displayed DNS instructions.

Future registrar/provider integrations can build on the same domain state.

============================================================
73. NO DOMAIN PURCHASE
    ============================================================

No:

domain search
registration
purchase
renewal
billing

Customer already owns the domain.

============================================================
74. NO EMAIL DOMAIN CONFIG
    ============================================================

Do not touch:

MX
SPF
DKIM
DMARC

This custom-domain feature is website routing only.

============================================================
75. NO MULTI-SITE TENANT
    ============================================================

Current model is one public website per tenant.

Do not add multiple independent websites per tenant merely because domains are
being introduced.

============================================================
76. PORTAL DOMAIN PRIVACY
    ============================================================

Custom hostname is public infrastructure information.

Verification token is operator/admin data.

No reason to display token on public site.

Portal helper text should explain:

- domain must be owned/controlled
- DNS changes may take time to propagate
- domain becomes public only after verification/activation

Keep UI concise.

============================================================
77. ERROR UX
    ============================================================

Portal should distinguish:

Hostname already in use

Verification record not found yet

Verification token mismatch

DNS lookup temporarily failed

Domain verified

Domain active

Do not dump raw Firestore/DNS/Google errors.

============================================================
78. OPERATOR INFRASTRUCTURE PROCEDURE
    ============================================================

If V1 keeps Google Cloud provisioning manual, provide exact expected operator
sequence in the implementation plan.

For example conceptually:

1. Register domain in BakerRang.
2. Add ownership TXT.
3. Verify.
4. Add hostname/certificate to shared Google ingress.
5. Configure customer DNS routing.
6. Wait for HTTPS readiness.
7. Activate in BakerRang.
8. Test.
9. Shared public route begins redirect/canonical behavior.

But base this on the chosen Google architecture.

============================================================
79. LOCAL DEV
    ============================================================

Custom host routing must be testable locally.

Potential strategies:

hosts file:
127.0.0.1 test-domain.local

or:

Host header via curl

or Playwright context headers

Do not require real public DNS for automated tests.

Production hostname validation may reject .local; unit tests can directly test
routing helpers.

Recommend practical manual DEV verification.

============================================================
80. MANUAL DEV E2E
    ============================================================

Plan a realistic DEV walkthrough.

Potential:

1. Existing published DEV tenant with no custom domain.

2. Shared URL works normally.

3. Open Custom Domain editor.

4. Register a test hostname.

5. Inspect Firestore domain registry.

6. Verify generated ownership TXT instructions.

7. Exercise verification using:
    - a real controlled test DNS name
      OR
    - a documented development test seam without weakening production code.

8. Verify domain state transitions.

9. Configure test routing/infrastructure if needed.

10. Request custom hostname root.

11. Confirm correct tenant PUBLISHED site renders.

12. Preview edits working content but custom host remains old published content.

13. Republish and custom host updates.

14. Check:
    canonical
    OpenGraph URL
    JSON-LD URL
    robots
    sitemap if implemented

15. `/contact` works.

16. Submit lead from custom domain.

17. Lead appears under correct tenant.

18. Shared public route follows chosen redirect/canonical policy.

19. Disable domain.

20. Custom host stops resolving to tenant.

21. Shared path resumes normal canonical behavior.

22. Published snapshot bytes never changed due solely to domain lifecycle.

23. Only bakerrang-dev domain data changed.

============================================================
81. SECURITY REVIEW
    ============================================================

Explicitly assess:

domain hijacking
tenant confusion
Host-header injection
open redirects
cross-tenant routing
verification-token entropy
DNS rebinding/reassignment concerns
public API enumeration
raw internal data leakage

Keep mitigations proportional.

============================================================
82. FILES
    ============================================================

Return exact:

files to add
files to modify
files explicitly unchanged

Likely areas may include:

server/domain/siteDomain.js
server/services/siteDomainService.js
public domain-resolution route
tenant domain routes
portal CustomDomainEditor
renderer request-host/site-routing helpers
root/custom-domain routes
SEO URL helper changes
robots/sitemap

But inspect actual implementation before deciding.

============================================================
83. DO NOT REDESIGN SITE UI
    ============================================================

Step 1.23 is infrastructure/routing.

Do NOT redesign:

Hero
Services
Gallery
Testimonials
Contact
Header
Footer

Custom-domain rendering should look identical to shared rendering.

============================================================
84. DO NOT CHANGE SITE CONTENT SCHEMA
    ============================================================

No changes to section content schema merely for domains.

Business Profile remains the same.

Branding remains the same.

Home.sections remains the same.

============================================================
85. NO PUBLIC FIRESTORE
    ============================================================

This is non-negotiable.

Renderer:

NO Firestore SDK

Domain routing:

renderer → Express public API → Firestore

Do not bypass this because Host lookup seems simple.

============================================================
86. BACKWARD COMPATIBILITY
    ============================================================

All tenants with no domain:

unchanged.

Existing published snapshots:

unchanged.

Existing API consumers:

avoid unnecessary breaking response-envelope changes.

If a public endpoint contract must change, design compatibility deliberately.

============================================================
87. VERIFICATION COMMANDS
    ============================================================

Backend:

cd server
npm test
npm run lint

Platform:

cd platform
npm run typecheck
npm run lint
npm run build

Site renderer tests:

cd platform/apps/site-renderer
npm test

All previous Step 1.2–1.22 tests must remain green.

============================================================
88. INTENTIONAL DEFERRALS
    ============================================================

Explicitly identify what remains later.

Potential:

fully automated Certificate Manager provisioning
automatic LB host-rule creation
registrar/DNS APIs
domain purchase
many aliases
domain analytics
Search Console verification
redirect rules editor
multi-site tenants

Do not silently smuggle them into V1.

============================================================
89. ROADMAP AFTER 1.23
    ============================================================

Recommend the next milestone after Custom Domains.

Potential future areas from the larger platform roadmap include:

Portal Website-management UX polish
local SEO / GBP integration
analytics
reviews
lead notifications
additional CMS capabilities

Do not implement them.

============================================================
90. ARCHITECTURAL PRINCIPLE
    ============================================================

The intended architecture should resemble:

customer DNS + HTTPS infrastructure
↓
shared site-renderer Cloud Run service
↓
validated incoming hostname
↓
public API hostname resolution
↓
ACTIVE domain registry
↓
tenantId
↓
PUBLISHED SiteDefinition
↓
same shared renderer/components

while:

custom domain
≠
CMS content

custom domain
≠
published snapshot

request Host
≠
trusted tenant identity until resolved

and:

renderer
≠
Firestore client

============================================================
DELIVERABLE
============================================================

Return:

1. Current custom-domain readiness.
2. Current renderer/public request flow.
3. Current Step 1.22 URL resolver implementation.
4. Recommended Google Cloud topology.
5. Cloud Run Domain Mapping vs Load Balancer decision.
6. Infrastructure automation vs operator-managed decision.
7. Exact domain data model.
8. Global uniqueness strategy.
9. Domain normalization.
10. One-domain vs primary+alias decision.
11. Exact domain states.
12. Ownership verification design.
13. Verification token design.
14. DNS lookup/error behavior.
15. Registration/reassignment semantics.
16. Activation semantics.
17. Removal/disable semantics.
18. Authorization.
19. Portal UX.
20. Authenticated mutation endpoints.
21. Anonymous domain-resolution endpoint.
22. Public data sanitization.
23. Request-host normalization/trust model.
24. Root custom-domain routing architecture.
25. Home custom-domain route.
26. Contact custom-domain route.
27. Lead Form tenant resolution.
28. Preview behavior.
29. Shared-route behavior after domain activation.
30. Redirect policy/status.
31. Canonical behavior.
32. resolveSiteBaseUrl evolution.
33. Navigation/internal-link behavior.
34. OpenGraph behavior.
35. JSON-LD behavior.
36. robots.txt architecture.
37. Sitemap decision.
38. Indexing safety.
39. HTTPS/scheme handling.
40. Raw run.app behavior.
41. Infrastructure env/config.
42. Firestore read strategy.
43. Caching decision.
44. Snapshot-isolation behavior.
45. Legacy compatibility.
46. Exact backend tests.
47. Exact renderer tests.
48. Exact authorization/security tests.
49. Manual DEV E2E.
50. Production/operator onboarding sequence.
51. Concrete security risks.
52. Concrete infrastructure risks.
53. Files to add.
54. Files to modify.
55. Files explicitly unchanged.
56. Intentional deferrals.
57. Recommended next milestone.
58. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

DO NOT MODIFY CODE.