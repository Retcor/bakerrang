import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClaudeAuth, parseCodexAuth } from '../src/doctor.js';

test('Claude auth parser requires all subscription-backed fields', () => {
  assert.equal(parseClaudeAuth(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' })), true);
  assert.equal(parseClaudeAuth(JSON.stringify({ loggedIn: true, authMethod: 'apiKey', apiProvider: 'firstParty' })), false);
  assert.equal(parseClaudeAuth('loggedIn: true\nauthMethod: claude.ai\napiProvider: firstParty'), true);
});

test('Codex auth parser requires ChatGPT login wording', () => {
  assert.equal(parseCodexAuth('Logged in using ChatGPT'), true);
  assert.equal(parseCodexAuth('Logged in using an API key'), false);
});
