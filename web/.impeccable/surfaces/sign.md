---
version: 1
slug: "sign"
primary_target: "sign"
related_targets: []
---

## Scope & mode

Surface: the **Sign** consumer app at `sign.bakerrang.com` (`web/apps/sign`, `@bakerrang/web-sign`). The comp is at
`web/.impeccable/mocks/sign-comp.html`. There is one working surface, **the viewfinder** (camera frame + docked target
line), plus Welcome (signed out) and Not found. Mode: **Operate**. Architecture and product truth live in
`docs/apps/PhaseE-SignLanguage.md`.

## Audience, job, action, constraints

A signed-in person learning the ASL manual alphabet, at a laptop webcam or with a phone propped up. They hold up a
handshape and want to know whether it reads as the letter they meant. Job: see what Sign reads at their hand and
in large text, pick a handshape from the 20 it can read, and hold it until Sign says **Held**. It is **not an
interpreter** (legacy overclaimed). Coverage is honest: 17 letters plus 1, 5 and I love you, and not D M N P Q R S T U.
The camera stays on the device, and nothing is sent or saved. Sign has **no audio** and every output is text. Constraints:
shared consumer world (charcoal + reserved gold, Archivo, 1px rules, no glass, gradients or card grids); light + dark
first-class; phone and desktop; independent PWA; the owner wants the reading **drawn at the hand**, mirrored as large
real text for accessibility.

## Direction contract

THESIS. Sign is a camera **viewfinder**, not a video-call tile or a dashboard. The mirrored camera sits inside a
near-black finder frame with 1px crop-mark corners marking where to hold your hand. What Sign reads is drawn at the
hand and printed in the finder's caption strip, like a camera's info rail. It refuses the category default: a
rounded webcam card floating in a glass panel beside a stat grid.

OWN-WORLD. The consumer world plus one fixed object. The finder is `#0c0b0a` in **both** themes (a camera, not a
surface) with white-ink rails, crop marks and a skeleton. Around it is the world ground, Archivo only, with Archivo
Expanded for the reading glyph. Below it, the target line is printed on the ground above one hairline-ruled hold row (no raised
slab, unlike Polyglot's dock): Target ▾, a how-to sentence, a 12-segment hold rule, the tally. Gold = the camera key
only. Sign Violet = emblem, held ticks and hover only.

STORY. Tap Start camera and allow it. Hold up a hand, and the reading appears at the hand and in the caption. Pick
Target ▸ L from the handshape sheet, read "Raise your index finger and stick your thumb out", hold. The rule fills,
the crop marks lock in, and it says Held. Then Next.

FIRST VIEWPORT. Phone: the 58px bar (pixel-B · Sign · switcher · avatar). The finder fills the middle: top rail
"Mirror · Stays on this device", the mirrored video with crop marks and the reading at the hand, then a caption strip
with the glyph (~44px) and "Letter L". Below it, the target line: "Target L ▾" with its how-to, the hold rule +
"Hold it…", and a full-width **gold Stop camera** key in the bottom third. Desktop: one column ≤ 960px. The finder is
capped so the target line never leaves the viewport.

FORM. "The Viewfinder", position 5 on the re-rolled ordered list (re-roll 1), dealt by the roll and locked by the
product owner on the decision page. Seed key 3051b08d (surface scope, mode operate, --reroll 1). Code-led.

SIGNATURE. **Focus lock.** When a target is Held, the four crop marks step 6px inward and thicken, like a camera
confirming focus, then settle back. Under reduced motion they only thicken. The same moment is announced as text:
"Held: Letter L".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Resolved sub-decisions

- One route (`/`). Sign-in required (owner). Welcome for signed-out visitors, with an example finder (synthetic
  skeleton drawing, labelled "Example").
- A reading commits after 400 ms steady. The hold is 1.2 s. J/Z are Held on detection. No transcript/tape (owner).
- The handshape reference is a 5×4 grid of glyph cells in an anchored panel (desktop, opening upward from Target) or a
  bottom sheet (≤640px). Type-ahead, with each cell's how-to shown for the focused cell. Never a native `<select>`.
- The session tally is memory only. There is no score, streak or history.
- The overlay colors are fixed video-safe white/ink, independent of theme.
- The target line stacks and the camera key goes full width (60px) at ≤760px; the phone layer starts at 640px.
- The coverage note ("What Sign reads") is reachable from the target line and inside the sheet.
- **Stable layout (finish review, fix 1).** The hold row has fixed slots: rule · state · slot (tally, or Next after
  Held) · "What Sign reads". It never wraps, and the finder's size never changes across reading, holding, Held or
  target changes at 390 and 1440. The how-to line reserves two lines.
- **Focus lock plays forward (fix 2).** Toggle the lock class on the **persistent** crop element a frame after
  paint (or run a keyframe): step 6px inward and thicken, hold ~900 ms, release. Under reduced motion it only thickens.
- **No re-mounting (fix 6).** Reading, holding and Held update the existing nodes. Controls (camera key, Target
  trigger, Clear, the picker) are never re-mounted, so keyboard focus stays put. On Held, focus does **not** move
  (Next is not auto-focused). The polite live region is the only announcement. After Clear, focus moves to the
  Target trigger. The comp re-renders `#root` for convenience only and restores focus, so Codex must not copy that.
- **Motion targets (fix 5).** J/Z show no hold meter and no progressbar. They show a note ("Held the moment Sign sees
  the motion.") under the how-to and a state (Not yet → Held).
- **Caption strip right slot.** Target-match text: "Target L · not yet" / "On target" / "✓ Held" (on phone the
  not-yet text is omitted; the hold row carries the status). It's text, never color alone. The empty glyph cell shows a drawn Ink-3 hand, not a dash.
- **Signed-out top bar (fix 8).** On Welcome the top-bar Sign in is a **ghost** button and the page's one gold fill is
  "Sign in with Google". This follows the DESIGN.md Polyglot layer precedent ("On Welcome the only gold fill is 'Sign
  in with Google', and the top-bar Sign in there is a ghost button") and The Reserved Gold Rule (one gold fill per surface).
- The Welcome example carries "Example" as a tag on its own rail. There is no eyebrow above it (fix 3).
- The rail shows no camera resolution (a costume detail with no meaning for a learner).

## Unresolved / for review

- The comp's camera image is **synthetic**: a drawn hand silhouette and skeleton stand in for live video.
- Handshape illustrations are deliberately absent (words-only how-to). Adding drawn handshape art is future scope (R6).
