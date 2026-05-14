// Stub for Juraj's level/map system.
//
// Contract — the real level module must provide objects with this shape:
//   level.width, level.height                            (in tiles)
//   level.getTile(x, y)                 -> number        (0 = empty, >0 = wall id)
//   level.getPlayerSpawn()              -> { x, y, angle }
//   level.getEntitySpawns()             -> Array<{ kind, type, x, y }>
//                                          kind: 'enemy' | 'pickup' | 'exit'
//                                          type: enemy archetype id or pickup id
//   level.getName?()                    -> string
//
// This stub returns a tiny test map so gameplay code can be developed without
// the real level pipeline.

export function createStubLevel() {
  // 16x12 map. 1 = wall, 0 = floor.
  const map = [
    '1111111111111111',
    '1..............1',
    '1...11..11.....1',
    '1...1....1.....1',
    '1...1....1..Z..1',
    '1...1....1.....1',
    '1...11111......1',
    '1.......I......1',
    '1.....11111....1',
    '1..@..1.S.1..E.1',
    '1.....1...1....1',
    '1111111111111111',
  ];

  const width = map[0].length;
  const height = map.length;

  const tiles = new Uint8Array(width * height);
  const spawns = [];
  let playerSpawn = { x: 1.5, y: 1.5, angle: 0 };

  for (let y = 0; y < height; y++) {
    const row = map[y];
    for (let x = 0; x < width; x++) {
      const c = row[x];
      const wx = x + 0.5, wy = y + 0.5;
      if (c === '1') {
        tiles[y * width + x] = 1;
      } else if (c === '@') {
        playerSpawn = { x: wx, y: wy, angle: 0 };
      } else if (c === 'Z') {
        spawns.push({ kind: 'enemy', type: 'zombie', x: wx, y: wy });
      } else if (c === 'I') {
        spawns.push({ kind: 'enemy', type: 'imp', x: wx, y: wy });
      } else if (c === 'S') {
        spawns.push({ kind: 'pickup', type: 'w_shotgun', x: wx, y: wy });
      } else if (c === 'E') {
        spawns.push({ kind: 'exit', type: 'exit', x: wx, y: wy });
      }
    }
  }

  // Scatter a few pickups for testing.
  spawns.push({ kind: 'pickup', type: 'stimpack', x: 4.5, y: 1.5 });
  spawns.push({ kind: 'pickup', type: 'clip',     x: 8.5, y: 1.5 });
  spawns.push({ kind: 'pickup', type: 'armor_g',  x: 2.5, y: 7.5 });

  return {
    width, height,
    getName: () => 'E1M1: Stub',
    getTile(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return 1;
      return tiles[y * width + x] | 0;
    },
    getPlayerSpawn: () => playerSpawn,
    getEntitySpawns: () => spawns.slice(),
  };
}
