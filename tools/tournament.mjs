#!/usr/bin/env node
// Balance tournament: N fully-AI games (all five nations played by their AI),
// one JSON line per game with winner, duration, flip methods, and final state.
//   node tools/tournament.mjs [games=20] [maxMinutes=60] [--patch=exp.json]

import { runGame, ticksToMinutes } from './headless.mjs';
import { applyPatchArg } from './patch.mjs';

applyPatchArg(process.argv);
const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const games = Number(pos[0] || 20);
const maxMinutes = Number(pos[1] || 60);

for (let g = 0; g < games; g++) {
  const flips = {};
  const eras = {};
  const fell = {}; // nation -> its killer and the minute it died
  let firstFall = null;

  const { world, ticks } = runGame({
    minutes: maxMinutes,
    onEvent(ev, t) {
      if (ev.type === 'region_flipped' && ev.owner) {
        flips[ev.owner] ??= { conviction: 0, conquest: 0, defection: 0 };
        flips[ev.owner][ev.how] = (flips[ev.owner][ev.how] ?? 0) + 1;
      }
      if (ev.type === 'nation_fell') {
        if (!firstFall) firstFall = ev.owner;
        fell[ev.owner] = { by: ev.conqueror ?? null, min: +ticksToMinutes(t).toFixed(1) };
      }
      if (ev.type === 'era_advanced') eras[ev.owner] = ev.era;
    },
  });

  const finalRegions = {};
  for (const r of Object.values(world.regions)) {
    const k = r.owner ?? 'neutral';
    finalRegions[k] = (finalRegions[k] ?? 0) + 1;
  }
  console.log(JSON.stringify({
    game: g,
    winner: world.winner ?? null,
    minutes: +ticksToMinutes(ticks).toFixed(1),
    firstFall,
    fell,
    finalRegions,
    flips,
    eras,
    alive: Object.values(world.players).filter(p => p.alive).map(p => p.id),
  }));
}
