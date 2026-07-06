// Runtime balance overrides for experiments. A patch keeps a candidate change
// out of git history, docs and reverts until it has earned a real commit:
//
//   node tools/tournament.mjs 20 75 --patch=exp.json
//   node tools/round.mjs --name=exp --patch=exp.json
//
// Patch file shape (deep-merged into the live config objects):
//   {
//     "factions": { "galicia": { "bonus": { "mineRate": 2 }, "aiStyle": { "turtle": 1 } } },
//     "rules":    { "UNITS": { "soldier": { "hp": 100 } },
//                   "BUILDINGS": { "tower": { "hp": 600 } },
//                   "CONVICTION": { "conquerHoldTime": 12 } }
//   }

import { readFileSync } from 'node:fs';
import { FACTIONS } from '../src/config/factions.js';
import * as RULES from '../src/config/rules.js';

function merge(target, src, path = '') {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      merge(target[k], v, `${path}${k}.`);
    } else {
      target[k] = v;
    }
  }
}

export function applyPatch(spec) {
  if (spec.factions) merge(FACTIONS, spec.factions);
  if (spec.rules) {
    for (const [k, v] of Object.entries(spec.rules)) {
      if (RULES[k] && typeof RULES[k] === 'object') merge(RULES[k], v);
      else throw new Error(`rules.${k} is not a patchable object`);
    }
  }
}

// Looks for --patch=path in argv; applies it and returns the path (or null).
export function applyPatchArg(argv) {
  const arg = argv.find(a => a.startsWith('--patch='));
  if (!arg) return null;
  const path = arg.slice('--patch='.length);
  applyPatch(JSON.parse(readFileSync(path, 'utf8')));
  return path;
}
