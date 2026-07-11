// World -> screen projection straight from the camera's matrices. Plain math,
// no three.js import, so DOM-layer modules (overlays, controls picking) share
// one implementation without pulling in the renderer lib.
// Returns null when the point is on or behind the camera plane.
export function worldToScreen(camera, canvas, x, y, z) {
  const e = camera.matrixWorldInverse.elements, p = camera.projectionMatrix.elements;
  // world -> view
  const vx = e[0] * x + e[4] * y + e[8] * z + e[12];
  const vy = e[1] * x + e[5] * y + e[9] * z + e[13];
  const vz = e[2] * x + e[6] * y + e[10] * z + e[14];
  // view -> clip
  const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12];
  const cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13];
  const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
  if (cw <= 0) return null;
  const r = canvas.getBoundingClientRect();
  return {
    x: (cx / cw + 1) / 2 * r.width + r.left,
    y: (-cy / cw + 1) / 2 * r.height + r.top,
  };
}
