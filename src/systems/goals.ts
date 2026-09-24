import type { GameState, Goal, Side, Unit } from "../config/types";
import { distToGoal } from "./geometry";

export function goalsForSide(state: GameState, side: Side): Goal[] {
  return state.goals.filter((g) => g.side === side);
}

export function livingGoals(state: GameState, side: Side): Goal[] {
  return goalsForSide(state, side).filter((g) => g.hp > 0);
}

export function enemyGoals(state: GameState, side: Side): Goal[] {
  const foe: Side = side === "player" ? "ai" : "player";
  return livingGoals(state, foe);
}

export function findGoal(state: GameState, goalId: string): Goal | undefined {
  return state.goals.find((g) => g.id === goalId);
}

export function kingGoal(state: GameState, side: Side): Goal | undefined {
  return state.goals.find((g) => g.side === side && g.role === "king");
}

/** Nearest living enemy goal by distance to the goal rect. */
export function nearestEnemyGoal(state: GameState, unit: Unit): Goal | null {
  const goals = enemyGoals(state, unit.side);
  let best: Goal | null = null;
  let bestD = Infinity;
  for (const g of goals) {
    const d = distToGoal(unit, g);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

/** Front edge of the side's princess line — clamps the deploy zone. */
export function deployBoundY(state: GameState, side: Side): number {
  const princesses = goalsForSide(state, side).filter((g) => g.role === "princess");
  if (princesses.length === 0) {
    return side === "player" ? state.config.arena.height : 0;
  }
  if (side === "player") {
    return Math.min(...princesses.map((g) => g.y));
  }
  return Math.max(...princesses.map((g) => g.y + g.h));
}

export function activateKing(state: GameState, side: Side): void {
  const king = kingGoal(state, side);
  if (king && king.hp > 0) king.activated = true;
}
