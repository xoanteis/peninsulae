// Region allegiance: tribute, conviction (cultural conversion) and conquest.

import { MAP_W, REGIONS } from '../config/map.js';
import { FACTIONS } from '../config/factions.js';
import { CONVICTION } from '../config/rules.js';
import { tileToWorld, worldToTile, neighbors, hexDistance } from './hex.js';

export function initRegions(world) {
  const regions = {};
  for (const [key, meta] of Object.entries(REGIONS)) {
    regions[key] = {
      key, meta, owner: null, converted: false, resent: false,
      conversion: null, conquest: null,
      tiles: [], coastal: false, villageIds: [], militiaIds: [],
      center: tileToWorld(...meta.village),
      neighborKeys: new Set(),
    };
  }
  for (const t of world.tiles) {
    if (!t.region) continue;
    const region = regions[t.region];
    region.tiles.push(t);
    for (const [c, r] of neighbors(t.col, t.row)) {
      const n = world.tileAt(c, r);
      if (!n) continue;
      if (n.terrain === 'sea') region.coastal = true;
      else if (n.region && n.region !== t.region) region.neighborKeys.add(n.region);
    }
  }
  return regions;
}

export function regionConvertCost(world, pid, key) {
  const region = world.regions[key];
  const f = FACTIONS[pid];
  const ownsNeighbor = [...region.neighborKeys].some(k => world.regions[k].owner === pid);
  let cost = ownsNeighbor ? CONVICTION.adjacentCost : CONVICTION.baseCost;
  if (region.owner && region.resent) cost *= CONVICTION.resentDiscount;
  if (region.coastal && f.bonus.coastalConvertMul) cost *= f.bonus.coastalConvertMul;
  if (world.players[pid].techs?.consolat) cost *= 0.75; // Consolat de Mar (era tech)
  // empire fatigue: every region past the second makes the next sermon pricier —
  // a message that spread like fire in three valleys strains across a peninsula
  const owned = Object.values(world.regions).filter(r => r.owner === pid).length;
  cost *= 1 + 0.25 * Math.max(0, owned - 2);
  return Math.round(cost);
}

export function updateRegions(world, dt) {
  for (const region of Object.values(world.regions)) {
    updateConversion(world, region, dt);
    updateConquest(world, region, dt);
  }
}

function enemiesInRegion(world, region, pid) {
  // armed enemy units near the village suppress conversion
  const list = world.unitsNear(region.center.x, region.center.z, 5.5);
  return list.filter(u => u.owner && u.owner !== pid && u.owner !== '__dead__' && u.kind !== 'worker');
}

function updateConversion(world, region, dt) {
  const conv = region.conversion;
  if (!conv) return;
  const f = FACTIONS[conv.pid];
  const suppressors = enemiesInRegion(world, region, conv.pid);
  conv.suppressed = suppressors.length > 0;
  if (conv.suppressed) return;
  let rate = 1;
  if (f.bonus.convictionRateMul) rate *= f.bonus.convictionRateMul;
  conv.t += dt * rate;
  if (conv.t >= CONVICTION.time) {
    flipRegion(world, region, conv.pid, 'conviction');
  }
}

// A nation's home region cannot change allegiance while its capital stands —
// you break a nation at its head (raze the castle), not by picketing its square.
function capitalStands(world, region) {
  const capOf = region.meta.capitalOf;
  if (!capOf) return false;
  const p = world.players[capOf];
  return p.alive && region.owner === capOf && world.entities.get(p.capitalId);
}

function updateConquest(world, region, dt) {
  if (capitalStands(world, region)) { region.conquest = null; return; }
  // guards must be gone, then armed presence holds the village
  if (region.owner === null) {
    const guardsAlive = region.militiaIds.some(id => world.entities.get(id))
      || region.villageIds.some(id => {
        const b = world.entities.get(id);
        return b && b.kind === 'tower';
      });
    if (guardsAlive) { region.conquest = null; return; }
  }
  // militia are guards, not conquerors — they hold posts but cannot seize banners
  const holders = world.unitsNear(region.center.x, region.center.z, 3.2)
    .filter(u => u.owner && u.owner !== '__dead__' && u.kind !== 'worker' && u.kind !== 'militia' && u.owner !== region.owner);
  const owners = new Set(holders.map(u => u.owner));
  if (owners.size !== 1) { region.conquest = null; return; }
  const pid = [...owners][0];
  // capturing an owned region requires its defenses down: no defender units present
  if (region.owner) {
    const defenders = world.unitsNear(region.center.x, region.center.z, 4.5)
      .filter(u => u.owner === region.owner && u.kind !== 'worker');
    if (defenders.length > 0) { region.conquest = null; return; }
    // owned regions are anchored by their village tower if any survives
    const tower = region.villageIds.map(id => world.entities.get(id)).find(b => b && b.kind === 'tower');
    if (tower) { region.conquest = null; return; }
  }
  if (!region.conquest || region.conquest.pid !== pid) {
    region.conquest = { pid, t: 0 };
    world.pushEvent({ type: 'conquest_started', region: region.key, owner: pid });
  }
  region.conquest.t += dt;
  // loyal (converted) regions resist the sword twice as long — conviction sticks
  const hold = CONVICTION.conquerHoldTime * (region.converted ? 2 : 1);
  if (region.conquest.t >= hold) {
    flipRegion(world, region, pid, 'conquest');
  }
}

export function flipRegion(world, region, pid, how) {
  const prev = region.owner;
  region.owner = pid;
  region.conversion = null;
  region.conquest = null;
  // Foruak: a nation of pacts conquers without breeding resentment — the region
  // keeps its law and pays full tribute, and missionaries get no grievance to
  // exploit. At full strength ('loyal') the pact binds like conviction: the
  // region resists conquest 2x and, if the pact-maker falls, goes free again.
  const foru = how === 'conquest' ? FACTIONS[pid].bonus.foruPact : null;
  region.converted = how === 'conviction' || foru === 'loyal';
  region.resent = how !== 'conviction' && !foru;
  // village structures change hands; militia disband — unless the region was
  // won by conviction and the new nation arms its brotherhoods (Irmandades)
  const joins = how === 'conviction' && FACTIONS[pid].bonus.militiaJoin;
  for (const id of region.militiaIds) {
    const m = world.entities.get(id);
    if (m && joins) {
      const { col, row } = worldToTile(m.x, m.z);
      world.removeEntity(id);
      const u = world.addUnit(pid, 'militia', col, row);
      u.guardPost = m.guardPost ?? null;
    } else {
      world.removeEntity(id);
    }
  }
  region.militiaIds = [];
  for (const id of region.villageIds) {
    const b = world.entities.get(id);
    if (b) b.owner = pid;
  }
  world.pushEvent({
    type: 'region_flipped', region: region.key, owner: pid, prev, how,
    x: region.center.x, z: region.center.z,
  });
}

// tribute is paid in economy.js each tick
export function regionTribute(world, region) {
  if (!region.owner) return null;
  const f = FACTIONS[region.owner];
  const p = world.players[region.owner];
  const out = {};
  let mul = region.resent ? CONVICTION.resentTributeMul : 1;
  if (region.coastal) {
    // Escola de Sagres (era tech) supersedes the base coastal bonus
    const coastMul = p?.techs?.sagres ? 1.5 : f.bonus.coastalTributeMul;
    if (coastMul) mul *= coastMul;
  }
  for (const [k, v] of Object.entries(region.meta.tribute)) out[k] = v * mul;
  return out;
}
