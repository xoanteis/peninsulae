# Session state — Peninsulae (update + commit with every shipped change)

New session? Read this file first — it replaces re-deriving anything from git history,
raw tournament JSONL, or old conversations.

## Current shipped truth (R17-clean-retune + match recorder)
- galicia.bonus: fishRate 1.5 · churchCostMul 0.7 · caminoIdentity 0.1 · capitalHpMul 1.3 (3900) ·
  mineralTrickle 0.15 · unitHpMul 1.15  (REMOVED in R17: militiaJoin, towerCostMul, mineRate)
- basque: mineRate 1.5 · hp muls 1.22 · foruPact · aggression 0.65 / turtle 0.6
- catalonia: buildCostMul 0.75 · marketPerRegion 0.12
- portugal: workerSpeedMul 1.2 · coastalConvertMul 0.7 · coastalTributeMul 1.25 ·
  aiStyle aggression 0.5 / turtle 0.4
- castile: soldierCostMul 0.75 · trainTimeMul 0.7 · +2 regions (map hardcode, no flag)
- rules: capital 3000 · resent tribute 0.65 · loyal 2x hold · empire fatigue +25%/region>2 ·
  REPAIR 30hp/s @35% wood · FORESTS REGROW (NODES.wood.regrowTime 210s @ regrowTo 0.75;
  0 disables — player-requested design, validated at 60 games)
- AI meta: era techs are PER-PLAYER (p.techs — never mutate FACTIONS!) · nearest-rival targeting
  (army x2 deterrence, dominator heat x90) · lateGame gate 900s, hegemon 660s · early sieges +4 ·
  capital siege recalls whole army · turtle/convictionLove live knobs · zombie nations dissolve

## portugal-terrain-full standings (60 games, SHIPPED — the new reference round)
galicia 38.3 [27.1-51] · catalonia 28.3 [18.5-40.8] · castile 15 · portugal 10 [4.7-20.1] ·
basque 8.3 — FLATTEST TABLE EVER. Map fix (R19): Pinhal de Leiria (5 forest, Lisboa) +
Serra do Alentejo (2 mtn → 8 mine sites). Portugal 3.3→10% (6 real wins, first-fall
36→26/60) AND galicia 63→38 organically — a solvent southern neighbor unsafes the corner
(galicia's first 4 first-falls of the clean era). Lesson: the MAP was Portugal's kit all
along; multipliers on a starved base do nothing (5 failed buffs proved it). Watch:
catalonia 28.3 rising, basque 8.3 floor. n=4 smoke said portugal 2/4 — variance; trust
only CI bands (relearned AGAIN).

## forest-regrow-full standings (60 games — superseded by portugal-terrain-full)
galicia 63.3 [50.7-74.4] · castile 13.3 [6.9-24.2] · catalonia 11.7 · basque 8.3 ·
portugal 3.3 [0.9-11.4] — portugal's FIRST wins in the clean harness (2). All bands
overlap R17: mechanic passed. Directional watch: castile softened (regrow blunts
attrition aggression), galicia drifted up. Median win 24.6m. First-fall: portugal 36/60.

## R17 standings (60 games, honest harness — superseded by forest-regrow-full)
galicia 56.7 [44-68] · castile 23.3 · catalonia 18.3 · basque 1.7 · portugal 0 [0-6]
Kill graph: castile executes portugal (32x, ~min 11-13); galicia now dies 26x/60 (heat works).

## OPEN PROBLEMS (next balance round — start here)
1. LARGELY SOLVED by R19 map fix: Portugal 10% [4.7-20.1] with real wins (was 0). Remaining
   headroom: fishGold kit rework ("Descobrimentos: shoals yield gold for Portugal") — designed,
   not yet built; hegemon target diversity still untried. workerSpeedMul is still a dead bonus.
2. IMPROVED organically by R19: Galicia 38.3 [27.1-51] (was 57-63). The corner unsafed itself
   once Portugal could fight. Anti-turtle AI pressure (human-play issue) still untried.
3. Basque 8.3% floor (unchanged through R18/R19). Catalonia 28.3 and rising — watch.
4. Golden Age (era 2) is content-thin by design (P3 backlog): only +1 dmg.
NOTE: pre-R16 rows in tools/balance-history.jsonl were measured on a biased harness
(FACTIONS mutation leak) — compare only against post-R16 rounds.

## Lessons that must not be relearned the hard way
- AI tournaments measure bonuses THROUGH AI temperaments, not human play. Human match logs
  (matches/, tools/analyze-match.mjs) outrank tournament conclusions when they disagree.
  Example: cheap towers made the AI over-fortify and skip its army — a human wouldn't.
- Between-run variance is ±10pp at n=60: judge Wilson-CI bands, never orderings. n=20 screens
  only detect collapses/overshoots.
- Expansion accelerants on a survival-constrained faction backfire (coastal bonus made
  Galicia die FIRST 53/60). Diagnose with a probe snapshot (min-12 army/econ/regions) first.
- Never mutate the FACTIONS module object (or any shared config) from sim code — it leaks
  across games in one process and silently biases every harness (cost us months of data).

## Human match log #4 (matches/2026-07-08-galicia-win-38min-game4.json) — R19 world, human-confirmed
First game on the full R18+R19 build (fingerprint ✓). Regrow REAL: 101 cut / 92 regrown.
PORTUGAL TRANSFORMED in human play: era 1 FIRST (4.4), era 2 FIRST (6.9), 17 workers by
min 15 (was 2-4 in games 1-3), survived to 29.4 — the map fix reads exactly like the
tournaments said. Win took 37.8 min (was 32) — stronger rivals = slower human win;
catalonia peaked at 10 regions. Player metrics across 4 games: idle 4.2→3.6→3.0→1.2
(flag GONE — badge works) · food float 7.6k→5.7k→4.1k→3.2k · wood 5.1k→2.2k→5.3k→2.5k ·
10-unit queue bursts everywhere (172 train orders). The 3 stubborn items were ADDRESSED
by design changes (all asserted in checks/feedback.mjs): (a) attack-move is now the
DEFAULT for military-only ground right-clicks (Alt = plain move; F stays for mixed) —
teaching failed 3 times, so the default changed instead; (b) 🔧N badge for buildings
<60% HP, click cycles them (the badge pattern with the proven track record); (c) 🏠
badge is queue-aware: fires amber (pop-soon) when pop+queued > cap, before the block.
Game 5 verdict: watch for amove orders in the log and whether supply-block snaps drop.

## Human match log #3 (matches/2026-07-07-galicia-win-32min-game3.json) — the deploy race
Player reported "no regrow" — CORRECT: game started 21:40 UTC, R18 Pages deploy finished
21:42 UTC. Played the #26 build (proof in-log: 10-soldier queue burst at 10.6). Fixed the
telemetry so this never needs archaeology again: meta.rules fingerprint (forestRegrow) +
forests cut/grown counters in the recorder, printed by the analyzer; old logs degrade to
"build[unknown]". Plus a one-time in-game alert on first regrowth (mechanic legibility).
Game 3 numbers (all pre-regrow, WITH pop badge + queue-10): workers 17.4 avg (plateau
BROKEN, was ~15) · supply-blocked 14 snaps (was 31 — badge works) · 0 worker losses ·
idle 3.0 · 8 houses in opening. Still open: attack-move UNUSED (3 games — bar+tip shipped
in #26 didn't land either); era 1 late again (8.8); wood float back up 5.3k (~25 towers);
repair never used while 4 buildings razed (new flag).

## Human match log #2 (matches/2026-07-07-galicia-win-32min.json) — coaching + UX fixes WORK
Same player, same faction, played AFTER the coaching + UX fix packs. Win in 32.2 min
(was 41.4). Before → after: era 1 last @7.6 → FIRST @4.9 · army@10 6-vs-16 → 10-vs-14
(both rush flags gone) · wood float 5123 → 2159 · gold 1890 → 879 · food 7618 → 5727 ·
idle 4.2 → 3.6 · train orders 71 → 117 (5-at-a-time queue spam visible in the log —
the #25 fix in action) · player took 2 of 4 kills (was 0, AIs did all killing).
STILL OPEN after 2 games: (a) attack-move NEVER used in either game — discoverability
fix needed (desktop hint or button, not just F+click in help); (b) supply-blocked in
31 snapshots (worse than 27) — pop-cap needs an in-game nudge (badge-style, like idle);
(c) worker count plateaus ~15 both games; (d) identity floats ~2000 both games.
Design cross-checks: portugal collapsed again (2 workers by min 10 — fragility is
systemic, not matchup luck); ALL nation deaths in both games came via defection/shatter
cascades (zombie-dissolve is THE kill mechanic); galicia human 2/2 wins.

## Human match log #1 (matches/2026-07-07-galicia-win-41min.json) — first ground truth
Player as galicia WON in 41.4 min via corner turtle → late defection cascade. Key facts:
- Confirms open problem #2 IN HUMAN PLAY: 17 towers by min 11, army 3 vs rival 16 at min 10,
  floated 7.6k food / 5.1k wood / 1.9k identity, 4.2 idle workers, supply-blocked in 27
  snapshots — and was NEVER punished. Corner + towers = zero AI pressure for 20+ min.
  The "a human wouldn't over-fortify" lesson is WRONG — the human did, and it won anyway.
- Kill graph matches R17: castile executed portugal (min 22 vs AI 11-13 — human presence
  slows it), catalonia killed basque (26) and castile (32). Orderings hold with a human in.
- UX gaps surfaced: attack-move (F+click) never discovered; no in-game idle-worker or
  supply-block indicator (flags only appear post-game in the analyzer).
- Candidate directions it supports: AI punishes weak-army neighbors early (anti-turtle);
  in-game nudges for idle workers / pop-cap / resource float; attack-move discoverability.

## UX fix pack from player feedback (2026-07-07) — SHIPPED, regression check tools/checks/feedback.mjs
1. Mining order traps — FIXED: repair completion now flows into a free work slot;
   a click anywhere on a building's tile counts as the building (pick-miss no longer
   becomes a blind move); full slots push worker_idle reason 'slots_full' → specific
   HUD alert; slot workers float "+gold"/"+food" (work_pulse now carries building kind).
2. Repair visibility — FIXED: hammer SFX on repair pulses, 🔧 floater every pulse.
3. Idle workers — FIXED: 💤 badge in the res-bar (click = cycle, same code as '.') +
   pulsing 💤 marker over each idle worker (overlays pool of 24).
4. Rocks — FIXED: scattered only on mountain-adjacent land now (mine-site signpost,
   ~55% of such tiles); mine desc + min-42s tip updated. Purely cosmetic, no tile bonus.
5. Resource icons player-tested: 🪵 read as a second coin → now 🌲; 🪙 rendered as
   "a spiral" on the player's system (2019 emoji, patchy font support) → now 💰
   (2010 codepoint, safe everywhere). All via RES_ICONS; res chips have title
   tooltips; selected slot buildings state their yield ("👷 n/2 working — yields
   💰 gold"). LESSON: only use pre-2015 emoji for load-bearing UI icons.
6. Place-hint banner lingered: updatePlaceHint only ran from the menu button, but
   placement also ends via Esc / click-to-place / touch — all funnel through
   controls.setPlacing, which now notifies the HUD (onPlacingChange). Text slimmed
   (drafting clause only when it applies), quieter styling. Worker plurals are real
   words now (unitNames.workers: Labregos/Baserritarrak/Pagesos/Camponeses/Labriegos
   — "Pagèss" was shipping). Banner lifecycle asserted in checks/feedback.mjs.
7a. Follow-ups from match log #2 (all verified in checks/feedback.mjs): queue cap
   5→10 (world.trainUnit; chips group by kind "×N" so a full queue fits the fixed
   row); 🏠! pop-cap badge in res-bar when pop==cap (click = place house); ⚔ command
   bar now on desktop too (attack-move was keyboard/help-only — unused in 2 games) +
   a 150s tip. FOUND VIA PIXELS: the longer res-bar slid UNDER the centered
   domination bar on ≤1440px viewports — DOM assertions passed while pixels were
   covered. Domination bar is right-anchored now; overlap asserted geometrically
   (check #8). LESSON: after HUD layout changes, verify overlap with rects AND one
   screenshot — DOM-only checks can't see z-order coverage.
7b. Train button slid out from under a spam-clicking cursor (player couldn't queue
   5 without re-aiming). THREE causes on the bottom-anchored, centered panel:
   (a) queue row only existed when non-empty → height jump on first click — row now
   always rendered, min-height 25px, free slots shown as dots; (b) the live train %
   in the html made dataset.html differ every tick → full innerHTML rebuild 4x/s ate
   mid-press clicks — volatile numbers (train %, era countdown) now live in spans
   (.sp-pct/.sp-timer) patched in place, and handlers rebuild synchronously in the
   click (refreshSelPanel); (c) 5 chips widened the panel past min-width → centered
   panel re-centers, sliding ~3px — queue row is width:0/min-width:100% so it never
   drives panel width (+ min-width 320). trainSpam asserted in checks/feedback.mjs
   (5 clicks, buttonStable, live pct). LESSON: bottom-anchored centered panels must
   have geometry-stable content; never put per-tick numbers in structural innerHTML.

## Deployed / published
- Game: https://xoanteis.github.io/peninsulae/ (Pages from main; PR merge = deploy)
- Balance report artifact: https://claude.ai/code/artifact/787124ec-debb-4119-bdcf-305262aa255a
  (source: docs/balance-report.html — edit it and republish with the Artifact tool `url`
  param to the SAME address; update only when a change ships)
- docs/AUDIT.md: full audit ledger (all items fixed as of the audit fix pack PR #18)

## Render perf (profiled 2026-07-08; scenecensus/frameprof scripts rebuildable from PR #30)
- FIXED: per-unit material clones (hit-flash rationale) gave 840 unique materials
  (795 entity meshes → 791 mats). Now shared + 3-step cached flash pool → 56 unique
  (entities: 7). Benefits real GPUs (state reuse in color+shadow passes); invisible in
  headless SwiftShader, where raster dominates — judge browser perf by COUNTERS
  (drawCalls/materials/census), not headless frame times.
- Future levers, measured & flagged: 1,131 draw calls (InstancedMesh per building
  kind+color would collapse ~400); 413 GPU textures (≈130 = skeleton bone textures,
  inherent; rest = per-GLTF-file texture instances — loader dedup possible); 1.25M tris
  (KayKit tree density — designer trade-off). Terrain already exemplary (15 instanced).

## Tool map (details in CLAUDE.md)
- Balance round: node tools/round.mjs --name=x [--patch=exp.json] [--full] [--raw=f.jsonl]
  [--jobs=N] — a --full is ~3.5 min now (unitsNear int-key spatial hash 2x + all-core
  workers 2x; verified behavior-identical vs R19 bands). Ship-intent → straight to --full.
- Probes: tools/probes/ (N=1 env for smoke) · headless recorder test: recorder-headless.mjs
- Browser checks: tools/checks/*.mjs via tools/verify.mjs (all green as of the persistence PR)
- Docs regen: node tools/gendocs.mjs after any bonus change
