# Polyglot Phase D deployment runbook

This runbook provisions and accepts the extracted Polyglot app. The implementation task does not run these commands. Logical service: `web-polyglot`; Cloud Run service: `bakerrang-web-polyglot`; public host: `https://polyglot.bakerrang.com`.

## Prerequisites

- GitHub `production` Environment variables:
  - `WEB_POLYGLOT_SERVICE=bakerrang-web-polyglot`
  - `POLYGLOT_BASE_URL=https://polyglot.bakerrang.com`
- Existing WIF deployer and Artifact Registry configuration used by Launcher and Story Book.
- Existing frontend runtime service account: `bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com`.
- API runtime configuration adds `POLYGLOT_DOMAIN=https://polyglot.bakerrang.com`; preserve every existing origin and OAuth target.

## Bootstrap the Cloud Run service

Create the service with the established immutable-image and runtime-identity policy. Grant the deployer only the existing scoped `roles/run.developer` access for `bakerrang-web-polyglot` and service-account-user access to the frontend runtime identity. Do not grant project-wide Cloud Run admin.

The shared `web/Dockerfile` build contract is:

```text
APP=polyglot
VITE_API_BASE_URL=https://api.bakerrang.com
VITE_OAUTH_TARGET=polyglot
```

The reusable deploy workflow builds `web-polyglot`, verifies the immutable digest and unchanged runtime service account, then smokes the SPA shell. Do not deploy from a workstation as part of normal operation.

## Domain mapping and DNS

Use the Cloud Run beta command form known to work for this project, including the region:

```powershell
gcloud beta run domain-mappings create --service bakerrang-web-polyglot --domain polyglot.bakerrang.com --region us-west1 --project avian-cable-379805
```

Apply only the DNS records returned for `polyglot.bakerrang.com`. Do not change the apex, Launcher, Story Book, API, portal, or renderer mappings.

## Legacy Cloud Run request-log exclusion

Application access logs redact every query value and mask speech tokens. Cloud Run platform request logs cannot be rewritten by the app, and the legacy apex clients still place sensitive content in `prompt` query values on these routes:

- `/chat/gpt/translate` — Polyglot utterances
- `/text/to/speech/v1/convert/*` — translated or narration text
- `/chat/gpt/prompt/story` — Story Book ideas
- `/chat/gpt/image/prompt` — Story Book page text/picture prompts

Before live acceptance, add a `_Default` sink exclusion with this narrow filter:

```text
resource.type="cloud_run_revision"
AND resource.labels.service_name="bakerrang-api"
AND httpRequest.requestUrl=~"[?&]prompt="
```

This preserves normal request visibility while dropping only API request logs whose URL contains a `prompt` parameter. Exclusions affect future logs only; they do not remove historical entries. Confirm the filter matches all four legacy route families above before enabling it.

## Acceptance and cutover

1. Deploy the additive API changes, including `POLYGLOT_DOMAIN`.
2. Deploy `web-polyglot` and open its direct Cloud Run URL, then `https://polyglot.bakerrang.com`.
3. Complete the Phase D live acceptance matrix in `PhaseD-Polyglot.md`, including iOS Safari, Android Chrome, microphone teardown, no-voice behavior, and log inspection.
4. Confirm provider retention settings for Deepgram, OpenAI API, and ElevenLabs are appropriate.
5. Only after acceptance, make the separate one-line registry flip setting Polyglot `liveUrl` to `https://polyglot.bakerrang.com` and redeploy Launcher, Story Book, and Polyglot.

Until step 5, `liveUrl` stays `null` and the shared registry points to `https://bakerrang.com/polyglot/instant`. Legacy `/polyglot` and `/polyglot/instant` remain available throughout.

## Rollback and verification

- Dispatch `Rollback MAIN` with `service=web-polyglot` and the approved immutable SHA or revision.
- `scripts/verify-live.ps1` and `.github/workflows/verify-live.yml` include the Polyglot SPA-shell check.
- Reverting the later registry flip returns product navigation to the legacy Instant route without changing the apex routes.
