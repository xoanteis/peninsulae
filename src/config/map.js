// The Iberian peninsula as a hex map: two aligned ASCII layers (terrain + regions).
// Odd-r offset grid, row 0 = north (Cantabrian coast), col 0 = west (Atlantic).
// Terrain: . sea   g grass   f forest   h hills   m mountain
// Regions: letters, one historical comarca each; '.' must align with sea.

export const MAP_W = 28;
export const MAP_H = 21;

export const TERRAIN_ROWS = [
  '............................', // 0
  '.fgfggfggggggggf............', // 1  Galicia · Asturias · Cantabria · Euskadi
  '.fgffmgmgmgmggfgmmmmmmmmgg..', // 2  Picos de Europa · Pyrenees · Empordà
  '.gfgggmghghghghghhgghmmggfg.', // 3
  '.gggfghggggggghggghggghggg..', // 4  Douro · Rioja · Ebro · Costa Brava
  '.fggggggggggghgggghgfgghgg..', // 5
  '.ggggghggggggggghggggghgg...', // 6  Ebro delta
  '.ggfggggggggghgfggghggggg...', // 7  Valencia coast begins
  '.ggggggggmmmmhggggggghgg....', // 8  Serra da Estrela · Gredos · Guadarrama
  '.gggggggggmhggggfghgggg.....', // 9  Tajo
  '.ggghghggggggggggggghgg.....', // 10 Lisboa · La Mancha
  '.ggggggggggghgggggggg.......', // 11
  '.ggggggfghggggghgfggg.......', // 12
  '.ggggghggggfggggghg.........', // 13 La Mancha · Murcia
  '.gggggggmmghggggghg.........', // 14 Sierra Morena
  '.gggggggggghgfgggg..........', // 15 Guadalquivir
  '.ggggghgfgggggmmh...........', // 16 Sierra Nevada
  '.gggghggggggghgg............', // 17
  '.ggggggggggggg..............', // 18 Algarve · Cádiz · Málaga
  '...gggggggg.................', // 19 the Strait
  '............................', // 20
];

export const REGION_ROWS = [
  '............................', // 0
  '.GGGGGSSSSSSSSEE............', // 1
  '.GGGGSSSSSSSSEEEENNRRRRRCC..', // 2
  '.GGGGGSSSSSSEEEENNNRRRRCCCC.', // 3
  '.OOOOGLLLLLLLKKNNNRRRRRCCC..', // 4
  '.OOOOLLLLLLLLKKKKRRRRRRRCC..', // 5
  '.OOOOOLLLLLLKKKKKRRRRRRCC...', // 6
  '.OOOOOLLLLLKKKKKKKRRVVVVV...', // 7
  '.OOOOOOXKKKKKKKKKKKKVVVV....', // 8
  '.IIIIIXXXXKKKKKKKKVVVVV.....', // 9
  '.IIIIIXXXXKKKKKKKKKVVVV.....', // 10
  '.IIIIXXXXXKKKKKKKKKVV.......', // 11
  '.IIIIXXXXXKKKKKKKKVVV.......', // 12
  '.TTTTXXXXXKKKKKKKDV.........', // 13
  '.TTTTXXXDDDDDDDDDDV.........', // 14
  '.TTTTTDDDDDDDDDDDD..........', // 15
  '.TTTTTDDDDDDDDDDD...........', // 16
  '.TTTTDDDDDDDDDDD............', // 17
  '.TTTTTDDDDDDDD..............', // 18
  '...TTDDDDDD.................', // 19
  '............................', // 20
];

// Region metadata. capitalOf: faction id that starts here (its capital city).
// village: offset [col,row] for the region's town; must be a buildable land tile.
// tribute: what owning this region pays per second (its historical specialty).
export const REGIONS = {
  G: { name: 'Galiza',       city: 'Santiago',    village: [2, 2],   capitalOf: 'galicia',  tribute: { food: 1.0, identity: 0.4 } },
  S: { name: 'Asturias',     city: 'Uviéu',       village: [8, 2],   tribute: { food: 0.8, wood: 0.4 } },
  E: { name: 'Euskal Herria',city: 'Bilbo',       village: [14, 2],  capitalOf: 'basque',   tribute: { gold: 1.0 } },
  N: { name: 'Nafarroa',     city: 'Iruñea',      village: [17, 3],  tribute: { food: 0.8, identity: 0.2 } },
  R: { name: 'Aragón',       city: 'Zaragoza',    village: [20, 5],  tribute: { food: 0.6, wood: 0.6 } },
  C: { name: 'Catalunya',    city: 'Barcelona',   village: [24, 3],  capitalOf: 'catalonia', tribute: { gold: 1.2 } },
  V: { name: 'València',     city: 'València',    village: [21, 9],  tribute: { food: 1.0, gold: 0.4 } },
  K: { name: 'Castela',      city: 'Toledo',      village: [13, 10], capitalOf: 'castile',  tribute: { food: 1.4 } },
  L: { name: 'León',         city: 'León',        village: [7, 5],   tribute: { food: 1.0 } },
  X: { name: 'Estremadura',  city: 'Mérida',      village: [7, 11],  tribute: { food: 0.7, wood: 0.3 } },
  D: { name: 'Andalucía',    city: 'Sevilla',     village: [9, 16],  tribute: { gold: 1.2, food: 0.4 } },
  O: { name: 'Norte',        city: 'Porto',       village: [2, 6],   tribute: { wood: 0.8, food: 0.4 } },
  I: { name: 'Lisboa',       city: 'Lisboa',      village: [2, 10],  capitalOf: 'portugal', tribute: { gold: 0.8, food: 0.6 } },
  T: { name: 'Alentejo',     city: 'Évora',       village: [3, 15],  tribute: { food: 1.0 } },
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
