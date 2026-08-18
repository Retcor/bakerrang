# Claude Code Assignment — Step 1.23a Deployment Packaging

DO NOT MODIFY CODE.

Step 1.23 Custom Domains application behavior is complete and live-verified
locally.

The Portal and site-renderer are NOT deployed yet.

The next substep is:

STEP 1.23a — PORTAL + SITE-RENDERER CONTAINERIZATION FOR CLOUD RUN

This is deployment packaging only.

Do not deploy anything.
Do not create Google Cloud resources.
Do not implement product features.

============================================================
1. GOAL
   ============================================================

Prepare these two Next.js applications for independent Google Cloud Run
deployment:

platform/apps/portal

platform/apps/site-renderer

They should become two separate Cloud Run services and two separate container
images.

Do not combine them into one container.

============================================================
2. CURRENT MONOREPO
   ============================================================

Inspect the actual current structure.

Expected general shape:

platform/
package.json
package-lock.json
apps/
portal/
site-renderer/
packages/
ui/
site-components/
site-schema/

Confirm:

- npm workspace configuration
- Next.js versions
- Node version assumptions
- app package scripts
- shared-package imports
- build output
- next.config.ts contents
- public directories
- lockfile location
- any native dependencies
- current env files/examples

Do not assume filenames if they differ.

============================================================
3. NEXT.JS STANDALONE OUTPUT
   ============================================================

Evaluate using:

output: 'standalone'

for both apps.

Because this is a monorepo, inspect whether:

outputFileTracingRoot

or its current Next.js equivalent is required so standalone output includes
workspace packages outside each app directory.

The final containers must correctly include dependencies from:

platform/packages/ui
platform/packages/site-components
platform/packages/site-schema

and any other actual workspace dependency.

Do not vendor/copy arbitrary node_modules manually if standalone tracing can
handle it correctly.

============================================================
4. CLOUD RUN CONTRACT
   ============================================================

Containers must work with Google Cloud Run.

Runtime requirements:

- Linux container
- listen on 0.0.0.0
- use process.env.PORT
- Cloud Run normally injects PORT=8080
- no TLS inside the container
- production Next.js server

Determine whether Next standalone server.js already respects:

PORT
HOSTNAME

and what runtime environment should be set, e.g.:

HOSTNAME=0.0.0.0

Do not hardcode localhost.

============================================================
5. BUILD CONTEXT
   ============================================================

Recommend the correct Docker build context.

Likely:

platform/

rather than:

platform/apps/portal

because npm workspace dependencies and lockfile live at platform root.

Determine the exact command we should eventually run, for example conceptually:

docker build \
-f apps/portal/Dockerfile \
-t ... \
.

from platform/.

Same for renderer.

Do not implement until the actual workspace layout is confirmed.

============================================================
6. MULTI-STAGE DOCKERFILES
   ============================================================

Plan minimal production multi-stage Dockerfiles.

Expected conceptual stages:

base
deps
builder
runner

or a simpler equivalent if adequate.

Requirements:

- deterministic npm install from lockfile, preferably npm ci
- workspace-aware
- build only what is necessary
- production runtime should not contain the full source tree/node_modules when
  standalone output suffices
- copy .next/standalone
- copy .next/static
- copy public/ when present/needed
- run as non-root if practical
- NODE_ENV=production
- respect PORT/HOSTNAME
- no dev server
- no npm install at runtime

Keep images understandable; no Docker cleverness for its own sake.

============================================================
7. BUILD ONLY THE TARGET APP
   ============================================================

Inspect current npm scripts.

Determine the safest target build command for each image.

We do not want building Portal to accidentally require deployment runtime env
for site-renderer or vice versa unless the workspace architecture genuinely
does.

Potential examples:

npm run build --workspace=<workspace-name>

or:

npm run build -w ...

Use actual package names/scripts.

============================================================
8. NEXT PUBLIC / STATIC FILES
   ============================================================

Inspect both apps for:

public/

and other runtime assets.

Standalone output does not necessarily mean every public/static asset can be
ignored.

Specify exactly what must be copied into the runner image.

============================================================
9. BUILD-TIME VS RUNTIME ENV
   ============================================================

This is important.

Inventory all env vars used by:

Portal
Site Renderer

Classify each as:

BUILD-TIME
RUNTIME
BOTH

Pay particular attention to:

NEXT_PUBLIC_*

Next.js may inline NEXT_PUBLIC variables into client bundles at build time.

Determine which values therefore must exist during image build versus which
can safely be Cloud Run runtime variables.

Do not silently bake secrets into images.

============================================================
10. PORTAL ENVIRONMENT
    ============================================================

Inspect actual Portal env usage.

Potential existing areas:

API base URL
Google OAuth/client information
custom-domain routing instructions
any NEXT_PUBLIC values

Return the exact production/dev Cloud Run environment variables needed.

Distinguish:

public non-secret config
server-only config
secret values

Do not invent new vars unless needed.

============================================================
11. SITE-RENDERER ENVIRONMENT
    ============================================================

Inspect actual renderer env usage.

Likely includes actual equivalents of:

SITE_API_BASE_URL
NEXT_PUBLIC_SITE_API_BASE_URL
SITE_PUBLIC_ORIGIN
SITE_PUBLIC_INDEXING_ENABLED

plus any Step 1.23 custom-domain config actually used by renderer.

Determine exact Cloud Run runtime/build-time requirements.

Custom domain routing must continue:

renderer
→ Express public API

No Firestore credentials/client in renderer.

============================================================
12. PORTAL AUTH / OAUTH DEPLOYMENT CONCERNS
    ============================================================

Inspect how Portal authentication currently works.

Document any Cloud Run deployment requirements for:

Google OAuth redirect URI
allowed origins
session/API relationship
portal hostname

Do not reimplement auth.

Do not configure Google OAuth in this planning task.

Just identify what must be updated when the deployed Portal URL exists.

============================================================
13. API CORS / ORIGIN CONFIG
    ============================================================

The backend already has origin allowlists.

Identify the server environment values that will eventually need the deployed:

Portal Cloud Run/public hostname
Site Renderer Cloud Run/public hostname

so deployed Portal and Renderer work correctly.

Do not modify server configuration unless containerization genuinely requires
it.

Document deployment follow-up.

============================================================
14. DEV VS PROD CLOUD RUN SERVICES
    ============================================================

We are initially deploying a DEV/staging environment, not customer production.

Recommend service names, e.g. conceptually:

bakerrang-portal-dev
bakerrang-site-renderer-dev

Do not hardcode if existing naming conventions suggest better names.

We want these pointed at:

bakerrang-dev Firestore/API

not production data.

============================================================
15. FIRESTORE
    ============================================================

Portal and renderer should not directly need Firestore.

Confirm this from actual code.

Renderer absolutely must remain Firestore-free.

Portal should operate through the API.

No service-account Firestore permissions should be added to either frontend
service unless actual current code proves they need them.

============================================================
16. DOCKERIGNORE
    ============================================================

Determine whether to add:

platform/.dockerignore

or app-specific ignore strategy.

Exclude unnecessary:

node_modules
.next
git metadata
local env files
test output
editor files

But do not exclude workspace package source needed during builds.

============================================================
17. HEALTH / STARTUP
    ============================================================

Determine whether we need an explicit health endpoint.

Prefer not to add one unless Cloud Run or our app needs it.

Cloud Run can start routing once the container listens on PORT.

Do not add application features just for containerization.

============================================================
18. IMAGE PLATFORM
    ============================================================

Cloud Run requires compatible Linux images.

Plan standard Node LTS Linux base image compatible with the currently used
Next version and dependencies.

Check actual repo Node engines/version assumptions.

Do not blindly choose Alpine if native/binary dependency compatibility would
be a concern.

Prefer boring/reliable.

============================================================
19. LOCAL DOCKER VERIFICATION
    ============================================================

Plan exact local verification for each image.

Portal:

docker build ...
docker run -p <local>:8080 \
-e PORT=8080 \
...required env...

Then verify page/auth boot behavior.

Renderer:

docker build ...
docker run -p <local>:8080 \
-e PORT=8080 \
...required env...

Verify:

/
shared /site/:tenant
custom-host lookup via Host header
/contact
robots
sitemap

Do not require Cloud Run for first container verification.

============================================================
20. CLOUD RUN DEPLOYMENT — PLAN ONLY
    ============================================================

After images work locally, plan the eventual deployment steps:

Artifact Registry
build/tag/push image
Cloud Run deploy Portal
Cloud Run deploy Site Renderer
runtime env vars
Secret Manager where appropriate
public access / ingress decisions
service accounts

Do not execute them now.

Cloud Run secrets should use Secret Manager rather than baking credentials
into Docker images.

============================================================
21. INITIAL INGRESS
    ============================================================

For first DEV deployment, recommend the least-surprising ingress configuration.

We still need direct access to verify the raw Cloud Run services before the
load balancer is configured.

Do NOT prematurely switch renderer ingress to:

internal-and-cloud-load-balancing

until the LB path is working.

Document when we would tighten it later.

============================================================
22. CUSTOM DOMAIN NEXT STEP
    ============================================================

Once both apps are deployed:

1. verify deployed Portal
2. verify deployed shared renderer
3. verify API integration
4. then configure:
   external Application Load Balancer
   serverless NEG
   Certificate Manager
   test DNS
5. then repeat the Step 1.23 real HTTPS custom-domain verification

No LB work belongs in the Dockerfile implementation itself.

============================================================
23. FILES
    ============================================================

Recommend exact files to add/modify.

Likely candidates:

platform/apps/portal/Dockerfile
platform/apps/site-renderer/Dockerfile
platform/.dockerignore

platform/apps/portal/next.config.ts
platform/apps/site-renderer/next.config.ts

env example/docs

possibly:
docs/marketing-site/Step1.23-CloudRun-Deployment.md

Do NOT add files merely to match this list.

============================================================
24. NON-GOALS
    ============================================================

Do NOT:

deploy Cloud Run
create Artifact Registry
configure DNS
configure Certificate Manager
configure LB
change Custom Domain lifecycle
change CMS
change SiteDefinition
change auth architecture
create CI/CD
create GitHub Actions
create Terraform
create Kubernetes
introduce nginx
combine Portal + Renderer
use static export unless actual app capabilities support it

============================================================
25. VERIFICATION
    ============================================================

Implementation later must preserve:

cd platform
npm run typecheck
npm run lint
npm run build

and existing renderer tests.

Also require:

docker build Portal image
docker build Renderer image

and local docker-run smoke tests.

============================================================
DELIVERABLE
============================================================

Return:

1. Current platform/workspace build structure.
2. Current Next versions.
3. Current Node/runtime assumptions.
4. Shared workspace dependency graph relevant to Portal.
5. Shared workspace dependency graph relevant to Renderer.
6. Recommended Next standalone configuration.
7. Whether outputFileTracingRoot is needed.
8. Recommended Docker build context.
9. Exact Portal Dockerfile design.
10. Exact Renderer Dockerfile design.
11. Base image choice.
12. Runtime user choice.
13. Static/public asset copy requirements.
14. Dockerignore design.
15. Portal build command.
16. Renderer build command.
17. Portal build-time env vars.
18. Portal runtime env vars.
19. Renderer build-time env vars.
20. Renderer runtime env vars.
21. Secrets handling.
22. PORT/HOSTNAME behavior.
23. Local Portal image test commands.
24. Local Renderer image test commands.
25. Cloud Run service names.
26. Cloud Run initial ingress recommendation.
27. Cloud Run environment configuration.
28. OAuth/CORS follow-up needed after deployment.
29. Files to add.
30. Files to modify.
31. Files explicitly unchanged.
32. Exact implementation tests.
33. Exact local Docker verification.
34. Eventual Cloud Run deployment sequence.
35. Risks.
36. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

DO NOT MODIFY CODE.