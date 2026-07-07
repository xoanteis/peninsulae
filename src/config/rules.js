// Unit, building, era and region rules. One tile = one building.
// All rates are per second; the sim ticks at TICK_MS.

export const TICK_MS = 100;

export const UNITS = {
  worker: {
    hp: 45, dmg: 3, armor: 0, speed: 2.9, range: 0.55, attackTime: 1.1,
    cost: { food: 55 }, trainTime: 9, pop: 1,
    gatherRate: 0.85, buildRate: 0.10, // construction progress /s
  },
  soldier: {
    hp: 95, dmg: 12, armor: 1, speed: 2.65, range: 0.62, attackTime: 1.05,
    cost: { food: 60, gold: 20 }, trainTime: 11, pop: 1, aggroRange: 5.5,
  },
  crossbow: {
    hp: 58, dmg: 9, armor: 0, speed: 2.65, range: 5.6, attackTime: 1.7,
    cost: { food: 45, wood: 30, gold: 10 }, trainTime: 13, pop: 1, aggroRange: 6.5,
  },
  militia: { // neutral village guards — stiff enough that conquest isn't free
    hp: 100, dmg: 9, armor: 0, speed: 2.5, range: 0.62, attackTime: 1.15, pop: 0, aggroRange: 4.5,
  },
};

export const BUILDINGS = {
  capital: {
    name: 'Capital', hp: 3000, cost: {}, buildTime: 0, model: 'castle',
    trains: ['worker'], popCap: 14, rates: { identity: 0.35 },
    desc: 'Trains workers and advances Eras. Lose it and the nation falls.',
  },
  house: {
    name: 'House', hp: 260, cost: { wood: 40 }, buildTime: 14, model: 'home_A', popCap: 5,
    desc: '+5 population room.',
  },
  farm: {
    name: 'Farm', hp: 180, cost: { wood: 45 }, buildTime: 12, model: 'grain', neutral: true,
    slots: 1, slotRate: { food: 1.15 }, workAnim: 'gather',
    desc: 'A worker tends it for a steady flow of food.',
  },
  mine: {
    name: 'Mine', hp: 320, cost: { wood: 65 }, buildTime: 18, model: 'mine',
    needsMountain: true, slots: 2, slotRate: { gold: 0.8 },
    desc: 'Dig gold from the sierra. Build it on the rocky ground beside a mountain. Two worker slots.',
  },
  lumbercamp: {
    name: 'Lumber Camp', hp: 280, cost: { wood: 50 }, buildTime: 12, model: 'lumbermill',
    woodBoost: 0.15,
    desc: 'Sawmill and yard: all wood-cutting +15% (stacks up to two camps).',
  },
  market: {
    name: 'Market', hp: 300, cost: { wood: 70, gold: 30 }, buildTime: 16, model: 'market',
    rates: { gold: 0.5 },
    desc: 'Steady gold from trade. Catalans profit from every region they hold.',
  },
  church: {
    name: 'Church', hp: 350, cost: { wood: 60, gold: 30 }, buildTime: 18, model: 'church',
    rates: { identity: 0.5 },
    desc: 'Keeps the language, the songs, the stories: +Identity.',
  },
  festival: {
    name: 'Festival Hall', hp: 320, cost: { wood: 80, gold: 60 }, buildTime: 20, model: 'tavern', era: 1,
    rates: { identity: 0.8 },
    desc: 'Feast days and defiant songs: more Identity. (Kingdom era)',
  },
  barracks: {
    name: 'Barracks', hp: 450, cost: { wood: 90 }, buildTime: 20, model: 'barracks',
    trains: ['soldier'],
    desc: 'Trains soldiers.',
  },
  archery: {
    name: 'Archery Range', hp: 400, cost: { wood: 80, gold: 20 }, buildTime: 18, model: 'archeryrange', era: 1,
    trains: ['crossbow'],
    desc: 'Trains crossbowmen. (Kingdom era)',
  },
  tower: {
    name: 'Watchtower', hp: 520, cost: { wood: 60, gold: 25 }, buildTime: 16, model: 'tower_A',
    attack: { dmg: 10, range: 5.2, attackTime: 1.6 },
    desc: 'Fires bolts at enemies in range.',
  },
  blacksmith: {
    name: 'Blacksmith', hp: 340, cost: { wood: 70, gold: 40 }, buildTime: 16, model: 'blacksmith', era: 1,
    upgrades: true,
    desc: 'Forge upgrades for attack and armor. (Kingdom era)',
  },
};

export const ERAS = [
  { name: 'County', },
  { name: 'Kingdom', cost: { food: 250, gold: 120, identity: 80 }, time: 30 },
  { name: 'Golden Age', cost: { food: 500, gold: 300, identity: 200 }, time: 45 },
];

export const SMITH_UPGRADES = {
  attack: { name: 'Forged Blades', cost: { gold: 120, wood: 60 }, dmg: 3 },
  armor: { name: 'Plate & Mail', cost: { gold: 120, wood: 60 }, armor: 1 },
};

// Region allegiance
export const CONVICTION = {
  baseCost: 140,          // identity
  adjacentCost: 100,      // if region touches one you own
  resentDiscount: 0.6,    // flipping a region its holder conquered by force
  time: 40,               // seconds of undisturbed conversion
  conquerHoldTime: 10,    // seconds of armed presence after guards fall
  resentTributeMul: 0.65, // conquered regions pay reduced tribute
};

export const START = {
  resources: { food: 180, wood: 140, gold: 80, identity: 0 },
  workers: 5, soldiers: 2,
};

// masonry: workers restore damaged buildings for a share of the build cost
export const REPAIR = {
  hpPerSec: 30,     // per worker on the scaffold
  woodShare: 0.35,  // wood cost of a full 0->max restore, as share of build wood
  fallbackWood: 120, // for buildings with no wood cost (the capital)
};

// gathering
export const NODES = {
  wood: {
    rate: 1.0, perTile: 320, maxWorkers: 3,
    // cut groves regrow — permanent depletion starves wood-poor nations out of
    // the late game. regrowTime 0/null disables (patchable off-switch).
    regrowTime: 210, regrowTo: 0.75, // seconds to regrow; fraction of perTile restored
  },
  fish: { rate: 1.1, maxWorkers: 2 },
};
