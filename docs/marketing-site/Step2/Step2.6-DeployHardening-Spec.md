# Step 2.6 Planning — Release / Rollback / Verification Hardening

Planning/read-only only.

Do NOT modify files.
Do NOT deploy.
Do NOT modify GCP.
Do NOT modify DNS.
Do NOT modify GitHub settings.
Do NOT delete revisions/images.

Steps 2.5a–2.5e are COMPLETE.

The environment consolidation is finished.

---

# Current steady state

## LOCAL

Local API / Portal / Renderer / Client

Data backing:

FIRESTORE_PROJECT_ID=bakerrang-dev
MEDIA_BUCKET_NAME=bakerrang-dev-media-marketing

Developer uses ADC.

There is:

- no deployed DEV Cloud Run stack
- no DEV load balancer
- no DEV WIF
- no DEV deployment workflow
- no GitHub development Environment

---

## LIVE

Project:

avian-cable-379805

Region:

us-west1

Public ingress:

one global external Application Load Balancer

IPv4:

34.8.236.85

Public hosts:

bakerrang.com
api.bakerrang.com
portal.bakerrang.com
sites.bakerrang.com

Controlled custom-domain test:

custom.bakerrang.com

Services:

bakerrang-api
bakerrang-client
bakerrang-portal
bakerrang-site-renderer

Runtime SAs:

API:
bakerrang-api@avian-cable-379805.iam.gserviceaccount.com

Client / Portal / Renderer:
bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com

---

# Current CI/CD

PR:

pull_request → main
→ credential-free CI

MAIN:

push main
→ authoritative classifier
→ selective validation
→ selective automatic live deployment

Manual MAIN:

workflow_dispatch
→ exactly one service
→ main only

Reusable deployment:

.github/workflows/_deploy-cloud-run.yml

Properties already proven:

- WIF
- immutable `git-${GITHUB_SHA}` tags
- tag reuse by exact SHA
- digest deployment
- image-only Cloud Run update
- runtime-SA unchanged assertion
- per-service concurrency
- stale deployment guard
- deployment smoke using Cloud Run `status.url`

Public ingress verification is currently manual and separate.

---

# Goal of Step 2.6

Make releases, failures, verification, and rollback operationally predictable.

Do NOT redesign CI/CD.

Do NOT introduce:

- release branches
- production branches
- a second deployed environment
- Kubernetes
- Terraform
- GitOps platforms
- release-management SaaS
- heavyweight approval gates
- semantic-version releases unless actually justified
- automatic rollback based on fragile heuristics

Prefer small scripts/workflows/runbooks using the infrastructure already present.

---

# 1. Audit existing rollback capability

Inspect actual current:

.github/workflows/deploy.yml
.github/workflows/_deploy-cloud-run.yml
scripts/ci/**
docs/CI-CD.md
docs/infra/live-environment-bootstrap.md

Also inspect Cloud Run deployment/image naming assumptions.

Determine what rollback capability already exists implicitly through:

- Cloud Run revisions
- immutable Artifact Registry `git-<sha>` images
- manual single-service deployment

Identify gaps between:

"technically possible to rollback"

and

"safe/operator-friendly rollback"

---

# 2. Define the rollback model

Recommend the simplest canonical rollback mechanism.

Evaluate these options:

A. Cloud Run revision traffic rollback

B. redeploy a previous immutable `git-<sha>` Artifact Registry image

C. git revert + normal deployment

D. some combination

For each, explain:

- speed
- safety
- whether config is also rolled back
- whether source history matches runtime
- whether it works after old revisions are pruned
- whether it can accidentally change runtime SA/config

Choose one PRIMARY rollback mechanism and one SECONDARY fallback.

Important:

Normal deployments are image-only and intentionally preserve current Cloud Run runtime config.

That invariant should not be casually broken.

---

# 3. Per-service rollback

We need rollback independently for:

api
portal
renderer
client

Design an operator-friendly manual workflow or script.

Possible shape:

workflow_dispatch:
service:
api|portal|renderer|client
target:
git SHA / revision

But do not assume that is best.

Determine whether rollback should accept:

- git SHA
- image digest
- Cloud Run revision name

Prefer the least error-prone operator input.

The rollback path must:

- be main-operator initiated
- never affect another service
- preserve runtime SA
- preferably preserve runtime env/secrets
- produce an auditable GitHub Actions run if practical
- validate that the target belongs to the expected service
- fail closed if the target does not exist

Do not implement yet.

---

# 4. Rollback safety checks

Design deterministic checks such as:

Before rollback:

- capture current revision
- capture current image digest
- capture runtime SA
- resolve target image/revision
- verify target service/repository
- refuse `latest`
- refuse cross-service image
- refuse malformed SHA
- verify target exists

After rollback:

- new/selected revision Ready
- expected image digest
- runtime SA unchanged
- Cloud Run `status.url` smoke
- public-host smoke separately

Determine what belongs in automation versus runbook.

---

# 5. Configuration rollback semantics

This is especially important for API.

Current normal deployment changes image only.

Cloud Run revision rollback can also restore historical:

- env vars
- secret mappings
- service account
- other revision template settings

That may be desirable during an emergency, but it may also revert valid configuration changes.

Analyze this carefully.

Recommend when to use:

revision rollback

versus

old-image-on-current-config rollback

For example:

bad code, current config good
→ old image + current config may be preferable

bad configuration + code
→ historical revision traffic rollback may be preferable

Turn this into a simple operator decision tree.

---

# 6. Public ingress verification workflow

Design a separate lightweight workflow, not part of image deployment success.

Suggested endpoints:

API:
https://api.bakerrang.com/health

Portal:
https://portal.bakerrang.com/

Renderer:
https://sites.bakerrang.com/robots.txt

Client:
https://bakerrang.com/

Custom-domain architecture:
https://custom.bakerrang.com/

Determine whether custom should be part of every check or only manual/deeper verification.

Checks should be stable and inexpensive.

Examples:

API:
HTTP 200 + Healthy

Portal:
HTTP 200 + stable app-shell marker if available

Renderer:
HTTP 200 + User-agent

Client:
HTTP 200 + <div id="root"

Custom:
HTTP 200 / expected canonical behavior

Do not use fragile business content.

---

# 7. Trigger model for public verification

Evaluate:

- after automatic deployment
- manual workflow_dispatch
- scheduled
- all three

Important:

Do NOT make public ingress failure retroactively mark a successful Cloud Run image deployment as failed.

Deployment health and public ingress health remain separate signals.

Recommend a simple model.

Possibly:

push/deploy completes
→ separate public verification job/workflow

plus:

workflow_dispatch

and perhaps:
daily scheduled verification

But only add schedule if it is useful rather than ceremony.

---

# 8. Alerting / notification scope

We are a single-operator project.

Do not add PagerDuty/Datadog/etc.

Determine whether GitHub Action failure visibility is sufficient.

If a scheduled public verification is recommended, explain how the operator is expected to notice failure.

Do not invent notification infrastructure unless necessary.

---

# 9. Multi-service push behavior

One main push can affect multiple services.

Analyze current behavior if:

API succeeds
Portal succeeds
Renderer fails
Client succeeds

The aggregate should be red, but successful services are already live.

Determine whether this is acceptable.

Recommend whether we need any automatic coordinated rollback.

Strong default:

NO automatic cross-service rollback unless there is a compelling correctness requirement.

Explain why.

Document how operator should respond to partial deployment.

---

# 10. Cross-service compatibility

Assess whether API / Portal / Renderer / Client require synchronized releases.

Look at actual architecture and APIs.

Determine whether:

- backend changes are expected to remain backward-compatible
- Portal/Renderer can temporarily run against old/new API during independent deployment
- any schema/version handshake exists
- any current route change could require atomic release

If there is no atomic-release mechanism, recommend engineering rules such as:

expand → deploy consumers → contract

rather than adding deployment orchestration.

Identify any current incompatibility risk.

---

# 11. Firestore changes / migrations

There is currently no formal migration framework for platform Firestore.

Analyze future release risk when data shape changes.

We have intentionally preferred read defaults/backward compatibility when practical.

Recommend a lightweight policy:

- additive fields
- read defaults
- dual-read/dual-write where necessary
- explicit one-off migration only when unavoidable
- never destructive schema change in same release as consumer code

Do not invent a migration platform unless source actually needs one now.

---

# 12. Artifact Registry retention

Inspect actual MAIN Artifact Registry:

project:
avian-cable-379805

repo:
bakerrang

Images:

api
portal
site-renderer
client

Determine current image count/storage if possible read-only.

Design a conservative cleanup policy.

Important requirements:

- never delete images still used by live Cloud Run revisions
- retain enough historical `git-<sha>` images for rollback
- immutable tags must remain meaningful
- avoid unbounded image growth

Evaluate:

keep last N per service

or:

keep images newer than N days + always keep live/rollback references

Prefer simple and safe.

Determine whether Artifact Registry cleanup policies are suitable or whether a manual cleanup runbook is safer.

---

# 13. Cloud Run revision retention

Inspect how many revisions exist today for each service.

Cloud Run already limits retained revisions, but determine whether we need any manual policy.

Avoid deleting revisions solely for tidiness if they provide useful rollback.

Recommend whether to leave Cloud Run revision management alone.

---

# 14. Known-good release identification

Determine whether we need an explicit notion of:

known good SHA

per service.

Possibilities:

- most recent successful deploy
- GitHub deployment metadata
- small documented operator command
- tag/label
- no additional system needed

Avoid introducing a database/release registry unless justified.

Design the simplest way to answer:

"What version of API is running?"
"What SHA was the previous good API?"

---

# 15. Deployment observability

Determine whether GitHub Actions + Cloud Run revision metadata is enough.

Useful operator commands should answer:

current revision
current image
runtime SA
creation timestamp

for all four services.

Design a small PowerShell verification script if that would be useful.

Possible:

scripts/verify-live.ps1

It must be read-only.

Could output:

API      revision   image SHA/digest   SA
Portal   ...
Renderer ...
Client   ...

plus public health.

Evaluate whether this is worth adding.

---

# 16. Release/runbook documentation

Create a recommended documentation structure.

Possibly:

docs/operations/release.md
docs/operations/rollback.md
docs/operations/live-verification.md

or fewer files if one concise runbook is sufficient.

User preference:
pragmatic, not documentation-heavy.

The runbook should answer:

- what happens when main is merged
- how to see what deployed
- how to verify live
- how to rollback one service
- how to recover from partial deployment
- how to handle bad config versus bad code
- how to identify current/previous image
- when NOT to rollback

---

# 17. GitHub workflow design

If new workflows are recommended, give exact proposed responsibilities.

Possible:

verify-live.yml
rollback.yml

Keep deployment logic centralized.

Do NOT duplicate `_deploy-cloud-run.yml` unnecessarily.

If rollback requires separate reusable logic, justify it.

Security requirements:

- read-only verification workflow should have no OIDC if it only performs public HTTP checks
- rollback workflow may need OIDC
- rollback must be main/operator controlled
- no PR code should gain cloud credentials
- no arbitrary image string should be deployable without validation

---

# 18. Branch protection / required checks

Audit current relevant branch-check model from repo docs/workflows.

Determine which checks should be required for PR merge.

Likely:

ci-passed

Do NOT require deployment jobs on PRs.

Determine whether `live-deploy-passed` should be a branch protection requirement.

Remember:
it runs after main push, not before merge.

Probably not useful as a PR required check.

Explain.

---

# 19. Automatic deployment failure behavior

If automatic MAIN deploy fails after a merge:

- source main has advanced
- live service may remain on prior revision
- aggregate is red

Document what operator should do.

Evaluate:

retry workflow
manual deploy same SHA
fix-forward
rollback

Create a clear decision tree.

---

# 20. Stale deployment behavior

Current stale-deploy guard intentionally skips old same-service deployments if newer relevant main commit exists.

Explain how this interacts with:

- retries
- rollback
- manual deploy
- rapid main pushes

A manual emergency rollback must not be accidentally rejected by a stale-forward-deploy rule if it intentionally targets an older version.

If a rollback workflow is recommended, it may need different stale semantics from normal deployment.

Analyze explicitly.

---

# 21. Security

Audit proposed operational workflows for:

- OIDC scope
- GitHub Environment usage
- arbitrary input injection
- shell quoting
- cross-service image injection
- accidental runtime-config mutation
- secret exposure
- public verification SSRF-like arbitrary URL input

Prefer fixed enums and internally-derived URLs.

No user-supplied arbitrary URLs or image repositories.

---

# 22. Cost

Estimate ongoing cost of any proposed additions.

A public verification workflow should be effectively free.

Artifact cleanup should reduce storage slowly.

Do not introduce paid monitoring.

---

# 23. Scope boundary

2.6 SHOULD include only operational hardening.

It should NOT include:

- new product features
- tenant features
- custom-domain automation
- new environments
- infrastructure redesign
- OAuth redesign
- dependency/security audit remediation unless directly required
- Firestore migration tooling unless an actual current need exists

Keep it small.

---

# 24. Recommended implementation split

Propose substeps.

Likely something like:

2.6a — Rollback design + tooling
2.6b — Public verification workflow
2.6c — Retention + operational docs

But choose based on actual repo/state.

Each substep should be independently useful and verifiable.

---

# 25. Output

Return:

1. current rollback capabilities
2. gaps
3. canonical rollback strategy
4. bad-code vs bad-config rollback decision tree
5. proposed rollback workflow/script
6. public verification design
7. trigger/schedule recommendation
8. partial multi-service failure policy
9. cross-service compatibility policy
10. Firestore evolution policy
11. Artifact Registry retention recommendation
12. Cloud Run revision retention recommendation
13. known-good release identification
14. proposed read-only live verification tooling
15. documentation structure
16. GitHub workflow/security design
17. branch protection recommendation
18. automatic deployment failure decision tree
19. stale-guard interaction with rollback
20. cost impact
21. exact recommended 2.6 substeps
22. files likely to change
23. blockers
24. whether 2.6 is ready to implement

No implementation.
No deployment.
No mutation.