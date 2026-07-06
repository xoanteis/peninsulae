# PENINSULAE — Five Nations, One Iberia

A browser real-time strategy game about the struggle for self-rule in the Iberian
peninsula. **Galicians, Basques, Catalans, Portuguese and Castilians** race to fly
their banner over every region of Iberia — with armies, but above all with
**identity**: language, trade, faith and the sea. Armies take land; culture keeps it.

Built with three.js (plain ES modules, no build step) on real, human-made
CC0/CC-BY assets: fully rigged & animated KayKit characters, Kenney sound
effects, and a Kevin MacLeod underscore. See `GAME_DESIGN.md` for how the
history became the mechanics, and `assets/ATTRIBUTION.md` for credits.

## Play it

**Live:** https://xoanteis.github.io/peninsulae/ — works on desktop (trackpad/mouse)
and phones (drag pan · pinch zoom · tap select · long-press order).

## Run it locally

Any static file server works. From the repo root:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Pick your nation, press **H** in game for the full manual.

## How you win

Fly your banner over **all 17 regions** — total domination. Two roads to a region:

- **🕊 Conviction** — click a region, spend **📜 Identity** to convert it. Slow,
  suppressed by enemy garrisons, but converted regions stay loyal.
- **⚔️ Conquest** — kill the village militia and tower, hold the village with
  soldiers. Fast, but conquered regions pay reduced tribute and flip back cheaply.

Raze a rival's **capital castle** and their nation falls: conquered borderlands
defect to the conqueror, but regions won by conviction rise free again — faith
does not transfer at swordpoint. Lose your own capital and your war of
independence is over.

Castile begins with three regions and a cheap, fast war machine — the peripheral
nations must out-grow, out-believe or out-fight the hegemon.

## Controls

PC scheme in the Command & Conquer tradition, plus trackpad and touch:

| Input | Action |
|---|---|
| click / double-click / drag | select · select all of type · box-select (Shift adds) |
| right-click | contextual order: move · attack · gather · build · rally |
| right-drag / screen edges / WASD | pan camera |
| mouse wheel / trackpad pinch | zoom |
| Ctrl+1–9 / 1–9 | assign / recall control group (double-tap centers) |
| F + click | attack-move (engage everything on the way) |
| S · E · H · Space | stop · all soldiers on screen · home · last alert |
| Q/R · +/− · F1 · M · Esc | rotate · zoom · help · mute · cancel |
| trackpad | two-finger scroll pans · pinch zooms · two-finger tap orders |
| touch | drag pans · pinch zooms · tap selects · long-press orders |

## Engineering

- `src/sim/` — the whole game state, three.js-free, fixed 100 ms ticks:
  hex-grid A* (with partial paths and siege fallbacks), task state machines,
  economy, combat, region allegiance, eras, and five AI personalities.
- `src/render/` — reads sim state, never writes: instanced KayKit terrain,
  SkeletonUtils-cloned characters driven by AnimationMixers, palette-shifted
  faction building sets, effects.
- `src/ui/`, `src/audio/` — DOM HUD + WebAudio soundscape, driven by sim events.
- `tools/simtest.mjs` — run headless AI-vs-AI games at ~25× realtime.
- `tools/verify.mjs` — Playwright harness that boots the game in Chromium,
  captures errors and screenshots, and drives milestone checks.

```sh
node tools/simtest.mjs 30            # watch a 30-minute AI race in your terminal
PWTOOLS=... node tools/verify.mjs out ./check.mjs   # live browser verification
```
