/**
 * Core types for The Quiet Garden game engine.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAP_W = 32;
export const MAP_H = 32;
export const TILE_SIZE = 24;

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

export type TerrainType =
  | 'cracked_soil'
  | 'dry_soil'
  | 'mulch'
  | 'bund'
  | 'moist_soil'
  | 'grass'
  | 'rock'
  | 'water'; // permanent water feature — ponds, seasonal pools

export type PlantType = 'blue_grama' | 'desert_marigold' | 'lupine' | 'sage' | 'milkweed' | 'mesquite' | 'camas' | 'violet' | 'yarrow' | 'bee_balm' | 'goldenrod' | 'aster';
export type PlantStage = 0 | 1 | 2 | 3 | 4; // seed → sprout → young → mature → blooming

export interface PlantState {
  type: PlantType;
  stage: PlantStage;
  age: number;          // ticks at current stage
  waterStress: number;  // 0–100; climbs when moisture < plant minimum, drops when above
  isWilted: boolean;    // true when waterStress ≥ 50; growth pauses
  isMesquiteOccupied?: boolean; // true for the 3 non-anchor tiles in a 2x2 mesquite placement
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export type WildlifeType =
  | 'ant' | 'beetle' | 'bee' | 'hoverfly'
  | 'painted_lady' | 'monarch' | 'cottontail'
  | 'quail' | 'finch' | 'hawk'
  | 'dragonfly' | 'frog';

export interface WildlifeEntity {
  id: string;
  type: WildlifeType;
  px: number; // pixel x in world space
  py: number; // pixel y in world space
  vx: number;
  vy: number;
  wanderTimer: number;
  emoji: string;
}

export type FairyType = 'sprig' | 'nima' | 'bloom' | 'ripple' | 'tampopo';

export interface FairyEntity {
  id: string;
  type: FairyType;
  px: number;
  py: number;
  glowPhase: number;
  wisdom: string;
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export interface Tile {
  terrain: TerrainType;
  moisture: number;   // 0–100
  fertility: number;  // 0–100
  erosion: number;    // 0–100
  elevation: number;  // 0–10 (higher = more elevated = north)
  plant?: PlantState;
  water: number;      // 0–100, transient water on tile for viz
  isModified: boolean; // set true when player changes this tile
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export type ToolType =
  | 'move' | 'inspect' | 'bund' | 'mulch' | 'seed'
  | 'rain' | 'talk' | 'journal' | 'shovel' | 'landscape';

// ---------------------------------------------------------------------------
// Quest
// ---------------------------------------------------------------------------

export type QuestStep =
  | 'intro'          // Moss intro dialogue / Clover intro dialogue
  | 'inspect_soil'   // Inspect 3 cracked soil tiles (Ch1)
  | 'first_rain'     // Call gentle rain (water escapes) (Ch1)
  | 'dig_bund'       // Dig a semicircular bund (Ch1)
  | 'second_rain'    // Call rain again (bund catches it) (Ch1)
  | 'plant_seed'     // Plant Blue Grama Grass (Ch1)
  | 'listen_quiet'   // Ch2: Listen to the quiet (Clover intro complete)
  | 'early_flowers'  // Ch2: Plant early bloom flowers
  | 'mid_flowers'    // Ch2: Plant mid-season flowers
  | 'late_flowers'   // Ch2: Plant late-season flowers
  | 'flower_clusters'// Ch2: Create flower clusters with mixed bloom times
  | 'free_play';     // Open exploration

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

export interface DialogueLine {
  speaker: string;
  emoji: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Game State
// ---------------------------------------------------------------------------

export interface GameState {
  // Chapter tracking
  chapter: 'dryland' | 'meadow';  // Which chapter is being played

  // World
  tiles: Tile[][];   // [y][x]

  // Player
  playerTX: number;   // current tile x
  playerTY: number;   // current tile y
  playerPX: number;   // pixel x (animated)
  playerPY: number;   // pixel y (animated)
  playerDestTX: number; // destination tile
  playerDestTY: number;
  playerFacing: 'e' | 'w' | 'n' | 's';

  // Entities
  entities: WildlifeEntity[];
  fairies: FairyEntity[];
  fairySpawnCooldown: number;       // ticks until next fairy can spawn (prevents bunching)

  // Moss
  mossTX: number;
  mossTY: number;

  // Rain / water
  isRaining: boolean;
  rainTimer: number; // ms remaining
  rainDrops: Array<{ x: number; y: number; speed: number; length: number }>;
  lastRestorationBeforeRain: number;  // For Moss rain dialogue trigger (>8% gain required)

  // Time
  tick: number;           // frame counter
  lastPhysicsTick: number; // last ms when physics ran
  lastGrowthTick: number;  // last ms when plant growth ran

  // Quest
  questStep: QuestStep;
  inspectedCount: number; // for inspect_soil step
  bundPlaced: boolean;
  rainsCount: number;     // times player has called rain

  // Chapter 2 quest tracking
  chapter2EarlyFlowerPlanted: boolean;   // Has player planted any early bloom flower?
  chapter2MidFlowerPlanted: boolean;     // Has player planted any mid-season flower?
  chapter2LateFlowerPlanted: boolean;    // Has player planted any late-season flower?
  chapter2ClustersFound: number;         // Count of valid clusters discovered
  chapter2HummingbirdSeen: boolean;      // Has hummingbird been spotted?

  // Highlight tiles (for objectives)
  highlightTiles: Array<{ x: number; y: number }>;

  // Discovery log
  discoveredWildlife: string[];
  discoveredFairies: string[];
  discoveredPlants: string[];
  discoveredGuideNotes: string[];  // Guide note IDs player has unlocked

  // Ecological progression tracking
  bundCenterTX: number;                  // player TX when bund stencil was confirmed — seeds placed relative to this
  bundCenterTY: number;
  firstBundActivated: boolean;          // true once a bund has captured rain — unlocks restoration score
  restorationMilestonesSeen: number[]; // milestones already announced by Moss (every 5%)
  completionTriggered: boolean;         // true once 100% restoration event fires
  workingBundCount: number;             // bunds currently holding moisture ≥ 25 — affects drying speed
  firstWiltSeen: boolean;               // whether first-time plant-wilt dialogue has fired
  grassSpreadingStarted: boolean;       // true once natural grass spread begins at 92% restoration
  bundRemovalPenalty: number;           // cumulative restoration penalty from removing bunds

  // Cinematic camera (null = follow player, set during completion tour)
  cinematicCam: { px: number; py: number } | null;

  // Intro animation: Moss walks toward player then back home
  introAnimationState: null | {
    startTick: number;
    targetTX: number;
    targetTY: number;
    originalTX: number;
    originalTY: number;
    playerOriginalTX: number;
    playerOriginalTY: number;
  };

  // Track if intro animation was completed (saved in game state, not persistent across new games)
  introAnimationCompleted: boolean;

  // Pathfinding: queued path to follow
  playerPath: Array<{ x: number; y: number }>;
}

// ---------------------------------------------------------------------------
// UI State (kept in React useState for re-renders)
// ---------------------------------------------------------------------------

export interface UIState {
  activeTool: ToolType;
  selectedSeed: PlantType;
  inspectedTile: { x: number; y: number; tile: Tile } | null;
  dialogue: DialogueLine | null;
  dialogueQueue: DialogueLine[];
  questStep: QuestStep;
  questObjective: string;
  restoration: number;
  unlockedTools: ToolType[];
  showWatershed: boolean;
  avgMoisture: number;
  wildlifeCount: number;
  plantCount: number;
  rainCooling: boolean; // true while rain is active + cooldown — disables rain button
  heldPlant: PlantState | null; // landscape tool: plant picked up for relocation (legacy, use heldEntity)
  heldEntity: { type: 'plant' | 'animal' | 'fairy' | 'mulch' | 'grass' | 'rock'; data: any; sourceTX?: number; sourceTY?: number; sourceTerrainBefore?: TerrainType } | null; // reshape tool: entity picked up for relocation (with optional swap source)
  previousTool: ToolType | null; // tool active before dialogue opened — restored on close
  fastDialogue: boolean;         // accessibility: skip typewriter animation

  // Bund placement stencil system
  bundMode: 'positioning' | 'digging' | null; // positioning: stencil follows player; digging: locked tiles
  bundTargetTiles: Array<{ x: number; y: number }>; // locked tile set after stencil is confirmed

  // Mesquite 2x2 placement stencil (active when seed=mesquite and tool=seed)
  mesquiteMode: 'positioning' | null; // stencil follows player until confirmed

  // Seed selector panel visibility (independent from activeTool)
  showSeedPanel: boolean; // can close panel while keeping seed tool active

  // Reshape tool menu
  showReshapeMenu: boolean; // reshape tool mode selector
  reshapeMode: 'move' | 'create_water' | 'create_rocks' | 'destroy_rocks'; // move = swap tiles, create_water = turn to water, create_rocks = turn to rocks, destroy_rocks = remove rocks
}
