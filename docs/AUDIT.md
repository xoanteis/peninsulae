# Full game audit — findings ledger (4 parallel audits + first-hand verification)

## CRITICAL — data integrity
C1. FACTIONS mutation leak: economy.js applyEraTech writes f.bonus.convictionCostMul=0.75 (catalonia)
    and f.bonus.coastalTributeMul=1.5 (portugal) onto the SHARED module object. tournament.mjs runs many
    games/process -> games 2+ start with these pre-applied. VERIFIED first-hand. All tournament data biased
    pro-Portugal/Catalonia. Fix: per-player state (p.techs.*), read in regionConvertCost/regionTribute.
    After fix: one clean --full round to re-baseline.

## HIGH — correctness
H1. Zombie nations (world.js checkVictory): fallen player's units keep fighting/gathering; towers keep firing;
    zombies suppress living conversions (regions.js enemiesInRegion) and block conquests (owners.size).
    Fix: on nation_fell, neutralize/remove fallen pid's units + buildings.
H2. Defection branch (world.js ~546) doesn't reassign villageIds owners nor disband militiaIds -> conqueror
    inherits region with ENEMY tower firing inside it. Fix: route through flipRegion-style cleanup.
H3. S-key double-bound: controls.js:91 orderStop + camera.js:119 pan south. Move stop to X or gate.
H4. AI dead params: (a) turtle tower rule ai.js:206 can never fire (capitals spawn w/ 2 towers, world.js:94);
    (b) convictionLove church rule ai.js:195 collapses to constant 2 for everyone. Personalities unexpressed.
H5. Zombie half-built sites: ai.js:93 demolishes only progress===0; progress>0 abandoned sites block build
    pipeline forever (sites.length>=2 gate at :169). Fix: demolish on no-progress-for-N-sec.

## MEDIUM — mechanics
M1. Fish infinite (no perTile) while forests deplete; NODES maxWorkers + fishNode.workers never enforced
    (unlimited stacking on one node).
M2. Era starvation: expand() spends identity before eras() checks buffer -> galicia/catalonia lag eras.
    Fix: reserve era cost in expand() or reorder think().
M3. defend() churn: retargets foes[0] every tick; no proximity filter -> recalls away-army (task.auto) home.
M4. Golden Age (era 2) unlocks NOTHING; only undocumented +1 dmg (economy.js:104). Content gap + doc overclaim
    (GAME_DESIGN "unlocks buildings/units... signature tech" false for era 2).
M5. work_pulse never emitted for construct/repair (units.js returns early) -> hammer SFX dead (audio.js:136),
    🔨/🔧 floaters dead (overlays.js:83). Construction is SILENT.
M6. militiaJoin doesn't push new ids to region.militiaIds (regions.js ~137) -> joined Irmandades untracked,
    can't be disbanded on later flip -> permanent zombie guards if galicia loses region.
M7. Draw unhandled: both last capitals die same tick -> winner null forever, game runs to cap.
M8. Militia count as conquest holders (regions.js:96) -> lone militia can conquer; zombie units block conquest.
M9. Repair doesn't re-check b.owner (worker heals enemy-flipped building, billing own wood).

## USABILITY (player-facing, priority order from UX audit)
U1. S-key conflict (=H3).
U2. Idle-worker finder missing + workers silently idle after forest depletes (no event). Add '.' cycle + alert.
U3. Training queue: no cancel (no world.cancelTrain), minimal display (⏳ N (X%)). Add chips + refund.
U4. Touch cannot micro: no attack-move/stop/groups/box-select/double-tap on touch. On-screen buttons needed.
U5. Rally points invisible (set controls.js:316, consumed economy.js:29, never drawn).
U6. No pause / game speed. (Space is 'last alert'; remap or add P.)
U7. Minimap: viewport rect hardcoded 18x14 (wrong at all zooms), no flip markers, no click-commands.
U8. Enemy units selectable via tap with misleading order hints (tapSelect no owner filter).
U9. Conversion UX: no pre-commit warning when enemies present (paid identity stalls); conquest progress not
    shown in region panel; empire-fatigue price unexplained.
U10. Defeat screen is modal-only (can't spectate); no end-game stats summary.
U11. Region label contrast: near-white basque/neutral on bright terrain; add plate/stroke.
U12. factionSelect says "Press H for manual" but help is F1 (H=home). Trivial.

## LOW — cleanup
L1. Dead config: extraRegions flag, soldierWeapon, workSlot field, convictionRateMul (no faction), village
    phantom model field; economy.js:70 no-op line.
L2. ~20 unused assets fetched every boot (weapons except arrow, windmill/watermill/well x4 colors, etc.).
L3. order_attack event has no ground ping (move does); train_started/era_started/signature_tech unconsumed.
L4. Sort comparators embed Math.random() (ai.js expand/war) — undefined ordering; armyOf full-scan inside sort.
L5. Rebalance if/else thrash (wood vs food); stale camera.js comment (Q/E vs Q/R).
L6. Cosmetic: E/R villages sit on forest tiles (tree pokes through building), N on hills.

## REFUTED (verified fine)
popCap decrement on destroy ✓ · endgame gates expand/war consistent ✓ · map integrity all 17 regions ✓ ·
asset refs valid ✓ · no NaN/negative-resource paths ✓ · faction query param validated ✓ · docs honest
post-cleanup except Golden Age ✓ · control groups handle dead units ✓
