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

// ── Elite event reports ───────────────────────────────────────────────────────

const ELITE_EVENT_REPORTS: Record<string, string[]> = {
  "Generational Talent": [
    "EXCEPTIONAL FIND. This is a once-in-a-generation discovery. The physical metrics, decision-making under pressure, and raw athletic ceiling are all dramatically beyond her age group. Technical staff reviewed the footage three times before filing this report. Scouts encounter a player like this once in a career. Sign immediately — there will be competition.",
    "PRIORITY SIGNING. Rarely does a report leave this office with such unambiguous language, but the situation demands it: this player is a generational find. Every measurable indicator points to a ceiling that rivals the current top of the World Tour. She is younger than her peers and already superior. Delay is not an option.",
    "HISTORIC PROSPECT. In twenty years of scouting, I have filed this classification twice. She moves differently. She reads the game differently. Her technical foundations at this age are not merely impressive — they are unprecedented in my experience. Whatever the cost, this player must be signed.",
  ],
  "Olympic Wonderkid": [
    "STANDOUT PROSPECT. Everything needed to compete at Olympic level is present. The athleticism, the competitive composure, the technical foundation — all elite for her age. International scouts from multiple national programs have already been spotted watching her practice sessions. The window to secure this player is narrow.",
    "OLYMPIC CALIBRE. This player carries herself like a veteran despite being a teenager. The court awareness and shot selection under pressure are the kind that can't be coached — they have to be innate. With proper development, an Olympic podium is a realistic ceiling. She will not be available for long.",
    "FUTURE OLYMPIAN. The physical projections alone make this a compelling case, but it is the competitive mentality that elevates her above her peers. She does not wilt under pressure — she accelerates. National programme scouts are already circling. Priority signing recommended.",
  ],
  "Physical Freak": [
    "ATHLETIC OUTLIER. The physical profile on this player is unlike anything documented in this region in years. The combination of explosive power, top-end speed, and natural athleticism creates a developmental ceiling that is genuinely difficult to cap. The raw material is extraordinary — with coaching investment, this could become an elite performer.",
    "PHYSICAL SPECIMEN. Standard rating scales don't capture what I saw in person. The sheer athleticism — the vertical, the acceleration, the power-to-weight ratio — puts her in a category outside her peers. She is unpolished technically, but the physical gifts are so pronounced that development risk is low. Back this one.",
    "EXCEPTIONAL ATHLETE. Her physical tools belong at a higher level than her current rating suggests. The body is built for beach volleyball: the wingspan, the explosiveness off the sand, the stamina in long rallies. Technical work will come with coaching. The physical ceiling is already set — and it is very high.",
  ],
  "Local Hero": [
    "LOCAL LEGEND. Already a revered figure in local beach volleyball despite her youth. Community-supported and widely celebrated, she brings genuine technical ability alongside rare crowd-drawing appeal. Her grounded mentality, burning desire to represent her nation, and local knowledge of the conditions make her a unique signing proposition.",
    "COMMUNITY ICON. The reception at the local tournament was telling — she is already beloved. But the emotional story is backed by genuine talent. Her court sense is sharpened by years of competing in these specific conditions, giving her an edge that stadium players rarely carry. She brings the crowd and brings results.",
    "HOMETOWN HERO. There is something different about a player who has grown up under local expectation and thrived. The competitive pressure she has already faced — playing for her community every time she steps on the sand — has forged a mentality that coaching rarely produces. High ceiling, ready-made character.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateEliteEventReport(eliteEventType: string): string {
  const pool = ELITE_EVENT_REPORTS[eliteEventType];
  if (!pool) return "";
  return pick(pool);
}

export function generateScoutingReport(params: {
  name: string;
  age: number;
  nationality: string;
  speciality: string;
  region: string;
  scoutedPotential: string;
  eliteEventType?: string | null;
}): string {
  const { age, nationality, speciality, region, scoutedPotential, eliteEventType } = params;

  // Elite events get their own dedicated report
  if (eliteEventType) {
    return generateEliteEventReport(eliteEventType);
  }

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
