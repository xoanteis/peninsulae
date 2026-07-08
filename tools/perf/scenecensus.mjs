// Scene-graph census (verify.mjs check script): who owns the meshes, materials,
// textures, triangles, and shadow casters in a busy mid-game scene. This is the
// deterministic, GPU-independent way to judge render cost in headless — the
// numbers that matter on real machines (state changes, draw submissions) are
// exactly the countable ones. Found the 840-unique-materials bug (PR #30).
//
//   PWTOOLS=<dir> QUERY='?faction=galicia' node tools/verify.mjs <outdir> tools/perf/scenecensus.mjs
export async function run(page, { sleep, report }) {
  await sleep(1800);
  await page.evaluate(() => { const w = window.__game.world; for (let i = 0; i < 9000; i++) w.step(); w.events.length = 0; });
  await sleep(1200);
  report.checks.census = await page.evaluate(() => {
    const g = window.__game;
    const groups = {};
    const mats = new Set(), texs = new Set(), casters = { yes: 0, no: 0 };
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) return;
      let p = o; while (p.parent && p.parent !== g.scene) p = p.parent;
      const key = p.name || p.type;
      const gr = (groups[key] ??= { meshes: 0, instanced: 0, mats: new Set(), tris: 0 });
      gr.meshes++;
      if (o.isInstancedMesh) gr.instanced++;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { gr.mats.add(m.uuid); mats.add(m.uuid); if (m.map) texs.add(m.map.uuid); }
      const idx = o.geometry.index; const n = idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
      gr.tris += n * (o.isInstancedMesh ? o.count : 1);
      o.castShadow ? casters.yes++ : casters.no++;
    });
    const out = {};
    for (const [k, v] of Object.entries(groups)) out[k] = { meshes: v.meshes, instanced: v.instanced, uniqueMats: v.mats.size, ktris: Math.round(v.tris / 1000) };
    return { groups: out, uniqueMaterials: mats.size, uniqueTextures: texs.size, shadowCasters: casters };
  });
}
