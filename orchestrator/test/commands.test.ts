import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { claudeReadOnlyArgs } from '../src/claude.js';
import { codexExecArgs } from '../src/codex.js';
import { verificationDescriptors } from '../src/verify.js';

test('Claude read-only command uses plan mode and explicit write-tool denial', () => {
  assert.deepEqual(claudeReadOnlyArgs(), ['-p', '--permission-mode', 'plan', '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', '--output-format', 'text']);
  assert.equal(claudeReadOnlyArgs().includes('--bare'), false);
});

test('Codex command uses explicit sandbox, no approval, cwd, and final-message output', () => {
  assert.deepEqual(codexExecArgs('/repo', 'read-only', '/run/last.txt'), [
    'exec', '--sandbox', 'read-only', '--ask-for-approval', 'never', '-C', '/repo', '-o', '/run/last.txt'
  ]);
});

test('verification list is fixed and ordered', () => {
  const root = path.resolve('/repo');
  const values = verificationDescriptors(root);
  assert.deepEqual(values.map((item) => [path.relative(root, item.cwd).replaceAll('\\', '/'), item.command]), [
    ['orchestrator', 'npm test'], ['server', 'npm test'], ['server', 'npm run lint'],
    ['platform', 'npm run typecheck'], ['platform', 'npm run lint'],
    ['platform/apps/site-renderer', 'npm test'], ['platform', 'npm run build']
  ]);
});
