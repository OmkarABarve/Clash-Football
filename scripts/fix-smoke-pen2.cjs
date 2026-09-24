const fs = require("fs");
let smoke = fs.readFileSync("scripts/smoke-pen.mts", "utf8");
if (smoke.charCodeAt(1) === 0) {
  smoke = Buffer.from(smoke, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
}

const bad = `if (invader.y >= invY0) throw new Error("invader should be shoved toward half line");
if (invader.y < mid - 1) {
  throw new Error(\`invader pushed past half line: y=\${invader.y} mid=\${mid}\`);
}
// Stop on AI river bank (half-line clear), not geometric mid through water.
const stopY = mid - MATCH_CONFIG.riverHeight / 2 - 18;
if (Math.abs(invader.y - stopY) > 2) {
  throw new Error(\`invader should stop at half-line bank ~\${stopY}, got y=\${invader.y}\`);
}`;

const good = `if (invader.y >= invY0) throw new Error("invader should be shoved toward half line");
// Stop on AI river bank (their half edge) — geometric mid sits in the river.
const stopY = mid - MATCH_CONFIG.riverHeight / 2 - 18;
if (Math.abs(invader.y - stopY) > 2) {
  throw new Error(\`invader should stop at half-line bank ~\${stopY}, got y=\${invader.y}\`);
}
if (invader.y < stopY - 2) {
  throw new Error(\`invader shoved deeper than half line: y=\${invader.y} stop=\${stopY}\`);
}`;

if (!smoke.includes("invader pushed past half line") && !smoke.includes("half-line bank")) {
  console.log(smoke.slice(smoke.indexOf("invader"), smoke.indexOf("invader") + 500));
  throw new Error("assertion block not found");
}

if (smoke.includes(bad)) {
  smoke = smoke.replace(bad, good);
} else {
  // Replace more loosely
  smoke = smoke.replace(
    /if \(invader\.y >= invY0\)[\s\S]*?if \(Math\.abs\(home\.y - homeY0\)/,
    `if (invader.y >= invY0) throw new Error("invader should be shoved toward half line");
// Stop on AI river bank (their half edge) — geometric mid sits in the river.
const stopY = mid - MATCH_CONFIG.riverHeight / 2 - 18;
if (Math.abs(invader.y - stopY) > 2) {
  throw new Error(\`invader should stop at half-line bank ~\${stopY}, got y=\${invader.y}\`);
}
if (invader.y < stopY - 2) {
  throw new Error(\`invader shoved deeper than half line: y=\${invader.y} stop=\${stopY}\`);
}
if (Math.abs(home.y - homeY0)`,
  );
}

fs.writeFileSync("scripts/smoke-pen.mts", smoke, "utf8");
console.log("smoke fixed");
