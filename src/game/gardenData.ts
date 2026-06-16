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
    name: 'The Dusty Dryland',
    guide: {
      name: 'Sage',
      emoji: '🌾',
      greeting:
        'Water is sacred here. Every drop that stays in the earth is a gift to life.',
    },
    emoji: '🌵',
    tagline: 'Parched earth, waiting for rain to stay',
    description:
      'A dry, cracked landscape where rainwater runs off before it can sink in. Soil crusts hard in the sun, and only the toughest plants cling on.',
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
  },

  // ── 2. MEADOW ─────────────────────────────────────────────────────────────
  {
    id: 'meadow',
    name: 'The Lost Meadow',
    guide: {
      name: 'Meadow',
      emoji: '🧚',
      greeting:
        'Pollinators need corridors — unbroken paths of flowers they can follow across the land.',
    },
    emoji: '🌸',
    tagline: 'Once alive with wings and colour, now silent',
    description:
      'A meadow overgrown with invasive plants, where the hum of pollinators has faded. The native wildflowers that fed them are gone.',
    gradientFrom: '#7B5C8A',
    gradientTo: '#C4A8C3',
    headerTextColor: '#FFF8FF',
    unlockAfterZoneId: 'dryland',
    unlockAtZoneHealth: 30,
    actions: [
      {
        id: 'remove_invasives',
        label: 'Remove Invasive Plants',
        emoji: '🌿',
        technique: 'Targeted invasive clearance',
        healthGain: 10,
        unlockAtHealth: 0,
        wisdom:
          'Invasive species crowd out the native plants that local pollinators evolved with over thousands of years. Removing them doesn\'t destroy — it makes room for what belongs. The land remembers.',
      },
      {
        id: 'wildflower_patches',
        label: 'Sow Wildflower Patches',
        emoji: '🌼',
        technique: 'Native wildflower seeding',
        healthGain: 12,
        unlockAtHealth: 0,
        wisdom:
          'A patch of native wildflowers can support 30 different bee species. Variety is everything — bees, butterflies, and hoverflies all need different flower shapes and different bloom times across the season.',
      },
      {
        id: 'bee_hotels',
        label: 'Build Bee Hotels',
        emoji: '🐝',
        technique: 'Solitary bee nesting habitat',
        healthGain: 8,
        unlockAtHealth: 0,
        wisdom:
          'Most bees are solitary — no hive, no queen, just one small bee raising her young alone. She nests in hollow stems and small holes. A bee hotel with the right materials can house dozens of species in a very small space.',
      },
      {
        id: 'butterfly_host',
        label: 'Plant Butterfly Host Plants',
        emoji: '🦋',
        technique: 'Larval host planting',
        healthGain: 12,
        unlockAtHealth: 25,
        wisdom:
          'Caterpillars are picky eaters. Each species needs a specific host plant — milkweed for monarchs, nettles for tortoiseshells. Without these plants, the adult butterflies have nowhere to lay eggs.',
      },
      {
        id: 'long_grass',
        label: 'Leave Long Grass Areas',
        emoji: '🌾',
        technique: 'Reduced mowing regime',
        healthGain: 8,
        unlockAtHealth: 25,
        wisdom:
          'What looks untidy is home. Long grass shelters hibernating insects, ground-nesting bees, and small mammals. Sometimes the most powerful restoration technique is simply to put down the mower.',
      },
      {
        id: 'pollinator_corridor',
        label: 'Create Pollinator Corridor',
        emoji: '🌺',
        technique: 'Habitat connectivity planting',
        healthGain: 20,
        unlockAtHealth: 50,
        wisdom:
          'A pollinator corridor is a ribbon of flowers connecting wild spaces. Bees can\'t cross large open areas — they need stepping stones of bloom every few hundred metres. One corridor can link an entire landscape.',
      },
      {
        id: 'meadow_pond',
        label: 'Add a Meadow Pond',
        emoji: '🐸',
        technique: 'Wetland creation',
        healthGain: 15,
        unlockAtHealth: 60,
        wisdom:
          'Even a small pond transforms a meadow. Dragonflies hunt, frogs lay eggs, birds drink at the edge, and the meadow organises itself around the water. A pond is a magnet for life.',
      },
      {
        id: 'meadow_celebration',
        label: 'Witness the First Bats',
        emoji: '🦇',
        technique: 'Ecological milestone',
        healthGain: 15,
        unlockAtHealth: 75,
        wisdom:
          'Bats are a sign of a healthy insect population — and a healthy insect population means a healthy meadow. One pipistrelle bat eats 3,000 insects a night. When they return, the food web is working again.',
      },
    ],
  },

  // ── 3. FOREST ─────────────────────────────────────────────────────────────
  {
    id: 'forest',
    name: 'The Forgotten Forest',
    guide: {
      name: 'Fern',
      emoji: '🌿',
      greeting:
        'Trees talk to each other through the wood wide web — a network of fungi connecting their roots underground.',
    },
    emoji: '🌲',
    tagline: 'Bare hillsides where trees once stood',
    description:
      'A cleared hillside where topsoil washes away with every rain. The soil is compacted, the streams run brown, and something is missing.',
    gradientFrom: '#2E5E2E',
    gradientTo: '#5C8C4A',
    headerTextColor: '#F0FFF0',
    unlockAfterZoneId: 'meadow',
    unlockAtZoneHealth: 30,
    actions: [
      {
        id: 'pioneer_species',
        label: 'Plant Pioneer Species',
        emoji: '🌱',
        technique: 'Successional planting',
        healthGain: 10,
        unlockAtHealth: 0,
        wisdom:
          'Pioneer species are nature\'s first responders. Nitrogen-fixing plants like alder and wattle rebuild the soil, creating conditions for the slower-growing, longer-lived species that will follow them.',
      },
      {
        id: 'contour_swales',
        label: 'Dig Contour Swales',
        emoji: '〰️',
        technique: 'Permaculture earthworks',
        healthGain: 12,
        unlockAtHealth: 0,
        wisdom:
          'A swale is a trench dug on contour — perfectly level — so it fills evenly with rain. Water spreads slowly across the hillside instead of rushing down it. The trees planted on the swale berm drink deeply all year.',
      },
      {
        id: 'nurse_logs',
        label: 'Place Nurse Logs',
        emoji: '🪵',
        technique: 'Coarse woody debris habitat',
        healthGain: 8,
        unlockAtHealth: 0,
        wisdom:
          'A fallen log is not dead — it\'s the beginning of decades of life. Nurse logs feed fungi, shelter salamanders, and provide the perfect nursery for ferns and young trees. Old forests are full of them.',
      },
      {
        id: 'understory_plants',
        label: 'Plant Understory Layer',
        emoji: '🍃',
        technique: 'Forest stratification',
        healthGain: 12,
        unlockAtHealth: 25,
        wisdom:
          'A forest has layers: canopy, understory, shrub, herb, ground cover, root zone, and vine. Each layer creates conditions for the others. Without the understory, the forest floor is too exposed and too quiet.',
      },
      {
        id: 'fungi_inoculation',
        label: 'Inoculate with Fungi',
        emoji: '🍄',
        technique: 'Mycorrhizal network establishment',
        healthGain: 10,
        unlockAtHealth: 25,
        wisdom:
          'Mycorrhizal fungi connect trees in a chemical internet, passing sugars, water, and warning signals about pests. A forest without its fungal network is a forest without its nervous system.',
      },
      {
        id: 'food_forest',
        label: 'Establish a Food Forest',
        emoji: '🍎',
        technique: 'Agroforestry / food forest design',
        healthGain: 20,
        unlockAtHealth: 50,
        wisdom:
          'A food forest mimics the structure of a natural forest while growing food for people. It asks little of the land and gives back year after year — no plowing, no bare soil, no chemicals needed.',
      },
      {
        id: 'wildlife_corridors',
        label: 'Open Wildlife Corridors',
        emoji: '🦌',
        technique: 'Habitat connectivity',
        healthGain: 15,
        unlockAtHealth: 60,
        wisdom:
          'Isolated forest patches are not enough. Animals need corridors — connected greenways between habitats. A hedgerow, a stream bank, even a garden fence planted with the right species becomes a corridor for life.',
      },
      {
        id: 'forest_celebration',
        label: 'Hear the First Cuckoo',
        emoji: '🐦',
        technique: 'Ecological milestone',
        healthGain: 15,
        unlockAtHealth: 75,
        wisdom:
          'The cuckoo is an indicator species — it arrives in spring to lay its eggs in the nests of caterpillar-eating birds. No cuckoo means no caterpillars. No caterpillars means the forest is not yet whole. But it\'s getting there.',
      },
    ],
  },

  // ── 4. WETLAND ────────────────────────────────────────────────────────────
  {
    id: 'wetland',
    name: 'The Silted Wetland',
    guide: {
      name: 'Mira',
      emoji: '💧',
      greeting:
        'Wetlands are the kidneys of the land. They filter, store, and breathe for everything downstream.',
    },
    emoji: '🦆',
    tagline: 'Choked with sediment, longing to breathe',
    description:
      'A wetland filling with silt, where the water barely moves. Reeds struggle to grow and the birds that once nested here are gone.',
    gradientFrom: '#1E6678',
    gradientTo: '#4A9EB0',
    headerTextColor: '#F0FBFF',
    unlockAfterZoneId: 'forest',
    unlockAtZoneHealth: 30,
    actions: [
      {
        id: 'clear_channels',
        label: 'Clear Water Channels',
        emoji: '🌊',
        technique: 'Hydrological restoration',
        healthGain: 12,
        unlockAtHealth: 0,
        wisdom:
          'Healthy wetlands breathe through their channels. When channels silt up, the whole system slows. Clearing them carefully — without disturbing the banks — lets life flow again.',
      },
      {
        id: 'plant_reeds',
        label: 'Plant Reed Beds',
        emoji: '🌾',
        technique: 'Phytoremediation planting',
        healthGain: 10,
        unlockAtHealth: 0,
        wisdom:
          'Reeds are extraordinary water cleaners. Their roots feed oxygen to bacteria that break down pollutants. A well-planted reed bed can purify water from an entire village — a living filter that costs almost nothing.',
      },
      {
        id: 'willow_edge',
        label: 'Plant Willows at Edge',
        emoji: '🍃',
        technique: 'Riparian planting',
        healthGain: 8,
        unlockAtHealth: 0,
        wisdom:
          'Willows anchor stream banks with their dense root systems. They shade the water — keeping it cool for fish — and their fallen leaves feed the invertebrates that everything else eats.',
      },
      {
        id: 'sedimentation_ponds',
        label: 'Create Sedimentation Ponds',
        emoji: '🪨',
        technique: 'Constructed wetlands',
        healthGain: 12,
        unlockAtHealth: 25,
        wisdom:
          'A sedimentation pond catches silt before it reaches the wetland. The trapped sediment becomes habitat itself, and the cleaned water flows on to do far less damage. Problems become solutions.',
      },
      {
        id: 'amphibian_habitat',
        label: 'Create Amphibian Habitat',
        emoji: '🐸',
        technique: 'Amphibian pond creation',
        healthGain: 10,
        unlockAtHealth: 25,
        wisdom:
          'Frogs and newts are indicators of wetland health. A wetland with breeding amphibians is a thriving system. They eat mosquitoes, feed herons, and tell us the water is clean enough for complex life.',
      },
      {
        id: 'nesting_islands',
        label: 'Build Nesting Islands',
        emoji: '🦢',
        technique: 'Habitat island construction',
        healthGain: 18,
        unlockAtHealth: 50,
        wisdom:
          'A floating or fixed island in open water gives nesting birds safety from ground predators. One nesting island can support dozens of pairs — coots, ducks, grebes — each season. Small shelter, large impact.',
      },
      {
        id: 'water_quality',
        label: 'Restore Water Quality',
        emoji: '💎',
        technique: 'Catchment-scale restoration',
        healthGain: 15,
        unlockAtHealth: 60,
        wisdom:
          'A restored wetland doesn\'t just support its own wildlife — it purifies water for everything downstream. It stores floodwater, recharges aquifers, and moderates the climate of the land around it. It is a gift to the whole watershed.',
      },
      {
        id: 'wetland_celebration',
        label: 'Watch the First Otter',
        emoji: '🦦',
        technique: 'Ecological milestone',
        healthGain: 15,
        unlockAtHealth: 75,
        wisdom:
          'Otters sit at the top of the freshwater food web. When they return, it means fish are plentiful, the water is clean, and the banks are undisturbed enough to raise young. An otter is the wetland declaring itself healed.',
      },
    ],
  },

  // ── 5. COASTAL DUNE ───────────────────────────────────────────────────────
  {
    id: 'dune',
    name: 'The Drifting Dune',
    guide: {
      name: 'Sandy',
      emoji: '🌊',
      greeting:
        'Dunes are not just sand — they are living systems built over centuries by grasses, birds, and the patient wind.',
    },
    emoji: '🏖️',
    tagline: 'Sand dunes shifting, losing their ancient shape',
    description:
      'A coastal dune destabilised by trampling and development, slowly drifting. Without its grasses, it has nothing to hold itself together.',
    gradientFrom: '#9A7A50',
    gradientTo: '#D4B47A',
    headerTextColor: '#FFF8EE',
    unlockAfterZoneId: 'wetland',
    unlockAtZoneHealth: 30,
    actions: [
      {
        id: 'marram_grass',
        label: 'Plant Marram Grass',
        emoji: '🌾',
        technique: 'Dune stabilisation planting',
        healthGain: 15,
        unlockAtHealth: 0,
        wisdom:
          'Marram grass is the architect of sand dunes. Its roots hold shifting sand in place; its stems catch blowing grains and build the dune higher year by year. Without it, dunes simply drift to the sea.',
      },
      {
        id: 'sand_fences',
        label: 'Build Sand Fences',
        emoji: '🪵',
        technique: 'Brushwood stabilisation',
        healthGain: 10,
        unlockAtHealth: 0,
        wisdom:
          'Low brushwood fences across the dune slow the wind, trap blown sand, and give marram grass time to establish. They mimic what dense vegetation does naturally — a gentle, temporary scaffold for the dune to grow against.',
      },
      {
        id: 'boardwalks',
        label: 'Install Boardwalks',
        emoji: '🚶',
        technique: 'Visitor management',
        healthGain: 8,
        unlockAtHealth: 0,
        wisdom:
          'Most dune damage comes from footfall. A boardwalk channels people to marked paths so vegetation on either side can recover. The most important thing we can do is sometimes simply move our feet elsewhere.',
      },
      {
        id: 'native_scrub',
        label: 'Establish Native Scrub',
        emoji: '🌿',
        technique: 'Dune scrub restoration',
        healthGain: 12,
        unlockAtHealth: 25,
        wisdom:
          'Sea buckthorn, elder, and dog rose create the dune scrub zone — a shelter belt behind the open face. This zone slows the wind before it reaches the beach and creates rich habitat for nesting birds and hibernating insects.',
      },
      {
        id: 'tern_habitat',
        label: 'Create Tern Nesting Areas',
        emoji: '🐦',
        technique: 'Rare species protection',
        healthGain: 10,
        unlockAtHealth: 25,
        wisdom:
          'Little terns are among the most threatened coastal birds. They nest on open shingle near water, returning to the same site each year. A few carefully protected areas, and they will come. They have been waiting.',
      },
      {
        id: 'slack_restoration',
        label: 'Restore Dune Slacks',
        emoji: '💦',
        technique: 'Dune slack hydrology',
        healthGain: 18,
        unlockAtHealth: 50,
        wisdom:
          'Dune slacks are the wet hollows between dune ridges — one of the rarest habitats in the world. They fill with fresh water in winter, dry in summer, and host extraordinary plants found almost nowhere else on Earth.',
      },
      {
        id: 'coastal_resilience',
        label: 'Build Coastal Resilience',
        emoji: '🌊',
        technique: 'Nature-based coastal defence',
        healthGain: 15,
        unlockAtHealth: 60,
        wisdom:
          'A healthy dune system is a coastal defence. It absorbs storm energy, protects farmland and settlements behind it, and does it without concrete. A living seawall, grown by the land itself over centuries.',
      },
      {
        id: 'dune_celebration',
        label: 'Find the First Orchid',
        emoji: '🌸',
        technique: 'Ecological milestone',
        healthGain: 15,
        unlockAtHealth: 75,
        wisdom:
          'Dune orchids are indicators of the rarest, most undisturbed dune habitats. They take years to appear — first as a single leaf, then a rosette, finally a flower spike. An orchid on a dune is decades of patience made visible.',
      },
    ],
  },
];
