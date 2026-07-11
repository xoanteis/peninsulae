// AI-vs-AI probe: Basque development snapshots at minutes 12 and 18, plus their
// region flips — the diagnostic for "can the Basques actually convert their kit
// into map presence". Accepts a runtime patch like round.mjs.
//   N=8 node tools/probes/probe_basque.mjs [patch.json]
import { readFileSync } from 'node:fs';
import { applyPatch } from '../patch.mjs';
import { runGame } from '../headless.mjs';

const patchPath = process.argv[2];
if (patchPath) applyPatch(JSON.parse(readFileSync(patchPath, 'utf8')));

function snap(world) {
  const b = [...world.entities.values()].filter(e => e.owner === 'basque');
  const p = world.players.basque;
  return {
    soldiers: b.filter(e => e.type === 'unit' && e.kind !== 'worker' && e.kind !== 'militia').length,
    workers: b.filter(e => e.type === 'unit' && e.kind === 'worker').length,
    mines: b.filter(e => e.type === 'building' && e.kind === 'mine' && e.progress >= 1).length,
    regions: Object.values(world.regions).filter(r => r.owner === 'basque').length,
    gold: Math.round(p.res.gold), identity: Math.round(p.res.identity), era: p.era,
    alive: p.alive,
  };
}

const N = Number(process.env.N || 8);
for (let g = 0; g < N; g++) {
  let flips = 0, s12 = null, s18 = null;
  const { world } = runGame({
    minutes: 75,
    onEvent(ev) { if (ev.type === 'region_flipped' && ev.owner === 'basque') flips++; },
    onTick(world) {
      if (!s12 && world.time >= 12 * 60) s12 = snap(world);
      if (!s18 && world.time >= 18 * 60) s18 = snap(world);
    },
  });
  console.log(`g${g} @12m: army=${s12?.soldiers} mines=${s12?.mines} regions=${s12?.regions} gold=${s12?.gold} id=${s12?.identity} era=${s12?.era} | @18m: army=${s18?.soldiers} regions=${s18?.regions} id=${s18?.identity} era=${s18?.era} alive=${s18?.alive} | flips=${flips} winner=${world.winner}`);
}
