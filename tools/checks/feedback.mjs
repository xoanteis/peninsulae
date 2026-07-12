// Regression check for the worker-feedback fix pack: repair->slot handoff,
// slot-full worker_idle events, labeled slot work_pulses, and the HUD 💤 badge.
export async function run(page, { sleep, report }) {
  report.checks.feedback = await page.evaluate(() => {
    const g = window.__game, w = g.world, pid = g.controls.humanId;
    const p = w.players[pid];
    // stage: a completed mine on a free tile near the capital + three fresh workers
    const cap = w.entities.get(p.capitalId);
    const site = w.tiles.find(t => !t.building && t.terrain === 'grass'
      && Math.abs(t.col - cap.col) + Math.abs(t.row - cap.row) <= 4);
    const mine = w.addBuilding(pid, 'mine', site.col, site.row, { complete: true });
    const ws = [1, 2, 3].map(() => w.addUnit(pid, 'worker', site.col, site.row));
    p.res.wood = 500;

    const events = [];
    const origPush = w.pushEvent.bind(w);
    w.pushEvent = ev => { events.push(ev); origPush(ev); };

    // 1. repair->slot handoff: repairing a chipped mine should end in mining it
    mine.hp = Math.round(mine.maxHp * 0.6);
    w.orderRepair(pid, [ws[0].id], mine.id);
    for (let i = 0; i < 200 && !mine.slots.includes(ws[0].id); i++) w.step();
    const handoff = mine.slots.includes(ws[0].id) && mine.hp === mine.maxHp;

    // 2. slot-full: with both slots taken, the extra worker idles AND says so
    w.orderGather(pid, [ws[1].id], { type: 'slot', buildingId: mine.id });
    w.orderGather(pid, [ws[2].id], { type: 'slot', buildingId: mine.id });
    for (let i = 0; i < 150; i++) w.step();
    const slotsFullEvent = events.some(e => e.type === 'worker_idle' && e.reason === 'slots_full' && e.kind === 'mine');
    const twoMining = mine.slots.length === 2;
    const extraIdle = [ws[1], ws[2]].some(u => u.state === 'idle');

    // 3. labeled pulses: slot work_pulse events carry the building kind
    const minePulse = events.some(e => e.type === 'work_pulse' && e.task === 'slot' && e.kind === 'mine');

    w.pushEvent = origPush;
    return { handoff, twoMining, extraIdle, slotsFullEvent, minePulse, errors: g.errors };
  });

  // 4. the HUD 💤 badge shows up while a worker idles (renders on a later frame)
  await sleep(1200);
  report.checks.idleBadge = await page.evaluate(() =>
    document.querySelector('#idle-badge')?.textContent ?? null);

  // 5. train button must not move under a spam-clicking cursor: queue row has a
  //    fixed footprint and handlers rebuild synchronously
  report.checks.trainSpam = await page.evaluate(() => {
    const g = window.__game, w = g.world, pid = g.controls.humanId;
    const p = w.players[pid];
    p.res.food = 2000; p.res.wood = 2000; p.res.gold = 2000;
    const cap = w.entities.get(p.capitalId);
    g.selection.clear();
    g.selection.add(cap.id);
    g.hud.renderSelPanel(g.selection);
    const btn = () => document.querySelector('#sel-panel [data-train="worker"]');
    const r0 = btn().getBoundingClientRect();
    for (let i = 0; i < 10; i++) btn().click(); // re-query: each click rebuilds the panel
    const r1 = btn().getBoundingClientRect();
    for (let i = 0; i < 20; i++) w.step(); // 2s of training
    g.hud.renderSelPanel(g.selection);
    return {
      queued: cap.trainQueue.length, // cap is 10
      buttonStable: r0.top === r1.top && r0.left === r1.left,
      groupedChip: document.querySelector('#sel-panel .sp-chip')?.textContent.includes('×10') ?? false,
      pct: document.querySelector('#sel-panel .sp-pct')?.textContent ?? null,
    };
  });

  // 6. pop-cap badge: appears when supply-blocked, click arms house placement
  report.checks.popBadge = await page.evaluate(() => {
    const g = window.__game, p = g.world.players[g.controls.humanId];
    const saved = p.popCap;
    p.popCap = p.pop; // simulate a supply block
    g.hud.update(1, g.selection); // force a res-bar refresh
    const shown = !!document.getElementById('pop-badge');
    document.getElementById('pop-badge')?.click();
    const placingHouse = g.controls.placing === 'house';
    g.controls.setPlacing(null);
    p.popCap = saved;
    g.hud.update(1, g.selection);
    return { shown, placingHouse, goneAfter: !document.getElementById('pop-badge') };
  });

  // 7. the ⚔ command bar exists on desktop (fine-pointer) too
  report.checks.commandBar = await page.evaluate(() => !!document.getElementById('tb-amove'));

  // 7b. smart right-click: military-only ground clicks attack-move; workers and
  //     alt-clicks stay plain moves
  report.checks.smartClick = await page.evaluate(() => {
    const g = window.__game, w = g.world, pid = g.controls.humanId;
    const cap = w.entities.get(w.players[pid].capitalId);
    const s1 = w.addUnit(pid, 'soldier', cap.col, cap.row);
    const s2 = w.addUnit(pid, 'soldier', cap.col, cap.row);
    const wk = w.addUnit(pid, 'worker', cap.col, cap.row);
    const t = g.controls.groundOrderType.bind(g.controls);
    return {
      army: t([s1.id, s2.id], false),        // amove
      armyAlt: t([s1.id, s2.id], true),      // move
      mixed: t([s1.id, s2.id, wk.id], false), // move
      workers: t([wk.id], false),            // move
    };
  });

  // 7c. 🔧 badge: appears for damaged buildings, click cycles to them; and the
  //     🏠 badge fires EARLY when the queue will outrun housing
  report.checks.badges = await page.evaluate(() => {
    const g = window.__game, w = g.world, pid = g.controls.humanId;
    const p = w.players[pid];
    const cap = w.entities.get(p.capitalId);
    const tower = [...w.entities.values()].find(e => e.type === 'building' && e.owner === pid && e.kind === 'tower');
    tower.hp = Math.round(tower.maxHp * 0.4);
    g.hud.update(1, g.selection);
    const repairShown = document.getElementById('repair-badge')?.textContent ?? null;
    document.getElementById('repair-badge')?.click();
    const cycledTo = g.selection.has(tower.id);
    tower.hp = tower.maxHp;
    // predictive housing: fill the queue so pop + queued > cap while pop < cap
    p.res.food = 5000;
    for (let i = 0; i < 10; i++) w.trainUnit(pid, cap.id, 'worker');
    const savedCap = p.popCap;
    p.popCap = p.pop + 3; // pop below cap, queue overshoots
    g.hud.update(1, g.selection);
    const soon = document.getElementById('pop-badge')?.className.includes('pop-soon') ?? false;
    cap.trainQueue.length = 0;
    p.popCap = savedCap;
    g.hud.update(1, g.selection);
    const cleared = !document.getElementById('repair-badge') && !document.getElementById('pop-badge');
    return { repairShown, cycledTo, soon, cleared };
  });

  // 8. cut forests regrow (stump queue in the economy tick) — wood is renewable
  report.checks.forestRegrow = await page.evaluate(() => {
    const g = window.__game, w = g.world, pid = g.controls.humanId;
    const cap = w.entities.get(w.players[pid].capitalId);
    const t = w.tiles.find(t => t.terrain === 'forest'
      && Math.abs(t.col - cap.col) + Math.abs(t.row - cap.row) <= 6);
    const worker = w.addUnit(pid, 'worker', t.col, t.row);
    t.wood = 1; // one swing left
    w.orderGather(pid, [worker.id], { type: 'forest', col: t.col, row: t.row });
    for (let i = 0; i < 100 && t.terrain === 'forest'; i++) w.step();
    const cut = t.terrain === 'grass' && t.regrowAt > w.time;
    t.regrowAt = w.time; // fast-forward instead of stepping 210s of sim
    for (let i = 0; i < 5; i++) w.step();
    return {
      cut, regrown: t.terrain === 'forest', wood: Math.round(t.wood),
      recorded: g.recorder?.log.forests ?? null,          // telemetry counters
      fingerprint: g.recorder?.log.meta.rules ?? null,     // build fingerprint
    };
  });

  // 9. the fully-loaded res-bar (badges shown) must not slide under the
  //    domination bar — DOM geometry passes even when pixels are covered
  report.checks.hudOverlap = await page.evaluate(() => {
    const g = window.__game, p = g.world.players[g.controls.humanId];
    const saved = p.popCap;
    p.popCap = p.pop; // force the 🏠 badge so the bar is at max length
    g.hud.update(1, g.selection);
    const rb = document.getElementById('res-bar').getBoundingClientRect();
    const dom = document.getElementById('domination').getBoundingClientRect();
    p.popCap = saved;
    g.hud.update(1, g.selection);
    return { resRight: Math.round(rb.right), domLeft: Math.round(dom.left), clear: rb.right <= dom.left };
  });

  // 6. place-hint banner tracks EVERY exit path (all funnel through setPlacing)
  report.checks.placeHint = await page.evaluate(() => {
    const g = window.__game, hint = document.getElementById('place-hint');
    const hidden = () => hint.classList.contains('hidden');
    g.controls.setPlacing('farm');
    const shownOnPlace = !hidden(), text = hint.textContent;
    g.controls.setPlacing(null); // same path Esc / click-to-place / touch take
    const hiddenAfter = hidden();
    return { shownOnPlace, text, hiddenAfter };
  });
}
