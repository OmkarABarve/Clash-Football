/**
 * Clash-style pitch grid: 18 wide × 32 long.
 * All layout / card distances are authored in tiles, then converted to px
 * via TILE_SIZE (change only that constant to rescale the arena).
 */
export const GRID_COLS = 18;
export const GRID_ROWS = 32;

/** Pixels per tile. 32 → 576×1024 arena (9:16 portrait). */
export const TILE_SIZE = 32;

export const ARENA_WIDTH = GRID_COLS * TILE_SIZE; // 576
export const ARENA_HEIGHT = GRID_ROWS * TILE_SIZE; // 1024

/**
 * Layout in tiles (1-indexed columns/rows as in the design doc).
 * Converted to 0-based world px below.
 */
export const LAYOUT_TILES = {
  /** Halfway line sits between rows 16 and 17. */
  halfwayAfterRow: 16,
  /** Center circle radius (tiles). */
  centerCircleRadius: 3,
  /** King / main goal: 4 tiles wide, centered (cols 8–11). */
  kingGoal: { col: 8, width: 4, depth: 1.25 },
  /** Princess towers: ~2.25 tiles wide, inset from each side. */
  princessGoal: { width: 2.25, depth: 1, insetX: 0.75, insetY: 3.5 },
  /** King sits behind princesses. */
  kingInsetY: 0.5,
  /** Penalty box: 10 wide × 5 deep, centered on each end. */
  penalty: { width: 10, depth: 5 },
  /** River band straddling the halfway line. */
  riverHeight: 2,
  /** Bridge width and inward nudge from princess centers. */
  bridgeWidth: 3,
  bridgeTowardCenter: 1.5,
} as const;

export function tilesToPx(tiles: number, tileSize: number = TILE_SIZE): number {
  return tiles * tileSize;
}

export function pxToTiles(px: number, tileSize: number = TILE_SIZE): number {
  return px / tileSize;
}

/** 1-indexed column → left edge x in px. */
export function colToX(col1: number, tileSize: number = TILE_SIZE): number {
  return (col1 - 1) * tileSize;
}

/** 1-indexed row → top edge y in px. */
export function rowToY(row1: number, tileSize: number = TILE_SIZE): number {
  return (row1 - 1) * tileSize;
}

/** World y of the halfway line (between rows 16 and 17). */
export function halfwayY(tileSize: number = TILE_SIZE): number {
  return LAYOUT_TILES.halfwayAfterRow * tileSize;
}

export interface PitchLayoutPx {
  tileSize: number;
  cols: number;
  rows: number;
  arena: { width: number; height: number };
  midlineY: number;
  riverHeight: number;
  bridgeWidth: number;
  bridgeTowardCenter: number;
  princessWidth: number;
  princessHeight: number;
  kingWidth: number;
  kingHeight: number;
  princessInsetX: number;
  princessInsetY: number;
  kingInset: number;
  centerCircleRadius: number;
  penalty: { width: number; depth: number };
}

/** Derive all pitch geometry in world pixels from the tile layout. */
export function buildPitchLayout(tileSize: number = TILE_SIZE): PitchLayoutPx {
  const L = LAYOUT_TILES;
  return {
    tileSize,
    cols: GRID_COLS,
    rows: GRID_ROWS,
    arena: {
      width: GRID_COLS * tileSize,
      height: GRID_ROWS * tileSize,
    },
    midlineY: halfwayY(tileSize),
    riverHeight: tilesToPx(L.riverHeight, tileSize),
    bridgeWidth: tilesToPx(L.bridgeWidth, tileSize),
    bridgeTowardCenter: tilesToPx(L.bridgeTowardCenter, tileSize),
    princessWidth: tilesToPx(L.princessGoal.width, tileSize),
    princessHeight: tilesToPx(L.princessGoal.depth, tileSize),
    kingWidth: tilesToPx(L.kingGoal.width, tileSize),
    kingHeight: tilesToPx(L.kingGoal.depth, tileSize),
    princessInsetX: tilesToPx(L.princessGoal.insetX, tileSize),
    princessInsetY: tilesToPx(L.princessGoal.insetY, tileSize),
    kingInset: tilesToPx(L.kingInsetY, tileSize),
    centerCircleRadius: tilesToPx(L.centerCircleRadius, tileSize),
    penalty: {
      width: tilesToPx(L.penalty.width, tileSize),
      depth: tilesToPx(L.penalty.depth, tileSize),
    },
  };
}
