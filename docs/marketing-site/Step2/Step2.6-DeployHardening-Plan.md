# Step 2.6 Plan (Revision 2) — Release / Rollback / Verification Hardening

**Status:** Planning / read-only. **Nothing was deployed, mutated, or changed in GCP, DNS, GitHub,
or the working tree beyond this document.** All facts below were verified by reading the actual
workflows, scripts, and infra docs in this repo. Items that require a live `gcloud` read at
implementation time (not now, per the read-only constraint) are marked **(verify)**.

**Revision 2 supersedes Revision 1** after an operator review. The material changes: the **primary
rollback mechanism is flipped to old-image-on-current-config** (revision traffic rollback introduced a
sticky-traffic footgun — §3/§4b); **Artifact Registry retention is corrected** (a retained Cloud Run
revision does **not** need its AR image to keep serving — §12); **verify-live now distinguishes serving
vs. latest revisions** (§15); a **rollback/forward-deploy concurrency design** is added (§17c); **target
validation** is tightened to full 40-char SHAs (§16b); the **IAM conclusion is "no change needed"** (§17d);
**known-good terminology** is made honest (§14); and the **implementation order is observability-first**
(§24). Superseded Rev-1 text has been replaced in place.

Sources inspected: [deploy.yml](../../../.github/workflows/deploy.yml),
[_deploy-cloud-run.yml](../../../.github/workflows/_deploy-cloud-run.yml),
[ci.yml](../../../.github/workflows/ci.yml),
[classify-changes.mjs](../../../scripts/ci/classify-changes.mjs),
[stale-deploy-guard.mjs](../../../scripts/ci/stale-deploy-guard.mjs),
[docs/CI-CD.md](../../CI-CD.md),
[docs/infra/live-environment-bootstrap.md](../../infra/live-environment-bootstrap.md),
[server/app.js](../../../server/app.js).

---

## 0. Load-bearing finding (shapes the whole plan)

**The existing pipeline has no rollback mechanism — not even manually.** Both the automatic push path
and `workflow_dispatch` in `deploy.yml` hardcode `image_tag: git-${{ github.sha }}`, and both run under
a WIF attribute condition **and** a `guard-main` step that require `refs/heads/main`. So the manual
dispatch can only ever deploy **current main HEAD**; there is no input, and no permitted ref, that lets
the existing reusable workflow put an *older* image live. **The manual button is a fix-forward tool, not
a rollback tool.** Everything about rollback in this plan is therefore net-new tooling, not a reuse of
the current dispatch.

Corollary: `_deploy-cloud-run.yml` always **builds/reuses the image of the SHA the workflow runs on** and
runs the **stale-deploy guard**, which would classify an intentionally older rollback target as
"superseded" and refuse it (§19). Rollback must live in a **separate** workflow with opposite semantics.

---

## 1. Current rollback capabilities (what exists implicitly)

| Layer | What's there | Rollback value today |
|---|---|---|
| **Cloud Run revisions** | Every deploy creates a new revision; the update is **image-only** (env/secrets/SA/traffic untouched, `_deploy-cloud-run.yml` "Update Cloud Run image"). Cloud Run retains prior revisions. | **Highest.** A prior revision is a complete, already-served, known-good snapshot of **code + config**. `gcloud run services update-traffic` can point 100% back to it, atomically, no build. This is the real (untooled, undocumented) rollback path. |
| **Immutable `git-<sha>` AR images** | `--immutable-tags` repo; each source SHA is write-once; deploy reuses an existing tag by digest instead of rebuilding. | **High.** Any prior SHA's image is durably addressable and re-deployable onto *current* config — **if not pruned**. No tool exists to do this today. |
| **Manual single-service dispatch** | `workflow_dispatch` → one service, main only. | **Low as rollback.** Deploys main HEAD only. Useful to *retry* the current SHA or *fix-forward*. |
| **Deploy-time capture** | Each deploy writes previous revision/image/SA into the job summary. | **Audit only.** No command reads it back later. |

**Runtime-SA invariant is already protected**: every deploy asserts the runtime SA is unchanged. Any
rollback tool must preserve this same assertion.

## 2. Gaps ("technically possible" vs. "safe / operator-friendly")

1. **No rollback command or workflow at all** — an incident would mean unrehearsed, unaudited hand-run `gcloud`.
2. **No one-shot answer to "what SHA is live?"** across the four services.
3. **No one-shot answer to "what was the previous good SHA/revision?"** outside old Action-run summaries.
4. **The stale-deploy guard would reject a rollback** if rollback reused the forward path (§19).
5. **AR growth is unbounded** — no retention policy; nothing protects rollback-relevant images.
6. **Public ingress health is verified only by hand** — deploy smoke hits `status.url`, never LB/DNS/TLS/host routing.
7. **No documented bad-code-vs-bad-config guidance** — the two rollback mechanisms have opposite config semantics.

## 3. Canonical rollback strategy (Rev 2 — flipped to image-first)

**PRIMARY — redeploy previous immutable `git-<sha>` image onto CURRENT config (Option B).**
`gcloud run services update <svc> --image <repo>/<img>@<digest>`.
- Speed: one revision creation, no build (reuses the immutable image).
- Safety: high; rolls back **code** while keeping **current** env/secrets/SA.
- **Traffic state: none.** Because our deploy path never pins traffic, the service stays in
  "100% → latest ready revision" mode, so an old-image redeploy creates a **new latest revision that
  receives 100%**, and **all subsequent normal CI deploys keep landing on latest automatically.** Nothing
  to remember or reset. This is the property that makes it primary (§4b).
- Source match: runtime reverts to a past SHA on current config; reconcile source afterward via Option C.
- Requires the `git-<sha>` image to still exist in AR (hence the retention window, §12); **fails closed** if pruned.

**SECONDARY — Cloud Run revision traffic rollback (Option A).**
`gcloud run services update-traffic <svc> --to-revisions <REV>=100`.
- Speed: seconds, atomic, no build, no AR round-trip.
- Restores a complete **code + config** snapshot that actually served before. The tool for **bad config**,
  **restore code + config together**, or **exact historical-snapshot recovery**.
- Config: rolled back **too** (env, secrets, SA, resources restored to that revision's template).
- **⚠️ Sticky traffic state.** Explicit traffic assignment persists across future normal deploys until
  explicitly returned to latest, so it carries a **mandatory unpin recovery** before normal CI resumes (§4b).
- Does **not** require the AR image to keep serving (Cloud Run imports the image at deploy time; instances
  do not pull from AR at cold start — §12).

**TERTIARY / reconciliation — git revert + normal forward deploy (Option C).**
Not an emergency mechanism (full validate + build + deploy = minutes), but the way to make **source
history match runtime** after a rollback. Always the mandatory follow-up.

**Decision:** PRIMARY **image (B)**, SECONDARY **revision (A)**, with **C** as the required reconciliation
step. Image-first is chosen specifically because our normal deploy is image-only and never touches traffic,
so image rollback keeps "normal future CI continues behaving normally" true with zero special traffic state
— whereas revision rollback would silently pin traffic and cause later green CI deploys to serve 0% (§4b).

**(verify — precondition):** each service is currently unpinned — a single `status.traffic` entry with
`latestRevision=true`, `percent=100`. This is what the image-first model assumes and is exactly what the
2.6a verify tooling surfaces first.

## 4. Bad-code vs. bad-config decision tree (Rev 2)

```
Incident: live service is broken.
│
├─ Bad code, config unchanged (normal CI deploy, no manual gcloud config edit since last good)?
│     └─ PRIMARY (image): redeploy old git-<sha> image on CURRENT config.
│        New latest revision, 100% traffic, normal CI resumes cleanly. No traffic state.
│
├─ Bad code, but a GOOD config/secret change also shipped and must be kept?
│     └─ PRIMARY (image): old image + current config keeps the good config by construction.
│
├─ Config itself is bad, OR code+config must be restored together, OR you want the exact
│  historical snapshot back?
│     └─ SECONDARY (revision): update-traffic OLD=100 to stop the bleeding, THEN follow the
│        mandatory unpin recovery in §4b before normal deploys can resume.
│
└─ After ANY rollback, once stable:
      → Option C: git revert the bad commit(s) on main so source == runtime; let normal CI
        redeploy the fix. Do not leave main ahead of live, and land the revert so the next
        forward deploy ships good code rather than re-shipping the bad HEAD (§17c case B/D).
```

## 4b. Explicit traffic-state implications

The single most important reason the primary flipped. Our normal deploy is an image-only
`gcloud run services update` that **never touches traffic** (`_deploy-cloud-run.yml`, "Update Cloud Run
image" — no `update-traffic`). Cloud Run keeps an *explicit* traffic assignment sticky until it is
returned to latest. Therefore:

- **PRIMARY (image): no traffic state.** No explicit assignment is ever created; traffic stays
  "100% → latest ready." Post-rollback the **new** revision is both latest and serving; nothing to unpin.
- **SECONDARY (revision): sticky pin.** `update-traffic OLD=100` creates an explicit pin that **survives
  future `services update --image` deploys** — so the next normal CI deploy would build a new revision that
  **receives 0% traffic** while the pin keeps serving OLD, and CI would still report green. To prevent a
  silently-stuck service, the mechanism has a **mandatory recovery**, documented in the runbook as part of
  using it:
  1. `update-traffic OLD=100` — immediate mitigation.
  2. Fix code/config (forward commit, or a follow-up image rollback).
  3. **`gcloud run services update-traffic <svc> --to-latest`** — removes the pin, restores
     "100% → latest ready" behavior.
  4. Confirm serving revision == intended via the verify tooling (§15).

We are **not** changing normal deploy to always `--to-latest`; `--to-latest` is only an explicit operator
recovery step tied to the secondary mechanism. Preserving current image-only deploy semantics is the point.

## 5. Configuration rollback semantics (especially API)

The API is the only service with meaningful runtime config (session/CSRF secrets, OAuth secret, Firestore
project pin, media bucket, preview token, third-party keys). This is exactly why the two mechanisms stay distinct:

- **SECONDARY revision rollback restores the whole template** — including secret *mappings* and env.
  Correct when config is implicated; dangerous when a legitimate secret rotation or env change happened
  since the target revision (it silently reverts that).
- **PRIMARY image rollback keeps current config** — correct in the common bad-code case, and specifically
  when you rotated a key / fixed an env var **and** need to undo a code regression.

**Invariant to preserve:** normal deploys are image-only and must stay that way. Neither rollback tool may
ever *set* env/secrets/SA (no `--set-env-vars`, no `--service-account`, no `--update-secrets`). Revision
rollback restores them by picking a whole revision; image rollback leaves them alone. Both then assert the
runtime SA of the **serving** revision is unchanged vs. the pre-rollback live SA (§15).

## 6. Public ingress verification design

Separate, credential-free, read-only HTTP checks over fixed public hosts:

| Target | URL | Assertion (stable, non-fragile) |
|---|---|---|
| API | `https://api.bakerrang.com/health` | 200 + body exactly `Healthy` (confirmed `server/app.js` `/health`) |
| Portal | `https://portal.bakerrang.com/` | 200 (Next shell; do not assert body text) |
| Renderer | `https://sites.bakerrang.com/robots.txt` | 200 + contains `User-agent` |
| Client | `https://bakerrang.com/` | 200 + contains `<div id="root"` (matches deploy smoke marker) |
| **Custom** | `https://custom.bakerrang.com/` | 200 — **manual / deep tier only**, not every run |

Markers mirror exactly what the deploy smoke already trusts, so they can't drift from what the app serves.
`custom.bakerrang.com` exercises the LB **default backend → renderer** wildcard path (a distinct
architectural assertion: unmatched-host routing). Keep it in a deeper / manual tier — a custom-domain
cert/DNS issue must not redden a routine API verification.

## 7. Trigger / schedule recommendation

- **After deploy:** a *separate* `verify-live` workflow via `workflow_run` on `Deploy MAIN` completion —
  **never** a job inside `_deploy-cloud-run.yml`. It carries its own status and **cannot** retroactively
  fail the deploy (deployment health and ingress health stay separate signals).
- **`workflow_dispatch`:** always available on demand, with an optional `deep` boolean that adds `custom`.
- **Scheduled:** **one daily cron.** It is the only thing that catches a silent LB/DNS/TLS/cert regression
  no deploy touched (e.g. a managed-cert renewal failure). Cheap enough to justify (§22).

Nothing is gated on public verification; it is an observation signal, not a deploy gate.

## 8. Alerting / notification scope

GitHub's native failure surfacing is sufficient for a single operator — **no PagerDuty/Datadog/etc.** The
one gap is a *scheduled* run's failure (no PR/push to look at). Mitigation, free: rely on GitHub's default
email to the repo owner on a scheduled workflow's first failure, plus the Actions-tab badge. Do not build
notification infrastructure. Document "how you notice" = the scheduled-run failure email + the Actions badge.

## 9. Multi-service partial-failure policy

Current behavior for `API ✓ / Portal ✓ / Renderer ✗ / Client ✓`: each deploy job is independent; the
three successes are **already live**; `live-deploy-passed` is **red** because it checks each affected
service. **This is correct and acceptable.**

**No automatic cross-service rollback.** Reasons: (a) services are designed to deploy independently and
backward-compatibly (§10), so a partially-updated fleet is a *valid* state; (b) auto-rollback would couple
unrelated services and could revert a *healthy* one because a sibling failed; (c) it is exactly the
"automatic rollback on fragile heuristics" the spec forbids. Operator response: open the red run → the
failed service is on its **prior** revision (per-service deploy is atomic) → fix-forward or roll back
**only** that service.

## 10. Cross-service compatibility policy

Consumers of the API contract: **Portal** (authed `/tenants/**`), **Renderer** (public
`/public/sites/**`), the legacy **Client**, and the **browser extension** (`/vault` GETs). Deploys are
independent and unorchestrated, and Renderer/Portal bake `NEXT_PUBLIC_*` base URLs at build time — so
during any single-service deploy an **old consumer runs against a new API and vice-versa** for minutes.
There is **no version handshake and no atomic-release mechanism**, and none should be added.

**Engineering rule (policy):** **expand → deploy consumers → contract.** Any API change stays
backward-compatible for at least one deploy cycle:
- add new fields/routes first (expand), deploy API, then deploy Portal/Renderer to use them;
- only remove/rename an old field/route (contract) in a *later* release once no consumer uses it;
- never rename/remove a `/public/sites/**` field in the same release a consumer starts depending on the new shape.

**Current risk:** low (contract has been additive), but the public renderer contract is the sharpest edge —
a breaking change there breaks live customer sites with no atomic cover.

## 11. Firestore evolution policy

No migration framework exists, and none is needed now. The platform already practices the right discipline
(merge-writes so login can't erase `platformRole`; read-defaults; section corruption scans; `status:'NEW'`
back-compat). Codify as policy, do not build tooling:

- **additive fields only** by default; **read with defaults** for absent fields;
- **dual-read / dual-write** only when a field's meaning genuinely changes;
- an explicit **one-off backfill script** (committed, run once, then deleted) only when truly unavoidable;
- **never** a destructive/renaming schema change in the **same** release as the consumer code that depends
  on it (same expand → contract rule as §10).

## 12. Artifact Registry retention (Rev 2 — corrected premise)

**Rev-1 correction:** the earlier "never delete an image a retained revision references" rule rested on a
false premise. Cloud Run **imports** the container image at deploy time; instances do **not** pull from
Artifact Registry when they start, and the source AR image may be deleted after deployment without
affecting a retained revision's ability to serve or cold-start. So **retained revisions do not require
their AR image** — the revision-aware protection is dropped entirely.

AR retention is needed for exactly **one** reason: the **PRIMARY image-rollback mechanism** — redeploying
an old `git-<sha>` requires that image to still exist. (SECONDARY revision rollback needs no AR image.)

**Policy: keep the last N deployed `git-<sha>` images per service; drop older ones.** Because the
constraint is now a simple per-package "most-recent-N versions," **Artifact Registry's native cleanup
policy (keep-most-recent-versions, per image package) is now suitable** — free, set-and-forget, and no
longer at risk of orphaning a serving image. A manual runbook is optional, not required.

**N:** N=10 is defensible but tight. Since each image is only a few MB and a larger window strictly widens
rollback reach at negligible cost, recommend **N = 20 per service** — a long rollback horizon at our
affected-only, per-merge cadence while staying bounded. Applying the AR policy is a GCP config change, so
it lands in 2.6c (not now).

**(verify):** current per-service image counts, to confirm N=20 sits comfortably above normal churn.

## 13. Cloud Run revision retention

**Leave Cloud Run revision management alone.** Cloud Run already caps retained revisions and prunes
oldest-inactive automatically. Retained revisions are the **SECONDARY** rollback surface (code + config
snapshots) — deleting them for tidiness removes that depth. No manual policy; do **not** delete revisions.
Retained revisions serve independently of Artifact Registry (§12), so revision retention and AR retention
are now decoupled concerns.

## 14. Known-good release identification (Rev 2 — honest terminology)

Do **not** equate "the immediately previous Ready revision" with "known good" — a Ready revision need not
have passed post-deploy smoke. The tooling and runbook use honest terms and leave the choice to the operator:

- **current serving revision** — the revision at 100% traffic (from `status.traffic`), **not** merely `latestRevisionName`.
- **previous revision candidate** — the prior revision by creation time; a *candidate*, not certified.
- **associated git-SHA / image** — shown for each, so the operator can reason about the target.
- **operator chooses the target** — the tool never auto-selects "the known-good."

Cheap existing "known-good" evidence, **no registry built**: a **green `Deploy MAIN` run** for a service
means that SHA's **deploy smoke passed** (the reusable job records deployed revision + digest + smoke result
in its summary). So "known-good SHA for API" = the SHA of the most recent green `Deploy MAIN` API deploy.
The operator cross-references verify-live (current serving) against green Actions runs to pick a certified
image-rollback target. This uses existing GitHub metadata only — no release database/registry.

## 15. Read-only live verification tooling (Rev 2 — serving vs. latest)

Add `scripts/verify-live.ps1` (read-only; PowerShell to match the operator environment). It must
distinguish the **serving** revision from the **latest** revision — they diverge whenever traffic is pinned,
and "what is running" means the revision **receiving traffic**, never merely `latestRevisionName`.

Per service, print:
- `latestReadyRevisionName` (latest created/ready).
- **Traffic table** from `status.traffic[]`: revision name, percent, tag.
- For the **serving revision** (the traffic entry at 100%, or the max), via `gcloud run revisions describe
  <REV>`: revision name, **image digest + `git-<sha>` tag**, **runtime SA**, createdAt. Identity is read from
  the *serving revision*, not the service template.
- A **`SERVING != LATEST` warning** when the serving revision isn't the latest — i.e. a pinned/rolled-back
  state that normal CI will not advance (see §4b).
- Then the §6 public-host health line.

```
Service   Serving rev              %   Latest rev              SHA (git-tag)   Image digest   Runtime SA           Created     Flag
api       bakerrang-api-00042-abc  100 bakerrang-api-00042-abc git-<40hex>     sha256:…       bakerrang-api@…      2026-08-29  ok
portal    …                        100 …                       …               …             bakerrang-frontend@  …           ok
renderer  …
client    …
```

This is the first thing to run in an incident, it confirms the §3 **(verify)** unpinned precondition, and
it must only call `describe` / `list` / `curl` — never a mutating verb.

**Rollback post-checks (both mechanisms) use the same serving-state read:**
- **Image mechanism:** assert the **new latest** revision now receives 100%, its image digest == the
  expected old-SHA digest, its runtime SA == expected, then smoke.
- **Revision mechanism:** assert the **target** revision now receives 100% (from `status.traffic`), the
  target is Ready, its image == captured, and **its** runtime SA == expected. **Do not assert the service
  template** — with a pin the template may point elsewhere than what serves.

## 16. Documentation structure

Pragmatic — **two** files under `docs/operations/` (release and verification fold together cleanly):

- **`docs/operations/rollback.md`** — the §4 decision tree; exact A/B/C commands per service; the safety
  checks (§16b); and **when NOT to roll back** (e.g. a partial deploy where the failed service is safely on
  its prior revision, or a trivially fix-forwardable bug).
- **`docs/operations/live-ops.md`** — what happens on merge to main; how to read what deployed;
  `verify-live.ps1` usage; public verification; partial-deployment recovery (§19b); and the AR cleanup
  runbook (§12).

Cross-link both from `docs/CI-CD.md`. Resist a larger doc tree.

## 16b. Rollback target validation & safety checks (Rev 2 — exact)

Tag convention confirmed in `_deploy-cloud-run.yml`: images are tagged `git-${GITHUB_SHA}` — a **full
40-char SHA**. Validation is fail-closed and per-mechanism.

**Image mechanism (PRIMARY):**
- Accept a fixed `service` **enum** (`api|portal|renderer|client`) only.
- Require an **exact full SHA**: `^[0-9a-f]{40}$` (no 7-char abbreviations — ambiguous, and unnecessary
  since the tag is full).
- Map service→image name internally exactly as the deploy path does (`api`→`api`, `portal`→`portal`,
  `renderer`→`site-renderer`, `client`→`client`) and **construct the AR path internally**:
  `${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPOSITORY}/<image>:git-<sha>`.
- Resolve the digest **only inside that path** (`gcloud artifacts docker images describe … --format='value(image_summary.digest)'`,
  reusing the deploy path's approach); validate `^sha256:[a-f0-9]{64}$`.
- **Fail closed if absent; never accept an arbitrary image/repository string; never accept `latest`.**

**Revision mechanism (SECONDARY):**
- Validate the revision-name shape (`<service-name>-…`).
- **Confirm it belongs to the selected service**: `gcloud run revisions describe <REV>` **and** confirm it
  appears in `gcloud run revisions list --service <svc>` (authoritative service membership).
- Verify it is **Ready**; capture its **image**; verify its **runtime SA == the expected/pre-approved
  service identity**. **Fail closed on any mismatch.**

**Before/after checks (both):** capture current serving revision + digest + SA before acting; after acting
run the §15 serving-state post-check (target/new revision at 100%, expected image, runtime SA unchanged)
then the `status.url` smoke.
**In the runbook** (operator judgment): the §4 decision (which mechanism), the §4b unpin recovery for the
revision mechanism, the public-host smoke interpretation, and "should I roll back at all."

## 17. GitHub workflow / security design

Two new workflows; **do not** thread rollback through `_deploy-cloud-run.yml`.

- **`verify-live.yml`** — triggers `workflow_run` (after Deploy MAIN) + `workflow_dispatch` + daily
  `schedule`. **`permissions: contents: read` only — NO `id-token`.** Pure public `curl` over a fixed host
  allowlist; no input becomes a URL (a `deep: true` boolean at most). Cannot touch cloud or fail a deploy.

- **`rollback.yml`** — `workflow_dispatch` only. Inputs: `service` (choice enum `api|portal|renderer|client`),
  `mechanism` (choice `image|revision`, **`image` default** = PRIMARY), `target` (a **full 40-char SHA** for
  image, or a revision name for revision — validated per §16b). Needs `id-token: write` + a `guard-main`
  step (main-only, like the existing dispatch), and **shares the forward path's per-service concurrency
  domain** (§17c). It is a **separate** job, justified because it has **opposite** semantics to the forward
  path: it must **never build**, must **skip the stale guard** (§19), must resolve an **older** target, and
  must **fail closed if the target doesn't exist**. Folding those branches into the load-bearing
  forward-deploy workflow would risk the very invariants 2.6 exists to protect. It **reuses the forward
  path's patterns** (auth, resolve-service-config, capture-previous, image-only update / traffic pin,
  serving-state post-check, `status.url` smoke) by copying those steps, not by parametrizing the critical path.

**Security posture (§21):** fixed service **enum** (no free-form service/repo strings); `target` validated
against a strict regex **and** against the resolved service's own AR path / service revision list (no
cross-service image or revision injection); all shell args passed via `env:` and quoted (matches existing
style); no `--set-env-vars` / `--service-account` anywhere (no accidental config mutation); no user-supplied
URLs in verify; rollback stays main-only under the existing WIF `ref == refs/heads/main` condition; verify
workflow holds no credentials; no PR code path gains cloud credentials.

## 17c. Rollback / forward-deploy concurrency

Verified: `_deploy-cloud-run.yml` sets `concurrency: { group: deploy-${{ inputs.environment }}-${{ inputs.service }},
cancel-in-progress: false }` → `deploy-production-<service>`. `deploy.yml` / `ci.yml` add no service-level
deploy concurrency of their own; serialization lives entirely in the reusable job.

**Design: `rollback.yml` joins the SAME per-service domain** —
`concurrency: { group: deploy-production-${{ inputs.service }}, cancel-in-progress: false }`. No
cross-service coordination, no cancellation machinery.

**Proven safety property:** one shared group + `cancel-in-progress: false` ⇒ **at most one job runs at a
time per service**, and a running job is never cancelled by a newcomer. So a same-service forward deploy and
a rollback **can never mutate concurrently**, and **a queued forward job cannot clobber an actively-running
rollback.** Case analysis:

- **A — forward running, operator starts rollback:** rollback goes *pending*, runs when the forward finishes
  (or the operator cancels the stuck forward → rollback runs immediately). No interleaving.
- **B — rollback running, new push triggers forward:** forward goes *pending*, runs only after rollback
  completes; it then ships main HEAD — so land the Option-C revert on main so that forward ships **good**
  code. Concurrency guarantees no concurrent mutation; revert-first handles correctness.
- **C — older forward queued when rollback begins:** if that forward is running, rollback queues behind it
  (→ A); if it was itself only pending, the rollback's arrival supersedes that stale pending forward (which
  the stale-guard would have skipped anyway). Rollback runs next.
- **D — operator reverts right after rollback:** the revert push's forward deploy serializes after the
  rollback and ships the good SHA; verify-live confirms. Clean happy path.

**Residual, stated honestly:** GitHub keeps only one *pending* item per group, so a rollback still sitting
*pending* (waiting behind a running forward) can be superseded by a newer pending forward and show as
**cancelled** — visible and re-runnable. Mitigation is the pre-approved runbook line: **"cancel an obviously
stuck forward deployment before starting an emergency rollback,"** which removes the running forward so
rollback starts immediately with nothing pending. A running rollback is never at risk.

## 17d. IAM conclusion — no change needed

Audited the documented MAIN deployer grants in `live-environment-bootstrap.md` ("MAIN WIF"):

- `roles/run.developer` on **exactly the four services** — covers both `services update --image` (image
  rollback) and `services update-traffic` (revision rollback).
- `roles/iam.serviceAccountUser` on `bakerrang-api@` and `bakerrang-frontend@` — the
  Service-Account-User-on-runtime-identity requirement Google lists for deploy/traffic ops.
- `roles/artifactregistry.writer` on repo `bakerrang` — includes read/download, so the image-describe /
  reference in image rollback is covered (no separate Reader grant required).

Both mechanisms are fully satisfied by existing grants. **No IAM change.** Keep a read-only **(verify)** that
live grants still match the doc.

## 18. Branch protection / required checks

- **Required for PR merge:** `ci-passed` (the stable aggregate in `ci.yml`). Correct single gate.
- **Do NOT require** any deploy job, nor `live-deploy-passed`, as a PR check — it runs on **push to main,
  after merge**; it cannot exist as a pre-merge status and requiring it would deadlock merges. Document that
  `live-deploy-passed` is a **post-merge** signal you watch, not a merge gate.
- `verify-live` / `rollback` are never PR-required (post-deploy / operator-initiated).

## 19. Automatic-deploy-failure decision tree

```
Merge to main → Deploy MAIN goes red.
│
├─ Run verify-live.ps1 (or read the failed job): which service, and is live on old or new revision?
│     (per-service deploy is atomic; a failed service stays on its PRIOR revision)
│
├─ Failure was transient (image-push race, smoke timeout, GCP blip)?
│     └─ Re-run the failed job / dispatch that one service (deploys same main HEAD). Verify.
│
├─ Real regression in new code, live already flipped, users impacted?
│     └─ ROLLBACK that service now (§4: usually PRIMARY image) → then git revert on main (Option C).
│
├─ Real regression but live is still on the OLD good revision (deploy failed before the flip)?
│     └─ No rollback needed. Fix-forward: commit the fix, let CI redeploy. Live was never bad.
│
└─ Config/secret/infra cause (missing var, IAM)?
      └─ Fix config/infra out-of-band, then re-dispatch that service. Not a code rollback.
```

## 19b. Partial-deployment recovery

Apply the §19 tree per red service; green services need no action (they are live and, per §10, compatible).
Never mass-rollback the fleet.

## 20. Stale-guard interaction with rollback

The forward guard (`stale-deploy-guard.mjs`) does: if `triggerSha === origin/main` → deploy; else if the
range `trigger..main` touches this service → **superseded → skip**; else deploy. Interactions:

- **Retries / rapid pushes / manual forward dispatch:** correct as-is — a superseded older forward deploy
  should skip so the newest relevant commit wins.
- **Rollback:** a rollback **intentionally** targets an *older* state while main HEAD is ahead and (usually)
  touched that service. If rollback reused this guard it would be classified "superseded" and **refuse to
  run** — exactly the failure mode the spec warns about. Therefore **`rollback.yml` must not run the stale
  guard at all.** Its safety comes from a *different* invariant — explicit operator input + fail-closed
  target validation — not "am I the newest commit." This is a primary justification for a separate rollback
  workflow (§17). It shares only the forward path's per-service **concurrency** domain (§17c), not its guard.

## 21. Security

Covered inline in §17. Summary: read-only verify has no OIDC; rollback keeps the existing main-only WIF
gate; fixed enums + regex-validated targets + service-scoped AR resolution prevent
cross-service/arbitrary-image injection; env-quoted args; no config-mutating flags; no user URLs; no PR
code path gains credentials.

## 22. Cost impact

- `verify-live.yml`: a handful of `curl`s per run; per-deploy + 1×/day ≈ negligible Actions minutes → **≈ $0**.
- `rollback.yml`: runs only during incidents → **≈ $0**.
- AR cleanup: **reduces** storage slowly (a few MB per image).
- No paid monitoring, no new GCP resources. **Net cost ≈ zero.**

## 23. Scope boundary

2.6 is operational hardening only. Explicitly **excluded**: new product/tenant features, custom-domain
automation, a second environment, infra redesign, OAuth redesign, dependency/security-audit remediation,
and Firestore migration tooling (no current need). Published-site revision history and an audit log are
separate roadmap items (2.10 / 2.11) and are **out of scope** here.

## 24. Recommended 2.6 substeps (Rev 2 — observability first)

Order is now **observability → rollback → retention/docs**, so rollback is built and pre/post-checked on
top of already-proven serving-state visibility.

- **2.6a — Read-only live verification / serving-state visibility.** `scripts/verify-live.ps1` (read-only:
  serving-vs-latest, traffic table, serving-revision image/SHA/SA, `SERVING != LATEST` warning, public-host
  health) + `verify-live.yml` (`workflow_run` after Deploy MAIN + `workflow_dispatch` + daily `schedule`;
  `contents: read`, no OIDC). Also confirms the §3 **(verify)** unpinned-traffic precondition that PRIMARY
  image rollback relies on.
  *Verifiable:* run both; they report all four services (serving vs latest) + public hosts with no credentials.
- **2.6b — Rollback tooling + runbook.** `rollback.yml` (PRIMARY image + SECONDARY revision mechanisms, §16b
  validation, §17c shared per-service concurrency, §15 serving-state post-checks, no stale guard,
  SA-preserving) + `docs/operations/rollback.md` (§4 tree, §4b unpin recovery, when-not-to-rollback,
  cancel-stuck-forward note). **Reuses 2.6a serving-state tooling** for its pre/post checks.
  *Verifiable:* dry-run an image rollback of one non-critical service (renderer) in a controlled window;
  confirm new-latest-serving + SA-unchanged + smoke.
- **2.6c — Retention + final ops docs.** AR native keep-most-recent-versions policy (N=20/service) +
  `docs/operations/live-ops.md` + `docs/CI-CD.md` cross-links + the branch-protection note.
  *Verifiable:* the AR policy leaves ≥ N `git-<sha>` images per service; a dry-run lists only images beyond N.

Substeps are sequential by dependency-of-convenience (b reuses a); none is blocked by the others.

## 25. Files likely to change (new unless noted)

- `scripts/verify-live.ps1` *(new; 2.6a — includes `gcloud run revisions describe` for serving-revision identity)*
- `.github/workflows/verify-live.yml` *(new; 2.6a — no OIDC)*
- `.github/workflows/rollback.yml` *(new; 2.6b — shares `deploy-production-<service>` concurrency; image + revision mechanisms)*
- `docs/operations/rollback.md` *(new; 2.6b)*, `docs/operations/live-ops.md` *(new; 2.6c)*
- `docs/CI-CD.md` *(edit; 2.6c — cross-links + "live-deploy-passed is post-merge" note)*
- `scripts/ci/classify-changes.mjs` *(likely minor edit; 2.6a)* — `.github/` paths already classify
  no-deploy/no-CI, but a new top-level `scripts/verify-live.ps1` (or `scripts/ops/**`) at the `scripts/` root
  is **not** yet covered by a rule (only `scripts/ci/` and the `scripts/deploy-dev.ps1` tombstone are), so
  the fail-closed "unknown path" gate would trip. Add a `scripts/verify-live.ps1` (and/or `scripts/ops/`
  prefix) rule as `ci: [], deploy: []`. **Flag for the implementation step.**
- **AR cleanup policy** — a **GCP config change** (keep-most-recent-versions, N=20/service) applied in 2.6c;
  not a repo file. `scripts/ops/ar-cleanup.ps1` is optional and no longer required (native policy suffices).
- **No IAM changes** (§17d).

## 26. Blockers

- **None hard.** Every design decision is resolvable from the repo as-is.
- **(verify), read-only, at implementation time:** (a) each service's traffic is a single unpinned
  "100% → latest" entry — the precondition for clean PRIMARY image rollback, surfaced first by 2.6a;
  (b) per-service AR image counts, to confirm N=20 headroom; (c) live deployer grants still match the
  documented WIF set (§17d). None alters the design.

## 27. Is 2.6 ready to implement?

**Yes — ready.** Scope is well-bounded operational hardening (no new environments, no infra redesign, no
orchestration, no paid tooling); every mechanism builds on infrastructure already proven in the repo; and
the real subtleties — image-first rollback to avoid sticky traffic (§4b), serving-vs-latest visibility
(§15), shared per-service concurrency (§17c), and rollback bypassing the stale guard while never building —
are all resolved. **No IAM change is required.** Proceed with substeps **2.6a → 2.6b → 2.6c** (observability
first). The only implementation-time inputs are the read-only **(verify)** reads in §26, which do not gate
the design.
