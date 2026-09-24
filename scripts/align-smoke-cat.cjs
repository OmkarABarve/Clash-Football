const fs = require("fs");
const f = "scripts/smoke-categories.mts";
let b = fs.readFileSync(f);
if (b[1] === 0) {
  fs.writeFileSync(f, b.toString("utf16le").replace(/^\uFEFF/, ""), "utf8");
}
const ney = fs
  .readFileSync("src/config/units.ts", "utf8")
  .match(/neymar:[\s\S]*?targetFilter: "([^"]+)"/)[1];
const filter = fs
  .readFileSync("src/config/types.ts", "utf8")
  .match(/TargetFilter = ([^;]+)/)[1];
console.log({ ney, filter });
let s = fs.readFileSync(f, "utf8");
s = s.replace(/buildingsOrKing/g, ney);
s = s.replace(/"buildingsOrKing"/g, `"${ney}"`);
fs.writeFileSync(f, s, "utf8");
