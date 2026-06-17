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
 * Returns the minimum moisture floor at a given restoration %.
 * Soil can never fall below this — healthy ecosystems retain water.
 * Rises linearly from 5% (bare degraded land) to 65% (self-sustaining ecosystem).
 */
export function getMinimumMoisture(restoration: number): number {
  return Math.round(5 + (restoration / 100) * 60);
}

/**
 * Returns a drying-speed multiplier per restoration phase.
 * Phase 1 (0-20%): 1.50 — land barely retains water
 * Phase 2 (20-40%): 1.20 — slight improvement
 * Phase 3 (40-70%): 1.00 — neutral, roots helping
 * Phase 4 (70-93%): 0.50 — resilient, bund ponds permanent
 * Phase 5 (93-100%): 0.20 — self-sustaining
 */
export function getDryingMultiplier(restoration: number): number {
  if (restoration < 20) return 1.50;
  if (restoration < 40) return 1.20;
  if (restoration < 70) return 1.00;
  if (restoration < 93) return 0.50;
  return 0.20;
}

/**
 * Returns the maximum moisture a tile can hold at a given restoration %.
 * Degraded land cannot become saturated — cap rises as ecosystem recovers.
 */
function getMoistureCap(restoration: number): number {
  if (restoration < 30) return 75;
  if (restoration < 50) return 85;
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

    mossTX: MOSS_START_TX,
    mossTY: MOSS_START_TY,

    isRaining: false,
    rainTimer: 0,
    rainDrops: [],

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

    firstBundActivated: false,
    restorationMilestonesSeen: [],
    completionTriggered: false,
    cinematicCam: null,
  };
}

// ---------------------------------------------------------------------------
// Tool actions
// ---------------------------------------------------------------------------

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
    moisture: Math.min(100, tile.moisture + 10),
    fertility: Math.min(100, tile.fertility + 5),
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

  // Revert human-placed bund or mulch back to dry soil
  if (tile.terrain === 'bund' || tile.terrain === 'mulch') {
    setTile(gs.tiles, tx, ty, { terrain: 'dry_soil', isModified: true });
    return true;
  }

  return false;
}

export function applyLandscape(
  gs: GameState,
  tx: number, ty: number,
  heldPlant: import('./types').PlantState | null,
): { action: 'picked' | 'placed' | 'none'; plant: import('./types').PlantState | null } {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return { action: 'none', plant: null };

  // If holding a plant, try to place it here
  if (heldPlant) {
    if (
      tile.terrain !== 'rock' && tile.terrain !== 'water' &&
      tile.terrain !== 'bund' && !tile.plant &&
      tx !== gs.mossTX || ty !== gs.mossTY
    ) {
      setTile(gs.tiles, tx, ty, { plant: { ...heldPlant }, isModified: true });
      return { action: 'placed', plant: null };
    }
    return { action: 'none', plant: heldPlant }; // can't place here, keep holding
  }

  // Not holding — try to pick up a mature+ plant
  if (tile.plant && tile.plant.stage >= 3) {
    const picked = { ...tile.plant };
    setTile(gs.tiles, tx, ty, { plant: undefined, isModified: true });
    return { action: 'picked', plant: picked };
  }

  return { action: 'none', plant: null };
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
    plant: { type: plantType, stage: 0, age: 0 },
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
};

// ---------------------------------------------------------------------------
// Rain
// ---------------------------------------------------------------------------

export function triggerRain(gs: GameState): void {
  gs.isRaining = true;
  gs.rainTimer = 5000; // 5 seconds of rain
  gs.rainsCount++;

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
  const moistureFloor = getMinimumMoisture(restoration);
  const moistureCap = getMoistureCap(restoration);
  const dryingMult = getDryingMultiplier(restoration);

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
        // Bunds hold water efficiently; cap prevents unrealistic saturation
        tile.moisture = Math.min(moistureCap, tile.moisture + absorbed * 0.8);

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

      // Moisture decay — faster in degraded landscape, slower as ecosystem matures
      // Apply floor (ecosystem minimum) and cap (degraded land can't fully saturate)
      tile.moisture = Math.max(
        moistureFloor,
        Math.min(moistureCap, tile.moisture - 0.01 * dryingMult),
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
// Plant growth
// ---------------------------------------------------------------------------

const GROWTH_TICKS_PER_STAGE = 300; // ticks at 60fps ≈ 5 seconds per stage

export function growPlants(gs: GameState): void {
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const tile = getTile(gs.tiles, x, y);
      if (!tile?.plant) continue;

      const plant = tile.plant;
      if (plant.stage >= 4) continue;

      const req = PLANT_REQUIREMENTS[plant.type];
      if (!req) continue;

      if (tile.moisture < req.moisture * 0.7) continue;  // growth pauses
      if (tile.fertility < req.fertility * 0.7) continue;

      plant.age++;
      if (plant.age >= GROWTH_TICKS_PER_STAGE) {
        plant.stage = (plant.stage + 1) as PlantStage;
        plant.age = 0;
      }
    }
  }
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
// Fairy spawning
// ---------------------------------------------------------------------------

interface FairyCondition {
  type: FairyEntity['type'];
  wisdom: string;
  check: (gs: GameState) => boolean;
}

const FAIRY_CONDITIONS: FairyCondition[] = [
  {
    type: 'grama',
    wisdom: '"The grass holds the hill together. Small roots hold small worlds."',
    check: (gs) => gs.discoveredPlants.includes('blue_grama'),
  },
  {
    type: 'marigold',
    wisdom: '"Every yellow petal is a landing strip for something smaller than your smallest thought."',
    check: (gs) => gs.discoveredPlants.includes('desert_marigold'),
  },
  {
    type: 'lupine',
    wisdom: '"Lupine gives back to soil what years of neglect took away. Patience is a kind of generosity."',
    check: (gs) => gs.discoveredPlants.includes('lupine'),
  },
  {
    type: 'sage',
    wisdom: '"Sage remembers drought. It does not fear it. There is wisdom in choosing what endures."',
    check: (gs) => gs.discoveredPlants.includes('sage'),
  },
  {
    type: 'milkweed',
    wisdom: '"Without milkweed there are no monarchs. You gave the migration a place to pause."',
    check: (gs) => gs.discoveredPlants.includes('milkweed'),
  },
];

export function spawnFairies(gs: GameState): void {
  for (const cond of FAIRY_CONDITIONS) {
    if (gs.discoveredFairies.includes(cond.type)) continue;
    if (!cond.check(gs)) continue;

    // Find a blooming plant tile to appear near
    let fx = 15, fy = 18;
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        const tile = getTile(gs.tiles, x, y);
        if (tile?.plant?.stage === 4) { fx = x; fy = y; }
      }
    }

    const fairy: FairyEntity = {
      id: nextId(),
      type: cond.type,
      px: fx * TILE_SIZE + TILE_SIZE / 2,
      py: fy * TILE_SIZE - 4,
      glowPhase: Math.random() * Math.PI * 2,
      wisdom: cond.wisdom,
    };
    gs.fairies.push(fairy);
    gs.discoveredFairies.push(cond.type);
    break;
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
  let totalErosionRisk = 0;
  let tileCount = 0;
  const plantTypes = new Set<string>();
  let bloomCount = 0;

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = getTile(gs.tiles, x, y);
      if (!tile || tile.terrain === 'rock') continue;
      tileCount++;
      totalMoisture += tile.moisture;
      totalFertility += tile.fertility;
      totalErosionRisk += tile.erosion;
      if (tile.plant) {
        plantTypes.add(tile.plant.type);
        if (tile.plant.stage >= 4) bloomCount++;
      }
    }
  }

  if (tileCount === 0) return 0;

  const avgMoisture = totalMoisture / tileCount;   // 0–100
  const avgFertility = totalFertility / tileCount; // 0–100
  const avgErosion = totalErosionRisk / tileCount; // 0–100

  // Starting baselines: moisture ~8, fertility ~12, erosion ~82
  const moistureScore = Math.min(100, Math.max(0, (avgMoisture - 8) / 52 * 100));
  const fertilityScore = Math.min(100, Math.max(0, (avgFertility - 12) / 48 * 100));
  const erosionScore = Math.min(100, Math.max(0, (82 - avgErosion) / 62 * 100));
  const plantScore = Math.min(100, plantTypes.size * 20);
  const wildlifeScore = Math.min(100, gs.discoveredWildlife.length * 10);

  const score = (
    moistureScore  * 0.25 +
    fertilityScore * 0.20 +
    erosionScore   * 0.20 +
    plantScore     * 0.20 +
    wildlifeScore  * 0.15
  );

  return Math.round(Math.min(100, score));
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
    { speaker: 'Moss', emoji: '🐸', text: 'Walk with me. Let\'s see where the rain escapes.' },
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

/** Milestone dialogue — Moss comments as the ecosystem heals */
export const MOSS_MILESTONE_DIALOGUES: Record<number, DialogueLine> = {
  10: { speaker: 'Moss', emoji: '🐸', text: 'The rain is still escaping. Every drop helps.' },
  20: { speaker: 'Moss', emoji: '🐸', text: 'The soil is holding a little more.' },
  40: { speaker: 'Moss', emoji: '🐸', text: 'Roots are beginning to help.' },
  70: { speaker: 'Moss', emoji: '🐸', text: 'The valley no longer loses every drop.' },
  93: { speaker: 'Moss', emoji: '🐸', text: 'The valley remembers.' },
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
): void {
  gs.tick++;

  // Update rain
  if (gs.isRaining) {
    gs.rainTimer -= dt;
    if (gs.rainTimer <= 0) {
      gs.isRaining = false;
      gs.rainDrops = [];
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
    growPlants(gs);
    if (gs.tick % 180 === 0) {
      spawnWildlife(gs);
      spawnFairies(gs);
    }
  }

  // Wildlife movement
  updateWildlife(gs, dt);

  // Notify React every ~0.5s
  if (onUIChange && gs.tick % 30 === 0) {
    const restoration = calculateRestoration(gs);
    const avgMoisture = getAvgMoisture(gs);
    onUIChange(restoration, avgMoisture, gs.discoveredWildlife.length, gs.questStep);

    // Check ecological milestones (only in free_play)
    if (onMilestone && gs.questStep === 'free_play') {
      for (const pct of [10, 20, 40, 70, 93] as const) {
        if (restoration >= pct && !gs.restorationMilestonesSeen.includes(pct)) {
          gs.restorationMilestonesSeen.push(pct);
          const line = MOSS_MILESTONE_DIALOGUES[pct];
          if (line) onMilestone(pct, line);
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
