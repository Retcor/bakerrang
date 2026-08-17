import { cp, mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeRun, latestRun, readState, RunState, RunStateName, terminalStates, writeState } from './state.js';
import { compareMutationSnapshots, createBranch, generateDiffEvidence, mutationSnapshot, readDiffStat, repositoryIdentity, requireClean } from './git.js';
import { validateAuthForAiStages, validateClaudeSubscription, validateCodexSubscription, validateToolsAndAuth } from './doctor.js';
import { compilePrompt, extractSectionBefore, extractTerminalSection, parseVerdict } from './prompts.js';
import { runClaudeReadOnly } from './claude.js';
import { runCodex } from './codex.js';
import { runVerification } from './verify.js';

const orchestratorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(orchestratorRoot, '..');
const runsDir = path.join(orchestratorRoot, 'runs');
const promptsDir = path.join(orchestratorRoot, 'prompts');
const contextPath = path.join(orchestratorRoot, 'PROJECT_CONTEXT.md');

class MutationError extends Error {
  constructor(public changedPaths: string[]) {
    super(`Read-only model stage changed repository paths:\n${changedPaths.join('\n')}\nNo files were reverted.`);
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'milestone';
}

async function readonlyGuard(runDir: string, action: () => Promise<void>): Promise<void> {
  const logs = path.join(runDir, 'logs');
  const before = await mutationSnapshot(repoRoot, logs);
  let actionError: unknown;
  try { await action(); } catch (error) { actionError = error; }
  const after = await mutationSnapshot(repoRoot, logs);
  const changed = compareMutationSnapshots(before, after);
  if (changed.length) throw new MutationError(changed);
  if (actionError) throw actionError;
}

async function setStage(runDir: string, state: RunState, next: RunStateName): Promise<RunState> {
  return writeState(runDir, { ...state, state: next, stageError: null });
}

async function failStage(runDir: string, state: RunState, stage: RunStateName, error: unknown): Promise<never> {
  const value = error as Error & { signal?: string };
  const interrupted = Boolean(value.signal);
  await writeState(runDir, {
    ...state,
    state: interrupted ? 'INTERRUPTED' : 'FAILED',
    stageError: {
      stage,
      message: value.message || String(error),
      interrupted,
      changedPaths: error instanceof MutationError ? error.changedPaths : undefined,
      resumeState: stage
    }
  });
  throw error;
}

async function loadInputs(runDir: string) {
  return {
    context: await readFile(contextPath, 'utf8'),
    spec: await readFile(path.join(runDir, 'spec.md'), 'utf8')
  };
}

async function runPlanning(runDir: string, initial: RunState): Promise<void> {
  let state = await setStage(runDir, initial, 'PLANNING');
  try {
    const { context, spec } = await loadInputs(runDir);
    const promptPath = path.join(runDir, 'prompts', 'claude-plan.compiled.md');
    const prompt = await compilePrompt(promptPath, path.join(promptsDir, 'claude-plan.md'), [
      ['PROJECT_CONTEXT.md', context], ['MILESTONE SPECIFICATION', spec]
    ]);
    await validateClaudeSubscription(repoRoot, path.join(runDir, 'logs'), `claude-auth-plan-${Date.now()}`);
    await readonlyGuard(runDir, () => runClaudeReadOnly({
      repoRoot, runDir, stage: 'claude-plan', prompt, artifactPath: path.join(runDir, 'claude-plan.md')
    }));
    const verdict = parseVerdict(await readFile(path.join(runDir, 'claude-plan.md'), 'utf8'), ['READY_FOR_IMPLEMENTATION', 'BLOCKED']);
    state = await writeState(runDir, { ...state, verdicts: { ...state.verdicts, planner: verdict } });
    if (verdict === 'BLOCKED') {
      await writeState(runDir, { ...state, state: 'BLOCKED' });
      console.log('Claude marked the milestone BLOCKED. See claude-plan.md.');
      return;
    }
  } catch (error) { return failStage(runDir, state, 'PLANNING', error); }
  await runPlanReview(runDir, state);
}

async function runPlanReview(runDir: string, initial: RunState): Promise<void> {
  let state = await setStage(runDir, initial, 'REVIEWING_PLAN');
  try {
    const { context, spec } = await loadInputs(runDir);
    const claudePlan = await readFile(path.join(runDir, 'claude-plan.md'), 'utf8');
    const promptPath = path.join(runDir, 'prompts', 'codex-plan-review.compiled.md');
    const prompt = await compilePrompt(promptPath, path.join(promptsDir, 'codex-plan-review.md'), [
      ['PROJECT_CONTEXT.md', context], ['MILESTONE SPECIFICATION', spec], ['CLAUDE PLAN', claudePlan]
    ]);
    await validateCodexSubscription(repoRoot, path.join(runDir, 'logs'), `codex-auth-plan-review-${Date.now()}`);
    await readonlyGuard(runDir, () => runCodex({
      repoRoot, runDir, stage: 'codex-plan-review', prompt, sandbox: 'read-only',
      artifactPath: path.join(runDir, 'codex-plan-review.md')
    }));
    const review = await readFile(path.join(runDir, 'codex-plan-review.md'), 'utf8');
    const verdict = parseVerdict(review, ['APPROVED', 'APPROVED_WITH_CORRECTIONS', 'BLOCKED']);
    state = await writeState(runDir, { ...state, verdicts: { ...state.verdicts, planReview: verdict } });
    if (verdict === 'BLOCKED') {
      await writeState(runDir, { ...state, state: 'BLOCKED' });
      console.log('Codex marked the plan BLOCKED. See codex-plan-review.md.');
      return;
    }
    const finalPrompt = extractTerminalSection(review, 'FINAL_CODEX_IMPLEMENTATION_PROMPT');
    await writeFile(path.join(runDir, 'codex-implementation-prompt.md'), finalPrompt, 'utf8');
    state = await writeState(runDir, { ...state, state: 'WAITING_FOR_IMPLEMENTATION_APPROVAL' });
    const corrections = extractSectionBefore(review, 'CORRECTIONS', 'FINAL_CODEX_IMPLEMENTATION_PROMPT') || 'None';
    console.log(`\nGate 1 reached\nClaude: ${state.verdicts.planner}\nCodex: ${verdict}\nCorrections: ${corrections}`);
    console.log(`Claude plan: ${path.join(runDir, 'claude-plan.md')}\nReview: ${path.join(runDir, 'codex-plan-review.md')}\nImplementation prompt: ${path.join(runDir, 'codex-implementation-prompt.md')}`);
  } catch (error) { return failStage(runDir, state, 'REVIEWING_PLAN', error); }
}

async function runImplementation(runDir: string, initial: RunState): Promise<void> {
  let state = await setStage(runDir, initial, 'IMPLEMENTING');
  try {
    const context = await readFile(contextPath, 'utf8');
    const approved = await readFile(path.join(runDir, 'codex-implementation-prompt.md'), 'utf8');
    const prompt = await compilePrompt(path.join(runDir, 'prompts', 'codex-implement.compiled.md'), path.join(promptsDir, 'codex-implement.md'), [
      ['PROJECT_CONTEXT.md', context], ['APPROVED IMPLEMENTATION PROMPT', approved]
    ]);
    await validateCodexSubscription(repoRoot, path.join(runDir, 'logs'), `codex-auth-implement-${Date.now()}`);
    await runCodex({ repoRoot, runDir, stage: 'codex-implement', prompt, sandbox: 'workspace-write', artifactPath: path.join(runDir, 'codex-result.md') });
    await generateDiffEvidence(repoRoot, runDir, state.baseCommit);
  } catch (error) { return failStage(runDir, state, 'IMPLEMENTING', error); }
  await runDiffReview(runDir, state);
}

async function runDiffReview(runDir: string, initial: RunState): Promise<void> {
  let state = await setStage(runDir, initial, 'REVIEWING_DIFF');
  try {
    await generateDiffEvidence(repoRoot, runDir, state.baseCommit);
    const { context, spec } = await loadInputs(runDir);
    const sections: Array<[string, string]> = [
      ['PROJECT_CONTEXT.md', context], ['MILESTONE SPECIFICATION', spec],
      ['CLAUDE ORIGINAL PLAN', await readFile(path.join(runDir, 'claude-plan.md'), 'utf8')],
      ['CODEX PLAN REVIEW', await readFile(path.join(runDir, 'codex-plan-review.md'), 'utf8')],
      ['APPROVED IMPLEMENTATION PROMPT', await readFile(path.join(runDir, 'codex-implementation-prompt.md'), 'utf8')],
      ['CODEX IMPLEMENTATION REPORT', await readFile(path.join(runDir, state.correctionAttempts > 0 ? `codex-correction-${state.correctionAttempts}.md` : 'codex-result.md'), 'utf8')],
      ['ACTUAL DIFF EVIDENCE', `Read ${path.join(runDir, 'diff.patch')} and ${path.join(runDir, 'diff-stat.txt')} from disk. These are the canonical repository diff artifacts.`]
    ];
    const prompt = await compilePrompt(path.join(runDir, 'prompts', 'claude-diff-review.compiled.md'), path.join(promptsDir, 'claude-diff-review.md'), sections);
    await validateClaudeSubscription(repoRoot, path.join(runDir, 'logs'), `claude-auth-diff-${Date.now()}`);
    await readonlyGuard(runDir, () => runClaudeReadOnly({
      repoRoot, runDir, stage: `claude-diff-review-${state.correctionAttempts}`, prompt,
      artifactPath: path.join(runDir, 'claude-diff-review.md')
    }));
    const audit = await readFile(path.join(runDir, 'claude-diff-review.md'), 'utf8');
    const verdict = parseVerdict(audit, ['APPROVED', 'CORRECTIONS_REQUIRED']);
    state = await writeState(runDir, { ...state, verdicts: { ...state.verdicts, diffReview: verdict } });
    if (verdict === 'APPROVED') return runDeterministicVerification(runDir, state);
    if (state.correctionAttempts >= 2) {
      await writeState(runDir, { ...state, state: 'BLOCKED', stageError: { stage: 'REVIEWING_DIFF', message: 'Claude still requires corrections after the maximum of 2 attempts' } });
      console.log('Correction limit reached; run is BLOCKED.');
      return;
    }
    const correction = extractTerminalSection(audit, 'CODEX_CORRECTION_PROMPT');
    await writeFile(path.join(runDir, `codex-correction-prompt-${state.correctionAttempts + 1}.md`), correction, 'utf8');
  } catch (error) { return failStage(runDir, state, 'REVIEWING_DIFF', error); }
  await runCorrection(runDir, state);
}

async function runCorrection(runDir: string, initial: RunState): Promise<void> {
  let state = await setStage(runDir, { ...initial, correctionAttempts: initial.correctionAttempts + 1 }, 'CORRECTING');
  try {
    const attempt = state.correctionAttempts;
    const prompt = await compilePrompt(path.join(runDir, 'prompts', `codex-correction-${attempt}.compiled.md`), path.join(promptsDir, 'codex-correction.md'), [
      ['PROJECT_CONTEXT.md', await readFile(contextPath, 'utf8')],
      ['APPROVED IMPLEMENTATION PROMPT', await readFile(path.join(runDir, 'codex-implementation-prompt.md'), 'utf8')],
      ['CLAUDE CORRECTION PROMPT', await readFile(path.join(runDir, `codex-correction-prompt-${attempt}.md`), 'utf8')]
    ]);
    await validateCodexSubscription(repoRoot, path.join(runDir, 'logs'), `codex-auth-correction-${attempt}-${Date.now()}`);
    await runCodex({ repoRoot, runDir, stage: `codex-correction-${attempt}`, prompt, sandbox: 'workspace-write', artifactPath: path.join(runDir, `codex-correction-${attempt}.md`) });
    await generateDiffEvidence(repoRoot, runDir, state.baseCommit);
  } catch (error) { return failStage(runDir, state, 'CORRECTING', error); }
  await runDiffReview(runDir, state);
}

async function runDeterministicVerification(runDir: string, initial: RunState): Promise<void> {
  let state = await setStage(runDir, initial, 'VERIFYING');
  try {
    const results = await runVerification(repoRoot, runDir);
    const failed = results.find((item) => item.exitCode !== 0);
    if (failed) throw new Error(`Required verification failed: ${failed.name} (${failed.command})`);
    state = await writeState(runDir, { ...state, state: 'WAITING_FOR_FINAL_APPROVAL' });
    console.log(`\nGate 2 reached for ${state.milestone}\nBranch: ${state.runBranch}\nBase: ${state.baseCommit}`);
    console.log(`Planner: ${state.verdicts.planner}\nPlan review: ${state.verdicts.planReview}\nDiff review: ${state.verdicts.diffReview}`);
    console.log(await readDiffStat(runDir));
    console.log(await readFile(path.join(runDir, 'verification.md'), 'utf8'));
  } catch (error) { return failStage(runDir, state, 'VERIFYING', error); }
}

export async function start(specArgument: string): Promise<void> {
  if (await activeRun(runsDir)) throw new Error('Another non-terminal orchestrator run is active');
  const sourceSpec = path.resolve(process.cwd(), specArgument);
  const spec = await readFile(sourceSpec, 'utf8');
  const milestone = slug(path.basename(sourceSpec));
  const stamp = timestamp();
  const runId = `${milestone}-${stamp}`;
  const runBranch = `orch/${runId}`;
  const startupLogs = await mkdtemp(path.join(os.tmpdir(), 'bakerrang-orch-'));
  await validateToolsAndAuth(repoRoot, startupLogs);
  await requireClean(repoRoot, startupLogs);
  const { baseCommit, startingBranch } = await repositoryIdentity(repoRoot, startupLogs);
  await createBranch(repoRoot, startupLogs, runBranch);
  const runDir = path.join(runsDir, runId);
  await mkdir(path.join(runDir, 'prompts'), { recursive: true });
  await mkdir(path.join(runDir, 'logs'), { recursive: true });
  await rename(startupLogs, path.join(runDir, 'logs', 'startup'));
  await cp(sourceSpec, path.join(runDir, 'spec.md'));
  const title = spec.match(/^#\s+(.+)$/m)?.[1].trim() || milestone;
  const now = new Date().toISOString();
  const state = await writeState(runDir, {
    runId, milestone, title, state: 'CREATED', specPath: sourceSpec, baseCommit, startingBranch, runBranch,
    correctionAttempts: 0, verdicts: {}, stageError: null, createdAt: now, updatedAt: now
  });
  console.log(`Created ${runBranch} and run ${runId}`);
  await runPlanning(runDir, state);
}

export async function continueRun(confirm: (question: string) => Promise<boolean>): Promise<void> {
  const current = await activeRun(runsDir);
  if (!current) throw new Error('No active orchestrator run');
  const { dir: runDir } = current;
  let state = await readState(runDir);
  if (state.state === 'WAITING_FOR_IMPLEMENTATION_APPROVAL') {
    let corrections = 'Unavailable';
    try {
      const review = await readFile(path.join(runDir, 'codex-plan-review.md'), 'utf8');
      corrections = extractSectionBefore(review, 'CORRECTIONS', 'FINAL_CODEX_IMPLEMENTATION_PROMPT') || 'None';
    } catch { /* display-only artifact */ }
    console.log(`\nGate 1 approval summary\nClaude plan verdict: ${state.verdicts.planner ?? 'Unavailable'}\nCodex review verdict: ${state.verdicts.planReview ?? 'Unavailable'}\nReviewer corrections: ${corrections}`);
    console.log(`Claude plan: ${path.join(runDir, 'claude-plan.md')}\nCodex review: ${path.join(runDir, 'codex-plan-review.md')}\nImplementation prompt: ${path.join(runDir, 'codex-implementation-prompt.md')}`);
    if (!await confirm('Proceed with Codex implementation? [y/N] ')) return;
    await validateAuthForAiStages(repoRoot, path.join(runDir, 'logs'));
    return runImplementation(runDir, state);
  }
  if (state.state === 'WAITING_FOR_FINAL_APPROVAL') {
    let diffStat = 'Unavailable';
    let verification = 'Unavailable';
    try { diffStat = (await readDiffStat(runDir)).trim() || 'Unavailable'; } catch { /* display-only artifact */ }
    try { verification = (await readFile(path.join(runDir, 'verification.md'), 'utf8')).trim() || 'Unavailable'; } catch { /* display-only artifact */ }
    console.log(`\nGate 2 approval summary\nMilestone: ${state.milestone}\nBranch: ${state.runBranch}\nBase commit: ${state.baseCommit}\nClaude plan verdict: ${state.verdicts.planner ?? 'Unavailable'}\nCodex review verdict: ${state.verdicts.planReview ?? 'Unavailable'}\nClaude diff-review verdict: ${state.verdicts.diffReview ?? 'Unavailable'}\n\nDiff stat:\n${diffStat}\n\nVerification:\n${verification}`);
    if (!await confirm('Accept the verified implementation? [y/N] ')) return;
    await writeState(runDir, { ...state, state: 'COMPLETED', stageError: null });
    console.log('Run marked COMPLETED. No commit, merge, push, deployment, or checkout was performed.');
    return;
  }
  if (terminalStates.has(state.state)) throw new Error(`Run is terminal: ${state.state}`);
  let resume = state.stageError?.resumeState ?? state.state;
  if (resume === 'IMPLEMENTING' || resume === 'CORRECTING') {
    console.warn('The previous write-capable Codex stage was interrupted or failed and may have left partial changes. Retrying will ask Codex to inspect and continue from the current repository state.');
    if (!await confirm('Retry this write-capable stage? [y/N] ')) return;
  }
  state = await readState(runDir);
  if (resume === 'PLANNING') return runPlanning(runDir, state);
  if (resume === 'REVIEWING_PLAN') return runPlanReview(runDir, state);
  if (resume === 'IMPLEMENTING') return runImplementation(runDir, state);
  if (resume === 'REVIEWING_DIFF') return runDiffReview(runDir, state);
  if (resume === 'CORRECTING') return runCorrection(runDir, { ...state, correctionAttempts: Math.max(0, state.correctionAttempts - 1) });
  if (resume === 'VERIFYING') return runDeterministicVerification(runDir, state);
  throw new Error(`State ${state.state} cannot be resumed automatically`);
}

export async function printStatus(): Promise<void> {
  const run = await activeRun(runsDir) ?? await latestRun(runsDir);
  if (!run) { console.log('No orchestrator runs found.'); return; }
  const s = run.state;
  console.log(`Run: ${s.runId}\nMilestone: ${s.milestone}\nBranch: ${s.runBranch}\nState: ${s.state}\nBase commit: ${s.baseCommit}\nCorrections: ${s.correctionAttempts}`);
  console.log(`Verdicts: planner=${s.verdicts.planner ?? '-'}, review=${s.verdicts.planReview ?? '-'}, diff=${s.verdicts.diffReview ?? '-'}`);
  if (s.stageError) console.log(`Stage error (${s.stageError.stage}): ${s.stageError.message}`);
  console.log(`Run directory: ${run.dir}\nSpec copy: ${path.join(run.dir, 'spec.md')}\nPlan: ${path.join(run.dir, 'claude-plan.md')}\nReview: ${path.join(run.dir, 'codex-plan-review.md')}\nImplementation prompt: ${path.join(run.dir, 'codex-implementation-prompt.md')}\nDiff: ${path.join(run.dir, 'diff.patch')}\nVerification: ${path.join(run.dir, 'verification.md')}`);
}

export async function cancel(): Promise<void> {
  const run = await activeRun(runsDir);
  if (!run) throw new Error('No active orchestrator run');
  await writeState(run.dir, { ...run.state, state: 'CANCELLED', stageError: null });
  console.log(`Run ${run.state.runId} marked CANCELLED. Branch and files were left untouched.`);
}
