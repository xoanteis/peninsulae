import * as THREE from 'three';
import { cloneModel } from './assets.js';
import { FACTIONS } from '../config/factions.js';

// Feedback effects: flying bolts, dust puffs, order pings, region-flip beams.

function makePuffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,244,220,0.9)');
  g.addColorStop(0.6, 'rgba(228,208,170,0.45)');
  g.addColorStop(1, 'rgba(228,208,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class EffectsRenderer {
  constructor(scene, humanId) {
    this.scene = scene;
    this.humanId = humanId;
    this.items = [];
    this.puffTex = makePuffTexture();
    this.ringGeo = new THREE.RingGeometry(0.5, 0.62, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  add(obj, ttl, tick, dispose = null) {
    this.scene.add(obj);
    this.items.push({ obj, ttl, t: 0, tick, dispose });
  }

  puff(x, z, scale = 1, y = 0.3) {
    const mat = new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.set(x, y, z);
    s.scale.setScalar(0.5 * scale);
    this.add(s, 0.7, (it, dt) => {
      const k = it.t / it.ttl;
      s.scale.setScalar((0.5 + k * 1.6) * scale);
      mat.opacity = 1 - k;
      s.position.y = y + k * 0.5;
    }, () => mat.dispose());
  }

  ping(x, z, color = 0x7dff9a) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.set(x, 0.08, z);
    this.add(m, 0.6, (it) => {
      const k = it.t / it.ttl;
      m.scale.setScalar(1 - k * 0.7);
      mat.opacity = 1 - k;
    }, () => mat.dispose()); // ringGeo is shared, material is per-ping
  }

  bolt(x1, z1, x2, z2) {
    let arrow;
    try { arrow = cloneModel('weapon_arrow'); } catch { return; }
    arrow.scale.setScalar(1.1);
    const from = new THREE.Vector3(x1, 0.9, z1);
    const to = new THREE.Vector3(x2, 0.7, z2);
    const dur = Math.max(0.14, from.distanceTo(to) / 16);
    arrow.position.copy(from);
    arrow.lookAt(to);
    arrow.rotateX(Math.PI / 2); // arrow model points up
    this.add(arrow, dur, (it) => {
      const k = it.t / it.ttl;
      arrow.position.lerpVectors(from, to, k);
      arrow.position.y = 0.9 + Math.sin(k * Math.PI) * 0.6;
    });
  }

  beam(x, z, color) {
    const geo = new THREE.CylinderGeometry(0.55, 0.75, 9, 20, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 4.5, z);
    this.add(m, 1.6, (it) => {
      const k = it.t / it.ttl;
      mat.opacity = 0.55 * (1 - k);
      m.scale.set(1 + k * 0.7, 1, 1 + k * 0.7);
    }, () => { geo.dispose(); mat.dispose(); });
    this.puff(x, z, 2.2, 0.5);
  }

  handleEvent(ev, world) {
    switch (ev.type) {
      case 'attack':
        if (ev.ranged) this.bolt(ev.x, ev.z, ev.tx, ev.tz);
        break;
      case 'building_complete':
      case 'building_destroyed': {
        const t = ev.type === 'building_destroyed' ? 2.4 : 1.4;
        const { x, z } = world.regions ? tilePos(ev) : ev;
        this.puff(x, z, t, 0.4);
        break;
      }
      case 'unit_died':
        this.puff(ev.x, ev.z, 0.9, 0.2);
        break;
      case 'order_move':
        if (ev.owner === this.humanId) this.ping(ev.x, ev.z);
        break;
      case 'region_flipped': {
        if (ev.x != null) {
          const f = ev.owner ? FACTIONS[ev.owner] : null;
          this.beam(ev.x, ev.z, f ? f.color : 0xffffff);
        }
        break;
      }
      case 'era_advanced':
        if (ev.owner === this.humanId) {
          // golden wash over the player's capital
          const p = world.players[ev.owner];
          const cap = world.entities.get(p.capitalId);
          if (cap) this.beam(cap.x, cap.z, 0xffd76a);
        }
        break;
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      it.tick?.(it, dt);
      if (it.t >= it.ttl) {
        this.scene.remove(it.obj);
        it.dispose?.();
        this.items.splice(i, 1);
      }
    }
  }
}

function tilePos(ev) {
  // building events carry col/row
  const COL = 2.0, ROW = 1.7320508;
  return { x: ev.col * COL + (ev.row & 1 ? 1 : 0), z: ev.row * ROW };
}
