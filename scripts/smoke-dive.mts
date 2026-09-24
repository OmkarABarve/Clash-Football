import { createMatch, createUnit } from "../src/entities/factory.ts";
import { getSpellDef, isSpellId, enabledCardIds } from "../src/config/cards.ts";
import { MATCH_CONFIG } from "../src/config/match.ts";
import { processIntents } from "../src/systems/intents.ts";
import { castDive, findDiveTarget } from "../src/systems/spells.ts";
import { kingGoal, enemyGoals } from "../src/systems/goals.ts";
import { goalCenter } from "../src/systems/geometry.ts";

const mid = MATCH_CONFIG.midlineY;

const dive = getSpellDef("dive");
if (dive.cost !== 2) throw new Error(`Dive should cost 2 M, got ${dive.cost}`);
if (dive.name !== "Dive") throw new Error("Spell should be named Dive");
if ((dive.towerHpDelta ?? 0) !== 1) throw new Error("Dive tower delta should be 1");
if ((dive.yellowAttackSpeedMult ?? 1) !== 0.8) {
  throw new Error("Dive yellow AS mult should be 0.8");
}
if (!isSpellId("dive") || !enabledCardIds().includes("dive")) {
  throw new Error("dive missing from roster");
}
if (enabledCardIds().includes("pen")) {
  throw new Error("pen should be fully renamed away");
}
console.log("dive def ok");

// --- Cast on king tower → −1 HP ---
const s = createMatch();
s.economy.player.current = 5;
s.deck.hand = ["dive", "messi", "neymar", "zlatan"];
s.deck.queue = ["ramos", "ronaldo", "iniesta", "highline"];

const king = kingGoal(s, "ai");
if (!king) throw new Error("AI king missing");
const kc = goalCenter(king);
const hp0 = king.hp;

const aim = findDiveTarget(s, "player", kc.x, kc.y);
if (!aim || aim.kind !== "goal" || aim.goalId !== king.id) {
  throw new Error("findDiveTarget should pick the king under cursor");
}

s.intents.push({ side: "player", defId: "dive", x: kc.x, y: kc.y });
processIntents(s);

if (s.economy.player.current !== 3) {
  throw new Error(`expected 3 M left, got ${s.economy.player.current}`);
}
if (king.hp !== hp0 - 1) {
  throw new Error(`Dive on tower should deal −1 (was ${hp0}, now ${king.hp})`);
}
console.log("dive tower ok", { kingHp: king.hp });

// --- Cast on princess tower ---
const s2 = createMatch();
const princess = enemyGoals(s2, "player").find((g) => g.role === "princess");
if (!princess) throw new Error("princess missing");
const pc = goalCenter(princess);
const php0 = princess.hp;
castDive(s2, "player", pc.x, pc.y);
if (princess.hp !== php0 - 1) {
  throw new Error("Dive on princess should deal −1");
}
console.log("dive princess ok");

// --- Cast on enemy unit → yellow card ---
const s3 = createMatch();
const troop = createUnit(s3, "neymar", "ai", 288, mid - 80);
troop.spawnT = 0;
troop.cooldownLeft = 1.0;
s3.units.push(troop);

const tAim = findDiveTarget(s3, "player", troop.x, troop.y);
if (!tAim || tAim.kind !== "unit" || tAim.unitId !== troop.id) {
  throw new Error("findDiveTarget should pick the troop");
}

castDive(s3, "player", troop.x, troop.y);
if (!troop.yellowCard) throw new Error("Dive on troop should apply yellow card");
if (Math.abs(troop.cooldownLeft - 1.25) > 0.02) {
  throw new Error(`yellow should stretch cooldown ~1.25, got ${troop.cooldownLeft}`);
}
console.log("dive yellow ok", { cooldownLeft: troop.cooldownLeft.toFixed(2) });

// Empty cast does nothing
const s4 = createMatch();
const k4 = kingGoal(s4, "ai")!;
const h4 = k4.hp;
castDive(s4, "player", 288, mid);
if (k4.hp !== h4) throw new Error("missed Dive should not damage king");
console.log("dive miss ok");

console.log("DIVE SMOKE OK");
