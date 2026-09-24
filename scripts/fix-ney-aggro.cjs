const fs = require("fs");
let tg = fs.readFileSync("src/systems/targeting.ts", "utf8");

const old = `    if (def.targetFilter === "buildingsOrKing") {
      // Prefer enemy buildings (e.g. Wall); otherwise march on the King tower.
      const buildings = enemies.filter(
        (e) =>
          unitCategory(getUnitDef(e.defId)) === "building" &&
          distUnits(unit, e) <= aggro,
      );
      const nearBuilding = nearestUnit(unit, buildings);`;

const neu = `    if (def.targetFilter === "buildingsOrKing") {
      // Prefer enemy buildings (e.g. Wall) anywhere on the pitch — Clash-style
      // building targeters don't use short troop aggro for buildings.
      const buildings = enemies.filter(
        (e) => unitCategory(getUnitDef(e.defId)) === "building",
      );
      const nearBuilding = nearestUnit(unit, buildings);`;

if (!tg.includes(old)) {
  // try without comment differences
  if (!tg.includes('unitCategory(getUnitDef(e.defId)) === "building" &&')) {
    console.log("pattern missing");
    const i = tg.indexOf("buildingsOrKing");
    console.log(tg.slice(i, i + 450));
    process.exit(1);
  }
  tg = tg.replace(
    /unitCategory\(getUnitDef\(e\.defId\)\) === "building" &&\s*distUnits\(unit, e\) <= aggro,/,
    'unitCategory(getUnitDef(e.defId)) === "building",',
  );
} else {
  tg = tg.replace(old, neu);
}
fs.writeFileSync("src/systems/targeting.ts", tg, "utf8");
console.log("buildings detected map-wide");
