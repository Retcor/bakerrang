import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runProcess } from './process.js';

export type MutationSnapshot = Map<string, string>;

function paths(logDir: string, label: string) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    stdoutPath: path.join(logDir, `${label}-${suffix}.stdout.log`),
    stderrPath: path.join(logDir, `${label}-${suffix}.stderr.log`)
  };
}

async function git(repoRoot: string, logDir: string, label: string, args: string[], accepted = [0]) {
  const result = await runProcess({ exe: 'git', args, cwd: repoRoot, ...paths(logDir, label) });
  if (!accepted.includes(result.exitCode)) throw new Error(`git ${args.join(' ')} failed (${result.exitCode}): ${result.stderr.trim()}`);
  return result.stdout;
}

export function parsePorcelain(output: string): MutationSnapshot {
  const snapshot = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const status = line.slice(0, 2);
    const rawPath = line.slice(3);
    const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath;
    if (filePath.replaceAll('\\', '/').startsWith('orchestrator/runs/')) continue;
    snapshot.set(filePath, status);
  }
  return snapshot;
}

export function compareMutationSnapshots(before: MutationSnapshot, after: MutationSnapshot): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter((filePath) => before.get(filePath) !== after.get(filePath)).sort();
}

export async function mutationSnapshot(repoRoot: string, logDir: string): Promise<MutationSnapshot> {
  const snapshot = parsePorcelain(await git(repoRoot, logDir, 'git-status', ['status', '--porcelain=v1', '--untracked-files=all']));
  for (const [filePath, status] of snapshot) {
    let fingerprint: string;
    try {
      const content = await readFile(path.join(repoRoot, filePath));
      fingerprint = createHash('sha256').update(content).digest('hex');
    } catch {
      fingerprint = '<missing>';
    }
    snapshot.set(filePath, `${status}:${fingerprint}`);
  }
  return snapshot;
}

export async function requireClean(repoRoot: string, logDir: string): Promise<void> {
  const snapshot = await mutationSnapshot(repoRoot, logDir);
  if (snapshot.size) throw new Error(`Git tree must be clean before start. Changed paths:\n${[...snapshot.keys()].join('\n')}`);
}

export async function repositoryIdentity(repoRoot: string, logDir: string) {
  const baseCommit = (await git(repoRoot, logDir, 'git-head', ['rev-parse', 'HEAD'])).trim();
  const startingBranch = (await git(repoRoot, logDir, 'git-branch', ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  if (startingBranch === 'HEAD') throw new Error('Start requires a named branch, not detached HEAD');
  return { baseCommit, startingBranch };
}

export async function createBranch(repoRoot: string, logDir: string, branch: string): Promise<void> {
  await git(repoRoot, logDir, 'git-checkout', ['checkout', '-b', branch]);
}

export async function generateDiffEvidence(repoRoot: string, runDir: string, baseCommit: string): Promise<void> {
  const logDir = path.join(runDir, 'logs');
  let diff = await git(repoRoot, logDir, 'git-diff', ['diff', baseCommit]);
  let stat = await git(repoRoot, logDir, 'git-diff-stat', ['diff', '--stat', baseCommit]);
  const snapshot = await mutationSnapshot(repoRoot, logDir);
  for (const [filePath, status] of snapshot) {
    if (status !== '??') continue;
    const patch = await git(repoRoot, logDir, 'git-untracked-diff', ['diff', '--no-index', '--', '/dev/null', filePath], [0, 1]);
    const patchStat = await git(repoRoot, logDir, 'git-untracked-stat', ['diff', '--stat', '--no-index', '--', '/dev/null', filePath], [0, 1]);
    diff += `${diff.endsWith('\n') || !diff ? '' : '\n'}${patch}`;
    stat += `${stat.endsWith('\n') || !stat ? '' : '\n'}${patchStat}`;
  }
  await Promise.all([
    writeFile(path.join(runDir, 'diff.patch'), diff, 'utf8'),
    writeFile(path.join(runDir, 'diff-stat.txt'), stat, 'utf8')
  ]);
}

export async function readDiffStat(runDir: string): Promise<string> {
  return readFile(path.join(runDir, 'diff-stat.txt'), 'utf8');
}
