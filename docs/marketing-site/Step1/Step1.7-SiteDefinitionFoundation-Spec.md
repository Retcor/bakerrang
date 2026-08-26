# Step 1.7 — Site Definition Foundation

## Objective

Introduce the canonical persisted website model for a Tenant.

A PLATFORM_ADMIN must be able to initialize a minimal website for an existing Business.

This milestone establishes:

* Site persistence
* Home page persistence
* Section persistence
* Shared TypeScript site schema
* Site initialization/read API

It does NOT connect the public site renderer yet.

---

# 1. Firestore Structure

Use:

```text
tenants/{tenantId}/site/config
```

and:

```text
tenants/{tenantId}/site/pages/{pageId}
```

Initial page ID:

```text
home
```

Do not create top-level global site/page collections.

Site data belongs structurally to the tenant.

---

# 2. Site Config

Document:

```text
tenants/{tenantId}/site/config
```

Initial fields:

```text
status
createdAt
updatedAt
createdByUserId
```

Initial status:

```text
DRAFT
```

Do not add:

* domain
* theme
* branding
* analytics
* SEO configuration
* social links

yet.

---

# 3. Home Page

Document:

```text
tenants/{tenantId}/site/pages/home
```

Initial fields:

```text
slug: "/"
title: "Home"
sections
createdAt
updatedAt
```

Sections are stored inline as an ordered array.

Do not create a sections subcollection.

---

# 4. Initial Section

Initialize exactly one section:

```json
{
  "id": "hero",
  "type": "hero",
  "content": {
    "title": "<tenant name>"
  }
}
```

Do not generate marketing copy.

Do not populate subtitle or CTA unless there is actual persisted content to use.

---

# 5. Shared Site Schema

Expand:

```text
@bakerrang/site-schema
```

from the existing minimal HeroContent type.

Add only the types necessary to describe the initial persisted site.

Conceptually:

```text
HeroContent
HeroSection
SiteSection
SitePage
SiteStatus
SiteDefinition
```

Use the existing lowercase:

```text
type: "hero"
```

convention unless the implemented code already establishes another canonical convention.

SiteStatus should support:

```text
DRAFT
PUBLISHED
```

Only DRAFT is created in this milestone.

Do not design every future section type.

Do not add runtime schema libraries merely for this milestone.

---

# 6. Backend Site Service

Add a site service following the existing:

```text
route
  ↓
service
  ↓
Firestore
```

architecture.

Initial operations:

```text
initializeSite(tenantId, actorUserId)

getSite(tenantId)
```

---

# 7. Site Initialization

Initialization must:

1. Verify the Tenant exists.
2. Verify a site does not already exist.
3. Load the Tenant name.
4. Create:

```text
site/config
```

5. Create:

```text
site/pages/home
```

6. Use the Tenant name for the Hero title.
7. Return an aggregate SiteDefinition-style response.

The config and home page must be created atomically.

Prefer a Firestore transaction/batch with appropriate duplicate protection.

Two concurrent initialization requests must not both report successful creation.

Existing site:

```text
409
```

Missing Tenant:

```text
404
```

---

# 8. Site Read

GET should return an aggregate site representation rather than exposing raw Firestore paths.

Conceptually:

```json
{
  "status": "DRAFT",
  "pages": [
    {
      "id": "home",
      "slug": "/",
      "title": "Home",
      "sections": [...]
    }
  ]
}
```

Administrative metadata may be included if needed by the portal API, but do not expose unnecessary Firestore implementation details.

No public unauthenticated site endpoint in Step 1.7.

---

# 9. Routes

Add authenticated Tenant-scoped routes conceptually:

```text
POST /tenants/:tenantId/site
GET  /tenants/:tenantId/site
```

Initial authorization:

POST:

```text
PLATFORM_ADMIN
```

GET:

```text
PLATFORM_ADMIN
OWNER
ADMIN
STAFF
```

Platform administrators continue to bypass membership through the existing tenant authorization middleware.

Do not add PUT/PATCH/DELETE yet.

---

# 10. Portal

Add only enough portal functionality to initialize and inspect a site's existence.

Avoid building a CMS.

A small action from the Business UI is sufficient, such as:

```text
[ Initialize Website ]
```

After initialization, the UI may show:

```text
Website: Draft
```

Do not add:

* page editing
* section editing
* drag/drop
* preview iframe
* theme controls
* publishing

yet.

Keep business-specific site-management code in the portal app, not `@bakerrang/ui`.

---

# 11. Shared API Client

Reuse the Step 1.6 portal API abstraction.

POST site initialization must use the existing CSRF handling.

Do not create another request layer.

---

# 12. Renderer Boundary

Do NOT connect `site-renderer` to Firestore.

Do NOT give the site-renderer direct Firestore data access.

Future architecture is:

```text
site-renderer
      ↓
sanitized site API
      ↓
Express
      ↓
Firestore
```

That public/sanitized API will be implemented in Step 1.8.

No site-renderer changes are required in Step 1.7 except shared-schema compilation compatibility if necessary.

---

# 13. Testing

Backend automated tests must verify at minimum:

* nonexistent tenant cannot initialize a site
* PLATFORM_ADMIN can initialize
* normal unauthorized user cannot initialize
* config document is created
* home page is created
* initial status is DRAFT
* home slug is "/"
* one hero section exists
* hero title equals Tenant name
* initialization does not invent subtitle/CTA
* duplicate initialization returns 409
* concurrent-safe initialization behavior
* getSite returns the aggregate definition
* missing site returns 404
* authorized tenant roles can read
* STAFF cannot initialize
* existing tenant functionality remains passing

Use existing `node:test` infrastructure.

No live Firestore required for unit tests if the existing fake DB can reasonably be extended.

---

# 14. Shared Schema Verification

TypeScript must prove:

* Hero component remains compatible with HeroContent
* SiteDefinition can represent the persisted initial site
* site-components continues building
* site-renderer continues building

Do not add a separate testing framework.

---

# 15. Manual DEV Verification

Use only:

```text
FIRESTORE_PROJECT_ID=bakerrang-dev
```

Flow:

1. Login to portal.
2. Existing Business appears.
3. Initialize its Website.
4. Confirm success.
5. Confirm portal shows Draft website state.
6. In DEV Firestore verify:

```text
tenants/{tenantId}/site/config
```

7. Verify:

```text
status: DRAFT
```

8. Verify:

```text
tenants/{tenantId}/site/pages/home
```

9. Verify:

```text
slug: "/"
title: "Home"
```

10. Verify sections contain one Hero using the Business name.
11. Attempt initialization again.
12. Confirm it does not create duplicates and returns/displays the already-initialized conflict appropriately.
13. Confirm production remains untouched.

---

# 16. Explicitly Out of Scope

Do not implement:

* Public site API
* Dynamic site renderer
* Domain resolution
* Preview URL
* Custom domains
* Site publishing UI
* Page editor
* Section editor
* Section reordering
* Multiple pages
* Themes
* Branding
* Services section
* Gallery
* Testimonials
* Quote form
* SEO
* Media
* Leads
* Analytics
* Google integrations
* Instagram
* AI content generation

---

# Definition of Done

Step 1.7 is complete when:

1. A Business can have an initialized Site.
2. Site data is persisted beneath the Tenant.
3. Site initialization is atomic/idempotent-safe.
4. A Home page exists with one Hero section.
5. Hero content derives only from known Tenant data.
6. Site API returns an aggregate SiteDefinition.
7. Shared site-schema represents that definition.
8. Portal can initialize the Site.
9. No renderer has direct Firestore access.
10. Backend tests pass.
11. Platform typecheck/lint/build pass.
12. Manual DEV Firestore verification succeeds.
