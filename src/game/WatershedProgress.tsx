/**
 * WatershedProgress — optional overlay showing chapter restoration state.
 * Accessible from the Journal button in-game.
 * Replaces the old dashboard as the primary screen.
 */
import { useState } from 'react';
import { theme } from '../theme';
import { WILDLIFE_CONDITIONS, PLANT_REQUIREMENTS, FAIRY_CONDITIONS } from './engine/gameEngine';
import { spriteLoader } from './services/spriteLoader';
import { wildlifeLoader } from './services/wildlifeLoader';
import { fairyLoader } from './services/fairyLoader';
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
          { id: 'plants' as CatalogTab, emoji: '🌱', label: 'Plants', count: discoveredPlants.length, total: 5 },
          { id: 'wildlife' as CatalogTab, emoji: '🐾', label: 'Wildlife', count: discoveredWildlife.length, total: 12 },
          { id: 'fairies' as CatalogTab, emoji: '✨', label: 'Fairies', count: discoveredFairies.length, total: 5 },
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
                      return sprite ? (
                        <canvas
                          ref={(canvas) => {
                            if (canvas && sprite) {
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                canvas.width = 40;
                                canvas.height = 40;
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
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                canvas.width = 32;
                                canvas.height = 32;
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
                      return sprite ? (
                        <canvas
                          ref={(canvas) => {
                            if (canvas && sprite) {
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                canvas.width = 56;
                                canvas.height = 56;
                                ctx.clearRect(0, 0, 56, 56);
                                const w = sprite.width * (50 / Math.max(sprite.width, sprite.height));
                                const h = sprite.height * (50 / Math.max(sprite.width, sprite.height));
                                ctx.drawImage(sprite, 28 - w / 2, 28 - h / 2, w, h);
                              }
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
                        <div><strong>Gift:</strong> {info.gift}</div>
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
