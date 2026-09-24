const fs = require("fs");

let s = fs.readFileSync("src/systems/spells.ts", "utf8");
if (s.charCodeAt(1) === 0) {
  s = Buffer.from(s, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
}

// Add directed land helper after safeLandPos
if (!s.includes("landAfterHighLinePush")) {
  const safeFn = s.match(/export function safeLandPos\([\s\S]*?\n\}/);
  if (!safeFn) throw new Error("safeLandPos missing");
  const helper = `

/** Prefer the river bank in the shove direction so HighLine doesn't bounce back. */
function landAfterHighLinePush(
  state: GameState,
  x: number,
  y: number,
  radius: number,
  sign: number,
): { x: number; y: number } {
  const { arena } = state.config;
  let nx = clamp(x, radius, arena.width - radius);
  let ny = clamp(y, radius, arena.height - radius);
  if (!isWater(state.config, nx, ny)) return { x: nx, y: ny };

  const layout = riverLayout(state.config);
  // sign < 0 → shove upward (AI backline) → north bank; else south bank.
  ny = sign < 0 ? layout.top - radius : layout.bottom + radius;
  ny = clamp(ny, radius, arena.height - radius);
  return { x: nx, y: ny };
}
`;
  s = s.replace(safeFn[0], safeFn[0] + helper);
}

// Use it in castHighLine pushes
const oldPush = `  const pushes = enemies.map((unit) => {
    const radius = 18;
    const rawY = clampPushToMidline(
      state,
      foe,
      unit.y,
      unit.y + sign * dist,
    );
    const target = safeLandPos(state, unit.x, rawY, radius);
    return {
      unitId: unit.id,
      fromX: unit.x,
      fromY: unit.y,
      toX: target.x,
      toY: target.y,
    };
  });`;

const neuPush = `  const pushes = enemies.map((unit) => {
    const radius = 18;
    const rawY = clampPushToMidline(
      state,
      foe,
      unit.y,
      unit.y + sign * dist,
      radius,
    );
    const target = landAfterHighLinePush(state, unit.x, rawY, radius, sign);
    return {
      unitId: unit.id,
      fromX: unit.x,
      fromY: unit.y,
      toX: target.x,
      toY: target.y,
    };
  });`;

if (!s.includes(oldPush)) {
  console.log("push block not exact — trying flexible replace");
  if (!s.includes("landAfterHighLinePush(state,")) {
    s = s.replace(
      /const target = safeLandPos\(state, unit\.x, rawY, radius\);/,
      "const target = landAfterHighLinePush(state, unit.x, rawY, radius, sign);",
    );
  }
} else {
  s = s.replace(oldPush, neuPush);
}

fs.writeFileSync("src/systems/spells.ts", s, "utf8");
console.log("landAfterHighLinePush wired");
