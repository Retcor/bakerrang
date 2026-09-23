# Consumer workspace implementation rules

- `web/PRODUCT.md`, `web/DESIGN.md`, `web/.impeccable/design.json`, the Launcher surface brief, and approved Launcher comp are authoritative design inputs.
- Keep the consumer workspace on Vite, React 18, Tailwind 3, and JavaScript unless the approved architecture changes.
- Use only `@bakerrang/web-*` package names. Never import from or into the separate `platform/` workspace.
- A component enters `web-ui` only after at least two applications need the same rendered component. Product presentation stays inside its app.
- Install only from the workspace root with `npm ci`. To change dependencies, edit `package.json`, run `npm run relock`, and commit the generated root lockfile. Never hand-edit the lockfile or regenerate it with a casual Windows `npm install`.
- PWA/build configuration belongs to each app. Do not place it in `web-app-shell` or create a shared PWA abstraction until a second app proves reuse.
- Supermarket is retired and must not be introduced anywhere under `web/`.
