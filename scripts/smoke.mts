import { createMatch, createUnit } from "../src/entities/factory.ts";
import { processIntents } from "../src/systems/intents.ts";
import { updateEconomy } from "../src/systems/economy.ts";
import { updateTargeting } from "../src/systems/targeting.ts";
import { updateMovement } from "../src/systems/movement.ts";
import { updateCombat } from "../src/systems/combat.ts";
import { updateProjectiles } from "../src/systems/projectiles.ts";
import { cleanupAndCheck } from "../src/systems/match.ts";
import { playCard, buildDeck } from "../src/systems/cycle.ts";
import { enabledUnitIds } from "../src/config/units.ts";
import { auraDamageMultiplier } from "../src/systems/damage.ts";

function aiHp(state: ReturnType<typeof createMatch>): number {
  return state.goals.filter((g) => g.side === "ai").reduce((a, g) => a + g.hp, 0);
}

const step = 1 / 60;

function tick(state: ReturnType<typeof createMatch>): void {
  processIntents(state);
  updateEconomy(state, step);
  processIntents(state);
  updateTargeting(state);
  updateMovement(state, step);
  updateCombat(state, step);
  updateProjectiles(state, step);
  cleanupAndCheck(state);
  state.time += step;
}

const deck = buildDeck(enabledUnitIds(), 4);
const first = deck.hand[0]!;
console.log("hand", deck.hand.join(","), "next", deck.queue[0]);
playCard(deck, first);
console.log("after play", deck.hand.join(","), "next", deck.queue[0]);
if (deck.hand.includes(first)) throw new Error("played card should leave hand");
console.log("cycle ok");

const state = createMatch();
state.economy.player.current = 10;
state.deck.hand = ["ronaldo", "messi", "neymar", "zlatan"];
state.deck.queue = ["ramos", "robbery", "iniesta"];
state.intents.push({ side: "player", defId: "ronaldo", x: 288, y: 720 });
for (let i = 0; i < 60 * 30; i++) tick(state);
console.log("ronaldo status", state.status, "aiGoal", aiHp(state));
if (aiHp(state) >= 60) throw new Error("Ronaldo should damage goal");

const s2 = createMatch();
s2.economy.player.current = 10;
s2.deck.hand = ["messi", "ronaldo", "neymar", "zlatan"];
s2.deck.queue = ["ramos", "robbery", "iniesta"];
s2.intents.push({ side: "player", defId: "messi", x: 288, y: 800 });
let empoweredHits = 0;
for (let i = 0; i < 60 * 25; i++) {
  const before = aiHp(s2);
  tick(s2);
  if (aiHp(s2) <= before - 2) empoweredHits++;
}
console.log(
  "messi empoweredHits",
  empoweredHits,
  "goal",
  aiHp(s2),
  "units",
  s2.units.length,
);
if (s2.units.length === 0) throw new Error("Messi should have spawned");
if (empoweredHits < 1) throw new Error("Messi should land an empowered goal hit");

const s3 = createMatch();
const n1 = createUnit(s3, "neymar", "player", 200, 500);
const n2 = createUnit(s3, "neymar", "player", 210, 505);
const victim = createUnit(s3, "ramos", "player", 205, 510);
s3.units.push(n1, n2, victim);
const mult = auraDamageMultiplier(s3, victim);
console.log("aura mult", mult);
if (mult !== 0.75) throw new Error("aura should be 0.75");

const s4 = createMatch();
s4.economy.player.current = 10;
s4.deck.hand = ["robbery", "messi", "neymar", "zlatan"];
s4.deck.queue = ["ramos", "ronaldo", "iniesta"];
s4.intents.push({ side: "player", defId: "robbery", x: 288, y: 740 });
tick(s4);
console.log("robbery", s4.units.map((u) => u.label).join(","));
if (s4.units.length !== 2) throw new Error("Robbery should spawn 2");

const s5 = createMatch();
s5.economy.ai.current = 10;
s5.intents.push({ side: "ai", defId: "zlatan", x: 288, y: 250 });
tick(s5);
if (s5.units.length !== 1 || s5.units[0]!.side !== "ai") {
  throw new Error("AI deploy failed");
}
console.log("ai deploy ok");

console.log("ALL SMOKE TESTS PASSED");
