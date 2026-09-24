# Phase C — Story Book extraction (`storybook.bakerrang.com`)

> **Status: DESIGN APPROVED (ChatGPT review) + LOCK ROUND APPLIED (§15) — ready for the Codex handoff. No production code written.**
> Author role: Planner / Product-Design / Architecture authority.
> Builds on the **locked** [Phase 0 architecture](Phase0-EcosystemArchitecture.md) (§11 Phase C) and the
> live Milestone-1 foundation ([Launcher runbook](Launcher-Milestone1-Runbook.md)). Nothing here reopens a
> Milestone-1 decision; where Phase C needs an addition to a shared mechanism it is called out explicitly.
>
> Design artifacts (consumer Impeccable world, `web/`):
> - Surface brief + direction contract: [`web/.impeccable/surfaces/storybook.md`](../../web/.impeccable/surfaces/storybook.md)
> - Interactive comp: [`web/.impeccable/mocks/storybook-comp.html`](../../web/.impeccable/mocks/storybook-comp.html)
> - App-icon master (spec): [`web/.impeccable/mocks/storybook-icon.svg`](../../web/.impeccable/mocks/storybook-icon.svg)

Product-owner decisions taken during this phase (2026-09-22): **audience = all ages, general** (not a
children's app); **every generated story auto-saves**; **narration stays cloned-voice-only**; structure
**"The Spread"** locked on the Impeccable decision page.

---

## 1. Current-state inventory (legacy `client/` + `server/`)

### 1.1 Where Story Book lives today

| Layer | Location | Notes |
|---|---|---|
| Route | `client/src/App.jsx` → `/storybook` inside `<MainContent>` shell | Behind legacy `AuthProvider` (redirects to `/login` when anonymous). |
| Page | `client/src/components/StoryBook.jsx` (~580 lines, one component) | All state local (`useState`), no router params, no deep links. |
| Narration | `AudioStreamPlayerSelector.jsx` + `AudioStreamPlayer.jsx` | Voice dropdown → chunked `<audio>` playback. |
| Voices | `providers/AppProvider.jsx` (`GET /text/to/speech/v1/voices` on shell mount) | Shared with Account + Polyglot Instant. |
| Generic deps | `ContentWrapper`, `InputWrapper`, `ConfirmModal`, `LoadingSpinner`, `utils/index.js request()`, `ThemeProvider` | All legacy chrome/glass components. |
| Libraries | `react-markdown` + `remark-gfm` (story text), `uuid` v4 (ids) | |
| Launcher tile | `client/src/components/AppGrid.jsx` (`/storybook`) | Legacy waffle menu. |
| Server: stories | `server/routes/storybook.js` + `services/storybookService.js`, mounted `app.use('/storybook', isAuthenticated, …)` | `GET /`, `POST /`, `DELETE /:id`. **No single-story GET, no PATCH.** |
| Server: generation | `server/routes/chatgpt.js` + `services/chatgptService.js`, mounted `/chat/gpt` (auth) | `GET /prompt/story?prompt=` (gpt-4.1, "Tell me a 3 paragraph story about: …"); `GET /image/prompt?prompt=` (gpt-4.1 writes a "safe prompt … for kids", then dall-e-3 1024², `b64_json`; **returns `''` (200) on any failure**). |
| Server: TTS | `server/routes/textToSpeech.js` + `textToSpeechService.js`, mounted `/text/to/speech` (auth) | `GET /v1/voices` (user's `voices` docs), `GET /v1/convert/:voiceId?prompt=` streams ElevenLabs `eleven_multilingual_v2` mp3; **403 unless the voice belongs to the user** (`userCanAccess`). |
| Data | Firestore `storybooks/{storyId}` (top-level, `userId` field); `voices/{voiceId}` | No Cloud Storage; images live **inside** the story doc as base64 JPEG. |

### 1.2 What a "story" is (verified from code)

```
storybooks/{id} = {
  id: string (client uuid v4),
  userId: string (server-stamped from session on save),
  title: string (user-typed at Save),
  prompt: string (the idea),
  createdAt: ISO string (client clock),
  thumbnail: base64 JPEG (page-1 image, 200px, q0.75) | null,
  pages: [{ reply: string (one paragraph), image: base64 JPEG (400px, q0.82) | null }]
}
```

- Pages = the GPT reply split on `\n`, empty lines dropped → **usually 3**, not guaranteed.
- One illustration per page, generated **in parallel**; the image prompt for page *n* is
  `pages[n-1] + pages[n]` (for page 1 the legacy code sends the literal string `"undefined"` + text — a bug).
- Everything (text + all images + thumbnail) is one Firestore document → bounded by the **1 MiB document limit**.

### 1.3 Flows today

1. **Generate:** type idea → Generate (Enter works) → fake timer progress % while `/prompt/story` then N×`/image/prompt` run → pages shown with numbered pager. Prompt is **not URL-encoded** (`?prompt=${prompt}` — `&`, `#`, `?` break it).
2. **Save (explicit):** Save → modal asks for a title → client compresses images → `POST /storybook`. Unsaved stories are lost on navigation; confirm dialogs guard "New Story" / regenerate.
3. **Library:** collapsible "Saved Stories" strip (horizontal thumbnails), newest first; Open / Rename (modal) / Delete (confirm modal).
4. **Read:** title + "Page n of N", markdown text + sticky illustration, numbered page buttons; no keyboard/swipe; mobile = stacked.
5. **Narrate:** "Narrate ▾" lists the user's cloned voices; text chunked (~220 chars at sentence boundaries) and played sequentially via `<audio src=…/convert/:voice?prompt=…>`; Pause stops. Turning the page does **not** stop audio (it keeps reading the old page).
6. **Rename:** re-POSTs the whole story object with a new title.
7. **Delete:** `DELETE /storybook/:id` (owner-checked; silently no-ops otherwise).

### 1.4 Auth, ownership, sharing, limits

- Every Story Book endpoint requires the central session (`isAuthenticated`); CSRF applies to POST/DELETE.
- Ownership: `userId` on the doc; list filters by `userId`; delete checks it.
- **No sharing, no public stories, no export/download** exist anywhere.
- No per-user limits, quotas, or rate limits on generation (OpenAI/ElevenLabs cost is uncapped per session).
- Story text prompt fixed at "3 paragraph story"; image safety prompt is written "for kids"; DALL·E 1024² square.
- Narration requires a **cloned** voice (created in legacy Account via ElevenLabs). There is **no stock voice**; users without a cloned voice cannot narrate.

### 1.5 Defects / risks found

| # | Finding | Severity | Phase C action |
|---|---|---|---|
| D1 | `saveStorybook` does `doc(story.id).set({...story, userId})` with a **client-supplied id and no ownership check** → any signed-in user who knows/guesses another story's id can **overwrite and take over** that story. | **High (IDOR)** | **Fix server-side, additively** (§5.2). Legacy client unaffected (it always sends fresh uuids or its own ids). |
| D2 | Prompt not URL-encoded in the generation GETs. | Medium | New client uses `encodeURIComponent`. No server change. |
| D3 | Page-1 image prompt prefixed with `"undefined"`. | Low | New client sends `''` for the previous page. |
| D4 | Fake progress timer (not tied to work). | UX | Replaced by real staged progress. |
| D5 | Audio keeps playing the previous page after a page turn. | UX | New client stops narration on page change. |
| D6 | `GET /storybook` returns every story **with every page image** — library payload grows ~150–400 KB per story. | Perf | Additive summary view (§5.2). |
| D7 | No single-story read → no deep links. | Blocks PWA/deep links | Additive `GET /storybook/:id` (§5.2). |
| D8 | Saved images are 400 px wide → slightly soft on a large desktop spread / retina. | Visual | **Accepted, unchanged in Phase C** (lock round): the new client keeps the legacy compression exactly, so documents stay byte-compatible and the summary read stays cheap (§5.7). A higher-resolution image store is a future decision. |
| D9 | Generation endpoints unmetered. | Cost risk (pre-existing) | Flagged; **not** Phase C scope (§11 R5). |

---

## 2. Story Book product truth

**What it does.** A signed-in person types one short idea; Story Book writes a short story (usually three
paragraphs, one per page), generates one illustration per page, keeps the story in their private library,
and can read any page aloud in a voice the person has cloned in their BakerRang account.

**Who it's for.** All ages, general audience (product-owner decision). Grown-ups writing for themselves or
to read with others; not designed for children operating it alone. Image prompts remain kid-safe (server).

**Core jobs.** (1) Turn an idea into a short illustrated story. (2) Read it comfortably on phone or desktop.
(3) Hear a page in a familiar (cloned) voice. (4) Come back to past stories; rename or delete them.

**User-owned data.** `storybooks/{id}` documents with `userId` = the user (title, idea, date, page texts,
page images, thumbnail). Voices (`voices/{id}`) are Account-owned; Story Book only reads them.

**Requires authentication.** Everything except the signed-out welcome page and static assets.

**Public/shared.** Nothing. Stories are private to their owner. (Sharing is not a Phase C capability.)

**AI-dependent.** Story text (OpenAI chat), illustrations (OpenAI DALL·E 3), narration (ElevenLabs).
Library, reading, rename and delete work without AI services.

**Limits that exist.** Story length is set by the server prompt ("3 paragraph story"); pages = non-empty
lines; one square image per page; whole story must fit one Firestore document (1 MiB); narration only with
the user's own cloned voices. No quotas, pricing, or usage caps exist — none are invented here.

---

## 3. Legacy feature classification

**KEEP (behavior must survive)**
- Generate a story from a single idea (same server prompts, same page-splitting rule).
- One illustration per page, generated in parallel; a failed picture doesn't fail the story.
- Private per-user library, newest first; open any story.
- Page-by-page reading with the illustration beside/above its text.
- Read the current page aloud in one of the user's cloned voices; primary voice honored; pause.
- Rename; delete with confirmation.
- Enter-to-submit on the idea field.

**REDESIGN (survives, new form)**
- Library strip → **contents page** (title, first line, pages, date, ⋯ menu; "Stopped at p. N" ribbon).
- Explicit Save + title modal → **auto-save** on completion, title derived from the idea, rename inline.
- "New Story" (clear and start over) → **Begin a new story** (library) / **Write another story** (end of a story), both opening an empty compose page. The legacy discard-confirms are obsolete with auto-save.
- *Not carried:* "Write again from this idea" appeared in the first comp but has **no legacy equivalent** (an opened story hides the idea field, and New Story clears the idea). It was a new capability, so it was **removed** in the lock round (§15.3).
- Fake % progress → **real staged progress** (writing → each page's picture arriving → saving).
- Numbered page buttons → **spread** with edge arrows, keyboard ←/→, swipe, segmented page rule; phone plate-then-text with a bottom page bar.
- Narrate dropdown → **Read aloud** popover with voice choice (remembered per device) and live sentence-group highlighting; no-voices state explains Account.
- Rename/delete modals → inline rename; one destructive dialog.

**DO NOT PORT (legacy implementation detail)**
- Glassmorphism, `ContentWrapper`/`InputWrapper`/`ConfirmModal`/`LoadingSpinner`, `useTheme().isDark` class switching.
- The fake progress interval; the `"undefined"` image-prompt prefix; unencoded query strings.
- `react-markdown` + `remark-gfm` (story text renders as plain paragraphs; see §4.8).
- `AppProvider` global voice fetch on every page load (Story Book fetches voices lazily, on first Read aloud).
- The legacy `request()` util and `SERVER_PREFIX` export (replaced by `@bakerrang/web-api-client`).
- Unsaved-story discard confirms (obsolete with auto-save).
- `uuid` package (use `crypto.randomUUID()`; same v4 format).

**NEEDS HUMAN DECISION** (resolved this phase — recorded, not open): audience (all ages); auto-save (yes);
stock/default voice (no — cloned-only). Remaining open items are in §12.

---

## 4. Migration boundary

### IN for Phase C
1. `web/apps/storybook` (`@bakerrang/web-storybook`) at `storybook.bakerrang.com`, its own PWA + Cloud Run service.
2. Signed-out welcome; Google sign-in via symbolic target `storybook`; deep-link return after login.
3. Library (contents page) incl. empty / loading / error / after-delete states, reading-position ribbon.
4. Compose + generation with real progress, per-page picture arrival, partial-picture failure, write failure, save failure/retry, leave-guard.
5. **Auto-save** of every completed story.
6. Reader (spread / phone single page), page-with-no-picture verso, end-of-story, not-found.
7. Read aloud (cloned voices), highlighting, stop-on-turn, no-voices and error states.
8. Rename (inline) and Delete (confirm).
9. Theme via shared `web-theme` (control in the avatar menu); app switcher + account menu via `web-app-shell`.
10. Additive, backward-compatible backend changes in §5.2 (IDOR fix, single-story GET, summary list, title PATCH).
11. CI/CD, rollback, verify-live, runbook additions (§9). Launcher's Story Book link repointed via build config.

### OUT for Phase C (deferred / stays legacy)
- Removing or redirecting legacy `bakerrang.com/storybook` (happens at Phase F cutover).
- Voice cloning/management UI (stays in legacy Account → Phase E Account app).
- Offline reading, sharing/public links, export/download/print, editing story text, per-page regenerate,
  choosing story length/style, continuous read-aloud across pages, a default house voice.
- Generation rate-limiting/quotas (R5).
- Any Polyglot/Account/other product work; apex cutover.

### REMOVE / DO NOT PORT
Everything in §3 "DO NOT PORT". No data is deleted; the `storybooks` collection is shared by both clients.

---

## 5. Data / API strategy

### 5.1 Compatibility verdict
**No data migration.** Old and new clients read and write the same `storybooks/{id}` shape. Stories saved
by either client render in the other. The new client writes **no new document fields**. All server
changes are additive and keep every existing request/response the legacy client uses byte-compatible.

### 5.2 Backend changes (exact, additive)

All in `server/routes/storybook.js` + `server/services/storybookService.js`, behind the existing
`isAuthenticated` mount; CSRF already covers POST/PATCH/DELETE. `node:test` coverage using the existing
FakeDb harness.

| Change | Contract | Why | Legacy compatibility |
|---|---|---|---|
| **C1 Ownership-safe save** | `POST /storybook` inside a transaction: read `storybooks/{id}`; if it exists with a different `userId` → **404 `{error:'Story not found'}`** (don't reveal existence); else set as today. Validate: `id` string 1..64 `[A-Za-z0-9-]`; `title` string 1..120 after trim; `prompt` string ≤ 1000; `createdAt` string; `thumbnail` string\|null; `pages` array 1..20 of `{reply: string ≤ 5000, image: string\|null}`; unknown top-level fields dropped. Oversize doc (Firestore `INVALID_ARGUMENT` size) → **413 `{error:'Story is too large to save'}`**. | Fixes D1 (IDOR overwrite). | Legacy sends exactly these fields with valid values; unchanged 200 + echo response. |
| **C2 Single-story read** | `GET /storybook/:id` → 200 story (same shape as list items) if `userId` matches, else **404**. | Deep links, PWA reopen, reader refresh (D7). | New route; legacy never calls it. |
| **C3 Summary list** | `GET /storybook?view=summary` → exact contract in **§5.7** (id, title, createdAt, pageCount, excerpt, the existing stored `thumbnail`; no page images). Any other `view` value, or none → the existing full response. | Library payload (D6) without schema change. | Default `GET /storybook` (no `view`) unchanged. |
| **C4 Rename** | `PATCH /storybook/:id` body `{title}` (trimmed 1..120) → owner-checked merge of `title` only → 200 updated summary; 404 if not owner/missing; 400 on invalid. | Rename from the library without downloading pages; avoids re-sending the whole doc. | Legacy keeps re-POSTing (still valid under C1). |

No changes to `/chat/gpt/*` or `/text/to/speech/*`. No new collections, indexes, or Cloud Storage.
`where('userId','==',…)` stays a single-field auto-index; sorting stays client-side (newest first by `createdAt`).

### 5.3 Client data layer (Story Book app)
- `src/api/stories.js` — thin wrappers over the shared `apiClient`: `listStories()` (summary view),
  `getStory(id)`, `saveStory(story)`, `renameStory(id,title)`, `deleteStory(id)`,
  `writeStory(idea, {signal})` (text), `drawPage(prev, text, {signal})` (image, `''` ⇒ no picture),
  `listVoices()`, `narrationUrl(voiceId, text)` (string only — played by `<audio>`).
  All query strings via `encodeURIComponent`.
- **Server state** in a small `StoriesProvider` (React context, no new dependency): summary list cache,
  per-id story cache (LRU of the last ~5 opened, images are large), and mutation helpers that update both
  caches optimistically (rename, delete) and roll back on error. Revalidate the list on focus/visibility
  (mirrors `web-auth`'s visibility pattern) — no polling.
- **Local UI state** stays in components (menus, rename draft, dialog, narration).
- **Per-device conveniences** (localStorage, wrapped in try/catch): `sb.voice` (last voice id),
  `sb.pos.<storyId>` (last page reached, for the ribbon; removed on delete / reaching the last page),
  `sb.return` (sessionStorage — deep link to restore after OAuth).
- 401 from any call → `auth.refresh()`; anonymous → welcome with the path preserved in `sb.return`.

### 5.4 Generation + auto-save orchestration (`useStoryGeneration`)
State machine: `idle → writing → drawing{total, done[]} → saving → saved(id)` with error exits
`writeFailed | saveFailed{story}`.
1. `writeStory(idea)` → split on `\n`, drop empties (identical to legacy). Empty result ⇒ `writeFailed`.
2. Draw all pages in parallel (`Promise.allSettled`), prompt = `(pages[i-1] ?? '') + pages[i]`; each settled
   page updates `done[i]` (real progress). `''`/rejection ⇒ that page has `image: null`.
3. Compress exactly as the legacy client does: each page image → JPEG **max 400 px wide, q0.82**; thumbnail
   → JPEG **200 px wide, q0.75** from **page 1's** image (null if page 1 has no picture — legacy rule). Base64
   without a `data:` prefix, as stored today. (A server 413 still surfaces as a save failure with retry.)
4. Title = the idea, trimmed, first letter capitalised, cut at a word boundary ≤ 80 chars (user renames later).
   `id = crypto.randomUUID()`, `createdAt = new Date().toISOString()`.
5. `saveStory()` → on success seed the story cache and `navigate('/story/:id', {replace:true})` with a
   transient "Saved to your library" note; partial pictures add "· page N has no picture".
   On failure keep the story in memory (`saveFailed`) with **Try saving again**.
6. `beforeunload` guard while `writing | drawing | saving | saveFailed`; an in-app navigation away asks
   for confirmation. Unmount aborts in-flight fetches (server-side work may still complete; nothing is saved).

### 5.5 Narration (`useNarration`)
Same chunking rule as legacy (sentence groups ≤ 220 chars). One `<audio>` element; `src` =
`narrationUrl(voice, chunk)`; `ended` → next chunk; `error` → error state (popover message + retry).
Stops on page change, story change, unmount, or Pause. The current chunk index drives the text highlight
(non-current chunks dim to `--page-dim`). Voices load lazily on first open; default = `sb.voice` if still
present, else `isPrimary`, else first. Audio is **never cached** (no SW route; plain network media).
`<audio>` cross-origin GET works today: same-site cookie + the API's `crossOriginResourcePolicy: cross-origin`.

### 5.6 Story text rendering
Plain text only: each page's `reply` rendered as a paragraph; strip a leading `#`-heading marker and
paired `**`/`*`/`_` emphasis markers before display (legacy GPT output occasionally contains them). No HTML
is ever interpreted. Story text is set in Literata; everything else in Archivo. Self-host exactly the
weights the comp uses (roman 400/500/600, italic 400; opsz axis) and set `font-synthesis: none` on every
serif surface so the browser never fakes a bold italic.

### 5.7 `GET /storybook?view=summary` — locked contract (lock round)

**What exists today (inspected).** Every saved story already carries a `thumbnail`: the legacy client
compresses **page 1's** picture to a **200 px-wide JPEG at q0.75** and stores it as base64 (no `data:` prefix)
beside the pages; it is `null` when page 1 had no picture. Page images are 400 px JPEG q0.82. Both have been
written this way since saving was introduced (commit `b770373`), so no story lacks the field (only `null`
values exist).

**Payload characteristics** (estimated from the stored compression parameters; production documents were
not read): a 200×200 q0.75 illustration is ~9–16 KB → **~12–22 KB base64**; a 400×400 q0.82 page image is
~35–60 KB → ~47–80 KB base64; a typical 3-page story document is therefore **~150–260 KB**. Returning the
stored thumbnail costs **~13–23 KB per story**, roughly **8–12× less** than today's full list (e.g. 50 stories
≈ 1 MB instead of ≈ 10 MB), and it is the same data the legacy library already displays.

**Decision.** Return the **existing stored `thumbnail` field as-is** — no new persistent field, no
migration, no server image processing, and never a fallback to `pages[0].image` (that would reintroduce
full-size images). `null` → the comp's typographic tile (the title's first letter in Literata italic).
The server reads full documents internally to compute `pageCount`/`excerpt`; only the fields below leave
the API. (Pagination is a future concern if a library grows past ~100 stories.)

**Request:** `GET /storybook?view=summary` — same mount (`isAuthenticated`), no body, no CSRF (GET).
Any other or missing `view` → the unchanged legacy full-array response.

**Response 200** — `Cache-Control: no-store`, JSON array sorted by `createdAt` descending (string compare of
the stored ISO value), ties by `id` ascending:

| Field | Type | Rule |
|---|---|---|
| `id` | string | Document `id` field, else the document key. |
| `title` | string | Stored `title` trimmed; empty/missing → `"Untitled story"`. |
| `createdAt` | string | Stored value verbatim (ISO string); missing → `""` (sorts last). |
| `pageCount` | integer ≥ 0 | `pages.length` when `pages` is an array, else `0`. |
| `excerpt` | string | From `pages[0].reply` (strings only): strip a leading `#…` heading marker and `**`/`__`/`*`/`_` emphasis markers, collapse whitespace, take the first sentence (through the first `.`/`!`/`?` plus any closing quote or bracket), cap at 160 chars on a word boundary with `…`. No text → `""`. |
| `thumbnail` | string \| null | Stored `thumbnail` if a non-empty string (base64 JPEG, **no** `data:` prefix), else `null`. |

**Excluded on purpose:** `pages`, page images, `prompt`, `userId`. **Reading position ("Stopped at
p. N") is not server data** — it is the per-device `sb.pos.<storyId>` convenience (§5.3), so it is not part
of this contract. Errors: unchanged `500 {error:'Failed to fetch storybooks'}`.

**Client rendering:** `<img src="data:image/jpeg;base64,{thumbnail}" width="64" height="64" alt=""
loading="lazy" decoding="async">` (decorative — the title sits beside it); `null` → typographic tile.

### 5.8 Story ownership & security contract (Phase C blocker, lock round)

Identity is the session user's **`req.user.id`** (Passport Google profile id, set in `server/app.js`), the
same convention as `vaultService`/`leadService`. The body's `userId` is **never** read; ownership is stored
server-side only. A foreign or missing story is always **`404 {error:'Story not found'}`**, so existence is
never revealed. `storybookService.js` gains the repo's `_setDb` test seam (as in `leadService.js`).

| Operation | Rule |
|---|---|
| `POST /storybook` (create **or** owner update — the legacy save/rename path) | Validate (C1 rules). In one `runTransaction`: read `storybooks/{id}`; **exists and `userId !== req.user.id` → 404, nothing written**; otherwise `set({...validatedFields, userId: req.user.id})`. Unknown fields (including a client-supplied `userId`) are dropped. Response unchanged: 200 + the saved story. |
| `GET /storybook/:id` | Read doc; missing or `userId !== req.user.id` → 404; else 200 story. |
| `PATCH /storybook/:id` `{title}` | Validate title; transaction read → foreign/missing 404 → merge `{title}` only; 200 summary item (§5.7 shape). |
| `DELETE /storybook/:id` | Read → foreign/missing **404, nothing deleted**; own → delete, `200 {success:true}`. (Legacy ignores the status, so moving the foreign/missing case from a silent 200 to 404 is compatible; the new client treats 404 on delete as "already gone".) |
| `GET /storybook` (full or summary) | `where('userId','==',req.user.id)` only — unchanged. |

**Required tests (`node:test` + `test/helpers/fakeDb.js`, users A and B):**
1. B `POST` with A's story id → 404; A's document **deep-equal to before** (title, pages, `userId`).
2. B `POST` with A's id and `userId: A` in the body → still 404, unchanged.
3. A `POST` new id → created with `userId: A`; A `POST` same id with a new title (legacy rename) → updated.
4. A `POST` with body `userId: B` → stored `userId` is A.
5. B `GET /storybook/:id` of A's story → 404; A → 200; unknown id → 404.
6. B `PATCH` A's story → 404, title unchanged; A `PATCH` → 200 + summary shape; invalid title → 400.
7. B `DELETE` A's story → 404 and the document still exists; A `DELETE` → 200 and gone; A `DELETE` again → 404.
8. B's list and summary never include A's stories.
9. Summary shape: no `pages`/`prompt`/`userId`; `null` thumbnail preserved; malformed legacy doc (no pages,
   blank title) → `pageCount 0`, `"Untitled story"`, `excerpt ""`; ordering by `createdAt` desc.
10. Validation 400s (bad id charset/length, empty title, pages not an array / > 20 / reply > 5000) and
    oversize → 413.

**Client fixes carried into Phase C (now contract):** every idea/page text sent in a query string goes
through `encodeURIComponent` (D2); page 1's picture prompt uses `''` for the previous page, never
`"undefined"` (D3); narration stops and releases the `<audio>` source on page change, story change, route
change and unmount (D5). Each has a unit test (`writeStory`/`drawPage` URL building with `&`, `#`, `?`,
non-ASCII; page-1 prompt; `useNarration` stop on page/story change).

---

## 6. Target app architecture — `web/apps/storybook`

```
web/apps/storybook/
  package.json            @bakerrang/web-storybook  (deps: web-* packages, react, react-dom, react-router-dom 6)
  index.html              theme boot (same plugin as Launcher), two theme-color metas, title "Story Book — BakerRang"
  vite.config.js          app-local VitePWA config (§7) + theme boot; dev port 3010
  tailwind.config.cjs / postcss.config.cjs   (mirrors Launcher; web-tokens preset)
  ASSETS.md               provenance: logo copy, icon set from storybook-icon.svg, Literata OFL
  public/                 favicon.ico, favicon-16/32, apple-touch-icon, android-chrome-192/512 (Story Book set)
  src/
    main.jsx              registerSW, CSS imports, <AppProviders><App/></AppProviders>
    providers.jsx         apiClient, AuthProvider(oauthTarget 'storybook'), ThemeBridge, StoriesProvider
    App.jsx               router + auth gate + chrome selection
    fonts/Literata-*.woff2 + OFL.txt   (roman 400/500/600, italic 400; opsz variable subset)
    styles/storybook.css  reading-layer tokens (--page, --page-ink…, light/dark) + page/spread styles
    api/stories.js
    state/StoriesProvider.jsx, useStoryGeneration.js, useNarration.js, readingPosition.js
    chrome/StoryBookBar.jsx (library/compose), ReadingBar.jsx, PageBar.jsx (phone)
    library/LibraryPage.jsx, ContentsEntry.jsx, StoryMenu.jsx, RenameField.jsx
    compose/ComposePage.jsx, IdeaField.jsx, GenerationSteps.jsx, PictureSlots.jsx
    reader/ReaderPage.jsx, Spread.jsx, Plate.jsx, StoryText.jsx, PageRule.jsx, ReadAloud.jsx, EndOfStory.jsx
    common/ConfirmDialog.jsx, Welcome.jsx, NotFound.jsx, Offline.jsx
    text.js               splitPages, deriveTitle, cleanStoryText, chunkText (pure, unit-tested)
```

### 6.1 Routes
| Path | Auth | Surface |
|---|---|---|
| `/` | anon → **Welcome**; authed → **Library** | Contents page. |
| `/new` | authed | Compose + generation (always starts empty). |
| `/story/:id` and `/story/:id/:page` | authed | Reader; page 1-based, default 1; out-of-range → clamp + `replace`. Unknown/foreign id → Not found. |
| `*` | any | Not found (links to `/`). |

Auth gate: `LOADING` → quiet desk (no spinner flash for < 300 ms); `ANONYMOUS` on a protected path → store
the path in `sb.return`, render Welcome; after sign-in `/` restores `sb.return` once. OAuth still returns to
the symbolic `STORYBOOK_DOMAIN` root — no server return-to change.

### 6.2 Surfaces (as comped)
- **Library** — one contents "leaf" (page plane) on the desk, max ~860 px: Literata "Stories" + count; single
  gold **Begin a new story**; ordered entries (thumb 64 · title · dotted leader · meta · first line · ⋯).
  Phone: leaf goes full-bleed, meta under title, first line hidden, gold action becomes a fixed bottom bar.
- **Compose** — spread: verso = picture slots (idle emblem → per-page slots filling as pictures land);
  recto = "What's the story about?", serif textarea (max 300 chars, Enter submits, Shift+Enter newline),
  one-line promise, gold **Write the story**, Cancel. Generating: idea echoed as a quotation + three honest
  steps (Writing / Drawing n of N / Saving). Phone: single column, slots above steps, sticky action.
- **Reader** — 56 px reading bar (← Stories · italic running title · Read aloud · ⋯ · switcher · avatar);
  spread height-fitted (~1.42:1, ≤ 820 px), verso plate square + folio, recto Literata ~17–21.5 px on the
  page measure, running heads, page-1 title + date line, **The end** + Write another / Back on the last page.
  Edge arrows, ←/→ keys, segmented page rule. Phone (< 1000 px): plate full-width, text below, bar hides on
  scroll-down, fixed bottom page bar (‹ n/N › · Read aloud) inside safe areas; swipe to turn.
- **Manage** — ⋯ menu (Rename · Delete story). Rename inline (library row or
  reading bar). Delete = the only dialog ("Keep it" default focus / "Delete story" danger); after delete →
  library with a dismissible status line. No undo (server hard-deletes).

### 6.3 Chrome (ecosystem integration)
- **Brand:** pixel-B mark (links to the Launcher — "all tools") + hairline + **Story Book** in Archivo
  Expanded (links to `/`). Mark alone ≤ 430 px (wordmark rule from DESIGN.md).
- **App switcher** (shared) with Story Book marked current and an **All tools — Launcher** item.
- **Account menu** (shared) with the **theme segmented control inside it** (quieter than the Launcher's
  top-bar control), Account link (legacy `bakerrang.com/account` until Phase E), Sign out.
- Reader hides switcher/Read-aloud text on phone; nothing permanent except the bottom page bar.

### 6.4 Loading / error / offline patterns
Skeleton contents rows (breathing opacity, none under reduced-motion); errors name problem + recovery,
never lose user input; `navigator.onLine === false` → Offline notice ("Your stories need a connection");
generation disabled offline. Every async surface has an `aria-live="polite"` status.

### 6.5 Cross-app destination registry (coexistence contract, lock round)

**One registry, already in place.** `@bakerrang/web-app-shell` exports `TOOL_DEFINITIONS`,
`ACCOUNT_DEFINITION` and `resolveDestinations(env)`; the Launcher already renders every row, the
switcher, the vault and the Account entry from it. Phase C keeps that function and file as the single
source of truth and extends the entries — no new config system:

```js
// web/packages/web-app-shell — the only place product URLs live
{ id, name, shortName, accent, envKey, legacyPath, liveUrl }
// url = env[envKey]                    // local dev / test override only
//    ?? liveUrl                         // set once a product is extracted and live
//    ?? `${legacyBase}${legacyPath}`    // legacyBase = env.VITE_LEGACY_CLIENT_BASE_URL ?? 'https://bakerrang.com'
```

Phase C values (legacy paths verified in `client/src/App.jsx`):

| id | Destination during Phase C | `legacyPath` | `liveUrl` | `envKey` |
|---|---|---|---|---|
| `launcher` (new entry) | `https://launch.bakerrang.com` | — | `https://launch.bakerrang.com` | `VITE_LAUNCHER_URL` |
| `storybook` | `https://storybook.bakerrang.com` (after the flip; legacy until then) | `/storybook` | `https://storybook.bakerrang.com` (set by the flip PR) | `VITE_STORYBOOK_URL` |
| `polyglot` | `https://bakerrang.com/polyglot` (Instant: `…/polyglot/instant`) | `/polyglot` | `null` | `VITE_POLYGLOT_URL` |
| `sign` | `https://bakerrang.com/sign-language` | `/sign-language` | `null` | `VITE_SIGN_URL` |
| `budget` | `https://bakerrang.com/budget` | `/budget` | `null` | `VITE_BUDGET_URL` |
| `wow` | `https://bakerrang.com/wow` | `/wow` | `null` | `VITE_WOW_URL` |
| `passwords` | `https://bakerrang.com/passwords` | `/passwords` | `null` | `VITE_PASSWORDS_URL` |
| `account` | `https://bakerrang.com/account` | `/account` | `null` | `VITE_ACCOUNT_URL` |

- **Behavior:** every switcher cell, Launcher row and Account link navigates **directly** to the resolved
  destination; nothing bounces through the Launcher. The Launcher is reached only from the pixel-B brand
  mark and the switcher's "All tools" item. The current app's own cell is marked current and links to its
  root. Polyglot Instant stays `${polyglot.url}/instant` (valid for both the legacy and future origins).
- **No drift:** both apps call the same `resolveDestinations(import.meta.env)`, and production builds pass
  **no** destination `VITE_*_URL` values (the workflows pass only `VITE_API_BASE_URL`/`VITE_OAUTH_TARGET`;
  a deployment-workflow test asserts it). Changing a destination is a code change to the shared package,
  which the classifier fans out to **every** web app, so the Launcher and Story Book always ship the same map.
- **Extraction procedure (every future product):** land the app → verify it live → one PR setting its
  `liveUrl` (fans out, redeploys all web apps). Story Book's flip is that separate PR after its runbook
  verification, so no build points at a subdomain that isn't serving yet.
- **Tests:** table test of `resolveDestinations` (defaults = the table above; env override; legacy-base
  override; `liveUrl` precedence); a Launcher test asserts rendered hrefs come from the registry.

---

## 7. PWA contract (app-local `vite.config.js`)

```js
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico','favicon-16x16.png','favicon-32x32.png','apple-touch-icon.png',
                  'android-chrome-192x192.png','android-chrome-512x512.png'],
  manifest: {
    id: '/', name: 'Story Book — BakerRang', short_name: 'Story Book',
    description: 'Write a short illustrated story from one idea, then read it here or aloud.',
    start_url: '/', scope: '/', display: 'standalone',
    theme_color: '#161514', background_color: '#161514',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{html,css,js,woff2,png,ico,webmanifest}'],
    navigateFallback: 'index.html',
    runtimeCaching: []          // no API, image, audio, or generated-content caching
  }
})
```
- Separate origin ⇒ separate install identity (Phase 0 §5). `index.html` carries
  `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#161514">` and a light
  (`#e6e1d8`) twin; the app updates the tag on resolved-theme change.
- **Icons:** a Story Book set rasterised from `web/.impeccable/mocks/storybook-icon.svg` (Story Ember open
  book on the charcoal tile; the badge is the **canonical `bakerrang-logo.png`** embedded as an image —
  byte-identical to `client/src/assets/bakerrang-logo.png`, SHA-256 `566f5419…0ea84a21` — composited, never
  redrawn). Maskable safe zone respected. Provenance recorded in `apps/storybook/ASSETS.md`.
- **Caching:** shell-only precache (Phase 0 §5.1). Stories, images (inline in JSON), narration audio,
  voices, and account data are never cached. **Offline reading is a future product decision** (it would
  mean caching private stories on device — needs an explicit opt-in design), not built.
- Compared with the Launcher block: identical *shape*, different identity values. Per Phase 0 §5 the
  graduation rule is evaluated now: the only shared parts are 4 Workbox lines — **not** enough to justify a
  `web-pwa-config` package. Keep app-local.

---

## 8. Auth / CORS / OAuth / environment

| Where | Addition |
|---|---|
| `server/config/oauthTargets.js` | `storybook: 'STORYBOOK_DOMAIN'` in `TARGET_ENV_KEYS` (+ test). |
| `server/config/origins.js` | `env.STORYBOOK_DOMAIN` in `buildAllowedOrigins` (+ test). |
| API Cloud Run env | `STORYBOOK_DOMAIN=https://storybook.bakerrang.com` (operator, `--update-env-vars`). |
| Story Book build args | `VITE_API_BASE_URL` (existing Environment var), `VITE_OAUTH_TARGET=storybook` (workflow constant). **No per-product destination build args** — destinations come from the shared registry (§6.5). |
| `web/Dockerfile` | `COPY apps/storybook/package.json …` in the deps stage. No new `ARG`s. |
| Local dev | `npm run dev:storybook` → port **3010**; API `CLIENT`-style localhost origin added via the existing dev env (`STORYBOOK_DOMAIN=http://localhost:3010`). |

Unchanged: central host-only `connect.sid` on `api.bakerrang.com` (SameSite=Lax, HttpOnly), CSRF
double-submit via `web-api-client`, POST logout, `br_theme` cookie, `/account/preferences`. No new Google
redirect URI (the `?target=` model).

---

## 9. CI/CD, deploy, rollback (extend Milestone-1 mechanisms)

| Mechanism | Change |
|---|---|
| `scripts/ci/classify-changes.mjs` | `ALL_WEB_SERVICES = ['web-launcher','web-storybook']`; rule `web/apps/storybook/ → ci+deploy [web-storybook]`; outputs `web_storybook`, `deploy_web_storybook`. Shared-package/root rules already fan out via `ALL_WEB_SERVICES`. Fails closed as before. |
| `.github/workflows/ci.yml` | `web-storybook` job mirroring the Launcher job: `npm ci`, lint, test, `npm run build -w @bakerrang/web-storybook`, Docker packaging validation `--build-arg APP=storybook --build-arg VITE_OAUTH_TARGET=storybook`; add to `ci-passed`. |
| `.github/workflows/deploy.yml` | `validate-web` runs if either web deploy flag is true and builds each affected app; new `deploy-web-storybook` job (same reusable workflow, `service: web-storybook`); add to `live-deploy-passed` result checks; add `web-storybook` to the `workflow_dispatch` service list. |
| `_deploy-cloud-run.yml` | `web-storybook)` case: `service_name=$WEB_STORYBOOK_SERVICE`, `image_name=web-storybook`, smoke `${STORYBOOK_BASE_URL%/}/`; docker build `APP=storybook`, `VITE_OAUTH_TARGET=storybook`; SPA-shell assertion list gains `web-storybook`. No destination build args (§6.5). Stale-deploy guard, write-once `git-<sha>` image, digest pin, runtime-SA assertion reused unchanged. |
| `rollback.yml` / `scripts/ci/rollback.ps1` | Add `web-storybook` to the choice list + allowlist; map `@{ Path='/'; Public='https://storybook.bakerrang.com/'; Assertion='ClientRoot' }`. |
| `verify-live.yml` | `check_endpoint storybook https://storybook.bakerrang.com/ client-root`. |
| Tests | `classify-changes.test.mjs` (storybook-only change → only web-storybook; `web/packages/**` → both; Dockerfile → both), `deployment-workflows.test.mjs` (new job wiring/aggregates), `rollback.test.ps1`, `verify-live.test.ps1`. |
| GitHub `production` Environment | `WEB_STORYBOOK_SERVICE=bakerrang-web-storybook`, `STORYBOOK_BASE_URL=https://storybook.bakerrang.com`. |

**Runbook** (new `docs/apps/StoryBook-PhaseC-Runbook.md`, cloned from the Launcher runbook): bootstrap
`bakerrang-web-storybook` (runtime SA `bakerrang-frontend@`), service-scoped `roles/run.developer` for the
deployer SA, Environment vars, API `STORYBOOK_DOMAIN`, domain mapping + DNS record for
`storybook.bakerrang.com` (never touching apex), deploy + public smoke, then **only after Story Book is live and
verified**, merge the separate one-line registry PR that flips `storybook` to its subdomain (§6.5) — a
`web/packages/**` change, so the classifier redeploys the Launcher and Story Book together. Rollback via the
standard MAIN rollback flow.

---

## 10. Coexistence (Phase C)

| Entry | Behavior |
|---|---|
| New Launcher (`launch.bakerrang.com`) | Once the registry flip (§6.5) is deployed, the Story Book row and switcher cell open `storybook.bakerrang.com`. Before that, they keep opening legacy `https://bakerrang.com/storybook`. |
| Legacy apex `bakerrang.com/storybook` | **Unchanged and fully working** (same data). No banner/redirect in Phase C; redirect map lands at Phase F. |
| Existing bookmarks | Legacy bookmarks keep working. New bookmarks (`/story/:id/:page`) deep-link into the new app (anon → welcome → sign in → returns to the story). |
| Installed Story Book PWA | Opens `/` (library) standalone; shell cold-launches offline; data requires network. |
| Data | Shared `storybooks` collection; a story made/renamed/deleted in one client appears in the other on next load. |

The legacy `/storybook` route is removed only at the approved Phase F/G retirement point.

---

## 11. Shared-package impact (graduation rule applied)

| Package | Phase C change | Justification |
|---|---|---|
| `web-app-shell` | **Refactor into composable exports** — `BrandLink`, `AppSwitcher({current, launcherUrl})`, `AccountMenu({themeControl: 'inline'})`, keeping `AppHeader` as the Launcher's composition so the Launcher renders unchanged. The existing `TOOL_DEFINITIONS`/`resolveDestinations` becomes the **single destination registry** (§6.5), gaining `launcher` and a per-product `liveUrl`. | Second app needs the **same** switcher + account menu rendered the same way, but not the Launcher's header layout. Launcher regression-tested. |
| `web-ui` | Add non-visual **`useDismiss`** (outside-pointer + Escape close) extracted from the shell's private `usePopover`. | Used identically by shell menus and Story Book menus/popovers (≥ 2 consumers, behavior not look). |
| `web-tokens`, `web-theme`, `web-auth`, `web-api-client` | **No change.** | Reused as-is. |
| Stays in `apps/storybook` | Literata + reading tokens, contents entry, spread/plate/folio, compose/steps/slots, Read aloud, story menu, rename field, **ConfirmDialog**, page bar. | Product-specific. `ConfirmDialog` is a **candidate** for `web-ui` when Passwords/Account need the same dialog — not before. |

---

## 12. Risks, open items, and decisions still needed

- **R1 IDOR (D1)** — must ship with Phase C (server C1) regardless of client timing; it is live today.
- **R2 Document size** — unchanged from legacy (same compression); an oversize save maps to 413 and a retryable save failure.
- **R3 Title quality** — auto-titles are the idea text; comp sample titles depict stories the user renamed.
  (A generated title would need a new server prompt — not proposed.)
- **R4 Generation abandonment** — leaving mid-generation spends API cost with no result; mitigated by the
  leave-guard, not prevented.
- **R5 Unmetered generation** (pre-existing) — recommend a separate hardening step (per-user limiter on
  `/chat/gpt/*`), out of Phase C scope.
- **R6 Voice setup lives in legacy Account** until Phase E; the no-voices link points there.
- **R7 Kid-safe image prompt vs all-ages audience** — server prompt unchanged; content safety stays conservative.
- **Human decisions:** none open. App icon confirmed as the canonical-logo composition (§15.4); no legacy
  banner/redirect during Phase C (approved).

## 13. Acceptance criteria

1. `storybook.bakerrang.com` serves the app over HTTPS; SPA shell smoke passes; non-root routes return the shell.
2. Anonymous visitor sees Welcome; sign-in via `?target=storybook` returns to Story Book; a deep link survives sign-in.
3. Already-signed-in user (from Launcher/legacy) lands authenticated with no prompt.
4. Library lists the same stories as legacy (incl. legacy-saved stories), newest first; empty/loading/error states match the comp.
5. Generate → real progress → story auto-saved → reader opens page 1; the new story appears in legacy `/storybook` too.
6. A picture failure yields a saved story with a typographic verso for that page; a text failure saves nothing and keeps the idea; a save failure offers retry and guards leaving.
7. Reader: spread ≥ 1000 px, single page below; ←/→, edge arrows, page rule, swipe all turn pages; page is in the URL.
8. Read aloud plays the current page in the chosen cloned voice with highlighting, stops on page turn; no-voices and error states as comped.
9. Rename (inline) and Delete (confirm) work from library and reader; changes visible in legacy.
10. `POST /storybook` with another user's id → 404, document unchanged (test); legacy save/rename still 200.
11. Light/dark/system correct with no flash; theme change persists via `/account/preferences`.
12. Installable as **Story Book** with its own icon; SW precaches shell only; no API/audio/image runtime cache.
13. A Story-Book-only change deploys only `web-storybook`; a `web/packages/**` change deploys both web apps; rollback and verify-live cover `web-storybook`.
14. After the registry flip (§6.5), the Launcher and Story Book both open `storybook.bakerrang.com`; every unextracted tool opens its legacy route directly from both apps; the Launcher otherwise renders unchanged.
15. Apex `bakerrang.com` untouched; legacy Story Book still works.

## 14. Testing strategy

- **Server (`node:test` + FakeDb):** C1 ownership (foreign id → 404 unchanged; own id → update; new id → create),
  validation 400s, 413 mapping; all §5.8 cross-user cases; C2 owner/foreign/missing; C3 summary shape per §5.7 (no images, excerpt/pageCount,
  legacy docs); C4 rename owner/foreign/invalid; legacy full `GET` unchanged; OAuth target + CORS origin tests.
- **Registry:** `resolveDestinations` table/override tests; no destination `VITE_*_URL` in deploy workflows (§6.5).
- **Pure units (Vitest):** `splitPages`, `deriveTitle`, `cleanStoryText`, `chunkText` (parity with legacy),
  image-size guard step-down, reading-position store (storage throwing).
- **Hooks (Vitest + fake fetch/timers):** `useStoryGeneration` transitions incl. partial image failure, write
  failure, save failure + retry, abort on unmount; `useNarration` chunk sequencing, stop on page change,
  audio error; `StoriesProvider` optimistic rename/delete rollback.
- **Components (Testing Library, behavior not snapshots):** auth gate (loading/anon/authed + `sb.return`),
  library states + menu actions, compose submit (Enter/Shift+Enter/disabled), reader navigation (keys,
  buttons, clamp), delete dialog focus/Escape, no-voices popover, theme control in account menu.
- **Shell regression:** Launcher `Launcher.test.jsx` still green after the `web-app-shell` refactor.
- **Config:** PWA manifest identity/`runtimeCaching: []` assertion (import the config); classifier,
  deployment-workflow, rollback, verify-live tests.
- **Manual:** phone install (iOS + Android), safe-area bottom bar, swipe, narration on mobile, both themes,
  cross-client data check with legacy, selective deploy proof.

## 15. Lock round (post-review, 2026-09-22)

1. **Destinations:** one shared registry in `web-app-shell` (§6.5); unextracted tools open their live
   legacy routes directly; Story Book flips to its subdomain by a one-line `liveUrl` PR after go-live.
   Replaces the earlier per-app `VITE_*_URL` build-arg proposal (removed from §8/§9). Comp switcher updated.
2. **Summary endpoint:** exact contract in §5.7; thumbnail = the existing stored 200 px `thumbnail`
   (~12–22 KB base64) returned as-is, `null` → typographic tile. Image compression stays legacy (D8 accepted).
3. **"Write again from this idea":** not a legacy capability (the idea field is hidden while a story is
   open and "New Story" clears it), so it was new scope and is **removed** from the comp, the brief and this
   document. "Begin a new story" / "Write another story" (legacy "New Story") remain.
4. **App icon:** the badge in `storybook-icon.svg` is the canonical `bakerrang-logo.png` embedded as an
   image (SHA-256 identical to `client/src/assets/bakerrang-logo.png`), not a redrawn pixel-B.
   Concept unchanged.
5. **Security:** ownership contract + mandatory cross-user tests in §5.8; the D2/D3/D5 fixes are contract.

---
*No production Story Book code has been written. The repo-root platform ("Business Workshop") design world
was not modified.*
