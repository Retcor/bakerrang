# BakerRang Orchestrator — Pass 1

A small local TypeScript CLI that coordinates milestone planning, independent plan review, human approval, implementation, diff audit/correction, deterministic verification, and final human acceptance.

It uses the locally installed Claude Code and Codex CLIs with subscription authentication. It does not intentionally invoke Anthropic or OpenAI APIs and includes no model API or agent SDK. Every child environment has `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` removed; any model stage refuses to start if either variable exists in the parent environment.

## Prerequisites

- Node.js 20+ and npm
- Git
- Claude Code authenticated by `claude auth status` with `loggedIn=true`, `authMethod=claude.ai`, and `apiProvider=firstParty`
- Codex authenticated by `codex login status` as “Logged in using ChatGPT”
- Existing dependencies for `server` and `platform` when the verification stage is reached

Install only the orchestrator dependencies:

```text
cd orchestrator
npm install
```

## Commands

Run from `orchestrator`:

```text
npm run orch -- start <spec-file>
npm run orch -- continue
npm run orch -- status
npm run orch -- cancel
```

`start` accepts any normal filesystem path, copies the specification verbatim, requires a completely clean Git tree, records the current branch and commit, and creates `orch/<milestone>-<timestamp>`. It never stashes or commits. Only one non-terminal run is supported.

`status` and `cancel` never invoke AI, perform auth checks, or reject API-key environment variables. Cancel only marks state; it does not delete files or branches. There is no public doctor command.

## Human gates and safety

Gate 1 follows the Claude plan and fresh Codex review. `continue` asks before any write-capable model runs. Gate 2 is reached only after Claude approves the actual diff and all seven deterministic checks pass; `continue` asks before marking the run complete. Gate 2 needs no current model authentication.

Claude planning/audit stages use plan permission mode and deny edit/write tools. Codex review uses a read-only sandbox. Each read-only stage also compares Git porcelain state before and after, including untracked files, and fails without reverting anything if mutation occurs. Codex implementation/correction uses `workspace-write`; an interrupted write stage requires an explicit retry warning and confirmation.

No stage automatically pushes, merges, rebases, resets, checks out another branch, deletes a branch, commits, deploys, installs dependencies, or repairs failed deterministic tests.

## Run artifacts

Ignored run data is written under `runs/<milestone>-<timestamp>/`:

```text
state.json
spec.md
prompts/*.compiled.md
claude-plan.md
codex-plan-review.md
codex-implementation-prompt.md
codex-result.md
diff.patch
diff-stat.txt
claude-diff-review.md
codex-correction-prompt-N.md
codex-correction-N.md
verification.md
logs/*
```

Prompts are compiled to files and piped through stdin—never placed in process arguments. Codex verdicts and reports come only from `--output-last-message`; stdout/stderr remain diagnostic logs. Terminal prompt sentinels are parsed through EOF, so Markdown headings inside an implementation or correction prompt are preserved.

State is schema-validated and atomically replaced through a temporary file. Safe read-only or deterministic stages can be retried with `continue`; write-capable retries always require confirmation because partial edits may remain.

## Tests

```text
npm test
npm run typecheck
```

Unit tests do not invoke Claude or Codex. Pass 1 deliberately contains no Playwright/browser automation and does not implement BakerRang Step 1.23 Custom Domains.
