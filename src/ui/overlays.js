// DOM overlays that track world positions: health bars, construction progress,
// floating resource/damage text. Crisp, cheap, pooled.

import { FACTIONS } from '../config/factions.js';

const BAR_POOL = 72;
const FLOAT_POOL = 40;

export class Overlays {
  constructor(hud, camera, canvas, world, humanId) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.humanId = humanId;
    this.root = document.createElement('div');
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:12;overflow:hidden;';
    hud.appendChild(this.root);

    this.bars = [];
    for (let i = 0; i < BAR_POOL; i++) {
      const el = document.createElement('div');
      el.className = 'hpbar';
      el.innerHTML = '<div class="hpfill"></div>';
      el.style.display = 'none';
      this.root.appendChild(el);
      this.bars.push(el);
    }
    this.floats = [];
    for (let i = 0; i < FLOAT_POOL; i++) {
      const el = document.createElement('div');
      el.className = 'floater';
      el.style.display = 'none';
      this.root.appendChild(el);
      this.floats.push({ el, t: 0, ttl: 0 });
    }
    this._v = { x: 0, y: 0 };

    // one quiet name-plate per region, anchored at its village, tinted by owner
    this.regionLabels = Object.values(world.regions).map(region => {
      const el = document.createElement('div');
      el.className = 'region-label';
      el.textContent = region.meta.name;
      this.root.appendChild(el);
      return { el, region, owner: undefined };
    });
  }

  project(x, y, z) {
    // manual projection to avoid importing three here
    const cam = this.camera;
    const e = cam.matrixWorldInverse.elements, p = cam.projectionMatrix.elements;
    // world -> view
    const vx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const vy = e[1] * x + e[5] * y + e[9] * z + e[13];
    const vz = e[2] * x + e[6] * y + e[10] * z + e[14];
    // view -> clip
    const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12];
    const cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13];
    const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
    if (cw <= 0) return null;
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (cx / cw + 1) / 2 * r.width + r.left,
      y: (-cy / cw + 1) / 2 * r.height + r.top,
    };
  }

  float(text, x, y, z, color = '#ffe9b0') {
    const f = this.floats.find(f => f.ttl <= 0);
    if (!f) return;
    f.ttl = 1.15; f.t = 0;
    f.wx = x; f.wy = y; f.wz = z;
    f.el.textContent = text;
    f.el.style.color = color;
    f.el.style.display = 'block';
  }

  handleEvent(ev, world) {
    switch (ev.type) {
      case 'work_pulse': {
        const u = world.entities.get(ev.id);
        if (!u || u.owner !== this.humanId) break;
        const labels = { forest: '+wood', fish: '+food', slot: '+', construct: '🔨' };
        if (ev.task === 'slot') break; // building bar shows it
        if (Math.random() < 0.4) this.float(labels[ev.task] ?? '+', ev.x, 1.4, ev.z, '#d9f2b8');
        break;
      }
      case 'damage':
        if (Math.random() < 0.5) this.float(`-${Math.round(ev.amount)}`, ev.x, 1.5, ev.z, '#ff9c8a');
        break;
      case 'region_flipped': {
        if (ev.x != null) {
          const f = ev.owner ? FACTIONS[ev.owner] : null;
          this.float(f ? `${f.name} claim ${world.regions[ev.region].meta.name}` : 'Region lost', ev.x, 3.2, ev.z, '#ffe9b0');
        }
        break;
      }
    }
  }

  update(dt, selection) {
    // region name-plates: readable from the air, ghosts up close
    const cp = this.camera.position;
    for (const L of this.regionLabels) {
      const { x, z } = L.region.center;
      const s = this.project(x, 1.2, z);
      if (!s || s.x < -40 || s.y < -20 || s.x > window.innerWidth + 40 || s.y > window.innerHeight + 20) {
        L.el.style.display = 'none';
        continue;
      }
      const d = Math.hypot(cp.x - x, cp.y, cp.z - z);
      const alpha = Math.min(0.85, Math.max(0.12, (d - 14) / 26));
      L.el.style.display = 'block';
      L.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%,-50%)`;
      L.el.style.opacity = alpha;
      if (L.owner !== L.region.owner) { // repaint only on flips
        L.owner = L.region.owner;
        const f = L.owner ? FACTIONS[L.owner] : null;
        L.el.style.color = f ? `#${f.color.toString(16).padStart(6, '0')}` : '#cfc7b8';
        L.el.classList.toggle('owned', !!f);
      }
    }

    // floats
    for (const f of this.floats) {
      if (f.ttl <= 0) continue;
      f.ttl -= dt; f.t += dt;
      if (f.ttl <= 0) { f.el.style.display = 'none'; continue; }
      const s = this.project(f.wx, f.wy + f.t * 0.9, f.wz);
      if (!s) { f.el.style.display = 'none'; continue; }
      f.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%,-100%)`;
      f.el.style.opacity = Math.min(1, f.ttl / 0.4);
    }

    // bars: units/buildings that are damaged, working, training or selected
    let i = 0;
    const world = this.world;
    for (const e of world.entities.values()) {
      if (i >= this.bars.length) break;
      let frac = null, color = null;
      const selected = selection.has(e.id);
      if (e.type === 'unit') {
        if (e.state === 'dying') continue;
        if (e.hp < e.maxHp || selected) { frac = e.hp / e.maxHp; }
      } else {
        if (e.progress < 1) { frac = e.progress; color = '#6fb7ff'; }
        else if (e.hp < e.maxHp || selected) frac = e.hp / e.maxHp;
        else if (e.trainQueue?.length) { frac = e.trainQueue[0].t / e.trainQueue[0].time; color = '#c9a2ff'; }
      }
      if (frac == null) continue;
      const h = e.type === 'building' ? 3.6 : 1.35;
      const s = this.project(e.x, h, e.z);
      if (!s) continue;
      const el = this.bars[i++];
      el.style.display = 'block';
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%,-100%)`;
      el.style.width = e.type === 'building' ? '44px' : '30px';
      const fill = el.firstChild;
      fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
      if (color) fill.style.background = color;
      else {
        const own = e.owner === this.humanId;
        fill.style.background = own ? '#7ee787' : (e.owner ? '#ff7b6b' : '#cccccc');
      }
    }
    for (; i < this.bars.length; i++) this.bars[i].style.display = 'none';
  }
}
