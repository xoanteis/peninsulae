// Nation selection screen shown before the world spawns.

import { FACTIONS } from '../config/factions.js';

export function pickFaction() {
  const preset = new URLSearchParams(location.search).get('faction');
  if (preset && FACTIONS[preset]) return Promise.resolve(preset);

  return new Promise(resolve => {
    const el = document.createElement('div');
    el.id = 'faction-select';
    el.innerHTML = `
      <div class="fs-inner">
        <h1>PENINSULAE</h1>
        <p class="fs-sub">Five nations. One Iberia. Only one banner will fly from Fisterra to Cap de Creus.</p>
        <div class="fs-cards">
          ${Object.entries(FACTIONS).map(([id, f]) => `
            <button class="fs-card" data-id="${id}" style="--fc:#${f.color.toString(16).padStart(6, '0')}">
              <span class="fs-crest"></span>
              <span class="fs-name">${f.name}</span>
              <span class="fs-motto">${f.motto}</span>
              <span class="fs-blurb">${f.blurb}</span>
              <span class="fs-bonus">${f.bonusText}</span>
            </button>`).join('')}
        </div>
        <p class="fs-hint">Castile begins mighty — the other four fight for independence. Press H in game for the full manual.</p>
      </div>`;
    document.body.appendChild(el);
    el.querySelectorAll('.fs-card').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.id;
        const url = new URL(location.href);
        url.searchParams.set('faction', id);
        history.replaceState(null, '', url); // restart keeps the choice
        el.classList.add('fading');
        setTimeout(() => el.remove(), 500);
        resolve(id);
      };
    });
  });
}
