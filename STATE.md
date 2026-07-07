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
  REPAIR 30hp/s @35% wood
- AI meta: era techs are PER-PLAYER (p.techs — never mutate FACTIONS!) · nearest-rival targeting
  (army x2 deterrence, dominator heat x90) · lateGame gate 900s, hegemon 660s · early sieges +4 ·
  capital siege recalls whole army · turtle/convictionLove live knobs · zombie nations dissolve

## R17 standings (60 games, honest harness)
galicia 56.7 [44-68] · castile 23.3 · catalonia 18.3 · basque 1.7 · portugal 0 [0-6]
Kill graph: castile executes portugal (32x, ~min 11-13); galicia now dies 26x/60 (heat works).

## OPEN PROBLEMS (next balance round — start here)
1. Portugal 0%: castile's hegemon window always finds Lisboa (nearest weak). Tried & failed:
   turtle 0.4, aggression 0.5, capitalHpMul 1.25, +6 siege premium, tribute 1.25. Untried:
   rework its kit toward defense/navy identity; or hegemon target diversity.
2. Galicia 57%: corner fortress-convertor. Tried & failed to tame fully: economy cuts, kit
   slimming (helped 63->57), fatigue 0.25, heat 90. Untried: fatigue on CONVERSION TIME not
   just cost; win condition rework (dominance threshold); map (corner safety).
3. Basque 1.7% in clean world.
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

## UX backlog from player feedback (2026-07-07, diagnosed in code — not yet built)
1. Mining order traps: (a) pick miss (22px) falls through to plain move — worker stands
   beside mine looking identical to a miner; (b) damaged mine: right-click = repair, and
   repair completion idles the worker (units.js:369) instead of entering the slot;
   (c) full slots idle silently (units.js:407); (d) slot work shows NO floater by design
   (overlays.js:91). Fixes: repair→slot flow, tile-click = mine click, full-slots hint,
   "+gold" floater for slot workers.
2. Repair invisible: 🔧 floater only 40%/s, NO sound (audio.js:137 hammers construct only).
   Fix: hammer SFX on repair pulses + per-pulse floater + green HP-bar flash.
3. Idle workers invisible in groups: '.' works but no persistent HUD badge, no per-unit
   marker. Fix: HUD idle badge w/ count (reuse Period-key cycle) + 💤 overhead floater.
4. Decorative rocks (terrain.js:103, 5.5% of grass tiles) read as mineral deposits — false
   affordance; player sited mines by them. Mines only need mountain adjacency. Fix: scatter
   rocks only on mountain-adjacent tiles (signpost) or drop them; optional tile bonus.

## Deployed / published
- Game: https://xoanteis.github.io/peninsulae/ (Pages from main; PR merge = deploy)
- Balance report artifact: https://claude.ai/code/artifact/787124ec-debb-4119-bdcf-305262aa255a
  (source: docs/balance-report.html — edit it and republish with the Artifact tool `url`
  param to the SAME address; update only when a change ships)
- docs/AUDIT.md: full audit ledger (all items fixed as of the audit fix pack PR #18)

## Tool map (details in CLAUDE.md)
- Balance round: node tools/round.mjs --name=x [--patch=exp.json] [--full] [--raw=f.jsonl]
- Probes: tools/probes/ (N=1 env for smoke) · headless recorder test: recorder-headless.mjs
- Browser checks: tools/checks/*.mjs via tools/verify.mjs (all green as of the persistence PR)
- Docs regen: node tools/gendocs.mjs after any bonus change
