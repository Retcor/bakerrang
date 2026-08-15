Implement Step 1.2 — Tenant Foundation in the BakerRang repository.

Claude Code has already inspected the repository and produced an implementation
plan. Use its technical findings and implementation approach, BUT the product
architect has corrected several scope/authorization decisions below.

THESE INSTRUCTIONS OVERRIDE CLAUDE'S PLAN WHERE THEY DIFFER.

Do not expand scope.

============================================================
GOAL
============================================================

Add the minimum backend foundation for:

- Tenants
- Tenant memberships
- PLATFORM_ADMIN
- Fresh Firestore-based tenant authorization

Existing BakerRang personal applications and ownership models must continue
working unchanged.

Do not add any frontend/platform/site functionality yet.

============================================================
APPROVED TECHNICAL APPROACH FROM CLAUDE
============================================================

Use the general implementation structure Claude identified:

New:

server/services/tenantService.js
server/middleware/tenantAuth.js
server/routes/tenants.js

Tests under:

server/test/

Use Node's built-in:

node --test

Avoid adding a large test framework.

Fresh authorization data must come from Firestore on every authorization
request.

Use dependency injection/test seams as needed so authorization and service
logic can be tested without requiring a live Firestore instance.

Follow existing repository conventions:

- ESM
- StandardJS
- route -> service -> Firestore layering
- existing HTTP error conventions where practical
- existing rate-limiter conventions

============================================================
1. GLOBAL USER / PLATFORM ROLE
   ============================================================

Reuse:

users/{userId}

Do NOT create another global user collection.

Optional field:

platformRole: "PLATFORM_ADMIN"

Absence of the field means no platform role.

No API for granting PLATFORM_ADMIN should be created.

Platform administrators will initially be bootstrapped manually in Firestore.

Authorization must NEVER trust platformRole from:

- req.user
- Passport session
- request body
- query params
- client-provided data

Read:

users/{req.user.id}

fresh from Firestore when checking platform authorization.

============================================================
2. HARDEN GOOGLE USER SYNCHRONIZATION
   ============================================================

Modify:

server/services/authService.js

Claude confirmed the current update behavior already preserves platformRole.

Harden it against future refactors by writing ONLY Google-profile-managed
fields with merge semantics.

The synchronized record should remain limited to fields such as:

id
displayName
email
emailLower
photo

Use a field-scoped merge write so internal fields such as:

platformRole

and future privileged/internal fields are never erased.

Do not copy arbitrary properties from an incoming profile object into
Firestore.

Existing login behavior and emailLower normalization must continue working.

============================================================
3. TENANT DOCUMENT
   ============================================================

Create:

tenants/{tenantId}

tenantId must be a generated UUID.

Exact initial shape:

{
name,
status: "ACTIVE",
createdAt,
updatedAt,
createdByUserId
}

Do NOT add:

id
slug
domain
site config
branding
settings
or other future fields.

Use timestamps consistent with existing backend conventions unless there is a
technical reason not to.

name validation:

- required
- string
- trimmed
- 1..200 characters

Do not persist arbitrary request fields.

============================================================
4. TENANT MEMBERSHIP
   ============================================================

Create:

tenants/{tenantId}/members/{userId}

Exact initial shape:

{
userId,
role,
createdAt,
updatedAt,
createdByUserId
}

Supported roles:

OWNER
ADMIN
STAFF

Document ID must equal userId.

Membership documents are the authoritative source of tenant permissions.

Never cache tenant roles in the Passport session.

============================================================
5. TENANT CREATION — IMPORTANT OVERRIDE
   ============================================================

Claude proposed allowing any authenticated user to create a tenant and making
the creator OWNER.

DO NOT IMPLEMENT THAT.

POST /tenants is:

PLATFORM_ADMIN ONLY.

Creating a tenant creates ONLY the tenant document.

Do NOT automatically create a membership for the platform admin.

Platform administrators already have implicit cross-tenant access and should
not appear as customer-business members unless explicitly added later.

============================================================
6. TENANT LISTING — IMPORTANT OVERRIDE
   ============================================================

Claude proposed listMyTenants() using collectionGroup('members').

DO NOT IMPLEMENT listMyTenants in Step 1.2.

GET /tenants is:

PLATFORM_ADMIN ONLY.

It returns the top-level tenant collection.

Do not add a reverse membership structure.

Do not add a collectionGroup members query.

"My Businesses" is deliberately deferred until the portal requires it.

============================================================
7. AUTHORIZATION MIDDLEWARE
   ============================================================

Implement:

requirePlatformAdmin

Behavior:

1. Request must already be authenticated.
2. Read users/{req.user.id} fresh from Firestore.
3. Require platformRole === "PLATFORM_ADMIN".
4. Otherwise return 403.
5. Firestore/system failures return 500 without leaking internals.

Implement:

requireTenantRole(allowedRoles)

Behavior:

1. Request must already be authenticated.
2. tenantId MUST come from req.params.tenantId.
3. Read users/{req.user.id} fresh.
4. If platformRole === "PLATFORM_ADMIN":
   authorize immediately.
5. Otherwise read:
   tenants/{tenantId}/members/{req.user.id}
   fresh from Firestore.
6. Missing membership -> 403.
7. Membership role not in allowedRoles -> 403.
8. Otherwise continue.

Do not authorize using tenant IDs supplied in request bodies.

============================================================
8. TENANT SERVICE OPERATIONS
   ============================================================

Implement ONLY:

createTenant
listTenants
getTenant
addMember
listMembers

Supporting internal helpers such as:

getMembership
getPlatformRole

are expected.

DO NOT implement:

listMyTenants
updateMemberRole
removeMember
deleteTenant
updateTenant

============================================================
9. ROUTES
   ============================================================

All routes remain authenticated through the existing application-level
isAuthenticated mechanism and existing CSRF behavior.

Implement exactly:

POST /tenants
Authorization:
PLATFORM_ADMIN
Service:
createTenant
Success:
201

GET /tenants
Authorization:
PLATFORM_ADMIN
Service:
listTenants
Success:
200

GET /tenants/:tenantId
Authorization:
PLATFORM_ADMIN OR OWNER OR ADMIN OR STAFF
Service:
getTenant
Success:
200

POST /tenants/:tenantId/members
Authorization:
PLATFORM_ADMIN ONLY
Service:
addMember
Success:
201

GET /tenants/:tenantId/members
Authorization:
PLATFORM_ADMIN OR OWNER OR ADMIN
Service:
listMembers
Success:
200

IMPORTANT:

STAFF may read basic tenant information.

STAFF may NOT list tenant members.

OWNER and ADMIN may list members.

OWNER and ADMIN may NOT add members in Step 1.2.

Only PLATFORM_ADMIN may add members.

============================================================
10. MEMBER CREATION
    ============================================================

addMember must:

- verify tenant exists
- verify users/{userId} exists
- validate role
- reject an existing membership with 409
- create the membership using the exact approved membership shape

Avoid a read-then-unconditional-write race if reasonably possible.

Prefer an atomic Firestore mechanism such as a transaction or document create
operation so two concurrent membership requests cannot both succeed while the
API promises duplicate protection.

Map an already-existing document to 409.

============================================================
11. RATE LIMITING
    ============================================================

Add a tenant route limiter following the existing security middleware style.

Mount the tenant router without disturbing existing middleware order.

Do NOT change portal CORS configuration yet.

Do NOT change OAuth return-to behavior yet.

Those belong to the portal-authentication milestone.

============================================================
12. TESTING
    ============================================================

Use Node's built-in node:test unless the repository presents a concrete blocker.

Tests must verify at minimum:

- unauthenticated access is rejected
- non-platform-admin cannot POST /tenants
- PLATFORM_ADMIN can create a tenant
- creating a tenant does NOT create an OWNER membership for the platform admin
- tenant document contains status ACTIVE
- tenant document uses the approved field names
- ordinary user without membership cannot access a tenant
- STAFF can access GET tenant
- STAFF cannot list members
- ADMIN can access tenant
- ADMIN can list members
- OWNER can access tenant
- OWNER can list members
- OWNER cannot add a member in Step 1.2
- ADMIN cannot add a member in Step 1.2
- PLATFORM_ADMIN can access tenants without membership
- PLATFORM_ADMIN can add a member
- invalid role returns 400
- missing target user returns 404
- duplicate membership returns 409
- missing tenant returns appropriate 404 where authorization permits disclosure
- authorization decisions come from fresh Firestore state, not req.user/session
- Google user synchronization preserves platformRole

Do NOT add tests for:

- listMyTenants
- update member role
- delete membership

because those features do not exist yet.

============================================================
13. PACKAGE / TEST SETUP
    ============================================================

Add the smallest practical npm test script needed for:

npm test

Do not add unnecessary dependencies.

Ensure new code passes the repository's StandardJS lint rules.

============================================================
14. OUT OF SCOPE
    ============================================================

Do not implement:

- platform frontend
- Next.js
- reusable component library
- site renderer
- CMS
- pages
- themes
- branding
- services offered by businesses
- media
- GCS
- leads
- CRM
- email
- custom domains
- analytics
- attribution
- Google integrations
- Instagram
- invitations
- membership editing
- membership deletion
- tenant editing/deletion
- list-my-businesses functionality
- billing

============================================================
15. VERIFICATION
    ============================================================

Run the appropriate repository commands, including at minimum:

cd server
npm test
npm run lint

Also perform syntax/startup verification appropriate to this Express project.

Do not leave the running server process hanging after verification.

============================================================
16. FINAL REPORT
    ============================================================

After implementation report:

1. Files added.
2. Files modified.
3. Exact Firestore shapes implemented.
4. Routes implemented and their authorization.
5. Tests added.
6. Test/lint/startup results.
7. Any deviations from this specification and why.
8. Any issues discovered that should influence the next platform milestone.

Do not implement anything beyond Step 1.2.