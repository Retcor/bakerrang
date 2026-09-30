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
  story generation with narration), **Polyglot** (spoken translation in your own cloned voice; the
  legacy "Instant" experience *is* Polyglot — no separate mode), **Sign** ("Sign Language" in the registry: ASL handshape practice via the camera, read on-device; not an interpreter), **Budget** (a
  paycheck-to-bills planner, not a spending tracker), **WoW Advisor** (World of Warcraft assistant; **retired from
  migration 2026-09-27**: legacy-only until decommission, never extracted or redesigned), **Passwords** (a password
  vault encrypted in the browser with a separate master password), and **Account** (cross-cutting, not a tool).
- **Supermarket is removed from the ecosystem (obsolete).** It was built for a game/use case no
  longer relevant and is being **deleted, not migrated** (no `supermarket.` subdomain, no app, no
  Account "licenses" carryover). Its decommission is scheduled in the migration plan; see
  `docs/apps/Phase0-EcosystemArchitecture.md`.
- **Passwords encrypts on the device**: the server never sees entry contents or the master password. Nothing in
  a redesign may weaken that or cache sensitive data. It is a distinct, high-trust product. Don't call it
  "zero-knowledge" (BakerRang does see metadata; see Phase G).
- Shared session/auth, CSRF, and API infrastructure already exist and are reused unchanged.
- **Resolved (Phase D, 2026-09-25):** there is **one Polyglot** — neither a separate "Instant"
  destination nor a mode. Legacy normal Polyglot is retired; legacy Instant becomes Polyglot.

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

## Product: Polyglot (Phase D truth, 2026-09-25)

Full inventory, retirement analysis and architecture: `docs/apps/PhaseD-Polyglot.md`; surface brief:
`.impeccable/surfaces/polyglot.md`.

- **What it does:** tap, speak, tap — Polyglot transcribes what it heard (Deepgram), translates it
  (OpenAI) into one of 29 languages, shows both as text, and says the translation aloud in the user's
  **own cloned voice** (ElevenLabs). Swap the pair and the other person answers. Typing is a secondary
  input; the translation can be copied and replayed.
- **Real scene:** a face-to-face moment (station, counter, visiting family), phone in hand, one thumb.
- **Polyglot keeps nothing** (it can't speak for the AI providers it sends speech/text to — never
  claim "nothing is saved" absolutely). No history, no phrasebook, no server data; the on-screen conversation is
  session memory only (Clear / reload empties it). Only the language pair and chosen voice are
  remembered, per device.
- **Voices:** cloned voices only (made in Account). Without one, Polyglot still translates as text.
  No stock voice; none may be claimed.
- **Not offered (don't imply):** automatic source-language detection, offline translation, saved
  history, conversation/split-screen mode, accuracy claims. No quotas or pricing exist.

## Product: Sign (Phase E truth, 2026-09-25)

Full inventory, retirement analysis and architecture: `docs/apps/PhaseE-SignLanguage.md`; surface brief:
`.impeccable/surfaces/sign.md`.

- **What it does:** the camera reads your hand **on this device** and shows the ASL handshape it reads, both drawn at
  your hand and as large text. Pick one of its handshapes as a target and hold it; Sign says **Held**.
- **What it reads (exactly 20):** letters A B C E F G H I J K L O V W X Y Z (J and Z by their motion), the numbers 1
  and 5, and I love you. **It can't read D M N P Q R S T U**, reads one hand at a time, and reads handshapes, not
  signs in context. It is a **practice aid, not an interpreter**: never claim interpretation, translation,
  fingerspelling of words, "A–Z", accuracy, or support for any sign language other than ASL.
- **Real scene:** someone learning the ASL manual alphabet at a laptop webcam or with a phone propped up, checking
  whether a handshape reads the way they meant it.
- **Privacy is structural:** no video, image, landmark or reading leaves the browser. Sign calls no product API and
  stores nothing (the held-this-session tally is memory only). "Sign sends no video or images anywhere" is true by
  construction and may be claimed.
- **No audio:** every output is visual text, so nothing depends on hearing. Sign-in is required (ecosystem
  consistency), though the feature itself needs no identity.
- **Not offered (don't imply):** words, sentences or a transcript; the missing letters; two-handed or moving signs
  beyond J/Z; sign→speech or speech→sign; other sign languages; saved progress, scores or streaks; handshape images.

## Product: Budget (Phase F truth, 2026-09-26)

Full inventory, money/date contracts and architecture: `docs/apps/PhaseF-Budget.md`; surface brief:
`.impeccable/surfaces/budget.md`.

- **What it does:** you enter your paydays (monthly on a day / first / last, every 2 weeks, or weekly) and your bills
  (monthly bills, debts with an optional last payment, and one-offs). **Month** shows each paycheck with the bills it has
  to pay before the next payday, what that covers, and what's **Left** (or **Short**). **Plan** holds the rules.
- **Allocation rule (owner):** an automatic bill is paid by the most recent payday on or before its due date, even last
  month's. A bill can be assigned to a payday by hand ("Paid from").
- **Real scene:** checking, around payday, whether this paycheck covers rent and the rest, often on a phone.
- **It is a plan, not a record:** no transactions, no "spent", no bank or account connections, no balances that update,
  no charts. The debt "balance" is a note the user keeps. USD only. Amounts are exact to the cent.
- **Data:** one private document per user in the BakerRang account (shared with the legacy `/budget` page during
  coexistence). Never claim encryption, bank-grade security or "private" beyond "saved to your BakerRang account".
- **Not offered (don't imply):** spending tracking, categories of spending, budgets-vs-actuals, reminders or
  notifications, bank sync, CSV import/export, multiple currencies, sharing, savings goals, forecasts.

## Product: Passwords (Phase G truth, 2026-09-27)

Full inventory, security audit, crypto/API contracts and architecture: `docs/apps/PhaseG-Passwords.md`; surface brief:
`.impeccable/surfaces/passwords.md`.

- **What it does:** keeps logins (title, username, password, website, notes) in nested folders, encrypted in the browser
  with a **master password that is separate from Google sign-in**. Unlock, find an entry, copy the username, show or
  copy the password, open the site. Edit, file, bulk-move, import from and export to KeePass (`.kdbx`, in the browser),
  share a folder with another BakerRang user (edit or view only), and see version history.
- **Real scene:** mid-login on another site or app (often on a phone), or tidying the vault at a desk.
- **Security truth (claims):** entries are encrypted on the device before they're saved (AES-256-GCM, Argon2id), and
  BakerRang stores the encrypted copy and can't read entries. **No recovery:** a forgotten master password can't be
  recovered. BakerRang **does** see metadata (account email, entry and folder counts and arrangement, change times, who
  you share with), and the vault relies on the app code the browser loads. Say "Encrypted on your device". **Never** say
  zero-knowledge, end-to-end encrypted, bank-grade, military-grade or unhackable, and never claim the clipboard is cleared.
- **Search** matches title, username and website only. Notes are treated like passwords: never kept in the list or search,
  held only while their entry is open. (Unlocking briefly decrypts each whole entry to build the list; never claim passwords
  or notes are "decrypted only when opened".)
- **Legacy design is the inspiration (owner):** the three-pane vault (folders | dense list + A–Z rail | entry sheet)
  carries forward. Entries open in View, with an explicit Edit.
- **Not offered (don't imply):** password recovery, changing the master password (deferred), TOTP/2FA codes,
  attachments, favorites, tags, breach or "health" checks, autofill from the web app (the browser extension does that),
  offline access, a password score.

## Product: Account (Phase H truth, 2026-09-29)

Full inventory, ownership decisions, API contracts and architecture: `docs/apps/PhaseH-Account.md`; surface brief:
`.impeccable/surfaces/account.md`.

- **What it is:** the control room for BakerRang itself, not a product app. One page: **Profile** (your name and email,
  read-only, from Google), **Appearance** (light / dark / system for every BakerRang app), **Voices** (the cloned voices
  Story Book and Polyglot speak in) and **Session** (sign out).
- **Real scene:** a short, purposeful visit from an avatar menu or from Story Book / Polyglot ("Set up a voice in
  Account"): check which account you're signed in with, change the theme, add or tidy a voice, sign out. Then leave.
- **Theme:** the shared `web-theme` behavior (the `br_theme` cookie + the account preference) owns the logic. Account is
  one place to change it, not the only one. It works signed out too (saved in this browser).
- **Voices (owner, 2026-09-29):** add (record in the browser or upload up to 3 audio files, with a consent confirmation),
  rename, make primary, delete. Samples go to ElevenLabs, which creates and stores the voice; BakerRang keeps the name and
  description, not the audio. Story Book and Polyglot only choose among them per device.
- **Identity is Google's:** name and email can't be edited in BakerRang, and no photo, user id, "member since" or sign-in
  history is shown (none of the last two is stored).
- **Owns no app-specific settings:** vault lock timing and extension autofill live in Passwords. **Supermarket is gone
  from Account** (new and legacy).
- **Not offered (don't imply):** deleting your account, downloading your data, signing out other devices, changing email,
  notifications, security settings, billing. Account says plainly that deletion and export aren't available yet.

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
