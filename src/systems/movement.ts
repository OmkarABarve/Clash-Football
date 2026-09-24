import type { GameState, Unit } from "../config/types";
import { getUnitDef } from "../config/units";
import { crossingWaypoint, stayOnLand } from "./lanes";
import { unitLockedBySpell } from "./spells";
import { distanceToTarget, targetPosition } from "./targeting";

const MOVE_EPSILON = 0.05;

export function updateMovement(state: GameState, dt: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0 || unit.deathT > 0) continue;
    unit.movedThisTick = false;

    if (unit.shootRecoil > 0) {
      unit.shootRecoil = Math.max(0, unit.shootRecoil - dt);
    }

    // HighLine shove owns position this tick
    if (unitLockedBySpell(state, unit)) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    // Deploy puff: scale up, no walking until finished
    if (unit.spawnT > 0) {
      unit.spawnT = Math.max(0, unit.spawnT - dt);
      updateCharge(unit, dt, 0, false);
      continue;
    }

    if (!unit.target) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const d = distanceToTarget(state, unit, unit.target);
    if (d <= unit.activeRange) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const pos = targetPosition(state, unit, unit.target);
    if (!pos) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const via = crossingWaypoint(state.config, unit.x, unit.y, pos.x, pos.y);
    const speed = currentSpeed(unit);
    const step = speed * dt;
    const dx = via.x - unit.x;
    const dy = via.y - unit.y;
    const len = Math.hypot(dx, dy) || 1;
    const move = Math.min(step, len);
    const next = stayOnLand(
      state.config,
      unit.x,
      unit.y,
      unit.x + (dx / len) * move,
      unit.y + (dy / len) * move,
    );
    const moved = Math.hypot(next.x - unit.x, next.y - unit.y);
    if (moved > MOVE_EPSILON) {
      unit.facing = Math.atan2(next.y - unit.y, next.x - unit.x);
    }
    unit.x = next.x;
    unit.y = next.y;
    unit.movedThisTick = moved > MOVE_EPSILON;
    updateCharge(unit, dt, moved, unit.movedThisTick);
  }
}

function currentSpeed(unit: Unit): number {
  const def = getUnitDef(unit.defId);
  if (unit.charge?.ready && def.ability?.kind === "charge") {
    return unit.speed * def.ability.speedMultiplier;
  }
  return unit.speed;
}

function updateCharge(
  unit: Unit,
  dt: number,
  distanceMoved: number,
  moved: boolean,
): void {
  const charge = unit.charge;
  if (!charge) return;
  const def = getUnitDef(unit.defId);
  if (def.ability?.kind !== "charge") return;
  const ability = def.ability;

  if (charge.ready) {
    // Ready stickies until the next shot; still track nothing while idle
    return;
  }

  if (moved) {
    charge.movingTime += dt;
    charge.movingDistance += distanceMoved;
    if (
      charge.movingTime >= ability.moveTime ||
      charge.movingDistance >= ability.moveDistance
    ) {
      charge.ready = true;
    }
  } else {
    charge.movingTime = 0;
    charge.movingDistance = 0;
  }
}
