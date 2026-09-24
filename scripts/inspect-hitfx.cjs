const fs = require("fs");

function grab(src, re) {
  const m = src.match(re);
  return m ? m[0] : "NOT FOUND";
}

const types = fs.readFileSync("src/config/types.ts", "utf8");
const matchCfg = fs.readFileSync("src/config/match.ts", "utf8");
const damage = fs.readFileSync("src/systems/damage.ts", "utf8");
const matchSys = fs.readFileSync("src/systems/match.ts", "utf8");
const loop = fs.readFileSync("src/systems/loop.ts", "utf8");
const projectiles = fs.readFileSync("src/systems/projectiles.ts", "utf8");
const render = fs.readFileSync("src/ui/render.ts", "utf8");
const factory = fs.readFileSync("src/entities/factory.ts", "utf8");
const movement = fs.readFileSync("src/systems/movement.ts", "utf8");
const combat = fs.readFileSync("src/systems/combat.ts", "utf8");
const targeting = fs.readFileSync("src/systems/targeting.ts", "utf8");

console.log("=== UNIT ===\n", grab(types, /export interface Unit \{[\s\S]*?\n\}/));
console.log("=== GAMESTATE ===\n", grab(types, /export interface GameState \{[\s\S]*?\n\}/));
console.log("=== MATCH CONFIG TAIL ===\n", matchCfg.slice(matchCfg.indexOf("shootRecoilDuration")));
console.log("=== TYPES CONFIG TAIL ===\n", types.slice(types.indexOf("shootRecoilDuration")));
console.log("=== DAMAGE ===\n", damage);
console.log("=== MATCH SYS ===\n", matchSys);
console.log("=== LOOP SIM ===\n", loop.slice(loop.indexOf("function simulate")));
console.log("=== PROJECTILES ===\n", projectiles);
console.log("=== FACTORY createUnit return ===\n", grab(factory, /return \{[\s\S]*?shootRecoil: 0,\n  \};/));
console.log("=== DRAW UNIT CALL ===\n", [...render.matchAll(/drawUnit\([^)]*\)/g)].map((m) => m[0]));
console.log("=== DRAW UNIT FN START ===\n", render.slice(render.indexOf("function drawUnit"), render.indexOf("function drawUnit") + 200));
console.log("=== CLEANUP FILTER ===", matchSys.includes("u.hp > 0"));
