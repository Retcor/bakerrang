Implement Step 1.23a — Portal + Site-Renderer Containerization for Cloud Run.

Claude Code inspected the actual platform workspace and produced an approved
implementation plan.

Follow that plan, with the corrections below taking precedence.

Do NOT deploy anything.
Do NOT create Google Cloud resources.
Do NOT implement product features.

============================================================
GOAL
============================================================

Produce two independent production container images:

@bakerrang/portal
@bakerrang/site-renderer

for eventual Google Cloud Run deployment.

Both apps are currently:

Next.js 16.3.0
React 19.2.8
Node >=24 <25

The platform is an npm workspace rooted at:

platform/

with a single:

platform/package-lock.json

and shared raw-TypeScript packages under:

platform/packages/*

============================================================
1. IMAGE BOUNDARY
   ============================================================

Create separate Dockerfiles:

platform/apps/portal/Dockerfile

platform/apps/site-renderer/Dockerfile

Do NOT combine Portal and Renderer.

Docker build context for both:

platform/

Expected commands:

cd platform

docker build \
-f apps/portal/Dockerfile \
...

docker build \
-f apps/site-renderer/Dockerfile \
...

============================================================
2. NEXT STANDALONE
   ============================================================

Both apps already use:

output: 'standalone'

Preserve that.

Add a deterministic:

outputFileTracingRoot

to BOTH next.config.ts files, resolving exactly to:

platform/

This is required because shared workspace package source lives outside each
individual app.

Use an implementation compatible with the ACTUAL Next 16 config/module
environment.

Do not guess whether import.meta.url or __dirname works.

Implement it, run the actual build, and verify the resulting tracing root and
standalone layout.

Do NOT use static export.

============================================================
3. EMPIRICALLY VERIFY STANDALONE ENTRYPOINT
   ============================================================

Do NOT blindly assume the generated entrypoint is:

.next/standalone/apps/<app>/server.js

After the first real build, inspect:

apps/portal/.next/standalone

and:

apps/site-renderer/.next/standalone

Determine the actual emitted server.js locations.

Docker COPY paths and CMD must match the REAL Next 16 output.

Expected likely result with platform tracing root:

apps/<app>/server.js

but actual output is the source of truth.

============================================================
4. BASE IMAGE
   ============================================================

Use:

node:24-bookworm-slim

for the Docker stages unless actual dependency inspection reveals a concrete
reason otherwise.

Do not use Alpine merely for size.

Use:

NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

in runner.

============================================================
5. CLOUD RUN LISTEN CONTRACT
   ============================================================

Standalone server must listen on:

0.0.0.0

and:

process.env.PORT

Cloud Run normally supplies PORT=8080.

Set:

HOSTNAME=0.0.0.0

Do not hardcode localhost.

A default:

PORT=8080

in the image is fine for local execution; Cloud Run may override it.

No TLS inside the container.

============================================================
6. NON-ROOT RUNTIME
   ============================================================

Run the final container as a dedicated non-root user.

No write permission to the application tree is required.

Do not add nginx or another process supervisor.

The standalone Next server is the container process.

============================================================
7. NPM WORKSPACE INSTALL — IMPORTANT CORRECTION
   ============================================================

Use:

npm ci

from the platform workspace root with the root lockfile.

The dependency stage must include every workspace package manifest required by
the lockfile/workspaces.

However, do NOT assume npm places every installed dependency only under:

/app/node_modules

npm workspaces may have workspace-local nested node_modules when hoisting
cannot satisfy the graph.

After npm ci, inspect the actual install layout.

Ensure the builder receives ALL installed dependency locations required for
the workspace build.

A safe simple shape is acceptable, such as copying the dependency-stage /app
tree into the builder and then overlaying source with COPY . ., provided:

- source node_modules are dockerignored
- local env files are dockerignored
- the result is deterministic
- final runner still contains only standalone traced runtime output

Do not copy the full development dependency tree into the final runner.

============================================================
8. TARGETED BUILDS
   ============================================================

Portal:

npm run build -w @bakerrang/portal

Renderer:

npm run build -w @bakerrang/site-renderer

Build each target independently.

Do not run the other app merely as part of constructing an individual image.

============================================================
9. PORTAL BUILD-TIME ENV
   ============================================================

Current Portal browser config is build-time.

Required:

NEXT_PUBLIC_API_BASE_URL

Current custom-domain UI also uses build-time values supplied through the
existing next.config mapping:

CUSTOM_DOMAIN_IPV4_ADDRESS
CUSTOM_DOMAIN_CNAME_TARGET

Preserve current application behavior.

Do NOT refactor the Portal runtime-config architecture in this packaging step.

These values are public and are not secrets.

Add Docker ARG/ENV handling necessary for `next build`.

The API URL is REQUIRED for a meaningful image.

Prefer failing the build clearly if:

NEXT_PUBLIC_API_BASE_URL

is absent rather than silently producing an image with an unusable API
origin.

The LB IP / CNAME values may remain optional at this packaging stage because
the real load balancer has not been provisioned yet.

============================================================
10. RENDERER ENV
    ============================================================

Build-time browser variable:

NEXT_PUBLIC_SITE_API_BASE_URL

Runtime/server variables:

SITE_API_BASE_URL
SITE_PUBLIC_ORIGIN
SITE_PUBLIC_INDEXING_ENABLED

Only the NEXT_PUBLIC value belongs in the Docker build args.

Do NOT bake the server-side variables into the image.

Cloud Run/docker run supplies those at runtime.

Prefer failing the image build clearly if:

NEXT_PUBLIC_SITE_API_BASE_URL

is absent.

============================================================
11. LOCAL NETWORKING — REQUIRED CORRECTION
    ============================================================

Distinguish browser networking from container networking.

For LOCAL Docker verification on Windows:

Portal browser bundle:

NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

NOT:

http://host.docker.internal:8080

because this value executes in the host browser.

Renderer browser LeadForm:

NEXT_PUBLIC_SITE_API_BASE_URL=http://localhost:8080

NOT:

http://host.docker.internal:8080

because it also executes in the host browser.

Renderer server-side requests originate INSIDE the container, so runtime:

SITE_API_BASE_URL=http://host.docker.internal:8080

is correct for a host-running API.

Therefore local example:

Portal build:
--build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

Renderer build:
--build-arg NEXT_PUBLIC_SITE_API_BASE_URL=http://localhost:8080

Renderer run:
-e SITE_API_BASE_URL=http://host.docker.internal:8080

In Cloud Run the browser/server values may both use the same deployed HTTPS
API origin.

============================================================
12. DOCKERIGNORE — REQUIRED CORRECTION
    ============================================================

Add:

platform/.dockerignore

Exclude at minimum:

**/node_modules
**/.next
**/out
**/*.tsbuildinfo
**/next-env.d.ts
**/.env*
**/npm-debug.log*
**/.DS_Store
**/Dockerfile
.dockerignore

The important rule is:

**/.env*

Do not copy ANY real env file into the image build context.

Build args/runtime environment are the configuration source.

Do NOT exclude:

apps/** source
packages/** source
package.json
package-lock.json
next.config.ts
tsconfig files
eslint config

============================================================
13. STATIC FILES
    ============================================================

Neither app currently has a public/ directory.

Do not add one.

Copy the target app's:

.next/static

into the correct location in the runner image because standalone output does
not include it automatically.

If actual build inspection proves another asset path is needed, follow the
actual Next output.

Dynamic robots/sitemap handlers are server code and require no static copy.

============================================================
14. FINAL RUNNER CONTENT
    ============================================================

Final image should contain only what is needed to run the standalone target:

standalone traced output
target .next/static
runtime Node base

No:

source tree wholesale
full dev node_modules
tests
local .env
npm install at startup

============================================================
15. FIRESTORE / IAM
    ============================================================

Do not add:

Firestore SDK
Firebase SDK
GCS SDK
service-account credentials

to either frontend.

Portal:
API over HTTP

Renderer:
API over HTTP

Renderer remains Firestore-free.

No frontend Firestore IAM is needed.

============================================================
16. LOCAL PORTAL SMOKE TEST
    ============================================================

From platform/:

docker build \
-f apps/portal/Dockerfile \
--build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 \
--build-arg CUSTOM_DOMAIN_IPV4_ADDRESS=203.0.113.10 \
--build-arg CUSTOM_DOMAIN_CNAME_TARGET=example.invalid \
-t bakerrang-portal:dev \
.

Run:

docker run --rm \
-p 3001:8080 \
-e PORT=8080 \
bakerrang-portal:dev

Verify:

- process starts
- binds 0.0.0.0:8080
- http://localhost:3001 renders
- generated browser/login URL uses http://localhost:8080
- no localhost value was accidentally loaded from .env.local inside image
- no missing workspace module errors

Full OAuth is NOT required for this raw container smoke test.

============================================================
17. LOCAL RENDERER SMOKE TEST
    ============================================================

From platform/:

docker build \
-f apps/site-renderer/Dockerfile \
--build-arg NEXT_PUBLIC_SITE_API_BASE_URL=http://localhost:8080 \
-t bakerrang-site-renderer:dev \
.

Run on Docker Desktop/Windows:

docker run --rm \
-p 3002:8080 \
-e PORT=8080 \
-e SITE_API_BASE_URL=http://host.docker.internal:8080 \
-e SITE_PUBLIC_ORIGIN=http://localhost:3002 \
-e SITE_PUBLIC_INDEXING_ENABLED=false \
bakerrang-site-renderer:dev

Verify:

- binds 0.0.0.0:8080
- /site/<published-tenant> renders
- /contact where appropriate
- robots.txt
- sitemap behavior
- server-side API calls reach host API through host.docker.internal
- LeadForm browser calls target http://localhost:8080
- no workspace module errors

For custom-domain routing, use the existing ACTIVE dev hostname if still
available or a Host-header test against an ACTIVE registry record.

============================================================
18. PLATFORM VERIFICATION
    ============================================================

Run:

cd platform

npm run typecheck
npm run lint
npm run build
npm test -w @bakerrang/site-renderer

Both Docker builds must also complete successfully.

Do not alter application functionality merely to make packaging work unless
the standalone build exposes a genuine packaging defect.

============================================================
19. DEV API DEPLOYMENT PREREQUISITE — IMPORTANT
    ============================================================

Do NOT assume a reachable DEV Express API already exists.

The user currently develops locally.

Containerization can be completed and tested locally against the host API.

However, before deploying these frontend images to Cloud Run for functional
DEV testing, we MUST have a network-reachable DEV API origin pointing at the
bakerrang-dev data environment.

Document this explicitly.

Cloud Run cannot call the developer's localhost API.

Do NOT deploy or containerize the API as part of this assignment.

The next deployment step will determine whether an existing dev API Cloud Run
service can be used or whether the Express API must be deployed first.

============================================================
20. PORTAL AUTH DEPLOYMENT NOTE
    ============================================================

Document that raw *.run.app is sufficient for a basic Portal boot check but
may not prove the complete OAuth/session flow because the API session cookie
uses the existing SameSite/domain model.

Do not change auth here.

Full deployed Portal auth will be tested after appropriate bakerrang.com
hostname/CORS configuration exists.

============================================================
21. CLOUD RUN PLAN ONLY
    ============================================================

Do NOT deploy.

Document future service names:

bakerrang-portal-dev
bakerrang-site-renderer-dev

Initial ingress when we deploy:

public/all
allow unauthenticated

so raw run.app endpoints can be smoke-tested.

Do NOT tighten renderer ingress until the external Application Load Balancer
path is proven.

Later:

renderer ingress -> internal-and-cloud-load-balancing

after LB/serverless NEG works.

============================================================
22. PORTAL CUSTOM-DOMAIN BUILD VALUES
    ============================================================

The real load-balancer IP does not exist yet.

Do not pretend the test value:

203.0.113.10

is a deployable value.

For local Docker verification it is only placeholder UI data.

Before building the actual Cloud Run DEV Portal image used for Step 1.23
custom-domain infrastructure testing, either:

- reserve the real global static LB IP first and bake it into the Portal
  image, or
- intentionally leave the field blank and rebuild Portal after the IP exists.

Document this so the placeholder cannot accidentally reach a deployed image.

============================================================
23. DOCUMENTATION
    ============================================================

Add a concise deployment/container runbook if useful:

docs/marketing-site/Step1.23-CloudRun-Deployment.md

It should capture:

- build context
- Docker build commands
- build-time vs runtime variables
- local Docker verification
- reachable DEV API prerequisite
- eventual Cloud Run service names
- raw run.app smoke-test limitation
- eventual LB step
- no Firestore IAM for frontend services

Do not turn it into a giant general Docker tutorial.

============================================================
24. FILES EXPECTED
    ============================================================

Add:

platform/apps/portal/Dockerfile
platform/apps/site-renderer/Dockerfile
platform/.dockerignore

Optionally/add if useful:

docs/marketing-site/Step1.23-CloudRun-Deployment.md

Modify:

platform/apps/portal/next.config.ts
platform/apps/site-renderer/next.config.ts

Optionally env examples for comments only.

Do NOT modify:

server/**
platform/package.json
package-lock.json
packages/** application source
Portal application source
Renderer application source
Custom Domain lifecycle
SEO
CORS
auth architecture

unless a genuine standalone packaging defect requires a narrowly reported
change.

============================================================
25. REPORT
    ============================================================

Return:

# IMPLEMENTATION_REPORT

Include:

Files added
Files modified
outputFileTracingRoot implementation
Actual generated standalone Portal entrypoint
Actual generated standalone Renderer entrypoint
Dependency-stage workspace handling
Dockerignore contents/intent
Portal build args
Renderer build args
Renderer runtime vars
Cloud Run PORT/HOSTNAME behavior
Portal image size if readily available
Renderer image size if readily available
Portal Docker build result
Portal docker-run result
Renderer Docker build result
Renderer docker-run result
Platform typecheck result
Platform lint result
Platform build result
Renderer tests result
Any workspace/standalone issues encountered
DEV API deployment prerequisite documented
Deviations
Risks

Do not deploy anything.