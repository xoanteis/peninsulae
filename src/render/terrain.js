import * as THREE from 'three';
import { getMergedGeometry, cloneModel } from './assets.js';
import { tileToWorld, tileRand, neighbors } from '../sim/hex.js';
import { MAP_W, MAP_H } from '../config/map.js';

const tmpMat = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const YUP = new THREE.Vector3(0, 1, 0);

function makeInstanced(modelKey, transforms, { shadow = true, material = null } = {}) {
  const { geometry, material: srcMat } = getMergedGeometry(modelKey);
  const mesh = new THREE.InstancedMesh(geometry, material || srcMat, Math.max(transforms.length, 1));
  mesh.count = transforms.length;
  let hasColor = false;
  transforms.forEach((t, i) => {
    tmpPos.set(t.x, t.y ?? 0, t.z);
    tmpQuat.setFromAxisAngle(YUP, t.rot ?? 0);
    const s = t.scale ?? 1;
    tmpScale.set(s, s, s);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    mesh.setMatrixAt(i, tmpMat);
    if (t.tint) { mesh.setColorAt(i, t.tint); hasColor = true; }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (hasColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

// Iberia's real gradient: green Atlantic north -> golden meseta -> ochre south
function grassTint(col, row) {
  const lat = row / (MAP_H - 1);
  const c = new THREE.Color();
  const north = { r: 0.72, g: 0.95, b: 0.62 };
  const mid = { r: 1.0, g: 1.0, b: 0.92 };
  const south = { r: 1.0, g: 0.9, b: 0.72 };
  const a = lat < 0.42 ? north : mid;
  const b = lat < 0.42 ? mid : south;
  const t = lat < 0.42 ? lat / 0.42 : (lat - 0.42) / 0.58;
  const n = (tileRand(col, row, 11) - 0.5) * 0.09;
  c.setRGB(a.r + (b.r - a.r) * t + n, a.g + (b.g - a.g) * t + n, a.b + (b.b - a.b) * t + n * 0.5);
  return c;
}

// hexes only look right at 60° steps
const hexRot = (col, row, salt) => (Math.floor(tileRand(col, row, salt) * 6) * Math.PI) / 3;

export function buildTerrain(scene, tiles) {
  const group = new THREE.Group();
  group.name = 'terrain';

  const t = {
    grass: [], water: [], mountains: { A: [], B: [], C: [] },
    hills: { A: [], B: [], single: [] }, rocks: { A: [], B: [], D: [] },
    forests: [], waterplants: [], lilies: [],
  };

  const landAt = (c, r) => {
    if (c < 0 || r < 0 || c >= MAP_W || r >= MAP_H) return false;
    return tiles[r * MAP_W + c].terrain !== 'sea';
  };

  // forest visual state is swappable (alive trees <-> cut stumps), so track slots
  const forestSlots = new Map(); // "col,row" -> instance index

  // skirt of extra sea hexes so the board doesn't end abruptly
  const SKIRT = 7;
  for (let r = -SKIRT; r < MAP_H + SKIRT; r++) {
    for (let c = -SKIRT; c < MAP_W + SKIRT; c++) {
      if (c >= 0 && r >= 0 && c < MAP_W && r < MAP_H) continue;
      const { x, z } = tileToWorld(c, r);
      t.water.push({ x, z, rot: hexRot(c + 40, r + 40, 1) });
    }
  }

  for (const tile of tiles) {
    const { col, row, terrain } = tile;
    const { x, z } = tileToWorld(col, row);
    const rot = hexRot(col, row, 1);
    if (terrain === 'sea') {
      t.water.push({ x, z, rot });
      const landNb = neighbors(col, row).filter(([c, r]) => landAt(c, r)).length;
      const rnd = tileRand(col, row, 7);
      if (landNb >= 2 && rnd < 0.35) {
        (rnd < 0.15 ? t.lilies : t.waterplants).push({ x: x + (rnd - 0.5), z: z + (tileRand(col, row, 8) - 0.5), rot: tileRand(col, row, 9) * Math.PI * 2 });
      }
      continue;
    }
    t.grass.push({ x, z, rot, tint: grassTint(col, row) });
    const rnd = tileRand(col, row, 2);
    if (terrain === 'mountain') {
      const pick = rnd < 0.4 ? 'A' : rnd < 0.8 ? 'B' : 'C';
      t.mountains[pick].push({ x, z, rot: hexRot(col, row, 3) });
    } else if (terrain === 'hills') {
      const pick = rnd < 0.45 ? 'A' : rnd < 0.75 ? 'B' : 'single';
      t.hills[pick].push({ x, z, rot: hexRot(col, row, 3) });
    } else if (terrain === 'forest') {
      forestSlots.set(`${col},${row}`, t.forests.length);
      t.forests.push({ x, z, rot: hexRot(col, row, 3) });
    } else if (rnd < 0.055) {
      const pick = rnd < 0.02 ? 'A' : rnd < 0.04 ? 'B' : 'D';
      t.rocks[pick].push({ x: x + (tileRand(col, row, 4) - 0.5) * 0.9, z: z + (tileRand(col, row, 5) - 0.5) * 0.9, rot: tileRand(col, row, 6) * Math.PI * 2, scale: 0.8 + rnd * 8 });
    }
  }

  group.add(makeInstanced('hex_grass', t.grass, { shadow: false }));

  // water: own material instance with a gentle swell
  const waterUniforms = { uTime: { value: 0 } };
  const { material: hexMat } = getMergedGeometry('hex_water');
  const waterMat = hexMat.clone();
  waterMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = waterUniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 wpos2 = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
          transformed.y += sin(uTime * 1.3 + wpos2.x * 0.85 + wpos2.y * 0.65) * 0.045;
        #endif`);
  };
  group.add(makeInstanced('hex_water', t.water, { shadow: false, material: waterMat }));

  // nature
  for (const k of ['A', 'B', 'C']) if (t.mountains[k].length) group.add(makeInstanced(`mountain_${k}`, t.mountains[k]));
  if (t.hills.A.length) group.add(makeInstanced('hills_A', t.hills.A));
  if (t.hills.B.length) group.add(makeInstanced('hills_B', t.hills.B));
  if (t.hills.single.length) group.add(makeInstanced('hill_single_A', t.hills.single));
  for (const k of ['A', 'B', 'D']) if (t.rocks[k].length) group.add(makeInstanced(`rock_${k}`, t.rocks[k]));
  if (t.waterplants.length) group.add(makeInstanced('waterplant_A', t.waterplants, { shadow: false }));
  if (t.lilies.length) group.add(makeInstanced('waterlily_A', t.lilies, { shadow: false }));

  // forests: two instanced meshes sharing slot indices — alive and cut
  const forestAlive = makeInstanced('trees_large_A', t.forests);
  const forestCut = makeInstanced('trees_cut_A', t.forests.map(f => ({ ...f, scale: 0.0001 })));
  group.add(forestAlive, forestCut);

  const setForestCut = (col, row, cut) => {
    const slot = forestSlots.get(`${col},${row}`);
    if (slot === undefined) return;
    const f = t.forests[slot];
    for (const [mesh, visible] of [[forestAlive, !cut], [forestCut, cut]]) {
      tmpPos.set(f.x, 0, f.z);
      tmpQuat.setFromAxisAngle(YUP, f.rot);
      const s = visible ? 1 : 0.0001;
      tmpScale.set(s, s, s);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(slot, tmpMat);
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  // deep sea horizon plane
  const seaPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x3f74a8, roughness: 0.7, metalness: 0 })
  );
  seaPlane.rotation.x = -Math.PI / 2;
  seaPlane.position.set(MAP_W, -0.55, MAP_H * 0.85);
  group.add(seaPlane);

  // drifting clouds with real shadows
  const clouds = [];
  const cloudArea = { w: MAP_W * 2.4, h: MAP_H * 1.9 };
  for (let i = 0; i < 8; i++) {
    const c = cloneModel(i % 3 === 0 ? 'cloud_big' : 'cloud_small');
    const s = 0.55 + tileRand(i, 7) * 0.75;
    c.scale.setScalar(s);
    c.position.set(tileRand(i, 1) * cloudArea.w - 6, 20 + tileRand(i, 2) * 6, tileRand(i, 3) * cloudArea.h - 4);
    c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    c.rotation.y = tileRand(i, 4) * Math.PI * 2;
    clouds.push(c);
    group.add(c);
  }

  scene.add(group);

  return {
    group,
    setForestCut,
    tick(time, dt) {
      waterUniforms.uTime.value = time;
      for (const c of clouds) {
        c.position.x += dt * 0.55;
        if (c.position.x > cloudArea.w) c.position.x = -8;
      }
    },
  };
}
