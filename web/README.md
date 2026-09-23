# BakerRang consumer web workspace

This workspace contains independently deployable Vite + React 18 consumer applications and their narrowly shared `@bakerrang/web-*` foundations. It is intentionally independent from `platform/`; packages must never cross-import between those workspaces.

## Install and dependency changes

- Run `npm ci` at this `web/` root for normal installs. There is one lockfile: `web/package-lock.json`.
- Never run a casual Windows `npm install` to regenerate the committed lockfile.
- To change dependencies, edit the appropriate `package.json`, run `npm run relock`, and commit the Linux/Docker-generated root lockfile.
- Never hand-edit `package-lock.json`.

## Launcher

- Local: `npm run dev:launcher` (port 3000 by default).
- Verify: `npm run lint`, `npm test`, then `npm run build -w @bakerrang/web-launcher`.
- Docker: `docker build --build-arg APP=launcher --build-arg VITE_API_BASE_URL=https://api.example.invalid --build-arg VITE_OAUTH_TARGET=launcher -t bakerrang-web-launcher .`

The Launcher PWA owns its manifest and Workbox configuration in `apps/launcher/vite.config.js`. Its service worker precaches static shell assets only and has no API runtime-caching route.
