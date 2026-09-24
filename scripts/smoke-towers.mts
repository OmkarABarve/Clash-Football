import { createMatch, createUnit } from "../src/entities/factory.ts";
import { MATCH_CONFIG } from "../src/config/match.ts";
import { TILE_SIZE } from "../src/config/tiles.ts";
import { applyGoalDamage } from "../src/systems/damage.ts";
import { updateTowers, towerRange } from "../src/systems/towers.ts";
import { updateProjectiles } from "../src/systems/projectiles.ts";
import { goalCenter } from "../src/systems/geometry.ts";

const step = 1 / 60;

if (MATCH_CONFIG.princessTowerRange !== 7.5) {
  throw new Error(`princess range should be 7.5 tiles, got ${MATCH_CONFIG.princessTowerRange}`);
}
if (MATCH_CONFIG.kingTowerRange !== 7) {
  throw new Error(`king range should be 7 tiles, got ${MATCH_CONFIG.kingTowerRange}`);
}
if (MATCH_CONFIG.princessTowerCooldown !== 0.8) {
  throw new Error(`princess cooldown should be 0.8s`);
}
if (MATCH_CONFIG.kingTowerCooldown !== 1.0) {
  throw new Error(`king cooldown should be 1.0s`);
}
if (MATCH_CONFIG.kingTowerDamage !== MATCH_CONFIG.princessTowerDamage) {
  throw new Error("king damage should match princess");
}
console.log("tower stats ok", {
  princess: `${MATCH_CONFIG.princessTowerRange}t / ${MATCH_CONFIG.princessTowerCooldown}s`,
  king: `${MATCH_CONFIG.kingTowerRange}t / ${MATCH_CONFIG.kingTowerCooldown}s`,
});

const s = createMatch();
const left = s.goals.find((g) => g.id === "player-left")!;
const center = goalCenter(left);
const rangePx = towerRange(s, left);
if (Math.abs(rangePx - 7.5 * TILE_SIZE) > 0.01) {
  throw new Error(`expected ${7.5 * TILE_SIZE}px range, got ${rangePx}`);
}

// Enemy inside 7.5 tiles — should get shot
const enemy = createUnit(s, "neymar", "ai", center.x, center.y - rangePx * 0.6);
enemy.spawnT = 0;
s.units.push(enemy);
const hpBefore = enemy.hp;

let fired = false;
for (let i = 0; i < 60 * 3; i++) {
  const before = s.projectiles.length;
  updateTowers(s, step);
  if (s.projectiles.length > before) fired = true;
  updateProjectiles(s, step);
}
if (!fired) throw new Error("princess should shoot inside 7.5 tiles");
if (enemy.hp >= hpBefore) throw new Error("tower should deal damage");
console.log("in-range ok", { rangePx, hpBefore, hpAfter: enemy.hp });

// Enemy beyond 7.5 tiles (toward mid) — should NOT get shot
const s2 = createMatch();
const left2 = s2.goals.find((g) => g.id === "player-left")!;
const c2 = goalCenter(left2);
const farY = c2.y - (7.5 * TILE_SIZE + 40);
const far = createUnit(s2, "neymar", "ai", c2.x, farY);
far.spawnT = 0;
s2.units.push(far);
for (let i = 0; i < 90; i++) updateTowers(s2, step);
if (s2.projectiles.length > 0) {
  throw new Error("tower must not shoot past 7.5 tiles");
}
console.log("out-of-range ok");

// Damaging king must NOT activate it
const s3 = createMatch();
const king = s3.goals.find((g) => g.id === "player-king")!;
if (king.activated) throw new Error("king starts inactive");
applyGoalDamage(s3, king.id, 1);
if (king.activated) throw new Error("damaging king must not activate it");
if (king.hp !== king.maxHp - 1) throw new Error("king should still take damage");
console.log("king hit does not wake ok");

// Losing a princess wakes the king
const s4 = createMatch();
const princess = s4.goals.find((g) => g.id === "player-left")!;
const king4 = s4.goals.find((g) => g.id === "player-king")!;
applyGoalDamage(s4, princess.id, princess.hp);
if (princess.hp > 0) throw new Error("princess should be destroyed");
if (!king4.activated) throw new Error("losing a side tower must wake the king");
console.log("princess fall wakes king ok");

console.log("CLASH TOWER SMOKE OK");
