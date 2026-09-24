const fs = require("fs");

let s = fs.readFileSync("src/ui/render.ts", "utf8");
if (s.charCodeAt(1) === 0) s = Buffer.from(s, "utf16le").toString("utf8").replace(/^\uFEFF/, "");

const needle =
  "  // Wall deploy preview — 3-tile barrier ghost\n" +
  '  if (def.ability?.kind === "wall") {\n' +
  "    const tile = state.config.tileSize;\n";

if (!s.includes(needle)) throw new Error("wall preview needle not found");

if (!s.includes("  const { arena } = state.config;\n\n  // Wall deploy preview")) {
  s = s.replace(
    needle,
    "  const { arena } = state.config;\n\n" + needle,
  );
}

s = s.replace(
  "    return;\n  }\n\n  const { arena } = state.config;\n  const rPx = def.radius * state.config.tileSize;",
  "    return;\n  }\n\n  const rPx = def.radius * state.config.tileSize;",
);

fs.writeFileSync("src/ui/render.ts", s, "utf8");
console.log("render fixed");

let p = fs.readFileSync("src/systems/projectiles.ts", "utf8");
if (p.charCodeAt(1) === 0) p = Buffer.from(p, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
p = p.replace(/import \{ getUnitDef \} from "\.\.\/config\/units";\r?\n/, "");
fs.writeFileSync("src/systems/projectiles.ts", p, "utf8");
console.log("projectiles cleaned");
