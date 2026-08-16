# BakerRang Orchestrator — Pass 1 Implementation Plan

> Planning response to [`Pass1-Orchestrator-Spec.md`](Pass1-Orchestrator-Spec.md).
> **No code was modified to produce this plan.** All CLI flags below were read from the
> locally installed tools (source of truth), not from external docs.

---

## 0. Environment inspection results (source of truth)

All findings below were captured on this machine on 2026-08-16.

### Installed tool versions
| Tool | Version | Auth (local, non-consuming check) |
|------|---------|-----------------------------------|
| `claude` | **2.1.233** | `claude auth status` → `{ loggedIn: true, authMethod: "claude.ai", apiProvider: "firstParty", subscriptionType: "pro" }` |
| `codex` | **codex-cli 0.147.0** | `codex login status` → `Logged in using ChatGPT` |
| `git`  | 2.39.1.windows.1 | — |
| `node` | v24.11.1 | — |
| `npm`  | 11.6.2 | — |

**Both CLIs are subscription-authenticated, not API-key authenticated.** This is exactly the
required execution model. The two `*-status` commands are local token inspections — they do **not**
consume a model call — so they are safe to run at startup.

### Claude CLI capabilities (from `claude --help`)
- **Non-interactive:** `-p / --print` ("Print response and exit").
- **Prompt via stdin:** with `--print` + default `--input-format text`, piped stdin is the prompt
  (`cat prompt.md | claude -p`). This is the large-prompt mechanism (avoids Windows argv limits).
- **Read-only mode:** `--permission-mode plan` (choices include `plan`). Plan mode cannot edit files.
  Belt-and-suspenders available: `--disallowedTools Edit Write NotebookEdit` and/or
  `--tools "Read,Grep,Glob,Bash"`.
- **Output:** `--output-format text|json|stream-json`. `json` wraps the result + metadata; `text` is
  the raw assistant text. We use **`text`** (we parse our own Markdown sentinels; see §15/§17 below).
- **Model / context:** `--model`, `--add-dir`, auto-loads repo `CLAUDE.md` when cwd is the repo.
- **Auth:** `claude auth status` (used at startup).
- **⚠️ Avoid `--bare`:** its help states it forces Anthropic auth to `ANTHROPIC_API_KEY`/apiKeyHelper
  and never reads OAuth/keychain — that would **break subscription auth and risk API billing.** Do not
  use `--bare`.

### Codex CLI capabilities (from `codex --help`, `codex exec --help`)
- **Non-interactive:** `codex exec [PROMPT]` (alias `codex e`).
- **Prompt via stdin (explicitly documented):** *"If not provided as an argument (or if `-` is used),
  instructions are read from stdin."* This is the large-prompt mechanism for Codex.
- **Sandbox / write control:** `-s / --sandbox read-only | workspace-write | danger-full-access`.
  - reviewer / planner → `read-only`
  - implementer / correction → `workspace-write` (smallest write mode; **never** `danger-full-access`)
- **Approvals:** `-a / --ask-for-approval never` (required so `exec` never blocks on a prompt in
  automation). Combined with a fixed sandbox, this is deterministic.
- **Final-message capture:** `-o / --output-last-message <FILE>` writes the agent's final message to a
  file — cleaner than scraping stdout for the report/verdict.
- **Other:** `-C/--cd <DIR>`, `--add-dir`, `--skip-git-repo-check`, `--json` (JSONL events, optional),
  `--output-schema <FILE>` (optional structured output).
- **Auth:** `codex login status` (used at startup). Note `codex login --with-api-key` reads
  `OPENAI_API_KEY` from stdin — we must ensure that path is never triggered (see §8).

### Repo facts relevant to `/orchestrator`
- Root is **not** an npm workspace. Independent trees: `client/`, `server/`, `platform/` (its own
  npm-workspaces root), `extension/`, `addon/`, `docs/`. Adding a self-contained `orchestrator/` needs
  **no root workspace migration** — exactly as the spec wants.
- Root `.gitignore` is tiny (`.idea`, `server/node_modules/`, `client/node_modules/`, `server/.env`,
  `/.playwright-mcp/`, `client/dist/`). We must **append** orchestrator ignores (see §28/§29).
- Project-level agent configs already exist at repo root: `CLAUDE.md` (72 KB) and `AGENTS.md` (43 KB).
  A subprocess run with cwd = repo root auto-loads these — useful free context for planner/reviewer,
  but note the token weight.
- **Verification scripts confirmed from real `package.json` files:**
  - `server/`: `test` = `node --import ./test/setup.js --test test/*.test.js`; `lint` = `standard`.
  - `platform/` (root): `build`, `lint`, `typecheck` each = `npm run <x> --workspaces --if-present`.
  - `platform/apps/portal`: `build` (`next build`), `lint` (`eslint .`), `typecheck` (`tsc --noEmit`).
  - `platform/apps/site-renderer`: same three, plus `test` (`node --experimental-strip-types --test`).
  - `packages/*` have no build/lint/typecheck scripts → `--if-present` safely skips them.

---

## 1. Current BakerRang repo structure relevant to adding `/orchestrator`

```
bakerrang/
  .gitignore            # append orchestrator ignores
  CLAUDE.md  AGENTS.md   # auto-loaded by claude/codex at repo root (free context)
  client/                # legacy app — untouched
  server/                # Express API — verification target (npm test, lint)
  platform/              # npm-workspaces root — verification target (typecheck/lint/build)
    apps/{portal,site-renderer}
    packages/{ui,site-components,site-schema}
  extension/  addon/
  docs/
    marketing-site/      # Step 1.x specs (1.16–1.22 present)
    orchestrator/
      Pass1-Orchestrator-Spec.md
      Pass1-Orchestrator-Plan.md   # this doc
  orchestrator/          # NEW — fully self-contained (see §28)
```

`orchestrator/` sits beside the other trees with its own `package.json` + `node_modules`; it imports
nothing from `client`/`server`/`platform` and they import nothing from it.

## 2. Current Git / package-script situation

- Git: clean-tree gate is enforceable via `git status --porcelain`. Current working branch context
  is `marketing`; `main` is the integration branch. HEAD/branch are recordable via
  `git rev-parse HEAD` / `git rev-parse --abbrev-ref HEAD`.
- No root `package.json` (intentional). `orchestrator/package.json` will own the `orch` script.
- Verification scripts are per-tree (see §0 / §24). There is **no** repo-wide lint/test command, and we
  will not invent one (the spec explicitly warns against a repo-wide lint that trips on legacy code).

## 3. Installed Claude CLI version / capabilities
`claude` **2.1.233** — see §0. Key flags used: `-p`, `--output-format text`, `--permission-mode plan`,
`--disallowedTools`, `--model`, stdin prompt, `claude auth status`.

## 4. Installed Codex CLI version / capabilities
`codex-cli` **0.147.0** — see §0. Key flags used: `exec`, stdin prompt, `-s <sandbox>`,
`-a never`, `-o <file>`, `-C <dir>`, `codex login status`.

## 5. Confirmed safe non-interactive invocation strategy for Claude

**Planner (read-only):**
```
claude -p \
  --permission-mode plan \
  --disallowedTools Edit Write NotebookEdit \
  --output-format text \
  --model <opus|sonnet>            # optional; default account model otherwise
  < <run>/prompts/claude-plan.compiled.md   > <run>/claude-plan.md
```
**Diff auditor (read-only):** identical flags, different compiled prompt → `claude-diff-review.md`.

Read-only is guaranteed by the CLI (`--permission-mode plan`), **not** by prompt wording — satisfying
§19. `--disallowedTools` is a second, independent layer. We never pass
`--dangerously-skip-permissions` / `--allow-dangerously-skip-permissions`.

## 6. Confirmed safe non-interactive invocation strategy for Codex

**Plan reviewer (read-only):**
```
codex exec \
  --sandbox read-only \
  --ask-for-approval never \
  -C <repoRoot> \
  -o <run>/codex-plan-review.last.txt \
  < <run>/prompts/codex-plan-review.compiled.md   > <run>/logs/codex-plan-review.stdout.log
```
Then the orchestrator writes the full captured stdout to `codex-plan-review.md`.

**Implementer (write):**
```
codex exec \
  --sandbox workspace-write \
  --ask-for-approval never \
  -C <repoRoot> \
  -o <run>/codex-result.last.txt \
  < <run>/prompts/codex-implement.compiled.md   > <run>/logs/codex-implement.stdout.log
```
**Correction (write):** same as implementer with the correction prompt.

`workspace-write` is the smallest write mode exposed (§18); `danger-full-access` is never used.

## 7. Large-prompt / stdin strategy

- **Every** model prompt is composed to a file under `<run>/prompts/*.compiled.md` and delivered via
  **stdin redirection** (`< file`), never as an argv string. This is the whole point of §3 — no huge
  argument on the Windows command line.
- Codex stdin is documented (`exec` reads stdin when no prompt arg). Claude stdin is the standard
  `cat prompt | claude -p` path (`--input-format text` + `--print`).
- Node implementation: spawn with `stdio: ['pipe','pipe','pipe']`, then `child.stdin.write(promptText); child.stdin.end()`. No shell, no temp-arg, no interpolation — sidesteps argv limits entirely and is safe for multi-hundred-KB specs.
- **First-run smoke test (implementer must do once):** confirm `claude -p` consumes piped stdin as the
  prompt on this machine. If it ever doesn't, fallback = write the prompt to `<run>/prompts/x.md` and
  pass a *tiny* argv prompt telling Claude to `Read` that absolute path. (Codex needs no fallback.)

## 8. Subscription-auth / API-key safety strategy

Three independent layers (defense in depth), matching the spec's **hard-fail** preference:

1. **Startup hard-fail** (in `start` and `continue`): if `ANTHROPIC_API_KEY` **or** `OPENAI_API_KEY`
   is present in the environment, abort with a clear message before any subprocess launches. Rationale:
   these are the exact vars that could divert a CLI onto metered API billing. (Recommended over "warn"
   per your stated preference — accidental billing must be impossible.)
2. **Child-env scrub:** the process runner always deletes `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from
   the spawned child's env (`{ ...process.env, ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined }`).
   So even if layer 1 were bypassed, the CLIs cannot see an API key.
3. **Positive auth assertion:** at startup run `claude auth status` and `codex login status`
   (local, non-consuming). Require Claude `loggedIn: true` with `apiProvider: "firstParty"` /
   `authMethod: "claude.ai"`, and Codex `Logged in using ChatGPT`. If either shows API-key/not-logged-in,
   refuse. **No paid "test prompt" is ever issued** to check auth (§13).

We never use `--bare` (Claude) or `codex login --with-api-key` (Codex).

## 9. Exact Pass 1 workflow

```
start <spec>:
  validate env (node/npm/git/claude/codex present; API-key hard-fail; auth status OK)
  validate git clean; record baseCommit + startingBranch
  create runBranch  orch/<milestone>-<timestamp>  and checkout
  create run dir; copy spec verbatim -> <run>/spec.md; write state.json (CREATED)
  [PLANNING]        compile+run Claude planner        -> claude-plan.md
  [REVIEWING_PLAN]  compile+run Codex plan reviewer   -> codex-plan-review.md
                    extract FINAL_CODEX_IMPLEMENTATION_PROMPT -> codex-implementation-prompt.md
  state = WAITING_FOR_IMPLEMENTATION_APPROVAL   ── GATE 1 ── stop

continue (at GATE 1):
  show Claude verdict, reviewer verdict, corrections, prompt path; ask approve/reject
  reject -> state stays WAITING (or CANCELLED); approve ->
  [IMPLEMENTING]    compile+run Codex implementer (workspace-write) -> codex-result.md
  [REVIEWING_DIFF]  git diff <base> -> diff.patch; compile+run Claude auditor -> claude-diff-review.md
    while verdict == CORRECTIONS_REQUIRED and attempts < 2:
      [CORRECTING]  extract CODEX_CORRECTION_PROMPT; run Codex (workspace-write); attempts++
      [REVIEWING_DIFF] regen diff.patch; re-run Claude auditor
    if still CORRECTIONS_REQUIRED -> state = BLOCKED; stop (show findings)
  [VERIFYING]       run deterministic verification (§24); any required fail -> state = FAILED; stop
  state = WAITING_FOR_FINAL_APPROVAL   ── GATE 2 ── stop

continue (at GATE 2):
  show summary (§24); ask accept -> state = COMPLETED (no merge/push/deploy)
```

The **orchestrator** owns this sequence; models never choose the next stage (§4).

## 10. Exact state transitions

```
CREATED ─► PLANNING ─► REVIEWING_PLAN ─► WAITING_FOR_IMPLEMENTATION_APPROVAL
   (GATE 1 approve) ─► IMPLEMENTING ─► REVIEWING_DIFF
        REVIEWING_DIFF ─(CORRECTIONS_REQUIRED, attempts<2)─► CORRECTING ─► REVIEWING_DIFF
        REVIEWING_DIFF ─(APPROVED)─► VERIFYING
   VERIFYING ─(all pass)─► WAITING_FOR_FINAL_APPROVAL ─(GATE 2 accept)─► COMPLETED

Terminal/aborts:
  any model/stage crash or interruption      ─► FAILED (retryable from that stage; §25)
  REVIEWING_DIFF after 2 failed corrections   ─► BLOCKED
  any required verification fails             ─► FAILED
  planner verdict BLOCKED                      ─► BLOCKED (stop before Gate 1)
  reviewer verdict BLOCKED                     ─► BLOCKED (stop before Gate 1)
  user cancel                                  ─► CANCELLED
```
Implemented as a plain `switch (state.state)` loop — no state-machine framework (§11).

## 11. Exact human gates

- **GATE 1** — after plan + plan review (`WAITING_FOR_IMPLEMENTATION_APPROVAL`). Shows Claude verdict,
  reviewer verdict, reviewer corrections, and the path to `codex-implementation-prompt.md`. Approval is
  the **only** thing that grants Codex write access.
- **GATE 2** — after diff review APPROVED + all verification PASS (`WAITING_FOR_FINAL_APPROVAL`). Shows
  the summary in §24. Acceptance marks `COMPLETED`. **No** auto merge/push/deploy — ever.

Gate interaction: a gate is a **stop point**, not a live blocking prompt. `continue` re-reads
`state.json`; if at a gate it prints the summary and asks (single stdin y/N) — keeping the tool
resumable and crash-safe (§25) rather than holding a long-lived interactive process.

## 12. Exact CLI commands

```
npm run orch -- start <spec-file>   # validate, branch, plan, plan-review, stop at Gate 1
npm run orch -- continue            # advance from whatever gate/state we're parked at
npm run orch -- status              # print current run's state.json + stage summary (read-only)
npm run orch -- cancel              # mark active run CANCELLED (no git surgery; see §13/§26)
```
Four commands, no more. `start` refuses if an active (non-terminal) run already exists (§26).
`cancel` only flips state to `CANCELLED`; it does **not** delete the branch or touch git (user owns git).

## 13. Git branch / safety strategy

- **Refuse to start on a dirty tree** (`git status --porcelain` non-empty) with a message naming the
  action (commit or stash). No auto-stash.
- Record `startingBranch` (`git rev-parse --abbrev-ref HEAD`) and `baseCommit` (`git rev-parse HEAD`).
- **Auto-create the run branch** `orch/<milestone>-<timestamp>` and check it out. *Recommendation:*
  auto-create (not "require user already on a feature branch") — the timestamp makes it collision-safe,
  it's the smallest friction, and it guarantees Codex writes land on an isolated branch. `<timestamp>`
  = `YYYYMMDD-HHMMSS`.
- All Codex writes happen on that branch. The orchestrator **never** runs push/merge/rebase/`reset
  --hard`/force-checkout/branch-delete. Diffs are computed against the recorded `baseCommit` with
  read-only git (`git diff`), which does not mutate anything.
- After `COMPLETED`/`BLOCKED`/`FAILED`, the user does normal git integration themselves.

## 14. Run-directory format

```
orchestrator/runs/<milestone>-<timestamp>/
  state.json
  spec.md                          # verbatim copy of the input spec (original untouched)
  prompts/
    claude-plan.compiled.md
    codex-plan-review.compiled.md
    codex-implement.compiled.md
    claude-diff-review.compiled.md
    codex-correction-<n>.compiled.md
  claude-plan.md
  codex-plan-review.md
  codex-implementation-prompt.md   # extracted FINAL_CODEX_IMPLEMENTATION_PROMPT
  codex-result.md                  # implementer report (from -o last-message)
  diff.patch                       # git diff <baseCommit> (regenerated each review)
  claude-diff-review.md
  codex-correction-<n>.md
  verification.md                  # table of each check: name/cwd/cmd/exit/duration
  logs/
    <stage>.stdout.log  <stage>.stderr.log
```
`orchestrator/runs/` is gitignored except a committed `.gitkeep` (§27/§28).

## 15. State file schema (`state.json`)

```jsonc
{
  "runId": "1.23-custom-domains-20260816-141230",
  "milestone": "1.23",
  "title": "Custom Domains",
  "specPath": "orchestrator/milestones/1.23-custom-domains.md",   // original source path
  "state": "WAITING_FOR_IMPLEMENTATION_APPROVAL",
  "baseCommit": "2384039…",
  "startingBranch": "marketing",
  "runBranch": "orch/1.23-custom-domains-20260816-141230",
  "correctionAttempts": 0,
  "verdicts": {                       // filled as stages complete; used by `status`
    "claudePlan": "READY_FOR_IMPLEMENTATION",
    "codexPlanReview": "APPROVED_WITH_CORRECTIONS",
    "claudeDiffReview": null
  },
  "stageError": null,                 // set when a stage FAILED/INTERRUPTED (§25/§26)
  "createdAt": "2026-08-16T14:12:30Z",
  "updatedAt": "2026-08-16T14:19:02Z"
}
```
`milestone`/`title` are parsed from the spec filename/first heading; both overridable via optional
`start` flags if parsing is imperfect. One JSON file; validated on read with a small `zod` schema (§28).

## 16. `PROJECT_CONTEXT.md` structure

`orchestrator/PROJECT_CONTEXT.md` — one durable, hand-maintained doc (no auto-sync in Pass 1, §9 of
spec). Suggested sections:

1. **Runtime & topology** — Cloud Run (not GKE/K8s); legacy `client` separate from `platform`;
   `platform` = portal + public site-renderer + shared packages.
2. **Data & tenancy invariants** — path-based Firestore tenant isolation; renderer never touches
   Firestore, only sanitized public API; working content vs published snapshots are separate; working
   changes don't affect public state until publish/republish.
3. **Composition model** — `Home.sections` is the authoritative Home composition/order; navigation
   derives from it (no second nav-order model).
4. **Media** — provider-neutral media IDs persist; public URLs/dimensions hydrated at read time;
   internal storage-provider fields never persist in `SiteDefinition`.
5. **Lifecycle scope** — Branding and Business Profile participate in working/published lifecycle;
   presentation content ≠ structured business identity; public/canonical URL is infrastructure, not
   persisted CMS content; `resolveSiteBaseUrl(tenantId)` is the Custom Domains seam.
6. **Roles** — PLATFORM_ADMIN is the current CMS editing role.
7. **Engineering guardrails** — backward-compat without migrations for existing sites/snapshots; build
   incrementally; no speculative abstractions; don't implement future roadmap merely because useful.
8. **Verification commands** — the exact §24 command list (so planner/reviewer know what "green" means).
9. **Roadmap state** — 1.22 complete; **1.23 Custom Domains next** (do not pre-build it).

This file is concatenated into every prompt once, by the composer — never duplicated in the prompt
templates (§16 of spec).

## 17. Prompt files and responsibilities

`orchestrator/prompts/` (five role templates; each is *just the role*, no project context baked in):

| File | Role | Consumes | Emits (sentinels) |
|------|------|----------|-------------------|
| `claude-plan.md` | Architecture planner (read-only) | PROJECT_CONTEXT + spec | `# VERDICT` (`READY_FOR_IMPLEMENTATION`\|`BLOCKED`), `# PLAN` |
| `codex-plan-review.md` | Independent plan reviewer (read-only) | PROJECT_CONTEXT + spec + claude-plan | `# VERDICT` (`APPROVED`\|`APPROVED_WITH_CORRECTIONS`\|`BLOCKED`), `# CORRECTIONS`, `# FINAL_CODEX_IMPLEMENTATION_PROMPT` |
| `codex-implement.md` | Implementer (workspace-write) | the extracted final impl prompt | free-form `# IMPLEMENTATION_REPORT` (files added/modified, decisions, tests run, deviations, risks) |
| `claude-diff-review.md` | Diff auditor (read-only) | spec + plan + plan-review + impl-prompt + impl-report + diff.patch | `# VERDICT` (`APPROVED`\|`CORRECTIONS_REQUIRED`), `# FINDINGS`, `# CODEX_CORRECTION_PROMPT` |
| `codex-correction.md` | Corrector (workspace-write) | the extracted correction prompt (+ minimal context) | free-form correction report |

**Composer** (`prompts.ts`) assembles each `*.compiled.md` = role template + `PROJECT_CONTEXT.md` +
spec + prior-stage artifacts, with clear `## ===` delimiters. **Parsing rule:** only fixed headers are
machine-read — `# VERDICT` (next non-empty line is the token) and the `# FINAL_…` / `# CODEX_CORRECTION_PROMPT`
headers (everything after the header, to EOF or next `# `, is extracted). No arbitrary-prose parsing (§15 of spec).

## 18. Claude planner invocation
See §5 (planner block). Read-only via `--permission-mode plan` + `--disallowedTools`; prompt via stdin;
output `text` → `claude-plan.md`. Orchestrator parses `# VERDICT`; `BLOCKED` stops before Gate 1.

## 19. Codex plan-review invocation
See §6 (reviewer block). `--sandbox read-only --ask-for-approval never`; prompt via stdin;
`-o …last.txt` + full stdout → `codex-plan-review.md`. Orchestrator parses `# VERDICT` and extracts
`# FINAL_CODEX_IMPLEMENTATION_PROMPT` → `codex-implementation-prompt.md`. `BLOCKED` stops before Gate 1.

## 20. Codex implementer invocation
See §6 (implementer block). `--sandbox workspace-write --ask-for-approval never`; input =
`codex-implementation-prompt.md`; report captured via `-o` → `codex-result.md`. Runs **only** after
Gate 1 approval.

## 21. Claude diff-review invocation
See §5 (auditor block, read-only). Input bundle = spec + claude-plan + codex-plan-review +
codex-implementation-prompt + codex-result + **`diff.patch`** (produced by the orchestrator's own
`git diff <baseCommit>`, never Codex's self-summary — §21 of spec). Output → `claude-diff-review.md`;
parse `# VERDICT`.

## 22. Correction loop

```
attempts = state.correctionAttempts
while diffVerdict == CORRECTIONS_REQUIRED and attempts < 2:
    extract CODEX_CORRECTION_PROMPT from claude-diff-review.md
    compose codex-correction-<attempts+1>.compiled.md (correction prompt + spec + diff excerpt)
    run Codex exec --sandbox workspace-write --ask-for-approval never
    attempts++; persist correctionAttempts
    regenerate diff.patch = git diff <baseCommit>
    re-run Claude diff auditor (fresh) -> claude-diff-review.md
if diffVerdict != APPROVED: state = BLOCKED; stop and show findings
```
Hard cap **2** attempts (§22 of spec). No infinite loop; each correction is a fresh Codex process and a
fresh Claude review.

## 23. Process runner design

One helper `runProcess(opts)`:
- Input: `{ exe, args[], cwd, stdinText?, logStdoutPath, logStderrPath, live?: boolean }`.
- Uses **`execa`** (justified: correct Windows arg handling, no shell string, easy stdin/streams). No
  shell interpolation (`shell:false`).
- **Env scrub:** child env = `{ ...process.env }` minus `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (§8).
- Streams stdout/stderr to log files **and** (when `live`) tees to console.
- Returns `{ exitCode, stdout, stderr, durationMs }`; full output preserved (never truncated on disk).
- Windows note: resolve `claude`/`codex` via `execa`'s PATH resolution (`.cmd` shims handled). No
  `.bat` string building.

This is the only subprocess abstraction — no shell framework (§14 of spec).

## 24. Deterministic verification commands (from the actual repo)

Run in this fixed order; each recorded as `{ name, cwd, command, exitCode, durationMs, logPath }` into
`verification.md`. All are **required** unless marked optional.

| # | Name | cwd | Command | Notes |
|---|------|-----|---------|-------|
| 1 | server-test | `server/` | `npm test` | `node --import ./test/setup.js --test test/*.test.js` |
| 2 | server-lint | `server/` | `npm run lint` | StandardJS; already green on the tree |
| 3 | platform-typecheck | `platform/` | `npm run typecheck` | `tsc --noEmit` across apps (`--if-present`) |
| 4 | platform-lint | `platform/` | `npm run lint` | eslint across apps |
| 5 | platform-build | `platform/` | `npm run build` | `next build` for portal + site-renderer |
| 6 | *(optional)* renderer-test | `platform/apps/site-renderer/` | `npm test` | only if the milestone touches the renderer |

- **`npm ci`/install is a prerequisite, not run automatically** — assume `server/` and `platform/`
  deps are installed (they are, per `node_modules` present). If a build fails on missing deps, that's a
  FAILED with a clear log, not an auto-install.
- We deliberately do **not** add a repo-wide lint/test (spec §23). We do **not** run `client/` checks
  (out of platform scope for these milestones).
- Any required check with non-zero exit → `state = FAILED`, stop, surface the log path. **Pass 1 does
  not auto-repair test failures** (your stated preference, §23 of spec).

## 25. Resume behavior

- Stage-level resume only. `continue` reads `state.json` and dispatches on `state.state`:
  - at a `WAITING_*` gate → present the gate.
  - mid-pipeline non-terminal (e.g. process died leaving `IMPLEMENTING`) → treat the stage as
    `INTERRUPTED`: `stageError` is set, and `continue` **re-runs that one stage** from its input
    artifacts (idempotent: prompts are already compiled; Codex writes are on the run branch; re-running
    a stage overwrites its output artifact).
  - `COMPLETED`/`CANCELLED`/`BLOCKED`/`FAILED` → `continue` refuses with an explanation.
- We do not checkpoint sub-stage progress. Re-running a whole stage is the smallest clean recovery.
- **Recommendation:** write `state.json` transactionally (write temp file + rename) before and after
  each stage so a crash never leaves a half-written state file.

## 26. Error behavior

- **Missing tool / bad auth / API key present:** hard-fail at startup with a specific message; no run
  dir created.
- **Dirty git tree:** refuse `start`; name the fix.
- **Another active run exists** (non-terminal `state.json` under `runs/`): refuse `start` (§26 of spec).
- **Model verdict BLOCKED** (planner or reviewer): stop before Gate 1, `state = BLOCKED`, show verdict.
- **Subprocess non-zero / crash:** mark stage `FAILED`/`INTERRUPTED`; `continue` retries that stage.
- **2 corrections exhausted:** `state = BLOCKED`.
- **Verification failure:** `state = FAILED`, show failing log path.
- All failures are **non-destructive** — the run branch and artifacts remain for inspection; the user
  decides git cleanup.

## 27. Dependencies

Minimal set (§28 of spec):
- `typescript`, `tsx` (run TS directly, no build step).
- `execa` (subprocess runner).
- `zod` (validate `state.json` only — small, justified).
- **No** arg-parser dependency: a ~30-line manual `argv` switch is enough for 4 commands (commander
  optional if preferred, but not needed).
- Explicitly **not** used: LangChain, Temporal, BullMQ, Redis, any agent/workflow SDK, Anthropic/OpenAI
  SDKs. **No Anthropic/OpenAI/Codex API SDK of any kind** (§1 hard constraint).

## 28. Files to add

```
orchestrator/
  package.json                 # {"scripts":{"orch":"tsx src/cli.ts"}}, deps above
  tsconfig.json
  .gitignore                   # runs/ (except .gitkeep), node_modules/
  PROJECT_CONTEXT.md           # §16
  README.md                    # how to run start/continue/status/cancel
  src/
    cli.ts                     # argv dispatch: start|continue|status|cancel
    workflow.ts                # the stage switch/loop (§9/§10)
    state.ts                   # load/save/validate state.json (zod), atomic write
    process.ts                 # runProcess() + env scrub (§23)
    git.ts                     # clean check, base commit, branch create, diff
    claude.ts                  # planner + diff-auditor invocations (§5)
    codex.ts                   # reviewer + implementer + corrector invocations (§6)
    prompts.ts                 # compose *.compiled.md; parse VERDICT + extract prompt blocks
    verify.ts                  # run §24 checks; write verification.md
    doctor.ts                  # env/tool/auth/API-key validation (§8/§13)
  prompts/
    claude-plan.md
    codex-plan-review.md
    codex-implement.md
    claude-diff-review.md
    codex-correction.md
  milestones/                  # (optional) home for input specs, e.g. 1.23-custom-domains.md
    .gitkeep
  runs/
    .gitkeep
```
~10 TS modules + 5 prompts + 1 context file — within the spec's "handful of modules" target (§32).

## 29. Files to modify

- **Root `.gitignore`** — append:
  ```
  orchestrator/node_modules/
  orchestrator/runs/*
  !orchestrator/runs/.gitkeep
  ```
That is the **only** change outside `orchestrator/`.

## 30. Files explicitly unchanged

`client/**`, `server/**`, `platform/**`, `extension/**`, `addon/**`, existing `docs/**` (except this new
plan doc), root `package`-less layout, `CLAUDE.md`, `AGENTS.md`, `firestore*.json`, `firebase.json`. The
orchestrator adds **no** root `package.json` and performs **no** workspace migration (§8 of spec).

## 31. Automated tests for the orchestrator itself

`node --test` (zero new test framework), pure-function focus:
- `prompts.ts`: VERDICT parsing (each valid token + malformed), extraction of
  `FINAL_CODEX_IMPLEMENTATION_PROMPT` / `CODEX_CORRECTION_PROMPT` (present, missing, trailing content),
  composer concatenation/ordering.
- `state.ts`: zod validation (valid/invalid), atomic write+read round-trip, transition legality helper.
- `git.ts`: parse porcelain/branch/rev-parse output from **fixtures** (no real repo mutation).
- `verify.ts`: builds the correct command list; records results from a stubbed `runProcess`.
- `doctor.ts`: API-key-present → fail; auth-status JSON parsing (Claude firstParty vs api).
- `process.ts`: env-scrub removes both keys; args passed as array (spawn a trivial `node -e` echo).

**Not** unit-tested: real `claude`/`codex` invocations (would consume calls / be non-deterministic) —
covered by the manual procedure below.

## 32. Manual verification procedure for Pass 1

1. `cd orchestrator && npm install`.
2. Negative auth test: `ANTHROPIC_API_KEY=x npm run orch -- status` → hard-fails with the API-key message.
3. Dirty-tree test: touch a file, `npm run orch -- start <spec>` → refuses, names the fix. Revert.
4. Happy path with a **tiny** throwaway spec (e.g. "add a code comment to a scratch file"):
   `start` → inspect `claude-plan.md` + `codex-plan-review.md` + extracted impl prompt; confirm Gate 1.
5. `continue` → approve → confirm Codex wrote on `orch/…` branch; inspect `codex-result.md`, `diff.patch`,
   `claude-diff-review.md`; confirm verification ran (`verification.md`); confirm Gate 2.
6. `continue` → accept → `state = COMPLETED`; confirm no push/merge happened (`git log`, `git branch`).
7. Resume test: kill the process during `IMPLEMENTING`; `continue` re-runs that stage cleanly.
8. Concurrency test: with an active run, `start` another → refused.

## 33. Concrete risks

1. **Claude stdin-as-prompt not behaving as expected on this box** → smoke-test in step 4; fallback in §7.
2. **CLI flag drift** (both tools self-update) — e.g. `--permission-mode` values or `codex exec` flags
   change. Mitigation: `doctor` prints both `--version`s into the run log; keep invocations in one place
   (`claude.ts`/`codex.ts`).
3. **Verdict-sentinel adherence** — a model may not emit the exact header. Mitigation: strong prompt
   templates with an explicit "output contract" section; parser fails **loudly** (stage FAILED) rather
   than guessing, so a human notices.
4. **Codex `workspace-write` scope** — could write outside intended files. Mitigation: it's already on
   an isolated run branch; the Claude diff auditor + human Gate 2 are the checks; diff is reviewed
   before any integration.
5. **Long-running builds** (`next build` ×2) — verification can take minutes. Mitigation: live-stream +
   log; no hard timeout in Pass 1 (or a generous one), surface duration.
6. **Repo-root context weight** — auto-loaded `CLAUDE.md`/`AGENTS.md` (115 KB) inflate every prompt.
   Acceptable in Pass 1; note it if latency/limits bite.
7. **`nul` file at repo root** (a stray Windows artifact) — harmless to the orchestrator; flagged for
   the user's awareness, not touched.

## 34. Anything that should be simplified further

- **Drop `--json`/`--output-schema`/`--json-schema`** entirely in Pass 1 — plain `text` output +
  Markdown sentinels is enough and more debuggable (§15 of spec agrees).
- **No commander** — 4 commands don't justify a dep.
- **One diff granularity** — `git diff <base>` (full) + `--stat` (summary); nothing fancier.
- **`cancel` does not touch git** — only flips state; keeps the tool out of destructive git territory.
- Keep `doctor` as an internal function invoked by `start`/`continue`, not a separate command (§13).

## 35. Recommended Pass 2 Playwright boundary

- Pass 1 ends at **deterministic verification** (§24). Structure `verify.ts` so it consumes an ordered
  **array of check descriptors** and runs them uniformly. Pass 2 appends browser-based descriptors
  (Playwright E2E against a locally launched portal/renderer with persisted dev auth state) to that same
  array — **no CLI/state redesign**, just more entries and a new `state = VERIFYING` sub-runner.
- Do **not** add Playwright, MCP, browser abstractions, or dev-auth persistence now (§29 of spec). The
  seam is: `verify.ts` exports `runChecks(checks: Check[])`; Pass 2 supplies additional `Check`s.
- Custom Domains (Step 1.23) is the **first real milestone** to run through the finished pipeline —
  not implemented here (§30 of spec).

---

## 36. Final verdict

# READY FOR IMPLEMENTATION

The design fits the spec's hard constraints: subscription-CLI execution only (no API SDKs/keys; verified
`claude.ai` + `ChatGPT` auth, with hard-fail + child-env scrub as guards), large prompts via stdin,
enforced read-only vs. `workspace-write` sandboxing from real CLI flags, two human gates, isolated
run branch with no destructive git, plain-file run storage, ~10 small modules + 5 prompts + 1 context
file, and deterministic verification wired to the repo's actual scripts. Only one item needs a live
confirmation during implementation (Claude stdin-as-prompt, §7/§33-1), and it has a documented fallback.

**No code was modified in producing this plan.**
