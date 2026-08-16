import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { runProcess } from './process.js';

export interface VerificationDescriptor {
  name: string;
  cwd: string;
  command: string;
  args: string[];
}

export function verificationDescriptors(repoRoot: string): VerificationDescriptor[] {
  return [
    { name: 'Orchestrator tests', cwd: path.join(repoRoot, 'orchestrator'), command: 'npm test', args: ['test'] },
    { name: 'Server tests', cwd: path.join(repoRoot, 'server'), command: 'npm test', args: ['test'] },
    { name: 'Server lint', cwd: path.join(repoRoot, 'server'), command: 'npm run lint', args: ['run', 'lint'] },
    { name: 'Platform typecheck', cwd: path.join(repoRoot, 'platform'), command: 'npm run typecheck', args: ['run', 'typecheck'] },
    { name: 'Platform lint', cwd: path.join(repoRoot, 'platform'), command: 'npm run lint', args: ['run', 'lint'] },
    { name: 'Site renderer tests', cwd: path.join(repoRoot, 'platform', 'apps', 'site-renderer'), command: 'npm test', args: ['test'] },
    { name: 'Platform build', cwd: path.join(repoRoot, 'platform'), command: 'npm run build', args: ['run', 'build'] }
  ];
}

export interface VerificationResult extends VerificationDescriptor {
  exitCode: number;
  durationMs: number;
  logPath: string;
}

export async function runVerification(repoRoot: string, runDir: string): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const [index, descriptor] of verificationDescriptors(repoRoot).entries()) {
    const slug = `${index + 1}-${descriptor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const logPath = path.join(runDir, 'logs', `${slug}.stdout.log`);
    const result = await runProcess({
      exe: 'npm', args: descriptor.args, cwd: descriptor.cwd, live: true,
      stdoutPath: logPath,
      stderrPath: path.join(runDir, 'logs', `${slug}.stderr.log`)
    });
    results.push({ ...descriptor, exitCode: result.exitCode, durationMs: result.durationMs, logPath });
    if (result.exitCode !== 0) break;
  }
  const lines = [
    '# Verification', '',
    '| Check | CWD | Command | Exit | Duration | Log |',
    '| --- | --- | --- | ---: | ---: | --- |',
    ...results.map((item) => `| ${item.name} | ${path.relative(repoRoot, item.cwd) || '.'} | \`${item.command}\` | ${item.exitCode} | ${item.durationMs} ms | ${path.relative(runDir, item.logPath)} |`),
    ''
  ];
  await writeFile(path.join(runDir, 'verification.md'), lines.join('\n'), 'utf8');
  return results;
}
