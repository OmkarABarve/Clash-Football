import { createMatch, createUnit } from "../src/entities/factory.ts";
import { getUnitDef } from "../src/config/units.ts";
import { applyUnitDamage } from "../src/systems/damage.ts";
import { updateTargeting } from "../src/systems/targeting.ts";
import { updateMovement } from "../src/systems/movement.ts";
import { updateCombat } from "../src/systems/combat.ts";
import { distUnits, unitFootprint } from "../src/systems/geometry.ts";
import { enabledCardIds } from "../src/config/cards.ts";

const step = 1 / 60;

// --- Defs ---
const wallDef = getUnitDef("wall");
const defTroop = getUnitDef("def");
const zlatan = getUnitDef("zlatan");
const iniesta = getUnitDef("iniesta");

if (wallDef.cost !== 5) throw new Error("Wall should cost 5 M");
if (wallDef.hp !== zlatan.hp / 2) throw new Error("Wall HP should be half Zlatan");
if (wallDef.ability?.kind !== "wall") throw new Error("Wall ability missing");
if (wallDef.ability.widthTiles !== 3) throw new Error("Wall should be 3 tiles wide");
if (wallDef.ability.breakInto !== "def" || wallDef.ability.breakCount !== 3) {
  throw new Error("Wall should break into 3 Def");
}
if (defTroop.speed !== iniesta.speed) throw new Error("Def speed should match Iniesta");
if (defTroop.hp !== iniesta.hp / 2) throw new Error("Def HP should be half Iniesta");
if (defTroop.damage !== 50) throw new Error("Def should deal basic melee damage 50");
if (defTroop.enabled !== false) throw new Error("Def should not be a hand card");
if (!enabledCardIds().includes("wall")) throw new Error("Wall should be in the card pool");
if (enabledCardIds().includes("def")) throw new Error("Def should not be in the card pool");
console.log("wall defs ok");

// --- Footprint width ---
const s = createMatch();
const wall = createUnit(s, "wall", "player", 288, 700);
wall.spawnT = 0;
s.units.push(wall);
const fp = unitFootprint(wall, s.config.tileSize);
const expectedW = 3 * s.config.tileSize;
if (Math.abs(fp.w - expectedW) > 0.5) {
  throw new Error(`Wall footprint width ${fp.w} != ${expectedW}`);
}
console.log("wall footprint ok", { w: fp.w, h: fp.h });

// --- Stationary / no attack ---
const foe = createUnit(s, "neymar", "ai", 288, 700 - 40);
foe.spawnT = 0;
s.units.push(foe);
const wallY0 = wall.y;
for (let i = 0; i < 30; i++) {
  updateTargeting(s);
  updateMovement(s, step);
  updateCombat(s, step);
}
if (Math.abs(wall.y - wallY0) > 0.5) throw new Error("Wall should not move");
if (wall.target !== null) throw new Error("Wall should not acquire targets");
console.log("wall stationary ok");

// --- Aggro: enemy should lock onto wall via footprint distance ---
updateTargeting(s);
if (!foe.target || foe.target.kind !== "unit" || foe.target.id !== wall.id) {
  // may already be in range — force closer
  foe.y = wall.y - 20;
  updateTargeting(s);
}
if (!foe.target || foe.target.kind !== "unit" || foe.target.id !== wall.id) {
  throw new Error("Enemy should aggro the Wall");
}
const d = distUnits(foe, wall, s.config.tileSize);
if (d > 40) throw new Error(`Footprint distance too large: ${d}`);
console.log("wall aggro ok", { d: d.toFixed(1) });

// --- Break into 3 Def on death ---
const s2 = createMatch();
const w2 = createUnit(s2, "wall", "player", 288, 650);
w2.spawnT = 0;
s2.units.push(w2);
applyUnitDamage(s2, w2, 9999);
if (w2.hp > 0) throw new Error("Wall should be dead");
const defs = s2.units.filter((u) => u.defId === "def" && u.hp > 0);
if (defs.length !== 3) throw new Error(`Expected 3 Def, got ${defs.length}`);
const xs = defs.map((u) => u.x).sort((a, b) => a - b);
const span = xs[2]! - xs[0]!;
if (span < s2.config.tileSize * 1.5) {
  throw new Error(`Def spawn span too tight: ${span}`);
}
for (const d of defs) {
  if (d.side !== "player") throw new Error("Def should keep Wall side");
  if (Math.abs(d.y - w2.y) > 1) throw new Error("Def should spawn on Wall Y");
}
console.log("wall break ok", { xs: xs.map((x) => x.toFixed(0)), defHp: defs[0]!.hp });

console.log("WALL SMOKE OK");
