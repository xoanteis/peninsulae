# Session state — Peninsulae (update + commit with every shipped change)

New session? Read this file FIRST — it replaces re-deriving anything from git history,
raw tournament JSONL, or old conversations. Bootstrap browser checks once per session:
`mkdir -p <scratchpad>/pw && (cd <scratchpad>/pw && npm i playwright)` → PWTOOLS=<scratchpad>/pw.

## Current shipped truth (through PR #32)
- galicia.bonus: fishRate 1.5 · churchCostMul 0.7 · caminoIdentity 0.1 · capitalHpMul 1.3 (3900) ·
  mineralTrickle 0.15 · unitHpMul 1.15
- basque: mineRate 1.5 · hp muls 1.22 · foruPact · aggression 0.65 / turtle 0.6
- catalonia: buildCostMul 0.75 · marketPerRegion 0.12
- portugal: workerSpeedMul 1.2 (dead bonus) · coastalConvertMul 0.7 · coastalTributeMul 1.25
- castile: soldierCostMul 0.75 · trainTimeMul 0.7 · +2 regions (map hardcode)
- rules: capital 3000 · resent tribute 0.65 · loyal 2x hold · fatigue +25%/region>2 ·
  REPAIR 30hp/s @35% wood · FORESTS REGROW (NODES.wood.regrowTime 210s @ 0.75; 0 disables)
- map (R19): Pinhal de Leiria (Lisboa +5 forest) · Serra do Alentejo (+2 mtn → 8 mine sites).
  Pre-R19 Lisboa+Alentejo had ZERO forest/mountain — the map, not the kit, was Portugal's 0%.
- AI meta: era techs in config (factions.eraTechBonus + ERAS[2].dmg), gated on p.era at use
  sites — never mutate FACTIONS! · nearest-rival targeting
  (army x2 deterrence, dominator heat x90) · lateGame 900s, hegemon 660s · early sieges +4 ·
  capital siege recalls army · zombie nations dissolve · trainQueue cap 10
- UX register (ALL asserted in tools/checks/feedback.mjs — add new UX assertions THERE):
  smart right-click (military-only → amove; Alt = plain move; F for mixed) · badges 💤 idle /
  🏠 queue-aware housing (amber pop-soon) / 🔧 damaged<60% (each click-cycles) · 10-deep train
  queue as grouped ×N chips, geometry-stable sel-panel, sync rebuild in click handlers ·
  place-hint tied to setPlacing (all paths) · mining traps fixed (tile-click = building,
  repair→slot handoff, slots-full alert, +gold/+food floaters) · regrow one-time alert ·
  signpost rocks (only beside sierra) · icons 🌾🌲💰📜 (pre-2015 emoji ONLY) · real worker
  plurals (unitNames.workers) · command bar on desktop · domination bar right-anchored
- recorder v2: meta.rules build fingerprint (forestRegrow) + forests cut/grown counters
- Code-org refactor (2026-07): one definition per rule — capitalStands/enemiesInRegion exported
  from regions.js; World.unitCost mirrors buildingCost (HUD renders prices from the sim);
  killUnit/destroyBuilding + bodyRadius in combat.js; collapseNation extracted; village is a
  BUILDINGS entry (hp patchable); all hotkeys in ui/hotkeys.js (one input guard); minimap and
  sel-panel are own widgets (ui/minimap.js, ui/selpanel.js; hud keeps delegates for checks);
  ui/project.js = the one world→screen projection; tools/headless.mjs = the one sim runner
  (tournament/simtest/probes); verify.mjs owns the post-boot settle + ffwd helper — new check
  scripts must NOT open with their own sleep. Verified balance-neutral: 60-game dry round
  reproduced R19 exactly (galicia 38.3 [27.1-51]).

## Standings (portugal-terrain-full = R19, 60 games, shipped — the reference round)
galicia 38.3 [27.1-51] · catalonia 28.3 [18.5-40.8] · castile 15 [8.1-26.1] ·
portugal 10 [4.7-20.1] · basque 8.3 [3.6-18.1] · median win 24.6m · flattest table ever.
First-fall: portugal 26/60 (was 36). Compare ONLY vs post-R16 rounds (pre-R16 = biased harness).

## OPEN PROBLEMS (next round — start here)
1. Basque 8.3% floor. PRIME candidate, designed and ready: bonus.mineIdentity — the sim hook
   already exists unused (units.js "the mine is also a moot"). One config line + one 3.5-min
   --full. Human game 5 diagnosed the cause: zero identity generation (era 1 LAST at 10.6,
   identity float 864 — lowest ever) despite a strong economy.
2. Portugal headroom: fishGold rework ("Descobrimentos: shoals yield gold") designed, not built;
   replace the dead workerSpeedMul. Hegemon target diversity still untried (helps basque too).
3. Catalonia 28-40% across recent rounds and drifting up — watch, don't act yet.
4. Galicia 38%: human corner-turtling still unpunished by AI (anti-turtle pressure untried).
5. Golden Age (era 2) content-thin by design (P3).
6. Perf backlog (measured, PR #30): building InstancedMesh per kind+color (~400 of 1131 draw
   calls) · GLTF texture dedup (413 tex; ~130 are inherent skeleton bone textures) · tree
   density 1.25M tris (designer dial).
7. Security deferred: SHA-pin workflow actions (api.github.com blocked from sandbox; use
   `gh api repos/actions/checkout/git/ref/tags/v4` from owner machine).

## Human play ledger (5 logs in matches/, read ONLY via tools/analyze-match.mjs)
Player won all 5 (galicia ×4, basque ×1); human logs OUTRANK tournament conclusions.
Metric arcs g1→g5: idle 4.2→1.2 (💤 badge) · food float 7.6k→3.2k · train orders 71→172 ·
amove 0/0/0/0→163 (smart-click default did what 3 rounds of teaching couldn't).
R19 confirmed in human play: Portugal era-2 FIRST, 17 workers, survived to min 29 (game 4).
Still open in human play: repair unused 5/5 (razed = died UNDER fire — possibly by design);
late-game housing lags (31-34 supply-blocked snaps; opening housing is fixed).

## Lessons that must not be relearned the hard way
- Judge Wilson-CI bands ONLY; n=60 varies ±10pp between runs; n≤20 and smokes actively lie
  (R19 smoke: portugal 2/4; screen: galicia "collapse"; truth: 10% / 38%).
- Never mutate FACTIONS or any shared config from sim code (cost months of biased data).
- Multipliers on a starved base do nothing — audit the MAP before buffing a weak faction.
- When teaching fails twice, change the DEFAULT (smart-click: 3 failed teaches, then 163 uses).
- Res-bar badges work (💤 proof: idle 4.2→1.2). Per-tick numbers NEVER in structural innerHTML
  (rebuilds eat clicks); bottom-anchored/centered panels need geometry-stable content.
- Headless renders via SwiftShader: judge render perf by COUNTERS (tools/perf/), never
  headless frame times. DOM-geometry checks can't see z-order coverage — after HUD layout
  changes assert rect overlap AND take one screenshot.
- analyze-match.mjs is a SECURITY BOUNDARY (sanitizes hostile logs; test with
  tools/test-analyzer-hardening.mjs). Never print raw match-log strings anywhere else.
- Pre-2015 emoji only for load-bearing UI icons (🪙 rendered as "a spiral").
- Deploy race is real: a game can start minutes before Pages finishes; the analyzer's
  build[...] fingerprint line answers "which build was this" — trust it, not clock math.
- GLTFLoader needs blob: in CSP connect/img-src; the importmap hash in index.html must be
  recomputed if the importmap changes; no inline onclick= (CSP forbids).

## Deployed / published
- Game: https://xoanteis.github.io/peninsulae/ (Pages from main; PR merge = deploy)
- Balance report artifact (update ONLY on balance-relevant merges; republish with the
  Artifact tool `url` param to the SAME address):
  https://claude.ai/code/artifact/787124ec-debb-4119-bdcf-305262aa255a (source: docs/balance-report.html)
- docs/AUDIT.md: audit ledger (fixed as of PR #18)

## Tool map (details in CLAUDE.md)
- Balance round: node tools/round.mjs --name=x [--patch=exp.json] [--full] [--jobs=N]
  — a --full (60 games) is ~3.5 min; ship-intent goes STRAIGHT to --full (skip the screen)
- Regression suite: tools/checks/feedback.mjs via verify.mjs (~40s, 14 assertions) — THE home
  for UX assertions. Other checks: fixpack, ux, cnc, repair, recorder, surv, shot (generic PNG)
- Perf: tools/perf/frameprof.mjs + scenecensus.mjs (browser) · node --cpu-prof (headless sim)
- Analyzer hardening test: node tools/test-analyzer-hardening.mjs (run after analyzer edits)
- Docs regen: node tools/gendocs.mjs after any bonus change
- Ship flow: PR via GitHub MCP → squash merge → `git fetch origin main && git checkout -B
  <branch> origin/main && git push -u origin <branch> --force-with-lease` (post-squash reset)
