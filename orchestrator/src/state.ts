import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const runStates = [
  'CREATED', 'PLANNING', 'REVIEWING_PLAN',
  'WAITING_FOR_IMPLEMENTATION_APPROVAL', 'IMPLEMENTING', 'REVIEWING_DIFF',
  'CORRECTING', 'VERIFYING', 'WAITING_FOR_FINAL_APPROVAL',
  'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED', 'INTERRUPTED'
] as const;

export const RunStateName = z.enum(runStates);
export type RunStateName = z.infer<typeof RunStateName>;

const StageError = z.object({
  stage: z.string(),
  message: z.string(),
  interrupted: z.boolean().optional(),
  changedPaths: z.array(z.string()).optional(),
  resumeState: RunStateName.optional()
});

export const RunState = z.object({
  runId: z.string().min(1),
  milestone: z.string().min(1),
  title: z.string().min(1),
  state: RunStateName,
  specPath: z.string().min(1),
  baseCommit: z.string().min(1),
  startingBranch: z.string().min(1),
  runBranch: z.string().min(1),
  correctionAttempts: z.number().int().min(0).max(2),
  verdicts: z.object({
    planner: z.string().optional(),
    planReview: z.string().optional(),
    diffReview: z.string().optional()
  }),
  stageError: StageError.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type RunState = z.infer<typeof RunState>;
export const terminalStates = new Set<RunStateName>(['COMPLETED', 'CANCELLED', 'BLOCKED']);

export async function readState(runDir: string): Promise<RunState> {
  return RunState.parse(JSON.parse(await readFile(path.join(runDir, 'state.json'), 'utf8')));
}

export async function writeState(runDir: string, state: RunState): Promise<RunState> {
  const next = RunState.parse({ ...state, updatedAt: new Date().toISOString() });
  await mkdir(runDir, { recursive: true });
  const target = path.join(runDir, 'state.json');
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
  return next;
}

export async function listRuns(runsDir: string): Promise<Array<{ dir: string; state: RunState }>> {
  let names: string[];
  try { names = await readdir(runsDir); } catch { return []; }
  const found: Array<{ dir: string; state: RunState }> = [];
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const dir = path.join(runsDir, name);
    try { found.push({ dir, state: await readState(dir) }); } catch { /* ignore non-run directories */ }
  }
  return found.sort((a, b) => b.state.createdAt.localeCompare(a.state.createdAt));
}

export async function activeRun(runsDir: string) {
  return (await listRuns(runsDir)).find(({ state }) => !terminalStates.has(state.state));
}

export async function latestRun(runsDir: string) {
  return (await listRuns(runsDir))[0];
}
