// The Iberian peninsula as a hex map: two aligned ASCII layers (terrain + regions).
// Odd-r offset grid, row 0 = north (Cantabrian coast), col 0 = west (Atlantic).
// Terrain: . sea   g grass   f forest   h hills   m mountain
// Regions: letters, one historical comarca each; '.' must align with sea.

export const MAP_W = 63;
export const MAP_H = 46;

export const TERRAIN_ROWS = [
  '...............................................................',
  '...............................................................',
  '...............................................................',
  '...ffgggfgggggfffggggggggggggggggggf...........................',
  '...ffgggfgggggfffggggggggggggggggggf...........................',
  '...ffgggffffmmgggmgggmmgggmgggggfffgmmmmmmmmmmmmmmmmmmggggg....',
  '...ffgggffffmmgggmgggmmgggmgggggfffgmmmmmmmmmmmmmmmmmmggggg....',
  '...ffgggffffmmgggmgggmmgggmgggggfffgmmmmmmmmmmmmmmmmmmggggg....',
  '...ggfffggggggmmmghhhgghhhghhhgghhhghhhhhgggghhhmmmmmggggffggg.',
  '...ggggggfffgghhhggggggggggggggghhhgggggghhhgggggghhhgggggg....',
  '...ggggggfffgghhhggggggggggggggghhhgggggghhhgggggghhhgggggg....',
  '...ggggggfffgghhhggggggggggggggghhhgggggghhhgggggghhhgggggg....',
  '...ffggggggggggggggggggggggggghhggggggggghhhgfffggggghggggg....',
  '...ffggggggggggggggggggggggggghhggggggggghhhgfffggggghggggg....',
  '...ggggggggggghhhggggggggggggggggggghhhggggggggggghhhgggg......',
  '...ggggggggggghhhggggggggggggggggggghhhggggggggggghhhgggg......',
  '...ggggggggggghhhggggggggggggggggggghhhggggggggggghhhgggg......',
  '...gggggfggggggggggggggggggggghhgggfgggggggghgggggggggggg......',
  '...ggggggggggggggggggmmmmmmmmmhhgggggggggggggggghhgggg.........',
  '...ggggggggggggggggggmmmmmmmmmhhgggggggggggggggghhgggg.........',
  '...ggggggggggggggggggmmmmmmmmmhhgggggggggggggggghhgggg.........',
  '...ggggggggggggggggggggmmmhgggggggggfffgghhhggggggggg..........',
  '...ggggggggggggggggggggmmmhgggggggggfffgghhhggggggggg..........',
  '...gggggghhhgghhhgggggggggggggggggggggggggggghhhggggg..........',
  '...gggggghhhgghhhgggggggggggggggggggggggggggghhhggggg..........',
  '...gggggghhhgghhhgggggggggggggggggggggggggggghhhggggg..........',
  '...gggggggggggggggggggggggghhhgggggggggggggggggg...............',
  '...ggggggggggggggfggghhgggggggggggghgggffggggggg...............',
  '...ggggggggggggggfggghhgggggggggggghgggffggggggg...............',
  '...ggggggggggggggfggghhgggggggggggghgggffggggggg...............',
  '...ggggggggggghhhgggggggggfgggggggggggghhggg...................',
  '...ggggggggggghhhgggggggggfgggggggggggghhggg...................',
  '...gggggggggggggggmmmmmggghgggggggggggghhggg...................',
  '...gggggggggggggggmmmmmggghgggggggggggghhggg...................',
  '...gggggggggggggggmmmmmggghgggggggggggghhggg...................',
  '...ggggggggggggggggggggggghgggffggggggggg......................',
  '...ggggggggggghhhgfffgggggggggggmmmmhhh........................',
  '...ggggggggggghhhgfffgggggggggggmmmmhhh........................',
  '...ggggggggggghhhgfffgggggggggggmmmmhhh........................',
  '...ggggggggghhgggggggggggggggghhgggg...........................',
  '...ggggggggghhgggggggggggggggghhgggg...........................',
  '...ggggggggggggggggggggggggggggg...............................',
  '...ggggggggggggggggggggggggggggg...............................',
  '...ggggggggggggggggggggggggggggg...............................',
  '........gggggggggggggggggg.....................................',
  '...............................................................',
];

export const REGION_ROWS = [
  '...............................................................',
  '...............................................................',
  '...............................................................',
  '...GGGGGGGGGGGSSSSSSSSSSSSSSSSSSEEEE...........................',
  '...GGGGGGGGGGGSSSSSSSSSSSSSSSSSSEEEE...........................',
  '...GGGGGGGGGSSSSSSSSSSSSSSSSSSEEEEEEEEENNNNNRRRRRRRRRRCCCCC....',
  '...GGGGGGGGGSSSSSSSSSSSSSSSSSSEEEEEEEEENNNNNRRRRRRRRRRCCCCC....',
  '...GGGGGGGGGSSSSSSSSSSSSSSSSSSEEEEEEEEENNNNNRRRRRRRRRRCCCCC....',
  '...GGGGGGGGGGGSSSSSSSSSSSSSEEEEEEEEENNNNNNNNRRRRRRRRRCCCCCCCCC.',
  '...OOOOOOOOOGGLLLLLLLLLLLLLLLLYYYYYNNNNNNRRRRRRRRRRRRCCCCCC....',
  '...OOOOOOOOOGGLLLLLLLLLLLLLLLLYYYYYNNNNNNRRRRRRRRRRRRCCCCCC....',
  '...OOOOOOOOOGGLLLLLLLLLLLLLLLLYYYYYNNNNNNRRRRRRRRRRRRCCCCCC....',
  '...OOOOOOOOOLLLLLLLLLLLLLLLLLLYYYYYYYYYRRRRRRRRRRRRRRRCCCCC....',
  '...OOOOOOOOOLLLLLLLLLLLLLLLLLLYYYYYYYYYRRRRRRRRRRRRRRRCCCCC....',
  '...OOOOOOOOOOOLLLLLLLLLLLLLYYYYYYYYYYYYRRRRRRRRRRRRRRCCCC......',
  '...OOOOOOOOOOOLLLLLLLLLLLLLYYYYYYYYYYYYRRRRRRRRRRRRRRCCCC......',
  '...OOOOOOOOOOOLLLLLLLLLLLLLYYYYYYYYYYYYRRRRRRRRRRRRRRCCCC......',
  '...OOOOOOOOOOOLLLLLLLLLLLLYYYYYYYYYYYYYYYRRRRVVVVVVVVVVVV......',
  '...OOOOOOOOOOOOOOXYYYYYYYYYYYYYYYYYYYYYYYYYYYVVVVVVVVV.........',
  '...OOOOOOOOOOOOOOXYYYYYYYYYYYYYYYYYYYYYYYYYYYVVVVVVVVV.........',
  '...OOOOOOOOOOOOOOXKKKKKKKKKKKKKKKKKKKKKKKKKKKVVVVVVVVV.........',
  '...IIIIIIIIIIIXXXXXXXXXKKKKKKKKKKKKKKKKKKVVVVVVVVVVVV..........',
  '...IIIIIIIIIIIXXXXXXXXXKKKKKKKKKKKKKKKKKKVVVVVVVVVVVV..........',
  '...IIIIIIIIIIIXXXXXXXXXKKKKKKKKKKKKKKKKKKKKKVVVVVVVVV..........',
  '...IIIIIIIIIIIXXXXXXXXXKKKKKKKKKKKKKKKKKKKKKVVVVVVVVV..........',
  '...IIIIIIIIIIIXXXXXXXXXKKKKKKKKKKKKKKKKKKKKKMMMMMMMMM..........',
  '...IIIIIIIIIXXXXXXXXXXXKKKKKKKKKKKKKKKKKKKKKMMMM...............',
  '...IIIIIIIIIXXXXXXXXXXXKKKKKKKKKKKKKKKKKKMMMMMMM...............',
  '...IIIIIIIIIXXXXXXXXXXXKKKKKKKKKKKKKKKKKKMMMMMMM...............',
  '...IIIIIIIIIXXXXXXXXXXXKKKKKKKKKKKKKKKKKKMMMMMMM...............',
  '...TTTTTTTTTXXXXXXXXXXXKKKKKKKKKKKKKKKKAAMMM...................',
  '...TTTTTTTTTXXXXXXXXXXXKKKKKKKKKKKKKKKKAAMMM...................',
  '...TTTTTTTTTXXXXXXDDDDDDDDDDAAAAAAAAAAAAAMMM...................',
  '...TTTTTTTTTXXXXXXDDDDDDDDDDAAAAAAAAAAAAAMMM...................',
  '...TTTTTTTTTXXXXXXDDDDDDDDDDAAAAAAAAAAAAAMMM...................',
  '...TTTTTTTTTTTDDDDDDDDDDDDDDAAAAAAAAAAAAA......................',
  '...TTTTTTTTTTTDDDDDDDDDDDDDDAAAAAAAAAAA........................',
  '...TTTTTTTTTTTDDDDDDDDDDDDDDAAAAAAAAAAA........................',
  '...TTTTTTTTTTTDDDDDDDDDDDDDDAAAAAAAAAAA........................',
  '...TTTTTTTTTDDDDDDDDDDDDDDDDAAAAAAAA...........................',
  '...TTTTTTTTTDDDDDDDDDDDDDDDDAAAAAAAA...........................',
  '...TTTTTTTTTTTDDDDDDDDDDDDDDAAAA...............................',
  '...TTTTTTTTTTTDDDDDDDDDDDDDDAAAA...............................',
  '...TTTTTTTTTTTDDDDDDDDDDDDDDAAAA...............................',
  '........TTTTDDDDDDDDDDDDDD.....................................',
  '...............................................................',
];

// Region metadata. capitalOf: faction id that starts here (its capital city).
// village: offset [col,row] for the region's town; must be a buildable land tile.
// tribute: what owning this region pays per second (its historical specialty).
export const REGIONS = {
  G: { name: 'Galiza',        city: 'Santiago',   village: [5, 5],  capitalOf: 'galicia',   tribute: { food: 1.0, identity: 0.4 } },
  S: { name: 'Asturias',      city: 'Uviéu',      village: [18, 5],  tribute: { food: 0.8, wood: 0.4 } },
  E: { name: 'Euskal Herria', city: 'Bilbo',      village: [32, 5],  capitalOf: 'basque',    tribute: { gold: 1.0 } },
  N: { name: 'Nafarroa',      city: 'Iruñea',     village: [39, 8],  tribute: { food: 0.8, identity: 0.2 } },
  R: { name: 'Aragón',        city: 'Zaragoza',   village: [45, 12],  tribute: { food: 0.6, wood: 0.6 } },
  C: { name: 'Catalunya',     city: 'Barcelona',  village: [54, 8],  capitalOf: 'catalonia', tribute: { gold: 1.2 } },
  V: { name: 'València',      city: 'València',   village: [48, 21],  tribute: { food: 1.0, gold: 0.4 } },
  M: { name: 'Murcia',        city: 'Murcia',     village: [44, 29],  tribute: { food: 0.8, gold: 0.3 } },
  K: { name: 'Castela Nova',  city: 'Toledo',     village: [30, 23],  capitalOf: 'castile',   tribute: { food: 1.4 } },
  Y: { name: 'Castela Vella', city: 'Burgos',     village: [32, 16],  tribute: { food: 1.2 } },
  L: { name: 'León',          city: 'León',       village: [17, 12],  tribute: { food: 1.0 } },
  X: { name: 'Estremadura',   city: 'Mérida',     village: [17, 26],  tribute: { food: 0.7, wood: 0.3 } },
  D: { name: 'Andalucía',     city: 'Sevilla',    village: [21, 36],  tribute: { gold: 1.2, food: 0.4 } },
  A: { name: 'Granada',       city: 'Granada',    village: [33, 35],  tribute: { gold: 0.9, food: 0.4 } },
  O: { name: 'Norte',         city: 'Porto',      village: [5, 14],  tribute: { wood: 0.8, food: 0.4 } },
  I: { name: 'Lisboa',        city: 'Lisboa',     village: [5, 23],  capitalOf: 'portugal',  tribute: { gold: 0.8, food: 0.6 } },
  T: { name: 'Alentejo',      city: 'Évora',      village: [8, 35],  tribute: { food: 1.0 } },
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
