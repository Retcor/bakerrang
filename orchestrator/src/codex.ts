import path from 'node:path';
import { copyFile, readFile, stat } from 'node:fs/promises';
import { assertNoApiKeys, runProcess } from './process.js';

export function codexExecArgs(repoRoot: string, sandbox: 'read-only' | 'workspace-write', lastMessagePath: string): string[] {
  return ['exec', '--sandbox', sandbox, '--ask-for-approval', 'never', '-C', repoRoot, '-o', lastMessagePath];
}

export async function runCodex(options: {
  repoRoot: string; runDir: string; stage: string; prompt: string;
  sandbox: 'read-only' | 'workspace-write'; artifactPath: string;
}): Promise<void> {
  assertNoApiKeys();
  const lastMessagePath = path.join(options.runDir, 'logs', `${options.stage}.last.txt`);
  const result = await runProcess({
    exe: 'codex', args: codexExecArgs(options.repoRoot, options.sandbox, lastMessagePath), cwd: options.repoRoot,
    stdinText: options.prompt, live: true,
    stdoutPath: path.join(options.runDir, 'logs', `${options.stage}.stdout.log`),
    stderrPath: path.join(options.runDir, 'logs', `${options.stage}.stderr.log`)
  });
  if (result.exitCode !== 0) throw Object.assign(new Error(`Codex ${options.stage} failed with exit code ${result.exitCode}`), { signal: result.signal });
  try {
    if ((await stat(lastMessagePath)).size === 0) throw new Error('empty');
    await readFile(lastMessagePath, 'utf8');
  } catch {
    throw new Error(`Codex ${options.stage} did not produce the required --output-last-message artifact`);
  }
  await copyFile(lastMessagePath, options.artifactPath);
}
