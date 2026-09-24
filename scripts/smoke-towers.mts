import { createMatch, createUnit } from "../src/entities/factory.ts";
import { MATCH_CONFIG } from "../src/config/match.ts";
import { getUnitDef } from "../src/config/units.ts";
import { updateTowers } from "../src/systems/towers.ts";
import { updateProjectiles } from "../src/systems/projectiles.ts";
import { goalCenter } from "../src/systems/geometry.ts";

const step = 1 / 60;

const messi = getUnitDef("messi");
if (messi.attackCooldown < 1.7) {
  throw new Error(`Messi should be slower; attackCooldown=${messi.attackCooldown}`);
}
console.log("atk speed ok", messi.attackCooldown);

const s = createMatch();
const left = s.goals.find((g) => g.id === "player-left")!;
const center = goalCenter(left);
const range = Math.abs(center.y - s.config.midlineY);

const enemy = createUnit(s, "neymar", "ai", center.x, center.y - range * 0.5);
enemy.spawnT = 0;
s.units.push(enemy);
const hpBefore = enemy.hp;

let fired = false;
for (let i = 0; i < 60 * 4; i++) {
  const before = s.projectiles.length;
  updateTowers(s, step);
  if (s.projectiles.length > before) fired = true;
  updateProjectiles(s, step);
}

console.log({
  fired,
  range: Math.round(range),
  dmg: MATCH_CONFIG.princessTowerDamage,
  hpBefore,
  hpAfter: enemy.hp,
});

if (!fired) throw new Error("princess tower should shoot enemies in range");
if (enemy.hp >= hpBefore) throw new Error("tower should deal damage");

const s2 = createMatch();
const left2 = s2.goals.find((g) => g.id === "player-left")!;
const c2 = goalCenter(left2);
const far = createUnit(s2, "neymar", "ai", c2.x, 80);
far.spawnT = 0;
s2.units.push(far);
for (let i = 0; i < 90; i++) updateTowers(s2, step);
if (s2.projectiles.length > 0) {
  throw new Error("tower must not shoot beyond half-line range");
}
console.log("half-line range ok");

const s3 = createMatch();
const king = s3.goals.find((g) => g.id === "player-king")!;
if (king.activated) throw new Error("king starts inactive");
const near = createUnit(s3, "neymar", "ai", king.x + king.w / 2, s.config.midlineY + 40);
near.spawnT = 0;
s3.units.push(near);
for (let i = 0; i < 90; i++) updateTowers(s3, step);
if (s3.projectiles.length > 0) throw new Error("inactive king must not shoot");
console.log("inactive king ok");

console.log("TOWER + ATK SPEED SMOKE OK");
