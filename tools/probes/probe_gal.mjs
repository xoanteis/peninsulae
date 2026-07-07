// AI-vs-AI probe: snapshot Galicia's development at minute 12 (peak, before a
// typical death) across N games — the diagnostic for "what does the AI actually
// build with this kit". Pattern: change config/patch, re-run, compare averages.
//   N=8 node tools/probes/probe_gal.mjs
import { World } from '../../src/sim/world.js';
import { AIController } from '../../src/sim/ai.js';

function runGame() {
  const world = new World('galicia');
  world.ai.push(new AIController(world, 'galicia')); // nobody idles
  let snap = null;
  for (let step = 0; step < 75 * 60 * 10; step++) {
    world.step();
    world.events.length = 0;
    if (!snap && world.time >= 12 * 60) {
      const gal = [...world.entities.values()].filter(e => e.owner === 'galicia');
      const p = world.players.galicia;
      snap = {
        towers: gal.filter(e => e.type === 'building' && e.kind === 'tower').length,
        soldiers: gal.filter(e => e.type === 'unit' && e.kind !== 'worker' && e.kind !== 'militia').length,
        workers: gal.filter(e => e.type === 'unit' && e.kind === 'worker').length,
        barracks: gal.filter(e => e.type === 'building' && e.kind === 'barracks').length,
        regions: Object.values(world.regions).filter(r => r.owner === 'galicia').length,
        gold: Math.round(p.res.gold), alive: p.alive,
      };
    }
    if (world.winner) break;
  }
  return snap;
}

const N = Number(process.env.N || 8);
const agg = { towers: 0, soldiers: 0, workers: 0, barracks: 0, regions: 0, gold: 0, n: 0 };
for (let g = 0; g < N; g++) {
  const s = runGame();
  if (!s) { console.log(`game ${g}: ended before min 12`); continue; }
  for (const k of ['towers', 'soldiers', 'workers', 'barracks', 'regions', 'gold']) agg[k] += s[k];
  agg.n++;
  console.log(`game ${g}: towers=${s.towers} soldiers=${s.soldiers} workers=${s.workers} barracks=${s.barracks} regions=${s.regions} gold=${s.gold} alive=${s.alive}`);
}
console.log(`--- Galicia avg at min 12 (n=${agg.n}) ---`);
for (const k of ['towers', 'soldiers', 'workers', 'barracks', 'regions', 'gold']) console.log(k, (agg[k] / agg.n).toFixed(1));
