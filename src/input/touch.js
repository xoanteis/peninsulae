// Touch controls for phones/tablets:
//   one-finger drag: pan · pinch: zoom · tap: select/place · long-press: order
// Mouse/trackpad handlers in Controls ignore touch pointers; we own them here.

const TAP_MS = 320, TAP_PX = 12, HOLD_MS = 480;

export class TouchControls {
  constructor({ canvas, rig, controls }) {
    this.rig = rig;
    this.controls = controls;
    this.pointers = new Map();
    this.mode = null; // 'tap' | 'pan' | 'pinch' | 'held'
    this.holdTimer = null;

    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer */ }
      controls.suppressContextUntil = performance.now() + 900;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      if (this.pointers.size === 1) {
        this.mode = 'tap';
        this.holdTimer = setTimeout(() => {
          if (this.mode !== 'tap') return;
          this.mode = 'held';
          const p = [...this.pointers.values()][0];
          navigator.vibrate?.(25);
          controls.contextOrder(p.x, p.y); // long-press = right-click order
        }, HOLD_MS);
      } else if (this.pointers.size === 2) {
        clearTimeout(this.holdTimer);
        this.mode = 'pinch';
        this.pinchBase = this.pinchState();
      }
    });

    canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch') return;
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;

      if (this.mode === 'tap' && Math.hypot(p.x - p.x0, p.y - p.y0) > TAP_PX) {
        clearTimeout(this.holdTimer);
        this.mode = 'pan';
      }
      if (this.mode === 'pan') {
        const s = this.rig.dist * 0.0021;
        this.rig.panScreen(-dx * s, -dy * s); // world follows the finger
      } else if (this.mode === 'pinch' && this.pointers.size >= 2) {
        const cur = this.pinchState();
        if (this.pinchBase.d > 0 && cur.d > 0) {
          this.rig.zoomBy(this.pinchBase.d / cur.d);
          const s = this.rig.dist * 0.0021;
          this.rig.panScreen(-(cur.cx - this.pinchBase.cx) * s, -(cur.cy - this.pinchBase.cy) * s);
        }
        this.pinchBase = cur;
      }
    });

    const end = e => {
      if (e.pointerType !== 'touch') return;
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      clearTimeout(this.holdTimer);
      if (this.mode === 'tap' && p && performance.now() - p.t0 <= TAP_MS + HOLD_MS) {
        if (this.controls.placing) this.controls.placeAt(p.x, p.y, false);
        else if (this.controls.amove) { // armed via touch bar
          this.controls.issueAmove(p.x, p.y);
          document.getElementById('tb-amove')?.classList.remove('active');
        }
        else this.controls.tapSelect(p.x, p.y, false);
      }
      if (this.pointers.size === 1 && this.mode === 'pinch') {
        this.mode = 'pan';
        const rest = [...this.pointers.values()][0];
        rest.x0 = rest.x; rest.y0 = rest.y;
      } else if (this.pointers.size === 0) {
        this.mode = null;
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
}
