const fs = require("fs");

let s = fs.readFileSync("src/systems/spells.ts", "utf8");
if (s.charCodeAt(1) === 0) {
  s = Buffer.from(s, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
}

const m = s.match(/export function clampPushToMidline\([\s\S]*?\n\}/);
if (!m) throw new Error("clampPushToMidline not found");

const neu = `export function clampPushToMidline(
  state: GameState,
  foe: Side,
  fromY: number,
  proposedY: number,
  radius = 18,
): number {
  // Stop on the foe's river bank (their half), not the geometric midline
  // through the water — otherwise safeLandPos nudges them back into your half.
  const layout = riverLayout(state.config);
  if (foe === "ai") {
    const stopY = layout.top - radius;
    if (fromY <= stopY) return fromY;
    return Math.max(proposedY, stopY);
  }
  const stopY = layout.bottom + radius;
  if (fromY >= stopY) return fromY;
  return Math.min(proposedY, stopY);
}`;

s = s.replace(m[0], neu);

// Empty FX: keep line on midline (visual only) — already mid/mid, fine.

// Ensure riverLayout is imported (not only isWater)
if (!s.includes("riverLayout")) {
  s = s.replace(
    'import { isWater, riverLayout } from "./lanes";',
    'import { isWater, riverLayout } from "./lanes";',
  );
}
if (!/import \{[^}]*riverLayout/.test(s)) {
  s = s.replace(
    /import \{([^}]+)\} from "\.\/lanes";/,
    (full, inner) => {
      if (inner.includes("riverLayout")) return full;
      return `import { ${inner.trim().replace(/,$/, "")}, riverLayout } from "./lanes";`;
    },
  );
}

fs.writeFileSync("src/systems/spells.ts", s, "utf8");
console.log("clamp updated");
console.log(s.match(/export function clampPushToMidline\([\s\S]*?\n\}/)?.[0]);
