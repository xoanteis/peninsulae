import * as THREE from 'three';
import { cloneModel, getGltf, getSharedHexMaterial, getPaletteMaterial } from './assets.js';
import { FACTIONS } from '../config/factions.js';
import { BUILDINGS } from '../config/rules.js';
import { REGIONS } from '../config/map.js';
import { tileToWorld } from '../sim/hex.js';

// Buildings, villages and region flags. KayKit ships four team palettes;
// the Basques get a whitewashed variant and neutral villages a weathered one,
// both generated from the same atlas at load time.

const KAYKIT_COLORS = new Set(['blue', 'red', 'green', 'yellow']);

function paletteFor(owner) {
  if (!owner) return { color: 'yellow', material: getPaletteMaterial('neutral') };
  const bc = FACTIONS[owner].buildingColor;
  if (KAYKIT_COLORS.has(bc)) return { color: bc, material: null };
  return { color: 'blue', material: getPaletteMaterial('basque') }; // basque
}

const MODEL_OF_KIND = kind => BUILDINGS[kind]?.model ?? 'home_A';

export class BuildingRenderer {
  constructor(scene, world) {
    this.scene = scene;
    this.views = new Map();   // building id -> {group, done}
    this.flags = new Map();   // region key -> mesh
    this.ruins = [];
    // seed from current world state (initial events may predate us)
    for (const e of world.entities.values()) {
      if (e.type === 'building') this.ensure(e);
    }
    for (const region of Object.values(world.regions)) this.updateFlag(world, region.key);
  }

  buildMesh(b) {
    const modelKind = MODEL_OF_KIND(b.kind);
    const { color, material } = paletteFor(b.owner);
    const grain = modelKind === 'grain'; // farms are neutral models
    const key = grain ? 'building_grain' : `building_${modelKind}_${color}`;
    let mesh;
    try {
      mesh = cloneModel(key);
    } catch {
      mesh = cloneModel('building_home_A_blue');
    }
    if (material) {
      const shared = getSharedHexMaterial();
      mesh.traverse(o => { if (o.isMesh && o.material === shared) o.material = material; });
    }
    return mesh;
  }

  ensure(b) {
    let v = this.views.get(b.id);
    if (!v) {
      const group = new THREE.Group();
      const { x, z } = tileToWorld(b.col, b.row);
      group.position.set(x, 0, z);
      group.rotation.y = ((b.col * 7 + b.row * 13) % 6) * Math.PI / 3;
      this.scene.add(group);
      v = { id: b.id, group, stage: null, owner: b.owner };
      this.views.set(b.id, v);
    }
    const stage = b.progress >= 1 ? 'done' : 'site';
    if (v.stage !== stage || v.owner !== b.owner) {
      v.stage = stage;
      v.owner = b.owner;
      v.group.clear();
      if (stage === 'site') {
        const scaff = cloneModel('building_scaffolding');
        scaff.scale.setScalar(0.9);
        v.group.add(scaff);
      } else {
        v.group.add(this.buildMesh(b));
      }
    }
    return v;
  }

  handleEvent(ev, world) {
    switch (ev.type) {
      case 'building_placed':
      case 'building_complete': {
        const b = world.entities.get(ev.id);
        if (b) {
          const v = this.ensure(b);
          if (ev.type === 'building_complete') {
            v.pop = 0.25; // completion pop
          }
        }
        break;
      }
      case 'entity_removed': {
        // covers demolition and other silent removals (destroyed has its own case)
        const v = this.views.get(ev.id);
        if (v) { this.scene.remove(v.group); this.views.delete(ev.id); }
        break;
      }
      case 'building_destroyed': {
        const v = this.views.get(ev.id);
        if (v) {
          this.scene.remove(v.group);
          this.views.delete(ev.id);
          const { x, z } = tileToWorld(ev.col, ev.row);
          const ruin = cloneModel('building_destroyed');
          ruin.position.set(x, 0, z);
          this.scene.add(ruin);
          this.ruins.push({ mesh: ruin, t: 14 });
        }
        break;
      }
      case 'region_flipped': {
        this.updateFlag(world, ev.region);
        // villages change palette with their new master
        const region = world.regions[ev.region];
        for (const id of region.villageIds) {
          const b = world.entities.get(id);
          if (b) { const v = this.views.get(id); if (v) { v.stage = null; this.ensure(b); } }
        }
        break;
      }
    }
  }

  updateFlag(world, key) {
    const region = world.regions[key];
    const old = this.flags.get(key);
    if (old) { this.scene.remove(old); this.flags.delete(key); }
    if (!region.owner) return;
    const f = FACTIONS[region.owner];
    let mesh;
    if (f.flag.startsWith('flag_') && f.flag !== 'flag_basque') {
      mesh = cloneModel(f.flag);
    } else {
      mesh = cloneModel('flag_blue');
      const mat = getPaletteMaterial('basque');
      const shared = getSharedHexMaterial();
      mesh.traverse(o => { if (o.isMesh && o.material === shared) o.material = mat; });
    }
    const [c, r] = REGIONS[key].village;
    const { x, z } = tileToWorld(c, r);
    mesh.position.set(x + 0.72, 0, z + 0.55);
    mesh.scale.setScalar(1.5);
    this.scene.add(mesh);
    this.flags.set(key, mesh);
  }

  update(world, dt) {
    for (const v of this.views.values()) {
      if (v.pop > 0) {
        v.pop -= dt;
        const k = 1 + Math.max(v.pop, 0) * 0.5;
        v.group.scale.set(k, 2 - k, k);
      }
      // construction sites pulse gently so they read as "in progress"
      if (v.stage === 'site') {
        const b = world.entities.get(v.id);
        if (b) {
          const s = 0.55 + b.progress * 0.4;
          v.group.scale.setScalar(s);
        }
      }
    }
    for (let i = this.ruins.length - 1; i >= 0; i--) {
      const r = this.ruins[i];
      r.t -= dt;
      if (r.t < 2) r.mesh.position.y = -(2 - r.t) * 0.3;
      if (r.t <= 0) { this.scene.remove(r.mesh); this.ruins.splice(i, 1); }
    }
  }
}
