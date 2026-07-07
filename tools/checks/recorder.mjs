// Verifies the match recorder: presence, order funnel, snapshot cadence,
// localStorage backup, and the end-screen save button.
export async function run(page, { sleep, report }) {
  await sleep(900);

  report.checks.wiring = await page.evaluate(() => {
    const g = window.__game, r = g.recorder;
    if (!r) return { present: false };
    const ordersBefore = r.log.orders.length;
    g.controls.onOrder({ type: 'move', ids: [], x: 10, z: 10 });
    g.controls.onOrder({ type: 'ui' }); // must be filtered out
    const snapsBefore = r.log.snaps.length;
    for (let i = 0; i < 260; i++) if (!g.world.winner) g.world.step();
    r.update();
    return {
      present: true,
      faction: r.log.meta.faction === g.controls.humanId,
      bootSnap: snapsBefore >= 1,
      snapGrew: r.log.snaps.length > snapsBefore,
      orderRecorded: r.log.orders.length === ordersBefore + 1,
      serializes: JSON.parse(r.serialize()).v === 1,
    };
  });

  report.checks.endScreen = await page.evaluate(() => {
    const g = window.__game;
    g.hud.showEnd('castile');
    const btn = document.getElementById('btn-matchlog');
    g.recorder.backup();
    const stored = localStorage.getItem('peninsulae:lastMatch');
    return {
      saveButton: !!btn,
      buttonWired: typeof btn?.onclick === 'function',
      backupStored: !!stored && JSON.parse(stored).meta.faction === g.controls.humanId,
    };
  });
}
