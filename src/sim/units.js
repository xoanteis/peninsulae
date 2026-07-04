// Unit task state machine + movement. States:
//   idle · moving · toWork · working · toFight · fighting · dying
// Anim hints for the renderer: idle · walk · work · attack · shoot · die

import { UNITS, BUILDINGS, NODES } from '../config/rules.js';
import { FACTIONS } from '../config/factions.js';
import { tileToWorld, worldToTile, neighbors, hexDistance } from './hex.js';
import { tryAttack, acquireTarget } from './combat.js';

const ARRIVE = 0.18;

export function updateUnit(world, u, dt) {
  if (u.state === 'dying') {
    u.dyingT += dt;
    if (u.dyingT > 2.2) world.removeEntity(u.id);
    return;
  }
  if (u.attackCd > 0) u.attackCd -= dt;

  switch (u.state) {
    case 'idle': {
      u.anim = 'idle';
      // soldiers keep watch; militia guard their post
      if (u.kind !== 'worker') {
        const enemy = acquireTarget(world, u);
        if (enemy) {
          u.task = { type: 'attack', targetId: enemy.id, auto: true };
          u.state = 'toFight';
        } else if (u.guardPost) {
          const { x, z } = tileToWorld(u.guardPost.col, u.guardPost.row);
          if (dist(u.x, u.z, x, z) > 4.5) moveToward(world, u, x, z, dt);
        }
      }
      break;
    }

    case 'moving': {
      u.anim = 'walk';
      if (!followPath(world, u, dt)) {
        u.state = 'idle';
        u.anim = 'idle';
        u.task = null;
      }
      break;
    }

    case 'toWork': {
      const spot = workSpot(world, u);
      if (!spot) { u.state = 'idle'; u.task = null; break; }
      const d = dist(u.x, u.z, spot.x, spot.z);
      if (d <= (spot.arrive ?? ARRIVE + 0.25)) {
        u.state = 'working';
        u.workT = 0;
      } else {
        u.anim = 'walk';
        if (!u.path || u.pathGoal !== spot.key) {
          const { col, row } = worldToTile(spot.x, spot.z);
          u.path = world.passable(col, row)
            ? world.findPathTo(u, col, row)
            : world.pathToNearestReachable(u, col, row);
          u.pathIdx = 1;
          u.pathGoal = spot.key;
          if (!u.path) { u.state = 'idle'; u.task = null; break; }
        }
        if (!followPath(world, u, dt, spot)) {
          u.path = null;
        }
      }
      break;
    }

    case 'working': {
      doWork(world, u, dt);
      break;
    }

    case 'toFight': {
      const t = world.entities.get(u.task?.targetId);
      if (!t || t.hp <= 0) { u.state = 'idle'; u.task = null; break; }
      const stats = UNITS[u.kind];
      const targetR = t.type === 'building' ? 0.95 : 0.3;
      const d = dist(u.x, u.z, t.x, t.z) - targetR;
      if (d <= stats.range) {
        u.state = 'fighting';
      } else {
        u.anim = 'walk';
        // chase: repath if target moved a tile away from current goal
        const goal = worldToTile(t.x, t.z);
        if (!u.path || u.chaseGoal !== `${goal.col},${goal.row}`) {
          u.path = world.passable(goal.col, goal.row)
            ? world.findPathTo(u, goal.col, goal.row)
            : world.pathToNearestReachable(u, goal.col, goal.row);
          u.pathIdx = 1;
          u.chaseGoal = `${goal.col},${goal.row}`;
          if (!u.path) { u.state = 'idle'; u.task = null; break; }
        }
        followPath(world, u, dt, { x: t.x, z: t.z, arrive: stats.range + targetR });
      }
      break;
    }

    case 'fighting': {
      tryAttack(world, u, dt);
      break;
    }
  }
}

function dist(x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

function moveToward(world, u, x, z, dt) {
  const d = dist(u.x, u.z, x, z);
  if (d < ARRIVE) return false;
  const step = Math.min(u.speed * dt, d);
  u.x += ((x - u.x) / d) * step;
  u.z += ((z - u.z) / d) * step;
  u.facing = Math.atan2(x - u.x, z - u.z);
  u.anim = 'walk';
  return true;
}

// follow the hex path; returns false when arrived (or no path)
function followPath(world, u, dt, goalOverride = null) {
  if (!u.path || u.pathIdx >= u.path.length) {
    if (goalOverride) {
      const d = dist(u.x, u.z, goalOverride.x, goalOverride.z);
      if (d > (goalOverride.arrive ?? ARRIVE)) {
        return moveToward(world, u, goalOverride.x, goalOverride.z, dt);
      }
      return false;
    }
    // final approach to exact click point
    if (u.task?.type === 'move') {
      const d = dist(u.x, u.z, u.task.x, u.task.z);
      if (d > ARRIVE) return moveToward(world, u, u.task.x, u.task.z, dt);
    }
    return false;
  }
  const [c, r] = u.path[u.pathIdx];
  const { x, z } = tileToWorld(c, r);
  const tx = x + u.jitterX, tz = z + u.jitterZ;
  const d = dist(u.x, u.z, tx, tz);
  if (d < ARRIVE + 0.15) {
    u.pathIdx++;
    return followPath(world, u, dt, goalOverride);
  }
  const step = Math.min(u.speed * dt, d);
  u.x += ((tx - u.x) / d) * step;
  u.z += ((tz - u.z) / d) * step;
  u.facing = Math.atan2(tx - u.x, tz - u.z);
  return true;
}

// Where should this worker stand to do its task?
function workSpot(world, u) {
  const t = u.task;
  if (!t) return null;
  if (t.type === 'construct') {
    const b = world.entities.get(t.buildingId);
    if (!b || b.progress >= 1) return null;
    const { x, z } = b;
    return { x, z, key: `b${b.id}`, arrive: 1.25 };
  }
  if (t.type !== 'gather') return null;
  const tg = t.target;
  if (tg.type === 'forest') {
    let tile = world.tileAt(tg.col, tg.row);
    if (!tile || !(tile.wood > 0)) {
      const next = nearestForest(world, tg.col, tg.row, 6);
      if (!next) return null;
      t.target = { type: 'forest', col: next.col, row: next.row };
      tile = next;
    }
    const { x, z } = tileToWorld(t.target.col, t.target.row);
    return { x, z, key: `f${t.target.col},${t.target.row}`, arrive: 0.75 };
  }
  if (tg.type === 'fish') {
    const node = world.fishNodes.find(n => n.col === tg.col && n.row === tg.row);
    if (!node) return null;
    // stand on the nearest land neighbor
    const shore = neighbors(tg.col, tg.row)
      .filter(([c, r]) => world.walkable(c, r))
      .map(([c, r]) => tileToWorld(c, r))
      .sort((a, b) => dist(u.x, u.z, a.x, a.z) - dist(u.x, u.z, b.x, b.z))[0];
    if (!shore) return null;
    return { x: shore.x, z: shore.z, key: `s${tg.col},${tg.row}`, arrive: 0.8 };
  }
  if (tg.type === 'slot') {
    const b = world.entities.get(tg.buildingId);
    if (!b || b.progress < 1 || !b.slots) return null;
    return { x: b.x, z: b.z, key: `w${b.id}`, arrive: 1.1 };
  }
  return null;
}

export function nearestForest(world, col, row, maxR = 6) {
  let best = null, bestD = Infinity;
  for (const t of world.tiles) {
    if (t.terrain !== 'forest' || !(t.wood > 0)) continue;
    const d = hexDistance(col, row, t.col, t.row);
    if (d < bestD && d <= maxR) { best = t; bestD = d; }
  }
  return best;
}

function doWork(world, u, dt) {
  const t = u.task;
  const p = world.players[u.owner];
  const f = FACTIONS[u.owner];
  if (!t) { u.state = 'idle'; return; }
  u.anim = 'work';
  u.workT = (u.workT ?? 0) + dt;

  if (t.type === 'construct') {
    const b = world.entities.get(t.buildingId);
    if (!b) { u.state = 'idle'; u.task = null; return; }
    if (b.progress >= 1) { afterBuild(world, u, b); return; }
    u.facing = Math.atan2(b.x - u.x, b.z - u.z);
    const def = BUILDINGS[b.kind];
    const rate = UNITS.worker.buildRate * (12 / Math.max(def.buildTime, 1));
    b.progress = Math.min(1, b.progress + rate * dt);
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * rate * dt * 0.9);
    if (b.progress >= 1) {
      b.hp = b.maxHp;
      if (def.popCap && b.owner) world.players[b.owner].popCap += def.popCap;
      world.pushEvent({ type: 'building_complete', id: b.id, kind: b.kind, owner: b.owner, col: b.col, row: b.row });
      afterBuild(world, u, b);
    }
    return;
  }

  const tg = t.target;
  if (tg.type === 'forest') {
    const tile = world.tileAt(tg.col, tg.row);
    if (!tile || !(tile.wood > 0)) { u.state = 'toWork'; return; }
    u.facing = Math.atan2(tileToWorld(tg.col, tg.row).x - u.x, tileToWorld(tg.col, tg.row).z - u.z);
    let rate = NODES.wood.rate * woodBoost(world, u.owner);
    const got = Math.min(rate * dt, tile.wood);
    tile.wood -= got;
    p.res.wood += got;
    if (tile.wood <= 0) {
      tile.terrain = 'grass';
      world.pushEvent({ type: 'forest_cut', col: tg.col, row: tg.row });
      u.state = 'toWork'; // find the next one
    }
  } else if (tg.type === 'fish') {
    let rate = NODES.fish.rate * (f?.bonus.fishRate ?? 1);
    p.res.food += rate * dt;
  } else if (tg.type === 'slot') {
    const b = world.entities.get(tg.buildingId);
    if (!b || b.progress < 1) { u.state = 'idle'; u.task = null; return; }
    const def = BUILDINGS[b.kind];
    if (!b.slots.includes(u.id)) {
      if (b.slots.length >= def.slots) { u.state = 'idle'; u.task = null; return; }
      b.slots.push(u.id);
    }
    u.facing = Math.atan2(b.x - u.x, b.z - u.z);
    for (const [k, v] of Object.entries(def.slotRate)) {
      let rate = v;
      if (k === 'gold' && f?.bonus.mineRate) rate *= f.bonus.mineRate;
      p.res[k] += rate * dt;
    }
  }
  // periodic feedback for the renderer
  if ((u.workT | 0) !== ((u.workT - dt) | 0)) {
    world.pushEvent({ type: 'work_pulse', id: u.id, x: u.x, z: u.z, task: tg?.type ?? t.type });
  }
}

function afterBuild(world, u, b) {
  // look for another construction site nearby, else idle
  for (const e of world.entities.values()) {
    if (e.type === 'building' && e.owner === u.owner && e.progress < 1 &&
        hexDistance(worldToTile(u.x, u.z).col, worldToTile(u.x, u.z).row, e.col, e.row) <= 5) {
      u.task = { type: 'construct', buildingId: e.id };
      u.state = 'toWork';
      u.path = null; u.pathGoal = null;
      return;
    }
  }
  u.state = 'idle'; u.task = null;
}

function woodBoost(world, pid) {
  let camps = 0;
  for (const e of world.entities.values()) {
    if (e.type === 'building' && e.kind === 'lumbercamp' && e.owner === pid && e.progress >= 1) camps++;
  }
  return 1 + Math.min(camps, 2) * (BUILDINGS.lumbercamp.woodBoost ?? 0);
}

// gentle push-apart so units don't stack
export function separation(world, dt) {
  for (const e of world.entities.values()) {
    if (e.type !== 'unit' || e.state === 'dying') continue;
    const near = world.unitsNear(e.x, e.z, 0.55);
    for (const o of near) {
      if (o.id === e.id || o.state === 'dying') continue;
      let dx = e.x - o.x, dz = e.z - o.z;
      let d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.0001) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = 0.5; }
      if (d < 0.55) {
        const push = (0.55 - d) * 1.6 * dt;
        e.x += (dx / d) * push;
        e.z += (dz / d) * push;
      }
    }
    // never end up in the sea or inside a mountain
    const { col, row } = worldToTile(e.x, e.z);
    if (!world.walkable(col, row)) { e.x = e.px; e.z = e.pz; }
  }
}
