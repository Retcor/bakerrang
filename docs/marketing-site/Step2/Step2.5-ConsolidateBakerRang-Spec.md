# Step 2.5 Planning — Consolidate BakerRang Into One Live GCP Environment

DO NOT modify anything.

The architecture has changed.

We are a single-person project and no longer want separate DEV and PROD cloud environments.

Current `bakerrang-dev` was useful for proving the architecture and CI/CD, but after migration it should be DECOMMISSIONED to eliminate duplicate cost.

The target is the user's existing MAIN BakerRang GCP project.

Important: do NOT assume its project ID. Discover it from the existing repository, gcloud resources, DNS, Cloud Run, and current `bakerrang.com` deployment.

There is also an existing legacy frontend:

client/

React/Vite.

`bakerrang.com` currently points to this frontend.

This frontend MUST become part of the unified CI/CD system after migration.

---

## Goal

Design a safe migration from:

bakerrang-dev
API
Portal
Renderer
Firestore
Artifact Registry
Load Balancer
WIF / deployer
DEV domains

plus existing main-project resources

into:

ONE main/live GCP project
existing BakerRang frontend
API
Portal
Renderer
Firestore
ONE load balancer
ONE GitHub WIF/deployer setup
one live deployment environment

Then decommission bakerrang-dev.

No migration or deletion during this planning task.

---

## 1. Discover the actual main GCP project

Inspect read-only:

- current gcloud projects accessible
- repo configuration/history
- existing Cloud Run services
- DNS zones
- Artifact Registry
- Firestore
- Secret Manager
- service accounts
- load balancers
- static/existing frontend deployment

Determine exactly which GCP project currently serves:

https://bakerrang.com

Do not assume an old project ID from source defaults.

Return:

- project ID
- project number
- region(s)
- current services/resources

---

## 2. Existing `client/` frontend

Inspect:

client/

Determine:

- Node version
- package manager/lockfile
- build command
- Dockerfile if any
- current hosting/deployment mechanism
- runtime vs build-time configuration
- current bakerrang.com routing
- whether it currently lives on Cloud Run
- current Artifact Registry image/repo if applicable

Treat this as a fourth deployable service.

Do NOT move it into platform/.

---

## 3. Unified deployable services

Target CI/CD service set:

API
source: server/

Portal
source: platform/apps/portal/

Renderer
source: platform/apps/site-renderer/

Main BakerRang frontend
source: client/

Determine exact classifier changes needed.

Preserve existing platform package fan-out.

A client-only change must not deploy API/Portal/Renderer.

A platform shared-package change must not deploy the legacy client.

---

## 4. Branch/environment model

Target:

feature branch
-> PR main
-> CI
-> merge main
-> selectively deploy affected services to the ONE live environment

No `production` branch required.

No second cloud environment.

Evaluate whether GitHub Environment should be called:

production
or
live

Recommend one.

The current `development` Environment should ultimately be removed after migration.

---

## 5. Firestore consolidation

Current BakerRang platform data lives in:

bakerrang-dev Firestore

Discover whether the main project already contains Firestore data and what collections exist.

Do NOT overwrite anything.

Design migration:

bakerrang-dev Firestore
->
main project Firestore

Determine:

- export/import mechanism
- collision risks
- collection paths
- indexes
- security/config implications
- media references
- whether storage buckets must also migrate
- verification queries/counts

We need to preserve:

tenants
sites
published snapshots
leads
media metadata
custom domain records
and all other actual current platform collections

Inspect rather than assuming this list is complete.

No data migration during planning.

---

## 6. Media / Cloud Storage

Inspect the current media bucket(s).

Determine:

- DEV bucket
- existing main-project bucket
- object naming/layout
- CORS/IAM
- URLs/provider-neutral media IDs

Design safe object migration if required.

Do not break published image references.

---

## 7. Secrets

Inventory secret RESOURCE NAMES only.

Do not print secret values.

Determine what must exist in the main project for:

API
Portal
Renderer

Design creation/copy process where sensitive VALUES are inserted manually/out-of-band.

Never put secret values in Terraform, GitHub variables, documentation, or logs.

---

## 8. Runtime service accounts

Discover existing main-project service accounts.

Design least-privilege runtime identities for:

API
frontend services

We may preserve the proven split:

API runtime SA
frontend runtime SA

but inspect the main project's existing identities first.

Do not reuse GitHub deployer SA as a runtime identity.

---

## 9. Artifact Registry

Inspect existing main-project repositories.

Design one purpose-built repository if appropriate:

{main-project-repo}/api
{main-project-repo}/portal
{main-project-repo}/site-renderer
{main-project-repo}/client

Prefer one repository unless actual discovery gives a reason not to.

---

## 10. Load balancer

Target is ONE external Application Load Balancer in the main project.

It must serve:

bakerrang.com
www.bakerrang.com if applicable

api.bakerrang.com
portal.bakerrang.com
sites.bakerrang.com

customer custom domains

Discover the existing main-project LB/DNS setup before recommending whether to:

- extend an existing LB
- migrate the DEV LB concept
- create a new main-project LB

Avoid running two permanent load balancers.

The DEV LB should eventually be deleted.

---

## 11. Custom domains

Preserve existing custom-domain architecture:

customer hostname
-> main LB
-> renderer
-> Host header determines tenant

Verify:

/
/contact
other renderer routes
SEO metadata
canonical redirects
custom-domain resolution

remain correct after project/domain migration.

Do not regress to per-tenant Cloud Run services.

---

## 12. Domain transition

Target likely becomes:

bakerrang.com
-> existing client frontend

api.bakerrang.com
-> API

portal.bakerrang.com
-> Portal

sites.bakerrang.com
-> Renderer

Existing DEV domains currently include:

api-dev.bakerrang.com
portal-dev.bakerrang.com
sites-dev.bakerrang.com
custom-dev.bakerrang.com

These should eventually be removed.

Plan DNS/TLS cutover carefully.

Do NOT mutate DNS during planning.

---

## 13. CI/CD migration

Current DEV deployment automation is proven.

Design how to reuse it for the main project.

We want:

main
-> classifier
-> validate
-> build only affected services
-> WIF
-> main project Artifact Registry
-> image-only Cloud Run update
-> smoke

Include the existing client frontend.

Determine whether to:

A. repurpose deploy-dev.yml
or
B. create the new live workflow, verify it, then remove deploy-dev.yml

Prefer the safer migration path.

No long-lived GCP keys.

---

## 14. WIF

Current WIF exists only in bakerrang-dev.

Design a NEW WIF pool/provider/deployer in the main project.

Trust remains:

Retcor owner ID: 2282360
bakerrang repo ID: 715929041
refs/heads/main

Use immutable GitHub IDs.

Least privilege:

Artifact Registry writer on one repo
Cloud Run developer on named services only
serviceAccountUser on named runtime SAs only

No project-wide deployer privileges unless technically necessary.

After successful cutover, delete the old bakerrang-dev WIF/deployer.

---

## 15. Existing main frontend CI/CD

The client frontend must receive the same properties:

- PR validation
- Docker packaging validation if containerized
- selective deployment
- immutable SHA image
- deploy by digest
- runtime config preservation
- smoke test against https://bakerrang.com

Determine exact smoke assertion from current behavior.

---

## 16. Migration sequence

Design a sequence that minimizes downtime and prevents data loss.

Likely conceptual stages:

A. discovery
B. create main-project runtime foundations
C. migrate/copy Firestore/media
D. deploy API/Portal/Renderer without public cutover
E. configure main-project LB/routes/certs
F. recreate custom-domain infrastructure
G. update GitHub WIF/environment
H. enable unified CI/CD
I. cut DNS
J. live verification
K. freeze/check old DEV
L. final data sync if required
M. delete DEV resources

But inspect reality and recommend exact ordering.

---

## 17. Data cutover concern

Because leads and site edits can occur while migrating, analyze whether we need:

- a short maintenance/freeze window
- double export/import
- final delta migration
- or another strategy

This is a small project, so prefer a short controlled maintenance window over complex replication if reasonable.

---

## 18. DEV decommission

Produce an explicit resource deletion checklist for bakerrang-dev.

Do NOT delete during planning.

Potential resources:

Cloud Run services
serverless NEGs
backend services
URL maps
HTTPS proxies
certificates
forwarding rules
static IP
Artifact Registry
WIF pool/provider
GitHub deployer SA
runtime SAs
Firestore
Storage bucket
Secret Manager resources
DNS records
GitHub development Environment

Discover actual resources before listing definitive deletions.

Important:

retain whatever backups/exports are needed before deleting Firestore/buckets.

---

## 19. Cost outcome

Identify which continuously/fixed-cost resources disappear after DEV deletion.

Especially:

- forwarding rules/load balancer
- reserved IP if chargeable
- Artifact Registry storage
- Cloud Run minimum instances if any
- other fixed resources

No need for exact billing estimates unless easily discoverable.

---

## 20. Terraform

Re-evaluate whether Terraform is worthwhile AT ALL for a single-person/single-environment project.

We originally planned Terraform primarily around creating clean PROD infrastructure.

Now that there will be one environment and existing manually-provisioned resources, determine whether introducing Terraform creates more complexity than value.

Do not assume Terraform remains required just because it was on the old roadmap.

Give a firm recommendation.

---

## 21. Rollback

Keep existing manual Cloud Run revision rollback available.

We can harden release/rollback later.

Do not add a second environment just for rollback.

---

## 22. Local development

Must remain unchanged.

Local developers use local env/config and do not need GCP/WIF.

---

## 23. Safety rules

Planning/read-only only.

DO NOT:

- migrate data
- delete DEV resources
- mutate DNS
- create Cloud Run
- modify Firestore
- modify WIF
- modify IAM
- change GitHub Environment
- deploy code
- modify repository files

---

## 24. Output

Return:

1. actual main GCP project identity
2. current main-project architecture
3. exact hosting of client/bakerrang.com
4. four-service dependency/deployment graph
5. single-environment branch model
6. GitHub Environment recommendation
7. Firestore migration plan
8. Storage/media migration plan
9. Secret migration plan
10. runtime-SA plan
11. Artifact Registry plan
12. one-load-balancer plan
13. DNS/TLS/custom-domain cutover plan
14. unified WIF plan
15. client frontend CI/CD integration
16. exact phased migration sequence
17. data-freeze/delta strategy
18. live verification checklist
19. rollback strategy during cutover
20. full bakerrang-dev deletion checklist
21. cost resources eliminated
22. Terraform keep/drop recommendation
23. expected repository changes
24. human actions required
25. anything risky or irreversible
26. updated Step 2 roadmap after this architecture change
27. whether this should be split into 2.5a/2.5b/etc.
28. safe first implementation step

Do not modify anything.