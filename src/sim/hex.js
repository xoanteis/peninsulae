// Hex grid math for odd-r offset coordinates, pointy-corner-north tiles.
// KayKit hex tile: 2.0 wide across flats (x), 2.31 across corners (z).
// World: +x east, +z south. Row spacing 1.5*R, col spacing sqrt(3)*R = 2.0.

export const HEX_R = 1.1547005; // outer radius so width across flats is exactly 2.0
export const COL_SPACING = 2.0;
export const ROW_SPACING = 1.5 * HEX_R; // 1.732...

export function tileToWorld(col, row) {
  return {
    x: col * COL_SPACING + (row & 1 ? COL_SPACING / 2 : 0),
    z: row * ROW_SPACING,
  };
}

export function worldToTile(x, z) {
  // convert via cube-coordinate rounding for robustness
  const q = (x * Math.sqrt(3) / 3 - z / 3) / HEX_R;
  const r = (z * 2 / 3) / HEX_R;
  return cubeRoundToOffset(q, r);
}

function cubeRoundToOffset(qf, rf) {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  // axial (q,r) -> odd-r offset
  return { col: q + ((r - (r & 1)) >> 1), row: r };
}

export function offsetToAxial(col, row) {
  return { q: col - ((row - (row & 1)) >> 1), r: row };
}

// neighbor offsets for odd-r: [even-row deltas, odd-row deltas]
const NEI = [
  [[+1, 0], [-1, 0], [0, -1], [-1, -1], [0, +1], [-1, +1]],
  [[+1, 0], [-1, 0], [+1, -1], [0, -1], [+1, +1], [0, +1]],
];

export function neighbors(col, row) {
  const out = [];
  for (const [dc, dr] of NEI[row & 1]) out.push([col + dc, row + dr]);
  return out;
}

export function hexDistance(c1, r1, c2, r2) {
  const a = offsetToAxial(c1, r1), b = offsetToAxial(c2, r2);
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// A* over the tile grid. passable(col,row) -> bool. Returns [[col,row],...] or null.
export function findPath(w, h, startC, startR, goalC, goalR, passable) {
  if (startC === goalC && startR === goalR) return [[startC, startR]];
  const idx = (c, r) => r * w + c;
  const open = new MinHeap();
  const gScore = new Map(), cameFrom = new Map();
  const s = idx(startC, startR);
  gScore.set(s, 0);
  open.push(hexDistance(startC, startR, goalC, goalR), s);
  const maxExpand = w * h * 4;
  let expanded = 0;
  while (open.size > 0 && expanded < maxExpand) {
    const cur = open.pop();
    expanded++;
    const cc = cur % w, cr = (cur / w) | 0;
    if (cc === goalC && cr === goalR) {
      const path = [[cc, cr]];
      let n = cur;
      while (cameFrom.has(n)) { n = cameFrom.get(n); path.push([n % w, (n / w) | 0]); }
      return path.reverse();
    }
    const g = gScore.get(cur);
    for (const [nc, nr] of neighbors(cc, cr)) {
      if (nc < 0 || nr < 0 || nc >= w || nr >= h) continue;
      if (!(nc === goalC && nr === goalR) && !passable(nc, nr)) continue;
      if (nc === goalC && nr === goalR && !passable(nc, nr)) {
        // goal itself blocked: stop adjacent instead (caller handles truncation)
      }
      const ni = idx(nc, nr);
      const ng = g + 1;
      if (ng < (gScore.get(ni) ?? Infinity)) {
        gScore.set(ni, ng);
        cameFrom.set(ni, cur);
        open.push(ng + hexDistance(nc, nr, goalC, goalR), ni);
      }
    }
  }
  return null;
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    this.k.push(key); this.v.push(val);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= this.k[i]) break;
      this.swap(p, i); i = p;
    }
  }
  pop() {
    const top = this.v[0], last = this.k.length - 1;
    this.swap(0, last); this.k.pop(); this.v.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < this.k.length && this.k[l] < this.k[m]) m = l;
      if (r < this.k.length && this.k[r] < this.k[m]) m = r;
      if (m === i) break;
      this.swap(m, i); i = m;
    }
    return top;
  }
  swap(a, b) {
    [this.k[a], this.k[b]] = [this.k[b], this.k[a]];
    [this.v[a], this.v[b]] = [this.v[b], this.v[a]];
  }
}

// deterministic per-tile random (stable decoration layouts)
export function tileRand(col, row, salt = 0) {
  let h = (col * 374761393 + row * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
