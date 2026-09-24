import type { MatchConfig } from "../config/types";

export interface Bridge {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RiverLayout {
  top: number;
  bottom: number;
  left: Bridge;
  right: Bridge;
}

export function riverLayout(config: MatchConfig): RiverLayout {
  const top = config.midlineY - config.riverHeight / 2;
  const bottom = config.midlineY + config.riverHeight / 2;
  const nudge = config.bridgeTowardCenter;
  const leftCenter = config.princessInsetX + config.princessWidth / 2 + nudge;
  const rightCenter =
    config.arena.width - config.princessInsetX - config.princessWidth / 2 - nudge;
  const bridge = (centerX: number): Bridge => ({
    x: centerX - config.bridgeWidth / 2,
    y: top,
    w: config.bridgeWidth,
    h: config.riverHeight,
  });
  return { top, bottom, left: bridge(leftCenter), right: bridge(rightCenter) };
}

export function bridges(layout: RiverLayout): Bridge[] {
  return [layout.left, layout.right];
}

export function bridgeAt(layout: RiverLayout, x: number, y: number): Bridge | null {
  if (y < layout.top || y > layout.bottom) return null;
  for (const bridge of bridges(layout)) {
    if (x >= bridge.x && x <= bridge.x + bridge.w) return bridge;
  }
  return null;
}

/** River tiles that are not part of a bridge. */
export function isWater(config: MatchConfig, x: number, y: number): boolean {
  const layout = riverLayout(config);
  if (y <= layout.top || y >= layout.bottom) return false;
  return bridgeAt(layout, x, y) === null;
}

export function nearestBridge(layout: RiverLayout, x: number): Bridge {
  const leftX = layout.left.x + layout.left.w / 2;
  const rightX = layout.right.x + layout.right.w / 2;
  return Math.abs(x - leftX) <= Math.abs(x - rightX) ? layout.left : layout.right;
}

/**
 * Point to walk toward. Same side of the river is a straight line.
 * The other side is reached by the nearest bridge.
 */
export function crossingWaypoint(
  config: MatchConfig,
  x: number,
  y: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const layout = riverLayout(config);
  const inRiver = y > layout.top && y < layout.bottom;
  const targetNorth = ty <= layout.top;
  const targetSouth = ty >= layout.bottom;
  const hereNorth = y <= layout.top;
  const hereSouth = y >= layout.bottom;
  const sameSide = (hereNorth && targetNorth) || (hereSouth && targetSouth);

  if (!inRiver && sameSide) return { x: tx, y: ty };

  const bridge = bridgeAt(layout, x, y) ?? nearestBridge(layout, x);
  const cx = bridge.x + bridge.w / 2;
  const goingNorth = ty < y;

  if (inRiver) {
    const exitY = goingNorth ? layout.top - 1 : layout.bottom + 1;
    return { x: cx, y: exitY };
  }

  const entryY = hereNorth ? layout.top - 1 : layout.bottom + 1;
  if (Math.abs(x - cx) < 6) {
    return { x: cx, y: goingNorth ? layout.bottom - 4 : layout.top + 4 };
  }
  return { x: cx, y: entryY };
}

/** Keep a step off the water. Slide along the bank toward a bridge. */
export function stayOnLand(
  config: MatchConfig,
  x: number,
  y: number,
  nx: number,
  ny: number,
): { x: number; y: number } {
  if (!isWater(config, nx, ny)) return { x: nx, y: ny };
  if (!isWater(config, nx, y)) return { x: nx, y };
  if (!isWater(config, x, ny)) return { x, y: ny };
  return { x, y };
}

export function ownHalfY(
  config: MatchConfig,
  side: "player" | "ai",
  radius: number,
): { minY: number; maxY: number } {
  const layout = riverLayout(config);
  if (side === "player") {
    return {
      minY: layout.bottom + radius,
      maxY: config.arena.height - radius,
    };
  }
  return {
    minY: radius,
    maxY: layout.top - radius,
  };
}
