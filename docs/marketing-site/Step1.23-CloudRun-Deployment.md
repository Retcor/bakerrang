# Step 1.23 Cloud Run container runbook

This step packages the Portal and Site Renderer as independent production images. It does not deploy them or create Google Cloud resources. Run all builds with `platform/` as the Docker build context.

## Image builds

Portal browser configuration is baked into its JavaScript bundle. `NEXT_PUBLIC_API_BASE_URL` is required. The custom-domain values are public and optional until the load balancer exists.

```powershell
cd platform
docker build -f apps/portal/Dockerfile `
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 `
  --build-arg CUSTOM_DOMAIN_IPV4_ADDRESS=203.0.113.10 `
  --build-arg CUSTOM_DOMAIN_CNAME_TARGET=example.invalid `
  -t bakerrang-portal:dev .
```

The documentation-only IP `203.0.113.10` is placeholder local UI data and must never be used in a deployed image. Before building the DEV Portal image for custom-domain testing, either reserve the real global load-balancer IP and bake it in, or leave the field blank and rebuild after the IP exists.

The renderer has one build-time browser value. Its server configuration must be supplied only at runtime.

```powershell
docker build -f apps/site-renderer/Dockerfile `
  --build-arg NEXT_PUBLIC_SITE_API_BASE_URL=http://localhost:8080 `
  -t bakerrang-site-renderer:dev .
```

## Local verification

Browser-facing values use `localhost` because the browser runs on the host. Renderer server requests originate inside Docker, so they use `host.docker.internal` to reach a host-running API.

```powershell
docker run --rm -p 3001:8080 -e PORT=8080 bakerrang-portal:dev

docker run --rm -p 3002:8080 `
  -e PORT=8080 `
  -e SITE_API_BASE_URL=http://host.docker.internal:8080 `
  -e SITE_PUBLIC_ORIGIN=http://localhost:3002 `
  -e SITE_PUBLIC_INDEXING_ENABLED=false `
  bakerrang-site-renderer:dev
```

Both images default to `PORT=8080`, bind `HOSTNAME=0.0.0.0`, terminate no TLS, and run the standalone Next server as a dedicated non-root user. Cloud Run may override `PORT`.

## Deployment prerequisites and later steps

Functional Cloud Run testing requires a network-reachable DEV Express API connected to the `bakerrang-dev` data environment. Cloud Run cannot call the developer's localhost API. Determining whether an existing DEV API service can be used or whether the API must first be deployed is a separate next step; this work does not containerize or deploy the API.

The planned service names are `bakerrang-portal-dev` and `bakerrang-site-renderer-dev`. Initially use public/all ingress and allow unauthenticated access so the raw `*.run.app` endpoints can be smoke-tested. A raw Portal URL proves basic boot behavior, but may not prove the complete OAuth/session flow under the existing cookie SameSite/domain model; that requires the intended `bakerrang.com` hostname and CORS configuration.

After the external Application Load Balancer and serverless NEG path is proven, renderer ingress can be tightened to internal-and-cloud-load-balancing. Do not tighten it before that validation.

Both frontends communicate with the API over HTTP. They contain no Firestore/Firebase/GCS SDK or service-account credentials and require no frontend Firestore IAM.
