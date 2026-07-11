// The HUD shell: resources, domination race, build menu, alerts, help overlay,
// end screen. The minimap and selection/region panel are their own widgets
// (minimap.js, selpanel.js); global hotkeys live in hotkeys.js. DOM-only;
// reads sim state.

import { FACTIONS, cssColor } from '../config/factions.js';
import { BUILDINGS, UNITS, ERAS, REPAIR } from '../config/rules.js';
import { tileToWorld } from '../sim/hex.js';
import { Minimap } from './minimap.js';
import { SelectionPanel } from './selpanel.js';
import { RES_ICONS, BUILD_ICONS, fmtCost } from './icons.js';

const BUILD_ORDER = ['house', 'farm', 'lumbercamp', 'mine', 'market', 'church', 'barracks', 'tower', 'archery', 'blacksmith', 'festival'];

export class HUD {
  constructor({ root, world, humanId, controls, rig, audio, recorder }) {
    this.world = world;
    this.humanId = humanId;
    this.controls = controls;
    this.rig = rig;
    this.audio = audio;
    this.recorder = recorder;
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
      <div id="vignette"></div>
    `;
    this.el = Object.fromEntries(
      ['res-bar', 'domination', 'dom-segments', 'dom-label', 'alerts', 'minimap', 'sel-panel',
        'build-menu', 'place-hint', 'help-overlay', 'end-overlay', 'btn-help', 'btn-mute']
        .map(id => [id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), document.getElementById(id)])
    );

    this.buildBuildMenu();
    this.buildHelp();
    this.controls.onPlacingChange = () => this.updatePlaceHint();
    this.el.btnHelp.title = 'How to play (F1)';
    this.el.btnHelp.onclick = () => this.toggleHelp();
    this.el.btnMute.onclick = () => this.toggleMute();
    // the 💤/🏠/🔧 badges are re-rendered into the res-bar every refresh, so delegate clicks
    this.el.resBar.addEventListener('click', e => {
      if (e.target.closest('#idle-badge')) this.controls.cycleIdleWorker();
      if (e.target.closest('#repair-badge')) this.controls.cycleDamagedBuilding();
      if (e.target.closest('#pop-badge')) {
        this.audio.play('ui_click', { volume: 0.5 });
        this.controls.setPlacing('house');
      }
    });

    // command bar: army commands for touch AND mouse. Desktop used to rely on
    // keyboard alone — attack-move went unused across two whole human games
    // because F+click only existed in the help screen.
    {
      const bar = document.createElement('div');
      bar.id = 'touch-bar';
      bar.className = 'panel';
      bar.innerHTML = `
        <button id="tb-army" title="select army on screen (E)">👥</button>
        <button id="tb-amove" title="attack-move (F): arm, then click the map — the army fights on the way">⚔</button>
        <button id="tb-stop" title="stop (X)">⏹</button>`;
      root.appendChild(bar);
      bar.querySelector('#tb-army').onclick = () => { this.audio.play('ui_click', { volume: 0.4 }); this.controls.selectSoldiersOnScreen(); };
      bar.querySelector('#tb-amove').onclick = () => {
        const btn = bar.querySelector('#tb-amove');
        this.controls.amove = !this.controls.amove;
        btn.classList.toggle('active', this.controls.amove);
        this.audio.play('ui_click', { volume: 0.4 });
        if (this.controls.amove) this.alert('⚔ Attack-move armed — click where the army should sweep', { ttl: 4 });
      };
      bar.querySelector('#tb-stop').onclick = () => {
        const ids = this.controls.myUnitIds();
        if (ids.length) this.controls.onOrder({ type: 'stop', ids });
      };
    }

    this.minimap = new Minimap({ canvas: this.el.minimap, world, rig, controls });
    this.selPanel = new SelectionPanel({
      el: this.el.selPanel, world, humanId, controls, audio,
      alert: (text, opts) => this.alert(text, opts),
    });

    this.alertsData = [];

    // opening tips for the first minutes of a match
    const wnames = FACTIONS[humanId ?? this.humanId]?.unitNames?.workers ?? 'workers';
    this.tips = [
      { at: 3, text: `🏰 Select your Capital and train ${wnames} — send them to forests 🌲 and fishing ripples 🐟 (long-press / right-click)` },
      { at: 28, text: '🛡 Neutral villages defend themselves — their towers fire at anyone who comes close. Keep clear until you bring soldiers, or convert the region peacefully with 📜' },
      { at: 42, text: '⛏ Scattered rocks mark the ground beside the sierra — build a Mine on such a tile to dig gold. Forests, shoals and farms cover the rest' },
      { at: 60, text: '🌾 Build Farms and Houses (bottom-right menu) — a worker starts raising it at once. Click any region to see its tribute and the 🕊 Convert action' },
      { at: 95, text: '⚔️ Castile is coming. Raise a Barracks and watchtowers before the Kingdom era — or out-convert everyone first' },
      { at: 150, text: '⚔ Armies attack-move by default — they fight everything on the way. Alt+right-click marches them PAST enemies without engaging' },
    ];
  }

  // hotkey targets (see hotkeys.js) ------------------------------------------
  toggleMute() {
    const muted = this.audio.toggleMute();
    this.el.btnMute.textContent = muted ? '🔇' : '🔊';
  }

  jumpHome() {
    const cap = this.world.entities.get(this.world.players[this.humanId].capitalId);
    if (cap) this.rig.jumpTo(cap.x, cap.z);
  }

  jumpToLastAlert() {
    if (this.lastPing) this.rig.jumpTo(this.lastPing.x, this.lastPing.z);
  }

  // widget delegates (main.js and the check suite talk to the HUD) -----------
  setRegion(key) { this.selPanel.setRegion(key); }
  renderSelPanel(selection) { this.selPanel.render(selection); }
  regionHtml(key, brief) { return this.selPanel.regionHtml(key, brief); }
  drawMinimap(dt) { this.minimap.draw(dt); }
  pingMinimap(x, z) { this.minimap.ping(x, z); }

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
        if (!this.ownsWorker()) {
          const wnames = FACTIONS[this.humanId]?.unitNames?.workers ?? 'workers';
          this.audio.play('ui_error', { volume: 0.5 });
          this.alert(`🔨 Only ${wnames} build — train one at your Capital first`, { ttl: 3.5 });
          return;
        }
        this.audio.play('ui_click');
        this.controls.setPlacing(this.controls.placing === kind ? null : kind);
      };
      grid.appendChild(b);
    }
  }

  // building needs hands. A worker in the selection builds it directly; if none
  // is selected, placement drafts the nearest one — so the gate is "own a worker".
  hasBuilder() {
    return [...this.controls.selection].some(id => {
      const e = this.world.entities.get(id);
      return e && e.kind === 'worker' && e.owner === this.humanId && e.state !== 'dying';
    });
  }

  ownsWorker() {
    return this.world.workersOf(this.humanId).length > 0;
  }

  updatePlaceHint() {
    const k = this.controls.placing;
    this.el.placeHint.classList.toggle('hidden', !k);
    if (k) {
      // short by default; the drafting behavior is only worth words when it applies
      const wname = FACTIONS[this.humanId]?.unitNames?.worker ?? 'worker';
      const who = this.hasBuilder() ? '' : ` · drafts your nearest ${wname}`;
      this.el.placeHint.textContent = `Placing ${BUILDINGS[k].name}${who} · Shift-click for more · Esc to cancel`;
    }
    for (const b of this.el.buildMenu.querySelectorAll('.bm-item')) {
      b.classList.toggle('active', b.dataset.kind === k);
    }
  }

  // ---------- help ----------
  buildHelp() {
    const factionRows = Object.values(FACTIONS).map(f => `
      <tr><td style="color:${cssColor(f.color)}">${f.name}</td>
      <td><em>${f.motto}</em></td><td>${f.bonusText}</td></tr>`).join('');
    this.el.helpOverlay.innerHTML = `
      <div class="help-box panel">
        <h2>How to play</h2>
        <div class="help-cols">
        <section>
          <h3>The goal — Total Domination</h3>
          <p>Fly your banner over <b>every region of Iberia</b>. Win regions two ways:</p>
          <p><b>🕊 Conviction</b> — select any region (click its land) and spend <b>📜 Identity</b> to convert it.
          Slow, suppressed while enemy soldiers camp there… but converted folk stay loyal, extend your culture,
          and <b>resist conquest twice as long</b>. The wider your realm already is, the costlier each new conversion.</p>
          <p><b>⚔️ Conquest</b> — kill a village's militia and tower, then hold the village with soldiers.
          Fast — but conquered regions pay <b>reduced tribute</b> and rivals can re-convert them cheaply.</p>
          <p>Raze a rival's <b>capital castle</b> and their nation falls: conquered borderlands defect
          to the conqueror, but regions won by conviction <b>rise free again</b> — faith does not
          transfer at swordpoint. Guard your own capital with your life.</p>
        </section>
        <section>
          <h3>Controls</h3>
          <p>🖱 <b>Click</b> select · <b>double-click</b> all of that type · <b>drag</b> box-select · <b>Shift</b> add<br>
          <b>Right-click</b> order (armies attack-move · workers gather/build · <b>Alt</b>+right-click plain move) · <b>right-drag</b> or <b>screen edge</b> pan · <b>wheel</b> zoom<br>
          ⌨️ <b>Ctrl+1–9</b> assign group · <b>1–9</b> recall (double-tap centers) · <b>F</b>+click attack-move (mixed groups) ·
          <b>X</b> stop · <b>E</b> all soldiers on screen · <b>.</b> idle worker · <b>P</b> pause ·
          <b>H</b> home · <b>Space</b> last alert<br>
          <b>WASD/arrows</b> pan · <b>Q/R</b> rotate · <b>+/−</b> zoom · <b>F1</b> help · <b>F2</b> save match log · <b>M</b> mute · <b>Esc</b> cancel<br>
          🖐 <b>Trackpad:</b> two-finger scroll pans · pinch zooms · two-finger tap orders<br>
          📱 <b>Touch:</b> drag pan · pinch zoom · tap select · <b>long-press</b> order (landscape recommended)</p>
          <h3>Economy</h3>
          <p>Workers chop <b>🌲 forests</b> (cut groves regrow after a few minutes), tend <b>🌾 farms</b>, dig <b>💰 gold mines</b> by mountains, and cast nets at
          <b>fish shoals</b> (ripples on the coast). <b>📜 Identity</b> flows from your capital, churches and festival halls
          — it is the currency of nationhood. Owning regions pays their historical tribute; houses raise your population cap.</p>
          <p>There is <b>no stone</b>: rocks and the sierra itself can't be gathered — but a <b>⛏ Mine built beside a
          mountain</b> turns it into gold. Only workers build: place a building and a worker starts raising it at once
          (whichever you've selected, or the nearest one otherwise). Soldiers can't build.</p>
          <p><b>🔧 Repair</b> — right-click a damaged building with workers selected and they mend it
          (masonry costs a little wood). A tower under siege can be kept standing by the workers behind it.</p>
          <h3>Eras</h3>
          <p>County → Kingdom → Golden Age. Advance at your capital: the <b>Kingdom</b> era unlocks
          buildings and your nation's signature power; the <b>Golden Age</b> sharpens every blade in the
          nation. Blacksmith forges attack & armor upgrades.</p>
        </section>
        </div>
        <h3>The five nations</h3>
        <table class="help-factions">${factionRows}</table>
        <button id="help-close" class="big-btn">To arms! (F1)</button>
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
    const fcolor = id => id ? cssColor(FACTIONS[id].color) : '#999';
    switch (ev.type) {
      case 'under_attack':
        if (my(ev.owner)) {
          this.alert('⚠️ We are under attack!', { x: ev.x, z: ev.z, color: '#ff6b57' });
          this.flashVignette();
          this.rig.addShake(0.25);
          this.lastPing = { x: ev.x, z: ev.z };
        }
        this.pingMinimap(ev.x, ev.z);
        break;
      case 'building_destroyed':
        if (my(ev.owner)) {
          this.flashVignette();
          this.rig.addShake(0.6);
        }
        break;
      case 'forest_grown': {
        // teach the mechanic once — dozens of tiles regrow per game, one alert suffices
        if (this.sawRegrow) break;
        this.sawRegrow = true;
        const g = tileToWorld(ev.col, ev.row);
        this.alert('🌲 A cut grove has regrown — forests return in a few minutes', { x: g.x, z: g.z, ttl: 8 });
        break;
      }
      case 'worker_idle': {
        if (!my(ev.owner)) break;
        if (ev.reason === 'slots_full') {
          // direct answer to a player order — its own (short) throttle, not the 15s one
          if (this.lastSlotsFullAlert && world.time - this.lastSlotsFullAlert < 4) break;
          this.lastSlotsFullAlert = world.time;
          const bname = BUILDINGS[ev.kind]?.name ?? 'building';
          this.alert(`👷 The ${bname} is full — the extra worker stands idle 💤`, { x: ev.x, z: ev.z, ttl: 5 });
          break;
        }
        if (this.lastIdleAlert && world.time - this.lastIdleAlert < 15) break;
        this.lastIdleAlert = world.time;
        this.alert(`💤 A worker stands idle — click the badge (or press .)`, { x: ev.x, z: ev.z, ttl: 6 });
        break;
      }
      case 'region_flipped': {
        const r = world.regions[ev.region];
        this.pingMinimap(r.center.x, r.center.z);
        if (ev.how === 'shattered') {
          this.alert(`🏳️ ${r.meta.name} rises free — its villagers reclaim it`, { x: r.center.x, z: r.center.z, color: '#999' });
          this.lastPing = { x: r.center.x, z: r.center.z };
          break;
        }
        const foru = ev.how === 'conquest' && FACTIONS[ev.owner]?.bonus.foruPact;
        const how = ev.how === 'conviction' ? 'embraces'
          : ev.how === 'defection' ? 'defects to'
          : foru ? 'signs the foru with' : 'falls to';
        this.alert(`🏳️ ${r.meta.name} ${how} ${fname(ev.owner)}`, { x: r.center.x, z: r.center.z, color: fcolor(ev.owner) });
        this.lastPing = { x: r.center.x, z: r.center.z };
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
        if (!ev.owner || my(ev.owner)) this.alert(`✋ ${ev.message}`, { ttl: 3.5 });
        break;
    }
  }

  setPaused(paused) {
    let chip = document.getElementById('pause-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'pause-chip';
      chip.className = 'panel';
      chip.textContent = '⏸ PAUSED — press P to resume';
      document.getElementById('hud').appendChild(chip);
    }
    chip.style.display = paused ? 'block' : 'none';
  }

  flashVignette() {
    const v = document.getElementById('vignette');
    v.classList.remove('on');
    void v.offsetWidth; // restart the animation
    v.classList.add('on');
  }

  // ---------- end screen ----------
  showEnd(winner) {
    if (this.ended) return;
    this.ended = true;
    const won = winner === this.humanId;
    const draw = winner == null || winner === '__none__';
    const f = draw ? null : FACTIONS[winner];
    const mins = Math.round(this.world.time / 60);
    this.el.endOverlay.classList.remove('hidden');
    this.el.endOverlay.innerHTML = `
      <div class="end-box panel">
        <h1>${won ? '🏆 TOTAL DOMINATION' : draw ? '💀 MUTUAL RUIN' : '⛓️ IBERIA IS LOST'}</h1>
        <p class="end-sub">${won
        ? `All of Iberia flies the ${f.name} banner. ${f.motto}.`
        : draw ? 'The last two crowns fell in the same hour. No banner flies; the villages rebuild alone.'
          : `The peninsula belongs to the ${f?.name ?? 'rebels'}. Your story becomes a song of resistance.`}</p>
        <p>${mins} minutes · ${Object.values(this.world.regions).filter(r => r.owner === this.humanId).length} regions held at the end</p>
        <button class="big-btn" id="btn-again">Play again</button>
        <button class="big-btn" id="btn-matchlog">📜 Save match log</button>
      </div>`;
    this.wireMatchLog();
  }

  // the log feeds tools/analyze-match.mjs — how a human game gets studied.
  // (buttons are wired here, not with onclick= attributes — the CSP forbids
  // inline handlers)
  wireMatchLog() {
    const btn = this.el.endOverlay.querySelector('#btn-matchlog');
    if (btn) btn.onclick = () => this.recorder?.download();
    const again = this.el.endOverlay.querySelector('#btn-again');
    if (again) again.onclick = () => location.reload();
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
        <button class="big-btn" id="btn-again">Play again</button>
        <button class="big-btn" id="btn-spectate">👁 Watch the war play out</button>
        <button class="big-btn" id="btn-matchlog">📜 Save match log</button>
      </div>`;
    this.wireMatchLog();
    // spectating: hide the verdict, keep the world running — a new end screen
    // will rise when someone actually wins
    this.el.endOverlay.querySelector('#btn-spectate').onclick = () => {
      this.el.endOverlay.classList.add('hidden');
      this.ended = false;       // allow the final victory screen
      this.spectating = true;   // but never re-show the "you fell" screen
    };
  }

  // ---------- per-frame ----------
  update(dt, selection) {
    this.refresh -= dt;
    if (this.refresh > 0) return;
    this.refresh = 0.25;

    while (this.tips.length && this.world.time >= this.tips[0].at) {
      this.alert(this.tips.shift().text, { ttl: 16 });
    }

    const p = this.world.players[this.humanId];
    // resources + action badges (💤 idle workers · 🏠 housing · 🔧 damaged buildings)
    const idleW = this.world.workersOf(this.humanId, { idleOnly: true }).length;
    let queuedPop = 0, hurtN = 0;
    for (const e of this.world.entities.values()) {
      if (e.type === 'building' && e.owner === this.humanId && e.progress >= 1) {
        for (const job of e.trainQueue) queuedPop += UNITS[job.kind]?.pop ?? 0;
        if (e.hp < e.maxHp * REPAIR.damagedFrac) hurtN++;
      }
    }
    // predictive: warn when the QUEUE will outrun housing, not when it already has
    const popState = p.pop >= p.popCap ? 'blocked' : (p.pop + queuedPop > p.popCap ? 'soon' : null);
    this.el.resBar.innerHTML = Object.entries(p.res).map(([k, v]) =>
      `<span class="res" title="${k}"><span class="res-ico">${RES_ICONS[k]}</span>${Math.floor(v)}</span>`).join('') +
      `<span class="res" title="population / housing cap"><span class="res-ico">👥</span>${p.pop}/${p.popCap}</span>` +
      (popState ? `<span class="res pop-badge${popState === 'soon' ? ' pop-soon' : ''}" id="pop-badge" title="${popState === 'blocked'
        ? 'Population capped — training is blocked. Click to place a 🏠 House'
        : 'Queued units will outrun the housing cap — click to place a 🏠 House ahead of need'}">🏠!</span>` : '') +
      (hurtN ? `<span class="res repair-chip" id="repair-badge" title="damaged buildings — click to cycle them; right-click one with a worker to repair (costs wood)">🔧${hurtN}</span>` : '') +
      (idleW ? `<span class="res idle-chip" id="idle-badge" title="idle workers — click (or press .) to cycle through them">💤${idleW}</span>` : '') +
      `<span class="res era-chip">👑 ${ERAS[p.era].name}${p.eraTimer != null ? ' ⏳' : ''}</span>`;

    // domination
    const regions = Object.values(this.world.regions);
    const total = regions.length;
    let segs = '';
    for (const [fid, f] of Object.entries(FACTIONS)) {
      const n = regions.filter(r => r.owner === fid).length;
      if (n) segs += `<div class="dom-seg" style="width:${n / total * 100}%;background:${cssColor(f.color)}" title="${f.name}: ${n}"></div>`;
    }
    const neutral = regions.filter(r => !r.owner).length;
    if (neutral) segs += `<div class="dom-seg" style="width:${neutral / total * 100}%;background:#777" title="unclaimed: ${neutral}"></div>`;
    this.el.domSegments.innerHTML = segs;
    const mine = regions.filter(r => r.owner === this.humanId).length;
    this.el.domLabel.textContent = `${mine}/${total} regions — total domination wins`;

    // build menu affordability (and whether the nation has a worker to build at all)
    const canBuild = this.ownsWorker();
    const bmTitle = this.el.buildMenu.querySelector('.bm-title');
    if (bmTitle) {
      const wname = FACTIONS[this.humanId]?.unitNames?.worker ?? 'worker';
      bmTitle.textContent = canBuild ? 'Build' : `Build — need a ${wname}`;
    }
    for (const btn of this.el.buildMenu.querySelectorAll('.bm-item')) {
      const kind = btn.dataset.kind;
      const def = BUILDINGS[kind];
      const cost = this.world.buildingCost(this.humanId, kind);
      btn.querySelector('.bm-cost').textContent = fmtCost(cost);
      const eraLocked = def.era && p.era < def.era;
      btn.classList.toggle('locked', !!eraLocked);
      btn.classList.toggle('poor', !eraLocked && !this.world.canAfford(this.humanId, cost));
      btn.classList.toggle('needsworker', !canBuild);
      if (eraLocked) btn.querySelector('.bm-cost').textContent = `${ERAS[def.era].name} era`;
    }

    this.renderSelPanel(selection);
    this.drawMinimap(0.25);

    // player fell but game continues
    if (!this.ended && !p.alive) this.showPlayerFell(p.lastAttacker);
  }
}
