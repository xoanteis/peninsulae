// Boot as Galicia: config sanity (fortress capital HP, faction table in help),
// then a minute of sim to be sure nothing throws with the current config.
export async function run(page, { shot, sleep, report }) {
  report.checks.surv = await page.evaluate(() => {
    const g = window.__game, w = g.world;
    const cap = w.entities.get(w.players.galicia.capitalId);
    g.hud.toggleHelp();
    const helpText = (document.getElementById('help-overlay')?.textContent ?? '').toLowerCase();
    g.hud.toggleHelp();
    return {
      capitalHp: cap.maxHp,
      bonusMentionsFortress: helpText.includes('fortress-cathedral'),
      bonusMentionsCoast: helpText.includes('coastal regions convert'),
    };
  });
  // let a minute of sim run to be sure nothing throws with the current config
  for (let b = 0; b < 8; b++) {
    await page.evaluate(() => { const w = window.__game.world; for (let i = 0; i < 200; i++) if (!w.winner) w.step(); });
    await sleep(80);
  }
  report.checks.after = await page.evaluate(() => ({
    errors: window.__game.errors,
    time: Math.round(window.__game.world.time),
    // cost labels are filled by the HUD's frame update, so read them late
    towerCostLabel: document.querySelector('.bm-item[data-kind="tower"] .bm-cost')?.textContent ?? null,
  }));
  await shot('surv-boot');
}
