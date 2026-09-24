const fs = require("fs");
let s = fs.readFileSync("scripts/smoke-dive.mts", "utf8");
if (s.charCodeAt(1) === 0) {
  s = Buffer.from(s, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
}
s = s.replace(
  'enemyGoals(s2, "ai").find((g) => g.role === "princess")',
  'enemyGoals(s2, "player").find((g) => g.role === "princess")',
);
fs.writeFileSync("scripts/smoke-dive.mts", s, "utf8");
console.log("fixed");
