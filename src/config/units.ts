import type { UnitDef } from "./types";

/**
 * Unit balance. Distance stats are in **tiles** (see `tiles.ts`):
 *   range / meleeRange / radius / speed / ability radii & moveDistance / offsetX
 * Gameplay converts to world px via tileSize at spawn time.
 *
 * damage = Damage per hit (Clash-style)
 * attackCooldown = Hit Speed in seconds
 * DPS = damage / attackCooldown in the HUD
 */
export const UNIT_DEFS: Record<string, UnitDef> = {
  messi: {
    id: "messi",
    name: "Messi",
    label: "M",
    cost: 4,
    hp: 900,
    speed: 2.0, // tiles/s
    range: 1.5,
    damage: 120,
    attackCooldown: 1.85,
    attackMode: "ranged",
    targetFilter: "goalsOnly",
    radius: 0.45,
    ability: {
      kind: "charge",
      moveTime: 3,
      moveDistance: 6,
      speedMultiplier: 1.8,
      goalHpDelta: 2,
    },
  },
  ronaldo: {
    id: "ronaldo",
    name: "Ronaldo",
    label: "CR",
    cost: 4,
    hp: 700,
    speed: 3.2,
    range: 5.5,
    damage: 110,
    attackCooldown: 1.55,
    attackMode: "ranged",
    targetFilter: "goalsOnly",
    radius: 0.55,
  },
  neymar: {
    id: "neymar",
    name: "Neymar",
    label: "N",
    cost: 3,
    hp: 400,
    speed: 3.1,
    range: 0,
    meleeRange: 1,
    damage: 70,
    attackCooldown: 1.4,
    attackMode: "melee",
    targetFilter: "buildingsOrKing",
    radius: 0.48,
    ability: {
      kind: "aura",
      radius: 3.5,
      damageReduction: 0.25,
    },
  },
  zlatan: {
    id: "zlatan",
    name: "Zlatan",
    label: "Z",
    cost: 3,
    hp: 800,
    speed: 1.4,
    range: 7,
    meleeRange: 1,
    damage: 60,
    attackCooldown: 2.45,
    attackMode: "hybrid",
    targetFilter: "unitThenGoal",
    radius: 0.55,
  },
  ramos: {
    id: "ramos",
    name: "Ramos",
    label: "Ra",
    cost: 5,
    hp: 1000,
    speed: 1.4,
    range: 0,
    meleeRange: 1,
    damage: 140,
    attackCooldown: 2.0,
    attackMode: "melee",
    targetFilter: "unitThenGoal",
    radius: 0.6,
  },
  robbery: {
    id: "robbery",
    name: "Robbery",
    label: "Ro",
    cost: 5,
    hp: 450,
    speed: 2.2,
    range: 3.5,
    damage: 85,
    attackCooldown: 1.7,
    attackMode: "ranged",
    targetFilter: "unitThenGoal",
    radius: 0.5,
    spawnCount: 2,
    spawnVariants: [
      {
        name: "Ribéry",
        label: "Ri",
        speed: 2.0,
        range: 3.25,
        offsetX: -4.5,
      },
      {
        name: "Robben",
        label: "Rb",
        speed: 2.8,
        range: 4,
        offsetX: 4.5,
      },
    ],
  },
  iniesta: {
    id: "iniesta",
    name: "Iniesta",
    label: "I",
    cost: 5,
    hp: 600,
    speed: 2.3,
    range: 0,
    meleeRange: 1,
    damage: 120,
    attackCooldown: 2.0,
    attackMode: "melee",
    targetFilter: "unitThenGoal",
    radius: 0.55,
    ability: {
      kind: "freeze",
      duration: 0.3,
    },
  },
  wall: {
    id: "wall",
    name: "Wall",
    label: "W",
    cost: 5,
    category: "building",
    hp: 400, // half Zlatan
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
};

export function getUnitDef(id: string): UnitDef {
  const def = UNIT_DEFS[id];
  if (!def) throw new Error(`Unknown unit def: ${id}`);
  return def;
}

export function enabledUnitIds(): string[] {
  return Object.keys(UNIT_DEFS).filter((id) => UNIT_DEFS[id].enabled !== false);
}


/** Clash-style card family for a unit def (default troop). */
export function unitCategory(def: import("./types").UnitDef): "troop" | "building" {
  return def.category ?? "troop";
}
