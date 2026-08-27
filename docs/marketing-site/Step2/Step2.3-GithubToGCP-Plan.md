# Implement Step 2.3 Repo Changes — DEV WIF Authentication Proof

Implement ONLY the repository-side portion of Step 2.3.

Do NOT create or modify Google Cloud resources.
Do NOT modify GitHub Environment/settings through an API.
Do NOT deploy anything.

The human operator will perform the GCP/GitHub configuration after this repo change lands.

Create:

.github/workflows/verify-gcp-auth-dev.yml

Modify only as needed:

.gitignore
server/.dockerignore
platform/.dockerignore

No product code.

---

## 1. Architecture

Authentication will be:

GitHub Actions on main
-> GitHub OIDC
-> DEV-local Google Workload Identity Pool/provider
-> dedicated DEV deployer SA

Service account:

bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com

Project:

bakerrang-dev

Region:

us-west1

The DEV Workload Identity Pool will be local to bakerrang-dev.

Do NOT document or design it as a shared DEV/PROD pool.

Future PROD receives its own WIF pool/provider in bakerrang-prod.

---

## 2. Trust uses immutable GitHub IDs

The final Google provider will map:

google.subject=assertion.sub
attribute.repository_id=assertion.repository_id
attribute.repository_owner_id=assertion.repository_owner_id
attribute.ref=assertion.ref

The Google attribute condition will ultimately require:

assertion.repository_owner_id == '<RET COR NUMERIC OWNER ID>'
&& assertion.repository_id == '<BAKERRANG NUMERIC REPOSITORY ID>'
&& assertion.ref == 'refs/heads/main'

Do not hardcode placeholder numeric IDs into the workflow because the workflow does not need them.

They belong in the Google WIF provider configuration.

The provider/binding will therefore remain secure across GitHub name changes.

---

## 3. Verification workflow

Create:

.github/workflows/verify-gcp-auth-dev.yml

Trigger:

workflow_dispatch only

No PR trigger.
No push trigger.

The workflow is an explicit one-time/reusable authentication verification tool.

Job:

environment: development

Permissions exactly:

contents: read
id-token: write

No additional write permissions.

---

## 4. Main-only UX gate

Before authentication, explicitly fail unless:

github.ref == 'refs/heads/main'

The Google provider's immutable-ID + main-ref attribute condition remains the real security boundary.

The YAML check is only for a clear error message.

---

## 5. Actions

Use current Node-24-era actions:

actions/checkout@v7
google-github-actions/auth@v3
google-github-actions/setup-gcloud@v3

Checkout MUST occur before auth because auth creates credentials in GITHUB_WORKSPACE.

Do not use deprecated Node-20 action majors.

---

## 6. Environment variables

Read these GitHub Environment variables:

GCP_PROJECT_ID
GCP_PROJECT_NUMBER
GCP_REGION
WIF_PROVIDER
GCP_DEPLOYER_SA

Expected later values:

GCP_PROJECT_ID=bakerrang-dev
GCP_PROJECT_NUMBER=1006288410962
GCP_REGION=us-west1
WIF_PROVIDER=projects/1006288410962/locations/global/workloadIdentityPools/github/providers/bakerrang-dev
GCP_DEPLOYER_SA=bakerrang-github-dev-deployer@bakerrang-dev.iam.gserviceaccount.com

They are all non-secret.

Do NOT introduce GitHub Secrets.

---

## 7. Authentication

Authenticate with:

google-github-actions/auth@v3

using:

project_id
workload_identity_provider
service_account

from Environment variables.

Do not use:

credentials_json
service account keys
long-lived Google credentials

---

## 8. Proof

After setup-gcloud, perform read-only verification.

Print the active authenticated account in a concise format, e.g.:

gcloud auth list --filter=status:ACTIVE --format="value(account)"

Print configured project:

gcloud config get-value project

Verify:

gcloud run services describe bakerrang-api-dev \
--project "${{ vars.GCP_PROJECT_ID }}" \
--region "${{ vars.GCP_REGION }}" \
--format="value(metadata.name)"

Expected result:

bakerrang-api-dev

No token contents may be printed.

No access-token generation/output.

---

## 9. No deployment

Absolutely no:

docker build
docker push
Artifact Registry mutation
gcloud run services update
gcloud run deploy
traffic mutation
env mutation
secret mutation
IAM mutation
Terraform

This workflow proves authentication only.

---

## 10. Credential-file hardening

Add:

gha-creds-*.json

to:

.gitignore
server/.dockerignore
platform/.dockerignore

Include a short explanatory comment where appropriate:

# Generated temporary credentials from google-github-actions/auth

Do not ignore arbitrary JSON files.

---

## 11. Existing CI

Do NOT modify:

.github/workflows/ci.yml

PR CI must remain:

permissions:
contents: read

and must continue to have NO id-token permission.

---

## 12. Local development

No effect on local development.

Do not modify:

.env contracts
npm scripts
runtime code
application configuration

---

## 13. Tests / static verification

Verify:

- workflow YAML parses
- workflow has only workflow_dispatch
- workflow permissions are exactly contents:read + id-token:write
- checkout occurs before auth
- no credentials_json
- no Google secrets
- no deploy/mutation commands
- no changes to ci.yml
- all three ignore files contain gha-creds-*.json
- classifier tests still pass
- full tracked-path classifier audit passes
- git diff --check passes

The classifier should classify these workflow/ignore changes according to the existing map; do not change it unless a genuine unknown-path failure exposes a missing classification.

No cloud commands.

---

## 14. Return

Return:

1. files created/modified
2. complete workflow behavior
3. permissions
4. Environment variables consumed
5. auth action versions
6. read-only proof command
7. credential-ignore changes
8. classifier result
9. YAML/static safety verification
10. git diff --check
11. confirmation ci.yml unchanged
12. confirmation no product/cloud/GitHub settings changed
13. anything blocking the human WIF bootstrap