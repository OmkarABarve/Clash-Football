const fs = require("fs");

let u = fs.readFileSync("src/config/units.ts", "utf8");
if (!u.includes("wall:")) throw new Error("wall missing");
const before = u.match(/wall: \{[\s\S]*?hp: \d+[^]*?\n/)?.[0];
u = u.replace(
  /(wall: \{[\s\S]*?hp: )\d+(,?\s*\/\/[^\n]*)?/,
  "$1400, // half Zlatan",
);
fs.writeFileSync("src/config/units.ts", u, "utf8");
console.log("was", before);
console.log("now", u.match(/wall: \{[\s\S]*?hp: \d+[^\n]*/)?.[0]);

let s = fs.readFileSync("scripts/smoke-wall.mts", "utf8");
if (s.charCodeAt(1) === 0) {
  s = Buffer.from(s, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
}
s = s.replace(
  /if \(wallDef\.hp !== zlatan\.hp\) throw new Error\("[^"]*"\);/,
  'if (wallDef.hp !== zlatan.hp / 2) throw new Error("Wall HP should be half Zlatan");',
);
fs.writeFileSync("scripts/smoke-wall.mts", s, "utf8");
console.log("smoke ok");
