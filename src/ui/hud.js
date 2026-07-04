// The full HUD: resources, domination race, selection panel, build menu,
// alerts, minimap, help overlay, end screen. DOM-only; reads sim state.

import { FACTIONS } from '../config/factions.js';
import { BUILDINGS, UNITS, ERAS, SMITH_UPGRADES } from '../config/rules.js';
import { REGIONS, MAP_W, MAP_H } from '../config/map.js';
import { regionConvertCost } from '../sim/regions.js';
import { tileToWorld } from '../sim/hex.js';

const RES_ICONS = { food: '🌾', wood: '🪵', gold: '🪙', identity: '📜' };
const BUILD_ICONS = {
  house: '🏠', farm: '🌾', lumbercamp: '🪚', mine: '⛏️', market: '⚖️', church: '⛪',
  festival: '🎻', barracks: '⚔️', archery: '🏹', tower: '🗼', blacksmith: '🛠️',
};
const UNIT_ICONS = { worker: '🧑‍🌾', soldier: '⚔️', crossbow: '🏹', militia: '🛡️' };
const BUILD_ORDER = ['house', 'farm', 'lumbercamp', 'mine', 'market', 'church', 'barracks', 'tower', 'archery', 'blacksmith', 'festival'];

const fmtCost = cost => Object.entries(cost).map(([k, v]) => `${RES_ICONS[k] ?? k}${v}`).join(' ') || 'free';

export class HUD {
  constructor({ root, world, humanId, controls, rig, audio }) {
    this.world = world;
    this.humanId = humanId;
    this.controls = controls;
    this.rig = rig;
    this.audio = audio;
    this.regionKey = null;
    this.refresh = 0;
    this.ended = false;

    root.innerHTML = `
      <div id="res-bar" class="panel"></div>
      <div id="domination" class="panel"><div id="dom-segments"></div><div id="dom-label"></div></div>
      <div id="top-right" class="panel">
        <button id="btn-help" title="How to play (H)">?</button>
        <button id="btn-mute" title="Mute (M)">🔊</button>
      </div>
      <div id="alerts"></div>
      <canvas id="minimap" width="240" height="182" class="panel"></canvas>
      <div id="sel-panel" class="panel hidden"></div>
      <div id="build-menu" class="panel"></div>
      <div id="place-hint" class="hidden"></div>
      <div id="help-overlay" class="hidden"></div>
      <div id="end-overlay" class="hidden"></div>
    `;
    this.el = Object.fromEntries(
      ['res-bar', 'domination', 'dom-segments', 'dom-label', 'alerts', 'minimap', 'sel-panel',
        'build-menu', 'place-hint', 'help-overlay', 'end-overlay', 'btn-help', 'btn-mute']
        .map(id => [id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), document.getElementById(id)])
    );

    this.buildBuildMenu();
    this.buildHelp();
    this.el.btnHelp.onclick = () => this.toggleHelp();
    this.el.btnMute.onclick = () => {
      const muted = this.audio.toggleMute();
      this.el.btnMute.textContent = muted ? '🔇' : '🔊';
    };
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'KeyH') this.toggleHelp();
      if (e.code === 'KeyM') this.el.btnMute.click();
    });

    this.minimapBase = this.renderMinimapBase();
    this.el.minimap.addEventListener('pointerdown', e => this.minimapJump(e));
    this.el.minimap.addEventListener('pointermove', e => { if (e.buttons & 1) this.minimapJump(e); });

    this.alertsData = [];
  }

  // ---------- build menu ----------
  buildBuildMenu() {
    const menu = this.el.buildMenu;
    menu.innerHTML = `<div class="bm-title">Build</div><div class="bm-grid"></div>`;
    const grid = menu.querySelector('.bm-grid');
    for (const kind of BUILD_ORDER) {
      const def = BUILDINGS[kind];
      const b = document.createElement('button');
      b.className = 'bm-item';
      b.dataset.kind = kind;
      b.innerHTML = `<span class="bm-icon">${BUILD_ICONS[kind]}</span><span class="bm-name">${def.name}</span><span class="bm-cost"></span>`;
      b.title = def.desc;
      b.onclick = () => {
        this.audio.play('ui_click');
        this.controls.setPlacing(this.controls.placing === kind ? null : kind);
        this.updatePlaceHint();
      };
      grid.appendChild(b);
    }
  }

  updatePlaceHint() {
    const k = this.controls.placing;
    this.el.placeHint.classList.toggle('hidden', !k);
    if (k) this.el.placeHint.textContent = `Placing ${BUILDINGS[k].name} — click a tile in your regions · Shift-click for more · Esc to cancel`;
    for (const b of this.el.buildMenu.querySelectorAll('.bm-item')) {
      b.classList.toggle('active', b.dataset.kind === k);
    }
  }

  // ---------- help ----------
  buildHelp() {
    const factionRows = Object.values(FACTIONS).map(f => `
      <tr><td style="color:#${f.color.toString(16).padStart(6, '0')}">${f.name}</td>
      <td><em>${f.motto}</em></td><td>${f.bonusText}</td></tr>`).join('');
    this.el.helpOverlay.innerHTML = `
      <div class="help-box panel">
        <h2>How to play</h2>
        <div class="help-cols">
        <section>
          <h3>The goal — Total Domination</h3>
          <p>Fly your banner over <b>every region of Iberia</b>. Win regions two ways:</p>
          <p><b>🕊 Conviction</b> — select any region (click its land) and spend <b>📜 Identity</b> to convert it.
          Slow, suppressed while enemy soldiers camp there… but converted folk stay loyal and extend your culture.</p>
          <p><b>⚔️ Conquest</b> — kill a village's militia and tower, then hold the village with soldiers.
          Fast — but conquered regions pay <b>half tribute</b> and rivals can re-convert them cheaply.</p>
          <p>Raze a rival's <b>capital castle</b> and their whole nation defects to the conqueror.
          Guard your own capital with your life.</p>
        </section>
        <section>
          <h3>Trackpad controls</h3>
          <p>🖐 <b>Two-finger scroll</b> pan · <b>pinch</b> zoom · <b>two-finger tap</b> (right-click) order<br>
          🖱 <b>Click</b> select · <b>drag</b> box-select · <b>Shift</b> add<br>
          ⌨️ <b>WASD/arrows</b> pan · <b>Q/E</b> rotate · <b>+/−</b> zoom · <b>H</b> help · <b>M</b> mute · <b>Esc</b> cancel</p>
          <h3>Economy</h3>
          <p>Workers chop <b>🪵 forests</b>, tend <b>🌾 farms</b>, dig <b>🪙 mines</b> by mountains, and cast nets at
          <b>fish shoals</b> (ripples on the coast). <b>📜 Identity</b> flows from your capital, churches and festival halls
          — it is the currency of nationhood. Owning regions pays their historical tribute; houses raise your population cap.</p>
          <h3>Eras</h3>
          <p>County → Kingdom → Golden Age. Advance at your capital: unlocks buildings and your nation's
          signature power. Blacksmith forges attack & armor upgrades.</p>
        </section>
        </div>
        <h3>The five nations</h3>
        <table class="help-factions">${factionRows}</table>
        <button id="help-close" class="big-btn">To arms! (H)</button>
      </div>`;
    this.el.helpOverlay.querySelector('#help-close').onclick = () => this.toggleHelp();
  }

  toggleHelp() {
    const h = this.el.helpOverlay;
    const opening = h.classList.contains('hidden');
    h.classList.toggle('hidden');
    this.audio.play(opening ? 'ui_open' : 'ui_close', { volume: 0.5 });
  }

  // ---------- alerts ----------
  alert(text, { x = null, z = null, color = null, ttl = 7 } = {}) {
    const div = document.createElement('div');
    div.className = 'alert-item panel';
    div.textContent = text;
    if (color) div.style.borderLeft = `3px solid ${color}`;
    if (x != null) {
      div.style.cursor = 'pointer';
      div.onclick = () => this.rig.jumpTo(x, z);
    }
    this.el.alerts.prepend(div);
    setTimeout(() => { div.classList.add('fade'); setTimeout(() => div.remove(), 800); }, ttl * 1000);
    while (this.el.alerts.children.length > 5) this.el.alerts.lastChild.remove();
  }

  handleEvent(ev, world) {
    const my = id => id === this.humanId;
    const fname = id => id ? FACTIONS[id].name : 'The rebels';
    const fcolor = id => id ? `#${FACTIONS[id].color.toString(16).padStart(6, '0')}` : '#999';
    switch (ev.type) {
      case 'under_attack':
        if (my(ev.owner)) this.alert('⚠️ We are under attack!', { x: ev.x, z: ev.z, color: '#ff6b57' });
        this.pingMinimap(ev.x, ev.z);
        break;
      case 'region_flipped': {
        const r = world.regions[ev.region];
        const how = ev.how === 'conviction' ? 'embraces' : ev.how === 'defection' ? 'defects to' : 'falls to';
        this.alert(`🏳️ ${r.meta.name} ${how} ${fname(ev.owner)}`, { x: r.center.x, z: r.center.z, color: fcolor(ev.owner) });
        break;
      }
      case 'conversion_started': {
        const r = world.regions[ev.region];
        if (r.owner === this.humanId) {
          this.alert(`🕊 Foreign ideas spread in ${r.meta.name} — garrison it!`, { x: r.center.x, z: r.center.z, color: fcolor(ev.owner) });
        }
        break;
      }
      case 'conquest_started': {
        const r = world.regions[ev.region];
        if (r.owner === this.humanId) {
          this.alert(`⚔️ ${fname(ev.owner)} storms ${r.meta.name}!`, { x: r.center.x, z: r.center.z, color: '#ff6b57' });
        }
        break;
      }
      case 'era_advanced':
        this.alert(my(ev.owner)
          ? `👑 We enter the ${ev.name} era — ${FACTIONS[ev.owner].eraTech}!`
          : `${fname(ev.owner)} enter the ${ev.name} era`, { color: fcolor(ev.owner) });
        break;
      case 'nation_fell':
        this.alert(`💀 The ${fname(ev.owner)} have fallen${ev.conqueror ? ` to ${fname(ev.conqueror)}` : ''}!`, { color: '#ff6b57', ttl: 12 });
        break;
      case 'victory':
        this.showEnd(ev.owner);
        break;
      case 'ui_error':
        this.alert(`✋ ${ev.message}`, { ttl: 3.5 });
        break;
    }
  }

  // ---------- end screen ----------
  showEnd(winner) {
    if (this.ended) return;
    this.ended = true;
    const won = winner === this.humanId;
    const f = FACTIONS[winner];
    const mins = Math.round(this.world.time / 60);
    this.el.endOverlay.classList.remove('hidden');
    this.el.endOverlay.innerHTML = `
      <div class="end-box panel">
        <h1>${won ? '🏆 TOTAL DOMINATION' : '⛓️ IBERIA IS LOST'}</h1>
        <p class="end-sub">${won
        ? `All of Iberia flies the ${f.name} banner. ${f.motto}.`
        : `The peninsula belongs to the ${f?.name ?? 'rebels'}. Your story becomes a song of resistance.`}</p>
        <p>${mins} minutes · ${Object.values(this.world.regions).filter(r => r.owner === this.humanId).length} regions held at the end</p>
        <button class="big-btn" onclick="location.reload()">Play again</button>
      </div>`;
  }

  // when the player's own capital falls but others fight on
  showPlayerFell(conqueror) {
    if (this.ended) return;
    this.ended = true;
    const f = conqueror ? FACTIONS[conqueror] : null;
    this.el.endOverlay.classList.remove('hidden');
    this.el.endOverlay.innerHTML = `
      <div class="end-box panel">
        <h1>⛓️ THE CAPITAL HAS FALLEN</h1>
        <p class="end-sub">${f ? `The ${f.name} banner flies over your castle.` : 'Your nation is broken.'}
        The dream of independence waits for another century.</p>
        <button class="big-btn" onclick="location.reload()">Play again</button>
      </div>`;
  }

  // ---------- minimap ----------
  renderMinimapBase() {
    const c = document.createElement('canvas');
    c.width = this.el.minimap.width; c.height = this.el.minimap.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#27506e';
    ctx.fillRect(0, 0, c.width, c.height);
    const { sx, sy } = this.minimapScale();
    for (const t of this.world.tiles) {
      if (t.terrain === 'sea') continue;
      const { x, z } = tileToWorld(t.col, t.row);
      ctx.fillStyle = { grass: '#8ea44c', forest: '#4e7a34', hills: '#a3a465', mountain: '#8d8d88' }[t.terrain];
      ctx.fillRect(x * sx - 2.2, z * sy - 2.2, 4.4, 4.4);
    }
    return c;
  }

  minimapScale() {
    const w = tileToWorld(MAP_W - 1, MAP_H - 1);
    return { sx: this.el.minimap.width / (w.x + 2), sy: this.el.minimap.height / (w.z + 2) };
  }

  minimapJump(e) {
    const r = this.el.minimap.getBoundingClientRect();
    const { sx, sy } = this.minimapScale();
    this.rig.jumpTo((e.clientX - r.left) / r.width * this.el.minimap.width / sx,
      (e.clientY - r.top) / r.height * this.el.minimap.height / sy);
  }

  pingMinimap(x, z) {
    this.mmPing = { x, z, t: 3 };
  }

  drawMinimap(dt) {
    const ctx = this.el.minimap.getContext('2d');
    ctx.drawImage(this.minimapBase, 0, 0);
    const { sx, sy } = this.minimapScale();
    // region ownership tint
    for (const region of Object.values(this.world.regions)) {
      if (!region.owner) continue;
      ctx.fillStyle = `#${FACTIONS[region.owner].color.toString(16).padStart(6, '0')}55`;
      for (const t of region.tiles) {
        const { x, z } = tileToWorld(t.col, t.row);
        ctx.fillRect(x * sx - 2.2, z * sy - 2.2, 4.4, 4.4);
      }
    }
    // units
    for (const e of this.world.entities.values()) {
      if (e.type !== 'unit' || e.state === 'dying' || e.owner === '__dead__') continue;
      ctx.fillStyle = e.owner ? `#${FACTIONS[e.owner].color.toString(16).padStart(6, '0')}` : '#ddd';
      ctx.fillRect(e.x * sx - 1, e.z * sy - 1, 2.2, 2.2);
    }
    // camera target
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    const t = this.rig.target;
    ctx.strokeRect(t.x * sx - 9, t.z * sy - 7, 18, 14);
    // ping
    if (this.mmPing && this.mmPing.t > 0) {
      this.mmPing.t -= dt;
      const k = 1 - (this.mmPing.t % 0.8) / 0.8;
      ctx.strokeStyle = `rgba(255,80,60,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.mmPing.x * sx, this.mmPing.z * sy, 3 + k * 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------- selection / region panel ----------
  setRegion(key) { this.regionKey = key; }

  renderSelPanel(selection) {
    const panel = this.el.selPanel;
    const world = this.world;
    const ids = [...selection];
    const ents = ids.map(id => world.entities.get(id)).filter(Boolean);

    let html = '';
    if (ents.length === 0 && this.regionKey) {
      html = this.regionHtml(this.regionKey);
    } else if (ents.length === 1 && ents[0].type === 'building') {
      html = this.buildingHtml(ents[0]);
    } else if (ents.length >= 1) {
      const byKind = {};
      for (const e of ents) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
      const f = FACTIONS[ents[0].owner] ?? null;
      html = `<div class="sp-units">` + Object.entries(byKind).map(([k, n]) =>
        `<span class="sp-unit">${UNIT_ICONS[k] ?? '👤'} ${f?.unitNames?.[k] ?? k} × ${n}</span>`).join('') + `</div>
        <div class="sp-hint">two-finger tap: move · attack · gather · build</div>`;
    }
    panel.classList.toggle('hidden', !html);
    if (html && panel.dataset.html !== html) {
      panel.dataset.html = html;
      panel.innerHTML = html;
      this.wireSelPanel(panel, ents);
    }
  }

  buildingHtml(b) {
    const world = this.world;
    const def = b.kind === 'village' ? { name: 'Village' } : BUILDINGS[b.kind];
    const f = b.owner ? FACTIONS[b.owner] : null;
    const own = b.owner === this.humanId;
    let html = `<div class="sp-title">${def.name}${f ? ` · <span style="color:${hex(f.color)}">${f.name}</span>` : ' · unclaimed'}</div>`;
    html += `<div class="sp-row">❤️ ${Math.ceil(b.hp)}/${b.maxHp}${b.progress < 1 ? ` · 🏗 ${Math.round(b.progress * 100)}%` : ''}</div>`;
    if (own && b.progress >= 1) {
      const p = world.players[this.humanId];
      if (BUILDINGS[b.kind]?.trains) {
        html += `<div class="sp-actions">` + BUILDINGS[b.kind].trains.map(kind => {
          const cost = {};
          for (const [k, v] of Object.entries(UNITS[kind].cost)) {
            cost[k] = Math.round(v * (kind !== 'worker' ? (f.bonus.soldierCostMul ?? 1) : 1));
          }
          return `<button data-train="${kind}">${UNIT_ICONS[kind]} ${f.unitNames[kind] ?? kind}<small>${fmtCost(cost)}</small></button>`;
        }).join('') + `</div>`;
        if (b.trainQueue.length) html += `<div class="sp-row">⏳ training ${b.trainQueue.length} (${Math.round(b.trainQueue[0].t / b.trainQueue[0].time * 100)}%)</div>`;
        html += `<div class="sp-hint">two-finger tap the map to set the rally point</div>`;
      }
      if (b.kind === 'capital') {
        const next = ERAS[p.era + 1];
        if (p.eraTimer != null) html += `<div class="sp-row">👑 Advancing… ${Math.ceil(p.eraTimer)}s</div>`;
        else if (next) html += `<div class="sp-actions"><button data-era="1">👑 ${next.name} era<small>${fmtCost(next.cost)}</small></button></div>`;
        else html += `<div class="sp-row">👑 Golden Age — the summit of your power</div>`;
      }
      if (b.kind === 'blacksmith') {
        html += `<div class="sp-actions">` + Object.entries(SMITH_UPGRADES).map(([key, up]) => {
          const owned = key === 'attack' ? world.players[this.humanId].upgrades.dmg > 0 : world.players[this.humanId].upgrades.armor > 0;
          return owned ? `<span class="sp-row">✅ ${up.name}</span>` : `<button data-smith="${key}">${up.name}<small>${fmtCost(up.cost)}</small></button>`;
        }).join('') + `</div>`;
      }
      if (b.slots) {
        const def2 = BUILDINGS[b.kind];
        html += `<div class="sp-row">👷 ${b.slots.length}/${def2.slots} working — send workers with a two-finger tap</div>`;
      }
    }
    // village → region actions
    const tile = world.tileAt(b.col, b.row);
    if (tile?.region && (b.kind === 'village' || b.kind === 'capital')) {
      html += this.regionHtml(tile.region, true);
    }
    return html;
  }

  regionHtml(key, brief = false) {
    const world = this.world;
    const region = world.regions[key];
    const meta = region.meta;
    const owner = region.owner ? FACTIONS[region.owner] : null;
    let html = `<div class="sp-title">${brief ? '—' : ''} ${meta.name} <small>(${meta.city})</small>
      ${owner ? `· <span style="color:${hex(owner.color)}">${owner.name}${region.resent ? ' (held by force)' : ''}</span>` : '· unclaimed'}</div>`;
    html += `<div class="sp-row">Tribute: ${Object.entries(meta.tribute).map(([k, v]) => `${RES_ICONS[k]}${v}/s`).join(' ')}${region.coastal ? ' · ⚓ coastal' : ''}</div>`;
    if (region.conversion) {
      const f = FACTIONS[region.conversion.pid];
      html += `<div class="sp-row">🕊 ${f.name} converting… ${Math.round(region.conversion.t / 40 * 100)}%${region.conversion.suppressed ? ' (suppressed by garrison)' : ''}</div>`;
    }
    if (region.owner !== this.humanId) {
      const cost = regionConvertCost(world, this.humanId, key);
      const blocked = meta.capitalOf && region.owner === meta.capitalOf && world.players[meta.capitalOf].alive;
      if (!blocked && !region.conversion) {
        html += `<div class="sp-actions"><button data-convert="${key}">🕊 Convert to our cause<small>📜${cost}</small></button></div>`;
      } else if (blocked) {
        html += `<div class="sp-hint">a capital region — raze the castle to break it</div>`;
      }
    }
    return html;
  }

  wireSelPanel(panel, ents) {
    const world = this.world;
    const b = ents[0];
    panel.querySelectorAll('[data-train]').forEach(btn => {
      btn.onclick = () => {
        const err = world.trainUnit(this.humanId, b.id, btn.dataset.train);
        this.audio.play(err ? 'ui_error' : 'ui_click', { volume: 0.6 });
        if (err) this.alert(`✋ ${err}`, { ttl: 3 });
        panel.dataset.html = '';
      };
    });
    panel.querySelectorAll('[data-era]').forEach(btn => {
      btn.onclick = () => {
        const err = world.advanceEra(this.humanId);
        this.audio.play(err ? 'ui_error' : 'era', { volume: 0.7 });
        if (err) this.alert(`✋ ${err}`, { ttl: 3 });
        panel.dataset.html = '';
      };
    });
    panel.querySelectorAll('[data-smith]').forEach(btn => {
      btn.onclick = () => {
        const err = world.buySmithUpgrade(this.humanId, btn.dataset.smith);
        this.audio.play(err ? 'ui_error' : 'ui_click', { volume: 0.6 });
        if (err) this.alert(`✋ ${err}`, { ttl: 3 });
        panel.dataset.html = '';
      };
    });
    panel.querySelectorAll('[data-convert]').forEach(btn => {
      btn.onclick = () => {
        const err = world.startConversion(this.humanId, btn.dataset.convert);
        this.audio.play(err ? 'ui_error' : 'coins', { volume: 0.8 });
        if (err) this.alert(`✋ ${err}`, { ttl: 3 });
        panel.dataset.html = '';
      };
    });
  }

  // ---------- per-frame ----------
  update(dt, selection) {
    this.refresh -= dt;
    if (this.refresh > 0) return;
    this.refresh = 0.25;

    const p = this.world.players[this.humanId];
    // resources
    this.el.resBar.innerHTML = Object.entries(p.res).map(([k, v]) =>
      `<span class="res"><span class="res-ico">${RES_ICONS[k]}</span>${Math.floor(v)}</span>`).join('') +
      `<span class="res"><span class="res-ico">👥</span>${p.pop}/${p.popCap}</span>` +
      `<span class="res era-chip">👑 ${ERAS[p.era].name}${p.eraTimer != null ? ' ⏳' : ''}</span>`;

    // domination
    const regions = Object.values(this.world.regions);
    const total = regions.length;
    let segs = '';
    for (const [fid, f] of Object.entries(FACTIONS)) {
      const n = regions.filter(r => r.owner === fid).length;
      if (n) segs += `<div class="dom-seg" style="width:${n / total * 100}%;background:${hex(f.color)}" title="${f.name}: ${n}"></div>`;
    }
    const neutral = regions.filter(r => !r.owner).length;
    if (neutral) segs += `<div class="dom-seg" style="width:${neutral / total * 100}%;background:#777" title="unclaimed: ${neutral}"></div>`;
    this.el.domSegments.innerHTML = segs;
    const mine = regions.filter(r => r.owner === this.humanId).length;
    this.el.domLabel.textContent = `${mine}/${total} regions — total domination wins`;

    // build menu affordability
    for (const btn of this.el.buildMenu.querySelectorAll('.bm-item')) {
      const kind = btn.dataset.kind;
      const def = BUILDINGS[kind];
      const cost = this.world.buildingCost(this.humanId, kind);
      btn.querySelector('.bm-cost').textContent = fmtCost(cost);
      const eraLocked = def.era && p.era < def.era;
      btn.classList.toggle('locked', !!eraLocked);
      btn.classList.toggle('poor', !eraLocked && !this.world.canAfford(this.humanId, cost));
      if (eraLocked) btn.querySelector('.bm-cost').textContent = `${ERAS[def.era].name} era`;
    }

    this.renderSelPanel(selection);
    this.drawMinimap(0.25);

    // player fell but game continues
    if (!this.ended && !p.alive) this.showPlayerFell(p.lastAttacker);
  }
}

function hex(c) { return `#${c.toString(16).padStart(6, '0')}`; }
