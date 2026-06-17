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
  | 'rock';

export type PlantType = 'blue_grama' | 'desert_marigold' | 'lupine' | 'sage' | 'milkweed';
export type PlantStage = 0 | 1 | 2 | 3 | 4; // seed → sprout → young → mature → blooming

export interface PlantState {
  type: PlantType;
  stage: PlantStage;
  age: number; // ticks at current stage
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export type WildlifeType =
  | 'ant' | 'beetle' | 'bee' | 'hoverfly'
  | 'painted_lady' | 'monarch' | 'cottontail'
  | 'quail' | 'finch' | 'hawk';

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

export type FairyType = 'marigold' | 'grama' | 'lupine' | 'sage' | 'milkweed';

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

export type ToolType = 'move' | 'inspect' | 'bund' | 'mulch' | 'seed' | 'rain' | 'talk' | 'journal' | 'shovel';

// ---------------------------------------------------------------------------
// Quest
// ---------------------------------------------------------------------------

export type QuestStep =
  | 'intro'          // Moss intro dialogue
  | 'inspect_soil'   // Inspect 3 cracked soil tiles
  | 'first_rain'     // Call gentle rain (water escapes)
  | 'dig_bund'       // Dig a semicircular bund
  | 'second_rain'    // Call rain again (bund catches it)
  | 'plant_seed'     // Plant Blue Grama Grass
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

  // Moss
  mossTX: number;
  mossTY: number;

  // Rain / water
  isRaining: boolean;
  rainTimer: number; // ms remaining
  rainDrops: Array<{ x: number; y: number; speed: number; length: number }>;

  // Time
  tick: number;           // frame counter
  lastPhysicsTick: number; // last ms when physics ran
  lastGrowthTick: number;  // last ms when plant growth ran

  // Quest
  questStep: QuestStep;
  inspectedCount: number; // for inspect_soil step
  bundPlaced: boolean;
  rainsCount: number;     // times player has called rain

  // Highlight tiles (for objectives)
  highlightTiles: Array<{ x: number; y: number }>;

  // Discovery log
  discoveredWildlife: string[];
  discoveredFairies: string[];
  discoveredPlants: string[];
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
  rainCooling: boolean; // true while rain is active + cooldown — disables rain button
}
