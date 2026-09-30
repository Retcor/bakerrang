---
version: 1
slug: "account"
primary_target: "account"
related_targets: []
---

## Scope & mode

Surface: the **Account** consumer app at `account.bakerrang.com` (`web/apps/account`, `@bakerrang/web-account`). Comp:
`web/.impeccable/mocks/account-comp.html` (states via `?state=`). One route `/` (the account sheet), plus Welcome (signed
out, with a working Appearance section) and Not found. Mode: **Operate**. Product truth, API contracts and ownership live in
`docs/apps/PhaseH-Account.md`.

## Audience, job, action, constraints

A signed-in BakerRang user who is **not here to stay**. They arrive from an avatar menu or from Story Book / Polyglot
("Set up a voice in Account"), do one thing, and leave: see which Google identity they're signed in with, choose light /
dark / system for every BakerRang app, add or manage the cloned voices Story Book and Polyglot speak in, or sign out.
Account is cross-cutting infrastructure, **quieter than any product**. It owns no app-specific settings: vault settings
live in Passwords, Supermarket is gone. Identity is read-only (it comes from Google). There's no account deletion or data
export yet, and the page says so plainly. Constraints: the shared consumer world, light and dark first-class, phone
(390 × 844) and desktop, an independent PWA, the shared `web-theme` / `web-auth` behavior (never re-implemented here).

## Direction contract

THESIS. Account is **one ruled sheet with a section rail**: a quiet index of four sections (Profile, Appearance, Voices,
Session) beside a single column of labelled rows. It reads like the specification page of BakerRang itself. It refuses the
category defaults: a giant avatar hero over a grid of settings cards, and a tabbed settings dashboard.

OWN-WORLD. Consumer world on the ground, no panels: section heads are Expanded 800 names over a `line-strong` rule, and
rows are label (Ink 2, 600 13px) | value or control, separated by 1px Line rules. Identity is a nameplate row (a 52px
initials monogram on the 4px control radius, never a photo). Kinds are small-caps text tags (PRIMARY, FROM GOOGLE). Account Grey `#A5A59C` /
`#63625a` marks only the emblem and the rail's current section (a 1px rule). Gold fills **Add voice** only (Sign in
with Google when signed out). Commits (Create voice, Save) are ink-filled. Danger is only Delete and Sign out.

STORY. You land on Account from your avatar. Your name and email sit at the top, labelled FROM GOOGLE. Choose Dark, and
the sheet repaints. A relay strip shows every BakerRang app taking the new ground in turn: "Saved to your account.
Every BakerRang app on this browser uses it now." Below, your two voices, one marked PRIMARY. Add voice opens in place.
Name it, record a minute or drop in a file, confirm it's your voice, and Create. Sign out sits last, set apart.

FIRST VIEWPORT. Desktop 1440: the 58px bar (mark | Account; switcher and avatar right). The page head "Account"
(Expanded 800, ~2rem) with a one-line lead. A 200px sticky rail at the left of a 920px column (Profile · Appearance ·
Voices · Session, with the current one marked), and a 680px sheet: the Profile nameplate, then Appearance with the
three-way theme choice and the relay strip, then the top of Voices with gold **Add voice** at its head's right. Phone
390: no rail. The head, the nameplate, Appearance, and Voices beginning above the fold; Add voice is full-width under
the Voices head.

FORM. "Section rail + one ruled sheet", position 4 on the ordered list of seven grounded structures, dealt by the roll
and locked by the product owner on the decision page. Seed key e184acff (surface scope, mode operate). Code-led (no
image generation).

SIGNATURE. **The Relay.** Under the theme choice, a ruled strip of the six BakerRang app emblems (Launcher, Story Book,
Polyglot, Sign, Budget, Passwords), each on a 36px tile of the resolved plane. When the theme changes, the sheet repaints at
once and the tiles take the new ground one after another, left to right, 40ms apart (160ms each). The strip proves the one thing Account owns:
a single switch that reaches every app. Under reduced motion, the tiles change together, instantly. It's announced
once ("Theme set to Dark. Saved to your account.").

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Resolved sub-decisions

- **Owner (2026-09-29): voices stay in Account**, with full management: list, add (upload up to 3 files or record in the
  browser, with a consent confirmation), rename, make primary, delete. Story Book and Polyglot keep only their per-device
  voice choice and keep linking here.
- **Owner (2026-09-29): Supermarket is removed from Account only**, in both the new app and legacy Account. The legacy
  `/supermarket` page and backend stay until the final cleanup. Nothing Supermarket appears in `web/`.
- Vault settings aren't here. One quiet Session row points to Passwords → Vault settings.
- Theme is immediate (the shared `web-theme` contract). Voice edits are explicit (Save / Create). Make primary is a
  single immediate action. There's no page-level Save.
- Identity is read-only, with a "Manage your Google account" external link. No photo (initials, as the AccountMenu),
  no user id, no invented "member since".
- Edits happen in place, one editor at a time (Add voice or a rename). Delete confirms inline.
- Phone ≤ 760px: the rail is dropped; sections flow in one column; every target is ≥ 44px.
- **Finish review fixes (2026-09-29):**
  - The sheet repaints at once, and only the Relay tiles move (a page cross-fade collapsed contrast).
  - The Relay tiles have a hairline border, so they read as ground samples.
  - "Manage your Google account" sits in the nameplate, with one hint line under it (no separate "Signed in with" row),
    so Voices starts above the phone fold.
  - Session order is App settings → Your data → Signed in / Sign out. Sign out is last, set apart by space and one
    line-strong rule, and the row above drops its rule.
  - The checked theme segment adds 700 weight + a 1px Ink 3 border.
  - The in-place surfaces share one 12px bleed.
  - The page lead is one line at desktop.

## Unresolved / for review

- All names, emails and voices in the comp are synthetic.
