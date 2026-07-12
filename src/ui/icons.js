// Icon vocabulary + cost formatter shared by the HUD shell and the selection panel.

// icon choices are player-tested: 🪵's ring cross-section read as a second coin
// (now 🌲), and 🪙 is too new (2019) — some system fonts draw it as a spiral-marked
// disc or worse, so gold is the ancient, universally-rendered 💰
export const RES_ICONS = { food: '🌾', wood: '🌲', gold: '💰', identity: '📜' };

export const BUILD_ICONS = {
  house: '🏠', farm: '🌾', lumbercamp: '🪚', mine: '⛏️', market: '⚖️', church: '⛪',
  festival: '🎻', barracks: '⚔️', archery: '🏹', tower: '🗼', blacksmith: '🛠️',
};

export const UNIT_ICONS = { worker: '🧑‍🌾', soldier: '⚔️', crossbow: '🏹', militia: '🛡️' };

export const fmtCost = cost => Object.entries(cost).map(([k, v]) => `${RES_ICONS[k] ?? k}${v}`).join(' ') || 'free';
