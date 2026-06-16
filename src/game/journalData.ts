/**
 * The Gardener's Journal — static content for the field journal feature.
 *
 * Plants (28), Guide Notes (3 per guide × 5 guides).
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
    appearsAtHealth: 28,
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

  // ── MEADOW ────────────────────────────────────────────────────────────────
  {
    id: 'camas',
    name: 'Camas',
    emoji: '🌸',
    zoneId: 'meadow',
    biome: 'The Meadow',
    role: 'Early bloom',
    fact: 'Camas was cultivated by Indigenous peoples for food long before modern agriculture. Its blue-violet flower carpets were described by early explorers as looking like lakes from a distance.',
    attractsWildlife: ['Mason Bees'],
    appearsAtHealth: 5,
  },
  {
    id: 'violet',
    name: 'Violet',
    emoji: '🔵',
    zoneId: 'meadow',
    biome: 'The Meadow',
    role: 'Early pollinator food',
    fact: 'Violets bloom before most other meadow plants, providing critical early-season nectar when bees first emerge. The seeds are also carried by ants, spreading the plant across the meadow.',
    attractsWildlife: ['Bumblebees'],
    appearsAtHealth: 10,
  },
  {
    id: 'yarrow',
    name: 'Yarrow',
    emoji: '🌿',
    zoneId: 'meadow',
    biome: 'The Meadow',
    role: 'Mid-season bloom',
    fact: 'Yarrow\'s flat flower heads create a landing platform for dozens of pollinator species at once. It has been used medicinally for thousands of years — and ecologically for just as long.',
    attractsWildlife: ['Hoverflies', 'Bees'],
    appearsAtHealth: 22,
  },
  {
    id: 'bee_balm',
    name: 'Bee Balm',
    emoji: '🌺',
    zoneId: 'meadow',
    biome: 'The Meadow',
    role: 'Hummingbird plant',
    fact: 'Bee balm\'s tubular red flowers are perfectly shaped for hummingbird beaks. Its strong aromatic oils also deter pests from nearby plants — it is a generous neighbour.',
    attractsWildlife: ['Hummingbirds', 'Bumblebees'],
    appearsAtHealth: 35,
  },
  {
    id: 'goldenrod',
    name: 'Goldenrod',
    emoji: '🌻',
    zoneId: 'meadow',
    biome: 'The Meadow',
    role: 'Late-season nectar',
    fact: 'Goldenrod is often blamed for hayfever, but ragweed is almost always responsible. Goldenrod pollen is too heavy to blow in wind — it needs an insect to carry it. It has been unfairly maligned for a century.',
    attractsWildlife: ['Butterflies', 'Bees'],
    appearsAtHealth: 48,
  },
  {
    id: 'aster',
    name: 'Aster',
    emoji: '🌸',
    zoneId: 'meadow',
    biome: 'The Meadow',
    role: 'Late bloom',
    fact: 'Asters are among the last flowers to bloom before winter. For migrating pollinators, they are a final fuel stop — a meadow with asters extends the season for dozens of species.',
    attractsWildlife: ['Migrating Pollinators'],
    appearsAtHealth: 60,
  },

  // ── FOREST ────────────────────────────────────────────────────────────────
  {
    id: 'oak',
    name: 'Oak',
    emoji: '🌳',
    zoneId: 'forest',
    biome: 'The Forest',
    role: 'Keystone tree',
    fact: 'A single mature oak can support more than 500 species of insects alone — and those insects support birds, bats, and mammals. The oak is not one plant. It is an entire community with a trunk.',
    attractsWildlife: ['Birds', 'Squirrels', 'Deer'],
    appearsAtHealth: 5,
  },
  {
    id: 'chestnut',
    name: 'Chestnut',
    emoji: '🌰',
    zoneId: 'forest',
    biome: 'The Forest',
    role: 'Food producer',
    fact: 'Chestnuts produce highly nutritious food for wildlife and humans alike. The American chestnut was devastated by blight in the 20th century — restoration plantings are slowly bringing it back.',
    attractsWildlife: ['Deer', 'Small Mammals'],
    appearsAtHealth: 15,
  },
  {
    id: 'serviceberry',
    name: 'Serviceberry',
    emoji: '🫐',
    zoneId: 'forest',
    biome: 'The Forest',
    role: 'Fruit tree',
    fact: 'Serviceberries fruit early in summer, before most other berries, providing a critical food source for birds just as they are raising their young. Timing matters as much as abundance.',
    attractsWildlife: ['Birds'],
    appearsAtHealth: 25,
  },
  {
    id: 'elderberry',
    name: 'Elderberry',
    emoji: '🍇',
    zoneId: 'forest',
    biome: 'The Forest',
    role: 'Shrub layer',
    fact: 'Elderberry grows fast, fruits prolifically, and provides habitat for insects in its hollow stems. It is a generous plant — it gives before the slower trees are ready.',
    attractsWildlife: ['Songbirds'],
    appearsAtHealth: 32,
  },
  {
    id: 'comfrey',
    name: 'Comfrey',
    emoji: '🌿',
    zoneId: 'forest',
    biome: 'The Forest',
    role: 'Nutrient accumulator',
    fact: 'Comfrey sends roots three metres deep to pull up minerals that shallow-rooted plants cannot reach. When its leaves fall and decompose, those minerals become available to everything else. It is a living elevator for fertility.',
    attractsWildlife: [],
    appearsAtHealth: 40,
  },
  {
    id: 'clover_plant',
    name: 'White Clover',
    emoji: '🍀',
    zoneId: 'forest',
    biome: 'The Forest',
    role: 'Ground cover',
    fact: 'Clover fixes nitrogen and feeds pollinators at ground level, creating fertility in the spaces between trees. It was once deliberately seeded into lawns — then the lawn-care industry convinced people it was a weed.',
    attractsWildlife: ['Bees', 'Pollinators'],
    appearsAtHealth: 48,
  },
  {
    id: 'wild_strawberry',
    name: 'Wild Strawberry',
    emoji: '🍓',
    zoneId: 'forest',
    biome: 'The Forest',
    role: 'Ground cover',
    fact: 'Wild strawberries carpet the forest floor, stabilizing soil and feeding birds throughout summer. The fruits are small but intensely flavoured — tasted once, they rearrange your understanding of strawberries.',
    attractsWildlife: ['Birds', 'Pollinators'],
    appearsAtHealth: 55,
  },
  {
    id: 'oyster_mushroom',
    name: 'Oyster Mushroom Log',
    emoji: '🍄',
    zoneId: 'forest',
    biome: 'The Forest',
    role: 'Fungal decomposer',
    fact: 'Oyster mushrooms decompose lignin — one of the hardest biological materials to break down. They are among the few organisms that can. A log inoculated with oyster mushroom mycelium is on its way back to being soil.',
    attractsWildlife: [],
    appearsAtHealth: 62,
  },

  // ── WETLAND ───────────────────────────────────────────────────────────────
  {
    id: 'cattail',
    name: 'Cattail',
    emoji: '🌾',
    zoneId: 'wetland',
    biome: 'The Wetland',
    role: 'Water filter',
    fact: 'Cattails absorb excess nutrients and pollutants from water through their roots, acting as a natural filtration system. They are also shelter, food, and nesting material for dozens of wetland species.',
    attractsWildlife: ['Ducks', 'Insects'],
    appearsAtHealth: 5,
  },
  {
    id: 'sedge',
    name: 'Sedge',
    emoji: '🌿',
    zoneId: 'wetland',
    biome: 'The Wetland',
    role: 'Bank stabiliser',
    fact: 'Sedges — "sedges have edges," as botanists say — stabilise stream banks with dense root mats. They are the first line of defence against erosion and the first welcome mat for frogs.',
    attractsWildlife: ['Frogs'],
    appearsAtHealth: 18,
  },
  {
    id: 'rush',
    name: 'Rush',
    emoji: '🌱',
    zoneId: 'wetland',
    biome: 'The Wetland',
    role: 'Wetland habitat',
    fact: 'Rushes create the dense, partially submerged habitat that dragonfly nymphs need to climb toward their final metamorphosis. Without rushes, dragonflies cannot complete their lives.',
    attractsWildlife: ['Dragonflies'],
    appearsAtHealth: 30,
  },
  {
    id: 'willow',
    name: 'Willow',
    emoji: '🌿',
    zoneId: 'wetland',
    biome: 'The Wetland',
    role: 'Riparian tree',
    fact: 'Willows grow fast, root deep, and anchor stream banks against floods. Their roots also pump oxygen into waterlogged soil, creating habitat for specialized bacteria that clean the water further.',
    attractsWildlife: ['Beavers'],
    appearsAtHealth: 45,
  },
  {
    id: 'water_lily',
    name: 'Water Lily',
    emoji: '🌸',
    zoneId: 'wetland',
    biome: 'The Wetland',
    role: 'Aquatic habitat',
    fact: 'Water lily pads provide resting platforms for frogs, shade that cools water for fish, and shelter for invertebrates below. Their roots stabilise the bottom sediments and provide oxygen underground.',
    attractsWildlife: ['Frogs', 'Dragonflies'],
    appearsAtHealth: 58,
  },

  // ── COASTAL DUNES ─────────────────────────────────────────────────────────
  {
    id: 'beach_grass',
    name: 'Beach Grass',
    emoji: '🌾',
    zoneId: 'dune',
    biome: 'The Coastal Dunes',
    role: 'Sand stabiliser',
    fact: 'Beach grass traps blowing sand and actually builds the dune higher year by year. It thrives under the stress of being buried — each new layer of sand triggers it to grow taller. Adversity is its nutrient.',
    attractsWildlife: [],
    appearsAtHealth: 5,
  },
  {
    id: 'sea_rocket',
    name: 'Sea Rocket',
    emoji: '🌿',
    zoneId: 'dune',
    biome: 'The Coastal Dunes',
    role: 'Pioneer coastal plant',
    fact: 'Sea rocket colonises bare sand at the top of the beach, one of the most hostile plant habitats on Earth. It tolerates salt, wind, drought, and occasional flooding. Everything that comes after it owes it a debt.',
    attractsWildlife: ['Coastal Pollinators'],
    appearsAtHealth: 18,
  },
  {
    id: 'dune_lupine',
    name: 'Dune Lupine',
    emoji: '🟣',
    zoneId: 'dune',
    biome: 'The Coastal Dunes',
    role: 'Nitrogen fixer',
    fact: 'Dune lupine fixes nitrogen in one of the poorest soils on the planet, creating fertility from air and sunlight. Its purple flowers signal that the dune is becoming something more than sand.',
    attractsWildlife: ['Butterflies'],
    appearsAtHealth: 32,
  },
  {
    id: 'beach_strawberry',
    name: 'Beach Strawberry',
    emoji: '🍓',
    zoneId: 'dune',
    biome: 'The Coastal Dunes',
    role: 'Ground cover',
    fact: 'Beach strawberry spreads via runners across the dune, knitting the surface together while feeding birds and pollinators. It is small, low, and resilient — exactly what the dune needs near the tideline.',
    attractsWildlife: ['Birds'],
    appearsAtHealth: 48,
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

  // ── CLOVER (meadow) ───────────────────────────────────────────────────────
  {
    id: 'clover_1',
    zoneId: 'meadow',
    guideName: 'Clover',
    guideEmoji: '🐝',
    noteNumber: 1,
    noteTitle: 'On Timing',
    text: 'A meadow is not a place. It is a schedule. Early bloomers, mid-season flowers, late asters — every week of the year, something different is needed. Miss a month and you lose a species. Fill every month and you keep them all.',
    appearsAtHealth: 8,
  },
  {
    id: 'clover_2',
    zoneId: 'meadow',
    guideName: 'Clover',
    guideEmoji: '🐝',
    noteNumber: 2,
    noteTitle: 'On Small Things',
    text: 'Every time a bee visits a flower, it is casting a vote for the world it needs. Billions of such votes, every summer, for millions of years. And then one generation of people forgot to plant the flowers. We can plant them again.',
    appearsAtHealth: 40,
  },
  {
    id: 'clover_3',
    zoneId: 'meadow',
    guideName: 'Clover',
    guideEmoji: '🐝',
    noteNumber: 3,
    noteTitle: 'On Sound',
    text: 'The meadow I remember had so many bees, you could hear it before you could see it. That sound — that low, warm buzzing hum — is what a healthy summer feels like. I think we are getting close again.',
    appearsAtHealth: 75,
  },

  // ── ROWAN (forest) ────────────────────────────────────────────────────────
  {
    id: 'rowan_1',
    zoneId: 'forest',
    guideName: 'Rowan',
    guideEmoji: '🦊',
    noteNumber: 1,
    noteTitle: 'On Secrets',
    text: 'The forest keeps secrets in roots. Everything above ground is just the announcement. The real conversation is underground — in the fungi, in the root networks, in the chemical signals trees send to each other when they are stressed. We know perhaps 10% of it.',
    appearsAtHealth: 8,
  },
  {
    id: 'rowan_2',
    zoneId: 'forest',
    guideName: 'Rowan',
    guideEmoji: '🦊',
    noteNumber: 2,
    noteTitle: 'On Being Wrong',
    text: 'I was wrong about the fungi earlier. Or mostly wrong. The principle was correct — trees do share resources — but the mechanism is more complicated than I suggested. This is usually how learning goes. The exciting part first, the nuance later.',
    appearsAtHealth: 42,
  },
  {
    id: 'rowan_3',
    zoneId: 'forest',
    guideName: 'Rowan',
    guideEmoji: '🦊',
    noteNumber: 3,
    noteTitle: 'On Conversation',
    text: 'A forest is not a collection of trees. It is a conversation that started before we arrived and will continue after we leave. We are not restoring a forest. We are creating the conditions for a very old conversation to resume.',
    appearsAtHealth: 78,
  },

  // ── RIPPLE (wetland) ──────────────────────────────────────────────────────
  {
    id: 'ripple_1',
    zoneId: 'wetland',
    guideName: 'Ripple',
    guideEmoji: '🦦',
    noteNumber: 1,
    noteTitle: 'On Memory',
    text: 'Water remembers everywhere it\'s been. It carries a history of every landscape it has moved through. This wetland\'s water has been glacier, cloud, rain, river. It knows how to be still. We just need to give it space.',
    appearsAtHealth: 8,
  },
  {
    id: 'ripple_2',
    zoneId: 'wetland',
    guideName: 'Ripple',
    guideEmoji: '🦦',
    noteNumber: 2,
    noteTitle: 'On Grief and Return',
    text: 'There is a kind of grief in watching a wetland go silent. I know the sound it is supposed to make. The frogs, the ducks, the reeds in the wind. When it goes quiet, you feel the absence like a missing word. There is a different kind of feeling when it begins to come back.',
    appearsAtHealth: 45,
  },
  {
    id: 'ripple_3',
    zoneId: 'wetland',
    guideName: 'Ripple',
    guideEmoji: '🦦',
    noteNumber: 3,
    noteTitle: 'On Time',
    text: 'The otter was here before me. It will be here long after. My job is not to restore the wetland — it is to stop doing things that prevented it from restoring itself. Most of the time, nature knows exactly what to do. It just needs us to get out of the way.',
    appearsAtHealth: 80,
  },

  // ── SABLE (dune) ──────────────────────────────────────────────────────────
  {
    id: 'sable_1',
    zoneId: 'dune',
    guideName: 'Sable',
    guideEmoji: '🐦',
    noteNumber: 1,
    noteTitle: 'On Wind',
    text: 'The wind is not the enemy. The dune simply needs to be strong enough to accept it. A healthy dune bends and gives under the wind, and stays. A damaged dune fights the wind, and loses.',
    appearsAtHealth: 8,
  },
  {
    id: 'sable_2',
    zoneId: 'dune',
    guideName: 'Sable',
    guideEmoji: '🐦',
    noteNumber: 2,
    noteTitle: 'On What Was Here',
    text: 'I have watched this coast for a long time. I remember when the plovers nested here in hundreds. A few careful fences, a few quiet seasons, a few generations of marram grass — and they came back. Not all of them. But enough.',
    appearsAtHealth: 45,
  },
  {
    id: 'sable_3',
    zoneId: 'dune',
    guideName: 'Sable',
    guideEmoji: '🐦',
    noteNumber: 3,
    noteTitle: 'On Soft Strength',
    text: 'Soft systems can be strong systems. The dune proves this in every storm. Concrete walls crack under wave pressure. A dune absorbs the blow, shifts slightly, and reforms. Rigidity breaks. Flexibility endures.',
    appearsAtHealth: 80,
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
