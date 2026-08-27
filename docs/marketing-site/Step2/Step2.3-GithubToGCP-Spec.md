# Planning Task — Step 2.3: GitHub → GCP Workload Identity Federation (DEV)

Do NOT make changes.

We are continuing BakerRang Step 2.

Completed:

```text
2.1 CI/CD architecture + monorepo dependency graph
2.2 PR CI + centralized change detection
2.2a backend lint baseline cleanup
```

The branch model is now locked:

```text
main        -> DEV truth
production  -> future PROD truth
```

PR CI is live and verified.

The next task is:

# 2.3 — GitHub → GCP Workload Identity Federation (DEV)

Goal:

```text
GitHub Actions running from main
        ↓
GitHub OIDC token
        ↓
Google Workload Identity Federation
        ↓
dedicated DEV deployer service account
        ↓
read-only authentication proof

NO application deployment yet
```

Step 2.4 will perform automatic Cloud Run deployments.

---

# 1. Current DEV Environment

Google Cloud project:

```text
bakerrang-dev
```

Region:

```text
us-west1
```

Current DEV Cloud Run services:

```text
bakerrang-api-dev
bakerrang-portal-dev
bakerrang-site-renderer-dev
```

Stable URLs:

```text
https://api-dev.bakerrang.com
https://portal-dev.bakerrang.com
https://sites-dev.bakerrang.com
```

Existing API runtime SA:

```text
bakerrang-api-dev@bakerrang-dev.iam.gserviceaccount.com
```

Frontend runtime services have their existing runtime identities.

Do NOT modify those runtime identities.

---

# 2. GitHub Repository Identity

Inspect the actual repository Git remote.

Determine exact:

```text
GitHub owner
GitHub repository name
full owner/repo identity
```

Do not assume from the local project name.

This identity becomes a security boundary in WIF.

---

# 3. Authentication Architecture

Plan GitHub authentication using:

```text
GitHub OIDC
Google Workload Identity Federation
dedicated deployer service account
```

Do NOT use:

```text
service-account JSON keys
GitHub-stored Google credential files
long-lived GCP secrets
```

Expected service account conceptually:

```text
bakerrang-github-dev-deployer
```

in:

```text
bakerrang-dev
```

Validate the name against GCP naming constraints.

---

# 4. Service Account vs Direct WIF

Google's current auth Action supports:

```text
Direct WIF
WIF through service-account impersonation
```

Step 2.1 recommended a dedicated deployer service account.

Re-evaluate this briefly against the actual requirements of:

```text
Artifact Registry push
Cloud Run service update
runtime service-account impersonation / actAs
```

Return a firm recommendation.

My current preference remains:

```text
WIF -> dedicated DEV deployer SA
```

because it gives us a clearly scoped Google principal and clean DEV/PROD separation.

Do not change this without a concrete reason.

---

# 5. DEV Workload Identity Resources

Design exact resource names for:

```text
Workload Identity Pool
Workload Identity Provider
DEV deployer service account
```

Prefer short, explicit names.

For example conceptually:

```text
github
bakerrang-github
bakerrang-github-dev-deployer
```

but inspect existing IAM/WIF resources before choosing names to avoid collisions.

---

# 6. Existing Resource Discovery

Before proposing create commands, inspect with read-only gcloud commands whether the following already exist:

```text
Workload Identity Pools
GitHub providers
service account named/similar to deployer
relevant IAM bindings
Artifact Registry repository
Cloud Run runtime service accounts
```

Do not assume the project is empty.

The plan must be idempotent-aware:

```text
if absent -> create
if already correct -> reuse
if conflicting -> stop and report
```

---

# 7. APIs

Determine which Google APIs must be enabled for WIF / IAM / later deployment.

Likely areas include:

```text
IAM
IAM Credentials
STS
Artifact Registry
Cloud Run
```

Inspect actual project state.

Do not blindly enable unrelated APIs.

Return exact APIs required and whether each is already enabled.

---

# 8. Attribute Mapping

Design the provider attribute mapping.

At minimum consider:

```text
google.subject
attribute.repository
attribute.repository_owner
attribute.ref
attribute.environment
```

Use actual GitHub OIDC claims.

Do not map unnecessary claims.

---

# 9. Provider Attribute Condition

GitHub uses a multi-tenant OIDC issuer, so the provider MUST have an attribute condition restricting trusted GitHub identity.

DEV must be limited to the BakerRang repository.

Strongly consider:

```text
assertion.repository_owner == '<actual owner>'
&& assertion.repository == '<actual owner>/<actual repo>'
```

and because this is a DEV-only provider:

```text
&& assertion.ref == 'refs/heads/main'
```

Evaluate whether branch should live in:

```text
provider attribute condition
IAM principalSet binding
GitHub Environment protection
```

or a layered combination.

Prefer defense in depth without needless complexity.

---

# 10. GitHub Environment

Step 2.1 recommended:

```text
development
production
```

GitHub Environments.

For Step 2.3, evaluate creating:

```text
development
```

with no required reviewer.

Future DEV deploy workflows will use:

```yaml
environment: development
```

Potential Environment variables later include:

```text
GCP_PROJECT_ID
GCP_REGION
WIF_PROVIDER
GCP_DEPLOYER_SERVICE_ACCOUNT
Artifact Registry repository
Cloud Run service names
public build URLs
```

Do NOT add production configuration yet.

Determine what variables should be created now versus Step 2.4.

---

# 11. GitHub Secrets

Desired result:

```text
ZERO Google credential secrets
```

Confirm no GitHub Secret is needed for WIF.

The following are not secret:

```text
WIF provider resource name
project id
service-account email
region
```

Recommend GitHub Environment variables rather than Secrets for those.

---

# 12. Deployer IAM — Step 2.3 vs Step 2.4

Important scope distinction:

Step 2.3 only needs to prove authentication.

Step 2.4 will need deploy permissions such as:

```text
Artifact Registry writer
Cloud Run developer
serviceAccountUser on runtime identities
```

Determine whether we should:

### Option A

Create the DEV deployer SA now but grant only enough IAM for a harmless read-only auth proof.

Then add deployment roles in Step 2.4.

### Option B

Create the final Step 2.4 deploy IAM now even though no deployment occurs yet.

Prefer least privilege and staged rollout unless splitting the IAM creates needless work.

Recommend one.

---

# 13. WIF Service Account Binding

Plan the required:

```text
roles/iam.workloadIdentityUser
```

binding allowing the trusted GitHub principal to impersonate:

```text
bakerrang-github-dev-deployer
```

Use an appropriately narrow principal/principalSet.

Do not allow the entire Workload Identity Pool to impersonate the service account.

---

# 14. Runtime Service Account Boundary

The deployer SA must remain separate from Cloud Run runtime identities.

Conceptually:

```text
GitHub
  ↓
DEV deployer SA
  ↓ deploys
Cloud Run service
  ↓ runs as
runtime SA
```

Do not merge these identities.

Document why.

---

# 15. Future `serviceAccountUser`

Step 2.4 may require:

```text
roles/iam.serviceAccountUser
```

on Cloud Run runtime service accounts so the deployer can update services without changing their identity.

Inspect actual Cloud Run services to identify which runtime SAs they use.

Do NOT grant broad project-level `serviceAccountUser` if resource-level bindings suffice.

Return the exact future binding plan.

---

# 16. Artifact Registry Discovery

Read the current images for the three DEV Cloud Run services.

Determine exact:

```text
Artifact Registry host
repository name
image paths
```

Step 2.1 couldn't determine the repository name from source.

Resolve it now.

Do NOT mutate Artifact Registry.

Report whether all three services currently share one repository.

---

# 17. GitHub Action Version

Current CI was upgraded successfully to Node-24-compatible actions.

For the auth proof, use current compatible official Actions.

Expected:

```text
actions/checkout@v7
google-github-actions/auth@v3
google-github-actions/setup-gcloud
```

Verify current supported major versions before implementation.

Do not use deprecated Node-20 actions.

---

# 18. Auth Verification Workflow

Design a minimal workflow for proving WIF.

Potential file:

```text
.github/workflows/verify-gcp-auth-dev.yml
```

or another clean name.

It should:

```text
workflow_dispatch
main only
environment: development
permissions:
    contents: read
    id-token: write
```

Then:

```text
checkout
auth via WIF
setup gcloud
run harmless read-only checks
```

Possible checks:

```text
gcloud auth list
gcloud config get-value project
gcloud run services describe ...
```

Do NOT expose access tokens.

Do NOT deploy.

---

# 19. Main-Only Enforcement

The DEV WIF trust must reject:

```text
feature branches
pull_request refs
production
forks
other repos
other GitHub owners
```

even if someone copies the workflow.

Design how that is enforced at Google, not merely by a GitHub YAML `if:`.

The Google trust boundary is authoritative.

---

# 20. `workflow_dispatch`

If the verification workflow is manually dispatchable, explain GitHub's ref behavior.

Ensure:

```text
dispatch from main -> allowed
dispatch from another branch -> Google WIF rejected
```

Ideally also fail early in workflow YAML for user clarity.

---

# 21. No Pull Request WIF

PR CI should continue to have:

```text
permissions:
  contents: read
```

and no:

```text
id-token: write
```

Do not modify existing `.github/workflows/ci.yml` to authenticate to Google.

Cloud credentials must never be available to ordinary PR CI.

---

# 22. Credential File Handling

`google-github-actions/auth` may generate a temporary credential file.

Inspect recommended current behavior.

Ensure:

```text
gha-creds-*.json
```

cannot accidentally enter Docker contexts or Git.

Check existing:

```text
.gitignore
server/.dockerignore
platform/.dockerignore
```

and recommend the minimum ignore changes if needed.

Do NOT confuse this temporary federated credential file with a long-lived service-account key.

---

# 23. Token Lifetime

GitHub OIDC and derived WIF credentials are intentionally short-lived.

Confirm whether token lifetime is sufficient for:

```text
future Docker build/push
Cloud Run update
```

and whether re-auth should occur near the deployment portion in Step 2.4.

No premature optimization required.

---

# 24. IAM Least Privilege

Do NOT grant:

```text
Owner
Editor
Service Account Admin
Secret Manager Admin
Project IAM Admin
```

to the deployer.

Step 2.3 should use the smallest role set possible.

Separate:

```text
bootstrap permissions used by the human/operator
```

from:

```text
permissions held by GitHub deployer
```

The human gcloud account can create IAM resources; GitHub does not need administrative IAM privileges.

---

# 25. Bootstrap Identity

Determine which current local Google identity/project context should execute the setup commands.

Plan explicit verification before commands:

```text
gcloud auth list
gcloud config get-value account
gcloud config get-value project
```

Require confirmation that commands target:

```text
bakerrang-dev
```

before mutation.

Avoid reliance on whatever project happens to be active.

Every mutation command should include:

```text
--project bakerrang-dev
```

where supported.

---

# 26. Idempotent/Recoverable Commands

Provide future implementation commands in small logical sections:

```text
discover
create service account
create pool
create provider
bind GitHub principal
configure GitHub Environment
verify
```

For destructive/conflicting cases, stop rather than automatically replacing resources.

Do not include delete/recreate as the default recovery mechanism.

---

# 27. Propagation Delay

WIF and IAM changes may take several minutes to propagate.

Include this in verification expectations so an immediate first auth failure is not misdiagnosed.

Do not build arbitrary long sleeps into infrastructure commands.

---

# 28. GitHub Environment Configuration Method

Evaluate whether GitHub Environment + variables should be created:

```text
manually in GitHub UI
gh CLI
GitHub API
```

for this project.

The user is the primary operator.

Prefer a clear reproducible method, but do not require another automation layer just for a handful of variables.

If `gh` CLI provides a clean path, show it as an option.

---

# 29. Branch Protection

The live `ci-passed` check is now verified.

Recommend that `main` be protected with:

```text
Require pull request
Require ci-passed
```

No second reviewer required currently.

Determine whether this should be performed before or after WIF setup.

Production protection waits until `production` exists.

---

# 30. Step 2.3 Must NOT Deploy

Absolutely no:

```text
docker build/push
Artifact Registry write
Cloud Run update
traffic change
runtime env mutation
Secret Manager mutation
Terraform
production resource
```

Authentication proof only.

---

# 31. Security Review

Explicitly evaluate these attack cases:

```text
fork PR attempts WIF
feature branch copies auth workflow
different GitHub repo under same owner
different owner creates repo with same name
workflow_dispatch on non-main
compromised DEV deployer
```

For each, explain why trust succeeds or fails.

---

# 32. Files Expected in Later Implementation

Likely:

```text
.github/workflows/verify-gcp-auth-dev.yml
.gitignore / dockerignore only if gha credential exclusion is missing
docs/CI-CD.md maybe tiny Step 2.3 note, not full doc
```

Most Step 2.3 work is external resource configuration rather than application code.

Do not modify product code.

---

# 33. Verification

Design the final verification result.

Success means a GitHub Actions run on `main` can say, without credentials stored in GitHub:

```text
Authenticated as:
bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com

Project:
bakerrang-dev
```

and successfully perform one harmless read-only Google Cloud command.

No deployment.

---

# 34. Output

Return:

1. Executive Step 2.3 recommendation
2. Actual GitHub owner/repo identity
3. Existing WIF/IAM resource discovery
4. Existing Artifact Registry identity
5. Existing Cloud Run runtime service accounts
6. Service-account vs direct-WIF decision
7. Exact WIF resource names
8. Required APIs
9. Attribute mapping
10. Attribute condition
11. PrincipalSet/service-account binding strategy
12. DEV deployer IAM plan
13. Roles granted now vs deferred to 2.4
14. GitHub `development` Environment recommendation
15. GitHub variables/secrets inventory
16. Credential-file ignore audit
17. Auth verification workflow design
18. Exact future gcloud bootstrap commands
19. Exact future GitHub configuration steps
20. Propagation/retry expectations
21. Main branch-protection recommendation
22. Security attack-case analysis
23. Files future implementation will create/modify
24. Human actions required
25. Tests/verifications
26. Definition of done for Step 2.3
27. Safe to proceed to Step 2.4 criteria

Do NOT modify anything.