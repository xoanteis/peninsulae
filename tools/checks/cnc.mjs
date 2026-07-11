export async function run(page, { shot, sleep, report }) {

  // overview of the new 63x46 map
  await page.evaluate(() => { const g = window.__game; g.rig.goalDist = 82; g.rig.jumpTo(63, 40); });
  await sleep(1500);
  await shot('cnc-overview');
  await page.evaluate(() => { const g = window.__game; const c = g.world.entities.get(g.world.players.galicia.capitalId); g.rig.jumpTo(c.x, c.z); g.rig.goalDist = 16; });
  await sleep(1300);

  // E: select all soldiers on screen
  await page.keyboard.press('KeyE');
  await sleep(200);
  report.checks.selectMilitary = await page.evaluate(() => window.__game.selection.size);

  // Ctrl+1 assign, clear, 1 recall
  await page.keyboard.down('Control');
  await page.keyboard.press('Digit1');
  await page.keyboard.up('Control');
  await page.evaluate(() => { window.__game.selection.clear(); });
  await page.keyboard.press('Digit1');
  await sleep(150);
  report.checks.groupRecall = await page.evaluate(() => window.__game.selection.size);

  // F + left-click = attack-move; unit should be moving with amove task
  const ground = await page.evaluate(() => {
    const g = window.__game;
    const c = g.world.entities.get(g.world.players.galicia.capitalId);
    return g.controls.project(c.x + 6, c.z + 4);
  });
  await page.keyboard.press('KeyF');
  await sleep(120);
  await page.mouse.click(ground.x, ground.y);
  await sleep(300);
  report.checks.amove = await page.evaluate(() => {
    const g = window.__game;
    const ids = [...g.selection];
    const tasks = ids.map(id => g.world.entities.get(id)?.task?.type);
    return { tasks: [...new Set(tasks)], cursorReset: g.controls.amove === false };
  });

  // X = stop (S pans the camera since the usability pack)
  await page.keyboard.press('KeyX');
  await sleep(200);
  report.checks.stopped = await page.evaluate(() => {
    const g = window.__game;
    return [...g.selection].every(id => g.world.entities.get(id)?.state === 'idle');
  });

  // double-click a worker selects all workers on screen
  const w = await page.evaluate(() => {
    const g = window.__game;
    const u = [...g.world.entities.values()].find(e => e.type === 'unit' && e.kind === 'worker' && e.owner === 'galicia');
    const s = g.controls.project(u.x, u.z);
    return { x: s.x, y: s.y };
  });
  await page.mouse.click(w.x, w.y + 4);
  await sleep(120);
  await page.mouse.click(w.x, w.y + 4);
  await sleep(250);
  report.checks.doubleClick = await page.evaluate(() => {
    const g = window.__game;
    const kinds = [...g.selection].map(id => g.world.entities.get(id)?.kind);
    return { n: g.selection.size, kinds: [...new Set(kinds)] };
  });

  // right-drag pans the camera; quick right-click still orders
  const t0 = await page.evaluate(() => ({ ...window.__game.rig.goalTarget }));
  await page.mouse.move(700, 400);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(560, 320, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await sleep(250);
  const t1 = await page.evaluate(() => ({ ...window.__game.rig.goalTarget }));
  report.checks.rightDragPan = +(Math.hypot(t1.x - t0.x, t1.z - t0.z)).toFixed(2);

  const move = await page.evaluate(() => {
    const g = window.__game;
    const u = [...g.selection][0];
    const e = g.world.entities.get(u);
    return e ? g.controls.project(e.x + 4, e.z + 3) : null;
  });
  if (move) {
    await page.mouse.click(move.x, move.y, { button: 'right' });
    await sleep(250);
    report.checks.rightClickOrder = await page.evaluate(() => {
      const g = window.__game;
      const types = [...g.selection].map(id => g.world.entities.get(id)?.task?.type);
      return [...new Set(types)];
    });
  }

  // edge scroll: park the cursor at the right edge
  const t2 = await page.evaluate(() => ({ ...window.__game.rig.goalTarget }));
  await page.mouse.move(1438, 450);
  await sleep(1200);
  const t3 = await page.evaluate(() => ({ ...window.__game.rig.goalTarget }));
  report.checks.edgeScroll = +(Math.hypot(t3.x - t2.x, t3.z - t2.z)).toFixed(2);
  await page.mouse.move(700, 400);

  // H = home
  await page.evaluate(() => window.__game.rig.jumpTo(100, 60));
  await sleep(300);
  await page.keyboard.press('KeyH');
  await sleep(300);
  report.checks.homeKey = await page.evaluate(() => {
    const g = window.__game;
    const c = g.world.entities.get(g.world.players.galicia.capitalId);
    return Math.hypot(g.rig.goalTarget.x - c.x, g.rig.goalTarget.z - c.z) < 2;
  });

  // F1 opens help
  await page.keyboard.press('F1');
  await sleep(300);
  report.checks.f1Help = await page.evaluate(() => !document.getElementById('help-overlay').classList.contains('hidden'));
  await page.keyboard.press('F1');

  report.checks.errors = await page.evaluate(() => window.__game.errors);
}
