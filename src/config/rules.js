// Unit, building, era and region rules. One tile = one building.
// All rates are per second; the sim ticks at TICK_MS.

export const TICK_MS = 100;

export const UNITS = {
  worker: {
    hp: 45, dmg: 3, armor: 0, speed: 2.7, range: 0.55, attackTime: 1.1,
    cost: { food: 55 }, trainTime: 9, pop: 1,
    gatherRate: 0.85, buildRate: 0.10, // construction progress /s
  },
  soldier: {
    hp: 95, dmg: 12, armor: 1, speed: 2.45, range: 0.62, attackTime: 1.05,
    cost: { food: 60, gold: 20 }, trainTime: 11, pop: 1, aggroRange: 5.5,
  },
  crossbow: {
    hp: 58, dmg: 9, armor: 0, speed: 2.45, range: 5.6, attackTime: 1.7,
    cost: { food: 45, wood: 30, gold: 10 }, trainTime: 13, pop: 1, aggroRange: 6.5,
  },
  militia: { // neutral village guards
    hp: 70, dmg: 8, armor: 0, speed: 2.3, range: 0.62, attackTime: 1.15, pop: 0, aggroRange: 4.5,
  },
};

export const BUILDINGS = {
  capital: {
    name: 'Capital', hp: 1500, cost: {}, buildTime: 0, model: 'castle',
    trains: ['worker'], popCap: 10, rates: { identity: 0.35 },
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
    desc: 'Dig gold from the sierra. Needs a mountain beside it. Two worker slots.',
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
  resentTributeMul: 0.5,  // conquered regions pay half
};

export const START = {
  resources: { food: 180, wood: 140, gold: 80, identity: 0 },
  workers: 4, soldiers: 1,
};

// gathering
export const NODES = {
  wood: { rate: 1.0, perTile: 320, maxWorkers: 3 },
  fish: { rate: 1.1, maxWorkers: 2 },
};
