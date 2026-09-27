# Budget asset provenance

- The app bar imports the canonical BakerRang logo from `web/apps/polyglot/src/assets/bakerrang-logo.png`; that file is a byte-for-byte copy of `client/src/assets/bakerrang-logo.png`.
- PWA icons and favicons are rasterized from the approved `web/.impeccable/mocks/budget-icon.svg` by `scripts/generate-icons.cjs`. The SVG's BakerRang badge is replaced with the canonical logo bytes during generation.
