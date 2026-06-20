/**
 * The Gardener's Journal — static content for plants and guide notes.
 */

export interface PlantEntry {
  id: string;
  name: string;
  emoji: string;
  zoneId: string;
  biome: string;
  role: string;
  fact: string;
  attractsWildlife: string[];
  appearsAtHealth: number;
}

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

export type DiscoveryLevel = 0 | 1 | 2 | 3;

export const PLANTS: PlantEntry[] = [
  {
    id: 'blue_grama',
    name: 'Blue Grama Grass',
    emoji: '🌾',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Pioneer species',
    fact: 'Blue grama is drought-tolerant and native. Its deep roots anchor the earth.',
    attractsWildlife: ['Ants', 'Beetles'],
    appearsAtHealth: 5,
  },
  {
    id: 'desert_marigold',
    name: 'Desert Marigold',
    emoji: '🌼',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Pollinator support',
    fact: 'Desert marigolds thrive in arid regions and provide nectar when most others rest.',
    attractsWildlife: ['Bees', 'Hoverflies'],
    appearsAtHealth: 15,
  },
  {
    id: 'milkweed',
    name: 'Milkweed',
    emoji: '🌺',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Host plant',
    fact: 'Monarch caterpillars can only develop on milkweed.',
    attractsWildlife: ['Monarchs'],
    appearsAtHealth: 25,
  },
  {
    id: 'lupine',
    name: 'Lupine',
    emoji: '💜',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Nitrogen fixer',
    fact: 'Lupines host bacteria that convert atmospheric nitrogen for other plants.',
    attractsWildlife: ['Butterflies', 'Bees'],
    appearsAtHealth: 35,
  },
  {
    id: 'mesquite',
    name: 'Mesquite',
    emoji: '🌳',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Nitrogen fixer & food source',
    fact: 'Mesquite trees fix nitrogen while producing nutrient-dense seed pods.',
    attractsWildlife: ['Beetles', 'Birds'],
    appearsAtHealth: 50,
  },
  {
    id: 'sage',
    name: 'Sage',
    emoji: '🌿',
    zoneId: 'dryland',
    biome: 'Dryland Valley',
    role: 'Drought specialist',
    fact: 'Sage evolved to survive prolonged drought with volatile oils.',
    attractsWildlife: ['Native Bees', 'Beetles'],
    appearsAtHealth: 40,
  },
];

export const GUIDE_NOTES: GuideNote[] = [
  {
    id: 'moss_1',
    zoneId: 'dryland',
    guideName: 'Moss',
    guideEmoji: '🐸',
    noteNumber: 1,
    noteTitle: 'On Water',
    text: 'Water is not lazy. It simply follows the invitations the land gives it.',
    appearsAtHealth: 8,
  },
  {
    id: 'moss_2',
    zoneId: 'dryland',
    guideName: 'Moss',
    guideEmoji: '🐸',
    noteNumber: 2,
    noteTitle: 'On Patience',
    text: 'Water is patient. It does not force its way into the soil. It waits for invitations.',
    appearsAtHealth: 35,
  },
  {
    id: 'moss_3',
    zoneId: 'dryland',
    guideName: 'Moss',
    guideEmoji: '🐸',
    noteNumber: 3,
    noteTitle: 'On Remembering',
    text: 'Most healing looks like one good rain held a little longer than the last.',
    appearsAtHealth: 70,
  },
];

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
