import { MATCH_CONFIG } from "../config/match";
import type {
  DeployIntent,
  Economy,
  GameState,
  Goal,
  MatchConfig,
  Projectile,
  Side,
  TargetRef,
  Unit,
} from "../config/types";
import { enabledCardIds } from "../config/cards";
import { getUnitDef } from "../config/units";
import { nextId } from "./ids";
import { buildShuffledDeck } from "../systems/cycle";

/** Clash Royale layout: left princess, right princess, king behind. */
export function createSideGoals(
  side: Side,
  config: MatchConfig = MATCH_CONFIG,
): Goal[] {
  const {
    arena,
    princessWidth,
    princessHeight,
    kingWidth,
    kingHeight,
    princessInsetX,
    princessInsetY,
    kingInset,
    princessMaxHp,
    kingMaxHp,
  } = config;

  const leftX = princessInsetX;
  const rightX = arena.width - princessInsetX - princessWidth;
  const kingX = (arena.width - kingWidth) / 2;

  let leftY: number;
  let rightY: number;
  let kingY: number;

  if (side === "ai") {
    kingY = kingInset;
    leftY = princessInsetY;
    rightY = princessInsetY;
  } else {
    kingY = arena.height - kingInset - kingHeight;
    leftY = arena.height - princessInsetY - princessHeight;
    rightY = leftY;
  }

  return [
    {
      id: `${side}-left`,
      side,
      role: "princess",
      lane: "left",
      x: leftX,
      y: leftY,
      w: princessWidth,
      h: princessHeight,
      hp: princessMaxHp,
      maxHp: princessMaxHp,
      activated: true,
      cooldownLeft: 0,
    },
    {
      id: `${side}-right`,
      side,
      role: "princess",
      lane: "right",
      x: rightX,
      y: rightY,
      w: princessWidth,
      h: princessHeight,
      hp: princessMaxHp,
      maxHp: princessMaxHp,
      activated: true,
      cooldownLeft: 0,
    },
    {
      id: `${side}-king`,
      side,
      role: "king",
      lane: "center",
      x: kingX,
      y: kingY,
      w: kingWidth,
      h: kingHeight,
      hp: kingMaxHp,
      maxHp: kingMaxHp,
      activated: false,
      cooldownLeft: 0,
    },
  ];
}

export function createEconomy(config = MATCH_CONFIG): Economy {
  return {
    current: config.startingM,
    max: config.maxM,
    regenPerSecond: 1 / config.regenInterval,
  };
}

export function createUnit(
  state: GameState,
  defId: string,
  side: Side,
  x: number,
  y: number,
  variantIndex = 0,
): Unit {
  const def = getUnitDef(defId);
  const variant = def.spawnVariants?.[variantIndex];
  const charge =
    def.ability?.kind === "charge"
      ? { movingTime: 0, movingDistance: 0, ready: false }
      : null;

  return {
    id: nextId(state),
    defId,
    side,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    cooldownLeft: 0,
    target: null,
    activeRange: (def.meleeRange ?? def.range) * state.config.tileSize * state.config.rangeScale,
    charge,
    movedThisTick: false,
    hybridMeleeLock: false,
    label: variant?.label ?? def.label,
    name: variant?.name ?? def.name,
    speed: (variant?.speed ?? def.speed) * state.config.tileSize * state.config.speedScale,
    range: (variant?.range ?? def.range) * state.config.tileSize * state.config.rangeScale,
    spawnT: state.config.deployPuffDuration,
    facing: side === "player" ? -Math.PI / 2 : Math.PI / 2,
    shootRecoil: 0,
    hitFlash: 0,
    deathT: 0,
  };
}

export function createProjectile(
  state: GameState,
  opts: {
    side: Side;
    x: number;
    y: number;
    target: TargetRef;
    damage: number;
    goalHpDelta: number;
    empowered: boolean;
  },
): Projectile {
  return {
    id: nextId(state),
    side: opts.side,
    x: opts.x,
    y: opts.y,
    target: opts.target,
    damage: opts.damage,
    goalHpDelta: opts.goalHpDelta,
    speed: state.config.projectileSpeed,
    empowered: opts.empowered,
  };
}

export function spawnFromCard(
  state: GameState,
  intent: DeployIntent,
): Unit[] {
  const def = getUnitDef(intent.defId);
  const count = def.spawnCount ?? 1;
  const spawned: Unit[] = [];
  for (let i = 0; i < count; i++) {
    const offsetX = (def.spawnVariants?.[i]?.offsetX ?? 0) * state.config.tileSize;
    const x = clamp(
      intent.x + offsetX,
      def.radius,
      state.config.arena.width - def.radius,
    );
    const y = clamp(
      intent.y,
      def.radius,
      state.config.arena.height - def.radius,
    );
    spawned.push(createUnit(state, intent.defId, intent.side, x, y, i));
  }
  return spawned;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function createMatch(): GameState {
  const config = { ...MATCH_CONFIG, arena: { ...MATCH_CONFIG.arena } };
  const ids = enabledCardIds();
  const deck = buildShuffledDeck(ids, config.handSize, config.deckSize);
  const aiDeck = buildShuffledDeck(ids, config.handSize, config.deckSize);
  const [minAi, maxAi] = config.aiInterval;

  return {
    status: "playing",
    time: 0,
    timeLeft: config.matchDuration,
    nextId: 1,
    config,
    goals: [
      ...createSideGoals("player", config),
      ...createSideGoals("ai", config),
    ],
    units: [],
    projectiles: [],
    economy: {
      player: createEconomy(config),
      ai: createEconomy(config),
    },
    deck,
    aiDeck,
    aiTimer: minAi + Math.random() * (maxAi - minAi),
    selectedId: null,
    hover: null,
    intents: [],
    shake: 0,
    goalFlashes: [],
    damageFloats: [],
    highLineFx: null,
  };
}
