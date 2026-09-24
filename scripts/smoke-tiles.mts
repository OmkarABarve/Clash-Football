import { MATCH_CONFIG } from "../src/config/match.ts";
import {
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  halfwayY,
  tilesToPx,
  buildPitchLayout,
} from "../src/config/tiles.ts";
import { getUnitDef } from "../src/config/units.ts";
import { createMatch, createUnit } from "../src/entities/factory.ts";

if (GRID_COLS !== 18 || GRID_ROWS !== 32) {
  throw new Error(`expected 18×32 grid, got ${GRID_COLS}×${GRID_ROWS}`);
}
if (TILE_SIZE !== 32) throw new Error(`expected tileSize 32, got ${TILE_SIZE}`);

const pitch = buildPitchLayout(TILE_SIZE);
if (pitch.arena.width !== 576 || pitch.arena.height !== 1024) {
  throw new Error(
    `arena should be 576×1024, got ${pitch.arena.width}×${pitch.arena.height}`,
  );
}
if (MATCH_CONFIG.arena.width !== 576 || MATCH_CONFIG.arena.height !== 1024) {
  throw new Error("MATCH_CONFIG.arena not derived from tiles");
}
if (MATCH_CONFIG.midlineY !== halfwayY()) {
  throw new Error("midline should sit between rows 16 and 17");
}
if (MATCH_CONFIG.kingWidth !== tilesToPx(4)) {
  throw new Error("king goal should be 4 tiles wide");
}
console.log("grid ok", {
  arena: MATCH_CONFIG.arena,
  midlineY: MATCH_CONFIG.midlineY,
  kingW: MATCH_CONFIG.kingWidth / TILE_SIZE,
  princessInsetY: MATCH_CONFIG.princessInsetY / TILE_SIZE,
});

// Unit stats authored in tiles → converted at spawn
const s = createMatch();
const z = createUnit(s, "zlatan", "player", 288, 700);
z.spawnT = 0;
const def = getUnitDef("zlatan");
const expectedRange = def.range * TILE_SIZE;
if (Math.abs(z.range - expectedRange) > 0.01) {
  throw new Error(
    `Zlatan range should be ${expectedRange}px (${def.range} tiles), got ${z.range}`,
  );
}
const expectedSpeed = def.speed * TILE_SIZE;
if (Math.abs(z.speed - expectedSpeed) > 0.01) {
  throw new Error(
    `Zlatan speed should be ${expectedSpeed}px/s (${def.speed} tiles/s), got ${z.speed}`,
  );
}
console.log("unit tile→px ok", {
  rangeTiles: def.range,
  rangePx: z.range,
  speedTiles: def.speed,
  speedPx: z.speed,
});

console.log("TILE GRID SMOKE OK");
