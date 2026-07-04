#!/usr/bin/env node
// Live browser verification harness for Peninsulae.
// Serves the repo, drives headless Chromium via Playwright, captures console
// errors / failed requests / sim state, and saves screenshots.
//
//   PWTOOLS=<dir with node_modules/playwright> node tools/verify.mjs [outdir] [script.mjs]
//
// The optional script exports `run(page, helpers)` for milestone-specific checks.

import { createRequire } from 'module';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] || 'verify-out');
const scriptPath = process.argv[3] ? resolve(process.argv[3]) : null;
mkdirSync(outDir, { recursive: true });

const pwDir = process.env.PWTOOLS || repo;
const require = createRequire(pwDir + '/');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 8734;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: repo, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

const report = { consoleErrors: [], pageErrors: [], failedRequests: [], gameErrors: [], screenshots: [], checks: {} };
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.consoleErrors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => report.pageErrors.push(String(e)));
  page.on('requestfailed', r => report.failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) report.failedRequests.push(`${r.url()} :: HTTP ${r.status()}`); });

  await page.goto(`http://127.0.0.1:${PORT}/${process.env.QUERY ?? ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.ready || window.__game?.errors?.length > 0, null, { timeout: 45000 })
    .catch(() => { report.checks.readyTimeout = true; });

  report.gameErrors = await page.evaluate(() => window.__game?.errors || []);
  report.checks.ready = await page.evaluate(() => !!window.__game?.ready);

  const shot = async name => {
    const p = `${outDir}/${name}.png`;
    await page.screenshot({ path: p });
    report.screenshots.push(p);
  };

  const helpers = { shot, report, sleep: ms => new Promise(r => setTimeout(r, ms)) };

  if (report.checks.ready) {
    await page.waitForTimeout(1200); // let loading fade + first frames settle
    if (scriptPath) {
      const mod = await import(scriptPath);
      await mod.run(page, helpers);
    } else {
      await shot('default');
    }
    report.stats = await page.evaluate(() => ({ fps: window.__game.fps, drawCalls: window.__game.drawCalls, triangles: window.__game.triangles }));
  } else {
    await shot('failed-state');
  }
} catch (e) {
  report.fatal = String(e?.stack || e);
} finally {
  await browser?.close();
  server.kill();
}

writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
const bad = report.pageErrors.length || report.gameErrors.length || report.failedRequests.length || !report.checks.ready || report.fatal;
console.log(JSON.stringify(report, null, 2));
process.exit(bad ? 1 : 0);
