// Headless recorder test: AI plays all five nations, the recorder taps the
// event stream exactly like main.js does, then the log shape is validated.
// Chain it into the analyzer to test the whole pipeline:
//   node tools/probes/recorder-headless.mjs /tmp/m.json && node tools/analyze-match.mjs /tmp/m.json
import { writeFileSync } from 'node:fs';
import { World } from '../../src/sim/world.js';
import { AIController } from '../../src/sim/ai.js';
import { MatchRecorder } from '../../src/ui/recorder.js';
import { TICK_MS } from '../../src/config/rules.js';

const out = process.argv[2] || '/tmp/peninsulae-match-test.json';
const world = new World('galicia');
world.ai.push(new AIController(world, 'galicia'));
const rec = new MatchRecorder(world, 'galicia');

// simulate a few human orders through the funnel
rec.recordOrder({ type: 'move' });
rec.recordOrder({ type: 'place', kind: 'house' });
rec.recordOrder({ type: 'amove' });
rec.recordOrder({ type: 'ui' }); // must be skipped

const maxTicks = 45 * 60000 / TICK_MS;
for (let t = 0; t < maxTicks; t++) {
  world.step();
  for (const ev of world.events) rec.handleEvent(ev);
  world.events.length = 0;
  rec.update();
  if (world.winner) break;
}

const json = rec.serialize();
const log = JSON.parse(json);
console.log(JSON.stringify({
  bytes: json.length,
  snaps: log.snaps.length,
  events: log.events.length,
  orders: log.orders.length,
  result: log.result,
  snapRowLen: log.snaps[0][1][0].length === log.meta.snapCols.length,
  orderSkippedUi: !log.orders.some(o => o[1] === 'ui'),
  hasFlip: log.events.some(e => e[1] === 'flip'),
  hasTrainOrders: log.orders.some(o => o[1] === 'train'),
  lossesTracked: log.snaps.at(-1)[1].some(r => r[11] > 0),
}, null, 1));
writeFileSync(out, json);
console.log('wrote', out);
