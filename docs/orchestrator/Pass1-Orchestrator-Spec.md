# BakerRang Orchestrator — Pass 1 Planning Assignment

DO NOT MODIFY CODE.

We want to build a SMALL local CLI utility inside the BakerRang repository
that automates the development workflow we have already been using manually.

This is NOT intended to become a separate agent platform or product.

The goal is simply to remove repetitive copying/pasting between:

- Claude Code
- Codex CLI
- shell/test commands

while retaining the useful independent planning/review loop.

============================================================
1. HARD CONSTRAINT — NO API BILLING
   ============================================================

The orchestrator MUST NOT call:

Anthropic API
OpenAI API

Do not use:

ANTHROPIC_API_KEY
OPENAI_API_KEY
Anthropic SDK
OpenAI API SDK
Claude Agent SDK
OpenAI Agents SDK
Codex SDK

The user's existing subscription-authenticated command-line tools are the
execution mechanism:

claude

codex

The orchestrator launches those local CLIs as subprocesses.

It must deliberately avoid introducing separate API billing.

============================================================
2. INSPECT LOCAL ENVIRONMENT FIRST
   ============================================================

Before designing exact subprocess arguments, inspect:

claude --version
claude --help

codex --version
codex --help
codex exec --help

and any available LOCAL authentication/status commands documented by the
installed versions.

The locally-installed CLI versions and their --help output are the source of
truth.

Do NOT assume flags merely because older/newer documentation shows them.

Document:

- installed Claude CLI version
- installed Codex CLI version
- exact non-interactive invocation available
- whether prompts can be supplied through stdin
- available read-only / plan modes
- available write/sandbox modes
- output options useful for orchestration
- local auth-status command if any

============================================================
3. IMPORTANT WINDOWS / PROMPT SIZE CONSTRAINT
   ============================================================

Milestone specifications can be VERY large.

Do NOT design the orchestrator around:

claude -p "<huge prompt>"

or:

codex exec "<huge prompt>"

if that requires putting the entire prompt into the process command line.

Windows command-line length limits make that fragile.

Prefer:

stdin
temporary prompt files
or another supported file/stdin mechanism

after verifying what the locally installed CLIs support.

The orchestrator should be able to pass very large specs/plans reliably.

============================================================
4. PRODUCT GOAL
   ============================================================

The desired workflow is:

SPEC FILE
↓
CLAUDE PLAN
↓
CODEX PLAN REVIEW
↓
HUMAN APPROVAL
↓
CODEX IMPLEMENTATION
↓
CLAUDE DIFF REVIEW
↓
OPTIONAL CODEX CORRECTION
↓
DETERMINISTIC TESTS
↓
HUMAN FINAL REVIEW

The orchestrator itself controls the sequence.

The models do NOT decide which workflow stage occurs next.

============================================================
5. ROLES
   ============================================================

Claude invocation #1:

ARCHITECTURE PLANNER

- inspect repository
- inspect current shipped code
- read milestone specification
- read project architectural guardrails
- DO NOT edit code
- produce implementation plan
- verdict READY or BLOCKED

Codex invocation #1:

INDEPENDENT PLAN REVIEWER

- fresh context
- read original specification
- read project guardrails
- read Claude's plan
- optionally inspect repository read-only
- challenge incorrect assumptions
- find architecture problems
- find scope expansion
- find security/data-lifecycle problems
- find missing tests/backward compatibility
- produce final corrected implementation prompt
- DO NOT modify code

Codex invocation #2:

IMPLEMENTER

- fresh context
- receives FINAL reviewed implementation prompt
- permitted to modify repository
- implements the milestone
- runs appropriate scoped checks if useful
- produces an implementation report

Claude invocation #2:

IMPLEMENTATION / DIFF AUDITOR

- fresh context
- read-only
- receives:
  original spec
  Claude plan
  Codex plan review/corrections
  final Codex implementation prompt
  implementation report
  git diff
- determines whether implementation satisfies approved contract
- does NOT propose unrelated improvements
- returns:
  APPROVED
  or
  CORRECTIONS_REQUIRED
- if corrections required, supplies a narrow Codex correction prompt

Codex correction:

- workspace-write
- receives only the approved correction request + necessary context
- fixes implementation

Then Claude re-reviews.

Maximum:
2 correction passes.

After 2 failed review/correction loops:
STOP and require human intervention.

============================================================
6. HUMAN GATES
   ============================================================

Pass 1 should have only TWO mandatory human gates.

GATE 1:

after Claude plan + Codex plan review

Show:

- Claude verdict
- reviewer verdict
- reviewer corrections
- path to final implementation prompt

Ask user to approve before Codex gets write access.

GATE 2:

after implementation review and deterministic verification

Show:

- implementation result
- Claude review verdict
- test/build results
- branch name
- diff summary

Require human final acceptance.

Do NOT automatically:

merge
push
deploy
modify production

============================================================
7. GIT SAFETY
   ============================================================

Do NOT build worktree support in Pass 1 unless there is a compelling reason.

Keep Git behavior simple.

Recommended:

- require Git working tree to be clean before `start`
- record current branch
- record current HEAD commit
- create a feature branch for the orchestration run

Example:

orch/1.23-custom-domains

or a duplicate-safe timestamped equivalent.

All Codex writes happen on that branch.

Do NOT:

push
merge
rebase
reset --hard
force checkout
delete branches

automatically.

If Git is dirty:
refuse to start and explain what needs to be committed/stashed.

Evaluate whether branch creation should happen automatically or whether the
CLI should require the user to already be on the desired feature branch.

Recommend the smallest safe approach.

============================================================
8. MINIMAL REPOSITORY LOCATION
   ============================================================

Prefer:

/orchestrator

inside the BakerRang repository.

This must remain independent of:

/client
/server
/platform

Do not create a root workspace migration merely for the orchestrator.

Inspect the repo before finalizing.

Potential structure:

orchestrator/
package.json
tsconfig.json

src/
cli.ts
workflow.ts
state.ts
process.ts
git.ts
claude.ts
codex.ts
verify.ts

prompts/
claude-plan.md
codex-plan-review.md
codex-implement.md
claude-diff-review.md
codex-correction.md

PROJECT_CONTEXT.md

runs/
.gitkeep

Do not create dozens of abstraction files.

Prefer fewer files where sensible.

============================================================
9. PROJECT CONTEXT
   ============================================================

The orchestrator needs ONE durable project context document.

Prefer:

orchestrator/PROJECT_CONTEXT.md

It should contain durable architectural constraints, not every historical
milestone conversation.

Important existing BakerRang constraints to seed into it:

- Runtime is Google Cloud Run, not Kubernetes/GKE.
- Existing legacy BakerRang client remains separate from the new platform.
- Platform workspace contains portal + public site renderer + shared packages.
- Public renderer must not directly access Firestore.
- Public renderer reads sanitized public API responses.
- Firestore uses path-based tenant isolation.
- PLATFORM_ADMIN is currently the website/CMS editing role.
- Working content and published snapshots are intentionally separate.
- Working changes must not affect normal public state until publish/republish.
- Home.sections is the authoritative Home composition/order.
- Navigation derives from Home.sections; no second nav-order model.
- Media persists provider-neutral media IDs.
- Public Media URLs/dimensions are hydrated at read time.
- Internal storage provider fields must never persist in SiteDefinition.
- Branding participates in the working/published lifecycle.
- Business Profile participates in the working/published lifecycle.
- Presentation content is not structured business identity.
- Public/canonical URL is infrastructure, not persisted CMS content.
- resolveSiteBaseUrl(tenantId) is the future Custom Domain seam.
- Existing sites/snapshots generally require backward compatibility without
  migrations.
- Build incrementally; avoid speculative abstractions.
- Do not implement future roadmap features merely because they seem useful.

Also document current roadmap state:

1.22 complete
1.23 Custom Domains next

The context file should be manually maintainable.

Do NOT build automatic architecture-memory synchronization in Pass 1.

============================================================
10. RUN STORAGE
    ============================================================

Keep run storage simple.

Suggested:

orchestrator/runs/
1.23-custom-domains-<timestamp>/
state.json
spec.md
claude-plan.md
codex-plan-review.md
codex-implementation-prompt.md
codex-result.md
diff.patch
claude-diff-review.md
codex-correction-1.md
verification.md
logs/

No database.

No Redis.

No workflow engine.

No persistence service.

Plain files.

`runs/*` should probably be gitignored.

============================================================
11. STATE
    ============================================================

Use one small:

state.json

Example conceptual information:

{
runId,
milestone,
title,
state,
baseCommit,
startingBranch,
runBranch,
correctionAttempts
}

Possible states:

CREATED

PLANNING

REVIEWING_PLAN

WAITING_FOR_IMPLEMENTATION_APPROVAL

IMPLEMENTING

REVIEWING_DIFF

CORRECTING

VERIFYING

WAITING_FOR_FINAL_APPROVAL

COMPLETED

FAILED

BLOCKED

CANCELLED

Do not build a generic workflow/state-machine framework.

A simple TypeScript switch/loop is enough.

============================================================
12. CLI COMMANDS
    ============================================================

We want very few commands.

Evaluate something close to:

npm run orch -- start <spec-file>

npm run orch -- continue

npm run orch -- status

Possibly:

npm run orch -- cancel

Do not add commands unless useful.

`start`:

- validates environment
- validates Git
- copies spec into run folder
- launches Claude planner
- launches Codex plan reviewer
- stops at Gate 1

`continue`:

At Gate 1:
- asks for approval
- runs implementation
- runs diff review
- correction loop if needed
- runs deterministic verification
- stops at Gate 2

At Gate 2:
- marks complete when approved

Determine clean interaction behavior.

No web UI.

============================================================
13. DOCTOR / STARTUP VALIDATION
    ============================================================

We may not need a separate `doctor` command.

Startup can validate:

git executable exists
node/npm available
claude executable exists
codex executable exists

Warn or REFUSE when environment contains:

ANTHROPIC_API_KEY
OPENAI_API_KEY

The intent is subscription-backed CLI auth, not API usage.

Recommend whether:

- API key presence should warn
  or
- API key presence should hard-fail

My preference:
hard-fail by default so accidental API billing cannot occur.

If supported by installed CLIs, verify their subscription login/auth state
without consuming a model call.

If no reliable auth-status command exists:
report that and let the first invocation expose auth failure.

Do not perform a paid/usage-consuming "test prompt" merely to check auth.

============================================================
14. PROCESS RUNNER
    ============================================================

Build one reusable subprocess helper.

Requirements:

- explicit executable + argument array
- cwd
- optional stdin
- stdout capture
- stderr capture
- exit code
- duration
- optional live console streaming
- log file
- NO shell string interpolation where avoidable
- compatible with Windows
- preserve full output

Use a lightweight library such as execa if justified.

Do not build a shell abstraction framework.

============================================================
15. MODEL OUTPUT FORMAT
    ============================================================

V1 does NOT need complex JSON Schema integration unless the locally-installed
CLIs make it extremely easy/reliable.

Readable Markdown artifacts are valuable.

Prefer stable sentinel sections.

Claude planner output:

# VERDICT

READY_FOR_IMPLEMENTATION
or
BLOCKED

# PLAN

...

Codex plan reviewer:

# VERDICT

APPROVED
APPROVED_WITH_CORRECTIONS
BLOCKED

# CORRECTIONS

...

# FINAL_CODEX_IMPLEMENTATION_PROMPT

...

The orchestrator extracts everything after the final implementation-prompt
heading into the implementer prompt file.

Claude diff review:

# VERDICT

APPROVED
or
CORRECTIONS_REQUIRED

# FINDINGS

...

# CODEX_CORRECTION_PROMPT

...

Only require machine parsing of small fixed verdict/header fields.

Do NOT make the system dependent on parsing arbitrary prose.

============================================================
16. PROMPT COMPOSITION
    ============================================================

Prompts should be templates stored under:

orchestrator/prompts

The runner assembles:

base role prompt
+
PROJECT_CONTEXT.md
+
milestone spec
+
previous stage artifact(s)

Do not bake huge prompt strings into TypeScript.

Do not duplicate PROJECT_CONTEXT in every prompt file.

============================================================
17. SPEC INPUT
    ============================================================

The orchestrator does NOT need to generate product specifications.

The user/ChatGPT workflow will produce milestone specification files.

Example:

orchestrator/milestones/1.23-custom-domains.md

or another repo path.

`start` accepts the spec path.

It copies the exact spec into the run folder.

The original spec remains untouched.

No AI spec-generation stage in Pass 1.

============================================================
18. CODEX WRITE SAFETY
    ============================================================

Only implementation/correction Codex invocations may write.

Planner/reviewer/auditor roles must be read-only where supported.

Implementation should use the smallest supported workspace-write/sandbox
permission exposed by the locally installed Codex CLI.

Do not use dangerous/full-access mode unless technically unavoidable.

If installed CLI behavior prevents a safe distinction:
report it rather than silently granting broad permissions.

============================================================
19. CLAUDE WRITE SAFETY
    ============================================================

Claude planner and diff auditor must not modify files.

Use the safest available installed CLI plan/read-only configuration.

If Claude CLI cannot guarantee a useful read-only mode in the installed
version:
design a backup safety mechanism and explain it.

Do not simply trust prompt wording when a permission mode exists.

============================================================
20. IMPLEMENTATION REPORT
    ============================================================

Codex should produce a concise report after implementation:

files added
files modified
major decisions
tests run
test results
deviations
risks

The orchestrator stores it verbatim.

Do not require Codex to prove tests passed.

The orchestrator independently runs verification afterward.

============================================================
21. GIT DIFF REVIEW
    ============================================================

After implementation:

the orchestrator runs Git itself.

Generate review evidence based on the recorded base commit.

At minimum:

git diff --stat <baseCommit>
git diff <baseCommit>

Store:

diff.patch

Claude receives the actual diff plus implementation artifacts.

Do not ask Codex to summarize its own diff and treat that as evidence.

============================================================
22. CORRECTION LOOP
    ============================================================

If Claude returns:

CORRECTIONS_REQUIRED

extract:

CODEX_CORRECTION_PROMPT

Run Codex in workspace-write mode.

Then regenerate:

git diff <baseCommit>

and ask a fresh Claude review again.

Maximum:

2 correction attempts.

If still not approved:

state = BLOCKED

Show the findings to the human.

No infinite loop.

============================================================
23. DETERMINISTIC VERIFICATION
    ============================================================

The orchestrator itself runs real verification commands.

Do NOT rely on statements such as:

"Codex reports tests passed."

Inspect current BakerRang package scripts and determine the exact default
verification commands.

Expected current pattern likely includes:

server:
npm test

platform:
npm run typecheck
npm run lint
npm run build

But inspect actual package.json files before finalizing.

Potentially include changed-backend-file StandardJS checks if there is a
reliable repo-supported command.

Do not invent a repository-wide lint command that already fails due to known
legacy unrelated code.

Record for each verification:

name
cwd
command
exit code
duration
stdout/stderr log

Any required verification failure:

state = FAILED

Do NOT automatically ask Codex to repair test failures in Pass 1 unless that
can be added with almost no complexity.

My preference:
Pass 1 simply stops and shows the failure.

We can decide later whether automatic test-failure correction is actually
useful.

============================================================
24. FINAL HUMAN GATE
    ============================================================

When:

Claude diff review = APPROVED

and

all deterministic verification commands pass

show a concise summary:

Milestone
Branch
Base commit

Claude plan verdict
Codex review verdict
Claude diff verdict

Files changed
Diff stat

Verification:
PASS/PASS/PASS

Then:

WAITING FOR FINAL APPROVAL

No merge.

No push.

No deployment.

Final approval marks the run:

COMPLETED

The user remains responsible for normal Git integration.

============================================================
25. RESUME
    ============================================================

Basic resume is important.

If the process exits at either human gate or crashes:

`continue`

should read:

state.json

and continue from the current stage rather than rerunning everything.

Do not build arbitrary checkpoint recovery for every line of code.

Stage-level resume is enough.

For an interrupted active model subprocess:

mark the stage FAILED/INTERRUPTED and allow retry from that stage.

Recommend the smallest clean behavior.

============================================================
26. CONCURRENCY
    ============================================================

Pass 1 should support ONE active orchestration run at a time.

Do not build parallel milestone execution.

If another active run exists:

refuse to start.

This avoids branch/repo collisions and keeps implementation simple.

============================================================
27. SECURITY / SECRETS
    ============================================================

Never copy:

Claude credentials
Codex credentials
browser credentials
Google credentials

into run artifacts.

Do not log entire environment variables.

Redact obvious secret env names if environment logging is needed.

runs/
should be ignored.

No API keys.

============================================================
28. DEPENDENCIES
    ============================================================

Keep dependencies minimal.

Potential:

typescript
tsx
execa
commander OR a tiny manual argv parser

Maybe zod if truly useful.

Avoid dependency-heavy orchestration libraries.

Do not use:

LangChain
Temporal
BullMQ
Redis
workflow engines
agent frameworks

Recommend the smallest set.

============================================================
29. PLAYWRIGHT IS OUT OF PASS 1
    ============================================================

Do NOT implement Playwright or MCP in this pass.

Pass 2 will add:

- Playwright
- persistent DEV auth state
- repeatable E2E verification
- maybe Playwright MCP only if adaptive browser reasoning is actually needed

Pass 1 ends after deterministic tests/builds.

However:

structure the final verification stage so browser verification can be added
later without redesigning the whole CLI.

Do not create browser abstractions yet.

============================================================
30. FIRST REAL USE
    ============================================================

Once Pass 1 and then Playwright Pass 2 are working, the first real BakerRang
milestone run through the orchestrator will be:

Step 1.23 — Custom Domains

Do NOT implement Custom Domains as part of this task.

============================================================
31. NON-GOALS
    ============================================================

Do NOT build:

web dashboard
database
API server
workflow service
background daemon
agent SDK integration
API billing integration
MCP orchestration server
production deployment
GitHub integration
automatic commits
automatic pushes
automatic merges
PR creation
notifications
multi-user support
parallel agents
cost dashboards
token accounting

This is a local convenience CLI.

============================================================
32. IMPLEMENTATION SIZE
    ============================================================

Strong preference:

small enough that a senior engineer can understand the whole orchestration
implementation quickly.

Aim for roughly:

a handful of TypeScript modules
five prompt files
one context file

Avoid architecture astronautics.

If your plan starts looking like a standalone SaaS application:
simplify it.

============================================================
DELIVERABLE
============================================================

Return:

1. Current BakerRang repo structure relevant to adding /orchestrator.
2. Current Git/package-script situation.
3. Installed Claude CLI version/capabilities.
4. Installed Codex CLI version/capabilities.
5. Confirmed safe non-interactive invocation strategy for Claude.
6. Confirmed safe non-interactive invocation strategy for Codex.
7. Large-prompt/stdin strategy.
8. Subscription-auth / API-key safety strategy.
9. Exact Pass 1 workflow.
10. Exact state transitions.
11. Exact human gates.
12. Exact CLI commands.
13. Git branch/safety strategy.
14. Run-directory format.
15. State file schema.
16. PROJECT_CONTEXT structure.
17. Prompt files and responsibilities.
18. Claude planner invocation.
19. Codex plan-review invocation.
20. Codex implementer invocation.
21. Claude diff-review invocation.
22. Correction loop.
23. Process runner design.
24. Deterministic verification commands based on the actual repo.
25. Resume behavior.
26. Error behavior.
27. Dependencies.
28. Files to add.
29. Files to modify.
30. Files explicitly unchanged.
31. Automated tests for the orchestrator itself.
32. Manual verification procedure for Pass 1.
33. Concrete risks.
34. Anything that should be simplified further.
35. Recommended Pass 2 Playwright boundary.
36. Final verdict:

READY FOR IMPLEMENTATION

or

BLOCKED

DO NOT MODIFY CODE.