import path from 'node:path';
import { assertNoApiKeys, runProcess } from './process.js';

export function parseClaudeAuth(output: string): boolean {
  try {
    const value = JSON.parse(output) as Record<string, unknown>;
    return value.loggedIn === true && value.authMethod === 'claude.ai' && value.apiProvider === 'firstParty';
  } catch {
    return /loggedIn["'\s:=]+true/i.test(output) && /authMethod["'\s:=]+claude\.ai/i.test(output) && /apiProvider["'\s:=]+firstParty/i.test(output);
  }
}

export function parseCodexAuth(output: string): boolean {
  return /logged in using chatgpt/i.test(output);
}

async function check(exe: string, args: string[], cwd: string, logDir: string, label: string) {
  const result = await runProcess({
    exe, args, cwd,
    stdoutPath: path.join(logDir, `${label}.stdout.log`),
    stderrPath: path.join(logDir, `${label}.stderr.log`)
  });
  if (result.exitCode !== 0) throw new Error(`${exe} ${args.join(' ')} failed or is unavailable: ${result.stderr.trim()}`);
  return `${result.stdout}\n${result.stderr}`;
}

export async function validateToolsAndAuth(repoRoot: string, logDir: string): Promise<void> {
  assertNoApiKeys();
  await check('npm', ['--version'], repoRoot, logDir, 'npm-version');
  await check('git', ['--version'], repoRoot, logDir, 'git-version');
  await check('claude', ['--version'], repoRoot, logDir, 'claude-version');
  await check('codex', ['--version'], repoRoot, logDir, 'codex-version');
  await validateClaudeSubscription(repoRoot, logDir, 'claude-auth');
  await validateCodexSubscription(repoRoot, logDir, 'codex-auth');
}

export async function validateAuthForAiStages(repoRoot: string, logDir: string): Promise<void> {
  assertNoApiKeys();
  await validateClaudeSubscription(repoRoot, logDir, 'claude-auth-gate');
  await validateCodexSubscription(repoRoot, logDir, 'codex-auth-gate');
}

export async function validateClaudeSubscription(repoRoot: string, logDir: string, label = 'claude-auth-stage'): Promise<void> {
  assertNoApiKeys();
  const claude = await check('claude', ['auth', 'status'], repoRoot, logDir, label);
  if (!parseClaudeAuth(claude)) throw new Error('Claude subscription authentication is not valid');
}

export async function validateCodexSubscription(repoRoot: string, logDir: string, label = 'codex-auth-stage'): Promise<void> {
  assertNoApiKeys();
  const codex = await check('codex', ['login', 'status'], repoRoot, logDir, label);
  if (!parseCodexAuth(codex)) throw new Error('Codex ChatGPT authentication is not valid');
}
