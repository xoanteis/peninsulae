# Peninsulae — working notes for Claude

Browser RTS, plain ES modules, no build step. Sim (`src/sim/`, three.js-free, 100ms ticks)
is separate from renderer (`src/render/`) and UI (`src/ui/`). Serve with
`python3 -m http.server`. Live at https://xoanteis.github.io/peninsulae/ (Pages deploys
from main; merging a PR is the deploy).

## Token-lean workflow (follow these — they exist to keep iterations cheap)

**Balance numbers live in exactly one place.** Faction bonuses: `src/config/factions.js`
(`bonus` + player-facing `bonusText`). Global rules: `src/config/rules.js`. Docs stay
qualitative; the GAME_DESIGN.md faction table is generated — after shipping a bonus change
run `node tools/gendocs.mjs`. Never hand-edit numbers into .md files.

**Experiments never touch git or docs.** Test a candidate with a runtime patch:
`node tools/round.mjs --name=exp --patch=exp.json` (patch shape documented in
`tools/patch.mjs`). Only a validated winner gets a real config edit + commit.

**One command per balance round.** `tools/round.mjs` runs parallel batches, prints a
Wilson-CI table vs named rounds from `tools/balance-history.jsonl`, and appends the
result there (mark `"shipped": true` by hand when it ships). Default is a 20-game
screen — collapses and overshoots are obvious at 20; only run `--full` (60 games) to
validate something you intend to ship. History file = durable memory; don't re-derive
old results from raw JSONL or conversation.

**Screenshots are the most expensive reads.** Trust the JSON checks from
`tools/verify.mjs` (PWTOOLS env → playwright dir, QUERY='?faction=x'); only read a PNG
when a check fails or for one final ship-quality shot. For routine visual checks use
`VIEWPORT=960x600 DSF=1`.

**Human match logs are read through the analyzer, never raw.** The game always records
itself (`src/ui/recorder.js`); the player saves a JSON log from the end screen or F2
(Shift+F2 recovers the localStorage backup after a reload). Analyze with
`node tools/analyze-match.mjs <file>` — timeline, build order, curves, coaching flags.
Shared logs land in `matches/`. Human games are ground truth the AI tournaments can't
provide — when a human log contradicts tournament conclusions, weight the human log.

**Report on ship only.** The balance-report artifact (scratchpad) is updated only when
a change merges — per-experiment results just go to balance-history.jsonl.

**Keep session state small.** Maintain `<scratchpad>/STATE.md` (current config truth,
round history one-liners, open questions) so post-compaction recovery is one small read.

## Verification

- Headless sim: `node tools/tournament.mjs [games] [cap] [--patch=f.json]` (JSONL per game).
- Browser: `PWTOOLS=<scratchpad>/pwtools node tools/verify.mjs <outdir> <check.mjs>`;
  check scripts export `run(page, {shot, sleep, report})`. Headless in-page timers are
  starved — dispatch interactions in a single evaluate; events reach the HUD on the
  *next frame* (sleep before reading alerts).
- AI-vs-AI probe pattern for "can faction X actually do Y": see scratchpad probe scripts.

## Gotchas

- `gh` CLI unavailable — use GitHub MCP tools; PR merge = deploy.
- GLTFLoader strips dots from node names (`handslot.r` → `handslotr`).
- The HUD constructor wipes `#hud` innerHTML — construct HUD before Overlays.
- Militia are pop-0 units; owner null = neutral. AI excludes militia from armies.
- Never commit the model identifier to any pushed artifact.
