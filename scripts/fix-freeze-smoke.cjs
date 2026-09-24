const fs = require("fs");

let r = fs.readFileSync("src/ui/render.ts", "utf8");
r = r.replace(
  /\n  const colorDrawn = unit\.freezeT > 0 \? "#4dd0e1" : color;/,
  "",
);
fs.writeFileSync("src/ui/render.ts", r, "utf8");
console.log("removed unused colorDrawn", !r.includes("colorDrawn"));

const smoke = `import { createMatch, createUnit } from "../src/entities/factory.ts";
import { getUnitDef } from "../src/config/units.ts";
import { updateTowers, towerRange } from "../src/systems/towers.ts";
import { updateProjectiles } from "../src/systems/projectiles.ts";
import { updateCombat } from "../src/systems/combat.ts";
import { updateMovement } from "../src/systems/movement.ts";
import { updateTargeting } from "../src/systems/targeting.ts";
import { goalCenter } from "../src/systems/geometry.ts";

const step = 1 / 60;

// --- Opponent towers attack player units ---
const s = createMatch();
const aiLeft = s.goals.find((g) => g.id === "ai-left")!;
const c = goalCenter(aiLeft);
const range = towerRange(s, aiLeft);
const troop = createUnit(s, "neymar", "player", c.x, c.y + range * 0.5);
troop.spawnT = 0;
s.units.push(troop);
const hp0 = troop.hp;

let aiFired = false;
for (let i = 0; i < 60 * 3; i++) {
  const before = s.projectiles.length;
  updateTowers(s, step);
  if (s.projectiles.length > before) {
    const shot = s.projectiles[s.projectiles.length - 1]!;
    if (shot.side === "ai") aiFired = true;
  }
  updateProjectiles(s, step);
}
console.log({ aiFired, hp0, hpAfter: troop.hp });
if (!aiFired) throw new Error("AI princess tower should shoot player troops");
if (troop.hp >= hp0) throw new Error("AI tower shot should damage player troop");
console.log("ai towers attack player ok");

// --- Iniesta freeze on hit ---
const def = getUnitDef("iniesta");
if (def.ability?.kind !== "freeze" || def.ability.duration !== 0.3) {
  throw new Error("Iniesta should have freeze 0.3s");
}

const s2 = createMatch();
const ini = createUnit(s2, "iniesta", "player", 288, 600);
const foe = createUnit(s2, "neymar", "ai", 288, 600 - 28);
ini.spawnT = 0;
foe.spawnT = 0;
s2.units.push(ini, foe);

let froze = false;
for (let i = 0; i < 60 * 4; i++) {
  updateTargeting(s2);
  updateMovement(s2, step);
  updateCombat(s2, step);
  updateProjectiles(s2, step);
  if (foe.freezeT > 0) {
    froze = true;
    const yLock = foe.y;
    for (let j = 0; j < 10; j++) {
      updateMovement(s2, step);
      updateCombat(s2, step);
    }
    if (Math.abs(foe.y - yLock) > 1) {
      throw new Error("frozen unit should not walk");
    }
    break;
  }
}
if (!froze) throw new Error("Iniesta hit should freeze the target");
console.log("iniesta freeze ok", {
  freezeT: foe.freezeT.toFixed(2),
  foeHp: foe.hp,
});

console.log("SYMMETRY + FREEZE SMOKE OK");
`;

fs.writeFileSync("scripts/smoke-freeze.mts", smoke, "utf8");
console.log("smoke written");
