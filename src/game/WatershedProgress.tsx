/**
 * WatershedProgress — optional overlay showing chapter restoration state.
 * Accessible from the Journal button in-game.
 * Replaces the old dashboard as the primary screen.
 */
import { theme } from '../theme';
import { WILDLIFE_CONDITIONS } from './engine/gameEngine';

interface ChapterInfo {
  id: string;
  name: string;
  emoji: string;
  restoration: number;
  locked: boolean;
  unlockAt: string;
  gradientFrom: string;
  gradientTo: string;
  guideEmoji: string;
  guideName: string;
}

const CHAPTERS: ChapterInfo[] = [
  {
    id: 'dryland',
    name: 'The Valley That Forgot the Rain',
    emoji: '🏜️',
    restoration: -1, // filled in from props
    locked: false,
    unlockAt: '',
    gradientFrom: '#C4935A',
    gradientTo: '#A07040',
    guideEmoji: '🐸',
    guideName: 'Moss',
  },
  {
    id: 'meadow',
    name: 'The Meadow of Forgotten Wings',
    emoji: '🌸',
    restoration: 0,
    locked: true,
    unlockAt: 'Restore Ch.1 to 80%',
    gradientFrom: '#7B9E4A',
    gradientTo: '#5A7A30',
    guideEmoji: '🐝',
    guideName: 'Clover',
  },
  {
    id: 'forest',
    name: 'The Forest That Feeds Itself',
    emoji: '🌳',
    restoration: 0,
    locked: true,
    unlockAt: 'Restore Ch.2 to 80%',
    gradientFrom: '#3A6B3A',
    gradientTo: '#2A5A2A',
    guideEmoji: '🦊',
    guideName: 'Rowan',
  },
  {
    id: 'wetland',
    name: 'The Wetland That Remembers',
    emoji: '🦆',
    restoration: 0,
    locked: true,
    unlockAt: 'Restore Ch.3 to 80%',
    gradientFrom: '#4A7A8A',
    gradientTo: '#2A5A6A',
    guideEmoji: '🦦',
    guideName: 'Ripple',
  },
  {
    id: 'coastal',
    name: 'The Coastal Dunes',
    emoji: '🐚',
    restoration: 0,
    locked: true,
    unlockAt: 'Restore Ch.4 to 80%',
    gradientFrom: '#C4A040',
    gradientTo: '#A08020',
    guideEmoji: '🐦',
    guideName: 'Sable',
  },
];

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

  const chapters = CHAPTERS.map((ch) =>
    ch.id === 'dryland' ? { ...ch, restoration: chapter1Restoration } : ch,
  );

  const overallRestoration = Math.round(chapter1Restoration / 5);
  const sanctuaryUnlocked = chapter1Restoration >= 100;

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
          <div style={{ fontWeight: 700, fontSize: theme.fontSize.md }}>Watershed Progress</div>
          <div style={{ fontSize: theme.fontSize.xs, opacity: 0.7 }}>
            Five chapters · One living world
          </div>
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div style={{ fontSize: theme.fontSize.lg, fontWeight: 700 }}>{overallRestoration}%</div>
          <div style={{ fontSize: 10, opacity: 0.65 }}>overall</div>
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

      {/* Discovery summary */}
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
          { emoji: '🌱', label: 'Plants', count: discoveredPlants.length, total: 5 },
          { emoji: '🐾', label: 'Wildlife', count: discoveredWildlife.length, total: 10 },
          { emoji: '✨', label: 'Fairies', count: discoveredFairies.length, total: 5 },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              padding: '10px 8px',
              textAlign: 'center',
              borderRight: `1px solid ${c.border}`,
            }}
          >
            <div style={{ fontSize: 20 }}>{item.emoji}</div>
            <div style={{ fontSize: theme.fontSize.xs, fontWeight: 700, color: c.text.primary }}>{item.count}/{item.total}</div>
            <div style={{ fontSize: 10, color: c.text.muted }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Chapter cards */}
      <div
        style={{
          flex: 1,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.md,
        }}
      >
        {chapters.map((ch) => (
          <ChapterCard key={ch.id} chapter={ch} />
        ))}

        {/* Wildlife Catalog */}
        {discoveredWildlife.length > 0 && (
          <div
            style={{
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${c.border}`,
              background: c.surface,
              padding: theme.spacing.md,
              marginTop: theme.spacing.sm,
            }}
          >
            <div style={{ fontSize: theme.fontSize.md, fontWeight: 700, marginBottom: theme.spacing.md, color: c.text.primary }}>
              🐾 Discovered Wildlife
            </div>
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
                    <div style={{ fontSize: 24, minWidth: 32 }}>{info.emoji}</div>
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

        {/* Sanctuary */}
        <div
          style={{
            borderRadius: theme.borderRadius.lg,
            border: sanctuaryUnlocked
              ? `1px solid rgba(124, 202, 124, 0.5)`
              : `1px dashed ${c.border}`,
            background: sanctuaryUnlocked
              ? 'linear-gradient(160deg, #1a3a1a, #2E5E2E)'
              : 'transparent',
            padding: theme.spacing.lg,
            textAlign: 'center',
            color: sanctuaryUnlocked ? '#F0FFF0' : c.text.muted,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 6 }}>🌺</div>
          <div style={{ fontSize: theme.fontSize.md, fontWeight: 700 }}>The Sanctuary Garden</div>
          {sanctuaryUnlocked ? (
            <div style={{ fontSize: theme.fontSize.sm, opacity: 0.85, marginTop: 6, fontStyle: 'italic' }}>
              &ldquo;Nothing thrives alone.&rdquo;
            </div>
          ) : (
            <div style={{ fontSize: theme.fontSize.sm, marginTop: 6, opacity: 0.65 }}>
              Complete Ch.1 to begin unlocking the sanctuary.
            </div>
          )}
        </div>

        <div style={{ height: theme.spacing.xl }} />
      </div>
    </div>
  );
}

function ChapterCard({ chapter }: { chapter: ChapterInfo }) {
  const c = theme.colors;
  const { locked, restoration, name, emoji, guideEmoji, guideName, gradientFrom, gradientTo, unlockAt } = chapter;

  return (
    <div
      style={{
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        border: `1px solid ${c.border}`,
        opacity: locked ? 0.65 : 1,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          color: '#F0FFF0',
          padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 28 }}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: theme.fontSize.sm }}>{name}</div>
          <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
            {guideEmoji} {guideName}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: theme.fontSize.md }}>
            {locked ? '🔒' : `${restoration}%`}
          </div>
          <div style={{ fontSize: 10, opacity: 0.75 }}>{locked ? 'Locked' : 'restored'}</div>
        </div>
      </div>

      {/* Progress bar */}
      {!locked && (
        <div style={{ height: 5, background: 'rgba(0,0,0,0.1)' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, restoration)}%`,
              background: '#7CCA7C',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      )}

      {/* Unlock hint */}
      {locked && (
        <div
          style={{
            padding: `6px ${theme.spacing.md}px`,
            background: c.surface,
            fontSize: 11,
            color: c.text.muted,
          }}
        >
          {unlockAt}
        </div>
      )}
    </div>
  );
}

export default WatershedProgress;
