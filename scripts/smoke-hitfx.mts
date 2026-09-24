import { createMatch } from "../src/entities/factory.ts";
import { processIntents } from "../src/systems/intents.ts";
import { applyUnitDamage } from "../src/systems/damage.ts";
import { cleanupAndCheck } from "../src/systems/match.ts";
import fs from "fs";

const s = createMatch();
s.economy.player.current = 10;
s.economy.ai.current = 10;
s.intents.push({ side: "player", defId: s.deck.hand[0]!, x: 300, y: 520 });
s.intents.push({ side: "ai", defId: s.aiDeck.hand[0]!, x: 300, y: 200 });
processIntents(s);
processIntents(s);

const victim = s.units.find((u) => u.side === "ai");
if (!victim) throw new Error("no ai unit");
victim.spawnT = 0;

applyUnitDamage(s, victim, 120);
console.log({
  hp: victim.hp,
  hitFlash: victim.hitFlash,
  floats: s.damageFloats.map((f) => f.amount),
  deathT: victim.deathT,
});

applyUnitDamage(s, victim, 99999);
console.log("after lethal", {
  hp: victim.hp,
  deathT: victim.deathT,
  stillInList: s.units.includes(victim),
});

cleanupAndCheck(s);
console.log(
  "after cleanup while dying",
  s.units.some((u) => u.id === victim.id),
);

victim.deathT = 0;
cleanupAndCheck(s);
console.log("after death done", s.units.some((u) => u.id === victim.id));

const r = fs.readFileSync("src/ui/render.ts", "utf8");
console.log("drawDamageFloats call", r.includes("drawDamageFloats(ctx, state)"));
console.log("drawDamageFloats fn", r.includes("function drawDamageFloats"));
console.log("hitFlash draw", r.includes("unit.hitFlash"));
console.log("death ring", r.includes("deathProgress"));
console.log("SMOKE OK");
