import * as THREE from 'three';
import { loadAllModels } from './render/assets.js';
import { createRenderer, createScene, createLights, updateSunFollow } from './render/scene.js';
import { buildTerrain } from './render/terrain.js';
import { UnitRenderer } from './render/units.js';
import { BuildingRenderer } from './render/buildings.js';
import { EffectsRenderer } from './render/effects.js';
import { CameraRig } from './input/camera.js';
import { Controls } from './ui/controls.js';
import { TouchControls } from './input/touch.js';
import { Overlays } from './ui/overlays.js';
import { HUD } from './ui/hud.js';
import { pickFaction } from './ui/factionSelect.js';
import { AudioEngine } from './audio/audio.js';
import { MAP_W, MAP_H } from './config/map.js';
import { tileToWorld } from './sim/hex.js';
import { TICK_MS } from './config/rules.js';
import { World } from './sim/world.js';

const dbg = (window.__game ||= { errors: [] });
dbg.ready = false;

async function boot() {
  const loadFill = document.getElementById('load-fill');
  const loadStatus = document.getElementById('load-status');
  const loading = document.getElementById('loading');

  const modelsReady = loadAllModels((p, key) => {
    loadFill.style.width = `${Math.round(p * 100)}%`;
    loadStatus.textContent = `Loading ${key}…`;
  }).then(() => {
    // don't sit on top of the faction-select screen
    loading.classList.add('fading');
    setTimeout(() => loading.classList.add('hidden'), 700);
  });
  const [humanFaction] = await Promise.all([pickFaction(), modelsReady]);

  const world = new World(humanFaction);
  const audio = new AudioEngine();
  const armAudio = () => { audio.init(); window.removeEventListener('pointerdown', armAudio); window.removeEventListener('keydown', armAudio); };
  window.addEventListener('pointerdown', armAudio);
  window.addEventListener('keydown', armAudio);

  const canvas = document.getElementById('gl');
  const renderer = createRenderer(canvas);
  const scene = createScene();
  const lights = createLights(scene);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 500);
  const nw = tileToWorld(0, 0), se = tileToWorld(MAP_W - 1, MAP_H - 1);
  const rig = new CameraRig(camera, { minX: nw.x + 4, maxX: se.x - 4, minZ: nw.z + 3, maxZ: se.z - 3 });
  rig.attach(canvas);
  {
    const cap = world.entities.get(world.players[humanFaction].capitalId);
    if (cap) { rig.jumpTo(cap.x, cap.z); rig.target.set(cap.x, 0, cap.z); rig.goalDist = 22; rig.dist = 30; }
  }

  const terrain = buildTerrain(scene, world.tiles, world.fishNodes);
  const unitR = new UnitRenderer(scene);
  const buildingR = new BuildingRenderer(scene, world);
  const fx = new EffectsRenderer(scene, humanFaction);

  const hudRoot = document.getElementById('hud');
  hudRoot.classList.remove('hidden');
  const selection = new Set();

  const controls = new Controls({
    canvas, camera, world, humanId: humanFaction, selection, rig,
    onSelect(hit, regionKey) {
      hud.setRegion(regionKey ?? null);
      hud.renderSelPanel(selection);
      if (hit) audio.play('ui_click', { volume: 0.3 });
    },
    onOrder(o) {
      switch (o.type) {
        case 'move': world.orderMove(humanFaction, o.ids, o.x, o.z); break;
        case 'amove': world.orderAttackMove(humanFaction, o.ids, o.x, o.z); audio.play('blip', { volume: 0.5 }); break;
        case 'stop': world.orderStop(humanFaction, o.ids); audio.play('ui_click', { volume: 0.4 }); break;
        case 'ui': audio.play(o.sound ?? 'ui_click', { volume: 0.4 }); break;
        case 'attack': world.orderAttack(humanFaction, o.ids, o.targetId); audio.play('blip', { volume: 0.4 }); break;
        case 'gather': world.orderGather(humanFaction, o.ids, o.target); audio.play('ui_click', { volume: 0.4 }); break;
        case 'build': world.orderBuild(humanFaction, o.ids, o.buildingId); break;
        case 'repair': world.orderRepair(humanFaction, o.ids, o.buildingId); audio.play('ui_click', { volume: 0.4 }); break;
        case 'workslot': world.orderGather(humanFaction, o.ids, { type: 'slot', buildingId: o.buildingId }); break;
        case 'rally': audio.play('ui_click', { volume: 0.4 }); break;
        case 'place': {
          const err = world.placeBuilding(humanFaction, o.kind, o.col, o.row);
          if (err) world.pushEvent({ type: 'ui_error', message: err });
          else {
            const t = world.tileAt(o.col, o.row);
            let ids = [...selection].filter(id => world.entities.get(id)?.kind === 'worker');
            if (!ids.length && t.building) {
              // no builder in the selection: draft the nearest worker, idle first
              const site = world.entities.get(t.building);
              const workers = [...world.entities.values()].filter(e =>
                e.type === 'unit' && e.kind === 'worker' && e.owner === humanFaction && e.state !== 'dying');
              const pool = workers.filter(w => w.state === 'idle');
              let best = null, bestD = Infinity;
              for (const w of (pool.length ? pool : workers)) {
                const d = Math.hypot(w.x - site.x, w.z - site.z);
                if (d < bestD) { bestD = d; best = w; }
              }
              if (best) ids = [best.id];
            }
            if (ids.length && t.building) world.orderBuild(humanFaction, ids, t.building);
          }
          break;
        }
        case 'hint': world.pushEvent({ type: 'ui_error', message: o.message }); break;
        case 'pause': {
          dbg.paused = !dbg.paused;
          hud.setPaused(dbg.paused);
          audio.play('ui_click', { volume: 0.4 });
          break;
        }
      }
    },
  });

  const touch = new TouchControls({ canvas, rig, controls });
  // HUD first: it resets #hud's innerHTML, which would orphan the overlay layer
  const hud = new HUD({ root: hudRoot, world, humanId: humanFaction, controls, rig, audio });
  const overlays = new Overlays(hudRoot, camera, canvas, world, humanFaction);
  hud.updatePlaceHint = hud.updatePlaceHint.bind(hud);
  audio.setListener(rig.target.x, rig.target.z, rig.dist);

  // placement ghost: hex outline following the cursor while placing
  const ghostGeo = new THREE.RingGeometry(0.82, 1.0, 6);
  ghostGeo.rotateX(-Math.PI / 2);
  ghostGeo.rotateY(Math.PI / 6);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.85, depthWrite: false });
  const ghost = new THREE.Mesh(ghostGeo, ghostMat);
  ghost.visible = false;
  scene.add(ghost);

  const bootEvents = world.events.splice(0);
  for (const ev of bootEvents) unitR.handleEvent(ev, world);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- main loop: fixed-tick sim, interpolated render ----
  let last = performance.now();
  let acc = 0;
  let frames = 0, fpsTime = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    acc += dt * 1000;
    let safety = 0;
    while (acc >= TICK_MS && safety++ < 10) {
      if (!world.winner && !dbg.paused) world.step();
      acc -= TICK_MS;
    }
    // freeze interpolation once the war is decided, or units vibrate on stale ticks
    const alpha = (world.winner || dbg.paused) ? 1 : Math.min(acc / TICK_MS, 1);

    const events = world.events.splice(0);
    for (const ev of events) {
      unitR.handleEvent(ev, world);
      buildingR.handleEvent(ev, world);
      fx.handleEvent(ev, world);
      overlays.handleEvent(ev, world);
      hud.handleEvent(ev, world);
      audio.handleEvent(ev, world, humanFaction);
      if (ev.type === 'forest_cut') terrain.setForestCut(ev.col, ev.row, true);
      if (ev.type === 'entity_removed' || ev.type === 'unit_died') selection.delete(ev.id);
    }

    rig.update(dt);
    updateSunFollow(lights, rig.target);
    audio.setListener(rig.target.x, rig.target.z, rig.dist);
    terrain.tick(now / 1000, dt);
    unitR.update(world, dt, alpha, selection);
    buildingR.update(world, dt);
    fx.update(dt);
    overlays.update(dt, selection);
    hud.update(dt, selection);

    // placement ghost
    if (controls.placing && controls.hoverTile) {
      const { col, row } = controls.hoverTile;
      const ok = world.canPlaceAt(humanFaction, controls.placing, col, row) === null;
      const { x, z } = tileToWorld(col, row);
      ghost.visible = true;
      ghost.position.set(x, 0.06, z);
      ghostMat.color.set(ok ? 0x7dff9a : 0xff6b57);
    } else ghost.visible = false;

    renderer.render(scene, camera);

    frames++; fpsTime += dt;
    if (fpsTime >= 1) {
      dbg.fps = Math.round(frames / fpsTime);
      dbg.drawCalls = renderer.info.render.calls;
      dbg.triangles = renderer.info.render.triangles;
      frames = 0; fpsTime = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  Object.assign(dbg, { ready: true, scene, rig, camera, renderer, world, terrain, selection, controls, hud, audio, touch });

  loading.classList.add('fading');
  setTimeout(() => loading.classList.add('hidden'), 700);
}

boot().catch(err => {
  console.error(err);
  dbg.errors.push(String(err?.stack || err));
  const el = document.getElementById('load-status');
  if (el) { el.textContent = `Failed to load: ${err.message}`; el.style.color = '#ff6b57'; }
});
