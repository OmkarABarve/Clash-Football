const fs = require("fs");

function read(p) {
  const b = fs.readFileSync(p);
  return b[1] === 0
    ? b.toString("utf16le").replace(/^\uFEFF/, "")
    : b.toString("utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

// --- types ---
let types = read("src/config/types.ts");
if (!types.includes("princessTowerRange")) {
  types = types.replace(
    `  /** Princess tower damage per shot (vs troops). */
  princessTowerDamage: number;
  /** Princess tower hit speed in seconds. */
  princessTowerCooldown: number;
  /** King tower damage per shot (vs troops), when activated. */
  kingTowerDamage: number;
  /** King tower hit speed in seconds. */
  kingTowerCooldown: number;`,
    `  /** Princess tower damage per shot (vs troops). */
  princessTowerDamage: number;
  /** Princess tower hit speed in seconds (Clash: 0.8). */
  princessTowerCooldown: number;
  /** Princess tower shoot range in tiles (Clash: 7.5). */
  princessTowerRange: number;
  /** King tower damage per shot (vs troops), when activated. */
  kingTowerDamage: number;
  /** King tower hit speed in seconds (Clash: ~1.0). */
  kingTowerCooldown: number;
  /** King tower shoot range in tiles (Clash: ~7). */
  kingTowerRange: number;`,
  );
  write("src/config/types.ts", types);
  console.log("types ok");
} else console.log("types already has range");

// --- match ---
let match = read("src/config/match.ts");
match = match.replace(
  `  princessTowerDamage: 85,
  princessTowerCooldown: 1.25,
  kingTowerDamage: 105,
  kingTowerCooldown: 1.4,
};`,
  `  // Clash Royale tower stats (tiles / seconds)
  princessTowerDamage: 85,
  princessTowerCooldown: 0.8,
  princessTowerRange: 7.5,
  // King damage matches princess; wakes only when a side tower falls
  kingTowerDamage: 85,
  kingTowerCooldown: 1.0,
  kingTowerRange: 7,
};`,
);
write("src/config/match.ts", match);
console.log("match ok");

// --- towers.ts ---
write(
  "src/systems/towers.ts",
  `import { createProjectile } from "../entities/factory";
import type { GameState, Goal, Side, Unit } from "../config/types";
import { goalCenter } from "./geometry";

function enemySide(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

/** Clash-style tower sight range in world px (from tile stats). */
export function towerRange(state: GameState, goal: Goal): number {
  const tiles =
    goal.role === "king"
      ? state.config.kingTowerRange
      : state.config.princessTowerRange;
  return tiles * state.config.tileSize;
}

function towerDamage(state: GameState, goal: Goal): number {
  return goal.role === "king"
    ? state.config.kingTowerDamage
    : state.config.princessTowerDamage;
}

function towerCooldown(state: GameState, goal: Goal): number {
  return goal.role === "king"
    ? state.config.kingTowerCooldown
    : state.config.princessTowerCooldown;
}

function livingEnemies(state: GameState, side: Side): Unit[] {
  const foe = enemySide(side);
  return state.units.filter(
    (u) => u.side === foe && u.hp > 0 && u.deathT <= 0,
  );
}

function nearestInRange(
  state: GameState,
  goal: Goal,
  enemies: Unit[],
): Unit | null {
  const c = goalCenter(goal);
  const range = towerRange(state, goal);
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const u of enemies) {
    const d = Math.hypot(u.x - c.x, u.y - c.y);
    if (d > range) continue;
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/**
 * Active towers shoot the nearest enemy troop in range.
 * Princess: always. King: only after a side (princess) tower falls.
 */
export function updateTowers(state: GameState, dt: number): void {
  for (const goal of state.goals) {
    if (goal.hp <= 0) continue;
    if (goal.role === "king" && !goal.activated) continue;

    if (goal.cooldownLeft > 0) {
      goal.cooldownLeft = Math.max(0, goal.cooldownLeft - dt);
    }
    if (goal.cooldownLeft > 0) continue;

    const target = nearestInRange(state, goal, livingEnemies(state, goal.side));
    if (!target) continue;

    const c = goalCenter(goal);
    state.projectiles.push(
      createProjectile(state, {
        side: goal.side,
        x: c.x,
        y: c.y,
        target: { kind: "unit", id: target.id },
        damage: towerDamage(state, goal),
        goalHpDelta: 0,
        empowered: false,
      }),
    );
    goal.cooldownLeft = towerCooldown(state, goal);
  }
}
`,
);
console.log("towers rewritten");

// --- damage: king wakes ONLY when a princess falls, not when king is hit ---
let dmg = read("src/systems/damage.ts");
if (dmg.includes('if (goal.role === "king")')) {
  dmg = dmg.replace(
    `  if (goal.role === "king") {
    goal.activated = true;
  }

  // Clash Royale: losing a princess wakes the king
  if (goal.role === "princess" && goal.hp <= 0) {
    activateKing(state, goal.side);
  }
}`,
    `  // Clash Royale: King wakes only when a side (princess) tower is destroyed —
  // not merely from being damaged.
  if (goal.role === "princess" && goal.hp <= 0) {
    activateKing(state, goal.side);
  }
}`,
  );
  write("src/systems/damage.ts", dmg);
  console.log("damage king-wake fixed");
} else {
  console.log("damage already without king-on-hit");
}

console.log("DONE");
