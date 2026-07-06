#!/usr/bin/env node
// One-command balance round. Runs a tournament in parallel batches, aggregates
// with Wilson CIs, prints a comparison table against named rounds from
// tools/balance-history.jsonl, and appends this round's summary to it.
//
//   node tools/round.mjs --name=my-experiment [--patch=exp.json] [--full]
//                        [--games=N] [--cap=75] [--vs=name,name] [--dry]
//
// Default is a 20-game SCREEN — enough to spot a collapse or an overshoot.
// Use --full (60 games) only to validate a candidate you intend to ship.
// --vs defaults to the baseline plus the latest shipped round.
// --dry runs and prints but does not append to history.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HISTORY = join(HERE, 'balance-history.jsonl');
const FACTIONS = ['galicia', 'basque', 'catalonia', 'portugal', 'castile'];

const argv = process.argv.slice(2);
const flag = name => {
  const a = argv.find(x => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return null;
  return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};
const name = flag('name');
if (!name) { console.error('required: --name=<round-name>'); process.exit(1); }
const patchPath = flag('patch');
const games = Number(flag('games') ?? (flag('full') ? 60 : 20));
const cap = Number(flag('cap') ?? 75);
const dry = !!flag('dry');

// ---- run batches in parallel ----
const workers = Math.max(2, Math.min(6, cpus().length - 2));
const per = Math.ceil(games / workers);
const batchArgs = [];
for (let left = games; left > 0; left -= per) batchArgs.push(Math.min(per, left));

console.error(`[round] ${name}: ${games} games @ ${cap}m cap, ${batchArgs.length} workers${patchPath ? `, patch ${patchPath}` : ''}`);
const results = await Promise.all(batchArgs.map(n => new Promise((resolve, reject) => {
  const args = [join(HERE, 'tournament.mjs'), String(n), String(cap)];
  if (patchPath) args.push(`--patch=${patchPath}`);
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`batch exited ${code}`)));
})));
const rows = results.join('').split('\n').filter(Boolean).map(l => JSON.parse(l));

// ---- aggregate ----
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, den = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / den;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [Math.max(0, c - h) * 100, Math.min(1, c + h) * 100];
}
const summary = { name, games: rows.length, cap, patch: patchPath ?? null, shipped: false, wins: {}, winPct: {}, ci: {}, firstFall: {}, flips: {}, medianWin: null, draws: 0 };
if (patchPath) summary.patchSpec = JSON.parse(readFileSync(patchPath, 'utf8'));
const winTimes = [];
for (const f of FACTIONS) {
  const w = rows.filter(r => r.winner === f);
  summary.wins[f] = w.length;
  summary.winPct[f] = +(100 * w.length / rows.length).toFixed(1);
  summary.ci[f] = wilson(w.length, rows.length).map(x => +x.toFixed(1));
  summary.firstFall[f] = rows.filter(r => r.firstFall === f).length;
  const per = k => +(rows.reduce((s, r) => s + (r.flips?.[f]?.[k] ?? 0), 0) / rows.length).toFixed(1);
  summary.flips[f] = { conviction: per('conviction'), conquest: per('conquest'), defection: per('defection') };
}
for (const r of rows) { if (r.winner) winTimes.push(r.minutes); else summary.draws++; }
winTimes.sort((a, b) => a - b);
summary.medianWin = winTimes.length ? winTimes[Math.floor(winTimes.length / 2)] : null;

// ---- compare against history ----
const history = existsSync(HISTORY)
  ? readFileSync(HISTORY, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];
let vsNames = flag('vs') ? String(flag('vs')).split(',') : null;
if (!vsNames) {
  const shipped = history.filter(h => h.shipped);
  vsNames = [history[0]?.name, shipped[shipped.length - 1]?.name].filter(Boolean);
}
const compare = vsNames.map(n => history.find(h => h.name === n)).filter(Boolean);

const pad = (s, w) => String(s).padStart(w);
console.log(`\n=== ${name} · ${rows.length} games · median win ${summary.medianWin}m · draws ${summary.draws} ===`);
console.log('faction'.padEnd(11) + compare.map(c => pad(c.name.slice(0, 14), 16)).join('') + pad('THIS ROUND', 16) + '   95% CI    first-fall');
for (const f of FACTIONS) {
  const line = f.padEnd(11)
    + compare.map(c => pad(`${c.winPct?.[f] ?? '?'}%`, 16)).join('')
    + pad(`${summary.wins[f]}w ${summary.winPct[f]}%`, 16)
    + `   [${summary.ci[f][0]}-${summary.ci[f][1]}]`.padEnd(14)
    + `${summary.firstFall[f]}/${rows.length}`;
  console.log(line);
}

if (!dry) {
  appendFileSync(HISTORY, JSON.stringify(summary) + '\n');
  console.log(`\n[round] appended to ${HISTORY} — mark "shipped": true by hand if this ships.`);
} else {
  console.log('\n[round] --dry: not recorded.');
}
