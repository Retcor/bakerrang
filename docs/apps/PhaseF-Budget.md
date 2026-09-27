# Phase F — Budget extraction (`budget.bakerrang.com`)

> **Status: PLAN.** Structure locked by the product owner. The Impeccable finish verdict is recorded in §24. Awaiting
> ChatGPT review. **No production code has been written.**
> Author role: Planner / Product-Design / Architecture authority.
> Builds on the locked [Phase 0 architecture](Phase0-EcosystemArchitecture.md) and the Phase C/D/E template
> ([Story Book](PhaseC-StoryBook.md), [Polyglot](PhaseD-Polyglot.md), [Sign](PhaseE-SignLanguage.md),
> [Sign runbook](Sign-PhaseE-Runbook.md)). Nothing here reopens an earlier phase's decision. Where Phase F changes a
> shared mechanism, it says so.
>
> Design artifacts (consumer Impeccable world, `web/`):
> - Surface brief + direction contract: [`web/.impeccable/surfaces/budget.md`](../../web/.impeccable/surfaces/budget.md)
> - Interactive comp: [`web/.impeccable/mocks/budget-comp.html`](../../web/.impeccable/mocks/budget-comp.html)
>   (states from its review panel or `?state=`; it runs the §5 allocation algorithm on synthetic data)
> - App-icon master (spec): [`web/.impeccable/mocks/budget-icon.svg`](../../web/.impeccable/mocks/budget-icon.svg)
> - Review captures: `web/.impeccable/review/budget/*.png`

**Product-owner decisions (input to this phase, 2026-09-26):**
1. **Structure: "Plan and Month"** (Impeccable decision round, seed `a78dd77e`, surface scope, mode operate; the
   owner chose it from the three dealt cards: The Month Board / Plan and Month / The Pay Line). Month shows each
   paycheck with the bills it must cover and what's left. Plan holds the standing rules and is edited in place.
2. **Early bills:** when a bill is auto-assigned, **the previous payday pays it**: the most recent payday on or
   before the due date, even if that payday was last month. **A bill can still be assigned to a payday by hand.**
   This replaces legacy's rule (see §5.4, L-diff 3).
3. `budget.bakerrang.com`, `web/apps/budget`, `@bakerrang/web-budget`, `web-budget`, `bakerrang-web-budget`,
   OAuth target `budget`, `BUDGET_DOMAIN`. No naming conflict was found (§17).

---

## 1. Legacy inventory (repository truth)

### 1.1 Where it lives

| Layer | Truth |
|---|---|
| Route | `/budget` → `<Budget />` (`client/src/App.jsx:33`), inside the legacy `MainContent` shell. |
| Page | `client/src/components/Budget.jsx` (1,040 lines): the date/grouping logic, sidebar forms, month calendar, and summary panel. |
| Edit modal | `client/src/components/BudgetItemModal.jsx` (288 lines). |
| Launcher tile | `client/src/components/AppGrid.jsx:51` "Budget" → `/budget`. |
| Shared registry | `web/packages/web-app-shell/src/index.jsx:11`: `{ id: 'budget', name: 'Budget', shortName: 'Budget', accent: 'var(--accent-budget)', legacyPath: '/budget', liveUrl: null, envKey: 'VITE_BUDGET_URL' }`. The `budget` ProductEmblem (coin + `$`) already exists. |
| New Launcher copy | `web/apps/launcher/src/Launcher.jsx:12`: "Track spending against a plan without a spreadsheet." (**inaccurate**: see D16). |
| Server | `server/routes/budget.js` + `server/services/budgetService.js`, mounted `app.use('/budget', isAuthenticated, budgetRouter)` (`server/app.js:119`). |
| Storage | Firestore collection `budget`, one document per user: `budget/{userId}`. |
| History | `a5f81f1` (2026-03-16) "New Budget page"; `6c02f49` (2026-03-17) collapsible summaries + "+n more"; `d75e784`, `71e63b8`: restyles only. There are no tests. |
| Other callers | None. A grep across `client/`, `web/`, `extension/`, `addon/`, `platform/`, `server/` finds `/budget` only in the files above. |

### 1.2 What it actually is (the real product)

Budget is **not** a spending tracker, an expense log or a bank-style budget. There are no transactions, no
"spent", no categories-of-spending, no accounts, no balances that change. It is a **paycheck-to-bills planner**:

1. You enter **paydays** (income sources): a name, a take-home amount, and a schedule. The schedule is monthly
   (a fixed day, the first day or the last day), or biweekly/weekly counted from a "First Occurrence Date".
2. You enter **bills** of three kinds, stored as `category`:
   - `utility`: a monthly recurring bill (the placeholder is "Netflix"),
   - `debt`: a monthly recurring payment with an optional *remaining balance* and *end date*,
   - `one-time`: a bill due once, on a date.

   Each bill has an amount, a due-day rule, optional notes and a URL, an auto-pay flag, an active flag and an
   optional **"Associate with Payday"** pin.
3. For the month you're viewing, Budget:
   - draws a **calendar grid** with each payday and bill as a colored chip on its day,
   - builds a **month summary** that groups every bill under the payday that "covers" it and shows **"$x left"**
     per paycheck,
   - totals **Income / Expenses / Net** for the month.

**The question it answers:** *"Which paycheck pays which bills this month, and what's left from each?"* That's the
extracted product's whole job. The calendar grid was one way to show *when*. The summary is *the answer*.

### 1.3 Inventory (the 26 requested dimensions)

| # | Dimension | Legacy truth |
|---|---|---|
| 1 | Problem solved | Plan which paycheck covers which recurring/one-off bills, and what's left from each paycheck, month by month. |
| 2 | Primary workflow | Add paydays → add bills → flip months → read each paycheck's "left" in the summary panel. Click a calendar chip → modal edit/delete. |
| 3 | Create/edit/delete | Paydays and bills (the three categories): create (sidebar form), edit (modal from a calendar chip or the sidebar "Existing" list), delete (modal → ConfirmModal). |
| 4 | Kind of product | A **pay-period planner / bill calendar**. It is not a budget-vs-actual tracker or a calculator. |
| 5 | Modes | One page, three panels: an add sidebar (4 tabs), the calendar, and the month summary. No separate modes. |
| 6 | State stored | `items[]` (bills) and `paydays[]` arrays (shapes in §1.4). UI state (month, tab, collapsed groups) is not persisted. |
| 7 | Where stored | Firestore `budget/{userId}`: `{ userId, items: [...], paydays: [...] }`. |
| 8 | Per-user | Yes. The document id is the session's `req.user.id`. |
| 9 | Server-persisted | Yes, on every save and delete. |
| 10 | Browser storage | **None.** The theme is the legacy ThemeProvider's. |
| 11 | Backend routes | `GET /budget`, `POST /budget/item` (upsert by client id), `DELETE /budget/item/:id`, `POST /budget/payday` (upsert), `DELETE /budget/payday/:id`. |
| 12 | Collections | `budget` only. No subcollections and no indexes (single-doc reads). |
| 13 | Authorization | Structural: every call reads and writes `budget/{req.user.id}`. An item id can only address entries inside the caller's own doc. **No cross-user path exists.** The browser never sends a user id. |
| 14 | Authentication | `isAuthenticated` on the mount. The global `csrfProtection` covers POST/DELETE (the legacy `request()` attaches `x-csrf-token`). |
| 15 | Currency/numbers | USD only, with a hard-coded `$`. `parseFloat(amount) \|\| 0` from `<input type="number">`, stored as JS float dollars, summed in floats, displayed with `toFixed(2)` (the stat card uses `toFixed(0)`). No validation of range, sign or precision. |
| 16 | Date/time | `YYYY-MM-DD` strings parsed with `new Date(str)` (**UTC midnight**) and compared against **local** dates. The biweekly/weekly walk steps with `ms` arithmetic (`86400000`). "Today" is `new Date()`. The default `startDate` is `new Date().toISOString().slice(0,10)` (the **UTC** date). |
| 17 | Categories | Fixed: `utility` / `debt` / `one-time`, plus `payday`. Distinguished **by color only** (blue/red/purple/green chips). |
| 18 | Recurrence | Bills are monthly (a fixed day 1–31 clamped to the month length, the first day, or the last day). Debts can end (month-level). Paydays are monthly (a fixed day **not** clamped; first; last), or biweekly/weekly from an anchor date, projected **both forwards and backwards** from it. |
| 19 | Import/export | None. |
| 20 | Mobile | The 7-column grid shrinks to 52px cells with **one** chip visible plus "+n more". The panels stack. Hover tooltips don't exist on touch. The sidebar form sits above the calendar. Not realistically usable on a phone. |
| 21 | Keyboard | Chips and buttons are `<button>`s, but tooltips are mouse-only, the modal has no focus trap, no Esc and no dialog role, and focus isn't returned. Enter doesn't submit the forms (no `<form>`). |
| 22 | Validation/errors | Client-side: Save is disabled until the name and amount are non-empty. Nothing else. Server: **none** (it stores `req.body` verbatim). Network/HTTP errors are unhandled (D5, D6). |
| 23 | Charts | None. The calendar and a text summary only. |
| 24 | Dead/abandoned | `url` is stored but **never shown or linked** anywhere. `balance` is stored and only ever shown back in the form. The hero stats ("Budget Items", "Paydays", "Monthly Out") are decorative. `CategoryBadge` only renders inside tooltips. |
| 25 | Security/privacy weaknesses | §1.5 D7–D9, D17, D20; §23. |
| 26 | Legacy bugs | §1.5. |

### 1.4 Persisted shapes (exact, as the legacy client writes them)

```js
// budget/{userId}
{ userId: string, items: Item[], paydays: Payday[] }

// Item (a bill). Fields as written by ItemForm / BudgetItemModal handleSave:
{ id: string,                      // client uid(): Math.random base36 + Date.now base36
  name: string, amount: number,    // parseFloat dollars (may carry float noise or >2 dp)
  category: 'utility' | 'debt' | 'one-time',
  dayType: 'fixed' | 'first' | 'last' | 'specific',   // 'specific' for one-time
  day: number | 'first' | 'last' | 'YYYY-MM-DD',       // int for fixed; the dayType string for first/last; date for one-time
  notes: string, url: string, autoPay: boolean, active: boolean,
  balance: number | null,          // debt only
  endDate: 'YYYY-MM-DD' | null,    // debt only; compared month-level
  paydayId: string | null }

// Payday (undefined keys are dropped by JSON):
{ id, name, amount: number, frequency: 'monthly' | 'biweekly' | 'weekly',
  dayType?: 'fixed' | 'first' | 'last',  // monthly only
  day?: number,                          // monthly + fixed only
  startDate?: 'YYYY-MM-DD' }             // biweekly/weekly only
```

Arrays keep insertion order. Upserts replace the whole entry object with what the client sent.

### 1.5 Defects and debt: do NOT reproduce

| # | Finding | Where | Phase F action |
|---|---|---|---|
| D1 | **Date-only strings parsed as UTC.** `new Date('2026-09-04')` is UTC midnight, which is the *previous evening* in every US time zone (the owner commits at UTC−6). So in legacy: **every biweekly/weekly payday shows one day early**; **every one-off shows one day early**, and a one-off due on the **1st moves into the previous month**; a debt whose end date is the **1st stops a month early**. | `Budget.jsx:59, 96, 105` | Civil-date arithmetic only: integer day numbers, never `Date` parsing (§5.1). |
| D2 | Biweekly/weekly stepping uses `+14·86400000 ms`. That's correct only because every step lands at the same wrong UTC-shifted local hour. It's fragile across DST and meaningless once D1 is fixed. | `:68-82` | Day-number modular arithmetic (§5.2). |
| D3 | **Monthly paydays on day 29–31 vanish** in shorter months (`if (d <= last)`), while bills on those days clamp to the last day. A "31st" payday means **no income** in 7 months a year. | `:53-54` vs `:117` | Clamp paydays like bills (§5.2). **Changes month income for affected users** (L-diff 2). |
| D4 | Editing a recurring bill saved as first/last (`day: 'first'`) and switching it to "Fixed" puts `'first'` into a number input. That saves `parseInt('first') = NaN` → JSON `null`, and **the bill silently disappears from every month**. | `BudgetItemModal.jsx:30, 82` | Strict server validation. Normalization on read flags the entry as "needs a due day" instead of hiding it (§6.3). |
| D5 | **Save errors are rendered as data.** On a non-2xx, `res.json()` is `{error: …}`, which the client appends to `items` as a phantom row. A crash follows on `item.amount.toFixed` (undefined). | `Budget.jsx:608-617` | Typed API client, errors never merged into state (§8). |
| D6 | **Delete errors are ignored.** The row is removed locally even when the server failed, and reappears on reload. A **load failure shows an empty budget**, which looks like data loss. | `:591-605, 619-624` | Explicit failure states with Retry (§14). |
| D7 | **Lost updates.** Every write is read-array → modify → `update`, with no transaction. Two quick saves (two tabs, or phone + laptop, or legacy + new app during coexistence) overwrite each other's changes to **different** entries. The first-ever write uses `set()`, so two concurrent first writes lose one. | `budgetService.js` (all writes) | All writes (legacy **and** new routes) in `runTransaction` (§7.5). |
| D8 | **No server validation.** Any JSON is stored verbatim: extra fields, strings as amounts, `null` amounts (legacy's `toFixed` then **crashes the whole page**), negative amounts, 10 MB bodies (up to the Firestore doc limit → 500). | `routes/budget.js` | Validated new routes; the legacy routes keep their semantics but gain transactions (§7). |
| D9 | Float money: `parseFloat` + float sums + `toFixed(2)`. `toFixed` rounds the *binary* value (`1.005.toFixed(2) === '1.00'`). Amounts with >2 dp are accepted (a number input with the default step doesn't enforce it on this form). | throughout | Integer cents end to end (§4). |
| D10 | "Today" is highlighted by `today.getDate() === day`, so the same day number is marked in **every** month and year. | `:492` | A real civil-date comparison. Today is shown only in its own period (§11). |
| D11 | Collapse state is keyed by `payday.id`. A biweekly payday with two occurrences in a month has two groups with the same key, so collapsing one collapses both. (The naming is also inverted: `isExpanded = collapsed.has`.) | `:914` | Periods are keyed by `paydayId@dayNumber` (§5.3). No collapse in the new UI. |
| D12 | Category is conveyed **by color alone** (chips, legend, dots). Tooltips are mouse-only. On phones, one chip shows per day. | calendar | Text tags, and a date column in a table (§12, §13). |
| D13 | The modal has no dialog semantics, focus trap, Esc or focus return. Its scroll lock uses `position: fixed`, which **jumps the page to the top**. | `BudgetItemModal.jsx:42-51` | There's no modal: rows open in place (§11). |
| D14 | Negative amounts are accepted and undefined in meaning (a negative bill becomes income). | forms | Rejected on write. Legacy negatives are read tolerantly and flagged (§4.4). |
| D15 | The default biweekly `startDate` is the **UTC** date (`toISOString`): an evening user in the US gets tomorrow. | `:261` | The default is the local civil date (§5.1). |
| D16 | **Overclaim:** the new Launcher says "Track spending against a plan without a spreadsheet." Budget tracks no spending. The legacy hero says "Track your monthly budget, bills, and income". | Launcher, `Budget.jsx:686` | Honest copy (§16). |
| D17 | `url` is stored unvalidated. Legacy never renders it, but **any client that links it** would render `javascript:`/`data:` URLs from stored data. | forms | Validate `http(s)` on write. The client links **only** `http(s)` on read (§9). |
| D18 | The hero stats count inactive items, and "Monthly Out" rounds to whole dollars. | `:691-699` | Retired (§2). |
| D19 | Duplicate-create risk: a client-generated id plus an unconditional upsert is fine, but no request id exists, so a retried create from a new client could double a bill. | new-client concern | Idempotent create with `requestId` (§7.3, §8.4). |
| D20 | Budget responses carry no `Cache-Control`. That makes private financial data eligible for heuristic caching. There's no rate limit on `/budget`. | `server/app.js:119` | `no-store` on every `/budget` response; `budgetLimiter` (§7.6). |
| D21 | Raw error objects go to `console.error(error)`. Firestore errors don't include the payload today, but that isn't guaranteed. | `routes/budget.js` | Fixed-shape logging `{code, name}` (§9). |

---

## 2. Simplification: keep / improve / retire / defer

| Legacy thing | Verdict | Why |
|---|---|---|
| Paydays: monthly (day/first/last), biweekly, weekly | **KEEP** | This is the product's input. Every schedule legacy supports stays. |
| Bills: monthly recurring (`utility`), debts, one-offs | **KEEP** | Same. The UI labels are **Bill**, **Debt** and **One-off**. The stored values are unchanged. |
| Paycheck grouping with "left" per paycheck | **KEEP, as the product** | It's the answer. It becomes the Month sheet. |
| Month totals Income / Expenses / Net | **KEEP** as the pinned statement: **Paychecks / Bills / Net**. | Real, month-based and unchanged in meaning. |
| "Associate with Payday" pin | **KEEP** as **"Paid from"** | Owner decision 2. |
| Auto-pay flag | **KEEP** (the "Auto-pay" tag) | It's informational and real. |
| Active flag | **KEEP** as **Paused** | Same semantics (it leaves every month). |
| Notes | **KEEP** | |
| `url` | **IMPROVE** → **"Payment link"**, shown as "Open payment site" (http/https only) | It's stored but never usable today. It's clearly meant to reach the payee's site. |
| Debt end date | **IMPROVE** → **"Last payment"** month + year (stored as the last day of that month; §6.2) | Legacy compares it month-level anyway. A month picker says exactly that and dodges D1 in legacy. |
| Debt `balance` | **KEEP, relabelled** "Balance you noted (optional) — for your reference; Budget doesn't change it." | The data exists and users typed it in. It never decrements, so it must not look live. |
| Month calendar grid | **RETIRE** | It's unreadable on phones (D12). The ledger's due-date column carries "when", and the pay-period split carries the real meaning. |
| Hero + stat cards | **RETIRE** | Decorative (D18), and stat grids are banned by the world. |
| Category colors / legend / tooltips | **RETIRE** | Replaced by text tags (D12). |
| Add sidebar with 4 tabs | **RETIRE** → Plan sheet + gold **Add** menu | |
| Edit modal | **RETIRE** → rows open **in place** | D13. |
| Collapsible summary groups | **RETIRE** | Every period is short, and collapse hid the answer. |
| Changing a bill's kind after creation | **Not added** (legacy can't either) | Delete and re-add. |
| Starting month for recurring bills | **DEFER** | Legacy recurring bills show in every past month. That's kept (Budget is a plan, not a record). A "starts in" field is new scope. |
| Carry-over / rolling balance / savings / charts / CSV export / reminders / bank links / multi-currency / shared budgets | **DEFER / not added** | New financial features legacy never had. |

---

## 3. Exact retained feature set

**One sentence:** Budget lines your bills up against your paydays. Month shows every paycheck with the bills it has
to pay before the next one arrives, what that covers, and what's left. Plan is where you keep the rules.

1. **Month** (`/`, `/month/YYYY-MM`): the pay periods overlapping the month (§5.3). Each shows a paycheck band
   (date · source · amount), a "Pay period {start} – {end}" line (§5.3a), the bills as table rows (due date · name + tags ·
   amount), **Covered**, and **Left** or **Short**. A **Today** rule sits in the current period. The **statement**
   (Paychecks received / Bills due / Net) is pinned at the foot. ‹ › and "This month" move between months.
2. **Plan** (`/plan`): four ruled tables, **Paydays**, **Bills**, **Debts** and **One-offs** (name + tags, schedule text,
   amount). Bills and Debts show an "Each month" sum. Every row opens **in place** into its editor. Each table has a
   quiet "Add a …" row.
3. **Add** (the one gold action): a menu of Payday / Bill / Debt / One-off. It opens a new-entry editor at the top of
   that Plan table.
4. **Editors** (§11.4): payday (name, take-home pay, repeats monthly/every 2 weeks/every week, paid on day/first/last,
   or "A payday date"); bill/debt (name, amount, due day/first/last, paid from, auto-pay, paused, payment link, notes;
   debts add last payment and balance noted); one-off (name, amount, due date, paid from, auto-pay, link, notes).
   Explicit **Save**, **Cancel**, and an inline-confirmed **Delete**.
5. **Needs attention**: legacy entries the new rules can't place (no due day, no valid amount, no valid
   schedule) are listed with a tag in Plan and a notice on Month. They are **never silently hidden or dropped**.
6. **Welcome** (signed out) with a labelled example. **Not found.**

## 4. Money semantics (locked)

### 4.1 Representation
- **All arithmetic is in integer cents** (JavaScript safe integers). No floating-point value is ever added or
  subtracted, on client or server.
- **API** amounts are integers named `…Cents` (`amountCents`, `balanceCents`).
- **Storage stays legacy-shaped** (coexistence, §6): `amount` / `balance` are JS numbers in dollars, written as
  `cents / 100`. That is the nearest double to the 2-dp decimal, and it round-trips exactly through `toCents`
  (§4.2), which is proven by a property test over 0..999,999,999 at sampled and boundary points.
- **Currency:** USD only (legacy parity). Display is `$1,234.56`: thousands grouped, always two decimals, minus
  sign U+2212 for negatives (legacy data only). The formatter works on integer cents
  (`Math.floor(abs/100)` grouped with `toLocaleString('en-US')` + `.` + `abs % 100` padded). **Never** `toFixed` on a float.

### 4.2 Legacy float → cents (the only rounding in the system)
`toCents(n)`: if `typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1e11`, then the amount is **invalid**
(→ issue `amount`, §6.3). Otherwise
`Math.sign(n) * Math.round(Number((Math.abs(n) * 100).toPrecision(15)))`.
That is **half away from zero** on the decimal the user typed: `1.005 → 101`, `0.285 → 29`, `12.345 → 1235`,
`-2.5 → -250`, and float noise like `0.30000000000000004 → 30`. It runs **once, at read** (server normalization).
Every later computation is exact.

### 4.3 Input (client) and validation (server)
- **Input field:** `type="text"`, `inputmode="decimal"`, `autocomplete="off"`, a `$` adornment, right-aligned,
  tabular figures. It accepts an optional leading `$`, digits with **optional correct** thousands commas, and an
  optional `.` with **0–2** decimals. Surrounding spaces are trimmed. Regex after stripping `$` and whitespace:
  `^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d{0,2})?$` and at least one digit. Parsed **as a string** into cents (never
  `parseFloat`). On blur, a valid value is reformatted to `1,234.50`, and an invalid value is left exactly as typed
  and flagged on submit.
- Rejected: negatives, exponents, 3+ decimals, misplaced commas, and anything above the maximum. Messages are locked
  in §14.
- **Range:** `amountCents` and `balanceCents` are integers **0 … 999,999,999** ($9,999,999.99). `0` is allowed
  (legacy allowed "0").
- **Server** validates `Number.isSafeInteger(v) && v >= 0 && v <= 999999999`. The server never receives a
  formatted string.

### 4.4 Totals, signs and wording
- **Per pay period:** `covered = Σ amountCents of its assigned bill occurrences`; `left = paycheck − covered`.
  `left ≥ 0` → row label **"Left"** with the figure. `left < 0` → label **"Short"** with a drawn down-arrow and the
  figure shown **as a positive amount** (`Short $30.00`). The word carries the meaning, not color.
- **Month statement:** `paychecks = Σ occurrences received in the month`; `bills = Σ bill occurrences due in the month`;
  `net = paychecks − bills`. The label is just **"Net"** with the sign in the figure: `+$2,215.36` / `−$120.00`. The word
  "left" is reserved for per-period figures, so the month figure is never compared with them (finish review fix 4). Same
  meaning as legacy Income/Expenses/Net.
- **Plan sums:** "Each month" in Bills and Debts = Σ of **active**, valid entries (Debts: only those whose last
  payment month is ≥ the current month). Paydays and One-offs show no sum (their frequencies differ, so a sum would
  mislead).
- **Legacy negatives** (D14) are read as signed cents, **included** in totals exactly as legacy did, and flagged
  `issues: ['negative']`. They show a "Negative amount" tag. The next save must be ≥ 0.
- **No percentages** exist in legacy, and none are added.
- **Large values:** the money column is `11.5ch` (phone `10.2ch`) at tabular figures and grows when a figure is wider.
  It never truncates money. Names wrap (`overflow-wrap:anywhere`). Figures never ellipsize.

## 5. Dates, schedules and allocation (locked; client module `web/apps/budget/src/plan/`)

### 5.1 Civil dates
- A date is a **civil date** `YYYY-MM-DD` in the user's own calendar, with **no time and no zone**. Internally it is an
  integer **day number** (days since 1970-01-01, Howard Hinnant's `days_from_civil` / `civil_from_days`). `Date` is
  used **only** to read *today*, via local `getFullYear()/getMonth()/getDate()`, once per page load and on
  `visibilitychange → visible`. Date-only strings are **never** passed to `new Date()`.
- Valid dates: years 2000–2100, with a real month and day (leap years per the Gregorian rule).
- Weekday: `((z % 7) + 11) % 7` (0 = Sunday; 1970-01-01 was a Thursday).
- Display (en-US): `Fri, Sep 4` in bands, `Sep 4` with a small weekday in the due column, `Wed, Sep 16, 2026` for
  one-offs in Plan.

### 5.2 Occurrence rules
- **Monthly day `d`:** `min(d, daysInMonth)`, for **bills and paydays alike** (D3 fixed). First → 1. Last → the
  month's last day.
- **Weekly / every 2 weeks:** interval `k = 7 | 14` from the anchor day `a`. Occurrences are every `a + n·k` for any
  integer `n`, both **before and after** the anchor. This is legacy's semantics, kept on purpose because users
  typed "a payday", not a start. It's relabelled **"A payday date — any past or upcoming payday"**. The first
  occurrence ≥ `lo` is `a + ceil((lo − a)/k)·k`.
- **Debt last payment:** the debt recurs through the month of its last-payment month inclusive (month-level, the
  legacy rule). No last payment means it recurs forever.
- **One-off:** exactly its date.
- **Paused** (`active === false`) bills have no occurrences. **Entries with issues** have no occurrences.

### 5.3 Pay periods and the Month view (owner decision 2)
For month `M` (first day `F`, last day `L`), with window `lo = F − 45`, `hi = L + 45` (enough for every rule below;
test-locked):
1. **Payday occurrences** in `[lo, hi]` for all paydays, sorted by `(day, index of the payday in the stored array)`.
   Each occurrence `o` has `o.next` = the day of the following occurrence **of any payday** (or none). The **pay
   period** of `o` is `[o.day, o.next − 1]`.
2. **Bill occurrences** in `[lo, hi]`, sorted by `(day, index in the stored array)`. Each is assigned:
   - **Paid from (pinned)**, when `paydayId` names an existing payday: the **latest occurrence of that payday with
     day ≤ the bill's due day**.
   - **Automatic** (and the pinned fallback): the **latest occurrence of any payday with day ≤ due day**. With
     equal days, it goes to the **last** in sort order.
   - **None:** only possible when no valid payday exists. Those bills (due in `M`) form the **"Not covered yet"**
     group.
3. **Shown periods** = the periods whose payday falls in `M`, **plus** any earlier period that covers a bill due in
   `M` (the "carried in" period, labelled "started in {Month}"). They're ordered by day. Each lists **all** of
   its assigned bills, including those dated outside `M` (shown with their date in Ink-3 plus the month name). So a
   paycheck's Left is always computed over its **whole** period.
4. **Statement** (month-based): paychecks = the occurrences with day in `[F, L]`; bills = the bill occurrences with day
   in `[F, L]`; net = paychecks − bills.
5. **Today rule:** shown inside the period whose range contains today, before its first bill with day > today.

### 5.3a Pay-period line: display semantics (locked)
The allocation above is unchanged. Automatic bills go to the latest payday of any source on or before the due date.
"Paid from" bills go to the latest occurrence of the **chosen** payday on or before the due date. Manual assignment wins.
The line under each paycheck band describes **only the automatic window**, and says so when hand-assigned bills fall outside it:

- **Window:** `[o.day, o.next − 1]` = from this payday to the day before the next payday of **any** source. With no next
  occurrence in the computation window: `Pay period from {start}`.
- **Copy:** `Pay period {Mon D} – {Mon D}`, then `· started in {Month}` for the carried-in period, then, when
  `later = count(assigned bills with due ≥ o.next) > 0`:
  `· 1 bill due later is paid from here` / `· {N} bills due later are paid from here`.
  Example (the §5.3 fixture): **`Pay period Sep 15 – Sep 17 · 1 bill due later is paid from here`**.
- **Why "due later" is always true:** a "Paid from" bill takes the latest occurrence of its payday **≤ its due date**, so a
  hand-assigned bill can never be due *before* its period starts, only on or after `o.next`. "Pay period" never
  claims that every row falls inside it. The word "Covers" is retired.
- **Rows:** a bill due after the window keeps its **real due date** in the due column and its `PAID FROM {PAYDAY}` tag (the
  reason it's here). Its name button is followed by the screen-reader-only text `, due after this pay period`. Rows stay
  sorted by due date, so these rows sit after the window's rows. No extra visual marker, color or divider is added.
- **Totals:** Covered and Left/Short include every assigned row, in-window or not (unchanged).
- **Screen readers:** the table caption = `Bills paid from the {Tue, Sep 15} {Tutoring} paycheck. {pay-period line with each " · " replaced by ". "}.`
  (e.g. "… Pay period Sep 15 – Sep 17. 1 bill due later is paid from here."; no middle dot read aloud). The visible line uses
  `text-wrap: pretty` so no lone word wraps on phones. The row
  reads "Credit card, due after this pay period, Debt, Paid from Tutoring, $150.00".
- Hand-assigned bills **inside** the window keep the `PAID FROM` tag and get no suffix, and they don't count toward `later`.
- **Required fixture test (`allocate.test.js` + `PeriodTable.test.jsx`):** with the §5.3 data, the Sep 15 Tutoring period
  has window Sep 15–Sep 17 and bills [Dentist Sep 16, Credit card Sep 20]; Credit card is `pinned:true, afterWindow:true`;
  covered 41000, left −3000. The rendered line is exactly `Pay period Sep 15 – Sep 17 · 1 bill due later is paid from here`,
  the Credit card row contains the sr text `, due after this pay period` and the tag `Paid from Tutoring`, the foot reads Covered
  `$410.00` and `Short $30.00`, and the Sep 18 Acme period line is exactly `Pay period Sep 18 – Oct 1` (no suffix: Credit card
  isn't counted there). Also: **no rendered period line contains "Covers"**, and a two-bill variant (add a bill due Sep 25
  paid from Tutoring) renders `· 2 bills due later are paid from here`.

**Worked example (the comp's synthetic data, September 2026).** Acme payroll $2,140.00 every 2 weeks (anchor Fri
Sep 4); Tutoring $380.00 monthly on the 15th; the bills are in the comp. Periods: **Aug 21** (carried in: Aug 22 Phone,
Aug 27 Streaming, Aug 31 Water, Sep 1 Rent = $1,555.06 → Left $584.94) · **Sep 4** ($479.58 → Left $1,660.42) · **Sep
15 Tutoring** (Sep 16 Dentist $260.00 + Sep 20 Credit card $150.00 *paid from Tutoring* = $410.00 → **Short $30.00**) ·
**Sep 18** (… + Oct 1 Rent + Oct 1 Car registration = $1,641.56 → Left $498.44). Statement: Paychecks $4,660.00 · Bills
$2,444.64 · Net +$2,215.36. **This exact fixture is a required unit test.**

### 5.4 Deliberate differences from legacy (a live-acceptance checklist)
| # | Difference | Effect |
|---|---|---|
| L-diff 1 | D1 fixed: biweekly/weekly paydays, one-offs and debt end dates land on their real dates. | Items that legacy showed a day early now show on the right day. A 1st-of-month one-off or debt end moves back into its correct month (month totals change **only** there). |
| L-diff 2 | D3 fixed: monthly paydays on 29–31 clamp. | Month income **rises** in months where legacy dropped the paycheck. |
| L-diff 3 | Owner's early-bill rule: the previous payday covers a bill, across months. Pinned = the latest occurrence of that payday ≤ due. (Legacy: the month's first payday; pinned = the first occurrence in the month.) | **Per-paycheck Left changes** for early-month bills and pinned bills. Month totals are unaffected. |
| L-diff 4 | Periods include bills due in the next month (up to the next payday). | A paycheck late in the month shows next month's early bills. |

## 6. Data model, compatibility and migration decision

### 6.1 Verdict: **no migration, no new collection, no index, both clients coexist**
The extracted app reads and writes the **same** `budget/{userId}` document in the **same** legacy shape. The server
translates both ways. Legacy keeps working unchanged against its unchanged routes. A schema migration isn't
needed: every legacy value is either representable or explicitly flagged (§6.3). A migration would also break
the legacy client during coexistence and on rollback.

### 6.2 API ↔ storage mapping (new routes only)
| API field (Bill) | Stored field(s) |
|---|---|
| `id` | `id` (new entries: `randomUUID()` from the server) |
| `category` `'utility'\|'debt'\|'one-time'` | `category` (same values; UI labels Bill/Debt/One-off) |
| `name` | `name` |
| `amountCents` | `amount = amountCents / 100` |
| `due {rule:'day',day}` | `dayType:'fixed', day:<int>` |
| `due {rule:'first'\|'last'}` | `dayType:'first'\|'last', day:null` (**null**, not the legacy string, which avoids D4 in the legacy editor) |
| `due {rule:'date',date}` (one-time only) | `dayType:'specific', day:'YYYY-MM-DD'` |
| `lastPaymentMonth 'YYYY-MM'\|null` (debt only) | `endDate: 'YYYY-MM-<last day>' \| null`. The **last day of the month** is stored so that legacy's UTC parse (D1) still lands in the right month. |
| `balanceCents` (debt only) | `balance = cents/100 \| null` |
| `paydayId` | `paydayId` |
| `autoPay`, `active`, `notes` | same |
| `url` (`''` when none) | `url` |
| `rev` | `rev` (new; integer, see §7.5) |
| — | `requestId` (new, create only; §8.4) |

| API field (Payday) | Stored |
|---|---|
| `schedule {frequency:'monthly', rule:'day', day}` | `frequency:'monthly', dayType:'fixed', day, startDate:null` |
| `schedule {frequency:'monthly', rule:'first'\|'last'}` | `frequency:'monthly', dayType, day:null, startDate:null` |
| `schedule {frequency:'weekly'\|'biweekly', anchorDate}` | `frequency, dayType:null, day:null, startDate: anchorDate` |
| `amountCents`, `name`, `rev` | `amount`, `name`, `rev` |

A **PUT** merges the mapped known fields onto the stored entry. **Unknown stored fields are preserved**, and known
fields that no longer apply are written as `null`. Legacy's reader tolerates every value above (checked
line by line against `Budget.jsx` and `BudgetItemModal.jsx`; a server test pins the written shapes).

### 6.3 Read normalization (stored → API), tolerant and total
The server's `normalizeBill` / `normalizePayday` **never throw and never drop an entry**. Each returns the canonical
shape plus `issues: string[]` (omitted when empty):

| Stored condition | API result |
|---|---|
| `amount` non-numeric / non-finite / absurd | `amountCents: null`, issue `amount` (no occurrences, excluded from totals) |
| `amount < 0` | signed cents, issue `negative` (included, like legacy) |
| `category` not one of the three | `category:'utility'` (legacy treats non-one-time as monthly), issue `category` |
| recurring `dayType` `first`/`last` | `due {rule}` whatever `day` holds |
| recurring otherwise: `parseInt(day)` 1–31 | `due {rule:'day', day}`; **`> 31` → `day:31`** (legacy clamped anything > the month length to the last day, identical) |
| recurring day missing / NaN / < 1 | `due:null`, issue `due` (legacy hid these, D4) |
| one-time `day` a valid civil date | `due {rule:'date', date}`; else `due:null`, issue `due` |
| `endDate` valid | `lastPaymentMonth: 'YYYY-MM'`; invalid → `null` (no issue: legacy ignored it) |
| `balance` finite | `balanceCents`; else `null` |
| `active` | `Boolean(active)` (legacy semantics: a missing `active` means **not** scheduled) |
| `paydayId` string naming an existing payday | kept; dangling → `null` (legacy fell back to automatic) |
| `notes`/`url`/`name` non-string | `''` (name `''` shows "(unnamed)", issue `name`) |
| payday `frequency` monthly + `dayType` first/last/fixed-with-valid-day | `schedule`; day > 31 → 31; invalid → `schedule:null`, issue `schedule` |
| payday weekly/biweekly with valid `startDate` | `schedule {anchorDate}`; else `schedule:null`, issue `schedule` |
| missing `rev` | `rev: 0` |

### 6.4 Ownership, coexistence and rollback answers
- **Reuse directly?** Yes. **Migration?** No. **Compatibility layer?** Yes, the §6.2/§6.3 server mapping (not a data rewrite).
- **Both clients at once:** safe. Both routes families write in transactions (§7.5), so neither loses the other's
  changes to *different* entries. For the *same* entry, the new client's `expectedRev` detects a legacy edit (legacy
  saves bump `rev` server-side, §7.4) and returns 409. A legacy save over a newer new-client edit is last-write-wins
  (that's legacy's behavior, documented, and legacy retires later).
- **Ownership checks:** correct today and kept. The document id comes from `req.user.id` only; ids resolve only inside
  the caller's own doc; unknown ids → 404. Updates and deletes are owner-safe by construction. **No cross-user
  risk. The browser never supplies a user id** (legacy doesn't either).
- **Rollback:** everything the new routes write is legacy-shaped. Rolling back the web app, the registry flip or the
  server PR leaves every document fully readable and editable by legacy. Extra fields (`rev`, `requestId`) are
  ignored by legacy and harmless.

## 7. Backend / API

### 7.1 Change list
| # | Change | Where |
|---|---|---|
| **B1** | New validated routes `GET /budget/plan`, `POST /budget/paydays`, `PUT/DELETE /budget/paydays/:id`, `POST /budget/bills`, `PUT/DELETE /budget/bills/:id` | `server/routes/budget.js`, `server/services/budgetService.js`, new `server/domain/budgetPlan.js` (validation, mapping, normalization, pure) |
| **B2** | Legacy routes: transactional read-modify-write, `rev` bump, fixed-shape error logging. Request/response semantics unchanged. | `budgetService.js` |
| **B3** | `noStore` on every `/budget` response (router-level, first middleware) | `routes/budget.js` (reuse `middleware/contentSecurity.js` `noStore`) |
| **B4** | `budgetLimiter` = `limiter(300)` per IP per 15 min, mounted like the vault: `app.use('/budget', budgetLimiter, isAuthenticated, budgetRouter)` | `middleware/security.js`, `server/app.js` |
| **B5** | OAuth target `budget: 'BUDGET_DOMAIN'`; CORS `env.BUDGET_DOMAIN` | `config/oauthTargets.js`, `config/origins.js` |
| **B6** | `.env.example` gets `BUDGET_DOMAIN=`; API runtime `BUDGET_DOMAIN=https://budget.bakerrang.com` (operator); local `http://localhost:3040` | `server/.env.example`, runbook |
| **B7** | `_setDb` test seam in `budgetService.js` (the storybook/lead pattern) | `budgetService.js` |

**Auth / CSRF for every B1 route:** the existing mount → `401 {"isAuthenticated":false,"message":"User not
authenticated"}` when signed out. POST/PUT/DELETE go through the global double-submit `csrfProtection` (a missing
or invalid token gets the unchanged `403` from `csrf-csrf`). `@bakerrang/web-api-client` attaches the token and
retries once. **Headers:** `Cache-Control: no-store` on every response, including errors. **Body:** JSON.
**Unknown body fields are ignored.** **Error body:** `{"error": string, "field"?: string, "code"?: string, ...}`.

### 7.2 `GET /budget/plan`
- **200** `{ "paydays": Payday[], "bills": Bill[] }`, normalized (§6.3), in stored order. A missing doc →
  `{paydays:[],bills:[]}` (the doc is **not** created).
- `Payday = { id, name, amountCents|null, schedule|null, rev, issues? }`
- `Bill = { id, category, name, amountCents|null, due|null, paydayId|null, autoPay, active, notes, url,
  lastPaymentMonth|null (debt), balanceCents|null (debt), rev, issues? }`
- 500 → `{"error":"Failed to load budget"}`.

### 7.3 Create — `POST /budget/paydays`, `POST /budget/bills`
- **Body (payday):** `{ requestId?: uuid, name, amountCents, schedule }`
- **Body (bill):** `{ requestId?: uuid, category, name, amountCents, due, paydayId?, autoPay?, active?, notes?, url?,
  lastPaymentMonth?, balanceCents? }` (the optional booleans default to `false`/`true`/`''`/`null` respectively)
- **Validation, first failing field in this order** → `400 {"error":"Invalid payday"|"Invalid bill","field":…}`:
  `body` (plain object) → `requestId` (absent, or an RFC 4122 v4 string) → `category` (bill: one of the three) →
  `name` (string, trimmed, 1–80 code points, no C0/DEL control characters) → `amountCents` (§4.3) → `schedule` / `due`
  (shape per §6.2; `day` an integer 1–31; dates valid civil dates 2000–2100; `rule:'date'` **iff** `category ===
  'one-time'`) → `lastPaymentMonth` (debt only; `YYYY-MM`, 2000-01..2100-12; must be absent/null otherwise) →
  `balanceCents` (debt only; §4.3 range or null) → `paydayId` (null, or an existing payday id in this doc, checked
  in the transaction) → `autoPay` / `active` (booleans) → `url` (trimmed; `''` or an absolute `http:`/`https:` URL via
  `new URL`, no username/password, ≤ 1000 chars) → `notes` (string, trimmed, ≤ 300 code points, no control chars
  except none).
- **Limits:** paydays ≤ **20**, bills ≤ **250** per user (keeps the doc well under Firestore's 1 MiB) →
  `409 {"error":"Payday limit reached"|"Bill limit reached","code":"limit","limit":20|250}`.
- **Idempotency:** when `requestId` matches an entry already in the doc (same list) → **200** with that entry
  (no second write). Otherwise the server assigns `id = randomUUID()`, `rev = 1`, stores `requestId`, and returns
  **201** `{ "payday": Payday }` / `{ "bill": Bill }`.

### 7.4 Replace — `PUT /budget/paydays/:id`, `PUT /budget/bills/:id`
- **Body:** the full create body minus `requestId`, plus `expectedRev` (integer ≥ 0, required → field `expectedRev`).
  Bill `category` must equal the stored category → otherwise `400 field "category"` (kind is immutable).
- Missing id in this user's doc → **404** `{"error":"Payday not found"|"Bill not found"}`.
- `stored.rev ?? 0 !== expectedRev` → **409** `{"error":"Bill changed","code":"conflict","current": Bill}` (the
  normalized current entry, so the client needn't refetch).
- Success → merge (§6.2), `rev = prev + 1` → **200** `{ "bill": Bill }` / `{ "payday": Payday }`.
- **Legacy routes (B2): server-owned metadata is preserved (locked).** `SERVER_OWNED_FIELDS = ['requestId']` (a
  constant in `server/domain/budgetPlan.js`; **any future server-managed field must be added to it**), plus `rev`, which
  is always recomputed. In the legacy `POST /budget/item` / `POST /budget/payday` transaction:
  - **Existing id:** `stored = { ...legacyBody-without-server-owned-keys, ...pick(existing, SERVER_OWNED_FIELDS), rev: (existing.rev ?? 0) + 1 }`.
    The legacy body still replaces every *legacy* field wholesale (unchanged legacy semantics). It can never set or erase
    `requestId` or `rev`: any such keys in the body are dropped, and the existing values are carried over.
  - **New id (legacy create):** `stored = { ...legacyBody-without-server-owned-keys, rev: 1 }` (no `requestId`).
  - **Response and user-visible behavior unchanged:** it still returns exactly the body the legacy client sent.
  - `DELETE` legacy routes are unchanged (they remove the entry; there's nothing to preserve).
  - Consequence: a `POST` retry with the same `requestId` still finds the entry after any number of legacy edits, and
    returns it (the §7.3 idempotency lookup scans the stored `requestId` of every entry in that list, whatever its
    current `rev`) → **200 with the current stored entry, no duplicate**. (A retry after the entry was *deleted* creates it
    again. That's accepted: retries happen within seconds.)

### 7.5 Delete, and the concurrency model
- `DELETE /budget/bills/:id` → **200** `{"deleted":true}`; missing → **404** `{"error":"Bill not found"}`.
- `DELETE /budget/paydays/:id` → **200** `{"deleted":true,"unpinned":[{"id":billId,"rev":n}]}`. In the **same
  transaction**, every bill with `paydayId === id` gets `paydayId:null` and `rev+1`. Missing → 404.
- No `expectedRev` on delete: deleting is final and confirmed in the UI. A delete of a concurrently edited entry
  wins (documented).
- **Every write, new and legacy, is one `firestore.runTransaction`:** `tx.get(budget/{uid})` → compute →
  `tx.set(ref, { userId, items, paydays }, { merge: true })`. Reads precede writes (the FakeDb enforces it). Firestore
  retries on contention, so **no cross-entry lost update is possible** (D7). Per-entry `rev` handles same-entry
  conflicts.

### 7.6 Rate limit, logging, errors
- `budgetLimiter`: 300 requests / 15 min / IP (`standardHeaders`, JSON message
  `{"error":"Too many requests. Please wait a moment."}`). It covers legacy and new routes (legacy's own traffic is a
  handful of calls per session).
- Logging: `console.error('[budget] <op> failed', { code: err.code, name: err.name })`. **Never** log bodies,
  names, amounts, notes, URLs or error objects. The access log already strips query values (`sanitizeLogUrl`).
  Budget URLs carry only opaque ids.
- Unexpected failure → `500 {"error":"Failed to save budget"|"Failed to delete budget item"|"Failed to load budget"}`.

### 7.7 Client data layer (`web/apps/budget/src/api/budget.js`)
Thin wrappers over the shared `apiClient`, each taking `{ signal }`: `loadPlan()`, `createPayday(body)`,
`updatePayday(id, body)`, `deletePayday(id)`, the same three for bills. They throw a typed `BudgetApiError
{status, code, field, current, limit}` built from the JSON body. **Nothing from an error response is ever merged
into plan state** (D5).

## 8. Save / edit / delete behavior + async and races (locked)

### 8.1 Saving model: **explicit Save, no autosave**
Every edit is a small multi-field rule (amount + schedule + pin). Autosaving half-typed amounts would write wrong
money and re-foot the ledger on every keystroke. Legacy is explicit-save, too. **One editor is open at a time.**
Totals change **only** from server-confirmed state (no optimistic figures).

### 8.2 Lifecycle
- **Open:** tapping a row (or its name button, or Enter on it) opens its editor directly below it, seeded from state.
  A second row can't open while the first is **dirty** without the inline discard prompt (§8.3). While **saving**,
  other rows are inert (`aria-disabled`).
- **Save:** client validation (§14 copy) → the first invalid field is focused, and an `ed__msg` summary says "Check the N fields
  marked above." Otherwise the status is `saving` (inputs `readOnly`, Save/Delete `aria-disabled`, `aria-busy`),
  and the request carries `expectedRev` (PUT) or a fresh `requestId` (POST, reused on retry of the same draft).
- **Success:** state takes the server's entry, the editor closes, focus returns to that entry's row button (in its
  new period if it moved), the **re-foot** plays (§11.5), and the live region says "Saved Rent. September net is now
  +$2,215.36." (or "Added …").
- **Failure** (network, 5xx, timeout 15 s): the editor stays open with the user's values. "Couldn't save. Your
  changes are still here." Save again = retry (same `requestId` for creates).
- **409 conflict:** the editor shows "{Name} was changed somewhere else. Now {amount}, {schedule}." with **Use latest**
  (re-seeds from `current`, discarding the draft) and Cancel. **If `current` equals the draft's canonical fields**
  (our own earlier save committed before a timeout), treat it as success.
- **404 on PUT:** "{Name} was deleted somewhere else." → **Remove from view** (drops it locally).
- **400:** show the server's `field` on that input ("This value wasn't accepted.") and focus it. (It shouldn't
  happen: client and server rules match, and a drift test enforces that.)
- **Delete:** Delete → the footer becomes an inline confirm ("Delete Rent? It leaves every month. This can't be
  undone." / for a payday "…N bills paid from it go back to automatic.") → **Delete** / **Keep it**. On success the entry is removed,
  `unpinned` is applied, focus goes to the sheet title, and "Deleted Rent." is announced. A 404 is treated as
  already deleted. On failure the row stays with the error.

### 8.3 Unsaved changes
The draft is dirty when it differs from its seed. With a dirty editor, **Cancel, Esc, opening another row, switching
sheets, month nav and in-app links** turn the editor footer into "Discard changes to {Name}? **Keep editing** /
**Discard**" (no `window.confirm`), and the pending action runs only on Discard. A `beforeunload` guard is active
only while dirty. Sign-out (menu) with a dirty editor asks the same.

### 8.4 Async/race rules
- **Load:** one `GET /budget/plan` with an `AbortController`, aborted on unmount/sign-out. A response for an aborted
  or replaced load is ignored (load token).
- **Refresh:** on `visibilitychange → visible`, if ≥ 60 s since the last successful load, **no editor is open** and no
  write is in flight → refetch and replace state wholesale. The same handler recomputes *today*.
- **One write in flight at a time** (a single editor). Every response is applied only if its op token is still current
  and (for PUT/DELETE) the entry still exists locally. Otherwise it's ignored.
- **Month navigation is pure computation** over loaded state (no fetch per month), so there are no stale month
  responses.
- **Sign-out / auth loss** (the `web-auth` 60 s poll): abort everything, drop plan state from memory, show Welcome.
- **Double activation:** Save/Delete are `aria-disabled` while saving. Add isn't rendered until the plan loads.

## 9. Privacy / security contract
- Amounts, names, notes and URLs travel **only in JSON bodies** (never query strings). Budget URLs are
  `/budget/...` with opaque ids. `sanitizeLogUrl` already masks query values. No new Cloud Logging exclusion is needed.
- `Cache-Control: no-store` on all `/budget` responses (B3). The service worker has **no runtime caching** (§16). Plan data
  is **never** written to localStorage/sessionStorage/IndexedDB/Cache Storage. The only stored client values are the
  ecosystem theme cookie.
- **No client analytics** exist in the consumer apps. None are added.
- **Server errors** are fixed strings; logs are `{code,name}` only (§7.6).
- **Payment links:** the server stores `http(s)` only on new writes. The client **renders a link only if**
  `new URL(url).protocol` is `http:`/`https:`, with `target="_blank" rel="noopener noreferrer"`. Any other stored
  value (legacy) is shown as plain text in the editor field and never linked.
- **Ownership:** §6.4. No user id is ever accepted from the browser.
- Not added (no need): per-user encryption (Budget isn't Passwords, and nothing in the product promises it), audit
  history, revision history.
- **Claims:** the Welcome says only "Budget is a plan, not a bank feed. You add your paydays and bills yourself, and
  nothing connects to your accounts. Your plan is saved to your BakerRang account." **No** "private", "encrypted" or
  "secure" claims.

## 10. Auth / session
- `AuthProvider` (`web-auth`) with `oauthTarget = 'budget'` (`VITE_OAUTH_TARGET=budget`). Sign in → `GET
  /auth/google?target=budget` → back to `BUDGET_DOMAIN` `/` (root: the existing mechanism has no return path).
  Unknown target stays 400. If `BUDGET_DOMAIN` is unset, the callback gives the existing 500. Arbitrary redirect URLs
  stay impossible.
- `LOADING` → quiet ground (no spinner < 300 ms); `ANONYMOUS` → Welcome on **every** route; `AUTHENTICATED` → sheets.
- The shared host-only `connect.sid` on `api.bakerrang.com`, `SameSite=Lax`. `budget.` and `api.` are same-site. No cookie changes.
- Logout: the shared POST flow in `AccountMenu`, subject to §8.3.
- CORS: `https://budget.bakerrang.com` allowed with credentials exactly like `SIGN_DOMAIN`. Every existing origin and
  target is unchanged.

## 11. UX structure — "Plan and Month" (locked)

Direction contract: [`web/.impeccable/surfaces/budget.md`](../../web/.impeccable/surfaces/budget.md). Comp:
[`budget-comp.html`](../../web/.impeccable/mocks/budget-comp.html). Code-led (no image generation was available), so
the comp is the contract.

```
┌ bar 58px: pixel-B | Budget ····································· switcher · avatar(theme inside) ┐
│   ‹ September 2026 ›  (This month)          [ Month | Plan ]                     [+ Add ] (GOLD)   │
│   DUE          BILL                                                                       AMOUNT   │
│ ━ PAYCHECK  Fri, Aug 21  Acme payroll ···················································· $2,140.00 ━ (Ground-2 band, Line-strong top rule)
│   Pay period Aug 21 – Sep 3 · started in August                                                       │
│   Sat Aug 22   Phone  August  AUTO-PAY ······································· $48.37 (Ink-2, out of month)
│   Tue Sep 1    Rent  AUTO-PAY ·················································· $1,450.00             │
│                                                              Covered ─────── $1,555.06 (single rule over)
│                                                                 Left         $584.94               │
│                                                                              ═══════ (double rule) │
│ ━ PAYCHECK  Tue, Sep 15  Tutoring ··················································· $380.00 ━          │
│   Pay period Sep 15 – Sep 17 · 1 bill due later is paid from here                                  │
│   Wed Sep 16   Dentist  ONE-OFF ···················································· $260.00             │
│   Sun Sep 20   Credit card  DEBT  PAID FROM TUTORING ······························· $150.00             │
│                                                           ↓ Short            $30.00                │
│   TODAY · SAT, SEP 26 ──────────────────────────────────────────────────── (in its own period)     │
├─────────────── statement (sticky foot, upward rule shadow) ─────────────────────────────────────────┤
│ SEPTEMBER 2026 / Paychecks received and bills due this month    Paychecks $4,660.00  Bills $2,444.64  Net +$2,215.36 │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
phone: title+arrows · full-width Month|Plan · due column stacks weekday over date · tags drop under the
       name · statement pinned above a full-width 52px gold Add bar; both hide while an editor is open.
```

### 11.1 Routes
| Path | Auth | Surface |
|---|---|---|
| `/` | anon → Welcome; authed → Month for the current local month | |
| `/month/:ym` | same; `ym` = `YYYY-MM`, 2000-01..2100-12, else Not found | Month for that month |
| `/plan` | same | Plan |
| `*` | any | Not found ("That page isn't in Budget." → Back to Budget) |

React Router 6 (ecosystem parity). Month nav updates the URL (`replace` for ‹ ›), so reload keeps the month and sheet.
There's no other persisted UI state.

### 11.2 Component map (`web/apps/budget/src/`)
`App.jsx` (routes, auth gate, bar via `BrandLink`/`AppSwitcher`/`AccountMenu`/`ProductEmblem`) · `sheets/SheetHead.jsx`
(month title + nav, the Month|Plan `<nav>` with `aria-current`, the Add menu) · `sheets/MonthSheet.jsx` · `sheets/PeriodTable.jsx`
(band + ledger table + tfoot rules) · `sheets/Statement.jsx` · `sheets/PlanSheet.jsx` · `sheets/PlanTable.jsx` ·
`editor/EntryEditor.jsx` (payday/bill/debt/one-off variants) · `editor/MoneyInput.jsx` · `editor/Listbox.jsx` (Paid from, Last
payment month; **never** a native `<select>`) · `editor/DayRule.jsx` (the segmented radiogroup + day input) · `Welcome.jsx` ·
`NotFound.jsx` · `state/usePlan.js` (load/refresh/writes/op tokens, §8) · `state/useEditor.js` (draft, dirty, status) ·
`plan/{dates,money,schedule,allocate,format,validate}.js` (pure, §4–5) · `api/budget.js` (§7.7). Nothing Budget-specific
graduates to `web-ui`.

### 11.3 Visual contract (summary; DESIGN.md "Product layer: Budget" is authoritative)
Flat ground, no containers. The sheet column is 920px. Paycheck **bands** are ruled section heads: Ground-2 running the
full column width, a Line-strong rule on top and a Line rule below, with **no side borders and no radius** (finish review fix 3). Rows are 1px-ruled. **One right-aligned tabular money column**. The accounting rules: a single `Line
Strong` rule over Covered and a **double rule** under Left (the signature). Kind tags are text: 10.5px/700 small caps,
Ink-3 (`DEBT`, `ONE-OFF`, `AUTO-PAY`, `PAID FROM …`, `PAUSED`, `NEEDS A DUE DAY`). **Gold = Add only.** In first run the
generic Add renders **ghost** and "Add a payday" is the only gold. While loading or after a failed load, Add is **not rendered**
(fixes 1–2). **Budget Blue** only on the emblem and the row-name hover underline.
**Save is ink-filled** (the Ink colour with Ground text), never gold. Errors and status are **in ink with a drawn icon**, never red,
except the Delete control and the destructive confirm, which use the world's Danger text.

### 11.4 Editor field map and copy (locked)
- **Payday:** Name ("e.g. Acme payroll") · Take-home pay · **Repeats** [Monthly | Every 2 weeks | Every week] (a radiogroup) ·
  Monthly: **Paid on** [Day | First day | Last day] + the day input (hint "Days past the end of a short month land on its last
  day.") · Weekly/2 weeks: **A payday date** (native `type="date"`, default = local today) with the hint "Any past or upcoming
  payday. Budget counts … forward and back from it."
- **Bill / Debt:** Name · Amount · **Due every month on** [Day | First day | Last day] + day (hint > 28: "In shorter months
  it is due on the last day.") · Debt: **Last payment** (optional; month listbox "No end"/January…December + year input) and
  **Balance you noted** (optional; hint "For your reference. Budget doesn't change it.") · **Paid from** listbox:
  "Automatic — the most recent payday on or before the due date", then each payday with its schedule · Auto-pay ·
  Paused ("Left out of every month") · Payment link (optional, "https://"; the "Open payment site" link when saved +
  valid) · Notes (optional).
- **One-off:** Name · Amount · **Due date** (`type="date"`) · Paid from · Auto-pay · Payment link · Notes. (Paused is
  shown only if a legacy one-off is already paused.)
- Intro line: "Changes apply to every month." / "A one-off bill, due once." / "New debt. It repeats every month."
- Footer: Delete (Danger text) · status message · Cancel · **Save** / **Add bill** (ink).

### 11.5 Signature: re-footing
After a confirmed save or delete, only the figures whose **rendered string changed** (the bill, its period's Covered/Left,
the statement) roll up into place (`translateY(45%)→0` + fade, **120 ms**, ease-out). The changed period's double rule
redraws left→right (`scaleX 0→1`, **180 ms**). No other motion runs on the sheet. Under `prefers-reduced-motion` (or the
comp's reduced toggle), values swap instantly. Implementation: keep the previous formatted strings in a ref keyed by
`bill:<id>:<day>`, `cov:<period>`, `left:<period>`, `st:<in|bills|net>`, and add the class on commit. **Stable layout:**
figures change in place and nothing else moves. A bill whose due day changed re-sorts once, on save.

### 11.6 Why this isn't Story Book, Polyglot or Sign
There's no book, log, dock or camera. The first object is a **ruled pay-period ledger** whose structure comes from
accounting notation (a column of figures, a single rule before a subtotal, a double rule under the total). The only
shared grammar is the ecosystem chrome and the one-gold-action rule.

## 12. Responsive / mobile contract
- **Phones are a first-class use** (checking "what's left from this paycheck" happens on a phone). ≤ 640px:
  - The head stacks: arrows + title in one row (title centered, "This month" hidden; the ‹ › labels say which month),
    then the Month|Plan switch full width. **Add moves to a fixed bottom bar**: full-width 52px gold, inside
    `env(safe-area-inset-bottom)`.
  - **The tables stay tables** (3 columns): the due column is 4.6rem (weekday on its own line above the date), then the name
    (tags drop to their own line; the out-of-month month note is **visually hidden but kept for screen readers**, since the
    due column already says "Aug 22") and a 10.2ch money column. **No horizontal scrolling anywhere.**
  - Plan hides the schedule column. The schedule prints under the name.
  - The statement stays pinned (3 columns: Paychecks / Bills / Net) just above the Add bar.
  - **While an editor is open, the statement and the Add bar hide** (keyboard room). The editor fields stack in one column,
    and Save stretches.
  - Touch targets are ≥ 44px: the month arrows 44×44, every small button (`btn--sm`, e.g. "Add a bill") 44px tall, rows ≥ 48px
    tall, inputs 44px, the Add bar 52px. The month title uses the world clamp's 1.55rem floor (no phone override).
- **Desktop:** one 920px column; the statement is pinned to the viewport foot; the editor is a 6-column grid (Name 4 / Amount 2;
  schedule full; Paid from 3 / checks 3; link 3 / notes 3; debt extras 3 / 3).
- Landscape phones use the phone layer below 640px width, and the desktop layer above it.
- No dialogs or sheets exist: the Add menu is a popover (desktop anchored under Add; phone opening upward from the
  bottom bar). The listboxes are anchored popovers inside the editor.

## 13. Accessibility contract
- **Semantics:** each pay period is a `<section aria-labelledby>` (the band's `<h2>`: "Paycheck Fri, Sep 4 Acme payroll"),
  holding a `<table>` with a visually hidden `<caption>` ("Bills paid from the Fri, Sep 4 Acme payroll paycheck"), visually
  hidden `<thead>` (Due / Bill / Amount), rows with `<th scope="row">` for the bill name, and a `<tfoot>` with **Covered**
  and **Left / Short** as `<th scope="row">`. The statement is a `<footer aria-label="September 2026 totals">` with a `<dl>`.
  The Month|Plan switch is a `<nav>` with links and `aria-current="page"`. The page `<h1>` is the month (or "Plan").
- **Accessible totals:** each figure is real text. Out-of-month rows add "(October)". "Short" rows read "Short $30.00"
  (the icon is `aria-hidden`). Net reads "Net plus $2,215.36" / "Net minus …" (sign in text). The **Today** rule is a real
  table row ("Today · Sat, Sep 26"), read in order, so screen-reader users keep their place. On phone Plan, the duplicated
  schedule line under the name is `aria-hidden` (the schedule cell is read once).
- **Row activation:** the name is a `<button aria-expanded aria-controls>`. Clicking the row delegates to it. The editor
  is a `<form aria-label="Edit Rent">` in the next row (`<td colspan="3">`). When the editor opens, **focus moves to its
  first field**. On close it returns to the row button.
- **Forms:** every input has a `<label>`. Errors are `aria-invalid="true"` + `aria-describedby` → an inline message
  (icon + text, ink), the footer summary is `role="alert"`, and the first invalid field gets focus. Radiogroups
  (Repeats / Due rule) use `role="radiogroup"` + `role="radio" aria-checked` with arrow-key roving. Listboxes follow the
  ARIA listbox pattern (button `aria-haspopup="listbox"`, `aria-activedescendant`, ↑↓ Home End Enter Space Esc Tab).
  Enter submits the form. Esc cancels (subject to §8.3).
- **Live region:** one polite `role="status"`: "Saved Rent. September net is now plus $2,215.36.", "Deleted Dentist.",
  "October 2026" on month change, "Loaded the latest Rent." Errors use `role="alert"` in the editor.
- **Color-independence:** Short/Left and net sign are words + sign + icon. Kinds are text tags. Paused is text + Ink-3.
  Validation is icon + text + a heavier ink border (a 3px inset ink bar, **not** red).
- **Keyboard:** Tab order is bar → month nav → sheet switch → Add → rows in visual order → statement. No single-key
  global shortcuts.
- **Reduced motion:** re-footing and the editor entrance are instant. The menu pop is instant.
- **Contrast:** AA in both themes. The light Ink-3 is `#6b665e` (the world's Ink-3 on Ground `#efece6` is AA for small tags).
  The focus ring is the world's 2px gold-text outline.

## 14. Loading / error / empty states (copy locked)
| State | What shows | Recovery |
|---|---|---|
| Loading (> 300 ms) | The column heads + "Loading your plan…" with a small spinner. Add **not rendered** (header and phone bar). | — |
| Couldn't load | "Budget couldn't load your plan." / "Nothing was changed. Check your connection, then try again." (a drawn cloud icon, ink, `role="alert"`). **Never** an empty plan. Add not rendered, so **Try again** is the primary action. | Try again |
| First run (no paydays, no bills) | "Start with a payday." + a 3-step ruled list + **Add a payday** (the only gold on the page; the header/bar Add is **ghost** in this state) | Add a payday |
| Bills but no paydays | A "No paycheck · Not covered yet" band: "Add a payday and Budget will split these across your paychecks." Bills listed, "Due" total. | Add → Payday |
| Month with nothing | "Nothing is due this month." / "No paychecks or bills fall in this month." | — |
| Period with no bills | "No bills due before the next payday." | — |
| Needs attention | A notice: "{N} bill(s) in your plan {has/have} no due day, so {it isn't/they aren't} on any month." + **Open Plan** | Fix in Plan |
| Offline (loaded) | A notice: "You're offline." / "You can read this month, but changes can't be saved until you're back." Save `aria-disabled` ("Offline. Saving is paused.") | — |
| Saving / failed / conflict / deleted-elsewhere / discard | §8.2–8.3 | — |
| Validation | Name: "Give it a name." · Amount (empty): "Enter an amount." · Amount (bad): "Enter an amount like 1,234.56, up to $9,999,999.99." · Day: "Enter a day from 1 to 31." · Anchor: "Pick a payday date." · One-off date: "Pick the date it is due." · Last payment year: "Enter the year of the last payment, like 2027." · Balance: "Enter a balance like 2,864.00, or leave it empty." · Link: "Use a full link that starts with https://" | fix field |
| Limits | "You have 250 bills, which is the most Budget keeps. Delete one to add another." (the same form for 20 paydays) | — |

## 15. Theme
Shared `web-theme` (light / dark / system, `br_theme` cookie + `/account/preferences`), boot script, no flash. The theme
control lives in the account menu (Story Book/Polyglot/Sign parity). Two `theme-color` metas: `#161514` / `#efece6`.
`color-scheme` follows the theme, so native date pickers and checkboxes match.

## 16. PWA and Launcher copy
App-local `vite.config.js`, the same shape as Polyglot, exporting `BUDGET_PWA_OPTIONS` for a config test:
`registerType:'autoUpdate'`, `id:'/'`, `name:'Budget — BakerRang'`, `short_name:'Budget'`, `description:'See what
every paycheck has to cover, month by month.'`, `start_url:'/'`, `scope:'/'`, `display:'standalone'`,
`theme_color` and `background_color` `'#161514'`, maskable 192/512 icons. Workbox:
`globPatterns: ['**/*.{html,css,js,woff2,png,ico,webmanifest}']`, `navigateFallback:'index.html'`,
**`runtimeCaching: []`**. **No API responses are cached** (they're cross-origin at `api.bakerrang.com`, and runtime
caching is empty). **No offline editing:** offline, the cached shell loads, auth/plan loads fail, and the ecosystem's
standard offline behavior applies (web-auth treats a failed `/auth/check` as ANONYMOUS → Welcome, the same as every
extracted app). Legacy has no offline behavior either.
Icons are rasterized from `web/.impeccable/mocks/budget-icon.svg` (the shared Budget emblem in Budget Blue on the charcoal tile,
an accounting double rule in 40% ink, and the **canonical** `bakerrang-logo.png` badge composited, never redrawn) by an app-local
`scripts/generate-icons.cjs` cloned from Polyglot's. Provenance goes in `apps/budget/ASSETS.md`.

**Launcher copy (PR 2, launcher-only deploy):** `Launcher.jsx` `budget:` → **"See which paycheck covers which bills,
month by month."** (D16).

## 17. CI / CD / deployment (extend the Phase C/D/E mechanisms; no redesign)

Naming check: nothing in `scripts/ci`, `.github/workflows`, `web/`, Cloud Run conventions or the registry uses
`budget` for anything else. The registry id is already `budget`, the env key `VITE_BUDGET_URL`, and the token `--accent-budget`.

| Mechanism | Change |
|---|---|
| `web/apps/budget` | `@bakerrang/web-budget`, dev port **3040**, preview **4177**, root script `npm run dev:budget`. Deps mirror Polyglot's (the shared packages + `react-router-dom@6.28.0`). **No new third-party dependencies.** |
| `web/package-lock.json` | Relock via the existing `npm run relock`. |
| `web/Dockerfile` | `COPY apps/budget/package.json apps/budget/package.json` (deps stage). `APP=budget`, `VITE_OAUTH_TARGET=budget`. |
| `scripts/ci/classify-changes.mjs` | `ALL_WEB_SERVICES` += `'web-budget'`; rule `{ prefix: 'web/apps/budget/', ci: ['web-budget'], deploy: ['web-budget'] }`; outputs `web_budget`, `deploy_web_budget`. |
| `.github/workflows/ci.yml` | A `web-budget` build + Docker packaging validation (`--build-arg APP=budget --build-arg VITE_OAUTH_TARGET=budget`, tag `bakerrang-web-budget:pr-<sha>`); added to the web-job `if`, the outputs and `ci-passed`. |
| `.github/workflows/deploy.yml` | `workflow_dispatch` option `web-budget`; `validate-web` builds budget when flagged; a `deploy-web-budget` job (the `deploy-web-sign` shape, `service: web-budget`); `live-deploy-passed` aggregates `DEPLOY_WEB_BUDGET` / `WEB_BUDGET_RESULT`. |
| `_deploy-cloud-run.yml` | The description list gains `web-budget`; env `WEB_BUDGET_SERVICE`, `BUDGET_BASE_URL`; a `web-budget)` case (`service_name="$WEB_BUDGET_SERVICE"`, `image_name="web-budget"`, smoke `${BUDGET_BASE_URL%/}/`); a build case (`APP=budget`, `VITE_OAUTH_TARGET=budget`); added to the SPA-shell assertion (`…\|web-sign\|web-budget`). No vendor smoke. |
| `scripts/ci/stale-deploy-guard.mjs` | `SERVICES` += `'web-budget'`. |
| `rollback.yml` / `scripts/ci/rollback.ps1` | the `web-budget` choice + allowlist + message; `'web-budget' = @{ Path = '/'; Public = 'https://budget.bakerrang.com/'; Assertion = 'ClientRoot' }`. |
| `verify-live.yml` / `scripts/verify-live.ps1` | `{ Logical='web-budget'; Service='bakerrang-web-budget'; Package='web-budget'; ExpectedSa='bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' }` + endpoint `Web Budget https://budget.bakerrang.com/ ClientRoot`. |
| Tests | `classify-changes.test.mjs` (budget-only → only `web-budget`; `web/packages/**` → all five web services; `server/` → api only), `deployment-workflows.test.mjs` (the job, case, option and SPA assertion exist), `stale-deploy-guard.test.mjs`, `rollback.test.ps1`, `verify-live.test.ps1`. |
| GitHub `production` Environment | `WEB_BUDGET_SERVICE=bakerrang-web-budget`, `BUDGET_BASE_URL=https://budget.bakerrang.com`. |
| Immutable SHA / WIF | Unchanged conventions: image `…/web-budget:<sha>`, deploy by digest through the existing WIF deployer, scoped `roles/run.developer` on `bakerrang-web-budget` only. |

**Selective deploy:** a Budget-only change deploys only `web-budget`. A `web/packages/**` change deploys `web-launcher`,
`web-storybook`, `web-polyglot`, `web-sign` **and** `web-budget`. PR 2 touches `web/Dockerfile`/the classifier, so it
deploys all five. A `server/` change deploys `api` only.

## 18. Shared-package impact / registry
| Package | Change |
|---|---|
| `web-app-shell` | **Implementation PRs: none.** `legacyPath:'/budget'` (verified correct: a single legacy page) and `liveUrl:null` stay. **Flip PR:** `liveUrl:'https://budget.bakerrang.com'` + update `index.test.jsx`'s expected budget URL. Story Book/Polyglot/Sign live URLs untouched. |
| `web-ui`, `web-tokens`, `web-theme`, `web-auth`, `web-api-client` | None. `--accent-budget` exists (`#7fb0e8` / `#235f9e`). |
| Launcher | The copy line only (§16). |

## 19. Coexistence / cutover
| Entry | Before the flip | After the flip |
|---|---|---|
| Launcher row + app switchers | `https://bakerrang.com/budget` | `https://budget.bakerrang.com` |
| Legacy `bakerrang.com/budget` | Unchanged UI, working (it now gets transactional writes + `rev` server-side) | Unchanged (retirement is a later phase) |
| Data | One doc per user, shared by both clients | Same |
| Apex `bakerrang.com` | Unchanged | Unchanged |

1. **PR 1 — server:** B1–B7 + tests + `.env.example`. Deployable alone. The legacy client is unaffected (its routes keep
   their contract).
2. **PR 2 — app + CI:** `web/apps/budget`, Dockerfile, classifier, workflows, rollback/verify-live, the Launcher copy line,
   `docs/apps/Budget-PhaseF-Runbook.md`. `liveUrl` stays `null`.
3. **Operator runbook** (§20) → first deploy via CI → verify on `run.app` → map `budget.bakerrang.com` → DNS.
4. **Live acceptance** (§22) directly on `budget.bakerrang.com`.
5. **PR 3 — flip:** `liveUrl:'https://budget.bakerrang.com'` (a shared package → redeploys all five web apps).
6. **Rollback:** `rollback.yml` for `web-budget`. Revert PR 3 to restore the legacy destination. Revert PR 1 only after
   PR 3 is reverted (the new app needs B1). Data needs no rollback (§6.4).

## 20. Runbook specification (`docs/apps/Budget-PhaseF-Runbook.md`, written in PR 2)
Clone the Sign runbook's structure and voice **exactly** (PowerShell, copy-pasteable, expected output after each check).
Targets block: `web-budget` / `bakerrang-web-budget` / `https://budget.bakerrang.com` / `bakerrang-api` / `avian-cable-379805`
/ `us-west1` / the runtime SA `bakerrang-frontend@…`, and a "Until final cutover" block (`budget.liveUrl` null; the Launcher → `https://bakerrang.com/budget`;
legacy available; apex unchanged).
- **STEP 0** variables: `$ProjectId`, `$Region`, `$ApiService`, `$BudgetService="bakerrang-web-budget"`,
  `$BudgetHost="budget.bakerrang.com"`, `$BudgetBaseUrl="https://budget.bakerrang.com"`, `$FrontendRuntimeSa`,
  `$GitHubEnvironment="production"`, `$GitHubRepo` (via `gh repo view`); confirm the project + auth.
- **STEP 1** `gh variable set/get` `WEB_BUDGET_SERVICE`, `BUDGET_BASE_URL` (expected output shown).
- **STEP 2** `gcloud run services update $ApiService --update-env-vars "BUDGET_DOMAIN=$BudgetBaseUrl"` + describe/verify.
  Don't remove the existing env vars. (PR 1 must be deployed first.)
- **STEP 3** Bootstrap the service from the current `bakerrang-web-sign` image (`--service-account $FrontendRuntimeSa --port 8080
  --allow-unauthenticated`), then verify the SA.
- **STEP 4** Copy the `roles/run.developer` members from `bakerrang-web-sign` onto `$BudgetService` (the foreach loop), then verify.
  No project-wide roles.
- **STEP 5** Verify SA-user on `$FrontendRuntimeSa`.
- **STEP 6** Push PR 2 → the normal deploy (only the web services the classifier names), watch `gh run watch`.
- **STEP 7** Get the `run.app` URL; `Invoke-WebRequest` the shell (200, `<div id="root"`), `/plan` + `/month/2026-09` +
  `/nope` return the shell (SPA fallback), `/manifest.webmanifest` name "Budget — BakerRang", `sw.js` present.
- **STEP 8** Verify the API: `OPTIONS`/`GET https://api.bakerrang.com/budget/plan` with `Origin: https://budget.bakerrang.com` →
  `access-control-allow-origin` echoes it with credentials (401 is expected unauthenticated); `Cache-Control: no-store` present on the 401.
- **STEP 9–11** `gcloud beta run domain-mappings create --service $BudgetService --domain $BudgetHost` (**never apex**), the
  describe → DNS records, and waiting for the certificate (a `Ready` loop with the expected output).
- **STEP 12** Direct-host acceptance = §22 rows 1–15, each as a numbered checklist with the exact clicks and expected text.
- **STEP 13** Privacy/network check (§22 row 12) with the DevTools filter instructions.
- **STEP 14** Coexistence (§22 row 14): edit in legacy → Refresh in new (visible), edit the same bill in both → new gets 409 copy.
- **STEP 15** Registry cutover PR (§19.5) with the exact snippet, and "do NOT remove `legacyPath:'/budget'`, do NOT delete the legacy page".
- **STEP 16** Post-cutover smoke: Launcher row + every app switcher (Story Book, Polyglot, Sign, Budget) open `budget.bakerrang.com`.
- **STEP 17** Rollback: (a) `gh workflow run rollback.yml -f service=web-budget …`; (b) revert only the product cutover
  (the PR 3 revert); (c) server rollback order note (§19.6); data needs nothing.
- **FINAL EXPECTED STATE** block.
- **No** Cloud Logging exclusion step (Budget puts no content in URLs) and **no** key-rotation step.

## 21. Deterministic test plan
**Automated.** Vitest + Testing Library in `web/`; `node:test` + FakeDb in `server/`. Behavior, not snapshots.

| Area | Tests |
|---|---|
| `plan/money.js` | `parseMoney` accepts `1234.5`, `1,234.50`, `$ 12`, `.5`, `0`; rejects `-1`, `1e3`, `1.234`, `1,23`, `12,3456`, `''`, `10000000`; results are integers. `formatCents`: `0 → $0.00`, `5 → $0.05`, `123456789 → $1,234,567.89`, `-3000 → −$30.00`, signed `+`. `toCents` table: `1.005→101`, `0.285→29`, `12.345→1235`, `0.1+0.2→30`, `-2.5→-250`, `NaN/∞/'12'/null → invalid`. **Round-trip property:** `toCents(c/100) === c` for boundaries and 10k sampled values in 0..999,999,999. |
| `plan/dates.js` | `daysFromCivil`/`civil` inverse over 2000–2100 (every 1st and last of the month); leap years (2000 yes, 2100 no, 2024 yes); weekday 1970-01-01 Thu, 2026-09-26 Sat; `parseISO` rejects `2026-02-30`, `2026-13-01`, `26-09-01`. **No `new Date(` on a date string anywhere in `src/`** (a static grep test). |
| `plan/schedule.js` | Monthly day 31 → Feb 28/29, Apr 30 (**bills and paydays**, D3). First/last. Biweekly anchor Fri 2026-09-04 → Aug 21, Sep 4, Sep 18, Oct 2 (back and forward). Weekly; an anchor far in the future still projects backwards. A debt last payment 2027-03 → recurs in March 2027, not April. A one-off on 2026-10-01 lands only in October (D1). Paused → none. Issues → none. |
| `plan/allocate.js` | **The §5.3a pinned-outside-window fixture** (see §5.3a). **The §5.3 worked example exactly** (periods, per-period covered/left, Short $30.00, statement $4,660.00/$2,444.64/+$2,215.36, out-of-month rows flagged). An early bill → the previous month's payday. A pinned bill → the latest occurrence of its payday ≤ due (incl. across a month). Pinned to a missing payday → automatic. Ties on the same day → the last in order. Two paydays of different sources on one day. No paydays → "not covered". The ±45-day window covers a monthly payday on the 31st pinned from a bill on the 30th. Negative legacy amounts included, not errors. Bills with `amountCents:null` excluded. Today placement. |
| `plan/validate.js` | Mirrors the server rules. **A drift test** runs the same fixture table through `web/apps/budget/src/plan/validate.js` and `server/domain/budgetPlan.js` (imports the server module by relative path in the test only), and both give the same field/verdict. |
| Components | Auth gate (anon → Welcome on `/`, `/plan`, `/month/…`). Month renders tables with captions/`th scope`, "Short" text + icon, net sign in text. A row opens the editor in place, focus goes to the first field, Esc returns focus. Dirty + month nav → the inline discard prompt, not navigation. Save: `aria-disabled` while saving; success re-seeds state from the **server** entry (a fake returns a different normalized value → the UI shows the server's). 409 → conflict copy + Use latest; 409 equal to the draft → treated as success. 404 on PUT → "deleted somewhere else". Network failure keeps the draft. Create timeout → retry sends the **same `requestId`**. Delete confirm → removed; payday delete applies `unpinned`. **A load failure never shows the first-run state.** Offline notice disables Save. The Add menu: arrows, Esc returns focus. Listbox ARIA pattern keys. Radiogroup arrows. Phone class toggles hide the statement/Add bar while editing (matchMedia mocked). **The error body is never merged into state** (D5 regression). URL link rendered only for http(s); a stored `javascript:alert(1)` is shown as text. Live-region messages. |
| `usePlan` races | An aborted load response is ignored. The visibility refresh is skipped while an editor is open. A late save response for a deleted entry is ignored. Sign-out aborts in flight. |
| PWA config | `BUDGET_PWA_OPTIONS` identity, `runtimeCaching: []`, no API pattern in `globPatterns`. |
| Storage privacy | During a simulated session (load, edit, save, delete), `localStorage`/`sessionStorage`/`indexedDB`/`caches` are untouched by Budget code (spies). Requests carry amounts only in bodies (no `?` on any `/budget` URL). |
| Server `budgetPlan.js` | Validation order + every §7.3 rule, with a fixture per field. Mapping both ways (§6.2 table, row by row). **Normalization table §6.3, row by row**, including `day:'first'` + `dayType:'fixed'`, `day:null`, `day:45`, a string amount, a negative, an unknown category, a missing `active`, a dangling `paydayId`. The written shape equals the legacy shape contract (field names/types §1.4) for every entry kind. |
| Server routes (`budgetRoutes.test.js`, FakeDb + the express app harness of `polyglot.test.js`) | 401 unauthenticated; `no-store` on 200/400/404/409/500 and on the legacy GET; GET with a missing doc → empty, no write; POST 201 with a server `id`/`rev:1`; repeated `requestId` → 200 same entry, one entry stored; the limits → 409 `code:limit`; PUT happy path bumps `rev` and **preserves unknown stored fields**; PUT stale → 409 with `current`; PUT another user's id → 404 (**cross-user**: seed user B's doc, user A cannot read/modify/delete B's entries by id); category change → 400; payday delete unpins in the same transaction; **concurrency:** FakeDb `beforeCommit` interleaves two writes to different entries → both survive (legacy and new routes); the legacy POST/DELETE still returns its old response shape and now bumps `rev`; **legacy metadata preservation (§7.4):** (1) `POST /budget/bills` with `requestId: R` → 201, `rev 1`; (2) legacy `POST /budget/item` with the same `id` and a changed amount and **no** `requestId`/`rev` → the unchanged legacy response; (3) the stored entry still has `requestId === R`; (4) the stored `rev === 2` and the amount changed; (5) repeat request 1 with `requestId: R` → **200**, the body is the current entry (the legacy-edited amount, `rev 2`); (6) the bills array holds exactly one entry with that `requestId`/`id`. The same flow for `POST /budget/paydays` + legacy `POST /budget/payday`. Also: a legacy body that *includes* `requestId:'x'` / `rev:99` cannot overwrite the stored ones, and a legacy create stores `rev:1` and no `requestId`; logs never contain a name/amount (console spy); the rate limiter is mounted (a smoke test with a low `max` in a test app). |
| Auth/CORS | `oauthTarget.test.js` (`budget` valid → `BUDGET_DOMAIN`; missing env → 500), `cors.test.js` (allowed when set; rejected when unset). |
| CI | §17 tests. |

## 22. Live acceptance matrix (`budget.bakerrang.com`, before the flip)
| # | Check | Pass when |
|---|---|---|
| 1 | Shell | HTTPS; `/`, `/plan`, `/month/2026-10`, `/nope` → the shell (Not found inside for `/nope`); `manifest.webmanifest` "Budget — BakerRang". |
| 2 | Signed out | Welcome with a labelled Example; the top-bar Sign in is ghost, the page gold is "Sign in with Google"; `?target=budget` → back to Budget. Already signed in via the Launcher → no prompt. |
| 3 | **Real existing data** | The owner's real plan loads, with every legacy entry present (count paydays/bills vs legacy). Entries with issues appear in Plan with a tag, and none vanish. |
| 4 | **Totals parity** | For the current and next month, record legacy Income/Expenses/Net. The new Paychecks/Bills/Net **match**, except months touched by L-diff 1/2, which must be explained by a specific entry. Per-paycheck Left differs **only** as L-diff 3/4 predicts. Spot-check one period by hand in cents. |
| 5 | Create/edit/delete | Add a payday (every 2 weeks), a bill, a debt with last payment, a one-off; edit an amount (`1,234.5` → shows `$1,234.50`); delete a one-off; delete a payday with a pinned bill → the bill becomes Automatic. Reload → all persisted. |
| 6 | Validation | `-5`, `1.234`, `1e3`, day `32`, an empty name, `javascript:alert(1)` as the link → each blocked with the locked copy, focus on the field, nothing saved. |
| 7 | Money correctness | The comp fixture reproduced as real data (a disposable test account) gives exactly §5.3's figures. `$9,999,999.99` is accepted and aligned; `$10,000,000.00` is rejected. |
| 8 | Desktop | Chrome + Firefox + Safari (macOS) at 1280–1600: the head, bands, rules and money column are aligned. The double rule sits under Left. Re-footing plays once on save. |
| 9 | Mobile (real iOS Safari + Android Chrome) | No horizontal scroll at 360–430px. Rows ≥ 48px. The editor opens in place with the keyboard and the statement/Add bar hidden. Save reachable. `inputmode` gives a decimal keypad. The native date picker themed. |
| 10 | Themes | Light/dark/system, no flash; `theme-color` follows; the Add gold with dark ink in both. |
| 11 | Accessibility sanity | Keyboard-only: open a row, edit, Save, Esc, Delete confirm, the month nav, the listbox and radiogroup. VoiceOver/NVDA read the period caption, "Short $30.00", "Net left plus …", and the save announcement once. Reduced motion → instant. |
| 12 | Privacy / network | DevTools: `/budget/*` requests have no query strings; the bodies hold the amounts; the responses carry `cache-control: no-store`; Application tab → no Budget data in Local/Session Storage, IndexedDB or Cache Storage (the SW precache holds only the shell). |
| 13 | Concurrency | Two tabs: edit Rent in tab A and save; save a stale Rent edit in tab B → "Rent was changed somewhere else" → Use latest shows A's value. Edit *different* bills in both tabs → both persist. |
| 14 | **Coexistence with legacy** | Edit an amount in legacy `bakerrang.com/budget` → the new app shows it after returning to the tab (≥ 60 s) or reload. Edit in new → legacy shows it on reload, and legacy's modal opens and saves it without error (incl. a first/last-day bill, which no longer turns into NaN). Legacy Add still works. |
| 15 | Offline | Airplane mode after load → the offline notice, Save paused. A cold start offline → the ecosystem Welcome (standard behavior). |
| 16 | PWA | Installable as **Budget** with its icon. Cache Storage has only shell assets. |
| 17 | App switcher | Pre-flip: the switcher/Launcher still open legacy `/budget`. After the flip (PR 3): the Launcher and every app's switcher open `budget.bakerrang.com`; the Story Book/Polyglot/Sign destinations are unchanged. |
| 18 | Deploy mechanics | A Budget-only commit deploys only `web-budget`; rollback + verify-live cover it. Apex unchanged. |

## 23. Security / privacy findings (summary)
| # | Finding | Severity | Action |
|---|---|---|---|
| F1 | Lost updates: non-transactional read-modify-write on one shared doc (D7), made worse by coexistence. | **Medium** (data integrity) | Transactions on every write, legacy included (B1, B2). |
| F2 | No server validation: arbitrary JSON stored, including values that crash legacy rendering (D8). | **Medium** | Validated new routes; tolerant normalization on read (§6.3). |
| F3 | Unvalidated `url` that a future client would link (`javascript:`). | **Medium** if rendered | `http(s)` on write; link only `http(s)` on read (§9). |
| F4 | Client merges error bodies into data, and silent delete failures (D5, D6). | Medium (integrity perception) | Typed errors; explicit states. |
| F5 | Private data responses without `Cache-Control`; no rate limit (D20). | Low | `no-store`; `budgetLimiter`. |
| F6 | Raw error logging (D21). | Low | Fixed-shape logs. |
| — | **Ownership is correct**: session-derived, structural, no browser-supplied user id, no cross-user path. | — | Kept and tested (cross-user test). |
| — | No content in URLs today (ids only), so no logging exclusion needed. | — | — |

## 24. Impeccable process and finish review
- Audit first (§1). **Structure round:** `concept-seed --scope surface --mode operate` (seed `a78dd77e`) dealt three of the
  planner's seven grounded structures (The Month Board [lead], Plan and Month, The Pay Line). None of the catalog challengers
  (darkroom stations, ASCII render, zoo map, vertical feed, deep dive, cloud quarry) fused better on audience or clarity.
  The decision page closed unanswered, so the round was re-presented through the structured question tool, and the owner locked
  **Plan and Month** and the early-bill rule.
- The direction contract was written to `web/.impeccable/surfaces/budget.md` before the comp. The comp was built code-led, then went
  through two inspection rounds (desktop 1440 + phone 390, both themes) and one detector pass (2 advisories: a radius fixed; the phone
  title size is an intentional step).
- **Finish review:** see §24a (the reviewer's verdict and every fix are recorded there).

### 24a. Finish review record
A fresh `impeccable-finish-reviewer` (no shared context) reviewed the comp, the icon and the captures (1440 / 390, dark + light, 12
states) against the direction contract.

- **Round 0 — `recapture`:** two of the planner's captures were invalid evidence (one was scrolled, and the full page had a
  stitched sticky bar and statement covering rows). Both were recaptured correctly (fresh load at scrollTop 0; full page with the
  bar and statement forced static).
- **Round 1 — `fix`**, with 8 material fixes: (1) two gold fills on first run; (2) a disabled gold Add dominating the
  loading/failed screens; (3) paycheck bands drawn as bordered boxes, against "no containers"; (4) "Net left" inviting comparison
  with the per-period Lefts; (5) 36px phone targets (month arrows, small buttons); (6) a redundant out-of-month line on phone rows;
  (7) the Today rule `aria-hidden` and a phone Plan schedule read twice; (8) an off-ramp phone title size. The reviewer
  kept the ledger exactly: one tabular money column, a single rule over Covered, a double rule under Left, pay-period
  grouping with the carried-in period, text tags, and the pinned statement.
- **All 8 fixed in one batch → verdict pass: all 8 `resolved`, no regressions → `ship`** (scoped to the scored fixes;
  not a fresh full-surface hunt). The fixes are folded into §11.3, §12, §13, §14 and the surface brief.
- **Documenter:** `web/DESIGN.md` "Product layer: Budget" (+ Budget typography/components in the frontmatter) and additive
  `web/.impeccable/design.json` entries (typography, `statement` shadow, `refoot`/`redraw`/`editor-open` motion,
  the `budget-phone` 640px breakpoint, three components, scoped rules). The frontmatter parses, and design.json is valid JSON.
- **Post-review lock (2026-09-26), pay-period line:** "Covers {start} – {end}" was replaced by §5.3a's "Pay period … · N
  bill(s) due later … paid from here". Focused check: the detector returned `[]`, and a scoped `impeccable-finish-reviewer` pass
  (captures `review/budget/desktop-payperiod.png`, `mobile-payperiod.png`) returned **`ship`, no material fixes**. Its two
  optional notes were applied: full stops instead of middle dots in the caption, and `text-wrap: pretty` on the line.
  `web/DESIGN.md` (the span-line rule) and the `web/.impeccable/design.json` period specimen were corrected. The specimen had put the
  pinned Credit card under the Sep 18 paycheck with "Covers Sep 18 – Oct 1", contradicting the approved allocation.
- **Implementation must NOT copy these comp shortcuts** (documented as non-canonical): the native `window.confirm()` discard (use
  the §8.3 inline prompt); the Short arrow drawn at stroke 2.2 (use the world's **1.75**); the editor entrance missing from the
  `prefers-reduced-motion` query (it must be instant under reduced motion, §13); CDN fonts (the app uses `web-tokens`' self-hosted
  Archivo); `innerHTML` re-rendering (React; **no re-mounting of focused controls**); synthetic data. The re-footing
  signature is verified from code only (no post-save capture). Live acceptance row 8 checks it.

## 25. Files created / updated by this planning phase
| File | Status |
|---|---|
| `docs/apps/PhaseF-Budget.md` | **new** (this document) |
| `web/.impeccable/surfaces/budget.md` | **new** (the surface brief + direction contract) |
| `web/.impeccable/mocks/budget-comp.html` | **new** (the interactive comp) |
| `web/.impeccable/mocks/budget-icon.svg` | **new** (the app-icon master) |
| `web/.impeccable/review/budget/*.png` | **new** (review captures) |
| `web/DESIGN.md` | updated: "Product layer: Budget" (the Impeccable documenter, from the finished comp) |
| `web/.impeccable/design.json` | updated: the Budget layer (documenter) |
| `web/PRODUCT.md` | updated: "Product: Budget (Phase F truth)" + the Budget capability line |
| `docs/apps/Phase0-EcosystemArchitecture.md` | updated: the Phase F supersede note |
| **Created by implementation later (not now):** `web/apps/budget/**`, the server changes (§7), CI/CD (§17), `docs/apps/Budget-PhaseF-Runbook.md` | — |

## 26. Risks, open items, and blocking decisions
- **R1** L-diff 3 (the owner's rule) intentionally changes per-paycheck Left numbers the owner sees today. Acceptance row 4
  makes the differences explicit, so none look like bugs.
- **R2** Recurring bills have no start month (legacy parity), so past months show today's rules. The copy calls
  Budget a plan. A "starts in" field is future scope.
- **R3** A legacy save can still overwrite a newer new-client edit of the **same** entry (legacy is last-write-wins by design).
  It's mitigated by transactions + `rev` for every other case, and it ends when legacy retires.
- **R4** The anchor semantics project weekly/biweekly paydays into the past indefinitely (legacy parity, relabelled honestly).
- **R5** Whether other users (beyond the owner) hold Budget data wasn't queried from production Firestore (the planner does not read
  user financial data). The design is safe either way (no migration). The operator can count `budget` docs if wanted.
- **R6** "Today" updates on load and on tab focus, not at midnight in a continuously open tab (documented; harmless).

**Blocking decisions: none.** Both owner decisions are recorded above. Every contract in §4–§21 is locked for Codex.

---
*No production Budget code has been written. The repo-root platform ("Business Workshop") design world was not modified.*
