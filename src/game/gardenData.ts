/**
 * The Quiet Garden — static game content.
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
  appearsAtHealth: number;
}

export interface FairyMilestone {
  id: string;
  name: string;
  personality: string;
  wisdom: string;
  appearsAtHealth: number;
}

export interface RestorationAction {
  id: string;
  label: string;
  emoji: string;
  technique: string;
  healthGain: number;
  wisdom: string;
  unlockAtHealth: number;
}

export interface Zone {
  id: string;
  name: string;
  guide: GuideCharacter;
  emoji: string;
  tagline: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  headerTextColor: string;
  unlockAfterZoneId?: string;
  unlockAtZoneHealth?: number;
  actions: RestorationAction[];
  wildlife: WildlifeSighting[];
  fairies: FairyMilestone[];
}

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

export const ZONES: Zone[] = [
  {
    id: 'dryland',
    name: 'The Valley That Forgot The Rain',
    guide: {
      name: 'Moss',
      emoji: '🐸',
      greeting: 'Nothing is wrong with this place. It has simply forgotten how to keep water.',
    },
    emoji: '🌵',
    tagline: 'A valley that has forgotten how to hold the rain',
    description: 'The valley is dry. No birds. No insects. Cracked soil and the memory of water that once moved slowly through this land. Nothing is lost — only forgotten.',
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
        wisdom: 'Seed balls protect seeds from birds and drought until the rains come.',
      },
      {
        id: 'halfmoon_basins',
        label: 'Dig Half-Moon Basins',
        emoji: '🌙',
        technique: 'Semicircular bunds',
        healthGain: 15,
        unlockAtHealth: 0,
        wisdom: 'Semicircular bunds catch rainwater on slopes and let it sink into the soil slowly.',
      },
      {
        id: 'mulch',
        label: 'Lay Mulch Pathways',
        emoji: '🍂',
        technique: 'Sheet mulching',
        healthGain: 10,
        unlockAtHealth: 0,
        wisdom: 'Mulch breaks the force of rain and feeds the invisible world beneath.',
      },
      {
        id: 'native_grasses',
        label: 'Plant Native Grasses',
        emoji: '🌿',
        technique: 'Native grass establishment',
        healthGain: 12,
        unlockAtHealth: 25,
        wisdom: 'Native grasses evolved alongside this land over millennia.',
      },
      {
        id: 'rock_clusters',
        label: 'Place Rock Clusters',
        emoji: '🪨',
        technique: 'Rock microhabitat creation',
        healthGain: 8,
        unlockAtHealth: 25,
        wisdom: 'Rocks create microclimates for small creatures.',
      },
      {
        id: 'shade_trees',
        label: 'Establish Shade Trees',
        emoji: '🌳',
        technique: 'Dryland agroforestry',
        healthGain: 20,
        unlockAtHealth: 50,
        wisdom: 'A single tree transforms everything around it.',
      },
      {
        id: 'water_harvest',
        label: 'Build Water Harvesting',
        emoji: '💧',
        technique: 'Zai pits & swale systems',
        healthGain: 15,
        unlockAtHealth: 60,
        wisdom: 'Swales and check dams slow water across the landscape.',
      },
      {
        id: 'dryland_celebration',
        label: 'Welcome the First Rain',
        emoji: '🌦️',
        technique: 'Ecological milestone',
        healthGain: 15,
        unlockAtHealth: 75,
        wisdom: 'The first rain on restored dryland is something to witness.',
      },
    ],
    wildlife: [
      {
        id: 'ant',
        name: 'Ant',
        emoji: '🐜',
        role: 'Soil builder',
        fact: 'Ant tunnels aerate the soil and improve water infiltration.',
        appearsAtHealth: 10,
      },
      {
        id: 'monarch',
        name: 'Monarch',
        emoji: '🦋',
        role: 'Pollinator',
        fact: 'Monarchs depend on milkweed for their survival.',
        appearsAtHealth: 20,
      },
      {
        id: 'bee',
        name: 'Bee',
        emoji: '🐝',
        role: 'Pollinator',
        fact: 'Bees pollinate flowers and support plant reproduction.',
        appearsAtHealth: 25,
      },
      {
        id: 'beetle',
        name: 'Beetle',
        emoji: '🪲',
        role: 'Decomposer',
        fact: 'Beetles recycle organic matter back into the soil.',
        appearsAtHealth: 30,
      },
      {
        id: 'painted_lady',
        name: 'Painted Lady',
        emoji: '🦋',
        role: 'Migratory pollinator',
        fact: 'Painted ladies migrate thousands of miles following blooms.',
        appearsAtHealth: 40,
      },
      {
        id: 'quail',
        name: 'Quail',
        emoji: '🐦',
        role: 'Seed disperser',
        fact: 'Quail disperse seeds as they forage and scratch.',
        appearsAtHealth: 50,
      },
      {
        id: 'frog',
        name: 'Frog',
        emoji: '🐸',
        role: 'Wetland indicator',
        fact: 'Frogs indicate clean water and healthy ecosystems.',
        appearsAtHealth: 55,
      },
      {
        id: 'dragonfly',
        name: 'Dragonfly',
        emoji: '🟢',
        role: 'Aerial predator',
        fact: 'Dragonflies hunt insects and indicate water quality.',
        appearsAtHealth: 60,
      },
      {
        id: 'finch',
        name: 'Finch',
        emoji: '🐦',
        role: 'Seed eater',
        fact: 'Finches eat seeds and help disperse native plants.',
        appearsAtHealth: 65,
      },
      {
        id: 'hawk',
        name: 'Hawk',
        emoji: '🦅',
        role: 'Apex predator',
        fact: 'Hawks indicate a complete food web is functioning.',
        appearsAtHealth: 75,
      },
      {
        id: 'hoverfly',
        name: 'Hoverfly',
        emoji: '🪰',
        role: 'Pollinator',
        fact: 'Hoverflies mimic bees but are harmless pollinators.',
        appearsAtHealth: 70,
      },
      {
        id: 'cottontail',
        name: 'Cottontail',
        emoji: '🐰',
        role: 'Herbivore',
        fact: 'Cottontails browse vegetation and indicate food sources.',
        appearsAtHealth: 80,
      },
      {
        id: 'swallow',
        name: 'Swallow',
        emoji: '🐦',
        role: 'Insect hunter',
        fact: 'Swallows consume hundreds of insects daily.',
        appearsAtHealth: 85,
      },
    ],
    fairies: [
      {
        id: 'sprig',
        name: 'Sprig',
        personality: 'Cheerful, optimistic',
        wisdom: 'Every small action begins a larger transformation.',
        appearsAtHealth: 15,
      },
      {
        id: 'nima',
        name: 'Nima',
        personality: 'Wise, patient',
        wisdom: 'Water finds its way when the land listens.',
        appearsAtHealth: 35,
      },
      {
        id: 'bloom',
        name: 'Bloom',
        personality: 'Creative, vibrant',
        wisdom: 'Flowers are the earth\'s way of celebrating.',
        appearsAtHealth: 50,
      },
      {
        id: 'ripple',
        name: 'Ripple',
        personality: 'Playful, curious',
        wisdom: 'Small movements create waves of change.',
        appearsAtHealth: 65,
      },
      {
        id: 'tampopo',
        name: 'Tampopo',
        personality: 'Ancient, serene',
        wisdom: 'All healing is simply returning to what was always possible.',
        appearsAtHealth: 80,
      },
    ],
  },
];
