#!/usr/bin/env node
// Regenerates the faction table in GAME_DESIGN.md from src/config/factions.js,
// so balance facts live in exactly one place (bonusText) and docs cannot drift.
// Run after shipping any change to a faction's bonuses:
//   node tools/gendocs.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACTIONS } from '../src/config/factions.js';

const DOC = join(dirname(fileURLToPath(import.meta.url)), '..', 'GAME_DESIGN.md');
const BEGIN = '<!-- factions:generated:begin (edit src/config/factions.js, then run node tools/gendocs.mjs) -->';
const END = '<!-- factions:generated:end -->';

const COLOR_WORD = { blue: 'Blue', basque: 'White', yellow: 'Yellow', green: 'Green', red: 'Red' };

const rows = Object.values(FACTIONS).map(f =>
  `| **${f.name}** | ${COLOR_WORD[f.buildingColor] ?? f.buildingColor} | *${f.motto}* | ${f.bonusText} |`
).join('\n');

const table = `${BEGIN}
| Nation | Color | Theme | Bonuses |
|---|---|---|---|
${rows}
${END}`;

const doc = readFileSync(DOC, 'utf8');
const start = doc.indexOf(BEGIN);
const end = doc.indexOf(END);
if (start === -1 || end === -1) {
  console.error('gendocs: markers not found in GAME_DESIGN.md');
  process.exit(1);
}
const next = doc.slice(0, start) + table + doc.slice(end + END.length);
if (next === doc) {
  console.log('gendocs: up to date');
} else {
  writeFileSync(DOC, next);
  console.log('gendocs: faction table regenerated');
}
