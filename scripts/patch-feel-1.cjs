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

patch("src/config/types.ts", [
  [
    `  hybridMeleeLock: boolean;
  /** Runtime overrides for multi-spawn cards. */
  label: string;
  name: string;
  speed: number;
  range: number;
}`,
    `  hybridMeleeLock: boolean;
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
}`,
  ],
  [
    `  unitDetectRange: number;
  hybridMeleeExit: number;
  goalHitDelta: number;
}`,
    `  unitDetectRange: number;
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
}`,
  ],
  [
    `export interface GameState {
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
  /** Cursor position in arena coordinates while a card is selected. */
  hover: { x: number; y: number } | null;
  intents: DeployIntent[];
}`,
    `export interface GoalFlash {
  goalId: string;
  t: number;
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
}`,
  ],
]);

patch("src/config/match.ts", [
  [
    `  hybridMeleeExit: 55,
  goalHitDelta: 1,
};`,
    `  hybridMeleeExit: 55,
  goalHitDelta: 1,
  deckSize: 8,
  deployPuffDuration: 0.3,
  matchDuration: 180,
  lastMinuteSeconds: 60,
  overtimeRegenInterval: 1.4,
  goalShakeAmount: 7,
  goalShakeDecay: 18,
  goalFlashDuration: 0.22,
  shootRecoilDuration: 0.09,
};`,
  ],
]);

console.log("types/match ok");
