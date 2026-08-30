# Step 2.5d — MAIN Load Balancer + DNS/TLS Cutover Plan (analysis)

> **Planning / read-only.** Companion to
> [Step2.5d-MainLoadBalancerCutover-Spec.md](Step2.5d-MainLoadBalancerCutover-Spec.md). No GCP,
> DNS, certificate, GitHub, or Cloud Run change is performed by producing this document. Live-state
> facts below were captured with read-only `gcloud` (compute, run, dns, certificate-manager) and
> `Resolve-DnsName` on 2026-08-29 and reconciled against `server/` + `docs/`.

## 0. The finding that shapes the cert plan (CORRECTED)

> **Correction (supersedes the earlier "apex deferred to 2.5e" conclusion).** The prior plan assumed
> a domain has exactly one `_acme-challenge.<name>` CNAME slot, so MAIN could not authorize the apex
> while DEV's `_acme-challenge.bakerrang.com` existed. That is wrong for this case: Certificate
> Manager DNS authorizations have a **`type`** — DEV's is the default **`FIXED_RECORD`** (uses the
> fixed `_acme-challenge.bakerrang.com`), but MAIN can create a **`PER_PROJECT_RECORD`**
> authorization for the *same* domain, which emits a **project-unique** validation name
> (`_acme-challenge_<project-specific-id>.bakerrang.com`) that does **not** collide with DEV's fixed
> record. The two projects independently hold live authorizations + wildcard certs for
> `bakerrang.com` at once — exactly the supported PER_PROJECT_RECORD use case.

Consequences:
- MAIN creates **one** authorization `bakerrang-main-auth` (domain `bakerrang.com`,
  `PER_PROJECT_RECORD`) and **one** cert `bakerrang-web-cert` = `bakerrang.com` + `*.bakerrang.com`.
  A single parent-domain authorization covers both the apex and the wildcard.
- That one cert covers `bakerrang.com`, `api`, `portal`, `sites`, `www`, and `custom.bakerrang.com`
  (every single-label subdomain).
- DEV's `bakerrang-dev-auth` (FIXED_RECORD) and its `_acme-challenge.bakerrang.com` CNAME are **left
  untouched**; DEV stays fully intact as rollback throughout 2.5d.
- **The apex no longer waits on DEV decommission.** MAIN provisions apex + wildcard before any
  cutover, and the apex is cut over **last within 2.5d** (§8/§16). **2.5e is reduced to DEV cleanup
  only** (§21) — it no longer owns any apex certificate migration.

---

## Output 1 — Current ingress / DNS / cert state (verified)

**Cloud Run domain mappings (us-west1), all `Ready`:**

| Host | Route | Notes |
|---|---|---|
| `bakerrang.com` | `bakerrang-client` | live apex |
| `api.bakerrang.com` | `bakerrang-api` | live API |
| `claude-exam.bakerrang.com` | `claude-practice-exam` | unrelated app, same project |
| `danbaker.info` | `danbaker-info` | unrelated (chatbot origin) |
| `plex-requests.bakerrang.com` | `seerr-proxy` | unrelated |

`portal.bakerrang.com`, `sites.bakerrang.com`, `www.bakerrang.com` have **no** mapping and **no**
DNS — Portal/Renderer are currently reachable only at their `*.run.app` URLs.

**Compute LB inventory (MAIN): empty.** Zero forwarding rules, url-maps, backend-services,
serverless NEGs, target proxies, classic SSL certs. The reserved global IPv4 `bakerrang-web-ip` =
`34.8.236.85` is `RESERVED` (unattached). **There is no MAIN load balancer yet — it is greenfield.**

**Certificate Manager (MAIN): empty** (0 certs, 0 maps, 0 dns-authorizations), API enabled.

**DNS is in-project** — Cloud DNS managed zone `bakerrang-client` for `bakerrang.com.`
(so all cutover records are `gcloud dns` operations here, not an external registrar). Authoritative
records today:

| Name | Type | TTL | Data |
|---|---|---|---|
| `bakerrang.com.` | A / AAAA | 300 | `216.239.32/34/36/38.21` + IPv6 (Cloud Run anycast) |
| `api.bakerrang.com.` | CNAME | 300 | `ghs.googlehosted.com.` (Cloud Run mapping) |
| `_acme-challenge.bakerrang.com.` | CNAME | 300 | DEV wildcard auth (see §0) |
| `api-dev/portal-dev/sites-dev/custom-dev` | A | 300 | `8.232.231.135` (DEV LB) |
| `custom.bakerrang.com.` | — | — | **absent** → available as the safe test host |

Runtime SAs: `bakerrang-api`→`bakerrang-api@`; `bakerrang-portal`/`bakerrang-site-renderer`→
`bakerrang-frontend@`; **`bakerrang-client`→`307696703523-compute@developer…` (default compute SA —
still needs migration, §10/§11).** API confirmed on platform revision `bakerrang-api-00028-q9c`.

---

## Output 2 — Target MAIN LB architecture

**One global external Application Load Balancer** (`EXTERNAL_MANAGED`, Premium tier) on
`34.8.236.85`, HTTPS-terminating, fronting four Cloud Run services via serverless NEGs:

```
                      34.8.236.85 (bakerrang-web-ip)
                               │
                    [:443 global forwarding rule]
                               │
                target-https-proxy (+ certificate map)
                               │
                          URL map (host routing)
   ┌───────────────┬───────────────┬───────────────┬─────────────── default
   │ api.*         │ portal.*      │ sites.*       │ apex+www       (custom
   ▼               ▼               ▼               ▼                 domains)▼
 api-backend    portal-backend  renderer-backend client-backend   renderer-backend
   │               │               │               │                 │
 api-neg        portal-neg      renderer-neg     client-neg        (same renderer)
   ▼               ▼               ▼               ▼
 bakerrang-api  bakerrang-portal bakerrang-site-renderer  bakerrang-client
```

**Host routing:** `api`→api; `portal`→portal; `sites`→renderer; `bakerrang.com`/`www`→client;
**default (any unmatched Host, i.e. customer custom domains)→renderer**. The external ALB
**preserves the original Host header** to Cloud Run by default — no rewrite — so the renderer
resolves `siteDomains/{hostname}` and the API applies Host-based CORS/lead rules
([origins.js](../../../server/config/origins.js)) exactly as they do behind the current mappings.
**No path rewriting** anywhere: each path matcher only sets a default backend, so `/`, `/contact`,
etc. pass through verbatim.

All hosts including apex/`www` are cut over within 2.5d; their DNS moves to the LB in the §8
sequence once `bakerrang-web-cert` is `ACTIVE` (§0 correction).

---

## Output 3 — Exact GCP resources required

- 4 serverless NEGs (us-west1): `bakerrang-api-neg`, `bakerrang-client-neg`,
  `bakerrang-portal-neg`, `bakerrang-renderer-neg`.
- 4 global backend services (`EXTERNAL_MANAGED`, no CDN, no health checks — not applicable to
  serverless NEGs): `bakerrang-api-backend`, `bakerrang-client-backend`,
  `bakerrang-portal-backend`, `bakerrang-renderer-backend`.
- 1 URL map: `bakerrang-web-urlmap` (default = renderer backend).
- Certificate Manager: **one** DNS authorization `bakerrang-main-auth` (domain `bakerrang.com`,
  `PER_PROJECT_RECORD`); **one** managed cert `bakerrang-web-cert` = `bakerrang.com` + `*.bakerrang.com`;
  one cert map `bakerrang-web-cert-map` with two entries (`bakerrang.com`, `*.bakerrang.com`) plus
  per-customer entries later.
- 1 target HTTPS proxy `bakerrang-web-https-proxy` (references url-map + cert map).
- 1 global forwarding rule `bakerrang-web-https` (:443 → proxy, `--address=bakerrang-web-ip`).
- *(optional)* HTTP→HTTPS redirect: url-map `bakerrang-web-redirect` + `bakerrang-web-http-proxy` +
  `bakerrang-web-http` (:80). See §7.

Reuses the already-reserved IP; **no new IP**.

---

## Output 4 — Exact gcloud creation commands (2.5d-1, no live impact)

```powershell
$P="avian-cable-379805"; $R="us-west1"

# 1) Serverless NEGs
foreach ($m in @(
  @{neg="bakerrang-api-neg";      svc="bakerrang-api"},
  @{neg="bakerrang-client-neg";   svc="bakerrang-client"},
  @{neg="bakerrang-portal-neg";   svc="bakerrang-portal"},
  @{neg="bakerrang-renderer-neg"; svc="bakerrang-site-renderer"})) {
  gcloud compute network-endpoint-groups create $($m.neg) `
    --project=$P --region=$R `
    --network-endpoint-type=serverless `
    --cloud-run-service=$($m.svc)
}

# 2) Backend services (global external managed; no CDN)
foreach ($m in @(
  @{be="bakerrang-api-backend";      neg="bakerrang-api-neg"},
  @{be="bakerrang-client-backend";   neg="bakerrang-client-neg"},
  @{be="bakerrang-portal-backend";   neg="bakerrang-portal-neg"},
  @{be="bakerrang-renderer-backend"; neg="bakerrang-renderer-neg"})) {
  gcloud compute backend-services create $($m.be) `
    --project=$P --global --load-balancing-scheme=EXTERNAL_MANAGED
  gcloud compute backend-services add-backend $($m.be) `
    --project=$P --global `
    --network-endpoint-group=$($m.neg) --network-endpoint-group-region=$R
}

# 3) URL map: default -> renderer (custom domains); host rules for the rest
gcloud compute url-maps create bakerrang-web-urlmap `
  --project=$P --global --default-service=bakerrang-renderer-backend
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=client-matcher --default-service=bakerrang-client-backend `
  --new-hosts="bakerrang.com,www.bakerrang.com"
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=api-matcher --default-service=bakerrang-api-backend `
  --new-hosts="api.bakerrang.com"
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=portal-matcher --default-service=bakerrang-portal-backend `
  --new-hosts="portal.bakerrang.com"
gcloud compute url-maps add-path-matcher bakerrang-web-urlmap --project=$P --global `
  --path-matcher-name=sites-matcher --default-service=bakerrang-renderer-backend `
  --new-hosts="sites.bakerrang.com"

# 4) ONE PER_PROJECT_RECORD DNS authorization for the parent domain (DO FIRST — long pole).
#    PER_PROJECT_RECORD emits a project-unique _acme-challenge_<id>.bakerrang.com name, so it does
#    NOT collide with DEV's fixed _acme-challenge.bakerrang.com (which stays untouched).
gcloud certificate-manager dns-authorizations create bakerrang-main-auth --project=$P `
  --domain="bakerrang.com" --type=PER_PROJECT_RECORD
gcloud certificate-manager dns-authorizations describe bakerrang-main-auth --project=$P `
  --format="value(dnsResourceRecord.name,dnsResourceRecord.type,dnsResourceRecord.data)"
# -> add EXACTLY the printed record to zone bakerrang-client, verbatim, e.g.:
#      gcloud dns record-sets create <printed .name> --zone=bakerrang-client --project=$P `
#        --type=CNAME --ttl=300 --rrdatas="<printed .data>"
#    Do not hand-craft the name; copy it. Do not modify _acme-challenge.bakerrang.com (DEV's).

# 5) ONE managed cert covering apex + wildcard (covers api/portal/sites/www/custom too)
gcloud certificate-manager certificates create bakerrang-web-cert --project=$P `
  --domains="bakerrang.com,*.bakerrang.com" `
  --dns-authorizations="bakerrang-main-auth"

# 6) Cert map + two explicit entries (per-customer entries added later, §5 of the plan)
gcloud certificate-manager maps create bakerrang-web-cert-map --project=$P
gcloud certificate-manager maps entries create bakerrang-apex-entry --project=$P `
  --map=bakerrang-web-cert-map --certificates=bakerrang-web-cert --hostname="bakerrang.com"
gcloud certificate-manager maps entries create bakerrang-wildcard-entry --project=$P `
  --map=bakerrang-web-cert-map --certificates=bakerrang-web-cert --hostname="*.bakerrang.com"

# 7) HTTPS proxy (cert MAP, not --ssl-certificates) + :443 forwarding rule on the reserved IP
gcloud compute target-https-proxies create bakerrang-web-https-proxy --project=$P `
  --url-map=bakerrang-web-urlmap --certificate-map=bakerrang-web-cert-map
gcloud compute forwarding-rules create bakerrang-web-https --project=$P --global `
  --load-balancing-scheme=EXTERNAL_MANAGED --network-tier=PREMIUM `
  --address=bakerrang-web-ip --target-https-proxy=bakerrang-web-https-proxy --ports=443
```

**Validate before any DNS flip** (proves LB + cert + Host routing off-DNS):
```powershell
gcloud certificate-manager certificates describe bakerrang-web-cert --project=$P --format="value(managed.state)"  # want ACTIVE
curl.exe -s --resolve portal.bakerrang.com:443:34.8.236.85 https://portal.bakerrang.com/ -o NUL -w "%{http_code}`n"
curl.exe -s --resolve sites.bakerrang.com:443:34.8.236.85  https://sites.bakerrang.com/robots.txt
curl.exe -s --resolve api.bakerrang.com:443:34.8.236.85    https://api.bakerrang.com/health
```

---

## Output 5 — Custom-domain TLS plan

Per [Step 1.23 runbook](../Step1/Step1.23-CustomDomains-OperatorRunbook.md), the **application never
touches GCP/Cert Manager/LB/DNS** — custom-domain cert provisioning is a **manual operator step**
(runbook step 4: "the operator adds Google-managed certificate coverage for the hostname to the
shared global HTTPS load balancer"). There is **no on-demand/automatic certificate automation** in
the codebase. So the concrete plan per customer domain `customer.example.com`:

1. Customer registers + TXT-verifies + `ACTIVE`s the domain in the Portal (app-level ownership; this
   only writes `siteDomains/{hostname}` — no GCP change).
2. Operator creates a Certificate Manager managed cert for that host and a **cert-map entry**
   `--hostname=customer.example.com --certificates=<that cert>` on `bakerrang-web-cert-map`. Because
   the customer points their domain at the LB IP, **load-balancer authorization** is the natural
   fit (no `_acme-challenge` step for them); DNS authorization is an alternative if pre-provisioning
   is wanted. Adding a map entry does **not** recreate the proxy — the LB scales to many customer
   certs cleanly. This is exactly why the proxy uses a **certificate map**, not `--ssl-certificates`.
3. Customer sets `A customer.example.com → 34.8.236.85`.
4. Request flow verified: `customer.example.com → 34.8.236.85 → default (renderer) backend → Host
   preserved → renderer calls the public API → API resolves `siteDomains/{hostname}` → tenant`.
   Confirmed against source: the URL-map default backend is the renderer, Host is preserved, and
   `resolveActiveDomain` ([siteDomainService.js:231](../../../server/services/siteDomainService.js))
   is the authorization boundary. **This works with the LB as designed.**

No per-tenant URL-map host rule is required (the default backend already sends every unmatched Host
to the renderer) — matching the runbook.

---

## Output 6 — BakerRang-owned certificate plan (CORRECTED)

**One** Certificate Manager managed cert `bakerrang-web-cert` = `bakerrang.com` + `*.bakerrang.com`,
provisioned via **one** `PER_PROJECT_RECORD` DNS authorization `bakerrang-main-auth` on the parent
domain `bakerrang.com` (§0). A single parent-domain authorization is sufficient to issue both the
apex and the wildcard. This one cert covers **every** owned hostname —
`bakerrang.com, api, portal, sites, www, custom.bakerrang.com` — so the four separate
api/portal/sites/www authorizations and the SAN cert built on them from the earlier draft are
**removed**.

DNS authorization (not LB authorization) is still chosen so the cert is **`ACTIVE` before any DNS
flips** → zero-downtime for the live `api` **and** apex hosts. Because `PER_PROJECT_RECORD` uses a
project-unique validation name, this is done **without touching DEV's `_acme-challenge.bakerrang.com`**;
DEV's `bakerrang-dev-auth`/`bakerrang-dev-cert` remain live as rollback throughout 2.5d.

Scope notes: `*.bakerrang.com` covers only single-label subdomains (all of ours qualify; none are
multi-label). Keep per-customer domains as their **own** managed certs + cert-map entries (§5).

**New risks introduced by `PER_PROJECT_RECORD` + wildcard (none blocking):**
- **Single-cert blast radius.** One cert now backs apex + every subdomain, so a provisioning/renewal
  failure would affect all owned hosts at once (vs. independent per-host certs). Cert Manager
  auto-renews well ahead; mitigate by monitoring `bakerrang-web-cert` state and alerting on non-ACTIVE.
- **Wildcard on the default (renderer) backend widens catch-all.** With a valid `*.bakerrang.com`
  cert, any unmatched `<x>.bakerrang.com` Host pointed at `34.8.236.85` now completes TLS and reaches
  the renderer (which 404s unless it's a tenant). This is the intended custom-domain behavior, but it
  means owned subdomains **must** have explicit URL-map host rules (they do: api/portal/sites/apex);
  anything else silently falls to the renderer. No security exposure (the renderer only serves
  published tenant content), but keep host rules exhaustive.
- **Two live authorizations for one domain.** DEV (FIXED_RECORD) and MAIN (PER_PROJECT_RECORD) now
  both hold `bakerrang.com` authorizations + wildcard certs. Supported and independent, but the zone
  carries **two** `_acme-challenge*` CNAMEs — do not delete either while its project's cert is in use.
  2.5e removes only DEV's.
- **Copy the generated record exactly.** The `PER_PROJECT_RECORD` name/value is generated; add it
  verbatim from `dns-authorizations describe`. Hand-crafting the `_acme-challenge_<id>` name will
  fail validation (low-severity, self-evident at provisioning time).

---

## Output 7 — HTTP vs HTTPS forwarding rule

- **HTTPS :443 rule is required** (1 rule minimum).
- **HTTP :80 redirect rule is optional and ~free.** A GCP global external ALB bills a base
  proxy/LB hour that **includes up to 5 forwarding rules**; a 2nd rule (the :80 redirect) stays
  within that bundle → **no meaningful additional recurring charge** (data-processing is per-GB and
  rule-count-independent).
- **Recommendation:** add the :80 → :443 redirect (url-map `defaultUrlRedirect.httpsRedirect=true`).
  It is essentially free, prevents "connection refused" for users typing a bare hostname, and helps
  SEO/canonicalization. HTTPS-only is acceptable if absolute-minimum resource count is preferred;
  the cost argument does not favor omitting it.

---

## Output 8 — DNS cutover sequence (exact records)

Order (safest → riskiest), all in Cloud DNS zone `bakerrang-client`:

1. **portal.bakerrang.com** (new; no existing record):
   `gcloud dns record-sets create portal.bakerrang.com. --zone=bakerrang-client --project=$P --type=A --ttl=300 --rrdatas=34.8.236.85`
2. **sites.bakerrang.com** (new): same, name `sites.bakerrang.com.`
3. **custom.bakerrang.com** (new; controlled test host, §15): same. *(Also register/verify/activate
   it as a real tenant custom domain in the Portal to exercise the full custom-domain path.)*
4. **api.bakerrang.com** — swap CNAME→A via transaction (capture rollback first):
   ```powershell
   gcloud dns record-sets transaction start --zone=bakerrang-client --project=$P
   gcloud dns record-sets transaction remove --zone=bakerrang-client --project=$P `
     --name=api.bakerrang.com. --type=CNAME --ttl=300 "ghs.googlehosted.com."
   gcloud dns record-sets transaction add --zone=bakerrang-client --project=$P `
     --name=api.bakerrang.com. --type=A --ttl=60 "34.8.236.85"
   gcloud dns record-sets transaction execute --zone=bakerrang-client --project=$P
   ```
   Pre-lower the TTL to 60 a day ahead (edit the existing CNAME's TTL) so rollback propagates fast.
5. **bakerrang.com (apex) — LAST, within 2.5d** (no longer deferred, §0/§6). Swap the apex `A`
   **and `AAAA`** via transaction (capture rollback first):
   ```powershell
   gcloud dns record-sets transaction start --zone=bakerrang-client --project=$P
   gcloud dns record-sets transaction remove --zone=bakerrang-client --project=$P `
     --name=bakerrang.com. --type=A --ttl=300 "216.239.32.21" "216.239.34.21" "216.239.36.21" "216.239.38.21"
   gcloud dns record-sets transaction remove --zone=bakerrang-client --project=$P `
     --name=bakerrang.com. --type=AAAA --ttl=300 "2001:4860:4802:32::15" "2001:4860:4802:34::15" "2001:4860:4802:36::15" "2001:4860:4802:38::15"
   gcloud dns record-sets transaction add --zone=bakerrang-client --project=$P `
     --name=bakerrang.com. --type=A --ttl=60 "34.8.236.85"
   gcloud dns record-sets transaction execute --zone=bakerrang-client --project=$P
   ```
   The LB is IPv4-only in 2.5d, so the apex `AAAA` is **removed** (do not leave a stale IPv6 pointing
   at Cloud Run). Pre-lower the apex `A`/`AAAA` TTL to 60 a day ahead.

Target for every host: `A → 34.8.236.85`. New hosts are added only **after** `bakerrang-web-cert` is
`ACTIVE` and the `curl --resolve` check passes. DEV stays intact as rollback the entire time.

---

## Output 9 — Cloud Run domain-mapping retirement

Keep **both** existing mappings (`api.bakerrang.com→bakerrang-api`, `bakerrang.com→bakerrang-client`)
in place throughout 2.5d. **No conflict:** a hostname's DNS resolves to exactly one target; while it
points at `34.8.236.85` the mapping simply receives no traffic but stays valid as an **instant
rollback** (flip DNS back to `ghs`/anycast). The serverless NEG targets the Cloud Run **service**,
independent of the mapping, so both ingresses coexist. **Retire mappings only after** the LB path is
proven and you're ready to give up the DNS-rollback target — earliest at the end of 2.5d for **both**
`api` and apex (both are now cut in 2.5d). Prefer keeping them until 2.5e alongside DEV. Removal
command (later, not now):
`gcloud beta run domain-mappings delete --domain api.bakerrang.com --region us-west1 --project $P`.

---

## Output 10 — Client runtime-SA migration recommendation

Current `bakerrang-client` runs as the **default compute SA**; target `bakerrang-frontend@`. The
client is a **static SPA** needing ~no GCP permissions at runtime, so `bakerrang-frontend@`
(near-zero perms) is safe. This is a live, one-time revision change and must **not** be combined with
an image deploy:
```powershell
gcloud run services update bakerrang-client --project=$P --region=$R `
  --service-account=bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com
```
**Timing: after LB ingress is proven (portal/sites/api) and before enabling automatic MAIN client
deploys — i.e. in substep 2.5d-3, isolated.** Rationale: (a) it's independent of ingress, so keep it
off the critical path; (b) the deployer already holds `serviceAccountUser` on `bakerrang-frontend@`
(bootstrap doc) but **lacks actAs on the default compute SA**, so CI cannot image-update the client
until this migration lands — making it the prerequisite for client auto-deploy (§19). Verify the
client still serves (its `*.run.app` and, if apex already on LB, the site) on the new revision;
rollback = re-run the same command with the previous SA.

---

## Output 11 — Client deployment recommendation

**A — leave the current Client image untouched during ingress cutover.** The live client already
falls back to `https://api.bakerrang.com` (the `VITE_API_BASE_URL` addition is non-breaking), and as
a Host-agnostic static SPA it serves identically behind the LB. There is **no functional need** to
redeploy it for 2.5d. Redeploy only when a real client code change requires it, and do that through
CI **after** the SA migration (§10). This keeps the risky client image change fully decoupled from
ingress. (Option B — moving client into AR/CI before apex — buys nothing for 2.5d and adds risk.)

---

## Output 12 — Portal verification plan (browser, real hostname)

`*.run.app` cannot prove browser auth (cookies/CSRF/CORS are keyed to `*.bakerrang.com`). Once
`portal.bakerrang.com` resolves through the LB (api may still be on its mapping — fine):
- `GET https://portal.bakerrang.com/` → 200, app shell renders.
- Login: navigates to `https://api.bakerrang.com/auth/google?target=portal` → Google → API callback
  → **redirects back to `https://portal.bakerrang.com`** (proves `target=portal` + `PORTAL_DOMAIN`
  from 2.5c). No Google OAuth console change is required (callback stays on the API domain; portal
  uses the server redirect flow).
- Session cookie present on `portal→api` XHR (`credentials:'include'`, `SameSite=lax`, same-site
  under `bakerrang.com`); `GET /auth/check` → authenticated.
- `GET /tenants` returns data (PLATFORM_ADMIN); create a business (CSRF token fetched from
  `/auth/csrf`, `x-csrf-token` attached; write succeeds).
- Confirm no CORS errors in console (API allows `PORTAL_DOMAIN` from 2.5c).

---

## Output 13 — Renderer verification plan

Once `sites.bakerrang.com` resolves through the LB (create/publish a test tenant in the Portal
first, §14 needs it):
- `GET https://sites.bakerrang.com/robots.txt` → 200 with `User-agent` (LB smoke parity).
- Published tenant route renders; `/contact` renders (Lead Form path if configured).
- SEO/canonical: canonical/robots behavior matches `SITE_PUBLIC_ORIGIN`/indexing config.
- Public site API reachable renderer→api (server-side fetch to `api.bakerrang.com`).
- **Media loads from `bakerrang-media-marketing`** (public-read `<img>` URLs 200; no mixed-content).

---

## Output 14 — Custom-domain verification plan

Use the **BakerRang-owned** test host **`custom.bakerrang.com`** (absent today → safe; we control
its DNS). Register+verify+activate it as a tenant custom domain in the Portal, add its cert-map
entry, then `A custom.bakerrang.com → 34.8.236.85`, and verify:
- DNS resolves to `34.8.236.85`; TLS valid (its managed cert `ACTIVE`).
- Host reaches renderer (default backend); `resolveActiveDomain('custom.bakerrang.com')` → correct
  tenant; `/` and `/contact` render; canonical/redirect behavior correct (shared published URL
  permanently redirects to the custom URL; DRAFT preview does **not** redirect — per runbook).
Only after this passes should a real customer domain be onboarded.

---

## Output 15 — API cutover procedure + rollback

**Preconditions:** `bakerrang-web-cert` `ACTIVE` for `api.bakerrang.com`; LB api path proven via
`curl --resolve api.bakerrang.com:443:34.8.236.85 …/health` → `Healthy`; api CNAME TTL pre-lowered to
60; rollback value captured (`api.bakerrang.com CNAME ghs.googlehosted.com`).

**Cut:** the §8 step-4 transaction (CNAME→A `34.8.236.85`).

**Verify (browser + curl):** `/health`; Google login end-to-end; `/auth/check`; one legacy feature
(vault/TTS); a Portal API call; a public/lead endpoint. **Also verify behind-the-LB proxy semantics
that changed with the extra hop:** (a) secure session cookie still set (`Secure`, via
`X-Forwarded-Proto=https` + `trust proxy:1`), and (b) per-IP rate-limit / lead keying still sees the
real client IP (`req.ip`) rather than an LB address. These are the two things the added LB hop can
perturb — check explicitly.

**Rollback (fast):** reverse transaction —
```powershell
gcloud dns record-sets transaction start --zone=bakerrang-client --project=$P
gcloud dns record-sets transaction remove --zone=bakerrang-client --project=$P --name=api.bakerrang.com. --type=A --ttl=60 "34.8.236.85"
gcloud dns record-sets transaction add    --zone=bakerrang-client --project=$P --name=api.bakerrang.com. --type=CNAME --ttl=300 "ghs.googlehosted.com."
gcloud dns record-sets transaction execute --zone=bakerrang-client --project=$P
```
The Cloud Run mapping is still live, so this restores service within one (60s) TTL.

---

## Output 16 — Apex cutover procedure + rollback (CORRECTED — now in 2.5d, LAST)

**In 2.5d, as the final DNS flip** (§0/§8). `bakerrang-web-cert` (= `bakerrang.com` + `*.bakerrang.com`)
is already `ACTIVE` from 2.5d-1, so the apex cert is ready **before** the flip — zero-downtime, with
DEV untouched.

**Preconditions:** `bakerrang-web-cert` `ACTIVE`; apex path proven off-DNS
(`curl --resolve bakerrang.com:443:34.8.236.85 https://bakerrang.com/`); api already proven behind
the LB; the `bakerrang.com→bakerrang-client` mapping still intact; apex `A`/`AAAA` TTL pre-lowered to
60; rollback values captured.

**Cut:** the §8 step-5 transaction — remove apex `A` (Cloud Run anycast) **and `AAAA`**, add
`A → 34.8.236.85`. The LB is IPv4-only in 2.5d, so leave no apex `AAAA`.

**Verify:** `/`, SPA assets, a deep SPA route on refresh, login, and legacy client→API calls.

**Rollback (fast):** reverse the transaction — restore apex `A` to the Cloud Run anycast set
(`216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21`) and `AAAA` to the IPv6 quad
(`2001:4860:4802:32::15`, `:34::15`, `:36::15`, `:38::15`), which the still-present
`bakerrang.com→bakerrang-client` mapping serves. Restores service within one (60s) TTL.

---

## Output 17 — Automatic MAIN deployment activation plan

Target: `push main → auto MAIN deploy`, DEV auto-deploy removed, **never both at once**.
- Both are `push:main` triggers, so flip them in **one atomic commit**: remove the `push:main`
  trigger from `deploy-dev.yml` (keep it dispatch-only or delete it) **and** add a `push:main`
  auto-deploy path for MAIN. Reuse the audited `_deploy-cloud-run.yml` (image-only, digest-verified,
  runtime-SA-unchanged assertion) with `environment: production`; drive service selection from
  `classify-changes.mjs`. This preserves the 2.5c invariant that env/secret config is applied
  out-of-band and survives image-only updates.
- **Client gating:** the deployer cannot image-update the client until the SA migration (§10). So
  enable auto-deploy for **api/portal/renderer first**; include **client only after** 2.5d-3's SA
  migration — otherwise an auto client deploy fails on missing actAs.
- Keep deploy smoke on `*.run.app` (§18).

---

## Output 18 — Public smoke vs deployment smoke

Keep them separate. The deploy workflow continues smoking **`*.run.app` (`status.url`)** — do **not**
modify it in 2.5d to smoke public DNS (that couples deploy success to DNS/cert state and to the LB).
After cutover, add a **separate, lightweight public-host smoke** (a scheduled/manual check hitting
`https://api.bakerrang.com/health`, `https://portal.bakerrang.com/`, `https://sites.bakerrang.com/robots.txt`)
as its own job — evaluated then, not folded into the image deploy.

---

## Output 19 — Documentation updates (after real commands run)

- [docs/infra/live-environment-bootstrap.md](../../infra/live-environment-bootstrap.md): add a
  **"MAIN load balancer"** section with the §4 create commands, the **certificate-map** design, the
  single `PER_PROJECT_RECORD` authorization `bakerrang-main-auth` + its project-unique
  `_acme-challenge_<id>.bakerrang.com` CNAME + the apex+wildcard cert `bakerrang-web-cert`, the §7
  forwarding-rule decision, the §8 DNS cutover transactions (incl. the apex A/AAAA swap), and the §9
  mapping-retirement rule. Record that DEV's FIXED_RECORD authorization coexists untouched and that
  the full apex cutover (incl. `www`) completes **within 2.5d**.
- [docs/CI-CD.md](../../CI-CD.md): document the auto-MAIN/remove-auto-DEV flip (§17) and the client
  SA-migration prerequisite for client auto-deploy; note public-smoke stays separate (§18).
- Custom-domain operator cert steps (§5) → extend
  [Step1.23-CustomDomains-OperatorRunbook.md](../Step1/Step1.23-CustomDomains-OperatorRunbook.md)
  with the exact cert-map-entry command once first used.

---

## Output 20 — Cost implications

- **Forwarding rules:** 1 (:443) or 2 (+:80 redirect) — both within the LB's included 5-rule bundle
  → the redirect adds **no meaningful recurring cost** (§7).
- **Reserved IPs:** exactly **1** (already reserved; an in-use global IP attached to a forwarding
  rule is not separately charged). No IPv6 IP (no AAAA on the LB in 2.5d).
- **Serverless NEGs:** free. **Backend services:** free (no per-backend charge).
- **Certificate Manager:** Google-managed certs + DNS authorizations at this scale are **$0**
  (well under free limits).
- **No CDN** → no cache/egress surcharge.
- **Net new recurring ≈ one global external ALB** (~$0.025/hr base ≈ ~$18/mo) **+ per-GB data
  processing**. This is the simplest architecture meeting HTTPS + custom domains + Host routing +
  Cloud Run.

---

## Output 21 — Recommended 2.5d substeps

- **2.5d-1 — LB foundation** (§4): NEGs, backends, url-map, **one `PER_PROJECT_RECORD` DNS auth +
  one apex+wildcard cert + cert map (two entries)**, HTTPS proxy, :443 rule, optional :80 redirect.
  **Zero live impact.** Independently verifiable via `curl --resolve` against `34.8.236.85` before
  any DNS change.
- **2.5d-2 — BakerRang DNS/TLS cutover**: portal → sites → custom-test → **api** → **apex LAST**
  (§8/§12/§13/§14/§15/§16). The apex is **included** in 2.5d now (§0 correction).
- **2.5d-3 — Client SA migration + auto-deploy activation** (§10/§17): migrate client runtime SA,
  then atomically enable auto-MAIN (api/portal/renderer; client once SA-migrated) and remove
  auto-DEV.
- **2.5e (out of scope here)** — **DEV cleanup only**: decommission DEV Cloud Run/LB/WIF and remove
  DEV's `bakerrang-dev-auth`/`bakerrang-dev-cert` + its `_acme-challenge.bakerrang.com` CNAME. **No
  apex certificate migration lives here anymore** — MAIN already owns its apex+wildcard cert.

This matches the brief's suggested split, with the apex fully handled inside 2.5d.

---

## Output 22 — Blockers before execution

1. **Apex is no longer blocked** (§0 correction) — `PER_PROJECT_RECORD` lets MAIN authorize
   `bakerrang.com` independently of DEV. The apex is cut in 2.5d, last.
2. **Client auto-deploy is blocked** until the client runtime SA is migrated to `bakerrang-frontend@`
   (deployer lacks actAs on the default compute SA).
3. **`bakerrang-web-cert` must be `ACTIVE`** (the `PER_PROJECT_RECORD` CNAME added verbatim +
   provisioned) **before** announcing any A record — it gates every host including apex/api for
   zero-downtime.
4. **Nothing blocks 2.5d-1** — the entire LB foundation is additive and carries no live impact until a
   forwarding rule + DNS point at it.

---

## Output 23 — Safest first human action

**Create the one `PER_PROJECT_RECORD` DNS authorization `bakerrang-main-auth` (domain
`bakerrang.com`) and add its printed project-unique `_acme-challenge_<id>.bakerrang.com` CNAME
verbatim** (§4 step 4), then create `bakerrang-web-cert` (`bakerrang.com` + `*.bakerrang.com`). This
is the safest first move: it has **zero serving impact** (the new record doesn't affect any live
hostname), it **does not touch DEV's `_acme-challenge.bakerrang.com`** or the apex/api records, and
it starts the **long-pole** (cert provisioning, ~15–60 min) so it runs in parallel while the
NEGs/backends/url-map/proxy are built. Then stand up the rest of 2.5d-1 and prove it entirely with
`curl --resolve … 34.8.236.85` **before** the first real DNS flip (`portal`).

(If a strictly no-DNS-writes first action is preferred, create the four serverless NEGs first — also
zero live impact — and add the one `PER_PROJECT_RECORD` CNAME immediately after.)
