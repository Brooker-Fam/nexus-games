// ══════════════════════════════════════════════
//  DOOM — Level catalog
// ══════════════════════════════════════════════
//  Each level is an ASCII-grid map plus metadata
//  consumed by doomLoadLevel() in js/doom/game.js.
//
//  Tile glyphs:
//    1/2/3  walls (brick / metal / stone)
//    9      exit portal (passable)
//    P      player spawn
//    E      enemy (demon) spawn
//    A      ammo pickup
//    M      medkit pickup
//    S      shotgun pickup    (forward-compat: +20 ammo in foundation)
//    C      chaingun pickup   (forward-compat: +30 ammo in foundation)
//    R      rocket pickup     (forward-compat: medkit + ammo in foundation)
//    K      armor / key       (forward-compat: medkit in foundation)
//    .      empty floor
//
//  All rows must be the same width. The map is finite — the engine
//  treats out-of-bounds reads as solid walls, so you don't need an
//  outer ring of walls but levels here include one for clarity.

const DOOM_LEVELS = [
  // ───────────────────────────────────────────────
  // Level 1 — "The Hangar"  (E1M1-style intro)
  // 24×18 multi-room map. Several distinct chambers,
  // corridors, ammo / medkit pickups, shotgun pickup
  // in the side chamber, demons in each room.
  // ───────────────────────────────────────────────
  {
    id: 'e1m1',
    name: 'THE HANGAR',
    subtitle: 'CITADEL ENTRY — FLOOR 1',
    music: 'doomMusicHangar',
    par: 120,   // par time in seconds (cosmetic)
    map: [
      '111111111111111111111111',
      '1P...A.1......1.S......1',
      '1......1......1........1',
      '1...M..1..E...1...E....1',
      '1......1......1........1',
      '1......1......1........1',
      '1..2222122222212222.2..1',
      '1.....................11',
      '1..E...A..............1.',
      '1.....................11',
      '13333.111111.3333333..1.',
      '1...3.1....1.3..M.....11',
      '1.A.3.1.E..1.3........1.',
      '1...3.1....1.3.....C..11',
      '1...3.1....1.333333...1.',
      '1...3.1....1.........E91',
      '1.....1....1...........1',
      '111111111111111111111111',
    ],
  },

  // ───────────────────────────────────────────────
  // Level 2 — "Test Arena" (small training arena)
  // 14×14 single-room map. Used as a quick warm-up
  // or for engine smoke-testing. Cleaner geometry,
  // weapon + medkit dropped in center.
  // ───────────────────────────────────────────────
  {
    id: 'arena',
    name: 'THE PIT',
    subtitle: 'COMBAT ARENA — FLOOR 2',
    music: 'doomMusicPit',
    par: 60,
    map: [
      '11111111111111',
      '1P...........1',
      '1...22..22...1',
      '1...2....2...1',
      '1.E..E..E..E.1',
      '1............1',
      '1....SAMK....1',
      '1............1',
      '1.E..E..E..E.1',
      '1...2....2...1',
      '1...22..22...1',
      '1............1',
      '1.........E.91',
      '11111111111111',
    ],
  },

  // ───────────────────────────────────────────────
  // Level 3 — "The Inner Sanctum" (boss chamber, final)
  // 18×18 with a central inner ring and a circle of
  // demons. Heavy weapons + armor available, but more
  // enemies guard the exit.
  // ───────────────────────────────────────────────
  {
    id: 'sanctum',
    name: 'INNER SANCTUM',
    subtitle: 'THE FINAL FLOOR',
    music: 'doomMusicSanctum',
    par: 180,
    map: [
      '111111111111111111',
      '1P..A...........R1',
      '1.....3333333....1',
      '1.....3.....3....1',
      '1..E..3..E..3..E.1',
      '1.....3.....3....1',
      '1.....3..M..3....1',
      '1.....3.K...3....1',
      '1.....333.333....1',
      '1...........E....1',
      '1..C.............1',
      '1...22222222.....1',
      '1...2......2.....1',
      '1.E.2..E...2..E..1',
      '1...2......2.....1',
      '1...2222.222.....1',
      '1.A...........S.91',
      '111111111111111111',
    ],
  },
];

// Map glyph → pickup descriptor for the extended tile set.
// Foundation has no weapon system yet; these pickups behave as
// "supercharged" health/ammo so level data stays valid until
// the weapons-and-combat branch is merged.
const DOOM_EXTRA_PICKUPS = {
  S: { type: 'shotgun',  // weapons-branch will treat this as the shotgun
       ammoBonus: 20, hpBonus: 0,   label: 'SHOTGUN'  },
  C: { type: 'chaingun', ammoBonus: 30, hpBonus: 0,   label: 'CHAINGUN' },
  R: { type: 'rocket',   ammoBonus: 10, hpBonus: 25,  label: 'ROCKETS'  },
  K: { type: 'armor',    ammoBonus: 0,  hpBonus: 35,  label: 'ARMOR'    },
};

// Expose for other modules.
window.DOOM_LEVELS = DOOM_LEVELS;
window.DOOM_EXTRA_PICKUPS = DOOM_EXTRA_PICKUPS;
