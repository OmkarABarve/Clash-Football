/**
 * Pen → Dive: targeted tower −1 or unit yellow card (−20% attack speed).
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

// 1) types
{
  let s = read("src/config/types.ts");
  s = s.replace('export type SpellId = "highline" | "pen";', 'export type SpellId = "highline" | "dive";');
  s = s.replace(
    `  /** Pen: guaranteed HP removed from the enemy King tower. */
  towerHpDelta?: number;
  enabled?: boolean;
}`,
    `  /** Dive: HP removed when cast on a tower. */
  towerHpDelta?: number;
  /** Dive: attack-speed multiplier on yellow card (0.8 = −20%). */
  yellowAttackSpeedMult?: number;
  enabled?: boolean;
}`,
  );
  if (!s.includes("yellowCard")) {
    s = s.replace(
      `  /** Stun / freeze timer (seconds). > 0 = cannot move or attack. */
  freezeT: number;
}`,
      `  /** Stun / freeze timer (seconds). > 0 = cannot move or attack. */
  freezeT: number;
  /** Dive yellow card — attacks 20% slower while true. */
  yellowCard: boolean;
}`,
    );
  }
  write("src/config/types.ts", s);
}

// 2) cards
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

// 3) factory
{
  let s = read("src/entities/factory.ts");
  if (!s.includes("yellowCard")) {
    s = s.replace(/freezeT: 0,\r?\n  \};/, "freezeT: 0,\n    yellowCard: false,\n  };");
    write("src/entities/factory.ts", s);
  } else console.log("factory ok");
}

// 4) combat AS
{
  let s = read("src/systems/combat.ts");
  if (!s.includes("yellowCard")) {
    s = s.replace(
      /unit\.cooldownLeft = def\.attackCooldown;/,
      "unit.cooldownLeft = def.attackCooldown / (unit.yellowCard ? 0.8 : 1);",
    );
    write("src/systems/combat.ts", s);
  } else console.log("combat ok");
}

// 5) spells — replace castPen
{
  let s = read("src/systems/spells.ts");
  s = s.replace(
    `import { goalCenter } from "./geometry";
import { kingGoal } from "./goals";`,
    `import {
  closestPointOnGoal,
  closestPointOnUnit,
  dist,
  goalCenter,
  pointInGoal,
  unitFootprint,
} from "./geometry";
import { enemyGoals } from "./goals";`,
  );

  const castStart = s.search(/\/\*\*[\s\*]*Penalty shot[\s\S]*?export function castPen/);
  const altStart = s.search(/export function castPen\(/);
  const start = castStart >= 0 ? castStart : altStart;
  if (start < 0) throw new Error("castPen not found");
  s = s.slice(0, start).trimEnd() + "\n\n";

  s += `const DIVE_HIT_TILES = 1.5;

type DiveTarget =
  | { kind: "goal"; goalId: string }
  | { kind: "unit"; unitId: number };

/** Nearest enemy tower or troop under the cast point. */
export function findDiveTarget(
  state: GameState,
  caster: Side,
  x: number,
  y: number,
): DiveTarget | null {
  const foe = enemyOf(caster);
  const hitR = DIVE_HIT_TILES * state.config.tileSize;

  let bestGoal: { id: string; d: number } | null = null;
  for (const goal of enemyGoals(state, foe)) {
    if (goal.hp <= 0) continue;
    const d = pointInGoal(x, y, goal)
      ? 0
      : (() => {
          const p = closestPointOnGoal(goal, x, y);
          return dist(x, y, p.x, p.y);
        })();
    if (d <= hitR && (!bestGoal || d < bestGoal.d)) {
      bestGoal = { id: goal.id, d };
    }
  }

  let bestUnit: { id: number; d: number } | null = null;
  for (const unit of state.units) {
    if (unit.side !== foe || unit.hp <= 0 || unit.deathT > 0) continue;
    const p = closestPointOnUnit(unit, x, y, state.config.tileSize);
    const d = dist(x, y, p.x, p.y);
    if (d <= hitR && (!bestUnit || d < bestUnit.d)) {
      bestUnit = { id: unit.id, d };
    }
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
 * Dive — play anywhere (Clash-style).
 * On enemy tower → −1 HP. On enemy troop → yellow card (−20% attack speed).
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
    applyGoalDamage(state, target.goalId, delta);
    const goal = state.goals.find((g) => g.id === target.goalId);
    if (!goal) return;
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
    return;
  }

  const unit = state.units.find((u) => u.id === target.unitId);
  if (!unit || unit.hp <= 0) return;
  const asMult = spell.yellowAttackSpeedMult ?? 0.8;
  unit.yellowCard = true;
  if (unit.cooldownLeft > 0) {
    unit.cooldownLeft /= asMult;
  }
  const f = unitFootprint(unit, state.config.tileSize);
  state.damageFloats.push({
    x: unit.x,
    y: unit.y - f.h / 2 - 8,
    amount: 0,
    t: state.config.damageFloatDuration,
    duration: state.config.damageFloatDuration,
  });
}
`;
  write("src/systems/spells.ts", s);
}

// 6) intents
{
  let s = read("src/systems/intents.ts");
  s = s.replace(
    'import { castHighLine, castPen } from "./spells";',
    'import { castHighLine, castDive } from "./spells";',
  );
  s = s.replace(
    `      } else if (def.spell === "pen") {
        castPen(state, intent.side, intent.x, intent.y);
      }`,
    `      } else if (def.spell === "dive") {
        castDive(state, intent.side, intent.x, intent.y);
      }`,
  );
  write("src/systems/intents.ts", s);
}

// 7) hud
{
  let s = read("src/ui/hud.ts");
  s = s.replace(/def\.spell === "pen"/g, 'def.spell === "dive"');
  s = s.replace(/SPELL · King −1/g, "SPELL · Tower −1 / YC");
  s = s.replace(/SPELL · King -1/g, "SPELL · Tower −1 / YC");
  write("src/ui/hud.ts", s);
}

// 8) ai — treat dive like a useful always-on spell (no special filter needed)
{
  let s = read("src/systems/ai.ts");
  s = s.replace(/"pen"/g, '"dive"');
  write("src/systems/ai.ts", s);
}

// 9) render — yellow card badge + dive preview highlight
{
  let s = read("src/ui/render.ts");
  // yellow card after freeze ring / near HP bar
  if (!s.includes("yellowCard")) {
    const marker = "  // Freeze ring";
    if (s.includes(marker)) {
      s = s.replace(
        marker,
        `  // Yellow card (Dive)
  if (unit.yellowCard) {
    const f = /* footprint approx */ getUnitDef(unit.defId).radius * state.config.tileSize;
    ctx.fillStyle = "#fdd835";
    ctx.strokeStyle = "#f9a825";
    ctx.lineWidth = 1.5;
    const qw = 10;
    const qh = 14;
    const qx = unit.x + f * 0.55;
    const qy = unit.y - f - 6;
    ctx.fillRect(qx, qy, qw, qh);
    ctx.strokeRect(qx, qy, qw, qh);
  }

  // Freeze ring`,
      );
    }
  }

  // Dive preview: highlight target under cursor
  if (!s.includes("findDiveTarget")) {
    s = s.replace(
      /import \{[^}]*\} from "\.\.\/systems\/spells";/,
      (m) => {
        if (m.includes("findDiveTarget")) return m;
        return m.replace(
          /\{([^}]+)\}/,
          (_, inner) => `{ ${inner.trim().replace(/,$/, "")}, findDiveTarget }`,
        );
      },
    );
    // If no spells import yet:
    if (!s.includes('from "../systems/spells"') && !s.includes("from '../systems/spells'")) {
      s = `import { behindSign, enemyOf, findDiveTarget } from "../systems/spells";\n` + s;
    } else if (!s.includes("findDiveTarget")) {
      // try add to existing behindSign import
      if (s.includes('from "../systems/spells"')) {
        s = s.replace(
          /import \{([^}]+)\} from "\.\.\/systems\/spells";/,
          (m, inner) => {
            if (inner.includes("findDiveTarget")) return m;
            return `import { ${inner.trim().replace(/,$/, "")}, findDiveTarget } from "../systems/spells";`;
          },
        );
      }
    }

    s = s.replace(
      `  if (isSpellDef(def) && def.spell === "highline") {
    drawHighLinePreview(ctx, state, def.pushTiles ?? 5);
    return;
  }
  if (isSpellDef(def)) return;`,
      `  if (isSpellDef(def) && def.spell === "highline") {
    drawHighLinePreview(ctx, state, def.pushTiles ?? 5);
    return;
  }
  if (isSpellDef(def) && def.spell === "dive") {
    drawDivePreview(ctx, state);
    return;
  }
  if (isSpellDef(def)) return;`,
    );

    if (!s.includes("function drawDivePreview")) {
      s += `
function drawDivePreview(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.hover) return;
  const { x, y } = state.hover;
  const target = findDiveTarget(state, "player", x, y);
  const valid = isOnPitch(state, x, y);
  ctx.save();
  ctx.globalAlpha = valid ? 0.85 : 0.35;
  ctx.beginPath();
  ctx.arc(x, y, state.config.tileSize * 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = target ? "#ffeb3b" : "#90a4ae";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (target?.kind === "goal") {
    const goal = state.goals.find((g) => g.id === target.goalId);
    if (goal) {
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 3;
      ctx.strokeRect(goal.x - 2, goal.y - 2, goal.w + 4, goal.h + 4);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("−1", goal.x + goal.w / 2, goal.y + goal.h / 2);
    }
  } else if (target?.kind === "unit") {
    const unit = state.units.find((u) => u.id === target.unitId);
    if (unit) {
      const r = getUnitDef(unit.defId).radius * state.config.tileSize;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#fdd835";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fdd835";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("YC", unit.x, unit.y - r - 14);
    }
  }

  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    target?.kind === "goal"
      ? "Dive · Tower −1"
      : target?.kind === "unit"
        ? "Dive · Yellow card"
        : "Dive · aim tower or troop",
    x,
    y - state.config.tileSize * 1.5 - 10,
  );
  ctx.restore();
}
`;
    }
  }
  write("src/ui/render.ts", s);
}

console.log("dive patch core done");
