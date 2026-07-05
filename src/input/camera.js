import * as THREE from 'three';

// Trackpad-first RTS camera rig.
//  two-finger scroll -> pan          pinch (ctrlKey wheel) -> zoom
//  mouse wheel (coarse deltas) -> zoom          WASD / arrows -> pan
//  Q / E -> rotate       middle-drag -> pan
// Camera sits south of its target looking north, pitch flattens as you zoom in.

const MIN_DIST = 9, MAX_DIST = 82;

export class CameraRig {
  constructor(camera, bounds) {
    this.camera = camera;
    this.bounds = bounds; // {minX, maxX, minZ, maxZ}
    this.target = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    this.goalTarget = this.target.clone();
    this.dist = 40; this.goalDist = 40;
    this.yaw = 0; this.goalYaw = 0;
    this.keys = new Set();
    this.shake = 0;
    this._middleDrag = null;
    this.enabled = true;
  }

  attach(dom) {
    dom.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if (e.code === 'Equal' || e.code === 'NumpadAdd') this.zoomBy(0.82);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.zoomBy(1.22);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('pointerdown', e => {
      if (e.button === 1) {
        e.preventDefault();
        this._middleDrag = { x: e.clientX, y: e.clientY };
        dom.setPointerCapture(e.pointerId);
      }
    });
    dom.addEventListener('pointermove', e => {
      if (this._middleDrag) {
        const scale = this.dist * 0.0016;
        this.panScreen((this._middleDrag.x - e.clientX) * scale, (this._middleDrag.y - e.clientY) * scale);
        this._middleDrag = { x: e.clientX, y: e.clientY };
      }
    });
    dom.addEventListener('pointerup', e => { if (e.button === 1) this._middleDrag = null; });
  }

  onWheel(e) {
    e.preventDefault();
    if (!this.enabled) return;
    if (e.ctrlKey) {
      // trackpad pinch (and ctrl+wheel)
      this.zoomBy(Math.exp(e.deltaY * 0.012));
    } else if (e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 60 && Number.isInteger(e.deltaY))) {
      // coarse steps: a real mouse wheel -> zoom
      this.zoomBy(Math.exp(Math.sign(e.deltaY) * 0.16));
    } else {
      // fine two-finger trackpad scroll -> pan
      const scale = this.dist * 0.0021;
      this.panScreen(e.deltaX * scale, e.deltaY * scale);
    }
  }

  zoomBy(f) {
    this.goalDist = THREE.MathUtils.clamp(this.goalDist * f, MIN_DIST, MAX_DIST);
  }

  // pan in screen space (x right, y down) mapped onto the ground plane
  panScreen(dx, dy) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    this.goalTarget.x += dx * cy - dy * sy;
    this.goalTarget.z += dx * sy + dy * cy;
    this.clampTarget();
  }

  clampTarget() {
    const b = this.bounds;
    this.goalTarget.x = THREE.MathUtils.clamp(this.goalTarget.x, b.minX, b.maxX);
    this.goalTarget.z = THREE.MathUtils.clamp(this.goalTarget.z, b.minZ, b.maxZ);
  }

  jumpTo(x, z) {
    this.goalTarget.x = x; this.goalTarget.z = z;
    this.clampTarget();
  }

  addShake(amount) { this.shake = Math.min(1, this.shake + amount); }

  update(dt) {
    // keyboard pan
    const sp = this.dist * 0.9 * dt;
    let dx = 0, dy = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= sp;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += sp;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= sp;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += sp;
    if (dx || dy) this.panScreen(dx, dy);
    if (this.keys.has('KeyQ')) this.goalYaw += 1.4 * dt;
    if (this.keys.has('KeyE')) this.goalYaw -= 1.4 * dt;

    // smooth follow
    const k = 1 - Math.exp(-9 * dt);
    this.target.lerp(this.goalTarget, k);
    this.dist += (this.goalDist - this.dist) * k;
    this.yaw += (this.goalYaw - this.yaw) * k;

    // pitch: strategic when far, cinematic when close
    const t = (this.dist - MIN_DIST) / (MAX_DIST - MIN_DIST);
    const pitch = THREE.MathUtils.lerp(0.78, 1.08, t); // radians above horizon

    const horiz = Math.cos(pitch) * this.dist;
    const y = Math.sin(pitch) * this.dist;
    const cx = this.target.x + Math.sin(this.yaw) * horiz;
    const cz = this.target.z + Math.cos(this.yaw) * horiz;
    this.camera.position.set(cx, y, cz);
    this.camera.lookAt(this.target.x, 0, this.target.z);

    if (this.shake > 0.001) {
      const s = this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.6;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shake *= Math.exp(-6 * dt);
    } else this.shake = 0;
  }
}
