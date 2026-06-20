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

  // ── 2. MEADOW ─────────────────────────────────────────────────────────────
  {
    id: 'meadow',
    name: 'The Meadow of Forgotten Wings',
    guide: {
      name: 'Clover',
      emoji: '🐝',
      greeting:
        'There were so many species here — hundreds! Each one needs different flowers at different times of year. We have a lot of work to do. I am very excited about this.',
    },
    emoji: '🌸',
    tagline: 'Once filled with wings and colour, now silent',
    description:
      'A meadow where the hum of bees and flutter of butterflies has faded. Invasive plants crowd out the native wildflowers that kept pollinators fed and flying.',
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
    wildlife: [
      {
        id: 'mason_bee',
        name: 'Mason Bee',
        emoji: '🐝',
        role: 'Early pollinator',
        fact: 'Mason bees are excellent pollinators and very rarely sting. They\'re here because there are now flowers worth visiting.',
        appearsAtHealth: 10,
      },
      {
        id: 'bumblebee',
        name: 'Bumblebee',
        emoji: '🐝',
        role: 'Cold-weather pollinator',
        fact: 'Bumblebees can fly in colder temperatures than honeybees. They buzz-pollinate — vibrating flowers to release pollen that no other bee can reach.',
        appearsAtHealth: 25,
      },
      {
        id: 'hoverfly',
        name: 'Hoverfly',
        emoji: '🪰',
        role: 'Pollinator',
        fact: 'Many hoverflies mimic bees for protection — striped but harmless. They are among the most important pollinators in meadows.',
        appearsAtHealth: 40,
      },
      {
        id: 'painted_lady',
        name: 'Painted Lady Butterfly',
        emoji: '🦋',
        role: 'Pollinator',
        fact: 'Painted Ladies are champions of migration—traveling thousands of miles on delicate wings. Their presence signals a meadow in full bloom.',
        appearsAtHealth: 60,
      },
      {
        id: 'hummingbird',
        name: 'Rufous Hummingbird',
        emoji: '🐦',
        role: 'Long-distance pollinator',
        fact: 'The rufous hummingbird migrates thousands of miles despite being barely 8cm long. A meadow worth visiting from that far away is a meadow worth celebrating.',
        appearsAtHealth: 80,
      },
      {
        id: 'tree_swallow',
        name: 'Tree Swallow',
        emoji: '🐦',
        role: 'Aerial insect hunter',
        fact: 'Tree swallows consume hundreds of insects daily. Their aerobatics above the meadow are a sign that the insect population has truly recovered.',
        appearsAtHealth: 92,
      },
    ],
    fairies: [
      {
        id: 'bee_fairy',
        name: 'Bee Fairy',
        personality: 'Busy, energetic',
        wisdom: 'Many small visits become a harvest.',
        appearsAtHealth: 15,
      },
      {
        id: 'butterfly_fairy',
        name: 'Butterfly Fairy',
        personality: 'Dreamy, artistic',
        wisdom: 'Change often begins hidden.',
        appearsAtHealth: 50,
      },
      {
        id: 'stone_fairy',
        name: 'Stone Fairy',
        personality: 'Quiet, thoughtful',
        wisdom: 'Stillness is a kind of work.',
        appearsAtHealth: 85,
      },
    ],
  },

  // ── 3. FOREST ─────────────────────────────────────────────────────────────
  {
    id: 'forest',
    name: 'The Forest That Feeds Itself',
    guide: {
      name: 'Rowan',
      emoji: '🦊',
      greeting:
        "I have several theories about what happened to this forest. They can't all be right. The most interesting one involves fungi — though I may have gotten a detail slightly wrong.",
    },
    emoji: '🌲',
    tagline: 'A hillside stripped bare, where topsoil washes away',
    description:
      "A cleared hillside where soil runs off with every rain. Something essential is missing — not just the trees, but the entire living community they were part of.",
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
    wildlife: [
      {
        id: 'chipmunk',
        name: 'Chipmunk',
        emoji: '🐿️',
        role: 'Seed disperser',
        fact: 'Chipmunks cache thousands of seeds and forget many of them — inadvertently planting the next generation of trees.',
        appearsAtHealth: 12,
      },
      {
        id: 'woodpecker',
        name: 'Woodpecker',
        emoji: '🐦',
        role: 'Insect controller',
        fact: 'Woodpecker holes later become nesting sites for owls, ducks, and small mammals. One woodpecker creates homes for dozens of future residents.',
        appearsAtHealth: 28,
      },
      {
        id: 'salamander',
        name: 'Salamander',
        emoji: '🦎',
        role: 'Forest health indicator',
        fact: 'Salamanders require moist, cool forest floors to survive. Their presence means the canopy is closing and the soil is holding moisture.',
        appearsAtHealth: 48,
      },
      {
        id: 'great_horned_owl',
        name: 'Great Horned Owl',
        emoji: '🦉',
        role: 'Apex predator',
        fact: 'Owls can rotate their heads 270°. They miss almost nothing. A hunting owl means the forest has enough prey, which means the forest has enough of everything.',
        appearsAtHealth: 70,
      },
      {
        id: 'deer',
        name: 'Black-Tailed Deer',
        emoji: '🦌',
        role: 'Herbivore',
        fact: 'Deer browse selectively, opening gaps in vegetation that let light reach the forest floor. They are editors as much as grazers.',
        appearsAtHealth: 80,
      },
      {
        id: 'fox_kits',
        name: 'Fox Kits',
        emoji: '🦊',
        role: 'Symbol of maturity',
        fact: 'Fox kits tumbling outside a den are one of the most joyful signs of an ecosystem that has grown up. They need large territories with diverse prey.',
        appearsAtHealth: 92,
      },
    ],
    fairies: [
      {
        id: 'mushroom_fairy',
        name: 'Mushroom Fairy',
        personality: 'Mysterious',
        wisdom: 'The strongest connections are often invisible.',
        appearsAtHealth: 18,
      },
      {
        id: 'forest_fairy',
        name: 'Forest Fairy',
        personality: 'Patient',
        wisdom: 'No tree grows alone.',
        appearsAtHealth: 52,
      },
      {
        id: 'frog_lantern_fairy',
        name: 'Frog Lantern Fairy',
        personality: 'Warm, gentle',
        wisdom: 'Memories are gardens too.',
        appearsAtHealth: 88,
      },
    ],
  },

  // ── 4. WETLAND ────────────────────────────────────────────────────────────
  {
    id: 'wetland',
    name: 'The Wetland That Remembers',
    guide: {
      name: 'Ripple',
      emoji: '🦦',
      greeting:
        "Water remembers everywhere it's been. This wetland remembers what it was. We just need to help it find its way back.",
    },
    emoji: '🦆',
    tagline: 'Choked with sediment, longing to breathe again',
    description:
      "A wetland slowly filling with silt, where water barely moves. The reeds are struggling and the creatures that called this place home have moved on — for now.",
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
    wildlife: [
      {
        id: 'pacific_tree_frog',
        name: 'Pacific Tree Frog',
        emoji: '🐸',
        role: 'Indicator species',
        fact: 'Frogs absorb water through their skin — they feel everything the wetland feels. Their return is the water announcing that it is clean again.',
        appearsAtHealth: 10,
      },
      {
        id: 'dragonfly',
        name: 'Dragonfly',
        emoji: '🟢',
        role: 'Aerial predator',
        fact: 'Dragonflies spend most of their lives as aquatic nymphs. An adult dragonfly hovering above the water began its life in the sediment below.',
        appearsAtHealth: 20,
      },
      {
        id: 'mallard_duck',
        name: 'Mallard Duck',
        emoji: '🦆',
        role: 'Seed disperser',
        fact: 'Mallards carry seeds in their gut and disperse them across wetlands as they feed and travel. They are living seed libraries.',
        appearsAtHealth: 38,
      },
      {
        id: 'great_blue_heron',
        name: 'Great Blue Heron',
        emoji: '🦢',
        role: 'Apex wader',
        fact: 'The great blue heron can stand motionless for an hour waiting for a single fish. Its patience is a form of intelligence the wetland rewards.',
        appearsAtHealth: 58,
      },
      {
        id: 'beaver',
        name: 'Beaver',
        emoji: '🦫',
        role: 'Ecosystem engineer',
        fact: 'Beavers create wetland habitat for hundreds of species. A single beaver family can transform a degraded stream into a thriving wetland complex.',
        appearsAtHealth: 78,
      },
      {
        id: 'river_otter',
        name: 'River Otter',
        emoji: '🦦',
        role: 'Wetland ambassador',
        fact: 'River otters are playful, social, and unmistakably joyful. Their return to a restored wetland feels exactly like what it is: a celebration.',
        appearsAtHealth: 92,
      },
    ],
    fairies: [
      {
        id: 'rain_fairy_wetland',
        name: 'Rain Fairy',
        personality: 'Playful, curious',
        wisdom: 'The land does not drink faster because it is thirsty.',
        appearsAtHealth: 15,
      },
      {
        id: 'moon_pond_fairy',
        name: 'Moon Pond Fairy',
        personality: 'Dreamlike',
        wisdom: 'The moon visits every pond differently.',
        appearsAtHealth: 50,
      },
      {
        id: 'stream_fairy_wetland',
        name: 'Stream Fairy',
        personality: 'Wise, ancient',
        wisdom: 'Water remembers every kindness.',
        appearsAtHealth: 88,
      },
    ],
  },

  // ── 5. COASTAL DUNE ───────────────────────────────────────────────────────
  {
    id: 'dune',
    name: 'The Coastal Dunes',
    guide: {
      name: 'Sable',
      emoji: '🐦',
      greeting:
        'The dune is a border between sea and land. Everything behind us depends on what we protect here. I take this seriously.',
    },
    emoji: '🏖️',
    tagline: 'Sand dunes drifting, losing their ancient hold',
    description:
      'A coastal dune system destabilised by trampling and development. Without its grasses, the dune has no anchor — it drifts grain by grain toward the sea.',
    gradientFrom: '#8A8060',
    gradientTo: '#C8B880',
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
    wildlife: [
      {
        id: 'sand_crab',
        name: 'Sand Crab',
        emoji: '🦀',
        role: 'Nutrient recycler',
        fact: 'Sand crabs filter-feed in the swash zone, recycling organic matter back into the beach system. They are the base of the coastal food web.',
        appearsAtHealth: 10,
      },
      {
        id: 'sandpiper',
        name: 'Sandpiper',
        emoji: '🐦',
        role: 'Shorebird',
        fact: 'Sandpipers probe the wet sand with sensitive bills, detecting invertebrates by touch and pressure. They read the beach like a map.',
        appearsAtHealth: 25,
      },
      {
        id: 'snowy_plover',
        name: 'Snowy Plover',
        emoji: '🐦',
        role: 'Protected nesting species',
        fact: 'Snowy plovers nest in small scrapes on open sand. They are among the most vulnerable shorebirds — their nests are invisible, and they need humans to simply not walk where they live.',
        appearsAtHealth: 45,
      },
      {
        id: 'western_gull',
        name: 'Western Gull',
        emoji: '🦅',
        role: 'Coastal scavenger',
        fact: 'Gulls are ecosystem cleaners. They remove what the ocean leaves behind, recycling nutrients back into the coastal system.',
        appearsAtHealth: 65,
      },
      {
        id: 'harbor_seal',
        name: 'Harbor Seal',
        emoji: '🦭',
        role: 'Coastal predator',
        fact: 'Harbor seals haul out on stable, undisturbed beaches to rest and raise their pups. A seal on a restored dune is the coast declaring itself safe again.',
        appearsAtHealth: 88,
      },
    ],
    fairies: [
      {
        id: 'wind_fairy',
        name: 'Wind Fairy',
        personality: 'Adventurous',
        wisdom: 'Movement and stability belong together.',
        appearsAtHealth: 15,
      },
      {
        id: 'stone_fairy_coast',
        name: 'Stone Fairy',
        personality: 'Quiet, thoughtful',
        wisdom: 'Stillness is a kind of work.',
        appearsAtHealth: 52,
      },
      {
        id: 'watershed_fairy',
        name: 'Watershed Fairy',
        personality: 'Ancient, serene',
        wisdom: 'Nothing thrives alone.',
        appearsAtHealth: 90,
      },
    ],
  },
];
