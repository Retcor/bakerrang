#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { cancel, continueRun, printStatus, start } from './workflow.js';

async function confirm(question: string): Promise<boolean> {
  const terminal = createInterface({ input: stdin, output: stdout });
  try { return /^(y|yes)$/i.test((await terminal.question(question)).trim()); }
  finally { terminal.close(); }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'start') {
    if (args.length !== 1) throw new Error('Usage: npm run orch -- start <spec-file>');
    await start(args[0]);
  } else if (command === 'continue') {
    if (args.length) throw new Error('Usage: npm run orch -- continue');
    await continueRun(confirm);
  } else if (command === 'status') {
    if (args.length) throw new Error('Usage: npm run orch -- status');
    await printStatus();
  } else if (command === 'cancel') {
    if (args.length) throw new Error('Usage: npm run orch -- cancel');
    await cancel();
  } else {
    throw new Error('Commands: start <spec-file> | continue | status | cancel');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
