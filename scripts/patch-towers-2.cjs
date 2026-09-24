const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
  console.log("wrote", rel);
}

write(
  "src/config/types.ts",
  `export type Side = "player" | "ai";
export type MatchStatus = "playing" | "playerWin" | "aiWin";
export type AttackMode = "ranged" | "melee" | "hybrid";
export type TargetFilter = "goalsOnly" | "unitThenGoal";
export type GoalRole = "princess" | "king";
export type GoalLane = "left" | "right" | "center";

export interface ChargeAbility {
  kind: "charge";
  moveTime: number;
  moveDistance: number;
  speedMultiplier: number;
  goalHpDelta: number;
}

export interface AuraAbility {
  kind: "aura";
  radius: number;
  damageReduction: number;
}

export type Ability = ChargeAbility | AuraAbility;

/** Optional per-spawn overrides used by multi-troop cards like Robbery. */
export interface SpawnVariant {
  label: string;
  name: string;
  speed: number;
  range: number;
  /** Horizontal offset from deploy point (world px). */
  offsetX: number;
}

export interface UnitDef {
  id: string;
  name: string;
  label: string;
  cost: number;
  hp: number;
  speed: number;
  /** Ranged / long-range attack distance. Unused for pure melee. */
  range: number;
  meleeRange?: number;
  /** Damage dealt to enemy units per hit. */
  damage: number;
  /** Seconds between attacks (Clash-style Hit Speed). */
  attackCooldown: number;
  attackMode: AttackMode;
  targetFilter: TargetFilter;
  radius: number;
  ability?: Ability;
  enabled?: boolean;
  /** How many troops this card spawns. Default 1. */
  spawnCount?: number;
  /** Per-troop overrides when spawnCount > 1 (e.g. Ribery / Robben). */
  spawnVariants?: SpawnVariant[];
}

export interface ChargeState {
  movingTime: number;
  movingDistance: number;
  ready: boolean;
}

export type TargetRef =
  | { kind: "unit"; id: number }
  | { kind: "goal"; goalId: string };

export interface Unit {
  id: number;
  defId: string;
  side: Side;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldownLeft: number;
  target: TargetRef | null;
  activeRange: number;
  charge: ChargeState | null;
  movedThisTick: boolean;
  /** Hybrid hysteresis: stay in melee until target exceeds exit range. */
  hybridMeleeLock: boolean;
  /** Runtime overrides for multi-spawn cards. */
  label: string;
  name: string;
  speed: number;
  range: number;
}

export interface Projectile {
  id: number;
  side: Side;
  x: number;
  y: number;
  target: TargetRef;
  damage: number;
  goalHpDelta: number;
  speed: number;
  empowered: boolean;
}

export interface Goal {
  id: string;
  side: Side;
  role: GoalRole;
  lane: GoalLane;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  /** King starts inactive; activates when hit or a princess falls. */
  activated: boolean;
}

export interface Economy {
  current: number;
  max: number;
  regenPerSecond: number;
}

export interface DeckState {
  hand: string[];
  queue: string[];
}

export interface MatchConfig {
  princessMaxHp: number;
  kingMaxHp: number;
  startingM: number;
  maxM: number;
  regenInterval: number;
  handSize: number;
  arena: { width: number; height: number };
  midlineY: number;
  princessWidth: number;
  princessHeight: number;
  kingWidth: number;
  kingHeight: number;
  princessInsetX: number;
  princessInsetY: number;
  kingInset: number;
  projectileSpeed: number;
  aiInterval: [number, number];
  step: number;
  unitRadiusDefault: number;
  hybridMeleeExit: number;
  goalHitDelta: number;
}

export interface DeployIntent {
  side: Side;
  defId: string;
  x: number;
  y: number;
}

export interface GameState {
  status: MatchStatus;
  time: number;
  nextId: number;
  config: MatchConfig;
  goals: Goal[];
  units: Unit[];
  projectiles: Projectile[];
  economy: Record<Side, Economy>;
  deck: DeckState;
  aiTimer: number;
  selectedId: string | null;
  intents: DeployIntent[];
}

/** Derived display stats for the hand UI (Clash-style Damage / Hit Speed / DPS). */
export function unitDps(def: UnitDef): number {
  if (def.attackCooldown <= 0) return 0;
  return Math.round((def.damage / def.attackCooldown) * 10) / 10;
}

export function unitHitSpeed(def: UnitDef): number {
  return def.attackCooldown;
}
`,
);

write(
  "src/config/match.ts",
  `import type { MatchConfig } from "./types";

export const MATCH_CONFIG: MatchConfig = {
  princessMaxHp: 5,
  kingMaxHp: 5,
  startingM: 5,
  maxM: 10,
  regenInterval: 2.8,
  handSize: 4,
  arena: { width: 420, height: 760 },
  midlineY: 380,
  princessWidth: 72,
  princessHeight: 32,
  kingWidth: 100,
  kingHeight: 44,
  princessInsetX: 28,
  princessInsetY: 64,
  kingInset: 10,
  projectileSpeed: 420,
  aiInterval: [3, 6],
  step: 1 / 60,
  unitRadiusDefault: 18,
  hybridMeleeExit: 55,
  goalHitDelta: 1,
};
`,
);

write(
  "src/systems/goals.ts",
  `import type { GameState, Goal, Side, Unit } from "../config/types";
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
`,
);

console.log("ok");
