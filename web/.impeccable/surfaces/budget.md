---
version: 1
slug: "budget"
primary_target: "budget"
related_targets: []
---

## Scope & mode

Surface: the **Budget** consumer app at `budget.bakerrang.com` (`web/apps/budget`, `@bakerrang/web-budget`). Comp:
`web/.impeccable/mocks/budget-comp.html`. There are two working sheets, **Month** (`/`, `/month/YYYY-MM`) and **Plan**
(`/plan`), plus Welcome (signed out) and Not found. Mode: **Operate**. Architecture, money/date contracts and product
truth live in `docs/apps/PhaseF-Budget.md`.

## Audience, job, action, constraints

A signed-in person who gets paid on a schedule (monthly, every two weeks or weekly, sometimes from more than one
source) and pays a set of monthly bills, debts and the odd one-off. Job: before and around each payday, see **what
this paycheck has to cover until the next one, and what's left**. Tweak an amount or a due day when a bill changes.
Budget is a **plan, not a record**: there are no transactions, no bank links, no "spent" tracking. Legacy overclaimed
("track spending"). Constraints: shared consumer world (charcoal + reserved gold, Archivo, 1px rules, no glass,
gradients, KPI cards or donut charts); light and dark first-class; phone and desktop; independent PWA; money is
exact (integer cents) and dates are civil dates.

## Direction contract

THESIS. Budget is a **pay-period ledger**, set as two ruled sheets. **Month** answers "what does each paycheck have
to cover until the next one, and what's left?". **Plan** holds the standing rules that produce it. It refuses the
category default: KPI cards over a donut chart, and a month grid of colored chips.

OWN-WORLD. Consumer world, flat on the ground. No containers: sheets are hairline-ruled rows on a 920px column.
Each paycheck heads its period as a Ground-2 band. Money sits in one right-aligned tabular column, and accounting rules
do the structure: a single rule over Covered, a double rule under Left. Kinds are small-caps text tags (DEBT, ONE-OFF,
AUTO, PAID FROM …), never colored chips. Gold = Add only. Budget Blue = emblem + row hover mark only.

STORY. Open Budget and September shows four paychecks, each with its dated bills, Covered and Left (or Short).
Income · Bills · Net stays pinned at the foot. Tap Rent, and it opens in place. Change the amount, Save, and the
column re-foots. Switch to Plan to add a payday.

FIRST VIEWPORT. Desktop: the 58px bar. The sheet head: ‹ **September 2026** › (Archivo Expanded 800, ~2rem), the
Month | Plan switch, and gold **Add** at the right. Then the ledger starts with the first paycheck band. The statement
is pinned at the bottom. Phone: title + arrows; the switch goes full width; ledger; the statement pinned over a
bottom bar holding the full-width gold Add.

FORM. "Plan and Month", position 3 on the ordered list, dealt by the roll and locked by the product owner.
Seed key a78dd77e (surface scope, mode operate). Code-led.

SIGNATURE. **Re-footing.** After a save, only the figures that changed roll to their new value (120ms, vertical),
and the period's double rule redraws left to right (180ms). Under reduced motion, values swap instantly. The new
totals are announced once.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Resolved sub-decisions

- **Early bills (owner, 2026-09-26):** an automatic bill is paid by the **most recent payday on or before its due
  date**, even when that payday was last month. A bill can still be assigned to a payday by hand ("Paid from").
  The unit is the pay period: a paycheck covers bills until the next payday of any source.
- A Month shows every period that starts in the month, plus any earlier period that covers a bill due in the month
  (the carried-in period). Bills dated outside the month are shown in their period in Ink-3 with their month
  ("Oct 1"). The foot statement is month-based: paychecks received and bills due in the month.
- Edits happen **in place** (the row opens into its editor) on both sheets and at every width. One editor is open
  at a time. Save is an explicit ink-filled button (gold stays on Add). Delete confirms inline.
- Custom listboxes for "Paid from" and the month picker. Never a native `<select>`. Date fields are native
  `type="date"` with `color-scheme` following the theme.
- Left/Short and Net are words plus a sign, never color alone.
- **Bands are ruled section heads (finish review fix 3):** Ground-2 across the full column, Line-strong top rule, Line
  bottom rule, no side borders, no radius.
- **Statement label is "Net" (fix 4)**, with the sign in the figure. "Left" is reserved for per-period figures.
- **Gold discipline (fixes 1–2):** in first run the generic Add is ghost, so "Add a payday" is the only gold. While
  loading or after a failed load, Add is not rendered, and "Try again" leads.
- **Phone (fixes 5, 6, 8):** month arrows and small buttons are 44px. The out-of-month note is sr-only at ≤640px. The month
  title uses the clamp floor (no override).
- **Pay-period line (post-review lock, 2026-09-26):** under each band, `Pay period {start} – {end}` names only the
  automatic window (payday → the day before the next payday of any source). When "Paid from" bills are due after it,
  append `· 1 bill due later is paid from here` / `· N bills due later are paid from here`. Those rows keep their real date
  and `PAID FROM …` tag, plus a screen-reader-only `, due after this pay period`. Covered/Left include them. "Covers" is
  retired. No new visual marker.
- **Screen readers (fix 7):** the Today rule is a real row. The phone Plan duplicate schedule line is aria-hidden.

## Unresolved / for review

- All comp figures are **synthetic** example data, and the Welcome example sheet is labeled "Example".
