import type { GameState, Side, TargetRef, Unit } from "../config/types";
import { getUnitDef, unitCategory } from "../config/units";
import { closestPointOnGoal, closestPointOnUnit, distToGoal, distUnits } from "./geometry";
import { findGoal, nearestEnemyGoal, kingGoal } from "./goals";

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

    // Buildings (Wall etc.) never acquire targets.
    if (unitCategory(def) === "building" || def.damage <= 0) {
      unit.target = null;
      unit.activeRange = 0;
      continue;
    }

    const enemies = livingEnemies(state, unit.side);
    const reach = attackRange(state, unit);
    const aggro = Math.max(baseDetect, reach);
    const foe = enemySide(unit.side);

    if (def.targetFilter === "goalsOnly") {
      unit.target = goalTarget(state, unit);
      unit.activeRange = reach;
      unit.hybridMeleeLock = false;
      continue;
    }

    if (def.targetFilter === "buildingsOrKing") {
      // Prefer enemy buildings (e.g. Wall) anywhere on the pitch — Clash-style
      // building targeters don't use short troop aggro for buildings.
      const buildings = enemies.filter(
        (e) => unitCategory(getUnitDef(e.defId)) === "building",
      );
      const nearBuilding = nearestUnit(unit, buildings);
      if (nearBuilding) {
        unit.target = { kind: "unit", id: nearBuilding.id };
        unit.activeRange = reach;
        unit.hybridMeleeLock = false;
        continue;
      }
      const king = kingGoal(state, foe);
      unit.target =
        king && king.hp > 0 ? { kind: "goal", goalId: king.id } : null;
      unit.activeRange = reach;
      unit.hybridMeleeLock = false;
      continue;
    }

    // Default unitThenGoal: nearest troop in aggro, else nearest goal.
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
      const meleeRange =
        (def.meleeRange ?? 1) * state.config.tileSize * state.config.rangeScale;
      const d = distUnits(unit, near);
      const stuck =
        d <= meleeRange ||
        (unit.hybridMeleeLock && d <= state.config.hybridMeleeExit);
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
    if (!u) return null;
    // Walk / aim at the nearest point on wide footprints (Wall).
    return closestPointOnUnit(u, unit.x, unit.y, state.config.tileSize);
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
