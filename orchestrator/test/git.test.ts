import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMutationSnapshots, parsePorcelain } from '../src/git.js';

test('porcelain parser captures tracked and untracked changes but ignores run artifacts', () => {
  const result = parsePorcelain(' M client/a.ts\n?? new.txt\n?? orchestrator/runs/test/log.txt\nR  old.ts -> new.ts\n');
  assert.deepEqual([...result], [['client/a.ts', ' M'], ['new.txt', '??'], ['new.ts', 'R ']]);
});

test('mutation comparison detects additions, removals, and status changes', () => {
  const before = new Map([['existing.ts', ' M'], ['removed.ts', '??']]);
  const after = new Map([['existing.ts', 'MM'], ['added.ts', '??']]);
  assert.deepEqual(compareMutationSnapshots(before, after), ['added.ts', 'existing.ts', 'removed.ts']);
});

test('identical dirty baselines are safe for read-only stages', () => {
  const snapshot = new Map([['implementation.ts', ' M:content-hash']]);
  assert.deepEqual(compareMutationSnapshots(snapshot, new Map(snapshot)), []);
});

test('content fingerprint changes are detected even when porcelain status is unchanged', () => {
  const before = new Map([['implementation.ts', ' M:old-hash']]);
  const after = new Map([['implementation.ts', ' M:new-hash']]);
  assert.deepEqual(compareMutationSnapshots(before, after), ['implementation.ts']);
});
