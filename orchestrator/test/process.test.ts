import test from 'node:test';
import assert from 'node:assert/strict';
import { assertNoApiKeys, scrubApiKeys } from '../src/process.js';

test('child environment removes both model API keys', () => {
  const clean = scrubApiKeys({ PATH: 'x', ANTHROPIC_API_KEY: 'secret-a', OPENAI_API_KEY: 'secret-o' });
  assert.deepEqual(clean, { PATH: 'x' });
});

test('AI invocation guard rejects either API key', () => {
  assert.throws(() => assertNoApiKeys({ ANTHROPIC_API_KEY: 'fake' }), /ANTHROPIC_API_KEY/);
  assert.throws(() => assertNoApiKeys({ OPENAI_API_KEY: 'fake' }), /OPENAI_API_KEY/);
  assert.doesNotThrow(() => assertNoApiKeys({ PATH: 'x' }));
});
