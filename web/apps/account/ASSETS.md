# Account asset provenance

- The app bar uses a byte-for-byte copy of `client/src/assets/bakerrang-logo.png` at `src/assets-bakerrang-logo.png`. The Relay's Launcher tile uses the same file.
- `public/` PWA icons and favicons are byte-for-byte copies of the main BakerRang set in `client/public/`, matching every other web app since the favicon unification (#34).
- `scripts/generate-icons.cjs` can still rasterize the Phase H `web/.impeccable/mocks/account-icon.svg` master, but its output is not shipped.
- Archivo and Archivo Expanded are the self-hosted faces in `@bakerrang/web-tokens`; the app loads no font from a third-party origin.
