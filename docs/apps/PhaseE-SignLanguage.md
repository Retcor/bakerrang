# Phase E — Sign Language extraction (`sign.bakerrang.com`)

> **Status: PLAN — design locked by the product owner, Impeccable finish verdict *ship* (§7a). Awaiting ChatGPT review.
> No production code written.**
> Author role: Planner / Product-Design / Architecture authority.
> Builds on the locked [Phase 0 architecture](Phase0-EcosystemArchitecture.md) and the Phase C/D template
> ([Story Book](PhaseC-StoryBook.md), [Polyglot](PhaseD-Polyglot.md), [Polyglot runbook](Polyglot-PhaseD-Runbook.md)).
> Nothing here reopens an earlier phase's decision. Where Phase E changes a shared mechanism, it says so.
>
> Design artifacts (consumer Impeccable world, `web/`):
> - Surface brief + direction contract: [`web/.impeccable/surfaces/sign.md`](../../web/.impeccable/surfaces/sign.md)
> - Interactive comp: [`web/.impeccable/mocks/sign-comp.html`](../../web/.impeccable/mocks/sign-comp.html)
> - App-icon master (spec): [`web/.impeccable/mocks/sign-icon.svg`](../../web/.impeccable/mocks/sign-icon.svg)

**Product-owner decisions (input to this phase, 2026-09-25):**
1. **Practice + reader.** Sign is an honest ASL *handshape practice* tool, not an interpreter. The camera
   reads your handshape. A reference of the handshapes it can read lets you pick one to practise, and
   Sign confirms when you hold it.
2. **Reading at the hand + a large readout.** The label stays drawn at the hand (the owner's 2026-03-28 call
   when the transcript box was removed). The same *steadied* reading is also shown as large real text and
   announced politely. There is **no running transcript/tape**.
3. **ASL-true set.** Letters, `1`, and `I love you` are kept. The open palm is relabelled **`5`**.
   ThumbsUp/ThumbsDown are retired (they are not ASL signs).
4. **Sign-in required**, like Story Book and Polyglot: signed-out visitors see a Welcome with Sign in.
5. **Structure:** see §7 (locked on the Impeccable decision page).

---

## 1. Legacy inventory (repository truth)

### 1.1 Where it lives

| Layer | Truth |
|---|---|
| Route | `/sign-language` → `<SignLanguage />` (`client/src/App.jsx:34`), inside the legacy `MainContent` shell. |
| Page | `client/src/components/SignLanguage.jsx` (299 lines). |
| Recognizer data | `client/src/utils/aslGestures.js` (226 lines): `fingerpose` `GestureDescription`s. |
| Launcher tile | `client/src/components/AppGrid.jsx:41-49` "Sign" → `/sign-language` (Heroicons "hand-raised" path). |
| Shared registry | `web/packages/web-app-shell/src/index.jsx:10`: `{ id: 'sign', name: 'Sign Language', shortName: 'Sign', accent: 'var(--accent-sign)', legacyPath: '/sign-language', liveUrl: null, envKey: 'VITE_SIGN_URL' }`. The `sign` ProductEmblem is the same Heroicons path, scaled. |
| Client deps | `@mediapipe/tasks-vision ^0.10.34` (installed **0.10.34**), `fingerpose ^0.1.0` (MIT; built for TF.js handpose). Only Sign uses them. |
| Server | `server/routes/signLanguage.js`, mounted `app.use('/sign-language', isAuthenticated, signLanguageRouter)` (`server/app.js:122`). **Dead** (see 1.5). |
| History | `cc1a954` (2026-03-25): first version, which posted camera frames to GPT-4.1 vision and kept a transcript box. `8502bbf` (2026-03-28): rewritten to on-device MediaPipe + fingerpose. The transcript box was removed: "better just to have the interpretation shown in the video itself around the hand." `71e63b8`/`d75e784`: restyles only. |

### 1.2 What it actually does (the real use case)

**Signed input → a label drawn on the video.** Nothing else. The flow:

1. **Start Camera** loads MediaPipe from **third-party CDNs at runtime**: the WASM fileset from
   `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm` and the model
   `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
   (7,819,105 bytes, SHA-256 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`, verified 2026-09-25).
   It creates `HandLandmarker` with `delegate: 'GPU'`, `runningMode: 'VIDEO'`, `numHands: 2`.
2. `getUserMedia({ video: true })` (no facing mode, no resolution) → `<video>` in a 16:9 `object-cover` box.
3. A `requestAnimationFrame` loop runs `detectForVideo` every frame and takes **only `landmarks[0]`**. It
   draws the skeleton, a bounding box and a 22px canvas label above the hand in hard-coded lime/green/amber.
4. It classifies with `fingerpose.GestureEstimator(allGestures).estimate(landmarks, 8)` on **normalized** `[x,y,z]`
   and takes the top score. Two trajectory heuristics override it: **J** (pinky moves down > 0.08 and sideways > 0.05
   over 20 frames while in `I` or no pose) and **Z** (index right → down-left → right over 24 frames while in `1`
   or no pose).
5. **Stop Camera** cancels the loop and stops the tracks.

**Recognition set (20 descriptions + 2 motions):** `I Love You`, `ThumbsUp`, `ThumbsDown`, `Hello` (all five fingers
extended), and the letters **A B C E F G H I K L O V W X Y**, the number **1**, plus motion **J** and **Z**.
**Not recognized: D, M, N, P, Q, R, S, T, U.** There is one hand, American Sign Language only, and no
words or sentences.

**So the product is:** a camera handshape reader with partial fingerspelling-alphabet coverage. It is
presented as an "ASL Interpreter" ("A–Z + Signs", "recognized instantly"). That claim is false. It
cannot spell most English words, and it reads static handshapes, not signs in context. PRODUCT.md
already describes it truthfully as "sign practice via camera". The honest scene is **a hearing person
learning the ASL manual alphabet who wants feedback on their handshape**. The phase makes no claim
about Deaf/Hard-of-Hearing users' needs beyond that: Sign does not interpret for or between people.

### 1.3 Inventory table (the 16 requested dimensions)

| # | Dimension | Legacy truth |
|---|---|---|
| 1 | Routes | `/sign-language` only. No sub-routes, no deep-linkable state. |
| 2 | Components | `SignLanguage.jsx` (page, camera, loop, drawing), `ContentWrapper` (title), `useTheme` (colors). No sub-components. |
| 3 | APIs | **None called.** The page makes zero requests to `api.bakerrang.com` (beyond the legacy shell's auth/voices fetches). `POST /sign-language/interpret` exists but has had no caller since `8502bbf`. |
| 4 | Providers/models | MediaPipe HandLandmarker float16 v1 (Google, Apache-2.0) via jsdelivr + GCS. `fingerpose` 0.1.0 heuristics. Dead server path: OpenAI `gpt-4.1` vision. |
| 5 | Media flow | Camera → `<video>` → `detectForVideo` in WASM/GPU in the tab → landmarks → canvas. **No frame, image or landmark leaves the browser.** The only network traffic is the runtime CDN fetch of the WASM and model (no user content in it). |
| 6 | User state | Component refs: stream, landmarker, estimator, rAF id, `currentSignRef` (written every frame and **never read**), 30-frame trajectory. `isActive`, `status` (`idle`/`loading`/`ready`), `error`. |
| 7 | Persisted data | **None.** No Firestore collection, no server data, nothing to migrate. |
| 8 | Authentication | Required only because the whole legacy SPA redirects anonymous users to `/login` (`client/src/providers/AuthProvider.jsx`). The feature itself needs no identity. |
| 9 | Local/browser storage | None (the theme is the legacy ThemeProvider's). |
| 10 | Settings/preferences | None. There is no camera choice, mirror toggle, hand choice or sensitivity setting. |
| 11 | Mobile behavior | A 16:9 box with `object-cover` on portrait cameras crops heavily. The canvas label is 22 **canvas** px, which is ~6 CSS px on a 360px-wide phone showing a 1280px frame (illegible). No `facingMode`. The 3-column stat grid squeezes. |
| 12 | Keyboard behavior | Start/Stop are real `<button>`s. There is nothing else to operate. No live region, no text output, no focus management. |
| 13 | Design structure | Glass hero card (icon tile, "ASL Interpreter" title, 3-stat grid "ASL / Instant / A–Z + Signs"), then a glass camera card (video, status dot, Start/Stop, error box). Retired lime/green accents. |
| 14 | Legacy bugs | §1.4. |
| 15 | Dead/unused | `POST /sign-language/interpret` + `server/routes/signLanguage.js`. `currentSignRef` (never read). `numHands: 2` (second hand ignored). ThumbsUp/ThumbsDown (not ASL). |
| 16 | Dependencies on other apps | None. There is no shared data with Account, voices or other tools. Only the legacy AppGrid tile, the shared registry entry and the launcher row point at it. |

### 1.4 Defects and debt — do NOT reproduce

| # | Finding | Where | Phase E action |
|---|---|---|---|
| S1 | **Overclaim.** "Sign Language Interpreter" / "ASL Interpreter" / "A–Z + Signs" / "recognized instantly". Nine letters can't be read, and nothing is interpreted. | `SignLanguage.jsx:215-238` | Honest naming and coverage copy (§3, §7). Never "interpreter", "translate" or "A–Z". |
| S2 | **Output is canvas pixels only.** No DOM text and no live region, so screen readers, magnifiers and anyone too far from a small label get nothing. The status says "Ready — sign to begin" forever. | `:117-124` | Large DOM readout + polite live region on *steadied* readings (§12). The canvas label stays (owner decision 2). |
| S3 | **Version skew + third-party runtime loads.** The JS is pinned at 0.10.34, but the WASM loads from `tasks-vision@latest`, which jsdelivr **resolves to 1.0.1 today** (verified 2026-09-25, `x-jsd-version: 1.0.1`). A major-version WASM under a 0.10 JS loader can break the page without any deploy. Each start also discloses the visitor's IP/UA to jsdelivr and Google Cloud Storage. | `:153-160` | Self-host an **exactly pinned** WASM (0.10.34) + the model (SHA-verified) under the app's own origin (§5.4). Live acceptance re-checks the legacy page (§19). |
| S4 | `delegate: 'GPU'` with no fallback: devices without usable WebGL2 fail with a raw error. | `:158` | Try GPU, then fall back to CPU once (§5.5). |
| S5 | **Leaked camera on navigation.** If the user leaves while the model loads or the permission prompt is open, `getUserMedia` resolves after unmount cleanup already ran. The stream is never stopped (the OS camera light stays on), and `videoRef.current` is `null` → TypeError. | `:147-176, :192-197` | A start token/abort guard: a stream that arrives after cancel/unmount is stopped immediately (§13). |
| S6 | The camera keeps running in background tabs (no `visibilitychange`/`pagehide` handling). | — | Stop the tracks when hidden; resume only on a tap (§8, §13). |
| S7 | **Overlay misalignment.** The video uses `object-cover` in a 16:9 box while the canvas stretches (`fill`) to the same box. On 4:3 webcams or portrait phone cameras, the skeleton and label drift from the hand. | `:245-246` | The plate takes the track's real aspect ratio. Video and canvas share one box with no crop (§11). |
| S8 | **Not mirrored.** The preview is the camera's view, not a mirror, so a learner copying a handshape sees it reversed. | `:245` | Mirrored preview; overlay coordinates mirrored in code, text never mirrored (§5.5). |
| S9 | The label is illegible on phones (22 canvas px, S2). The label/box are clipped when the hand is near the top edge. | `:117-123` | The canvas label is sized in CSS px relative to the displayed plate and clamped inside the plate (§11). |
| S10 | **Per-frame flicker.** The label changes on every frame, with no stabilization. | `:103-114` | A reading commits only after 400 ms stable (§5.5). |
| S11 | **Aspect-distorted classification.** fingerpose computes finger angles, but receives normalized `[x,y]` (0–1 on both axes) from a 16:9 frame, which squashes horizontal angles. | `:104` | Scale to pixel space (`x·videoWidth, y·videoHeight, z·videoWidth`) before `estimate` (§5.5). |
| S12 | `numHands: 2` but only `landmarks[0]` is used, so which hand is read is arbitrary when two are in view. | `:160` | `numHands: 1` (§5.5). |
| S13 | Non-ASL `ThumbsUp`/`ThumbsDown`. The open palm is labelled "Hello" (the ASL sign HELLO moves; a still open hand is the **5** handshape). | `aslGestures.js` | ASL-true set (decision 3, §3). |
| S14 | Raw `err.message` shown ("Permission denied", WASM errors). There's no difference between denied, no camera, camera busy and insecure context. | `:173` | Mapped permission/device states with a way forward (§14). |
| S15 | `detectForVideo` exceptions are swallowed on every frame. A permanently failed model shows "Ready — sign to begin" with nothing happening. | `:79-83` | 30 consecutive frame failures → the `readerFailed` state (§14). |
| S16 | Retired palette (lime `#a3e635`, green `#16a34a`), glass cards, stat grid, a Heroicons tile. | page | Replaced by the consumer world (§7). |
| S17 | **Dead, unmetered AI endpoint.** `POST /sign-language/interpret` still forwards any signed-in user's base64 image (up to the 10 MB JSON limit) to OpenAI `gpt-4.1`, with no rate limit and no validation beyond presence. Nothing calls it. | `server/routes/signLanguage.js` | **Retired in PR 1** (§5.3). |

### 1.5 The dead server route (security + cost)

`server/routes/signLanguage.js` has one handler, `POST /interpret` `{ image: base64 }`. It builds
`data:image/jpeg;base64,${image}` and sends it to OpenAI chat completions (`gpt-4.1`, `max_tokens: 20`, `detail: 'low'`),
then returns `{ word }`. It sits behind `isAuthenticated` and the global CSRF check. **No client has called it since
2026-03-28** (grep across `client/`, `web/`, `extension/`, `addon/`, `platform/`: the only references are the mount in
`server/app.js` and the route file). While it stays mounted, any signed-in account can use BakerRang's OpenAI key
as an image-description proxy with no limit. Errors go to `next(err)`, which is Express's default handler
(status only in production, no body leak). Retiring it changes no user-visible behavior.

---

## 2. Simplification / retirement analysis

| Legacy thing | Value | Verdict |
|---|---|---|
| **Camera handshape reading, on-device** | The whole product. It's private by construction (frames never leave the tab) and costs nothing per use. | **KEEP**, fixed (S3–S12). |
| **Reading drawn at the hand** | Owner decision (2026-03-28). You look at your hand and see what it reads there. | **KEEP**, legible and mirrored. |
| Skeleton + bounding box | The skeleton gives real feedback: you can see which fingers the model thinks are bent. The box is noise around it. | **KEEP the skeleton** (quiet, 1.5px Ink). **RETIRE the box.** |
| J / Z motion heuristics | The only motion letters. They're crude, but they exist and are testable. | **KEEP**, as practice targets that confirm on detection (§5.5). |
| Letters A B C E F G H I K L O V W X Y, `1` | Real ASL handshapes. | **KEEP.** |
| `I Love You` | A real ASL handshape (ILY). | **KEEP.** |
| `Hello` (open palm) | The handshape is real, but the name is wrong. | **KEEP as `5`.** |
| `ThumbsUp` / `ThumbsDown` | Not ASL. | **RETIRE.** |
| "Interpreter" framing, hero, stat grid, glass | False claims and decoration. | **RETIRE.** |
| `numHands: 2` | Wasted work and arbitrary. | **RETIRE** (1 hand). |
| `POST /sign-language/interpret` (GPT-4.1 vision) | Dead. Its only property now is cost and abuse exposure. | **RETIRE** (PR 1). |
| Runtime CDN loads (`@latest`) | Accidental. They produce version skew and third-party requests. | **RETIRE** → self-hosted, pinned. |
| Persisted data | None exists. | Nothing to migrate. |

**Not added (explicit non-goals; each would be new scope):** words or fingerspelled spelling, a running
transcript/letter tape (owner decision 2), the missing letters D M N P Q R S T U (they need new recognizer
work), two-handed or moving signs beyond J/Z, sign→speech or speech→sign, BSL/other sign languages,
recorded video, saved progress, streaks, scores or gamification, handshape images or animations (see §7.3 and
the open item R6), and camera choice UI (the browser's own permission UI covers device choice).

---

## 3. Exact retained feature set

**One sentence:** hold up your hand; Sign reads your ASL handshape at your hand and says it in large text.
Pick a handshape from its reference, and Sign tells you when you're holding it.

1. **Reader.** A mirrored camera plate. When a readable handshape is held steady for 400 ms, its name is
   drawn at the hand and shown as a large readout, and announced once to assistive tech. The hand skeleton
   is drawn quietly. "No hand in view" shows when no hand is detected for 600 ms.
2. **Readable set (exactly 20, fixed order):** `A B C E F G H I J K L O V W X Y Z` (17 letters), `1`, `5`,
   `I love you`. Each has a display glyph, an accessible name and a **how-to line in words** (§3.1). This set is
   both the reference and the practice set. Sign never offers a target it can't read.
3. **Practise a handshape.** Choose a target from the reference. The target, its how-to line and a **hold
   rule** are shown. Holding the target's reading steady fills the rule over **1.2 s**, then it is **Held**.
   J and Z (motion) are held the moment their motion is read. Changing the target, or the reading leaving it,
   resets the rule. **Esc** / "Clear target" returns to plain reading.
4. **Session tally.** Handshapes held this session get a tick in the reference, plus a quiet "7 of 20 held
   this session". It's **memory only**: reload clears it. There is no score, streak or history.
5. **Honest coverage line**, always one tap away: "Sign reads 20 ASL handshapes, one hand at a time. It
   can't read D, M, N, P, Q, R, S, T or U yet. It's a practice aid, not an interpreter."
6. **Privacy line:** "Your camera stays on this device. Sign sends no video or images anywhere."
   This is a claim BakerRang controls, and it is true by construction (§6).
7. **Start / Stop camera**, with explicit permission, device and failure states (§14).

### 3.1 Handshape reference copy (locked)

| Id | Glyph | Accessible name | How to form it |
|---|---|---|---|
| `A` | A | Letter A | Make a fist with your thumb resting against the side of your index finger. |
| `B` | B | Letter B | Hold four fingers straight up and together, with your thumb folded across your palm. |
| `C` | C | Letter C | Curve your fingers and thumb into a C shape. |
| `E` | E | Letter E | Bend your fingertips down to rest on your thumb, tucked across your palm. |
| `F` | F | Letter F | Touch your thumb and index fingertip in a circle, with the other three fingers up. |
| `G` | G | Letter G | Point your index finger and thumb sideways, parallel, with the other fingers closed. |
| `H` | H | Letter H | Point your index and middle fingers sideways together, with the others closed. |
| `I` | I | Letter I | Raise your pinky, with the other fingers closed over your thumb. |
| `J` | J | Letter J | Make an I, then draw a J in the air with your pinky. |
| `K` | K | Letter K | Raise your index and middle fingers in a V, with your thumb touching between them. |
| `L` | L | Letter L | Raise your index finger and stick your thumb out to make an L. |
| `O` | O | Letter O | Curve all your fingertips to meet your thumb in an O. |
| `V` | V | Letter V | Raise your index and middle fingers apart in a V, with the others closed. |
| `W` | W | Letter W | Raise your index, middle and ring fingers apart, with your thumb holding your pinky. |
| `X` | X | Letter X | Hook your index finger, with the other fingers closed. |
| `Y` | Y | Letter Y | Stretch out your thumb and pinky, with the middle three fingers closed. |
| `Z` | Z | Letter Z | Draw a Z in the air with your index finger. |
| `1` | 1 | Number 1 | Raise your index finger, with the other fingers closed and your thumb over them. |
| `5` | 5 | Number 5 | Spread all five fingers open. |
| `ILY` | ILY | I love you | Stretch out your thumb, index finger and pinky, with the middle two fingers folded down. |

The display glyph for `ILY` is the three-letter string set in the same face. It is never an emoji. The
accessible name is what the live region and screen readers say ("Reading: Letter A").

## 4. Omitted / retired behavior (explicit)

- The "ASL Interpreter" / "Sign Language Interpreter" naming, the hero, the 3-stat grid, glass cards, the lime/green
  palette, the bounding box, the raw error box.
- ThumbsUp, ThumbsDown, the "Hello" label (→ `5`), the second hand.
- The runtime jsdelivr/GCS loads and `@latest`.
- `POST /sign-language/interpret` and `server/routes/signLanguage.js` (PR 1).
- The March transcript box stays retired (decision 2). No letter tape.
- The legacy `/sign-language` page **stays live and unchanged** through coexistence (§17). Its later retirement
  is a separate decision.

---

## 5. Backend / API

### 5.1 Verdict

**Sign calls no product API.** Its only server traffic is the shared ecosystem traffic every web app already makes:
`GET /auth/check`, `GET /auth/google?target=sign`, the CSRF token fetch and `POST /auth/logout` (via `web-auth` /
`web-api-client`), and the theme preference (`GET`/`PUT /account/preferences` via `web-theme`). There is no new product
endpoint, no data, no migration, no new collection or index, and no Cloud Storage.

### 5.2 Change list

| # | Change | Where |
|---|---|---|
| **B1** | OAuth target: `sign: 'SIGN_DOMAIN'` in `TARGET_ENV_KEYS` | `server/config/oauthTargets.js` |
| **B2** | CORS: `env.SIGN_DOMAIN` in `buildAllowedOrigins` | `server/config/origins.js` |
| **B3** | API runtime env `SIGN_DOMAIN=https://sign.bakerrang.com` (Cloud Run `bakerrang-api`); `.env.example` gets `SIGN_DOMAIN=`. Local dev: `SIGN_DOMAIN=http://localhost:3030`. | operator + `server/.env.example` |
| **B4** | **Retire** `POST /sign-language/interpret`: delete `server/routes/signLanguage.js`, remove its import and the `app.use('/sign-language', …)` mount from `server/app.js`. | `server/` |

### 5.3 Exact contracts

**B1 — `GET /auth/google?target=sign`.** This is the existing handler. `sign` becomes a valid symbolic target. The
callback returns to `SIGN_DOMAIN` (root `/`). An unknown target stays `400 Invalid OAuth target`. If
`SIGN_DOMAIN` is unset, the callback returns `500 SIGN_DOMAIN is not configured` (the existing mechanism).
Tests (`server/test/oauthTarget.test.js`): `sign` is valid; it resolves to `SIGN_DOMAIN`; missing env → 500.

**B2 — CORS.** `Origin: https://sign.bakerrang.com` is allowed with credentials exactly like `POLYGLOT_DOMAIN`.
Test (`server/test/cors.test.js`): allowed when `SIGN_DOMAIN` is set; rejected when unset.

**B4 — retirement.** After PR 1, `POST /sign-language/interpret` → **`404`** (Express's default not-found, no
route). Nothing else under `/sign-language` exists. Test (new `server/test/signLanguageRetired.test.js`, `node:test`
+ `supertest`-free `app` request helper as the existing route tests use): an authenticated `POST
/sign-language/interpret` returns 404, and the handler module no longer exists. The legacy client is unaffected: it
never calls this route. `openai` stays a server dependency (Story Book/Polyglot use it).

**Rate limits:** there's no product endpoint to limit. The auth/CSRF/preferences limits are unchanged.
**Provider calls / cancellation / timeouts:** none on the server. The only "provider" is the in-browser model,
whose load is cancellable on the client (§13).

### 5.4 Model + runtime hosting (the one real infrastructure decision)

Sign self-hosts its vision runtime on its own origin. No third-party request happens at runtime.

| Item | Contract |
|---|---|
| Package | `@mediapipe/tasks-vision` **exactly `0.10.34`** in `web/apps/sign/package.json` (the version legacy has run since March; **no 1.x migration in this phase**). `fingerpose` **exactly `0.1.0`**. |
| WASM | Build-time copy of `node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.{js,wasm}` and `vision_wasm_nosimd_internal.{js,wasm}` (the SIMD and non-SIMD sets `FilesetResolver` chooses between; the `module_internal` pair is not needed) → served at `/vendor/tasks-vision-0.10.34/`. |
| Model | `hand_landmarker.task` float16 v1, downloaded **at build** from the pinned GCS URL (§1.2) and verified against SHA-256 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`. A mismatch **fails the build**. Served at `/vendor/hand_landmarker-f16-v1.task`. |
| Mechanism | `web/apps/sign/scripts/vendor-vision.cjs` (plain Node: `fs.copyFile` + `https.get` + `crypto.createHash`, no new deps) writes to `web/apps/sign/public/vendor/` (**gitignored** via `web/apps/sign/.gitignore`). `package.json` scripts: `"prebuild": "node scripts/vendor-vision.cjs"`, `"predev": "node scripts/vendor-vision.cjs"`. The script is idempotent: it skips files already present with the right size/hash. The pins (version, URL, SHA) live in `web/apps/sign/vendor.lock.json`, and the script reads them. |
| Loader | `FilesetResolver.forVisionTasks('/vendor/tasks-vision-0.10.34')`, `modelAssetPath: '/vendor/hand_landmarker-f16-v1.task'`. These are relative to the app origin, with no env var. |
| nginx | Shared `web/nginx/nginx.conf` gains one location (it fans out to all web apps and is harmless where `/vendor/` doesn't exist): `location /vendor/ { types { application/wasm wasm; application/javascript js; application/octet-stream task; } add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }`. **A missing vendor file must 404, never fall through to `index.html`.** Paths are versioned, so `immutable` is safe. |
| Service worker | `globIgnores: ['vendor/**']`. The runtime and model are **not** precached (≈ 30 MB). The browser HTTP cache (immutable) makes repeat starts fast. `runtimeCaching: []`. |
| Docker | Network is already required at build (`npm ci`). The model download happens in the `build` stage via `npm run build -w @bakerrang/web-sign` → `prebuild`. Image size grows by ≈ 30 MB for `web-sign` only (`APP=sign`); other apps' images don't contain it. |
| Licenses | MediaPipe (Apache-2.0) and fingerpose (MIT) notices go in `web/apps/sign/ASSETS.md`, together with the model URL, SHA and download date. |

### 5.5 Recognizer semantics (locked; client, `web/apps/sign/src/vision/`)

Pure modules, testable without a camera:

- `handshapes.js`: the 20-entry table (§3.1) `{ id, glyph, name, howTo, motion: boolean }` in display order, plus
  `fingerpose` descriptions for the 18 static shapes: the legacy definitions for the kept shapes **verbatim**,
  `Hello` renamed to id `5`, `I Love You` → `ILY`, and ThumbsUp/ThumbsDown deleted. The order of the gesture array
  keeps legacy priority (ILY and 5 first, then letters, then `1`).
- `classify.js` → `classifyFrame(landmarks, { width, height })`: it scales landmarks to pixel space
  (`[x*width, y*height, z*width]`), calls `estimator.estimate(points, 8)` and returns the top-scoring static id or `null`.
- `motion.js` → `detectJ(trajectory)` / `detectZ(trajectory)`, the legacy thresholds **verbatim**, on a 30-sample
  trajectory of `{pinky: lm[20], index: lm[8]}` in **unmirrored normalized** coordinates (the space legacy tuned
  them in). J may override `I`/`null`; Z may override `1`/`null` (legacy rule).
- `stabilizer.js` → `createStabilizer({ readMs: 400, clearMs: 600 })`, a pure function of `(rawId, nowMs)`:
  - The **reading** becomes `id` once the same raw id (after J/Z override) has been the frame result continuously
    for ≥ 400 ms. A motion id (J/Z) commits **immediately** when detected, then holds for 1,000 ms before it can
    be replaced (motions are momentary).
  - With no hand, or a raw `null`, for ≥ 600 ms, the reading becomes `null` ("No hand in view" if no hand;
    "Not a shape Sign reads" if a hand with no match).
  - It returns `{ reading, changed }`. `changed` is true only on the transition.
- `hold.js` → `createHold({ holdMs: 1200 })`: with a target `T`, progress runs `0→1` while `reading === T`, and
  resets to 0 when the reading leaves `T` or the target changes. It reaches 1 once → **Held** (emits once per
  hold). Motion targets: Held the moment the reading commits to `T`.
- **Landmarker:** `numHands: 1`, `runningMode: 'VIDEO'`, `minHandDetectionConfidence` / `minHandPresenceConfidence` /
  `minTrackingConfidence` left at MediaPipe defaults (legacy parity). `delegate: 'GPU'` first. If
  `createFromOptions` rejects, retry **once** with `delegate: 'CPU'`. If that fails → `readerFailed`.
- **Frame loop:** `requestAnimationFrame`. Detection runs only when `video.currentTime` changed since the last detection, and
  at most every 33 ms. Timestamps are `performance.now()` (monotonic). Thirty consecutive `detectForVideo` throws →
  `readerFailed` (S15).
- **Mirroring:** the `<video>` is shown with `transform: scaleX(-1)`. The `<canvas>` is **not** CSS-mirrored. The
  drawing code maps `x → 1 - x` so the skeleton lands on the mirrored hand, and text is always drawn upright. Classification
  and motion use the raw (unmirrored) landmarks.

---

## 6. Media / privacy lifecycle

**Camera frames never leave the device.** This is structural, not a promise:

1. `getUserMedia` is called **only** from a user tap on Start camera, never on load. Constraints:
   `{ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }`.
2. Frames go `<video>` → `detectForVideo` (WASM/WebGL in the tab) → 21 landmarks → the classifier.
   The code **never** calls `canvas.toDataURL`/`toBlob`/`getImageData`, `MediaRecorder`, `ImageCapture`, or any
   network/storage API with frame, landmark or reading data. The `vision/` modules import nothing from
   `web-api-client`. A test enforces this: during a simulated session, no `fetch`/`XMLHttpRequest`/`sendBeacon`/
   `WebSocket` call is made except to `/vendor/*`.
3. Landmarks exist for one frame. The trajectory buffer holds 30 samples of 2 points and is cleared on stop.
   Readings and the session tally are React state (memory only).
4. The camera **stops** (every track `.stop()`, `video.srcObject = null`, loop cancelled, canvas cleared) on:
   Stop, `visibilitychange → hidden`, `pagehide`, route change/unmount, sign-out, and `readerFailed`. Returning to
   the tab shows "Camera paused while Sign was in the background." with **Start camera**. It never restarts silently.
5. **Storage:** nothing Sign-specific is written to localStorage, sessionStorage, IndexedDB, the Cache API, the
   service worker, the server or any log. There are no Sign preferences in this phase. The only stored values
   on the origin are the ecosystem's (the theme cookie `br_theme`).
6. **Third parties at runtime: none.** The vendor files come from Sign's own origin (§5.4). Google Fonts is only
   the ecosystem's font loading, if the shared tokens use it (unchanged).
7. **Welcome copy** claims only what is true: "Sign reads your hand on this device. No video or images leave your
   browser." (The Welcome itself runs no camera.)

## 7. Target UX structure — "The Viewfinder" (locked)

The product owner locked it on the Impeccable decision page (2026-09-25, seed `3051b08d`, surface scope, mode operate,
re-roll 1). Round 1 dealt *Alphabet Rail / Handshape Index / Hold Gauge*, and the owner re-rolled. Round 2 dealt
*The Viewfinder / Readout Plate / Drill Round*, and **The Viewfinder** was locked. Build path: **code-led**. No image
generation was available, so the HTML comp is the contract. Full direction contract:
[`web/.impeccable/surfaces/sign.md`](../../web/.impeccable/surfaces/sign.md). Comp:
[`sign-comp.html`](../../web/.impeccable/mocks/sign-comp.html) (states via its review panel or `?state=`).

```
┌ bar 58px: pixel-B | Sign ······································ switcher · avatar(theme inside) ┐
│ ┌ FINDER (#0c0b0a in both themes, 8px radius) ───────────────────────────────────────────┐ │
│ │ rail 34px: ● CAMERA ON · ⟷ MIRROR ···························· ▯ STAYS ON THIS DEVICE │ │
│ │ ┌ plate (camera's real aspect; mirrored video; letterboxed, never cropped) ─────────┐ │ │
│ │ │   ┌─                                                         ─┐  ← crop marks  │ │ │
│ │ │             [ L ✓ ]  ← reading drawn at the hand (upright chip)                  │ │ │
│ │ │                ╲ quiet white skeleton                                           │ │ │
│ │ │   └─                                                         ─┘                  │ │ │
│ │ └──────────────────────────────────────────────────────────────────────────────────┘ │ │
│ │ caption 76px:  L │ Letter L / Reading · steady ··················· Target L · not yet │ │
│ └──────────────────────────────────────────────────────────────────────────────────────┘ │
│ target line (printed on the ground between hairlines, NOT a raised slab):                  │
│ [L  TARGET / Letter L ▴]  Raise your index finger and stick your thumb out…  ✕  [■ Stop camera]│
│ ▬▬▬▬▬▬▬▬▭▭▭▭  Hold it…            3 of 20 held this session     What Sign reads   (GOLD 64px) │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
phone: the same order in one column; finder fills the middle; target line stacks (trigger + ✕ /
       how-to / hold rule / state · tally · link); full-width 60px gold camera key in the bottom third.
```

- **The finder is one object:** rail / plate / caption. It is a fixed near-black camera in **both** themes. The overlay
  (crop marks, skeleton, the at-hand chip) is fixed white ink, independent of theme.
- **The reading, three ways, one truth:** drawn at the hand (owner decision), printed in the caption strip (glyph + name),
  and announced (live region). All three change only when the stabilizer commits (§5.5).
- **The target line** holds every control except the finder: the Target trigger (opens the handshape picker), the how-to
  sentence (the text alternative for "what the shape looks like"), Clear, the 12-segment **hold rule** + text state,
  the session tally (or **Next handshape** after Held), "What Sign reads" and the **gold camera key**.
- **Handshape picker:** a 5×4 `listbox` grid of the 20 glyph cells (held cells get a violet tick; J/Z are marked
  "move"). It shows the focused cell's name + how-to beneath, and the coverage note ("Can't read yet: D M N P Q R S T U …
  not an interpreter") at the foot. Desktop: an anchored panel opening **upward** from the trigger (392px). ≤640px: a
  **bottom sheet** (max 88dvh, scrim `rgba(0,0,0,.45)`, no blur). Never a native `<select>`.
- **Signature, "focus lock":** on Held, the four crop marks step 6px inward and thicken (1.5→3px) over 180ms, hold
  ~900ms, then release. It plays forward on the persistent crop element. Under reduced motion they only thicken.
- **Stable layout:** the finder's size never changes across reading/holding/Held/target changes. The hold row has fixed
  slots, and the how-to reserves two lines (finish review fix 1).
- **Welcome (signed out):** masthead "Hold up a handshape. Sign reads it.", a lead, the gold **Sign in with Google**,
  the privacy line and the coverage line. Beside it is an **example finder** (drawn L, Held) with an "Example" tag on
  its rail and "Drawn example. In the app, this is your own camera, mirrored." The top-bar Sign in is ghost (Polyglot
  precedent: one gold fill per surface). **Not found:** 560px single column, "Back to Sign".
- **Why this is not Polyglot or Story Book:** there is no log, no dock slab and no book. The first object is a camera finder
  with photographic furniture (crop marks, info rails). The only shared grammar is the ecosystem chrome and the
  one-gold-action rule.

### 7a. Impeccable finish review

A fresh `impeccable-finish-reviewer` reviewed the comp, icon and 15 captures (390 / 1440, dark + light, 13 states)
against the direction contract. **Round 1: `fix`** with 8 material fixes:
1. Held reflowed the page.
2. The focus lock played backwards.
3. There was a banned eyebrow on Welcome.
4. Icon crop marks sat outside the maskable circle, and the badge was off the family position.
5. J/Z showed an unfillable hold meter.
6. The no-re-mount/focus rule was missing from the spec.
7. The phone caption glyph size deviated from the contract.
8. The ghost signed-out Sign in wasn't cited.

All were fixed in one batch. **Verdict pass: all 8 resolved → `ship`** (scoped to the scored fixes). Its two copy notes
(the phone "not yet" fragment, and a repeated J/Z instruction) were then folded in. The DESIGN.md Sign product layer is
written from the finished comp by the Impeccable documenter.

### 7b. Routes

| Path | Auth | Surface |
|---|---|---|
| `/` | anon → Welcome; authed → the viewfinder | The only product surface. |
| `*` | any | Not found (link to `/`). |

No deep-linkable state (no `?target=`: new scope). React Router 6 (parity with Story Book/Polyglot).

### 7c. Component map (app-local, `web/apps/sign/src/`)

`App.jsx` (routes, auth gate, bar via `BrandLink`/`AppSwitcher`/`AccountMenu`/`ProductEmblem`) · `Viewfinder.jsx`
(finder: rail, plate, crop marks, caption) · `OverlayCanvas.jsx` (skeleton + at-hand chip drawing) · `TargetLine.jsx`
(trigger, how-to, clear, hold rule, tally/next, coverage link, camera key) · `HandshapePicker.jsx` (listbox grid,
panel/sheet) · `Welcome.jsx` · `NotFound.jsx` · `state/useCamera.js` (§13) · `state/useReader.js` (loop + stabilizer + hold)
· `vision/{handshapes,classify,motion,stabilizer,hold,landmarker}.js` (§5.5). Nothing Sign-specific graduates to `web-ui`.

## 8. Auth / session

- Everything except Welcome, Not found and static assets requires the central session (decision 4). There are no API
  calls to protect, but the ecosystem rule is kept for consistency.
- `AuthProvider` from `web-auth` with `oauthTarget = 'sign'` (`VITE_OAUTH_TARGET=sign`). Sign in → `GET
  /auth/google?target=sign` → back to `SIGN_DOMAIN` `/`. There's a single route, so no return path is needed.
- `LOADING` → quiet ground (no spinner for < 300 ms). `ANONYMOUS` → Welcome. The 60 s auth poll (`web-auth`)
  noticing sign-out **stops the camera** and shows Welcome.
- Logout = the shared POST flow in `AccountMenu`. The camera stops first (unmount).
- Offline: `web-auth` treats a failed `/auth/check` as `ANONYMOUS`, so an offline cold start shows Welcome, the same
  as Polyglot and Story Book (ecosystem behavior, unchanged here).
- Shared host-only `connect.sid` on `api.bakerrang.com`, `SameSite=Lax`. `sign.` and `api.` are same-site.

## 9. Theme

Shared `web-theme` (light / dark / system, the `br_theme` cookie + `/account/preferences`), the boot script in
`index.html`, no flash. The theme control lives **in the account menu** (Story Book / Polyglot parity). Two
`theme-color` metas (`#161514` dark / `#efece6` light, the world ground). The camera plate's surround is a fixed
near-black in **both** themes (a video is a picture, not a surface). The overlay skeleton and label use fixed
video-safe colors, not theme tokens, so they read on any camera image (§7).

## 10. PWA

App-local `vite.config.js`, the same shape as Polyglot (`SIGN_PWA_OPTIONS` exported for a config test): `id '/'`,
`name 'Sign — BakerRang'`, `short_name 'Sign'`, `description 'Practise ASL handshapes with your camera. Sign reads
your hand on this device.'`, `start_url '/'`, `scope '/'`, `display 'standalone'`, `theme_color` and `background_color`
`'#161514'`, maskable 192/512 icons. Workbox `globPatterns: ['**/*.{html,css,js,woff2,png,ico,webmanifest}']`,
**`globIgnores: ['vendor/**']`**, `navigateFallback: 'index.html'`, **`runtimeCaching: []`**. No API, camera, frame,
reading or model caching in the SW. Icons are rasterized from `web/.impeccable/mocks/sign-icon.svg` (the shared Sign
emblem in Sign Violet on the charcoal tile + the **canonical** `bakerrang-logo.png` badge, composited, never redrawn)
by an app-local `scripts/generate-icons.cjs` cloned from Polyglot's. Provenance goes in `apps/sign/ASSETS.md`. Camera
permission is per-origin, and installing grants nothing extra. Graduation rule re-checked: three apps share ~6
Workbox lines. **Still no `web-pwa-config` package.**

## 11. Responsive / mobile

*(See §7a for the structure. General rules:)*
- **The plate takes the camera's real aspect ratio** (`track.getSettings()` width/height → CSS `aspect-ratio`),
  so there is no crop and the overlay can't misalign (S7). On phones the portrait front camera usually gives 3:4 or
  9:16. The plate is capped at `min(62dvh, …)` and centred, and it never pushes the readout off-screen.
- The **canvas label** is drawn at `max(28px, 7% of the plate's displayed height)` CSS px × `devicePixelRatio`,
  clamped inside the plate (S9). The canvas backing store is sized to the plate's CSS size × DPR (capped at 2).
- Targets ≥ 44 px. The primary control sits in the bottom third on phones, inside safe-area insets.
- Landscape phones: plate and readout go side by side.
- Screen wake lock: **not** requested (new scope). Noted in §20.

## 12. Accessibility requirements

- **Text is the output of record.** The canvas is `aria-hidden="true"`. The readout is a real element: the reading's
  glyph (display size) plus its accessible name. "Letter A" is visually hidden next to the glyph `A` when they differ
  (`ILY` → "I love you", `1` → "Number 1").
- **Live region:** one `role="status"` `aria-live="polite"` `aria-atomic="true"` region. It announces only
  **committed** readings ("Reading: Letter A"), once per change and never repeated for the same reading. It announces
  "Held: Letter A" on confirmation and state changes ("Camera on", "Camera paused", errors). "No hand in view" is
  announced at most once per 10 s so it doesn't chatter.
- **Reference as a real control:** the handshape set is a `role="radiogroup"` (or `listbox`, per §7a) with roving tabindex,
  arrows / Home / End, and type-ahead by first character (`A`–`Z`, `1`, `5`, `I`). Each option's name = accessible name +
  "held" state. The how-to line is its `aria-describedby`. Choosing a target moves nothing (focus stays).
- **Keyboard:** Tab reaches everything in visual order. `Enter`/`Space` activates. `Esc` clears the target (or closes a
  sheet/popover first). No single-letter global shortcuts (they clash with screen readers; letter keys only work
  inside the reference's type-ahead).
- **Focus:** after Start camera, focus stays on the camera toggle (now "Stop camera"). Opening a sheet moves focus
  in, and closing returns it to the trigger. Errors don't steal focus. Their message is in the live region and next to
  the control.
- **Color-independent status:** reading, held, paused and error states are all text + shape. The hold rule is a
  segmented bar **with a text state** ("Hold… 0.6 s" / "Held"). A tick and the word "held" mark tallied shapes.
  Violet never carries meaning alone.
- **Reduced motion:** the hold rule fills in discrete segment steps with no easing/glow. The "held" stamp appears without
  motion. No skeleton smoothing animation. Plate transitions are instant.
- **Text alternatives / captions:** Sign produces **no audio** at all. Every feedback channel is visual or text, so
  nothing depends on hearing, and no captions are needed. Every handshape has a words-only how-to (§3.1). There are no
  images to describe, and the camera view is labelled "Your camera, mirrored. Not recorded."
- **Camera permission:** requested only on a tap. The pre-permission copy says why ("to read your hand. The video stays
  on this device"). Denied/unavailable states explain how to fix it in words (§14).
- **Motor:** hold time is 1.2 s after a 400 ms read. There is no time limit to reach a target, and the target
  persists until you change it. **Target size ≥ 44 px.**
- Contrast AA in both themes. The focus ring is the world's gold-text 2px outline.
- **Honesty is an accessibility requirement here:** the coverage line (§3.5) is reachable from the first viewport,
  so nobody relies on Sign to understand a signer.

## 13. Race / cancellation behavior (locked)

A single `useCamera` hook owns the lifecycle with a monotonically increasing `startId` held in a ref:

- **Start:** `const id = ++startIdRef.current`. Load the landmarker (cached in a ref after the first success; reused
  across Start/Stop), then `getUserMedia`, then `video.play()`. After **every** `await`: `if (startIdRef.current !== id)`
  → stop any tracks this attempt obtained, and return. A stream obtained after cancel is stopped immediately (S5).
- **Stop / hidden / pagehide / unmount / sign-out:** `++startIdRef.current` (invalidates in-flight starts), cancel rAF,
  stop tracks, null `srcObject`, clear the canvas, reset the stabilizer/hold/trajectory. Idempotent.
- **Model load in flight + Stop:** the load promise is allowed to finish and is cached for next time (it is expensive
  and has no side effect). The camera is never opened for a cancelled start.
- **Double tap:** the toggle is `aria-disabled` while `starting`.
- **Target change mid-hold:** resets the hold. **Held** emits once per hold. Re-holding after the reading leaves and
  returns counts again but doesn't double-tally (the tally is a Set).
- **Theme change:** no effect on the loop (the overlay colors are fixed, §9).
- **Device change** (`devicechange`) while on: ignored. The track's `ended` event → `cameraLost` state (§14).

## 14. Loading / error / permission states

Camera state machine (`useCamera`): `off → starting(loadingReader | awaitingPermission) → on → off`, with exits
`denied | noCamera | cameraBusy | insecure | unsupported | readerFailed | cameraLost | paused`.

| State | What the user sees (copy is locked) | Recovery |
|---|---|---|
| Off (first visit) | The plate as a quiet frame with the Sign emblem: "Hold your hand up to the camera and Sign reads the handshape." The privacy line. **Start camera** (gold). | Start camera |
| Loading the reader | "Loading the hand reader…" + progress by step (Reader → Camera). The first load fetches ≈ 20 MB, later loads come from cache. | Stop |
| Waiting for permission | "Allow camera access in your browser to continue." | — |
| On, no hand | The plate is live. Readout: "No hand in view". | — |
| On, hand not a readable shape | Readout: "Not a shape Sign reads" (Ink 3). The skeleton still draws. | — |
| On, reading | Glyph + name at the hand and in the readout. | — |
| Target set, holding | The hold rule fills. Text: "Hold it…". | — |
| Held | "Held" + tick, the tally updates, announced. The target stays set (re-practise or pick another). | Next ▸ (moves to the next readable target in order) |
| `denied` | "Sign can't see your camera. Allow camera access for sign.bakerrang.com in your browser's site settings, then try again." | Try again |
| `noCamera` | "No camera found on this device." | — |
| `cameraBusy` (`NotReadableError`/`AbortError`) | "Your camera is being used by another app. Close it, then try again." | Try again |
| `insecure` / `unsupported` (`!navigator.mediaDevices`) | "This browser can't share a camera with Sign." | — |
| `readerFailed` (WASM/model load, GPU+CPU both failed, or 30 frame errors) | "Sign couldn't start its hand reader on this device. Check your connection and try again." | Try again |
| `cameraLost` (track `ended`) | "The camera stopped." | Start camera |
| `paused` (tab hidden) | "Camera paused while Sign was in the background." | Start camera |
| Offline, reader not loaded | Start camera stays enabled. If the load fails → `readerFailed` (above). If the reader is already loaded, reading keeps working offline (nothing needs the network). | Try again |

Errors are **in Ink with a drawn icon** (the Polyglot "problems in ink" discipline), never Danger red, a toast
or an alert box. Raw `err.message` is never shown (S14). Mapping: `NotAllowedError`/`SecurityError` → `denied`;
`NotFoundError`/`OverconstrainedError` → `noCamera` (an `OverconstrainedError` first retries once with `{ video: true }`);
`NotReadableError`/`AbortError` → `cameraBusy`; no `mediaDevices` or `!isSecureContext` → `unsupported`.

---

## 15. CI / CD / deployment (extend the Phase C/D mechanisms)

| Mechanism | Change |
|---|---|
| `web/apps/sign` | `@bakerrang/web-sign`, dev port **3030** (after Polyglot's 3020), preview **4176**, root script `npm run dev:sign`. `package.json` deps mirror Polyglot's shared packages + exact `@mediapipe/tasks-vision@0.10.34`, `fingerpose@0.1.0`. `prebuild`/`predev` run `scripts/vendor-vision.cjs` (§5.4). `.gitignore`: `public/vendor/`. |
| `web/package-lock.json` | Relocked via the existing `npm run relock` (Docker, node:20). |
| `web/Dockerfile` | `COPY apps/sign/package.json apps/sign/package.json` in the deps stage. No new `ARG`s (`APP=sign`, `VITE_OAUTH_TARGET=sign`). |
| `web/nginx/nginx.conf` | The `/vendor/` location (§5.4). Shared file → fans out to all web services (classifier rule `web/nginx/`). |
| `scripts/ci/classify-changes.mjs` | `ALL_WEB_SERVICES` += `'web-sign'`; rule `{ prefix: 'web/apps/sign/', ci: ['web-sign'], deploy: ['web-sign'] }`; outputs `web_sign`, `deploy_web_sign`. |
| `.github/workflows/ci.yml` | `web-sign` build step (`npm run build -w @bakerrang/web-sign`, which downloads + verifies the model) + Docker packaging validation (`--build-arg APP=sign --build-arg VITE_OAUTH_TARGET=sign`, tag `bakerrang-web-sign:pr-<sha>`); added to the web-job `if`, the outputs block and `ci-passed`. |
| `.github/workflows/deploy.yml` | `workflow_dispatch` option `web-sign`; `validate-web` builds sign when flagged; new `deploy-web-sign` job (same shape as `deploy-web-polyglot`: `service: web-sign`); `live-deploy-passed` aggregates `DEPLOY_WEB_SIGN` / `WEB_SIGN_RESULT`. |
| `_deploy-cloud-run.yml` | `web-sign)` case: `service_name="$WEB_SIGN_SERVICE"`, `image_name="web-sign"`, smoke `${SIGN_BASE_URL%/}/`, added to the SPA-shell assertion list (`client\|web-launcher\|web-storybook\|web-polyglot\|web-sign`). **Extra smoke:** `curl -fsSI "${SIGN_BASE_URL%/}/vendor/hand_landmarker-f16-v1.task"` → 200 with `cache-control: …immutable` (proves the vendor path is served and doesn't fall through to `index.html`). |
| `stale-deploy-guard.mjs` | `SERVICES` += `'web-sign'`. |
| `rollback.yml` / `scripts/ci/rollback.ps1` | `web-sign` choice + allowlist; `'web-sign' = @{ Path = '/'; Public = 'https://sign.bakerrang.com/'; Assertion = 'ClientRoot' }`. |
| `verify-live.yml` / `scripts/verify-live.ps1` | Service row `{ Logical='web-sign'; Service='bakerrang-web-sign'; Package='web-sign'; ExpectedSa='bakerrang-frontend@avian-cable-379805.iam.gserviceaccount.com' }` + endpoint `Web Sign https://sign.bakerrang.com/ ClientRoot`. |
| Tests | `classify-changes.test.mjs` (sign-only → only `web-sign`; `web/packages/**` → all four web services), `deployment-workflows.test.mjs`, `stale-deploy-guard.test.mjs`, `rollback.test.ps1`, `verify-live.test.ps1`. |
| GitHub `production` Environment | `WEB_SIGN_SERVICE=bakerrang-web-sign`, `SIGN_BASE_URL=https://sign.bakerrang.com`. |
| Immutable SHA / WIF | Unchanged conventions: image `…/web-sign:<sha>`, deploy by digest via the existing WIF deployer; the deployer gets scoped `run.developer` on `bakerrang-web-sign` only. |
| Runbook | New `docs/apps/Sign-PhaseE-Runbook.md`, cloned from the Polyglot runbook: service bootstrap (runtime SA `bakerrang-frontend@`), scoped deployer IAM, GitHub vars, API `SIGN_DOMAIN`, first deploy via CI, pre-mapping verification on the `run.app` URL, domain mapping + DNS for `sign.bakerrang.com` **only** (never apex), live acceptance (§19), registry flip, post-cutover smoke, rollback reference. **No** Cloud Logging exclusion step (Sign sends no content in URLs) and **no** key rotation step. |

**Selective deploy:** a Sign-only change deploys only `web-sign`. A `web/packages/**` change deploys Launcher, Story Book,
Polyglot **and** Sign. The PR that adds `web-sign` to `ALL_WEB_SERVICES` is itself a shared-file change and deploys all four.

## 16. Shared-package impact

| Package | Change | Why |
|---|---|---|
| `web-app-shell` | **Implementation PR: none.** `legacyPath` stays `/sign-language` (already correct: one legacy page, nothing to redirect like Polyglot's `/instant`), `liveUrl` stays `null`. **Flip PR:** `liveUrl: 'https://sign.bakerrang.com'`. The emblem is unchanged (the icon reuses its path). | Registry = single source of truth |
| Launcher (`web/apps/launcher`) | **One copy line (PR 2).** `Launcher.jsx:10` today reads "Practise sign language with your camera and instant feedback." That's broader than the truth (it reads 20 ASL handshapes, not sign language). Change it to **"Practise ASL handshapes with your camera. Sign reads your hand on this device."** The name stays "Sign Language" (registry + `Launcher.test.jsx`). It's a Launcher-app change → deploys `web-launcher` only. | Honesty (S1) |
| `web-ui`, `web-tokens`, `web-theme`, `web-auth`, `web-api-client` | None. `--accent-sign` already exists (`#b79ce0` / `#6e4fb4`). | Graduation rule |

## 17. Coexistence / cutover strategy

| Entry | Before the flip | After the flip |
|---|---|---|
| Launcher row + app switcher (shared registry) | `https://bakerrang.com/sign-language` (legacy) | `https://sign.bakerrang.com` |
| Legacy `bakerrang.com/sign-language` | Unchanged, fully working | Unchanged (retirement is a separate later decision) |
| Legacy backend `POST /sign-language/interpret` | **Removed in PR 1** (no caller) | — |
| Installed Sign PWA | n/a | Opens `/` standalone |
| Data | None | None |

1. **PR 1 — server:** B1 (OAuth target), B2 (CORS), B4 (retire `/sign-language/interpret`) + tests, `.env.example`.
   Deployable alone. The legacy client is unaffected.
2. **PR 2 — app + CI:** `web/apps/sign`, the nginx `/vendor/` location, Dockerfile, classifier, workflows, rollback/verify-live,
   the runbook, the Launcher copy line (§16). `liveUrl` stays `null`.
3. **Operator runbook:** API env `SIGN_DOMAIN`, the Cloud Run service `bakerrang-web-sign`, IAM, GitHub vars, first deploy
   via CI, verify on the `run.app` URL, map `sign.bakerrang.com`, DNS.
4. **Live acceptance** (§19) directly on `sign.bakerrang.com`, including a real phone.
5. **PR 3 — flip:** `liveUrl: 'https://sign.bakerrang.com'`. The shared-package change redeploys Launcher, Story Book,
   Polyglot and Sign. Verify the Launcher row and every app switcher open the subdomain.
6. **Rollback:** the standard rollback flow for `web-sign`. Reverting PR 3 restores the legacy destination.
7. The legacy `/sign-language` page and its client deps (`@mediapipe/tasks-vision`, `fingerpose`) stay until a later
   legacy-retirement phase.

## 18. Testing matrix

**Automated (Vitest + Testing Library in `web/`, `node:test` in `server/`; behavior, not snapshots).**

| Area | Tests |
|---|---|
| `handshapes.js` | Exactly 20 ids in the locked order. No `ThumbsUp`/`ThumbsDown`/`Hello`. `5` and `ILY` present. Every entry has glyph/name/howTo matching §3.1 verbatim. J/Z flagged `motion`. The 18 static fingerpose descriptions exist and the static ids = the 20 minus J/Z. **Drift test:** the kept static definitions are identical to legacy `client/src/utils/aslGestures.js` (except the rename/removals). |
| `classify.js` | Scales landmarks by `(width, height, width)` before `estimate` (spy on a fake estimator). Returns `null` below threshold. Top score wins. |
| `motion.js` | Synthetic trajectories: a down+sideways pinky stroke → J; the right/down-left/right index stroke → Z; short buffers → false. The J override only from `I`/`null`, Z only from `1`/`null`. |
| `stabilizer.js` | Commits after 400 ms stable, not before. Flicker never commits. Motion commits immediately and holds 1,000 ms. Clears after 600 ms without a hand. `changed` fires only on transitions. |
| `hold.js` | Fills over 1.2 s only while reading === target. Resets on leave or target change. Emits Held once. Motion targets are Held on commit. |
| `useCamera` | `getUserMedia` only after a Start tap, with the §6 constraints. Tracks stopped on Stop, hidden, `pagehide`, unmount and sign-out. **A stream resolving after Stop/unmount is stopped immediately** (S5). A double Start is ignored while starting. Error name → state mapping (§14), including the `OverconstrainedError` retry. GPU→CPU fallback once. 30 frame errors → `readerFailed`. |
| Privacy | During a simulated session, no `fetch`/XHR/`sendBeacon`/`WebSocket` call except `/vendor/*`. `localStorage`/`sessionStorage` untouched by Sign. No `toDataURL`/`toBlob`/`getImageData`/`MediaRecorder` usage (static grep test over `src/`). |
| Components | Auth gate (anon → Welcome). The camera key label per state. The live region announces committed readings once, Held once, and "No hand in view" throttled. Picker: arrows ±1/±5, Home/End, type-ahead (incl. `I` → I, then `IL` → ILY), Enter selects and returns focus to the trigger, Esc closes. Esc clears the target. **No re-mount:** focus stays on Stop camera across reading and Held updates. Next moves to the next target in order. Coverage copy present. `lang="en"`. |
| PWA config | `SIGN_PWA_OPTIONS`: identity, `runtimeCaching: []`, `globIgnores` includes `vendor/**`. |
| Vendor script | Hash mismatch fails. Idempotent skip. The pins are read from `vendor.lock.json`. |
| Server | `oauthTarget.test.js` (`sign`), `cors.test.js` (`SIGN_DOMAIN`), `signLanguageRetired.test.js` (404). |
| CI | classifier/workflow/stale-guard/rollback/verify-live tests per §15. |

## 19. Live acceptance criteria (`sign.bakerrang.com`, before the flip)

1. HTTPS shell. `/anything` returns the shell (Not found inside). `/vendor/hand_landmarker-f16-v1.task` → 200, 7,819,105
   bytes, `cache-control: public, max-age=31536000, immutable`. `/vendor/missing.task` → **404** (not HTML).
   `/vendor/tasks-vision-0.10.34/vision_wasm_internal.wasm` → `content-type: application/wasm`.
2. Anonymous → Welcome → Sign in (`?target=sign`) → back to Sign. A user already signed in (from the Launcher) needs no prompt.
3. **DevTools → Network during a 2-minute session:** the only requests are the shell, `/vendor/*` (first start only;
   cached after) and `api.bakerrang.com/auth/check` polling. **Zero requests to jsdelivr, storage.googleapis.com or
   openai**, and no request carries image data.
4. Desktop Chrome + webcam: Start → permission → reading. A, B, L, V, Y, 1, 5 and I love you each read at the hand and in
   the caption after a steady hold. The label sits on the hand (no drift) with a 4:3 **and** a 16:9 camera. Preview is mirrored.
5. **iOS Safari and Android Chrome (real phones):** portrait front camera, the plate at 3:4 without cropping, the label legible,
   the gold key in thumb reach. Switching apps turns the OS camera indicator **off**. Returning shows "Camera paused…".
6. Practice: target L → hold → the rule fills → **Held** + focus lock + tally. J and Z are Held via motion (best effort,
   heuristic; record the pass rate, not a blocker). Next → B.
7. Deny camera → the denied copy. Camera in use by another app → busy copy. A device with no camera → no-camera copy.
8. Screen reader (VoiceOver iOS + NVDA/Chrome): Start camera is announced, "Reading: Letter L" is announced once per change,
   "Held: Letter L" is announced, and the picker is navigable with arrows and type-ahead. Keyboard-only: the full loop without a mouse.
9. Reduced motion (OS setting): the crop marks thicken without moving, and the hold rule steps.
10. Light / dark / system without a flash. The finder stays near-black in light mode. Installable as **Sign** with its icon.
    The SW caches the shell only (no `vendor/` entries in Cache Storage).
11. Leaving mid-load (Start, then navigate away before the permission prompt resolves) leaves **no** camera light on.
12. A Sign-only change deploys only `web-sign`. Rollback + verify-live cover it.
13. The legacy `/sign-language` still works (it depends on jsdelivr `@latest`; record whether it currently loads, see S3).
    Apex is untouched.
14. After the flip: the Launcher and every switcher open `sign.bakerrang.com`.

## 20. Security / privacy findings (summary)

| # | Finding | Severity | Action |
|---|---|---|---|
| F1 | Dead `POST /sign-language/interpret`: an authenticated, unmetered GPT-4.1 vision proxy (10 MB bodies) with no caller. | Medium (cost/abuse) | Retire in PR 1 (B4). |
| F2 | Runtime third-party loads (jsdelivr `@latest` WASM = **1.0.1** under a 0.10.34 JS; GCS model): supply-chain + version skew + IP disclosure on every start. | Medium (integrity/availability) | Self-host exact pins; SHA-verify the model at build (§5.4). |
| F3 | The camera stream leaks after navigation during start. The camera stays on in background tabs. | Medium (privacy) | §13 start token; stop on hidden/pagehide/unmount. |
| F4 | Raw error messages shown to users. | Low | Mapped states (§14). |
| F5 | "Interpreter" overclaim could lead someone to rely on it to understand a Deaf person. | Medium (harm by misrepresentation) | Honest naming + coverage copy everywhere (§3, §12). |
| — | No sensitive content in URLs, no provider calls, no logging exposure, no ownership/authorization surface: Sign has no product API. | — | — |
| — | nginx has no `Permissions-Policy`/CSP today. If one is ever added it must allow `camera=(self)` and `'wasm-unsafe-eval'` for Sign (runbook note). | — | — |

**Data/persistence impact:** none. No collection, no migration, no stored preference (§6).

## 21. Risks and open items

- **R1** Recognition quality is heuristic (fingerpose on MediaPipe landmarks). Some readable shapes will be finicky
  (E vs A, K vs V, the J/Z heuristics). The copy never promises accuracy. Live acceptance records the per-shape behavior.
  Tuning thresholds is a later step.
- **R2** Pixel-space scaling (S11) changes finger-angle inputs relative to legacy. It is the correct geometry for fingerpose,
  but it is **the one recognition behavior change**. If live acceptance shows a regression for specific shapes, the
  fallback is legacy normalized input behind a single constant (decide at acceptance, no redesign).
- **R3** The first start downloads ≈ 20 MB (WASM + model). The loading copy says so. On slow mobile data that's a real wait.
  No mitigation in this phase (a lite model is new scope).
- **R4** The legacy page's jsdelivr `@latest` = 1.0.1 WASM with 0.10.34 JS **may already be broken** in production. Unverified
  here (the planner had no signed-in browser). This doesn't block Phase E, but acceptance item 13 records it.
- **R5** Screen wake lock isn't requested. A phone may dim during a long practice. New scope if wanted.
- **R6** Handshape illustrations are deliberately absent: the how-to is words-only, which is accessible and honest. Drawn
  handshape art is a possible future addition and must be accurate (commission or an owner-approved source).
- **R7** Left-handed signers: fingerpose directions accept both horizontal directions for most shapes, and mirrored preview
  helps, but left-hand accuracy is unverified. Record it in acceptance.
- **R8** Model/runtime licenses (Apache-2.0 / MIT) are recorded in `ASSETS.md`. The Google model terms were checked only at
  the level of "published for developer use". The operator should confirm before the flip.

## 22. Lock round (to be completed after ChatGPT review)

**Decisions already made by the product owner (2026-09-25):** practice + reader, reading at hand + large readout (no
tape), ASL-true set, sign-in required, The Viewfinder structure, `sign.bakerrang.com`.

**Planner-locked defaults (reviewable, not blocking):** hold 1.2 s / read 400 ms / clear 600 ms; session tally memory-only;
Next = next in fixed order; retire `/sign-language/interpret` in PR 1; self-hosted pinned runtime; pixel-space
classification (R2); no Sign preferences stored.

---
*No production Sign code has been written. The repo-root platform ("Business Workshop") design world was not modified.*
