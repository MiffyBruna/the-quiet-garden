/**
 * The Quiet Garden — main game component.
 *
 * A cozy ecological restoration game: five biomes to heal, real techniques
 * to apply, and fairy guides who share the science behind the work. No timers,
 * no streaks, no punishment for taking breaks.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { theme } from '../theme';
import { getSafeArea } from '../services/environment';
import { loadSave, persistSave, defaultSaveState, KitSaveState } from '../services/storage';
import { track } from '../services/analytics';
import { registerKitLifecycles } from '../services/lifecycles';
import {
  ZONES,
  calculateZoneHealth,
  getZoneStateLabel,
  getOverallHealth,
  Zone,
  RestorationAction,
  WildlifeSighting,
  FairyMilestone,
} from './gardenData';

// ---------------------------------------------------------------------------
// Module-scope lifecycle registration — runs once per page load.
// The save function is wired via a ref so state is always current.
// ---------------------------------------------------------------------------

const _saveFnRef: { current: (() => Promise<void>) | null } = { current: null };

registerKitLifecycles({
  onPause: async () => {
    track('custom_game_paused');
    await _saveFnRef.current?.();
  },
  onResume: () => track('custom_game_resumed'),
  onSleep: async () => {
    track('custom_game_sleep');
    await _saveFnRef.current?.();
  },
  onQuit: () => track('custom_game_quit'),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GardenData {
  completedActions: Record<string, string[]>; // zoneId → actionId[]
  totalRestorations: number;
}

interface WisdomMessage {
  guideEmoji: string;
  guideName: string;
  zoneName: string;
  actionLabel: string;
  technique: string;
  text: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gardenDataFromSave(save: KitSaveState): GardenData {
  const raw = save.data['garden'] as Partial<GardenData> | undefined;
  return {
    completedActions: raw?.completedActions ?? {},
    totalRestorations: raw?.totalRestorations ?? 0,
  };
}

function isZoneUnlocked(zone: Zone, completedActions: Record<string, string[]>): boolean {
  if (!zone.unlockAfterZoneId) return true;
  const health = calculateZoneHealth(
    completedActions[zone.unlockAfterZoneId] ?? [],
    ZONES.find((z) => z.id === zone.unlockAfterZoneId)!,
  );
  return health >= (zone.unlockAtZoneHealth ?? 30);
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function QuietGarden() {
  const safeArea = getSafeArea();
  const c = theme.colors;

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveState, setSaveState] = useState<KitSaveState | null>(null);
  const [gardenData, setGardenData] = useState<GardenData>({
    completedActions: {},
    totalRestorations: 0,
  });
  const [wisdom, setWisdom] = useState<WisdomMessage | null>(null);
  const [expandedZone, setExpandedZone] = useState<string | null>('dryland');

  // Always-current save function wired to module-scope ref
  const saveRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    _saveFnRef.current = saveRef.current;
  });

  // ---------------------------------------------------------------------------
  // Load on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const save = await loadSave();
        if (cancelled) return;
        setSaveState(save);
        setGardenData(gardenDataFromSave(save));
        setLoadStatus('ready');
        track('custom_garden_loaded', { total_restorations: gardenDataFromSave(save).totalRestorations });
      } catch (err) {
        if (cancelled) return;
        console.error('[quiet-garden] load failed:', err);
        setLoadStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---------------------------------------------------------------------------
  // Save helper — persists gardenData into the KitSaveState envelope
  // ---------------------------------------------------------------------------
  const save = useCallback(
    async (data: GardenData, currentSave: KitSaveState | null) => {
      const base = currentSave ?? defaultSaveState();
      const next: KitSaveState = {
        ...base,
        savedAt: Date.now(),
        data: { ...base.data, garden: data },
      };
      try {
        await persistSave(next);
        setSaveState(next);
      } catch (err) {
        console.error('[quiet-garden] save failed:', err);
      }
    },
    [],
  );

  // Wire save ref so lifecycle handlers can always call the latest version
  saveRef.current = () => save(gardenData, saveState);
  useEffect(() => {
    _saveFnRef.current = saveRef.current;
  });

  // Autosave every 30 seconds during active play
  useEffect(() => {
    if (loadStatus !== 'ready') return;
    const id = setInterval(() => saveRef.current(), 30_000);
    return () => clearInterval(id);
  }, [loadStatus]);

  // ---------------------------------------------------------------------------
  // Action handler
  // ---------------------------------------------------------------------------
  const handleAction = useCallback(
    (zone: Zone, action: RestorationAction) => {
      const prev = gardenData.completedActions[zone.id] ?? [];
      if (prev.includes(action.id)) return; // already done

      const nextCompleted = { ...gardenData.completedActions, [zone.id]: [...prev, action.id] };
      const nextData: GardenData = {
        completedActions: nextCompleted,
        totalRestorations: gardenData.totalRestorations + 1,
      };

      setGardenData(nextData);
      save(nextData, saveState);

      track('custom_restoration_action', {
        zone_id: zone.id,
        action_id: action.id,
        zone_health_after: calculateZoneHealth(nextCompleted[zone.id] ?? [], zone),
      });

      setWisdom({
        guideEmoji: zone.guide.emoji,
        guideName: zone.guide.name,
        zoneName: zone.name,
        actionLabel: action.label,
        technique: action.technique,
        text: action.wisdom,
      });
    },
    [gardenData, saveState, save],
  );

  const closeWisdom = useCallback(() => {
    setWisdom(null);
    track('custom_wisdom_dismissed');
  }, []);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const zoneHealthMap: Record<string, number> = {};
  for (const zone of ZONES) {
    zoneHealthMap[zone.id] = calculateZoneHealth(
      gardenData.completedActions[zone.id] ?? [],
      zone,
    );
  }
  const overallHealth = getOverallHealth(gardenData.completedActions);
  const sanctuaryUnlocked = ZONES.every((z) => (zoneHealthMap[z.id] ?? 0) >= 50);

  // ---------------------------------------------------------------------------
  // Loading / error screens
  // ---------------------------------------------------------------------------
  if (loadStatus === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: c.background,
          color: c.text.muted,
          fontSize: theme.fontSize.md,
          flexDirection: 'column',
          gap: theme.spacing.sm,
        }}
      >
        <div style={{ fontSize: 40 }}>🌿</div>
        <div>Tending the garden…</div>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: c.background,
          color: c.text.primary,
          fontSize: theme.fontSize.md,
          flexDirection: 'column',
          gap: theme.spacing.md,
          padding: theme.spacing.xl,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40 }}>🌧️</div>
        <div>Something went wrong loading your garden.</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: c.primary,
            color: '#fff',
            border: 'none',
            borderRadius: theme.borderRadius.sm,
            padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            cursor: 'pointer',
            fontSize: theme.fontSize.md,
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: c.background,
        color: c.text.primary,
        paddingTop: safeArea.top,
        paddingBottom: safeArea.bottom,
        position: 'relative',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          background: '#2E4A2E',
          color: '#F0FFF0',
          padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.xs,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <span style={{ fontSize: 28 }}>🌿</span>
          <div>
            <div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, lineHeight: 1.2 }}>
              The Quiet Garden
            </div>
            <div style={{ fontSize: theme.fontSize.xs, opacity: 0.75 }}>
              {gardenData.totalRestorations === 0
                ? 'Touch a zone to begin restoring'
                : `${gardenData.totalRestorations} restoration${gardenData.totalRestorations === 1 ? '' : 's'} made`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, lineHeight: 1.2 }}>
              {overallHealth}%
            </div>
            <div style={{ fontSize: theme.fontSize.xs, opacity: 0.75 }}>restored</div>
          </div>
        </div>
        {/* Overall progress bar */}
        <div
          style={{
            height: 6,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${overallHealth}%`,
              background: '#7CCA7C',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </header>

      {/* ── Zone list ──────────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.md,
        }}
      >
        {ZONES.map((zone) => {
          const health = zoneHealthMap[zone.id] ?? 0;
          const unlocked = isZoneUnlocked(zone, gardenData.completedActions);
          const isExpanded = expandedZone === zone.id;
          const completed = gardenData.completedActions[zone.id] ?? [];

          return (
            <ZoneCard
              key={zone.id}
              zone={zone}
              health={health}
              unlocked={unlocked}
              isExpanded={isExpanded}
              completedActionIds={completed}
              onToggle={() => {
                setExpandedZone(isExpanded ? null : zone.id);
                if (!isExpanded) track('custom_zone_opened', { zone_id: zone.id });
              }}
              onAction={handleAction}
            />
          );
        })}

        {/* ── Fairy Sanctuary ────────────────────────────────────────────── */}
        {sanctuaryUnlocked ? (
          <FairySanctuary guides={ZONES.map((z) => z.guide)} totalRestorations={gardenData.totalRestorations} />
        ) : (
          <SanctuaryHint overallHealth={overallHealth} />
        )}

        {/* Bottom breathing room */}
        <div style={{ height: theme.spacing.xl }} />
      </main>

      {/* ── Wisdom overlay ─────────────────────────────────────────────────── */}
      {wisdom && <WisdomOverlay wisdom={wisdom} onClose={closeWisdom} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZoneCard
// ---------------------------------------------------------------------------

interface ZoneCardProps {
  zone: Zone;
  health: number;
  unlocked: boolean;
  isExpanded: boolean;
  completedActionIds: string[];
  onToggle: () => void;
  onAction: (zone: Zone, action: RestorationAction) => void;
}

function ZoneCard({ zone, health, unlocked, isExpanded, completedActionIds, onToggle, onAction }: ZoneCardProps) {
  const c = theme.colors;
  const stateLabel = getZoneStateLabel(health);

  // Categorise actions
  const available = zone.actions.filter(
    (a) => a.unlockAtHealth <= health && !completedActionIds.includes(a.id),
  );
  const done = zone.actions.filter((a) => completedActionIds.includes(a.id));
  const locked = zone.actions.filter(
    (a) => a.unlockAtHealth > health && !completedActionIds.includes(a.id),
  );

  return (
    <div
      style={{
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
        border: `1px solid ${c.border}`,
        opacity: unlocked ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        disabled={!unlocked}
        style={{
          width: '100%',
          background: `linear-gradient(135deg, ${zone.gradientFrom}, ${zone.gradientTo})`,
          color: zone.headerTextColor,
          border: 'none',
          padding: `${theme.spacing.md}px ${theme.spacing.md}px`,
          cursor: unlocked ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 32, lineHeight: 1 }}>{zone.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.md }}>
            {zone.name}
          </div>
          <div style={{ fontSize: theme.fontSize.xs, opacity: 0.85, marginTop: 2 }}>
            {unlocked ? zone.tagline : `Restore ${ZONES.find((z) => z.id === zone.unlockAfterZoneId)?.name ?? 'previous zone'} to ${zone.unlockAtZoneHealth ?? 30}% to unlock`}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.md }}>
            {unlocked ? `${health}%` : '🔒'}
          </div>
          <div style={{ fontSize: theme.fontSize.xs, opacity: 0.85 }}>
            {unlocked ? stateLabel : 'Locked'}
          </div>
        </div>
      </button>

      {/* Health bar */}
      {unlocked && (
        <div style={{ background: zone.gradientTo, padding: '0 0 0 0' }}>
          <div style={{ height: 4, background: 'rgba(0,0,0,0.15)', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${health}%`,
                background: 'rgba(255,255,255,0.65)',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Expanded body */}
      {unlocked && isExpanded && (
        <div style={{ background: c.surface, padding: theme.spacing.md }}>
          {/* Zone description */}
          <p
            style={{
              margin: `0 0 ${theme.spacing.md}px`,
              fontSize: theme.fontSize.sm,
              color: c.text.muted,
              lineHeight: 1.6,
            }}
          >
            {zone.description}
          </p>

          {/* Guide greeting */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: theme.spacing.sm,
              background: c.background,
              borderRadius: theme.borderRadius.sm,
              padding: theme.spacing.sm,
              marginBottom: theme.spacing.md,
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>{zone.guide.emoji}</span>
            <div>
              <div style={{ fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold, color: c.text.muted }}>
                {zone.guide.name}
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: c.text.primary, lineHeight: 1.5, fontStyle: 'italic' }}>
                &ldquo;{zone.guide.greeting}&rdquo;
              </div>
            </div>
          </div>

          {/* Available actions */}
          {available.length > 0 && (
            <>
              <SectionLabel label="Restoration actions" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                {available.map((action) => (
                  <ActionButton
                    key={action.id}
                    action={action}
                    state="available"
                    onClick={() => onAction(zone, action)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Locked actions */}
          {locked.length > 0 && (
            <>
              <SectionLabel
                label={`Unlocks as ${zone.name.toLowerCase()} heals`}
                muted
                style={{ marginTop: available.length > 0 ? theme.spacing.md : 0 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                {locked.map((action) => (
                  <ActionButton key={action.id} action={action} state="locked" />
                ))}
              </div>
            </>
          )}

          {/* Completed actions */}
          {done.length > 0 && (
            <>
              <SectionLabel
                label="Work you've done"
                muted
                style={{ marginTop: available.length + locked.length > 0 ? theme.spacing.md : 0 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                {done.map((action) => (
                  <ActionButton key={action.id} action={action} state="done" />
                ))}
              </div>
            </>
          )}

          {available.length === 0 && locked.length === 0 && done.length > 0 && (
            <div
              style={{
                marginTop: theme.spacing.sm,
                textAlign: 'center',
                fontSize: theme.fontSize.sm,
                color: c.primary,
                fontWeight: theme.fontWeight.semibold,
              }}
            >
              {health >= 90 ? '🌟 Fully restored' : '✨ Keep going — more actions unlock as the zone heals'}
            </div>
          )}

          {/* ── Wildlife ───────────────────────────────────────────────── */}
          {zone.wildlife.length > 0 && (
            <WildlifePanel wildlife={zone.wildlife} health={health} />
          )}

          {/* ── Fairy visits ───────────────────────────────────────────── */}
          {zone.fairies.length > 0 && (
            <FairyPanel fairies={zone.fairies} health={health} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionButton
// ---------------------------------------------------------------------------

type ActionState = 'available' | 'locked' | 'done';

interface ActionButtonProps {
  action: RestorationAction;
  state: ActionState;
  onClick?: () => void;
}

function ActionButton({ action, state, onClick }: ActionButtonProps) {
  const c = theme.colors;
  const isDone = state === 'done';
  const isLocked = state === 'locked';

  return (
    <button
      onClick={state === 'available' ? onClick : undefined}
      disabled={isDone || isLocked}
      style={{
        width: '100%',
        textAlign: 'left',
        border: `1px solid ${isDone ? 'rgba(92,140,102,0.3)' : isLocked ? c.border : c.primary}`,
        borderRadius: theme.borderRadius.sm,
        padding: `${theme.spacing.sm}px ${theme.spacing.sm}px`,
        background: isDone
          ? 'rgba(92,140,102,0.08)'
          : isLocked
          ? 'transparent'
          : 'rgba(92,140,102,0.06)',
        cursor: state === 'available' ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        opacity: isLocked ? 0.5 : 1,
        transition: 'background 0.2s',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>
        {isDone ? '✅' : isLocked ? '🔒' : action.emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
            color: isDone ? c.text.muted : c.text.primary,
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {action.label}
        </div>
        <div style={{ fontSize: 11, color: c.text.muted, marginTop: 1 }}>
          {action.technique}
        </div>
      </div>
      {!isDone && !isLocked && (
        <span
          style={{
            fontSize: theme.fontSize.xs,
            color: c.primary,
            fontWeight: theme.fontWeight.semibold,
            flexShrink: 0,
          }}
        >
          +{action.healthGain}%
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// WildlifePanel
// ---------------------------------------------------------------------------

interface WildlifePanelProps {
  wildlife: WildlifeSighting[];
  health: number;
}

function WildlifePanel({ wildlife, health }: WildlifePanelProps) {
  const c = theme.colors;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const arrived = wildlife.filter((w) => health >= w.appearsAtHealth);
  const incoming = wildlife.find((w) => health < w.appearsAtHealth);

  if (arrived.length === 0 && !incoming) return null;

  return (
    <div style={{ marginTop: theme.spacing.lg }}>
      <SectionLabel label="Wildlife returning" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
        {arrived.map((w) => (
          <button
            key={w.id}
            onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'rgba(92,140,102,0.06)',
              border: `1px solid rgba(92,140,102,0.2)`,
              borderRadius: theme.borderRadius.sm,
              padding: `${theme.spacing.sm}px`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: theme.spacing.sm,
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>{w.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: c.text.primary }}>
                {w.name}
              </div>
              <div style={{ fontSize: 11, color: c.text.muted }}>{w.role}</div>
              {expandedId === w.id && (
                <div
                  style={{
                    marginTop: theme.spacing.xs,
                    fontSize: theme.fontSize.sm,
                    color: c.text.muted,
                    lineHeight: 1.55,
                  }}
                >
                  {w.fact}
                </div>
              )}
            </div>
            <span style={{ fontSize: 10, color: c.text.muted, flexShrink: 0, paddingTop: 3 }}>
              {expandedId === w.id ? '▲' : '▼'}
            </span>
          </button>
        ))}
        {incoming && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              opacity: 0.45,
              fontSize: theme.fontSize.sm,
              color: c.text.muted,
            }}
          >
            <span style={{ fontSize: 20 }}>🌫️</span>
            <span>Something is on its way as the {health < 30 ? 'restoration begins' : 'healing continues'}…</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FairyPanel
// ---------------------------------------------------------------------------

interface FairyPanelProps {
  fairies: FairyMilestone[];
  health: number;
}

function FairyPanel({ fairies, health }: FairyPanelProps) {
  const c = theme.colors;
  const visited = fairies.filter((f) => health >= f.appearsAtHealth);
  const nextFairy = fairies.find((f) => health < f.appearsAtHealth);

  if (visited.length === 0 && !nextFairy) return null;

  return (
    <div style={{ marginTop: theme.spacing.lg }}>
      <SectionLabel label="Fairy visits" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
        {visited.map((f) => (
          <div
            key={f.id}
            style={{
              background: 'rgba(180,140,200,0.08)',
              border: `1px solid rgba(180,140,200,0.25)`,
              borderRadius: theme.borderRadius.sm,
              padding: theme.spacing.sm,
              display: 'flex',
              alignItems: 'flex-start',
              gap: theme.spacing.sm,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>✨</span>
            <div>
              <div style={{ fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold, color: c.text.muted }}>
                {f.name} · {f.personality}
              </div>
              <div
                style={{
                  fontSize: theme.fontSize.sm,
                  color: c.text.primary,
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                  marginTop: 2,
                }}
              >
                &ldquo;{f.wisdom}&rdquo;
              </div>
            </div>
          </div>
        ))}
        {nextFairy && visited.length === 0 && (
          <div
            style={{
              fontSize: theme.fontSize.sm,
              color: c.text.muted,
              fontStyle: 'italic',
              opacity: 0.6,
              paddingLeft: theme.spacing.xs,
            }}
          >
            ✨ A fairy is waiting in the wings…
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WisdomOverlay
// ---------------------------------------------------------------------------

interface WisdomOverlayProps {
  wisdom: WisdomMessage;
  onClose: () => void;
}

function WisdomOverlay({ wisdom, onClose }: WisdomOverlayProps) {
  const c = theme.colors;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 35, 20, 0.75)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        padding: theme.spacing.md,
        paddingBottom: Math.max(theme.spacing.xl, 24),
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: c.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.30)',
        }}
      >
        {/* Guide header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.md,
          }}
        >
          <span style={{ fontSize: 36 }}>{wisdom.guideEmoji}</span>
          <div>
            <div style={{ fontSize: theme.fontSize.xs, color: c.text.muted }}>
              {wisdom.guideName} · {wisdom.zoneName}
            </div>
            <div style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold }}>
              {wisdom.actionLabel}
            </div>
            <div style={{ fontSize: 11, color: c.text.muted, fontStyle: 'italic' }}>
              {wisdom.technique}
            </div>
          </div>
        </div>

        {/* Wisdom text */}
        <p
          style={{
            fontSize: theme.fontSize.md,
            lineHeight: 1.65,
            color: c.text.primary,
            margin: `0 0 ${theme.spacing.lg}px`,
          }}
        >
          {wisdom.text}
        </p>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: '#2E4A2E',
            color: '#F0FFF0',
            border: 'none',
            borderRadius: theme.borderRadius.sm,
            padding: `${theme.spacing.sm + 4}px`,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
            cursor: 'pointer',
          }}
        >
          Continue gardening
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FairySanctuary (unlocked when all zones ≥ 50%)
// ---------------------------------------------------------------------------

interface FairySanctuaryProps {
  guides: Array<{ name: string; emoji: string; greeting: string }>;
  totalRestorations: number;
}

function FairySanctuary({ guides, totalRestorations }: FairySanctuaryProps) {
  return (
    <div
      style={{
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
        border: `1px solid rgba(124, 202, 124, 0.4)`,
        background: 'linear-gradient(160deg, #1a3a1a, #2E5E2E)',
        color: '#F0FFF0',
      }}
    >
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ textAlign: 'center', marginBottom: theme.spacing.lg }}>
          <div style={{ fontSize: 40, marginBottom: theme.spacing.sm }}>🌺</div>
          <div style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold }}>
            The Sanctuary Garden
          </div>
          <div style={{ fontSize: theme.fontSize.sm, opacity: 0.8, marginTop: theme.spacing.xs }}>
            Moss, Clover, Rowan, Ripple, and Sable have gathered to celebrate{' '}
            {totalRestorations} acts of restoration.
          </div>
        </div>

        {/* Guide circle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: theme.spacing.md,
            flexWrap: 'wrap',
            marginBottom: theme.spacing.lg,
          }}
        >
          {guides.map((g) => (
            <div key={g.name} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>{g.emoji}</div>
              <div style={{ fontSize: theme.fontSize.xs, opacity: 0.8, marginTop: 4 }}>{g.name}</div>
            </div>
          ))}
        </div>

        {/* Closing message */}
        <div
          style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: theme.borderRadius.sm,
            padding: theme.spacing.md,
            fontSize: theme.fontSize.sm,
            lineHeight: 1.65,
            textAlign: 'center',
            fontStyle: 'italic',
            opacity: 0.9,
          }}
        >
          &ldquo;The valley feeds the wetland. The wetland feeds the river. The river supports
          the forest. Pollinators connect every ecosystem. The coast protects them all.
          You did not restore five places — you restored one living world.&rdquo;
        </div>
        <div
          style={{
            marginTop: theme.spacing.md,
            textAlign: 'center',
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.bold,
            opacity: 0.9,
            letterSpacing: '0.02em',
          }}
        >
          Nothing thrives alone.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SanctuaryHint (shown before unlock)
// ---------------------------------------------------------------------------

function SanctuaryHint({ overallHealth }: { overallHealth: number }) {
  const c = theme.colors;
  const needed = 50;
  const progress = Math.min(100, Math.round((overallHealth / needed) * 100));

  return (
    <div
      style={{
        borderRadius: theme.borderRadius.lg,
        border: `1px dashed ${c.border}`,
        padding: theme.spacing.lg,
        textAlign: 'center',
        color: c.text.muted,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: theme.spacing.sm }}>🌺</div>
      <div style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xs }}>
        The Fairy Sanctuary
      </div>
      <div style={{ fontSize: theme.fontSize.sm, lineHeight: 1.5, marginBottom: theme.spacing.md }}>
        Restore all five zones to 50% to unlock your sanctuary, where all your guides will gather.
      </div>
      <div style={{ height: 6, background: c.border, borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: c.primary,
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11, marginTop: theme.spacing.xs }}>
        {progress}% of the way there
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionLabel helper
// ---------------------------------------------------------------------------

function SectionLabel({
  label,
  muted,
  style,
}: {
  label: string;
  muted?: boolean;
  style?: React.CSSProperties;
}) {
  const c = theme.colors;
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: theme.fontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: muted ? c.text.muted : c.text.primary,
        marginBottom: theme.spacing.sm,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

export default QuietGarden;
