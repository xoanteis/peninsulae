// AI nations. Same rules as the player, different personalities (aiStyle):
//   castile: aggressive conqueror · portugal: coastal creeper · catalonia: economist
//   basque: turtle-counter · galicia: quiet converter

import { FACTIONS } from '../config/factions.js';
import { UNITS, BUILDINGS, ERAS, CONVICTION } from '../config/rules.js';
import { REGIONS } from '../config/map.js';
import { worldToTile, hexDistance, neighbors } from './hex.js';
import { regionConvertCost } from './regions.js';
import { nearestForest } from './units.js';

export class AIController {
  constructor(world, pid) {
    this.world = world;
    this.pid = pid;
    this.style = FACTIONS[pid].aiStyle;
    this.cooldown = Math.random() * 2; // stagger
    this.attackWave = null;
    this.workerTarget = 7;
    this.armyTarget = 3 + Math.round(this.style.aggression * 3);
  }

  think(dt) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    this.cooldown = 1.4 + Math.random() * 0.5;
    const w = this.world, p = w.players[this.pid];
    if (!p.alive) return;

    const my = this.collect();
    this.workerTarget = 7 + p.era * 3 + Math.round(this.style.economy * 3);
    this.armyTarget = 3 + Math.round(this.style.aggression * 4) + p.era * 2 + (this.underThreat ? 3 : 0);

    this.defend(my);
    this.economy(my);
    this.trainAndBuild(my);
    this.expand(my);
    this.war(my);
    this.eras(my);
  }

  collect() {
    const w = this.world;
    const my = { workers: [], soldiers: [], idleWorkers: [], idleSoldiers: [], buildings: [], sites: [], regions: [] };
    for (const e of w.entities.values()) {
      if (e.owner !== this.pid) continue;
      if (e.type === 'unit') {
        if (e.kind === 'worker') {
          my.workers.push(e);
          if (e.state === 'idle') my.idleWorkers.push(e);
        } else {
          my.soldiers.push(e);
          if (e.state === 'idle') my.idleSoldiers.push(e);
        }
      } else {
        my.buildings.push(e);
        if (e.progress < 1) my.sites.push(e);
      }
    }
    for (const r of Object.values(w.regions)) if (r.owner === this.pid) my.regions.push(r);
    my.byKind = kind => my.buildings.filter(b => b.kind === kind && b.progress >= 1);
    my.cap = w.entities.get(w.players[this.pid].capitalId);
    return my;
  }

  defend(my) {
    const w = this.world, p = w.players[this.pid];
    this.underThreat = false;
    if (!my.cap) return;
    // enemies near any of my buildings?
    for (const b of my.buildings) {
      const foes = w.unitsNear(b.x, b.z, 6).filter(u =>
        u.owner && u.owner !== '__dead__' && u.owner !== this.pid && u.kind !== 'worker');
      if (foes.length) {
        this.underThreat = true;
        const defenders = [...my.idleSoldiers, ...my.soldiers.filter(s => s.task?.auto)].slice(0, 8);
        if (defenders.length) w.orderAttack(this.pid, defenders.map(u => u.id), foes[0].id);
        this.attackWave = null;
        return;
      }
    }
  }

  economy(my) {
    const w = this.world, p = w.players[this.pid];
    if (!my.cap) return;
    const capTile = worldToTile(my.cap.x, my.cap.z);

    // keep construction moving even when nobody is idle
    if (my.sites.length) {
      const busyBuilders = my.workers.filter(u => u.task?.type === 'construct').length;
      if (busyBuilders === 0) {
        const puller = my.idleWorkers[0] ?? my.workers.find(u => u.state === 'working' || u.state === 'toWork');
        if (puller) w.orderBuild(this.pid, [puller.id], my.sites[0].id);
      }
    }

    for (const u of my.idleWorkers) {
      // construction first
      if (my.sites.length) { w.orderBuild(this.pid, [u.id], my.sites[0].id); continue; }
      // then whatever resource we're poorest in
      const wants = [];
      if (p.res.wood < 200) wants.push('wood');
      const farms = my.byKind('farm').filter(b => b.slots.length < (BUILDINGS.farm.slots ?? 1));
      const mines = my.byKind('mine').filter(b => b.slots.length < (BUILDINGS.mine.slots ?? 2));
      if (farms.length) wants.push('farm');
      if (mines.length) wants.push('mine');
      if (this.nearFish(capTile)) wants.push('fish');
      if (!wants.length) wants.push('wood');
      const pick = wants[Math.floor(Math.random() * wants.length)];
      if (pick === 'wood') {
        const f = nearestForest(w, capTile.col, capTile.row, 16);
        if (f) { w.orderGather(this.pid, [u.id], { type: 'forest', col: f.col, row: f.row }); continue; }
      }
      if (pick === 'farm' && farms.length) { w.orderGather(this.pid, [u.id], { type: 'slot', buildingId: farms[0].id }); continue; }
      if (pick === 'mine' && mines.length) { w.orderGather(this.pid, [u.id], { type: 'slot', buildingId: mines[0].id }); continue; }
      if (pick === 'fish') {
        const n = this.nearFish(capTile);
        if (n) { w.orderGather(this.pid, [u.id], { type: 'fish', col: n.col, row: n.row }); continue; }
      }
    }
  }

  nearFish(capTile) {
    return this.world.fishNodes.find(n => hexDistance(n.col, n.row, capTile.col, capTile.row) <= 5);
  }

  trainAndBuild(my) {
    const w = this.world, p = w.players[this.pid];
    if (!my.cap) return;

    // train workers / army
    if (my.workers.length + queued(my.cap, 'worker') < this.workerTarget) {
      w.trainUnit(this.pid, my.cap.id, 'worker');
    }
    const barracks = my.byKind('barracks');
    const ranges = my.byKind('archery');
    const armySize = my.soldiers.length;
    if (armySize < this.armyTarget) {
      for (const b of barracks) if (b.trainQueue.length < 2) w.trainUnit(this.pid, b.id, 'soldier');
      for (const b of ranges) if (b.trainQueue.length < 2) w.trainUnit(this.pid, b.id, 'crossbow');
    }

    // build order
    if (my.sites.length >= 2) return;
    const capTile = worldToTile(my.cap.x, my.cap.z);
    const want = this.nextBuilding(my, p);
    if (!want) return;
    const spot = this.findSpot(want, capTile);
    if (spot) {
      const err = w.placeBuilding(this.pid, want, spot[0], spot[1]);
      if (!err && my.idleWorkers.length === 0 && my.workers.length) {
        // pull a gatherer to construct
        const worker = my.workers.find(u => u.state === 'working' || u.state === 'toWork');
        if (worker) {
          const site = [...w.entities.values()].find(e => e.type === 'building' && e.owner === this.pid && e.progress < 1);
          if (site) w.orderBuild(this.pid, [worker.id], site.id);
        }
      }
    }
  }

  nextBuilding(my, p) {
    const has = kind => my.buildings.filter(b => b.kind === kind).length;
    if (p.pop >= p.popCap - 1) return 'house';
    if (has('farm') < 2 + p.era) return 'farm';
    if (has('lumbercamp') < 1) return 'lumbercamp';
    if (has('barracks') < 1) return 'barracks';
    if (has('mine') < 1 && this.mineSpotExists()) return 'mine';
    if (has('church') < 1 + this.style.convictionLove) return 'church';
    if (has('market') < (this.style.economy > 0.7 ? 2 : 1)) return 'market';
    if (p.era >= 1) {
      if (has('archery') < 1) return 'archery';
      if (has('blacksmith') < 1) return 'blacksmith';
      if (has('festival') < 1 && this.style.convictionLove > 0.5) return 'festival';
      if (has('tower') < 2 && this.style.turtle) return 'tower';
    }
    if (has('house') < 6 && p.pop >= p.popCap - 2) return 'house';
    return null;
  }

  mineSpotExists() {
    return !!this.findSpot('mine', worldToTile(this.collectCap().x, this.collectCap().z));
  }

  collectCap() { return this.world.entities.get(this.world.players[this.pid].capitalId) ?? { x: 0, z: 0 }; }

  findSpot(kind, capTile) {
    const w = this.world;
    // spiral out from capital through owned regions
    const cands = [];
    for (const region of Object.values(w.regions)) {
      if (region.owner !== this.pid) continue;
      for (const t of region.tiles) {
        if (w.canPlaceAt(this.pid, kind, t.col, t.row) === null) {
          cands.push([t.col, t.row, hexDistance(capTile.col, capTile.row, t.col, t.row)]);
        }
      }
    }
    cands.sort((a, b) => a[2] - b[2]);
    return cands.length ? [cands[0][0], cands[0][1]] : null;
  }

  expand(my) {
    const w = this.world, p = w.players[this.pid];
    // pick a target region
    const targets = Object.values(w.regions).filter(r => r.owner !== this.pid);
    if (!targets.length) return;
    const score = r => {
      let s = 0;
      const adjacent = [...r.neighborKeys].some(k => w.regions[k].owner === this.pid);
      s += adjacent ? 3 : 0;
      if (r.coastal) s += this.style.expandCoastal * 2;
      if (!r.owner) s += 2; // neutrals are easier
      if (r.owner && w.players[r.owner]?.isHuman) s += this.style.aggression;
      s -= hexDistance(...Object.values(worldToTile(my.cap?.x ?? 0, my.cap?.z ?? 0)), ...r.meta.village) * 0.15;
      return s + Math.random() * 0.5;
    };
    targets.sort((a, b) => score(b) - score(a));
    const target = targets[0];

    // conviction if we love it and can afford it
    if (!target.conversion && !target.owner || (target.owner && target.resent)) {
      const cost = regionConvertCost(w, this.pid, target.key);
      const wantConvict = Math.random() < this.style.convictionLove;
      if (wantConvict && p.res.identity >= cost && !target.conversion) {
        w.startConversion(this.pid, target.key);
        return;
      }
    }
    // otherwise war handles it
    this.expandTarget = target.key;
  }

  war(my) {
    const w = this.world, p = w.players[this.pid];
    if (this.underThreat) return;
    const army = my.soldiers.filter(s => s.state === 'idle' || s.task?.auto);
    if (army.length < this.armyTarget) return;

    let targetRegion = this.expandTarget ? w.regions[this.expandTarget] : null;
    // hegemon endgame: hunt capitals
    if (this.style.aggression > 0.7 && p.era >= 1) {
      const rivals = Object.values(w.players).filter(o => o.alive && o.id !== this.pid);
      rivals.sort((a, b) => w.dominationShare(b.id) - w.dominationShare(a.id));
      const rival = rivals[0];
      const cap = rival && w.entities.get(rival.capitalId);
      if (cap && Math.random() < 0.35) {
        w.orderAttack(this.pid, army.map(u => u.id), cap.id);
        this.attackWave = { target: cap.id };
        return;
      }
    }
    if (!targetRegion || targetRegion.owner === this.pid) return;
    // attack the village guard / tower / any structure there
    const targetIds = [...targetRegion.villageIds, ...targetRegion.militiaIds]
      .filter(id => w.entities.get(id));
    const tid = targetIds.find(id => w.entities.get(id)?.kind === 'tower') ?? targetIds[0];
    if (tid) {
      w.orderAttack(this.pid, army.map(u => u.id), tid);
    } else {
      // nothing to kill: walk the army to the village to hold it
      w.orderMove(this.pid, army.map(u => u.id), targetRegion.center.x, targetRegion.center.z);
    }
    this.attackWave = { region: targetRegion.key };
  }

  eras(my) {
    const w = this.world, p = w.players[this.pid];
    const next = ERAS[p.era + 1];
    if (!next || p.eraTimer != null) return;
    // keep a buffer so the AI doesn't bankrupt itself
    const afford = Object.entries(next.cost).every(([k, v]) => p.res[k] >= v * 1.25);
    if (afford) w.advanceEra(this.pid);
  }
}

function queued(b, kind) {
  return b ? b.trainQueue.filter(j => j.kind === kind).length : 0;
}
