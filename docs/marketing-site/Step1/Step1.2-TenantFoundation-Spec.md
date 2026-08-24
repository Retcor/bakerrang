# Step 1.2 — Tenant Foundation Implementation Specification

## Objective

Establish the minimum backend foundation required for multi-tenancy and tenant authorization.

At the end of this step, the existing BakerRang Express API must understand:

* What a tenant is.
* What a tenant member is.
* What a platform administrator is.
* Whether the current authenticated user may access a tenant.
* Whether the current authenticated user may perform platform-admin operations.

Nothing related to websites, CMS, leads, media, domains, analytics, or marketing should be implemented yet.

---

# 1. Existing Architecture Must Remain Intact

Do not migrate or change the ownership model of existing BakerRang applications.

Existing functionality remains user-scoped:

```text
users/{userId}

vaults/{userId}
budget/{userId}
licenses/{userId}
...
```

Tenant functionality is additive.

---

# 2. Global User Model

Continue using the existing:

```text
users/{userId}
```

collection.

Add support for the optional field:

```text
platformRole: "PLATFORM_ADMIN"
```

Absence of `platformRole` means the user has no platform-level privileges.

Do not create a second platform-user collection.

## Security Requirement

The Google-login user synchronization process must preserve privileged/internal fields such as:

```text
platformRole
```

Google profile synchronization may update fields such as:

```text
displayName
email
emailLower
photo
```

but it must never remove or modify `platformRole`.

Platform role must never come from:

* Google profile data
* Session data
* Client request body
* Query parameters

For V1, there is no API for granting `PLATFORM_ADMIN`.

The initial platform administrator will be bootstrapped manually in Firestore.

---

# 3. Tenant Model

Create:

```text
tenants/{tenantId}
```

Use a generated UUID for `tenantId`.

Initial document shape:

```text
name
status
createdAt
updatedAt
createdByUserId
```

Initial supported status:

```text
ACTIVE
```

Do not introduce slug/domain/site configuration yet.

## Validation

`name`:

* Required.
* String.
* Trimmed.
* Reasonable length validation.

Do not accept arbitrary fields from the request and persist them directly.

---

# 4. Tenant Membership Model

Create:

```text
tenants/{tenantId}/members/{userId}
```

Document shape:

```text
userId
role
createdAt
updatedAt
createdByUserId
```

Supported roles:

```text
OWNER
ADMIN
STAFF
```

The document ID must equal `userId`.

The membership document is the authoritative source for tenant authorization.

Do not store tenant permissions in the session.

Do not store tenant permissions on `req.user`.

---

# 5. Authorization Rules

Create two reusable authorization primitives.

## requirePlatformAdmin

The middleware must:

1. Require an authenticated request.
2. Read:

```text
users/{req.user.id}
```

fresh from Firestore.
3. Verify:

```text
platformRole === "PLATFORM_ADMIN"
```

4. Return HTTP 403 when authenticated but unauthorized.

Do not trust a platform role contained in session state.

---

## requireTenantRole

Conceptual API:

```text
requireTenantRole(["OWNER", "ADMIN"])
```

The middleware must obtain the tenant ID from the route parameter:

```text
req.params.tenantId
```

Never use a tenant ID supplied in the body for authorization.

It must:

1. Require authentication.
2. Read the global user record fresh.
3. If the user is `PLATFORM_ADMIN`, authorize the request.

Otherwise:

4. Read:

```text
tenants/{tenantId}/members/{req.user.id}
```

fresh from Firestore.
5. Verify the membership exists.
6. Verify its role is included in the allowed role set.
7. Return 403 otherwise.

Platform administrators therefore have implicit administrative access to tenants without needing membership documents in every tenant.

---

# 6. Tenant Service

Add a tenant service following the existing:

```text
route
  ↓
service
  ↓
Firestore
```

convention.

Initial operations:

### createTenant

Create a new tenant.

Platform-admin only.

The creating platform admin does NOT need to automatically become an OWNER because platform admins already have global tenant access.

Return the created tenant.

---

### getTenant

Retrieve:

```text
tenants/{tenantId}
```

Return 404 if it does not exist.

---

### listTenants

For this initial phase, this operation is:

```text
PLATFORM_ADMIN only
```

It may query the top-level `tenants` collection.

Do not implement "list all tenants this business user belongs to" yet.

That operation requires us to deliberately choose between a reverse membership index and a collection-group query.

---

### addMember

Add an existing BakerRang user to a tenant.

Initial authorization:

```text
PLATFORM_ADMIN only
```

Request:

```json
{
  "userId": "...",
  "role": "OWNER"
}
```

Requirements:

* Tenant must exist.
* User must exist.
* Role must be one of OWNER/ADMIN/STAFF.
* Duplicate membership should not silently overwrite existing membership.
* Return an appropriate conflict response for an existing membership.

This restricted V1 operation deliberately avoids designing tenant-owner membership administration rules yet.

---

### listMembers

Allowed:

```text
PLATFORM_ADMIN
OWNER
ADMIN
```

Return the tenant's membership records.

Do not build elaborate joins/profile enrichment yet unless trivial.

---

# 7. API Routes

Add a tenant router consistent with existing routing conventions.

Recommended initial surface:

```text
POST /tenants
GET  /tenants
GET  /tenants/:tenantId

POST /tenants/:tenantId/members
GET  /tenants/:tenantId/members
```

Authorization:

```text
POST /tenants
    PLATFORM_ADMIN

GET /tenants
    PLATFORM_ADMIN

GET /tenants/:tenantId
    PLATFORM_ADMIN or OWNER/ADMIN/STAFF

POST /tenants/:tenantId/members
    PLATFORM_ADMIN

GET /tenants/:tenantId/members
    PLATFORM_ADMIN or OWNER/ADMIN
```

No update/delete endpoints yet.

---

# 8. HTTP Behavior

Use normal semantics:

```text
200  successful read
201  successful creation
400  invalid request
401  unauthenticated
403  authenticated but unauthorized
404  resource not found
409  membership already exists
500  unexpected server failure
```

Responses must not expose Firestore internals or stack traces.

---

# 9. Rate Limiting

Add a tenant-route limiter consistent with the existing rate-limiting architecture.

Do not invent a generalized rate-limiting framework.

Reuse existing patterns.

---

# 10. Firestore Rules/Indexes

No new composite index should be required for the initial operations.

Do not introduce collection-group membership queries yet.

Do not introduce:

```text
users/{userId}/tenantMemberships
```

yet.

We will make the reverse-membership/index decision when the portal needs "My Businesses."

---

# 11. Authentication Changes Explicitly Deferred

Do NOT implement these in Step 1.2:

```text
OAuth return-to
Portal CORS origin
SameSite cookie changes
```

They will be implemented in the portal authentication milestone.

The architectural constraints Claude identified remain accepted.

---

# 12. Frontend Explicitly Deferred

Do not create:

```text
platform/
platform/apps/portal
platform/apps/site-renderer
```

in this step.

The backend tenant foundation comes first.

---

# 13. Testing

Because authorization is now becoming security-critical, this implementation must introduce an automated test strategy sufficient to verify the new tenant authorization behavior.

At minimum verify:

```text
Unauthenticated request is rejected.

Non-platform-admin cannot create a tenant.

PLATFORM_ADMIN can create a tenant.

Normal user cannot access a tenant without membership.

STAFF can access basic tenant information.

ADMIN can access tenant information and member listing.

OWNER can access tenant information and member listing.

STAFF cannot list tenant members.

PLATFORM_ADMIN can access a tenant without membership.

Membership roles are read from Firestore rather than session state.

Invalid membership roles are rejected.

Duplicate memberships are rejected.
```

Prefer the smallest testing addition compatible with the existing Node/ESM project.

Do not introduce a large test framework unless justified.

---

# 14. Explicitly Out of Scope

Do not implement:

* CMS
* Site configuration
* Site pages
* Next.js applications
* Component library
* Themes
* Media
* Google Cloud Storage
* Leads
* CRM
* Email
* Custom domains
* Analytics
* Attribution
* Google integrations
* Instagram
* Marketing automation
* Invitations
* Membership deletion
* Membership role editing
* Tenant deletion
* Billing

---

# Definition of Done

Step 1.2 is complete when:

1. `Tenant` exists as a first-class backend concept.
2. Tenant memberships exist.
3. `PLATFORM_ADMIN` exists as a persisted global authorization concept.
4. Tenant authorization is always checked against fresh Firestore data.
5. Platform admins have implicit tenant access.
6. Existing BakerRang applications continue operating normally.
7. Existing Google login cannot erase platform authorization fields.
8. The API can create and retrieve a tenant.
9. A platform admin can add an existing user to a tenant.
10. Tenant member access can be proven through automated tests.
11. No frontend/platform/site functionality has been added.
