// The Iberian peninsula as a hex map: two aligned ASCII layers (terrain + regions).
// Odd-r offset grid, row 0 = north (Cantabrian coast), col 0 = west (Atlantic).
// Terrain: . sea   g grass   f forest   h hills   m mountain
// Regions: letters, one historical comarca each; '.' must align with sea.

export const MAP_W = 42;
export const MAP_H = 31;

export const TERRAIN_ROWS = [
  '..........................................',
  '..........................................',
  '..fggfgggffggggggggggggf..................',
  '..fggfffmggmggmggmgggffgmmmmmmmmmmmmggg...',
  '..fggfffmggmggmggmgggffgmmmmmmmmmmmmggg...',
  '..gffggggmmghhghhghhghhghhhggghhmmmgggfgg.',
  '..ggggffghhgggggggggghhgggghhgggghhgggg...',
  '..ggggffghhgggggggggghhgggghhgggghhgggg...',
  '..fggggggggggggggggghgggggghhgffggghggg...',
  '..ggggggghhggggggggggggghhggggggghhggg....',
  '..ggggggghhggggggggggggghhggggggghhggg....',
  '..gggfgggggggggggggghggfggggghgggggggg....',
  '..ggggggggggggmmmmmmhggggggggggghggg......',
  '..ggggggggggggmmmmmmhggggggggggghggg......',
  '..gggggggggggggmmhggggggffghhgggggg.......',
  '..gggghhghhggggggggggggggggggghhggg.......',
  '..gggghhghhggggggggggggggggggghhggg.......',
  '..gggggggggggggggghhgggggggggggg..........',
  '..gggggggggfgghgggggggghggfggggg..........',
  '..gggggggggfgghgggggggghggfggggg..........',
  '..ggggggghhggggggfgggggggghgg.............',
  '..ggggggggggmmmgghgggggggghgg.............',
  '..ggggggggggmmmgghgggggggghgg.............',
  '..ggggggggggggggghggfgggggg...............',
  '..ggggggghhgffgggggggmmmhh................',
  '..ggggggghhgffgggggggmmmhh................',
  '..gggggghggggggggggghggg..................',
  '..ggggggggggggggggggg.....................',
  '..ggggggggggggggggggg.....................',
  '.....gggggggggggg.........................',
  '..........................................',
];

export const REGION_ROWS = [
  '..........................................',
  '..........................................',
  '..GGGGGGGSSSSSSSSSSSSEEE..................',
  '..GGGGGGSSSSSSSSSSSSEEEEEENNNRRRRRRRCCC...',
  '..GGGGGGSSSSSSSSSSSSEEEEEENNNRRRRRRRCCC...',
  '..GGGGGGGSSSSSSSSSEEEEEENNNNNRRRRRRCCCCCC.',
  '..OOOOOOGLLLLLLLLLLLKKKNNNNRRRRRRRRCCCC...',
  '..OOOOOOGLLLLLLLLLLLKKKNNNNRRRRRRRRCCCC...',
  '..OOOOOOLLLLLLLLLLLLKKKKKKRRRRRRRRRRCCC...',
  '..OOOOOOOLLLLLLLLLKKKKKKKKRRRRRRRRRCCC....',
  '..OOOOOOOLLLLLLLLLKKKKKKKKRRRRRRRRRCCC....',
  '..OOOOOOOLLLLLLLLKKKKKKKKKKRRRVVVVVVVV....',
  '..OOOOOOOOOXKKKKKKKKKKKKKKKKKKVVVVVV......',
  '..OOOOOOOOOXKKKKKKKKKKKKKKKKKKVVVVVV......',
  '..IIIIIIIXXXXXXKKKKKKKKKKKKVVVVVVVV.......',
  '..IIIIIIIXXXXXXKKKKKKKKKKKKKKVVVVVV.......',
  '..IIIIIIIXXXXXXKKKKKKKKKKKKKKVVVVVV.......',
  '..IIIIIIXXXXXXXKKKKKKKKKKKKKKVVV..........',
  '..IIIIIIXXXXXXXKKKKKKKKKKKKVVVVV..........',
  '..IIIIIIXXXXXXXKKKKKKKKKKKKVVVVV..........',
  '..TTTTTTXXXXXXXKKKKKKKKKKKDVV.............',
  '..TTTTTTXXXXDDDDDDDDDDDDDDDVV.............',
  '..TTTTTTXXXXDDDDDDDDDDDDDDDVV.............',
  '..TTTTTTTDDDDDDDDDDDDDDDDDD...............',
  '..TTTTTTTDDDDDDDDDDDDDDDDD................',
  '..TTTTTTTDDDDDDDDDDDDDDDDD................',
  '..TTTTTTDDDDDDDDDDDDDDDD..................',
  '..TTTTTTTDDDDDDDDDDDD.....................',
  '..TTTTTTTDDDDDDDDDDDD.....................',
  '.....TTTDDDDDDDDD.........................',
  '..........................................',
];

// Region metadata. capitalOf: faction id that starts here (its capital city).
// village: offset [col,row] for the region's town; must be a buildable land tile.
// tribute: what owning this region pays per second (its historical specialty).
export const REGIONS = {
  G: { name: 'Galiza',       city: 'Santiago',    village: [3, 3],   capitalOf: 'galicia',  tribute: { food: 1.0, identity: 0.4 } },
  S: { name: 'Asturias',     city: 'Uviéu',       village: [12, 3],   tribute: { food: 0.8, wood: 0.4 } },
  E: { name: 'Euskal Herria',city: 'Bilbo',       village: [21, 3],  capitalOf: 'basque',   tribute: { gold: 1.0 } },
  N: { name: 'Nafarroa',     city: 'Iruñea',      village: [26, 5],  tribute: { food: 0.8, identity: 0.2 } },
  R: { name: 'Aragón',       city: 'Zaragoza',    village: [30, 8],  tribute: { food: 0.6, wood: 0.6 } },
  C: { name: 'Catalunya',    city: 'Barcelona',   village: [36, 5],  capitalOf: 'catalonia', tribute: { gold: 1.2 } },
  V: { name: 'València',     city: 'València',    village: [32, 14],  tribute: { food: 1.0, gold: 0.4 } },
  K: { name: 'Castela',      city: 'Toledo',      village: [20, 15], capitalOf: 'castile',  tribute: { food: 1.4 } },
  L: { name: 'León',         city: 'León',        village: [11, 8],   tribute: { food: 1.0 } },
  X: { name: 'Estremadura',  city: 'Mérida',      village: [11, 17],  tribute: { food: 0.7, wood: 0.3 } },
  D: { name: 'Andalucía',    city: 'Sevilla',     village: [14, 24],  tribute: { gold: 1.2, food: 0.4 } },
  O: { name: 'Norte',        city: 'Porto',       village: [3, 9],   tribute: { wood: 0.8, food: 0.4 } },
  I: { name: 'Lisboa',       city: 'Lisboa',      village: [3, 15],  capitalOf: 'portugal', tribute: { gold: 0.8, food: 0.6 } },
  T: { name: 'Alentejo',     city: 'Évora',       village: [5, 23],  tribute: { food: 1.0 } },
};

// Castile's hegemon head start (see GAME_DESIGN.md): it also begins owning these.
export const CASTILE_EXTRA_REGIONS = ['L', 'X'];

export function parseMap() {
  if (TERRAIN_ROWS.length !== MAP_H || REGION_ROWS.length !== MAP_H) {
    throw new Error('map row count mismatch');
  }
  const tiles = []; // index = row * MAP_W + col
  for (let r = 0; r < MAP_H; r++) {
    const trow = TERRAIN_ROWS[r], rrow = REGION_ROWS[r];
    if (trow.length !== MAP_W || rrow.length !== MAP_W) {
      throw new Error(`map row ${r} width mismatch: terrain=${trow.length} region=${rrow.length}`);
    }
    for (let c = 0; c < MAP_W; c++) {
      const t = trow[c], reg = rrow[c];
      const isLand = t !== '.';
      if (isLand && reg === '.') throw new Error(`land tile without region at ${c},${r}`);
      if (!isLand && reg !== '.') throw new Error(`sea tile with region ${reg} at ${c},${r}`);
      if (isLand && !REGIONS[reg]) throw new Error(`unknown region '${reg}' at ${c},${r}`);
      tiles.push({
        col: c, row: r,
        terrain: t === '.' ? 'sea' : t === 'g' ? 'grass' : t === 'f' ? 'forest' : t === 'h' ? 'hills' : 'mountain',
        region: isLand ? reg : null,
      });
    }
  }
  return tiles;
}
