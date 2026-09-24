import type { GameState, Projectile } from "../config/types";
import { applyGoalDamage, applyUnitDamage } from "./damage";
import { closestPointOnUnit, goalCenter, pointInGoal, unitFootprint } from "./geometry";
import { findGoal } from "./goals";

export function updateProjectiles(state: GameState, dt: number): void {
  const remaining: Projectile[] = [];

  for (const shot of state.projectiles) {
    const aim = resolveAim(state, shot);
    if (!aim) continue;

    const dx = aim.x - shot.x;
    const dy = aim.y - shot.y;
    const len = Math.hypot(dx, dy) || 1;
    const step = shot.speed * dt;

    if (shot.target.kind === "goal") {
      const goal = findGoal(state, shot.target.goalId);
      if (!goal || goal.hp <= 0) continue;
      if (pointInGoal(shot.x, shot.y, goal) || step >= len) {
        applyGoalDamage(state, shot.target.goalId, shot.goalHpDelta);
        continue;
      }
    } else {
      const targetId = shot.target.id;
      const victim = state.units.find((u) => u.id === targetId && u.hp > 0);
      if (!victim) continue;
      const tile = state.config.tileSize;
      const aimPt = closestPointOnUnit(victim, shot.x, shot.y, tile);
      const hitDx = aimPt.x - shot.x;
      const hitDy = aimPt.y - shot.y;
      const hitLen = Math.hypot(hitDx, hitDy) || 1;
      const footprint = unitFootprint(victim, tile);
      const hitR = Math.min(footprint.w, footprint.h) / 2;
      if (hitLen <= hitR || step >= hitLen - hitR) {
        applyUnitDamage(state, victim, shot.damage);
        if (shot.freezeDuration > 0 && victim.hp > 0) {
          victim.freezeT = Math.max(victim.freezeT, shot.freezeDuration);
        }
        continue;
      }
    }

    shot.x += (dx / len) * step;
    shot.y += (dy / len) * step;
    remaining.push(shot);
  }

  state.projectiles = remaining;
}

function resolveAim(
  state: GameState,
  shot: Projectile,
): { x: number; y: number } | null {
  if (shot.target.kind === "goal") {
    const goal = findGoal(state, shot.target.goalId);
    if (!goal || goal.hp <= 0) return null;
    return goalCenter(goal);
  }
  const targetId = shot.target.id;
  const u = state.units.find((x) => x.id === targetId && x.hp > 0);
  if (!u) return null;
  return closestPointOnUnit(u, shot.x, shot.y, state.config.tileSize);
}
