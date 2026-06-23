/**
 * The Gardener's Journal — a living field notebook that fills in as
 * ecosystems heal. Four tabs: Plants, Wildlife, Fairies, Guide Notes.
 *
 * Discovery levels (derived from zone health, never stored separately):
 *   0 — Silhouette: not yet encountered
 *   1 — Glimpsed:   first sighting, name + role visible
 *   2 — Observed:   zone ≥ 50%, ecological fact revealed
 *   3 — Documented: zone ≥ 90%, full entry, attracted wildlife, note
 */
import React, { useState, useRef, useEffect } from 'react';
import { theme } from '../theme';
import { getSafeArea } from '../services/environment';
import { track } from '../services/analytics';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { ZONES } from './gardenData';
import {
  PLANTS,
  GUIDE_NOTES,
  PlantEntry,
  GuideNote,
  DiscoveryLevel,
  plantDiscoveryLevel,
  wildlifeDiscoveryLevel,
  DISCOVERY_LABELS,
} from './journalData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JournalTab = 'plants' | 'wildlife' | 'fairies' | 'notes';

interface JournalProps {
  zoneHealthMap: Record<string, number>;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const PARCHMENT = '#FDFAF2';
const PARCHMENT_DARK = '#F5EFE0';
const INK = '#2E251F';
const INK_MUTED = '#7A6A58';
const INK_FAINT = '#B4A898';
const BORDER = 'rgba(120,90,60,0.15)';
const SHADOW = '2px 3px 10px rgba(80,55,30,0.08)';

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function Journal({ zoneHealthMap, onClose }: JournalProps) {
  const safeArea = getSafeArea();
  const [activeTab, setActiveTab] = useState<JournalTab>('plants');
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle arrow key scrolling for accessibility (users without mouse scroll)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!contentRef.current) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        contentRef.current.scrollBy({ top: 60, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        contentRef.current.scrollBy({ top: -60, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tabs: { id: JournalTab; label: string; emoji: string }[] = [
    { id: 'plants', label: 'Plants', emoji: '🌿' },
    { id: 'wildlife', label: 'Wildlife', emoji: '🦋' },
    { id: 'fairies', label: 'Fairies', emoji: '✨' },
    { id: 'notes', label: 'Guide Notes', emoji: '📝' },
  ];

  const handleTabChange = (tab: JournalTab) => {
    setActiveTab(tab);
    track('custom_journal_tab_viewed', { tab });
  };

  // Summary counts for the header
  const totalPlants = PLANTS.length;
  const discoveredPlants = PLANTS.filter(
    (p) => plantDiscoveryLevel(p, zoneHealthMap[p.zoneId] ?? 0) > 0,
  ).length;
  const totalWildlife = ZONES.flatMap((z) => z.wildlife).length;
  const discoveredWildlife = ZONES.flatMap((z) =>
    z.wildlife.filter((w) => wildlifeDiscoveryLevel(w.appearsAtHealth, zoneHealthMap[z.id] ?? 0) > 0),
  ).length;
  const totalFairies = ZONES.flatMap((z) => z.fairies).length;
  const discoveredFairies = ZONES.flatMap((z) =>
    z.fairies.filter((f) => (zoneHealthMap[z.id] ?? 0) >= f.appearsAtHealth),
  ).length;
  const totalNotes = GUIDE_NOTES.length;
  const discoveredNotes = GUIDE_NOTES.filter(
    (n) => (zoneHealthMap[n.zoneId] ?? 0) >= n.appearsAtHealth,
  ).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: PARCHMENT,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 500,
        paddingTop: safeArea.top,
        paddingBottom: safeArea.bottom,
      }}
    >
      {/* ── Journal Header ──────────────────────────────────────────────── */}
      <div
        style={{
          background: '#3A2A1A',
          color: '#F5EFE0',
          padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#C8A878',
            fontSize: theme.fontSize.md,
            cursor: 'pointer',
            padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
            borderRadius: theme.borderRadius.sm,
          }}
        >
          ← Garden
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold }}>
            📖 The Gardener&rsquo;s Journal
          </div>
          <div style={{ fontSize: 11, color: '#A89070', marginTop: 2 }}>
            {discoveredPlants + discoveredWildlife + discoveredFairies + discoveredNotes} of{' '}
            {totalPlants + totalWildlife + totalFairies + totalNotes} entries discovered
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: PARCHMENT_DARK,
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tabs.map((tab) => {
          const counts: Record<JournalTab, [number, number]> = {
            plants: [discoveredPlants, totalPlants],
            wildlife: [discoveredWildlife, totalWildlife],
            fairies: [discoveredFairies, totalFairies],
            notes: [discoveredNotes, totalNotes],
          };
          const [found, total] = counts[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                flex: '0 0 auto',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #5C4430' : '3px solid transparent',
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                cursor: 'pointer',
                textAlign: 'center',
                color: isActive ? INK : INK_MUTED,
              }}
            >
              <div style={{ fontSize: 18 }}>{tab.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: isActive ? theme.fontWeight.semibold : theme.fontWeight.normal, marginTop: 2 }}>
                {tab.label}
              </div>
              <div style={{ fontSize: 10, color: INK_FAINT, marginTop: 1 }}>
                {found}/{total}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div
        ref={contentRef}
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
        {activeTab === 'plants' && (
          <PlantsTab zoneHealthMap={zoneHealthMap} />
        )}
        {activeTab === 'wildlife' && (
          <WildlifeTab zoneHealthMap={zoneHealthMap} />
        )}
        {activeTab === 'fairies' && (
          <FairiesTab zoneHealthMap={zoneHealthMap} />
        )}
        {activeTab === 'notes' && (
          <NotesTab zoneHealthMap={zoneHealthMap} />
        )}
        <div style={{ height: theme.spacing.xl }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plants Tab
// ---------------------------------------------------------------------------

function PlantsTab({ zoneHealthMap }: { zoneHealthMap: Record<string, number> }) {
  // Group by zone
  const zoneOrder = ['dryland', 'meadow', 'forest', 'wetland', 'dune'];
  const zoneNames: Record<string, string> = {
    dryland: 'The Valley That Forgot The Rain',
    meadow: 'The Meadow of Forgotten Wings',
    forest: 'The Forest That Feeds Itself',
    wetland: 'The Wetland That Remembers',
    dune: 'The Coastal Dunes',
  };

  return (
    <>
      {zoneOrder.map((zoneId) => {
        const zonePlants = PLANTS.filter((p) => p.zoneId === zoneId);
        const health = zoneHealthMap[zoneId] ?? 0;
        const zone = ZONES.find((z) => z.id === zoneId)!;
        // Check if zone is unlocked (simplified: check if parent zone has 30%)
        const isUnlocked = zoneId === 'dryland' || health > 0 ||
          (zone.unlockAfterZoneId
            ? (zoneHealthMap[zone.unlockAfterZoneId] ?? 0) >= (zone.unlockAtZoneHealth ?? 30)
            : true);

        return (
          <div key={zoneId}>
            {(() => {
              const discoveredInZone = zonePlants.filter(
                (p) => plantDiscoveryLevel(p, health) > 0,
              ).length;
              return (
                <ZoneSectionHeader
                  emoji={zone.emoji}
                  name={zoneNames[zoneId] ?? zoneId}
                  isUnlocked={isUnlocked}
                  discovered={discoveredInZone}
                  total={zonePlants.length}
                />
              );
            })()}
            {isUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                {zonePlants.map((plant) => (
                  <PlantCard
                    key={plant.id}
                    plant={plant}
                    level={plantDiscoveryLevel(plant, health)}
                  />
                ))}
              </div>
            ) : (
              <LockedZoneNote zoneName={zoneNames[zoneId] ?? zoneId} />
            )}
          </div>
        );
      })}
    </>
  );
}

function PlantCard({ plant, level }: { plant: PlantEntry; level: DiscoveryLevel }) {
  const isHidden = level === 0;

  return (
    <JournalCard muted={isHidden}>
      <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'flex-start' }}>
        {/* Illustration area */}
        <div
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            background: isHidden ? '#E8E0D0' : PARCHMENT_DARK,
            borderRadius: theme.borderRadius.sm,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isHidden ? 28 : 32,
            border: `1px solid ${BORDER}`,
            filter: isHidden ? 'grayscale(1) opacity(0.3)' : 'none',
          }}
        >
          {isHidden ? '?' : plant.emoji}
        </div>

        {/* Entry body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: theme.fontSize.md,
                fontWeight: theme.fontWeight.semibold,
                color: isHidden ? INK_FAINT : INK,
              }}
            >
              {isHidden ? '???' : plant.name}
            </span>
            <DiscoveryBadge level={level} />
          </div>

          {!isHidden && (
            <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 2 }}>
              {plant.biome} · {plant.role}
            </div>
          )}

          {isHidden && (
            <div style={{ fontSize: theme.fontSize.xs, color: INK_FAINT, marginTop: 4, fontStyle: 'italic' }}>
              Continue restoring to discover…
            </div>
          )}

          {/* Ecological fact — revealed at level 2 */}
          {level >= 2 && (
            <p
              style={{
                margin: `${theme.spacing.sm}px 0 0`,
                fontSize: theme.fontSize.sm,
                color: INK,
                lineHeight: 1.65,
                fontStyle: 'italic',
              }}
            >
              {plant.fact}
            </p>
          )}

          {/* Attracted wildlife — revealed at level 3 */}
          {level >= 3 && plant.attractsWildlife.length > 0 && (
            <div style={{ marginTop: theme.spacing.sm }}>
              <FieldStamp label="Attracts" />
              <div style={{ fontSize: theme.fontSize.xs, color: INK_MUTED, marginTop: 4 }}>
                {plant.attractsWildlife.join(' · ')}
              </div>
            </div>
          )}

          {/* Glimpsed note — level 1 only */}
          {level === 1 && (
            <p
              style={{
                margin: `${theme.spacing.sm}px 0 0`,
                fontSize: theme.fontSize.xs,
                color: INK_MUTED,
                lineHeight: 1.6,
                fontStyle: 'italic',
              }}
            >
              A {plant.role.toLowerCase()} was spotted. More time in the field needed.
            </p>
          )}
        </div>
      </div>
    </JournalCard>
  );
}

// ---------------------------------------------------------------------------
// Wildlife Tab
// ---------------------------------------------------------------------------

function WildlifeTab({ zoneHealthMap }: { zoneHealthMap: Record<string, number> }) {
  const zoneOrder = ['dryland', 'meadow', 'forest', 'wetland', 'dune'];
  const zoneNames: Record<string, string> = {
    dryland: 'The Valley That Forgot The Rain',
    meadow: 'The Meadow of Forgotten Wings',
    forest: 'The Forest That Feeds Itself',
    wetland: 'The Wetland That Remembers',
    dune: 'The Coastal Dunes',
  };

  return (
    <>
      {zoneOrder.map((zoneId) => {
        const zone = ZONES.find((z) => z.id === zoneId)!;
        const health = zoneHealthMap[zoneId] ?? 0;
        const isUnlocked = zoneId === 'dryland' || health > 0 ||
          (zone.unlockAfterZoneId
            ? (zoneHealthMap[zone.unlockAfterZoneId] ?? 0) >= (zone.unlockAtZoneHealth ?? 30)
            : true);

        return (
          <div key={zoneId}>
            {(() => {
              const discoveredInZone = zone.wildlife.filter(
                (w) => wildlifeDiscoveryLevel(w.appearsAtHealth, health) > 0,
              ).length;
              return (
                <ZoneSectionHeader
                  emoji={zone.emoji}
                  name={zoneNames[zoneId] ?? zoneId}
                  isUnlocked={isUnlocked}
                  discovered={discoveredInZone}
                  total={zone.wildlife.length}
                />
              );
            })()}
            {isUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                {zone.wildlife.map((w) => {
                  const level = wildlifeDiscoveryLevel(w.appearsAtHealth, health);
                  return (
                    <WildlifeCard
                      key={w.id}
                      name={w.name}
                      emoji={w.emoji}
                      role={w.role}
                      fact={w.fact}
                      level={level}
                    />
                  );
                })}
              </div>
            ) : (
              <LockedZoneNote zoneName={zoneNames[zoneId] ?? zoneId} />
            )}
          </div>
        );
      })}
    </>
  );
}

function WildlifeCard({
  name, emoji, role, fact, level,
}: { name: string; emoji: string; role: string; fact: string; level: DiscoveryLevel }) {
  const isHidden = level === 0;

  return (
    <JournalCard muted={isHidden}>
      <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            background: isHidden ? '#E8E0D0' : PARCHMENT_DARK,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            border: `1px solid ${BORDER}`,
            filter: isHidden ? 'grayscale(1) opacity(0.3)' : 'none',
          }}
        >
          {isHidden ? '?' : emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            <span style={{ fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold, color: isHidden ? INK_FAINT : INK }}>
              {isHidden ? '???' : name}
            </span>
            <DiscoveryBadge level={level} />
          </div>
          {!isHidden && (
            <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 2 }}>{role}</div>
          )}
          {level === 1 && (
            <p style={{ margin: `${theme.spacing.sm}px 0 0`, fontSize: theme.fontSize.xs, color: INK_MUTED, fontStyle: 'italic', lineHeight: 1.6 }}>
              Briefly sighted. Observation continuing.
            </p>
          )}
          {level >= 2 && (
            <p style={{ margin: `${theme.spacing.sm}px 0 0`, fontSize: theme.fontSize.sm, color: INK, lineHeight: 1.65, fontStyle: 'italic' }}>
              {fact}
            </p>
          )}
          {isHidden && (
            <p style={{ margin: `${theme.spacing.sm}px 0 0`, fontSize: theme.fontSize.xs, color: INK_FAINT, fontStyle: 'italic' }}>
              Continue restoring to discover…
            </p>
          )}
        </div>
      </div>
    </JournalCard>
  );
}

// ---------------------------------------------------------------------------
// Fairies Tab
// ---------------------------------------------------------------------------

function FairiesTab({ zoneHealthMap }: { zoneHealthMap: Record<string, number> }) {
  return (
    <>
      {ZONES.map((zone) => {
        const health = zoneHealthMap[zone.id] ?? 0;
        const isUnlocked = !zone.unlockAfterZoneId ||
          (zoneHealthMap[zone.unlockAfterZoneId] ?? 0) >= (zone.unlockAtZoneHealth ?? 30);

        return (
          <div key={zone.id}>
            {(() => {
              const discoveredInZone = zone.fairies.filter((f) => health >= f.appearsAtHealth).length;
              return (
                <ZoneSectionHeader
                  emoji={zone.emoji}
                  name={zone.name}
                  isUnlocked={isUnlocked}
                  discovered={discoveredInZone}
                  total={zone.fairies.length}
                />
              );
            })()}
            {isUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                {zone.fairies.map((f) => {
                  const discovered = health >= f.appearsAtHealth;
                  return (
                    <FairyCard
                      key={f.id}
                      name={f.name}
                      personality={f.personality}
                      wisdom={f.wisdom}
                      discovered={discovered}
                    />
                  );
                })}
              </div>
            ) : (
              <LockedZoneNote zoneName={zone.name} />
            )}
          </div>
        );
      })}
    </>
  );
}

function FairyCard({
  name, personality, wisdom, discovered,
}: { name: string; personality: string; wisdom: string; discovered: boolean }) {
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; x: number; y: number; vx: number; vy: number; life: number }>>([]);
  const particleIdRef = useRef(0);

  // Map fairy names to personality emojis for the Easter egg
  const getEasterEggEmojis = (fairyName: string): string[] => {
    const emojiMap: Record<string, string[]> = {
      'Sprig': ['🌟', '⚡', '🎉', '💫', '✨'],
      'Nima': ['💧', '🌊', '🌙', '✨', '💎'],
      'Bloom': ['🌸', '🌺', '🌻', '🦋', '🌹'],
      'Ripple': ['🌀', '💨', '🌊', '🎪', '🎨'],
      'Tampopo': ['🌿', '🍃', '🕊️', '🌾', '🍂'],
    };
    return emojiMap[fairyName] || ['✨'];
  };

  const handleFairyClick = () => {
    if (!discovered) return;

    // Record Easter egg interaction
    RundotGameAPI.analytics.recordCustomEvent('fairy_easter_egg_triggered', { fairy: name });

    // Create explosion particles
    const emojis = getEasterEggEmojis(name);
    const newParticles = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 120 + Math.random() * 80;
      const emoji = emojis[Math.floor(Math.random() * emojis.length)] || '✨';
      return {
        id: particleIdRef.current++,
        emoji,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
      };
    });
    setParticles(newParticles);
  };

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx * 0.016,
            y: p.y + p.vy * 0.016,
            vy: p.vy + 200 * 0.016, // gravity
            life: p.life - 0.016 / 0.6, // fade over 0.6s
          }))
          .filter((p) => p.life > 0)
      );
    }, 16);

    return () => clearInterval(interval);
  }, [particles]);

  return (
    <JournalCard muted={!discovered}>
      <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'flex-start' }}>
        {/* Fairy portrait area */}
        <div
          onClick={handleFairyClick}
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            background: discovered ? 'linear-gradient(135deg, #EFE8FF, #F8F0FF)' : '#E8E0D0',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            border: `1px solid ${discovered ? 'rgba(160,120,200,0.3)' : BORDER}`,
            filter: discovered ? 'none' : 'grayscale(1) opacity(0.3)',
            cursor: discovered ? 'pointer' : 'default',
            position: 'relative',
            transition: discovered ? 'transform 0.1s' : 'none',
          }}
          onMouseDown={(e) => {
            if (discovered) (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            if (discovered) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
          }}
        >
          {discovered ? '✨' : '?'}
          {/* Explosion particles */}
          {particles.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
                fontSize: 16,
                pointerEvents: 'none',
                opacity: p.life,
                transition: 'none',
              }}
            >
              {p.emoji}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            <span style={{ fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold, color: discovered ? INK : INK_FAINT }}>
              {discovered ? name : '???'}
            </span>
            {discovered && (
              <span
                style={{
                  fontSize: 10,
                  background: 'rgba(160,120,200,0.12)',
                  color: '#6A4A9A',
                  padding: '2px 6px',
                  borderRadius: theme.borderRadius.full,
                  fontWeight: theme.fontWeight.semibold,
                }}
              >
                Visited
              </span>
            )}
          </div>
          {discovered && (
            <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 2 }}>{personality}</div>
          )}
          {discovered ? (
            <p
              style={{
                margin: `${theme.spacing.sm}px 0 0`,
                fontSize: theme.fontSize.md,
                color: INK,
                lineHeight: 1.65,
                fontStyle: 'italic',
              }}
            >
              &ldquo;{wisdom}&rdquo;
            </p>
          ) : (
            <p style={{ margin: `${theme.spacing.sm}px 0 0`, fontSize: theme.fontSize.xs, color: INK_FAINT, fontStyle: 'italic' }}>
              This fairy has not yet visited.
            </p>
          )}
        </div>
      </div>
    </JournalCard>
  );
}

// ---------------------------------------------------------------------------
// Guide Notes Tab
// ---------------------------------------------------------------------------

function NotesTab({ zoneHealthMap }: { zoneHealthMap: Record<string, number> }) {
  const guideOrder = ['moss', 'clover', 'rowan', 'ripple', 'sable'];
  const zoneForGuide: Record<string, string> = {
    moss: 'dryland',
    clover: 'meadow',
    rowan: 'forest',
    ripple: 'wetland',
    sable: 'dune',
  };

  return (
    <>
      {guideOrder.map((guideKey) => {
        const zoneId = zoneForGuide[guideKey] ?? '';
        const health = zoneHealthMap[zoneId] ?? 0;
        const notes = GUIDE_NOTES.filter((n) => n.zoneId === zoneId);
        const guide = notes[0];
        if (!guide) return null;
        const zone = ZONES.find((z) => z.id === zoneId)!;
        const isUnlocked = !zone.unlockAfterZoneId ||
          (zoneHealthMap[zone.unlockAfterZoneId] ?? 0) >= (zone.unlockAtZoneHealth ?? 30);

        return (
          <div key={guideKey}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.sm,
              }}
            >
              <span style={{ fontSize: 24 }}>{guide.guideEmoji}</span>
              <div>
                <div style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, color: INK }}>
                  {guide.guideName}&rsquo;s Notes
                </div>
                <div style={{ fontSize: 11, color: INK_MUTED }}>
                  {zone.name}
                </div>
              </div>
            </div>

            {isUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                {notes.map((note) => (
                  <NoteCard key={note.id} note={note} discovered={(health >= note.appearsAtHealth)} />
                ))}
              </div>
            ) : (
              <LockedZoneNote zoneName={zone.name} />
            )}
          </div>
        );
      })}
    </>
  );
}

function NoteCard({ note, discovered }: { note: GuideNote; discovered: boolean }) {
  return (
    <div
      style={{
        background: discovered ? PARCHMENT : '#EEEAE0',
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${discovered ? '#5C4430' : BORDER}`,
        borderRadius: theme.borderRadius.sm,
        padding: theme.spacing.md,
        boxShadow: discovered ? SHADOW : 'none',
        opacity: discovered ? 1 : 0.5,
      }}
    >
      <div style={{ fontSize: 11, color: INK_FAINT, marginBottom: theme.spacing.xs }}>
        {note.guideName}&rsquo;s Note #{note.noteNumber} — {note.noteTitle}
      </div>
      {discovered ? (
        <p
          style={{
            margin: 0,
            fontSize: theme.fontSize.sm,
            color: INK,
            lineHeight: 1.75,
            fontStyle: 'italic',
          }}
        >
          {note.text}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: theme.fontSize.sm, color: INK_FAINT, fontStyle: 'italic' }}>
          This note will reveal itself as the ecosystem heals…
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function JournalCard({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      style={{
        background: muted ? '#EEEAE0' : PARCHMENT,
        border: `1px solid ${BORDER}`,
        borderRadius: theme.borderRadius.sm,
        padding: theme.spacing.md,
        boxShadow: muted ? 'none' : SHADOW,
        opacity: muted ? 0.7 : 1,
      }}
    >
      {children}
    </div>
  );
}

function DiscoveryBadge({ level }: { level: DiscoveryLevel }) {
  if (level === 0) return null;
  const colours: Record<Exclude<DiscoveryLevel, 0>, [string, string]> = {
    1: ['rgba(120,90,60,0.1)', '#7A5A38'],
    2: ['rgba(92,140,102,0.12)', '#3C6A48'],
    3: ['rgba(80,60,140,0.12)', '#4A3A8A'],
  };
  const [bg, fg] = colours[level as Exclude<DiscoveryLevel, 0>];
  return (
    <span
      style={{
        fontSize: 10,
        background: bg,
        color: fg,
        padding: '2px 6px',
        borderRadius: theme.borderRadius.full,
        fontWeight: theme.fontWeight.semibold,
        flexShrink: 0,
      }}
    >
      {DISCOVERY_LABELS[level]}
    </span>
  );
}

function ZoneSectionHeader({
  emoji, name, isUnlocked, discovered, total,
}: { emoji: string; name: string; isUnlocked: boolean; discovered?: number; total?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
        paddingBottom: theme.spacing.xs,
        borderBottom: `1px solid ${BORDER}`,
        opacity: isUnlocked ? 1 : 0.5,
      }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <div
        style={{
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.bold,
          color: isUnlocked ? INK : INK_FAINT,
          fontStyle: 'italic',
          flex: 1,
        }}
      >
        {name}
      </div>
      {discovered !== undefined && total !== undefined && (
        <div style={{ fontSize: 11, color: INK_MUTED, marginLeft: 'auto' }}>
          {discovered}/{total}
        </div>
      )}
      {!isUnlocked && (
        <span style={{ fontSize: 12, marginLeft: discovered !== undefined ? undefined : 'auto' }}>🔒</span>
      )}
    </div>
  );
}

function LockedZoneNote({ zoneName }: { zoneName: string }) {
  return (
    <div
      style={{
        background: '#EEEAE0',
        border: `1px dashed ${BORDER}`,
        borderRadius: theme.borderRadius.sm,
        padding: theme.spacing.md,
        fontSize: theme.fontSize.sm,
        color: INK_FAINT,
        fontStyle: 'italic',
        marginBottom: theme.spacing.md,
        textAlign: 'center',
      }}
    >
      Restore earlier ecosystems to unlock entries from {zoneName}.
    </div>
  );
}

function FieldStamp({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: theme.fontWeight.bold,
        color: INK_MUTED,
        borderBottom: `1px solid ${BORDER}`,
        paddingBottom: 1,
      }}
    >
      {label}
    </span>
  );
}

export default Journal;
