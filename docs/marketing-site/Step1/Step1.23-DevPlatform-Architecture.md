Below is the cleaned-up version I’d keep in the repo as:

`docs/marketing-site/Step1.23-DevPlatform-Architecture.md`

````markdown
# BakerRang DEV Platform Architecture

**Status:** Implemented and verified  
**Environment:** DEV  
**Google Cloud Project:** `bakerrang-dev`  
**Primary Region:** `us-west1`  
**Implemented during:** Step 1.23 / Step 1.23a

---

## 1. Purpose

This document records the deployed DEV architecture for the BakerRang multi-tenant marketing-site platform.

It is intended as a future reference for understanding:

- how the DEV environment is hosted
- how requests are routed
- how the API, Portal, and public renderer interact
- how HTTPS and DNS are configured
- how tenant custom domains fit into the architecture
- which application settings are build-time versus runtime
- which major deployment decisions were made and why

This document describes the architecture as deployed and verified. It is not intended to be a full operational runbook.

---

## 2. Architecture Overview

The DEV platform consists of three independently deployed Cloud Run services behind one shared global HTTPS load balancer.

```text
                           Internet
                              |
                              v
                 Global External HTTPS Load Balancer
                         8.232.231.135
                              |
                       Host-based URL Map
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
       API Backend       Portal Backend    Renderer Backend
             |                |                |
             v                v                v
        Serverless NEG    Serverless NEG   Serverless NEG
             |                |                |
             v                v                v
      bakerrang-api-dev  bakerrang-portal-dev
                                      bakerrang-site-renderer-dev
````

Stable DEV URLs:

```text
https://api-dev.bakerrang.com
https://portal-dev.bakerrang.com
https://sites-dev.bakerrang.com
```

The renderer backend is also the load balancer's **default backend**, which is important for tenant custom-domain support.

---

## 3. Cloud Run Services

### API

Cloud Run service:

```text
bakerrang-api-dev
```

Public URL:

```text
https://api-dev.bakerrang.com
```

Responsibilities include:

* Google authentication
* tenant and business management
* working and published site definitions
* lead capture
* lead management
* media management
* custom-domain registration and verification
* public site APIs used by the renderer

The API is the only platform component that directly accesses Firestore and Google Cloud Storage.

---

### Portal

Cloud Run service:

```text
bakerrang-portal-dev
```

Public URL:

```text
https://portal-dev.bakerrang.com
```

The Portal is the authenticated administration application used to manage:

* businesses
* website content
* publishing
* leads
* media
* branding
* business profile information
* custom domains

The Portal does not access Firestore directly.

It communicates with:

```text
https://api-dev.bakerrang.com
```

---

### Site Renderer

Cloud Run service:

```text
bakerrang-site-renderer-dev
```

Shared public URL:

```text
https://sites-dev.bakerrang.com
```

The renderer is responsible for displaying published tenant websites.

Shared tenant URLs use:

```text
https://sites-dev.bakerrang.com/site/{tenantId}
```

The renderer also handles custom-domain requests by examining the incoming hostname and resolving it through the custom-domain registry.

The renderer does not access Firestore directly.

Published site data is retrieved through the API.

---

## 4. Environment Isolation

DEV application data is stored in:

```text
Google Cloud Project: bakerrang-dev
Firestore Database:   (default)
```

The API explicitly sets:

```text
FIRESTORE_PROJECT_ID=bakerrang-dev
```

This setting is intentionally explicit even though the Cloud Run service runs with:

```text
NODE_ENV=production
```

The server contains a legacy production Firestore fallback. Explicitly setting `FIRESTORE_PROJECT_ID` prevents the DEV deployment from accidentally discovering or connecting to the production project.

DEV and production must also use separate media buckets.

---

## 5. Cloud Run Runtime Identity

### API Service Account

The API uses a dedicated DEV service account.

It requires access to:

* DEV Firestore
* the DEV media bucket
* API secrets stored in Secret Manager

It should not be granted access to production Firestore or production storage resources.

---

### Frontend Service Account

The Portal and Renderer share a minimal frontend service account.

They do not require direct access to:

* Firestore
* Google Cloud Storage application data
* tenant records

All application-data access is performed through the API.

---

## 6. Artifact Registry and Container Deployment

The Portal and Renderer are built as Docker images and stored in Artifact Registry.

The Docker build context for both frontend applications is:

```text
platform/
```

Both Next.js applications use standalone output.

The deployed frontend containers run on:

```text
PORT=8080
HOSTNAME=0.0.0.0
```

The API is also deployed as a containerized Node/Express application.

---

## 7. Load Balancer

The DEV platform uses one:

```text
Global External Application Load Balancer
```

Global static IPv4 address:

```text
8.232.231.135
```

The same load balancer fronts:

```text
api-dev.bakerrang.com
portal-dev.bakerrang.com
sites-dev.bakerrang.com
```

and later tenant custom domains.

Using one shared load balancer avoids creating separate load-balancer infrastructure for each tenant.

---

## 8. Serverless NEGs

Each Cloud Run service has one serverless Network Endpoint Group.

Conceptually:

```text
API NEG
  -> bakerrang-api-dev

Portal NEG
  -> bakerrang-portal-dev

Renderer NEG
  -> bakerrang-site-renderer-dev
```

The NEGs provide the connection between the global load balancer and the corresponding Cloud Run services.

They do not represent additional application servers.

---

## 9. Backend Services

The load balancer has three backend services:

```text
API Backend
Portal Backend
Renderer Backend
```

Each backend service points to the corresponding serverless NEG.

Conceptually:

```text
API Backend
  -> API NEG
      -> bakerrang-api-dev

Portal Backend
  -> Portal NEG
      -> bakerrang-portal-dev

Renderer Backend
  -> Renderer NEG
      -> bakerrang-site-renderer-dev
```

The backend services are load-balancer routing objects. They are not independent compute services.

---

## 10. Host Routing

The load balancer URL map routes known BakerRang infrastructure domains as follows:

```text
api-dev.bakerrang.com
  -> API Backend

portal-dev.bakerrang.com
  -> Portal Backend

sites-dev.bakerrang.com
  -> Renderer Backend
```

The URL map's default backend is:

```text
Renderer Backend
```

This is intentional.

An unknown hostname therefore follows:

```text
Unknown Host
    |
    v
Global Load Balancer
    |
    v
No explicit host rule
    |
    v
Renderer Backend
    |
    v
Site Renderer
    |
    v
Custom-domain registry lookup
```

This allows arbitrary tenant custom domains to use the same renderer without adding a new load-balancer host rule for every customer.

---

## 11. DNS

The following DEV A records point to the global load-balancer IP:

```text
api-dev.bakerrang.com      -> 8.232.231.135
portal-dev.bakerrang.com   -> 8.232.231.135
sites-dev.bakerrang.com    -> 8.232.231.135
```

These records are separate from the existing apex:

```text
bakerrang.com
```

The DEV infrastructure does not require changing the existing `bakerrang.com` website or its routing.

---

## 12. HTTPS and Certificate Manager

Google Certificate Manager is used for DEV HTTPS.

A Google-managed certificate covers:

```text
bakerrang.com
*.bakerrang.com
```

Ownership was authorized through a DNS CNAME under:

```text
_acme-challenge.bakerrang.com
```

The certificate is associated with a Certificate Manager certificate map.

The certificate map is attached to the load balancer's HTTPS target proxy.

The request flow is therefore:

```text
Browser
   |
   | HTTPS
   v
Global Forwarding Rule :443
   |
   v
Target HTTPS Proxy
   |
   +--> Certificate Map
   |      |
   |      +--> Google-managed TLS certificate
   |
   v
URL Map
   |
   v
Selected Backend
```

The certificate allows browsers to verify that they are communicating with an authorized BakerRang hostname and encrypts traffic between the browser and the load balancer.

---

## 13. Custom-Domain Architecture

Tenant custom domains are stored outside published site definitions.

The domain registry is authoritative for hostname ownership and activation.

The basic request flow is:

```text
https://customer-domain.example
              |
              v
      Global Load Balancer
              |
              v
       Default Renderer
              |
              v
     Incoming Host header
              |
              v
       siteDomains registry
              |
              v
       ACTIVE tenant domain
              |
              v
       Published tenant site
```

The load balancer does not need a dedicated host rule for every tenant.

The application is responsible for deciding whether an incoming custom hostname is:

* registered
* verified
* active
* associated with a valid tenant

Unknown or inactive custom domains fail closed.

---

## 14. Custom-Domain DNS Configuration

The Portal is built with:

```text
CUSTOM_DOMAIN_IPV4_ADDRESS=8.232.231.135
```

This allows the domain-management UI to tell customers which IP address should be used for an A record.

Example:

```text
customer.example
    A
    8.232.231.135
```

An optional configuration also exists:

```text
CUSTOM_DOMAIN_CNAME_TARGET
```

No dedicated CNAME target is currently configured.

The platform currently relies on the load-balancer IPv4 address as the primary custom-domain DNS target.

A future dedicated target such as:

```text
domains.bakerrang.com
```

could be introduced if CNAME-based onboarding is desired.

---

## 15. Domain Ownership Verification

Custom-domain ownership is verified separately from HTTPS certificate ownership.

Tenant verification uses TXT records under a domain-specific name such as:

```text
_bakerrang-verification.{hostname}
```

The lifecycle is:

```text
PENDING_VERIFICATION
        |
        v
     VERIFIED
        |
        v
      ACTIVE
```

An ACTIVE domain may later become:

```text
DISABLED
```

Reactivation requires a fresh ownership-verification token.

Domain verification is application-level proof that the tenant controls the domain.

Certificate Manager's `_acme-challenge` record is infrastructure-level proof that BakerRang controls `bakerrang.com`.

These are separate mechanisms.

---

## 16. API Configuration

Important DEV API environment values include:

```text
NODE_ENV=production

FIRESTORE_PROJECT_ID=bakerrang-dev

ALLOW_DRAFT_PUBLIC_SITES=false

SERVER_DOMAIN=https://api-dev.bakerrang.com

PORTAL_DOMAIN=https://portal-dev.bakerrang.com

SITE_RENDERER_DOMAIN=https://sites-dev.bakerrang.com

MEDIA_BUCKET_NAME=<DEV media bucket>
```

Sensitive values are stored in Secret Manager rather than committed to the repository.

Examples include:

```text
GOOGLE_OAUTH_CLIENT_SECRET
SESSION_SECRET
CSRF_SECRET
CHAT_GPT_API_KEY
ELEVEN_LABS_API_KEY
DEEPGRAM_API_KEY
BLIZZARD_CLIENT_SECRET
```

---

## 17. Portal Build Configuration

Important Portal build-time values include:

```text
NEXT_PUBLIC_API_BASE_URL=https://api-dev.bakerrang.com

CUSTOM_DOMAIN_IPV4_ADDRESS=8.232.231.135
```

Optional:

```text
CUSTOM_DOMAIN_CNAME_TARGET
```

These values are compiled into the Next.js Portal image and therefore require a rebuild when changed.

---

## 18. Renderer Configuration

### Build-time

The renderer is built with:

```text
NEXT_PUBLIC_SITE_API_BASE_URL=https://api-dev.bakerrang.com
```

### Runtime

The deployed renderer uses:

```text
SITE_API_BASE_URL=https://api-dev.bakerrang.com

SITE_PUBLIC_ORIGIN=https://sites-dev.bakerrang.com

SITE_PUBLIC_INDEXING_ENABLED=false
```

`SITE_PUBLIC_ORIGIN` is especially important because it distinguishes the shared BakerRang renderer hostname from tenant custom-domain traffic.

---

## 19. Published Versus Draft Content

Published tenant content and working content remain isolated.

The public renderer consumes the published-site API.

Custom domains always render published content.

DEV shared-path preview behavior remains separate and does not authorize custom domains to view unpublished working content.

The deployed DEV environment runs:

```text
ALLOW_DRAFT_PUBLIC_SITES=false
```

and:

```text
NODE_ENV=production
```

so deployed public traffic behaves with production-style publication restrictions.

---

## 20. Lead Submission

Public lead forms follow:

```text
Browser
   |
   v
Site Renderer
   |
   v
POST /public/sites/{tenantId}/leads
   |
   v
API
   |
   v
DEV Firestore
```

For the shared renderer, the API permits the configured:

```text
SITE_RENDERER_DOMAIN
```

For custom-domain traffic, CORS authorization is intentionally narrow.

A custom-domain origin is permitted only for the public lead endpoint when:

* the hostname is an ACTIVE registered custom domain
* the registered domain resolves to the same tenant in the request
* the request origin matches the authoritative custom-domain registry

Custom-domain CORS is not enabled globally across the API.

---

## 21. Google OAuth

The deployed DEV authentication flow is:

```text
portal-dev.bakerrang.com
        |
        v
api-dev.bakerrang.com/auth/google
        |
        v
Google OAuth
        |
        v
api-dev.bakerrang.com/auth/google/callback
        |
        v
portal-dev.bakerrang.com
```

The Google OAuth application's authorized redirect URI includes:

```text
https://api-dev.bakerrang.com/auth/google/callback
```

Local development OAuth callbacks may remain configured separately.

Using BakerRang subdomains for both the Portal and API also preserves the intended browser/session-cookie architecture.

---

## 22. Current DEV Verification

The deployed architecture has been manually verified.

### API

Verified:

```text
Cloud Run deployment                 PASS
/health                              PASS
Firestore project = bakerrang-dev    PASS
```

### Load Balancer

Verified using direct load-balancer hostname tests before DNS cutover:

```text
api-dev.bakerrang.com       PASS
portal-dev.bakerrang.com    PASS
sites-dev.bakerrang.com     PASS
```

### DNS / HTTPS

Verified:

```text
https://api-dev.bakerrang.com       200
https://portal-dev.bakerrang.com    200
https://sites-dev.bakerrang.com     200
```

Certificate state:

```text
Certificate           ACTIVE
Certificate map entry ACTIVE
HTTPS proxy           ACTIVE
Forwarding rule       ACTIVE
```

### Portal

Verified:

```text
Portal loads                  PASS
Google OAuth login            PASS
DEV businesses visible        PASS
```

### Renderer

Verified:

```text
Published tenant site         PASS
Shared sites-dev hostname     PASS
```

Test tenant:

```text
94fddc9a-77e7-4739-a6ef-86ed0317777d
```

Shared renderer URL:

```text
https://sites-dev.bakerrang.com/site/94fddc9a-77e7-4739-a6ef-86ed0317777d
```

### Lead Capture

Verified:

```text
Lead submission through sites-dev     PASS
Lead persisted in bakerrang-dev        PASS
Lead visible through Portal            PASS
```

---

## 23. DEV Infrastructure Cost Considerations

The primary fixed networking cost introduced by this architecture is the global external HTTPS load balancer.

At the time this environment was created, the expected fixed DEV networking cost was approximately:

```text
~$18–20/month
```

before meaningful traffic usage.

The architecture deliberately shares one load balancer between:

* API
* Portal
* shared renderer
* future tenant custom domains

Backend services and serverless NEGs are routing resources rather than additional always-on servers.

Cloud Run remains usage-based and can scale down when idle.

---

## 24. Important Architectural Decisions

The following decisions should be preserved unless the architecture is deliberately redesigned.

### Public renderer never accesses Firestore directly

```text
Renderer
   -> API
       -> Firestore
```

This maintains a clear public-data security boundary.

### One shared renderer serves all tenants

A new tenant does not receive a new Cloud Run service.

### One shared load balancer serves the platform

A new tenant should not require a new load balancer.

### Customer domains use the renderer default backend

Do not create a new URL-map host rule for each tenant unless the architecture intentionally changes.

### Domain state is not part of published site content

Custom-domain lifecycle and ownership are infrastructure/application state, not CMS content.

### DEV explicitly identifies its Firestore project

Do not depend on Application Default Credentials to infer the Firestore project.

Always preserve:

```text
FIRESTORE_PROJECT_ID=bakerrang-dev
```

for the DEV API.

### Production-like security behavior is used in deployed DEV

Cloud Run DEV uses:

```text
NODE_ENV=production
```

while environment-specific resources are selected explicitly.

---

## 25. Current Boundary

This document records the DEV deployment foundation through the completion of stable BakerRang DEV domains.

The next major Step 1.23 verification is the full real custom-domain path, including:

```text
custom-dev.bakerrang.com
        |
        v
8.232.231.135
        |
        v
Global HTTPS Load Balancer
        |
        v
Default Renderer Backend
        |
        v
Custom-domain registry
        |
        v
Tenant published site
```

That verification includes real custom-domain HTTPS, DNS ownership, routing, canonical URLs, redirects, lead submission, and lifecycle behavior.

Production deployment remains separate from this DEV architecture.

---

## 26. Summary

The BakerRang DEV platform now uses:

```text
Google Cloud Run
        +
Artifact Registry
        +
Firestore
        +
Google Cloud Storage
        +
Secret Manager
        +
Global External HTTPS Load Balancer
        +
Serverless NEGs
        +
Certificate Manager
        +
Cloud DNS
```

to provide a reusable multi-tenant hosting platform.

The deployed request path is:

```text
User
  |
  v
DNS
  |
  v
Global HTTPS Load Balancer
  |
  v
Hostname Routing
  |
  +--> API
  |
  +--> Portal
  |
  +--> Renderer
           |
           v
       BakerRang API
           |
           v
       Firestore / GCS
```

The renderer's default-backend design provides the infrastructure foundation for arbitrary tenant custom domains without requiring per-tenant Cloud Run services or per-tenant load-balancer routing configuration.

```

This version is intentionally architectural rather than a transcript of the commands we ran. That should make it much more useful six months from now when the question is **“why is this configured this way?”** rather than **“what command did we type?”**

I’d still keep your existing `Step1.23-CloudRun-Deployment.md` alongside it as the more deployment/runbook-oriented document. 
```

### Real Custom-Domain Verification

A real deployed custom-domain lifecycle was verified using:

`https://custom-dev.bakerrang.com`

Verified:

- DNS TXT ownership verification
- routing A record to `8.232.231.135`
- HTTPS through the shared global load balancer
- routing through the renderer default backend
- ACTIVE-domain tenant resolution
- published Home and Contact rendering
- canonical metadata uses the custom hostname
- Contact remains `noindex`
- shared published tenant URL returns `308` to the active custom domain
- lead submission succeeds from the custom-domain origin
- lead is stored under the correct tenant
- disabling the domain stops custom-domain routing
- disabled domains no longer cause shared-site redirects
- reactivation requires a fresh DNS verification token
- reactivated domain successfully resumes serving the published site

`custom-dev.bakerrang.com` is intentionally retained as the permanent DEV custom-domain test hostname.