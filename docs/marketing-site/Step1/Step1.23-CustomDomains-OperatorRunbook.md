# Step 1.23 Custom Domains — Operator Runbook

Step 1.23 uses one shared Google Cloud topology:

Global external Application Load Balancer → serverless NEG → shared `site-renderer` Cloud Run service.

TLS is provided by Google-managed Certificate Manager. Direct Cloud Run Domain Mapping is not part of this architecture. The application does not create or mutate Google Cloud, Certificate Manager, load-balancer, or DNS-provider resources.

The MAIN frontend is `34.8.236.85`. URL map `bakerrang-web-urlmap` uses Renderer as its default backend, so every unmatched host reaching the frontend is routed to Renderer with its Host header preserved. Do not add a per-customer URL-map host rule.

## Certificate coverage

BakerRang-owned test hosts under `*.bakerrang.com`, including `custom.bakerrang.com`, are covered by the existing wildcard entry in `bakerrang-web-cert-map` and `bakerrang-web-cert`. They do not need a separate certificate or cert-map entry.

An external customer hostname such as `www.customer.example` is not covered by the BakerRang wildcard. Before asking the customer to direct production traffic to the frontend, the operator must create a Google-managed certificate for that exact hostname and attach it to `bakerrang-web-cert-map`. For load-balancer authorization after the hostname points to the frontend, the resource pattern is:

```powershell
$ProjectId = "avian-cable-379805"
$Hostname = "www.customer.example"
$CertificateName = "customer-example-cert"
$MapEntryName = "customer-example-entry"

gcloud certificate-manager certificates create $CertificateName `
  --project=$ProjectId --domains=$Hostname
gcloud certificate-manager maps entries create $MapEntryName `
  --project=$ProjectId --map=bakerrang-web-cert-map `
  --certificates=$CertificateName --hostname=$Hostname
```

Use DNS authorization instead when certificate issuance must complete before traffic moves, following Certificate Manager's generated authorization record exactly. Resource names must be unique and operator-reviewed. Confirm the certificate is `ACTIVE` and the map entry targets the intended hostname before activation. Never attach an external customer hostname to the BakerRang wildcard entry.

## Platform configuration

Configure the Portal build with the shared load-balancer targets that operators may show while onboarding a domain:

```text
CUSTOM_DOMAIN_IPV4_ADDRESS=<global load-balancer IPv4 address>
CUSTOM_DOMAIN_CNAME_TARGET=<optional suitable subdomain CNAME target>
```

Do not advertise an AAAA record unless the platform has an explicit IPv6 value and supporting configuration. These values are platform environment configuration; they are not stored in Firestore or published site snapshots.

## Onboarding sequence

1. A `PLATFORM_ADMIN` registers the hostname in Manage Website → Custom Domain.
2. The customer creates the displayed `_bakerrang-verification.<hostname>` TXT record.
3. A `PLATFORM_ADMIN` selects **Verify TXT**. The domain becomes `VERIFIED` only when the exact current token resolves.
4. The operator confirms wildcard coverage for a BakerRang-owned `*.bakerrang.com` test hostname, or creates the external customer's dedicated certificate and cert-map entry as described above.
5. The customer points the hostname to the shared load balancer:
   - apex/domain: A record to `CUSTOM_DOMAIN_IPV4_ADDRESS`;
   - subdomain: use `CUSTOM_DOMAIN_CNAME_TARGET` only when the deployed platform provides a suitable target.
6. Wait for DNS propagation and certificate readiness, then verify HTTPS reaches the shared renderer.
7. A `PLATFORM_ADMIN` selects **Activate**.
8. Test `https://<hostname>/` and `https://<hostname>/contact` when the published Contact section uses Lead Form.
9. Confirm the normal shared published routes permanently redirect to the corresponding custom URLs. Shared DRAFT preview must not redirect.

The application registry is the routing and authorization boundary. MAIN's default URL-map backend already sends unmatched frontend hostnames to Renderer, so no separate URL-map host rule is needed per tenant.

## Disable and removal

- **Disable** stops application routing immediately, rotates the ownership token, and requires the new TXT token to be verified before activation can occur again. Certificate and DNS cleanup remains an operator decision.
- **Remove Domain** atomically releases both the authoritative hostname record and tenant pointer. A later registration receives a new token and must verify again.

Neither operation changes working site content or `published/current`.

## V1 boundaries

Step 1.23 supports exactly one hostname per tenant. `www`/apex forwarding, aliases, wildcards, registrar integration, DNS automation, Certificate Manager automation, Terraform generation, and domain purchase/renewal are intentionally deferred. Any `www`/apex forwarding is external/operator-managed in V1.
