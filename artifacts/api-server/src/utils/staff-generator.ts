const STAFF_HEAD_COACHES = [
  { id: "head_coach_01", name: "James Whitmore",   nationality: "Australia",    age: 41, experience: 15, stars: 4.5, salary:  9800, contractYears: 4, personality: "Demanding",    specialties: ["Leadership", "Strategy", "Elite Performance"],          development: 92, matchManagement: 94, tactics: 93, motivation: 90, discipline: 89, image: "images/staff/staff_head_coach_01.webp" },
  { id: "head_coach_02", name: "Marco Ricci",       nationality: "Italy",        age: 52, experience: 21, stars: 4.5, salary: 11200, contractYears: 5, personality: "Calm",          specialties: ["Leadership", "Strategy", "Elite Performance"],          development: 90, matchManagement: 95, tactics: 96, motivation: 87, discipline: 92, image: "images/staff/staff_head_coach_02.webp" },
  { id: "head_coach_03", name: "Tomasz Kowalski",  nationality: "Poland",       age: 45, experience: 17, stars: 3.0, salary:  7200, contractYears: 3, personality: "Analytical",    specialties: ["Tactical Expert", "Game Intelligence", "Player Development"], development: 88, matchManagement: 82, tactics: 89, motivation: 79, discipline: 86, image: "images/staff/staff_head_coach_03.webp" },
  { id: "head_coach_04", name: "Sarah Mitchell",   nationality: "New Zealand",  age: 45, experience: 12, stars: 3.0, salary:  6900, contractYears: 3, personality: "Supportive",    specialties: ["Development", "Motivation", "Game Intelligence"],       development: 91, matchManagement: 79, tactics: 78, motivation: 90, discipline: 80, image: "images/staff/staff_head_coach_04.webp" },
  { id: "head_coach_05", name: "Daniel Persson",   nationality: "Sweden",       age: 38, experience:  8, stars: 3.0, salary:  6400, contractYears: 2, personality: "Reserved",      specialties: ["Tactics", "Analysis", "Performance"],                  development: 82, matchManagement: 77, tactics: 85, motivation: 76, discipline: 84, image: "images/staff/staff_head_coach_05.webp" },
  { id: "head_coach_06", name: "Laura Martínez",   nationality: "Spain",        age: 49, experience: 16, stars: 4.0, salary:  8600, contractYears: 4, personality: "Inspirational", specialties: ["Leadership", "Communication", "Team Culture"],          development: 90, matchManagement: 86, tactics: 85, motivation: 93, discipline: 84, image: "images/staff/staff_head_coach_06.webp" },
  { id: "head_coach_07", name: "Nikita Thompson",  nationality: "Jamaica",      age: 43, experience: 14, stars: 4.0, salary:  8300, contractYears: 4, personality: "Intense",       specialties: ["Discipline", "Resilience", "Winning Mentality"],        development: 86, matchManagement: 87, tactics: 84, motivation: 94, discipline: 95, image: "images/staff/staff_head_coach_07.webp" },
  { id: "head_coach_08", name: "Jessica Reid",     nationality: "Jamaica",      age: 29, experience:  6, stars: 3.5, salary:  5600, contractYears: 2, personality: "Energetic",     specialties: ["Energy", "Team Culture", "Player Development"],         development: 88, matchManagement: 74, tactics: 73, motivation: 91, discipline: 75, image: "images/staff/staff_head_coach_08.webp" },
  { id: "head_coach_09", name: "Mekdes Tesfaye",   nationality: "Ethiopia",     age: 61, experience: 22, stars: 4.0, salary:  9400, contractYears: 5, personality: "Mentor",        specialties: ["Experience", "Wisdom", "Discipline"],                  development: 89, matchManagement: 93, tactics: 88, motivation: 86, discipline: 96, image: "images/staff/staff_head_coach_09.webp" },
  { id: "head_coach_10", name: "Massimo Bianchi",  nationality: "Italy",        age: 52, experience: 20, stars: 4.5, salary: 10900, contractYears: 5, personality: "Professional",  specialties: ["Leadership", "Tactics", "Motivation"],                  development: 90, matchManagement: 94, tactics: 95, motivation: 90, discipline: 91, image: "images/staff/staff_head_coach_10.webp" },
];

const STAFF_FITNESS_TRAINERS = [
  { id: "fitness_trainer_01", name: "Lucas Anderson",       specialty: "Strength & Conditioning", stars: 4.5, experience:  8, fitnessBonus: 17, salary: 13000, nationality: "Australia",     age: 32, image: "images/staff/staff_fitness_trainer_01.webp" },
  { id: "fitness_trainer_02", name: "Lauren Johnson",        specialty: "Strength Training",        stars: 2.0, experience:  5, fitnessBonus:  6, salary:  6500, nationality: "United States",  age: 27, image: "images/staff/staff_fitness_trainer_02.webp" },
  { id: "fitness_trainer_03", name: "Emily Carter",          specialty: "Strength Training",        stars: 4.0, experience:  6, fitnessBonus: 13, salary: 10000, nationality: "Australia",     age: 32, image: "images/staff/staff_fitness_trainer_03.webp" },
  { id: "fitness_trainer_04", name: "Sofia Bianchi",         specialty: "HIIT Training",            stars: 4.0, experience:  4, fitnessBonus: 12, salary:  9500, nationality: "Italy",         age: 29, image: "images/staff/staff_fitness_trainer_04.webp" },
  { id: "fitness_trainer_05", name: "Mateo Gonzalez",        specialty: "Strength & Conditioning", stars: 4.0, experience:  7, fitnessBonus: 14, salary: 11000, nationality: "Argentina",      age: 33, image: "images/staff/staff_fitness_trainer_05.webp" },
  { id: "fitness_trainer_06", name: "Lucía Martínez",        specialty: "Strength Training",        stars: 4.0, experience:  5, fitnessBonus: 12, salary: 10000, nationality: "Spain",         age: 28, image: "images/staff/staff_fitness_trainer_06.webp" },
  { id: "fitness_trainer_07", name: "Isabella Rodriguez",    specialty: "Strength Training",        stars: 4.0, experience:  6, fitnessBonus: 13, salary: 10500, nationality: "Brazil",        age: 30, image: "images/staff/staff_fitness_trainer_07.webp" },
  { id: "fitness_trainer_08", name: "Natalie Thompson",      specialty: "Strength & Conditioning", stars: 4.0, experience:  8, fitnessBonus: 15, salary: 11500, nationality: "Canada",        age: 34, image: "images/staff/staff_fitness_trainer_08.webp" },
  { id: "fitness_trainer_09", name: "Eleni Papadopoulos",   specialty: "Strength Training",        stars: 4.0, experience:  7, fitnessBonus: 14, salary: 11000, nationality: "Greece",        age: 32, image: "images/staff/staff_fitness_trainer_09.webp" },
  { id: "fitness_trainer_10", name: "Sophie Martin",         specialty: "Strength Training",        stars: 4.0, experience:  5, fitnessBonus: 12, salary: 10000, nationality: "France",        age: 28, image: "images/staff/staff_fitness_trainer_10.webp" },
];

const STAFF_ASSISTANT_COACHES = [
  { id: "assistant_coach_01", name: "Luca Bardi",       specialty: "Offense Strategy",           stars: 4.0, experience:  9, coachingBonus: 14, salary: 13000, nationality: "Australia",  age: 38, image: "images/staff/staff_assistant_coach_01.webp" },
  { id: "assistant_coach_02", name: "Marcos Silva",      specialty: "Player Development",          stars: 2.5, experience: 17, coachingBonus:  7, salary:  8500, nationality: "Brazil",     age: 46, image: "images/staff/staff_assistant_coach_02.webp" },
  { id: "assistant_coach_03", name: "Sofia Martinez",    specialty: "Defensive Strategy",          stars: 2.5, experience:  8, coachingBonus:  6, salary:  7500, nationality: "Spain",      age: 34, image: "images/staff/staff_assistant_coach_03.webp" },
  { id: "assistant_coach_04", name: "Emma Watson",       specialty: "Defensive Strategy",          stars: 3.0, experience: 14, coachingBonus:  9, salary:  9500, nationality: "Australia",  age: 42, image: "images/staff/staff_assistant_coach_04.webp" },
  { id: "assistant_coach_05", name: "Anouk Van Dijk",    specialty: "All-Rounder Strategy",        stars: 2.5, experience: 15, coachingBonus:  7, salary:  8000, nationality: "Netherlands",age: 47, image: "images/staff/staff_assistant_coach_05.webp" },
  { id: "assistant_coach_06", name: "Jessica De Groot",  specialty: "Setting & Game Analysis",     stars: 4.5, experience: 11, coachingBonus: 16, salary: 14000, nationality: "Australia",  age: 38, image: "images/staff/staff_assistant_coach_06.webp" },
  { id: "assistant_coach_07", name: "Isabella Ricci",    specialty: "Defense & Court Positioning", stars: 4.5, experience:  8, coachingBonus: 15, salary: 12500, nationality: "Italy",      age: 34, image: "images/staff/staff_assistant_coach_07.webp" },
  { id: "assistant_coach_08", name: "Kwame Adu",         specialty: "Strength & Conditioning",     stars: 4.5, experience: 14, coachingBonus: 17, salary: 15000, nationality: "Ghana",      age: 40, image: "images/staff/staff_assistant_coach_08.webp" },
  { id: "assistant_coach_09", name: "Mei-Ling Tan",      specialty: "Technical Skills & Serve",    stars: 4.5, experience:  7, coachingBonus: 15, salary: 12000, nationality: "Singapore",  age: 31, image: "images/staff/staff_assistant_coach_09.webp" },
  { id: "assistant_coach_10", name: "Lukas Schmidt",     specialty: "Tactics & Game Strategy",     stars: 4.5, experience: 12, coachingBonus: 18, salary: 15000, nationality: "Germany",    age: 37, image: "images/staff/staff_assistant_coach_10.webp" },
];

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

function generateHeadCoach() {
  const c = pick(STAFF_HEAD_COACHES);
  const overallRating = Math.round((c.development + c.matchManagement + c.tactics + c.motivation + c.discipline) / 5);
  const [sqMin, sqMax] = ROLE_SCOUTING_RANGES["head_coach"];
  return {
    name:            c.name,
    role:            "head_coach" as StaffRole,
    specialty:       c.specialties[0] ?? "Leadership",
    salary:          c.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     c.nationality,
    imageUrl:        `/${c.image}`,
    isAvailable:     true,
    age:             c.age,
    overallRating,
    contractLength:  pick([12, 24, 36, 48, 60]),
    coachSpeciality: c.specialties[0] ?? "General",
    personality:     c.personality,
    attributes: {
      "Tactical Knowledge":   c.tactics,
      "Attack Coaching":      c.matchManagement,
      "Team Building":        c.development,
      "Motivation":           c.motivation,
      "Discipline":           c.discipline,
    },
    specialTrait:    pick(ROLE_TRAITS["head_coach"]),
    isScoutRevealed: false,
    scoutingRating:  rand(sqMin, sqMax),
  };
}

function generateFitnessTrainer() {
  const c = pick(STAFF_FITNESS_TRAINERS);
  const overallRating = Math.min(95, 46 + Math.round(c.fitnessBonus * 2.4));
  const attrNames = ROLE_ATTRIBUTES["fitness_trainer"];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-10, 10);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }
  const [sqMin, sqMax] = ROLE_SCOUTING_RANGES["fitness_trainer"];
  return {
    name:            c.name,
    role:            "fitness_trainer" as StaffRole,
    specialty:       c.specialty,
    salary:          c.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     c.nationality,
    imageUrl:        `/${c.image}`,
    isAvailable:     true,
    age:             c.age,
    overallRating,
    contractLength:  pick([6, 12, 18, 24]),
    coachSpeciality: pick(["Conditioning", "Injury Prevention", "Nutrition", "Speed", "General"]),
    personality:     pick(["Motivator", "Demanding", "Player Friendly", "Disciplinarian"]),
    attributes,
    specialTrait:    pick(ROLE_TRAITS["fitness_trainer"]),
    isScoutRevealed: false,
    scoutingRating:  rand(sqMin, sqMax),
  };
}

function generateAssistantCoach() {
  const c = pick(STAFF_ASSISTANT_COACHES);
  const overallRating = Math.min(95, 46 + Math.round(c.coachingBonus * 2.3));
  const attrNames = ROLE_ATTRIBUTES["assistant_coach"];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-10, 10);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }
  const [sqMin, sqMax] = ROLE_SCOUTING_RANGES["assistant_coach"];
  return {
    name:            c.name,
    role:            "assistant_coach" as StaffRole,
    specialty:       c.specialty,
    salary:          c.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     c.nationality,
    imageUrl:        `/${c.image}`,
    isAvailable:     true,
    age:             c.age,
    overallRating,
    contractLength:  pick([6, 12, 18, 24]),
    coachSpeciality: pick(["Technical", "Defensive", "Conditioning", "Youth Development", "General"]),
    personality:     pick(["Motivator", "Demanding", "Player Friendly", "Disciplinarian"]),
    attributes,
    specialTrait:    pick(ROLE_TRAITS["assistant_coach"]),
    isScoutRevealed: false,
    scoutingRating:  rand(sqMin, sqMax),
  };
}

export function generateStaffMember(role: StaffRole) {
  if (role === "head_coach") {
    return generateHeadCoach();
  }
  if (role === "fitness_trainer") {
    return generateFitnessTrainer();
  }
  if (role === "assistant_coach") {
    return generateAssistantCoach();
  }
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
