/**
 * WatershedProgress — optional overlay showing chapter restoration state.
 * Accessible from the Journal button in-game.
 * Replaces the old dashboard as the primary screen.
 */
import { useState, useEffect } from 'react';
import { theme } from '../theme';
import { WILDLIFE_CONDITIONS, PLANT_REQUIREMENTS, FAIRY_CONDITIONS } from './engine/gameEngine';
import { spriteLoader } from './services/spriteLoader';
import { wildlifeLoader } from './services/wildlifeLoader';
import { fairyLoader } from './services/fairyLoader';
import { PLANTS } from './journalData';
import { ZONES } from './gardenData';
import type { PlantType } from './engine/types';

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


interface WatershedProgressProps {
  chapter1Restoration: number;
  discoveredWildlife: string[];
  discoveredFairies: string[];
  discoveredPlants: string[];
  onClose: () => void;
}

export function WatershedProgress({
  chapter1Restoration,
  discoveredWildlife,
  discoveredFairies,
  discoveredPlants,
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
          onClick={onClose}
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
            onClick={() => setActiveTab(item.id)}
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
        {activeTab === 'wildlife' && discoveredWildlife.length > 0 && (
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
              {discoveredWildlife.map((wildlifeType) => {
                const info = WILDLIFE_CONDITIONS.find((w) => w.type === wildlifeType);
                if (!info) return null;
                return (
                  <div
                    key={wildlifeType}
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
                      const sprite = wildlifeLoader.getLoadedSprite(wildlifeType);
                      console.log(`[WatershedProgress] Rendering wildlife ${wildlifeType}: sprite=${sprite ? 'loaded' : 'not loaded'}`);
                      return sprite ? (
                        <canvas
                          ref={(canvas) => {
                            if (canvas && sprite) {
                              console.log(`[WatershedProgress] Canvas ref callback for ${wildlifeType}, sprite dimensions: ${sprite.width}x${sprite.height}`);
                              // Set canvas dimensions FIRST
                              canvas.width = 40;
                              canvas.height = 40;
                              // THEN get context (must be after setting dimensions)
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.clearRect(0, 0, 40, 40);
                                const w = sprite.width * (36 / Math.max(sprite.width, sprite.height));
                                const h = sprite.height * (36 / Math.max(sprite.width, sprite.height));
                                console.log(`[WatershedProgress] Drawing ${wildlifeType} to canvas, scaled size: ${w.toFixed(1)}x${h.toFixed(1)}`);
                                ctx.drawImage(sprite, 20 - w / 2, 20 - h / 2, w, h);
                              } else {
                                console.error(`[WatershedProgress] Failed to get canvas context for ${wildlifeType}`);
                              }
                            } else {
                              console.warn(`[WatershedProgress] Canvas ref callback called but sprite missing for ${wildlifeType}`);
                            }
                          }}
                          style={{ imageRendering: 'pixelated', width: 40, height: 40, minWidth: 40 }}
                        />
                      ) : (
                        <div style={{ fontSize: 24, minWidth: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{info.emoji}</div>
                      );
                    })()}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: c.text.primary, textTransform: 'capitalize' }}>
                        {wildlifeType.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: theme.fontSize.xs, color: c.text.muted, marginTop: 2, fontStyle: 'italic', lineHeight: 1.4 }}>
                        &ldquo;{info.wisdom}&rdquo;
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: c.text.primary }}>
                        {info.name}
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
                      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: c.text.primary }}>
                        {info.name}
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
        {activeTab === 'wildlife' && discoveredWildlife.length === 0 && (
          <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: c.text.muted, marginTop: theme.spacing.md }}>
            No wildlife discovered yet. Keep restoring the valley!
          </div>
        )}
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
