import * as THREE from 'three';
import { loadAllModels } from './render/assets.js';
import { createRenderer, createScene, createLights, updateSunFollow } from './render/scene.js';
import { buildTerrain } from './render/terrain.js';
import { UnitRenderer } from './render/units.js';
import { BuildingRenderer } from './render/buildings.js';
import { EffectsRenderer } from './render/effects.js';
import { CameraRig } from './input/camera.js';
import { Controls } from './ui/controls.js';
import { Overlays } from './ui/overlays.js';
import { MAP_W, MAP_H } from './config/map.js';
import { tileToWorld } from './sim/hex.js';
import { TICK_MS } from './config/rules.js';
import { World } from './sim/world.js';

const dbg = (window.__game ||= { errors: [] });
dbg.ready = false;

async function boot() {
  const loadFill = document.getElementById('load-fill');
  const loadStatus = document.getElementById('load-status');

  await loadAllModels((p, key) => {
    loadFill.style.width = `${Math.round(p * 100)}%`;
    loadStatus.textContent = `Loading ${key}…`;
  });
  loadStatus.textContent = 'Raising the banners…';

  const humanFaction = new URLSearchParams(location.search).get('faction') || 'galicia';
  const world = new World(humanFaction);

  const canvas = document.getElementById('gl');
  const renderer = createRenderer(canvas);
  const scene = createScene();
  const lights = createLights(scene);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 500);
  const nw = tileToWorld(0, 0), se = tileToWorld(MAP_W - 1, MAP_H - 1);
  const rig = new CameraRig(camera, { minX: nw.x + 4, maxX: se.x - 4, minZ: nw.z + 3, maxZ: se.z - 3 });
  rig.attach(canvas);
  // open on the player's capital
  {
    const cap = world.entities.get(world.players[humanFaction].capitalId);
    if (cap) { rig.jumpTo(cap.x, cap.z); rig.target.set(cap.x, 0, cap.z); rig.goalDist = 22; rig.dist = 26; }
  }

  const terrain = buildTerrain(scene, world.tiles, world.fishNodes);
  const unitR = new UnitRenderer(scene);
  const buildingR = new BuildingRenderer(scene, world);
  const fx = new EffectsRenderer(scene, humanFaction);

  const hud = document.getElementById('hud');
  hud.classList.remove('hidden');
  const selection = new Set();
  const overlays = new Overlays(hud, camera, canvas, world, humanFaction);
  const controls = new Controls({
    canvas, camera, world, humanId: humanFaction, selection,
    onOrder(o) {
      switch (o.type) {
        case 'move': world.orderMove(humanFaction, o.ids, o.x, o.z); break;
        case 'attack': world.orderAttack(humanFaction, o.ids, o.targetId); break;
        case 'gather': world.orderGather(humanFaction, o.ids, o.target); break;
        case 'build': world.orderBuild(humanFaction, o.ids, o.buildingId); break;
        case 'workslot': world.orderGather(humanFaction, o.ids, { type: 'slot', buildingId: o.buildingId }); break;
        case 'place': {
          const err = world.placeBuilding(humanFaction, o.kind, o.col, o.row);
          if (err) world.pushEvent({ type: 'ui_error', message: err });
          else {
            // send selected workers to raise it
            const t = world.tileAt(o.col, o.row);
            const ids = [...selection].filter(id => world.entities.get(id)?.kind === 'worker');
            if (ids.length && t.building) world.orderBuild(humanFaction, ids, t.building);
          }
          break;
        }
      }
    },
  });

  // consume the events emitted during world construction
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
      world.step();
      acc -= TICK_MS;
    }
    const alpha = Math.min(acc / TICK_MS, 1);

    const events = world.events.splice(0);
    for (const ev of events) {
      unitR.handleEvent(ev, world);
      buildingR.handleEvent(ev, world);
      fx.handleEvent(ev, world);
      overlays.handleEvent(ev, world);
      if (ev.type === 'forest_cut') terrain.setForestCut(ev.col, ev.row, true);
      if (ev.type === 'entity_removed') selection.delete(ev.id);
      if (ev.type === 'unit_died') selection.delete(ev.id);
    }
    dbg.lastEvents = events.length ? events : dbg.lastEvents;

    rig.update(dt);
    updateSunFollow(lights, rig.target);
    terrain.tick(now / 1000, dt);
    unitR.update(world, dt, alpha, selection);
    buildingR.update(world, dt);
    fx.update(dt);
    overlays.update(dt, selection);

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

  Object.assign(dbg, { ready: true, scene, rig, camera, renderer, world, terrain, selection, controls });

  const loading = document.getElementById('loading');
  loading.classList.add('fading');
  setTimeout(() => loading.classList.add('hidden'), 700);
}

boot().catch(err => {
  console.error(err);
  dbg.errors.push(String(err?.stack || err));
  const el = document.getElementById('load-status');
  if (el) { el.textContent = `Failed to load: ${err.message}`; el.style.color = '#ff6b57'; }
});
