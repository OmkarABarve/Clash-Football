import type { GameState, Side, Unit } from "../config/types";
import { getSpellDef } from "../config/cards";
import { isWater, riverLayout } from "./lanes";

/** Direction toward a side's own backline (behind their attack). */
export function behindSign(side: Side): number {
  return side === "player" ? 1 : -1;
}

export function enemyOf(side: Side): Side {
  return side === "player" ? "ai" : "player";
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
  const dist = spell.pushTiles * state.config.tileSize;
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
      lineToY: mid + sign * dist,
      lineY: mid,
      pushes: [],
    };
    return;
  }

  const pushes = enemies.map((unit) => {
    const radius = 18;
    const target = safeLandPos(state, unit.x, unit.y + sign * dist, radius);
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
  const lineToY = lineFromY + sign * dist;

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
