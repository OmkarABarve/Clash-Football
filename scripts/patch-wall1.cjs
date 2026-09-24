const fs = require("fs");

function read(p) {
  const b = fs.readFileSync(p);
  return b[1] === 0
    ? b.toString("utf16le").replace(/^\uFEFF/, "")
    : b.toString("utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

// ========== types ==========
let types = read("src/config/types.ts");
if (!types.includes("WallAbility")) {
  types = types.replace(
    `export interface FreezeAbility {
  kind: "freeze";
  /** Stun duration in seconds applied on each hit. */
  duration: number;
}

export type Ability = ChargeAbility | AuraAbility | FreezeAbility;`,
    `export interface FreezeAbility {
  kind: "freeze";
  /** Stun duration in seconds applied on each hit. */
  duration: number;
}

/** Stationary barrier that soaks hits, then splits into troops. */
export interface WallAbility {
  kind: "wall";
  /** Barrier width in tiles. */
  widthTiles: number;
  /** Unit def spawned when the wall breaks. */
  breakInto: string;
  /** How many troops spawn on break. */
  breakCount: number;
}

export type Ability = ChargeAbility | AuraAbility | FreezeAbility | WallAbility;`,
  );
  write("src/config/types.ts", types);
  console.log("types: WallAbility");
}

// ========== units ==========
let units = read("src/config/units.ts");
if (!units.includes("wall:")) {
  // insert before closing of UNIT_DEFS — after iniesta
  units = units.replace(
    `    ability: {
      kind: "freeze",
      duration: 0.3,
    },
  },
};`,
    `    ability: {
      kind: "freeze",
      duration: 0.3,
    },
  },
  wall: {
    id: "wall",
    name: "Wall",
    label: "W",
    cost: 5,
    hp: 800, // same as Zlatan
    speed: 0,
    range: 0,
    meleeRange: 0,
    damage: 0,
    attackCooldown: 1,
    attackMode: "melee",
    targetFilter: "unitThenGoal",
    radius: 0.5,
    ability: {
      kind: "wall",
      widthTiles: 3,
      breakInto: "def",
      breakCount: 3,
    },
  },
  /** Spawned when a Wall breaks — not in the hand cycle. */
  def: {
    id: "def",
    name: "Def",
    label: "D",
    cost: 0,
    hp: 300, // half Iniesta
    speed: 2.3, // Iniesta speed
    range: 0,
    meleeRange: 1,
    damage: 50, // basic melee
    attackCooldown: 1.6,
    attackMode: "melee",
    targetFilter: "unitThenGoal",
    radius: 0.45,
    enabled: false,
  },
};`,
  );
  write("src/config/units.ts", units);
  console.log("units: wall + def");
} else console.log("units already have wall");

// ========== geometry: wide wall distance ==========
let geo = read("src/systems/geometry.ts");
if (!geo.includes("unitFootprint")) {
  geo = `import type { Goal, Unit } from "../config/types";
import { getUnitDef } from "../config/units";

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

export function distUnits(a: Unit, b: Unit, tileSize = 32): number {
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
`;
  write("src/systems/geometry.ts", geo);
  console.log("geometry rewritten");
}

console.log("phase1 done");
