// Shared headless-game runner for the node tools. One place owns the World
// boot, the minutes→ticks conversion from TICK_MS, and the step loop with the
// mandatory per-tick event drain (a script that forgets the drain grows
// world.events without bound).
//
//   runGame({ minutes, human, humanPlays, onStart, onEvent, onTick }) -> { world, ticks }
//
// onStart(world) runs once before the first tick (boot events still queued);
// onEvent(ev, tick) sees every sim event; onTick(world, tick) runs after each
// tick's drain. The loop stops on world.winner or after `minutes` of sim time;
// `ticks` is the tick index the loop stopped on.

import { World } from '../src/sim/world.js';
import { AIController } from '../src/sim/ai.js';
import { TICK_MS } from '../src/config/rules.js';

export const minutesToTicks = minutes => minutes * 60000 / TICK_MS;
export const ticksToMinutes = ticks => ticks * TICK_MS / 60000;

export function runGame({ minutes = 60, human = 'galicia', humanPlays = true, onStart, onEvent, onTick } = {}) {
  const world = new World(human);
  if (humanPlays) world.ai.push(new AIController(world, human)); // nobody idles
  onStart?.(world);
  const maxTicks = minutesToTicks(minutes);
  let t = 0;
  for (; t < maxTicks; t++) {
    world.step();
    if (onEvent) for (const ev of world.events) onEvent(ev, t);
    world.events.length = 0;
    onTick?.(world, t);
    if (world.winner) break;
  }
  return { world, ticks: t };
}
