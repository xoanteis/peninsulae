// The simulation. No three.js in here — plain data ticked at a fixed rate.
// The renderer, UI and audio read state and drain `events`; they never mutate.

import { MAP_W, MAP_H, REGIONS, CASTILE_EXTRA_REGIONS, parseMap } from '../config/map.js';
import { FACTIONS } from '../config/factions.js';
import { UNITS, BUILDINGS, ERAS, START, NODES, CONVICTION, TICK_MS, SMITH_UPGRADES } from '../config/rules.js';
import { tileToWorld, worldToTile, neighbors, hexDistance, findPath } from './hex.js';
import { updateUnit, separation } from './units.js';
import { updateCombat } from './combat.js';
import { initRegions, updateRegions, regionConvertCost } from './regions.js';
import { updateEconomy } from './economy.js';
import { AIController } from './ai.js';

let nextId = 1;

export class World {
  constructor(humanFaction = 'galicia') {
    this.tick_ = 0;
    this.time = 0;
    this.events = [];
    this.tiles = parseMap();
    for (const t of this.tiles) {
      t.building = null;             // entity id occupying the tile
      if (t.terrain === 'forest') t.wood = NODES.wood.perTile;
    }
    this.entities = new Map();
    this.unitsByTile = new Map();    // spatial hash, rebuilt each tick
    this.players = {};
    this.winner = null;
    this.humanId = humanFaction;

    for (const [fid, f] of Object.entries(FACTIONS)) {
      this.players[fid] = {
        id: fid, faction: f, isHuman: fid === humanFaction, alive: true,
        res: { ...START.resources }, pop: 0, popCap: 0, era: 0,
        upgrades: { dmg: 0, armor: 0 }, eraTimer: null,
        capitalId: null,
      };
    }

    this.regions = initRegions(this);
    this.fishNodes = this.placeFishNodes();
    this.spawnStarts();
    this.ai = Object.values(this.players)
      .filter(p => !p.isHuman)
      .map(p => new AIController(this, p.id));
  }

  // ---------- setup ----------
  tileAt(col, row) {
    if (col < 0 || row < 0 || col >= MAP_W || row >= MAP_H) return null;
    return this.tiles[row * MAP_W + col];
  }

  passable(col, row) {
    const t = this.tileAt(col, row);
    return !!t && t.terrain !== 'sea' && t.terrain !== 'mountain' && !t.building;
  }

  walkable(col, row) { // like passable but buildings don't block their own tile for arrival checks
    const t = this.tileAt(col, row);
    return !!t && t.terrain !== 'sea' && t.terrain !== 'mountain';
  }

  placeFishNodes() {
    const nodes = [];
    for (const t of this.tiles) {
      if (t.terrain !== 'sea') continue;
      const landNb = neighbors(t.col, t.row).filter(([c, r]) => {
        const n = this.tileAt(c, r);
        return n && n.terrain !== 'sea';
      });
      if (landNb.length < 2) continue;
      if (nodes.some(n => hexDistance(n.col, n.row, t.col, t.row) < 4)) continue;
      nodes.push({ col: t.col, row: t.row, workers: [] });
    }
    return nodes;
  }

  spawnStarts() {
    for (const [key, meta] of Object.entries(REGIONS)) {
      const region = this.regions[key];
      if (meta.capitalOf) {
        const p = this.players[meta.capitalOf];
        region.owner = p.id;
        region.converted = true;
        const [c, r] = meta.village;
        const cap = this.addBuilding(p.id, 'capital', c, r, { complete: true });
        p.capitalId = cap.id;
        // starting citizens ring the capital
        const spots = this.freeSpotsAround(c, r, START.workers + START.soldiers + 1);
        for (let i = 0; i < START.workers; i++) this.addUnit(p.id, 'worker', ...spots[i % spots.length]);
        for (let i = 0; i < START.soldiers; i++) this.addUnit(p.id, 'soldier', ...spots[(START.workers + i) % spots.length]);
        this.addBuilding(null, 'tower', ...this.nearestFreeTile(c, r, 1), { complete: true, owner: p.id });
      } else {
        this.spawnNeutralVillage(key);
      }
    }
    for (const key of CASTILE_EXTRA_REGIONS) {
      const region = this.regions[key];
      region.owner = 'castile';
      region.converted = false; // held, not loved: conquered-style tribute
      region.resent = true;
      for (const id of region.villageIds) {
        const b = this.entities.get(id);
        if (b) b.owner = 'castile';
      }
      for (const id of region.militiaIds) this.removeEntity(id, true);
      region.militiaIds = [];
    }
  }

  spawnNeutralVillage(key) {
    const region = this.regions[key];
    const [c, r] = REGIONS[key].village;
    const village = this.addBuilding(null, 'village', c, r, { complete: true });
    const towerSpot = this.nearestFreeTile(c, r, 1);
    const tower = this.addBuilding(null, 'tower', ...towerSpot, { complete: true });
    region.villageIds = [village.id, tower.id];
    const spots = this.freeSpotsAround(c, r, 3);
    region.militiaIds = spots.slice(0, 3).map(([sc, sr]) => {
      const m = this.addUnit(null, 'militia', sc, sr);
      m.guardPost = { col: c, row: r };
      return m.id;
    });
  }

  freeSpotsAround(c, r, count) {
    const out = [];
    const seen = new Set([`${c},${r}`]);
    const queue = [[c, r]];
    while (queue.length && out.length < count) {
      const [qc, qr] = queue.shift();
      for (const [nc, nr] of neighbors(qc, qr)) {
        const k = `${nc},${nr}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (this.passable(nc, nr)) { out.push([nc, nr]); queue.push([nc, nr]); }
        else if (this.walkable(nc, nr)) queue.push([nc, nr]);
      }
    }
    while (out.length < count) out.push([c, r]);
    return out;
  }

  nearestFreeTile(c, r, minDist = 0) {
    const spots = this.freeSpotsAround(c, r, 8);
    for (const [sc, sr] of spots) if (hexDistance(c, r, sc, sr) >= minDist) return [sc, sr];
    return spots[0] || [c, r];
  }

  // ---------- entities ----------
  addUnit(owner, kind, col, row) {
    const stats = UNITS[kind];
    const { x, z } = tileToWorld(col, row);
    const f = owner ? FACTIONS[owner] : null;
    const hpMul = f?.bonus.unitHpMul && kind !== 'worker' ? f.bonus.unitHpMul : 1;
    const u = {
      id: nextId++, type: 'unit', kind, owner,
      x, z, px: x, pz: z, facing: Math.random() * Math.PI * 2,
      hp: Math.round(stats.hp * hpMul), maxHp: Math.round(stats.hp * hpMul),
      speed: stats.speed * (kind === 'worker' ? (f?.bonus.workerSpeedMul ?? 1) : 1),
      state: 'idle', anim: 'idle', task: null, path: null, pathIdx: 0,
      attackCd: 0, targetId: null, workSlot: null, dyingT: 0,
      jitterX: (Math.random() - 0.5) * 0.55, jitterZ: (Math.random() - 0.5) * 0.55,
    };
    this.entities.set(u.id, u);
    this.pushEvent({ type: 'unit_spawn', id: u.id, kind, owner, x, z });
    if (owner) this.players[owner].pop += stats.pop;
    return u;
  }

  addBuilding(owner, kind, col, row, { complete = false, owner: ownerOverride } = {}) {
    const def = kind === 'village'
      ? { name: 'Village', hp: 420, model: 'village', cost: {} }
      : BUILDINGS[kind];
    const t = this.tileAt(col, row);
    const { x, z } = tileToWorld(col, row);
    const own = ownerOverride ?? owner;
    const f = own ? FACTIONS[own] : null;
    const hpMul = f?.bonus.buildingHpMul ?? 1;
    const maxHp = Math.round(def.hp * hpMul);
    const b = {
      id: nextId++, type: 'building', kind, owner: own, col, row, x, z,
      hp: complete ? maxHp : Math.max(1, Math.round(maxHp * 0.1)), maxHp,
      progress: complete ? 1 : 0, trainQueue: [], attackCd: 0,
      slots: def.slots ? [] : null, placedAt: this.time,
    };
    t.building = b.id;
    this.entities.set(b.id, b);
    if (b.progress >= 1 && def.popCap && own) this.players[own].popCap += def.popCap;
    this.pushEvent({ type: complete ? 'building_complete' : 'building_placed', id: b.id, kind, owner: own, col, row });
    return b;
  }

  removeEntity(id, silent = false) {
    const e = this.entities.get(id);
    if (!e) return;
    if (e.type === 'building') {
      const t = this.tileAt(e.col, e.row);
      if (t && t.building === id) t.building = null;
      const def = BUILDINGS[e.kind];
      if (def?.popCap && e.owner && e.progress >= 1) this.players[e.owner].popCap -= def.popCap;
    } else if (e.owner && this.players[e.owner] && UNITS[e.kind]) {
      this.players[e.owner].pop -= UNITS[e.kind].pop;
    }
    this.entities.delete(id);
    if (!silent) this.pushEvent({ type: 'entity_removed', id });
  }

  pushEvent(ev) { this.events.push(ev); }

  // ---------- queries ----------
  unitsNear(x, z, radius) {
    const out = [];
    const { col, row } = worldToTile(x, z);
    const r2 = radius * radius;
    for (let dr = -Math.ceil(radius / 1.7) - 1; dr <= Math.ceil(radius / 1.7) + 1; dr++) {
      for (let dc = -Math.ceil(radius / 2) - 1; dc <= Math.ceil(radius / 2) + 1; dc++) {
        const list = this.unitsByTile.get(`${col + dc},${row + dr}`);
        if (!list) continue;
        for (const id of list) {
          const u = this.entities.get(id);
          if (!u) continue;
          const dx = u.x - x, dz = u.z - z;
          if (dx * dx + dz * dz <= r2) out.push(u);
        }
      }
    }
    return out;
  }

  isEnemy(a, b) {
    if (a === b) return false;
    if (a == null || b == null) return true; // neutrals defend against everyone
    return a !== b;
  }

  findPathTo(unit, col, row) {
    const from = worldToTile(unit.x, unit.z);
    return findPath(MAP_W, MAP_H, from.col, from.row, col, row, (c, r) => this.passable(c, r));
  }

  // fallback when properly walled in: squeeze past building tiles (never sea/mountain)
  findPathLoose(unit, col, row) {
    const from = worldToTile(unit.x, unit.z);
    return findPath(MAP_W, MAP_H, from.col, from.row, col, row, (c, r) => this.walkable(c, r));
  }

  // ---------- commands (UI + AI call these) ----------
  canAfford(pid, cost) {
    const p = this.players[pid];
    return Object.entries(cost).every(([k, v]) => p.res[k] >= v);
  }

  pay(pid, cost) {
    const p = this.players[pid];
    for (const [k, v] of Object.entries(cost)) p.res[k] -= v;
  }

  buildingCost(pid, kind) {
    const def = BUILDINGS[kind];
    const f = FACTIONS[pid];
    const cost = {};
    for (const [k, v] of Object.entries(def.cost)) {
      let m = f.bonus.buildCostMul ?? 1;
      if (kind === 'church' && f.bonus.churchCostMul) m *= f.bonus.churchCostMul;
      cost[k] = Math.round(v * m);
    }
    return cost;
  }

  canPlaceAt(pid, kind, col, row) {
    const t = this.tileAt(col, row);
    if (!t || t.terrain === 'sea' || t.terrain === 'mountain' || t.building) return 'blocked';
    if (t.terrain === 'forest' && t.wood > 0) return 'blocked';
    const { x, z } = tileToWorld(col, row);
    if (this.unitsNear(x, z, 0.9).some(u => u.state !== 'dying')) return 'units in the way';
    if (!t.region || this.regions[t.region].owner !== pid) return 'not your region';
    const def = BUILDINGS[kind];
    if (def.era && this.players[pid].era < def.era) return 'era';
    if (def.needsMountain && !neighbors(col, row).some(([c, r]) => this.tileAt(c, r)?.terrain === 'mountain')) {
      return 'needs mountain';
    }
    return null;
  }

  demolish(pid, buildingId) {
    const b = this.entities.get(buildingId);
    if (!b || b.owner !== pid || b.kind === 'capital') return 'invalid';
    // refund most of the cost if it never got built
    const cost = this.buildingCost(pid, b.kind);
    const frac = b.progress < 0.1 ? 0.8 : 0.25;
    for (const [k, v] of Object.entries(cost)) this.players[pid].res[k] += Math.floor(v * frac);
    this.removeEntity(buildingId);
    return null;
  }

  placeBuilding(pid, kind, col, row) {
    const err = this.canPlaceAt(pid, kind, col, row);
    if (err) return err;
    const cost = this.buildingCost(pid, kind);
    if (!this.canAfford(pid, cost)) return 'cannot afford';
    this.pay(pid, cost);
    this.addBuilding(pid, kind, col, row);
    return null;
  }

  trainUnit(pid, buildingId, kind) {
    const b = this.entities.get(buildingId);
    const p = this.players[pid];
    if (!b || b.owner !== pid || b.progress < 1) return 'invalid';
    const def = BUILDINGS[b.kind];
    if (!def.trains?.includes(kind)) return 'invalid';
    if (b.trainQueue.length >= 5) return 'queue full';
    const f = FACTIONS[pid];
    const cost = {};
    for (const [k, v] of Object.entries(UNITS[kind].cost)) {
      cost[k] = Math.round(v * (kind !== 'worker' ? (f.bonus.soldierCostMul ?? 1) : 1));
    }
    if (p.pop + UNITS[kind].pop > p.popCap) return 'need houses';
    if (!this.canAfford(pid, cost)) return 'cannot afford';
    this.pay(pid, cost);
    const time = UNITS[kind].trainTime * (kind !== 'worker' ? (f.bonus.trainTimeMul ?? 1) : 1);
    b.trainQueue.push({ kind, t: 0, time });
    this.pushEvent({ type: 'train_started', building: b.id, kind, owner: pid });
    return null;
  }

  advanceEra(pid) {
    const p = this.players[pid];
    const next = ERAS[p.era + 1];
    if (!next) return 'max era';
    if (p.eraTimer != null) return 'already advancing';
    if (!this.canAfford(pid, next.cost)) return 'cannot afford';
    this.pay(pid, next.cost);
    p.eraTimer = next.time;
    this.pushEvent({ type: 'era_started', owner: pid });
    return null;
  }

  buySmithUpgrade(pid, key) {
    const p = this.players[pid];
    const up = SMITH_UPGRADES[key];
    if (p.upgrades[key === 'attack' ? 'dmg' : 'armor'] > 0) return 'owned';
    const hasSmith = [...this.entities.values()].some(e =>
      e.type === 'building' && e.kind === 'blacksmith' && e.owner === pid && e.progress >= 1);
    if (!hasSmith) return 'needs blacksmith';
    if (!this.canAfford(pid, up.cost)) return 'cannot afford';
    this.pay(pid, up.cost);
    if (key === 'attack') p.upgrades.dmg += up.dmg;
    else p.upgrades.armor += up.armor;
    this.pushEvent({ type: 'upgrade_bought', owner: pid, key });
    return null;
  }

  startConversion(pid, regionKey) {
    const region = this.regions[regionKey];
    if (!region || region.owner === pid) return 'invalid';
    if (region.conversion) return 'someone is already converting it';
    if (region.meta.capitalOf && region.owner === region.meta.capitalOf &&
        this.players[region.meta.capitalOf].alive) {
      return 'a capital cannot be converted while its castle stands';
    }
    const cost = regionConvertCost(this, pid, regionKey);
    if (!this.canAfford(pid, { identity: cost })) return 'cannot afford';
    this.pay(pid, { identity: cost });
    region.conversion = { pid, t: 0, suppressed: false };
    this.pushEvent({ type: 'conversion_started', region: regionKey, owner: pid });
    return null;
  }

  // unit orders --------------------------------------------------------------
  orderMove(pid, ids, x, z) {
    const { col, row } = worldToTile(x, z);
    for (const id of ids) {
      const u = this.entities.get(id);
      if (!u || u.owner !== pid || u.state === 'dying') continue;
      u.task = { type: 'move', x, z };
      u.workSlot = null;
      const path = this.findPathTo(u, col, row) ?? this.findPathLoose(u, col, row)
        ?? this.pathToNearestReachable(u, col, row);
      u.path = path; u.pathIdx = 1; u.state = 'moving';
    }
    this.pushEvent({ type: 'order_move', x, z, count: ids.length, owner: pid });
  }

  pathToNearestReachable(u, col, row) {
    // goal blocked: try neighbors, then squeeze past walls as a last resort
    for (const [nc, nr] of neighbors(col, row)) {
      if (!this.passable(nc, nr)) continue;
      const p = this.findPathTo(u, nc, nr);
      if (p) return p;
    }
    for (const [nc, nr] of neighbors(col, row)) {
      if (!this.walkable(nc, nr)) continue;
      const p = this.findPathLoose(u, nc, nr);
      if (p) return p;
    }
    return null;
  }

  // C&C-style attack-move: walk to the point, engaging enemies met on the way
  orderAttackMove(pid, ids, x, z) {
    const { col, row } = worldToTile(x, z);
    for (const id of ids) {
      const u = this.entities.get(id);
      if (!u || u.owner !== pid || u.state === 'dying') continue;
      u.task = { type: 'amove', x, z };
      u.workSlot = null;
      u.path = this.findPathTo(u, col, row) ?? this.findPathLoose(u, col, row)
        ?? this.pathToNearestReachable(u, col, row);
      u.pathIdx = 1;
      u.state = 'moving';
    }
    this.pushEvent({ type: 'order_attack', x, z, owner: pid });
  }

  orderStop(pid, ids) {
    for (const id of ids) {
      const u = this.entities.get(id);
      if (!u || u.owner !== pid || u.state === 'dying') continue;
      u.task = null; u.path = null; u.workSlot = null;
      u.state = 'idle'; u.anim = 'idle';
    }
  }

  orderGather(pid, ids, target) {
    for (const id of ids) {
      const u = this.entities.get(id);
      if (!u || u.owner !== pid || u.kind !== 'worker' || u.state === 'dying') continue;
      u.task = { type: 'gather', target };
      u.workSlot = null;
      u.state = 'toWork';
      u.path = null;
    }
  }

  orderBuild(pid, ids, buildingId) {
    for (const id of ids) {
      const u = this.entities.get(id);
      if (!u || u.owner !== pid || u.kind !== 'worker' || u.state === 'dying') continue;
      u.task = { type: 'construct', buildingId };
      u.workSlot = null;
      u.state = 'toWork';
      u.path = null;
    }
  }

  orderAttack(pid, ids, targetId) {
    const t = this.entities.get(targetId);
    if (!t) return;
    for (const id of ids) {
      const u = this.entities.get(id);
      if (!u || u.owner !== pid || u.state === 'dying') continue;
      u.task = { type: 'attack', targetId };
      u.workSlot = null;
      u.state = 'toFight';
      u.path = null;
    }
    this.pushEvent({ type: 'order_attack', targetId, owner: pid });
  }

  // ---------- tick ----------
  step() {
    const dt = TICK_MS / 1000;
    this.tick_++;
    this.time += dt;

    // spatial hash
    this.unitsByTile.clear();
    for (const e of this.entities.values()) {
      if (e.type !== 'unit') continue;
      e.px = e.x; e.pz = e.z;
      const { col, row } = worldToTile(e.x, e.z);
      const k = `${col},${row}`;
      let list = this.unitsByTile.get(k);
      if (!list) this.unitsByTile.set(k, list = []);
      list.push(e.id);
    }

    updateEconomy(this, dt);
    for (const e of [...this.entities.values()]) {
      if (e.type === 'unit') updateUnit(this, e, dt);
    }
    separation(this, dt);
    updateCombat(this, dt);
    updateRegions(this, dt);
    this.checkVictory();
    if (!this.winner) for (const ai of this.ai) ai.think(dt);
  }

  checkVictory() {
    if (this.winner) return;
    // capital falls -> nation capitulates, regions defect to conqueror
    for (const p of Object.values(this.players)) {
      if (!p.alive) continue;
      const cap = this.entities.get(p.capitalId);
      if (!cap) {
        p.alive = false;
        const conqueror = p.lastAttacker && this.players[p.lastAttacker]?.alive ? p.lastAttacker : null;
        for (const region of Object.values(this.regions)) {
          if (region.owner === p.id) {
            region.owner = conqueror;
            region.resent = true;
            region.converted = false;
            region.conversion = null;
            this.pushEvent({ type: 'region_flipped', region: region.key, owner: conqueror, how: 'defection' });
          }
        }
        this.pushEvent({ type: 'nation_fell', owner: p.id, conqueror });
      }
    }
    const regions = Object.values(this.regions);
    for (const p of Object.values(this.players)) {
      if (p.alive && regions.every(r => r.owner === p.id)) {
        this.winner = p.id;
        this.pushEvent({ type: 'victory', owner: p.id });
      }
    }
    const alive = Object.values(this.players).filter(p => p.alive);
    if (alive.length === 1 && !this.winner) {
      this.winner = alive[0].id;
      this.pushEvent({ type: 'victory', owner: alive[0].id });
    }
  }

  dominationShare(pid) {
    const regions = Object.values(this.regions);
    return regions.filter(r => r.owner === pid).length / regions.length;
  }
}
