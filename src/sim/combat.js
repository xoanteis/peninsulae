// Combat: swings, damage, deaths, tower fire, auto-acquire.

import { UNITS, BUILDINGS } from '../config/rules.js';

// melee engagement geometry: how far from a target's center an attacker can
// stand. The fighting<->toFight handshake in units.js reads the SAME radius —
// if the two ever diverge, units oscillate between the states.
export const bodyRadius = t => t.type === 'building' ? 0.95 : 0.3;

export function acquireTarget(world, u) {
  const stats = UNITS[u.kind];
  if (!stats.aggroRange) return null;
  let best = null, bestD = Infinity;
  for (const o of world.unitsNear(u.x, u.z, stats.aggroRange)) {
    if (!world.isEnemy(u.owner, o.owner) || o.state === 'dying') continue;
    if (u.owner === null && o.owner === null) continue; // militia ignore militia
    // faction soldiers don't pick fights with neutral villagers unprovoked
    if (u.owner !== null && o.owner === null) continue;
    const d = dist(u, o);
    if (d < bestD) { best = o; bestD = d; }
  }
  return best;
}

export function tryAttack(world, u, dt) {
  const t = world.entities.get(u.task?.targetId);
  if (!t || t.hp <= 0 || t.state === 'dying') {
    const resume = u.task?.resume;
    u.task = null;
    u.anim = 'idle';
    u.state = 'idle';
    if (resume && u.owner) world.orderAttackMove(u.owner, [u.id], resume.x, resume.z);
    return;
  }
  const stats = UNITS[u.kind];
  const d = dist(u, t) - bodyRadius(t);
  if (d > stats.range + 0.25) { u.state = 'toFight'; u.path = null; u.chaseGoal = null; return; }

  u.facing = Math.atan2(t.x - u.x, t.z - u.z);
  u.anim = stats.range > 2 ? 'shoot' : 'attack';
  if (u.attackCd > 0) return;

  u.attackCd = stats.attackTime;
  const p = u.owner ? world.players[u.owner] : null;
  const dmg = Math.max(1, stats.dmg + (p?.upgrades.dmg ?? 0) - targetArmor(world, t));
  // ranged: the bolt flies; melee: damage lands mid-swing. Renderer/audio sync on this event.
  world.pushEvent({
    type: 'attack', id: u.id, targetId: t.id, kind: u.kind,
    x: u.x, z: u.z, tx: t.x, tz: t.z, ranged: stats.range > 2,
  });
  dealDamage(world, t, dmg, u.owner);
}

function targetArmor(world, t) {
  if (t.type === 'building') return 1;
  const p = t.owner ? world.players[t.owner] : null;
  return (UNITS[t.kind].armor ?? 0) + (p?.upgrades.armor ?? 0);
}

function dealDamage(world, t, dmg, attackerOwner) {
  if (t.hp <= 0) return;
  t.hp -= dmg;
  t.lastHitAt = world.time;
  world.pushEvent({ type: 'damage', id: t.id, x: t.x, z: t.z, amount: dmg, targetType: t.type });

  // fight back / flee
  if (t.type === 'unit' && t.state !== 'dying') {
    if ((t.state === 'idle' || t.state === 'working' || t.state === 'toWork') && attackerOwner !== undefined) {
      if (t.kind === 'worker') {
        // workers panic toward their capital
        const p = t.owner ? world.players[t.owner] : null;
        const cap = p ? world.entities.get(p.capitalId) : null;
        if (cap) {
          world.orderMove(t.owner, [t.id], cap.x, cap.z);
        }
      } else {
        t.task = { type: 'attack', targetId: lastAttackerId(world, t, attackerOwner), auto: true };
        if (t.task.targetId) t.state = 'toFight';
        else { t.task = null; }
      }
    }
  }

  // under-attack alert for players
  if (t.owner) {
    const p = world.players[t.owner];
    if (!p.lastAlert || world.time - p.lastAlert > 12) {
      p.lastAlert = world.time;
      world.pushEvent({ type: 'under_attack', owner: t.owner, x: t.x, z: t.z });
    }
    if (attackerOwner) p.lastAttacker = attackerOwner;
  }

  if (t.hp <= 0) kill(world, t, attackerOwner);
}

function lastAttackerId(world, t, attackerOwner) {
  // find nearest enemy of that owner
  let best = null, bestD = Infinity;
  for (const o of world.unitsNear(t.x, t.z, 7)) {
    if (o.owner !== attackerOwner || o.state === 'dying') continue;
    const d = dist(t, o);
    if (d < bestD) { best = o; bestD = d; }
  }
  return best?.id ?? null;
}

function kill(world, t, attackerOwner) {
  if (t.type === 'unit') killUnit(world, t);
  else destroyBuilding(world, t, attackerOwner);
}

// THE unit death sequence — combat kills and nation dissolution share it, so any
// change to death semantics (pop refunds, event fields) lands in one place
export function killUnit(world, t) {
  t.state = 'dying';
  t.anim = 'die';
  t.dyingT = 0;
  t.hp = 0;
  if (t.owner && UNITS[t.kind]) world.players[t.owner].pop -= UNITS[t.kind].pop;
  t.owner_atDeath = t.owner;
  t.owner = '__dead__'; // stop being targetable / counted
  world.pushEvent({ type: 'unit_died', id: t.id, x: t.x, z: t.z, kind: t.kind, owner: t.owner_atDeath });
}

export function destroyBuilding(world, b, by = null) {
  world.pushEvent({ type: 'building_destroyed', id: b.id, kind: b.kind, owner: b.owner, col: b.col, row: b.row, by });
  world.removeEntity(b.id);
}

export function updateCombat(world, dt) {
  // towers fire on their own
  for (const b of world.entities.values()) {
    if (b.type !== 'building' || b.kind !== 'tower' || b.progress < 1) continue;
    const def = BUILDINGS.tower;
    if (b.attackCd > 0) { b.attackCd -= dt; continue; }
    let best = null, bestD = Infinity;
    for (const o of world.unitsNear(b.x, b.z, def.attack.range)) {
      if (!world.isEnemy(b.owner, o.owner) || o.state === 'dying') continue;
      const d = dist(b, o);
      if (d < bestD) { best = o; bestD = d; }
    }
    if (best) {
      b.attackCd = def.attack.attackTime;
      world.pushEvent({ type: 'attack', id: b.id, targetId: best.id, kind: 'tower', x: b.x, z: b.z, tx: best.x, tz: best.z, ranged: true });
      dealDamage(world, best, def.attack.dmg, b.owner);
    }
  }
}

function dist(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
