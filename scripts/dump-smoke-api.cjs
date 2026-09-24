const fs = require("fs");
function dump() {
  const u = fs.readFileSync("src/config/units.ts", "utf8");
  console.log("getUnit", [...u.matchAll(/export function (\w+)/g)].map((x) => x[1]));
  const f = fs.readFileSync("src/entities/factory.ts", "utf8");
  console.log("factory exports", [...f.matchAll(/export function (\w+)/g)].map((x) => x[1]));
  console.log("goal ids sample", f.match(/id: `\$\{side\}-\w+`/g));
  const t = fs.readFileSync("src/config/types.ts", "utf8");
  console.log("Unit spawn/death", t.match(/spawn\w+|death\w+/g)?.slice(0, 10));
  console.log("GameState time", /time:/g.test(t), /timeLeft/.test(t));
  const m = fs.readFileSync("src/config/match.ts", "utf8");
  console.log("MATCH", /export const (\w+)/.exec(m)?.[1]);
  console.log("tower dmg", m.match(/princessTowerDamage: [\d.]+/)?.[0]);
}
dump();
