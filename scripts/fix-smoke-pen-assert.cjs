const fs = require("fs");
let smoke = fs.readFileSync("scripts/smoke-pen.mts", "utf8");
if (smoke.charCodeAt(1) === 0) {
  smoke = Buffer.from(smoke, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
}

const old = `if (Math.abs(invader.y - mid) > 2) {
  throw new Error(\`invader should stop at half line, got y=\${invader.y}\`);
}`;

const neu = `// Stop on AI river bank (half-line clear), not geometric mid through water.
const stopY = mid - MATCH_CONFIG.riverHeight / 2 - 18;
if (Math.abs(invader.y - stopY) > 2) {
  throw new Error(\`invader should stop at half-line bank ~\${stopY}, got y=\${invader.y}\`);
}`;

if (!smoke.includes(old)) {
  // try without template escape differences
  const idx = smoke.indexOf("invader should stop at half line");
  console.log("near", JSON.stringify(smoke.slice(idx - 80, idx + 120)));
  throw new Error("old assertion not found");
}
smoke = smoke.replace(old, neu);
fs.writeFileSync("scripts/smoke-pen.mts", smoke, "utf8");
console.log("smoke assertion updated");
