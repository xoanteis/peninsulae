// Verifies the UX round: build gating, auto-construction, mountain hint, region labels.
export async function run(page, { shot, sleep, report }) {

  // 1. build menu with only a SOLDIER selected still arms (nation owns workers),
  //    and placement drafts the nearest worker so building starts at once
  report.checks.soldierBuild = await page.evaluate(() => {
    const g = window.__game, w = g.world, pid = g.controls.humanId;
    const soldier = [...w.entities.values()].find(e => e.type === 'unit' && e.kind !== 'worker' && e.owner === pid && e.state !== 'dying');
    g.selection.clear(); if (soldier) g.selection.add(soldier.id);
    g.controls.setPlacing(null);
    document.querySelector('.bm-item[data-kind="house"]').click();
    const armed = g.controls.placing;
    const cap = w.entities.get(w.players[pid].capitalId);
    let spot = null;
    for (const [c, r] of w.freeSpotsAround(cap.col, cap.row, 6)) {
      if (w.canPlaceAt(pid, 'house', c, r) === null) { spot = [c, r]; break; }
    }
    if (!spot) return { armed, error: 'no spot' };
    g.controls.onOrder({ type: 'place', kind: 'house', col: spot[0], row: spot[1] });
    g.controls.setPlacing(null);
    const siteId = w.tileAt(spot[0], spot[1]).building;
    for (let i = 0; i < 200; i++) if (!w.winner) w.step();
    const site = w.entities.get(siteId);
    return {
      armedWithSoldierOnly: armed === 'house',
      siteBuilt: !!siteId,
      progressed: site ? site.progress > 0 : true, // gone => finished => progressed
    };
  });

  // 2. with a worker selected: menu arms, placement auto-assigns, progress runs
  report.checks.place = await page.evaluate(() => {
    const g = window.__game, w = g.world;
    const pid = g.controls.humanId;
    const worker = [...w.entities.values()].find(e => e.type === 'unit' && e.kind === 'worker' && e.owner === pid);
    g.selection.clear(); g.selection.add(worker.id);
    document.querySelector('.bm-item[data-kind="farm"]').click();
    const placingAfter = g.controls.placing;
    const cap = w.entities.get(w.players[pid].capitalId);
    let spot = null;
    for (const [c, r] of w.freeSpotsAround(cap.col, cap.row, 5)) {
      if (w.canPlaceAt(pid, 'farm', c, r) === null) { spot = [c, r]; break; }
    }
    if (!spot) return { placingAfter, error: 'no spot' };
    g.controls.onOrder({ type: 'place', kind: 'farm', col: spot[0], row: spot[1] });
    g.controls.setPlacing(null);
    const t = w.tileAt(spot[0], spot[1]);
    const siteId = t.building;
    for (let i = 0; i < 350; i++) if (!w.winner) w.step();
    const site = w.entities.get(siteId);
    return {
      placingAfter,
      sitePlaced: !!siteId,
      progress: site ? Math.round(site.progress * 100) / 100 : 'gone(complete?)',
      workerWasDrafted: worker.task?.type === 'construct' || site?.progress > 0,
    };
  });

  // 3. workers right-clicked onto a mountain get the mine hint, not a silent move
  await page.evaluate(() => {
    const g = window.__game, w = g.world;
    const pid = g.controls.humanId;
    const worker = [...w.entities.values()].find(e => e.type === 'unit' && e.kind === 'worker' && e.owner === pid);
    g.selection.clear(); g.selection.add(worker.id);
    const cap = w.entities.get(w.players[pid].capitalId);
    let mt = null, best = 1e9;
    for (const t of w.tiles) {
      if (t.terrain !== 'mountain') continue;
      const x = t.col * 2 + (t.row & 1 ? 1 : 0), z = t.row * 1.7320508;
      const d = Math.hypot(x - cap.x, z - cap.z);
      if (d < best) { best = d; mt = { t, x, z }; }
    }
    window.__mt = mt;
    g.rig.jumpTo(mt.x, mt.z);
  });
  await sleep(1200); // let the rig settle and the renderer refresh camera matrices
  report.checks.mountainHint = await page.evaluate(() => {
    const g = window.__game, mt = window.__mt;
    g.camera.updateMatrixWorld(true);
    g.camera.matrixWorldInverse.copy(g.camera.matrixWorld).invert();
    const e = g.camera.matrixWorldInverse.elements, p = g.camera.projectionMatrix.elements;
    const vx = e[0] * mt.x + e[8] * mt.z + e[12];
    const vy = e[1] * mt.x + e[9] * mt.z + e[13];
    const vz = e[2] * mt.x + e[10] * mt.z + e[14];
    const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12];
    const cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13];
    const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
    const sx = (cx / cw + 1) / 2 * window.innerWidth;
    const sy = (-cy / cw + 1) / 2 * window.innerHeight;
    g.controls.contextOrder(sx, sy);
    return { terrainClicked: mt.t.terrain };
  });
  await sleep(500); // the hint travels through the sim event queue to the HUD
  report.checks.mountainHintShown = await page.evaluate(() => {
    const after = document.getElementById('alerts')?.textContent ?? '';
    return { gotHint: after.includes('Mine'), alert: after.slice(-140) };
  });

  // 4. region labels exist, render, and carry owner colors
  report.checks.labels = await page.evaluate(() => {
    const g = window.__game;
    g.rig.jumpTo(g.world.regions.G.center.x, g.world.regions.G.center.z);
    g.rig.goalDist = 60;
    return { count: document.querySelectorAll('.region-label').length };
  });
  await sleep(1500);
  report.checks.labelsShown = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.region-label')];
    const shown = els.filter(el => el.style.display !== 'none');
    const owned = els.filter(el => el.classList.contains('owned'));
    return {
      shown: shown.length,
      owned: owned.length,
      sample: shown.slice(0, 4).map(el => ({ text: el.textContent, color: el.style.color, opacity: el.style.opacity })),
    };
  });
  await shot('ux-labels');
}
