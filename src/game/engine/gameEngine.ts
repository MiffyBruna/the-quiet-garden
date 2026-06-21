/**
 * Game engine: state creation, update loop, tool actions, water/plant/wildlife simulation.
 */
import {
  MAP_W, MAP_H, TILE_SIZE,
  GameState, Tile, TerrainType, PlantType, PlantStage, PlantState, FairyType,
  WildlifeEntity, FairyEntity, QuestStep, DialogueLine,
} from './types';
import { PLANTS } from '../journalData';
import { ZONES } from '../gardenData';
import {
  generateChapter1Map,
  PLAYER_START_TX, PLAYER_START_TY,
  MOSS_START_TX, MOSS_START_TY,
  INSPECT_HIGHLIGHTS,
  generateChapter2Map,
  CHAPTER2_PLAYER_START_TX, CHAPTER2_PLAYER_START_TY,
  CHAPTER2_CLOVER_START_TX, CHAPTER2_CLOVER_START_TY,
  CHAPTER2_INSPECT_HIGHLIGHTS,
  MESQUITE_OFFSETS,
} from './mapGen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTile(tiles: Tile[][], x: number, y: number): Tile | undefined {
  return tiles[y]?.[x];
}

export function getMissingPlants(gs: GameState): string[] {
  const plantedTypes = new Set<string>();
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = getTile(gs.tiles, x, y);
      if (tile?.plant) {
        plantedTypes.add(tile.plant.type);
      }
    }
  }

  const allPlantIds = PLANTS.map(p => p.id);
  const missing = allPlantIds.filter(id => !plantedTypes.has(id));
  return missing;
}

export function getMissingWildlife(gs: GameState): string[] {
  const discoveredSet = new Set(gs.discoveredWildlife);
  // Only check Chapter 1 wildlife (not future Chapter 2 creatures)
  const chapter1Wildlife = ['ant', 'beetle', 'bee', 'hoverfly', 'painted_lady', 'monarch', 'cottontail', 'frog', 'dragonfly', 'quail', 'finch', 'hawk', 'swallow'];
  const missing = chapter1Wildlife.filter(type => !discoveredSet.has(type));
  return missing;
}

export function setTile(tiles: Tile[][], x: number, y: number, patch: Partial<Tile>): void {
  const row = tiles[y];
  if (!row) return;
  const tile = row[x];
  if (!tile) return;
  Object.assign(tile, patch);
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
}

let _eid = 0;
function nextId(): string { return `e${++_eid}`; }

// ---------------------------------------------------------------------------
// Ecological moisture helpers
// ---------------------------------------------------------------------------

/**
 * Returns the minimum moisture floor.
 * At 0% restoration with no bunds, soil dries completely.
 * As bunds and restoration grow, the floor rises to retain water.
 */
export function getMinimumMoisture(restoration: number, workingBundCount = 0): number {
  if (workingBundCount < 1) return 0;  // No retention at start
  if (workingBundCount < 5) return Math.min(20, 6 + restoration * 0.4);
  if (restoration < 30) return 6;
  if (restoration < 90) return 20;
  return 30;
}

/**
 * Returns a drying-speed multiplier based on restoration %.
 * Degraded soil dries aggressively; well-restored soil retains water well.
 */
export function getDryingMultiplier(restoration: number): number {
  if (restoration < 10) return 3.50;
  if (restoration < 20) return 3.20;
  if (restoration < 30) return 2.80;
  if (restoration < 40) return 2.40;
  if (restoration < 50) return 1.90;
  if (restoration < 60) return 1.40;
  if (restoration < 70) return 0.95;
  if (restoration < 80) return 0.55;
  if (restoration < 90) return 0.28;
  if (restoration < 100) return 0.12;
  return 0.05;
}

/** Rain cooldown scales with restoration. Early game: precious rain with long cooldown; late game: quick succession. */
export function getRainCooldown(restoration: number): number {
  // Cooldown in milliseconds
  if (restoration < 1) return 45000;   // 45s: Starting out
  if (restoration < 10) return 40000;  // 40s
  if (restoration < 20) return 35000;  // 35s
  if (restoration < 30) return 30000;  // 30s
  if (restoration < 40) return 25000;  // 25s
  if (restoration < 50) return 20000;  // 20s
  if (restoration < 60) return 15000;  // 15s
  if (restoration < 70) return 12000;  // 12s
  if (restoration < 80) return 10000;  // 10s
  if (restoration < 90) return 8000;   // 8s
  return 6000;                         // 6s: Final push to 100%
}

/** Working bunds reduce drying. 0 bunds = faster drying; 10+ bunds = strong retention. */
function getBundRetentionModifier(workingBundCount: number): number {
  if (workingBundCount <= 0) return 1.30;
  if (workingBundCount === 1) return 1.15;
  if (workingBundCount <= 4) return 1.00;
  if (workingBundCount <= 7) return 0.85;
  if (workingBundCount <= 10) return 0.70;
  return 0.60;
}

/** Plants slow drying — only established ones (mature/blooming) help meaningfully. */
function getPlantRetentionModifier(plant: import('./types').PlantState | undefined): number {
  if (!plant) return 1.00;
  switch (plant.stage) {
    case 0: return 1.00; // seed — no help yet
    case 1: return 0.97; // sprout
    case 2: return 0.92; // young
    case 3: return 0.85; // mature
    case 4: return 0.80; // blooming
    default: return 1.00;
  }
}

/** Nearby mature plant clusters further reduce drying (root network effect). */
function getNearbyPlantModifier(tiles: Tile[][], x: number, y: number): number {
  let maturePlants = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = getTile(tiles, x + dx, y + dy);
      if (t?.plant && t.plant.stage >= 3) maturePlants++;
    }
  }
  if (maturePlants >= 5) return 0.80;
  if (maturePlants >= 3) return 0.90;
  if (maturePlants >= 1) return 0.96;
  return 1.00;
}

/** Mulch strongly reduces evaporation. */
function getMulchModifier(terrain: import('./types').TerrainType): number {
  return terrain === 'mulch' ? 0.75 : 1.00;
}

/** Plant growth speed depends on tile moisture. Dry plants grow slowly; moist plants grow faster. */
function getGrowthSpeedMultiplier(tileMoisture: number): number {
  if (tileMoisture < 20) return 0.6;    // Water stress dominates — very slow
  if (tileMoisture < 30) return 1.0;    // Minimum threshold
  if (tileMoisture < 60) return 1.3;    // Optimal range
  if (tileMoisture < 80) return 1.25;   // Good
  return 1.15;                          // Slight saturation penalty
}

/** Count bund tiles currently holding moisture ≥ 25 (proxy for "bunds that have caught water"). */
function countWorkingBunds(gs: GameState): number {
  let count = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = getTile(gs.tiles, x, y);
      if (t?.terrain === 'bund' && t.moisture >= 25) count++;
    }
  }
  return count;
}

/** Localized moisture retention based on proximity to bunds, mulch, and mature plants. */
function getLocalMoistureRetention(tiles: Tile[][], x: number, y: number, restoration: number): number {
  if (restoration >= 70) return 1.0; // At high restoration, global moisture floor is sufficient

  // Count support infrastructure within 3-tile radius
  let supportCount = 0;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const tile = getTile(tiles, x + dx, y + dy);
      if (!tile) continue;

      // Count bunds, mulch, and mature plants
      if (tile.terrain === 'bund' && tile.moisture >= 25) supportCount++;
      else if (tile.terrain === 'mulch') supportCount++;
      else if (tile.plant && tile.plant.stage >= 3) supportCount++;
    }
  }

  // Graduated retention bonus: more support = slower drying
  // 0 support: 1.0× (normal drying)
  // 1-2 support: 0.95× (5% less drying)
  // 3+ support: 0.90× (10% less drying)
  if (supportCount >= 3) return 0.90;
  if (supportCount >= 1) return 0.95;
  return 1.0;
}

/**
 * Returns the maximum moisture ordinary soil can reach.
 * Degraded land cannot become saturated — cap rises as roots, mulch, and organic matter improve.
 * Bunds and permanent water tiles are exempt (they are designed to hold water).
 */
function getMoistureCap(restoration: number): number {
  if (restoration < 20) return 55;
  if (restoration < 40) return 70;
  if (restoration < 60) return 85;
  if (restoration < 70) return 95;
  return 100;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialGameState(): GameState {
  const tiles = generateChapter1Map();
  return {
    chapter: 'dryland',
    tiles,

    playerTX: PLAYER_START_TX,
    playerTY: PLAYER_START_TY,
    playerPX: PLAYER_START_TX * TILE_SIZE,
    playerPY: PLAYER_START_TY * TILE_SIZE,
    playerDestTX: PLAYER_START_TX,
    playerDestTY: PLAYER_START_TY,
    playerFacing: 's',

    entities: [],
    fairies: [],
    fairySpawnCooldown: 0,

    mossTX: MOSS_START_TX,
    mossTY: MOSS_START_TY,

    isRaining: false,
    rainTimer: 0,
    rainDrops: [],
    lastRestorationBeforeRain: 0,

    tick: 0,
    lastPhysicsTick: 0,
    lastGrowthTick: 0,

    questStep: 'intro',
    inspectedCount: 0,
    bundPlaced: false,
    rainsCount: 0,

    chapter2EarlyFlowerPlanted: false,
    chapter2MidFlowerPlanted: false,
    chapter2LateFlowerPlanted: false,
    chapter2ClustersFound: 0,
    chapter2HummingbirdSeen: false,

    highlightTiles: [],

    discoveredWildlife: [],
    discoveredFairies: [],
    discoveredPlants: [],
    discoveredGuideNotes: [],

    bundCenterTX: 15,
    bundCenterTY: 15,
    seedSpots: [],
    firstBundActivated: false,
    restorationMilestonesSeen: [],
    completionTriggered: false,
    workingBundCount: 0,
    firstWiltSeen: false,
    grassSpreadingStarted: false,
    bundRemovalPenalty: 0,
    maxRestorationAchieved: 0,
    cinematicCam: null,
    introAnimationState: null,
    introAnimationCompleted: false,
    playerPath: [],
  };
}

export function createChapter2InitialState(): GameState {
  const tiles = generateChapter2Map();
  return {
    chapter: 'meadow',
    tiles,

    playerTX: CHAPTER2_PLAYER_START_TX,
    playerTY: CHAPTER2_PLAYER_START_TY,
    playerPX: CHAPTER2_PLAYER_START_TX * TILE_SIZE,
    playerPY: CHAPTER2_PLAYER_START_TY * TILE_SIZE,
    playerDestTX: CHAPTER2_PLAYER_START_TX,
    playerDestTY: CHAPTER2_PLAYER_START_TY,
    playerFacing: 's',

    entities: [],
    fairies: [],
    fairySpawnCooldown: 0,

    mossTX: CHAPTER2_CLOVER_START_TX,
    mossTY: CHAPTER2_CLOVER_START_TY,

    isRaining: false,
    rainTimer: 0,
    rainDrops: [],
    lastRestorationBeforeRain: 0,

    tick: 0,
    lastPhysicsTick: 0,
    lastGrowthTick: 0,

    questStep: 'intro',
    inspectedCount: 0,
    bundPlaced: false,
    rainsCount: 0,

    chapter2EarlyFlowerPlanted: false,
    chapter2MidFlowerPlanted: false,
    chapter2LateFlowerPlanted: false,
    chapter2ClustersFound: 0,
    chapter2HummingbirdSeen: false,

    highlightTiles: [],

    discoveredWildlife: [],
    discoveredFairies: [],
    discoveredPlants: [],
    discoveredGuideNotes: [],

    bundCenterTX: 15,
    bundCenterTY: 15,
    seedSpots: [],
    firstBundActivated: false,
    restorationMilestonesSeen: [],
    completionTriggered: false,
    workingBundCount: 0,
    firstWiltSeen: false,
    grassSpreadingStarted: false,
    bundRemovalPenalty: 0,
    maxRestorationAchieved: 0,
    cinematicCam: null,
    introAnimationState: null,
    introAnimationCompleted: false,
    playerPath: [],
  };
}

// ---------------------------------------------------------------------------
// Flower Cluster Detection (Chapter 2)
// ---------------------------------------------------------------------------

interface FlowerCluster {
  tiles: Array<{ x: number; y: number }>;
  hasEarlyBloom: boolean;
  hasMidBloom: boolean;
  hasLateBloom: boolean;
  isValid: boolean;
}

const EARLY_BLOOMS = ['camas', 'violet'];
const MID_BLOOMS = ['yarrow', 'bee_balm'];
const LATE_BLOOMS = ['goldenrod', 'aster'];

export function getFlowerClusters(tiles: Tile[][]): FlowerCluster[] {
  const clusters: FlowerCluster[] = [];
  const visited = new Set<string>();

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const key = `${x},${y}`;
      if (visited.has(key)) continue;

      const tile = getTile(tiles, x, y);
      if (!tile?.plant) continue;

      // Start a new cluster from this flower
      const clusterTiles = floodFillFlowers(tiles, x, y, visited);
      if (clusterTiles.length >= 3) {
        // Valid cluster has 3+ flowers
        let hasEarlyBloom = false;
        let hasMidBloom = false;
        let hasLateBloom = false;

        for (const { x: cx, y: cy } of clusterTiles) {
          const t = getTile(tiles, cx, cy);
          if (t?.plant) {
            const type = t.plant.type;
            if (EARLY_BLOOMS.includes(type)) hasEarlyBloom = true;
            if (MID_BLOOMS.includes(type)) hasMidBloom = true;
            if (LATE_BLOOMS.includes(type)) hasLateBloom = true;
          }
        }

        clusters.push({
          tiles: clusterTiles,
          hasEarlyBloom,
          hasMidBloom,
          hasLateBloom,
          isValid: hasEarlyBloom && hasMidBloom && hasLateBloom,
        });
      }
    }
  }

  return clusters;
}

function floodFillFlowers(tiles: Tile[][], startX: number, startY: number, visited: Set<string>): Array<{ x: number; y: number }> {
  const cluster: Array<{ x: number; y: number }> = [];
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    const tile = getTile(tiles, x, y);
    if (!tile?.plant) continue;

    // Only include meadow flowers
    if (![...EARLY_BLOOMS, ...MID_BLOOMS, ...LATE_BLOOMS].includes(tile.plant.type)) continue;

    cluster.push({ x, y });

    // Add neighbors (4-directional)
    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];

    for (const { x: nx, y: ny } of neighbors) {
      const nkey = `${nx},${ny}`;
      if (!visited.has(nkey) && inBounds(nx, ny)) {
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return cluster;
}

/**
 * Check Chapter 2 quest progression and return the next quest step if applicable.
 * Returns null if no progression should happen.
 */
export function checkChapter2QuestProgression(gs: GameState): QuestStep | null {
  const currentStep = gs.questStep;

  // Move from intro to listen_quiet once the opening dialogue completes
  // This will be triggered by GameScene when the CLOVER_OPENING_DIALOGUE finishes
  // (handled in GameScene when dialogue queue is empty after intro)

  // listen_quiet -> early_flowers: when player plants first early bloom flower
  if (currentStep === 'listen_quiet' && gs.chapter2EarlyFlowerPlanted) {
    return 'early_flowers';
  }

  // early_flowers -> mid_flowers: when player plants first mid-season flower
  if (currentStep === 'early_flowers' && gs.chapter2MidFlowerPlanted) {
    return 'mid_flowers';
  }

  // mid_flowers -> late_flowers: when player plants first late-season flower
  if (currentStep === 'mid_flowers' && gs.chapter2LateFlowerPlanted) {
    return 'late_flowers';
  }

  // late_flowers -> flower_clusters: when player creates first valid flower cluster
  if (currentStep === 'late_flowers' && gs.chapter2ClustersFound > 0) {
    return 'flower_clusters';
  }

  // flower_clusters -> free_play: when player creates clusters with all bloom times
  // (This is handled elsewhere when restoration reaches certain thresholds)
  if (currentStep === 'flower_clusters' && gs.chapter2ClustersFound >= 3) {
    return 'free_play';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tool actions
// ---------------------------------------------------------------------------

/**
 * Flood-fill to find all connected bund tiles (8-directional).
 * Used by Undo Bund system to remove entire bund clusters.
 */
function findConnectedBunds(tiles: Tile[][], startX: number, startY: number): Array<{ x: number; y: number }> {
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const connected: Array<{ x: number; y: number }> = [];

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    const tile = getTile(tiles, x, y);
    if (!tile || tile.terrain !== 'bund') continue;

    connected.push({ x, y });

    // Check all 8 neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nextKey = `${x + dx},${y + dy}`;
        if (!visited.has(nextKey)) {
          queue.push({ x: x + dx, y: y + dy });
        }
      }
    }
  }

  return connected;
}

/**
 * Calculate restoration penalty for removing a bund cluster.
 * Penalty: -2% per tile + -0.5% × current restoration.
 */
function calculateBundRemovalPenalty(bundCount: number, currentRestoration: number): number {
  const perTilePenalty = bundCount * 2;
  const restorationScaledPenalty = currentRestoration * 0.5;
  return Math.min(currentRestoration, perTilePenalty + restorationScaledPenalty);
}

export function applyBund(gs: GameState, tx: number, ty: number): boolean {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return false;
  if (tile.terrain === 'rock' || tile.terrain === 'bund' || tile.terrain === 'water') return false;
  if (tile.plant) return false; // plant blocks reshaping — caller shows message

  // Place a single bund tile — the player carves the half-moon one tile at a time.
  setTile(gs.tiles, tx, ty, { terrain: 'bund', isModified: true });
  gs.bundPlaced = true;
  return true;
}

export function applyMulch(gs: GameState, tx: number, ty: number): boolean {
  // Don't allow mulching the tile Moss is standing on
  if (tx === gs.mossTX && ty === gs.mossTY) return false;

  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return false;
  if (
    tile.terrain === 'rock' || tile.terrain === 'bund' ||
    tile.terrain === 'mulch' || tile.terrain === 'water'
  ) return false;
  if (tile.plant) return false; // plant is established — caller shows message

  setTile(gs.tiles, tx, ty, {
    terrain: 'mulch',
    moisture: Math.min(100, tile.moisture + 20), // enough to meet early plant requirements
    fertility: Math.min(100, tile.fertility + 8),
    erosion: Math.max(0, tile.erosion - 20),
    isModified: true,
    underlyingTerrain: tile.terrain, // track what soil is underneath
  });
  return true;
}

export function applyShovel(gs: GameState, tx: number, ty: number): boolean {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return false;
  if (tile.terrain === 'rock' || tile.terrain === 'water') return false;

  // Remove a plant first if one is present
  if (tile.plant) {
    // Mesquite occupies a 2x2 grid — find and remove all 4 tiles
    if (tile.plant.type === 'mesquite') {
      // Find the anchor tile (top-left of the 2x2)
      let anchorTX = tx;
      let anchorTY = ty;
      if (tile.plant.isMesquiteOccupied) {
        // Search nearby tiles for the anchor
        for (const { dx, dy } of MESQUITE_OFFSETS) {
          const candidateX = tx - dx;
          const candidateY = ty - dy;
          const candidateTile = getTile(gs.tiles, candidateX, candidateY);
          if (candidateTile?.plant?.type === 'mesquite' && !candidateTile.plant.isMesquiteOccupied) {
            anchorTX = candidateX;
            anchorTY = candidateY;
            break;
          }
        }
      }
      // Remove all 4 tiles
      for (const { dx, dy } of MESQUITE_OFFSETS) {
        setTile(gs.tiles, anchorTX + dx, anchorTY + dy, { plant: undefined, isModified: true });
      }
      return true;
    }
    setTile(gs.tiles, tx, ty, { plant: undefined, isModified: true });
    return true;
  }

  // Undo Bund: remove entire connected bund cluster with penalty
  if (tile.terrain === 'bund') {
    const currentRestoration = calculateRestoration(gs);
    const connectedBunds = findConnectedBunds(gs.tiles, tx, ty);
    const penalty = calculateBundRemovalPenalty(connectedBunds.length, currentRestoration);

    // Remove all connected bund tiles
    for (const bund of connectedBunds) {
      const bundTile = getTile(gs.tiles, bund.x, bund.y);
      if (bundTile) {
        setTile(gs.tiles, bund.x, bund.y, {
          terrain: 'dry_soil',
          water: 0,
          moisture: Math.max(8, bundTile.moisture * 0.6),
          isModified: true
        });
      }
    }

    // Apply penalty to restoration score
    gs.bundRemovalPenalty += penalty;

    return true;
  }

  // Remove mulch back to dry soil
  if (tile.terrain === 'mulch') {
    setTile(gs.tiles, tx, ty, {
      terrain: 'dry_soil',
      water: 0,  // Clear any collected water
      moisture: Math.max(8, tile.moisture * 0.6),  // Reduce moisture when reverting
      isModified: true
    });
    return true;
  }

  return false;
}

export function applyLandscape(
  gs: GameState,
  tx: number, ty: number,
  heldEntity: { type: 'plant' | 'animal' | 'fairy' | 'mulch' | 'grass' | 'rock'; data: any; sourceTX?: number; sourceTY?: number; sourceTerrainBefore?: TerrainType } | null,
  mode: 'move' | 'create_water' | 'create_rocks' | 'destroy_rocks' | 'create_grass' | 'create_soil' = 'move',
): { action: 'picked' | 'placed' | 'none'; entity: { type: 'plant' | 'animal' | 'fairy' | 'mulch' | 'grass' | 'rock'; data: any; sourceTX?: number; sourceTY?: number; sourceTerrainBefore?: TerrainType } | null } {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return { action: 'none', entity: null };

  const TILE_SIZE = 16;

  // If holding an entity, try to place it
  if (heldEntity) {
    const canPlace = tile.terrain !== 'rock' && tile.terrain !== 'water' && !tile.plant && !(tx === gs.mossTX && ty === gs.mossTY);

    if (heldEntity.type === 'plant' && canPlace && tile.terrain !== 'bund') {
      const plantData = heldEntity.data as PlantState;

      // Handle mesquite plants (2x2)
      if (plantData.type === 'mesquite') {
        // Check if all 4 tiles are valid for placement
        let canPlaceMesquite = true;
        for (const { dx, dy } of MESQUITE_OFFSETS) {
          const checkX = tx + dx;
          const checkY = ty + dy;
          if (checkX <= 0 || checkX >= MAP_W - 1 || checkY <= 0 || checkY >= MAP_H - 1) {
            canPlaceMesquite = false;
            break;
          }
          if (checkX === gs.mossTX && checkY === gs.mossTY) {
            canPlaceMesquite = false;
            break;
          }
          const checkTile = getTile(gs.tiles, checkX, checkY);
          if (!checkTile || checkTile.terrain === 'rock' || checkTile.terrain === 'water' || checkTile.plant || checkTile.terrain === 'bund') {
            canPlaceMesquite = false;
            break;
          }
        }

        if (canPlaceMesquite) {
          // Place mesquite on all 4 tiles
          for (const { dx, dy } of MESQUITE_OFFSETS) {
            const placeX = tx + dx;
            const placeY = ty + dy;
            const isAnchor = dx === 0 && dy === 0;
            setTile(gs.tiles, placeX, placeY, {
              plant: {
                type: 'mesquite',
                stage: plantData.stage,
                age: plantData.age,
                waterStress: plantData.waterStress,
                isWilted: plantData.isWilted,
                isMesquiteOccupied: !isAnchor,
              },
              isModified: true,
            });
          }
          return { action: 'placed', entity: null };
        }
      } else {
        // Single-tile plant
        setTile(gs.tiles, tx, ty, { plant: { ...heldEntity.data }, isModified: true });
        return { action: 'placed', entity: null };
      }
    }

    if (heldEntity.type === 'mulch' && canPlace) {
      // Swap: place mulch at destination, move destination terrain to source
      const destTerrainBefore = tile.terrain;
      setTile(gs.tiles, tx, ty, { terrain: 'mulch', isModified: true });
      if (heldEntity.sourceTX !== undefined && heldEntity.sourceTY !== undefined) {
        // Put the destination's terrain at the source
        setTile(gs.tiles, heldEntity.sourceTX, heldEntity.sourceTY, { terrain: destTerrainBefore, isModified: true });
      }
      return { action: 'placed', entity: null };
    }

    if (heldEntity.type === 'grass' && canPlace && tile.terrain !== 'bund') {
      // Swap: place grass at destination, move destination terrain to source
      const destTerrainBefore = tile.terrain;
      setTile(gs.tiles, tx, ty, { terrain: 'grass', isModified: true });
      if (heldEntity.sourceTX !== undefined && heldEntity.sourceTY !== undefined) {
        // Put the destination's terrain at the source
        setTile(gs.tiles, heldEntity.sourceTX, heldEntity.sourceTY, { terrain: destTerrainBefore, isModified: true });
      }
      return { action: 'placed', entity: null };
    }

    if (heldEntity.type === 'rock' && canPlace) {
      // Swap: place rock (or water if that's what was picked up) at destination, move destination terrain to source
      const destTerrainBefore = tile.terrain;
      // Determine what terrain to place based on what was originally picked up
      const terrainToPlace = heldEntity.sourceTerrainBefore ?? 'rock';
      setTile(gs.tiles, tx, ty, { terrain: terrainToPlace, isModified: true });
      if (heldEntity.sourceTX !== undefined && heldEntity.sourceTY !== undefined) {
        // Put the destination's terrain at the source
        setTile(gs.tiles, heldEntity.sourceTX, heldEntity.sourceTY, { terrain: destTerrainBefore, isModified: true });
      }
      return { action: 'placed', entity: null };
    }

    if (heldEntity.type === 'animal' && canPlace) {
      const animal = heldEntity.data as any;
      animal.px = tx * TILE_SIZE + TILE_SIZE / 2;
      animal.py = ty * TILE_SIZE + TILE_SIZE / 2;
      return { action: 'placed', entity: null };
    }

    if (heldEntity.type === 'fairy' && canPlace) {
      const fairy = heldEntity.data as any;
      fairy.px = tx * TILE_SIZE + TILE_SIZE / 2;
      fairy.py = ty * TILE_SIZE - 4;
      return { action: 'placed', entity: null };
    }

    return { action: 'none', entity: heldEntity }; // can't place here, keep holding
  }

  // Move mode: pick up any plant
  if (mode === 'move' && !heldEntity) {
    if (tile.plant) {
      // Handle mesquite plants (2x2)
      if (tile.plant.type === 'mesquite') {
        // Find the anchor tile if we clicked on an occupied tile
        let anchorTX = tx;
        let anchorTY = ty;
        if (tile.plant.isMesquiteOccupied) {
          // Search nearby tiles for the anchor
          for (const { dx, dy } of MESQUITE_OFFSETS) {
            const candidateX = tx - dx;
            const candidateY = ty - dy;
            const candidateTile = getTile(gs.tiles, candidateX, candidateY);
            if (candidateTile?.plant?.type === 'mesquite' && !candidateTile.plant.isMesquiteOccupied) {
              anchorTX = candidateX;
              anchorTY = candidateY;
              break;
            }
          }
        }

        // Get the plant data from the anchor tile
        const anchorTile = getTile(gs.tiles, anchorTX, anchorTY);
        const picked = anchorTile?.plant ? { ...anchorTile.plant } : { ...tile.plant };

        // Remove all 4 tiles
        for (const { dx, dy } of MESQUITE_OFFSETS) {
          setTile(gs.tiles, anchorTX + dx, anchorTY + dy, { plant: undefined, isModified: true });
        }
        return { action: 'picked', entity: { type: 'plant', data: picked } };
      } else {
        // Single-tile plant
        const picked = { ...tile.plant };
        setTile(gs.tiles, tx, ty, { plant: undefined, isModified: true });
        return { action: 'picked', entity: { type: 'plant', data: picked } };
      }
    }
  }

  // Create water: turn terrain into water — but not if plant is on the tile
  if (mode === 'create_water' && !heldEntity) {
    const convertibleTerrains = ['grass', 'mulch', 'bund', 'moist_soil', 'cracked_soil', 'dry_soil'];
    if (convertibleTerrains.includes(tile.terrain) && !tile.plant) {
      setTile(gs.tiles, tx, ty, { terrain: 'water', isModified: true });
      return { action: 'placed', entity: null }; // use 'placed' to indicate conversion happened
    }
  }

  // Create rocks: turn terrain into rocks — but not if plant is on the tile
  if (mode === 'create_rocks' && !heldEntity) {
    const convertibleTerrains = ['grass', 'mulch', 'bund', 'moist_soil', 'cracked_soil', 'dry_soil', 'soil'];
    if (convertibleTerrains.includes(tile.terrain) && !tile.plant) {
      setTile(gs.tiles, tx, ty, { terrain: 'rock', isModified: true });
      return { action: 'placed', entity: null }; // use 'placed' to indicate conversion happened
    }
  }

  // Destroy rocks or evaporate water: remove rocks/water (turn them into dry soil) — but not if plant is on the tile
  if (mode === 'destroy_rocks' && !heldEntity) {
    if ((tile.terrain === 'rock' || tile.terrain === 'water') && !tile.plant) {
      setTile(gs.tiles, tx, ty, { terrain: 'dry_soil', isModified: true });
      return { action: 'placed', entity: null }; // use 'placed' to indicate destruction/evaporation happened
    }
  }

  // Create grass: turn terrain into grass — but not if plant is on the tile
  if (mode === 'create_grass' && !heldEntity) {
    const convertibleTerrains = ['mulch', 'bund', 'moist_soil', 'cracked_soil', 'dry_soil'];
    if (convertibleTerrains.includes(tile.terrain) && !tile.plant) {
      setTile(gs.tiles, tx, ty, { terrain: 'grass', isModified: true });
      return { action: 'placed', entity: null };
    }
  }

  // Create soil: turn terrain into custom soil — but not if plant is on the tile
  if (mode === 'create_soil' && !heldEntity) {
    const convertibleTerrains = ['grass', 'mulch', 'bund', 'moist_soil', 'cracked_soil', 'dry_soil'];
    if (convertibleTerrains.includes(tile.terrain) && !tile.plant) {
      setTile(gs.tiles, tx, ty, { terrain: 'soil', isModified: true });
      return { action: 'placed', entity: null };
    }
  }

  return { action: 'none', entity: null };
}

export function applyPlantSeed(
  gs: GameState,
  tx: number,
  ty: number,
  plantType: PlantType,
): { planted: boolean; reason: string } {
  // Don't allow planting on the tile Moss is standing on
  if (tx === gs.mossTX && ty === gs.mossTY) {
    return { planted: false, reason: 'Moss is standing there.' };
  }

  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return { planted: false, reason: 'No tile here.' };
  if (tile.terrain === 'rock') return { planted: false, reason: 'Cannot plant on rock.' };
  if (tile.terrain === 'bund') return { planted: false, reason: 'Plant near the bund, not on it.' };
  if (tile.terrain === 'water') return { planted: false, reason: 'Cannot plant in open water.' };
  if (tile.plant) return { planted: false, reason: 'Something is already growing here.' };

  const req = PLANT_REQUIREMENTS[plantType];
  if (!req) return { planted: false, reason: 'Unknown plant.' };

  if (tile.moisture < req.moisture) {
    return {
      planted: false,
      reason: `${req.name} needs ${req.moisture}% moisture. This tile has ${Math.round(tile.moisture)}%.`,
    };
  }
  if (tile.fertility < req.fertility) {
    return {
      planted: false,
      reason: `${req.name} needs ${req.fertility}% fertility. This tile has ${Math.round(tile.fertility)}%.`,
    };
  }

  setTile(gs.tiles, tx, ty, {
    plant: { type: plantType, stage: 0, age: 0, waterStress: 0, isWilted: false },
    isModified: true,
  });

  if (!gs.discoveredPlants.includes(plantType)) {
    gs.discoveredPlants.push(plantType);
  }

  // Chapter 2 quest tracking: update plant bloom timing tracking
  if (EARLY_BLOOMS.includes(plantType)) {
    gs.chapter2EarlyFlowerPlanted = true;
  }
  if (MID_BLOOMS.includes(plantType)) {
    gs.chapter2MidFlowerPlanted = true;
  }
  if (LATE_BLOOMS.includes(plantType)) {
    gs.chapter2LateFlowerPlanted = true;
  }

  return { planted: true, reason: '' };
}

/**
 * Plant a mesquite tree on a 2x2 grid anchored at (anchorTX, anchorTY).
 * All 4 tiles must be valid (no rocks, water, existing plants, and fertility ≥ 25%).
 * The anchor tile (top-left) holds the real PlantState; the other 3 tiles get
 * an isMesquiteOccupied marker so the renderer skips them individually.
 */
export function applyMesquitePlant(
  gs: GameState,
  anchorTX: number,
  anchorTY: number,
): { planted: boolean; reason: string } {
  const REQUIRED_FERTILITY = 25; // Mesquite requires fertile soil, not necessarily wet soil

  // Validate all 4 tiles first
  for (const { dx, dy } of MESQUITE_OFFSETS) {
    const tx = anchorTX + dx;
    const ty = anchorTY + dy;

    if (tx === gs.mossTX && ty === gs.mossTY) {
      return { planted: false, reason: 'Moss is standing in the way of the tree.' };
    }
    if (tx <= 0 || tx >= MAP_W - 1 || ty <= 0 || ty >= MAP_H - 1) {
      return { planted: false, reason: 'Not enough space here for the tree.' };
    }
    const tile = getTile(gs.tiles, tx, ty);
    if (!tile) return { planted: false, reason: 'Not enough space here.' };
    if (tile.terrain === 'rock') return { planted: false, reason: 'Cannot plant over rock.' };
    if (tile.terrain === 'bund') return { planted: false, reason: 'Cannot plant over a bund.' };
    if (tile.terrain === 'water') return { planted: false, reason: 'Cannot plant in water.' };
    if (tile.plant) return { planted: false, reason: 'Something is already growing in the way.' };
    if (tile.fertility < REQUIRED_FERTILITY) {
      return {
        planted: false,
        reason: `All 4 tiles need ${REQUIRED_FERTILITY}% fertility. One only has ${Math.round(tile.fertility)}% — try an area with richer soil.`,
      };
    }
  }

  // Plant on all 4 tiles
  for (const { dx, dy } of MESQUITE_OFFSETS) {
    const tx = anchorTX + dx;
    const ty = anchorTY + dy;
    const isAnchor = dx === 0 && dy === 0;
    setTile(gs.tiles, tx, ty, {
      plant: {
        type: 'mesquite',
        stage: 0,
        age: 0,
        waterStress: 0,
        isWilted: false,
        isMesquiteOccupied: !isAnchor,
      },
      isModified: true,
    });
  }

  if (!gs.discoveredPlants.includes('mesquite')) {
    gs.discoveredPlants.push('mesquite');
  }

  return { planted: true, reason: '' };
}

// Move Moss off a plant tile to a nearby empty tile
export function moveMossOffPlant(gs: GameState): boolean {
  const mossTile = getTile(gs.tiles, gs.mossTX, gs.mossTY);
  if (!mossTile?.plant) return false; // Moss is not on a plant

  // Search in expanding rings for an empty tile
  for (let radius = 1; radius <= 3; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check tiles on the current radius perimeter
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

        const nx = gs.mossTX + dx;
        const ny = gs.mossTY + dy;

        const tile = getTile(gs.tiles, nx, ny);
        if (!tile) continue;
        if (tile.terrain === 'rock' || tile.terrain === 'water') continue;
        if (tile.plant) continue;

        // Move Moss here
        gs.mossTX = nx;
        gs.mossTY = ny;
        return true;
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Plant data
// ---------------------------------------------------------------------------

export const PLANT_REQUIREMENTS: Record<PlantType, {
  name: string;
  emoji: string[];  // per stage: seed, sprout, young, mature, blooming
  moisture: number;
  fertility: number;
  role: string;
  attractsWildlife: string[];
  growthRate?: number;  // multiplier on age per tick (default 1); trees use < 1 to grow slower
}> = {
  blue_grama: {
    name: 'Blue Grama Grass',
    emoji: ['🌑', '🌱', '🌿', '🌾', '🌾'],
    moisture: 20,
    fertility: 10,
    role: 'Pioneer stabilizer',
    attractsWildlife: ['ant', 'beetle'],
  },
  desert_marigold: {
    name: 'Desert Marigold',
    emoji: ['🌑', '🌱', '🌿', '🌼', '🌻'],
    moisture: 25,
    fertility: 15,
    role: 'Early flower',
    attractsWildlife: ['bee', 'hoverfly'],
  },
  lupine: {
    name: 'Lupine',
    emoji: ['🌑', '🌱', '🌿', '💐', '🪻'],
    moisture: 30,
    fertility: 20,
    role: 'Nitrogen fixer',
    attractsWildlife: ['painted_lady', 'bee'],
  },
  sage: {
    name: 'Sage',
    emoji: ['🌑', '🌱', '🌿', '🫙', '🌿'],
    moisture: 20,
    fertility: 15,
    role: 'Drought-tolerant habitat',
    attractsWildlife: ['bee', 'beetle'],
  },
  milkweed: {
    name: 'Milkweed',
    emoji: ['🌑', '🌱', '🌿', '🌸', '🦋'],
    moisture: 35,
    fertility: 25,
    role: 'Monarch host plant',
    attractsWildlife: ['monarch'],
  },
  mesquite: {
    name: 'Mesquite',
    emoji: ['🌑', '🌱', '🪴', '🪾', '🌳'],
    moisture: 50,
    fertility: 25,
    role: 'Desert canopy tree',
    attractsWildlife: ['bee', 'hawk', 'rabbit'],
    growthRate: 0.35, // trees grow slowly — about 3× longer per stage than herbs
  },

  // Chapter 2: Meadow flowers
  camas: {
    name: 'Camas',
    emoji: ['🌑', '🌱', '🌿', '💙', '💙'],
    moisture: 30,
    fertility: 20,
    role: 'Early bloomer for spring pollinators',
    attractsWildlife: ['mason_bee'],
  },
  violet: {
    name: 'Violet',
    emoji: ['🌑', '🌱', '🌿', '💜', '💜'],
    moisture: 28,
    fertility: 18,
    role: 'Early understory flower',
    attractsWildlife: ['mason_bee', 'hoverfly'],
  },
  yarrow: {
    name: 'Yarrow',
    emoji: ['🌑', '🌱', '🌿', '🌻', '🌻'],
    moisture: 25,
    fertility: 22,
    role: 'Mid-season favorite of many pollinators',
    attractsWildlife: ['bumblebee', 'hoverfly'],
  },
  bee_balm: {
    name: 'Bee Balm',
    emoji: ['🌑', '🌱', '🌿', '🔴', '🔴'],
    moisture: 35,
    fertility: 25,
    role: 'Vibrant mid-season pollinator magnet',
    attractsWildlife: ['bumblebee', 'hummingbird'],
  },
  goldenrod: {
    name: 'Goldenrod',
    emoji: ['🌑', '🌱', '🌿', '💛', '💛'],
    moisture: 28,
    fertility: 20,
    role: 'Late-season food for tired wings',
    attractsWildlife: ['painted_lady', 'bumblebee'],
  },
  aster: {
    name: 'Aster',
    emoji: ['🌑', '🌱', '🌿', '💗', '💗'],
    moisture: 26,
    fertility: 19,
    role: 'Late bloomer for autumn pollinators',
    attractsWildlife: ['painted_lady', 'bumblebee'],
  },
};

// ---------------------------------------------------------------------------
// Rain
// ---------------------------------------------------------------------------

export function triggerRain(gs: GameState, restoration: number = 0): void {
  gs.isRaining = true;
  gs.rainTimer = 5000; // 5 seconds of rain
  gs.rainsCount++;
  gs.lastRestorationBeforeRain = restoration;  // Capture for Moss rain dialogue

  // Spawn rain drops distributed across visible area
  gs.rainDrops = [];
  for (let i = 0; i < 120; i++) {
    gs.rainDrops.push({
      x: Math.random() * MAP_W * TILE_SIZE,
      y: Math.random() * MAP_H * TILE_SIZE,
      speed: 180 + Math.random() * 120,
      length: 8 + Math.random() * 12,
    });
  }
}

// ---------------------------------------------------------------------------
// Water simulation
// ---------------------------------------------------------------------------

function terrainAbsorption(terrain: TerrainType): number {
  switch (terrain) {
    case 'cracked_soil': return 0.10;
    case 'dry_soil':     return 0.25;
    case 'mulch':        return 0.55;
    case 'bund':         return 0.85;
    case 'moist_soil':   return 0.40;
    case 'grass':        return 0.50;
    case 'rock':         return 0.02;
    case 'water':        return 0.95; // permanent water tiles absorb freely
    default:             return 0.15;
  }
}

export function simulateWater(gs: GameState, restoration: number): void {
  const { tiles } = gs;
  // Update working bund count each physics tick — proxy for "bunds that hold water"
  gs.workingBundCount = countWorkingBunds(gs);
  const moistureFloor = getMinimumMoisture(restoration, gs.workingBundCount);
  const moistureCap = getMoistureCap(restoration);
  const restorationMult = getDryingMultiplier(restoration);
  const bundMod = getBundRetentionModifier(gs.workingBundCount);

  // Step 1: add rainfall to all non-rock, non-water tiles
  if (gs.isRaining) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = getTile(tiles, x, y);
        if (!tile || tile.terrain === 'rock') continue;
        tile.water = Math.min(100, tile.water + 6);
      }
    }
  }

  // Step 2: water flows from high to low elevation (simple pass)
  // Work south-to-north so water cascades downhill naturally
  for (let y = MAP_H - 2; y >= 1; y--) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const tile = getTile(tiles, x, y);
      if (!tile || tile.water < 2) continue;

      const absorption = terrainAbsorption(tile.terrain);
      const absorbed = tile.water * absorption;
      let runoff = tile.water - absorbed;

      if (tile.terrain === 'bund') {
        tile.water = Math.min(100, tile.water);
        // Bunds are designed to hold water — exempt from normal soil moisture cap
        tile.moisture = Math.min(100, tile.moisture + absorbed * 0.8);

        // At 70%+ restoration, bunds with sustained high moisture become permanent ponds
        if (restoration >= 70 && tile.moisture >= 80 && Math.random() < 0.005) {
          setTile(tiles, x, y, { terrain: 'water', water: 80, isModified: true });
        }
      } else if (tile.terrain === 'water') {
        // Permanent water tiles just stay full and overflow a little
        tile.moisture = 100;
        tile.water = Math.min(100, tile.water + absorbed * 0.2);
      } else {
        tile.moisture = Math.min(moistureCap, tile.moisture + absorbed * 0.4);
        tile.water = 0;
      }

      if (runoff < 1) continue;

      // Flow to lower adjacent tiles (prefer south/downhill)
      const neighbors: Array<[number, number, number]> = [
        [x, y + 1, getTile(tiles, x, y + 1)?.elevation ?? 10],
        [x - 1, y, getTile(tiles, x - 1, y)?.elevation ?? 10],
        [x + 1, y, getTile(tiles, x + 1, y)?.elevation ?? 10],
      ];

      for (const [nx, ny, nelev] of neighbors) {
        if (!inBounds(nx, ny)) continue;
        const neighbour = getTile(tiles, nx, ny);
        if (!neighbour || neighbour.terrain === 'rock') continue;
        if (nelev > (tile.elevation)) continue;

        const share = runoff * 0.5;
        neighbour.water = Math.min(100, neighbour.water + share);
        runoff -= share;
        if (runoff < 0.5) break;
      }
    }
  }

  // Step 3: update terrain based on moisture, apply floor + cap + decay
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const tile = getTile(tiles, x, y);
      if (!tile) continue;

      // Permanent water tiles stay wet — skip decay
      if (tile.terrain === 'water') {
        tile.moisture = 100;
        continue;
      }

      // Bund Neighbor Zone: apply fertility & moisture bonuses based on distance to nearest bund
      const neighborBonus = getBundNeighborBonus(tiles, x, y);
      tile.moisture = Math.min(moistureCap, tile.moisture + neighborBonus.moisture * 0.1);  // Scale bonus
      tile.fertility = Math.min(100, tile.fertility + neighborBonus.fertility * 0.1);      // Scale bonus

      // Moisture decay — combined formula:
      //   base × restoration_curve × bund_count_modifier × plant_modifier
      //   × nearby_plant_cluster × mulch_modifier × erosion_drying × local_water_retention
      // High erosion = cracked soil = much faster drying
      // Local moisture retention: tiles near bunds/mulch/plants dry slower
      const plantMod = getPlantRetentionModifier(tile.plant);
      const nearbyMod = getNearbyPlantModifier(tiles, x, y);
      const mulchMod = getMulchModifier(tile.terrain);
      const erosionMod = 1 + (tile.erosion / 100) * 2.0;  // 0-100 erosion → 1.0-3.0× drying rate
      const localRetentionMod = getLocalMoistureRetention(tiles, x, y, restoration);
      const finalRate = 0.025 * restorationMult * bundMod * plantMod * nearbyMod * mulchMod * erosionMod * localRetentionMod;
      tile.moisture = Math.max(
        moistureFloor,
        Math.min(moistureCap, tile.moisture - finalRate),
      );

      // Moisture improves fertility and reduces erosion slowly
      if (tile.moisture > 30) {
        tile.fertility = Math.min(100, tile.fertility + 0.005);
        tile.erosion = Math.max(0, tile.erosion - 0.005);
      }

      // Terrain transitions — stepped upgrade path with degradation (hysteresis prevents flapping)
      // Only for natural tiles (not bund, mulch, water, rock — those are player-placed or fixed)
      // 'water' is already handled above via continue, so only bund/mulch/rock need exclusion here
      if (!tile.plant && tile.terrain !== 'bund' && tile.terrain !== 'mulch' && tile.terrain !== 'rock') {
        // Upgrades (require more moisture to prevent instant bounce-back)
        if (tile.terrain === 'cracked_soil' && tile.moisture > 28) tile.terrain = 'dry_soil';
        if (tile.terrain === 'dry_soil' && tile.moisture > 45) tile.terrain = 'moist_soil';
        // Grass conversion starts at 60% restoration (very rare) and speeds up toward 95%
        if (tile.terrain === 'moist_soil' && tile.fertility > 40 && tile.moisture > 58) {
          if (restoration >= 60) {
            // Probability curve: very low at 60%, ramping up dramatically toward 95%
            const restoreProgress = Math.min(1, (restoration - 60) / 35); // 0 at 60%, 1 at 95%
            const convertChance = Math.pow(restoreProgress, 2.2) * 0.85; // Slow at first, fast near 95%
            if (Math.random() < convertChance) {
              tile.terrain = 'grass';
            }
          }
        }

        // Degradation (lower thresholds than upgrades — hysteresis gap prevents flapping)
        if (tile.terrain === 'grass' && tile.moisture < 36) tile.terrain = 'moist_soil';
        if (tile.terrain === 'moist_soil' && tile.moisture < 24) tile.terrain = 'dry_soil';
        if (tile.terrain === 'dry_soil' && tile.moisture < 14) tile.terrain = 'cracked_soil';
      }

      // Water surface evaporates
      tile.water = Math.max(0, tile.water * 0.92);
    }
  }
}

// ---------------------------------------------------------------------------
// Bund Neighbor Zone (Radius-based fertility & moisture bonus)
// ---------------------------------------------------------------------------

/**
 * Bund Neighbor Zone: Returns {moisture, fertility} bonuses based on distance to nearest bund.
 * Radius 1 (adjacent): +8% moisture, +3% fertility
 * Radius 2: +5% moisture, +2% fertility
 * Radius 3: +2% moisture, +1% fertility
 */
function getBundNeighborBonus(tiles: Tile[][], x: number, y: number): { moisture: number; fertility: number } {
  let minDist = 999;

  // Find distance to nearest bund
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const tile = getTile(tiles, x + dx, y + dy);
      if (tile?.terrain === 'bund') {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        minDist = Math.min(minDist, dist);
      }
    }
  }

  // Return bonus based on distance
  if (minDist === 1) return { moisture: 8, fertility: 3 };
  if (minDist === 2) return { moisture: 5, fertility: 2 };
  if (minDist === 3) return { moisture: 2, fertility: 1 };
  return { moisture: 0, fertility: 0 };
}

// ---------------------------------------------------------------------------
// Natural water feature expansion (93%+ restoration)
// ---------------------------------------------------------------------------

function tryExpandWaterFeatures(gs: GameState): void {
  const tiles = gs.tiles;
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      const tile = getTile(tiles, x, y);
      if (!tile || tile.terrain === 'water' || tile.terrain === 'rock') continue;
      if (tile.plant) continue; // don't flood established plants
      if (tile.moisture <= 70 || tile.fertility <= 60) continue;
      if (tile.elevation > 3) continue; // only low-lying areas

      // Must neighbour an existing water or bund tile
      const hasWaterNeighbour = [
        getTile(tiles, x - 1, y), getTile(tiles, x + 1, y),
        getTile(tiles, x, y - 1), getTile(tiles, x, y + 1),
      ].some((t) => t?.terrain === 'water' || t?.terrain === 'bund');

      if (hasWaterNeighbour && Math.random() < 0.0003) {
        setTile(tiles, x, y, { terrain: 'water', water: 60, moisture: 100, isModified: true });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Natural grass spread
// ---------------------------------------------------------------------------

/**
 * Spreads natural grass to fertile/moist empty soil tiles at 92%+ restoration.
 * 5% chance per tile per tick if moisture > 30 AND fertility > 25.
 */
function spreadNaturalGrass(gs: GameState): void {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = getTile(gs.tiles, x, y);
      if (!tile) continue;

      // Only spread to dry/cracked soil that is unoccupied
      if ((tile.terrain !== 'dry_soil' && tile.terrain !== 'cracked_soil') || tile.plant) continue;

      // Conditions: fertile + moist
      if (tile.moisture > 30 && tile.fertility > 25) {
        if (Math.random() < 0.05) {
          setTile(gs.tiles, x, y, { terrain: 'grass', isModified: true });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Plant growth
// ---------------------------------------------------------------------------

const GROWTH_TICKS_PER_STAGE = 300; // ticks at 60fps ≈ 5 seconds per stage

/**
 * Grows plants each tick, tracking water stress and wilting.
 * Returns true if this was the first-ever wilt event (triggers Moss dialogue once).
 */
export function growPlants(gs: GameState, restoration: number): boolean {
  let firstWiltThisTick = false;
  const canDieFromDrought = restoration < 70;

  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const tile = getTile(gs.tiles, x, y);
      if (!tile?.plant) continue;

      const plant = tile.plant;

      // Mesquite occupied tiles (non-anchor) are synced from the anchor — skip them here
      if (plant.isMesquiteOccupied) continue;

      const req = PLANT_REQUIREMENTS[plant.type];
      if (!req) continue;

      // --- Water stress tracking ---
      if (tile.moisture < req.moisture * 0.8) {
        plant.waterStress = Math.min(100, plant.waterStress + 4);
      } else {
        plant.waterStress = Math.max(0, plant.waterStress - 7);
      }

      // Wilt at stress ≥ 50
      if (plant.waterStress >= 50 && !plant.isWilted) {
        plant.isWilted = true;
        if (!gs.firstWiltSeen) {
          gs.firstWiltSeen = true;
          firstWiltThisTick = true;
        }
      }
      // Recover below stress 30
      if (plant.waterStress < 30 && plant.isWilted) {
        plant.isWilted = false;
      }

      // Death from drought — only before 70% restoration
      if (plant.waterStress >= 100 && canDieFromDrought) {
        if (plant.type === 'mesquite') {
          // Remove all 4 mesquite tiles
          for (const { dx, dy } of MESQUITE_OFFSETS) {
            setTile(gs.tiles, x + dx, y + dy, { plant: undefined });
          }
        } else {
          setTile(gs.tiles, x, y, { plant: undefined });
        }
        continue;
      }

      // Growth pauses when wilted or conditions unmet
      if (plant.isWilted) continue;
      if (plant.stage >= 4) continue;
      if (tile.moisture < req.moisture * 0.7) continue;
      if (tile.fertility < req.fertility * 0.7) continue;

      // Growth speed depends on moisture level
      const growthMult = getGrowthSpeedMultiplier(tile.moisture);

      // Bund neighbor bonus: 5% growth acceleration per bonus tier (max 15% from radius 3 bund)
      const neighborBonus = getBundNeighborBonus(gs.tiles, x, y);
      const neighborGrowthBonus = 1.0 + (neighborBonus.moisture * 0.005);  // max 1.04× at radius 1

      plant.age += (req.growthRate ?? 1) * growthMult * neighborGrowthBonus;
      if (plant.age >= GROWTH_TICKS_PER_STAGE) {
        plant.stage = (plant.stage + 1) as PlantStage;
        plant.age = 0;
      }

      // Sync stage/wilt/stress to the 3 occupied mesquite tiles
      if (plant.type === 'mesquite') {
        for (const { dx, dy } of MESQUITE_OFFSETS) {
          if (dx === 0 && dy === 0) continue; // skip anchor
          const occupiedTile = getTile(gs.tiles, x + dx, y + dy);
          if (occupiedTile?.plant?.isMesquiteOccupied) {
            occupiedTile.plant.stage = plant.stage;
            occupiedTile.plant.isWilted = plant.isWilted;
            occupiedTile.plant.waterStress = plant.waterStress;
          }
        }
      }
    }
  }
  return firstWiltThisTick;
}

// ---------------------------------------------------------------------------
// Wildlife conditions
// ---------------------------------------------------------------------------

interface WildlifeCondition {
  type: string;
  emoji: string;
  check: (gs: GameState, stats: GameStats) => boolean;
  wisdom: string;
}

interface GameStats {
  avgFertility: number;
  bloomCount: number;
  mulchCount: number;
  restoration: number;
  plantDiversity: number;
  waterTileCount: number;
}

export const WILDLIFE_CONDITIONS: WildlifeCondition[] = [
  {
    type: 'ant', emoji: '🐜',
    check: (_, s) => s.avgFertility >= 20,
    wisdom: 'Ants aerate the soil. Each tunnel is a tiny breath for the earth.',
  },
  {
    type: 'beetle', emoji: '🪲',
    check: (_gs, s) => s.mulchCount >= 2 && s.avgFertility >= 25,
    wisdom: 'Decomposers make the dead alive again.',
  },
  {
    type: 'bee', emoji: '🐝',
    check: (_, s) => s.bloomCount >= 1,
    wisdom: 'Where flowers open, pollinators find their way.',
  },
  {
    type: 'hoverfly', emoji: '🦟',
    check: (_, s) => s.bloomCount >= 3,
    wisdom: 'Hoverflies are pollinators disguised as something else. The garden is full of surprises.',
  },
  {
    type: 'painted_lady', emoji: '🦋',
    check: (_, s) => s.plantDiversity >= 3 && s.bloomCount >= 2,
    wisdom: 'Painted ladies travel thousands of miles. Your garden is a waypoint on a longer journey.',
  },
  {
    type: 'monarch', emoji: '🦋',
    check: (gs) => gs.discoveredPlants.includes('milkweed'),
    wisdom: 'Without milkweed, there are no monarchs. You gave them what they need.',
  },
  {
    type: 'cottontail', emoji: '🐇',
    check: (_, s) => s.bloomCount >= 3 && s.plantDiversity >= 3,
    wisdom: 'A rabbit is not a pest. It is a sign of enough abundance to share.',
  },
  {
    type: 'frog', emoji: '🐸',
    check: (_, s) => s.waterTileCount >= 2,
    wisdom: 'Frogs return when the water stays. They are the valley\'s memory of what it once was.',
  },
  {
    type: 'dragonfly', emoji: '🪲',
    check: (_, s) => s.waterTileCount >= 3,
    wisdom: 'Dragonflies emerge from still water. A pond is never just a pond.',
  },
  {
    type: 'quail', emoji: '🐦',
    check: (_, s) => s.restoration >= 70,
    wisdom: 'Quail scatter seeds as they walk. They are gardeners who do not know it.',
  },
  {
    type: 'finch', emoji: '🐦‍⬛',
    check: (_, s) => s.plantDiversity >= 4,
    wisdom: 'Finches follow diversity. Many plants mean many songs.',
  },
  {
    type: 'hawk', emoji: '🦅',
    check: (_, s) => s.restoration >= 80,
    wisdom: 'The hawk watches over everything. Its presence means the web is complete.',
  },

  // Chapter 2: Meadow pollinators
  {
    type: 'mason_bee', emoji: '🐝',
    check: (gs) => gs.discoveredPlants.includes('camas') || gs.discoveredPlants.includes('violet'),
    wisdom: 'Mason bees do not make a fuss. They simply arrive, work hard, and never complain.',
  },
  {
    type: 'bumblebee', emoji: '🐝',
    check: (gs) => gs.discoveredPlants.includes('yarrow') || gs.discoveredPlants.includes('bee_balm'),
    wisdom: 'Bumblebees are the gentle giants of the meadow. They hum songs of abundance.',
  },
  {
    type: 'painted_lady', emoji: '🦋',
    check: (gs) => gs.discoveredPlants.includes('goldenrod') || gs.discoveredPlants.includes('aster'),
    wisdom: 'Painted Ladies journey across continents on fragile wings, proving that beauty is also resilience.',
  },
  {
    type: 'hummingbird', emoji: '🌺',
    check: (gs, s) => gs.discoveredPlants.includes('bee_balm') && s.restoration >= 60,
    wisdom: 'Hummingbirds are flying punctuation marks—tiny exclamation points with wings.',
  },
  {
    type: 'swallow', emoji: '🦅',
    check: (_, s) => s.bloomCount >= 5 && s.restoration >= 85,
    wisdom: 'Swallows arrive when there are enough insects in the air. They are a sign of abundance.',
  },
];

/**
 * Debug function to see exactly what's blocking wildlife spawning
 */
export function debugWildlifeStatus(gs: GameState): void {
  const stats = computeGameStats(gs);

  console.log('=== WILDLIFE SPAWN DEBUG ===');
  console.log(`Restoration: ${stats.restoration}%`);
  console.log(`Bloom Count: ${stats.bloomCount}`);
  console.log(`Plant Diversity: ${stats.plantDiversity}`);
  console.log(`Water Tiles: ${stats.waterTileCount}`);
  console.log(`Avg Fertility: ${stats.avgFertility.toFixed(1)}`);
  console.log(`Mulch Count: ${stats.mulchCount}`);
  console.log('');
  console.log('Wildlife Status:');

  for (const cond of WILDLIFE_CONDITIONS) {
    const isDiscovered = gs.discoveredWildlife.includes(cond.type);
    const conditionMet = cond.check(gs, stats);
    const status = isDiscovered ? '✓ DISCOVERED' : conditionMet ? '⚠️ READY (not yet discovered)' : '✗ BLOCKED';
    console.log(`  ${cond.emoji} ${cond.type.padEnd(15)} — ${status}`);
  }
  console.log('=== END DEBUG ===');
}

/**
 * Generate debug info as array of strings for UI display
 */
export function getDebugInfo(gs: GameState): string[] {
  const stats = computeGameStats(gs);
  const lines: string[] = [];

  lines.push('=== WILDLIFE DEBUG ===');
  lines.push(`Restoration: ${stats.restoration}% | Discovered: ${gs.discoveredWildlife.length}/13`);
  lines.push(`Bloom: ${stats.bloomCount} | Diversity: ${stats.plantDiversity} | Water: ${stats.waterTileCount}`);
  lines.push(`Fertility: ${stats.avgFertility.toFixed(1)}`);
  lines.push('');

  for (const cond of WILDLIFE_CONDITIONS) {
    const isDiscovered = gs.discoveredWildlife.includes(cond.type);
    const conditionMet = cond.check(gs, stats);
    const status = isDiscovered ? '✓' : conditionMet ? '⚠️' : '✗';
    lines.push(`${status} ${cond.emoji} ${cond.type}`);
  }

  return lines;
}

function computeGameStats(gs: GameState): GameStats {
  let totalFertility = 0;
  let tileCount = 0;
  let bloomCount = 0;
  let mulchCount = 0;
  let waterTileCount = 0;
  const plantTypesFound = new Set<string>();

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = getTile(gs.tiles, x, y);
      if (!tile) continue;
      tileCount++;
      totalFertility += tile.fertility;
      if (tile.terrain === 'mulch') mulchCount++;
      if (tile.terrain === 'water') waterTileCount++;
      if (tile.plant) {
        plantTypesFound.add(tile.plant.type);
        if (tile.plant.stage >= 4) bloomCount++;
      }
    }
  }

  return {
    avgFertility: tileCount > 0 ? totalFertility / tileCount : 0,
    bloomCount,
    mulchCount,
    waterTileCount,
    plantDiversity: plantTypesFound.size,
    restoration: calculateRestoration(gs),
  };
}

export function spawnWildlife(gs: GameState): void {
  const stats = computeGameStats(gs);
  for (const cond of WILDLIFE_CONDITIONS) {
    if (gs.discoveredWildlife.includes(cond.type)) continue;
    if (!cond.check(gs, stats)) continue;

    // Find a non-rock tile anywhere on the map (search up to 20 attempts)
    let spawned = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const cx = Math.floor(Math.random() * MAP_W);
      const cy = Math.floor(Math.random() * MAP_H);
      const tile = getTile(gs.tiles, cx, cy);

      if (!tile || tile.terrain === 'rock') continue;

      const entity: WildlifeEntity = {
        id: nextId(),
        type: cond.type as WildlifeEntity['type'],
        px: cx * TILE_SIZE + Math.random() * TILE_SIZE,
        py: cy * TILE_SIZE + Math.random() * TILE_SIZE,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        wanderTimer: 2000 + Math.random() * 3000,
        emoji: cond.emoji,
      };
      gs.entities.push(entity);
      gs.discoveredWildlife.push(cond.type);
      spawned = true;
      break;
    }
    // Spawn all eligible wildlife — no cooldown delay
  }
}

// ---------------------------------------------------------------------------
// Fairy spawning — milestone-based, spaced across the map
// ---------------------------------------------------------------------------

interface FairyMilestone {
  id: string;
  percent: number;
  type: FairyEntity['type'];
  wisdom: string;
  /** Return the preferred [tx, ty] to spawn near */
  preferredTile: (gs: GameState) => [number, number];
}

const FAIRY_MILESTONES: FairyMilestone[] = [
  {
    id: 'sprig', percent: 5, type: 'sprig',
    wisdom: '"The first brave green thing is never small. It is the land deciding to try again."',
    preferredTile: (gs) => [gs.mossTX + 1, gs.mossTY],
  },
  {
    id: 'nima', percent: 25, type: 'nima',
    wisdom: '"Rain is not only what falls. Rain is what the earth is able to keep."',
    preferredTile: (gs) => {
      // Near first bund or water tile
      for (let y = 1; y < MAP_H - 1; y++)
        for (let x = 1; x < MAP_W - 1; x++)
          if (getTile(gs.tiles, x, y)?.terrain === 'bund') return [x + 1, y];
      return [15, 16];
    },
  },
  {
    id: 'bloom', percent: 45, type: 'bloom',
    wisdom: '"A flower is an invitation. When the land offers sweetness, life remembers the way back."',
    preferredTile: () => [10, 18],
  },
  {
    id: 'ripple', percent: 75, type: 'ripple',
    wisdom: '"Still water is never empty. It is a doorway for frogs, wings, roots, and sky."',
    preferredTile: () => [8, 12],
  },
  {
    id: 'tampopo', percent: 93, type: 'tampopo',
    wisdom: '"A healed place does not stay healed by being still. It sends seeds, shade, and stories onward."',
    preferredTile: (gs) => {
      for (let y = 1; y < MAP_H - 1; y++)
        for (let x = 1; x < MAP_W - 1; x++) {
          const t = getTile(gs.tiles, x, y);
          if (t?.plant && t.plant.stage >= 3) return [x, y - 1];
        }
      return [22, 18];
    },
  },
];

/**
 * Fairy information for the journal — includes name, restoration %, element, mood, and wisdom.
 */
export interface FairyCondition {
  type: FairyType;
  name: string;
  restorationPercent: number;
  element: string;
  mood: string;
  gift: string;
  wisdom: string;
}

export const FAIRY_CONDITIONS: FairyCondition[] = [
  {
    type: 'sprig',
    name: 'Sprig',
    restorationPercent: 5,
    element: 'Seed / soil',
    mood: 'Shy, curious, hopeful',
    gift: 'Tiny green sprout',
    wisdom: 'The first brave green thing is never small. It is the land deciding to try again.',
  },
  {
    type: 'nima',
    name: 'Nima',
    restorationPercent: 25,
    element: 'Rain / moisture',
    mood: 'Gentle, quiet, watchful',
    gift: 'Blue rain bead',
    wisdom: 'Rain is not only what falls. Rain is what the earth is able to keep.',
  },
  {
    type: 'bloom',
    name: 'Bloom',
    restorationPercent: 45,
    element: 'Flower / nectar',
    mood: 'Bright, delighted, playful',
    gift: 'Golden pollen star',
    wisdom: 'A flower is an invitation. When the land offers sweetness, life remembers the way back.',
  },
  {
    type: 'ripple',
    name: 'Ripple',
    restorationPercent: 75,
    element: 'Pond / reflection',
    mood: 'Calm, dreamy, slow',
    gift: 'Silver-blue water ring',
    wisdom: 'Still water is never empty. It is a doorway for frogs, wings, roots, and sky.',
  },
  {
    type: 'tampopo',
    name: 'Tampopo',
    restorationPercent: 93,
    element: 'Memory / wind / seeds',
    mood: 'Mysterious, old-soul, warm',
    gift: 'Drifting seed puff',
    wisdom: 'A healed place does not stay healed by being still. It sends seeds, shade, and stories onward.',
  },
];

/** Find a valid spawn tile near preferX/preferY — not rock, not too close to another fairy. */
function findFairySafeTile(gs: GameState, preferX: number, preferY: number): [number, number] {
  for (let radius = 0; radius <= 6; radius++) {
    for (let angle = 0; angle < 16; angle++) {
      const dx = Math.round(Math.cos((angle / 16) * 2 * Math.PI) * radius);
      const dy = Math.round(Math.sin((angle / 16) * 2 * Math.PI) * radius);
      const nx = Math.max(1, Math.min(MAP_W - 2, preferX + dx));
      const ny = Math.max(1, Math.min(MAP_H - 2, preferY + dy));
      const tile = getTile(gs.tiles, nx, ny);
      if (!tile || tile.terrain === 'rock' || tile.terrain === 'water') continue;
      // Minimum 3 tiles away from every existing fairy
      const tooClose = gs.fairies.some((f) => {
        const fx = Math.round(f.px / TILE_SIZE);
        const fy = Math.round(f.py / TILE_SIZE);
        return Math.abs(fx - nx) < 3 && Math.abs(fy - ny) < 3;
      });
      if (!tooClose) return [nx, ny];
    }
  }
  return [preferX, preferY];
}

export function spawnFairies(gs: GameState, restoration: number): void {
  // Max 5 fairies cap
  if (gs.fairies.length >= 5) return;

  // Spawn ALL pending fairies at their thresholds (no cooldown delay)
  // This ensures all eligible fairies appear when restoration reaches their milestone
  for (const milestone of FAIRY_MILESTONES) {
    if (gs.discoveredFairies.includes(milestone.id)) {
      console.log(`  - ${milestone.id} already discovered`);
      continue;
    }
    if (restoration < milestone.percent) {
      console.log(`  - ${milestone.id} requires ${milestone.percent}%, not ready (${restoration}%)`);
      continue;
    }

    if (gs.fairies.length >= 5) {
      console.log(`  ⚠️  Max 5 fairies reached, skipping ${milestone.id}`);
      break;
    }

    console.log(`  ✅ Spawning ${milestone.id} at ${restoration}%`);
    const [prefX, prefY] = milestone.preferredTile(gs);
    const [fx, fy] = findFairySafeTile(gs, prefX, prefY);

    const fairy: FairyEntity = {
      id: nextId(),
      type: milestone.type,
      px: fx * TILE_SIZE + TILE_SIZE / 2,
      py: fy * TILE_SIZE - 4,
      glowPhase: Math.random() * Math.PI * 2,
      wisdom: milestone.wisdom,
    };
    gs.fairies.push(fairy);
    gs.discoveredFairies.push(milestone.id);
    // No cooldown — spawn all pending fairies immediately
  }
}

// ---------------------------------------------------------------------------
// Wildlife movement
// ---------------------------------------------------------------------------

export function updateWildlife(gs: GameState, dt: number): void {
  for (const entity of gs.entities) {
    entity.wanderTimer -= dt;
    if (entity.wanderTimer <= 0) {
      entity.vx = (Math.random() - 0.5) * 30;
      entity.vy = (Math.random() - 0.5) * 30;
      entity.wanderTimer = 1500 + Math.random() * 3000;
    }

    entity.px += entity.vx * (dt / 1000);
    entity.py += entity.vy * (dt / 1000);

    // Bounce off edges
    const minX = TILE_SIZE;
    const minY = TILE_SIZE;
    const maxX = (MAP_W - 2) * TILE_SIZE;
    const maxY = (MAP_H - 2) * TILE_SIZE;
    if (entity.px < minX) { entity.px = minX; entity.vx = Math.abs(entity.vx); }
    if (entity.px > maxX) { entity.px = maxX; entity.vx = -Math.abs(entity.vx); }
    if (entity.py < minY) { entity.py = minY; entity.vy = Math.abs(entity.vy); }
    if (entity.py > maxY) { entity.py = maxY; entity.vy = -Math.abs(entity.vy); }
  }

  for (const fairy of gs.fairies) {
    fairy.glowPhase += dt * 0.002;
  }
}

// ---------------------------------------------------------------------------
// Restoration score (0–100)
// ---------------------------------------------------------------------------

export function calculateRestoration(gs: GameState): number {
  // Locked at 0 until the first bund has captured rain water
  if (!gs.firstBundActivated) return 0;

  let totalMoisture = 0;
  let totalFertility = 0;
  let soilTileCount = 0; // Only count actual soil tiles
  const plantTypes = new Set<string>();

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = getTile(gs.tiles, x, y);
      if (!tile || tile.terrain === 'rock' || tile.terrain === 'water') continue;

      // Only count tiles that are actual soil (cracked, moist, bund, mulch, grass)
      const isSoilTile = ['cracked_soil', 'moist_soil', 'bund', 'mulch', 'grass'].includes(tile.terrain);
      if (!isSoilTile) continue;

      soilTileCount++;
      totalMoisture += tile.moisture;
      totalFertility += tile.fertility;

      if (tile.plant) {
        plantTypes.add(tile.plant.type);
      }
    }
  }

  if (soilTileCount === 0) return 0;

  // Average values across actual soil tiles
  const avgMoisture = totalMoisture / soilTileCount;   // 0–100
  const avgFertility = totalFertility / soilTileCount; // 0–100

  // Starting baselines: moisture ~8, fertility ~12
  // Scale up to 100 as these improve
  const moistureScore = Math.min(100, Math.max(0, (avgMoisture - 8) / 52 * 100));
  const fertilityScore = Math.min(100, Math.max(0, (avgFertility - 12) / 48 * 100));
  const plantScore = Math.min(100, plantTypes.size * 20);
  const wildlifeScore = Math.min(100, gs.discoveredWildlife.length * 10);

  // Dynamic weighting based on restoration level:
  // Early (0-70%): Balance all factors equally (fragile phase — everything matters)
  // Late (70%+): Emphasize biodiversity (35/35) over soil (15/15) (resilient phase — self-sustaining)
  let moistureWeight = 0.25, fertilityWeight = 0.25, plantWeight = 0.25, wildlifeWeight = 0.25;

  // Calculate unweighted score to determine phase
  const baseScore = (
    moistureScore * 0.25 +
    fertilityScore * 0.25 +
    plantScore * 0.25 +
    wildlifeScore * 0.25
  );

  if (baseScore >= 70) {
    // Late game (resilient): Biodiversity matters more than soil health
    moistureWeight = 0.15;
    fertilityWeight = 0.15;
    plantWeight = 0.35;
    wildlifeWeight = 0.35;
  }

  const score = (
    moistureScore  * moistureWeight +
    fertilityScore * fertilityWeight +
    plantScore     * plantWeight +
    wildlifeScore  * wildlifeWeight
  );

  // Apply bund removal penalty (cumulative reduction from removing bund clusters)
  const penalizedScore = Math.max(0, score - gs.bundRemovalPenalty);

  // Cap restoration at 89% if not all plant types or wildlife have been discovered
  const missingPlants = getMissingPlants(gs);
  const missingWildlife = getMissingWildlife(gs);
  const maxAllowedRestoration = (missingPlants.length > 0 || missingWildlife.length > 0) ? 89 : 100;
  const currentRestoration = Math.round(Math.min(maxAllowedRestoration, penalizedScore));

  // Restoration never goes below the maximum previously achieved
  // This locks restoration at 100% once reached, while allowing moisture to fluctuate dynamically
  return Math.max(currentRestoration, gs.maxRestorationAchieved);
}

// ---------------------------------------------------------------------------
// Quest step management
// ---------------------------------------------------------------------------

export function getQuestObjective(step: QuestStep): string {
  switch (step) {
    case 'intro':         return 'Talk to Moss 🐸';
    case 'inspect_soil':  return 'Inspect 3 cracked soil tiles';
    case 'first_rain':    return 'Call gentle rain ☔';
    case 'dig_bund':      return 'Dig a semicircular bund';
    case 'second_rain':   return 'Call gentle rain again ☔';
    case 'plant_seed':    return 'Plant Blue Grama Grass 🌱';
    case 'free_play':     return 'Call rain ☔ to grow your seeds';
    default:              return '';
  }
}

export const MOSS_DIALOGUES: Record<string, DialogueLine[]> = {
  intro: [
    { speaker: 'Moss', emoji: '🐸', text: 'Nothing is wrong with this place. It has simply forgotten how to keep water.' },
    { speaker: 'Moss', emoji: '🐸', text: 'Walk with me. The valley will show us where it hurts, if we let her speak.' },
  ],
  inspect_soil: [
    { speaker: 'Moss', emoji: '🐸', text: 'Bare cracked soil lets water run away before any root can drink. Inspect a few tiles and see what we are working with.' },
  ],
  first_rain: [
    { speaker: 'Moss', emoji: '🐸', text: 'Bare soil lets water run away before roots can drink. Let\'s call a gentle rain and watch what happens.' },
  ],
  dig_bund: [
    { speaker: 'Moss', emoji: '🐸', text: 'The rain came. But the valley could not hold it.' },
    { speaker: 'Moss', emoji: '🐸', text: 'A half-moon basin is also called a semicircular bund. It is a curved earth shape that catches rainwater and slows runoff. Dig one in the highlighted area.' },
  ],
  second_rain: [
    { speaker: 'Moss', emoji: '🐸', text: 'Good. Now call the rain again — with the bund in place, the story will be different.' },
  ],
  plant_seed: [
    { speaker: 'Moss', emoji: '🐸', text: 'Do not chase the rain. Invite it to stay.' },
    { speaker: 'Moss', emoji: '🐸', text: 'The soil holds a little moisture now. Plant something that knows how to start small.' },
  ],
  free_play: [
    { speaker: 'Moss', emoji: '🐸', text: 'One good rain held a little longer. That is how healing starts.' },
    { speaker: 'Moss', emoji: '🐸', text: 'Now call more rain to help the seeds grow. Watch the sprouts — they will tell you when the soil is ready for more plants.' },
    { speaker: 'Moss', emoji: '🐸', text: 'Once the grasses take hold, try adding mulch between them, then plant a Desert Marigold. Pollinators will follow.' },
  ],
};

/** Milestone dialogue — Moss speaks at every 5% interval plus key tipping points. */
export const MOSS_MILESTONE_DIALOGUES: Record<number, DialogueLine> = {
   5:  { speaker: 'Moss', emoji: '🐸', text: 'A small beginning. The valley has held its first drop.' },
  10:  { speaker: 'Moss', emoji: '🐸', text: 'The rain is still escaping. Every drop counts.' },
  15:  { speaker: 'Moss', emoji: '🐸', text: 'The bunds are catching a little more each time.' },
  20:  { speaker: 'Moss', emoji: '🐸', text: 'The soil is holding a little more.' },
  25:  { speaker: 'Moss', emoji: '🐸', text: 'Fertility is slowly returning. The land is waking up.' },
  30:  { speaker: 'Moss', emoji: '🐸', text: 'Patience. The valley has been dry for a long time.' },
  35:  { speaker: 'Moss', emoji: '🐸', text: 'More bunds, more plants. The picture is taking shape.' },
  40:  { speaker: 'Moss', emoji: '🐸', text: 'Roots are beginning to help.' },
  45:  { speaker: 'Moss', emoji: '🐸', text: 'The flowers are attracting visitors. The web is forming.' },
  50:  { speaker: 'Moss', emoji: '🐸', text: 'Halfway. The land is beginning to trust the rain.' },
  55:  { speaker: 'Moss', emoji: '🐸', text: 'Each rain stays a little longer now.' },
  60:  { speaker: 'Moss', emoji: '🐸', text: 'The land no longer loses every drop it is given.' },
  65:  { speaker: 'Moss', emoji: '🐸', text: 'Plant diversity is building the foundation of a real ecosystem.' },
  70:  { speaker: 'Moss', emoji: '🐸', text: 'The roots are deep enough now. The valley will not forget them so easily.' },
  75:  { speaker: 'Moss', emoji: '🐸', text: 'Water is staying. That changes everything.' },
  80:  { speaker: 'Moss', emoji: '🐸', text: 'The valley is starting to sustain itself.' },
  85:  { speaker: 'Moss', emoji: '🐸', text: 'Wildlife is gathering. The web of life is becoming dense.' },
  90:  { speaker: 'Moss', emoji: '🐸', text: 'Almost there. Can you hear it? The valley is finding its rhythm.' },
  93:  { speaker: 'Moss', emoji: '🐸', text: 'The valley is making ponds of its own now. The rain no longer visits. It lives here.' },
  95:  { speaker: 'Moss', emoji: '🐸', text: 'The soil has learned to hold water. The ecosystem is nearly whole.' },
};

/** First restoration moment — fires when free_play begins (first bund activation) */
export const MOSS_FIRST_RESTORATION_DIALOGUE: DialogueLine[] = [
  { speaker: 'Moss', emoji: '🐸', text: 'There.' },
  { speaker: 'Moss', emoji: '🐸', text: 'The valley held its first rain.' },
  { speaker: 'Moss', emoji: '🐸', text: 'It may not seem like much.' },
  { speaker: 'Moss', emoji: '🐸', text: 'But this is how recovery begins.' },
];

/** The 100% completion sequence */
export const MOSS_COMPLETION_DIALOGUE: DialogueLine[] = [
  { speaker: 'Moss', emoji: '🐸', text: 'Look around.' },
  { speaker: 'Moss', emoji: '🐸', text: 'The valley is holding water.' },
  { speaker: 'Moss', emoji: '🐸', text: 'The flowers are feeding insects.' },
  { speaker: 'Moss', emoji: '🐸', text: 'The insects are feeding birds.' },
  { speaker: 'Moss', emoji: '🐸', text: 'The roots are holding soil.' },
  { speaker: 'Moss', emoji: '🐸', text: 'You did not save this place.' },
  { speaker: 'Moss', emoji: '🐸', text: 'You helped it remember.' },
  { speaker: 'Moss', emoji: '🐸', text: 'The valley remembers now.' },
];

/** Post-completion landscape tool dialogue */
export const MOSS_LANDSCAPE_DIALOGUE: DialogueLine[] = [
  { speaker: 'Moss', emoji: '🐸', text: 'The hard work is finished.' },
  { speaker: 'Moss', emoji: '🐸', text: 'Now comes the fun part.' },
  { speaker: 'Moss', emoji: '🐸', text: 'A healthy garden is not frozen. It keeps changing.' },
  { speaker: 'Moss', emoji: '🐸', text: 'Make this place your own.' },
];

export function getQuestMossDialogue(step: QuestStep): DialogueLine[] {
  return MOSS_DIALOGUES[step] ?? [];
}

// ---------------------------------------------------------------------------
// Chapter 2: Clover the Bee Dialogue
// ---------------------------------------------------------------------------

/** Clover opening scene dialogue */
export const CLOVER_OPENING_DIALOGUE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Ah! Good. You came.' },
  { speaker: 'Clover', emoji: '🐝', text: 'I was beginning to worry I had imagined footsteps.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Welcome to the meadow.' },
  { speaker: 'Clover', emoji: '🐝', text: 'It looks green, doesn\'t it?' },
  { speaker: 'Clover', emoji: '🐝', text: 'Very green. Very polite. Very… empty.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Listen.' },
  { speaker: 'Clover', emoji: '🐝', text: 'No buzzing.' },
  { speaker: 'Clover', emoji: '🐝', text: 'No wings.' },
  { speaker: 'Clover', emoji: '🐝', text: 'A meadow can be green and still be hungry.' },
];

/** Quest 1: Listen to the Quiet */
export const CLOVER_LISTEN_DIALOGUE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'You see it now, yes?' },
  { speaker: 'Clover', emoji: '🐝', text: 'The meadow has leaves.' },
  { speaker: 'Clover', emoji: '🐝', text: 'But it has no table set for the small hungry ones.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Let\'s start with breakfast.' },
];

/** Quest 2: Breakfast Flowers (Early blooms) */
export const CLOVER_EARLY_FLOWERS_DIALOGUE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Early flowers are breakfast.' },
  { speaker: 'Clover', emoji: '🐝', text: 'When the first bees wake, they do not need a lecture.' },
  { speaker: 'Clover', emoji: '🐝', text: 'They need nectar.' },
];

export const CLOVER_EARLY_FLOWERS_SPROUT: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Oh!' },
  { speaker: 'Clover', emoji: '🐝', text: 'That is small.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Small is acceptable.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Small is how everything begins.' },
];

export const CLOVER_EARLY_MATURE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Look! Mason bees!' },
  { speaker: 'Clover', emoji: '🐝', text: 'They do not make a fuss.' },
  { speaker: 'Clover', emoji: '🐝', text: 'They simply arrive, work hard, and pretend they were never worried.' },
];

/** Quest 3: Lunch Flowers (Mid-season blooms) */
export const CLOVER_MID_FLOWERS_DIALOGUE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Breakfast is kind.' },
  { speaker: 'Clover', emoji: '🐝', text: 'But a meadow cannot stop feeding everyone by noon.' },
  { speaker: 'Clover', emoji: '🐝', text: 'We need lunch flowers.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Something for the middle of the season, when wings are everywhere and everyone is terribly busy.' },
];

export const CLOVER_YARROW_BLOOM: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Yarrow is very popular.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Almost too popular.' },
  { speaker: 'Clover', emoji: '🐝', text: 'I respect it.' },
];

export const CLOVER_BEE_BALM_BLOOM: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Bee Balm!' },
  { speaker: 'Clover', emoji: '🐝', text: 'Dramatic. Bright. Absolutely impossible to ignore.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Hummingbirds love that sort of thing.' },
];

/** Quest 4: Supper Flowers (Late-season blooms) */
export const CLOVER_LATE_FLOWERS_DIALOGUE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Now comes the part people forget.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Late flowers.' },
  { speaker: 'Clover', emoji: '🐝', text: 'When the air cools and everyone thinks the work is done…' },
  { speaker: 'Clover', emoji: '🐝', text: 'Someone is still hungry.' },
];

export const CLOVER_GOLDENROD_BLOOM: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Goldenrod gets blamed for many things.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Mostly by people who do not understand ragweed.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Tragic.' },
];

export const CLOVER_ASTER_BLOOM: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Aster is a little star for tired wings.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Late-season flowers are kindness with petals.' },
];

/** Quest 5: Make Flower Clusters */
export const CLOVER_CLUSTERS_DIALOGUE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Pollinators are small.' },
  { speaker: 'Clover', emoji: '🐝', text: 'They should not have to cross a whole meadow for one sip.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Plant flowers close enough that a tired bee can make good choices.' },
];

export const CLOVER_FIRST_CLUSTER: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Yes! A little dining room.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Tiny. Fragrant. Excellent service.' },
];

export const CLOVER_ALL_CLUSTERS: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'The meadow is beginning to remember its schedule.' },
];

/** Quest 6: Hummingbird visit */
export const CLOVER_HUMMINGBIRD_DIALOGUE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Did you see that?' },
  { speaker: 'Clover', emoji: '🐝', text: 'No, no, do not blink.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Hummingbirds are basically flying punctuation.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Tiny exclamation marks with wings.' },
];

/** Clover restoration milestones (grouped by percentage) */
export const CLOVER_MILESTONE_DIALOGUES: Record<number, DialogueLine[]> = {
  10: [
    { speaker: 'Clover', emoji: '🐝', text: 'It is still quiet.' },
    { speaker: 'Clover', emoji: '🐝', text: 'But not empty quiet.' },
    { speaker: 'Clover', emoji: '🐝', text: 'Waiting quiet.' },
  ],
  25: [
    { speaker: 'Clover', emoji: '🐝', text: 'The first flowers are keeping time.' },
  ],
  40: [
    { speaker: 'Clover', emoji: '🐝', text: 'I heard buzzing.' },
    { speaker: 'Clover', emoji: '🐝', text: 'I am choosing to remain calm.' },
    { speaker: 'Clover', emoji: '🐝', text: 'I am failing.' },
  ],
  55: [
    { speaker: 'Clover', emoji: '🐝', text: 'Different flowers. Different visitors.' },
    { speaker: 'Clover', emoji: '🐝', text: 'That is how a meadow becomes generous.' },
  ],
  70: [
    { speaker: 'Clover', emoji: '🐝', text: 'The wings are returning.' },
    { speaker: 'Clover', emoji: '🐝', text: 'Not all at once.' },
    { speaker: 'Clover', emoji: '🐝', text: 'But enough to change the sound of the air.' },
  ],
  85: [
    { speaker: 'Clover', emoji: '🐝', text: 'This is no longer just grass.' },
    { speaker: 'Clover', emoji: '🐝', text: 'This is invitation.' },
  ],
  93: [
    { speaker: 'Clover', emoji: '🐝', text: 'The meadow is helping itself now.' },
    { speaker: 'Clover', emoji: '🐝', text: 'Seeds are falling. Wings are carrying news.' },
  ],
};

/** Clover completion dialogue */
export const CLOVER_COMPLETION_DIALOGUE: DialogueLine[] = [
  { speaker: 'Clover', emoji: '🐝', text: 'Listen.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Do you hear it?' },
  { speaker: 'Clover', emoji: '🐝', text: 'That is not noise.' },
  { speaker: 'Clover', emoji: '🐝', text: 'That is the meadow answering.' },
  { speaker: 'Clover', emoji: '🐝', text: 'A meadow is not a carpet.' },
  { speaker: 'Clover', emoji: '🐝', text: 'It is a calendar.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Breakfast for the early wings.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Lunch for the busy ones.' },
  { speaker: 'Clover', emoji: '🐝', text: 'Supper for those who arrive late.' },
  { speaker: 'Clover', emoji: '🐝', text: 'You did not just plant flowers.' },
  { speaker: 'Clover', emoji: '🐝', text: 'You gave time back to the meadow.' },
];

/**
 * Get Clover dialogue for Chapter 2 quest steps.
 * Returns empty array if not a Chapter 2 quest step.
 */
export function getCloverQuestDialogue(questStep: QuestStep): DialogueLine[] {
  switch (questStep) {
    case 'listen_quiet':
      return CLOVER_LISTEN_DIALOGUE;
    case 'early_flowers':
      return CLOVER_EARLY_FLOWERS_DIALOGUE;
    case 'mid_flowers':
      return CLOVER_MID_FLOWERS_DIALOGUE;
    case 'late_flowers':
      return CLOVER_LATE_FLOWERS_DIALOGUE;
    case 'flower_clusters':
      return CLOVER_CLUSTERS_DIALOGUE;
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Main update tick
// ---------------------------------------------------------------------------

export function updateGame(
  gs: GameState,
  dt: number,
  onUIChange?: (restoration: number, avgMoisture: number, wildlifeCount: number, plantCount: number, questStep: QuestStep) => void,
  onMilestone?: (milestone: number, lines: DialogueLine[]) => void,
  onCompletion?: () => void,
  onFirstWilt?: () => void,
): void {
  gs.tick++;

  // Decrement fairy spawn cooldown
  if (gs.fairySpawnCooldown > 0) {
    gs.fairySpawnCooldown--;
  }

  // Update rain
  if (gs.isRaining) {
    gs.rainTimer -= dt;
    if (gs.rainTimer <= 0) {
      gs.isRaining = false;
      gs.rainDrops = [];

      // Moss Rain Dialogue: Trigger only if restoration increased >8% from the start of this rain
      if (onMilestone && gs.questStep === 'free_play') {
        const currentRestoration = calculateRestoration(gs);
        const restorationGain = currentRestoration - gs.lastRestorationBeforeRain;
        if (restorationGain > 8) {
          const dialogue: DialogueLine = {
            speaker: 'Moss',
            emoji: '🐸',
            text: restorationGain >= 15
              ? 'The rain brought hope. The land remembers.'
              : 'The valley is drinking deeply now.',
          };
          onMilestone(0, [dialogue]);  // Use 0 as placeholder milestone number
        }
      }
    }
    // Animate rain drops
    for (const drop of gs.rainDrops) {
      drop.y += drop.speed * (dt / 1000);
      if (drop.y > MAP_H * TILE_SIZE) {
        drop.y = -drop.length;
        drop.x = Math.random() * MAP_W * TILE_SIZE;
      }
    }
  }

  // Physics at ~10Hz
  const now = gs.tick * 16;
  if (now - gs.lastPhysicsTick >= 100) {
    gs.lastPhysicsTick = now;
    const restoration = calculateRestoration(gs);
    if (gs.isRaining || hasPondedWater(gs)) {
      simulateWater(gs, restoration);
    }
    // 93%+ tipping point: natural water feature expansion
    if (restoration >= 93) {
      tryExpandWaterFeatures(gs);
    }
  }

  // Plant growth at ~2Hz
  if (now - gs.lastGrowthTick >= 500) {
    gs.lastGrowthTick = now;
    const restoration = calculateRestoration(gs);
    const firstWilt = growPlants(gs, restoration);
    if (firstWilt && onFirstWilt) onFirstWilt();
    // If Moss ends up on a plant, move them to an empty tile
    moveMossOffPlant(gs);
    // 92%+ tipping point: natural grass begins spreading
    if (restoration >= 92 && !gs.grassSpreadingStarted) {
      gs.grassSpreadingStarted = true;
      if (onMilestone) onMilestone(92, [{ speaker: 'Moss', emoji: '🐸', text: '✓ Native grasses spreading naturally!' }]);
    }
    if (restoration >= 92) {
      spreadNaturalGrass(gs);
    }
    if (gs.tick % 180 === 0) {
      spawnWildlife(gs);
      spawnFairies(gs, restoration);
    }
  }

  // Wildlife movement
  updateWildlife(gs, dt);

  // Notify React every ~0.5s
  if (onUIChange && gs.tick % 30 === 0) {
    const restoration = calculateRestoration(gs);
    // Update the maximum restoration ever achieved — prevents regression
    if (restoration > gs.maxRestorationAchieved) {
      gs.maxRestorationAchieved = restoration;
    }
    const avgMoisture = getAvgMoisture(gs);
    onUIChange(restoration, avgMoisture, gs.discoveredWildlife.length, gs.discoveredPlants.length, gs.questStep);

    // Check ecological milestones — every 5% plus tipping points (only in free_play)
    if (onMilestone && gs.questStep === 'free_play') {
      // Chapter 2 uses different milestone points and speakers
      if (gs.chapter === 'meadow') {
        const milestonePoints = [10, 25, 40, 55, 70, 85, 93] as const;
        for (const pct of milestonePoints) {
          if (restoration >= pct && !gs.restorationMilestonesSeen.includes(pct)) {
            gs.restorationMilestonesSeen.push(pct);
            const lines = CLOVER_MILESTONE_DIALOGUES[pct];
            if (lines) onMilestone(pct, lines);
            break; // Queue one at a time so lines don't pile up
          }
        }
      } else {
        // Chapter 1: Moss milestones (less frequent for a more natural feel)
        const milestonePoints = [10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95] as const;
        for (const pct of milestonePoints) {
          if (restoration >= pct && !gs.restorationMilestonesSeen.includes(pct)) {
            gs.restorationMilestonesSeen.push(pct);

            // Special handling for 85% milestone: check for missing plants and wildlife
            if (pct === 85) {
              const missingPlants = getMissingPlants(gs);
              const missingWildlife = getMissingWildlife(gs);

              if (missingPlants.length > 0 || missingWildlife.length > 0) {
                let missingText = 'The valley is almost whole. But it is missing voices: ';
                const missingItems: string[] = [];

                if (missingPlants.length > 0) {
                  const plantNames = missingPlants.map(id => {
                    const plant = PLANTS.find(p => p.id === id);
                    return plant?.name || id;
                  });
                  missingItems.push(...plantNames);
                }

                if (missingWildlife.length > 0) {
                  missingItems.push(...missingWildlife);
                }

                missingText += missingItems.join(', ') + '. ';
                missingText += 'Plant and nurture these and the land will be complete.';

                const line: DialogueLine = {
                  speaker: 'Moss',
                  emoji: '🐸',
                  text: missingText,
                };
                onMilestone(pct, [line]);
                break;
              }
            }

            const line = MOSS_MILESTONE_DIALOGUES[pct];
            if (line) onMilestone(pct, [line]);  // Wrap in array for consistency
            break; // Queue one at a time so lines don't pile up
          }
        }
      }
    }

    // 100% completion (once per session)
    if (onCompletion && !gs.completionTriggered && restoration >= 100) {
      gs.completionTriggered = true;
      onCompletion();
    }
  }
}

function hasPondedWater(gs: GameState): boolean {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = getTile(gs.tiles, x, y);
      if (t && (t.water > 0.5 || t.terrain === 'water')) return true;
    }
  }
  return false;
}

function getAvgMoisture(gs: GameState): number {
  let total = 0, count = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = getTile(gs.tiles, x, y);
      if (t && t.terrain !== 'rock') { total += t.moisture; count++; }
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

// ---------------------------------------------------------------------------
// Journal Persistence (save/load discoveries across sessions)
// ---------------------------------------------------------------------------

/**
 * Serialize discoveries to JSON string for storage.
 */
export function serializeDiscoveries(gs: GameState): string {
  return JSON.stringify({
    discoveredWildlife: gs.discoveredWildlife,
    discoveredFairies: gs.discoveredFairies,
    discoveredPlants: gs.discoveredPlants,
    discoveredGuideNotes: gs.discoveredGuideNotes,
  });
}

/**
 * Deserialize discoveries from JSON string and apply to GameState.
 */
export function deserializeDiscoveries(gs: GameState, json: string): void {
  try {
    const data = JSON.parse(json);
    // Filter out invalid discoveries to keep only those that exist in the current game
    if (Array.isArray(data.discoveredWildlife)) {
      const validWildlifeIds = new Set(ZONES.flatMap((z) => z.wildlife.map((w) => w.id)));
      gs.discoveredWildlife = data.discoveredWildlife.filter((w: string) => validWildlifeIds.has(w));
    }
    if (Array.isArray(data.discoveredFairies)) {
      const validFairyIds = new Set(ZONES.flatMap((z) => z.fairies.map((f) => f.id)));
      gs.discoveredFairies = data.discoveredFairies.filter((f: string) => validFairyIds.has(f));
    }
    if (Array.isArray(data.discoveredPlants)) {
      const validPlantIds = new Set(PLANTS.map((p) => p.id));
      gs.discoveredPlants = data.discoveredPlants.filter((plant: string) => validPlantIds.has(plant));
    }
    if (Array.isArray(data.discoveredGuideNotes)) gs.discoveredGuideNotes = data.discoveredGuideNotes;
  } catch (e) {
    // Silently ignore malformed JSON — use defaults
    console.warn('Failed to deserialize discoveries:', e);
  }
}

/**
 * Serialize full game state to JSON for saving a game
 */
export function serializeGameState(gs: GameState): string {
  return JSON.stringify({
    // Chapter tracking
    chapter: gs.chapter,

    // Player & world state
    playerTX: gs.playerTX,
    playerTY: gs.playerTY,
    playerPX: gs.playerPX,
    playerPY: gs.playerPY,
    playerDestTX: gs.playerDestTX,
    playerDestTY: gs.playerDestTY,
    tick: gs.tick,
    rainTimer: gs.rainTimer,
    isRaining: gs.isRaining,

    // Game progression
    questStep: gs.questStep,
    inspectedCount: gs.inspectedCount,
    bundPlaced: gs.bundPlaced,
    rainsCount: gs.rainsCount,
    completionTriggered: gs.completionTriggered,

    // Game systems
    fairySpawnCooldown: gs.fairySpawnCooldown,
    grassSpreadingStarted: gs.grassSpreadingStarted,
    bundRemovalPenalty: gs.bundRemovalPenalty,
    lastRestorationBeforeRain: gs.lastRestorationBeforeRain,
    firstBundActivated: gs.firstBundActivated,
    restorationMilestonesSeen: gs.restorationMilestonesSeen,
    workingBundCount: gs.workingBundCount,
    firstWiltSeen: gs.firstWiltSeen,
    maxRestorationAchieved: gs.maxRestorationAchieved,

    // Discoveries & journal
    discoveredWildlife: gs.discoveredWildlife,
    discoveredFairies: gs.discoveredFairies,
    discoveredPlants: gs.discoveredPlants,
    discoveredGuideNotes: gs.discoveredGuideNotes,

    // Tile data — serialize as array of tile objects
    tiles: gs.tiles.map(row =>
      row.map(tile => ({
        terrain: tile.terrain,
        fertility: tile.fertility,
        moisture: tile.moisture,
        water: tile.water,
        plant: tile.plant ? {
          type: tile.plant.type,
          stage: tile.plant.stage,
          age: tile.plant.age,
          waterStress: tile.plant.waterStress,
          isWilted: tile.plant.isWilted,
          isMesquiteOccupied: tile.plant.isMesquiteOccupied ?? false,
        } : null,
      }))
    ),

    // Entities & wildlife
    fairies: gs.fairies.map(f => ({ id: f.id, type: f.type, px: f.px, py: f.py, glowPhase: f.glowPhase, wisdom: f.wisdom })),
    entities: gs.entities.map(e => ({ px: e.px, py: e.py, emoji: e.emoji, type: e.type })),
    mossTX: gs.mossTX,
    mossTY: gs.mossTY,
  });
}

/**
 * Deserialize full game state from JSON
 */
export function deserializeGameState(json: string): GameState | null {
  try {
    const data = JSON.parse(json);
    // Determine which initial state to use based on saved chapter
    const gs = (data.chapter === 'meadow') ? createChapter2InitialState() : createInitialGameState();

    // Restore chapter (should match what was just set above, but restore for completeness)
    if (data.chapter) gs.chapter = data.chapter;

    // Restore player & world state
    gs.playerTX = data.playerTX ?? gs.playerTX;
    gs.playerTY = data.playerTY ?? gs.playerTY;
    gs.playerPX = data.playerPX ?? gs.playerPX;
    gs.playerPY = data.playerPY ?? gs.playerPY;
    // Sync destination to current position to prevent stuck animations
    gs.playerDestTX = data.playerDestTX ?? gs.playerTX;
    gs.playerDestTY = data.playerDestTY ?? gs.playerTY;
    gs.tick = data.tick ?? gs.tick;
    gs.rainTimer = data.rainTimer ?? gs.rainTimer;
    gs.isRaining = data.isRaining ?? gs.isRaining;

    // Restore progression
    if (data.questStep) gs.questStep = data.questStep;
    if (typeof data.inspectedCount === 'number') gs.inspectedCount = data.inspectedCount;
    if (typeof data.bundPlaced === 'boolean') gs.bundPlaced = data.bundPlaced;
    if (typeof data.rainsCount === 'number') gs.rainsCount = data.rainsCount;
    // Persist completion state — prevents dialogue from retriggering on reload
    if (typeof data.completionTriggered === 'boolean') gs.completionTriggered = data.completionTriggered;

    // Restore game systems
    if (typeof data.fairySpawnCooldown === 'number') gs.fairySpawnCooldown = data.fairySpawnCooldown;
    if (typeof data.grassSpreadingStarted === 'boolean') gs.grassSpreadingStarted = data.grassSpreadingStarted;
    if (typeof data.bundRemovalPenalty === 'number') gs.bundRemovalPenalty = data.bundRemovalPenalty;
    if (typeof data.lastRestorationBeforeRain === 'number') gs.lastRestorationBeforeRain = data.lastRestorationBeforeRain;
    if (typeof data.firstBundActivated === 'boolean') gs.firstBundActivated = data.firstBundActivated;
    if (Array.isArray(data.restorationMilestonesSeen)) gs.restorationMilestonesSeen = data.restorationMilestonesSeen;
    if (typeof data.workingBundCount === 'number') gs.workingBundCount = data.workingBundCount;
    if (typeof data.firstWiltSeen === 'boolean') gs.firstWiltSeen = data.firstWiltSeen;
    if (typeof data.maxRestorationAchieved === 'number') gs.maxRestorationAchieved = data.maxRestorationAchieved;

    // Restore discoveries and filter out invalid ones
    if (Array.isArray(data.discoveredWildlife)) {
      // Only keep wildlife that actually exist in the current game
      const validWildlifeIds = new Set(ZONES.flatMap((z) => z.wildlife.map((w) => w.id)));
      gs.discoveredWildlife = data.discoveredWildlife.filter((w: string) => validWildlifeIds.has(w));
      console.log('[GameEngine] Filtered wildlife:', data.discoveredWildlife, '=>', gs.discoveredWildlife);
    }
    if (Array.isArray(data.discoveredFairies)) {
      // Migrate old fairy names (first_fairy, second_fairy, etc.) to new ones (sprig, nima, etc.)
      const fairyMigration: Record<string, string> = {
        'first_fairy': 'sprig',
        'second_fairy': 'nima',
        'third_fairy': 'bloom',
        'fourth_fairy': 'ripple',
        'fifth_fairy': 'tampopo',
      };
      const migratedFairies = data.discoveredFairies.map((fairy: string) => fairyMigration[fairy] || fairy);
      // Only keep fairies that actually exist in the current game
      const validFairyIds = new Set(ZONES.flatMap((z) => z.fairies.map((f) => f.id)));
      gs.discoveredFairies = migratedFairies.filter((f: string) => validFairyIds.has(f));
      console.log('[GameEngine] Filtered fairies:', migratedFairies, '=>', gs.discoveredFairies);
    }
    if (Array.isArray(data.discoveredPlants)) {
      // Only keep plants that actually exist in the current game
      const validPlantIds = new Set(PLANTS.map((p) => p.id));
      gs.discoveredPlants = data.discoveredPlants.filter((plant: string) => validPlantIds.has(plant));
      console.log('[GameEngine] Filtered plants:', data.discoveredPlants, '=>', gs.discoveredPlants);
    }
    if (Array.isArray(data.discoveredGuideNotes)) gs.discoveredGuideNotes = data.discoveredGuideNotes;

    // Recreate wildlife entities based on discoveries
    gs.entities = [];
    for (const wildlifeType of gs.discoveredWildlife) {
      const cond = WILDLIFE_CONDITIONS.find((w) => w.type === wildlifeType);
      if (cond) {
        const cx = 12 + Math.floor(Math.random() * 8);
        const cy = 14 + Math.floor(Math.random() * 8);
        gs.entities.push({
          id: nextId(),
          type: wildlifeType as any,
          px: cx * TILE_SIZE + Math.random() * TILE_SIZE,
          py: cy * TILE_SIZE + Math.random() * TILE_SIZE,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          wanderTimer: 2000 + Math.random() * 3000,
          emoji: cond.emoji,
        });
      }
    }

    // Recreate fairy entities based on discoveries
    for (const fairyType of gs.discoveredFairies) {
      const milestone = FAIRY_MILESTONES.find((m) => m.id === fairyType);
      if (milestone) {
        const [prefX, prefY] = milestone.preferredTile(gs);
        const [fx, fy] = findFairySafeTile(gs, prefX, prefY);
        gs.fairies.push({
          id: nextId(),
          type: milestone.type,
          px: fx * TILE_SIZE + TILE_SIZE / 2,
          py: fy * TILE_SIZE - 4,
          glowPhase: Math.random() * Math.PI * 2,
          wisdom: milestone.wisdom,
        });
      }
    }

    // Restore tiles
    if (Array.isArray(data.tiles) && data.tiles.length > 0) {
      for (let ty = 0; ty < data.tiles.length; ty++) {
        const row = data.tiles[ty];
        if (Array.isArray(row)) {
          for (let tx = 0; tx < row.length; tx++) {
            const tileData = row[tx];
            const tile = gs.tiles[ty]?.[tx];
            if (tile && tileData) {
              tile.terrain = tileData.terrain ?? tile.terrain;
              tile.fertility = tileData.fertility ?? tile.fertility;
              tile.moisture = tileData.moisture ?? tile.moisture;
              tile.water = tileData.water ?? tile.water;

              if (tileData.plant) {
                tile.plant = {
                  type: tileData.plant.type,
                  stage: tileData.plant.stage ?? 0,
                  age: tileData.plant.age ?? 0,
                  waterStress: tileData.plant.waterStress ?? 0,
                  isWilted: tileData.plant.isWilted ?? false,
                  isMesquiteOccupied: tileData.plant.isMesquiteOccupied ?? false,
                };
              } else {
                tile.plant = undefined;
              }
            }
          }
        }
      }
    }

    // Restore fairy positions from saved data, but keep correct types from Step 1
    if (Array.isArray(data.fairies) && data.fairies.length > 0) {
      console.log(`[fairy restore] Merging saved fairy data (count: ${data.fairies.length})`);
      // Match saved fairies by index to the fairies created in Step 1
      // Step 1 created them from discoveredFairies, so they have correct types
      // We only want to restore their saved positions and glow phase
      for (let idx = 0; idx < data.fairies.length && idx < gs.fairies.length; idx++) {
        const savedFairy = data.fairies[idx];
        const currentFairy = gs.fairies[idx];

        if (savedFairy && currentFairy) {
          console.log(`[fairy restore] Restoring position for fairy ${idx} (type: ${currentFairy.type})`);
          currentFairy.px = savedFairy.px ?? currentFairy.px;
          currentFairy.py = savedFairy.py ?? currentFairy.py;
          currentFairy.glowPhase = savedFairy.glowPhase ?? currentFairy.glowPhase;
        }
      }
    }
    // Restore entities with missing fields regenerated
    if (Array.isArray(data.entities)) {
      gs.entities = data.entities.map((e: any) => {
        const cond = WILDLIFE_CONDITIONS.find((w) => w.type === e.type);
        return {
          id: nextId(),
          type: e.type,
          px: e.px,
          py: e.py,
          emoji: e.emoji ?? cond?.emoji ?? '🦌',
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          wanderTimer: 2000 + Math.random() * 3000,
        };
      });
    }
    gs.mossTX = data.mossTX ?? gs.mossTX;
    gs.mossTY = data.mossTY ?? gs.mossTY;

    // Ensure Moss isn't left on a plant tile
    moveMossOffPlant(gs);

    return gs;
  } catch (e) {
    console.warn('Failed to deserialize game state:', e);
    return null;
  }
}
