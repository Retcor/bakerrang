---
version: 1
slug: "polyglot"
primary_target: "polyglot"
related_targets: []
---

## Scope & mode

Surface: the **Polyglot** consumer app at `polyglot.bakerrang.com` (`web/apps/polyglot`,
`@bakerrang/web-polyglot`), comp at `web/.impeccable/mocks/polyglot-comp.html`. One surface, the
**instrument** (the exchange log + docked composer), plus Welcome (signed out) and Not found. Mode:
**Operate**. Architecture + product truth: `docs/apps/PhaseD-Polyglot.md`.

## Audience, job, action, constraints

A signed-in person in a face-to-face moment (a station, a shop counter, a visiting relative) who needs
to be understood now. Job: tap, speak, tap, then see what was heard and its translation, and hear the
translation in their **own cloned voice**. The other person answers, the pair is swapped, and the loop
repeats. Legacy **Polyglot Instant is the product**. Normal Polyglot is retired, and its typed input,
visible text and voice choice survive as subordinate parts. Nothing is saved: the log is this session
only, in memory. Constraints: shared consumer world (charcoal + reserved gold, Archivo, 1px rules, no
glass/gradients/card grids); light + dark first-class; phone-first, one-handed; independent PWA.

## Direction contract

THESIS. Polyglot is an interpreter's running log, not a translator form. Every turn becomes a ruled log
entry, with what was heard set small and what it became set large. The newest entry sits directly above
a docked composer that holds every control within thumb reach. It refuses the category default, a
two-pane source/target board around a glowing mic orb, and it refuses a chat app's bubbles.

OWN-WORLD. The consumer world at its plainest: world ground `#161514` / `#efece6` (not Story Book's desk),
Archivo only. Translations are Archivo 500 at reading-to-display size. Heard lines are Archivo 400 Ink-3.
The turn gutter carries tabular turn numbers and a direction code (`EN→ES`) in Label style. Entries are
separated by 1px rules, never cards. The composer is a Plane slab docked on the ground with a hairline
and an upward resting shadow. Gold = the talk key only. Signal Teal `#58C0C9` / `#1f7d86` = the emblem
and hover only. The live entry's three-segment stage rule (heard · translated · spoken) is the one
signature detail.

STORY. They set English ⇄ Spanish once. They tap Talk, speak, and tap again. The entry appears, the heard
line lands, the stage rule advances, and the translation arrives large while their voice says it. They
swap, the other person speaks, and a new entry stacks below. Typing is one tap away when speaking isn't possible.

FIRST VIEWPORT. Phone: 58px bar (pixel-B · Polyglot · switcher · avatar). The log fills the middle, with a
thin "This conversation · not saved · Clear" strip at its head, older entries small, and the newest entry's
translation at ~1.9rem. Docked at the bottom inside the safe area: a pair row (From ▾ · ⇄ · To ▾ · voice)
and then a row of a keyboard button and the full-width **gold Talk key** (64px, "Speak English"). Desktop:
the same column centred at ≤ 880px. The composer stays docked, with the type field inline beside a 240px Talk key.

FORM. "The Exchange Log", position 3 on the ordered structural list, dealt by the roll and locked by
the product owner on the decision page. Seed key b0752628 (surface scope, mode operate).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Resolved sub-decisions

- One product and one route (`/`). `/instant` redirects to `/`. No modes.
- The log is **session-only memory** (cap 50 turns, Clear action, cleared on reload). There is no history
  feature and it is never persisted or cached.
- Stages are real (heard → translated → spoken), each marked only after its request returns. There is no fake progress.
- Every control is in the composer (pair, swap, voice, type, talk). The top bar carries only ecosystem chrome.
- The talk key stays gold in every state (it is always the primary action). Listening = timer + ink level bars on gold.
- Language pickers: an anchored listbox that opens upward on desktop and a full-height sheet on phones,
  both with type-ahead. Never a native `<select>`.
- Theme control lives in the account menu (as in Story Book). No voices ⇒ text-only with an Account hint.
- Copy is the one small affordance without an exact legacy control (see PhaseD §3.8). **Approved (lock round).**
- **Older-turn actions (lock round):** the newest turn shows copy + replay icons. On hover-capable wide
  screens, older turns reveal them on hover/focus. On touch or ≤ 640px, each older turn carries **one** quiet
  `⋯` overflow control that opens "Copy {Language} text" / "Say it again in {voice}" (replay only when a
  voice exists). Phone users get parity without a permanent icon pair on every turn.
- **Turn identity:** each turn has a stable session-unique id, independent of the capped array. The
  displayed turn number is presentation only (PhaseD §7b).
- **Audio lifecycle:** raw audio lives only until transcription settles. A translation failure keeps the
  heard **text** for Try again ("What we heard is still here…"), never the recording.
- First-run pair English → Spanish. 60 s recording cap auto-stops and proceeds normally (not an error).

## Unresolved / for review

- The sample conversation in the comp (Madrid train, English ⇄ Spanish) is **synthetic**.
- Replay on any earlier turn re-requests TTS (legacy re-bills replay too).
