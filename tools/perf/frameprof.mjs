// Browser frame profiler (verify.mjs check script): fast-forwards the sim to a
// busy mid-game, then samples ~12s of live running — V8 profile via CDP, rAF
// frame deltas, three.js renderer counters.
//
//   PWTOOLS=<dir> QUERY='?faction=galicia' PROF_OUT=/tmp/page.cpuprofile \
//     node tools/verify.mjs <outdir> tools/perf/frameprof.mjs
//
// READ THE COUNTERS, NOT THE FRAME TIMES: headless renders through SwiftShader
// (software GL), so absolute ms don't transfer to real GPUs. What transfers is
// CPU submission cost — drawCalls, unique materials (see scenecensus.mjs),
// texture count. Analyze PROF_OUT grouped by file/function (V8 cpuprofile JSON).
import { writeFileSync } from 'node:fs';

export async function run(page, { sleep, report }) {
  await sleep(1800);
  await page.evaluate(() => {
    const w = window.__game.world;
    for (let i = 0; i < 9000; i++) w.step(); // minute 15 — armies out
    w.events.length = 0; // don't flood the UI with the backlog
  });
  await sleep(500);

  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = t => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); // µs
  await cdp.send('Profiler.start');
  await sleep(12000);
  const { profile } = await cdp.send('Profiler.stop');
  writeFileSync(process.env.PROF_OUT ?? '/tmp/page.cpuprofile', JSON.stringify(profile));

  report.checks.frame = await page.evaluate(() => {
    const f = window.__frames.slice(5).sort((a, b) => a - b);
    const q = p => f[Math.floor(f.length * p)];
    const g = window.__game, info = g.renderer.info;
    let units = 0, buildings = 0;
    for (const e of g.world.entities.values()) e.type === 'unit' ? units++ : buildings++;
    return {
      frames: f.length, mean: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1),
      p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1),
      drawCalls: info.render.calls, triangles: info.render.triangles,
      geometries: info.memory.geometries, textures: info.memory.textures,
      units, buildings, simMin: +(g.world.time / 60).toFixed(1),
    };
  });
}
