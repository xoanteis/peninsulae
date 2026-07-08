// Generic screenshot check: boot, settle, one PNG. For ship-quality visuals or
// when a JSON check needs eyes on it. Cheap read: VIEWPORT=960x600 DSF=1.
//   PWTOOLS=<dir> QUERY='?faction=x' [FFWD=9000] node tools/verify.mjs <outdir> tools/checks/shot.mjs
export async function run(page, { shot, sleep }) {
  await sleep(1500);
  const ffwd = Number(process.env.FFWD ?? 0);
  if (ffwd) {
    await page.evaluate(n => { const w = window.__game.world; for (let i = 0; i < n; i++) w.step(); w.events.length = 0; }, ffwd);
    await sleep(600);
  }
  await shot('shot');
}
