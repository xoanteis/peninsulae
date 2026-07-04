import * as THREE from 'three';
import { worldToTile } from '../sim/hex.js';

// Player interaction, trackpad-first:
//   click: select own unit/building · drag: box-select units
//   two-finger tap (contextmenu / right-click): contextual order
//   Esc: deselect
// Picking is screen-space (project sim positions), no mesh raycasts needed.

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class Controls {
  constructor({ canvas, camera, world, humanId, selection, onOrder, onSelect }) {
    this.canvas = canvas;
    this.camera = camera;
    this.world = world;
    this.humanId = humanId;
    this.selection = selection;
    this.onOrder = onOrder ?? (() => {});
    this.onSelect = onSelect ?? (() => {});
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.drag = null;
    this.placing = null; // building kind being placed (set by HUD)
    this.hoverTile = null;

    this.box = document.createElement('div');
    this.box.style.cssText = 'position:fixed;border:1.5px solid #ffd76a;background:rgba(255,215,106,0.12);pointer-events:none;display:none;z-index:20;';
    document.body.appendChild(this.box);

    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); this.onContext(e); });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if (this.placing) this.setPlacing(null);
        else { this.selection.clear(); this.onSelect(); }
      }
    });
  }

  setPlacing(kind) {
    this.placing = kind;
    this.canvas.style.cursor = kind ? 'copy' : '';
  }

  screenToGround(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(GROUND, p) ? p : null;
  }

  project(x, z) {
    const v = new THREE.Vector3(x, 0.5, z).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * r.width + r.left, y: (-v.y + 1) / 2 * r.height + r.top, behind: v.z > 1 };
  }

  pickEntity(cx, cy, { maxPx = 26 } = {}) {
    // units win ties over buildings; buildings get a larger catch radius
    let best = null, bestScore = Infinity;
    for (const e of this.world.entities.values()) {
      if (e.type === 'unit' && e.state === 'dying') continue;
      const s = this.project(e.x, e.z);
      if (s.behind) continue;
      const isB = e.type === 'building';
      const d = Math.hypot(s.x - cx, s.y - cy - (isB ? 18 : 6));
      if (d > (isB ? maxPx + 20 : maxPx)) continue;
      const score = isB ? d + 14 : d; // units take precedence
      if (score < bestScore) { best = e; bestScore = score; }
    }
    return best;
  }

  onDown(e) {
    if (e.button !== 0) return;
    if (this.placing) return; // click-to-place handled on up
    this.drag = { x0: e.clientX, y0: e.clientY, active: false };
  }

  onMove(e) {
    if (this.placing) {
      const p = this.screenToGround(e.clientX, e.clientY);
      this.hoverTile = p ? worldToTile(p.x, p.z) : null;
      return;
    }
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x0, dy = e.clientY - this.drag.y0;
    if (!this.drag.active && dx * dx + dy * dy > 36) this.drag.active = true;
    if (this.drag.active) {
      const x = Math.min(e.clientX, this.drag.x0), y = Math.min(e.clientY, this.drag.y0);
      Object.assign(this.box.style, {
        display: 'block', left: `${x}px`, top: `${y}px`,
        width: `${Math.abs(dx)}px`, height: `${Math.abs(dy)}px`,
      });
    }
  }

  onUp(e) {
    if (e.button !== 0) return;
    if (this.placing) {
      const p = this.screenToGround(e.clientX, e.clientY);
      if (p) {
        const { col, row } = worldToTile(p.x, p.z);
        this.onOrder({ type: 'place', kind: this.placing, col, row });
      }
      if (!e.shiftKey) this.setPlacing(null);
      return;
    }
    const drag = this.drag;
    this.drag = null;
    this.box.style.display = 'none';

    if (drag?.active) {
      // box select own units
      const x1 = Math.min(drag.x0, e.clientX), x2 = Math.max(drag.x0, e.clientX);
      const y1 = Math.min(drag.y0, e.clientY), y2 = Math.max(drag.y0, e.clientY);
      if (!e.shiftKey) this.selection.clear();
      for (const u of this.world.entities.values()) {
        if (u.type !== 'unit' || u.owner !== this.humanId || u.state === 'dying') continue;
        const s = this.project(u.x, u.z);
        if (!s.behind && s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2) this.selection.add(u.id);
      }
      this.onSelect();
      return;
    }

    // plain click: select
    const hit = this.pickEntity(e.clientX, e.clientY);
    if (!e.shiftKey) this.selection.clear();
    if (hit && hit.owner === this.humanId) {
      if (hit.type === 'unit') this.selection.add(hit.id);
      else this.selection.add(hit.id); // buildings selectable too
    }
    this.onSelect(hit);
  }

  onContext(e) {
    // two-finger tap: contextual order for current selection
    const ids = [...this.selection].filter(id => {
      const ent = this.world.entities.get(id);
      return ent?.type === 'unit';
    });
    const p = this.screenToGround(e.clientX, e.clientY);
    if (!p) return;
    const hit = this.pickEntity(e.clientX, e.clientY, { maxPx: 22 });
    const { col, row } = worldToTile(p.x, p.z);
    const tile = this.world.tileAt(col, row);

    if (!ids.length) {
      // no units: maybe set rally for selected building
      const bId = [...this.selection].find(id => this.world.entities.get(id)?.type === 'building');
      const b = bId && this.world.entities.get(bId);
      if (b && b.owner === this.humanId) {
        b.rally = { x: p.x, z: p.z };
        this.onOrder({ type: 'rally', x: p.x, z: p.z });
      }
      return;
    }

    if (hit && hit.owner !== this.humanId && hit.owner !== undefined && !(hit.owner === null && hit.type === 'building' && hit.kind === 'village')) {
      // enemy or neutral guard: attack
      if (hit.owner !== this.humanId) {
        this.onOrder({ type: 'attack', ids, targetId: hit.id });
        return;
      }
    }
    if (hit && hit.owner === null && hit.type === 'building') {
      this.onOrder({ type: 'attack', ids, targetId: hit.id });
      return;
    }
    if (hit && hit.owner === this.humanId && hit.type === 'building') {
      const b = hit;
      if (b.progress < 1) { this.onOrder({ type: 'build', ids, buildingId: b.id }); return; }
      if (b.slots) { this.onOrder({ type: 'workslot', ids, buildingId: b.id }); return; }
    }
    if (tile && tile.terrain === 'forest' && tile.wood > 0) {
      this.onOrder({ type: 'gather', ids, target: { type: 'forest', col, row } });
      return;
    }
    const fish = this.world.fishNodes.find(n => n.col === col && n.row === row);
    if (fish) {
      this.onOrder({ type: 'gather', ids, target: { type: 'fish', col, row } });
      return;
    }
    this.onOrder({ type: 'move', ids, x: p.x, z: p.z });
  }
}
