// The five nations. Bonuses are consumed by the sim as plain multipliers/flags —
// each one derives from the nation's historical identity (see GAME_DESIGN.md).

export const FACTIONS = {
  galicia: {
    name: 'Galicians', adj: 'Galician', motto: 'O Camiño e o Mar',
    color: 0x3f7fd4, buildingColor: 'blue', flag: 'flag_blue',
    soldierModel: 'char_mage', // the Irmandiño pilgrim-rebel, staff in hand
    soldierWeapon: 'weapon_staff',
    unitNames: { worker: 'Labrego', soldier: 'Irmandiño', crossbow: 'Besteiro' },
    eraTech: 'Camiño de Santiago',
    blurb: 'Patient people of the Atlantic mists. The sea feeds them, the Way of St James binds them, and every region they win by conviction strengthens the pilgrimage.',
    bonusText: 'Fishing +50% · Churches 30% cheaper · Converted regions add Identity (the Camino) and their militias join you (the Irmandades)',
    bonus: {
      fishRate: 1.5, churchCostMul: 0.7, caminoIdentity: 0.15, // per converted region /s
      militiaJoin: true, // Irmandades: village guards of convinced regions take up your banner
    },
    aiStyle: { aggression: 0.4, convictionLove: 0.95, expandCoastal: 0.6, economy: 0.7, turtle: 0.7 },
  },
  basque: {
    name: 'Basques', adj: 'Basque', motto: 'Burdina eta Foruak',
    color: 0xe8e4da, buildingColor: 'basque', flag: 'flag_basque', // runtime-tinted set
    soldierModel: 'char_barbarian', // the aizkolari, two-handed axe
    soldierWeapon: 'weapon_axe2h',
    unitNames: { worker: 'Baserritarra', soldier: 'Aizkolari', crossbow: 'Balestari' },
    eraTech: 'Foruak',
    blurb: 'The oldest people of Iberia, unmoved since before Rome. Their mountains hold iron, their law is ancient, and what they build does not break.',
    bonusText: 'Mines +50% · Buildings & units 18% tougher (the fueros endure)',
    bonus: {
      mineRate: 1.5, buildingHpMul: 1.18, unitHpMul: 1.18,
    },
    aiStyle: { aggression: 0.45, convictionLove: 0.4, expandCoastal: 0.3, economy: 0.6, turtle: 0.9 },
  },
  catalonia: {
    name: 'Catalans', adj: 'Catalan', motto: 'Seny i Comerç',
    color: 0xe3b23c, buildingColor: 'yellow', flag: 'flag_yellow',
    soldierModel: 'char_rogue', // the almogàver, quick and lethal
    soldierWeapon: 'weapon_sword',
    unitNames: { worker: 'Pagès', soldier: 'Almogàver', crossbow: 'Ballester' },
    eraTech: 'Consolat de Mar',
    blurb: 'Merchants and builders of the Mediterranean. Their ledgers reach further than any sword, and every region in the network pays.',
    bonusText: 'Buildings 25% cheaper · Markets add gold for every region you hold',
    bonus: {
      buildCostMul: 0.75, marketPerRegion: 0.12, // gold/s per owned region if a market stands
    },
    aiStyle: { aggression: 0.3, convictionLove: 0.7, expandCoastal: 0.5, economy: 0.95 },
  },
  portugal: {
    name: 'Portuguese', adj: 'Portuguese', motto: 'Descobrimentos',
    color: 0x3f9e4d, buildingColor: 'green', flag: 'flag_green',
    soldierModel: 'char_rogue_hooded', // the navigator-cavaleiro
    soldierWeapon: 'weapon_sword',
    unitNames: { worker: 'Camponês', soldier: 'Cavaleiro', crossbow: 'Besteiro' },
    eraTech: 'Escola de Sagres',
    blurb: 'The first nation of fixed borders turned its back to Castile and its face to the ocean. The coast is theirs by vocation.',
    bonusText: 'Workers 20% faster · Coastal regions convert at half cost and pay +25% tribute',
    bonus: {
      workerSpeedMul: 1.2, coastalConvertMul: 0.6, coastalTributeMul: 1.25,
    },
    aiStyle: { aggression: 0.35, convictionLove: 0.6, expandCoastal: 1.0, economy: 0.75 },
  },
  castile: {
    name: 'Castilians', adj: 'Castilian', motto: 'Plus Ultra',
    color: 0xc94434, buildingColor: 'red', flag: 'flag_red',
    soldierModel: 'char_knight', // the tercio
    soldierWeapon: 'weapon_sword',
    unitNames: { worker: 'Labriego', soldier: 'Tercio', crossbow: 'Ballestero' },
    eraTech: 'Tercios',
    blurb: 'The hegemon of the meseta. The center holds the largest lands and the cheapest armies — and means to hold everything else.',
    bonusText: 'Starts with 2 extra regions · Soldiers 25% cheaper and train 30% faster',
    bonus: {
      soldierCostMul: 0.75, trainTimeMul: 0.7, extraRegions: true,
    },
    aiStyle: { aggression: 0.95, convictionLove: 0.2, expandCoastal: 0.2, economy: 0.5 },
  },
};

export const FACTION_IDS = Object.keys(FACTIONS);
