#!/usr/bin/env node
// Turn a recorded human match (src/ui/recorder.js JSON) into a compact report:
// timeline, build order, per-nation curves, the human's habits, and heuristic
// coaching flags. This is the ONLY way match logs should be read — never dump
// the raw JSON into a conversation.
//   node tools/analyze-match.mjs <match.json>

import { readFileSync } from 'node:fs';
import { REGIONS } from '../src/config/map.js';

const rname = k => REGIONS[k]?.name ?? k;
const file = process.argv[2];
if (!file) { console.error('usage: node tools/analyze-match.mjs <match.json>'); process.exit(1); }
const log = JSON.parse(readFileSync(file, 'utf8'));

const C = Object.fromEntries(log.meta.snapCols.map((k, i) => [k, i]));
const players = log.meta.players;
const me = log.meta.faction;
const rivals = players.filter(p => p !== me);
const duration = (log.result?.time ?? log.snaps.at(-1)?.[0] ?? 0) / 60;
const mins = t => (t / 60).toFixed(1);
const row = (snap, pid) => snap[1][players.indexOf(pid)];
const snapAt = min => log.snaps.reduce((best, s) =>
  Math.abs(s[0] - min * 60) < Math.abs(best[0] - min * 60) ? s : best, log.snaps[0]);
const fellAt = Object.fromEntries(log.events.filter(e => e[1] === 'fell').map(e => [e[2], e[0]]));

// ---- header ------------------------------------------------------------
console.log(`MATCH  you=${me} · ${log.meta.date.slice(0, 16)} · ${duration.toFixed(1)} min · ` +
  (log.result
    ? `winner: ${log.result.winner ?? 'draw'} · you ${log.result.humanSurvived ? 'survived' : `fell (min ${mins(fellAt[me] ?? 0)})`}`
    : 'IN PROGRESS (mid-game save)'));

// ---- timeline: the strategic beats --------------------------------------
console.log('\nTIMELINE');
for (const e of log.events) {
  const [t, tag, ...a] = e;
  const line = {
    flip: () => `⚑ ${rname(a[0])} → ${a[1] ?? 'independence'} (${a[2]})`,
    fell: () => `💀 ${a[0]} falls${a[1] ? ` to ${a[1]}` : ''}`,
    era: () => `👑 ${a[0]} reaches era ${a[1]}`,
  }[tag];
  if (line) console.log(`  ${mins(t).padStart(5)}  ${line()}`);
}

// ---- your opening: what you built and trained, first 12 minutes ---------
const opening = log.orders.filter(o => o[0] < 720 && (o[1] === 'place' || o[1] === 'train' || o[1] === 'era_up'));
console.log('\nYOUR OPENING (place/train orders, first 12 min)');
console.log('  ' + (opening.map(o => `${mins(o[0])} ${o[2] ?? o[1]}`).join(' · ') || 'none'));

// ---- curves table --------------------------------------------------------
const step = Math.max(2, Math.ceil(duration / 8));
console.log(`\nCURVES — army/workers/regions/era (every ${step} min, * = you)`);
console.log('  min  ' + players.map(p => `${p === me ? '*' : ''}${p}`.padEnd(13)).join(''));
for (let m = step; m <= duration + 0.5; m += step) {
  const s = snapAt(m);
  const cells = players.map(p => {
    if (fellAt[p] != null && s[0] > fellAt[p]) return '—'.padEnd(13);
    const r = row(s, p);
    return `${r[C.army]}/${r[C.workers]}/${r[C.regions]}/${r[C.era]}`.padEnd(13);
  });
  console.log(`  ${String(m).padStart(3)}  ` + cells.join(''));
}

// ---- your habits ---------------------------------------------------------
const counts = {};
for (const o of log.orders) counts[o[1]] = (counts[o[1]] ?? 0) + 1;
const mix = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
const active = Math.min(duration, (fellAt[me] ?? Infinity) / 60);
const laterSnaps = log.snaps.filter(s => s[0] > 120 && s[0] < (fellAt[me] ?? Infinity));
const avg = col => laterSnaps.length
  ? laterSnaps.reduce((a, s) => a + row(s, me)[col], 0) / laterSnaps.length : 0;
const floatSnaps = log.snaps.filter(s => s[0] > 480 && s[0] < (fellAt[me] ?? Infinity));
const favg = col => floatSnaps.length
  ? Math.round(floatSnaps.reduce((a, s) => a + row(s, me)[col], 0) / floatSnaps.length) : 0;
const final = row(log.snaps.at(-1), me);

console.log('\nYOUR HABITS');
console.log(`  orders: ${log.orders.length} (${(log.orders.length / Math.max(active, 1)).toFixed(1)}/min) · ${mix || 'none'}`);
console.log(`  idle workers: avg ${avg(C.idleWorkers).toFixed(1)} of ${avg(C.workers).toFixed(1)}` +
  ` · losses: ${final[C.lossesArmy]} army, ${final[C.lossesWorkers]} workers`);
if (floatSnaps.length) console.log(`  avg stockpile after min 8: 🌾${favg(C.food)} 🪵${favg(C.wood)} 🪙${favg(C.gold)} 📜${favg(C.identity)}`);
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
  const best = Math.max(...rivals.filter(p => (fellAt[p] ?? Infinity) > s10[0]).map(p => row(s10, p)[C.army]));
  const mine = row(s10, me)[C.army];
  if (mine < best / 2) flags.push(`army at min 10: ${mine} vs strongest rival ${best} — you were open to a rush`);
}
const eraTimes = Object.fromEntries(log.events.filter(e => e[1] === 'era' && e[3] === 1).map(e => [e[2], e[0]]));
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
const capped = log.snaps.filter(s => s[0] < (fellAt[me] ?? Infinity) &&
  row(s, me)[C.pop] >= row(s, me)[C.popCap] && row(s, me)[C.food] > 120).length;
if (capped >= 3) flags.push(`supply-blocked in ${capped} snapshots (pop = cap with food banked) — build houses ahead of need`);

console.log('\nFLAGS');
console.log(flags.length ? flags.map(f => `  ⚠ ${f}`).join('\n') : '  none — clean fundamentals');
