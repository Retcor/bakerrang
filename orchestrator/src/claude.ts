import path from 'node:path';
import { copyFile } from 'node:fs/promises';
import { assertNoApiKeys, runProcess } from './process.js';

export function claudeReadOnlyArgs(): string[] {
  return ['-p', '--permission-mode', 'plan', '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', '--output-format', 'text'];
}

export async function runClaudeReadOnly(options: {
  repoRoot: string; runDir: string; stage: string; prompt: string; artifactPath: string;
}): Promise<void> {
  assertNoApiKeys();
  const result = await runProcess({
    exe: 'claude', args: claudeReadOnlyArgs(), cwd: options.repoRoot, stdinText: options.prompt, live: true,
    stdoutPath: path.join(options.runDir, 'logs', `${options.stage}.stdout.log`),
    stderrPath: path.join(options.runDir, 'logs', `${options.stage}.stderr.log`)
  });
  if (result.exitCode !== 0) throw Object.assign(new Error(`Claude ${options.stage} failed with exit code ${result.exitCode}`), { signal: result.signal });
  await copyFile(path.join(options.runDir, 'logs', `${options.stage}.stdout.log`), options.artifactPath);
}
