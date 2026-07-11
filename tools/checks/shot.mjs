// Generic screenshot check: boot, settle, one PNG. For ship-quality visuals or
// when a JSON check needs eyes on it. Cheap read: VIEWPORT=960x600 DSF=1.
//   PWTOOLS=<dir> QUERY='?faction=x' [FFWD=9000] node tools/verify.mjs <outdir> tools/checks/shot.mjs
export async function run(page, { shot, sleep, ffwd }) {
  const n = Number(process.env.FFWD ?? 0);
  if (n) {
    await ffwd(n);
    await sleep(600);
  }
  await shot('shot');
}
