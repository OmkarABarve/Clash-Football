import type { GameState, Unit } from "../config/types";
import { getUnitDef } from "../config/units";
import { activateKing, findGoal } from "./goals";
import { distUnits } from "./geometry";

export function auraDamageMultiplier(state: GameState, victim: Unit): number {
  let reduction = 0;
  for (const ally of state.units) {
    if (ally.hp <= 0 || ally.side !== victim.side) continue;
    if (ally.deathT > 0) continue;
    const def = getUnitDef(ally.defId);
    if (def.ability?.kind !== "aura") continue;
    if (distUnits(ally, victim) <= def.ability.radius * state.config.tileSize) {
      reduction = def.ability.damageReduction;
      break; // non-stacking
    }
  }
  return 1 - reduction;
}

export function applyUnitDamage(
  state: GameState,
  victim: Unit,
  rawDamage: number,
): void {
  if (victim.hp <= 0 || victim.deathT > 0) return;

  const mult = auraDamageMultiplier(state, victim);
  const before = victim.hp;
  victim.hp = Math.max(0, victim.hp - rawDamage * mult);
  const shown = Math.max(1, Math.round(before - victim.hp));

  victim.hitFlash = state.config.hitFlashDuration;
  state.damageFloats.push({
    x: victim.x,
    y: victim.y - getUnitDef(victim.defId).radius - 8,
    amount: shown,
    t: state.config.damageFloatDuration,
    duration: state.config.damageFloatDuration,
  });

  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.deathT = state.config.deathDuration;
    victim.target = null;
  }
}

export function applyGoalDamage(
  state: GameState,
  goalId: string,
  goalHpDelta: number,
): void {
  const goal = findGoal(state, goalId);
  if (!goal || goal.hp <= 0) return;

  const before = goal.hp;
  goal.hp = Math.max(0, goal.hp - goalHpDelta);

  if (goal.hp < before) {
    state.shake = Math.max(state.shake, state.config.goalShakeAmount);
    state.goalFlashes.push({
      goalId: goal.id,
      t: state.config.goalFlashDuration,
    });
  }

  if (goal.role === "king") {
    goal.activated = true;
  }

  // Clash Royale: losing a princess wakes the king
  if (goal.role === "princess" && goal.hp <= 0) {
    activateKing(state, goal.side);
  }
}
