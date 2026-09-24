import { createProjectile } from "../entities/factory";
import type { GameState, Goal, Side, Unit } from "../config/types";
import { goalCenter } from "./geometry";

function enemySide(side: Side): Side {
  return side === "player" ? "ai" : "player";
}

/** Range reaches from the tower center to the half-line (midline). */
export function towerRange(state: GameState, goal: Goal): number {
  const c = goalCenter(goal);
  return Math.abs(c.y - state.config.midlineY);
}

function towerDamage(state: GameState, goal: Goal): number {
  return goal.role === "king"
    ? state.config.kingTowerDamage
    : state.config.princessTowerDamage;
}

function towerCooldown(state: GameState, goal: Goal): number {
  return goal.role === "king"
    ? state.config.kingTowerCooldown
    : state.config.princessTowerCooldown;
}

function livingEnemies(state: GameState, side: Side): Unit[] {
  const foe = enemySide(side);
  return state.units.filter(
    (u) => u.side === foe && u.hp > 0 && u.deathT <= 0,
  );
}

function nearestInRange(
  state: GameState,
  goal: Goal,
  enemies: Unit[],
): Unit | null {
  const c = goalCenter(goal);
  const range = towerRange(state, goal);
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const u of enemies) {
    const d = Math.hypot(u.x - c.x, u.y - c.y);
    if (d > range) continue;
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

/**
 * Active towers shoot the nearest enemy troop in range (to the midline).
 * King only fires once activated.
 */
export function updateTowers(state: GameState, dt: number): void {
  for (const goal of state.goals) {
    if (goal.hp <= 0) continue;
    if (goal.role === "king" && !goal.activated) continue;

    if (goal.cooldownLeft > 0) {
      goal.cooldownLeft = Math.max(0, goal.cooldownLeft - dt);
    }
    if (goal.cooldownLeft > 0) continue;

    const target = nearestInRange(state, goal, livingEnemies(state, goal.side));
    if (!target) continue;

    const c = goalCenter(goal);
    state.projectiles.push(
      createProjectile(state, {
        side: goal.side,
        x: c.x,
        y: c.y,
        target: { kind: "unit", id: target.id },
        damage: towerDamage(state, goal),
        goalHpDelta: 0,
        empowered: false,
      }),
    );
    goal.cooldownLeft = towerCooldown(state, goal);
  }
}
