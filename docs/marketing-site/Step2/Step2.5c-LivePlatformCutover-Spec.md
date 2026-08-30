# Step 2.5c Planning — Live Platform Bootstrap + API Cutover Preparation

Planning/read-only only.

Do NOT modify GCP.
Do NOT deploy API.
Do NOT deploy Client.
Do NOT change DNS.
Do NOT change service accounts.
Do NOT change GitHub settings.
Do NOT modify Firestore.

2.5a and 2.5b are COMPLETE.

Portal and Renderer have both been successfully deployed to MAIN through the manual production workflow and are green.

Current live project:

avian-cable-379805
region us-west1

Current live API:

bakerrang-api
runtime SA:
bakerrang-api@avian-cable-379805.iam.gserviceaccount.com

Current image is still the older GCR image.

The first deployment of the current `server/` code to `bakerrang-api` is a LIVE cutover.

---

## 1. Audit exact current API runtime state

Read the current Cloud Run configuration again and compare it to source.

Existing live env currently includes:

GOOGLE_OAUTH_CLIENT_ID
CLIENT_DOMAIN
SERVER_DOMAIN
CHATBOT_ORIGIN
CHATBOT_VOICE_ID
BLIZZARD_CLIENT_ID

and Secret Manager references for:

CHAT_GPT_API_KEY
ELEVEN_LABS_API_KEY
DEEPGRAM_API_KEY
BLIZZARD_CLIENT_SECRET
GOOGLE_OAUTH_CLIENT_SECRET
SESSION_SECRET
CSRF_SECRET

Runtime SA already has:

roles/datastore.user

It also has secretAccessor on all current BakerRang secrets plus:

bakerrang-preview-token-secret

The new media bucket exists:

gs://bakerrang-media-marketing

API SA already has:

roles/storage.objectAdmin

on that bucket.

Verify all of this against current live state.

---

## 2. Audit current server runtime validators

Read actual:

server/config/runtimeConfig.js
server/config/firestoreConfig.js
and any related config modules.

Return the complete set of variables required by the CURRENT server code when:

NODE_ENV=production

Clearly separate:

required
optional
legacy but currently used
must be absent/false in production

Do not rely on previous notes if source has changed.

---

## 3. Exact target API configuration

Build the full target live runtime contract.

Expected new additions include at least:

FIRESTORE_PROJECT_ID=avian-cable-379805
MEDIA_BUCKET_NAME=bakerrang-media-marketing
PORTAL_DOMAIN=https://portal.bakerrang.com
SITE_RENDERER_DOMAIN=https://sites.bakerrang.com
PREVIEW_TOKEN_SECRET=<Secret Manager>

Preserve existing:

GOOGLE_OAUTH_CLIENT_ID
CLIENT_DOMAIN=https://bakerrang.com
SERVER_DOMAIN=https://api.bakerrang.com
CHATBOT_ORIGIN
CHATBOT_VOICE_ID
BLIZZARD_CLIENT_ID

and all existing Secret Manager references.

Do NOT recommend replacing the entire env list blindly.

Prefer safe additive/update commands that preserve all legacy configuration.

---

## 4. Determine exact Cloud Run config command

Design the safest PowerShell/gcloud command sequence for updating the API configuration.

Important:

Changing Cloud Run env/secret configuration creates a new revision and is LIVE IMPACT.

Therefore the configuration change should be deliberately coupled to the controlled API cutover, not applied casually beforehand.

Evaluate whether we should:

A. update configuration first, creating a revision of the OLD image with the new config, verify it, then deploy the NEW image

or

B. update configuration and new image in one controlled operation

Recommend the safer option.

Account for rollback.

---

## 5. Secret wiring syntax

Return the exact required Secret Manager mappings for the new API revision.

Do NOT show secret values.

Use secret resource names only.

Ensure:

PREVIEW_TOKEN_SECRET
→ bakerrang-preview-token-secret:latest

and preserve all existing secret references.

---

## 6. OAuth / cookies / CORS

Audit the actual authentication flow.

We are introducing:

https://portal.bakerrang.com
https://sites.bakerrang.com

while existing live domains include:

https://bakerrang.com
https://api.bakerrang.com

Inspect:

CORS configuration
session-cookie options
sameSite
secure
OAuth callback behavior
post-login redirect behavior
allowed origins

Determine whether any Google OAuth console redirect/origin changes are required for the Portal.

Do not modify the OAuth client.

Return exact human action if necessary.

---

## 7. Portal functional compatibility

The deployed Portal currently points to:

https://api.bakerrang.com

Determine whether the OLD currently-live API image contains the platform endpoints required by Portal.

Identify representative requests, such as:

auth/check
tenants
site/domain APIs

If the old API lacks them, state that full Portal functionality cannot be verified until API cutover.

If it already has them, state what can be tested now.

---

## 8. Renderer functional compatibility

Renderer points to:

https://api.bakerrang.com

Determine whether the old live API exposes the public renderer endpoints required by the new Renderer.

If not, full Renderer verification waits for API cutover.

---

## 9. Live Firestore bootstrap

There is NO DEV data migration.

MAIN Firestore already has legacy production data.

Determine the exact minimum platform bootstrap.

Expected:

1. operator authenticates through live OAuth
2. existing/new `users/{id}` record exists
3. manually set:

platformRole = PLATFORM_ADMIN

Confirm exact field name/value from source.

Determine whether any other record is required before creating the first live tenant through the Portal.

Prefer normal product flows after admin bootstrap.

No seed/migration script unless actually necessary.

---

## 10. Firestore collision safety

Confirm the platform collections introduced by current code can coexist safely with existing MAIN collections.

Especially inspect:

users
tenants
siteDomains
tenantSiteDomains
audit-related collections

Identify any path/name that overlaps legacy data in a dangerous way.

We already decided NOT to import DEV data.

---

## 11. MAIN Firestore indexes

Audit current platform queries against existing:

firestore.indexes.json

Identify exactly which platform queries need composite indexes.

Do not hand-wave "Firestore will tell us."

Return:

- required now for initial Portal/Renderer use
- required later
- not required

If a new index is definitely necessary for 2.5c, recommend adding it to source rather than creating an undocumented console-only index.

---

## 12. Controlled API deployment procedure

Design the exact live verification sequence.

Expected shape:

1. capture current revision/image/env/runtime SA
2. verify rollback target
3. apply required config safely
4. manually dispatch production workflow:
   service=api
5. verify deployment digest/runtime SA
6. smoke:
   /health
7. verify legacy APIs still work
8. verify auth
9. verify Portal
10. bootstrap PLATFORM_ADMIN
11. create a temporary/first live tenant
12. verify Renderer/public-site APIs
13. verify media upload
14. verify lead capture
15. only then declare API cutover successful

Refine this based on actual source.

---

## 13. Rollback

We need a concrete rollback if the new server image breaks legacy BakerRang functionality.

Current known old image:

gcr.io/avian-cable-379805/bakerrang-api@sha256:832368b6d011e9142a6fa0e6169840a3f10dacce48ca105f2725d7203074f711

Current known revision from earlier audit:

bakerrang-api-00026-wtv

Re-read live state because those may have changed.

Return exact rollback commands.

Consider both:

revision traffic rollback

and image/config rollback

Explain which is safest.

---

## 14. Client stays untouched

Do NOT prepare Client deployment yet beyond noting dependencies.

Client remains live on its existing image and runtime SA.

Client runtime-SA migration belongs later.

---

## 15. Infrastructure docs

Because infrastructure setup must remain reproducible:

identify any documentation updates required after the API cutover.

Especially:

docs/infra/live-environment-bootstrap.md
docs/CI-CD.md

Any new gcloud config/update/rollback commands we actually use should ultimately be captured.

---

## 16. Output

Return only:

1. current live API state
2. exact current server production runtime requirements
3. exact target live API env/secret contract
4. safest configuration-update approach
5. OAuth/CORS/session findings
6. old API compatibility with Portal
7. old API compatibility with Renderer
8. minimal live Firestore bootstrap
9. Firestore collision assessment
10. index requirements
11. exact controlled API cutover sequence
12. rollback procedure
13. human actions required
14. documentation updates required
15. blockers before API deployment
16. whether 2.5c API cutover is ready to execute

No implementation.
No deployment.
No mutations.