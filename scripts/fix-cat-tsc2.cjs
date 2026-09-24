const fs = require("fs");

let h = fs.readFileSync("src/ui/hud.ts", "utf8");
if (!h.includes("cardCategory")) {
  h = h.replace(
    /import \{([^}]+)\} from "\.\.\/config\/cards";/,
    (m, inner) =>
      inner.includes("cardCategory")
        ? m
        : `import { ${inner.trim().replace(/,$/, "")}, cardCategory } from "../config/cards";`,
  );
}

const oldHud = `    if (isSpellDef(def)) {
      btn.innerHTML = \`
        <span class="card-name">\${def.name}</span>
        <span class="card-label">\${def.label}</span>
        <span class="card-cost">\${def.cost} M</span>
        <span class="card-stats">\${cat} · \${
          def.spell === "dive"
            ? "SPELL · Tower −1 / YC"
            : def.spell === "highline"
              ? "SPELL · To half line"
              : "SPELL"
        }</span>
      \`;
    } else {
      const dps = unitDps(def);
      const hit = unitHitSpeed(def);
      const cat = cardCategory(def).toUpperCase();`;

const neuHud = `    const cat = cardCategory(def).toUpperCase();
    if (isSpellDef(def)) {
      btn.innerHTML = \`
        <span class="card-name">\${def.name}</span>
        <span class="card-label">\${def.label}</span>
        <span class="card-cost">\${def.cost} M</span>
        <span class="card-stats">\${cat} · \${
          def.spell === "dive"
            ? "Tower −1 / YC"
            : def.spell === "highline"
              ? "To half line"
              : "SPELL"
        }</span>
      \`;
    } else {
      const dps = unitDps(def);
      const hit = unitHitSpeed(def);`;

if (!h.includes(oldHud)) {
  console.log("HUD block mismatch, trying alt");
  // Insert cat before first isSpellDef content branch inside syncHand
  if (!h.includes("const cat = cardCategory(def)")) {
    h = h.replace(
      `    if (isSpellDef(def)) {
      btn.innerHTML = \``,
      `    const cat = cardCategory(def).toUpperCase();
    if (isSpellDef(def)) {
      btn.innerHTML = \``,
    );
  }
  // Remove inner cat declaration
  h = h.replace(
    `      const dps = unitDps(def);
      const hit = unitHitSpeed(def);
      const cat = cardCategory(def).toUpperCase();
`,
    `      const dps = unitDps(def);
      const hit = unitHitSpeed(def);
`,
  );
  // Ensure troop stats show category
  if (!h.includes("${cat} · DMG") && h.includes("DMG ${def.damage}")) {
    h = h.replace(
      "<span class=\"card-stats\">DMG ${def.damage}",
      '<span class="card-stats">${cat} · DMG ${def.damage}',
    );
  }
} else {
  h = h.replace(oldHud, neuHud);
  if (!h.includes("${cat} · DMG") && h.includes("DMG ${def.damage}")) {
    h = h.replace(
      '<span class="card-stats">DMG ${def.damage}',
      '<span class="card-stats">${cat} · DMG ${def.damage}',
    );
  }
}
fs.writeFileSync("src/ui/hud.ts", h, "utf8");
console.log("hud ok", h.includes("const cat = cardCategory(def)"));

// Targeting: replace building/wall skip with category-only
let tg = fs.readFileSync("src/systems/targeting.ts", "utf8");
tg = tg.replace(
  /if \(def\.ability\?\.kind === "wall" \|\| unitCategory\(def\) === "building"\) \{[\s\S]*?continue;\n    \}\n    if \(def\.ability\?\.kind === "wall"\) \{[\s\S]*?continue;\n    \}\n/,
  `if (unitCategory(def) === "building" || def.damage <= 0) {
      unit.target = null;
      unit.activeRange = 0;
      continue;
    }
`,
);
fs.writeFileSync("src/systems/targeting.ts", tg, "utf8");
console.log("targeting has building skip", tg.includes('unitCategory(def) === "building"'));
console.log("targeting still checks wall ability?", /ability\?\.kind === "wall"/.test(tg));
