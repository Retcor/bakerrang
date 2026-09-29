---
version: 1
slug: "passwords"
primary_target: "passwords"
related_targets: []
---

## Scope & mode

Surface: the **Passwords** consumer app at `passwords.bakerrang.com` (`web/apps/passwords`, `@bakerrang/web-passwords`).
Comp: `web/.impeccable/mocks/passwords-comp.html`. One route (`/`) carrying the whole vault state machine: Welcome
(signed out), Create vault, Unlock, and the unlocked three-pane vault with its entry sheet and dialogs, plus Not found.
Mode: **Operate**. Security, data and API contracts are locked in `docs/apps/PhaseG-Passwords.md` (§§1–18) and outrank
anything here.

## Audience, job, action, constraints

One signed-in person (sometimes a household sharing a folder) who keeps logins in folders behind a master password.
Job: find a login in seconds, copy the username, show or copy the password, open the site, and occasionally add, edit,
file or share. Real scene: at a desk in a normal lit room, or on a phone mid-login on another site or app, one thumb,
often in a hurry. Constraints: the consumer world (charcoal + reserved gold, Archivo/Archivo Expanded, 1px rules, 4/8px
radii, no glass/gradients/cards); light and dark first-class; phone and desktop; PWA; **the legacy Passwords UI is the
primary visual inspiration (owner)**; secrets never appear in the DOM, attributes or the accessibility tree while hidden;
every value in comps and captures is synthetic.

## Direction contract

THESIS. Passwords is **the legacy three-pane vault, re-cut in the BakerRang workbench**: folders | a dense entry index
with its A–Z rail | an entry sheet that opens in View. It refuses the category default of a card grid of site logos
with a big "Security score", and it refuses security theater (shields, padlock heroes, neon).

OWN-WORLD. Three ruled columns flat on the world ground: the folder rail and the sheet sit on Ground 2 behind
Line-strong rules, and the index sits on the ground with hairline rows that fill Plane on hover and selection. The
selected title carries a 1px Passwords Slate underline. Kinds are small-caps text (SHARED, VIEW ONLY, CAN EDIT, CAN'T
OPEN). Gold (owner, 2026-09-27) marks action: gold fills on New entry and on each sheet/dialog commit (Save, Add entry, Use latest, Share, Import, Export, Move, Done), gold switches and checked boxes, and Gold Text on active states (a shown password, Copied, the draining rule, the current letter, the selected folder count, tool hover). Copy/Show/Open/Edit/History/Delete are icon-only tools with named tooltips. Revealed secrets are set in the system
monospace.

STORY. Unlock, and the vault is simply there: the tree on the left, thirty logins in a tight list, the rail at the
edge. Pick Example Bank and its sheet opens beside the list with the username, a fixed row of twelve bullets, and the
website. Show the password and it appears in mono while a thin rule under it drains back to hiding. Copy says
"Copied", never the value. Edit, Replace password, Generate, Save.

FIRST VIEWPORT. Desktop 1440: the 58px bar (B | Passwords · switcher · avatar). The toolbar: gold **New entry** at the
left, quiet Import / Export / Activity with labels, then Vault settings and a labelled **Lock** alone at the far right. Below,
full-height columns: the folder rail 248px (FOLDERS, All entries 30, Unfiled 12, the tree, + New folder, SHARED WITH ME),
the index (context line "All entries 30", search with the select-all box, one-line rows, the A–Z rail on its right edge),
and the entry sheet 440px open on Example Bank in View. Phone 390: bar, toolbar, folder bar, search, two-line rows + rail.
The entry opens full-screen with Back.

FORM. Owner-pinned before any roll (2026-09-27): "Three panes, evolved", structure 1 of 2 on the planner's list,
derived from the legacy Passwords UI. A user-pinned direction beats the roll, so no concept-seed round ran and there's no
seed key. Code-led (no image generation).

SIGNATURE. **The Mask and the Draining Rule.** The hidden password is a fixed row of twelve Ink 3 bullets (never
length-revealing). Show swaps them in place for the value in mono, and a 1px Gold Text rule under it drains right to left
over 30 seconds. When it empties, the bullets return. Reduced motion: no drain, a static "Hides after 30 seconds".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Resolved sub-decisions

- **Owner (2026-09-27):** keep folder sharing; search matches title, username and website only (notes are secret-class);
  structure "Three panes, evolved".
- **View first, Edit explicit** (security, confirmed by the legacy audit): opening an entry never focuses a field or
  places the password in an input. Edit shows "Unchanged · Replace password". Replace/New use an empty, uncontrolled
  field with Show and Generate.
- **Legacy inheritance:** PRESERVE the three-pane proportions, one-line dense rows, the tree anatomy (grip, chevron,
  indent, count, ⋮, the shared people mark, the "Shared with me" group), the A–Z rail, the gold New entry at the toolbar's
  left with quiet tools and Lock alone at the right, gold on commit buttons (Save included, as legacy had it; owner
  amendment), the sheet header (back · title · history), the per-field tools, the bottom bulk bar, and the phone folder
  bar + full-screen sheet. REPLACE glass cards, boxed rows, the four always-gold tool squares, glyph icons, the row
  hover-trash and the length-leaking dots.
- Dialogs (Import, Export, Share, History/Activity, Vault settings, Move folder) are native `<dialog>`s, full-height
  sheets on phone. Listboxes are custom, never a native `<select>`.
- Errors and notices are Ink + a drawn icon on ruled strips. Danger text only for Delete, destructive confirms and Sign out.
- **Phone toolbar (cited adaptation, PhaseG §20):** New entry (gold), Activity, a ⋯ More menu (Import from KeePass,
  Export to KeePass, Vault settings), and a labelled Lock. With 44px targets, legacy's four icons plus a labelled Lock
  don't fit 358px.
- **Finish-review fixes (round 1):** the empty vault's rail reads empty; a conflict swaps Save for an ink "Use latest"
  (one ink primary, no duplicate Cancel); Revoke is a quiet action (Danger only on destructive confirms); on phone the
  new-password field has its own full-width row with Show inside it and Generate below; rail group titles carry the
  world's trailing 1px rule; the A–Z rail marks the current letter while the list scrolls.
- **Owner amendment (2026-09-27): more gold, icon-only tools.** The mock read too black and white. Gold now marks action
  across the surface (see OWN-WORLD), superseding "Gold = New entry only" and "Save is ink" **for Passwords only**; the world
  rule is unchanged elsewhere. Copy, Show, Open, Edit, Version history and Delete are icon-only (40px; 44px on phone), each
  with an accessible name and a hover/focus tooltip; "Copied" shows as a gold check and a tooltip that stays for 2 seconds.
  Everything else keeps its label.
- **Version history / Activity (owner, 2026-09-27): the legacy model restored.** A timeline of separate sections (Plane 2
  blocks on a spine), each with a coloured node and small-caps action label: Created green, Edited amber, Moved blue,
  Deleted red, vault events Ink 3, plus a legend. Changed fields sit in amber-tinted rows with a CHANGED tag and old → new.
  An "unchanged" line follows. Created lists its first fields; Deleted has Show/Hide what it held. Secrets stay masked,
  with a per-version Show. These status colours are Passwords-scoped tokens and appear only in history.
- Copy is announced by state ("Password copied"), never by value. There's no clipboard auto-clear and no claim of one.

## Unresolved / for review

- Every name, username, website and secret in the comp is synthetic (`example.test`, `SYNTHETIC-…`).
