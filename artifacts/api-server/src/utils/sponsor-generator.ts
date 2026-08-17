export type SponsorTier = "Local" | "Regional" | "Continental" | "International" | "Global";
export type SponsorSlot = "primary" | "kit" | "supporting";
export type SponsorCategory =
  | "sportswear" | "health_fitness" | "food_beverages" | "travel"
  | "technology" | "finance" | "automotive" | "tourism"
  | "media" | "local_business" | "international";

export const CATEGORY_LABELS: Record<SponsorCategory, string> = {
  sportswear:     "Sportswear",
  health_fitness: "Health & Fitness",
  food_beverages: "Food & Beverages",
  travel:         "Travel & Accommodation",
  technology:     "Technology",
  finance:        "Finance",
  automotive:     "Automotive",
  tourism:        "Tourism",
  media:          "Media",
  local_business: "Local Business",
  international:  "International Brand",
};

const NAME_PARTS: Record<SponsorCategory, { first: string[]; second: string[] }> = {
  sportswear: {
    first:  ["Swift", "Apex", "Stride", "Bolt", "Rush", "Peak", "Prime", "Blaze", "Iron", "Surge", "Crest", "Viper", "Storm", "Pulse", "Force", "Terra", "Zeal", "Coda"],
    second: ["Pro", "Sport", "Athletics", "Wear", "Active", "Kit", "Gear", "Athletic", "Sports", "Motion", "Edge", "Flex"],
  },
  health_fitness: {
    first:  ["Vitale", "Core", "Flex", "Nourish", "Pulse", "Zenith", "Vivo", "Aura", "Forte", "Vita", "Lumina", "Nexura", "Everliv", "Renew", "Solace"],
    second: ["Health", "Wellness", "Nutrition", "Labs", "Fitness", "Life", "Plus", "Care", "Science", "Balance", "Formula", "Bio"],
  },
  food_beverages: {
    first:  ["Harvest", "Fusion", "Cresta", "Brio", "Solero", "Verde", "Natura", "Fresco", "Bravo", "Pronto", "Lively", "Zesty", "Aroma", "Vivace"],
    second: ["Foods", "Beverages", "Nutrition", "Market", "Kitchen", "Drinks", "Eats", "Café", "Naturals", "Fresh", "Provisions"],
  },
  travel: {
    first:  ["Voya", "Horizons", "Cirrus", "Tropic", "Atlas", "Venture", "Zephyr", "Aero", "Marina", "Summit", "Serenity", "Odyssey"],
    second: ["Travel", "Airways", "Hotels", "Resorts", "Escapes", "Journeys", "Vacations", "Retreats", "Voyages", "Express"],
  },
  technology: {
    first:  ["Nexus", "Pixel", "Aero", "Synth", "Logic", "Cipher", "Vertex", "Nano", "Quantum", "Nova", "Helix", "Vortex", "Axiom", "Lumen", "Prism"],
    second: ["Tech", "Digital", "Systems", "Solutions", "Labs", "Works", "Net", "Data", "Cloud", "Grid", "Soft", "Dynamics"],
  },
  finance: {
    first:  ["Crest", "Summit", "Harbor", "Meridian", "Capital", "Anchor", "Pinnacle", "Vantage", "Sterling", "Argent", "Beacon", "Accord"],
    second: ["Finance", "Capital", "Bank", "Invest", "Partners", "Group", "Trust", "Wealth", "Holdings", "Advisory", "Asset"],
  },
  automotive: {
    first:  ["Torque", "Velo", "Axle", "Ignite", "Rally", "Drive", "Turbo", "Piston", "Revv", "Apex", "Clutch", "Camo"],
    second: ["Motors", "Auto", "Drive", "Wheels", "Racing", "Automotive", "Cars", "Dynamics", "Performance", "Speed"],
  },
  tourism: {
    first:  ["Vista", "Soleil", "Palma", "Aria", "Brava", "Lido", "Breeze", "Sol", "Riviera", "Serene", "Bliss", "Tropico"],
    second: ["Tourism", "Resort", "Destinations", "Experience", "Holidays", "Leisure", "Escapes", "Retreats", "Collection"],
  },
  media: {
    first:  ["Wave", "Prism", "Echo", "Signal", "Beacon", "Catalyst", "Relay", "Vector", "Spectrum", "Vox", "Radiant", "Sonix"],
    second: ["Media", "Sports", "Broadcasting", "Network", "Channel", "Press", "Digital", "Live", "Studio", "Vision"],
  },
  local_business: {
    first:  ["City", "Metro", "Bay", "Central", "Crown", "Oak", "Maple", "River", "Harbor", "Valley", "Sunrise", "Shore", "Crest", "Glen"],
    second: ["Business", "Group", "Services", "Enterprise", "Solutions", "Trading", "Co", "Industries", "Ventures", "Works"],
  },
  international: {
    first:  ["Global", "World", "Inter", "Trans", "Universal", "Continental", "Omni", "Pan", "Axis", "Intl", "Macro", "Cosmo"],
    second: ["Group", "Corp", "International", "Worldwide", "Holdings", "Industries", "Partners", "Alliance", "Consortium"],
  },
};

const TIER_CATEGORIES: Record<SponsorTier, SponsorCategory[]> = {
  Local:         ["local_business", "food_beverages", "tourism"],
  Regional:      ["sportswear", "health_fitness", "food_beverages", "travel", "tourism", "local_business"],
  Continental:   ["sportswear", "health_fitness", "technology", "automotive", "media", "travel", "tourism"],
  International: ["technology", "finance", "automotive", "media", "international", "sportswear", "travel"],
  Global:        ["finance", "technology", "automotive", "international", "media"],
};

const TIER_MONTHLY: Record<SponsorTier, [number, number]> = {
  Local:         [300,    1_500],
  Regional:      [1_000,  4_000],
  Continental:   [3_500,  12_000],
  International: [10_000, 35_000],
  Global:        [30_000, 100_000],
};

const TIER_SIGNING_MULT: Record<SponsorTier, [number, number]> = {
  Local:         [0.5, 1.5],
  Regional:      [1,   3],
  Continental:   [2,   5],
  International: [3,   8],
  Global:        [5,   12],
};

const SLOT_MONTHLY_MULT: Record<SponsorSlot, number> = {
  primary:    2.2,
  kit:        1.5,
  supporting: 1.0,
};

const LENGTH_MONTHLY_MULT: Record<number, number> = {
  1: 1.15,
  2: 1.00,
  3: 0.87,
};

const WIN_REQUIREMENTS: Record<SponsorTier, [number, number]> = {
  Local:         [2,  8],
  Regional:      [5,  15],
  Continental:   [10, 25],
  International: [15, 40],
  Global:        [25, 60],
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function computeAppealScore(team: {
  reputation: number;
  wins: number;
  titlesWon: number;
  budget: string | number;
  boardConfidence: number;
  managerRepPoints: number;
  sponsorReputation: number;
}): number {
  const rep      = Math.min(100, team.reputation ?? 50);
  const wins     = Math.min(50, team.wins ?? 0) / 50 * 20;
  const titles   = Math.min(20, (team.titlesWon ?? 0) * 4);
  const budget   = Math.min(15, Number(team.budget ?? 0) / 500_000 * 15);
  const board    = (team.boardConfidence ?? 60) / 100 * 15;
  const mgrRep   = Math.min(10, (team.managerRepPoints ?? 0) / 1000 * 10);
  const sponsRep = (team.sponsorReputation ?? 50) / 100 * 20;

  const raw = rep * 0.25 + wins + titles + budget + board + mgrRep + sponsRep;
  return Math.round(Math.min(120, raw));
}

export function selectTier(appealScore: number): SponsorTier {
  const roll = Math.random();
  if (appealScore < 20) {
    return roll < 0.85 ? "Local" : "Regional";
  } else if (appealScore < 40) {
    return roll < 0.4 ? "Local" : roll < 0.9 ? "Regional" : "Continental";
  } else if (appealScore < 60) {
    return roll < 0.15 ? "Local" : roll < 0.5 ? "Regional" : roll < 0.85 ? "Continental" : "International";
  } else if (appealScore < 80) {
    return roll < 0.1 ? "Regional" : roll < 0.4 ? "Continental" : roll < 0.8 ? "International" : "Global";
  } else {
    return roll < 0.15 ? "Continental" : roll < 0.5 ? "International" : "Global";
  }
}

export function generateSponsorName(category: SponsorCategory, usedNames: Set<string>): string {
  const parts = NAME_PARTS[category];
  for (let attempt = 0; attempt < 200; attempt++) {
    const first  = pickRandom(parts.first);
    const second = pickRandom(parts.second);
    const name   = `${first} ${second}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // Ultimate fallback
  const name = `${pickRandom(parts.first)} ${pickRandom(parts.second)} ${rand(2, 99)}`;
  usedNames.add(name);
  return name;
}

function appealReason(tier: SponsorTier, appealScore: number): string {
  const reasons: Record<SponsorTier, string[]> = {
    Local: [
      "Local community presence",
      "New club building local ties",
      "Regional fan engagement",
    ],
    Regional: [
      "Growing club reputation attracting regional interest",
      "Consistent results drawing regional sponsors",
      "Strong local fanbase expanding regionally",
    ],
    Continental: [
      "Continental competition appearance boosting profile",
      "Solid performance securing continental sponsors",
      "Growing club profile across the continent",
    ],
    International: [
      "International recognition following strong results",
      "Trophy success attracting international brands",
      "High-profile competition appearances",
    ],
    Global: [
      "World-class reputation securing global partnership",
      "Elite club status attracting premium global brands",
      "Championship history opening global sponsorship doors",
    ],
  };
  const options = reasons[tier];
  return options[Math.floor(Math.random() * options.length)];
}

export interface GeneratedOffer {
  sponsor:              string;
  description:          string;
  amount:               number;
  requirementWins:      number;
  expiresAt:            string;
  isAccepted:           boolean;
  isGlobal:             boolean;
  tier:                 SponsorTier;
  slot:                 SponsorSlot;
  category:             SponsorCategory;
  signingBonus:         number;
  monthlyPayment:       number;
  contractLengthSeasons:number;
  contractStartDate:    null;
  contractEndDate:      null;
  appealReason:         string;
  status:               "available";
  lastPaymentDate:      null;
  signingBonusPaid:     boolean;
}

export function generateOffer(params: {
  tier: SponsorTier;
  slot: SponsorSlot;
  usedNames: Set<string>;
  gameDate: string;
  appealScore: number;
}): GeneratedOffer {
  const { tier, slot, usedNames, gameDate, appealScore } = params;
  const category = pickRandom(TIER_CATEGORIES[tier]);
  const sponsor  = generateSponsorName(category, usedNames);

  const [monthlyMin, monthlyMax] = TIER_MONTHLY[tier];
  const contractLength = pickRandom([1, 2, 3] as const);
  const slotMult   = SLOT_MONTHLY_MULT[slot];
  const lengthMult = LENGTH_MONTHLY_MULT[contractLength];

  const baseMonthly   = rand(monthlyMin, monthlyMax);
  const monthlyPayment = Math.round(baseMonthly * slotMult * lengthMult / 100) * 100;

  const [sigMultMin, sigMultMax] = TIER_SIGNING_MULT[tier];
  const signingMult  = sigMultMin + Math.random() * (sigMultMax - sigMultMin);
  const signingBonus = Math.round(monthlyPayment * signingMult / 100) * 100;

  const totalValue = signingBonus + monthlyPayment * contractLength * 3;

  const [winMin, winMax] = WIN_REQUIREMENTS[tier];
  const requirementWins  = rand(winMin, winMax);

  const expDate = new Date(gameDate);
  expDate.setDate(expDate.getDate() + rand(21, 45));
  const expiresAt = expDate.toISOString().split("T")[0];

  const slotLabel     = { primary: "Primary Sponsor", kit: "Kit Sponsor", supporting: "Supporting Sponsor" }[slot];
  const categoryLabel = CATEGORY_LABELS[category];

  return {
    sponsor,
    description:           `${slotLabel} — ${categoryLabel}. ${contractLength}-season contract.`,
    amount:                totalValue,
    requirementWins,
    expiresAt,
    isAccepted:            false,
    isGlobal:              false,
    tier,
    slot,
    category,
    signingBonus,
    monthlyPayment,
    contractLengthSeasons: contractLength,
    contractStartDate:     null,
    contractEndDate:       null,
    appealReason:          appealReason(tier, appealScore),
    status:                "available",
    lastPaymentDate:       null,
    signingBonusPaid:      false,
  };
}

export function generateOfferBatch(params: {
  team: Parameters<typeof computeAppealScore>[0];
  usedNames: Set<string>;
  gameDate: string;
  count: number;
}): GeneratedOffer[] {
  const { team, usedNames, gameDate, count } = params;
  const appealScore = computeAppealScore(team);

  const slotOrder: SponsorSlot[] = [
    "primary", "kit",
    "supporting", "supporting", "supporting", "supporting",
    "supporting", "supporting",
  ];
  const slotAssignments = slotOrder.slice(0, count);

  return slotAssignments.map(slot => {
    const tier = selectTier(appealScore);
    return generateOffer({ tier, slot, usedNames, gameDate, appealScore });
  });
}
