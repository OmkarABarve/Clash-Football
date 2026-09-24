import type { GameState, Side, TargetRef, Unit } from "../config/types";
import { getUnitDef } from "../config/units";
import { closestPointOnGoal, distToGoal, distUnits } from "./geometry";
import { findGoal, nearestEnemyGoal } from "./goals";

function enemySide(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

function livingEnemies(state: GameState, side: Side): Unit[] {
  const foe = enemySide(side);
  return state.units.filter((u) => u.side === foe && u.hp > 0);
}

function nearestUnit(from: Unit, candidates: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const u of candidates) {
    const d = distUnits(from, u);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

function goalTarget(state: GameState, unit: Unit): TargetRef | null {
  const goal = nearestEnemyGoal(state, unit);
  return goal ? { kind: "goal", goalId: goal.id } : null;
}

/** How far this unit can attack (melee reach or ranged/hybrid long shot). */
function attackRange(state: GameState, unit: Unit): number {
  const def = getUnitDef(unit.defId);
  if (def.attackMode === "melee") {
    return (def.meleeRange ?? 1) * state.config.tileSize * state.config.rangeScale;
  }
  return unit.range;
}

export function updateTargeting(state: GameState): void {
  const baseDetect = state.config.unitDetectRange;
  for (const unit of state.units) {
    if (unit.hp <= 0 || unit.deathT > 0) continue;
    if (unit.spawnT > 0) continue;
    const def = getUnitDef(unit.defId);
    const enemies = livingEnemies(state, unit.side);

    // Aggro at least as far as this unit can shoot, so a long-range Zlatan
    // locks Neymar at ~his range and stops to fire instead of walking in.
    const reach = attackRange(state, unit);
    const aggro = Math.max(baseDetect, reach);
    const near = nearestUnit(
      unit,
      enemies.filter((e) => distUnits(unit, e) <= aggro),
    );

    if (!near) {
      unit.target = goalTarget(state, unit);
      unit.activeRange = reach;
      unit.hybridMeleeLock = false;
      continue;
    }

    unit.target = { kind: "unit", id: near.id };

    if (def.attackMode === "hybrid") {
      const meleeRange = (def.meleeRange ?? 1) * state.config.tileSize * state.config.rangeScale;
      const d = distUnits(unit, near);
      const stuck =
        d <= meleeRange ||
        (unit.hybridMeleeLock && d <= state.config.hybridMeleeExit);
      // Outside melee: hold at long range and shoot. Inside melee: fight close.
      unit.activeRange = stuck ? meleeRange : unit.range;
      unit.hybridMeleeLock = stuck;
      continue;
    }

    unit.activeRange = reach;
    unit.hybridMeleeLock = false;
  }
}

export function targetPosition(
  state: GameState,
  unit: Unit,
  target: TargetRef,
): { x: number; y: number } | null {
  if (target.kind === "unit") {
    const u = state.units.find((x) => x.id === target.id && x.hp > 0);
    return u ? { x: u.x, y: u.y } : null;
  }
  const goal = findGoal(state, target.goalId);
  if (!goal || goal.hp <= 0) return null;
  return closestPointOnGoal(goal, unit.x, unit.y);
}

export function distanceToTarget(
  state: GameState,
  unit: Unit,
  target: TargetRef,
): number {
  if (target.kind === "unit") {
    const u = state.units.find((x) => x.id === target.id && x.hp > 0);
    return u ? distUnits(unit, u) : Infinity;
  }
  const goal = findGoal(state, target.goalId);
  if (!goal || goal.hp <= 0) return Infinity;
  return distToGoal(unit, goal);
}
