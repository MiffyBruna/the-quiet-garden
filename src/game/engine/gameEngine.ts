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
  };
}

// ---------------------------------------------------------------------------
// Tool actions
// ---------------------------------------------------------------------------

export function applyBund(gs: GameState, tx: number, ty: number): boolean {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return false;
  if (tile.terrain === 'rock' || tile.terrain === 'bund') return false;

  // Place a single bund tile — the player carves the half-moon one tile at a time.
  setTile(gs.tiles, tx, ty, { terrain: 'bund', isModified: true });
  gs.bundPlaced = true;
  return true;
}

export function applyMulch(gs: GameState, tx: number, ty: number): boolean {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return false;
  if (tile.terrain === 'rock' || tile.terrain === 'bund' || tile.terrain === 'mulch') return false;

  setTile(gs.tiles, tx, ty, {
    terrain: 'mulch',
    moisture: Math.min(100, tile.moisture + 10),
    fertility: Math.min(100, tile.fertility + 5),
    erosion: Math.max(0, tile.erosion - 20),
    isModified: true,
  });
  return true;
}

export function applyPlantSeed(
  gs: GameState,
  tx: number,
  ty: number,
  plantType: PlantType,
): { planted: boolean; reason: string } {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile) return { planted: false, reason: 'No tile here.' };
  if (tile.terrain === 'rock') return { planted: false, reason: 'Cannot plant on rock.' };
  if (tile.terrain === 'bund') return { planted: false, reason: 'Plant near the bund, not on it.' };
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
    default:             return 0.15;
  }
}

export function simulateWater(gs: GameState): void {
  const { tiles } = gs;

  // Step 1: add rainfall to all non-rock tiles
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

      // Bunds catch and hold water
      if (tile.terrain === 'bund') {
        tile.water = Math.min(100, tile.water);
        tile.moisture = Math.min(100, tile.moisture + absorbed * 0.8);
      } else {
        tile.moisture = Math.min(100, tile.moisture + absorbed * 0.4);
        tile.water = 0;
      }

      if (runoff < 1) continue;

      // Flow to lower adjacent tiles (prefer south/downhill)
      const neighbors: Array<[number, number, number]> = [
        [x, y + 1, getTile(tiles, x, y + 1)?.elevation ?? 10],    // south (downhill)
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

  // Step 3: update terrain based on moisture
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const tile = getTile(tiles, x, y);
      if (!tile) continue;

      // Natural moisture decay
      tile.moisture = Math.max(0, tile.moisture - 0.01);

      // Moisture improves fertility and reduces erosion slowly
      if (tile.moisture > 30) {
        tile.fertility = Math.min(100, tile.fertility + 0.005);
        tile.erosion = Math.max(0, tile.erosion - 0.005);
      }

      // Update terrain visual from moisture
      if (tile.terrain === 'cracked_soil' && tile.moisture > 40) {
        tile.terrain = 'moist_soil';
      }
      if (tile.terrain === 'moist_soil' && tile.fertility > 40 && tile.moisture > 50) {
        tile.terrain = 'grass';
      }

      // Water evaporates
      tile.water = Math.max(0, tile.water * 0.92);
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
  const plantTypesFound = new Set<string>();

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = getTile(gs.tiles, x, y);
      if (!tile) continue;
      tileCount++;
      totalFertility += tile.fertility;
      if (tile.terrain === 'mulch') mulchCount++;
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
    case 'free_play':     return 'Restore the valley';
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
    { speaker: 'Moss', emoji: '🐸', text: 'Keep going. The valley has more to remember.' },
  ],
};

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
    if (gs.isRaining || hasPondedWater(gs)) {
      simulateWater(gs);
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

  // Notify React
  if (onUIChange && gs.tick % 30 === 0) {
    const restoration = calculateRestoration(gs);
    const avgMoisture = getAvgMoisture(gs);
    onUIChange(restoration, avgMoisture, gs.discoveredWildlife.length, gs.questStep);
  }
}

function hasPondedWater(gs: GameState): boolean {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = getTile(gs.tiles, x, y);
      if (t && t.water > 0.5) return true;
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
