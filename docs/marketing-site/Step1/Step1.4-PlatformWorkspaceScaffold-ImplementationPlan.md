Implement Step 1.4 — BakerRang Platform Frontend Workspace Scaffold.

Claude Code has already inspected the repository and produced an implementation
plan. Follow its repository findings and overall structure, with the corrections
below taking precedence wherever they conflict with Claude's plan.

Do not expand scope.

============================================================
GOAL
============================================================

Create a completely isolated frontend workspace under:

platform/

containing:

platform/
apps/
portal/
site-renderer/

packages/
ui/
site-components/
site-schema/

Existing:

client/
server/
extension/

must remain unchanged.

Do NOT create a repository-root package.json.

============================================================
TECHNOLOGY
============================================================

Use current stable releases compatible with:

- Next.js 16
- React version supported/recommended by the selected Next.js 16 release
- TypeScript
- Tailwind CSS v4
- ESLint
- npm workspaces

Use Node 24 for the new platform workspace.

Create:

platform/.nvmrc

containing:

24

Set the platform package engine to Node 24, e.g.:

"engines": {
"node": ">=24 <25"
}

Do NOT inherit dependency versions from the existing React/Vite client.

Resolve current compatible patch/minor versions during implementation and lock
them in platform/package-lock.json.

============================================================
WORKSPACE
============================================================

Create:

platform/package.json

with:

"private": true

and npm workspaces:

apps/*
packages/*

All platform tooling and dependencies must remain inside platform/.

Do not add Turborepo, Nx, pnpm, Yarn, or other orchestration tooling.

============================================================
APP 1 — PORTAL
============================================================

platform/apps/portal

Use:

- Next.js 16
- App Router
- TypeScript

Purpose:

Future authenticated BakerRang platform/business dashboard.

DO NOT implement authentication or API integration yet.

For this step the page only needs to prove that it can consume:

@bakerrang/ui

Render a small neutral demo page using a shared Button.

Run locally on port 3001.

============================================================
APP 2 — SITE RENDERER
============================================================

platform/apps/site-renderer

Use:

- Next.js 16
- App Router
- TypeScript

Purpose:

Future public multi-tenant marketing-site renderer.

Do not add:

- Firestore
- hostname resolution
- tenant resolution
- API calls
- custom domains
- CMS

For this step it renders a static demo Hero from:

@bakerrang/site-components

Run locally on port 3002.

============================================================
PACKAGE — @bakerrang/ui
============================================================

Create:

platform/packages/ui

Implement only:

Button
Container

These are generic design-system primitives.

They must contain no knowledge of:

- BakerRang branding
- tenants
- businesses
- marketing
- shower doors
- CMS

Use semantic design tokens.

Create something equivalent to:

src/styles/tokens.css

using Tailwind v4's theme-variable system.

For example conceptually:

@theme {
--color-bg: ...;
--color-fg: ...;
--color-fg-muted: ...;
--color-accent: ...;
--color-accent-fg: ...;
--radius-md: ...;
}

Use neutral defaults.

Components should prefer semantic Tailwind utilities created from the tokens,
such as:

bg-accent
text-accent-fg
text-fg

rather than repeatedly using arbitrary CSS-variable syntax.

Ensure the package explicitly exports its stylesheet.

Its package exports must support:

@bakerrang/ui
@bakerrang/ui/tokens.css

For example conceptually:

"exports": {
".": "./src/index.ts",
"./tokens.css": "./src/styles/tokens.css"
}

============================================================
PACKAGE — @bakerrang/site-schema
============================================================

Create:

platform/packages/site-schema

This must remain a small, React-independent TypeScript package.

Implement only the type currently required by Hero.

For example:

export interface HeroContent {
title: string
subtitle?: string
ctaLabel?: string
}

Do NOT design:

Site
Page
Section
Theme
CMS schemas

yet.

Do not add Zod or another runtime schema library.

============================================================
PACKAGE — @bakerrang/site-components
============================================================

Create:

platform/packages/site-components

Dependencies:

@bakerrang/ui
@bakerrang/site-schema

Implement only:

Hero

Hero must:

- import Button/Container from @bakerrang/ui
- type its content with HeroContent from @bakerrang/site-schema
- contain neutral reusable marketing markup
- contain no shower-door-specific content
- contain no tenant lookup logic

============================================================
DEPENDENCY GRAPH
============================================================

For this scaffold keep direct dependencies minimal:

@bakerrang/portal
-> @bakerrang/ui

@bakerrang/site-renderer
-> @bakerrang/site-components

@bakerrang/site-components
-> @bakerrang/ui
-> @bakerrang/site-schema

Do not give site-renderer a direct ui/schema dependency unless the actual
implementation requires one.

============================================================
TAILWIND
============================================================

Use current Tailwind CSS v4 configuration.

The applications must scan the workspace package source files so classes used
inside:

packages/ui
packages/site-components

are included in generated CSS.

Use the current supported @source mechanism or equivalent Tailwind v4 solution.

Both applications must import the shared token stylesheet from:

@bakerrang/ui/tokens.css

Do not copy the existing BakerRang React client's gold/black ThemeProvider or
theme CSS.

============================================================
NEXT CONFIG
============================================================

Workspace packages ship raw TypeScript/TSX.

Configure Next's transpilePackages appropriately for each application.

Portal must support:

@bakerrang/ui

Site renderer must support:

@bakerrang/site-components
@bakerrang/ui
@bakerrang/site-schema

Use:

output: 'standalone'

to keep eventual Cloud Run containerization straightforward.

Do NOT add Dockerfiles or Cloud Run configuration yet.

Do NOT add outputFileTracingRoot or deployment-specific monorepo configuration
unless it is actually required for the local production build.

That will be handled during deployment.

============================================================
TYPESCRIPT
============================================================

Use a strict shared TypeScript configuration under platform/.

Individual Next.js applications may extend it while retaining whatever Next.js
compiler/plugin settings are required.

Use modern module/bundler resolution appropriate for Next.js and local
workspace source packages.

============================================================
ESLINT — IMPORTANT OVERRIDE
============================================================

Do NOT use:

next lint

Next.js 16 no longer provides that command.

Use ESLint directly.

Use a committed modern flat config such as:

eslint.config.mjs

and app/workspace scripts based on:

eslint .

Lint must be non-interactive.

============================================================
PLATFORM ROOT SCRIPTS
============================================================

Provide convenient scripts from platform/package.json for:

npm run dev:portal
npm run dev:sites
npm run build
npm run lint
npm run typecheck

They should operate through npm workspaces.

============================================================
GIT ISOLATION
============================================================

Create platform/.gitignore as needed for:

node_modules
.next
*.tsbuildinfo
etc.

Do not modify the root .gitignore unless absolutely necessary.

Existing client/server/extension files should not be touched.

============================================================
PROOF OF ARCHITECTURE
============================================================

The implementation must prove:

1. platform/ is an independent npm workspace.
2. Portal runs independently.
3. Site renderer runs independently.
4. Both use Next.js 16 + TypeScript.
5. Portal imports Button from @bakerrang/ui.
6. Site renderer imports Hero from @bakerrang/site-components.
7. Hero imports Button/Container from @bakerrang/ui.
8. Hero uses HeroContent from @bakerrang/site-schema.
9. Shared Tailwind styles render correctly.
10. Both production builds succeed.
11. Existing client/server/extension are unchanged.

============================================================
EXPLICITLY OUT OF SCOPE
============================================================

Do not implement:

- authentication
- OAuth
- CORS changes
- API integration
- tenant UI
- business creation
- Firestore
- hostname resolution
- site configuration
- CMS
- media
- leads
- analytics
- domains
- Google integrations
- Instagram
- Storybook
- Docker
- Cloud Run deployment
- CI/CD
- full design-system library

============================================================
VERIFICATION
============================================================

Run from platform/:

npm install
npm run typecheck
npm run lint
npm run build

Also smoke-test both applications if practical:

npm run dev:portal
npm run dev:sites

Verify the shared Button and Hero render with styling.

Ensure any development processes are terminated after testing.

Verify git status and confirm this milestone only adds files under platform/.

============================================================
FINAL REPORT
============================================================

Report:

1. Exact directory tree created.
2. Dependency versions installed.
3. Workspace dependency graph.
4. Shared components/types implemented.
5. Next/Tailwind/ESLint configuration.
6. Verification results for install/typecheck/lint/build.
7. Smoke-test results.
8. Files modified outside platform/ — expected NONE.
9. Any deviation from this specification and why.
10. Any issue that should influence Step 1.5.

Do not implement anything beyond Step 1.4.