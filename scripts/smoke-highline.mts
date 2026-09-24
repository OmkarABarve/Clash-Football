import { createMatch, createUnit } from "../src/entities/factory.ts";
import { getSpellDef, isSpellId, enabledCardIds } from "../src/config/cards.ts";
import { MATCH_CONFIG } from "../src/config/match.ts";
import { processIntents } from "../src/systems/intents.ts";
import { updateHighLine } from "../src/systems/spells.ts";

const step = 1 / 60;

const spell = getSpellDef("highline");
if (spell.cost !== 6) throw new Error(`HighLine should cost 6 M, got ${spell.cost}`);
if (spell.pushTiles !== 5) {
  throw new Error(`HighLine should push 5 tiles, got ${spell.pushTiles}`);
}
if (!isSpellId("highline")) throw new Error("highline should be a spell id");
if (!enabledCardIds().includes("highline")) {
  throw new Error("deck roster should include highline");
}
console.log("def ok", spell.name, spell.cost, "M", spell.pushTiles, "tiles");

const s = createMatch();
s.economy.player.current = 10;
s.deck.hand = ["highline", "messi", "neymar", "zlatan"];
s.deck.queue = ["ramos", "ronaldo", "iniesta", "robbery"];

const n1 = createUnit(s, "neymar", "ai", 200, 420);
const n2 = createUnit(s, "zlatan", "ai", 300, 360);
n1.spawnT = 0;
n2.spawnT = 0;
s.units.push(n1, n2);

const y1 = n1.y;
const y2 = n2.y;
const expected = 5 * MATCH_CONFIG.tileSize;

s.intents.push({ side: "player", defId: "highline", x: 320, y: 500 });
processIntents(s);

if (s.economy.player.current !== 4) {
  throw new Error(`expected 4 M left after HighLine, got ${s.economy.player.current}`);
}
if (!s.highLineFx) throw new Error("HighLine FX should start");
if (s.deck.hand.includes("highline")) throw new Error("HighLine should leave the hand");

for (let i = 0; i < 60; i++) updateHighLine(s, step);

if (s.highLineFx) throw new Error("FX should finish");
const dy1 = y1 - n1.y; // AI pushed behind = toward top = smaller y
const dy2 = y2 - n2.y;
console.log("push", dy1.toFixed(1), dy2.toFixed(1), "expected", expected);
if (Math.abs(dy1 - expected) > 1 || Math.abs(dy2 - expected) > 1) {
  throw new Error(`AI units should move ${expected}px toward their backline`);
}
if (n1.y >= y1 || n2.y >= y2) throw new Error("AI should be shoved upward (behind)");

console.log("HIGHLINE SMOKE OK");
