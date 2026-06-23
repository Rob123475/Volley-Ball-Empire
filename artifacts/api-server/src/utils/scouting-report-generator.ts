const CONTINENT_DESCRIPTORS: Record<string, string[]> = {
  europe:        ["technically disciplined", "tactically refined", "positionally excellent", "technically polished"],
  asia:          ["technically precise", "methodically sound", "disciplined", "consistent under pressure"],
  africa:        ["physically explosive", "naturally athletic", "raw but powerful", "physically imposing"],
  south_america: ["creatively gifted", "naturally fluid", "instinctively brilliant", "game-smart"],
  "south america": ["creatively gifted", "naturally fluid", "instinctively brilliant", "game-smart"],
  north_america: ["athletically versatile", "physically well-rounded", "high-energy", "competitive"],
  "north america": ["athletically versatile", "physically well-rounded", "high-energy", "competitive"],
  oceania:       ["beach-hardened", "resilient", "conditions-tested", "physically robust"],
};

const SPECIALITY_STRENGTH: Record<string, string> = {
  Power:         "attacking explosiveness and raw striking power",
  Defense:       "defensive instincts and court-reading ability",
  Serve:         "serve velocity and tactical placement",
  Speed:         "court coverage speed and sharp reaction time",
  Block:         "blocking technique and aerial timing",
  "All-Rounder": "consistent all-round contributions across phases",
};

const SPECIALITY_WEAKNESS: Record<string, string[]> = {
  Power:         ["defensive footwork", "serve receive positioning", "lateral court mobility"],
  Defense:       ["attacking power output", "offensive shot selection", "serve aggression"],
  Serve:         ["blocking consistency", "defensive lateral movement", "physical power"],
  Speed:         ["physical power output", "blocking height and timing", "raw attacking strength"],
  Block:         ["speed and lateral quickness", "back court defensive skill", "footwork patterns"],
  "All-Rounder": ["a defined elite skill area", "consistent peak performance", "specialist-level depth"],
};

const GROWTH_DESCRIPTORS: Record<string, string[]> = {
  "Very Low": [
    "Limited growth ceiling based on current physical and technical profile.",
    "Development trajectory suggests modest improvement over time.",
    "Physical indicators point to limited long-term upside.",
  ],
  Low: [
    "Some development expected with structured coaching, though ceiling appears moderate.",
    "Steady but unremarkable growth potential in standard training environments.",
    "With proper guidance, incremental improvement is realistic.",
  ],
  Moderate: [
    "Solid development trajectory with clear upside given the right coaching environment.",
    "Well-positioned for meaningful growth under experienced coaching staff.",
    "Moderate ceiling with a realistic path to senior-level competition.",
  ],
  High: [
    "Exceptional growth indicators — this player could develop into a genuine team asset.",
    "High ceiling suggests significant improvement potential with dedicated training.",
    "Development trajectory is encouraging; this player could become a standout.",
  ],
  Elite: [
    "Elite growth potential — rare physical and technical qualities seldom seen at this age.",
    "Outstanding development indicators. This player has genuine top-tier ceiling.",
    "Exceptional talent profile. With proper development, this player could compete at the highest level.",
  ],
};

const RISK_NOTES: Record<string, string[]> = {
  "Very Low": [
    "Low-risk signing with tempered expectations advised.",
    "Safe signing but limited reward potential.",
  ],
  Low: [
    "Modest risk profile; reasonable value at this price point.",
    "Low-to-medium risk with a predictable development curve.",
  ],
  Moderate: [
    "Medium-risk signing with solid potential upside.",
    "Calculated risk with reasonable reward probability.",
  ],
  High: [
    "High-reward profile — development must be properly managed.",
    "Signing carries elevated expectation; coaching quality is critical.",
  ],
  Elite: [
    "Premium signing. Prioritise this player for development resources.",
    "Elite prospect — the investment is high but the potential return is exceptional.",
  ],
};

const AGE_ADJECTIVES: Partial<Record<number, string>> = {
  14: "extraordinarily young",
  15: "highly promising",
  16: "promising",
  17: "developing",
  18: "mature for her age",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateScoutingReport(params: {
  name: string;
  age: number;
  nationality: string;
  speciality: string;
  region: string;
  scoutedPotential: string;
}): string {
  const { age, nationality, speciality, region, scoutedPotential } = params;

  const regionKey = region.toLowerCase();
  const descriptors = CONTINENT_DESCRIPTORS[regionKey] ?? CONTINENT_DESCRIPTORS["north_america"]!;
  const descriptor = pick(descriptors);
  const ageAdj = AGE_ADJECTIVES[age] ?? "young";

  const strength = SPECIALITY_STRENGTH[speciality] ?? "all-round contributions";
  const weaknessPool = SPECIALITY_WEAKNESS[speciality] ?? ["areas requiring development"];
  const weakness = pick(weaknessPool);

  const growthPool = GROWTH_DESCRIPTORS[scoutedPotential] ?? GROWTH_DESCRIPTORS["Moderate"]!;
  const growthNote = pick(growthPool);

  const riskPool = RISK_NOTES[scoutedPotential] ?? RISK_NOTES["Moderate"]!;

  const sentences: string[] = [
    `A ${descriptor} ${ageAdj} ${speciality.toLowerCase()} specialist from ${nationality} with notable strength in ${strength}.`,
    `Areas requiring development include ${weakness}.`,
    growthNote,
  ];

  if (Math.random() < 0.6) {
    sentences.push(pick(riskPool));
  }

  return sentences.join(" ");
}
