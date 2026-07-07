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

## Tool map (details in CLAUDE.md)
- Balance round: node tools/round.mjs --name=x [--patch=exp.json] [--full] [--raw=f.jsonl]
- Probes: tools/probes/ (N=1 env for smoke) · headless recorder test: recorder-headless.mjs
- Browser checks: tools/checks/*.mjs via tools/verify.mjs (all green as of the persistence PR)
- Docs regen: node tools/gendocs.mjs after any bonus change
