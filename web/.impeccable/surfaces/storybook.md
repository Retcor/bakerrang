---
version: 1
slug: "storybook"
primary_target: "storybook"
related_targets: []
---

## Scope & mode

Surface: the **Story Book** consumer app at `storybook.bakerrang.com` (`web/apps/storybook`,
`@bakerrang/web-storybook`), comp at `web/.impeccable/mocks/storybook-comp.html`. Four surfaces in one
journey: **library** (contents), **compose + generate**, **reader** (spread), **manage** (rename /
delete). Mode: **Read** for the reader (the flagship), **Operate** for library/compose.
Architecture + product truth: `docs/apps/PhaseC-StoryBook.md`.

## Audience, job, action, constraints

All-ages, general audience (product-owner decision 2026-09-22 — not a children's app; the server's
kid-safe image prompt stays). A signed-in person types one idea, gets a short illustrated story
(one generated picture per page), reads it, optionally has a page read aloud in **their own cloned
voice**, and comes back to it later. Every generated story **auto-saves** to the library (decision
2026-09-22). Narration stays **cloned-voice-only** (decision 2026-09-22). No sharing/public stories
exist. Constraints: shared consumer world (charcoal + reserved gold, Archivo chrome, 1px rules, no
glass/gradients/card grids); light + dark first-class; excellent phone reading; independent PWA.

## Direction contract

THESIS. Story Book is an open book, not an app screen: every story is read as a **spread** —
illustration on the verso, story text on the recto, a real gutter between — and the library is that
book's **contents page**. It refuses the AI-writer default (prompt box over a card grid of results,
purple generation shimmer) and the fake-leather skeuomorph alike; book-ness comes from proportion,
folio, gutter, running head and serif text, not from texture.

OWN-WORLD. Inherits the consumer world (charcoal desk `#161514`, Archivo/Archivo Expanded chrome,
gold reserved for the single primary action per surface, 4/8px radii, contact/resting shadows). Adds
a **reading layer**: pages are their own tonal plane (dark `#1f1c19` page on charcoal desk, warm ink
`#ece4d8`; light `#ffffff` page on `#e6e1d8` desk, ink `#221e19`), story content set in **Literata**
(self-hosted OFL, screen-reading serif) while every control stays Archivo. Story Ember `#F08A5D` /
`#C25A34` appears only as the emblem, a thin ribbon marker for "you stopped here", and hover.

STORY. The reader opens their library and sees a contents page of their stories — title, first
line, pages, date — with one gold "Begin a new story". They type an idea on a blank recto, watch the
book get made honestly (writing, then each page's picture arriving), land on page one of the spread,
turn pages by edge, arrow key or swipe, and tap Read aloud to hear the page.

FIRST VIEWPORT. Reader, desktop: a slim 56px reading bar (← Stories · running title · Read aloud ·
⋯ · switcher · avatar); below it the spread centred on the desk, height-fitted to the viewport,
~1.42:1, verso plate square with generous margin and folio, recto text at ~21px Literata on a ~34em
measure with running head and folio; page arrows sit in the desk margins; a segmented page rule
under the spread. Phone: plate full-width then text, reading bar hides on scroll, fixed bottom bar
(‹ folio › · Read aloud) inside safe areas. Primary action on library/compose: the single gold button.

FORM. "The Spread" — picture-book double-page spread; position 1 on the ordered structural list,
dealt second by the roll and locked by the product owner over the rolled lead "The Turning Page".
Seed key b2de518f (surface scope, mode read).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Resolved sub-decisions

- Generation progress is **real** (stage + per-page picture arrival), never the legacy fake timer %.
- A page whose picture failed shows a typographic verso (large folio + title), not a broken image.
- Reading position is a per-device convenience (localStorage): the ribbon marks stories left mid-way.
- Rename is inline (title becomes editable); delete is the only dialog (destructive, protected focus).
- Theme control moves into the avatar menu in Story Book to keep chrome quiet.
- Lock round (2026-09-22): "Write again from this idea" removed (no legacy equivalent; no new scope).
- App switcher links each tool straight to its current live destination from the shared `web-app-shell`
  registry (unextracted tools → their legacy `bakerrang.com/<route>`); only the brand mark and "All tools"
  go to the Launcher.
- Library thumbnails are the stored 200 px `thumbnail` from the summary endpoint; `null` → typographic tile.

## Unresolved / for review

- Sample stories and illustrations in the comp are **synthetic** (authored SVG stand-ins for the
  generated DALL·E pictures); replace nothing in production — real pages show the user's images.
- Auto-advance narration across pages is deferred (legacy narrates one page).
