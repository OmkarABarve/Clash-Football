import { createMatch } from "../src/entities/factory.ts";
import { kingGoal, enemyGoals } from "../src/systems/goals.ts";
import { goalCenter, pointInGoal } from "../src/systems/geometry.ts";
import { findDiveTarget } from "../src/systems/spells.ts";

const s = createMatch();
const king = kingGoal(s, "ai");
console.log("king", king);
if (!king) throw new Error("no king");
const c = goalCenter(king);
console.log({
  kingId: king.id,
  hp: king.hp,
  activated: king.activated,
  rect: { x: king.x, y: king.y, w: king.w, h: king.h },
  c,
  in: pointInGoal(c.x, c.y, king),
});
console.log(
  "enemyGoals",
  enemyGoals(s, "ai").map((g) => ({ id: g.id, role: g.role, hp: g.hp })),
);
console.log("target", findDiveTarget(s, "player", c.x, c.y));
console.log("tileSize", s.config.tileSize, "hitR", 1.5 * s.config.tileSize);
