# Passwords asset provenance

- The app bar uses a byte-for-byte copy of `client/src/assets/bakerrang-logo.png` at `src/assets-bakerrang-logo.png`.
- `public/` PWA icons and favicons were rasterized from the approved `web/.impeccable/mocks/passwords-icon.svg` by `scripts/generate-icons.cjs`. The SVG's BakerRang badge is composited from the canonical logo bytes; it is not redrawn.
- The icon generator may be rerun after a design-approved asset change. Its inputs remain the approved SVG and canonical logo.
