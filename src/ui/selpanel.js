// The selection / region panel: what's selected, train buttons and queue,
// era/smith/convert actions, region allegiance. Reads sim state, issues
// commands through World's methods, and asks the sim for every price and
// rule it displays — the panel never re-derives a formula the sim owns.

import { FACTIONS, cssColor } from '../config/factions.js';
import { BUILDINGS, ERAS, SMITH_UPGRADES, CONVICTION } from '../config/rules.js';
import { regionConvertCost, enemiesInRegion, capitalStands } from '../sim/regions.js';
import { RES_ICONS, UNIT_ICONS, fmtCost } from './icons.js';

export class SelectionPanel {
  constructor({ el, world, humanId, controls, audio, alert }) {
    this.el = el;
    this.world = world;
    this.humanId = humanId;
    this.controls = controls;
    this.audio = audio;
    this.alert = alert;
    this.regionKey = null;
  }

  setRegion(key) { this.regionKey = key; }

  render(selection) {
    const panel = this.el;
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
      const yours = ents.some(e => e.owner === this.humanId);
      html = `<div class="sp-units">` + Object.entries(byKind).map(([k, n]) =>
        `<span class="sp-unit">${UNIT_ICONS[k] ?? '👤'} ${f?.unitNames?.[k] ?? k} × ${n}</span>`).join('') + `</div>`
        + (yours ? `<div class="sp-hint">two-finger tap: move · attack · gather · build</div>`
          : `<div class="sp-hint">${f ? f.name : 'neutral'} — not under your command</div>`);
    }
    panel.classList.toggle('hidden', !html);
    if (html && panel.dataset.html !== html) {
      panel.dataset.html = html;
      panel.innerHTML = html;
      this.wire(panel, ents);
    }
    if (html) {
      // per-tick numbers are patched into stable spans instead of being part of
      // the structural html — a full rebuild mid-click would swallow the press
      const b0 = ents.length === 1 && ents[0].type === 'building' ? ents[0] : null;
      const pct = panel.querySelector('.sp-pct');
      if (pct && b0?.trainQueue?.length) {
        pct.textContent = `${Math.round(b0.trainQueue[0].t / b0.trainQueue[0].time * 100)}%`;
      }
      const timer = panel.querySelector('.sp-timer');
      const t = this.world.players[this.humanId].eraTimer;
      if (timer && t != null) timer.textContent = Math.ceil(t);
    }
  }

  buildingHtml(b) {
    const world = this.world;
    const def = BUILDINGS[b.kind];
    const f = b.owner ? FACTIONS[b.owner] : null;
    const own = b.owner === this.humanId;
    let html = `<div class="sp-title">${def.name}${f ? ` · <span style="color:${cssColor(f.color)}">${f.name}</span>` : ' · unclaimed'}</div>`;
    html += `<div class="sp-row">❤️ ${Math.ceil(b.hp)}/${b.maxHp}${b.progress < 1 ? ` · 🏗 ${Math.round(b.progress * 100)}%` : ''}</div>`;
    if (own && b.progress >= 1) {
      const p = world.players[this.humanId];
      if (def.trains) {
        html += `<div class="sp-actions">` + def.trains.map(kind => {
          const cost = world.unitCost(this.humanId, kind);
          return `<button data-train="${kind}">${UNIT_ICONS[kind]} ${f.unitNames[kind] ?? kind}<small>${fmtCost(cost)}</small></button>`;
        }).join('') + `</div>`;
        // the queue row is ALWAYS rendered, with free slots marked: the panel is
        // bottom-anchored, so any height change shoves the train buttons up from
        // under a spam-clicking cursor. Chips group by kind (×N) so a full queue
        // fits the fixed-width row; ✕ refunds the group's newest job. The live %
        // sits in a span updated in place (render) — in this html it would
        // rebuild the panel every tick and eat clicks. Cap of 10 mirrors trainUnit.
        const groups = [];
        b.trainQueue.forEach((job, i) => {
          const g = groups[groups.length - 1];
          if (g && g.kind === job.kind) { g.n++; g.last = i; }
          else groups.push({ kind: job.kind, n: 1, first: i, last: i });
        });
        html += `<div class="sp-row sp-queue">⏳ ` + groups.map(g =>
          `<button class="sp-chip" data-cancel="${g.last}" title="cancel & refund the newest">${UNIT_ICONS[g.kind] ?? '👤'}${g.first === 0 ? ` <span class="sp-pct"></span>` : ''}${g.n > 1 ? ` ×${g.n}` : ''} ✕</button>`
        ).join('') + `<span class="sp-free">${'·'.repeat(Math.max(0, 10 - b.trainQueue.length))}</span></div>`;
        html += `<div class="sp-hint">two-finger tap the map to set the rally point</div>`;
      }
      if (b.kind === 'capital') {
        const next = ERAS[p.era + 1];
        if (p.eraTimer != null) html += `<div class="sp-row">👑 Advancing… <span class="sp-timer"></span>s</div>`;
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
        const yields = Object.keys(def.slotRate).map(k => `${RES_ICONS[k]} ${k}`).join(' ');
        html += `<div class="sp-row">👷 ${b.slots.length}/${def.slots} working — yields ${yields} · staff with right-click / two-finger tap</div>`;
      }
    }
    // every building anchors a region — show its allegiance and actions
    const tile = world.tileAt(b.col, b.row);
    if (tile?.region) {
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
      ${owner ? `· <span style="color:${cssColor(owner.color)}">${owner.name}${region.resent ? ' (held by force)' : ''}</span>` : '· unclaimed'}</div>`;
    html += `<div class="sp-row">Tribute: ${Object.entries(meta.tribute).map(([k, v]) => `${RES_ICONS[k]}${v}/s`).join(' ')}${region.coastal ? ' · ⚓ coastal' : ''}</div>`;
    if (region.conversion) {
      const f = FACTIONS[region.conversion.pid];
      html += `<div class="sp-row">🕊 ${f.name} converting… ${Math.round(region.conversion.t / CONVICTION.time * 100)}%${region.conversion.suppressed ? ' (suppressed by garrison)' : ''}</div>`;
    }
    if (region.conquest) {
      const f = FACTIONS[region.conquest.pid];
      html += `<div class="sp-row">⚔️ <span style="color:${cssColor(f.color)}">${f.name}</span> seizing the village…</div>`;
    }
    if (region.owner !== this.humanId) {
      const cost = regionConvertCost(world, this.humanId, key);
      const blocked = capitalStands(world, region);
      if (!blocked && !region.conversion) {
        // warn BEFORE the identity is spent — a paid sermon stalls under a garrison
        const foes = enemiesInRegion(world, region, this.humanId).length;
        html += `<div class="sp-actions"><button data-convert="${key}">🕊 Convert to our cause<small>📜${cost}</small></button></div>`;
        if (foes) html += `<div class="sp-hint">⚠️ enemy soldiers camp here — conversion will stall until they leave</div>`;
        const owned = Object.values(world.regions).filter(r => r.owner === this.humanId).length;
        if (owned > 2) html += `<div class="sp-hint">a wide realm raises the price of each new conversion</div>`;
      } else if (blocked) {
        html += `<div class="sp-hint">a capital region — raze the castle to break it</div>`;
      }
    }
    return html;
  }

  // rebuild the panel NOW, inside the click handler — deferring to the next
  // update tick risks replacing the button mid-press and eating the click
  refresh() {
    this.el.dataset.html = '';
    this.render(this.controls.selection);
  }

  wire(panel, ents) {
    const world = this.world;
    const b = ents[0];
    const act = (btn, run, { okSound = 'ui_click', volume = 0.6, alertErr = true } = {}) => {
      btn.onclick = () => {
        const err = run();
        this.audio.play(err ? 'ui_error' : okSound, { volume });
        if (err && alertErr) this.alert(`✋ ${err}`, { ttl: 3 });
        this.refresh();
      };
    };
    panel.querySelectorAll('[data-train]').forEach(btn =>
      act(btn, () => world.trainUnit(this.humanId, b.id, btn.dataset.train)));
    panel.querySelectorAll('[data-cancel]').forEach(btn =>
      act(btn, () => world.cancelTrain(this.humanId, b.id, Number(btn.dataset.cancel)), { alertErr: false }));
    panel.querySelectorAll('[data-era]').forEach(btn =>
      act(btn, () => world.advanceEra(this.humanId), { okSound: 'era', volume: 0.7 }));
    panel.querySelectorAll('[data-smith]').forEach(btn =>
      act(btn, () => world.buySmithUpgrade(this.humanId, btn.dataset.smith)));
    panel.querySelectorAll('[data-convert]').forEach(btn =>
      act(btn, () => world.startConversion(this.humanId, btn.dataset.convert), { okSound: 'coins', volume: 0.8 }));
  }
}
