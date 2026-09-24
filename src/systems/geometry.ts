import type { Goal, Unit } from "../config/types";

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

export function distUnits(a: Unit, b: Unit): number {
  return dist(a.x, a.y, b.x, b.y);
}

/** Closest point on an axis-aligned goal rect to (x, y). */
export function closestPointOnGoal(
  goal: Goal,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: clamp(x, goal.x, goal.x + goal.w),
    y: clamp(y, goal.y, goal.y + goal.h),
  };
}

export function distToGoal(unit: Unit, goal: Goal): number {
  const p = closestPointOnGoal(goal, unit.x, unit.y);
  return dist(unit.x, unit.y, p.x, p.y);
}

export function goalCenter(goal: Goal): { x: number; y: number } {
  return { x: goal.x + goal.w / 2, y: goal.y + goal.h / 2 };
}

export function pointInGoal(x: number, y: number, goal: Goal): boolean {
  return x >= goal.x && x <= goal.x + goal.w && y >= goal.y && y <= goal.y + goal.h;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
