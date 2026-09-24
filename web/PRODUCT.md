# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Decided (architecture-locked, see `docs/apps/Phase0-EcosystemArchitecture.md`): a `web/` npm
workspace of **Vite + React 18 + Tailwind 3** consumer apps, one per product, each an independently
deployable static SPA served by nginx on its own Cloud Run service and its own subdomain, plus an
installable PWA per product. This is a deliberate evolution of the existing `client/` SPA, not a
rewrite. (The separate `platform/` Next.js workspace — the B2B website builder — is a different
product line and out of scope here.)

## Users

Everyday people using a small family of focused BakerRang consumer tools, signed in with Google.
They dip into one tool at a time (translate a phrase, generate a bedtime story, check a password,
plan a shop) rather than living in a dashboard. The same person may use several BakerRang apps and
expects to stay signed in across them without re-authenticating.

## Product Purpose

BakerRang is a family of independent, genuinely useful consumer applications under one identity —
conceptually like one company shipping several distinct products. The root site (`bakerrang.com`)
is the **front door / app launcher**: it says what BakerRang is and makes entering each application
easy and enjoyable. Success = a person recognizes BakerRang as one trustworthy maker, finds the
tool they want quickly, and each tool feels purpose-built for its job.

## Positioning

Independently deployable and independently installable products that nonetheless share one account,
one session, and one recognizable BakerRang identity. The differentiator is the pairing: **each
product is its own real app (its own subdomain, install identity, and product-appropriate design),
while family resemblance comes from shared foundations, not from one universal page template.**

## Operating Context

- Authentication is Google sign-in against the shared BakerRang API; a signed-in user is signed in
  across every consumer subdomain (shared same-site session).
- Each product lives on its own subdomain (`storybook.`, `polyglot.`, `account.`, …) and is an
  installable PWA with its own name and icon.
- Light, dark, and system themes are first-class and consistent across every subdomain.
- Products are entered from the launcher and from a shared in-app app-switcher; account/profile is
  reachable from every app.

## Capabilities and Constraints

- Current products needing representation on the launcher (**6 tools + Account**): **Story Book** (AI
  story generation with narration), **Polyglot** with **Instant** as a mode (speech translation /
  instant voice translation), **Sign Language** (sign practice via camera), **Budget** (budget
  tracking), **WoW Advisor** (World of Warcraft assistant), **Passwords** (a zero-knowledge,
  client-side-encrypted password vault), and **Account** (cross-cutting, not a tool).
- **Supermarket is removed from the ecosystem (obsolete).** It was built for a game/use case no
  longer relevant and is being **deleted, not migrated** (no `supermarket.` subdomain, no app, no
  Account "licenses" carryover). Its decommission is scheduled in the migration plan; see
  `docs/apps/Phase0-EcosystemArchitecture.md`.
- **Passwords is zero-knowledge**: the server never sees plaintext; nothing in a redesign may weaken
  that or cache sensitive data. It is a distinct, high-trust product.
- Shared session/auth, CSRF, and API infrastructure already exist and are reused unchanged.
- Whether **Polyglot Instant** is a separate launcher destination or a mode within Polyglot is an
  open design decision to resolve and document during this design step.

## Product: Story Book (Phase C truth, 2026-09-22)

Full inventory and architecture: `docs/apps/PhaseC-StoryBook.md`; surface brief:
`.impeccable/surfaces/storybook.md`.

- **What it does:** from one short idea, writes a short story (usually three paragraphs, one per page),
  generates one square illustration per page, keeps it in a private library, and reads any page aloud in
  a voice the user has cloned in their BakerRang account.
- **Audience:** all ages, general (product-owner decision) — not a children's app; image prompts stay
  kid-safe server-side.
- **A story** = title, the idea, created date, page texts, one picture (or none) per page, thumbnail — one
  private Firestore document owned by the user. No sharing, public links, export, or text editing exist.
- **Saving:** every completed story auto-saves, titled from the idea; rename/delete later.
- **Narration:** cloned voices only; users without one are pointed to Account. No stock voice.
- **AI dependencies:** story text + pictures (OpenAI), narration (ElevenLabs). Library, reading, rename
  and delete don't need them. No quotas, pricing, or usage limits exist; none may be claimed.

## Brand Commitments

- Keep the **BakerRang** name.
- Established identity: **golden-yellow `#FFD500`** accent + **neutral charcoal** (`#1a1a1a` /
  `#303030` / `#181818`), and the blocky **pixel-"B" monogram** logo + BakerRang wordmark. Preserve
  or evolve these; do not replace them with generic design-fashion branding.
- Different BakerRang applications may use different designs appropriate to their purpose; there is a
  shared family identity but not one imposed universal interface style.
- Explicit anti-goal: the consumer apps must stop looking generically "AI-generated." Out of bounds
  as decoration: glassmorphism, ambient/arbitrary gradients, interchangeable cards, card-inside-card,
  pills everywhere, oversized vague hero sections, repetitive icon+heading+subtitle blocks, stat-grid
  dashboard patterns, and identical layouts for unrelated products.

## Evidence on Hand

- The existing consumer apps live in `client/` (the current combined SPA) and are the functional
  source of truth for each product's behavior.
- **Canonical BakerRang logo: `client/src/assets/bakerrang-logo.png`** (the gold/charcoal blocky
  "B" monogram; used in the app header + login today). This is the real mark to use everywhere —
  never redraw it. Favicons/PWA icons in `client/public/`; source master in
  `~/Downloads/bakerrang-logo-assets`.
- **No World of Warcraft logo asset exists in the repo** (only `client/src/components/WoW/` code;
  the legacy launcher pulls a Google favicon URL). The WoW mark must be provided; do not
  redraw/approximate it. Until then the WoW Advisor emblem is a neutral placeholder crest.
- No testimonials, customer counts, benchmarks, pricing, or awards exist — none may be fabricated in
  any design work.

## Product Principles

- **Family, not clones.** One recognizable BakerRang identity; each product keeps its own
  personality, density, and layout suited to its job.
- **Front door, not dashboard.** The launcher introduces BakerRang and speeds entry into apps; it is
  not a widget console.
- **Independently real.** Each product is separately deployable and separately installable; the
  ecosystem must make adding a new product easy without growing one monolith.
- **Trust through restraint and craft**, especially for Passwords; deliberate typography, hierarchy,
  and motion over decorative effects.
- **Accessible and theme-first.** Light/dark/system, sufficient contrast, and clear focus states are
  baseline, on phone and desktop.

## Accessibility & Inclusion

Light, dark, and system themes with AA-minimum contrast in both; visible keyboard focus; responsive
phone-and-desktop use; restrained, meaningful motion (respect reduced-motion).
