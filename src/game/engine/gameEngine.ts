/**
 * Game engine: state creation, update loop, tool actions, water/plant/wildlife simulation.
 */
import {
  MAP_W, MAP_H, TILE_SIZE,
  GameState, Tile, TerrainType, PlantType, PlantStage,
  WildlifeEntity, FairyEntity, QuestStep, DialogueLine,
} from './types';
import {
  generateChapter1Map,
  PLAYER_START_TX, PLAYER_START_TY,
  MOSS_START_TX, MOSS_START_TY,
  INSPECT_HIGHLIGHTS,
} from './mapGen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTile(tiles: Tile[][], x: number, y: number): Tile | undefined {
  return tiles[y]?.[x];
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

    highlightTiles: INSPECT_HIGHLIGHTS,

    discoveredWildlife: [],
    discoveredFairies: [],
    discoveredPlants: [],
    discoveredGuideNotes: [],

    bundCenterTX: 15,
    bundCenterTY: 15,
    firstBundActivated: false,
    restorationMilestonesSeen: [],
    completionTriggered: false,
    workingBundCount: 0,
    firstWiltSeen: false,
    grassSpreadingStarted: false,
    bundRemovalPenalty: 0,
    cinematicCam: null,
    introAnimationState: null,
  };
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
  });
  return true;
}

export function applyShovel(gs: GameState, tx: number, ty: number): boolean {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return false;
  if (tile.terrain === 'rock' || tile.terrain === 'water') return false;

  // Remove a plant first if one is present
  if (tile.plant) {
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
  heldEntity: { type: 'plant' | 'animal' | 'fairy' | 'mulch' | 'grass'; data: any } | null,
): { action: 'picked' | 'placed' | 'none'; entity: { type: 'plant' | 'animal' | 'fairy' | 'mulch' | 'grass'; data: any } | null } {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return { action: 'none', entity: null };

  const TILE_SIZE = 16;

  // If holding an entity, try to place it
  if (heldEntity) {
    const canPlace = tile.terrain !== 'rock' && tile.terrain !== 'water' && !tile.plant && !(tx === gs.mossTX && ty === gs.mossTY);

    if (heldEntity.type === 'plant' && canPlace && tile.terrain !== 'bund') {
      setTile(gs.tiles, tx, ty, { plant: { ...heldEntity.data }, isModified: true });
      return { action: 'placed', entity: null };
    }

    if (heldEntity.type === 'mulch' && canPlace) {
      setTile(gs.tiles, tx, ty, { terrain: 'mulch', isModified: true });
      return { action: 'placed', entity: null };
    }

    if (heldEntity.type === 'grass' && canPlace && tile.terrain !== 'bund') {
      setTile(gs.tiles, tx, ty, { terrain: 'grass', isModified: true });
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

  // Not holding — try to pick up entities
  // Pick up mature+ plants
  if (tile.plant && tile.plant.stage >= 3) {
    const picked = { ...tile.plant };
    setTile(gs.tiles, tx, ty, { plant: undefined, isModified: true });
    return { action: 'picked', entity: { type: 'plant', data: picked } };
  }

  // Pick up animals
  const animal = gs.entities.find(e =>
    Math.abs(e.px - (tx * TILE_SIZE + TILE_SIZE / 2)) < TILE_SIZE / 2 &&
    Math.abs(e.py - (ty * TILE_SIZE + TILE_SIZE / 2)) < TILE_SIZE / 2
  );
  if (animal) {
    return { action: 'picked', entity: { type: 'animal', data: animal } };
  }

  // Pick up fairies
  const fairy = gs.fairies.find(f =>
    Math.abs(f.px - (tx * TILE_SIZE + TILE_SIZE / 2)) < TILE_SIZE &&
    Math.abs(f.py - (ty * TILE_SIZE)) < TILE_SIZE
  );
  if (fairy) {
    return { action: 'picked', entity: { type: 'fairy', data: fairy } };
  }

  // Pick up mulch
  if (tile.terrain === 'mulch') {
    setTile(gs.tiles, tx, ty, { terrain: 'dry_soil', isModified: true });
    return { action: 'picked', entity: { type: 'mulch', data: null } };
  }

  // Pick up grass
  if (tile.terrain === 'grass') {
    setTile(gs.tiles, tx, ty, { terrain: 'dry_soil', isModified: true });
    return { action: 'picked', entity: { type: 'grass', data: null } };
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
  return { planted: true, reason: '' };
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
        if (tile.terrain === 'moist_soil' && tile.fertility > 40 && tile.moisture > 58) tile.terrain = 'grass';

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
        setTile(gs.tiles, x, y, { plant: undefined });
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

const WILDLIFE_CONDITIONS: WildlifeCondition[] = [
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
    check: (_, s) => s.restoration >= 90,
    wisdom: 'The hawk watches over everything. Its presence means the web is complete.',
  },
];

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

    // Find a non-rock tile near center of map
    const cx = 12 + Math.floor(Math.random() * 8);
    const cy = 14 + Math.floor(Math.random() * 8);
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
    break; // Spawn one at a time
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
    id: 'first_fairy', percent: 15, type: 'grama',
    wisdom: '"The valley has held its first rain. The memory is faint — but it is there."',
    preferredTile: (gs) => [gs.mossTX + 1, gs.mossTY],
  },
  {
    id: 'second_fairy', percent: 22, type: 'marigold',
    wisdom: '"Every bund is a small promise. The land is beginning to listen."',
    preferredTile: (gs) => {
      // Near first bund tile
      for (let y = 1; y < MAP_H - 1; y++)
        for (let x = 1; x < MAP_W - 1; x++)
          if (getTile(gs.tiles, x, y)?.terrain === 'bund') return [x + 1, y];
      return [15, 16];
    },
  },
  {
    id: 'third_fairy', percent: 32, type: 'sage',
    wisdom: '"Soil remembers fertility. It just needs time and care to recall it."',
    preferredTile: () => [10, 18],
  },
  {
    id: 'fourth_fairy', percent: 42, type: 'lupine',
    wisdom: '"Pollinators do not ask for much. Just a flower that stays open."',
    preferredTile: () => [8, 12],
  },
  {
    id: 'fifth_fairy', percent: 52, type: 'milkweed',
    wisdom: '"Lupine gives back to soil what years of neglect took away. Patience is a kind of generosity."',
    preferredTile: (gs) => {
      for (let y = 1; y < MAP_H - 1; y++)
        for (let x = 1; x < MAP_W - 1; x++) {
          const t = getTile(gs.tiles, x, y);
          if (t?.plant?.type === 'milkweed' && t.plant.stage >= 3) return [x, y - 1];
        }
      return [22, 18];
    },
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

  // Prevent spawning too close together (cooldown: 180 ticks = ~3 seconds at 60fps)
  if (gs.fairySpawnCooldown > 0) return;

  for (const milestone of FAIRY_MILESTONES) {
    if (gs.discoveredFairies.includes(milestone.id)) continue;
    if (restoration < milestone.percent) continue;

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
    gs.fairySpawnCooldown = 180;  // 3 second cooldown before next spawn
    break; // spawn one per call to spread them out over time
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

  return Math.round(Math.min(100, penalizedScore));
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

export const MOSS_DIALOGUES: Record<QuestStep, DialogueLine[]> = {
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
// Main update tick
// ---------------------------------------------------------------------------

export function updateGame(
  gs: GameState,
  dt: number,
  onUIChange?: (restoration: number, avgMoisture: number, wildlifeCount: number, questStep: QuestStep) => void,
  onMilestone?: (milestone: number, line: DialogueLine) => void,
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
          onMilestone(0, dialogue);  // Use 0 as placeholder milestone number
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
    // 92%+ tipping point: natural grass begins spreading
    if (restoration >= 92 && !gs.grassSpreadingStarted) {
      gs.grassSpreadingStarted = true;
      if (onMilestone) onMilestone(92, { speaker: 'Moss', emoji: '🐸', text: '✓ Native grasses spreading naturally!' });
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
    const avgMoisture = getAvgMoisture(gs);
    onUIChange(restoration, avgMoisture, gs.discoveredWildlife.length, gs.questStep);

    // Check ecological milestones — every 5% plus tipping points (only in free_play)
    if (onMilestone && gs.questStep === 'free_play') {
      const milestonePoints = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 93, 95] as const;
      for (const pct of milestonePoints) {
        if (restoration >= pct && !gs.restorationMilestonesSeen.includes(pct)) {
          gs.restorationMilestonesSeen.push(pct);
          const line = MOSS_MILESTONE_DIALOGUES[pct];
          if (line) onMilestone(pct, line);
          break; // Queue one at a time so lines don't pile up
        }
      }
    }

    // 100% completion (once only)
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
    if (Array.isArray(data.discoveredWildlife)) gs.discoveredWildlife = data.discoveredWildlife;
    if (Array.isArray(data.discoveredFairies)) gs.discoveredFairies = data.discoveredFairies;
    if (Array.isArray(data.discoveredPlants)) gs.discoveredPlants = data.discoveredPlants;
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
        } : null,
      }))
    ),

    // Entities & wildlife
    fairies: gs.fairies.map(f => ({ px: f.px, py: f.py, glowPhase: f.glowPhase })),
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
    const gs = createInitialGameState();

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

    // Restore discoveries
    if (Array.isArray(data.discoveredWildlife)) gs.discoveredWildlife = data.discoveredWildlife;
    if (Array.isArray(data.discoveredFairies)) gs.discoveredFairies = data.discoveredFairies;
    if (Array.isArray(data.discoveredPlants)) gs.discoveredPlants = data.discoveredPlants;
    if (Array.isArray(data.discoveredGuideNotes)) gs.discoveredGuideNotes = data.discoveredGuideNotes;

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
                };
              } else {
                tile.plant = undefined;
              }
            }
          }
        }
      }
    }

    // Restore entities
    if (Array.isArray(data.fairies)) {
      gs.fairies = data.fairies.map((f: any) => ({
        px: f.px,
        py: f.py,
        glowPhase: f.glowPhase,
      }));
    }
    if (Array.isArray(data.entities)) {
      gs.entities = data.entities.map((e: any) => ({
        px: e.px,
        py: e.py,
        emoji: e.emoji,
        type: e.type,
      }));
    }
    gs.mossTX = data.mossTX ?? gs.mossTX;
    gs.mossTY = data.mossTY ?? gs.mossTY;

    return gs;
  } catch (e) {
    console.warn('Failed to deserialize game state:', e);
    return null;
  }
}
