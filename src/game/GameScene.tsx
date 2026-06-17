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
import {
  TILE_SIZE, MAP_W, MAP_H,
  GameState, UIState, ToolType, PlantType, DialogueLine, QuestStep, Tile,
} from './engine/types';
import {
  createInitialGameState,
  applyBund, applyMulch, applyPlantSeed,
  triggerRain, updateGame,
  PLANT_REQUIREMENTS, calculateRestoration,
  getQuestObjective, getQuestMossDialogue,
  getTile,
} from './engine/gameEngine';
import {
  INSPECT_HIGHLIGHTS, BUND_HIGHLIGHT, SEED_HIGHLIGHT,
} from './engine/mapGen';

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function tileBaseColor(tile: Tile): string {
  const m = tile.moisture / 100;
  switch (tile.terrain) {
    case 'cracked_soil': {
      const r = Math.round(196 - m * 80);
      const g = Math.round(147 - m * 60);
      const b = Math.round(90 - m * 30);
      return `rgb(${r},${g},${b})`;
    }
    case 'dry_soil':   return `rgb(${Math.round(184-m*60)},${Math.round(134-m*50)},${Math.round(78-m*25)})`;
    case 'mulch':      return '#7D5A3C';
    case 'bund':       return '#9E7B55';
    case 'moist_soil': return `rgb(${Math.round(130-m*60)},${Math.round(100-m*45)},${Math.round(60-m*20)})`;
    case 'grass':      return `rgb(${Math.round(80+m*20)},${Math.round(160+m*30)},${Math.round(70+m*20)})`;
    case 'rock':       return '#8A8680';
    default:           return '#B8864E';
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderFrame(
  canvas: HTMLCanvasElement,
  gs: GameState,
  highlights: Array<{ x: number; y: number }>,
  tick: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const T = TILE_SIZE;

  // Camera follows player
  const camX = Math.round(gs.playerPX - W / 2 + T / 2);
  const camY = Math.round(gs.playerPY - H / 2 + T / 2);

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

      // Subtle grid line
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

      // Water overlay
      if (tile.water > 1) {
        ctx.fillStyle = `rgba(80,140,220,${Math.min(0.55, tile.water / 120)})`;
        ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
        // Shimmer
        if (tick % 12 < 6) {
          ctx.fillStyle = 'rgba(180,220,255,0.12)';
          ctx.fillRect(sx + 2, sy + 2, T - 4, 2);
        }
      }

      // Plant
      if (tile.plant) {
        const req = PLANT_REQUIREMENTS[tile.plant.type];
        const emoji = req?.emoji[tile.plant.stage] ?? '🌱';
        ctx.font = `${T - 6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Sway for mature/blooming plants
        const sway = tile.plant.stage >= 3 ? Math.sin(tick * 0.04 + tx * 1.3) * 1.5 : 0;
        ctx.fillText(emoji, sx + T / 2 + sway, sy + T / 2);
      }

      // Objective highlight (pulsing yellow border)
      const isHighlighted = highlights.some((h) => h.x === tx && h.y === ty);
      if (isHighlighted) {
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.12);
        ctx.strokeStyle = `rgba(255, 220, 40, ${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
      }
    }
  }

  // --- Draw fairies ---
  for (const fairy of gs.fairies) {
    const sx = fairy.px - camX;
    const sy = fairy.py - camY;
    if (sx < -T || sx > W + T || sy < -T || sy > H + T) continue;
    const glow = 0.6 + 0.4 * Math.sin(fairy.glowPhase + tick * 0.06);
    ctx.fillStyle = `rgba(255, 240, 100, ${glow * 0.25})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨', sx, sy);
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
    // Gentle blink/bob
    const bob = Math.sin(tick * 0.05) * 1.5;
    ctx.font = `${T - 2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐸', sx + T / 2, sy + T / 2 + bob);
    // Name label
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx + T / 2 - 20, sy - 4, 40, 13);
    ctx.fillStyle = '#fff';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Moss', sx + T / 2, sy + 2);
  }

  // --- Draw player ---
  {
    const sx = Math.round(gs.playerPX - camX);
    const sy = Math.round(gs.playerPY - camY);
    const cx = sx + T / 2;
    const cy = sy + T / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + T - 3, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#4A7A52';
    ctx.fillRect(cx - 5, cy - 1, 10, 10);

    // Head
    ctx.fillStyle = '#D4A882';
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hat brim
    ctx.fillStyle = '#5C3D2E';
    ctx.fillRect(cx - 7, cy - 10, 14, 3);
    // Hat crown
    ctx.fillRect(cx - 4, cy - 16, 9, 7);

    // Walking animation: bob feet
    const walkBob = gs.playerPX !== gs.playerDestTX * TILE_SIZE || gs.playerPY !== gs.playerDestTY * TILE_SIZE
      ? Math.abs(Math.sin(tick * 0.25)) * 2 : 0;
    ctx.fillStyle = '#5C3D2E';
    ctx.fillRect(cx - 5, cy + 7 + walkBob, 4, 4);
    ctx.fillRect(cx + 1, cy + 7 - walkBob + 2, 4, 4);
  }

  // --- Rain ---
  if (gs.isRaining) {
    ctx.strokeStyle = 'rgba(120, 170, 255, 0.6)';
    ctx.lineWidth = 1.2;
    for (const drop of gs.rainDrops) {
      // World-space rain, so offset by camera
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
};

export function GameScene({ onShowWatershed }: {
  onShowWatershed: (restoration: number, wildlife: string[], fairies: string[], plants: string[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState>(createInitialGameState());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [ui, setUI] = useState<UIState>(INITIAL_UI);
  const uiRef = useRef<UIState>(INITIAL_UI);
  const safeArea = getSafeArea();

  // Keep uiRef in sync
  useEffect(() => { uiRef.current = ui; }, [ui]);

  // -------------------------------------------------------------------------
  // Dialogue queue management
  // -------------------------------------------------------------------------
  const queueDialogue = useCallback((lines: DialogueLine[]) => {
    if (lines.length === 0) return;
    setUI((prev) => {
      const [first, ...rest] = lines;
      if (!first) return prev;
      return { ...prev, dialogue: first, dialogueQueue: rest };
    });
  }, []);

  const advanceDialogue = useCallback(() => {
    setUI((prev) => {
      if (prev.dialogueQueue.length === 0) return { ...prev, dialogue: null, dialogueQueue: [] };
      const [next, ...rest] = prev.dialogueQueue;
      if (!next) return { ...prev, dialogue: null, dialogueQueue: [] };
      return { ...prev, dialogue: next, dialogueQueue: rest };
    });
  }, []);

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
        highlights.push(...BUND_HIGHLIGHT);
        newTools = [...new Set([...newTools, 'bund' as ToolType])];
        break;
      case 'second_rain':
        newTools = [...new Set([...newTools, 'rain' as ToolType])];
        break;
      case 'plant_seed':
        highlights.push(...SEED_HIGHLIGHT);
        newTools = [...new Set([...newTools, 'seed' as ToolType, 'mulch' as ToolType])];
        break;
      case 'free_play':
        newTools = ['move', 'inspect', 'bund', 'mulch', 'seed', 'rain', 'talk', 'journal'];
        break;
      default:
        break;
    }

    gsRef.current.highlightTiles = highlights;

    setUI((prev) => ({
      ...prev,
      questStep: newStep,
      questObjective: objective,
      unlockedTools: newTools,
      activeTool: newStep === 'inspect_soil' ? 'inspect' : prev.activeTool,
    }));

    const dialogues = getQuestMossDialogue(newStep);
    if (dialogues.length > 0) queueDialogue(dialogues);
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
    if (!tile || tile.terrain === 'rock') return;

    gs.playerTX = nx;
    gs.playerTY = ny;
    gs.playerDestTX = nx;
    gs.playerDestTY = ny;
    if (dx > 0) gs.playerFacing = 'e';
    if (dx < 0) gs.playerFacing = 'w';
    if (dy > 0) gs.playerFacing = 's';
    if (dy < 0) gs.playerFacing = 'n';
  }, []);

  // -------------------------------------------------------------------------
  // Tool use on a tile
  // -------------------------------------------------------------------------
  const useTool = useCallback(
    (tx: number, ty: number) => {
      const gs = gsRef.current;
      const currentUI = uiRef.current;
      const tool = currentUI.activeTool;

      if (!currentUI.unlockedTools.includes(tool)) return;

      if (tool === 'move') {
        const tile = getTile(gs.tiles, tx, ty);
        if (!tile || tile.terrain === 'rock') return;
        gs.playerDestTX = tx;
        gs.playerDestTY = ty;
        gs.playerTX = tx;
        gs.playerTY = ty;
        return;
      }

      if (tool === 'inspect') {
        const tile = getTile(gs.tiles, tx, ty);
        if (!tile) return;
        setUI((prev) => ({ ...prev, inspectedTile: { x: tx, y: ty, tile: { ...tile } } }));
        track('custom_tile_inspected', { terrain: tile.terrain, moisture: Math.round(tile.moisture) });

        if (gs.questStep === 'inspect_soil') {
          gs.inspectedCount++;
          if (gs.inspectedCount >= 3) {
            advanceQuest('first_rain');
          }
        }
        return;
      }

      if (tool === 'bund') {
        const ok = applyBund(gs, tx, ty);
        if (ok) {
          track('custom_bund_placed', { tx, ty });
          if (gs.questStep === 'dig_bund') {
            // Count how many of the 8 highlighted half-moon tiles have been dug
            const dug = BUND_HIGHLIGHT.filter(
              ({ x, y }) => getTile(gs.tiles, x, y)?.terrain === 'bund',
            ).length;
            const total = BUND_HIGHLIGHT.length;
            if (dug >= total) {
              advanceQuest('second_rain');
            } else {
              setUI((p) => ({ ...p, questObjective: `Dig the half-moon bund (${dug}/${total})` }));
            }
          }
        }
        return;
      }

      if (tool === 'mulch') {
        const ok = applyMulch(gs, tx, ty);
        if (ok) {
          track('custom_mulch_placed', { tx, ty });
        }
        return;
      }

      if (tool === 'seed') {
        const result = applyPlantSeed(gs, tx, ty, currentUI.selectedSeed);
        if (result.planted) {
          const name = PLANT_REQUIREMENTS[currentUI.selectedSeed]?.name ?? currentUI.selectedSeed;
          track('custom_seed_planted', { plant: currentUI.selectedSeed });
          queueDialogue([{
            speaker: 'Moss', emoji: '🐸',
            text: `A ${name} seed goes in. The soil will know what to do.`,
          }]);
          if (gs.questStep === 'plant_seed') advanceQuest('free_play');
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
        const gs = gsRef.current;
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
        triggerRain(gs);
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
  const keydownRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const keyCooldown = useRef(false);

  useEffect(() => {
    keydownRef.current = (e: KeyboardEvent) => {
      if (keyCooldown.current) return;

      const currentUI = uiRef.current;

      if (e.key === 'Escape') {
        if (currentUI.inspectedTile) setUI((p) => ({ ...p, inspectedTile: null }));
        if (currentUI.dialogue) advanceDialogue();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (currentUI.dialogue) { advanceDialogue(); return; }
      }

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
  }, [advanceDialogue, movePlayer]);

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
      const camX = Math.round(gs.playerPX - canvas.width / 2 + TILE_SIZE / 2);
      const camY = Math.round(gs.playerPY - canvas.height / 2 + TILE_SIZE / 2);

      const worldX = (clientX - rect.left) * (canvas.width / rect.width) + camX;
      const worldY = (clientY - rect.top) * (canvas.height / rect.height) + camY;

      const tx = Math.floor(worldX / TILE_SIZE);
      const ty = Math.floor(worldY / TILE_SIZE);

      useTool(tx, ty);
    },
    [useTool],
  );

  // -------------------------------------------------------------------------
  // Game loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to container
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

      updateGame(gs, dt, (restoration, avgMoisture, wildlifeCount, questStep) => {
        setUI((prev) => ({
          ...prev,
          restoration,
          avgMoisture,
          wildlifeCount,
          questStep,
        }));
      });

      renderFrame(canvas, gs, gs.highlightTiles, gs.tick);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [queueDialogue]);

  // -------------------------------------------------------------------------
  // Layout constants
  // -------------------------------------------------------------------------
  const TOOLBAR_H = 82;
  const HUD_H = 60;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
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
      {/* ── Top HUD ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: safeArea.top,
          left: 0,
          right: 0,
          height: HUD_H,
          background: 'rgba(20,35,20,0.85)',
          backdropFilter: 'blur(4px)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#7CCA7C', fontWeight: 700, letterSpacing: '0.08em' }}>
            THE QUIET GARDEN
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
            Ch.1: The Valley That Forgot the Rain
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#F0FFF0',
              marginTop: 3,
              padding: '2px 6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4,
              display: 'inline-block',
            }}
          >
            ▸ {ui.questObjective}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#7CCA7C' }}>
            {ui.restoration}%
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>restored</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
              💧{Math.round(ui.avgMoisture)}% · 🐾{ui.wildlifeCount}
            </span>
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
          cursor: ui.activeTool === 'move' ? 'crosshair' : 'pointer',
          touchAction: 'none',
        }}
        onClick={handleCanvasClick}
        onTouchEnd={handleCanvasClick}
      />

      {/* ── Tile Inspect Panel ───────────────────────────────────────────── */}
      {ui.inspectedTile && (
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
            const t = ui.inspectedTile.tile;
            const terrainLabels: Record<string, string> = {
              cracked_soil: 'Cracked Soil', dry_soil: 'Dry Soil', mulch: 'Mulch',
              bund: 'Semicircular Bund', moist_soil: 'Moist Soil', grass: 'Grass', rock: 'Rock',
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
            };
            const suggestion = suggMap[t.terrain] ?? 'Inspect nearby tiles to understand water flow.';
            return (
              <div style={{ fontSize: 10, color: 'rgba(240,255,240,0.8)', lineHeight: 1.7 }}>
                <div><b>Terrain:</b> {label}</div>
                <div><b>Moisture:</b> {Math.round(t.moisture)}%</div>
                <div><b>Fertility:</b> {Math.round(t.fertility)}%</div>
                <div><b>Erosion risk:</b> {Math.round(t.erosion)}%</div>
                <div style={{ marginTop: 6, fontStyle: 'italic', opacity: 0.8 }}>{suggestion}</div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Dialogue Box ─────────────────────────────────────────────────── */}
      {ui.dialogue && (
        <div
          style={{
            position: 'absolute',
            bottom: TOOLBAR_H + safeArea.bottom + 8,
            left: 8,
            right: 8,
            background: 'rgba(20,35,20,0.94)',
            borderRadius: 12,
            border: '1px solid rgba(124,202,124,0.4)',
            padding: 14,
            zIndex: 40,
          }}
          onClick={advanceDialogue}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 30, flexShrink: 0, lineHeight: 1.1 }}>{ui.dialogue.emoji}</span>
            <div>
              <div style={{ fontSize: 10, color: '#7CCA7C', fontWeight: 700, marginBottom: 4 }}>
                {ui.dialogue.speaker}
              </div>
              <div style={{ fontSize: 13, color: '#F0FFF0', lineHeight: 1.55, fontStyle: 'italic' }}>
                &ldquo;{ui.dialogue.text}&rdquo;
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9, color: 'rgba(240,255,240,0.45)', marginTop: 6 }}>
            tap to continue ▸
          </div>
        </div>
      )}

      {/* ── Seed selector (shown when seed tool active) ──────────────────── */}
      {ui.activeTool === 'seed' && !ui.dialogue && (
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
          <div style={{ fontSize: 10, color: '#7CCA7C', marginBottom: 6, fontWeight: 700 }}>Select seed</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['blue_grama', 'desert_marigold', 'lupine', 'sage', 'milkweed'] as PlantType[]).map((p) => {
              const req = PLANT_REQUIREMENTS[p];
              const selected = ui.selectedSeed === p;
              return (
                <button
                  key={p}
                  onClick={() => setUI((prev) => ({ ...prev, selectedSeed: p }))}
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

      {/* ── Tool Belt ────────────────────────────────────────────────────── */}
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
        {TOOL_DEFS.map((def) => {
          const unlocked = ui.unlockedTools.includes(def.id);
          const active = ui.activeTool === def.id;
          return (
            <button
              key={def.id}
              disabled={!unlocked}
              onClick={() => {
                if (!unlocked) return;

                if (def.id === 'rain') {
                  // Handle rain directly — avoid the async activeTool read bug
                  const gs = gsRef.current;
                  if (gs.isRaining) {
                    queueDialogue([{ speaker: 'Moss', emoji: '🐸', text: 'The rain is already falling. Let it do its work.' }]);
                    return;
                  }
                  triggerRain(gs);
                  track('custom_rain_called', { rains: gs.rainsCount });
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
                  // Handle talk directly — avoid the async activeTool read bug
                  const gs = gsRef.current;
                  if (gs.questStep === 'intro') {
                    // Advance quest first (unlocks inspect tool, sets highlights),
                    // then override dialogue queue with intro lines followed by
                    // the inspect instruction, so the player hears both in order.
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
                  return;
                }

                setUI((p) => ({ ...p, activeTool: def.id, inspectedTile: null }));
                track('custom_tool_selected', { tool: def.id });
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
                cursor: unlocked ? 'pointer' : 'default',
                opacity: unlocked ? 1 : 0.3,
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFS: Array<{ id: ToolType; emoji: string; label: string }> = [
  { id: 'move',    emoji: '👟', label: 'Move' },
  { id: 'inspect', emoji: '🔍', label: 'Inspect' },
  { id: 'bund',    emoji: '🌙', label: 'Dig Bund' },
  { id: 'mulch',   emoji: '🍂', label: 'Mulch' },
  { id: 'seed',    emoji: '🌱', label: 'Plant' },
  { id: 'rain',    emoji: '☔', label: 'Rain' },
  { id: 'talk',    emoji: '💬', label: 'Moss' },
  { id: 'journal', emoji: '📖', label: 'Journal' },
];

export default GameScene;
