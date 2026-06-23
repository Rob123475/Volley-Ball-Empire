const NATIONALITIES = [
  "Brazilian","American","Australian","Spanish","German","French","Italian","Dutch",
  "Brazilian","Japanese","Chinese","Russian","Canadian","Argentine","Norwegian",
  "Swedish","Danish","Finnish","Polish","Czech","Swiss","Austrian","Belgian",
  "Portuguese","Mexican","Colombian","Chilean","Peruvian","South Korean","Thai",
];

export type MedicalRole =
  | "team_doctor"
  | "medical_specialist"
  | "physiotherapist"
  | "nutritionist"
  | "sports_chemist";

export const MEDICAL_ROLE_LABELS: Record<MedicalRole, string> = {
  team_doctor:        "Team Doctor",
  medical_specialist: "Medical Specialist",
  physiotherapist:    "Physiotherapist",
  nutritionist:       "Nutritionist",
  sports_chemist:     "Sports Chemist",
};

export const MEDICAL_ROLES: MedicalRole[] = [
  "team_doctor",
  "medical_specialist",
  "physiotherapist",
  "nutritionist",
  "sports_chemist",
];

const ROLE_ATTRIBUTES: Record<MedicalRole, string[]> = {
  team_doctor:        ["Diagnosis Accuracy", "Treatment Efficacy", "Emergency Response"],
  medical_specialist: ["Specialist Knowledge", "Clinical Precision", "Recovery Protocol"],
  physiotherapist:    ["Rehabilitation Skill", "Manual Therapy", "Exercise Prescription"],
  nutritionist:       ["Dietary Planning", "Performance Nutrition", "Supplement Knowledge"],
  sports_chemist:     ["Biochemical Analysis", "Supplement Development", "Anti-Doping Knowledge"],
};

const ROLE_TRAITS: Record<MedicalRole, string[]> = {
  team_doctor:        ["Rapid Diagnostician", "Emergency Expert", "Patient Advocate", "Clinical Genius", "Preventive Practitioner"],
  medical_specialist: ["Precision Healer", "Specialist Network", "Complex Case Expert", "Fast Track Recovery", "Evidence-Based Expert"],
  physiotherapist:    ["Rehabilitation Guru", "Hands-On Healer", "Movement Specialist", "Pain Relief Expert", "Functional Recovery Pro"],
  nutritionist:       ["Performance Fueller", "Metabolic Specialist", "Recovery Nutrition Expert", "Anti-Inflammatory Diet", "Hydration Guru"],
  sports_chemist:     ["Supplement Pioneer", "Biochemical Genius", "Legal Edge Expert", "Anti-Doping Shield", "Performance Optimizer"],
};

const ROLE_SALARY_RANGES: Record<MedicalRole, [number, number]> = {
  team_doctor:        [14000, 34000],
  medical_specialist: [11000, 26000],
  physiotherapist:    [5500, 14000],
  nutritionist:       [4500, 12000],
  sports_chemist:     [7500, 21000],
};

const ROLE_RATING_RANGES: Record<MedicalRole, [number, number]> = {
  team_doctor:        [55, 95],
  medical_specialist: [52, 92],
  physiotherapist:    [48, 88],
  nutritionist:       [46, 85],
  sports_chemist:     [50, 90],
};

const FEMALE_MEDICAL_NAMES = [
  "Dr. Sarah Chen", "Dr. Amara Osei", "Dr. Lucía Morales", "Dr. Yuki Tanaka", "Dr. Priya Sharma",
  "Dr. Emma Bauer", "Dr. Fatima Al-Hassan", "Dr. Sofia Petrov", "Dr. Hannah Müller", "Dr. Ji-Yeon Park",
  "Rebecca Torres", "Anika Johansson", "Camille Rousseau", "Nadia Ibrahim", "Ingrid Thorsen",
  "Clara Schmidt", "Mia Nakamura", "Alicia Vargas", "Zoe Mitchell", "Elena Voronova",
  "Dr. Nina Kowalski", "Dr. Ayasha Running Bear", "Dr. Mei Huang", "Dr. Valentina Ferrari", "Dr. Astrid Lindqvist",
  "Bianca Costa", "Tara O'Sullivan", "Dr. Maha Abdullah", "Kezia Adeyemi", "Dr. Irina Volkov",
  "Sophia Laurent", "Dr. Ana Paula Ribeiro", "Chiara Romano", "Dr. Soo-Jin Lee", "Pilar Gutiérrez",
  "Dr. Anya Ivanova", "Simone Dupont", "Dr. Amira Khalil", "Natasha Petrakis", "Dr. Rin Yamamoto",
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const getMedicalImageUrl = (name: string) =>
  `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(name + "_medical")}&backgroundColor=b6e3f4,ffd5dc,d1d4f9,c0aede`;

export function generateMedicalStaffMember(role: MedicalRole) {
  const name        = pick(FEMALE_MEDICAL_NAMES);
  const nationality = pick(NATIONALITIES);
  const [rMin, rMax] = ROLE_RATING_RANGES[role];
  const overallRating = rand(rMin, rMax);
  const [sMin, sMax]  = ROLE_SALARY_RANGES[role];
  const salary = rand(sMin, sMax);

  const attrNames = ROLE_ATTRIBUTES[role];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-10, 10);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }

  const specialTrait   = pick(ROLE_TRAITS[role]);

  return {
    name,
    role,
    specialty:       MEDICAL_ROLE_LABELS[role],
    salary:          salary.toFixed(2),
    skillLevel:      overallRating,
    nationality,
    imageUrl:        getMedicalImageUrl(name),
    isAvailable:     true,
    age:             rand(28, 55),
    overallRating,
    contractLength:  pick([6, 12, 18, 24]),
    coachSpeciality: "Medical",
    personality:     pick(["Empathetic", "Methodical", "Results-Driven", "Detail-Oriented", "Innovative"]),
    attributes,
    specialTrait,
    isScoutRevealed: false,
    scoutingRating:  rand(15, 40),
  };
}

export function generateMedicalAttributesForRole(role: string, skillLevel: number): Record<string, number> {
  const attrNames = ROLE_ATTRIBUTES[role as MedicalRole] ?? ["Medical Skill", "Patient Care", "Clinical Knowledge"];
  const result: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = skillLevel + rand(-10, 10);
    result[attr] = Math.min(99, Math.max(40, base));
  }
  return result;
}

export function pickMedicalTraitForRole(role: string): string {
  const traits = ROLE_TRAITS[role as MedicalRole] ?? ["Professional"];
  return pick(traits);
}

export function generateMedicalMarket(count = 30): ReturnType<typeof generateMedicalStaffMember>[] {
  const roles: MedicalRole[] = [
    "team_doctor", "team_doctor", "team_doctor",
    "medical_specialist", "medical_specialist", "medical_specialist",
    "physiotherapist", "physiotherapist", "physiotherapist", "physiotherapist",
    "nutritionist", "nutritionist", "nutritionist", "nutritionist",
    "sports_chemist", "sports_chemist", "sports_chemist",
  ];

  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(generateMedicalStaffMember(pick(roles)));
  }
  return result;
}
