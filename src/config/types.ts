export type Side = "player" | "ai";
export type MatchStatus = "playing" | "playerWin" | "aiWin";
export type AttackMode = "ranged" | "melee" | "hybrid";
/** Clash-style card families. */
export type CardCategory = "troop" | "building" | "spell";

export type TargetFilter = "goalsOnly" | "unitThenGoal" | "buildingsOrKing";
export type GoalRole = "princess" | "king";
export type GoalLane = "left" | "right" | "center";

export interface ChargeAbility {
  kind: "charge";
  moveTime: number;
  /** Charge build-up distance in tiles. */
  moveDistance: number;
  speedMultiplier: number;
  goalHpDelta: number;
}

export interface AuraAbility {
  kind: "aura";
  /** Aura radius in tiles. */
  radius: number;
  damageReduction: number;
}

export interface FreezeAbility {
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

export type Ability = ChargeAbility | AuraAbility | FreezeAbility | WallAbility;

export type SpellId = "highline" | "dive";

/** Spell cards (no troop spawn). Cast on the pitch. */
export interface SpellDef {
  id: string;
  name: string;
  label: string;
  cost: number;
  kind: "spell";
  spell: SpellId;
  /** HighLine: tiles to shove every enemy troop toward their own backline. */
  pushTiles?: number;
  /** Pen: guaranteed HP removed from the enemy King tower. */
  towerHpDelta?: number;
  /** Dive: AS multiplier on yellow (0.8 = −20%). */
  yellowAttackSpeedMult?: number;
  enabled?: boolean;
}

export interface HighLinePush {
  unitId: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Red-line shove FX for HighLine. */
export interface HighLineFx {
  caster: Side;
  t: number;
  duration: number;
  lineFromY: number;
  lineToY: number;
  lineY: number;
  pushes: HighLinePush[];
}

/** Optional per-spawn overrides used by multi-troop cards like Robbery. */
export interface SpawnVariant {
  label: string;
  name: string;
  speed: number;
  range: number;
  /** Horizontal offset from deploy point in tiles. */
  offsetX: number;
}

export interface UnitDef {
  /** Clash-style family. Default "troop". Wall etc. use "building". */
  id: string;
  name: string;
  label: string;
  cost: number;
  category?: Exclude<CardCategory, "spell">;
  hp: number;
  /** Movement speed in tiles per second. */
  speed: number;
  /** Ranged / long-range attack distance in tiles. Unused for pure melee. */
  range: number;
  /** Melee reach in tiles. */
  meleeRange?: number;
  /** Damage dealt to enemy units per hit. */
  damage: number;
  /** Seconds between attacks (Clash-style Hit Speed). */
  attackCooldown: number;
  attackMode: AttackMode;
  targetFilter: TargetFilter;
  /** Collision / draw radius in tiles. */
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
  /** Seconds left in deploy puff lock. 0 = can move/attack. */
  spawnT: number;
  /** Facing angle in radians (atan2 of walk/aim direction). */
  facing: number;
  /** Brief recoil timer after shooting — leans the sprite back. */
  shootRecoil: number;
  /** Hit-flash timer (seconds). Drawn white while > 0. */
  hitFlash: number;
  /** Death anim countdown. > 0 keeps the unit alive for the shrink/ring. */
  deathT: number;
  /** Stun / freeze timer (seconds). > 0 = cannot move or attack. */
  freezeT: number;
  /** Dive yellow card — attacks 20% slower while true. */
  yellowCard: boolean;
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
  /** Optional stun applied on hit (Iniesta). */
  freezeDuration: number;
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
  /** Seconds until this tower can fire again. */
  cooldownLeft: number;
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
  /** Impassable band centered on the midline. Troops cross only on the bridges. */
  riverHeight: number;
  bridgeWidth: number;
  /** How far each bridge sits inward from the side tower, toward midfield. */
  bridgeTowardCenter: number;
  /** Gameplay reads unit range as this fraction of the listed stat. */
  rangeScale: number;
  /** Gameplay reads unit speed as this fraction of the listed stat. */
  speedScale: number;
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
  /** Units ignore enemy players farther than this and keep walking to the goal. */
  unitDetectRange: number;
  hybridMeleeExit: number;
  goalHitDelta: number;
  /** Max cards in a side's deck (Clash-style 8). */
  deckSize: number;
  /** Deploy puff / spawn lock duration in seconds. */
  deployPuffDuration: number;
  /** Match length in seconds (3:00). */
  matchDuration: number;
  /** Last this many seconds use overtime M regen. */
  lastMinuteSeconds: number;
  /** M regen interval during the last minute / overtime (faster). */
  overtimeRegenInterval: number;
  /** Screen shake amplitude when a goal loses HP. */
  goalShakeAmount: number;
  /** Screen shake decay per second. */
  goalShakeDecay: number;
  /** Goal hit flash lifetime in seconds. */
  goalFlashDuration: number;
  /** How long the shoot lean-back lasts. */
  shootRecoilDuration: number;
  /** Hit flash duration (~3–4 frames at 60fps). */
  hitFlashDuration: number;
  /** Death shrink + ring duration in seconds. */
  deathDuration: number;
  /** Floating damage number lifetime. */
  damageFloatDuration: number;
  /** How far damage numbers rise (world px) over their lifetime. */
  damageFloatRise: number;
  /** World pixels per tile (Clash-style 18×32 grid). */
  tileSize: number;
  /** Center-circle radius in world px (from tiles). */
  centerCircleRadius: number;
  /** Penalty-area width in world px. */
  penaltyWidth: number;
  /** Penalty-area depth in world px. */
  penaltyDepth: number;
  /** HighLine red-line push duration in seconds. */
  highLineDuration: number;
  /** Princess tower damage per shot (vs troops). */
  princessTowerDamage: number;
  /** Princess tower hit speed in seconds (Clash: 0.8). */
  princessTowerCooldown: number;
  /** Princess tower shoot range in tiles (Clash: 7.5). */
  princessTowerRange: number;
  /** King tower damage per shot (vs troops), when activated. */
  kingTowerDamage: number;
  /** King tower hit speed in seconds (Clash: ~1.0). */
  kingTowerCooldown: number;
  /** King tower shoot range in tiles (Clash: ~7). */
  kingTowerRange: number;
}

export interface DeployIntent {
  side: Side;
  defId: string;
  x: number;
  y: number;
}

export interface GoalFlash {
  goalId: string;
  t: number;
}

export interface DamageFloat {
  x: number;
  y: number;
  amount: number;
  t: number;
  duration: number;
}

export interface GameState {
  status: MatchStatus;
  time: number;
  /** Seconds remaining on the match clock. */
  timeLeft: number;
  nextId: number;
  config: MatchConfig;
  goals: Goal[];
  units: Unit[];
  projectiles: Projectile[];
  economy: Record<Side, Economy>;
  deck: DeckState;
  /** AI uses the same Clash-style hand/cycle as the player. */
  aiDeck: DeckState;
  aiTimer: number;
  selectedId: string | null;
  /** Cursor position in arena coordinates while a card is selected. */
  hover: { x: number; y: number } | null;
  intents: DeployIntent[];
  /** Current screen-shake amplitude in world pixels. */
  shake: number;
  /** Brief flashes when a goal loses HP. */
  goalFlashes: GoalFlash[];
  /** Rising damage numbers from unit hits. */
  damageFloats: DamageFloat[];
  /** Active HighLine shove animation, if any. */
  highLineFx: HighLineFx | null;
}

/** Derived display stats for the hand UI (Clash-style Damage / Hit Speed / DPS). */
export function unitDps(def: UnitDef): number {
  if (def.attackCooldown <= 0) return 0;
  return Math.round((def.damage / def.attackCooldown) * 10) / 10;
}

export function unitHitSpeed(def: UnitDef): number {
  return def.attackCooldown;
}
