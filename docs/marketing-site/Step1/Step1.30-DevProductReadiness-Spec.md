# Planning Task — Step 1.30: DEV Product Readiness

We are continuing the BakerRang multi-tenant local-business website platform.

Do NOT implement anything.

Inspect the actual current repository and produce a comprehensive but prioritized implementation plan for:

# Step 1.30 — DEV Product Readiness

This is the final roadmap step before later production-focused work.

Steps 1.1 through 1.29 are complete.

The purpose of 1.30 is NOT to add another major feature.

The purpose is to evaluate the current DEV product end-to-end and identify the smallest set of work needed for the platform to feel coherent, reliable, safe, and meaningfully usable as a complete DEV product.

---

# 1. Mindset

Treat the platform as though an operator is about to use the DEV environment for real.

Ask:

```text
Can I sign in?
Can I create/manage a business?
Can I configure its website?
Can I Preview it?
Can I Publish it?
Can I attach a custom domain?
Can visitors submit leads?
Can I manage those leads?
Can I understand errors and empty states?
Can I recover from common mistakes?
Does the application clearly communicate state?
Does anything obviously look unfinished?
Are there obvious security/integrity gaps?
Can another developer deploy/run DEV without tribal knowledge?
```

Do not approach this as:

```text
find every possible future feature
```

Approach it as:

```text
find what prevents the existing product from feeling complete in DEV
```

---

# 2. Current Product Areas

Inspect the actual implementation for the complete current product.

At minimum cover:

## Authentication / Portal entry

- Google OAuth
- auth bootstrap
- logout
- unauthorized behavior
- session expiration behavior
- loading/auth-gating states

## Businesses

- business list
- create business
- business workspace
- business status
- empty states
- navigation

## Website

- Website Overview
- Website editor navigation
- Branding
- Theme
- Business Profile
- Business Hours
- Social Profiles
- Hero
- About
- Services
- Gallery
- Testimonials
- FAQ
- Contact
- Manage Sections
- Custom CSS
- Preview
- Publish / Republish / Unpublish
- published-vs-working status
- unsaved-change protection

## Leads

- public lead capture
- Leads inbox
- Lead detail
- workflow/status
- notes
- empty states
- errors
- tenant isolation

## Domains

- domain management
- verification
- activation
- disabling/removal
- DNS guidance
- active-domain state
- custom-domain routing
- CORS implications
- operator UX

## Public site

- shared renderer
- custom domain renderer
- Home
- Contact
- SEO
- structured data
- sitemap
- robots
- media
- responsive behavior
- theme
- custom CSS

## Infrastructure / DEV deployment

- Cloud Run services
- environment configuration
- Secret Manager requirements
- service accounts / IAM assumptions
- public URLs
- build arguments
- runtime environment variables
- DEV Firestore isolation
- health endpoint
- deployment repeatability

Inspect the actual code/configuration rather than relying only on roadmap descriptions.

---

# 3. Known Deferred Item — Favicon

There is a known current issue:

```text
/favicon.ico -> 404
```

This was intentionally deferred through previous steps.

The desired product direction is:

```text
tenant/public-site favicon configurable per published site
```

NOT:

```text
one hardcoded BakerRang favicon for every tenant site
```

Evaluate whether this should now be included in Step 1.30 as a DEV-readiness fix.

If yes, propose the smallest correct architecture.

Likely considerations:

```text
media-backed favicon
working/published lifecycle
Preview
published renderer
shared domain
custom domain
metadata route / icon generation
backward compatibility when absent
```

Do not automatically implement a complicated favicon-management system.

Determine whether favicon is:

```text
DEV blocker
worth fixing in 1.30
safe to defer
```

and explain why.

---

# 4. Readiness Classification

For every finding, classify it into exactly one category:

```text
BLOCKER
  prevents reliable end-to-end DEV product use
  security/data-integrity failure
  broken primary workflow
  major confusing state that can cause incorrect action

FIX NOW
  not technically blocking but materially hurts product completeness,
  trust, usability, or maintainability before closing DEV

DEFER
  production hardening
  future capability
  polish with low immediate value
  scaling work
  optional feature
```

Be disciplined.

Do not turn dozens of minor observations into required work.

---

# 5. End-to-End Operator Journey

Walk through the current operator journey from code:

```text
sign in
  ↓
business list
  ↓
create/select business
  ↓
business workspace
  ↓
configure Website
  ↓
Preview
  ↓
Publish
  ↓
configure Domain
  ↓
receive lead
  ↓
open Leads
  ↓
manage lead status / notes
```

Identify:

- dead ends
- missing navigation
- inconsistent terminology
- confusing transitions
- actions with no feedback
- states where the operator cannot tell what to do next

Do not redesign already-good areas merely for consistency.

---

# 6. New-Business / Empty-State Journey

This is particularly important.

Inspect what happens for a newly-created business with:

```text
no configured website
no published site
no custom domain
no leads
```

Evaluate whether an operator understands how to get from:

```text
new business
```

to:

```text
published working website
```

Check:

- empty states
- CTAs
- missing-site initialization
- Website Overview
- Leads empty state
- Domain empty state

Avoid adding onboarding tours or wizard frameworks unless the existing experience is genuinely unusable without one.

Simple useful empty-state guidance is preferable.

---

# 7. Missing / Loading / Error States

Audit the primary Portal screens.

Look specifically for:

```text
blank areas
raw errors
generic "Something went wrong"
infinite loading possibility
disabled UI with no explanation
stale data after failure
lost user input
layout collapse
```

Inspect:

- auth loading
- business list loading/error
- business workspace loading/error
- Website loading/error
- editor mutation failure
- Preview failure
- publish failure
- domain failure
- leads inbox/detail failure
- notes/status mutation failure
- media failure

Recommend only meaningful fixes.

---

# 8. Consistency of Terminology

Audit operator-facing terms such as:

```text
Business
Website
Draft
Published
Changes not published
Preview
Publish
Republish
Unpublish
Domain
Lead
Status
Notes
Remove
Delete
```

Identify terminology that could cause genuine confusion.

Do not perform a copy-editing sweep for style alone.

---

# 9. Authentication / Authorization Review

Perform a readiness-level review of:

- Portal authentication requirements
- PLATFORM_ADMIN boundaries
- tenant isolation
- anonymous public routes
- Preview token authorization
- lead submission boundary
- domain routes
- editor mutations

This is not intended to duplicate a full penetration test.

Look for obvious gaps introduced by the cumulative feature set.

Especially confirm no newer route accidentally skipped the established:

```text
auth
platformAdmin
tenant authorization
CSRF
rate limiting
```

patterns where applicable.

---

# 10. Tenant Isolation

Review representative cross-tenant operations.

At minimum:

```text
Website
Leads
Media
Domain
Preview
Custom CSS
```

Confirm IDs supplied by the client cannot be used to cross tenant boundaries.

Look for any service/route introduced in later steps that lacks the same tenant checks as earlier code.

Flag security/data isolation failures as BLOCKER.

---

# 11. Lead-Capture Readiness

Inspect the complete visitor-to-operator lead path.

Verify architecture and UX:

```text
published site
  ↓
lead form
  ↓
public API
  ↓
validation / honeypot / limiter
  ↓
tenant lead storage
  ↓
Portal Leads inbox
  ↓
detail
  ↓
status
  ↓
notes
```

Check for obvious gaps such as:

- misleading success behavior
- inability to distinguish empty/no-results/error
- data not refreshing after status/note updates
- tenant/site lifecycle inconsistencies
- contact form still shown when submission is not eligible
- Preview accidentally creating real leads

Do not add email notifications or CRM integrations in 1.30 unless they are somehow required for existing product functionality.

---

# 12. Public Website Readiness

Inspect the renderer as a visitor would encounter it.

Check:

- Home
- Contact
- missing/unpublished site behavior
- custom-domain redirect behavior
- shared-domain behavior
- mobile layout
- navigation
- external links
- social links
- lead form
- media
- Theme
- Custom CSS
- basic browser metadata
- obvious console errors / missing resources

Determine whether any obvious unfinished artifact remains beyond the known favicon issue.

Do not redesign public-site visuals.

---

# 13. SEO / Metadata Readiness

Review existing:

```text
title
description
canonical
Open Graph
Twitter
LocalBusiness JSON-LD
business hours
sameAs
robots
sitemap
```

Check that the cumulative About/Hours/Social/Domain features did not create contradictory metadata.

Do not expand SEO into an advanced feature project.

Only fix genuine errors or obvious missing baseline behavior.

---

# 14. Domain Lifecycle Readiness

Inspect the operator workflow for:

```text
enter hostname
get DNS instructions
verification
activation
active state
disable/remove
re-enable
```

Evaluate:

- clarity
- error recovery
- stale verification handling
- public URL presentation
- links/actions
- DEV permanent custom domain behavior

Do not redesign the custom-domain architecture.

No production wildcard/domain automation required here.

---

# 15. Media Readiness

Review media upload/read behavior across:

```text
Branding
About
Gallery
Testimonials if applicable
SEO social image
```

Look for:

- failed upload handling
- stale references
- missing image presentation
- orphaned upload concerns that are actually significant
- tenant authorization
- file-size/type behavior
- public hydration failure

Distinguish:

```text
DEV correctness issue
vs
future storage cleanup/garbage collection
```

Do not build a DAM/media library in this step.

---

# 16. Destructive Actions

Review significant destructive actions:

```text
Unpublish
Remove domain
Remove Business Hours
remove homepage section
delete/remove repeatable content
clear Custom CSS
```

Confirm the current distinction remains sensible:

```text
local reversible edit
  -> no unnecessary confirmation

immediate canonical destructive action
  -> confirmation when warranted
```

Flag only genuinely risky inconsistencies.

---

# 17. Cross-Feature State Integrity

Look for combinations that previous isolated feature tests may miss.

Examples:

```text
Theme + Custom CSS
Business Hours + homepage removal
Social Profiles + footer
About media + Gallery media
unpublished site + active domain
domain + republish
Preview + unsaved editor changes
published site + changed Business Profile
lead form eligibility + unpublish
```

Identify only combinations with actual code-level risk.

---

# 18. Public / Working / Published Invariants

Reconfirm cumulative architecture:

```text
WORKING
  editable

Preview
  WORKING only

PUBLISHED
  immutable public snapshot until Republish

custom domain
  PUBLISHED only

shared public site
  PUBLISHED unless explicit DEV draft behavior

lead authorization
  published/current site only

Custom CSS
  raw canonical + transient scoped

media
  provider-neutral IDs + read-time hydration
```

Any regression here is BLOCKER.

---

# 19. Browser Console / Network Cleanliness

Inspect code and recommend a manual DEV check for obvious:

```text
404
500
hydration warnings
React warnings
failed asset requests
CORS failures
mixed content
bad redirects
```

Do not require zero noise from third-party/browser extensions.

Known `/favicon.ico` should be specifically classified.

---

# 20. Responsive Product Readiness

Do not repeat Step 1.29's detailed Website-editor polish.

Instead perform a cross-product responsive check for:

```text
business list
business workspace navigation
Website
Leads inbox/detail
Domain
public site
```

at approximately:

```text
375px
768px
desktop
```

Identify actual blockers such as:

```text
unusable controls
horizontal overflow
modal inaccessible
critical content hidden
```

Minor aesthetic differences can defer.

---

# 21. Accessibility Readiness

Perform a pragmatic pass for:

```text
keyboard navigation
dialog focus
form labels
button names
active navigation
status messages
disabled-state explanation
touch targets
heading hierarchy
```

Focus on actual product blockers and easy high-value fixes.

Do not turn this into a formal WCAG certification project.

---

# 22. DEV Infrastructure / Configuration Audit

Inspect repository deployment/configuration expectations for the current DEV environment.

Identify all required environment variables/build args/secrets for:

```text
API
Portal
Renderer
```

Check for:

- undocumented required values
- dangerous defaults
- production project fallback risk
- missing DEV isolation enforcement
- variables read at build-time vs runtime
- frontend `NEXT_PUBLIC_*` assumptions
- Secret Manager dependencies
- domain/load-balancer assumptions

The existing DEV environment uses Cloud Run.

Do NOT propose Kubernetes.

---

# 23. Environment Validation

Evaluate whether startup currently fails clearly when critical configuration is missing.

Examples:

```text
FIRESTORE_PROJECT_ID
SITE_API_BASE_URL
SITE_PUBLIC_ORIGIN
preview secret
OAuth configuration
renderer origin
custom-domain LB IP
```

Determine whether any silent dangerous fallback should become:

```text
fail fast
```

in DEV/production runtime.

Be especially careful around Firestore project selection.

Flag potential accidental production-data access from DEV as BLOCKER.

---

# 24. Deployment Repeatability

Inspect:

```text
Dockerfiles
Cloud Run expectations
build args
runtime env
health endpoint
service account assumptions
Artifact Registry assumptions
```

Determine whether the current deployment process is reproducible enough for DEV.

Do not require Terraform/IaC merely because it would be nice.

If a concise deployment/readiness document or script would eliminate significant tribal knowledge, recommend it.

---

# 25. Repository Documentation

Inspect existing README/docs.

Determine whether a developer can reasonably understand:

```text
what each app is
how to run it
how to configure DEV
how to run tests
how to deploy DEV
```

Do not demand exhaustive documentation.

Recommend only documentation required to make this stage maintainable.

---

# 26. Automated Test Coverage

Review cumulative tests.

Do NOT aim for arbitrary coverage percentages.

Identify meaningful missing deterministic coverage around:

- end-to-end state transitions
- authorization
- tenant isolation
- deployment-sensitive config
- error states
- cross-feature behavior

If existing tests already prove an invariant adequately, do not request duplicates.

---

# 27. Manual DEV Smoke Suite

Design a final reusable manual DEV smoke checklist.

It should cover the major journey without being enormous.

Something an engineer could run after a large change in roughly:

```text
15–30 minutes
```

Include the highest-value checks across:

```text
Auth
Business
Website
Preview
Publish
Domain
public site
lead submission
Leads
responsive basics
console/network sanity
```

This can become the standard pre-production-development smoke test.

---

# 28. Automated Smoke Possibility

Assess whether a small Playwright smoke suite is now worthwhile.

Important:

Do NOT recommend Playwright just because browsers are involved.

Evaluate actual repo/tooling and answer:

```text
Would 3–6 high-value browser tests materially reduce regression risk?
```

Potential flows:

```text
Portal auth mocked/test mode if practical
Website workspace basic navigation
Preview/Publish state
public lead form submission
Leads visibility
```

If OAuth/Cloud Run makes reliable deterministic browser automation awkward, explain that and recommend keeping manual smoke for now.

Do not build a giant E2E framework during 1.30 unless the value is clearly high.

---

# 29. Observability / Diagnostics

Assess the current DEV ability to diagnose failures.

Look for:

```text
health endpoint
structured/useful server errors
Cloud Run logs
correlation IDs if existing
client errors
```

Do not add a full monitoring/telemetry platform.

Recommend only small readiness improvements if developers currently cannot diagnose basic failures.

---

# 30. Rate Limiting / Instance Semantics

Review the existing lead limiter and other in-memory safety controls in the context of Cloud Run.

Do not automatically call in-memory rate limiting a blocker.

Classify clearly:

```text
adequate DEV / basic abuse mitigation
vs
production-scale limitation
```

Production-grade distributed limiting may be deferred unless there is a concrete correctness/security issue at current scope.

---

# 31. Secrets / Sensitive Data

Check that:

- secrets are not accidentally exposed through `NEXT_PUBLIC_*`
- server secrets are not serialized into SiteDefinition
- Preview tokens are not logged unnecessarily
- OAuth secrets remain server-side
- lead data exposure stays authenticated/tenant-scoped

Any actual secret exposure is BLOCKER.

---

# 32. Logging / Privacy

Review obvious logging of:

```text
lead contents
auth headers
preview tokens
verification tokens
OAuth data
```

Do not invent a broad privacy program.

Flag concrete unsafe logs if present.

---

# 33. Dependency / Build Health

Inspect for obvious:

```text
build warnings
deprecated critical dependency behavior
runtime mismatch
Node mismatch
failing lint
failing typecheck
```

Do not launch a dependency-upgrade project unless something threatens current runtime reliability.

Known benign warnings should be documented rather than "fixed" unnecessarily.

---

# 34. Browser Support Assumptions

Only flag browser compatibility issues that affect normal modern Chrome/Edge/Safari/Firefox behavior.

Do not create legacy-browser work.

---

# 35. Production vs DEV Boundary

Be explicit about what is NOT required to close DEV readiness.

Likely production-later concerns may include:

```text
full infrastructure-as-code
multi-region
distributed rate limiting
advanced monitoring
backup/restore runbooks
production OAuth/domain setup
production secrets rotation
billing
SLA
load testing
CDN optimization
advanced security review
```

Do not sneak these into 1.30 unless current DEV correctness depends on them.

---

# 36. Product Feature Deferrals

Also identify non-readiness future features that should remain deferred, such as:

```text
additional pages
visual page builder
revision history
rollback
analytics
email lead notifications
CRM integrations
autosave
collaboration
Theme V2
advanced media management
```

Do not confuse "not built" with "not ready."

---

# 37. Recommended 1.30 Scope

After inspecting everything, define the **smallest recommended Step 1.30 implementation scope**.

Prefer something like:

```text
1.30a — critical readiness fixes
1.30b — high-value product completion / empty-error states
1.30c — final QA / deployment docs / smoke verification
```

ONLY if the findings justify multiple slices.

If there are very few required fixes, recommend one contained implementation pass instead.

Do not slice for ceremony.

---

# 38. Ranking

Provide a ranked table of findings.

Columns:

```text
Priority
Classification
Area
Finding
Why it matters
Recommended action
Estimated scope: XS / S / M / L
```

Keep the required set disciplined.

---

# 39. Human Decisions

Identify only genuine product/architecture decisions.

Possible examples:

```text
tenant-configurable favicon now vs later
Playwright smoke suite now vs later
whether DEV deployment documentation should live in repo
```

For each:

- current state
- choices
- recommendation
- consequence of deferring

Do not ask the human to decide trivial implementation details.

---

# 40. Manual Inspection Recommendations

If there are areas where code inspection cannot establish readiness, explicitly state what must be manually checked in DEV.

Examples:

```text
OAuth session expiration
mobile layout
actual custom-domain TLS
browser metadata/favicon
real lead submission
console/network errors
```

Do not pretend static code inspection proves live infrastructure.

---

# 41. Preserve Core Architecture

Nothing in Step 1.30 should casually change these established invariants:

```text
single renderer for all tenants

renderer -> sanitized API -> Firestore
no renderer Firestore access

working/published snapshot isolation

Home.sections is homepage composition/nav authority

BusinessProfile is structured identity

Theme = normal styling controls

Custom CSS = bounded advanced escape hatch

operator-managed custom domain V1

Cloud Run deployment

DEV Firestore project explicitly isolated
```

If a readiness finding suggests changing one, call it out as an architectural decision rather than casually including it.

---

# 42. No Production Deployment

Step 1.30 concerns DEV readiness.

Do NOT deploy production.

Do NOT modify production DNS.

Do NOT create production data.

Do NOT convert the DEV environment into the production environment.

---

# 43. Verification Gates for Future Implementation

For whatever implementation you recommend, define the expected final gates:

```text
Backend tests
Portal tests
Renderer tests
Shared UI tests
platform typecheck
platform lint
Portal production build
Renderer production build
server touched-file lint
git diff --check
manual DEV smoke
```

Add other gates only when justified.

---

# 44. Desired Outcome

At completion of Step 1.30 we want to be able to state:

```text
The BakerRang DEV product is coherent end-to-end.

An operator can:
- authenticate
- create/select a business
- configure a site
- Preview it
- Publish it
- attach a custom domain
- receive/manage leads

The major empty/error states are understandable.
Tenant/security boundaries remain intact.
DEV deployment/configuration is reproducible.
No known blocker remains before later production-focused work.
```

---

# 45. Output

Return:

1. Executive readiness verdict
2. Actual product areas inspected
3. End-to-end operator journey findings
4. New-business / empty-state findings
5. Auth findings
6. Business-management findings
7. Website findings
8. Leads findings
9. Domain findings
10. Public-renderer findings
11. SEO/metadata findings
12. Media findings
13. Security/tenant-isolation findings
14. Working/Preview/Published invariant findings
15. Error/loading-state findings
16. Responsive/accessibility findings
17. DEV infrastructure/configuration findings
18. Deployment-repeatability findings
19. Documentation findings
20. Test-coverage findings
21. Playwright recommendation
22. Favicon recommendation
23. Observability/diagnostics findings
24. Production-only items explicitly deferred
25. Future product features explicitly deferred
26. Ranked BLOCKER / FIX NOW / DEFER table
27. Smallest recommended Step 1.30 implementation scope
28. Recommended implementation slices
29. Exact files likely affected
30. Testing strategy
31. 15–30 minute final DEV smoke checklist
32. Human decisions genuinely required
33. Definition of done for Step 1.30

Do NOT modify code.