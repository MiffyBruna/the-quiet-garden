/**
 * GameScene — the main playable canvas for The Quiet Garden.
 *
 * Architecture:
 *  • HTML5 Canvas renders the game world (tiles, player, entities, rain)
 *  • React overlays handle HUD, toolbar, dialogue, inspect panel
 *  • gameState lives in a useRef (mutated each frame, not React state)
 *  • uiState in useState triggers React re-renders only when needed
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSafeArea } from '../services/environment';
import { track } from '../services/analytics';
import { playMusic, isMusicEnabled, toggleMusic, setMusicVolume, loadAudioSettings } from './services/audioManager';
import { playSFX, preloadSFX } from './services/sfxManager';
import {
  TILE_SIZE, MAP_W, MAP_H,
  GameState, UIState, ToolType, PlantType, DialogueLine, QuestStep, Tile,
} from './engine/types';
import {
  createInitialGameState,
  applyBund, applyMulch, applyPlantSeed, applyShovel, applyLandscape,
  triggerRain, updateGame,
  PLANT_REQUIREMENTS, calculateRestoration, getRainCooldown,
  getQuestObjective, getQuestMossDialogue,
  MOSS_COMPLETION_DIALOGUE, MOSS_LANDSCAPE_DIALOGUE, MOSS_FIRST_RESTORATION_DIALOGUE,
  getTile,
  serializeDiscoveries, deserializeDiscoveries,
  serializeGameState, deserializeGameState,
} from './engine/gameEngine';
import {
  INSPECT_HIGHLIGHTS, BUND_SHAPE_OFFSETS,
} from './engine/mapGen';

// Module-scope lifecycle telemetry (registered once per page load)
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
RundotGameAPI.lifecycles.onPause(() => RundotGameAPI.analytics.recordCustomEvent('game_paused'));
RundotGameAPI.lifecycles.onResume(() => RundotGameAPI.analytics.recordCustomEvent('game_resumed'));
RundotGameAPI.lifecycles.onSleep(() => RundotGameAPI.analytics.recordCustomEvent('game_sleep'));
RundotGameAPI.lifecycles.onQuit(() => RundotGameAPI.analytics.recordCustomEvent('game_quit'));

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/**
 * Tile color system:
 *  - Fertility sets the base soil hue (pale tan = infertile → dark brown = rich)
 *  - Moisture darkens the result (dry = lighter, wet = visibly darker)
 *  - Blue is ONLY for permanent water terrain, never for "moist soil"
 */
function tileBaseColor(tile: Tile): string {
  const f = tile.fertility / 100;  // 0–1
  const m = tile.moisture / 100;   // 0–1

  switch (tile.terrain) {
    case 'water': return '#4A90C4';   // permanent pond / pool — stays blue
    case 'rock':  return '#8A8680';

    case 'bund': {
      // Earth berm — slightly enriched by water; moisture darkens it
      const dark = m * 0.30;
      const r = Math.round(158 * (1 - dark));
      const g = Math.round(123 * (1 - dark));
      const b = Math.round(85  * (1 - dark));
      return `rgb(${r},${g},${b})`;
    }

    case 'mulch': {
      // Organic matter — darker with fertility, subtly dampened by moisture
      const rBase = Math.round(120 - f * 35);  // 120 → 85
      const gBase = Math.round(85  - f * 27);  //  85 → 58
      const bBase = Math.round(52  - f * 17);  //  52 → 35
      const dark = m * 0.20;
      return `rgb(${Math.round(rBase*(1-dark))},${Math.round(gBase*(1-dark))},${Math.round(bBase*(1-dark))})`;
    }

    case 'grass': {
      // Dry / infertile grass is pale olive; rich grass is deep emerald
      const rBase = Math.round(105 - f * 50);  // 105 → 55
      const gBase = Math.round(138 + f * 32);  // 138 → 170
      const bBase = Math.round(48  + f * 14);  //  48 → 62
      const dark = m * 0.22;
      return `rgb(${Math.max(0,Math.round(rBase*(1-dark)))},${Math.max(0,Math.round(gBase*(1-dark)))},${Math.max(0,Math.round(bBase*(1-dark)))})`;
    }

    default: {
      // All natural soil types (cracked_soil, dry_soil, moist_soil):
      // fertility is the primary signal — pale sandy tan at low fertility,
      // warm rich brown at high fertility.  Moisture darkens the result.
      const rBase = Math.round(196 - f * 108);  // 196 (pale tan) → 88 (dark brown)
      const gBase = Math.round(150 - f *  88);  // 150             → 62
      const bBase = Math.round(90  - f *  52);  //  90             → 38
      const dark = m * 0.35;
      return `rgb(${Math.round(rBase*(1-dark))},${Math.round(gBase*(1-dark))},${Math.round(bBase*(1-dark))})`;
    }
  }
}

// ---------------------------------------------------------------------------
// Dialogue text formatting with bold quest hints
// ---------------------------------------------------------------------------

// Sprite cache for player character
const spriteCache: Record<string, HTMLImageElement> = {};

function loadSprite(path: string): HTMLImageElement | null {
  if (spriteCache[path]) return spriteCache[path];
  const img = new Image();
  img.src = path;
  spriteCache[path] = img;
  return img;
}

function getPlayerSprite(facing: string, isMoving: boolean, tick: number): HTMLImageElement | null {
  let spriteName = 'idle';

  if (isMoving) {
    // Alternate between 2 frames every 300ms
    const frameIndex = Math.floor((tick * 16) / 300) % 2; // tick is in frames, ~16ms per frame
    spriteName = `walk_${facing === 'e' ? 'right' : facing === 'w' ? 'left' : facing === 'n' ? 'up' : 'down'}_${frameIndex + 1}`;
  } else {
    spriteName = `idle_${facing === 'n' ? 'up' : 'down'}`;
  }

  return loadSprite(`/sprites/${spriteName}t.png`);
}

// Fallback drawing function (stashed old sprite code in case we need to revert)
function drawPlayerShapeFallback(ctx: CanvasRenderingContext2D, sx: number, sy: number, T: number, tick: number, isMoving: boolean): void {
  const cx = sx + T / 2;
  const cy = sy + T / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, sy + T - 3, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4A7A52';
  ctx.fillRect(cx - 5, cy - 1, 10, 10);

  ctx.fillStyle = '#D4A882';
  ctx.beginPath();
  ctx.arc(cx, cy - 5, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5C3D2E';
  ctx.fillRect(cx - 7, cy - 10, 14, 3);
  ctx.fillRect(cx - 4, cy - 16, 9, 7);

  const walkBob = isMoving ? Math.abs(Math.sin(tick * 0.25)) * 2 : 0;
  ctx.fillStyle = '#5C3D2E';
  ctx.fillRect(cx - 5, cy + 7 + walkBob, 4, 4);
  ctx.fillRect(cx + 1, cy + 7 - walkBob + 2, 4, 4);
}

function renderDialogueText(text: string): React.ReactNode {
  // List of quest-related phrases to highlight in bold
  const boldPhrases = [
    'Inspect',
    'Dig',
    'Plant',
    'Rain',
    'Gentle rain',
    'Bund',
    'Mulch',
    'Grama',
    'Marigold',
    'Sage',
    'Milkweed',
    'Mesquite',
    'Water',
    'Moisture',
    'Restoration',
    'Moisture floor',
    'Fertility',
  ];

  // Create a regex that matches any of the bold phrases (case-insensitive)
  const pattern = new RegExp(`(${boldPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (pattern.test(part)) {
      return (
        <span key={i} style={{ fontWeight: 'bold', color: '#FFD700' }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderFrame(
  canvas: HTMLCanvasElement,
  gs: GameState,
  highlights: Array<{ x: number; y: number }>,
  tick: number,
  stencilTiles: Array<{ x: number; y: number }> = [],
  showMossHint = false,
  inspectFlash: { x: number; y: number; startTick: number } | null = null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const T = TILE_SIZE;

  // Camera: use cinematicCam if set (completion tour), else follow player
  const camCenter = gs.cinematicCam ?? { px: gs.playerPX, py: gs.playerPY };
  const camX = Math.round(camCenter.px - W / 2 + T / 2);
  const camY = Math.round(camCenter.py - H / 2 + T / 2);

  ctx.clearRect(0, 0, W, H);

  // Background sky colour
  ctx.fillStyle = '#D4C49A';
  ctx.fillRect(0, 0, W, H);

  // Compute visible tile range
  const startTX = Math.max(0, Math.floor(camX / T));
  const endTX = Math.min(MAP_W - 1, Math.ceil((camX + W) / T));
  const startTY = Math.max(0, Math.floor(camY / T));
  const endTY = Math.min(MAP_H - 1, Math.ceil((camY + H) / T));

  // --- Draw tiles ---
  for (let ty = startTY; ty <= endTY; ty++) {
    for (let tx = startTX; tx <= endTX; tx++) {
      const tile = getTile(gs.tiles, tx, ty);
      if (!tile) continue;

      const sx = tx * T - camX;
      const sy = ty * T - camY;

      // Base terrain colour
      ctx.fillStyle = tileBaseColor(tile);
      ctx.fillRect(sx, sy, T, T);

      // --- Water tile (permanent pond / pool) ---
      if (tile.terrain === 'water') {
        // Shimmer effect
        const shimmer = 0.06 + 0.04 * Math.sin(tick * 0.08 + tx * 0.7 + ty * 0.5);
        ctx.fillStyle = `rgba(120,200,255,${shimmer})`;
        ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
        // Highlight glint
        if (tick % 20 < 10) {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(sx + 3, sy + 3, T - 8, 2);
        }
        // Occasional lily pad (every 7th tile by position hash)
        if ((tx * 3 + ty * 7) % 9 === 0) {
          ctx.font = '10px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🪷', sx + T / 2, sy + T / 2);
        }
        // Grid line
        ctx.strokeStyle = 'rgba(0,80,180,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, T, T);
      } else {
        // Subtle grid line for non-water tiles
        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, T, T);

        // Crack texture on cracked soil
        if (tile.terrain === 'cracked_soil') {
          ctx.strokeStyle = `rgba(90,60,30,${0.25 - tile.moisture * 0.002})`;
          ctx.lineWidth = 0.8;
          const seed = tx * 7 + ty * 13;
          ctx.beginPath();
          ctx.moveTo(sx + (seed % 8) + 2, sy + (seed % 6) + 2);
          ctx.lineTo(sx + T - (seed % 5) - 2, sy + T / 2 + (seed % 4));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx + T / 2, sy + (seed % 5) + 2);
          ctx.lineTo(sx + (seed % 6) + 2, sy + T - 3);
          ctx.stroke();
        }

        // Bund arc
        if (tile.terrain === 'bund') {
          ctx.strokeStyle = '#6B4C2A';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sx + T / 2, sy + T * 0.75, T * 0.4, Math.PI, 0);
          ctx.stroke();
          // Small puddle inside bund if water present
          if (tile.water > 5) {
            ctx.fillStyle = `rgba(100,160,220,${Math.min(0.5, tile.water / 120)})`;
            ctx.beginPath();
            ctx.ellipse(sx + T / 2, sy + T * 0.8, T * 0.3, T * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Mulch dots
        if (tile.terrain === 'mulch') {
          ctx.fillStyle = 'rgba(60,35,15,0.35)';
          const dots = [{ x: 5, y: 5 }, { x: 14, y: 8 }, { x: 8, y: 15 }, { x: 18, y: 16 }];
          for (const d of dots) {
            ctx.beginPath();
            ctx.arc(sx + d.x, sy + d.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Wet sheen — transient water during rain darkens soil slightly.
        // No blue tint: blue is reserved exclusively for permanent water terrain.
        if (tile.water > 15 && tile.terrain !== 'bund' && !tile.plant) {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.14, tile.water / 280)})`;
          ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
        }
      }

      // Plant — always rendered last so it sits above terrain, mulch, water
      if (tile.plant) {
        const req = PLANT_REQUIREMENTS[tile.plant.type];
        const emoji = req?.emoji[tile.plant.stage] ?? '🌱';
        ctx.font = `${T - 6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Sway for mature/blooming plants; droop down when wilted
        const sway = tile.plant.stage >= 3 ? Math.sin(tick * 0.04 + tx * 1.3) * 1.5 : 0;
        const droop = tile.plant.isWilted ? 2 : 0;
        if (tile.plant.isWilted) ctx.globalAlpha = 0.60;
        ctx.fillText(emoji, sx + T / 2 + sway, sy + T / 2 + droop);
        ctx.globalAlpha = 1.0;
        // Water-stress droplet indicator (shows when noticeably stressed)
        if (tile.plant.waterStress >= 40) {
          ctx.font = '7px serif';
          ctx.textAlign = 'right';
          ctx.fillText('💧', sx + T - 1, sy + 8);
          ctx.textAlign = 'center';
        }
      }

      // Objective highlight (soft pulsing glow and border)
      const isHighlighted = highlights.some((h) => h.x === tx && h.y === ty);
      if (isHighlighted) {
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.12);
        // Soft fade fill
        ctx.fillStyle = `rgba(255, 220, 40, ${0.08 + pulse * 0.12})`;
        ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
        // Pulsing border
        ctx.strokeStyle = `rgba(255, 220, 40, ${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
      }

      // Bund stencil preview (teal outline — shown while positioning before confirm)
      const isStencil = stencilTiles.some((s) => s.x === tx && s.y === ty);
      if (isStencil) {
        const spulse = 0.5 + 0.5 * Math.sin(tick * 0.10 + tx * 0.5 + ty * 0.5);
        ctx.fillStyle = `rgba(80,210,190,${0.10 + spulse * 0.08})`;
        ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
        ctx.strokeStyle = `rgba(80,210,190,${0.6 + spulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
      }

      // Inspect flash animation — bright flash + pulsing border when a new tile is selected
      if (inspectFlash && inspectFlash.x === tx && inspectFlash.y === ty) {
        const flashElapsed = tick - inspectFlash.startTick;
        const flashDuration = 20; // frames — longer for better visibility
        if (flashElapsed < flashDuration) {
          const flashProgress = 1 - (flashElapsed / flashDuration);
          // Bright white flash
          const flashOpacity = flashProgress * 0.8;
          ctx.fillStyle = `rgba(255, 255, 200, ${flashOpacity})`;
          ctx.fillRect(sx, sy, T, T);
          // Pulsing gold border
          const borderOpacity = flashProgress * 0.9;
          ctx.strokeStyle = `rgba(255, 220, 100, ${borderOpacity})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
        }
      }
    }
  }

  // --- Draw fairies ---
  for (const fairy of gs.fairies) {
    const sx = fairy.px - camX;
    const sy = fairy.py - camY;
    if (sx < -T || sx > W + T || sy < -T || sy > H + T) continue;
    const float = Math.sin(fairy.glowPhase + tick * 0.04) * 2;
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧚', sx, sy + float);
  }

  // --- Draw wildlife entities ---
  for (const entity of gs.entities) {
    const sx = entity.px - camX;
    const sy = entity.py - camY;
    if (sx < -T || sx > W + T || sy < -T || sy > H + T) continue;
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.emoji, sx, sy);
  }

  // --- Draw Moss ---
  {
    const sx = gs.mossTX * T - camX;
    const sy = gs.mossTY * T - camY;
    const bob = Math.sin(tick * 0.05) * 1.5;
    ctx.font = `${T - 2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐸', sx + T / 2, sy + T / 2 + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx + T / 2 - 20, sy - 4, 40, 13);
    ctx.fillStyle = '#fff';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Moss', sx + T / 2, sy + 2);

    // Speech bubble above Moss when player is nearby
    if (showMossHint) {
      const bubblePulse = 0.80 + 0.20 * Math.sin(tick * 0.10);
      ctx.globalAlpha = bubblePulse;
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💬', sx + T / 2, sy - 22);
      ctx.globalAlpha = 1.0;
    }
  }

  // --- Draw player (hidden during cinematic) ---
  if (!gs.cinematicCam) {
    const sx = Math.round(gs.playerPX - camX);
    const sy = Math.round(gs.playerPY - camY);
    const isMoving = gs.playerPX !== gs.playerDestTX * TILE_SIZE || gs.playerPY !== gs.playerDestTY * TILE_SIZE;

    // Draw sprite
    const sprite = getPlayerSprite(gs.playerFacing, isMoving, tick);
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      // Sprite is loaded and ready - draw it centered on the tile
      const spriteWidth = 32;
      const spriteHeight = 32;
      const spriteX = sx + T / 2 - spriteWidth / 2;
      const spriteY = sy + T / 2 - spriteHeight / 2;
      ctx.drawImage(sprite, spriteX, spriteY, spriteWidth, spriteHeight);
    } else {
      // Fallback: draw simple shape if sprite not loaded
      drawPlayerShapeFallback(ctx, sx, sy, T, tick, isMoving);
    }
  }

  // --- Rain ---
  if (gs.isRaining) {
    ctx.strokeStyle = 'rgba(120, 170, 255, 0.6)';
    ctx.lineWidth = 1.2;
    for (const drop of gs.rainDrops) {
      const sx = drop.x - camX;
      const sy = drop.y - camY;
      if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 2, sy + drop.length);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

const INITIAL_UI: UIState = {
  activeTool: 'move',
  selectedSeed: 'blue_grama',
  inspectedTile: null,
  dialogue: null,
  dialogueQueue: [],
  questStep: 'intro',
  questObjective: 'Talk to Moss 🐸',
  restoration: 0,
  unlockedTools: ['move', 'talk', 'journal'],
  showWatershed: false,
  avgMoisture: 8,
  wildlifeCount: 0,
  rainCooling: false,
  heldPlant: null,
  heldEntity: null,
  previousTool: null,
  fastDialogue: false,
  bundMode: null,
  bundTargetTiles: [],
  showSeedPanel: true,
};

export function GameScene({ onShowWatershed, isContinue }: {
  onShowWatershed: (restoration: number, wildlife: string[], fairies: string[], plants: string[]) => void;
  isContinue: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState>(createInitialGameState());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastSaveTickRef = useRef<number>(0);
  const [ui, setUI] = useState<UIState>(INITIAL_UI);
  const uiRef = useRef<UIState>(INITIAL_UI);
  const safeArea = getSafeArea();
  const [frogHeight, setFrogHeight] = useState<number>(280);
  const [gameLoaded, setGameLoaded] = useState(false);

  // Calculate frog height based on screen size
  useEffect(() => {
    const calculateFrogHeight = () => {
      // Scale based on the smaller of width/height, but keep visible minimum
      const minDim = Math.min(window.innerWidth, window.innerHeight);
      const h = Math.min(280, Math.max(50, minDim * 0.4));
      setFrogHeight(Math.round(h));
    };
    calculateFrogHeight();
    window.addEventListener('resize', calculateFrogHeight);
    return () => window.removeEventListener('resize', calculateFrogHeight);
  }, []);

  // Game State Persistence: Load full game state if continuing, save periodically + on quit
  useEffect(() => {
    (async () => {
      try {
        // If continuing, load the full game state
        if (isContinue) {
          const savedState = await RundotGameAPI.appStorage.getItem('quiet-garden-save');
          if (savedState) {
            const loaded = deserializeGameState(savedState);
            if (loaded) {
              gsRef.current = loaded;
              RundotGameAPI.analytics.recordCustomEvent('game_continue_loaded');
            }
          }
        }

        // Always load discoveries (for both new and continue)
        const discoveries = await RundotGameAPI.appStorage.getItem('quiet-garden-discoveries');
        if (discoveries) {
          deserializeDiscoveries(gsRef.current, discoveries);
        }
      } catch (e) {
        console.warn('Failed to load game state:', e);
      } finally {
        setGameLoaded(true);
      }
    })();

    // Ensure music is playing in the game
    if (isMusicEnabled()) {
      playMusic('/cdn-assets/soundtrack.mp3');
    }

    // Preload sound effects in background
    preloadSFX().catch((e) => {
      console.warn('Failed to preload SFX:', e);
    });

    // Save on quit
    const quitHandler = () => {
      try {
        const gameState = serializeGameState(gsRef.current);
        RundotGameAPI.appStorage.setItem('quiet-garden-save', gameState);

        const discoveries = serializeDiscoveries(gsRef.current);
        RundotGameAPI.appStorage.setItem('quiet-garden-discoveries', discoveries);

        RundotGameAPI.analytics.recordCustomEvent('game_state_saved');
      } catch (e) {
        console.warn('Failed to save game state on quit:', e);
      }
    };
    RundotGameAPI.lifecycles.onQuit(quitHandler);

    return () => {
      // Cleanup is handled by RundotGameAPI
    };
  }, [isContinue]);

  // Typewriter animation state
  const [displayedText, setDisplayedText] = useState('');
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTypingRef = useRef(false);

  // Tile info fade animation state
  const [tileInfoFading, setTileInfoFading] = useState(false);
  const [displayedTileInfo, setDisplayedTileInfo] = useState<UIState['inspectedTile'] | null>(null);

  // Audio settings modal
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(true);
  const [musicVolume, setMusicVolumeState] = useState(70);

  // Intro animation: track if dialogue was shown last frame
  const introDialogueWasShownRef = useRef(false);

  // Inspect tile animation: track when a new tile is inspected for flash effect
  const inspectFlashRef = useRef<{ x: number; y: number; startTick: number } | null>(null);

  // Keep uiRef in sync
  useEffect(() => { uiRef.current = ui; }, [ui]);

  // Initialize audio settings
  useEffect(() => {
    const settings = loadAudioSettings();
    setIsMusicOn(settings.musicEnabled);
    setMusicVolumeState(settings.musicVolume);
  }, []);

  // Sync UI state to loaded game state (especially quest progression)
  useEffect(() => {
    if (gameLoaded && isContinue) {
      const gs = gsRef.current;
      const questStep = gs.questStep;
      const objective = getQuestObjective(questStep);

      // Rebuild highlights and tools based on loaded quest step
      const highlights: typeof gs.highlightTiles = [];
      let unlockedTools: ToolType[] = ['move', 'talk', 'journal'];

      switch (questStep) {
        case 'inspect_soil':
          highlights.push(...INSPECT_HIGHLIGHTS);
          unlockedTools.push('inspect');
          break;
        case 'first_rain':
          unlockedTools.push('rain');
          break;
        case 'dig_bund':
          unlockedTools.push('bund', 'shovel');
          break;
        case 'second_rain':
          unlockedTools.push('rain');
          break;
        case 'plant_seed': {
          const bcx = gs.bundCenterTX;
          const bcy = gs.bundCenterTY;
          highlights.push({ x: bcx - 1, y: bcy + 2 }, { x: bcx + 1, y: bcy + 2 });
          unlockedTools.push('seed', 'mulch', 'shovel');
          break;
        }
        case 'free_play':
          unlockedTools = ['move', 'inspect', 'bund', 'mulch', 'seed', 'rain', 'talk', 'journal', 'shovel'];
          break;
      }

      gs.highlightTiles = highlights;
      setUI((prev) => ({
        ...prev,
        questStep,
        questObjective: objective,
        unlockedTools,
        restoration: Math.round(calculateRestoration(gs)),
        avgMoisture: Math.round(gs.tiles.flat().reduce((sum, t) => sum + t.moisture, 0) / (gs.tiles.flat().length || 1)),
        wildlifeCount: gs.discoveredWildlife.length,
      }));
    }
  }, [gameLoaded, isContinue]);

  // Typewriter effect — animate dialogue text unless fast mode is on
  useEffect(() => {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
    isTypingRef.current = false;

    if (!ui.dialogue) {
      setDisplayedText('');
      return;
    }

    const text = ui.dialogue.text;

    if (ui.fastDialogue) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    isTypingRef.current = true;
    let i = 0;
    typewriterRef.current = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typewriterRef.current!);
        typewriterRef.current = null;
        isTypingRef.current = false;
      }
    }, 28);

    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, [ui.dialogue, ui.fastDialogue]);

  // Tile info fade animation — smooth transition when switching inspected tiles
  useEffect(() => {
    if (!ui.inspectedTile) {
      setDisplayedTileInfo(null);
      setTileInfoFading(false);
      return;
    }

    // If this is the same tile, just show it
    if (displayedTileInfo &&
        displayedTileInfo.x === ui.inspectedTile.x &&
        displayedTileInfo.y === ui.inspectedTile.y) {
      return;
    }

    // Different tile — fade out, swap, fade in
    setTileInfoFading(true);
    const timer = setTimeout(() => {
      setDisplayedTileInfo(ui.inspectedTile);
      setTileInfoFading(false);
    }, 150); // Fade out duration

    return () => clearTimeout(timer);
  }, [ui.inspectedTile]);

  // -------------------------------------------------------------------------
  // Dialogue queue management
  // -------------------------------------------------------------------------
  const queueDialogue = useCallback((lines: DialogueLine[]) => {
    if (lines.length === 0) return;
    setUI((prev) => {
      const [first, ...rest] = lines;
      if (!first) return prev;
      // Save the active tool only when transitioning from no-dialogue → dialogue
      const previousTool = prev.dialogue === null ? prev.activeTool : prev.previousTool;
      return { ...prev, dialogue: first, dialogueQueue: rest, previousTool };
    });
  }, []);

  const advanceDialogue = useCallback(() => {
    setUI((prev) => {
      if (prev.dialogueQueue.length === 0) {
        // Dialogue closing — restore the tool that was active before dialogue started
        const restoredTool = (prev.previousTool && prev.unlockedTools.includes(prev.previousTool))
          ? prev.previousTool
          : prev.activeTool;
        return { ...prev, dialogue: null, dialogueQueue: [], activeTool: restoredTool, previousTool: null };
      }
      const [next, ...rest] = prev.dialogueQueue;
      if (!next) {
        const restoredTool = (prev.previousTool && prev.unlockedTools.includes(prev.previousTool))
          ? prev.previousTool
          : prev.activeTool;
        return { ...prev, dialogue: null, dialogueQueue: [], activeTool: restoredTool, previousTool: null };
      }
      return { ...prev, dialogue: next, dialogueQueue: rest };
    });
  }, []);

  // Complete typewriter instantly (jump to full text without advancing the line)
  const completeTyping = useCallback(() => {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
    isTypingRef.current = false;
    if (uiRef.current.dialogue) {
      setDisplayedText(uiRef.current.dialogue.text);
    }
  }, []);

  // Called by any dialogue-advance input (key, click): skip animation first, then next line
  const handleDialogueInput = useCallback(() => {
    if (isTypingRef.current) {
      completeTyping();
    } else {
      advanceDialogue();
    }
  }, [completeTyping, advanceDialogue]);

  // -------------------------------------------------------------------------
  // Quest step transitions
  // -------------------------------------------------------------------------
  const advanceQuest = useCallback((newStep: QuestStep) => {
    gsRef.current.questStep = newStep;

    const highlights: typeof gsRef.current.highlightTiles = [];
    let newTools: ToolType[] = [...uiRef.current.unlockedTools];
    let objective = getQuestObjective(newStep);

    switch (newStep) {
      case 'inspect_soil':
        highlights.push(...INSPECT_HIGHLIGHTS);
        newTools = [...new Set([...newTools, 'inspect' as ToolType])];
        objective = 'Inspect 3 cracked soil tiles';
        break;
      case 'first_rain':
        newTools = [...new Set([...newTools, 'rain' as ToolType])];
        break;
      case 'dig_bund':
        // No pre-set highlights — player positions and confirms the bund stencil themselves
        newTools = [...new Set([...newTools, 'bund' as ToolType, 'shovel' as ToolType])];
        objective = 'Select Dig Bund 🌙 and place the stencil';
        break;
      case 'second_rain':
        newTools = [...new Set([...newTools, 'rain' as ToolType])];
        break;
      case 'plant_seed': {
        // Seed spots are always inside the cup of wherever the bund was dug:
        // one tile each side of the bund center, two rows below it.
        const bcx = gsRef.current.bundCenterTX;
        const bcy = gsRef.current.bundCenterTY;
        highlights.push({ x: bcx - 1, y: bcy + 2 }, { x: bcx + 1, y: bcy + 2 });
        newTools = [...new Set([...newTools, 'seed' as ToolType, 'mulch' as ToolType, 'shovel' as ToolType])];
        break;
      }
      case 'free_play':
        newTools = ['move', 'inspect', 'bund', 'mulch', 'seed', 'rain', 'talk', 'journal', 'shovel'];
        break;
      default:
        break;
    }

    gsRef.current.highlightTiles = highlights;

    setUI((prev) => {
      const newActiveTool = newStep === 'inspect_soil' ? 'inspect' : prev.activeTool;
      return {
        ...prev,
        questStep: newStep,
        questObjective: objective,
        unlockedTools: newTools,
        activeTool: newActiveTool,
        // Keep previousTool in sync so dialogue-close restore doesn't override quest intent
        previousTool: prev.previousTool !== null ? newActiveTool : null,
      };
    });

    const dialogues = getQuestMossDialogue(newStep);

    if (newStep === 'free_play') {
      // Unlock restoration scoring now that the first bund has captured rain
      gsRef.current.firstBundActivated = true;
      track('custom_first_bund_activated');
      RundotGameAPI.analytics.recordCustomEvent('first_bund_activated', { questStep: 'free_play' });
      // Delay the dialogue to prevent it from stacking with other queued messages
      setTimeout(() => {
        queueDialogue([...MOSS_FIRST_RESTORATION_DIALOGUE, ...dialogues]);
      }, 100);
    } else if (dialogues.length > 0) {
      queueDialogue(dialogues);
    }
  }, [queueDialogue]);

  // -------------------------------------------------------------------------
  // Bund stencil: confirm (lock tiles for digging) or cancel
  // -------------------------------------------------------------------------
  const confirmBund = useCallback(() => {
    const gs = gsRef.current;
    const allShapeTiles = BUND_SHAPE_OFFSETS
      .map(({ dx, dy }) => ({ x: gs.playerTX + dx, y: gs.playerTY + dy }));

    const hasRockConflict = allShapeTiles.some(({ x, y }) => {
      if (x <= 0 || x >= MAP_W - 1 || y <= 0 || y >= MAP_H - 1) return false;
      return getTile(gs.tiles, x, y)?.terrain === 'rock';
    });

    const mossInShape = allShapeTiles.some(({ x, y }) => x === gs.mossTX && y === gs.mossTY);

    const validTiles = allShapeTiles.filter(({ x, y }) => {
      if (x <= 0 || x >= MAP_W - 1 || y <= 0 || y >= MAP_H - 1) return false;
      if (x === gs.mossTX && y === gs.mossTY) return false; // never dig under Moss
      const t = getTile(gs.tiles, x, y);
      return t && t.terrain !== 'rock' && t.terrain !== 'water';
    });

    if (validTiles.length === 0) {
      queueDialogue([{
        speaker: 'Moss', emoji: '🐸',
        text: 'Rocks resist the shovel here. Move to softer ground before digging the bund.',
      }]);
      return;
    }

    if (mossInShape) {
      queueDialogue([{
        speaker: 'Moss', emoji: '🐸',
        text: "I'd rather not be dug up, thank you. The rest of the shape is marked — carry on.",
      }]);
    }

    // Remember where the bund was placed so seed spots stay relative to it
    gs.bundCenterTX = gs.playerTX;
    gs.bundCenterTY = gs.playerTY;
    gs.highlightTiles = validTiles;
    setUI((p) => ({
      ...p,
      bundMode: 'digging',
      bundTargetTiles: validTiles,
      questObjective: gs.questStep === 'dig_bund'
        ? `Dig the half-moon bund (0/${validTiles.length})`
        : p.questObjective,
    }));

    if (hasRockConflict) {
      queueDialogue([{
        speaker: 'Moss', emoji: '🐸',
        text: 'Some of the shape sits on rock — those spots will be skipped. Dig what remains.',
      }]);
    }

    // First-time bund digging dialogue
    if (gs.questStep === 'dig_bund' && !gs.bundPlaced) {
      queueDialogue([{
        speaker: 'Moss', emoji: '🐸',
        text: 'Now dig each space until you fill out the template.',
      }]);
    }

    RundotGameAPI.analytics.recordCustomEvent('bund_stencil_confirmed', {
      cx: gs.playerTX, cy: gs.playerTY, tiles: validTiles.length,
    });
  }, [queueDialogue]);

  const cancelBund = useCallback(() => {
    gsRef.current.highlightTiles = [];
    setUI((p) => ({
      ...p,
      bundMode: null,
      bundTargetTiles: [],
      activeTool: 'move',
    }));
  }, []);

  // -------------------------------------------------------------------------
  // Completion event — camera pan → dialogue → landscape tool
  // -------------------------------------------------------------------------
  const triggerCompletionEvent = useCallback(() => {
    track('custom_restoration_complete');
    RundotGameAPI.analytics.recordCustomEvent('restoration_complete', { valley: 'chapter1' });

    const gs = gsRef.current;

    // Waypoints: pan from bund → center map → seed area → player
    const waypoints = [
      { px: 15 * TILE_SIZE, py: 15 * TILE_SIZE }, // bund area
      { px: 16 * TILE_SIZE, py: 16 * TILE_SIZE }, // pond area
      { px: 16 * TILE_SIZE, py: 18 * TILE_SIZE }, // seed / plant area
    ];

    let wp = 0;
    gs.cinematicCam = waypoints[0] ?? null;

    const advanceWaypoint = () => {
      wp++;
      if (wp < waypoints.length) {
        gs.cinematicCam = waypoints[wp] ?? null;
        setTimeout(advanceWaypoint, 2000);
      } else {
        // End cinematic, restore camera
        gs.cinematicCam = null;
        // Show completion dialogue
        queueDialogue(MOSS_COMPLETION_DIALOGUE);
        // After final dialogue clears, unlock landscape tool + show its intro
        // (We use the dialogue closing event via onDialogueEnd, which we handle
        // by checking ui state changes — simpler: delay and then unlock)
        const totalDialogueMs = MOSS_COMPLETION_DIALOGUE.length * 4000;
        setTimeout(() => {
          setUI((prev) => ({
            ...prev,
            unlockedTools: [...prev.unlockedTools, 'landscape' as ToolType],
            questObjective: 'The valley remembers 🌿',
          }));
          queueDialogue(MOSS_LANDSCAPE_DIALOGUE);
          track('custom_landscape_tool_unlocked');
        }, totalDialogueMs);
      }
    };

    setTimeout(advanceWaypoint, 2000);
  }, [queueDialogue]);

  // -------------------------------------------------------------------------
  // Player movement
  // -------------------------------------------------------------------------
  const movePlayer = useCallback((dx: number, dy: number) => {
    const gs = gsRef.current;
    const nx = gs.playerTX + dx;
    const ny = gs.playerTY + dy;
    if (nx < 1 || nx >= MAP_W - 1 || ny < 1 || ny >= MAP_H - 1) return;
    const tile = getTile(gs.tiles, nx, ny);
    if (!tile || tile.terrain === 'rock' || tile.terrain === 'water') return;
    if (nx === gs.mossTX && ny === gs.mossTY) return; // can't step on Moss

    gs.playerTX = nx;
    gs.playerTY = ny;
    gs.playerDestTX = nx;
    gs.playerDestTY = ny;
    if (dx > 0) gs.playerFacing = 'e';
    if (dx < 0) gs.playerFacing = 'w';
    if (dy > 0) gs.playerFacing = 's';
    if (dy < 0) gs.playerFacing = 'n';

    // Play footstep sound
    playSFX('footstep', 0.5).catch(() => {});
    track('sfx_footstep');
  }, []);

  // -------------------------------------------------------------------------
  // Helper: move Moss to a nearby free adjacent tile
  // -------------------------------------------------------------------------
  const moveMossAway = (fromTX: number, fromTY: number): void => {
    const gs = gsRef.current;
    const candidates = [
      { x: fromTX - 1, y: fromTY }, { x: fromTX + 1, y: fromTY },
      { x: fromTX, y: fromTY - 1 }, { x: fromTX, y: fromTY + 1 },
      { x: fromTX - 1, y: fromTY - 1 }, { x: fromTX + 1, y: fromTY - 1 },
      { x: fromTX - 1, y: fromTY + 1 }, { x: fromTX + 1, y: fromTY + 1 },
    ].filter(({ x, y }) => {
      if (x <= 0 || x >= MAP_W - 1 || y <= 0 || y >= MAP_H - 1) return false;
      const t = getTile(gs.tiles, x, y);
      return t && t.terrain !== 'rock' && t.terrain !== 'water';
    });
    if (candidates[0]) {
      gs.mossTX = candidates[0].x;
      gs.mossTY = candidates[0].y;
    }
  };

  // -------------------------------------------------------------------------
  // Tool use on a tile
  // -------------------------------------------------------------------------
  const useTool = useCallback(
    (tx: number, ty: number) => {
      const gs = gsRef.current;
      const currentUI = uiRef.current;
      const tool = currentUI.activeTool;

      if (!currentUI.unlockedTools.includes(tool)) return;

      // Disable all input during intro cinematic animation
      if (gs.introAnimationState) return;

      if (tool === 'move') {
        const tile = getTile(gs.tiles, tx, ty);
        if (!tile || tile.terrain === 'rock' || tile.terrain === 'water') return;

        let destX = tx, destY = ty;

        // Magnetic redirect: clicking Moss's tile routes to the nearest free adjacent tile
        if (tx === gs.mossTX && ty === gs.mossTY) {
          const candidates = [
            { x: tx - 1, y: ty }, { x: tx + 1, y: ty },
            { x: tx, y: ty - 1 }, { x: tx, y: ty + 1 },
            { x: tx - 1, y: ty - 1 }, { x: tx + 1, y: ty - 1 },
            { x: tx - 1, y: ty + 1 }, { x: tx + 1, y: ty + 1 },
          ].filter(({ x, y }) => {
            if (x <= 0 || x >= MAP_W - 1 || y <= 0 || y >= MAP_H - 1) return false;
            const t = getTile(gs.tiles, x, y);
            return t && t.terrain !== 'rock' && t.terrain !== 'water';
          });
          // Prefer candidate with the smallest X distance from player (horizontal bias)
          candidates.sort((a, b) => Math.abs(a.x - gs.playerTX) - Math.abs(b.x - gs.playerTX));
          if (!candidates[0]) return;
          destX = candidates[0].x;
          destY = candidates[0].y;
        }

        gs.playerDestTX = destX;
        gs.playerDestTY = destY;
        gs.playerTX = destX;
        gs.playerTY = destY;
        return;
      }

      if (tool === 'inspect') {
        const tile = getTile(gs.tiles, tx, ty);
        if (!tile) return;

        // During inspect_soil quest, only allow inspecting highlighted tiles
        if (gs.questStep === 'inspect_soil') {
          const isHighlighted = gs.highlightTiles.some((h) => h.x === tx && h.y === ty);
          if (!isHighlighted) {
            return;  // Prevent inspection of non-highlighted tiles during quest
          }
        }

        setUI((prev) => ({ ...prev, inspectedTile: { x: tx, y: ty, tile: { ...tile } } }));
        // Trigger inspect flash animation
        inspectFlashRef.current = { x: tx, y: ty, startTick: gs.tick };
        track('custom_tile_inspected', { terrain: tile.terrain, moisture: Math.round(tile.moisture) });
        RundotGameAPI.analytics.recordCustomEvent('tile_inspected', { terrain: tile.terrain });

        if (gs.questStep === 'inspect_soil') {
          // Only count if this specific highlighted tile was clicked; remove it on inspection
          const wasHighlighted = gs.highlightTiles.some((h) => h.x === tx && h.y === ty);
          if (wasHighlighted) {
            gs.highlightTiles = gs.highlightTiles.filter((h) => !(h.x === tx && h.y === ty));
            gs.inspectedCount++;
            if (gs.inspectedCount >= 3) {
              advanceQuest('first_rain');
            }
          }
        }
        return;
      }

      if (tool === 'bund') {
        // Bund is only actionable once the stencil is confirmed (digging mode).
        // In positioning mode the canvas tap just moves the player — no digging.
        if (currentUI.bundMode !== 'digging') return;

        // Quest restriction: bund tool locked after bund is placed until seeds are grown
        if (gs.questStep === 'second_rain' || gs.questStep === 'plant_seed') {
          queueDialogue([{
            speaker: 'Moss', emoji: '🐸',
            text: 'The half-moon is complete. Tend to the seeds first.',
          }]);
          return;
        }

        // Must click within the confirmed target tiles
        const inTarget = currentUI.bundTargetTiles.some(({ x, y }) => x === tx && y === ty);
        if (!inTarget) {
          queueDialogue([{
            speaker: 'Moss', emoji: '🐸',
            text: 'Follow the shape. Dig only within the glowing tiles.',
          }]);
          return;
        }

        // Block digging on plant tiles
        const bundTile = getTile(gs.tiles, tx, ty);
        if (bundTile?.plant) {
          queueDialogue([{
            speaker: 'Moss', emoji: '🐸',
            text: 'Remove the plant first before reshaping the land.',
          }]);
          return;
        }

        const ok = applyBund(gs, tx, ty);
        if (ok) {
          playSFX('bund', 0.6).catch(() => {});
          track('custom_bund_placed', { tx, ty });
          RundotGameAPI.analytics.recordCustomEvent('bund_placed', { tx, ty });

          const total = currentUI.bundTargetTiles.length;
          const dug = currentUI.bundTargetTiles.filter(
            ({ x, y }) => getTile(gs.tiles, x, y)?.terrain === 'bund',
          ).length;

          if (dug >= total) {
            // Bund fully dug — clear stencil state
            gs.highlightTiles = [];
            setUI((p) => ({ ...p, bundMode: null, bundTargetTiles: [] }));
            if (gs.questStep === 'dig_bund') {
              advanceQuest('second_rain');
            }
          } else {
            setUI((p) => ({ ...p, questObjective: gs.questStep === 'dig_bund'
              ? `Dig the half-moon bund (${dug}/${total})`
              : p.questObjective,
            }));
          }
        }
        return;
      }

      if (tool === 'mulch') {
        // Block mulching on plant tiles
        const mulchTile = getTile(gs.tiles, tx, ty);
        if (mulchTile?.plant) {
          queueDialogue([{
            speaker: 'Moss', emoji: '🐸',
            text: 'This plant is already established here. Mulch the empty soil nearby instead.',
          }]);
          return;
        }
        const ok = applyMulch(gs, tx, ty);
        if (ok) {
          track('custom_mulch_placed', { tx, ty });
          RundotGameAPI.analytics.recordCustomEvent('mulch_placed', { tx, ty });
        }
        return;
      }

      if (tool === 'shovel') {
        // Clicking any tile within the active bund (whether already dug or not)
        // undoes the entire bund in one action.
        const inActiveBund = currentUI.bundTargetTiles.some(({ x, y }) => x === tx && y === ty);
        if (inActiveBund) {
          for (const { x, y } of currentUI.bundTargetTiles) {
            const t = getTile(gs.tiles, x, y);
            if (t?.terrain === 'bund') applyShovel(gs, x, y);
          }
          gs.highlightTiles = [];
          setUI((p) => ({ ...p, bundMode: null, bundTargetTiles: [] }));
          track('custom_bund_undone');
          RundotGameAPI.analytics.recordCustomEvent('bund_undone', {
            tiles: currentUI.bundTargetTiles.length,
          });
          return;
        }

        const ok = applyShovel(gs, tx, ty);
        if (ok) {
          track('custom_shovel_used', { tx, ty });
          RundotGameAPI.analytics.recordCustomEvent('shovel_used', { tx, ty });

          // Play undo sound when removing things
          playSFX('undo', 0.5).catch(() => {});
        }
        return;
      }

      if (tool === 'landscape') {
        const result = applyLandscape(gs, tx, ty, currentUI.heldEntity);
        if (result.action === 'picked') {
          setUI((p) => ({ ...p, heldEntity: result.entity }));
          track('custom_landscape_picked');
        } else if (result.action === 'placed') {
          setUI((p) => ({ ...p, heldEntity: null }));
          track('custom_landscape_placed', { tx, ty, type: result.entity?.type ?? 'unknown' });
          RundotGameAPI.analytics.recordCustomEvent('landscape_placed', { tx, ty, type: result.entity?.type ?? 'unknown' });
        }
        return;
      }

      if (tool === 'seed') {
        // Seed spots always relative to wherever the bund was confirmed
        const seedSpots = [
          { x: gs.bundCenterTX - 1, y: gs.bundCenterTY + 2 },
          { x: gs.bundCenterTX + 1, y: gs.bundCenterTY + 2 },
        ];
        if (gs.questStep === 'plant_seed') {
          const inSpot = seedSpots.some(({ x, y }) => x === tx && y === ty);
          if (!inSpot) {
            queueDialogue([{
              speaker: 'Moss', emoji: '🐸',
              text: 'Plant in the two glowing spots inside the cup. The moisture is best there.',
            }]);
            return;
          }
        }
        // Move Moss away if she's blocking the seed spot
        if (tx === gs.mossTX && ty === gs.mossTY) {
          moveMossAway(tx, ty);
        }
        const result = applyPlantSeed(gs, tx, ty, currentUI.selectedSeed);
        if (result.planted) {
          const name = PLANT_REQUIREMENTS[currentUI.selectedSeed]?.name ?? currentUI.selectedSeed;
          track('custom_seed_planted', { plant: currentUI.selectedSeed });
          RundotGameAPI.analytics.recordCustomEvent('seed_planted', { plant: currentUI.selectedSeed });

          // Play planting sound
          playSFX('planting', 0.6).catch(() => {});
          if (gs.questStep === 'plant_seed') {
            const bothPlanted = seedSpots.every(
              ({ x, y }) => getTile(gs.tiles, x, y)?.plant != null,
            );
            if (bothPlanted) {
              advanceQuest('free_play');
            } else {
              const count = seedSpots.filter(
                ({ x, y }) => getTile(gs.tiles, x, y)?.plant != null,
              ).length;
              setUI((p) => ({ ...p, questObjective: `Plant Blue Grama Grass (${count}/${seedSpots.length})` }));
              queueDialogue([{
                speaker: 'Moss', emoji: '🐸',
                text: `A ${name} seed goes in. Now plant one more in the other glowing spot.`,
              }]);
            }
          } else {
            // Show Moss's message only the first time a seed is planted per selection.
            // Resets when the player switches tools or changes seed type.
            if (seedMsgShownRef.current !== currentUI.selectedSeed) {
              seedMsgShownRef.current = currentUI.selectedSeed;
              queueDialogue([{
                speaker: 'Moss', emoji: '🐸',
                text: `A ${name} seed goes in. The soil will know what to do.`,
              }]);
            }
          }
        } else if (result.reason) {
          queueDialogue([{ speaker: 'Moss', emoji: '🐸', text: result.reason }]);
        }
        return;
      }

      if (tool === 'talk') {
        const dialogues = getQuestMossDialogue(gs.questStep);
        queueDialogue(dialogues.length > 0 ? dialogues : [{
          speaker: 'Moss', emoji: '🐸',
          text: 'The valley heals slowly, like memory. Each action reaches forward in time.',
        }]);
        track('custom_moss_talked');
        return;
      }

      if (tool === 'journal') {
        onShowWatershed(
          calculateRestoration(gs),
          [...gs.discoveredWildlife],
          [...gs.discoveredFairies],
          [...gs.discoveredPlants],
        );
        track('custom_journal_opened');
        return;
      }

      if (tool === 'rain') {
        if (gs.isRaining) {
          queueDialogue([{ speaker: 'Moss', emoji: '🐸', text: 'The rain is already falling. Let it do its work.' }]);
          return;
        }
        const currentRestoration = calculateRestoration(gs);
        triggerRain(gs, currentRestoration);
        playSFX('rain', 0.5).catch(() => {});
        track('custom_rain_called', { rains: gs.rainsCount });

        if (gs.questStep === 'first_rain') {
          setTimeout(() => {
            queueDialogue([{
              speaker: 'Moss', emoji: '🐸',
              text: 'The rain came. But the valley could not hold it.',
            }]);
            advanceQuest('dig_bund');
          }, 6000);
        } else if (gs.questStep === 'second_rain') {
          setTimeout(() => {
            queueDialogue([{
              speaker: 'Moss', emoji: '🐸',
              text: 'Do not chase the rain. Invite it to stay.',
            }]);
            advanceQuest('plant_seed');
          }, 6000);
        } else {
          const restoration = calculateRestoration(gs);
          if (restoration > 0) {
            setTimeout(() => {
              queueDialogue([{
                speaker: 'Moss', emoji: '🐸',
                text: `Moisture rises. The valley remembers a little more. ${restoration}% restored.`,
              }]);
            }, 4000);
          }
        }
        return;
      }
    },
    [advanceQuest, queueDialogue, onShowWatershed],
  );

  // -------------------------------------------------------------------------
  // Input handling
  // -------------------------------------------------------------------------
  // Track which seed type has already shown Moss's "seed goes in" message this selection.
  // Resets when the player switches tools or changes seed type.
  const seedMsgShownRef = useRef<PlantType | null>(null);

  const keydownRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const keyCooldown = useRef(false);

  useEffect(() => {
    keydownRef.current = (e: KeyboardEvent) => {
      if (keyCooldown.current) return;
      const currentUI = uiRef.current;

      // While dialogue is active: any printable key, enter, space, or escape advances it
      if (currentUI.dialogue) {
        const isAdvanceKey = (e.key.length === 1 || e.key === 'Enter' || e.key === 'Escape')
          && !e.ctrlKey && !e.metaKey;
        if (isAdvanceKey) handleDialogueInput();
        return;
      }

      if (e.key === 'Escape') {
        if (currentUI.bundMode === 'positioning') { cancelBund(); return; }
        if (currentUI.inspectedTile) setUI((p) => ({ ...p, inspectedTile: null }));
        return;
      }

      // Enter confirms bund placement while in positioning mode
      if (e.key === 'Enter' && currentUI.bundMode === 'positioning') {
        confirmBund();
        return;
      }

      // Inspect mode: movement disabled — player must switch back to Move first
      if (currentUI.activeTool === 'inspect') return;

      const mvMap: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
        W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
      };
      const mv = mvMap[e.key];
      if (mv) {
        movePlayer(mv[0], mv[1]);
        keyCooldown.current = true;
        setTimeout(() => { keyCooldown.current = false; }, 140);
      }
    };
  }, [handleDialogueInput, movePlayer, confirmBund, cancelBund]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keydownRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // -------------------------------------------------------------------------
  // Canvas click → tile coordinate → tool use
  // -------------------------------------------------------------------------
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      // When dialogue is showing: canvas tap advances it (same as tapping the dialogue box)
      if (uiRef.current.dialogue !== null) {
        handleDialogueInput();
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ('touches' in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        if (!t) return;
        clientX = t.clientX;
        clientY = t.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const gs = gsRef.current;
      const currentUI = uiRef.current;
      const camCenter = gs.cinematicCam ?? { px: gs.playerPX, py: gs.playerPY };
      const camX = Math.round(camCenter.px - canvas.width / 2 + TILE_SIZE / 2);
      const camY = Math.round(camCenter.py - canvas.height / 2 + TILE_SIZE / 2);

      const worldX = (clientX - rect.left) * (canvas.width / rect.width) + camX;
      const worldY = (clientY - rect.top) * (canvas.height / rect.height) + camY;

      // Check if clicked on speech bubble above Moss
      const playerNearMoss =
        Math.abs(gs.playerTX - gs.mossTX) <= 2 &&
        Math.abs(gs.playerTY - gs.mossTY) <= 2;
      const showMossHint = playerNearMoss && currentUI.activeTool === 'move' && !currentUI.dialogue;
      if (showMossHint) {
        // Moss's bubble is at (mossTX * TILE_SIZE + TILE_SIZE/2, mossTY * TILE_SIZE - TILE_SIZE + 2)
        const mossBubbleWorldX = gs.mossTX * TILE_SIZE + TILE_SIZE / 2;
        const mossBubbleWorldY = gs.mossTY * TILE_SIZE - TILE_SIZE + 2;
        const mossBubbleScreenX = mossBubbleWorldX - camX;
        const mossBubbleScreenY = mossBubbleWorldY - camY;
        const screenX = (clientX - rect.left) * (canvas.width / rect.width);
        const screenY = (clientY - rect.top) * (canvas.height / rect.height);
        const bubbleRadius = 10;
        const distSq = (screenX - mossBubbleScreenX) ** 2 + (screenY - mossBubbleScreenY) ** 2;
        if (distSq <= bubbleRadius ** 2) {
          // Prevent speech bubble interaction during intro animation
          if (gs.introAnimationState) return;
          // Clicked on speech bubble — talk to Moss
          if (gs.questStep === 'intro') {
            // Don't repeat intro dialogue — advance directly to inspect_soil
            advanceQuest('inspect_soil');
            queueDialogue(getQuestMossDialogue('inspect_soil'));
          } else {
            const dialogues = getQuestMossDialogue(gs.questStep);
            queueDialogue(dialogues.length > 0 ? dialogues : [{
              speaker: 'Moss', emoji: '🐸',
              text: 'The valley heals slowly, like memory. Each action reaches forward in time.',
            }]);
          }
          track('custom_moss_talked');
          return;
        }
      }

      const tx = Math.floor(worldX / TILE_SIZE);
      const ty = Math.floor(worldY / TILE_SIZE);

      useTool(tx, ty);
    },
    [useTool, handleDialogueInput],
  );

  // -------------------------------------------------------------------------
  // Game loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Start intro dialogue
    queueDialogue(getQuestMossDialogue('intro'));

    const loop = (timestamp: number) => {
      const dt = Math.min(50, timestamp - (lastTimeRef.current || timestamp));
      lastTimeRef.current = timestamp;

      const gs = gsRef.current;

      // Smooth player pixel position toward destination
      const destPX = gs.playerDestTX * TILE_SIZE;
      const destPY = gs.playerDestTY * TILE_SIZE;
      const speed = 200; // pixels per second
      const maxMove = speed * (dt / 1000);
      const dxPx = destPX - gs.playerPX;
      const dyPx = destPY - gs.playerPY;
      const dist = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
      if (dist > 0.5) {
        const ratio = Math.min(1, maxMove / dist);
        gs.playerPX += dxPx * ratio;
        gs.playerPY += dyPx * ratio;
      } else {
        gs.playerPX = destPX;
        gs.playerPY = destPY;
      }

      updateGame(
        gs,
        dt,
        (restoration, avgMoisture, wildlifeCount, questStep) => {
          setUI((prev) => ({ ...prev, restoration, avgMoisture, wildlifeCount, questStep }));
        },
        (_milestone, line) => {
          // Ecological milestone — Moss comments on ecosystem recovery
          queueDialogue([line]);
        },
        () => {
          // 100% restoration completion
          triggerCompletionEvent();
        },
        () => {
          // First plant wilt — show Moss tutorial once
          queueDialogue([
            { speaker: 'Moss', emoji: '🐸', text: 'This one is thirsty.' },
            { speaker: 'Moss', emoji: '🐸', text: 'The land is still learning to hold rain.' },
            { speaker: 'Moss', emoji: '🐸', text: 'Try rain, mulch, or a bund nearby.' },
          ]);
        },
      );

      // Periodic Persistence: Save game state and discoveries every 30 ticks (~0.5s at 60fps)
      if (gs.tick - lastSaveTickRef.current >= 30) {
        lastSaveTickRef.current = gs.tick;
        try {
          const gameState = serializeGameState(gs);
          RundotGameAPI.appStorage.setItem('quiet-garden-save', gameState);

          const discoveries = serializeDiscoveries(gs);
          RundotGameAPI.appStorage.setItem('quiet-garden-discoveries', discoveries);
        } catch (e) {
          console.warn('Failed to save game state:', e);
        }
      }

      // Intro animation: detect when dialogue finishes and trigger Moss walk
      const currentUI = uiRef.current;
      const dialogueNowShowing = currentUI.dialogue !== null;
      if (introDialogueWasShownRef.current && !dialogueNowShowing && gs.questStep === 'intro' && !gs.introAnimationState) {
        // Dialogue just finished — start the animation
        // Both player and Moss walk toward each other, meet, then walk back
        gs.introAnimationState = {
          startTick: gs.tick,
          targetTX: gs.playerTX,
          targetTY: gs.playerTY,
          originalTX: gs.mossTX,
          originalTY: gs.mossTY,
          playerOriginalTX: gs.playerTX,
          playerOriginalTY: gs.playerTY,
        } as any;
        track('cinematic_intro_animation', {});
        RundotGameAPI.analytics.recordCustomEvent('cinematic_intro_animation', {});
      }
      introDialogueWasShownRef.current = dialogueNowShowing;

      // Update both player and Moss positions during intro animation
      if (gs.introAnimationState) {
        const elapsed = gs.tick - gs.introAnimationState.startTick;
        const meetDuration = 100; // meet in middle — slow and graceful
        const walkDuration = 140; // walk to rock together — leisurely pace
        const circleDuration = 180; // circle around rock smoothly — enjoy the moment
        const returnDuration = 140; // return home — reflective walk
        const totalDuration = meetDuration + walkDuration + circleDuration + returnDuration;

        // Rock location — the gray rock on the right side
        const rockCX = 26;
        const rockCY = 20;

        if (elapsed < meetDuration) {
          // Phase 1: Walk toward each other to meet
          const progress = elapsed / meetDuration;
          const midX = (gs.introAnimationState.originalTX + gs.introAnimationState.targetTX) / 2;
          const midY = (gs.introAnimationState.originalTY + gs.introAnimationState.targetTY) / 2;

          gs.mossTX = Math.round(
            gs.introAnimationState.originalTX + (midX - gs.introAnimationState.originalTX) * progress
          );
          gs.mossTY = Math.round(
            gs.introAnimationState.originalTY + (midY - gs.introAnimationState.originalTY) * progress
          );
          gs.playerDestTX = Math.round(
            gs.introAnimationState.playerOriginalTX + (midX - gs.introAnimationState.playerOriginalTX) * progress
          );
          gs.playerDestTY = Math.round(
            gs.introAnimationState.playerOriginalTY + (midY - gs.introAnimationState.playerOriginalTY) * progress
          );
        } else if (elapsed < meetDuration + walkDuration) {
          // Phase 2: Walk together toward the rock on the right
          const progress = (elapsed - meetDuration) / walkDuration;
          const midX = (gs.introAnimationState.originalTX + gs.introAnimationState.targetTX) / 2;
          const midY = (gs.introAnimationState.originalTY + gs.introAnimationState.targetTY) / 2;

          gs.mossTX = Math.round(
            midX + (rockCX - midX) * progress
          );
          gs.mossTY = Math.round(
            midY + (rockCY - midY) * progress
          );
          gs.playerDestTX = Math.round(
            midX + (rockCX + 2 - midX) * progress
          );
          gs.playerDestTY = Math.round(
            midY + (rockCY - midY) * progress
          );
        } else if (elapsed < meetDuration + walkDuration + circleDuration) {
          // Phase 3: Circle smoothly around the rock
          const circleProgress = (elapsed - meetDuration - walkDuration) / circleDuration;
          const angle = circleProgress * Math.PI * 2;
          const radius = 2.5;

          gs.mossTX = Math.round(rockCX + radius * Math.cos(angle));
          gs.mossTY = Math.round(rockCY + radius * Math.sin(angle));
          gs.playerDestTX = Math.round(rockCX + radius * Math.cos(angle + Math.PI));
          gs.playerDestTY = Math.round(rockCY + radius * Math.sin(angle + Math.PI));
        } else if (elapsed < totalDuration) {
          // Phase 4: Return to original positions
          const returnProgress = (elapsed - meetDuration - walkDuration - circleDuration) / returnDuration;
          const rockAtX = rockCX;
          const rockAtY = rockCY;

          gs.mossTX = Math.round(
            rockAtX + (gs.introAnimationState.originalTX - rockAtX) * returnProgress
          );
          gs.mossTY = Math.round(
            rockAtY + (gs.introAnimationState.originalTY - rockAtY) * returnProgress
          );
          gs.playerDestTX = Math.round(
            rockAtX + 2 + (gs.introAnimationState.playerOriginalTX - rockAtX - 2) * returnProgress
          );
          gs.playerDestTY = Math.round(
            rockAtY + (gs.introAnimationState.playerOriginalTY - rockAtY) * returnProgress
          );
        } else {
          // Animation complete
          gs.mossTX = gs.introAnimationState.originalTX;
          gs.mossTY = gs.introAnimationState.originalTY;
          gs.playerDestTX = gs.introAnimationState.playerOriginalTX;
          gs.playerDestTY = gs.introAnimationState.playerOriginalTY;
          gs.introAnimationState = null;
        }
      }

      // Bund stencil: compute valid tiles from player position during positioning mode
      const stencilTiles = currentUI.bundMode === 'positioning'
        ? BUND_SHAPE_OFFSETS
            .map(({ dx, dy }) => ({ x: gs.playerTX + dx, y: gs.playerTY + dy }))
            .filter(({ x, y }) => x > 0 && x < MAP_W - 1 && y > 0 && y < MAP_H - 1)
        : [];

      // Moss proximity hint
      const playerNearMoss =
        Math.abs(gs.playerTX - gs.mossTX) <= 2 &&
        Math.abs(gs.playerTY - gs.mossTY) <= 2;
      const showMossHint =
        playerNearMoss && currentUI.activeTool === 'move' && !currentUI.dialogue;

      // Imperative cursor — keeps React style clean and lets the loop override for Moss
      if (currentUI.dialogue) {
        canvas.style.cursor = 'default';
      } else if (currentUI.activeTool === 'landscape' && currentUI.heldEntity) {
        canvas.style.cursor = 'grabbing';
      } else if (showMossHint) {
        canvas.style.cursor = 'pointer';
      } else if (currentUI.activeTool === 'move') {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = 'pointer';
      }

      renderFrame(canvas, gs, gs.highlightTiles, gs.tick, stencilTiles, showMossHint, inspectFlashRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [gameLoaded, queueDialogue, triggerCompletionEvent]);

  // -------------------------------------------------------------------------
  // Layout constants
  // -------------------------------------------------------------------------
  const TOOLBAR_H = 82;
  const HUD_H = 60;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Don't render game until state is loaded
  if (!gameLoaded) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#1A1A1A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        Loading game...
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1A1A1A',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: safeArea.top,
        paddingBottom: safeArea.bottom,
      }}
    >
      <style>{`
        @keyframes questFlicker {
          0%   { border-color: rgba(255,220,40,0.0); box-shadow: none; }
          15%  { border-color: rgba(255,220,40,0.9); box-shadow: 0 0 7px rgba(255,220,40,0.5); }
          30%  { border-color: rgba(255,220,40,0.2); box-shadow: none; }
          50%  { border-color: rgba(255,220,40,0.9); box-shadow: 0 0 7px rgba(255,220,40,0.5); }
          70%  { border-color: rgba(255,220,40,0.2); box-shadow: none; }
          85%  { border-color: rgba(255,220,40,0.6); box-shadow: 0 0 4px rgba(255,220,40,0.3); }
          100% { border-color: rgba(255,220,40,0.0); box-shadow: none; }
        }
        .quest-objective {
          animation: questFlicker 2.4s ease-in-out infinite;
          border: 1px solid rgba(255,220,40,0);
        }
        @keyframes toolPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(124,202,124,0.5); }
          50% { box-shadow: 0 0 8px rgba(124,202,124,0.8); }
        }
        .tool-active {
          animation: toolPulse 1.8s ease-in-out infinite;
        }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        .dialogue-cursor { animation: blink 0.65s step-end infinite; }
      `}</style>

      {/* ── Top HUD ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: safeArea.top,
          left: 0,
          right: 0,
          minHeight: HUD_H,
          background: 'rgba(20,35,20,0.85)',
          backdropFilter: 'blur(4px)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'flex-start',
          padding: '12px 12px 8px',
          gap: 10,
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ fontSize: 11, color: '#7CCA7C', fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1 }}>
            THE QUIET GARDEN
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 1, lineHeight: 1 }}>
            Ch.1: The Valley That Forgot the Rain
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
            <div
              key={ui.questStep}
              className="quest-objective"
              style={{
                fontSize: 9,
                color: '#F0FFF0',
                padding: '2px 6px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 4,
                display: 'inline-block',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              ▸ {ui.questObjective}
            </div>
            <button
              onClick={() => {
                setShowAudioSettings(true);
                track('custom_audio_settings_opened');
              }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#7CCA7C',
                padding: '2px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 8,
                fontWeight: 'bold',
                transition: 'all 0.15s ease',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
            >
              Audio
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7CCA7C', lineHeight: 1 }}>
              {ui.restoration}%
            </div>
            {(() => {
              let badge = '';
              let color = '';
              if (ui.restoration >= 70) {
                badge = '◆ Resilient';
                color = '#4CAF50';  // Green
              } else if (ui.restoration >= 40) {
                badge = '▲ Recovering';
                color = '#FFC107';  // Yellow
              } else {
                badge = '● Fragile';
                color = '#F44336';  // Red
              }
              return (
                <div style={{ fontSize: 7, fontWeight: 700, color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {badge}
                </div>
              );
            })()}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>restored</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
            💧{Math.round(ui.avgMoisture)}% · 🐾{ui.wildlifeCount}
          </div>
        </div>
      </div>

      {/* ── Game Canvas ──────────────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
        onClick={handleCanvasClick}
        onTouchEnd={handleCanvasClick}
      />

      {/* ── Tile Inspect Panel ───────────────────────────────────────────── */}
      {displayedTileInfo && !ui.dialogue && (
        <div
          style={{
            position: 'absolute',
            top: HUD_H + safeArea.top + 8,
            right: 8,
            width: 170,
            background: 'rgba(20,35,20,0.92)',
            borderRadius: 10,
            border: '1px solid rgba(124,202,124,0.3)',
            padding: 12,
            zIndex: 30,
            color: '#F0FFF0',
            opacity: tileInfoFading ? 0 : 1,
            transition: 'opacity 150ms ease-in-out',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#7CCA7C', letterSpacing: '0.07em' }}>
              Tile Info
            </div>
            <button
              onClick={() => setUI((p) => ({ ...p, inspectedTile: null }))}
              style={{ background: 'none', border: 'none', color: '#7CCA7C', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
          {((): React.ReactNode => {
            const t = displayedTileInfo.tile;
            const terrainLabels: Record<string, string> = {
              cracked_soil: 'Cracked Soil', dry_soil: 'Dry Soil', mulch: 'Mulch',
              bund: 'Semicircular Bund', moist_soil: 'Moist Soil', grass: 'Grass',
              rock: 'Rock', water: 'Seasonal Pool',
            };
            const label = terrainLabels[t.terrain] ?? t.terrain;
            const suggMap: Record<string, string> = {
              cracked_soil: 'Dig a bund uphill or add mulch to slow runoff.',
              dry_soil: 'Mulch will help this soil hold moisture.',
              mulch: 'Ready for planting when moisture rises.',
              bund: 'Catching rain — good placement!',
              moist_soil: 'Good conditions — try planting a pioneer species.',
              grass: 'This area is healing well.',
              rock: 'Rocks shelter seeds and reduce wind erosion.',
              water: 'A permanent water feature. Life will gather here.',
            };
            const suggestion = suggMap[t.terrain] ?? 'Inspect nearby tiles to understand water flow.';
            return (
              <div style={{ fontSize: 10, color: 'rgba(240,255,240,0.8)', lineHeight: 1.7 }}>
                <div><b>Terrain:</b> {label}</div>
                <div><b>Moisture:</b> {Math.round(t.moisture)}%</div>
                <div><b>Fertility:</b> {Math.round(t.fertility)}%</div>
                <div><b>Erosion risk:</b> {Math.round(t.erosion)}%</div>
                <div style={{ marginTop: 6, fontStyle: 'italic', opacity: 0.8 }}>{renderDialogueText(suggestion)}</div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Dialogue Box ─────────────────────────────────────────────────── */}
      {ui.dialogue && (() => {
        const isTyping = displayedText !== ui.dialogue.text;
        return (
          <div
            style={{
              position: 'fixed',
              bottom: safeArea.bottom,
              left: 0,
              right: 0,
              zIndex: 44,
              overflow: 'visible',
              display: 'flex',
              justifyContent: 'center',
              paddingLeft: 8,
              paddingRight: 8,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                overflow: 'visible',
              }}
            >
            {/* Dialogue panel */}
            <div
              style={{
                background: 'rgb(45, 30, 20)',
                borderRadius: 12,
                padding: 14,
                paddingRight: 14,
                height: 160,
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={handleDialogueInput}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '100%', minWidth: 0 }}>
                <span style={{ fontSize: 30, flexShrink: 0, lineHeight: 1.1 }}>{ui.dialogue.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: '#7CCA7C', fontWeight: 700, marginBottom: 4 }}>
                    {ui.dialogue.speaker}
                  </div>
                  <div style={{ fontSize: 13, color: '#F0FFF0', lineHeight: 1.55, fontStyle: 'italic', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                    &ldquo;{renderDialogueText(displayedText)}&rdquo;
                    {isTyping && <span className="dialogue-cursor" style={{ color: '#7CCA7C', marginLeft: 1 }}>▌</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <button
                  onClick={(evt) => {
                    evt.stopPropagation();
                    setUI((p) => ({ ...p, fastDialogue: !p.fastDialogue }));
                    track('custom_fast_dialogue_toggled', { enabled: !ui.fastDialogue });
                    RundotGameAPI.analytics.recordCustomEvent('fast_dialogue_toggled', { enabled: !ui.fastDialogue });
                  }}
                  style={{
                    background: ui.fastDialogue ? 'rgba(124,202,124,0.2)' : 'transparent',
                    border: `1px solid ${ui.fastDialogue ? 'rgba(124,202,124,0.5)' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 6,
                    padding: '2px 7px',
                    color: ui.fastDialogue ? '#7CCA7C' : 'rgba(240,255,240,0.4)',
                    fontSize: 9,
                    cursor: 'pointer',
                  }}
                >
                  {ui.fastDialogue ? '⚡ Fast' : '⏤ Normal'}
                </button>
                <div style={{ fontSize: 9, color: 'rgba(240,255,240,0.45)', paddingRight: 8 }}>
                  {isTyping ? 'tap to skip ▸' : 'tap to continue ▸'}
                </div>
              </div>
            </div>
            </div>
          </div>
        );
      })()}

      {/* Moss portrait — smoothly scales with screen size */}
      {ui.dialogue && frogHeight > 100 && (
        <img
          src="/moss-portrait.png"
          alt=""
          style={{
            position: 'fixed',
            bottom: 160 + Math.max(0, 140 - frogHeight),
            right: 8,
            height: frogHeight,
            width: 'auto',
            zIndex: 42,
            pointerEvents: 'none',
            transform: 'scaleX(-1)',
          }}
        />
      )}

      {/* ── Bund stencil confirm/cancel (positioning mode, no dialogue) ──── */}
      {ui.bundMode === 'positioning' && !ui.dialogue && (
        <div
          style={{
            position: 'absolute',
            bottom: TOOLBAR_H + safeArea.bottom + 8,
            left: 8,
            right: 8,
            background: 'rgba(20,35,30,0.96)',
            borderRadius: 12,
            border: '1px solid rgba(80,210,190,0.45)',
            padding: '10px 14px',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#50D2BE', marginBottom: 2 }}>
              🌙 Position bund
            </div>
            <div style={{ fontSize: 10, color: 'rgba(240,255,240,0.6)' }}>
              Move to choose location, then confirm
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={cancelBund}
              style={{
                background: 'rgba(200,80,80,0.15)',
                border: '1px solid rgba(200,80,80,0.45)',
                borderRadius: 8,
                padding: '6px 12px',
                color: '#FF9090',
                fontSize: 14,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✗
            </button>
            <button
              onClick={confirmBund}
              style={{
                background: 'rgba(80,210,190,0.2)',
                border: '1px solid rgba(80,210,190,0.55)',
                borderRadius: 8,
                padding: '6px 12px',
                color: '#50D2BE',
                fontSize: 14,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✓
            </button>
          </div>
        </div>
      )}

      {/* ── Seed selector (shown when seed tool active, no dialogue) ─────── */}
      {ui.activeTool === 'seed' && !ui.dialogue && ui.showSeedPanel && (
        <div
          style={{
            position: 'absolute',
            bottom: TOOLBAR_H + safeArea.bottom + 8,
            left: 8,
            right: 8,
            background: 'rgba(20,35,20,0.94)',
            borderRadius: 12,
            border: '1px solid rgba(124,202,124,0.3)',
            padding: 10,
            zIndex: 35,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: '#7CCA7C', fontWeight: 700 }}>Select seed</div>
            <button
              onClick={() => setUI((prev) => ({ ...prev, showSeedPanel: false }))}
              style={{
                background: 'none',
                border: 'none',
                color: '#7CCA7C',
                fontSize: 16,
                cursor: 'pointer',
                padding: '0 2px',
                lineHeight: 1,
              }}
              title="Close panel"
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['blue_grama', 'desert_marigold', 'lupine', 'sage', 'milkweed', 'mesquite'] as PlantType[]).map((p) => {
              const req = PLANT_REQUIREMENTS[p];
              const selected = ui.selectedSeed === p;
              return (
                <button
                  key={p}
                  onClick={() => {
                    seedMsgShownRef.current = null; // new seed type — allow one fresh message
                    setUI((prev) => ({ ...prev, selectedSeed: p }));
                  }}
                  style={{
                    background: selected ? '#2E6B2E' : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${selected ? '#7CCA7C' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 8,
                    padding: '4px 8px',
                    color: '#F0FFF0',
                    fontSize: 10,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{req?.emoji[4] ?? '🌿'}</span>
                  <span>{req?.name.split(' ')[0] ?? p}</span>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>💧{req?.moisture}% 🌱{req?.fertility}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Landscape held-entity indicator ───────────────────────────────── */}
      {ui.activeTool === 'landscape' && ui.heldEntity && !ui.dialogue && (
        <div
          style={{
            position: 'absolute',
            bottom: TOOLBAR_H + safeArea.bottom + 8,
            left: 8,
            right: 8,
            background: 'rgba(20,35,20,0.92)',
            borderRadius: 10,
            border: '1px solid rgba(124,202,124,0.4)',
            padding: '8px 14px',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 22 }}>
            {ui.heldEntity.type === 'plant'
              ? PLANT_REQUIREMENTS[ui.heldEntity.data.type]?.emoji[ui.heldEntity.data.stage] ?? '🌿'
              : ui.heldEntity.type === 'animal' ? '🦌'
              : ui.heldEntity.type === 'fairy' ? '✨'
              : ui.heldEntity.type === 'mulch' ? '🟫'
              : ui.heldEntity.type === 'grass' ? '🌾'
              : '❓'}
          </span>
          <div style={{ fontSize: 11, color: '#F0FFF0' }}>
            <div style={{ fontWeight: 700, color: '#7CCA7C' }}>Holding {ui.heldEntity.type}</div>
            <div style={{ opacity: 0.7 }}>Tap a tile to place it</div>
          </div>
        </div>
      )}

      {/* ── Tool Belt — hidden while any dialogue is on screen ──────────── */}
      {!ui.dialogue && (
      <div
        style={{
          position: 'absolute',
          bottom: safeArea.bottom,
          left: 0,
          right: 0,
          height: TOOLBAR_H,
          background: 'rgba(15,25,15,0.92)',
          backdropFilter: 'blur(6px)',
          borderTop: '1px solid rgba(124,202,124,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 4px',
          zIndex: 20,
        }}
      >
        {TOOL_DEFS.filter((def) => ui.unlockedTools.includes(def.id)).map((def) => {
          const rainBlocked = def.id === 'rain' && ui.rainCooling;
          const active = ui.activeTool === def.id;
          return (
            <button
              key={def.id}
              disabled={rainBlocked}
              className={active ? 'tool-active' : ''}
              onClick={() => {
                if (rainBlocked) return;
                // Prevent any tool interaction during intro animation
                if (gsRef.current.introAnimationState) return;

                if (def.id === 'rain') {
                  const gs = gsRef.current;
                  const restoration = calculateRestoration(gs);
                  triggerRain(gs, restoration);
                  setUI((p) => ({ ...p, rainCooling: true }));
                  const cooldown = getRainCooldown(restoration);
                  setTimeout(() => setUI((p) => ({ ...p, rainCooling: false })), cooldown);
                  track('custom_rain_called', { rains: gs.rainsCount });
                  RundotGameAPI.analytics.recordCustomEvent('rain_called', { rains: gs.rainsCount });
                  if (gs.questStep === 'first_rain') {
                    setTimeout(() => {
                      queueDialogue([{ speaker: 'Moss', emoji: '🐸', text: 'The rain came. But the valley could not hold it.' }]);
                      advanceQuest('dig_bund');
                    }, 6000);
                  } else if (gs.questStep === 'second_rain') {
                    setTimeout(() => {
                      queueDialogue([{ speaker: 'Moss', emoji: '🐸', text: 'Do not chase the rain. Invite it to stay.' }]);
                      advanceQuest('plant_seed');
                    }, 6000);
                  } else {
                    const restoration = calculateRestoration(gs);
                    if (restoration > 0) {
                      setTimeout(() => {
                        queueDialogue([{ speaker: 'Moss', emoji: '🐸', text: `Moisture rises. The valley remembers a little more. ${restoration}% restored.` }]);
                      }, 4000);
                    }
                  }
                  return;
                }

                if (def.id === 'talk') {
                  const gs = gsRef.current;
                  if (gs.questStep === 'intro') {
                    advanceQuest('inspect_soil');
                    queueDialogue([
                      ...getQuestMossDialogue('intro'),
                      ...getQuestMossDialogue('inspect_soil'),
                    ]);
                  } else {
                    const dialogues = getQuestMossDialogue(gs.questStep);
                    queueDialogue(dialogues.length > 0 ? dialogues : [{
                      speaker: 'Moss', emoji: '🐸',
                      text: 'The valley heals slowly, like memory. Each action reaches forward in time.',
                    }]);
                  }
                  track('custom_moss_talked');
                  return;
                }

                if (def.id === 'journal') {
                  const gss = gsRef.current;
                  onShowWatershed(
                    calculateRestoration(gss),
                    [...gss.discoveredWildlife],
                    [...gss.discoveredFairies],
                    [...gss.discoveredPlants],
                  );
                  track('custom_journal_opened');
                  RundotGameAPI.analytics.recordCustomEvent('journal_opened');
                  return;
                }

                // Leaving seed tool resets the "once per selection" message
                if (uiRef.current.activeTool === 'seed' && def.id !== 'seed') {
                  seedMsgShownRef.current = null;
                }

                if (def.id === 'bund') {
                  // Cancel any in-progress positioning if switching back to bund
                  // from another tool while in digging mode: keep digging mode.
                  // If not currently in bund mode, start positioning.
                  if (uiRef.current.bundMode !== 'digging') {
                    gsRef.current.highlightTiles = [];
                    setUI((p) => ({
                      ...p,
                      activeTool: 'bund',
                      bundMode: 'positioning',
                      bundTargetTiles: [],
                      inspectedTile: null,
                    }));
                    track('custom_tool_selected', { tool: def.id });
                    RundotGameAPI.analytics.recordCustomEvent('tool_selected', { tool: def.id });
                    return;
                  }
                  // Already in digging mode — just re-select tool
                }

                // Selecting any tool other than bund while in positioning mode cancels the stencil
                if (def.id !== 'bund' && uiRef.current.bundMode === 'positioning') {
                  gsRef.current.highlightTiles = [];
                  setUI((p) => ({
                    ...p,
                    activeTool: def.id,
                    bundMode: null,
                    bundTargetTiles: [],
                    inspectedTile: null,
                  }));
                  track('custom_tool_selected', { tool: def.id });
                  RundotGameAPI.analytics.recordCustomEvent('tool_selected', { tool: def.id });
                  return;
                }

                setUI((p) => ({
                  ...p,
                  activeTool: def.id,
                  inspectedTile: null,
                  // When switching to seed tool, show the seed panel
                  ...(def.id === 'seed' && { showSeedPanel: true }),
                }));
                track('custom_tool_selected', { tool: def.id });
                RundotGameAPI.analytics.recordCustomEvent('tool_selected', { tool: def.id });
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                background: active ? 'rgba(124,202,124,0.2)' : 'transparent',
                border: active ? '1px solid rgba(124,202,124,0.5)' : '1px solid transparent',
                borderRadius: 10,
                padding: '5px 3px',
                cursor: rainBlocked ? 'default' : 'pointer',
                opacity: rainBlocked ? 0.4 : 1,
                minWidth: 36,
              }}
            >
              <span style={{ fontSize: 20 }}>{def.emoji}</span>
              <span style={{ fontSize: 8, color: active ? '#7CCA7C' : 'rgba(240,255,240,0.6)', textAlign: 'center' }}>
                {def.label}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {/* Audio Settings Modal */}
      {showAudioSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '20px',
          }}
          onClick={() => setShowAudioSettings(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0a3d0a 0%, #1a5a1a 100%)',
              border: '2px solid #7CCA7C',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '90vw',
              width: '300px',
              textAlign: 'center',
              color: '#fff',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '18px',
                margin: '0 0 20px 0',
                color: '#7CCA7C',
                fontFamily: 'Georgia, serif',
              }}
            >
              Audio Settings
            </h2>

            {/* Music Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#7CCA7C',
                }}
              >
                Music
              </span>
              <button
                onClick={() => {
                  toggleMusic(!isMusicOn);
                  setIsMusicOn(!isMusicOn);
                  track('custom_game_music_toggled');
                }}
                style={{
                  background: isMusicOn ? '#7CCA7C' : '#4a6d4a',
                  border: 'none',
                  color: '#0a3d0a',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isMusicOn ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Volume Slider */}
            {isMusicOn && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#7CCA7C',
                    marginBottom: '10px',
                  }}
                >
                  Volume: {musicVolume}%
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={musicVolume}
                  onChange={(e) => {
                    const newVolume = parseInt(e.target.value);
                    setMusicVolumeState(newVolume);
                    setMusicVolume(newVolume);
                  }}
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    accentColor: '#7CCA7C',
                  }}
                  title="Music Volume"
                />
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setShowAudioSettings(false)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: '#7CCA7C',
                color: '#0a3d0a',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#9FDF9F';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#7CCA7C';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFS: Array<{ id: ToolType; emoji: string; label: string }> = [
  { id: 'move',      emoji: '👟', label: 'Move' },
  { id: 'inspect',   emoji: '🔍', label: 'Inspect' },
  { id: 'bund',      emoji: '🌙', label: 'Dig Bund' },
  { id: 'shovel',    emoji: '⛏️',  label: 'Undo' },
  { id: 'mulch',     emoji: '🍂', label: 'Mulch' },
  { id: 'seed',      emoji: '🌱', label: 'Plant' },
  { id: 'rain',      emoji: '☔', label: 'Rain' },
  { id: 'talk',      emoji: '💬', label: 'Moss' },
  { id: 'journal',   emoji: '📖', label: 'Journal' },
  { id: 'landscape', emoji: '🌿', label: 'Reshape' },
];

export default GameScene;
