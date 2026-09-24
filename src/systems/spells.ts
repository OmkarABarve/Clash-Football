import type { GameState, Side, Unit } from "../config/types";
import { getSpellDef } from "../config/cards";
import { createProjectile } from "../entities/factory";
import { applyGoalDamage } from "./damage";
import {
  closestPointOnGoal,
  closestPointOnUnit,
  dist,
  goalCenter,
  pointInGoal,
  unitFootprint,
} from "./geometry";
import { enemyGoals } from "./goals";
import { isWater, riverLayout } from "./lanes";

/** Direction toward a side's own backline (behind their attack). */
export function behindSign(side: Side): number {
  return side === "player" ? 1 : -1;
}

export function enemyOf(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

/**
 * HighLine only clears to the half line — never shoves enemies past midline
 * into their own half.
 */
export function clampPushToMidline(
  state: GameState,
  foe: Side,
  fromY: number,
  proposedY: number,
  radius = 18,
): number {
  // Stop on the foe's river bank (their half), not the geometric midline
  // through the water — otherwise safeLandPos nudges them back into your half.
  const layout = riverLayout(state.config);
  if (foe === "ai") {
    const stopY = layout.top - radius;
    if (fromY <= stopY) return fromY;
    return Math.max(proposedY, stopY);
  }
  const stopY = layout.bottom + radius;
  if (fromY >= stopY) return fromY;
  return Math.min(proposedY, stopY);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Keep a pushed unit on land inside the arena. */
export function safeLandPos(
  state: GameState,
  x: number,
  y: number,
  radius: number,
): { x: number; y: number } {
  const { arena } = state.config;
  let nx = clamp(x, radius, arena.width - radius);
  let ny = clamp(y, radius, arena.height - radius);
  if (!isWater(state.config, nx, ny)) return { x: nx, y: ny };

  const layout = riverLayout(state.config);
  // Nudge to the nearest bank instead of drowning mid-push.
  if (ny <= state.config.midlineY) {
    ny = layout.top - radius;
  } else {
    ny = layout.bottom + radius;
  }
  ny = clamp(ny, radius, arena.height - radius);
  return { x: nx, y: ny };
}

/** Prefer the river bank in the shove direction so HighLine doesn't bounce back. */
function landAfterHighLinePush(
  state: GameState,
  x: number,
  y: number,
  radius: number,
  sign: number,
): { x: number; y: number } {
  const { arena } = state.config;
  let nx = clamp(x, radius, arena.width - radius);
  let ny = clamp(y, radius, arena.height - radius);
  if (!isWater(state.config, nx, ny)) return { x: nx, y: ny };

  const layout = riverLayout(state.config);
  // sign < 0 → shove upward (AI backline) → north bank; else south bank.
  ny = sign < 0 ? layout.top - radius : layout.bottom + radius;
  ny = clamp(ny, radius, arena.height - radius);
  return { x: nx, y: ny };
}


export function isUnitBeingPushed(state: GameState, unitId: number): boolean {
  const fx = state.highLineFx;
  if (!fx) return false;
  return fx.pushes.some((p) => p.unitId === unitId);
}

/** Snap any in-flight HighLine to its end positions before starting another. */
export function finishHighLine(state: GameState): void {
  const fx = state.highLineFx;
  if (!fx) return;
  for (const push of fx.pushes) {
    const unit = state.units.find((u) => u.id === push.unitId);
    if (!unit || unit.hp <= 0) continue;
    unit.x = push.toX;
    unit.y = push.toY;
  }
  state.highLineFx = null;
}

/**
 * Shove every living enemy troop toward their own backline by pushTiles.
 * Starts the red-line push animation.
 */
export function castHighLine(state: GameState, caster: Side): void {
  const spell = getSpellDef("highline");
  const foe = enemyOf(caster);
  const sign = behindSign(foe);
  const pushTiles = spell.pushTiles ?? 5;
  const dist = pushTiles * state.config.tileSize;
  const enemies = state.units.filter(
    (u) => u.side === foe && u.hp > 0 && u.deathT <= 0,
  );

  finishHighLine(state);

  if (enemies.length === 0) {
    // Still spend/cycle the card — empty pitch, brief line flash midfield.
    const mid = state.config.midlineY;
    state.highLineFx = {
      caster,
      t: 0,
      duration: state.config.highLineDuration,
      lineFromY: mid,
      lineToY: mid, // half-line clear — no deep shove past midline
      lineY: mid,
      pushes: [],
    };
    return;
  }

  const pushes = enemies.map((unit) => {
    const radius = 18;
    const rawY = clampPushToMidline(
      state,
      foe,
      unit.y,
      unit.y + sign * dist,
      radius,
    );
    const target = landAfterHighLinePush(state, unit.x, rawY, radius, sign);
    return {
      unitId: unit.id,
      fromX: unit.x,
      fromY: unit.y,
      toX: target.x,
      toY: target.y,
    };
  });

  // Line starts at the enemies' front (toward the caster) and sweeps behind.
  const fromYs = pushes.map((p) => p.fromY);
  const lineFromY =
    foe === "ai" ? Math.max(...fromYs) : Math.min(...fromYs);
  const lineToY = clampPushToMidline(
    state,
    foe,
    lineFromY,
    lineFromY + sign * dist,
  );

  state.highLineFx = {
    caster,
    t: 0,
    duration: state.config.highLineDuration,
    lineFromY,
    lineToY,
    lineY: lineFromY,
    pushes,
  };

  // Interrupt attack aim — they'll re-acquire after the shove.
  for (const unit of enemies) {
    unit.target = null;
    unit.cooldownLeft = Math.max(unit.cooldownLeft, 0.15);
  }
}

export function updateHighLine(state: GameState, dt: number): void {
  const fx = state.highLineFx;
  if (!fx) return;

  fx.t += dt;
  const p = Math.min(1, fx.t / Math.max(0.0001, fx.duration));
  // Ease-out so the shove hits hard then settles.
  const ease = 1 - (1 - p) * (1 - p);

  fx.lineY = fx.lineFromY + (fx.lineToY - fx.lineFromY) * ease;

  for (const push of fx.pushes) {
    const unit = state.units.find((u) => u.id === push.unitId);
    if (!unit || unit.hp <= 0) continue;
    unit.x = push.fromX + (push.toX - push.fromX) * ease;
    unit.y = push.fromY + (push.toY - push.fromY) * ease;
    unit.movedThisTick = false;
  }

  if (p >= 1) {
    finishHighLine(state);
  }
}

export function livingEnemyCount(state: GameState, side: Side): number {
  const foe = enemyOf(side);
  return state.units.filter((u) => u.side === foe && u.hp > 0 && u.deathT <= 0)
    .length;
}

/** Used by movement to freeze shoved troops mid-animation. */
export function unitLockedBySpell(state: GameState, unit: Unit): boolean {
  return isUnitBeingPushed(state, unit.id);
}

const DIVE_HIT_TILES = 1.5;

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
  for (const goal of enemyGoals(state, caster)) {
    if (goal.hp <= 0) continue;
    let d = 0;
    if (!pointInGoal(x, y, goal)) {
      const p = closestPointOnGoal(goal, x, y);
      d = dist(x, y, p.x, p.y);
    }
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
    applyGoalDamage(state, target.goalId, spell.towerHpDelta ?? 1);
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
