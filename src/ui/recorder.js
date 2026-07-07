// Match recorder: builds a compact, analyzable log of one game — periodic
// economy snapshots for every nation plus the strategic event timeline and
// the human player's order stream. The end screen (and F2) saves it as JSON;
// `node tools/analyze-match.mjs <file>` turns it into a coaching report.
// DOM/localStorage are only touched in save paths, so node can import this
// for headless tests.

import { NODES } from '../config/rules.js';

const SNAP_EVERY = 20; // seconds of sim time between snapshots
const BACKUP_EVERY_SNAPS = 3; // localStorage backup cadence (~1 min)

// one row of ints per player per snapshot, in this column order
export const SNAP_COLS = [
  'food', 'wood', 'gold', 'identity', 'pop', 'popCap',
  'workers', 'idleWorkers', 'army', 'regions', 'era', 'lossesArmy', 'lossesWorkers',
];

export class MatchRecorder {
  constructor(world, humanId) {
    this.world = world;
    this.humanId = humanId;
    this.pids = Object.keys(world.players);
    this.losses = Object.fromEntries(this.pids.map(p => [p, { army: 0, workers: 0 }]));
    this.nextSnap = 0;
    this.snapsSinceBackup = 0;
    this.log = {
      v: 2,
      meta: {
        faction: humanId,
        date: new Date().toISOString(),
        players: this.pids,
        snapEvery: SNAP_EVERY,
        snapCols: SNAP_COLS,
        // build fingerprint: which rules this game actually ran — "did my build
        // have X?" must be answerable from the log, not deploy archaeology
        rules: { forestRegrow: NODES.wood.regrowTime ?? 0 },
      },
      snaps: [],   // [t, [row per player, meta.players order]]
      events: [],  // [t, tag, ...] — strategic timeline, all nations
      orders: [],  // [t, type, detail?] — the human's commands only
      forests: { cut: 0, grown: 0 },
      result: null,
    };
  }

  // called from the main event drain, sees every sim event
  handleEvent(ev) {
    if (this.log.result) return;
    const t = +this.world.time.toFixed(1);
    const push = row => this.log.events.push(row);
    switch (ev.type) {
      case 'region_flipped': push([t, 'flip', ev.region, ev.owner ?? null, ev.how]); break;
      case 'conversion_started': push([t, 'convert_start', ev.region, ev.owner]); break;
      case 'conquest_started': push([t, 'conquest_start', ev.region, ev.owner]); break;
      case 'nation_fell': push([t, 'fell', ev.owner, ev.conqueror ?? null]); break;
      case 'era_advanced': push([t, 'era', ev.owner, ev.era]); break;
      case 'upgrade_bought': push([t, 'upgrade', ev.owner, ev.key]); break;
      case 'building_complete':
        if (ev.owner && this.world.time > 1) push([t, 'built', ev.owner, ev.kind]);
        break;
      case 'building_destroyed':
        if (ev.owner && ev.owner !== '__dead__') push([t, 'razed', ev.owner, ev.kind, ev.by ?? null]);
        break;
      case 'unit_died': {
        const l = ev.owner && this.losses[ev.owner];
        if (l) l[ev.kind === 'worker' ? 'workers' : 'army']++;
        break;
      }
      case 'forest_cut': this.log.forests.cut++; break;
      case 'forest_grown': this.log.forests.grown++; break;
      // HUD-issued commands surface as sim events — fold the human's into the order stream
      case 'train_started':
        if (ev.owner === this.humanId) this.log.orders.push([t, 'train', ev.kind]);
        break;
      case 'era_started':
        if (ev.owner === this.humanId) this.log.orders.push([t, 'era_up']);
        break;
      case 'victory': this.finish(ev.owner); break;
    }
  }

  // called from the Controls order funnel — human commands only
  recordOrder(o) {
    if (this.log.result || o.type === 'ui' || o.type === 'hint') return;
    const t = +this.world.time.toFixed(1);
    const detail = o.type === 'place' ? o.kind : undefined;
    this.log.orders.push(detail ? [t, o.type, detail] : [t, o.type]);
  }

  // called once per frame; snapshots on sim time so pause doesn't spam
  update() {
    if (this.log.result || this.world.time < this.nextSnap) return;
    this.snap();
    this.nextSnap += SNAP_EVERY;
    if (++this.snapsSinceBackup >= BACKUP_EVERY_SNAPS) {
      this.snapsSinceBackup = 0;
      this.backup();
    }
  }

  snap() {
    const counts = Object.fromEntries(this.pids.map(p => [p, { workers: 0, idle: 0, army: 0, regions: 0 }]));
    for (const e of this.world.entities.values()) {
      const c = counts[e.owner];
      if (!c || e.type !== 'unit' || e.state === 'dying') continue;
      if (e.kind === 'worker') {
        c.workers++;
        if (e.state === 'idle') c.idle++;
      } else if (e.kind === 'soldier' || e.kind === 'crossbow') c.army++;
    }
    for (const r of Object.values(this.world.regions)) {
      if (r.owner && counts[r.owner]) counts[r.owner].regions++;
    }
    const rows = this.pids.map(pid => {
      const p = this.world.players[pid];
      const c = counts[pid], l = this.losses[pid];
      return [
        Math.round(p.res.food), Math.round(p.res.wood), Math.round(p.res.gold), Math.round(p.res.identity),
        p.pop, p.popCap, c.workers, c.idle, c.army, c.regions, p.era, l.army, l.workers,
      ];
    });
    this.log.snaps.push([+this.world.time.toFixed(1), rows]);
  }

  finish(winner) {
    if (this.log.result) return;
    this.snap();
    this.log.result = {
      winner: winner ?? null,
      time: +this.world.time.toFixed(1),
      humanSurvived: !!this.world.players[this.humanId]?.alive,
    };
    this.backup();
  }

  serialize() { return JSON.stringify(this.log); }

  backup() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('peninsulae:lastMatch', this.serialize());
    } catch { /* private mode / quota: the in-memory log still works */ }
  }

  download() {
    // a mid-game save should still carry the latest state
    if (!this.log.result) { this.snap(); this.backup(); }
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    saveFile(this.serialize(), `peninsulae-${this.humanId}-${stamp}.json`);
  }

  // "Play again" reloads the page; the localStorage backup is how a match a
  // player forgot to save gets recovered (Shift+F2 right after the reload)
  static downloadBackup() {
    try {
      const raw = localStorage.getItem('peninsulae:lastMatch');
      if (raw) saveFile(raw, `peninsulae-${JSON.parse(raw).meta.faction}-recovered.json`);
    } catch { /* nothing stored */ }
  }

  attachHotkey() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', e => {
      if (e.code !== 'F2') return;
      e.preventDefault();
      if (e.shiftKey) MatchRecorder.downloadBackup();
      else this.download();
    });
  }
}

function saveFile(text, name) {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
