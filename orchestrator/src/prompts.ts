import { readFile, writeFile } from 'node:fs/promises';

export function parseVerdict(text: string, allowed: readonly string[]): string {
  const match = text.match(/^# VERDICT\s*\r?\n+([A-Z_]+)\s*$/m);
  if (!match || !allowed.includes(match[1])) {
    throw new Error(`Missing or invalid exact verdict; expected one of: ${allowed.join(', ')}`);
  }
  return match[1];
}

export function extractTerminalSection(text: string, sentinel: string): string {
  const pattern = new RegExp(`^# ${sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gm');
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Expected exactly one terminal # ${sentinel} sentinel`);
  const value = text.slice((matches[0].index ?? 0) + matches[0][0].length).trim();
  if (!value) throw new Error(`# ${sentinel} section is empty`);
  return `${value}\n`;
}

export function extractSectionBefore(text: string, heading: string, terminalHeading: string): string {
  const start = text.match(new RegExp(`^# ${heading}\\s*$`, 'm'));
  const end = text.match(new RegExp(`^# ${terminalHeading}\\s*$`, 'm'));
  if (!start || start.index === undefined || !end || end.index === undefined || end.index <= start.index) return '';
  return text.slice(start.index + start[0].length, end.index).trim();
}

export async function compilePrompt(outputPath: string, templatePath: string, sections: Array<[string, string]>): Promise<string> {
  const template = await readFile(templatePath, 'utf8');
  const content = [template.trim(), ...sections.map(([title, body]) => `# INPUT: ${title}\n\n${body.trim()}`)].join('\n\n') + '\n';
  await writeFile(outputPath, content, 'utf8');
  return content;
}
