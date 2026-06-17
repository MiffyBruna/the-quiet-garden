/**
 * Chapter 1 map generation — The Valley That Forgot the Rain.
 *
 * A 32×32 grid. North is elevated; south is valley floor.
 * Starting state: mostly cracked/dry soil, a few rocks, sparse dead grass.
 */
import { MAP_W, MAP_H, Tile, TerrainType } from './types';

// ---------------------------------------------------------------------------
// Seeded pseudo-random (deterministic map each time)
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 0xffffffff);
  };
}

// ---------------------------------------------------------------------------
// Map generation
// ---------------------------------------------------------------------------

export function generateChapter1Map(): Tile[][] {
  const rng = seededRandom(42);
  const tiles: Tile[][] = [];

  for (let y = 0; y < MAP_H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_W; x++) {
      // Elevation: north (y=0) is highest, south (y=31) lowest
      // Add gentle east-west gradient to create drainage channels
      const northSouth = 1 - y / MAP_H;           // 1 at north, 0 at south
      const wave = Math.sin(x * 0.4) * 0.08;       // gentle undulation
      const elevation = Math.max(0, Math.min(10, (northSouth * 8 + wave * 8 + rng() * 0.5)));

      // Terrain selection
      const r = rng();
      let terrain: TerrainType;

      // Border rocks
      if (x === 0 || x === MAP_W - 1 || y === 0 || y === MAP_H - 1) {
        terrain = 'rock';
      } else if (isRockCluster(x, y)) {
        terrain = 'rock';
      } else if (r < 0.70) {
        terrain = 'cracked_soil';
      } else if (r < 0.90) {
        terrain = 'dry_soil';
      } else {
        // Sparse dead grass patches (will look like dry_soil initially)
        terrain = 'dry_soil';
      }

      // Starting moisture/fertility/erosion for damaged valley
      const baseMoisture = 4 + rng() * 8;          // 4–12%
      const baseFertility = 8 + rng() * 8;         // 8–16%
      const baseErosion = 72 + rng() * 20;         // 72–92%

      row.push({
        terrain,
        moisture: baseMoisture,
        fertility: baseFertility,
        erosion: baseErosion,
        elevation,
        water: 0,
        isModified: false,
      });
    }
    tiles.push(row);
  }

  // Place a few landmark rock formations (3-tile groups)
  placeRockGroup(tiles, 5, 5);
  placeRockGroup(tiles, 25, 8);
  placeRockGroup(tiles, 8, 20);
  placeRockGroup(tiles, 22, 24);
  placeRockGroup(tiles, 14, 10);

  return tiles;
}

// Rock clusters at fixed positions for visual interest
const ROCK_POSITIONS: Array<[number, number]> = [
  [4, 4], [5, 4], [4, 5],
  [26, 7], [27, 7], [26, 8],
  [7, 21], [8, 21],
  [21, 25], [22, 25], [22, 24],
  [13, 9], [14, 9],
  [18, 5], [19, 5],
  [28, 18], [29, 18],
  [2, 14], [2, 15],
];

function isRockCluster(x: number, y: number): boolean {
  return ROCK_POSITIONS.some(([rx, ry]) => rx === x && ry === y);
}

function placeRockGroup(tiles: Tile[][], cx: number, cy: number): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      if (tx <= 0 || tx >= MAP_W - 1 || ty <= 0 || ty >= MAP_H - 1) continue;
      const row = tiles[ty];
      if (!row) continue;
      const tile = row[tx];
      if (!tile) continue;
      if (Math.abs(dx) + Math.abs(dy) <= 1) {
        tile.terrain = 'rock';
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Starting positions
// ---------------------------------------------------------------------------

export const PLAYER_START_TX = 15;
export const PLAYER_START_TY = 22;
export const MOSS_START_TX = 18;
export const MOSS_START_TY = 21;

// Objective highlight tiles for quest steps
export const INSPECT_HIGHLIGHTS: Array<{ x: number; y: number }> = [
  { x: 13, y: 20 },
  { x: 15, y: 18 },
  { x: 17, y: 22 },
];

export const BUND_HIGHLIGHT: Array<{ x: number; y: number }> = [
  { x: 14, y: 16 },
  { x: 15, y: 16 },
  { x: 16, y: 16 },
];

export const SEED_HIGHLIGHT: Array<{ x: number; y: number }> = [
  { x: 14, y: 17 },
  { x: 15, y: 18 },
];
