import { createMatch, createUnit } from "../src/entities/factory.ts";
import { getUnitDef, unitCategory } from "../src/config/units.ts";
import { updateTargeting } from "../src/systems/targeting.ts";
import { distUnits } from "../src/systems/geometry.ts";
import { MATCH_CONFIG } from "../src/config/match.ts";

const mid = MATCH_CONFIG.midlineY;
const s = createMatch();
console.log("detect", s.config.unitDetectRange, "tile", s.config.tileSize);

const n = createUnit(s, "neymar", "player", 288, mid + 120);
n.spawnT = 0;
const w = createUnit(s, "wall", "ai", 288, mid - 40);
w.spawnT = 0;
const troop = createUnit(s, "messi", "ai", 288, mid + 40);
troop.spawnT = 0;
s.units.push(n, w, troop);

console.log({
  neyFilter: getUnitDef("neymar").targetFilter,
  wallCat: unitCategory(getUnitDef("wall")),
  dWall: distUnits(n, w),
  dTroop: distUnits(n, troop),
  aggro: Math.max(s.config.unitDetectRange, 1 * s.config.tileSize * s.config.rangeScale),
  n: { x: n.x, y: n.y, spawnT: n.spawnT },
  w: { x: w.x, y: w.y, spawnT: w.spawnT, hp: w.hp },
});

updateTargeting(s);
console.log("target", n.target);
