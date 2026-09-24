const fs = require("fs");
let s = fs.readFileSync("scripts/smoke.mts", "utf8");
if (s.includes("function aiHp(")) {
  console.log("already patched");
  process.exit(0);
}
const helper = `function aiHp(state: ReturnType<typeof createMatch>): number {
  return state.goals.filter((g) => g.side === "ai").reduce((a, g) => a + g.hp, 0);
}

`;
s = s.replace("const step = 1 / 60;", helper + "const step = 1 / 60;");
s = s.replace(/state\.goals\.ai\.hp/g, "aiHp(state)");
s = s.replace(/s2\.goals\.ai\.hp/g, "aiHp(s2)");
s = s.replace(
  "if (aiHp(state) >= 5) throw new Error(\"Ronaldo should damage goal\");",
  "if (aiHp(state) >= 60) throw new Error(\"Ronaldo should damage goal\");",
);
fs.writeFileSync("scripts/smoke.mts", s, "utf8");
console.log("patched smoke.mts");
