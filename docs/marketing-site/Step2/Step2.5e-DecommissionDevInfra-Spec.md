# Step 2.5e Planning — Decommission DEV Deployment Infrastructure

READ-ONLY PLANNING ONLY.

Do NOT delete anything.
Do NOT modify GCP.
Do NOT modify DNS.
Do NOT modify GitHub.
Do NOT modify IAM.
Do NOT modify repository files.

Steps 2.5a–2.5d are COMPLETE.

MAIN is now the single live cloud environment.

MAIN production traffic is live through the global external Application Load Balancer:

34.8.236.85

Public MAIN hosts are working:

bakerrang.com
api.bakerrang.com
portal.bakerrang.com
sites.bakerrang.com

custom.bakerrang.com has also proven the Renderer default-backend/custom-host architecture.

MAIN automatic deployment is now:

push main
→ selective automatic MAIN deployment

DEV automatic deployment has been removed.

---

# Goal

Decommission only the DEV resources that existed to support the old deployed DEV environment.

We MUST retain DEV as the backing data environment for LOCAL development.

Steady state:

LOCAL DEVELOPMENT
→ local processes
→ Firestore in bakerrang-dev
→ gs://bakerrang-dev-media-marketing
→ developer ADC/local credentials

LIVE
→ avian-cable-379805
→ MAIN Cloud Run/LB/DNS/CI/CD

There should be no deployed DEV web stack left.

---

# 1. Inventory actual DEV project

Project:

bakerrang-dev

Region:

us-west1

Perform read-only inventory of:

Cloud Run services
Artifact Registry repositories
Container Registry images if any
Compute forwarding rules
reserved IP addresses
target HTTP/HTTPS proxies
URL maps
backend services
serverless NEGs
Certificate Manager certificates
Certificate Manager certificate maps
Certificate Manager DNS authorizations
Cloud DNS records related to DEV
service accounts
IAM bindings
Secret Manager secrets
WIF pools/providers
Firestore databases
Cloud Storage buckets

Return exact current resource names.

Do not rely only on old plan names.

---

# 2. Hard KEEP boundary

These resources MUST survive 2.5e:

## GCP project

bakerrang-dev

Do NOT delete the project.

## Firestore

(default) database in bakerrang-dev

This remains the explicit local-development Firestore project.

Do NOT export/import/migrate/delete its data.

DEV test data is disposable, but the database itself stays.

## Media bucket

gs://bakerrang-dev-media-marketing

This remains local-development media storage.

Do NOT delete the bucket or its contents as part of infrastructure decommission.

## Developer access

Retain only the minimum IAM needed so the developer can locally run:

API
Portal
Renderer
Client

against:

FIRESTORE_PROJECT_ID=bakerrang-dev
MEDIA_BUCKET_NAME=bakerrang-dev-media-marketing

using normal local ADC.

Determine the exact minimum developer IAM that must remain.

Do not assume deployment SAs are required for local development.

---

# 3. Cloud Run cleanup

Expected obsolete DEV services:

bakerrang-api-dev
bakerrang-portal-dev
bakerrang-site-renderer-dev

Verify exact names.

Determine whether anything still references them.

Plan deletion only after confirming:

- MAIN is live
- local development does not rely on their URLs
- no GitHub workflow still targets them automatically
- their service URLs are not baked into source/config that remains relevant

Return exact deletion commands.

---

# 4. DEV load balancer cleanup

Inventory the actual DEV LB chain that currently serves:

8.232.231.135

Expected categories:

global forwarding rules
target HTTPS proxy
possibly target HTTP proxy
URL map(s)
backend services
serverless NEGs
reserved static IP
Certificate Manager map/cert/auth
possibly HTTP redirect resources

Determine exact dependency-safe deletion order.

Do not guess resource names.

Return commands in dependency order.

The final DEV LB static IP should be released only after all forwarding rules using it are gone.

---

# 5. DEV certificate cleanup — CRITICAL

DEV currently owns the older FIXED_RECORD authorization for:

bakerrang.com

and its DNS record:

_acme-challenge.bakerrang.com

MAIN now independently owns a PER_PROJECT_RECORD authorization with the generated record:

_acme-challenge_c2uhycul3477z5xq.bakerrang.com

MAIN certificate:

bakerrang-web-cert

is ACTIVE and currently serves:

bakerrang.com
*.bakerrang.com

through the MAIN load balancer.

Audit actual DEV certificate resources.

Expected DEV resources may include:

bakerrang-dev-auth
bakerrang-dev-cert

Delete ONLY DEV certificate resources and ONLY the DEV fixed authorization DNS record.

DO NOT delete or alter MAIN's:

_acme-challenge_c2uhycul3477z5xq.bakerrang.com

PER_PROJECT_RECORD CNAME.

Return an explicit before/after DNS comparison so this cannot be confused.

---

# 6. DEV public DNS cleanup

Expected obsolete DEV hostnames include:

api-dev.bakerrang.com
portal-dev.bakerrang.com
sites-dev.bakerrang.com
custom-dev.bakerrang.com

possibly related TXT verification/test records.

Read actual Cloud DNS state first.

Determine exactly which records are DEV-deployment-only and safe to delete.

Do NOT touch:

bakerrang.com
api.bakerrang.com
portal.bakerrang.com
sites.bakerrang.com
custom.bakerrang.com
MAIN Certificate Manager authorization records
unrelated BakerRang subdomains such as other applications

Return exact delete commands.

---

# 7. Artifact Registry / images

Inventory DEV deployment image storage.

Previously DEV used deployment repositories/images for:

api
portal
site-renderer

Determine exact current repositories and image contents.

Because local development does not need deployment images:

plan deletion of obsolete DEV deployment repositories/images.

Do NOT touch MAIN repository:

avian-cable-379805 / us-west1 / bakerrang

Do NOT touch Dockerfiles/source code.

Return whether repository-level deletion is simpler/cheaper than deleting individual images.

---

# 8. DEV WIF cleanup

Inventory:

Workload Identity pools
providers
GitHub principal bindings
deployment service accounts

Previously expected:

pool:
github

provider:
bakerrang-dev

DEV deployer:
bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com

Verify actual state.

Because DEV deployment becomes local-only:

plan removal of DEV GitHub WIF/provider/pool bindings and deployment identity.

Determine whether the whole `github` pool is dedicated solely to this deployment.

If other providers/resources exist in that pool, do NOT delete the whole pool.

Return exact safe commands.

---

# 9. DEV runtime service accounts

Inventory DEV service accounts.

Previously expected:

bakerrang-api-dev@
bakerrang-frontend-dev@
bakerrang-github-dev-deployer@

Determine whether:

bakerrang-api-dev@
bakerrang-frontend-dev@

are needed in any way for local development.

Local ADC should normally use the developer identity, not Cloud Run runtime SAs.

If they are deployment/runtime-only, plan deletion.

Before recommending deletion, inspect:

project IAM
bucket IAM
secret IAM
Firestore IAM
service references

Remove stale IAM bindings where appropriate.

Do NOT accidentally remove developer access to Firestore/media.

---

# 10. Secret Manager

Inventory DEV secrets.

Distinguish:

A. deployment/runtime-only secrets that become unnecessary once no DEV Cloud Run service exists

B. secrets that local development actually consumes

C. secrets that should remain for another application or reason

Do not assume every DEV secret can be deleted.

For each secret, identify source usage before recommending deletion.

Pay special attention to:

OAuth
SESSION_SECRET
CSRF_SECRET
preview token
third-party API keys

If local `.env`/developer credentials replace them, say so explicitly.

Do NOT expose secret values.

---

# 11. APIs

Audit APIs enabled only because of the old deployed DEV infrastructure.

Possible examples:

Compute Engine API
Certificate Manager
IAM Credentials
Security Token Service
Artifact Registry
Cloud Run

Determine whether disabling any APIs is worth doing.

Be conservative.

Firestore and Storage APIs must remain usable.

If API disabling provides no meaningful cost/safety benefit, recommend leaving them enabled rather than adding unnecessary cleanup risk.

---

# 12. GitHub Environment

Current deployment state:

MAIN:
production Environment

DEV:
development Environment remains only for manual DEV deployment during decommission.

After GCP DEV deployment resources are gone, determine whether GitHub Environment:

development

should be deleted.

Inventory conceptually what it contains:

DEV project/region
WIF provider
deployer SA
service names
URLs
build vars

None should be needed for local development.

Recommend exact timing:

only after repository DEV workflow is removed/disabled and GCP deployment stack is gone.

This may require a manual GitHub UI action.

Return exact human steps.

---

# 13. Repository cleanup

Audit current repository for DEV deployment-specific assets.

Expected candidates:

.github/workflows/deploy-dev.yml
.github/workflows/verify-gcp-auth-dev.yml if still present
scripts/deploy-dev.ps1
DEV deployment documentation/config

Distinguish:

REMOVE:
obsolete cloud deployment automation

KEEP/UPDATE:
local development documentation
DEV Firestore/media config examples
useful historical/recovery runbooks

We want future humans/AI to understand:

- DEV used to be deployed
- it was deliberately retired
- bakerrang-dev remains local-data backing only
- MAIN is the sole deployed environment

Do not erase useful infrastructure history.

---

# 14. Local development contract after cleanup

Verify the final documented local contract.

API local environment should include at least:

FIRESTORE_PROJECT_ID=bakerrang-dev
MEDIA_BUCKET_NAME=bakerrang-dev-media-marketing

plus appropriate local app secrets/config.

Client:

VITE_API_BASE_URL=http://localhost:8080

Renderer:

SITE_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_SITE_API_BASE_URL=http://localhost:8080
SITE_PUBLIC_ORIGIN=<local renderer origin>
SITE_PUBLIC_INDEXING_ENABLED=false

Portal should use the local API endpoint/config appropriate to current source.

Developer uses ADC.

No WIF.
No load balancer.
No Cloud Run.

Verify actual source/examples and identify any documentation mismatch.

---

# 15. Local custom-domain testing after DEV LB removal

The DEV public host:

custom-dev.bakerrang.com

will disappear.

Confirm local custom-domain testing still works with a fake dotted hostname such as:

acme.local

or another hostname accepted by current normalization logic.

Required concept:

Host: acme.local
→ local Renderer
→ DEV Firestore siteDomains lookup

Document:

curl Host-header method

and/or:

Windows hosts file method

No public DNS/TLS required.

Ensure hostname validation accepts the recommended test hostname.

---

# 16. Dependency-safe decommission order

Design an exact sequence.

Prefer something like:

Phase A — final read-only captures
Phase B — disable/remove repo/GitHub DEV deployment entrypoints
Phase C — delete DEV Cloud Run
Phase D — delete DEV LB/cert/DNS
Phase E — delete DEV deployment images
Phase F — delete WIF/deployer/runtime SAs
Phase G — delete unnecessary secrets
Phase H — GitHub Environment cleanup
Phase I — final retained-resource verification

But refine based on actual dependencies.

Important:

Once a destructive phase begins, provide verification checks between phases.

---

# 17. Rollback philosophy

Most DEV cleanup is destructive and does not need rollback because MAIN is now live.

However, before deleting each resource family:

capture enough configuration in repository docs to reproduce it if ever necessary.

The user's standing requirement:

GCP/gcloud bootstrap commands, GitHub Environment/WIF setup, IAM grants, and infrastructure history must remain documented in-repo for future humans and AI agents.

Determine what must be documented BEFORE deletion.

---

# 18. Cost impact

Identify which removed resources actually reduce recurring cost.

Especially:

DEV external Application Load Balancer
reserved/in-use static IP
Cloud Run minimum instances if any
Artifact Registry storage
Certificate Manager resources if billable
unused secrets/storage

Firestore and DEV media bucket remain.

Estimate which cleanup gives the largest savings.

Do not claim savings for resources that are effectively free when idle.

---

# 19. MAIN safety boundary

2.5e must not modify MAIN resources.

Explicitly list resources/prefixes/project IDs that commands must NEVER target.

MAIN:

avian-cable-379805

MAIN LB IP:

34.8.236.85

MAIN Certificate Manager:

bakerrang-main-auth
bakerrang-web-cert
bakerrang-web-cert-map

MAIN public DNS:

bakerrang.com
api.bakerrang.com
portal.bakerrang.com
sites.bakerrang.com
custom.bakerrang.com

MAIN runtime services:

bakerrang-api
bakerrang-client
bakerrang-portal
bakerrang-site-renderer

Do not touch them.

---

# 20. Final retained-state verification

After decommission, expected DEV state should be approximately:

project:
bakerrang-dev

Firestore:
(default) exists

bucket:
gs://bakerrang-dev-media-marketing exists

developer:
can read/write DEV Firestore
can read/write DEV media bucket via ADC as required

Cloud Run:
no BakerRang DEV deployment services

Compute LB:
no BakerRang DEV forwarding/proxy/urlmap/backend/NEG/static-IP stack

Certificate Manager:
no DEV BakerRang deployment certificate/auth/map

WIF:
no BakerRang DEV GitHub deployment trust

Artifact Registry:
no obsolete BakerRang DEV deployment image repository

public DEV DNS:
api-dev/portal-dev/sites-dev/custom-dev removed

GitHub:
no active DEV deployment environment/workflow

Return exact verification commands for this final state.

---

# 21. Output

Return:

1. actual DEV inventory
2. KEEP list
3. DELETE list
4. UNKNOWN/needs-human-decision list
5. exact dependency-safe deletion order
6. exact gcloud/PowerShell commands
7. DEV DNS records to remove
8. certificate resources/records to remove
9. WIF/IAM/service-account cleanup
10. Secret Manager recommendation per secret
11. Artifact Registry cleanup
12. GitHub Environment cleanup
13. repository cleanup
14. local-development verification
15. local custom-domain testing verification
16. documentation changes required before deletion
17. cost impact
18. final retained-state verification commands
19. MAIN safety guardrails
20. blockers
21. whether 2.5e is ready to execute
22. safest first destructive action

No mutations.
No deletions.
No implementation.