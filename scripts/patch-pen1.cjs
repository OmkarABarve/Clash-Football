/**
 * Neymar buff + HighLine midline cap + Pen spell (2M, king tower -1).
 */
const fs = require("fs");
const path = require("path");

function read(rel) {
  const p = path.join(__dirname, "..", rel);
  let b = fs.readFileSync(p);
  if (b[1] === 0) b = Buffer.from(b.toString("utf16le").replace(/^\uFEFF/, ""), "utf8");
  return { p, s: b.toString("utf8") };
}

function write(rel, s) {
  fs.writeFileSync(path.join(__dirname, "..", rel), s, "utf8");
  console.log("wrote", rel);
}

// --- Neymar: faster, slightly smaller ---
{
  let { s } = read("src/config/units.ts");
  s = s.replace(
    /(neymar: \{[\s\S]*?speed: )[\d.]+/,
    "$13.1",
  );
  s = s.replace(
    /(neymar: \{[\s\S]*?radius: )[\d.]+/,
    "$10.48",
  );
  write("src/config/units.ts", s);
}

// --- Types: SpellId + optional pushTiles / towerHpDelta ---
{
  let { s } = read("src/config/types.ts");
  s = s.replace(
    'export type SpellId = "highline";',
    'export type SpellId = "highline" | "pen";',
  );
  const oldSpell = `export interface SpellDef {
  id: string;
  name: string;
  label: string;
  cost: number;
  kind: "spell";
  spell: SpellId;
  /** Tiles to shove every enemy troop toward their own backline. */
  pushTiles: number;
  enabled?: boolean;
}`;
  const neuSpell = `export interface SpellDef {
  id: string;
  name: string;
  label: string;
  cost: number;
  kind: "spell";
  spell: SpellId;
  /** HighLine: tiles to shove every enemy troop toward their own backline. */
  pushTiles?: number;
  /** Pen: guaranteed HP removed from the enemy King tower. */
  towerHpDelta?: number;
  enabled?: boolean;
}`;
  if (!s.includes(oldSpell)) throw new Error("SpellDef block not found");
  s = s.replace(oldSpell, neuSpell);
  write("src/config/types.ts", s);
}

// --- Cards: add Pen ---
{
  let { s } = read("src/config/cards.ts");
  if (!s.includes("pen:")) {
    s = s.replace(
      `  highline: {
    id: "highline",
    name: "HighLine",
    label: "HL",
    cost: 6,
    kind: "spell",
    spell: "highline",
    pushTiles: 5,
  },
};`,
      `  highline: {
    id: "highline",
    name: "HighLine",
    label: "HL",
    cost: 6,
    kind: "spell",
    spell: "highline",
    pushTiles: 5,
  },
  pen: {
    id: "pen",
    name: "Pen",
    label: "P",
    cost: 2,
    kind: "spell",
    spell: "pen",
    towerHpDelta: 1,
  },
};`,
    );
    write("src/config/cards.ts", s);
  } else {
    console.log("pen already in cards");
  }
}

// --- HighLine: clamp push destination to midline ---
{
  let { s } = read("src/systems/spells.ts");

  // Add helpers after enemyOf
  if (!s.includes("clampPushToMidline")) {
    s = s.replace(
      `export function enemyOf(side: Side): number {
  return side === "player" ? "ai" : "player";
}`,
      `export function enemyOf(side: Side): Side {
  return side === "player" ? "ai" : "player";
}`,
    );
    // enemyOf already returns Side - don't break it. Insert after enemyOf block:
    const afterEnemy = `export function enemyOf(side: Side): Side {
  return side === "player" ? "ai" : "player";
}
`;
    if (!s.includes(afterEnemy)) throw new Error("enemyOf not found");
    s = s.replace(
      afterEnemy,
      afterEnemy +
        `
/**
 * HighLine only clears to the half line — never shoves enemies past midline
 * into their own half.
 */
export function clampPushToMidline(
  state: GameState,
  foe: Side,
  fromY: number,
  proposedY: number,
): number {
  const mid = state.config.midlineY;
  if (foe === "ai") {
    // AI is pushed upward (smaller y); stop at midline.
    return Math.max(proposedY, mid);
  }
  // Player is pushed downward (larger y); stop at midline.
  return Math.min(proposedY, mid);
}
`,
    );
  }

  // Fix empty FX + push targets
  const oldMap = `  const pushes = enemies.map((unit) => {
    const radius = 18;
    const target = safeLandPos(state, unit.x, unit.y + sign * dist, radius);
    return {
      unitId: unit.id,
      fromX: unit.x,
      fromY: unit.y,
      toX: target.x,
      toY: target.y,
    };
  });`;

  const neuMap = `  const pushes = enemies.map((unit) => {
    const radius = 18;
    const rawY = clampPushToMidline(
      state,
      foe,
      unit.y,
      unit.y + sign * dist,
    );
    const target = safeLandPos(state, unit.x, rawY, radius);
    return {
      unitId: unit.id,
      fromX: unit.x,
      fromY: unit.y,
      toX: target.x,
      toY: target.y,
    };
  });`;

  if (!s.includes("clampPushToMidline(state,")) {
    if (!s.includes(oldMap)) throw new Error("pushes map not found");
    s = s.replace(oldMap, neuMap);
  }

  // Empty pitch line should only sweep to midline
  const oldEmpty = `    const mid = state.config.midlineY;
    state.highLineFx = {
      caster,
      t: 0,
      duration: state.config.highLineDuration,
      lineFromY: mid,
      lineToY: mid + sign * dist,
      lineY: mid,
      pushes: [],
    };`;
  const neuEmpty = `    const mid = state.config.midlineY;
    state.highLineFx = {
      caster,
      t: 0,
      duration: state.config.highLineDuration,
      lineFromY: mid,
      lineToY: mid, // half-line clear — no deep shove past midline
      lineY: mid,
      pushes: [],
    };`;
  if (s.includes(oldEmpty)) s = s.replace(oldEmpty, neuEmpty);

  // Line sweep also capped
  const oldLine = `  const lineFromY =
    foe === "ai" ? Math.max(...fromYs) : Math.min(...fromYs);
  const lineToY = lineFromY + sign * dist;`;
  const neuLine = `  const lineFromY =
    foe === "ai" ? Math.max(...fromYs) : Math.min(...fromYs);
  const lineToY = clampPushToMidline(
    state,
    foe,
    lineFromY,
    lineFromY + sign * dist,
  );`;
  if (s.includes(oldLine)) s = s.replace(oldLine, neuLine);

  // Add castPen at end if missing
  if (!s.includes("export function castPen")) {
    s += `
import { applyGoalDamage } from "./damage";
import { createProjectile } from "../entities/factory";
import { kingGoal } from "./goals";
import { goalCenter } from "./geometry";

/**
 * Penalty shot: guaranteed -1 HP on the enemy King tower, with a ball FX.
 */
export function castPen(
  state: GameState,
  caster: Side,
  fromX: number,
  fromY: number,
): void {
  const spell = getSpellDef("pen");
  const delta = spell.towerHpDelta ?? 1;
  const foe = enemyOf(caster);
  const king = kingGoal(state, foe);
  if (!king || king.hp <= 0) return;

  // Guaranteed damage — not missable.
  applyGoalDamage(state, king.id, delta);

  // Visual: ball flies from cast point to the king.
  const c = goalCenter(king);
  const shot = createProjectile(state, {
    side: caster,
    x: fromX,
    y: fromY,
    target: { kind: "goal", goalId: king.id },
    damage: 0,
    goalHpDelta: 0, // already applied — FX only
    empowered: true,
  });
  // Aim travel toward king; projectile will "hit" with 0 extra damage.
  shot.x = fromX;
  shot.y = fromY;
  // Nudge so it doesn't instantly register as inside the goal rect.
  const dx = c.x - fromX;
  const dy = c.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  shot.x = fromX;
  shot.y = fromY;
  shot.speed = state.config.projectileSpeed * 1.6;
  state.projectiles.push(shot);
  void len;
}
`;
  }

  write("src/systems/spells.ts", s);
}

console.log("patch-pen phase1 done");
