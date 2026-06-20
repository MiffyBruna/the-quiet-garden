/**
 * The Quiet Garden — static game content.
 *
 * Five ecosystems to restore, each with a fairy guide, a set of real
 * ecological restoration techniques, and wisdom messages that teach the
 * science behind the work.
 */

export interface GuideCharacter {
  name: string;
  emoji: string;
  greeting: string;
}

export interface WildlifeSighting {
  id: string;
  name: string;
  emoji: string;
  role: string;
  fact: string;
  /** Zone health % at which this animal first arrives */
  appearsAtHealth: number;
}

export interface FairyMilestone {
  id: string;
  name: string;
  /** Short personality hint shown in the card */
  personality: string;
  wisdom: string;
  /** Zone health % at which this fairy first visits */
  appearsAtHealth: number;
}

export interface RestorationAction {
  id: string;
  label: string;
  emoji: string;
  /** Actual ecological technique name, shown as a subtitle */
  technique: string;
  healthGain: number;
  /** What the guide says after this action */
  wisdom: string;
  /** Only appears once zone health (0–100) is at or above this value */
  unlockAtHealth: number;
}

export interface Zone {
  id: string;
  name: string;
  guide: GuideCharacter;
  emoji: string;
  tagline: string;
  description: string;
  /** CSS gradient for the card header */
  gradientFrom: string;
  gradientTo: string;
  /** Text color over the gradient header */
  headerTextColor: string;
  /** This zone is locked until the named zone reaches the given health % */
  unlockAfterZoneId?: string;
  unlockAtZoneHealth?: number;
  actions: RestorationAction[];
  /** Wildlife that return as the zone heals */
  wildlife: WildlifeSighting[];
  /** Fairies that visit at restoration milestones */
  fairies: FairyMilestone[];
}

// ---------------------------------------------------------------------------
// Helper: derive health % from completed actions
// ---------------------------------------------------------------------------

export function calculateZoneHealth(completedActionIds: string[], zone: Zone): number {
  const maxHealth = zone.actions.reduce((sum, a) => sum + a.healthGain, 0);
  if (maxHealth === 0) return 0;
  const earned = zone.actions
    .filter((a) => completedActionIds.includes(a.id))
    .reduce((sum, a) => sum + a.healthGain, 0);
  return Math.min(100, Math.round((earned / maxHealth) * 100));
}

export function getZoneStateLabel(health: number): string {
  if (health >= 90) return 'Fully restored ✨';
  if (health >= 70) return 'Flourishing';
  if (health >= 50) return 'Recovering';
  if (health >= 30) return 'Waking up';
  if (health >= 10) return 'First signs of life';
  return 'Damaged';
}

export function getOverallHealth(completedActions: Record<string, string[]>): number {
  const scores = ZONES.map((z) => calculateZoneHealth(completedActions[z.id] ?? [], z));
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / ZONES.length);
}

// ---------------------------------------------------------------------------
// Zone data
// ---------------------------------------------------------------------------

export const ZONES: Zone[] = [
  // ── 1. DRYLAND ────────────────────────────────────────────────────────────
  {
    id: 'dryland',
    name: 'The Valley That Forgot The Rain',
    guide: {
      name: 'Moss',
      emoji: '🐸',
      greeting:
        'Nothing is wrong with this place. It has simply forgotten how to keep water.',
    },
    emoji: '🌵',
    tagline: 'A valley that has forgotten how to hold the rain',
    description:
      'The valley is dry. No birds. No insects. Cracked soil and the memory of water that once moved slowly through this land. Nothing is lost — only forgotten.',
    gradientFrom: '#C87941',
    gradientTo: '#E8B87A',
    headerTextColor: '#FFFBF0',
    actions: [
      {
        id: 'seed_balls',
        label: 'Scatter Seed Balls',
        emoji: '🌱',
        technique: 'Seed ball inoculation',
        healthGain: 10,
        unlockAtHealth: 0,
        wisdom:
          'Seed balls — clay, compost, and native seeds rolled together — protect seeds from birds and drought until the rains come. Ancient farmers used this technique across Africa and Asia for thousands of years.',
      },
      {
        id: 'halfmoon_basins',
        label: 'Dig Half-Moon Basins',
        emoji: '🌙',
        technique: 'Semicircular bunds',
        healthGain: 15,
        unlockAtHealth: 0,
        wisdom:
          'Semicircular bunds — shaped like half-moons, open end facing downhill — catch rainwater on slopes and let it sink into the soil slowly. Each basin becomes a small oasis where seeds germinate and soil life returns.',
      },
      {
        id: 'mulch',
        label: 'Lay Mulch Pathways',
        emoji: '🍂',
        technique: 'Sheet mulching',
        healthGain: 10,
        unlockAtHealth: 0,
        wisdom:
          'Mulch breaks the force of rain, slows its flow, and feeds the invisible world beneath: fungi, bacteria, earthworms. A mulched soil drinks rain like a sponge instead of letting it run away.',
      },
      {
        id: 'native_grasses',
        label: 'Plant Native Grasses',
        emoji: '🌿',
        technique: 'Native grass establishment',
        healthGain: 12,
        unlockAtHealth: 25,
        wisdom:
          'Native grasses evolved alongside this land\'s weather and soils over millennia. Their deep roots anchor the earth, their seed heads feed birds through winter, and they ask nothing but to be left alone.',
      },
      {
        id: 'rock_clusters',
        label: 'Place Rock Clusters',
        emoji: '🪨',
        technique: 'Rock microhabitat creation',
        healthGain: 8,
        unlockAtHealth: 25,
        wisdom:
          'Rocks create microclimates. Their shaded sides stay moist longer; morning dew collects on their cool surfaces. Lizards, insects, and small plants gather in their company. Every rock is a tiny world.',
      },
      {
        id: 'shade_trees',
        label: 'Establish Shade Trees',
        emoji: '🌳',
        technique: 'Dryland agroforestry',
        healthGain: 20,
        unlockAtHealth: 50,
        wisdom:
          'A single tree transforms everything around it. It pumps moisture up from deep roots and releases it into the air as transpiration. It shelters the ground below from burning sun. It calls birds who carry seeds of the next forest.',
      },
      {
        id: 'water_harvest',
        label: 'Build Water Harvesting',
        emoji: '💧',
        technique: 'Zai pits & swale systems',
        healthGain: 15,
        unlockAtHealth: 60,
        wisdom:
          'Swales, ponds, and check dams slow water across the landscape. Zai pits — hand-dug planting holes — concentrate moisture and fertility where crops are planted. A dryland with good water harvesting can sustain a forest.',
      },
      {
        id: 'dryland_celebration',
        label: 'Welcome the First Rain',
        emoji: '🌦️',
        technique: 'Ecological milestone',
        healthGain: 15,
        unlockAtHealth: 75,
        wisdom:
          'The first rain on restored dryland is something to witness. It sinks in rather than running off. The soil exhales a smell called petrichor — released by soil bacteria greeting the water they\'ve been waiting for. Life is returning.',
      },
    ],
    wildlife: [
      {
        id: 'harvester_ant',
        name: 'Harvester Ant',
        emoji: '🐜',
        role: 'Soil builder',
        fact: 'Ant tunnels aerate the soil and dramatically improve water infiltration. Before you see them, they are already working.',
        appearsAtHealth: 10,
      },
      {
        id: 'darkling_beetle',
        name: 'Darkling Beetle',
        emoji: '🪲',
        role: 'Decomposer',
        fact: 'Darkling beetles recycle organic matter back into the soil. They are the cleanup crew that every dry ecosystem depends on.',
        appearsAtHealth: 20,
      },
      {
        id: 'solitary_bee',
        name: 'Solitary Bee',
        emoji: '🐝',
        role: 'First pollinator',
        fact: 'Most bee species are solitary — no hive, no queen, just one bee raising her young alone. The first one to return means there are flowers worth visiting.',
        appearsAtHealth: 30,
      },
      {
        id: 'painted_lady',
        name: 'Painted Lady Butterfly',
        emoji: '🦋',
        role: 'Migratory pollinator',
        fact: 'Painted ladies migrate thousands of miles, following the bloom. Their arrival means the valley is back on the map of living places.',
        appearsAtHealth: 55,
      },
      {
        id: 'california_quail',
        name: 'California Quail',
        emoji: '🐦',
        role: 'Seed disperser',
        fact: 'Quail disperse seeds as they scratch and forage. Each quail is also a small gardener, unknowingly planting the valley\'s next generation.',
        appearsAtHealth: 75,
      },
      {
        id: 'red_tailed_hawk',
        name: 'Red-Tailed Hawk',
        emoji: '🦅',
        role: 'Apex predator',
        fact: 'A hawk in residence means the whole food web is working. You cannot have a hawk without mice. You cannot have mice without seeds. You cannot have seeds without flowers.',
        appearsAtHealth: 92,
      },
    ],
    fairies: [
      {
        id: 'rain_fairy',
        name: 'Rain Fairy',
        personality: 'Playful, curious',
        wisdom: 'The land does not drink faster because it is thirsty.',
        appearsAtHealth: 15,
      },
      {
        id: 'marigold_fairy',
        name: 'Marigold Fairy',
        personality: 'Cheerful, encouraging',
        wisdom: 'Small roots hold small worlds together.',
        appearsAtHealth: 45,
      },
      {
        id: 'stream_fairy',
        name: 'Stream Fairy',
        personality: 'Wise, ancient',
        wisdom: 'Water remembers every kindness.',
        appearsAtHealth: 85,
      },
    ],
  },
];
