# Step 1.6 — Business Management Specification

## Objective

Allow an authenticated BakerRang platform administrator to:

* View all businesses/tenants.
* Create a new business/tenant.

Use the existing tenant API implemented in Step 1.2.

Do not expand the tenant backend unless the actual implementation reveals a concrete bug or missing requirement.

---

## 1. Terminology

Backend/domain terminology:

`Tenant`

Portal/user-facing terminology:

`Business`

Do not rename the existing API or Firestore collection.

Existing:

```text
tenants/{tenantId}
```

remains correct.

---

## 2. Existing API

Use the existing endpoints:

```text
GET /tenants
POST /tenants
```

Both are PLATFORM_ADMIN-only.

Do not add a new business API.

---

## 3. Business List

After authentication succeeds, the portal should load:

```text
GET /tenants
```

The page must support these states:

```text
LOADING
SUCCESS
EMPTY
FORBIDDEN
ERROR
```

### Loading

Display a simple loading state.

### Success

Render returned tenants as businesses.

Display at minimum:

```text
name
status
createdAt
```

Do not assume additional fields.

### Empty

Display something like:

```text
No businesses yet.

Create your first business to get started.

[ Add Business ]
```

### Forbidden

If API returns HTTP 403:

```text
Your account does not have access to platform administration.
```

Do not infer why from browser-side user data.

### Error

Display a useful retryable error without exposing backend internals.

---

## 4. Create Business

Provide:

```text
Add Business
```

which opens either:

* a lightweight modal/dialog, or
* an inline form.

Use the existing `@bakerrang/ui` package where appropriate.

Initial field:

```text
Business Name
```

Only.

Do not add fields that the backend does not support yet.

---

## 5. Create Request

Submit:

```http
POST /tenants
Content-Type: application/json
```

Body:

```json
{
  "name": "Wasatch Shower Glass"
}
```

The request must:

* Include session credentials.
* Include the existing CSRF token mechanism.
* Use the shared API client introduced in this step.

---

## 6. Success Behavior

On successful creation:

* Close/reset the create form.
* Refresh the business list or update it from the returned object.
* Display the newly created business.

Prefer the simplest implementation that keeps server state correct.

Do not introduce a client caching/state library solely for this feature.

---

## 7. Validation

Client validation should mirror obvious backend requirements without replacing backend validation.

At minimum:

* Required.
* Trim whitespace.
* Prevent submission of an empty name.
* Respect the backend's current maximum name length.

Backend remains authoritative.

Display backend validation errors in a user-friendly way.

---

## 8. API Client Foundation

Create or evolve a small portal API abstraction.

Responsibilities should include:

* `NEXT_PUBLIC_API_BASE_URL`
* `credentials: 'include'`
* JSON request/response handling
* HTTP error representation
* CSRF handling for unsafe HTTP methods

Unsafe methods conceptually include:

```text
POST
PUT
PATCH
DELETE
```

The implementation should use the existing:

```text
GET /auth/csrf
```

endpoint.

Do not create a large networking framework.

Do not add Axios unless concretely justified.

Native `fetch` is sufficient.

---

## 9. Auth Refactor

If the new API helper cleanly replaces duplicated functionality currently in:

```text
portal/lib/auth.ts
```

a small refactor is permitted.

Do not change the portal's authentication semantics.

Login remains a full browser navigation.

Auth states remain:

```text
loading
anonymous
authenticated
```

Logout remains:

```text
POST /auth/logout
```

with CSRF protection.

---

## 10. Component Organization

Do not put all business management logic directly into `app/page.tsx`.

Establish a small feature organization appropriate to the existing Next app.

Conceptually:

```text
portal/
  features/
    businesses/
      api
      components
      types
```

or an equivalent structure consistent with the actual repository.

Avoid architecture ceremony.

Likely concepts:

```text
BusinessList
BusinessCard
CreateBusiness
```

Create only what materially improves readability.

---

## 11. UI Package Boundary

`@bakerrang/ui` may gain a very small number of genuinely generic primitives if the business UI exposes a clear need.

Examples could include:

```text
Input
Card
Dialog
```

BUT:

Do not build the future design system during this milestone.

Any component added to `@bakerrang/ui` must be generic and contain no business/tenant knowledge.

Business-specific components stay inside the portal feature.

---

## 12. No New State Library

Do not add:

* Redux
* Zustand
* TanStack Query
* SWR

for this milestone.

Normal React state/effects are sufficient for the current complexity.

We can introduce a data-fetching library later if repeated server-state behavior justifies one.

---

## 13. Backend Changes

Expected backend changes:

```text
NONE
```

The Step 1.2 API should already support this milestone.

If implementation discovers a genuine backend defect:

* stop expanding scope,
* report the issue,
* make only the smallest correction necessary.

Do not add tenant update/delete operations.

---

## 14. Testing

Do not add a large frontend testing stack solely for Step 1.6.

Required automated/static verification:

```text
npm run typecheck
npm run lint
npm run build
```

Existing server tests must remain passing if server code is touched.

The API abstraction should be structured so it can be tested later without major refactoring.

---

## 15. Manual Verification

Verify:

1. Start API.
2. Start portal.
3. Log in through Google.
4. Confirm authenticated portal.
5. Confirm business list loads.
6. If there are no businesses, confirm empty state.
7. Click Add Business.
8. Enter a business name.
9. Create it.
10. Confirm it appears in the list.
11. Confirm Firestore contains:

```text
tenants/{generatedId}
```

with:

```text
name
status: ACTIVE
createdAt
updatedAt
createdByUserId
```

12. Refresh browser.
13. Confirm business remains present.
14. Verify empty business-name submission is rejected.
15. Verify session/logout behavior still works.

---

## 16. PLATFORM_ADMIN Verification

If:

```text
GET /tenants
```

returns `403`, verify the logged-in user's Firestore document contains:

```text
platformRole: "PLATFORM_ADMIN"
```

Do not work around missing authorization in the frontend.

---

## 17. Explicitly Out of Scope

Do not implement:

* Business editing
* Business deletion
* Membership UI
* Invitations
* Business-owner portal
* Business profile
* Logo
* Branding
* Address
* Phone
* Email
* Service areas
* Services
* Site configuration
* Site rendering
* Preview websites
* Domains
* Media
* Leads
* Analytics
* Google Business Profile
* Instagram
* Billing

---

## Definition of Done

Step 1.6 is complete when:

1. Authenticated platform admin can view tenant records as Businesses.
2. Empty/loading/error/403 states are handled.
3. Platform admin can create a Business from the portal.
4. POST uses the existing CSRF protection.
5. Newly created business appears without requiring manual Firestore changes.
6. Refresh retains the business because it is loaded from the API.
7. No authorization logic is trusted to the browser.
8. No unnecessary backend functionality was added.
9. API access is now reusable for subsequent platform features.
10. Platform typecheck/lint/build succeed.
