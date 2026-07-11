// The minimap: static terrain base, region-ownership tint, unit dots, the
// camera's real ground footprint, and alert pings. Click/drag jumps the camera.

import { FACTIONS, cssColor } from '../config/factions.js';
import { MAP_W, MAP_H } from '../config/map.js';
import { tileToWorld } from '../sim/hex.js';

export class Minimap {
  constructor({ canvas, world, rig, controls }) {
    this.canvas = canvas;
    this.world = world;
    this.rig = rig;
    this.controls = controls; // screenToGround for the viewport rectangle
    this.base = this.renderBase();
    canvas.addEventListener('pointerdown', e => this.jump(e));
    canvas.addEventListener('pointermove', e => { if (e.buttons & 1) this.jump(e); });
  }

  renderBase() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#27506e';
    ctx.fillRect(0, 0, c.width, c.height);
    const { sx, sy } = this.scale();
    const px = Math.max(2.4, sx * 2.3);
    for (const t of this.world.tiles) {
      if (t.terrain === 'sea') continue;
      const { x, z } = tileToWorld(t.col, t.row);
      ctx.fillStyle = { grass: '#8ea44c', forest: '#4e7a34', hills: '#a3a465', mountain: '#8d8d88' }[t.terrain];
      ctx.fillRect(x * sx - px / 2, z * sy - px / 2, px, px);
    }
    return c;
  }

  scale() {
    const w = tileToWorld(MAP_W - 1, MAP_H - 1);
    return { sx: this.canvas.width / (w.x + 2), sy: this.canvas.height / (w.z + 2) };
  }

  jump(e) {
    const r = this.canvas.getBoundingClientRect();
    const { sx, sy } = this.scale();
    this.rig.jumpTo((e.clientX - r.left) / r.width * this.canvas.width / sx,
      (e.clientY - r.top) / r.height * this.canvas.height / sy);
  }

  ping(x, z) {
    this.pingAt = { x, z, t: 3 };
  }

  draw(dt) {
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.base, 0, 0);
    const { sx, sy } = this.scale();
    // region ownership tint
    const px = Math.max(2.4, sx * 2.3);
    for (const region of Object.values(this.world.regions)) {
      if (!region.owner) continue;
      ctx.fillStyle = `${cssColor(FACTIONS[region.owner].color)}55`;
      for (const t of region.tiles) {
        const { x, z } = tileToWorld(t.col, t.row);
        ctx.fillRect(x * sx - px / 2, z * sy - px / 2, px, px);
      }
    }
    // units
    for (const e of this.world.entities.values()) {
      if (e.type !== 'unit' || e.state === 'dying' || e.owner === '__dead__') continue;
      ctx.fillStyle = e.owner ? cssColor(FACTIONS[e.owner].color) : '#ddd';
      ctx.fillRect(e.x * sx - 1, e.z * sy - 1, 2.2, 2.2);
    }
    // camera viewport — real ground footprint, not a fixed rectangle
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    const tl = this.controls.screenToGround(0, 0);
    const br = this.controls.screenToGround(window.innerWidth, window.innerHeight);
    if (tl && br) {
      ctx.strokeRect(Math.min(tl.x, br.x) * sx, Math.min(tl.z, br.z) * sy,
        Math.abs(br.x - tl.x) * sx, Math.abs(br.z - tl.z) * sy);
    } else {
      const t = this.rig.target;
      ctx.strokeRect(t.x * sx - 9, t.z * sy - 7, 18, 14);
    }
    // ping
    if (this.pingAt && this.pingAt.t > 0) {
      this.pingAt.t -= dt;
      const k = 1 - (this.pingAt.t % 0.8) / 0.8;
      ctx.strokeStyle = `rgba(255,80,60,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.pingAt.x * sx, this.pingAt.z * sy, 3 + k * 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
