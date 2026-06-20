/**
 * The Gardener's Journal — static content for the field journal feature.
 *
 * Plants (30 = 6 per zone × 5 zones), Guide Notes (3 per guide × 5 guides).
 * Wildlife and fairies are imported from gardenData.ts.
 *
 * Discovery levels are derived at runtime from zone health:
 *   0  — zone locked or health < appearsAtHealth  (silhouette)
 *   1  — Glimpsed:    health >= appearsAtHealth
 *   2  — Observed:    health >= 50
 *   3  — Documented:  health >= 90
 */

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------

export interface PlantEntry {
  id: string;
  name: string;
  emoji: string;
  zoneId: string;
  biome: string;
  role: string;
  fact: string;
  attractsWildlife: string[];
  /** Zone health % when this plant first appears in the journal */
  appearsAtHealth: number;
}

export const PLANTS: PlantEntry[] = [
  // ── DRYLAND ───────────────────────────────────────────────────────────────
  {
    id: 'blue_grama',
    name: 'Blue Grama Grass',
    emoji: '🌾',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Pioneer species',
    fact: 'Blue grama is drought-tolerant and native to North America. It is often among the first plants to establish in recovering grasslands, stitching cracked soil back together with deep, patient roots.',
    attractsWildlife: ['Ants', 'Beetles', 'Grasshoppers'],
    appearsAtHealth: 5,
  },
  {
    id: 'desert_marigold',
    name: 'Desert Marigold',
    emoji: '🌼',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Pollinator support',
    fact: 'Desert marigolds thrive in arid regions and provide nectar during the dry season when most other plants have given up. They are a lifeline for early pollinators.',
    attractsWildlife: ['Solitary Bees', 'Hoverflies'],
    appearsAtHealth: 15,
  },
  {
    id: 'lupine',
    name: 'Lupine',
    emoji: '💜',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Nitrogen fixer',
    fact: 'Lupines host bacteria in their roots that convert atmospheric nitrogen into a form other plants can use. They are not just growing — they are rebuilding the soil for everything that comes after them.',
    attractsWildlife: ['Butterflies', 'Bees'],
    appearsAtHealth: 25,
  },
  {
    id: 'sage',
    name: 'Sage',
    emoji: '🌿',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Drought specialist',
    fact: 'Sage evolved to survive prolonged drought by producing volatile oils that cool the air around them and slow water loss. Their silver-green leaves are a form of survival engineering.',
    attractsWildlife: ['Native Bees', 'Beetles'],
    appearsAtHealth: 40,
  },
  {
    id: 'milkweed',
    name: 'Milkweed',
    emoji: '🌺',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Host plant',
    fact: 'Monarch caterpillars can only develop on milkweed. Without it, the monarch butterfly cannot complete its life cycle. Planting milkweed is not gardening — it is migration infrastructure.',
    attractsWildlife: ['Monarch Butterflies'],
    appearsAtHealth: 55,
  },
  {
    id: 'mesquite',
    name: 'Mesquite',
    emoji: '🌳',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Nitrogen fixer & food source',
    fact: 'Mesquite trees fix nitrogen while producing nutrient-dense seed pods. Indigenous peoples gathered mesquite pods for thousands of years, ground them into flour, and stored them for months. A single mesquite tree can feed a family.',
    attractsWildlife: ['Beetles', 'Birds'],
    appearsAtHealth: 70,
  },

];

// ---------------------------------------------------------------------------
// Guide Notes
// ---------------------------------------------------------------------------

export interface GuideNote {
  id: string;
  zoneId: string;
  guideName: string;
  guideEmoji: string;
  noteNumber: number;
  noteTitle: string;
  text: string;
  appearsAtHealth: number;
}

export const GUIDE_NOTES: GuideNote[] = [
  // ── MOSS (dryland) ────────────────────────────────────────────────────────
  {
    id: 'moss_1',
    zoneId: 'dryland',
    guideName: 'Moss',
    guideEmoji: '🐸',
    noteNumber: 1,
    noteTitle: 'On Water',
    text: 'Water is not lazy. It simply follows the invitations the land gives it. A cracked, compacted surface says: move on quickly. A mulched, bunded surface says: stay a while.',
    appearsAtHealth: 8,
  },
  {
    id: 'moss_2',
    zoneId: 'dryland',
    guideName: 'Moss',
    guideEmoji: '🐸',
    noteNumber: 2,
    noteTitle: 'On Patience',
    text: 'Water is patient. It does not force its way into the soil. It waits for invitations. Our job is to arrange those invitations — one bund, one seed ball, one mulched path at a time.',
    appearsAtHealth: 35,
  },
  {
    id: 'moss_3',
    zoneId: 'dryland',
    guideName: 'Moss',
    guideEmoji: '🐸',
    noteNumber: 3,
    noteTitle: 'On Remembering',
    text: 'Most healing looks like one good rain held a little longer than the last. The valley will not declare itself restored with a fanfare. One morning you will simply notice that it does not look thirsty anymore.',
    appearsAtHealth: 70,
  },
];

// ---------------------------------------------------------------------------
// Discovery helpers
// ---------------------------------------------------------------------------

export type DiscoveryLevel = 0 | 1 | 2 | 3;

export function plantDiscoveryLevel(plant: PlantEntry, zoneHealth: number): DiscoveryLevel {
  if (zoneHealth < plant.appearsAtHealth) return 0;
  if (zoneHealth >= 90) return 3;
  if (zoneHealth >= 50) return 2;
  return 1;
}

export function wildlifeDiscoveryLevel(appearsAtHealth: number, zoneHealth: number): DiscoveryLevel {
  if (zoneHealth < appearsAtHealth) return 0;
  if (zoneHealth >= 90) return 3;
  if (zoneHealth >= 50) return 2;
  return 1;
}

export const DISCOVERY_LABELS: Record<DiscoveryLevel, string> = {
  0: 'Not yet discovered',
  1: 'Glimpsed',
  2: 'Observed',
  3: 'Documented',
};
