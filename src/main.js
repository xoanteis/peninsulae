import * as THREE from 'three';
import { loadAllModels } from './render/assets.js';
import { createRenderer, createScene, createLights, updateSunFollow } from './render/scene.js';
import { buildTerrain } from './render/terrain.js';
import { CameraRig } from './input/camera.js';
import { parseMap, MAP_W, MAP_H } from './config/map.js';
import { tileToWorld } from './sim/hex.js';

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

  const canvas = document.getElementById('gl');
  const renderer = createRenderer(canvas);
  const scene = createScene();
  const lights = createLights(scene);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 500);
  const nw = tileToWorld(0, 0), se = tileToWorld(MAP_W - 1, MAP_H - 1);
  const rig = new CameraRig(camera, { minX: nw.x + 4, maxX: se.x - 4, minZ: nw.z + 3, maxZ: se.z - 3 });
  rig.attach(canvas);

  const tiles = parseMap();
  const terrain = buildTerrain(scene, tiles);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- main loop ----
  let last = performance.now();
  let frames = 0, fpsTime = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    rig.update(dt);
    updateSunFollow(lights, rig.target);
    terrain.tick(now / 1000, dt);

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

  // expose for the verification harness
  Object.assign(dbg, { ready: true, scene, rig, camera, renderer, tiles, terrain });

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
