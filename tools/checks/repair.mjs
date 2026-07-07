export async function run(page, { sleep, report }) {
  await sleep(900);
  report.checks.repair = await page.evaluate(() => {
    const g = window.__game, w = g.world, pid = g.controls.humanId;
    const p = w.players[pid];
    // find a tower and a worker; damage the tower
    const tower = [...w.entities.values()].find(e => e.type === 'building' && e.owner === pid && e.kind === 'tower');
    const worker = [...w.entities.values()].find(e => e.type === 'unit' && e.kind === 'worker' && e.owner === pid);
    tower.hp = Math.round(tower.maxHp * 0.3);
    p.res.wood = 200;
    const hp0 = tower.hp, wood0 = p.res.wood;
    w.orderRepair(pid, [worker.id], tower.id);
    for (let i = 0; i < 300; i++) w.step(); // 30s
    const afterHp = tower.hp, afterWood = Math.round(p.res.wood * 10) / 10;
    // soldier cannot repair
    const soldier = [...w.entities.values()].find(e => e.type === 'unit' && e.kind !== 'worker' && e.kind !== 'militia' && e.owner === pid);
    let soldierBlocked = true;
    if (soldier) { w.orderRepair(pid, [soldier.id], tower.id); soldierBlocked = soldier.task?.type !== 'repair'; }
    // wood-out: damage again, drain wood
    tower.hp = Math.round(tower.maxHp * 0.5);
    p.res.wood = 0.05;
    w.orderRepair(pid, [worker.id], tower.id);
    for (let i = 0; i < 100; i++) w.step();
    const stopped = worker.task === null || worker.task?.type !== 'repair';
    return {
      hpBefore: hp0, hpAfter: Math.round(afterHp), maxHp: tower.maxHp,
      woodSpent: Math.round((wood0 - afterWood) * 10) / 10,
      workerTaskDuring: 'repair(ran)', soldierBlocked, stoppedWhenBroke: stopped,
      errors: window.__game.errors,
    };
  });
}
