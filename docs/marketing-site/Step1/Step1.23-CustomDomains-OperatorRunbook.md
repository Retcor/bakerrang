# Step 1.23 Custom Domains — Operator Runbook

Step 1.23 uses one shared Google Cloud topology:

Global external Application Load Balancer → serverless NEG → shared `site-renderer` Cloud Run service.

TLS is provided by Google-managed Certificate Manager. Direct Cloud Run Domain Mapping is not part of this architecture. The application does not create or mutate Google Cloud, Certificate Manager, load-balancer, or DNS-provider resources.

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
4. The operator adds Google-managed certificate coverage for the hostname to the shared global HTTPS load balancer.
5. The customer points the hostname to the shared load balancer:
   - apex/domain: A record to `CUSTOM_DOMAIN_IPV4_ADDRESS`;
   - subdomain: use `CUSTOM_DOMAIN_CNAME_TARGET` only when the deployed platform provides a suitable target.
6. Wait for DNS propagation and certificate readiness, then verify HTTPS reaches the shared renderer.
7. A `PLATFORM_ADMIN` selects **Activate**.
8. Test `https://<hostname>/` and `https://<hostname>/contact` when the published Contact section uses Lead Form.
9. Confirm the normal shared published routes permanently redirect to the corresponding custom URLs. Shared DRAFT preview must not redirect.

The application registry is the routing and authorization boundary. A separate URL-map host rule per tenant is not an application requirement when the load balancer default backend already sends all frontend hostnames to the renderer. If the deployed load balancer is configured more restrictively, the operator must add the required host rule as infrastructure work before activation; that rule is not application state.

## Disable and removal

- **Disable** stops application routing immediately, rotates the ownership token, and requires the new TXT token to be verified before activation can occur again. Certificate and DNS cleanup remains an operator decision.
- **Remove Domain** atomically releases both the authoritative hostname record and tenant pointer. A later registration receives a new token and must verify again.

Neither operation changes working site content or `published/current`.

## V1 boundaries

Step 1.23 supports exactly one hostname per tenant. `www`/apex forwarding, aliases, wildcards, registrar integration, DNS automation, Certificate Manager automation, Terraform generation, and domain purchase/renewal are intentionally deferred. Any `www`/apex forwarding is external/operator-managed in V1.
