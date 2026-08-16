import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';

export interface ProcessRequest {
  exe: string;
  args: string[];
  cwd: string;
  stdinText?: string;
  stdoutPath: string;
  stderrPath: string;
  live?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  signal?: string;
}

export function scrubApiKeys(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean = { ...env };
  delete clean.ANTHROPIC_API_KEY;
  delete clean.OPENAI_API_KEY;
  return clean;
}

export function assertNoApiKeys(env: NodeJS.ProcessEnv = process.env): void {
  const present = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'].filter((name) => Boolean(env[name]));
  if (present.length) throw new Error(`Refusing AI invocation while API key environment variables exist: ${present.join(', ')}`);
}

export async function runProcess(request: ProcessRequest): Promise<ProcessResult> {
  await Promise.all([
    mkdir(path.dirname(request.stdoutPath), { recursive: true }),
    mkdir(path.dirname(request.stderrPath), { recursive: true })
  ]);
  const started = Date.now();
  const child = execa(request.exe, request.args, {
    cwd: request.cwd,
    env: scrubApiKeys(request.env ?? process.env),
    reject: false,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe'
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString(); stdout += text;
    if (request.live) process.stdout.write(text);
  });
  child.stderr?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString(); stderr += text;
    if (request.live) process.stderr.write(text);
  });
  if (request.stdinText !== undefined) child.stdin?.end(request.stdinText);
  else child.stdin?.end();
  const result = await child;
  await Promise.all([
    writeFile(request.stdoutPath, stdout, 'utf8'),
    writeFile(request.stderrPath, stderr, 'utf8')
  ]);
  return {
    exitCode: result.exitCode ?? 1,
    durationMs: Date.now() - started,
    stdout,
    stderr,
    signal: result.signal
  };
}
