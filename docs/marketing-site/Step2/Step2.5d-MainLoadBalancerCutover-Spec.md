# Step 2.5d Planning — MAIN Load Balancer + DNS/TLS Cutover

Planning/read-only only.

Do NOT modify GCP.
Do NOT change DNS.
Do NOT create certificates.
Do NOT deploy code.
Do NOT modify Cloud Run services.
Do NOT modify GitHub.

2.5a, 2.5b, and 2.5c are COMPLETE.

Current live project:

avian-cable-379805
project number: 307696703523
region: us-west1

Reserved MAIN global IPv4:

34.8.236.85
resource name:
bakerrang-web-ip

Current live services:

bakerrang-api
bakerrang-client
bakerrang-portal
bakerrang-site-renderer

Current runtime identities:

API:
bakerrang-api@avian-cable-379805.iam.gserviceaccount.com

Client/Portal/Renderer target:
bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com

Portal and Renderer are already deployed successfully via the manual MAIN workflow.

API has been cut over successfully to the current platform image:

bakerrang-api-00028-q9c

MAIN Firestore bootstrap is complete:

platformRole = PLATFORM_ADMIN

GET /tenants returns 200.

---

# 1. Discover current ingress state

Read-only inspect:

- Cloud Run domain mappings
- DNS records
- Certificate Manager
- Compute forwarding rules
- target HTTPS proxies
- URL maps
- backend services
- serverless NEGs
- reserved addresses
- current apex/api DNS

Confirm current mappings for:

bakerrang.com
api.bakerrang.com

and whether:

portal.bakerrang.com
sites.bakerrang.com
www.bakerrang.com

exist today.

Return exact current state.

---

# 2. Target MAIN LB architecture

Design ONE global external Application Load Balancer using:

34.8.236.85

Target host routing:

bakerrang.com
www.bakerrang.com if used
-> bakerrang-client

api.bakerrang.com
-> bakerrang-api

portal.bakerrang.com
-> bakerrang-portal

sites.bakerrang.com
-> bakerrang-site-renderer

customer custom domains
-> bakerrang-site-renderer

Default backend should support the existing custom-domain model.

Preserve the Host header so Renderer/API domain resolution works.

---

# 3. Serverless NEGs

Determine exact NEGs required.

Likely:

bakerrang-api-neg
bakerrang-client-neg
bakerrang-portal-neg
bakerrang-renderer-neg

all in us-west1.

Confirm exact `gcloud compute network-endpoint-groups create` syntax for Cloud Run serverless NEGs.

---

# 4. Backend services

Determine exact backend services required.

Likely:

bakerrang-api-backend
bakerrang-client-backend
bakerrang-portal-backend
bakerrang-renderer-backend

Global external managed.

No CDN unless there is a deliberate reason.

Do not introduce unnecessary complexity.

---

# 5. URL map

Design exact host rules/path matchers.

Expected:

bakerrang.com
www.bakerrang.com
-> client

api.bakerrang.com
-> api

portal.bakerrang.com
-> portal

sites.bakerrang.com
-> renderer

unknown/custom host
-> renderer

No path rewrite for:

/
/contact
or other renderer routes.

DNS cannot encode paths; Renderer must receive the original path + Host.

---

# 6. Custom-domain behavior

Audit the current custom-domain design against this LB.

Confirm that:

customer.example.com
-> 34.8.236.85
-> default renderer backend
-> Host preserved
-> API resolves siteDomains/{hostname}

works.

Identify exactly how certificate provisioning for arbitrary customer domains is currently intended to work.

Inspect source/docs/config rather than assuming.

Determine whether Certificate Manager certificate maps / DNS authorization / managed certs are already part of the implementation.

This is important.

Do NOT hand-wave "on-demand certs" unless the current GCP design actually supports them.

Return a concrete custom-domain TLS plan.

---

# 7. Certificates for BakerRang-owned domains

Determine the exact certificate approach for:

bakerrang.com
api.bakerrang.com
portal.bakerrang.com
sites.bakerrang.com
www.bakerrang.com if used

Prefer Certificate Manager managed certificates.

Determine whether one SAN certificate or multiple certificates is simpler/better.

Inspect existing `_acme-challenge` DNS records and current Certificate Manager resources.

Do not destroy existing domain-mapping cert infrastructure until cutover succeeds.

---

# 8. HTTPS proxy / forwarding rule

Design exact resources using:

bakerrang-web-ip
34.8.236.85

Determine:

- certificate map if required
- target HTTPS proxy
- global forwarding rule on 443

Evaluate whether an HTTP 80 forwarding rule is worth creating only for redirect-to-HTTPS.

Given cost sensitivity, explicitly state whether adding a second forwarding rule has meaningful recurring cost.

If HTTPS-only is sufficient, prefer it unless there is a strong UX/SEO reason for HTTP redirect support.

---

# 9. DNS cutover sequence

Current known live domains:

bakerrang.com
api.bakerrang.com

Portal/Renderer are new.

Design the safest sequence.

Prefer:

1. portal.bakerrang.com
2. sites.bakerrang.com
3. one controlled custom-domain/test hostname
4. api.bakerrang.com
5. bakerrang.com last

Determine exact current record types and the replacement records.

Likely target:

A -> 34.8.236.85

Do not mutate during planning.

---

# 10. Existing Cloud Run domain mappings

Current:

bakerrang.com -> bakerrang-client
api.bakerrang.com -> bakerrang-api

Determine when to remove those mappings.

They should remain available as rollback until LB cutover is proven.

Explain whether leaving them temporarily while DNS points at the LB causes any conflict.

Do not remove them during planning.

---

# 11. Client runtime SA

Current Client still runs as:

307696703523-compute@developer.gserviceaccount.com

Target:

bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com

Determine the safest point in 2.5d to perform this one-time runtime-SA change.

This is LIVE impact.

Do not mix it with image deployment.

Decide whether it should happen:

- before LB cutover
- after LB cutover
- after full consolidation

Prefer minimal risk.

Remember the current live deployer cannot image-update Client until this SA migration is complete because it lacks actAs on the default Compute SA.

---

# 12. Client deployment

Determine whether the existing Client must actually be redeployed during 2.5d.

The Step 2.5b source change introduced:

VITE_API_BASE_URL

but the live fallback still points to:

https://api.bakerrang.com

So there may be no functional need to deploy Client immediately.

Recommend whether to:

A. leave current Client image untouched during ingress cutover

or

B. deliberately move Client into the new AR/CI pipeline before apex cutover

Prefer lower risk.

---

# 13. Portal functional verification

Once portal.bakerrang.com works through the LB:

Verify:

- GET /
- OAuth login via api.bakerrang.com
- redirect back to portal.bakerrang.com
- /tenants returns data
- business creation
- CSRF
- credentials/include session behavior

Do not assume run.app testing proves browser auth.

---

# 14. Renderer functional verification

Once sites.bakerrang.com works:

Verify:

- /robots.txt
- published tenant route
- /contact
- SEO/canonical behavior
- public site API
- media loading from bakerrang-media-marketing

Create a test/first live tenant through Portal if needed.

---

# 15. Custom-domain verification

Use a controlled test hostname before relying on a real customer domain.

Determine the safest available hostname.

It may be:

custom.bakerrang.com

or another BakerRang-owned hostname.

Prefer something we control.

Verify:

- DNS -> 34.8.236.85
- TLS valid
- Host reaches Renderer
- siteDomains lookup resolves correct tenant
- /
- /contact
- canonical behavior

---

# 16. API DNS cutover

api.bakerrang.com is already live and working through Cloud Run domain mapping.

Before changing its DNS:

- LB backend must be healthy
- certificate valid
- test direct LB behavior if possible
- rollback record value captured
- TTL reduced if useful

After changing:

- /health
- login
- auth/check
- legacy feature
- Portal API request
- lead/public endpoints

Return exact rollback.

---

# 17. Apex cutover

bakerrang.com is last.

Before changing it:

- Client backend proven behind LB
- certificate valid
- api already proven through LB
- existing domain mapping still intact

After changing:

- /
- SPA assets
- login
- legacy Client API calls
- browser refresh/deep SPA route if applicable

Return exact rollback.

---

# 18. Public smoke vs deployment smoke

Keep these separate.

Deployment smoke:
*.run.app

Ingress smoke:
real public hostname

Do not modify the deployment workflow yet solely to make it smoke public DNS.

Later, after cutover, evaluate whether live deploys should additionally perform public-host smoke.

Return recommendation.

---

# 19. Automatic live deployment activation

Current transitional state:

DEV:
push main -> automatic DEV deploy

MAIN:
manual workflow_dispatch only

After LB/DNS/API/Portal/Renderer are fully verified:

we want:

main
-> automatic MAIN live deploy

and DEV auto-deploy disabled/removed.

Determine the safest repository change.

There must never be an intentional steady-state where both auto-deploy from main.

Client actAs/runtime-SA situation must be resolved before automatic Client deployment can be considered fully functional.

---

# 20. DEV decommission boundary

2.5d does NOT delete DEV infrastructure yet.

Only after all public MAIN ingress is proven do we enter 2.5e.

DEV remains rollback/reference during cutover.

---

# 21. Cost-sensitive design

The user is a single operator and specifically wants to minimize recurring infrastructure cost.

Explicitly identify:

- number of forwarding rules
- number of reserved IPs
- whether HTTP redirect adds another forwarding-rule charge
- Certificate Manager recurring cost if relevant
- NEG/backend service cost implications if any

Prefer the simplest architecture that still supports:

HTTPS
custom customer domains
Host routing
Cloud Run

---

# 22. Documentation

Identify exact updates needed to:

docs/infra/live-environment-bootstrap.md
docs/CI-CD.md

after actual commands are executed.

The user wants actual gcloud commands and GitHub setup retained for future humans and AI agents.

---

# 23. Exact implementation split

Decide whether 2.5d should be broken into:

2.5d-1 LB foundation
2.5d-2 BakerRang DNS/TLS cutover
2.5d-3 Client SA + automatic live deployment activation

or another structure.

Prefer independently verifiable steps.

---

# 24. Output

Return only:

1. current ingress/DNS/cert state
2. exact target LB architecture
3. exact GCP resources required
4. exact gcloud creation commands
5. custom-domain TLS plan
6. BakerRang certificate plan
7. HTTP-vs-HTTPS forwarding-rule recommendation
8. exact DNS cutover sequence
9. Cloud Run domain-mapping retirement sequence
10. Client SA migration recommendation
11. Client deployment recommendation
12. Portal verification plan
13. Renderer verification plan
14. custom-domain verification plan
15. API cutover procedure + rollback
16. apex cutover procedure + rollback
17. automatic MAIN deployment activation plan
18. cost implications
19. documentation updates
20. recommended 2.5d substeps
21. blockers before execution
22. safest first human action

No implementation.
No mutation.
No deployment.