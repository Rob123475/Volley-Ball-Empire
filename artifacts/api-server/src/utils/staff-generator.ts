const NATIONALITIES = [
  "Brazilian","American","Australian","Spanish","German","French","Italian","Dutch",
  "Brazilian","Japanese","Chinese","Russian","Canadian","Argentine","Norwegian",
  "Swedish","Danish","Finnish","Polish","Czech","Swiss","Austrian","Belgian",
  "Portuguese","Mexican","Colombian","Chilean","Peruvian","South Korean","Thai",
];

export type StaffRole =
  | "head_coach"
  | "assistant_coach"
  | "fitness_trainer"
  | "strength_conditioner"
  | "massage_therapist"
  | "promotions_manager"
  | "scout";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  head_coach:           "Head Coach",
  assistant_coach:      "Assistant Coach",
  fitness_trainer:      "Fitness Trainer",
  strength_conditioner: "Strength Conditioner",
  massage_therapist:    "Massage Therapist",
  promotions_manager:   "Promotions Manager",
  scout:                "Scout",
};

const ROLE_ATTRIBUTES: Record<StaffRole, string[]> = {
  head_coach:           ["Tactical Knowledge", "Attack Coaching", "Team Building"],
  assistant_coach:      ["Technical Drills", "Set Play Design", "Player Communication"],
  fitness_trainer:      ["Conditioning Level", "Speed Training", "Endurance Protocols"],
  strength_conditioner: ["Power Development", "Core Strength", "Injury Prevention"],
  massage_therapist:    ["Recovery Techniques", "Injury Treatment", "Fatigue Reduction"],
  promotions_manager:   ["Sponsorship Networks", "Media Relations", "Brand Building"],
  scout:                ["Talent Identification", "Judgement Accuracy", "Regional Knowledge"],
};

const ROLE_TRAITS: Record<StaffRole, string[]> = {
  head_coach:           ["Visionary", "High-Pressure Expert", "Youth Developer", "Tactician", "Motivational Leader"],
  assistant_coach:      ["Analytics Expert", "Scout's Eye", "Set Play Designer", "Communication Master", "Video Analyst"],
  fitness_trainer:      ["Sprint Specialist", "Injury Prevention Pro", "Stamina Coach", "Power Developer", "Recovery Expert"],
  strength_conditioner: ["Explosive Power", "Peak Physical Prep", "Anti-Fatigue Protocol", "Strength Builder", "Muscle Recovery"],
  massage_therapist:    ["Healing Hands", "Deep Tissue Pro", "Rapid Recovery", "Pain Management", "Pre-Match Routine"],
  promotions_manager:   ["Deal Closer", "Media Darling", "Brand Builder", "Viral Marketer", "Sponsor Magnet"],
  scout:                ["Diamond Eye", "Negotiation Expert", "Youth Specialist", "Global Network", "Hidden Gem Hunter"],
};

const ROLE_SALARY_RANGES: Record<StaffRole, [number, number]> = {
  head_coach:           [15000, 35000],
  assistant_coach:      [8000, 18000],
  fitness_trainer:      [6000, 14000],
  strength_conditioner: [5000, 12000],
  massage_therapist:    [4000, 10000],
  promotions_manager:   [7000, 20000],
  scout:                [6000, 22000],
};

const ROLE_RATING_RANGES: Record<StaffRole, [number, number]> = {
  head_coach:           [55, 95],
  assistant_coach:      [50, 88],
  fitness_trainer:      [48, 85],
  strength_conditioner: [48, 82],
  massage_therapist:    [45, 80],
  promotions_manager:   [50, 88],
  scout:                [48, 90],
};

const ROLE_SCOUTING_RANGES: Record<StaffRole, [number, number]> = {
  head_coach:           [40, 80],
  assistant_coach:      [55, 95],
  fitness_trainer:      [25, 60],
  strength_conditioner: [20, 55],
  massage_therapist:    [20, 50],
  promotions_manager:   [28, 62],
  scout:                [60, 99],
};

const FEMALE_STAFF_NAMES = [
  "Sarah Johnson", "Michelle Rodriguez", "Jennifer Williams", "Karen Thompson", "Lisa Anderson",
  "Patricia Martinez", "Sandra Taylor", "Christine Wilson", "Dorothy Moore", "Ruth Jackson",
  "Angela Davis", "Brenda Wilson", "Cheryl Anderson", "Deborah Thomas", "Emily Harris",
  "Frances Martin", "Gloria Garcia", "Helen Martinez", "Irene Robinson", "Janet Clark",
  "Katherine Lewis", "Laura Lee", "Megan Walker", "Nancy Hall", "Olivia Allen",
  "Pamela Young", "Rachel Hernandez", "Sharon King", "Teresa Wright", "Vanessa Scott",
  "Ava Chen", "Bella Kim", "Carmen Diaz", "Diana Patel", "Elena Petrov",
  "Fiona O'Brien", "Grace Nakamura", "Hannah Müller", "Isabelle Laurent", "Julia Novak",
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const getStaffImageUrl = (name: string) =>
  `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(name + "_coach")}&backgroundColor=b6e3f4,ffd5dc,d1d4f9`;

export function generateStaffMember(role: StaffRole) {
  const name       = pick(FEMALE_STAFF_NAMES);
  const nationality = pick(NATIONALITIES);
  const [rMin, rMax] = ROLE_RATING_RANGES[role];
  const overallRating = rand(rMin, rMax);
  const [sMin, sMax] = ROLE_SALARY_RANGES[role];
  const salary = rand(sMin, sMax);

  const attrNames = ROLE_ATTRIBUTES[role];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-10, 10);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }

  const specialTrait = pick(ROLE_TRAITS[role]);
  const [sqMin, sqMax] = ROLE_SCOUTING_RANGES[role];
  const scoutingRating = rand(sqMin, sqMax);

  return {
    name,
    role,
    specialty:       STAFF_ROLE_LABELS[role],
    salary:          salary.toFixed(2),
    skillLevel:      overallRating,
    nationality,
    imageUrl:        getStaffImageUrl(name),
    isAvailable:     true,
    age:             rand(28, 58),
    overallRating,
    contractLength:  pick([6, 12, 18, 24]),
    coachSpeciality: pick(["Technical", "Athletic", "Defensive", "Conditioning", "Youth Development", "General"]),
    personality:     pick(["Motivator", "Demanding", "Player Friendly", "Disciplinarian"]),
    attributes,
    specialTrait,
    isScoutRevealed: false,
    scoutingRating,
  };
}

export function generateAttributesForRole(role: string, skillLevel: number): Record<string, number> {
  const attrNames = ROLE_ATTRIBUTES[role as StaffRole] ?? ["Skill", "Knowledge", "Experience"];
  const result: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = skillLevel + rand(-10, 10);
    result[attr] = Math.min(99, Math.max(40, base));
  }
  return result;
}

export function pickTraitForRole(role: string): string {
  const traits = ROLE_TRAITS[role as StaffRole] ?? ["Professional"];
  return pick(traits);
}

export function generateStaffMarket(count = 30): ReturnType<typeof generateStaffMember>[] {
  const roles: StaffRole[] = [
    "head_coach", "head_coach",
    "assistant_coach", "assistant_coach", "assistant_coach",
    "fitness_trainer", "fitness_trainer", "fitness_trainer",
    "strength_conditioner", "strength_conditioner", "strength_conditioner",
    "massage_therapist", "massage_therapist", "massage_therapist",
    "promotions_manager", "promotions_manager", "promotions_manager",
    "scout", "scout", "scout", "scout",
  ];

  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(generateStaffMember(pick(roles)));
  }
  return result;
}
