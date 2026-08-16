import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RunState, readState, writeState } from '../src/state.js';

function fixture() {
  const now = new Date().toISOString();
  return {
    runId: 'm-20260101', milestone: 'm', title: 'Milestone', state: 'CREATED' as const,
    specPath: '/tmp/spec.md', baseCommit: 'abc', startingBranch: 'main', runBranch: 'orch/m-20260101',
    correctionAttempts: 0, verdicts: {}, stageError: null, createdAt: now, updatedAt: now
  };
}

test('state schema validates required fields and rejects invalid attempts', () => {
  assert.equal(RunState.parse(fixture()).runId, 'm-20260101');
  assert.throws(() => RunState.parse({ ...fixture(), correctionAttempts: 3 }));
  assert.throws(() => RunState.parse({ ...fixture(), baseCommit: '' }));
});

test('atomic state write roundtrips valid JSON without leftover temp content', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orch-state-'));
  try {
    await writeState(dir, fixture());
    await writeState(dir, { ...fixture(), state: 'PLANNING' });
    const loaded = await readState(dir);
    assert.equal(loaded.runBranch, 'orch/m-20260101');
    assert.equal(loaded.state, 'PLANNING');
    assert.equal(JSON.parse(await readFile(path.join(dir, 'state.json'), 'utf8')).runId, loaded.runId);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
