#!/usr/bin/env node
// Headless simulation test: runs full AI-vs-AI games with no renderer.
//   node tools/simtest.mjs [minutes] [humanFaction]
// The "human" player idles, so its AI rivals should out-expand it.

import { runGame, minutesToTicks } from './headless.mjs';

const minutes = Number(process.argv[2] || 12);
const human = process.argv[3] || 'galicia';
const ticksPerMin = minutesToTicks(1);

let eventCounts = {};
let lastReport = 0;
const t0 = Date.now();

const { world, ticks } = runGame({
  minutes,
  human,
  humanPlays: false, // the "human" idles
  onEvent(ev, tick) {
    eventCounts[ev.type] = (eventCounts[ev.type] ?? 0) + 1;
    if (['region_flipped', 'nation_fell', 'victory', 'era_advanced', 'signature_tech'].includes(ev.type)) {
      console.log(`[${(tick / ticksPerMin).toFixed(1)}m]`, ev.type, JSON.stringify(ev));
    }
  },
  onTick(world, tick) {
    const min = Math.floor(tick / ticksPerMin);
    if (min > lastReport || tick === 0) {
      lastReport = min;
      const rows = Object.values(world.players).map(p => {
        const units = [...world.entities.values()].filter(e => e.type === 'unit' && e.owner === p.id);
        const workers = units.filter(u => u.kind === 'worker').length;
        const mil = units.length - workers;
        const buildings = [...world.entities.values()].filter(e => e.type === 'building' && e.owner === p.id).length;
        const regions = Object.values(world.regions).filter(r => r.owner === p.id).length;
        const r = p.res;
        return `${p.id.padEnd(10)} ${p.alive ? 'alive' : 'DEAD '} era${p.era} reg:${regions} w:${workers} m:${mil} b:${buildings} F${r.food | 0} W${r.wood | 0} G${r.gold | 0} I${r.identity | 0} pop ${p.pop}/${p.popCap}`;
      });
      console.log(`--- minute ${min} ---\n` + rows.join('\n'));
    }
  },
});

if (world.winner) console.log(`WINNER: ${world.winner} at ${(ticks / ticksPerMin).toFixed(1)} minutes`);
console.log('\nevents:', JSON.stringify(eventCounts));
console.log(`sim speed: ${(minutes * ticksPerMin / ((Date.now() - t0) / 1000)).toFixed(0)} ticks/s`);
