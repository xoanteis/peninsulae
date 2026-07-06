#!/usr/bin/env node
// Balance tournament: N fully-AI games (all five nations played by their AI),
// one JSON line per game with winner, duration, flip methods, and final state.
//   node tools/tournament.mjs [games=20] [maxMinutes=60]

import { World } from '../src/sim/world.js';
import { AIController } from '../src/sim/ai.js';
import { TICK_MS } from '../src/config/rules.js';

const games = Number(process.argv[2] || 20);
const maxMinutes = Number(process.argv[3] || 60);
const ticksPerGame = maxMinutes * 60000 / TICK_MS;

for (let g = 0; g < games; g++) {
  const world = new World('galicia');
  world.ai.push(new AIController(world, 'galicia')); // nobody idles
  const flips = {};
  const eras = {};
  let firstFall = null;

  let t = 0;
  for (; t < ticksPerGame; t++) {
    world.step();
    for (const ev of world.events) {
      if (ev.type === 'region_flipped' && ev.owner) {
        flips[ev.owner] ??= { conviction: 0, conquest: 0, defection: 0 };
        flips[ev.owner][ev.how] = (flips[ev.owner][ev.how] ?? 0) + 1;
      }
      if (ev.type === 'nation_fell' && !firstFall) firstFall = ev.owner;
      if (ev.type === 'era_advanced') eras[ev.owner] = ev.era;
    }
    world.events.length = 0;
    if (world.winner) break;
  }

  const finalRegions = {};
  for (const r of Object.values(world.regions)) {
    const k = r.owner ?? 'neutral';
    finalRegions[k] = (finalRegions[k] ?? 0) + 1;
  }
  console.log(JSON.stringify({
    game: g,
    winner: world.winner ?? null,
    minutes: +(t * TICK_MS / 60000).toFixed(1),
    firstFall,
    finalRegions,
    flips,
    eras,
    alive: Object.values(world.players).filter(p => p.alive).map(p => p.id),
  }));
}
