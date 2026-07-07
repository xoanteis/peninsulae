// Regression check for the worker-feedback fix pack: repair->slot handoff,
// slot-full worker_idle events, labeled slot work_pulses, and the HUD 💤 badge.
export async function run(page, { sleep, report }) {
  await sleep(900);
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

  // 8. the fully-loaded res-bar (badges shown) must not slide under the
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
