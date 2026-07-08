import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { getGltf } from './assets.js';
import { FACTIONS } from '../config/factions.js';

// Animated characters. Every unit is a SkeletonUtils clone of a KayKit
// adventurer with its own AnimationMixer, driven by the sim's anim hint.

const UNIT_SCALE = 0.46;
const WORKER_MODEL = 'char_rogue_hooded';
const MILITIA_MODEL = 'char_rogue_hooded';

const WORK_CLIPS = {
  forest: '1H_Melee_Attack_Chop',
  construct: '1H_Melee_Attack_Chop',
  slot: 'Interact',
  fish: 'Throw',
};

const ATTACK_CLIPS = {
  char_knight: '1H_Melee_Attack_Slice_Diagonal',
  char_barbarian: '2H_Melee_Attack_Chop',
  char_mage: '2H_Melee_Attack_Spin',
  char_rogue: '1H_Melee_Attack_Stab',
  char_rogue_hooded: '1H_Melee_Attack_Slice_Horizontal',
};

function modelFor(unit) {
  if (unit.kind === 'worker') return WORKER_MODEL;
  if (unit.kind === 'militia') return MILITIA_MODEL;
  if (unit.kind === 'crossbow') return 'char_rogue';
  return FACTIONS[unit.owner]?.soldierModel ?? 'char_knight';
}

// Each KayKit character ships every weapon variant as hidden-able nodes.
// We toggle the right ones per role (GLTFLoader strips dots from node names).
const ALL_WEAPON_NODES = new Set([
  '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield',
  '1H_Sword', '2H_Sword', '1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe',
  'Mug', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff',
  'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable',
]);

function keepNodesFor(unit) {
  if (unit.kind === 'worker') return new Set();
  if (unit.kind === 'militia') return new Set(['Knife']);
  if (unit.kind === 'crossbow') return new Set(['2H_Crossbow']);
  switch (FACTIONS[unit.owner]?.soldierModel) {
    case 'char_knight': return new Set(['1H_Sword', 'Badge_Shield']);
    case 'char_barbarian': return new Set(['2H_Axe']);
    case 'char_mage': return new Set(['2H_Staff']);
    case 'char_rogue': return new Set(['Knife', 'Knife_Offhand']); // the almogàver coltell
    case 'char_rogue_hooded': return new Set(['Knife']); // navigator's blade
    default: return new Set(['1H_Sword']);
  }
}

export class UnitRenderer {
  constructor(scene) {
    this.scene = scene;
    this.units = new Map(); // sim id -> view
    this.clipCache = new Map();

    // faction rings under units
    const ringGeo = new THREE.RingGeometry(0.3, 0.4, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, opacity: 0.85 });
    ringMat.color.set(0xffffff);
    this.rings = new THREE.InstancedMesh(ringGeo, ringMat, 640);
    this.rings.count = 0;
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 1;
    scene.add(this.rings);
    this._m4 = new THREE.Matrix4();
    this._color = new THREE.Color();
    this.flashCache = new Map(); // shared material -> [3 emissive fade steps]
  }

  flashMat(shared, step) {
    let steps = this.flashCache.get(shared);
    if (!steps) {
      this.flashCache.set(shared, steps = [0, 1, 2].map(i => {
        if (!shared.emissive) return shared; // basic materials can't flash
        const m = shared.clone();
        const k = (i + 1) / 3;
        m.emissive.setRGB(k * 0.9, k * 0.25, k * 0.15);
        m.emissiveIntensity = 1;
        return m;
      }));
    }
    return steps[step];
  }

  clipsFor(modelKey) {
    if (!this.clipCache.has(modelKey)) {
      const map = new Map();
      for (const clip of getGltf(modelKey).animations) map.set(clip.name, clip);
      this.clipCache.set(modelKey, map);
    }
    return this.clipCache.get(modelKey);
  }

  handleEvent(ev, world) {
    if (ev.type === 'unit_spawn') {
      const u = world.entities.get(ev.id);
      if (u) this.spawn(u);
    } else if (ev.type === 'unit_died') {
      const v = this.units.get(ev.id);
      if (v) { v.dead = true; v.deadT = 0; this.play(v, 'die'); }
    } else if (ev.type === 'entity_removed') {
      this.remove(ev.id);
    } else if (ev.type === 'attack') {
      const v = this.units.get(ev.id);
      if (v) this.play(v, ev.ranged ? 'shoot' : 'attack', true);
    } else if (ev.type === 'damage' && ev.targetType === 'unit') {
      const v = this.units.get(ev.id);
      if (v && !v.dead) v.flash = 0.18;
    }
  }

  spawn(u) {
    const modelKey = modelFor(u);
    const src = getGltf(modelKey).scene;
    const mesh = skeletonClone(src);
    mesh.scale.setScalar(UNIT_SCALE);
    mesh.position.set(u.x, 0, u.z);
    mesh.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
    });
    this.swapHandProps(mesh, u);
    const mixer = new THREE.AnimationMixer(mesh);
    const view = {
      id: u.id, mesh, mixer, modelKey, current: null, currentName: null,
      dead: false, deadT: 0, flash: 0, flashStep: -1, spawnT: 0.25,
      facing: u.facing, mats: [],
    };
    // materials stay SHARED — per-unit clones gave every mesh its own material
    // (~600 unique across an army), destroying renderer state reuse in both the
    // color and shadow passes. Hit flashes swap to cached per-step variants.
    mesh.traverse(o => {
      if (o.material) view.mats.push({ o, shared: o.material });
    });
    this.units.set(u.id, view);
    this.scene.add(mesh);
    this.play(view, 'idle');
  }

  swapHandProps(mesh, u) {
    const keep = keepNodesFor(u);
    mesh.traverse(o => {
      if (ALL_WEAPON_NODES.has(o.name)) o.visible = keep.has(o.name);
    });
  }

  play(view, hint, restart = false) {
    const clipName = this.resolveClip(view, hint);
    if (!clipName) return;
    if (view.currentName === clipName && !restart) return;
    const clips = this.clipsFor(view.modelKey);
    const clip = clips.get(clipName);
    if (!clip) return;
    const action = view.mixer.clipAction(clip);
    if (hint === 'die') {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    } else if (hint === 'attack' || hint === 'shoot' || hint === 'work') {
      action.setLoop(THREE.LoopRepeat);
    }
    if (restart) action.reset();
    if (view.current && view.current !== action) {
      action.reset().crossFadeFrom(view.current, 0.16, false).play();
    } else {
      action.play();
    }
    view.current = action;
    view.currentName = clipName;
  }

  resolveClip(view, hint) {
    switch (hint) {
      case 'idle': return 'Idle';
      case 'walk': return 'Walking_A';
      case 'die': return Math.random() < 0.5 ? 'Death_A' : 'Death_B';
      case 'attack': return ATTACK_CLIPS[view.modelKey] ?? '1H_Melee_Attack_Chop';
      case 'shoot': return '2H_Ranged_Shooting';
      case 'work': return WORK_CLIPS[view.taskKind] ?? 'Interact';
      case 'cheer': return 'Cheer';
      default: return 'Idle';
    }
  }

  remove(id) {
    const v = this.units.get(id);
    if (!v) return;
    this.scene.remove(v.mesh);
    v.mixer.stopAllAction();
    v.mixer.uncacheRoot(v.mesh);
    // materials are shared with the GLTF cache (and the flash pool) — never dispose
    v.mesh.traverse(o => { if (o.isSkinnedMesh) o.skeleton?.dispose(); }); // bone textures
    this.units.delete(id);
  }

  update(world, dt, alpha, selection) {
    let ringCount = 0;
    for (const v of this.units.values()) {
      const u = world.entities.get(v.id);
      if (u && !v.dead) {
        // interpolate between sim ticks
        const x = u.px + (u.x - u.px) * alpha;
        const z = u.pz + (u.z - u.pz) * alpha;
        v.mesh.position.set(x, 0, z);
        // shortest-arc facing
        let d = u.facing - v.facing;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        v.facing += d * Math.min(1, dt * 10);
        v.mesh.rotation.y = v.facing;

        // sync anim hint
        v.taskKind = u.task?.type === 'gather' ? u.task.target?.type : u.task?.type;
        if (u.anim !== v.simAnim) {
          v.simAnim = u.anim;
          this.play(v, u.anim);
        }
        if (v.currentName === 'Walking_A' && v.current) {
          v.current.timeScale = u.speed / 2.3;
        }

        // spawn pop
        if (v.spawnT > 0) {
          v.spawnT -= dt;
          const s = UNIT_SCALE * (1 - Math.max(v.spawnT, 0) / 0.25 * 0.5);
          v.mesh.scale.setScalar(s);
        }

        // faction ring
        if (ringCount < 640) {
          const f = u.owner && u.owner !== '__dead__' ? FACTIONS[u.owner] : null;
          const isSel = selection?.has(u.id);
          this._color.set(isSel ? 0xffffff : (f ? f.color : 0x8a8a8a));
          this._m4.makeTranslation(x, 0.06, z);
          if (isSel) this._m4.scale(new THREE.Vector3(1.25, 1, 1.25));
          this.rings.setMatrixAt(ringCount, this._m4);
          this.rings.setColorAt(ringCount, this._color);
          ringCount++;
        }
      } else if (v.dead) {
        v.deadT += dt;
        if (v.deadT > 1.3) v.mesh.position.y = -(v.deadT - 1.3) * 0.6; // sink away
      }

      // hit flash: swap to cached emissive-step materials (shared mats stay pristine)
      if (v.flash > 0 || v.flashStep >= 0) {
        v.flash -= dt;
        const step = v.flash > 0 ? Math.min(2, Math.floor(v.flash / 0.18 * 3)) : -1;
        if (step !== v.flashStep) {
          v.flashStep = step;
          for (const { o, shared } of v.mats) o.material = step < 0 ? shared : this.flashMat(shared, step);
        }
      }

      v.mixer.update(dt);
    }
    this.rings.count = ringCount;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }
}
