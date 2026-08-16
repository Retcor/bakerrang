import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTerminalSection, parseVerdict } from '../src/prompts.js';

test('parseVerdict accepts an exact allowed token', () => {
  assert.equal(parseVerdict('# VERDICT\n\nAPPROVED\n\n# PLAN\nDo it.', ['APPROVED', 'BLOCKED']), 'APPROVED');
});

test('parseVerdict rejects prose and unknown tokens', () => {
  assert.throws(() => parseVerdict('# VERDICT\nProbably APPROVED', ['APPROVED']), /invalid exact verdict/);
  assert.throws(() => parseVerdict('# VERDICT\nREADY', ['APPROVED']), /invalid exact verdict/);
});

for (const sentinel of ['FINAL_CODEX_IMPLEMENTATION_PROMPT', 'CODEX_CORRECTION_PROMPT']) {
  test(`${sentinel} preserves all nested Markdown headings through EOF`, () => {
    const text = `# VERDICT\nAPPROVED\n# ${sentinel}\nImplement this.\n# Internal heading\n## Detail\nKeep this too.\n`;
    assert.equal(extractTerminalSection(text, sentinel), 'Implement this.\n# Internal heading\n## Detail\nKeep this too.\n');
  });

  test(`${sentinel} fails when missing`, () => {
    assert.throws(() => extractTerminalSection('# VERDICT\nAPPROVED', sentinel), /Expected exactly one/);
  });

  test(`${sentinel} fails when empty`, () => {
    assert.throws(() => extractTerminalSection(`# ${sentinel}\n\n`, sentinel), /empty/);
  });
}
