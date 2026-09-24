/**
 * Fix spells.ts imports, midline clamp, castPen; wire intents/hud/ai; smoke.
 */
const fs = require("fs");
const path = require("path");

function read(rel) {
  const p = path.join(__dirname, "..", rel);
  let b = fs.readFileSync(p);
  if (b[1] === 0) b = Buffer.from(b.toString("utf16le").replace(/^\uFEFF/, ""), "utf8");
  return b.toString("utf8");
}
function write(rel, s) {
  fs.writeFileSync(path.join(__dirname, "..", rel), s, "utf8");
  console.log("wrote", rel);
}

// Rebuild spells.ts cleanly from current logic
{
  let s = read("src/systems/spells.ts");
  // Strip trailing bad imports + castPen; we'll rewrite them
  const cut = s.indexOf("\nimport { applyGoalDamage }");
  if (cut >= 0) s = s.slice(0, cut).trimEnd() + "\n";

  // Replace clamp function body
  const oldClamp = `export function clampPushToMidline(
  state: GameState,
  foe: Side,
  fromY: number,
  proposedY: number,
): number {
  const mid = state.config.midlineY;
  if (foe === "ai") {
    // AI is pushed upward (smaller y); stop at midline.
    return Math.max(proposedY, mid);
  }
  // Player is pushed downward (larger y); stop at midline.
  return Math.min(proposedY, mid);
}`;
  const neuClamp = `export function clampPushToMidline(
  state: GameState,
  foe: Side,
  fromY: number,
  proposedY: number,
): number {
  const mid = state.config.midlineY;
  if (foe === "ai") {
    // Already on their half — HighLine does not shove deeper.
    if (fromY <= mid) return fromY;
    // Invaders in player half: push up, stop at half line.
    return Math.max(proposedY, mid);
  }
  if (fromY >= mid) return fromY;
  return Math.min(proposedY, mid);
}`;
  if (!s.includes(oldClamp)) throw new Error("clamp block missing");
  s = s.replace(oldClamp, neuClamp);

  // Fix header imports
  s = s.replace(
    `import type { GameState, Side, Unit } from "../config/types";
import { getSpellDef } from "../config/cards";
import { isWater, riverLayout } from "./lanes";`,
    `import type { GameState, Side, Unit } from "../config/types";
import { getSpellDef } from "../config/cards";
import { createProjectile } from "../entities/factory";
import { applyGoalDamage } from "./damage";
import { goalCenter } from "./geometry";
import { kingGoal } from "./goals";
import { isWater, riverLayout } from "./lanes";`,
  );

  s += `
/**
 * Penalty shot: guaranteed -1 HP on the enemy King tower, with a ball FX.
 */
export function castPen(
  state: GameState,
  caster: Side,
  fromX: number,
  fromY: number,
): void {
  const spell = getSpellDef("pen");
  const delta = spell.towerHpDelta ?? 1;
  const foe = enemyOf(caster);
  const king = kingGoal(state, foe);
  if (!king || king.hp <= 0) return;

  // Guaranteed damage — not missable.
  applyGoalDamage(state, king.id, delta);

  // Visual: empowered ball flies from cast point to the king.
  const shot = createProjectile(state, {
    side: caster,
    x: fromX,
    y: fromY,
    target: { kind: "goal", goalId: king.id },
    damage: 0,
    goalHpDelta: 0, // already applied
    empowered: true,
  });
  shot.speed = state.config.projectileSpeed * 1.6;
  state.projectiles.push(shot);
  void goalCenter; // keep import used if tree-shaken oddly — actually use for aim check
  const c = goalCenter(king);
  // Start slightly off the king so the projectile travels visibly.
  if (Math.hypot(c.x - fromX, c.y - fromY) < 8) {
    shot.y = fromY + (caster === "player" ? -40 : 40);
  }
}
`;

  // Clean the void goalCenter hack - rewrite castPen more cleanly
  s = s.replace(
    /\/\*\*\n \* Penalty shot:[\s\S]*$/,
    `/**
 * Penalty shot: guaranteed -1 HP on the enemy King tower, with a ball FX.
 */
export function castPen(
  state: GameState,
  caster: Side,
  fromX: number,
  fromY: number,
): void {
  const spell = getSpellDef("pen");
  const delta = spell.towerHpDelta ?? 1;
  const foe = enemyOf(caster);
  const king = kingGoal(state, foe);
  if (!king || king.hp <= 0) return;

  applyGoalDamage(state, king.id, delta);

  const c = goalCenter(king);
  let sx = fromX;
  let sy = fromY;
  if (Math.hypot(c.x - sx, c.y - sy) < 8) {
    sy = fromY + (caster === "player" ? -48 : 48);
  }
  const shot = createProjectile(state, {
    side: caster,
    x: sx,
    y: sy,
    target: { kind: "goal", goalId: king.id },
    damage: 0,
    goalHpDelta: 0,
    empowered: true,
  });
  shot.speed = state.config.projectileSpeed * 1.6;
  state.projectiles.push(shot);
}
`,
  );

  write("src/systems/spells.ts", s);
}

// Wire intents
{
  let s = read("src/systems/intents.ts");
  s = s.replace(
    'import { castHighLine } from "./spells";',
    'import { castHighLine, castPen } from "./spells";',
  );
  if (!s.includes('def.spell === "pen"')) {
    s = s.replace(
      `      if (def.spell === "highline") {
        castHighLine(state, intent.side);
      }`,
      `      if (def.spell === "highline") {
        castHighLine(state, intent.side);
      } else if (def.spell === "pen") {
        castPen(state, intent.side, intent.x, intent.y);
      }`,
    );
  }
  write("src/systems/intents.ts", s);
}

// HUD spell stats
{
  let s = read("src/ui/hud.ts");
  const old = `        <span class="card-stats">SPELL · Push \${def.pushTiles} tiles</span>`;
  const neu = `        <span class="card-stats">\${
          def.spell === "highline"
            ? \`SPELL · Push to half\`
            : def.spell === "pen"
              ? \`SPELL · King -1\`
              : "SPELL"
        }</span>`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
  } else if (!s.includes("King -1")) {
    // try without escape
    const alt = s.match(/card-stats">SPELL · Push[^<]+/);
    console.log("hud match", alt && alt[0]);
    s = s.replace(
      /<span class="card-stats">SPELL · Push \$\{def\.pushTiles\} tiles<\/span>/,
      neu.replace(/\\\$/g, "$").replace(/\\`/g, "`").replace(/\\\{/g, "{").replace(/\\\}/g, "}"),
    );
  }
  // Simpler approach:
  s = read("src/ui/hud.ts");
  if (!s.includes("King -1")) {
    s = s.replace(
      `<span class="card-stats">SPELL · Push \${def.pushTiles} tiles</span>`,
      `<span class="card-stats">\${
          def.spell === "pen"
            ? "SPELL · King −1"
            : def.spell === "highline"
              ? "SPELL · To half line"
              : "SPELL"
        }</span>`,
    );
    write("src/ui/hud.ts", s);
  } else {
    console.log("hud already updated");
  }
}

// AI: Pen is always useful; HighLine only with invaders past half
{
  let s = read("src/systems/ai.ts");
  // Update highline filter - keep as enemies > 0 for now, or refine
  if (!s.includes('def.spell === "pen"')) {
    // no special filter needed — pen works anytime
  }
  write("src/systems/ai.ts", s);
}

console.log("phase2 done");
