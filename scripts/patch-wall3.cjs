/**
 * Wall phase 3: render as 3-tile bar, placement width, target closest point.
 */
const fs = require("fs");
const path = require("path");

function read(rel) {
  const p = path.join(__dirname, "..", rel);
  let b = fs.readFileSync(p);
  if (b[1] === 0) b = Buffer.from(b.toString("utf16le").replace(/^\uFEFF/, ""), "utf8");
  return { p, s: b.toString("utf8") };
}

function write(rel, s) {
  const p = path.join(__dirname, "..", rel);
  fs.writeFileSync(p, s, "utf8");
  console.log("wrote", rel);
}

// --- targeting: walk to closest point on wall footprint ---
{
  const { s } = read("src/systems/targeting.ts");
  let out = s;
  if (!out.includes("closestPointOnUnit")) {
    out = out.replace(
      'import { closestPointOnGoal, distToGoal, distUnits } from "./geometry";',
      'import { closestPointOnGoal, closestPointOnUnit, distToGoal, distUnits } from "./geometry";',
    );
  }
  const old = `  if (target.kind === "unit") {
    const u = state.units.find((x) => x.id === target.id && x.hp > 0);
    return u ? { x: u.x, y: u.y } : null;
  }`;
  const neu = `  if (target.kind === "unit") {
    const u = state.units.find((x) => x.id === target.id && x.hp > 0);
    if (!u) return null;
    // Walk / aim at the nearest point on wide footprints (Wall).
    return closestPointOnUnit(u, unit.x, unit.y, state.config.tileSize);
  }`;
  if (!out.includes("Walk / aim at the nearest point on wide footprints")) {
    if (!out.includes(old)) throw new Error("targetPosition unit branch not found");
    out = out.replace(old, neu);
  }
  write("src/systems/targeting.ts", out);
}

// --- intents / input: wall uses half-width for placement bounds ---
{
  let { s } = read("src/systems/intents.ts");
  if (!s.includes("deployRadiusPx")) {
    const helper = `
/** Horizontal/vertical margin used for deploy validity (walls are wide). */
export function deployRadiusPx(state: GameState, defId: string): number {
  const def = getCardDef(defId);
  if (!isSpellDef(def) && def.ability?.kind === "wall") {
    return (def.ability.widthTiles / 2) * state.config.tileSize;
  }
  if (isSpellDef(def)) return 0;
  return def.radius * state.config.tileSize;
}
`;
    // ensure imports
    if (!s.includes("getCardDef")) {
      s = s.replace(
        /import .+ from ["']\.\.\/config\/cards["'];?/,
        (m) => m,
      );
      if (!s.includes("from \"../config/cards\"")) {
        s = `import { getCardDef, isSpellDef } from "../config/cards";\n` + s;
      } else if (!s.includes("isSpellDef")) {
        s = s.replace(
          /import \{([^}]+)\} from ["']\.\.\/config\/cards["']/,
          (m, inner) => `import { ${inner.trim().replace(/,$/, "")}, isSpellDef } from "../config/cards"`,
        );
      }
      if (!s.includes("getCardDef")) {
        s = s.replace(
          /import \{([^}]+)\} from ["']\.\.\/config\/cards["']/,
          (m, inner) => `import { ${inner.trim().replace(/,$/, "")}, getCardDef } from "../config/cards"`,
        );
      }
    } else {
      if (!s.includes("isSpellDef")) {
        s = s.replace(
          /import \{([^}]+)\} from ["']\.\.\/config\/cards["']/,
          (m, inner) => {
            if (inner.includes("isSpellDef")) return m;
            return `import { ${inner.trim().replace(/,$/, "")}, isSpellDef } from "../config/cards"`;
          },
        );
      }
    }
    // insert helper before isInOwnHalf
    s = s.replace(
      "export function isInOwnHalf(",
      helper + "\nexport function isInOwnHalf(",
    );
    // use deployRadiusPx in resolveIntents
    s = s.replace(
      /if \(!isInOwnHalf\(state, intent\.side, intent\.x, intent\.y, def\.radius \* state\.config\.tileSize\)\)/,
      "if (!isInOwnHalf(state, intent.side, intent.x, intent.y, deployRadiusPx(state, intent.defId)))",
    );
    write("src/systems/intents.ts", s);
  } else {
    console.log("intents already has deployRadiusPx");
  }
}

{
  let { s } = read("src/systems/input.ts");
  if (!s.includes("deployRadiusPx")) {
    s = s.replace(
      'import { isInOwnHalf, isOnPitch } from "./intents";',
      'import { deployRadiusPx, isInOwnHalf, isOnPitch } from "./intents";',
    );
    s = s.replace(
      /!isInOwnHalf\(state, "player", world\.x, world\.y, def\.radius \* state\.config\.tileSize\)/,
      '!isInOwnHalf(state, "player", world.x, world.y, deployRadiusPx(state, state.selectedId))',
    );
    write("src/systems/input.ts", s);
  } else {
    console.log("input already uses deployRadiusPx");
  }
}

// --- render: draw wall as bar + wide preview ---
{
  let { s } = read("src/ui/render.ts");

  // Import deployRadiusPx if needed for preview validity
  if (!s.includes("deployRadiusPx")) {
    s = s.replace(
      'import { isInOwnHalf, isOnPitch } from "../systems/intents";',
      'import { deployRadiusPx, isInOwnHalf, isOnPitch } from "../systems/intents";',
    );
  }

  // Replace body drawing section inside drawUnit — inject wall branch before circle fill
  const marker = "  ctx.beginPath();\n  ctx.arc(0, 0, r, 0, Math.PI * 2);\n  ctx.fillStyle = color;";
  if (!s.includes("ability?.kind === \"wall\"")) {
    const wallBody = `  // Wall: wide horizontal barrier (3 tiles)
  if (def.ability?.kind === "wall") {
    const tile = state.config.tileSize;
    const w = def.ability.widthTiles * tile;
    const h = Math.max(r * 2, tile * 0.7);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.45 + 0.55 * scale;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#0d1b2a";
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // Brick seams
    ctx.strokeStyle = "rgba(13, 27, 42, 0.45)";
    ctx.lineWidth = 1;
    for (let i = 1; i < def.ability.widthTiles; i++) {
      const sx = -w / 2 + (w * i) / def.ability.widthTiles;
      ctx.beginPath();
      ctx.moveTo(sx, -h / 2);
      ctx.lineTo(sx, h / 2);
      ctx.stroke();
    }
    if (unit.hitFlash > 0) {
      const flashA = Math.min(
        1,
        unit.hitFlash / Math.max(0.0001, state.config.hitFlashDuration),
      );
      ctx.fillStyle = \`rgba(255, 255, 255, \${0.55 + flashA * 0.45})\`;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(unit.label, 0, 0);
    ctx.restore();

    if (deathProgress > 0) {
      const ringR = (w / 2) * (1 + deathProgress * 0.6);
      ctx.beginPath();
      ctx.ellipse(unit.x, unit.y, ringR, h * (1 + deathProgress), 0, 0, Math.PI * 2);
      ctx.strokeStyle = \`rgba(255, 255, 255, \${0.55 * (1 - deathProgress)})\`;
      ctx.lineWidth = 3 * (1 - deathProgress * 0.5);
      ctx.stroke();
    }

    if (deathProgress <= 0) {
      const barW = w * 0.9;
      const barH = 4;
      const bx = unit.x - barW / 2;
      const by = unit.y - h / 2 - 10;
      const pct = Math.max(0, unit.hp / unit.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = pct > 0.35 ? "#66bb6a" : "#ef5350";
      ctx.fillRect(bx, by, barW * pct, barH);
    }
    return;
  }

` + marker;
    if (!s.includes(marker)) throw new Error("drawUnit circle marker not found");
    s = s.replace(marker, wallBody);
  }

  // Deploy preview for wall
  if (!s.includes("Wall deploy preview")) {
    const oldPreview = `  const { arena } = state.config;
  const rPx = def.radius * state.config.tileSize;
  const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, rPx);
  const count = def.spawnCount ?? 1;

  ctx.save();
  ctx.globalAlpha = valid ? 0.72 : 0.35;
  for (let i = 0; i < count; i++) {
    const variant = def.spawnVariants?.[i];
    const offsetX = (variant?.offsetX ?? 0) * state.config.tileSize;
    const x = clamp(state.hover.x + offsetX, rPx, arena.width - rPx);
    const y = clamp(state.hover.y, rPx, arena.height - rPx);
    const r = rPx;
    const label = variant?.label ?? def.label;

    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = valid ? "#ffeb3b" : "#ef9a9a";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = valid ? "#2196f3" : "#ef9a9a".includes("ef") ? (valid ? "#2196f3" : "#e53935") : "#2196f3";
    ctx.fill();
    ctx.strokeStyle = "#0d1b2a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}`;
    // Use exact file content for replacement
    const exact = `  const { arena } = state.config;
  const rPx = def.radius * state.config.tileSize;
  const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, rPx);
  const count = def.spawnCount ?? 1;

  ctx.save();
  ctx.globalAlpha = valid ? 0.72 : 0.35;
  for (let i = 0; i < count; i++) {
    const variant = def.spawnVariants?.[i];
    const offsetX = (variant?.offsetX ?? 0) * state.config.tileSize;
    const x = clamp(state.hover.x + offsetX, rPx, arena.width - rPx);
    const y = clamp(state.hover.y, rPx, arena.height - rPx);
    const r = rPx;
    const label = variant?.label ?? def.label;

    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = valid ? "#ffeb3b" : "#ef9a9a";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = valid ? "#2196f3" : "#e53935";
    ctx.fill();
    ctx.strokeStyle = "#0d1b2a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}`;

    const neu = `  // Wall deploy preview — 3-tile barrier ghost
  if (def.ability?.kind === "wall") {
    const tile = state.config.tileSize;
    const w = def.ability.widthTiles * tile;
    const h = Math.max(def.radius * tile * 2, tile * 0.7);
    const margin = deployRadiusPx(state, state.selectedId!);
    const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, margin);
    const x = clamp(state.hover.x, margin, arena.width - margin);
    const y = clamp(state.hover.y, h / 2, arena.height - h / 2);
    ctx.save();
    ctx.globalAlpha = valid ? 0.72 : 0.35;
    ctx.fillStyle = valid ? "#2196f3" : "#e53935";
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = valid ? "#ffeb3b" : "#ef9a9a";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.label, x, y);
    ctx.restore();
    return;
  }

` + exact.replace(
      "const valid = isInOwnHalf(state, \"player\", state.hover.x, state.hover.y, rPx);",
      "const valid = isInOwnHalf(state, \"player\", state.hover.x, state.hover.y, deployRadiusPx(state, state.selectedId!));",
    );

    if (!s.includes(exact)) {
      // try to find a looser match
      const idx = s.indexOf("const rPx = def.radius * state.config.tileSize;");
      if (idx < 0) throw new Error("deploy preview rPx not found");
      console.log("exact preview block mismatch — inserting wall branch before rPx");
      s = s.replace(
        "  const { arena } = state.config;\n  const rPx = def.radius * state.config.tileSize;",
        `  const { arena } = state.config;

  // Wall deploy preview — 3-tile barrier ghost
  if (def.ability?.kind === "wall") {
    const tile = state.config.tileSize;
    const w = def.ability.widthTiles * tile;
    const h = Math.max(def.radius * tile * 2, tile * 0.7);
    const margin = deployRadiusPx(state, state.selectedId!);
    const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, margin);
    const x = clamp(state.hover.x, margin, arena.width - margin);
    const y = clamp(state.hover.y, h / 2, arena.height - h / 2);
    ctx.save();
    ctx.globalAlpha = valid ? 0.72 : 0.35;
    ctx.fillStyle = valid ? "#2196f3" : "#e53935";
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = valid ? "#ffeb3b" : "#ef9a9a";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.label, x, y);
    ctx.restore();
    return;
  }

  const rPx = def.radius * state.config.tileSize;`,
      );
      s = s.replace(
        'const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, rPx);',
        'const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, deployRadiusPx(state, state.selectedId!));',
      );
    } else {
      s = s.replace(exact, neu);
    }
  }

  write("src/ui/render.ts", s);
}

console.log("phase3 done");
