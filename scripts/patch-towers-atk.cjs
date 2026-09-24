/**
 * Patch: slower unit attack speeds + tower combat to midline.
 */
const fs = require("fs");

function read(p) {
  const b = fs.readFileSync(p);
  return b[1] === 0 ? b.toString("utf16le").replace(/^\uFEFF/, "") : b.toString("utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

// --- 1) Slow all unit attack speeds (~40% slower hits) ---
let units = read("src/config/units.ts");
const cds = {
  "1.32": "1.85",
  "1.1": "1.55",
  "0.99": "1.4",
  "1.76": "2.45",
  "1.43": "2.0",
  "1.21": "1.7",
};
units = units.replace(/attackCooldown: ([0-9.]+)/g, (_, n) => {
  const next = cds[n];
  if (!next) throw new Error("unexpected cooldown " + n);
  return "attackCooldown: " + next;
});
write("src/config/units.ts", units);
console.log("units attackCooldown slowed");

// --- 2) Types: Goal.cooldownLeft + tower config ---
let types = read("src/config/types.ts");
if (!types.includes("cooldownLeft: number;") || !types.includes("export interface Goal")) {
  // ensure Goal gets cooldown
}
if (!/export interface Goal \{[\s\S]*?cooldownLeft/.test(types)) {
  types = types.replace(
    `  /** King starts inactive; activates when hit or a princess falls. */
  activated: boolean;
}`,
    `  /** King starts inactive; activates when hit or a princess falls. */
  activated: boolean;
  /** Seconds until this tower can fire again. */
  cooldownLeft: number;
}`,
  );
}
if (!types.includes("princessTowerDamage")) {
  types = types.replace(
    `  /** HighLine red-line push duration in seconds. */
  highLineDuration: number;
}`,
    `  /** HighLine red-line push duration in seconds. */
  highLineDuration: number;
  /** Princess tower damage per shot (vs troops). */
  princessTowerDamage: number;
  /** Princess tower hit speed in seconds. */
  princessTowerCooldown: number;
  /** King tower damage per shot (vs troops), when activated. */
  kingTowerDamage: number;
  /** King tower hit speed in seconds. */
  kingTowerCooldown: number;
}`,
  );
}
write("src/config/types.ts", types);
console.log("types patched");

// --- 3) Match config values ---
let match = read("src/config/match.ts");
if (!match.includes("princessTowerDamage")) {
  match = match.replace(
    `  highLineDuration: 0.55,
};`,
    `  highLineDuration: 0.55,
  princessTowerDamage: 85,
  princessTowerCooldown: 1.25,
  kingTowerDamage: 105,
  kingTowerCooldown: 1.4,
};`,
  );
}
write("src/config/match.ts", match);
console.log("match patched");

// --- 4) Factory: init goal.cooldownLeft ---
let factory = read("src/entities/factory.ts");
if (!/role: "princess"[\s\S]*?cooldownLeft/.test(factory)) {
  factory = factory.replace(
    /activated: true,\n    \},/g,
    "activated: true,\n      cooldownLeft: 0,\n    },",
  );
  factory = factory.replace(
    `      activated: false,
    },
  ];`,
    `      activated: false,
      cooldownLeft: 0,
    },
  ];`,
  );
}
write("src/entities/factory.ts", factory);
console.log("factory patched");

// --- 5) towers system ---
write(
  "src/systems/towers.ts",
  `import { createProjectile } from "../entities/factory";
import type { GameState, Goal, Side, Unit } from "../config/types";
import { goalCenter } from "./geometry";

function enemySide(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

/** Range reaches from the tower center to the half-line (midline). */
export function towerRange(state: GameState, goal: Goal): number {
  const c = goalCenter(goal);
  return Math.abs(c.y - state.config.midlineY);
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
 * Active towers shoot the nearest enemy troop in range (to the midline).
 * King only fires once activated.
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
console.log("wrote towers.ts");

// --- 6) Wire into loop ---
let loop = read("src/systems/loop.ts");
if (!loop.includes("updateTowers")) {
  loop = loop.replace(
    `import { updateCombat } from "./combat";`,
    `import { updateCombat } from "./combat";\nimport { updateTowers } from "./towers";`,
  );
  loop = loop.replace(
    `  updateCombat(state, dt);\n  updateProjectiles(state, dt);`,
    `  updateCombat(state, dt);\n  updateTowers(state, dt);\n  updateProjectiles(state, dt);`,
  );
}
write("src/systems/loop.ts", loop);
console.log("loop wired");

console.log("DONE");
