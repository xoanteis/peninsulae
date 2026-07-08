#!/usr/bin/env node
// Turn a recorded human match (src/ui/recorder.js JSON) into a compact report:
// timeline, build order, per-nation curves, the human's habits, and heuristic
// coaching flags. This is the ONLY way match logs should be read — never dump
// the raw JSON into a conversation.
//   node tools/analyze-match.mjs <match.json>
//
// SECURITY: matches/ solicits logs from anyone, and this tool's output is read
// as trusted text by both humans and the AI-assisted workflow. Every string
// from the log is therefore sanitized at the output boundary (control chars
// stripped — kills ANSI/RTL terminal spoofing and output-borne instruction
// injection), identifiers are checked against the real faction/region sets,
// numbers are coerced, and array sizes are capped.

import { readFileSync, statSync } from 'node:fs';
import { REGIONS } from '../src/config/map.js';
import { FACTIONS } from '../src/config/factions.js';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/analyze-match.mjs <match.json>'); process.exit(1); }
if (statSync(file).size > 20 * 1024 * 1024) { console.error('log exceeds 20 MB — refusing'); process.exit(1); }
const log = JSON.parse(readFileSync(file, 'utf8'));

// ---- sanitizers ----------------------------------------------------------
const clean = (v, cap = 48) => String(v).replace(/\p{C}/gu, '').slice(0, cap);
const num = (v, fb = 0) => (Number.isFinite(+v) ? +v : fb);
const fac = v => (v != null && Object.hasOwn(FACTIONS, v)) ? v : `⟨not-a-faction:${clean(v, 16)}⟩`;
const rname = k => REGIONS[k]?.name ?? `⟨not-a-region:${clean(k, 16)}⟩`;
const HOW = new Set(['conviction', 'conquest', 'defection', 'shattered']);

log.meta = typeof log.meta === 'object' && log.meta ? log.meta : {};
for (const [k, max] of [['events', 20000], ['orders', 60000], ['snaps', 20000]]) {
  if (!Array.isArray(log[k])) log[k] = [];
  log[k] = log[k].filter(Array.isArray);
  if (log[k].length > max) { console.error(`note: ${k} truncated to ${max} rows (log had ${log[k].length})`); log[k].length = max; }
}
if (!log.snaps.length) log.snaps.push([0, []]);

const C = Object.fromEntries((Array.isArray(log.meta.snapCols) ? log.meta.snapCols : [])
  .slice(0, 32).map((k, i) => [clean(k, 24), i]));
const players = (Array.isArray(log.meta.players) ? log.meta.players : []).slice(0, 8);
const me = log.meta.faction;
const rivals = players.filter(p => p !== me);
const duration = num(log.result?.time ?? log.snaps.at(-1)?.[0]) / 60;
const mins = t => (num(t) / 60).toFixed(1);
const row = (snap, pid) => (snap?.[1] ?? [])[players.indexOf(pid)] ?? [];
const cell = (r, col) => num(r[col]);
const snapAt = min => log.snaps.reduce((best, s) =>
  Math.abs(num(s[0]) - min * 60) < Math.abs(num(best[0]) - min * 60) ? s : best, log.snaps[0]);
const fellAt = Object.fromEntries(log.events.filter(e => e[1] === 'fell').map(e => [e[2], num(e[0])]));

// ---- header ------------------------------------------------------------
console.log(`MATCH  you=${fac(me)} · ${clean(log.meta.date ?? '?', 16)} · ${duration.toFixed(1)} min · ` +
  (log.result
    ? `winner: ${log.result.winner == null ? 'draw' : fac(log.result.winner)} · you ${log.result.humanSurvived ? 'survived' : `fell (min ${mins(fellAt[me] ?? 0)})`}`
    : 'IN PROGRESS (mid-game save)') +
  (log.meta.rules ? ` · build[regrow ${num(log.meta.rules.forestRegrow)}s]` : ' · build[unknown — log predates the rules fingerprint]'));

// ---- timeline: the strategic beats --------------------------------------
console.log('\nTIMELINE');
for (const e of log.events) {
  const [t, tag, ...a] = e;
  const line = {
    flip: () => `⚑ ${rname(a[0])} → ${a[1] == null ? 'independence' : fac(a[1])} (${HOW.has(a[2]) ? a[2] : clean(a[2], 16)})`,
    fell: () => `💀 ${fac(a[0])} falls${a[1] ? ` to ${fac(a[1])}` : ''}`,
    era: () => `👑 ${fac(a[0])} reaches era ${num(a[1])}`,
  }[tag];
  if (line) console.log(`  ${mins(t).padStart(5)}  ${line()}`);
}

// ---- your opening: what you built and trained, first 12 minutes ---------
const opening = log.orders.filter(o => num(o[0]) < 720 && (o[1] === 'place' || o[1] === 'train' || o[1] === 'era_up'));
console.log('\nYOUR OPENING (place/train orders, first 12 min)');
console.log('  ' + (opening.map(o => `${mins(o[0])} ${clean(o[2] ?? o[1], 24)}`).join(' · ') || 'none'));

// ---- curves table --------------------------------------------------------
const step = Math.max(2, Math.ceil(duration / 8));
console.log(`\nCURVES — army/workers/regions/era (every ${step} min, * = you)`);
console.log('  min  ' + players.map(p => `${p === me ? '*' : ''}${fac(p)}`.padEnd(13)).join(''));
for (let m = step; m <= duration + 0.5; m += step) {
  const s = snapAt(m);
  const cells = players.map(p => {
    if (fellAt[p] != null && num(s[0]) > fellAt[p]) return '—'.padEnd(13);
    const r = row(s, p);
    return `${cell(r, C.army)}/${cell(r, C.workers)}/${cell(r, C.regions)}/${cell(r, C.era)}`.padEnd(13);
  });
  console.log(`  ${String(m).padStart(3)}  ` + cells.join(''));
}

// ---- your habits ---------------------------------------------------------
const counts = {};
for (const o of log.orders) { const k = clean(o[1], 20); counts[k] = (counts[k] ?? 0) + 1; }
const mix = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
const active = Math.min(duration, (fellAt[me] ?? Infinity) / 60);
const laterSnaps = log.snaps.filter(s => num(s[0]) > 120 && num(s[0]) < (fellAt[me] ?? Infinity));
const avg = col => laterSnaps.length
  ? laterSnaps.reduce((a, s) => a + cell(row(s, me), col), 0) / laterSnaps.length : 0;
const floatSnaps = log.snaps.filter(s => num(s[0]) > 480 && num(s[0]) < (fellAt[me] ?? Infinity));
const favg = col => floatSnaps.length
  ? Math.round(floatSnaps.reduce((a, s) => a + cell(row(s, me), col), 0) / floatSnaps.length) : 0;
const final = row(log.snaps.at(-1), me);

console.log('\nYOUR HABITS');
console.log(`  orders: ${log.orders.length} (${(log.orders.length / Math.max(active, 1)).toFixed(1)}/min) · ${mix || 'none'}`);
console.log(`  idle workers: avg ${avg(C.idleWorkers).toFixed(1)} of ${avg(C.workers).toFixed(1)}` +
  ` · losses: ${cell(final, C.lossesArmy)} army, ${cell(final, C.lossesWorkers)} workers`);
if (floatSnaps.length) console.log(`  avg stockpile after min 8: 🌾${favg(C.food)} 🪵${favg(C.wood)} 🪙${favg(C.gold)} 📜${favg(C.identity)}`);
if (log.forests) console.log(`  forests (all nations): ${num(log.forests.cut)} cut · ${num(log.forests.grown)} regrown`);
const myFlips = log.events.filter(e => e[1] === 'flip' && e[3] === me);
console.log(`  regions gained: ${myFlips.filter(e => e[4] === 'conviction').length} by conviction, ` +
  `${myFlips.filter(e => e[4] === 'conquest').length} by conquest, ${myFlips.filter(e => e[4] === 'defection').length} by defection`);

// ---- heuristic flags -------------------------------------------------------
const flags = [];
if (avg(C.idleWorkers) > 1.5) flags.push(`workers idle (avg ${avg(C.idleWorkers).toFixed(1)}) — '.' cycles idle workers; keep them tasked`);
for (const [k, icon] of [['food', '🌾'], ['wood', '🪵'], ['gold', '🪙']]) {
  if (favg(C[k]) > 500) flags.push(`${icon} ${k} floats at ~${favg(C[k])} — spend it (units, buildings, era)`);
}
if (favg(C.identity) > 350) flags.push(`📜 identity floats at ~${favg(C.identity)} — start conversions or push the next era`);
if (duration >= 10 && (fellAt[me] ?? Infinity) > 600) {
  const s10 = snapAt(10);
  const best = Math.max(...rivals.filter(p => (fellAt[p] ?? Infinity) > num(s10[0])).map(p => cell(row(s10, p), C.army)));
  const mine = cell(row(s10, me), C.army);
  if (mine < best / 2) flags.push(`army at min 10: ${mine} vs strongest rival ${best} — you were open to a rush`);
}
const eraTimes = Object.fromEntries(log.events.filter(e => e[1] === 'era' && e[3] === 1).map(e => [e[2], num(e[0])]));
if (eraTimes[me] == null && Object.keys(eraTimes).length >= 2 && duration > 12) {
  flags.push(`never reached era 1 — ${Object.keys(eraTimes).length} rivals did (signature tech + buildings missed)`);
} else if (eraTimes[me] != null) {
  const earlier = Object.entries(eraTimes).filter(([p, t]) => p !== me && t < eraTimes[me]).length;
  if (earlier >= 3) flags.push(`era 1 at min ${mins(eraTimes[me])}, after ${earlier} rivals — push it sooner`);
}
if (!counts.amove && (counts.attack ?? 0) + (counts.move ?? 0) > 20) {
  flags.push(`attack-move never used (F+click) — armies moved blind past enemies`);
}
const myRazed = log.events.filter(e => e[1] === 'razed' && e[2] === me).length;
if (myRazed >= 2 && !counts.repair) flags.push(`${myRazed} of your buildings razed, repair never used — workers can mend under fire`);
const capped = log.snaps.filter(s => num(s[0]) < (fellAt[me] ?? Infinity) &&
  cell(row(s, me), C.pop) >= cell(row(s, me), C.popCap) && cell(row(s, me), C.food) > 120).length;
if (capped >= 3) flags.push(`supply-blocked in ${capped} snapshots (pop = cap with food banked) — build houses ahead of need`);

console.log('\nFLAGS');
console.log(flags.length ? flags.map(f => `  ⚠ ${f}`).join('\n') : '  none — clean fundamentals');
