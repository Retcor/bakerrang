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

test('Codex reviewer puts top-level approval before exec and uses read-only sandbox', () => {
  const args = codexExecArgs('/repo', 'read-only', '/run/last.txt');
  assert.deepEqual(args, [
    '--ask-for-approval', 'never', 'exec', '--sandbox', 'read-only', '-C', '/repo', '-o', '/run/last.txt'
  ]);
  assert.ok(args.indexOf('--ask-for-approval') < args.indexOf('exec'));
  assert.equal(args.includes('danger-full-access'), false);
});

test('Codex implementer and corrector use workspace-write without danger-full-access', () => {
  const args = codexExecArgs('/repo', 'workspace-write', '/run/last.txt');
  assert.deepEqual(args, [
    '--ask-for-approval', 'never', 'exec', '--sandbox', 'workspace-write', '-C', '/repo', '-o', '/run/last.txt'
  ]);
  assert.ok(args.indexOf('--ask-for-approval') < args.indexOf('exec'));
  assert.equal(args.includes('danger-full-access'), false);
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
