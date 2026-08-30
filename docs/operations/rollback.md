# MAIN rollback runbook

Use **Actions → Rollback MAIN**, dispatched from **main**, for one service at a time.
Never mass-rollback sibling services. Start by checking the actual serving state with
`scripts/verify-live.ps1` and the affected deployment's summary, not just whether its job failed.

## Which rollback do I use?

| Situation | Action |
| --- | --- |
| Bad code, current config is good | Image rollback |
| Bad code, good newer config must be retained | Image rollback |
| Bad config | Historical revision rollback |
| Need the exact old code + config snapshot | Historical revision rollback |
| Failed deploy never changed the serving version | No rollback; fix forward |

## Prerequisites and fixed scope

You need permission to dispatch the workflow and satisfy the existing `production`
Environment protections. It uses the existing MAIN WIF provider/deployer, restricted
to main; no new credentials, IAM grants, tag settings or retention policies are installed.
The existing resource-scoped grants are documented in [MAIN WIF](../infra/live-environment-bootstrap.md#main-wif).

Project: `avian-cable-379805`; region: `us-west1`.
Image root: `us-west1-docker.pkg.dev/avian-cable-379805/bakerrang`.

| Input | Cloud Run service | Image package | Expected runtime SA prefix |
| --- | --- | --- | --- |
| `api` | `bakerrang-api` | `api` | `bakerrang-api` |
| `portal` | `bakerrang-portal` | `portal` | `bakerrang-frontend` |
| `renderer` | `bakerrang-site-renderer` | `site-renderer` | `bakerrang-frontend` |
| `client` | `bakerrang-client` | `client` | `bakerrang-frontend` |

Every SA above ends in `@avian-cable-379805.iam.gserviceaccount.com`.
If credentials, identity, target membership, or state checks fail, stop and have the
repository/cloud operator investigate. Do not bypass the guards or broaden IAM as
an emergency shortcut. No env values or secret values are included in the summaries.

## Image rollback (normal mechanism)

1. In **Actions → Rollback MAIN → Run workflow**, choose branch **main**.
2. Select the affected `service`, `mechanism=image`, and `target=<full lowercase 40-character SHA>`.
   Choose a previously deployed SHA for that service, not a branch, short SHA, URL,
   image path, `latest`, or an already-prefixed `git-...` value.
3. Review **ROLLBACK REQUEST** and **ROLLBACK RESULT** in the job summary.

The helper constructs `git-<SHA>` in only the selected package, resolves and validates
the digest, then updates only `--image` using the digest. **Code goes backward;
configuration stays current**: env, secret mappings, runtime SA, resources and
networking remain on the current template. It neither builds nor retags an image.

Precondition: **LATEST**, one 100% symbolic `latestRevision: true` target.
PINNED, SPLIT and UNKNOWN are rejected **before mutation**; nothing automatically
unpins traffic. Even `serving revision == latest ready revision` can be PINNED if
the traffic target names that revision explicitly.

The operation must create a new revision, make it latest ready and actually serving
with the resolved image and expected runtime SA, keep LATEST traffic and pass
selected-service checks. An unchanged image/template may create no new revision;
the workflow reports failure rather than claiming a new rollback happened. Inspect
state before repeating it. After a successful image rollback, normal CI deployment
semantics remain intact.

## Historical revision rollback (exceptional mechanism)

1. Choose **main**, the affected `service`, `mechanism=revision`, and
   `target=<exact Cloud Run revision name>` in **Actions → Rollback MAIN**.
2. The workflow checks the service-scoped revision list, describes the exact target,
   and requires its service label, Ready condition, image and runtime SA to match.
   An old Artifact Registry tag is **not** required.
3. The only mutation routes 100% traffic to that revision. It does not rewrite the
   current template or its env, secret mappings, image, resources or runtime SA.

**THIS PINS TRAFFIC. REVISION ROLLBACK ACTIVE.**

Normal future image deployments may create new revisions receiving **0% traffic**.
The warning stays in the job summary even if later verification fails. This is
intentional historical code + revision-config recovery, not a source revert.
External data and secret contents are not restored to historical values.
The workflow never automatically restores dynamic latest traffic.

## Mandatory revision-unpin recovery

Once corrected code/config is ready:

1. Identify the intended latest revision and compare latest **created**, latest
   **ready**, and actual serving revisions. Deploying again alone does not remove a pin.
2. Confirm the intended revision is Ready, its image and runtime SA are correct,
   and validate it before moving traffic. The untagged service URL still tests the
   pinned revision; it does **not** prove that a zero-traffic latest revision works.
3. Ensure no same-service forward deployment or rollback is running/queued; local
   gcloud commands do not participate in the GitHub concurrency lock. Have an
   authorized operator deliberately restore symbolic latest (example for API):

   ```powershell
   gcloud run services update-traffic bakerrang-api --to-latest --project avian-cable-379805 --region us-west1
   ```

   Substitute only the intended Cloud Run service from the mapping above. This is
   a separate, intentional production mutation, **not** part of rollback.
4. Run `scripts/verify-live.ps1` and require **Traffic mode = LATEST** for the recovered
   service, correct serving image/identity, readiness, and passing public checks.
   The script checks all four services by default; investigate sibling warnings
   separately rather than rolling them back automatically.

## Checks and failure handling

Preflight records configured and actual traffic, latest revisions, every serving
revision's image/SA and expected SA. Unknown traffic and identity mismatches fail
closed. A currently unhealthy service can still be recovered to a healthy target.
For image rollback the current template SA is also checked before mutation.

Post-checks require target revision readiness, the intended sole serving revision,
expected image and SA, and LATEST (image) or PINNED (revision) traffic at 100%.
Image rollback also requires the service Ready condition. Historical revision
recovery can succeed while a broken latest template keeps that condition false:
the healthy pinned target is checked instead, and the template warning remains
visible for subsequent repair before unpinning.
Then only the selected service's Cloud Run `status.url` and fixed public endpoint
are tested with the normal deployment markers:

| Service | Path / public endpoint | Assertion |
| --- | --- | --- |
| API | `/health` / `https://api.bakerrang.com/health` | 200 + `Healthy` |
| Portal | `/` / `https://portal.bakerrang.com/` | 200 |
| Renderer | `/robots.txt` / `https://sites.bakerrang.com/robots.txt` | 200 + `User-agent` |
| Client | `/` / `https://bakerrang.com/` | 200 + `<div id="root"` |

A selected-service smoke failure fails the rollback workflow but does **not** undo
the mutation. Unrelated endpoints are never checked. A lost/failed mutation response
can be ambiguous: inspect actual state before retrying. There are no automatic
recovery mutations. Use the request/result summary to distinguish "not attempted",
"attempted" and "completed" from whether verification passed.

## Source reconciliation

After either rollback, revert or fix the bad commit(s) on **main**, run normal CI,
and deploy corrected source. Do not leave source HEAD and live behavior diverged
long-term. Rollback intentionally does **not** use the forward stale-deploy guard;
forward deployment keeps that guard unchanged. If revision rollback was used,
complete the explicit unpin recovery above before resuming normal traffic behavior.

## Concurrent deployment warning

Rollback and forward deployment share **`deploy-production-<service>`** with
**`cancel-in-progress: false`**. They cannot mutate the same service concurrently;
different services remain independent. A newer forward deployment cannot cancel a
**running** rollback through this concurrency policy.

GitHub retains only one pending run per group: a newer pending forward run can
supersede a rollback waiting behind another run. Cancel an **obviously stuck
same-service forward deployment first**, then launch or re-run the emergency
rollback. Confirm that it actually started. Cancellation does not undo a Cloud Run
operation already submitted; inspect serving state and let that operation settle
before proceeding. Coordinate source fixes so a later queued forward deploy does
not immediately replace an image rollback with the same bad code.

## When NOT to roll back

- The failed deployment never changed the serving revision.
- A transient workflow failure occurred while live behavior is still good.
- A trivial fix-forward is safer or faster.
- An unrelated sibling service failed.

Never infer "roll back everything" from an aggregate workflow failure.

## Local safety tests

The [rollback helper](../../scripts/ci/rollback.ps1) is invoked by the protected
workflow, not an alternate local mutation entrypoint. Local tests mock all cloud and
HTTP calls:

```powershell
pwsh -NoProfile -File scripts/ci/rollback.test.ps1
pwsh -NoProfile -File scripts/ci/verify-live.test.ps1
node --test scripts/ci/deployment-workflows.test.mjs scripts/ci/classify-changes.test.mjs scripts/ci/stale-deploy-guard.test.mjs
```

No live rollback is required to run these tests. The helper reuses Step 2.6a's
traffic interpretation and smoke assertions without invoking its all-service check.
