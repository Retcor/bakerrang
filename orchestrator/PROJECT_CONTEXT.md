# BakerRang Project Context

These are durable architecture constraints for milestone planning and implementation.

- Runtime is Google Cloud Run, not Kubernetes/GKE.
- The legacy client remains separate from the platform.
- The platform contains the portal, public site renderer, and shared packages.
- The public renderer must not access Firestore directly; it consumes sanitized API responses.
- Firestore tenant isolation is path-based.
- `PLATFORM_ADMIN` is currently the website/CMS editor role.
- Working state and published snapshots are intentionally separate.
- Working changes do not affect normal public output until publish or republish.
- `Home.sections` is the authoritative Home composition and order.
- Navigation derives from `Home.sections`.
- Media persistence uses provider-neutral Media IDs.
- Storage URLs and dimensions are hydrated at read time.
- Provider-specific storage fields never persist in `SiteDefinition`.
- Branding participates in the publication lifecycle.
- Business Profile participates in the publication lifecycle.
- Presentation content is not structured business identity.
- Canonical/public URL is infrastructure rather than CMS content.
- `resolveSiteBaseUrl(tenantId)` is the Step 1.23 custom-domain seam.
- Existing site and snapshot backward compatibility is preferred without migration.
- Build incrementally, avoid speculative abstractions, and do not preimplement future roadmap items.

## Roadmap

- 1.22 SEO & Discoverability — COMPLETE
- 1.23 Custom Domains — NEXT (not part of Orchestrator Pass 1)

## Deterministic verification

Run these commands in order:

1. `npm test` in `orchestrator`
2. `npm test` in `server`
3. `npm run lint` in `server`
4. `npm run typecheck` in `platform`
5. `npm run lint` in `platform`
6. `npm test` in `platform/apps/site-renderer`
7. `npm run build` in `platform`
