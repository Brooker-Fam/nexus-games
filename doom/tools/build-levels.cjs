#!/usr/bin/env node
// Lays out the three starter levels using room/corridor primitives,
// validates that every thing is reachable from the player start, and writes
// out the level JSON files.
//
// Wall IDs (consistent across all levels):
//   0 = air
//   1 = wall_tech   (default)
//   2 = wall_panel  (industrial)
//   3 = wall_blood  (gore room)
//   4 = wall_brick  (older masonry)
//   5 = door_steel  (regular door)
//   6 = door_red    (needs red key)
//   7 = door_blue   (needs blue key)
//   9 = wall_exit   (exit sign at end of level)

'use strict';

const fs = require('fs');
const path = require('path');

const WALL_TEXTURES = {
  '1': 'wall_tech',
  '2': 'wall_panel',
  '3': 'wall_blood',
  '4': 'wall_brick',
  '5': 'door_steel',
  '6': 'door_red',
  '7': 'door_blue',
  '9': 'wall_exit'
};

class MapBuilder {
  constructor(w, h, fill = 1) {
    this.w = w; this.h = h;
    this.cells = Array.from({ length: h }, () => Array(w).fill(fill));
    this.doors = [];
    this.things = [];
  }
  setCell(x, y, v) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = v;
  }
  // Carve a rectangular floor (cells become 0). Walls of the rect stay as
  // whatever was previously there (typically wall).
  carveRoom(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.setCell(x, y, 0);
  }
  // Carve a 1-tile-wide horizontal corridor between (x0,y) and (x1,y).
  carveH(x0, x1, y) {
    const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
    for (let x = a; x <= b; x++) this.setCell(x, y, 0);
  }
  carveV(y0, y1, x) {
    const [a, b] = y0 < y1 ? [y0, y1] : [y1, y0];
    for (let y = a; y <= b; y++) this.setCell(x, y, 0);
  }
  // Place a door cell. Adds to doors[] and sets the cell to the door wall ID.
  door(x, y, axis, doorId = 5, key = null) {
    this.setCell(x, y, doorId);
    const tex = doorId === 6 ? 'door_red' : doorId === 7 ? 'door_blue' : 'door_steel';
    this.doors.push({ x, y, axis, texture: tex, key });
  }
  // Stamp a strip of cells with a particular wall ID (used for the exit sign).
  paint(x0, y0, x1, y1, id) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.setCell(x, y, id);
  }
  thing(type, x, y, extra = {}) {
    this.things.push({ type, x, y, ...extra });
  }
}

// ---- connectivity check -----------------------------------------------------

function checkReachable(level) {
  const start = level.things.find(t => t.type === 'player_start');
  if (!start) return { ok: false, msg: 'no player_start' };
  const visited = Array.from({ length: level.height }, () => Array(level.width).fill(false));
  const sx = Math.floor(start.x), sy = Math.floor(start.y);
  if (level.cells[sy][sx] !== 0) return { ok: false, msg: `player_start at (${sx},${sy}) is not on an air cell (got ${level.cells[sy][sx]})` };
  const stack = [[sx, sy]];
  visited[sy][sx] = true;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue;
      if (visited[ny][nx]) continue;
      const c = level.cells[ny][nx];
      // 0 = air, door IDs (5/6/7) treated walkable when opened.
      if (c !== 0 && c !== 5 && c !== 6 && c !== 7) continue;
      visited[ny][nx] = true;
      stack.push([nx, ny]);
    }
  }
  const unreachable = [];
  for (const t of level.things) {
    if (t.type === 'player_start') continue;
    const tx = Math.floor(t.x), ty = Math.floor(t.y);
    if (!visited[ty][tx]) unreachable.push(`${t.type} at (${t.x},${t.y})`);
  }
  return unreachable.length === 0
    ? { ok: true, msg: 'all reachable' }
    : { ok: false, msg: 'unreachable: ' + unreachable.join('; ') };
}

// ---- level builders ---------------------------------------------------------

function buildE1M1() {
  // Hangar Echo: NW spawn room -> connecting hall -> central plaza ->
  // SE storage room -> exit nook.
  const m = new MapBuilder(24, 20, 1);

  // NW spawn room
  m.carveRoom(1, 1, 9, 5);
  // NE supply room
  m.carveRoom(14, 1, 22, 5);
  // central plaza
  m.carveRoom(1, 8, 22, 11);
  // SW vestibule
  m.carveRoom(1, 14, 8, 18);
  // SE storage
  m.carveRoom(13, 14, 22, 18);
  // exit nook (between SW and SE, on the south wall)
  m.carveRoom(10, 16, 12, 18);

  // Connecting corridors
  m.carveV(5, 8, 4);     // NW room -> plaza
  m.carveV(5, 8, 18);    // NE room -> plaza
  m.carveV(11, 14, 4);   // plaza -> SW
  m.carveV(11, 14, 18);  // plaza -> SE
  m.carveV(11, 16, 11);  // plaza -> exit nook
  m.carveH(8, 10, 17);   // SW vestibule -> exit nook
  m.carveH(12, 13, 17);  // exit nook -> SE storage

  // Doors
  m.door(4, 6, 'y', 5);   // NW -> plaza
  m.door(18, 6, 'y', 5);  // NE -> plaza
  m.door(4, 13, 'y', 5);  // plaza -> SW
  m.door(18, 13, 'y', 5); // plaza -> SE
  m.door(11, 15, 'y', 5); // plaza -> exit nook

  // Exit wall sign — south wall of the exit nook at y=19 (the bottom border).
  m.paint(10, 19, 12, 19, 9);

  // Things
  m.thing('player_start', 2.5, 3.5, { angle: 0 });
  m.thing('decoration_lamp', 1.5, 1.5);
  m.thing('decoration_lamp', 8.5, 1.5);
  m.thing('decoration_barrel', 7.5, 4.5, { destructible: true });

  m.thing('enemy_zombie', 16.5, 3.5);
  m.thing('enemy_zombie', 20.5, 4.5);
  m.thing('pickup_ammo',   21.5, 1.5);
  m.thing('pickup_health', 14.5, 4.5);

  m.thing('decoration_pillar', 8.5, 9.5);
  m.thing('decoration_pillar', 15.5, 9.5);
  m.thing('decoration_pillar', 8.5, 10.5);
  m.thing('decoration_pillar', 15.5, 10.5);
  m.thing('enemy_imp',         11.5, 9.5);
  m.thing('decoration_corpse', 12.5, 10.5);
  m.thing('pickup_shells',     12.5, 9.5);

  m.thing('enemy_zombie',      3.5, 17.5);
  m.thing('weapon_shotgun',    5.5, 16.5);
  m.thing('pickup_health',     7.5, 14.5);

  m.thing('decoration_barrel', 14.5, 15.5, { destructible: true });
  m.thing('decoration_barrel', 15.5, 15.5, { destructible: true });
  m.thing('enemy_imp',         18.5, 15.5);
  m.thing('pickup_armor',      21.5, 17.5);

  m.thing('exit', 11.5, 17.5);

  return {
    name: 'E1M1: Hangar Echo',
    description: 'Opening level. NW spawn into a central plaza, two flanking rooms, then south to the exit nook.',
    width: 24, height: 20,
    tileset: 'tech',
    floor:   { texture: 'floor_tile',   light: 0.55 },
    ceiling: { texture: 'ceiling_gray', light: 0.45 },
    wallTextures: WALL_TEXTURES,
    cells: m.cells, doors: m.doors, things: m.things
  };
}

function buildE1M2() {
  // Refinery Pit: a more open level with a central pit, blood theme.
  // The shotgun and red key are hidden in side rooms; exit is locked.
  const m = new MapBuilder(28, 22, 1);

  // entry room
  m.carveRoom(1, 1, 6, 6);
  // east entry corridor
  m.carveRoom(7, 3, 12, 4);
  // central pit room
  m.carveRoom(8, 6, 19, 15);
  // pit decorations: leave the floor as 0; just thematic
  // west chapel (blood)
  m.carveRoom(1, 9, 6, 13);
  // east refinery
  m.carveRoom(21, 6, 26, 11);
  // south armory
  m.carveRoom(10, 17, 17, 20);
  // north overlook
  m.carveRoom(13, 1, 16, 4);

  // corridors
  m.carveH(6, 8, 3);    // entry -> central via corridor at row 3-4
  m.carveH(6, 8, 4);
  m.carveV(4, 6, 14);   // overlook -> central
  m.carveH(6, 8, 11);   // chapel -> central
  m.carveV(11, 13, 5);  // chapel link
  m.carveH(19, 21, 8);  // central -> refinery
  m.carveH(19, 21, 9);
  m.carveV(15, 17, 13); // central -> armory
  m.carveV(15, 17, 14);

  // doors
  m.door(7, 3, 'x', 5);   // entry door (steel)
  m.door(8, 11, 'y', 5);  // chapel door
  m.door(20, 8, 'y', 5);  // refinery door
  m.door(13, 16, 'x', 6); // armory door (RED key required)
  m.door(14, 16, 'x', 6);

  // exit sign on south wall of armory (occupies row 21, the bottom border)
  m.paint(12, 21, 15, 21, 9);

  // Style: paint a few central cells as blood walls? Skip — keep textures
  // consistent so engines don't need theme switching.

  // Things
  m.thing('player_start', 2.5, 2.5, { angle: 0 });
  m.thing('decoration_lamp',   1.5, 1.5);
  m.thing('pickup_health',     5.5, 5.5);

  // central pit
  m.thing('enemy_imp',         10.5, 8.5);
  m.thing('enemy_imp',         17.5, 9.5);
  m.thing('enemy_demon',       13.5, 11.5);
  m.thing('decoration_barrel', 11.5, 12.5, { destructible: true });
  m.thing('decoration_barrel', 12.5, 12.5, { destructible: true });
  m.thing('decoration_pillar', 9.5,  6.5);
  m.thing('decoration_pillar', 18.5, 6.5);

  // chapel — has the red key and a shotgun, watched by a zombie
  m.thing('enemy_zombie',      3.5, 11.5);
  m.thing('weapon_shotgun',    2.5, 10.5);
  m.thing('pickup_key_red',    5.5, 12.5);
  m.thing('decoration_corpse', 4.5, 11.5);

  // overlook — sniping zombies
  m.thing('enemy_zombie',      14.5, 2.5);
  m.thing('enemy_zombie',      15.5, 3.5);
  m.thing('pickup_ammo',       14.5, 1.5);

  // refinery — shells and an imp
  m.thing('enemy_imp',         24.5, 8.5);
  m.thing('pickup_shells',     25.5, 6.5);
  m.thing('pickup_armor',      22.5, 10.5);
  m.thing('decoration_barrel', 23.5, 7.5, { destructible: true });

  // armory (locked red) — has health, ammo, exit
  m.thing('pickup_health',     11.5, 18.5);
  m.thing('pickup_health',     16.5, 18.5);
  m.thing('pickup_ammo',       12.5, 19.5);
  m.thing('decoration_lamp',   10.5, 17.5);
  m.thing('decoration_lamp',   17.5, 17.5);
  m.thing('exit',              13.5, 19.5);

  return {
    name: 'E1M2: Refinery Pit',
    description: 'Open central pit, side rooms, and a red-locked armory hiding the exit.',
    width: 28, height: 22,
    tileset: 'industrial',
    floor:   { texture: 'floor_concrete', light: 0.5 },
    ceiling: { texture: 'ceiling_gray',   light: 0.4 },
    wallTextures: WALL_TEXTURES,
    cells: m.cells, doors: m.doors, things: m.things
  };
}

function buildE1M3() {
  // Command Spire: brick-and-blood themed final-act level. Long corridors,
  // a blood lake, a blue-locked command room with the exit.
  const m = new MapBuilder(30, 24, 1);

  // entry corridor (south-west) — player spawns here.
  m.carveRoom(1, 20, 6, 22);
  // first chamber, opens north of the entry corridor
  m.carveRoom(1, 14, 8, 19);
  // vertical climb corridor (cols 4-5, rows 5-14)
  m.carveV(5, 14, 4);
  m.carveV(5, 14, 5);
  // upper hall (covers cols 1-12, rows 1-4)
  m.carveRoom(1, 1, 12, 4);
  // blood lake (central room)
  m.carveRoom(10, 6, 19, 14);
  // east passage
  m.carveRoom(20, 8, 28, 13);
  // command room (north-east)
  m.carveRoom(20, 1, 28, 6);
  // exit alcove
  m.carveRoom(23, 16, 28, 22);

  // Bridges between rooms — all must connect.
  // upper hall (row 4) -> blood lake (row 6): carve col 11 rows 4-6
  m.carveV(4, 6, 11);
  // blood lake -> east passage at col 19/20 around row 10
  m.carveH(19, 20, 10);
  m.carveH(19, 20, 11);
  // east passage -> command room (col 24 rows 6-8)
  m.carveV(6, 8, 24);
  // east passage -> exit alcove (col 25 rows 13-16)
  m.carveV(13, 16, 25);
  // blood lake -> first chamber south (col 11 rows 14-16? first chamber stops at row 19)
  m.carveV(14, 16, 11);

  // Doors
  m.door(11, 5, 'y', 5);   // upper hall -> blood lake (just north of lake)
  m.door(20, 10, 'x', 5);  // blood lake -> east passage
  m.door(24, 7, 'y', 5);   // east passage -> command room
  m.door(11, 15, 'y', 5);  // blood lake -> first chamber link
  m.door(25, 15, 'y', 7);  // exit alcove door — BLUE key required

  // Exit sign on south wall of exit alcove (row 23, bottom border)
  m.paint(25, 23, 27, 23, 9);

  // Things
  m.thing('player_start', 2.5, 21.5, { angle: 4.71 }); // facing north

  // entry corridor
  m.thing('decoration_lamp',   1.5, 20.5);
  m.thing('decoration_corpse', 5.5, 21.5);

  // first chamber
  m.thing('enemy_zombie',      4.5, 16.5);
  m.thing('enemy_zombie',      7.5, 18.5);
  m.thing('pickup_health',     6.5, 14.5);
  m.thing('weapon_shotgun',    3.5, 18.5);

  // upper hall
  m.thing('enemy_imp',         8.5, 2.5);
  m.thing('enemy_imp',         11.5, 3.5);
  m.thing('pickup_ammo',       2.5, 1.5);
  m.thing('pickup_shells',     3.5, 1.5);
  m.thing('decoration_pillar', 6.5, 2.5);
  m.thing('decoration_pillar', 9.5, 2.5);

  // blood lake (central) — big fight
  m.thing('enemy_demon',       12.5, 9.5);
  m.thing('enemy_demon',       17.5, 11.5);
  m.thing('enemy_imp',         14.5, 7.5);
  m.thing('enemy_imp',         15.5, 13.5);
  m.thing('decoration_barrel', 13.5, 10.5, { destructible: true });
  m.thing('decoration_barrel', 16.5, 10.5, { destructible: true });
  m.thing('decoration_pillar', 11.5, 7.5);
  m.thing('decoration_pillar', 18.5, 13.5);

  // east passage
  m.thing('enemy_zombie',      22.5, 10.5);
  m.thing('enemy_imp',         26.5, 12.5);
  m.thing('pickup_armor',      27.5, 8.5);
  m.thing('pickup_health',     21.5, 12.5);

  // command room — has the BLUE key
  m.thing('enemy_demon',       25.5, 3.5);
  m.thing('pickup_key_blue',   27.5, 1.5);
  m.thing('pickup_shells',     22.5, 1.5);
  m.thing('decoration_lamp',   20.5, 1.5);
  m.thing('decoration_lamp',   28.5, 1.5);

  // exit alcove
  m.thing('pickup_health',     26.5, 16.5);
  m.thing('pickup_ammo',       27.5, 16.5);
  m.thing('exit',              25.5, 21.5);

  return {
    name: 'E1M3: Command Spire',
    description: 'Multi-room descent. Blood-lake brawl, blue-locked command room, then the spire exit.',
    width: 30, height: 24,
    tileset: 'gothic',
    floor:   { texture: 'floor_blood', light: 0.4 },
    ceiling: { texture: 'ceiling_dark', light: 0.35 },
    wallTextures: WALL_TEXTURES,
    cells: m.cells, doors: m.doors, things: m.things
  };
}

// ---- main -------------------------------------------------------------------

const targets = [
  { file: 'e1m1.json', build: buildE1M1 },
  { file: 'e1m2.json', build: buildE1M2 },
  { file: 'e1m3.json', build: buildE1M3 }
];

const outDir = path.resolve(__dirname, '..', 'levels');
fs.mkdirSync(outDir, { recursive: true });

// Stable JSON writer: pretty-prints top-level fields, but inlines each row
// of `cells` and each entry of `doors` / `things` onto a single line so the
// files are diff-friendly and human-readable.
function formatLevel(lvl) {
  const j = (v) => JSON.stringify(v);
  const lines = [];
  lines.push('{');
  lines.push(`  "name": ${j(lvl.name)},`);
  lines.push(`  "description": ${j(lvl.description)},`);
  lines.push(`  "width": ${lvl.width},`);
  lines.push(`  "height": ${lvl.height},`);
  lines.push(`  "tileset": ${j(lvl.tileset)},`);
  lines.push(`  "floor": ${j(lvl.floor)},`);
  lines.push(`  "ceiling": ${j(lvl.ceiling)},`);
  lines.push('  "wallTextures": {');
  const wkeys = Object.keys(lvl.wallTextures);
  wkeys.forEach((k, i) => {
    const tail = i === wkeys.length - 1 ? '' : ',';
    lines.push(`    ${j(k)}: ${j(lvl.wallTextures[k])}${tail}`);
  });
  lines.push('  },');
  lines.push('  "cells": [');
  lvl.cells.forEach((row, i) => {
    const tail = i === lvl.cells.length - 1 ? '' : ',';
    lines.push(`    [${row.join(',')}]${tail}`);
  });
  lines.push('  ],');
  lines.push('  "doors": [');
  lvl.doors.forEach((d, i) => {
    const tail = i === lvl.doors.length - 1 ? '' : ',';
    lines.push(`    ${j(d)}${tail}`);
  });
  lines.push('  ],');
  lines.push('  "things": [');
  lvl.things.forEach((t, i) => {
    const tail = i === lvl.things.length - 1 ? '' : ',';
    lines.push(`    ${j(t)}${tail}`);
  });
  lines.push('  ]');
  lines.push('}');
  return lines.join('\n') + '\n';
}

let failed = 0;
for (const { file, build } of targets) {
  const lvl = build();
  const verdict = checkReachable(lvl);
  const fp = path.join(outDir, file);
  if (!verdict.ok) {
    console.error(`${file}: ${verdict.msg}`);
    failed++;
    continue;
  }
  fs.writeFileSync(fp, formatLevel(lvl));
  console.log(`${file}: ${verdict.msg} (${lvl.width}x${lvl.height}, ${lvl.things.length} things, ${lvl.doors.length} doors)`);
}
process.exit(failed === 0 ? 0 : 1);
