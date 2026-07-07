import * as THREE from 'three';
import { worldToTile } from '../sim/hex.js';

// Player interaction, trackpad-first:
//   click: select own unit/building · drag: box-select units
//   two-finger tap (contextmenu / right-click): contextual order
//   Esc: deselect
// Picking is screen-space (project sim positions), no mesh raycasts needed.

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class Controls {
  constructor({ canvas, camera, world, humanId, selection, rig, onOrder, onSelect }) {
    this.canvas = canvas;
    this.camera = camera;
    this.world = world;
    this.humanId = humanId;
    this.selection = selection;
    this.rig = rig;
    this.onOrder = onOrder ?? (() => {});
    this.onSelect = onSelect ?? (() => {});
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.drag = null;
    this.rdrag = null;          // right-button camera drag (C&C style)
    this.placing = null;        // building kind being placed (set by HUD)
    this.hoverTile = null;
    this.amove = false;         // attack-move armed (A key)
    this.groups = {};           // control groups 1-9
    this._groupTap = { code: null, t: 0 };
    this._lastClick = { t: 0, id: null };

    this.box = document.createElement('div');
    this.box.style.cssText = 'position:fixed;border:1.5px solid #ffd76a;background:rgba(255,215,106,0.12);pointer-events:none;display:none;z-index:20;';
    document.body.appendChild(this.box);

    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.onKey(e));
  }

  myUnitIds({ militaryOnly = false } = {}) {
    return [...this.selection].filter(id => {
      const u = this.world.entities.get(id);
      return u?.type === 'unit' && u.owner === this.humanId && u.state !== 'dying'
        && (!militaryOnly || u.kind !== 'worker');
    });
  }

  onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Escape') {
      if (this.amove) { this.amove = false; this.canvas.style.cursor = ''; return; }
      if (this.placing) this.setPlacing(null);
      else { this.selection.clear(); this.onSelect(); }
      return;
    }
    // control groups: Ctrl+1..9 assign, 1..9 recall, double-tap centers
    const m = e.code.match(/^Digit([1-9])$/);
    if (m) {
      e.preventDefault();
      const n = m[1];
      if (e.ctrlKey || e.metaKey) {
        this.groups[n] = this.myUnitIds();
        this.onOrder({ type: 'ui', sound: 'blip' });
      } else {
        const alive = (this.groups[n] ?? []).filter(id => {
          const u = this.world.entities.get(id);
          return u && u.state !== 'dying';
        });
        this.groups[n] = alive;
        if (alive.length) {
          this.selection.clear();
          for (const id of alive) this.selection.add(id);
          this.onSelect();
          const now = performance.now();
          if (this._groupTap.code === n && now - this._groupTap.t < 450) this.centerOnSelection();
          this._groupTap = { code: n, t: now };
        }
      }
      return;
    }
    switch (e.code) {
      case 'KeyF': { // attack-move ("fight-move"; A stays camera-pan like WASD)
        const ids = this.myUnitIds({ militaryOnly: true });
        if (ids.length) { this.amove = true; this.canvas.style.cursor = 'crosshair'; }
        break;
      }
      case 'KeyS': {
        const ids = this.myUnitIds();
        if (ids.length) { this.onOrder({ type: 'stop', ids }); }
        break;
      }
      case 'KeyE': { // select every soldier on screen
        this.selection.clear();
        for (const u of this.world.entities.values()) {
          if (u.type !== 'unit' || u.owner !== this.humanId || u.kind === 'worker' || u.state === 'dying') continue;
          const s = this.project(u.x, u.z);
          if (!s.behind && s.x >= 0 && s.y >= 0 && s.x <= window.innerWidth && s.y <= window.innerHeight) {
            this.selection.add(u.id);
          }
        }
        this.onSelect();
        break;
      }
    }
  }

  centerOnSelection() {
    const ids = [...this.selection];
    let x = 0, z = 0, n = 0;
    for (const id of ids) {
      const u = this.world.entities.get(id);
      if (u) { x += u.x; z += u.z; n++; }
    }
    if (n) this.rig?.jumpTo(x / n, z / n);
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
    if (e.pointerType === 'touch') return; // TouchControls owns touch
    if (e.button === 2) {
      // right button: quick click = order, drag = pan camera (C&C style)
      this.rdrag = { x: e.clientX, y: e.clientY, panned: false };
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      return;
    }
    if (e.button !== 0) return;
    if (this.placing) return; // click-to-place handled on up
    this.drag = { x0: e.clientX, y0: e.clientY, active: false };
  }

  onMove(e) {
    if (e.pointerType === 'touch') return;
    if (this.rdrag) {
      const dx = e.clientX - this.rdrag.x, dy = e.clientY - this.rdrag.y;
      if (this.rdrag.panned || dx * dx + dy * dy > 25) {
        this.rdrag.panned = true;
        const s = (this.rig?.dist ?? 30) * 0.0021;
        this.rig?.panScreen(-dx * s, -dy * s); // grab the ground
        this.rdrag.x = e.clientX; this.rdrag.y = e.clientY;
      }
      return;
    }
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

  placeAt(cx, cy, keepPlacing) {
    const p = this.screenToGround(cx, cy);
    if (p) {
      const { col, row } = worldToTile(p.x, p.z);
      this.onOrder({ type: 'place', kind: this.placing, col, row });
    }
    if (!keepPlacing) this.setPlacing(null);
  }

  onUp(e) {
    if (e.pointerType === 'touch') return;
    if (e.button === 2) {
      const wasPan = this.rdrag?.panned;
      this.rdrag = null;
      if (!wasPan) {
        if (this.amove) this.issueAmove(e.clientX, e.clientY);
        else if (this.suppressContextUntil && performance.now() < this.suppressContextUntil) { /* touch */ }
        else this.contextOrder(e.clientX, e.clientY);
      }
      return;
    }
    if (e.button !== 0) return;
    if (this.amove) {
      this.issueAmove(e.clientX, e.clientY);
      return;
    }
    if (this.placing) {
      this.placeAt(e.clientX, e.clientY, e.shiftKey);
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

    // double-click a unit: select all of its kind on screen (C&C style)
    const now = performance.now();
    const hit = this.pickEntity(e.clientX, e.clientY);
    if (hit && hit.type === 'unit' && hit.owner === this.humanId &&
        this._lastClick.id === hit.id && now - this._lastClick.t < 550) {
      this._lastClick = { t: 0, id: null };
      this.selectAllOfKind(hit.kind);
      return;
    }
    this._lastClick = { t: now, id: hit?.id ?? null };

    // plain click: select
    this.tapSelect(e.clientX, e.clientY, e.shiftKey);
  }

  selectAllOfKind(kind) {
    this.selection.clear();
    for (const u of this.world.entities.values()) {
      if (u.type !== 'unit' || u.owner !== this.humanId || u.kind !== kind || u.state === 'dying') continue;
      const s = this.project(u.x, u.z);
      if (!s.behind && s.x >= 0 && s.y >= 0 && s.x <= window.innerWidth && s.y <= window.innerHeight) {
        this.selection.add(u.id);
      }
    }
    this.onSelect();
  }

  issueAmove(cx, cy) {
    this.amove = false;
    this.canvas.style.cursor = '';
    const ids = this.myUnitIds({ militaryOnly: true });
    const p = this.screenToGround(cx, cy);
    if (ids.length && p) this.onOrder({ type: 'amove', ids, x: p.x, z: p.z });
  }

  // select own entities for control, anything else for info
  tapSelect(cx, cy, shift) {
    const hit = this.pickEntity(cx, cy);
    if (!shift) this.selection.clear();
    let regionKey = null;
    if (hit) {
      this.selection.add(hit.id);
    } else {
      const p = this.screenToGround(cx, cy);
      if (p) {
        const { col, row } = worldToTile(p.x, p.z);
        regionKey = this.world.tileAt(col, row)?.region ?? null;
      }
    }
    this.onSelect(hit, regionKey);
  }

  // contextual order for the current selection (right-click / long-press)
  contextOrder(clientX, clientY) {
    const e = { clientX, clientY };
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
      if (b.hp < b.maxHp && ids.some(id => this.world.entities.get(id)?.kind === 'worker')) {
        this.onOrder({ type: 'repair', ids, buildingId: b.id });
        return;
      }
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
    // workers sent at the sierra: it can't be gathered — teach the mine instead
    if (tile && tile.terrain === 'mountain'
      && ids.some(id => this.world.entities.get(id)?.kind === 'worker')) {
      this.onOrder({ type: 'hint', message: 'The sierra can\'t be gathered — build a ⛏ Mine on a tile beside a mountain to dig its gold' });
      return;
    }
    this.onOrder({ type: 'move', ids, x: p.x, z: p.z });
  }
}
