import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Central asset registry. Everything the renderer instantiates comes from here.
const HEX = './assets/models/hex';
const CHAR = './assets/models/characters';
const WEAP = './assets/models/weapons';

export const MODEL_MANIFEST = {
  // terrain tiles
  hex_grass: `${HEX}/tiles/base/hex_grass.gltf`,
  hex_water: `${HEX}/tiles/base/hex_water.gltf`,
  // nature decoration
  trees_large_A: `${HEX}/decoration/nature/trees_A_large.gltf`,
  trees_large_B: `${HEX}/decoration/nature/trees_B_large.gltf`,
  trees_medium_A: `${HEX}/decoration/nature/trees_A_medium.gltf`,
  trees_cut_A: `${HEX}/decoration/nature/trees_A_cut.gltf`,
  tree_single_A: `${HEX}/decoration/nature/tree_single_A.gltf`,
  tree_single_B: `${HEX}/decoration/nature/tree_single_B.gltf`,
  mountain_A: `${HEX}/decoration/nature/mountain_A_grass.gltf`,
  mountain_B: `${HEX}/decoration/nature/mountain_B_grass.gltf`,
  mountain_C: `${HEX}/decoration/nature/mountain_C_grass_trees.gltf`,
  hills_A: `${HEX}/decoration/nature/hills_A.gltf`,
  hills_B: `${HEX}/decoration/nature/hills_B_trees.gltf`,
  hill_single_A: `${HEX}/decoration/nature/hill_single_A.gltf`,
  rock_A: `${HEX}/decoration/nature/rock_single_A.gltf`,
  rock_B: `${HEX}/decoration/nature/rock_single_B.gltf`,
  rock_D: `${HEX}/decoration/nature/rock_single_D.gltf`,
  waterplant_A: `${HEX}/decoration/nature/waterplant_A.gltf`,
  waterlily_A: `${HEX}/decoration/nature/waterlily_A.gltf`,
  cloud_big: `${HEX}/decoration/nature/cloud_big.gltf`,
  cloud_small: `${HEX}/decoration/nature/cloud_small.gltf`,
};

// Buildings come in KayKit team colors; factions map onto them (see factions.js).
export const BUILDING_COLORS = ['blue', 'red', 'green', 'yellow'];
const BUILDING_KINDS = [
  'castle', 'home_A', 'home_B', 'barracks', 'archeryrange', 'blacksmith',
  'church', 'market', 'mine', 'lumbermill', 'tavern', 'windmill',
  'tower_A', 'watermill', 'well',
];
for (const color of BUILDING_COLORS) {
  for (const kind of BUILDING_KINDS) {
    MODEL_MANIFEST[`building_${kind}_${color}`] = `${HEX}/buildings/${color}/building_${kind}_${color}.gltf`;
  }
}
// neutral extras
Object.assign(MODEL_MANIFEST, {
  building_grain: `${HEX}/buildings/neutral/building_grain.gltf`,
  building_scaffolding: `${HEX}/buildings/neutral/building_scaffolding.gltf`,
  building_destroyed: `${HEX}/buildings/neutral/building_destroyed.gltf`,
  building_dirt: `${HEX}/buildings/neutral/building_dirt.gltf`,
  projectile_catapult: `${HEX}/buildings/neutral/projectile_catapult.gltf`,
  flag_blue: `${HEX}/decoration/props/flag_blue.gltf`,
  flag_red: `${HEX}/decoration/props/flag_red.gltf`,
  flag_green: `${HEX}/decoration/props/flag_green.gltf`,
  flag_yellow: `${HEX}/decoration/props/flag_yellow.gltf`,
  prop_lumber: `${HEX}/decoration/props/resource_lumber.gltf`,
  prop_stone: `${HEX}/decoration/props/resource_stone.gltf`,
  prop_tent: `${HEX}/decoration/props/tent.gltf`,
  prop_barrel: `${HEX}/decoration/props/barrel.gltf`,
  prop_sack: `${HEX}/decoration/props/sack.gltf`,
  // characters (rigged + 76 animations each)
  char_knight: `${CHAR}/Knight.glb`,
  char_barbarian: `${CHAR}/Barbarian.glb`,
  char_mage: `${CHAR}/Mage.glb`,
  char_rogue: `${CHAR}/Rogue.glb`,
  char_rogue_hooded: `${CHAR}/Rogue_Hooded.glb`,
  // hand props
  weapon_sword: `${WEAP}/sword_1handed.gltf`,
  weapon_axe2h: `${WEAP}/axe_2handed.gltf`,
  weapon_axe1h: `${WEAP}/axe_1handed.gltf`,
  weapon_crossbow: `${WEAP}/crossbow_2handed.gltf`,
  weapon_staff: `${WEAP}/staff.gltf`,
  weapon_shield: `${WEAP}/shield_badge.gltf`,
  weapon_arrow: `${WEAP}/arrow.gltf`,
});

const gltfCache = new Map();
let sharedHexMaterial = null;

export function getSharedHexMaterial() { return sharedHexMaterial; }

// Palette variants of the hex atlas for factions beyond KayKit's four colors.
// We surgically recolor only strongly-saturated pixels in a hue window, so wood,
// stone and grass stay untouched.
const paletteCache = new Map();
export function getPaletteMaterial(name) {
  if (paletteCache.has(name)) return paletteCache.get(name);
  const recipes = {
    // whitewashed caserío for the Basques: blue accents -> chalk white
    basque: { hue: [185, 265], minSat: 0.22, set: { s: 0.06, lMul: 1.45, lMax: 0.86 } },
    // weathered neutral villages: yellow accents -> dry tan
    neutral: { hue: [35, 75], minSat: 0.3, set: { s: 0.18, lMul: 0.92, lMax: 0.7 } },
  };
  const recipe = recipes[name];
  const src = sharedHexMaterial.map.image;
  const canvas = document.createElement('canvas');
  canvas.width = src.width; canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    if (s >= recipe.minSat && h >= recipe.hue[0] && h <= recipe.hue[1]) {
      const nl = Math.min(l * recipe.set.lMul, recipe.set.lMax);
      const [r, g, b] = hsl2rgb(h, recipe.set.s, nl);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = sharedHexMaterial.map.flipY;
  tex.colorSpace = sharedHexMaterial.map.colorSpace;
  tex.magFilter = THREE.NearestFilter;
  const mat = sharedHexMaterial.clone();
  mat.map = tex;
  mat.name = `hex_${name}`;
  paletteCache.set(name, mat);
  return mat;
}

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const dd = max - min;
  const s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
  let h;
  if (max === r) h = ((g - b) / dd + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / dd + 2) * 60;
  else h = ((r - g) / dd + 4) * 60;
  return [h, s, l];
}

function hsl2rgb(h, s, l) {
  h /= 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = t => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

export async function loadAllModels(onProgress) {
  const loader = new GLTFLoader();
  const keys = Object.keys(MODEL_MANIFEST);
  let done = 0;
  const jobs = keys.map(key => loader.loadAsync(MODEL_MANIFEST[key]).then(gltf => {
    gltfCache.set(key, gltf);
    done++;
    onProgress?.(done / keys.length, key);
  }));
  await Promise.all(jobs);
  unifyHexMaterials();
}

// Every hex-pack model ships its own copy of the same atlas; collapse them into
// one shared material so merged/instanced meshes batch cleanly.
function unifyHexMaterials() {
  for (const [key, gltf] of gltfCache) {
    if (key.startsWith('char_')) continue;
    gltf.scene.traverse(obj => {
      if (!obj.isMesh) return;
      const name = obj.material?.name || '';
      if (name.includes('hexagons_medieval')) {
        if (!sharedHexMaterial) {
          sharedHexMaterial = obj.material;
          sharedHexMaterial.metalness = 0;
          sharedHexMaterial.roughness = 1;
        }
        obj.material = sharedHexMaterial;
      }
    });
  }
}

export function getGltf(key) {
  const g = gltfCache.get(key);
  if (!g) throw new Error(`model not loaded: ${key}`);
  return g;
}

// A fresh scene clone for placing as a unique object (buildings, props).
export function cloneModel(key) {
  const src = getGltf(key).scene;
  const clone = src.clone(true);
  clone.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return clone;
}

// Merged geometry of a model (all meshes baked into one), for InstancedMesh use.
// KayKit hex models share one material, so a single geometry+material suffices.
const mergedCache = new Map();
export function getMergedGeometry(key) {
  if (mergedCache.has(key)) return mergedCache.get(key);
  const src = getGltf(key).scene;
  const geoms = [];
  let material = null;
  src.updateMatrixWorld(true);
  src.traverse(obj => {
    if (!obj.isMesh) return;
    const g = obj.geometry.clone();
    g.applyMatrix4(obj.matrixWorld);
    // drop attributes that differ between meshes so merge succeeds
    for (const attr of Object.keys(g.attributes)) {
      if (attr !== 'position' && attr !== 'normal' && attr !== 'uv') g.deleteAttribute(attr);
    }
    geoms.push(g);
    material ??= obj.material;
  });
  let geometry;
  if (geoms.length === 1) geometry = geoms[0];
  else {
    // manual merge (BufferGeometryUtils.mergeGeometries equivalent, kept local)
    geometry = mergeGeoms(geoms);
  }
  const entry = { geometry, material };
  mergedCache.set(key, entry);
  return entry;
}

function mergeGeoms(geoms) {
  const out = new THREE.BufferGeometry();
  const attrs = ['position', 'normal', 'uv'];
  const merged = {};
  for (const name of attrs) {
    const arrays = [];
    let itemSize = 0;
    let ok = true;
    for (const g of geoms) {
      const a = g.getAttribute(name);
      if (!a) { ok = false; break; }
      itemSize = a.itemSize;
      arrays.push(a.array);
    }
    if (!ok) continue;
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const arr = new Float32Array(total);
    let off = 0;
    for (const a of arrays) { arr.set(a, off); off += a.length; }
    merged[name] = new THREE.BufferAttribute(arr, itemSize);
  }
  const indexArrays = [];
  let vertOffset = 0;
  for (const g of geoms) {
    const pos = g.getAttribute('position');
    const idx = g.index;
    if (idx) {
      const arr = new Uint32Array(idx.count);
      for (let i = 0; i < idx.count; i++) arr[i] = idx.array[i] + vertOffset;
      indexArrays.push(arr);
    } else {
      const arr = new Uint32Array(pos.count);
      for (let i = 0; i < pos.count; i++) arr[i] = i + vertOffset;
      indexArrays.push(arr);
    }
    vertOffset += pos.count;
  }
  for (const [name, attr] of Object.entries(merged)) out.setAttribute(name, attr);
  const totalIdx = indexArrays.reduce((s, a) => s + a.length, 0);
  const idxArr = new Uint32Array(totalIdx);
  let off = 0;
  for (const a of indexArrays) { idxArr.set(a, off); off += a.length; }
  out.setIndex(new THREE.BufferAttribute(idxArr, 1));
  return out;
}
