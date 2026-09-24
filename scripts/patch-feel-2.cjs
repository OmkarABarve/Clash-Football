const fs = require("fs");

function patch(rel, pairs) {
  let s = fs.readFileSync(rel, "utf8");
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.error("MISSING in", rel, ":\n---\n" + from + "\n---");
      process.exit(1);
    }
    s = s.split(from).join(to);
  }
  fs.writeFileSync(rel, s, "utf8");
  console.log("patched", rel);
}

// ---------- cycle: shuffle + shuffled deck ----------
patch("src/systems/cycle.ts", [
  [
    `import type { DeckState } from "../config/types";

/** Clash-style circular cycle: hand of N, rest in queue, next slot shows queue[0]. */
export function buildDeck(unitIds: string[], handSize: number): DeckState {
  if (unitIds.length === 0) {
    return { hand: [], queue: [] };
  }
  const roster = [...unitIds];
  const size = Math.min(handSize, roster.length);
  return {
    hand: roster.slice(0, size),
    queue: roster.slice(size),
  };
}`,
    `import type { DeckState } from "../config/types";

export function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/** Clash-style circular cycle: hand of N, rest in queue, next slot shows queue[0]. */
export function buildDeck(unitIds: string[], handSize: number): DeckState {
  if (unitIds.length === 0) {
    return { hand: [], queue: [] };
  }
  const roster = [...unitIds];
  const size = Math.min(handSize, roster.length);
  return {
    hand: roster.slice(0, size),
    queue: roster.slice(size),
  };
}

/** Shuffle, cap at deckSize, then deal a Clash-style hand. */
export function buildShuffledDeck(
  unitIds: string[],
  handSize: number,
  deckSize: number,
): DeckState {
  const capped = shuffleIds(unitIds).slice(0, Math.min(deckSize, unitIds.length));
  return buildDeck(capped, handSize);
}`,
  ],
]);

// ---------- factory: spawn fields + dual decks + timer ----------
{
  let fac = fs.readFileSync("src/entities/factory.ts", "utf8");
  const unitInsert = `    speed: (variant?.speed ?? def.speed) * state.config.speedScale,
    range: (variant?.range ?? def.range) * state.config.rangeScale,
  };`;
  const unitReplace = `    speed: (variant?.speed ?? def.speed) * state.config.speedScale,
    range: (variant?.range ?? def.range) * state.config.rangeScale,
    spawnT: state.config.deployPuffDuration,
    facing: side === "player" ? -Math.PI / 2 : Math.PI / 2,
    shootRecoil: 0,
  };`;
  if (!fac.includes(unitInsert)) {
    console.error("factory unit return missing");
    process.exit(1);
  }
  fac = fac.replace(unitInsert, unitReplace);

  if (!fac.includes('import { buildDeck } from "../systems/cycle";')) {
    console.error("factory cycle import missing");
    process.exit(1);
  }
  fac = fac.replace(
    'import { buildDeck } from "../systems/cycle";',
    'import { buildShuffledDeck } from "../systems/cycle";',
  );

  const oldMatch = `export function createMatch(): GameState {
  const config = { ...MATCH_CONFIG, arena: { ...MATCH_CONFIG.arena } };
  const ids = enabledUnitIds();
  const deck = buildDeck(ids, config.handSize);
  const [minAi, maxAi] = config.aiInterval;

  return {
    status: "playing",
    time: 0,
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
    aiTimer: minAi + Math.random() * (maxAi - minAi),
    selectedId: null,
    hover: null,
    intents: [],
  };
}`;

  const newMatch = `export function createMatch(): GameState {
  const config = { ...MATCH_CONFIG, arena: { ...MATCH_CONFIG.arena } };
  const ids = enabledUnitIds();
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
  };
}`;

  if (!fac.includes(oldMatch)) {
    console.error("factory createMatch block missing");
    process.exit(1);
  }
  fac = fac.replace(oldMatch, newMatch);
  fs.writeFileSync("src/entities/factory.ts", fac, "utf8");
  console.log("patched factory");
}

// ---------- intents: AI cycles its deck ----------
patch("src/systems/intents.ts", [
  [
    `    if (intent.side === "player") {
      if (!isInHand(state.deck, intent.defId)) continue;
      if (!isInOwnHalf(state, intent.side, intent.x, intent.y, def.radius)) {
        continue;
      }
      if (!spend(eco, def.cost)) continue;
      playCard(state.deck, intent.defId);
      state.selectedId = null;
    } else {
      if (!isInOwnHalf(state, intent.side, intent.x, intent.y, def.radius)) {
        continue;
      }
      if (!spend(eco, def.cost)) continue;
    }`,
    `    if (intent.side === "player") {
      if (!isInHand(state.deck, intent.defId)) continue;
      if (!isInOwnHalf(state, intent.side, intent.x, intent.y, def.radius)) {
        continue;
      }
      if (!spend(eco, def.cost)) continue;
      playCard(state.deck, intent.defId);
      state.selectedId = null;
    } else {
      if (!isInHand(state.aiDeck, intent.defId)) continue;
      if (!isInOwnHalf(state, intent.side, intent.x, intent.y, def.radius)) {
        continue;
      }
      if (!spend(eco, def.cost)) continue;
      playCard(state.aiDeck, intent.defId);
    }`,
  ],
]);

// ---------- AI: play from hand ----------
fs.writeFileSync(
  "src/systems/ai.ts",
  `import type { GameState } from "../config/types";
import { getUnitDef } from "../config/units";
import { canAfford } from "./economy";
import { ownHalfY } from "./lanes";

export function updateAi(state: GameState, dt: number): void {
  if (state.status !== "playing") return;

  state.aiTimer -= dt;
  if (state.aiTimer > 0) return;

  rollNextTimer(state);

  const affordable = state.aiDeck.hand.filter((id) =>
    canAfford(state.economy.ai, getUnitDef(id).cost),
  );
  if (affordable.length === 0) return;

  const defId = affordable[Math.floor(Math.random() * affordable.length)]!;
  const { arena, unitRadiusDefault } = state.config;
  const margin = unitRadiusDefault + 4;
  const x = margin + Math.random() * (arena.width - margin * 2);
  const { minY, maxY } = ownHalfY(state.config, "ai", margin);
  const y = minY + Math.random() * Math.max(1, maxY - minY);

  state.intents.push({ side: "ai", defId, x, y });
}

function rollNextTimer(state: GameState): void {
  const [min, max] = state.config.aiInterval;
  state.aiTimer = min + Math.random() * (max - min);
}
`,
  "utf8",
);
console.log("wrote ai");

console.log("phase2 ok");
