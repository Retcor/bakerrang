---
version: 1
slug: "launcher"
primary_target: "launcher"
related_targets: []
---

## Scope & mode

Surface: the BakerRang **consumer front door / app launcher** at `bakerrang.com` (comp built at
`web/.impeccable/mocks/launcher-comp.html`). Mode: **Persuade** — a first visitor must understand
what BakerRang is, recognize it as one trustworthy maker, and enter a specific tool quickly; a
returning signed-in visitor jumps back to their tools. This surface also establishes the shared
consumer visual world (family look reused across all apps).

## Audience, job, action, constraints

Everyday people who use one or more small BakerRang tools and sign in with Google. Signed-out job:
grasp BakerRang + choose/enter a tool + sign in. Signed-in job: switch to a tool + reach account.
Constraints: gold `#FFD500` + charcoal identity and the pixel-B monogram are pinned brand; each
product must have its own recognizable form (never a grid of identical SaaS cards); Passwords is a
high-trust zero-knowledge vault and must read as distinctly serious; light/dark/system + phone and
desktop are required; the anti-goals in PRODUCT.md (glass, ambient gradients, interchangeable cards,
card-in-card, pills-everywhere, oversized vague heroes, icon+heading+subtitle repetition, stat-grid
dashboards) are out of bounds.

## Direction contract

**THESIS.** BakerRang is a small collection of sharp, well-made tools from one maker — presented as
an organized, modern *workbench index*, not a marketing dashboard. It refuses the category default
(a hero headline over a uniform grid of icon+title+subtitle cards); each tool earns its own drawn
mark, accent, and place in a deliberately non-uniform, signage-clear layout.

**OWN-WORLD.** Charcoal ground (`#181818`/`#1f1f1f` planes) with **gold `#FFD500` reserved for
BakerRang identity, the single primary action/focus, and one rare intentional brand-emphasis moment**
(the masthead accentword) — never a broad fill or decoration. Type is an industrial-editorial
grotesque system: **Archivo Expanded** for display/signage headings, **Archivo** for body/UI, set
tight and confident with strong scale/weight steps and hairline rules for signage structure. Each
product carries one **muted, distinct accent** (never neon, never confetti) used only on its own
drawn SVG emblem + hover; all emblems share one 1.75/32 stroke weight so the set reads as a matched
tool kit. Surfaces are flat charcoal planes separated by 1px rules and restrained real shadows
(offset+blur), not glass. The **real BakerRang logo mark** (`bakerrang-logo.png`) appears as a
precise brand mark in the header + footer, not a theme. Utility/industrial character comes from
precision, alignment, tactile-but-restrained controls, and machined detail — **no skeuomorphism**
(no wood, pegboard holes, screws, or taped labels).

**STORY.** The visitor lands, immediately reads "BakerRang = a workshop of small, sharp tools,"
recognizes the charcoal/gold maker's identity, scans an organized index where each tool looks like
its own thing, and either signs in (signed-out) or jumps straight into a tool / switches tools and
reaches Account (signed-in). They leave able to name two or three specific tools, not "an AI app."

**FIRST VIEWPORT.** Slim top bar: the real BakerRang logo mark + "BakerRang" wordmark left; right =
theme control and (signed-out) a single gold "Sign in with Google" / (signed-in) a waffle
app-switcher + avatar menu. Masthead below on charcoal: the two-line Archivo-Expanded statement
**"Variety of Tools." (in gold) / "One Workshop." (in ink)**, a one-line concrete subline, and the
primary action (gold, singular); opposite it, a composed signature "collection" object — the **six
tool emblems** arranged as one matched kit (the bench), proving "many distinct tools, one maker"
before any scrolling. Primary action sits top-right in the bar and repeated in the masthead left
column.

**FORM.** Maker's-workbench-index fused with editorial/signage discipline (typography, clarity,
signage navigation), warm+distinctive but modern+restrained. Chosen from the audience's world of
matched tool kits + printed indexes/directories. Direction selected via a structured user-decision
probe (the human explicitly steered "Maker's Workbench with editorial/signage discipline — no
literal skeuomorphism; borrow Signal/Directory typographic clarity; pixel-B stays but not full
Pixel Arcade; not the generic Clean Launcher"); the concept-seed dice/decision-page were substituted
by that direct structured decision because this environment has no image generation. No seed key.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Resolved sub-decisions

- **Product set = 6 tools + Account.** **Supermarket is removed (obsolete)** — not on the bench, in
  the switcher, or in the directory; deleted, not migrated (decommission plan in
  `docs/apps/Phase0-EcosystemArchitecture.md` §11.S). The six tools: Story Book, Polyglot, Sign
  Language, Budget, WoW Advisor, Passwords.
- **Polyglot Instant = a MODE within Polyglot, not a separate launcher destination.** It shares
  Polyglot's domain/subdomain (`polyglot.bakerrang.com/instant`), so as an ecosystem *destination*
  Polyglot is one product; the launcher shows Polyglot once with a secondary inline "Instant mode"
  entry, avoiding a diluting near-duplicate tile.
- **Account** is a cross-cutting destination (top-bar avatar menu when signed in, separated below
  the tool grid in the app-switcher, plus a "Your account" directory entry) — **not a tool**, not on
  the bench, not in the "6 tools" count.
- **Masthead** = "Variety of Tools." (gold) / "One Workshop." (ink) — a sanctioned intentional
  brand-emphasis use of gold; light mode uses deep-gold `#8a6300` for contrast.
- **Real BakerRang logo** (`bakerrang-logo.png`) used in header + footer. **Footer** simplified to
  logo + copyright + "one maker, many tools" (placeholder About/Privacy/Account/Status links removed
  — no real destinations yet).
- **Sign Language** emblem = clear five-finger raised hand; **Budget** emblem = `$`-in-coin; both on
  the shared 1.75/32 emblem stroke.

## Unresolved / for review

- **WoW Advisor emblem** is a neutral placeholder crest — **no World of Warcraft logo asset exists
  in the repo** and the real mark must not be redrawn/approximated. A licensed/official asset must be
  provided before this emblem is final.
- Per-product accent hues are provisional (muted set); final values recorded in DESIGN.md.
- Default theme for the public front door: charcoal/dark (on-brand, distinctive) with a fully
  designed light mode — confirm at review.
- Self-hosting Archivo / Archivo Expanded (currently Google Fonts CDN) is a tracked pre-ship task.
