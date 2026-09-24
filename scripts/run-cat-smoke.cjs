const fs = require("fs");
const { spawnSync } = require("child_process");

const ney = fs
  .readFileSync("src/config/units.ts", "utf8")
  .match(/neymar:[\s\S]*?targetFilter: "([^"]+)"/)[1];
console.log("neymar filter =", ney);

let tg = fs.readFileSync("src/systems/targeting.ts", "utf8");
if (!tg.includes(`"${ney}"`)) {
  tg = tg
    .replace(/"buildingsOrKing"/g, `"${ney}"`)
    .replace(/"buildingsOrKing"/g, `"${ney}"`);
  // also replace bare identifier usages if any
  fs.writeFileSync("src/systems/targeting.ts", tg, "utf8");
  console.log("aligned targeting to", ney);
} else {
  console.log("targeting already uses", ney);
}

let smoke = fs.readFileSync("scripts/smoke-categories.mts", "utf8");
if (smoke.charCodeAt(1) === 0) {
  smoke = Buffer.from(smoke, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
}
smoke = smoke.replace(/buildingsOrKing/g, ney);
fs.writeFileSync("scripts/smoke-categories.mts", smoke, "utf8");

const r = spawnSync("npx", ["tsx", "scripts/smoke-categories.mts"], {
  encoding: "utf8",
  shell: true,
});
console.log(r.stdout);
console.error(r.stderr);
process.exit(r.status ?? 1);
