import type { Goal, Unit } from "../config/types";
import { getUnitDef } from "../config/units";
import { TILE_SIZE } from "../config/tiles";

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

/** Axis-aligned footprint for a unit (walls are wide bars). */
export function unitFootprint(
  unit: Unit,
  tileSize: number,
): { x: number; y: number; w: number; h: number } {
  const def = getUnitDef(unit.defId);
  if (def.ability?.kind === "wall") {
    const w = def.ability.widthTiles * tileSize;
    const h = Math.max(def.radius * tileSize * 2, tileSize * 0.7);
    return { x: unit.x - w / 2, y: unit.y - h / 2, w, h };
  }
  const d = def.radius * tileSize * 2;
  return { x: unit.x - d / 2, y: unit.y - d / 2, w: d, h: d };
}

export function closestPointOnUnit(
  unit: Unit,
  x: number,
  y: number,
  tileSize: number,
): { x: number; y: number } {
  const f = unitFootprint(unit, tileSize);
  return {
    x: Math.max(f.x, Math.min(f.x + f.w, x)),
    y: Math.max(f.y, Math.min(f.y + f.h, y)),
  };
}

export function distUnits(a: Unit, b: Unit, tileSize: number = TILE_SIZE): number {
  // If either is a wide wall, measure edge-to-edge via footprints.
  const aDef = getUnitDef(a.defId);
  const bDef = getUnitDef(b.defId);
  if (aDef.ability?.kind === "wall" || bDef.ability?.kind === "wall") {
    const pa = closestPointOnUnit(a, b.x, b.y, tileSize);
    const pb = closestPointOnUnit(b, a.x, a.y, tileSize);
    // Use midpoints of closest edges for a stable distance
    if (aDef.ability?.kind === "wall" && bDef.ability?.kind !== "wall") {
      return dist(pa.x, pa.y, b.x, b.y);
    }
    if (bDef.ability?.kind === "wall" && aDef.ability?.kind !== "wall") {
      return dist(a.x, a.y, pb.x, pb.y);
    }
    return dist(pa.x, pa.y, pb.x, pb.y);
  }
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
