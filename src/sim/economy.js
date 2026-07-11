// Passive economy: building rates, region tribute, train queues, era timers.

import { BUILDINGS, ERAS, NODES } from '../config/rules.js';
import { FACTIONS } from '../config/factions.js';
import { regionTribute } from './regions.js';

export function updateEconomy(world, dt) {
  // stumps regrow in cut order — the constant delay keeps the queue sorted,
  // so only the front ever needs checking
  while (world.stumps.length && world.stumps[0].regrowAt <= world.time) {
    const t = world.stumps.shift();
    if (t.building) { // someone built on the clearing — try again in a while
      t.regrowAt = world.time + NODES.wood.regrowTime;
      world.stumps.push(t);
      continue;
    }
    t.terrain = 'forest';
    t.wood = NODES.wood.perTile * NODES.wood.regrowTo;
    world.pushEvent({ type: 'forest_grown', col: t.col, row: t.row });
  }

  // building passive rates + training
  let marketOwners = new Set();
  for (const b of world.entities.values()) {
    if (b.type !== 'building' || b.progress < 1 || !b.owner || b.owner === '__dead__') continue;
    const def = BUILDINGS[b.kind];
    if (!def) continue;
    const p = world.players[b.owner];
    if (!p?.alive) continue;
    if (def.rates) {
      for (const [k, v] of Object.entries(def.rates)) p.res[k] += v * dt;
    }
    if (b.kind === 'market') marketOwners.add(b.owner);

    if (b.trainQueue.length) {
      const job = b.trainQueue[0];
      job.t += dt;
      if (job.t >= job.time) {
        b.trainQueue.shift();
        const [c, r] = world.nearestFreeTile(b.col, b.row, 1);
        const u = world.addUnit(b.owner, job.kind, c, r);
        world.pushEvent({ type: 'train_complete', building: b.id, unit: u.id, kind: job.kind, owner: b.owner });
        if (b.rally) world.orderMove(b.owner, [u.id], b.rally.x, b.rally.z);
      }
    }
  }

  // clean stale slot assignments
  for (const b of world.entities.values()) {
    if (b.type === 'building' && b.slots) {
      b.slots = b.slots.filter(id => {
        const u = world.entities.get(id);
        return u && u.state === 'working' && u.task?.target?.buildingId === b.id;
      });
    }
  }

  // region tribute + faction trickles
  const perPlayerRegions = {};
  for (const region of Object.values(world.regions)) {
    if (!region.owner) continue;
    perPlayerRegions[region.owner] = (perPlayerRegions[region.owner] ?? 0) + 1;
    const p = world.players[region.owner];
    if (!p?.alive) continue;
    const trib = regionTribute(world, region);
    if (trib) for (const [k, v] of Object.entries(trib)) p.res[k] += v * dt;
  }

  for (const p of Object.values(world.players)) {
    if (!p.alive) continue;
    const f = FACTIONS[p.id];
    // Camino de Santiago: converted regions strengthen the pilgrim network
    if (f.bonus.caminoIdentity) {
      const converted = Object.values(world.regions)
        .filter(r => r.owner === p.id && r.converted && !r.meta.capitalOf).length;
      p.res.identity += converted * f.bonus.caminoIdentity * eraTechMul(p, f, 'caminoMul') * dt;
    }
    // As Minas de Gallaecia: the land's scattered gold, tin and wolfram workings
    // pay a steady trickle — the war-chest an Identity economy can't otherwise raise
    if (f.bonus.mineralTrickle) p.res.gold += f.bonus.mineralTrickle * dt;
    // Catalan trade network: markets pay per region held
    if (f.bonus.marketPerRegion && marketOwners.has(p.id)) {
      const owned = perPlayerRegions[p.id] ?? 0;
      p.res.gold += owned * f.bonus.marketPerRegion * eraTechMul(p, f, 'marketMul') * dt;
    }

    // era advance timer
    if (p.eraTimer != null) {
      p.eraTimer -= dt;
      if (p.eraTimer <= 0) {
        p.eraTimer = null;
        p.era++;
        applyEraTech(world, p);
        world.pushEvent({ type: 'era_advanced', owner: p.id, era: p.era, name: ERAS[p.era].name });
      }
    }
  }
}

// Signature techs land when a nation reaches a new era (see GAME_DESIGN.md).
// Their numbers live in config (factions.eraTechBonus / ERAS), gated on p.era at
// the use sites — NEVER copy them onto the shared FACTIONS object: writing to it
// leaks era bonuses across games in one process (it biased the balance harness
// for months).
function applyEraTech(world, p) {
  const f = FACTIONS[p.id];
  if (p.era === 1) {
    const tech = f.eraTechBonus ?? {};
    if (tech.dmg) p.upgrades.dmg += tech.dmg;
    if (tech.armor) p.upgrades.armor += tech.armor;
    world.pushEvent({ type: 'signature_tech', owner: p.id, name: f.eraTech });
  }
  if (p.era === 2) {
    // Golden Age: everyone's workers and soldiers sharpen
    p.upgrades.dmg += ERAS[2].dmg;
  }
}

// signature-tech multipliers apply once the nation reaches the Kingdom era
function eraTechMul(p, f, key) {
  return p.era >= 1 ? (f.eraTechBonus?.[key] ?? 1) : 1;
}
