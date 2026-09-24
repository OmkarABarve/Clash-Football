import { createMatch, createUnit } from "../src/entities/factory.ts";
import { getSpellDef, isSpellId, enabledCardIds } from "../src/config/cards.ts";
import { getUnitDef } from "../src/config/units.ts";
import { MATCH_CONFIG } from "../src/config/match.ts";
import { processIntents } from "../src/systems/intents.ts";
import { updateHighLine, castPen } from "../src/systems/spells.ts";
import { kingGoal } from "../src/systems/goals.ts";

const step = 1 / 60;
const mid = MATCH_CONFIG.midlineY;

// --- Neymar buff ---
const ney = getUnitDef("neymar");
if (ney.speed < 3.0) throw new Error(`Neymar speed should be increased, got ${ney.speed}`);
if (ney.radius > 0.5) throw new Error(`Neymar radius should be slightly smaller, got ${ney.radius}`);
console.log("neymar ok", { speed: ney.speed, radius: ney.radius });

// --- HighLine: only pushes invaders to the half line ---
const hl = getSpellDef("highline");
if (hl.cost !== 6) throw new Error("HighLine should cost 6 M");
if (!isSpellId("highline") || !enabledCardIds().includes("highline")) {
  throw new Error("highline missing from roster");
}

const s = createMatch();
s.economy.player.current = 10;
s.deck.hand = ["highline", "messi", "neymar", "zlatan"];
s.deck.queue = ["ramos", "ronaldo", "iniesta", "robbery"];

const invader = createUnit(s, "neymar", "ai", 200, mid + 180);
const home = createUnit(s, "zlatan", "ai", 300, mid - 120);
invader.spawnT = 0;
home.spawnT = 0;
s.units.push(invader, home);

const invY0 = invader.y;
const homeY0 = home.y;

s.intents.push({ side: "player", defId: "highline", x: 288, y: mid + 100 });
processIntents(s);

if (!s.highLineFx) throw new Error("HighLine FX should start");
for (let i = 0; i < 60; i++) updateHighLine(s, step);
if (s.highLineFx) throw new Error("HighLine FX should finish");

if (invader.y >= invY0) throw new Error("invader should be shoved toward half line");
// Stop on AI river bank (their half edge) — geometric mid sits in the river.
const stopY = mid - MATCH_CONFIG.riverHeight / 2 - 18;
if (Math.abs(invader.y - stopY) > 2) {
  throw new Error(`invader should stop at half-line bank ~${stopY}, got y=${invader.y}`);
}
if (invader.y < stopY - 2) {
  throw new Error(`invader shoved deeper than half line: y=${invader.y} stop=${stopY}`);
}
if (Math.abs(home.y - homeY0) > 1) {
  throw new Error("unit already on own half should not be shoved");
}
console.log("highline half-line ok", {
  invader: invader.y.toFixed(1),
  home: home.y.toFixed(1),
  mid,
});

// --- Pen: 2 M, guaranteed King −1 ---
const pen = getSpellDef("pen");
if (pen.cost !== 2) throw new Error(`Pen should cost 2 M, got ${pen.cost}`);
if ((pen.towerHpDelta ?? 0) !== 1) throw new Error("Pen should deal 1 tower HP");
if (!enabledCardIds().includes("pen")) throw new Error("Pen missing from roster");

const s2 = createMatch();
s2.economy.player.current = 5;
s2.deck.hand = ["pen", "messi", "neymar", "zlatan"];
s2.deck.queue = ["ramos", "ronaldo", "iniesta", "highline"];

const king = kingGoal(s2, "ai");
if (!king) throw new Error("AI king missing");
const hp0 = king.hp;

s2.intents.push({ side: "player", defId: "pen", x: 288, y: mid + 80 });
processIntents(s2);

if (s2.economy.player.current !== 3) {
  throw new Error(`expected 3 M left after Pen, got ${s2.economy.player.current}`);
}
if (king.hp !== hp0 - 1) {
  throw new Error(`Pen should guarantee King -1 (was ${hp0}, now ${king.hp})`);
}
if (s2.deck.hand.includes("pen")) throw new Error("Pen should leave the hand");

const hp1 = king.hp;
castPen(s2, "player", 288, mid + 80);
if (king.hp !== hp1 - 1) throw new Error("castPen should also deal -1");

console.log("pen ok", { kingHp: king.hp, projectiles: s2.projectiles.length });
console.log("NEYMAR + HIGHLINE + PEN SMOKE OK");
