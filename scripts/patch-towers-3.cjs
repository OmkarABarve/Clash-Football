const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
  console.log("wrote", rel);
}

write(
  "src/entities/factory.ts",
  `import { MATCH_CONFIG } from "../config/match";
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
import { enabledUnitIds, getUnitDef } from "../config/units";
import { nextId } from "./ids";
import { buildDeck } from "../systems/cycle";

export function createSideGoals(side: Side, config: MatchConfig = MATCH_CONFIG): Goal[] {
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
    // King at the back (top), princesses toward the river
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
      id: \`\${side}-left\`,
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
    },
    {
      id: \`\${side}-right\`,
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
    },
    {
      id: \`\${side}-king\`,
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
    activeRange: def.meleeRange ?? def.range,
    charge,
    movedThisTick: false,
    hybridMeleeLock: false,
    label: variant?.label ?? def.label,
    name: variant?.name ?? def.name,
    speed: variant?.speed ?? def.speed,
    range: variant?.range ?? def.range,
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
    const offsetX = def.spawnVariants?.[i]?.offsetX ?? 0;
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
  const ids = enabledUnitIds();
  const deck = buildDeck(ids, config.handSize);
  const [minAi, maxAi] = config.aiInterval;

  return {
    status: "playing",
    time: 0,
    nextId: 1,
    config,
    goals: [...createSideGoals("player", config), ...createSideGoals("ai", config)],
    units: [],
    projectiles: [],
    economy: {
      player: createEconomy(config),
      ai: createEconomy(config),
    },
    deck,
    aiTimer: minAi + Math.random() * (maxAi - minAi),
    selectedId: null,
    intents: [],
  };
}
`,
);

write(
  "src/systems/damage.ts",
  `import type { GameState, Unit } from "../config/types";
import { getUnitDef } from "../config/units";
import { activateKing, findGoal, livingGoals } from "./goals";
import { distUnits } from "./geometry";

export function auraDamageMultiplier(state: GameState, victim: Unit): number {
  let reduction = 0;
  for (const ally of state.units) {
    if (ally.hp <= 0 || ally.side !== victim.side) continue;
    const def = getUnitDef(ally.defId);
    if (def.ability?.kind !== "aura") continue;
    if (distUnits(ally, victim) <= def.ability.radius) {
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
  const mult = auraDamageMultiplier(state, victim);
  victim.hp = Math.max(0, victim.hp - rawDamage * mult);
}

export function applyGoalDamage(
  state: GameState,
  goalId: string,
  goalHpDelta: number,
): void {
  const goal = findGoal(state, goalId);
  if (!goal || goal.hp <= 0) return;

  goal.hp = Math.max(0, goal.hp - goalHpDelta);

  if (goal.role === "king") {
    goal.activated = true;
  }

  // Princess destroyed → activate that side's king (Clash Royale rule)
  if (goal.role === "princess" && goal.hp <= 0) {
    activateKing(state, goal.side);
  }

  // If any princess remains 0 and was already dead, still ensure king wake
  const livingPrincesses = livingGoals(state, goal.side).filter(
    (g) => g.role === "princess",
  );
  const allPrincesses = state.goals.filter(
    (g) => g.side === goal.side && g.role === "princess",
  );
  if (allPrincesses.some((g) => g.hp <= 0)) {
    activateKing(state, goal.side);
  }
  void livingPrincesses;
}
`,
);

write(
  "src/systems/match.ts",
  `import { createMatch } from "../entities/factory";
import type { GameState, MatchStatus } from "../config/types";
import { kingGoal } from "./goals";

/** Clash-style: destroying the King Tower ends the match. */
export function outcome(state: GameState): MatchStatus {
  const playerKing = kingGoal(state, "player");
  const aiKing = kingGoal(state, "ai");
  if (playerKing && playerKing.hp <= 0) return "aiWin";
  if (aiKing && aiKing.hp <= 0) return "playerWin";
  return "playing";
}

export function cleanupAndCheck(state: GameState): void {
  state.units = state.units.filter((u) => u.hp > 0);
  state.projectiles = state.projectiles.filter((p) => {
    if (p.target.kind === "unit") {
      const unitId = p.target.id;
      return state.units.some((u) => u.id === unitId);
    }
    const goal = state.goals.find((g) => g.id === p.target.goalId);
    return !!goal && goal.hp > 0;
  });
  state.status = outcome(state);
}

export function restartMatch(): GameState {
  return createMatch();
}
`,
);

console.log("factory/damage/match done");
