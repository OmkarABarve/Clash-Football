/**
 * Rename Pen → Dive. Targeted spell: tower −1 HP, or enemy unit yellow (−20% AS).
 */
const fs = require("fs");
const path = require("path");

function read(rel) {
  const p = path.join(__dirname, "..", rel);
  let b = fs.readFileSync(p);
  if (b[1] === 0) b = Buffer.from(b.toString("utf16le").replace(/^\uFEFF/, ""), "utf8");
  return b.toString("utf8");
}
function write(rel, s) {
  fs.writeFileSync(path.join(__dirname, "..", rel), s, "utf8");
  console.log("wrote", rel);
}

// --- types ---
{
  let s = read("src/config/types.ts");
  s = s.replace(/"highline" \| "pen"/, '"highline" | "dive"');
  s = s.replace(
    /\/\*\* Pen: guaranteed HP removed from the enemy King tower\. \*\/\n  towerHpDelta\?: number;/,
    `/** Dive: HP removed when cast on a tower. */
  towerHpDelta?: number;
  /** Dive: attack-speed multiplier when yellow-carding a unit (0.8 = −20%). */
  yellowAttackSpeedMult?: number;`,
  );
  // Unit: yellow card flag
  if (!s.includes("yellowCard")) {
    s = s.replace(
      /\/\*\* Stun \/ freeze timer \(seconds\)\. > 0 = cannot move or attack\. \*\/\n  freezeT: number;\n\}/,
      `/** Stun / freeze timer (seconds). > 0 = cannot move or attack. */
  freezeT: number;
  /** Dive yellow card — attacks 20% slower while true. */
  yellowCard: boolean;
}`,
    );
  }
  write("src/config/types.ts", s);
}

// --- cards ---
{
  let s = read("src/config/cards.ts");
  s = s.replace(
    /pen: \{[\s\S]*?\n  \},/,
    `dive: {
    id: "dive",
    name: "Dive",
    label: "DV",
    cost: 2,
    kind: "spell",
    spell: "dive",
    towerHpDelta: 1,
    yellowAttackSpeedMult: 0.8,
  },`,
  );
  write("src/config/cards.ts", s);
}

// --- factory: yellowCard: false ---
{
  let s = read("src/entities/factory.ts");
  if (!s.includes("yellowCard")) {
    s = s.replace(
      /freezeT: 0,\n  \};/,
      `freezeT: 0,\n    yellowCard: false,\n  };`,
    );
    write("src/entities/factory.ts", s);
  } else console.log("factory already has yellowCard");
}

// --- combat: apply yellow AS ---
{
  let s = read("src/systems/combat.ts");
  s = s.replace(
    /unit\.cooldownLeft = def\.attackCooldown;/,
    `unit.cooldownLeft = def.attackCooldown / (unit.yellowCard ? 0.8 : 1);`,
  );
  write("src/systems/combat.ts", s);
}

// --- spells: replace castPen with castDive ---
{
  let s = read("src/systems/spells.ts");
  // Ensure imports for geometry/goals helpers used by targeting
  if (!s.includes("pointInGoal")) {
    s = s.replace(
      /import \{([^}]+)\} from "\.\/geometry";/,
      (m, inner) => {
        const parts = inner.split(",").map((x) => x.trim()).filter(Boolean);
        for (const need of ["pointInGoal", "closestPointOnGoal", "dist", "unitFootprint", "closestPointOnUnit", "goalCenter"]) {
          if (!parts.includes(need) && !inner.includes(need)) parts.push(need);
        }
        // keep only what exists - we'll verify after
        return `import { ${parts.join(", ")} } from "./geometry";`;
      },
    );
  }
  if (!s.includes("enemyGoals") && !s.includes("livingGoals")) {
    s = s.replace(
      /import \{([^}]+)\} from "\.\/goals";/,
      (m, inner) => `import { ${inner.trim()}, enemyGoals } from "./goals";`,
    );
  }

  // Remove old castPen
  s = s.replace(/\n\/\*\*[\s\S]*?export function castPen\([\s\S]*?\n\}\n?$/, "\n");
  s = s.replace(/\nexport function castPen\([\s\S]*?\n\}\n?$/, "\n");

  const geo = read("src/systems/geometry.ts");
  const hasPointInGoal = geo.includes("export function pointInGoal");
  const hasClosestGoal = geo.includes("export function closestPointOnGoal");
  const hasDist = geo.includes("export function dist(");
  const hasFootprint = geo.includes("export function unitFootprint");
  const hasClosestUnit = geo.includes("export function closestPointOnUnit");
  const hasGoalCenter = /export function goalCenter/.test(geo);

  // Rebuild geometry import cleanly
  const geoNeeds = [];
  if (hasGoalCenter) geoNeeds.push("goalCenter");
  if (hasPointInGoal) geoNeeds.push("pointInGoal");
  if (hasClosestGoal) geoNeeds.push("closestPointOnGoal");
  if (hasDist) geoNeeds.push("dist");
  if (hasFootprint) geoNeeds.push("unitFootprint");
  if (hasClosestUnit) geoNeeds.push("closestPointOnUnit");
  // Also keep anything spells already used from geometry
  if (s.includes("goalCenter") && !geoNeeds.includes("goalCenter") && hasGoalCenter) geoNeeds.push("goalCenter");

  if (/import \{[^}]+\} from "\.\/geometry";/.test(s)) {
    s = s.replace(/import \{[^}]+\} from "\.\/geometry";/, `import { ${geoNeeds.join(", ")} } from "./geometry";`);
  } else {
    s = s.replace(
      /import \{ getSpellDef \} from "\.\.\/config\/cards";/,
      `import { getSpellDef } from "../config/cards";\nimport { ${geoNeeds.join(", ")} } from "./geometry";`,
    );
  }

  // goals import
  const goalsFile = read("src/systems/goals.ts");
  const enemyGoalsName = goalsFile.includes("export function enemyGoals")
    ? "enemyGoals"
    : goalsFile.includes("export function enemyGoals")
      ? "enemyGoals"
      : null;
  const kingName = goalsFile.includes("export function kingGoal")
    ? "kingGoal"
    : goalsFile.includes("export function kingGoal")
      ? "kingGoal"
      : "kingGoal";

  if (enemyGoalsName && !s.includes(enemyGoalsName)) {
    if (/import \{[^}]+\} from "\.\/goals";/.test(s)) {
      s = s.replace(/import \{([^}]+)\} from "\.\/goals";/, (m, inner) => {
        if (inner.includes(enemyGoalsName)) return m;
        return `import { ${inner.trim()}, ${enemyGoalsName} } from "./goals";`;
      });
    }
  }

  const damageFile = read("src/systems/damage.ts");
  const applyGoal = damageFile.includes("applyGoalDamage")
    ? "applyGoalDamage"
    : "applyGoalDamage";

  const diveFn = `
const DIVE_HIT_TILES = 1.5;

type DiveTarget =
  | { kind: "goal"; goalId: string }
  | { kind: "unit"; unitId: number };

/** Pick the nearest enemy tower or troop under the cast point (Clash-style). */
export function findDiveTarget(
  state: GameState,
  caster: Side,
  x: number,
  y: number,
): DiveTarget | null {
  const foe = enemyOf(caster);
  const hitR = DIVE_HIT_TILES * state.config.tileSize;

  let bestGoal: { id: string; d: number } | null = null;
  for (const goal of ${enemyGoalsName ?? "enemyGoals"}(state, foe)) {
    if (goal.hp <= 0) continue;
    let d: number;
    if (pointInGoal(x, y, goal)) d = 0;
    else {
      const p = closestPointOnGoal(goal, x, y);
      d = dist(x, y, p.x, p.y);
    }
    if (d <= hitR && (!bestGoal || d < bestGoal.d)) bestGoal = { id: goal.id, d };
  }

  let bestUnit: { id: number; d: number } | null = null;
  for (const unit of state.units) {
    if (unit.side !== foe || unit.hp <= 0 || unit.deathT > 0) continue;
    const p = closestPointOnUnit(unit, x, y, state.config.tileSize);
    const d = dist(x, y, p.x, p.y);
    if (d <= hitR && (!bestUnit || d < bestUnit.d)) bestUnit = { id: unit.id, d };
  }

  if (bestGoal && bestUnit) {
    return bestGoal.d <= bestUnit.d
      ? { kind: "goal", goalId: bestGoal.id }
      : { kind: "unit", unitId: bestUnit.id };
  }
  if (bestGoal) return { kind: "goal", goalId: bestGoal.id };
  if (bestUnit) return { kind: "unit", unitId: bestUnit.id };
  return null;
}

/**
 * Dive: play anywhere. On an enemy tower → −1 HP.
 * On an enemy troop → yellow card (−20% attack speed).
 */
export function castDive(
  state: GameState,
  caster: Side,
  x: number,
  y: number,
): void {
  const spell = getSpellDef("dive");
  const target = findDiveTarget(state, caster, x, y);
  if (!target) return;

  if (target.kind === "goal") {
    const delta = spell.towerHpDelta ?? 1;
    ${applyGoal}(state, target.goalId, delta);
    const goal = state.goals.find((g) => g.id === target.goalId);
    if (goal) {
      const c = goalCenter(goal);
      let sx = x;
      let sy = y;
      if (Math.hypot(c.x - sx, c.y - sy) < 8) {
        sy = y + (caster === "player" ? -48 : 48);
      }
      const shot = createProjectile(state, {
        side: caster,
        x: sx,
        y: sy,
        target: { kind: "goal", goalId: goal.id },
        damage: 0,
        goalHpDelta: 0,
        empowered: true,
      });
      shot.speed = state.config.projectileSpeed * 1.6;
      state.projectiles.push(shot);
    }
    return;
  }

  const unit = state.units.find((u) => u.id === target.unitId);
  if (!unit || unit.hp <= 0) return;
  unit.yellowCard = true;
  // Stretch current wind-up so the slowdown is felt immediately.
  if (unit.cooldownLeft > 0) {
    unit.cooldownLeft /= spell.yellowAttackSpeedMult ?? 0.8;
  }
  state.damageFloats.push({
    x: unit.x,
    y: unit.y - getUnitDefRadius(state, unit),
    amount: 0,
    t: state.config.damageFloatDuration,
    duration: state.config.damageFloatDuration,
    label: "YC",
  });
}

function getUnitDefRadius(state: GameState, unit: Unit): number {
  // local helper avoids circular import churn — use footprint height
  const f = unitFootprint(unit, state.config.tileSize);
  return f.h / 2 + 8;
}
`;

  // Fix damage float if label not supported — check DamageFloat type
  const types = read("src/config/types.ts");
  if (!types.includes("interface DamageFloat")) {
    // skip label
  }
  let diveBody = diveFn;
  if (!/interface DamageFloat \{[\s\S]*?label/.test(types)) {
    // Check amount-only floats — use a comment float via amount hack or skip
    diveBody = diveBody.replace(
      /state\.damageFloats\.push\(\{[\s\S]*?\}\);/,
      `state.damageFloats.push({
    x: unit.x,
    y: unit.y - getUnitDefRadius(state, unit),
    amount: 0,
    t: state.config.damageFloatDuration,
    duration: state.config.damageFloatDuration,
  });`,
    );
  }

  // Remove unused kingGoal import if present after deleting castPen
  s = s.trimEnd() + "\n" + diveBody;
  write("src/systems/spells.ts", s);
}

console.log("phase A done");
