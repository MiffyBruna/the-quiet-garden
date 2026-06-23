/**
 * WatershedProgress — optional overlay showing chapter restoration state.
 * Accessible from the Journal button in-game.
 * Replaces the old dashboard as the primary screen.
 */
import { useState, useEffect } from 'react';
import { theme } from '../theme';
import { WILDLIFE_CONDITIONS, PLANT_REQUIREMENTS, FAIRY_CONDITIONS, GameStats } from './engine/gameEngine';
import { spriteLoader } from './services/spriteLoader';
import { wildlifeLoader } from './services/wildlifeLoader';
import { fairyLoader } from './services/fairyLoader';
import { playMenuSelect } from './services/audioManager';
import { PLANTS } from './journalData';
import { ZONES } from './gardenData';
import type { PlantType, WildlifeType } from './engine/types';

type CatalogTab = 'plants' | 'wildlife' | 'fairies';

// Hide scrollbar while keeping scroll functionality
const scrollbarHiddenStyles = `
  .content-scroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .content-scroll::-webkit-scrollbar {
    display: none;
  }
`;

// ---------------------------------------------------------------------------
// Helper: Generate hint for a specific undiscovered wildlife
// ---------------------------------------------------------------------------

function getHintForWildlife(
  wildlifeType: WildlifeType,
  stats: GameStats,
  discoveredPlants: string[],
  hasMatureMesquite: boolean = false
): string {
  const discovered = new Set(discoveredPlants);

  switch (wildlifeType) {
    case 'ant':
      if (stats.avgFertility < 20) {
        return `💡 Something needs fertile soil. Currently ${Math.round(stats.avgFertility)}% fertile — add mulch and let the land rest.`;
      }
      return '✓ Ready: Something should appear soon (soil is fertile enough)';
    case 'bee':
      if (stats.bloomCount < 1) {
        return '💡 Something needs open flowers. Plant a seed and let it bloom.';
      }
      return `✓ Ready: Something should appear soon (${stats.bloomCount} flower open)`;
    case 'monarch':
      if (!discovered.has('milkweed')) {
        return '💡 Something needs a specific plant. Plant milkweed and wait.';
      }
      return '✓ Ready: Something should appear soon (the required plant is there)';
    case 'frog':
      if (stats.waterTileCount < 2) {
        return `💡 Something needs water. Create 2+ pools (you have ${stats.waterTileCount}).`;
      }
      return `✓ Ready: Something should appear soon (${stats.waterTileCount} water tiles)`;
    case 'beetle':
      if (stats.mulchCount < 2 || stats.avgFertility < 25) {
        return `💡 Something needs mulch & fertile soil. You have ${stats.mulchCount} mulch, ${Math.round(stats.avgFertility)}% fertility.`;
      }
      return '✓ Ready: Something should appear soon (mulch & fertility OK)';
    case 'hoverfly':
      if (stats.bloomCount < 3) {
        return `💡 Something needs 3 blooms at once. You have ${stats.bloomCount}.`;
      }
      return `✓ Ready: Something should appear soon (${stats.bloomCount} blooms)`;
    case 'painted_lady':
      if (stats.plantDiversity < 3 || stats.bloomCount < 2) {
        return `💡 Something needs variety: 3 plant types & 2 blooms. You have ${stats.plantDiversity} types, ${stats.bloomCount} blooming.`;
      }
      return `✓ Ready: Something should appear soon (${stats.plantDiversity} types, ${stats.bloomCount} blooms)`;
    case 'dragonfly':
      if (stats.waterTileCount < 3) {
        return `💡 Something needs larger pools. Need 3+ water tiles (you have ${stats.waterTileCount}).`;
      }
      return `✓ Ready: Something should appear soon (${stats.waterTileCount} water tiles)`;
    case 'cottontail':
      if (stats.bloomCount < 3 || stats.plantDiversity < 3) {
        return `💡 Something needs 3 blooms & 3 plant types at once. You have ${stats.bloomCount} blooms, ${stats.plantDiversity} types.`;
      }
      return `✓ Ready: Something should appear soon (${stats.bloomCount} blooms, ${stats.plantDiversity} types)`;
    case 'finch':
      if (stats.plantDiversity < 4) {
        return `💡 Something loves diversity. Plant a 4th kind (you have ${stats.plantDiversity}).`;
      }
      return `✓ Ready: Something should appear soon (${stats.plantDiversity} plant types)`;
    case 'quail':
      if (stats.restoration < 70) {
        return `💡 Something returns at 70% restoration. Valley is ${Math.round(stats.restoration)}% restored.`;
      }
      return `✓ Ready: Something should appear soon (${Math.round(stats.restoration)}% restored)`;
    case 'hawk':
      if (stats.restoration < 80) {
        return `💡 Something waits for 80% restoration. Valley is ${Math.round(stats.restoration)}% restored.`;
      }
      if (!hasMatureMesquite) {
        return '💡 Something needs a mature tree to establish. Grow a Mesquite to completion.';
      }
      return `✓ Ready: Something should appear soon (${Math.round(stats.restoration)}% restored, mature tree established)`;
    case 'swallow':
      if (stats.bloomCount < 5 || stats.restoration < 85) {
        return `💡 Something needs 5 blooms + 85% restoration. You have ${stats.bloomCount} blooms, ${Math.round(stats.restoration)}% restored.`;
      }
      return `✓ Ready: Something should appear soon (${stats.bloomCount} blooms, ${Math.round(stats.restoration)}% restored)`;
    default:
      return 'Continue restoring the valley to discover this animal.';
  }
}

interface WatershedProgressProps {
  chapter1Restoration: number;
  discoveredWildlife: string[];
  discoveredFairies: string[];
  discoveredPlants: string[];
  newlyDiscovered: string[];
  gameStats: GameStats;
  hasMatureMesquite: boolean;
  onClose: () => void;
}

export function WatershedProgress({
  chapter1Restoration,
  discoveredWildlife,
  discoveredFairies,
  discoveredPlants,
  newlyDiscovered,
  gameStats,
  hasMatureMesquite,
  onClose,
}: WatershedProgressProps) {
  const c = theme.colors;
  const [activeTab, setActiveTab] = useState<CatalogTab>('plants');
  const [, setSpritesLoaded] = useState(false);

  // Ensure fairy and wildlife sprites are loaded when journal opens
  useEffect(() => {
    console.log(`[WatershedProgress] Opening journal with ${discoveredFairies.length} fairies and ${discoveredWildlife.length} wildlife`);

    const spritePromises: Promise<any>[] = [];

    if (discoveredFairies.length > 0) {
      console.log(`[WatershedProgress] Loading fairy sprites: ${discoveredFairies.join(', ')}`);
      discoveredFairies.forEach((fairyType) => {
        spritePromises.push(fairyLoader.loadSprite(fairyType).catch((err) => {
          console.error(`[WatershedProgress] Failed to load fairy sprite ${fairyType}:`, err);
        }));
      });
    }

    if (discoveredWildlife.length > 0) {
      console.log(`[WatershedProgress] Loading wildlife sprites: ${discoveredWildlife.join(', ')}`);
      discoveredWildlife.forEach((wildlifeType) => {
        spritePromises.push(wildlifeLoader.loadSprite(wildlifeType).catch((err) => {
          console.error(`[WatershedProgress] Failed to load wildlife sprite ${wildlifeType}:`, err);
        }));
      });
    }

    if (spritePromises.length > 0) {
      Promise.all(spritePromises).then(() => {
        console.log(`[WatershedProgress] All sprites loaded, triggering re-render`);
        setSpritesLoaded(true);
      });
    } else {
      console.log(`[WatershedProgress] No sprites to load`);
      setSpritesLoaded(true);
    }
  }, [discoveredFairies, discoveredWildlife]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: c.background,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <style>{scrollbarHiddenStyles}</style>
      {/* Header */}
      <div
        style={{
          background: '#2E4A2E',
          color: '#F0FFF0',
          padding: `14px 16px`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 24 }}>🌿</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: theme.fontSize.md }}>The Valley That Forgot the Rain</div>
          <div style={{ fontSize: theme.fontSize.xs, opacity: 0.7 }}>
            Restoration Progress
          </div>
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div style={{ fontSize: theme.fontSize.lg, fontWeight: 700 }}>{chapter1Restoration}%</div>
          <div style={{ fontSize: 10, opacity: 0.65 }}>restored</div>
        </div>
        <button
          onClick={() => {
            playMenuSelect();
            onClose();
          }}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 8,
            color: '#F0FFF0',
            fontSize: 13,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      </div>

      {/* Discovery tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          background: 'rgba(46,74,46,0.08)',
          borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}
      >
        {[
          { id: 'plants' as CatalogTab, emoji: '🌱', label: 'Plants', count: discoveredPlants.length, total: PLANTS.length },
          { id: 'wildlife' as CatalogTab, emoji: '🐾', label: 'Wildlife', count: discoveredWildlife.length, total: ZONES.flatMap((z) => z.wildlife).length },
          { id: 'fairies' as CatalogTab, emoji: '✨', label: 'Fairies', count: discoveredFairies.length, total: ZONES.flatMap((z) => z.fairies).length },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => {
              playMenuSelect();
              setActiveTab(item.id);
            }}
            style={{
              flex: 1,
              padding: '10px 8px',
              textAlign: 'center',
              borderRight: `1px solid ${c.border}`,
              border: 'none',
              background: activeTab === item.id ? 'rgba(124,202,124,0.15)' : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <div style={{ fontSize: 20 }}>{item.emoji}</div>
            <div style={{ fontSize: theme.fontSize.xs, fontWeight: 700, color: c.text.primary }}>{item.count}/{item.total}</div>
            <div style={{ fontSize: 10, color: c.text.muted }}>{item.label}</div>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div
        className="content-scroll"
        style={{
          flex: 1,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm,
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Catalog View (switches based on active tab) */}
        {activeTab === 'wildlife' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            {WILDLIFE_CONDITIONS.map((info) => {
              const isDiscovered = discoveredWildlife.includes(info.type);
              const hint = !isDiscovered ? getHintForWildlife(info.type as WildlifeType, gameStats, discoveredPlants, hasMatureMesquite) : null;

              return (
                <div
                  key={info.type}
                  style={{
                    borderRadius: theme.borderRadius.lg,
                    border: `1px solid ${isDiscovered ? c.border : 'rgba(128,128,128,0.3)'}`,
                    background: isDiscovered ? c.surface : 'rgba(128,128,128,0.08)',
                    padding: theme.spacing.md,
                    display: 'flex',
                    gap: theme.spacing.sm,
                    alignItems: 'flex-start',
                    opacity: isDiscovered ? 1 : 0.6,
                  }}
                >
                  {isDiscovered ? (
                    <>
                      {(() => {
                        const sprite = wildlifeLoader.getLoadedSprite(info.type);
                        return sprite ? (
                          <canvas
                            ref={(canvas) => {
                              if (canvas && sprite) {
                                canvas.width = 40;
                                canvas.height = 40;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  ctx.clearRect(0, 0, 40, 40);
                                  const w = sprite.width * (36 / Math.max(sprite.width, sprite.height));
                                  const h = sprite.height * (36 / Math.max(sprite.width, sprite.height));
                                  ctx.drawImage(sprite, 20 - w / 2, 20 - h / 2, w, h);
                                }
                              }
                            }}
                            style={{ imageRendering: 'pixelated', width: 40, height: 40, minWidth: 40 }}
                          />
                        ) : (
                          <div style={{ fontSize: 24, minWidth: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{info.emoji}</div>
                        );
                      })()}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: c.text.primary, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
                          {info.type.replace(/_/g, ' ')}
                          {newlyDiscovered.includes(info.type) && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(124,202,124,0.3)', color: '#7CCA7C', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              NEW
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: theme.fontSize.xs, color: c.text.muted, marginTop: 2, fontStyle: 'italic', lineHeight: 1.4 }}>
                          &ldquo;{info.wisdom}&rdquo;
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 24, minWidth: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>?</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: c.text.muted, textTransform: 'capitalize' }}>
                          Unknown
                        </div>
                        <div style={{ fontSize: theme.fontSize.xs, color: c.text.muted, marginTop: 2, lineHeight: 1.4, fontStyle: 'italic' }}>
                          {hint}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Plants Catalog */}
        {activeTab === 'plants' && discoveredPlants.length > 0 && (
          <div
            style={{
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${c.border}`,
              background: c.surface,
              padding: theme.spacing.md,
              marginTop: theme.spacing.sm,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {discoveredPlants.map((plantType) => {
                const info = PLANT_REQUIREMENTS[plantType as PlantType];
                if (!info) return null;
                return (
                  <div
                    key={plantType}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${c.border}`,
                      background: 'rgba(0,0,0,0.05)',
                      padding: theme.spacing.sm,
                      display: 'flex',
                      gap: theme.spacing.sm,
                      alignItems: 'flex-start',
                    }}
                  >
                    {(() => {
                      const sprite = spriteLoader.getLoadedSprite(plantType as PlantType, 4); // stage 4 = blooming
                      return sprite ? (
                        <canvas
                          ref={(canvas) => {
                            if (canvas && sprite) {
                              // Set canvas dimensions FIRST
                              canvas.width = 32;
                              canvas.height = 32;
                              // THEN get context (must be after setting dimensions)
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.clearRect(0, 0, 32, 32);
                                const w = sprite.width * (28 / Math.max(sprite.width, sprite.height));
                                const h = sprite.height * (28 / Math.max(sprite.width, sprite.height));
                                ctx.drawImage(sprite, 16 - w / 2, 16 - h / 2, w, h);
                              }
                            }
                          }}
                          style={{ imageRendering: 'pixelated', width: 32, height: 32, minWidth: 32 }}
                        />
                      ) : (
                        <div style={{ fontSize: 24, minWidth: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{info.emoji[4]}</div>
                      );
                    })()}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: c.text.primary, display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
                        {info.name}
                        {newlyDiscovered.includes(plantType) && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(124,202,124,0.3)', color: '#7CCA7C', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            NEW
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: theme.fontSize.xs, color: c.text.muted, marginTop: 2, lineHeight: 1.4, fontStyle: 'italic' }}>
                        {info.role}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fairies Catalog */}
        {activeTab === 'fairies' && discoveredFairies.length > 0 && (
          <div
            style={{
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${c.border}`,
              background: c.surface,
              padding: theme.spacing.md,
              marginTop: theme.spacing.sm,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {discoveredFairies.map((fairyType) => {
                const info = FAIRY_CONDITIONS.find((f) => f.type === fairyType);
                if (!info) return null;
                return (
                  <div
                    key={fairyType}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${c.border}`,
                      background: 'rgba(0,0,0,0.05)',
                      padding: theme.spacing.sm,
                      display: 'flex',
                      gap: theme.spacing.sm,
                      alignItems: 'flex-start',
                    }}
                  >
                    {(() => {
                      const sprite = fairyLoader.getLoadedSprite(fairyType);
                      console.log(`[WatershedProgress] Rendering fairy ${fairyType}: sprite=${sprite ? 'loaded' : 'not loaded'}`);
                      return sprite ? (
                        <canvas
                          ref={(canvas) => {
                            if (canvas && sprite) {
                              console.log(`[WatershedProgress] Canvas ref callback for ${fairyType}, sprite dimensions: ${sprite.width}x${sprite.height}`);
                              // Set canvas dimensions FIRST
                              canvas.width = 56;
                              canvas.height = 56;
                              // THEN get context (must be after setting dimensions)
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.clearRect(0, 0, 56, 56);
                                const w = sprite.width * (50 / Math.max(sprite.width, sprite.height));
                                const h = sprite.height * (50 / Math.max(sprite.width, sprite.height));
                                console.log(`[WatershedProgress] Drawing ${fairyType} to canvas, scaled size: ${w.toFixed(1)}x${h.toFixed(1)}`);
                                ctx.drawImage(sprite, 28 - w / 2, 28 - h / 2, w, h);
                              } else {
                                console.error(`[WatershedProgress] Failed to get canvas context for ${fairyType}`);
                              }
                            } else {
                              console.warn(`[WatershedProgress] Canvas ref callback called but sprite missing for ${fairyType}`);
                            }
                          }}
                          style={{ imageRendering: 'pixelated', width: 56, height: 56, minWidth: 56, borderRadius: 4 }}
                        />
                      ) : (
                        <div style={{ fontSize: 28, minWidth: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✨</div>
                      );
                    })()}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: c.text.primary, display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
                        {info.name}
                        {newlyDiscovered.includes(fairyType) && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(124,202,124,0.3)', color: '#7CCA7C', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            NEW
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: theme.fontSize.xs, color: c.text.muted, marginTop: 2, lineHeight: 1.5 }}>
                        <div><strong>Appears at:</strong> {info.restorationPercent}% restoration</div>
                        <div><strong>Element:</strong> {info.element}</div>
                        <div><strong>Mood:</strong> {info.mood}</div>
                      </div>
                      <div style={{ fontSize: theme.fontSize.xs, color: c.text.muted, marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>
                        &ldquo;{info.wisdom}&rdquo;
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {activeTab === 'plants' && discoveredPlants.length === 0 && (
          <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: c.text.muted, marginTop: theme.spacing.md }}>
            No plants discovered yet. Plant some seeds!
          </div>
        )}
        {activeTab === 'fairies' && discoveredFairies.length === 0 && (
          <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: c.text.muted, marginTop: theme.spacing.md }}>
            No fairies discovered yet. Keep exploring!
          </div>
        )}
      </div>
    </div>
  );
}


export default WatershedProgress;
