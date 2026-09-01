# MAIN/live operations guide

This is the steady-state operator guide for BakerRang. MAIN/live is the only
deployed environment. For detailed emergency procedures, use the
[MAIN rollback runbook](rollback.md).

## Architecture at a glance

Local development runs the API, Portal, Site Renderer, and Client on the
developer machine. Those processes use developer Application Default
Credentials (ADC), Firestore in `bakerrang-dev`, and the
`bakerrang-dev-media-marketing` bucket. There is no deployed DEV environment.

MAIN/live runs the same four services in project `avian-cable-379805`, behind
one external load balancer:

| Service | Public host |
| --- | --- |
| API | `api.bakerrang.com` |
| Portal | `portal.bakerrang.com` |
| Site Renderer | `sites.bakerrang.com` and customer domains |
| Client | `bakerrang.com` |

Merges to `main` selectively deploy only affected services.

## Normal release flow

```text
PR -> ci-passed -> merge to main -> Deploy MAIN classifier
   -> affected services only -> Cloud Run status.url smoke
   -> separate Verify Live public-ingress workflow
```

`ci-passed` is the required pre-merge validation signal. `Verify Live` is a
separate observation of public DNS, TLS, load-balancer, and host-routing health.
A `Verify Live` failure does not retroactively make the Cloud Run deployment job
fail; investigate the deployment result and ingress result as separate signals.

## Verify live

From an operator workstation with read access to production, start with:

```powershell
./scripts/verify-live.ps1
```

Include the fixed custom-domain check when needed:

```powershell
./scripts/verify-live.ps1 -Deep
```

Traffic vocabulary:

| Mode | Meaning |
| --- | --- |
| `LATEST` | Normal steady state: one symbolic `latestRevision: true` target receives 100% of traffic. |
| `PINNED` | An explicit revision receives traffic. A normal forward deployment may create a revision that receives 0%. |
| `SPLIT` | Exceptional/manual distribution across more than one target. |
| `UNKNOWN` | State could not be safely classified; fail closed and investigate. |

`SERVING == LATEST` alone does **not** prove that the service is unpinned. The
traffic target must be symbolic `latestRevision: true` for `LATEST` mode.

## GitHub Actions responsibilities

| Workflow | Responsibility |
| --- | --- |
| `CI` (`ci.yml`) | Credential-free, selective pre-merge validation. Its aggregate check is `ci-passed`. |
| `Deploy MAIN` (`deploy.yml` + `_deploy-cloud-run.yml`) | Automatic selective post-merge deployment and manual current-`main` single-service retry. It is not a rollback tool. Normal deployment changes only the image. |
| `Verify live public ingress` (`verify-live.yml`) | Credential-free public-ingress checks after deployment, on manual dispatch, and daily. It has no OIDC permission. |
| `Rollback MAIN` (`rollback.yml`) | Manual, emergency, service-scoped rollback using production WIF. It is separate from forward deployment's stale-deploy logic. |

## Manual forward retry

In **Actions -> Deploy MAIN -> Run workflow**, select one service. This deploys
that service from the current `main` HEAD.

Use it for a transient deployment failure, a retry after an infrastructure or
configuration issue is corrected, or a normal fix-forward. It is not an
old-version rollback tool.

## Rollback decision table

| Situation | Action |
| --- | --- |
| Bad code; current configuration is good | Image rollback |
| Bad code; newer good configuration must remain | Image rollback |
| Bad configuration, or exact old code plus configuration is required | Historical revision rollback |
| Failed deploy never changed the serving revision | No rollback; retry or fix forward |
| An unrelated sibling service failed | Do not roll back healthy services |

Follow the [MAIN rollback runbook](rollback.md) for prerequisites, exact steps,
guardrails, and post-checks.

## Image rollback

Image rollback combines an old immutable `git-<full SHA>` Artifact Registry
image with the current Cloud Run configuration. It creates a new latest revision
and preserves symbolic `LATEST` traffic. This is the primary rollback mechanism.

Client has a temporary bootstrap limitation. At completion of Step 2.6, MAIN
Artifact Registry had no `client` package because no Client-affecting deployment
had yet populated it. Until Client has at least one prior `git-<full SHA>` image:

- primary image rollback may have no Client target;
- historical Cloud Run revision rollback remains the emergency fallback, with
  the normal pinned-traffic caveats.

Do not fabricate or import historical Client images, and do not force a Client
deployment to populate the package. The first future Client deployment through
the unified MAIN pipeline creates its first immutable image; after a subsequent
Client version deploys, that prior image becomes a normal primary rollback
candidate.

## Revision rollback warning

Historical revision rollback restores that revision's exact historical code and
configuration by routing traffic to it explicitly. This creates `PINNED` traffic.
Normal future image deployments may then create revisions that receive 0%.

After the corrected/latest revision is ready, recovery requires a deliberate:

```powershell
gcloud run services update-traffic <service> --to-latest --project avian-cable-379805 --region us-west1
```

Then run `./scripts/verify-live.ps1` and require `Traffic Mode = LATEST`. See the
[rollback runbook](rollback.md#mandatory-revision-unpin-recovery) for the full
validation and recovery procedure.

## Partial deployment handling

If one of several affected services fails, successful services stay live. Inspect
the failed service's serving state and independently retry, fix forward, or roll
back only that service. Never automatically mass-rollback the fleet.

## Firestore/data compatibility policy

- Prefer additive fields and supply read defaults when fields are missing.
- Use dual read/write only when semantics genuinely change.
- Use a one-off migration or backfill only when unavoidable; there is currently
  no migration platform.
- Never destructively rename or remove data in the same release that introduces
  the new consumer expectation.

## Cross-service API compatibility

Use **expand -> deploy consumers -> contract later**. Services deploy
independently, so old-consumer/new-API and new-consumer/old-API combinations can
temporarily exist. There is no atomic release coordinator and no version
handshake; add one only if future product needs demonstrate that it is necessary.

## Artifact Registry retention

- Keep immutable tags enabled.
- Deployed images use `git-<full SHA>` tags.
- Retain all tagged rollback images indefinitely for now.
- Do not create a cleanup policy. The Step 2.6 audit found zero untagged artifacts.
- Do not weaken immutable tags merely to simplify storage cleanup.
- Revisit retention only when growth becomes operationally or financially
  material.

At the Step 2.6 audit, `avian-cable-379805/us-west1/bakerrang` contained six
tagged versions, zero untagged versions, and about 216 MB total. Artifact Registry's
0.5 GiB free storage allowance is billing-account-wide, not guaranteed per
project or repository. Even if all 216 MB were billable at standard storage
pricing, the attributable monthly storage cost would be on the order of a few
cents. Cleanup complexity is not justified at this scale.

## Cloud Run revisions

Do not manually prune revisions for tidiness. Let Cloud Run manage revision
retention. Historical revisions are the secondary rollback surface when exact
historical code and configuration are required.

## Useful operator entry points

- Inspect serving state: `./scripts/verify-live.ps1`
- Include the fixed custom host: `./scripts/verify-live.ps1 -Deep`
- Current-main retry: **Actions -> Deploy MAIN**
- Public-ingress observation: **Actions -> Verify live public ingress**
- Emergency recovery: **Actions -> Rollback MAIN**, then follow the
  [rollback runbook](rollback.md)
