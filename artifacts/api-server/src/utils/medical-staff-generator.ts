const STAFF_PHYSIOTHERAPISTS = [
  { id: "physio_01", name: "Dr. Isabella Conti",   specialty: "Injury & Rehab Specialist",  stars: 4, experience: 10, rehabilitationBonus: 13, salary: 12000, nationality: "Italy",        age: 38, image: "images/staff/staff_medical_physiotherapist_01.webp" },
  { id: "physio_02", name: "Dr. Sipho Dlamini",    specialty: "Team Physiotherapist",        stars: 4, experience: 12, rehabilitationBonus: 15, salary: 13000, nationality: "South Africa", age: 37, image: "images/staff/staff_medical_physiotherapist_02.webp" },
  { id: "physio_03", name: "Dr. Anastasia Ivanova",specialty: "Team Physiotherapist",        stars: 4, experience: 17, rehabilitationBonus: 17, salary: 14000, nationality: "Russia",       age: 42, image: "images/staff/staff_medical_physiotherapist_03.webp" },
  { id: "physio_04", name: "Dr. Nattaya Somboon",  specialty: "Team Physiotherapist",        stars: 4, experience:  7, rehabilitationBonus: 11, salary: 10000, nationality: "Thailand",     age: 29, image: "images/staff/staff_medical_physiotherapist_04.webp" },
  { id: "physio_05", name: "Dr. Anita Sharma",     specialty: "Team Physiotherapist",        stars: 4, experience: 23, rehabilitationBonus: 20, salary: 14000, nationality: "India",        age: 52, image: "images/staff/staff_medical_physiotherapist_05.webp" },
  { id: "physio_06", name: "Dr. Emily Harrison",   specialty: "Musculoskeletal Specialist",  stars: 4, experience:  6, rehabilitationBonus: 10, salary:  9500, nationality: "Australia",    age: 31, image: "images/staff/staff_medical_physiotherapist_06.webp" },
  { id: "physio_07", name: "Irina Morozova",       specialty: "Movement & Recovery",         stars: 2, experience:  7, rehabilitationBonus:  7, salary:  6500, nationality: "Russia",       age: 29, image: "images/staff/staff_medical_physiotherapist_07.webp" },
  { id: "physio_08", name: "Alexei Mironov",       specialty: "Rehabilitation Specialist",   stars: 5, experience:  9, rehabilitationBonus: 18, salary: 22000, nationality: "Russia",       age: 34, image: "images/staff/staff_medical_physiotherapist_08.webp" },
  { id: "physio_09", name: "Mei Ling Tan",         specialty: "Sports Rehabilitation",       stars: 4, experience:  5, rehabilitationBonus: 10, salary:  8000, nationality: "Singapore",    age: 27, image: "images/staff/staff_medical_physiotherapist_09.webp" },
  { id: "physio_10", name: "Nikita Belyakov",      specialty: "Extra Specialist",            stars: 5, experience:  7, rehabilitationBonus: 22, salary: 26000, nationality: "Russia",       age: 31, image: "images/staff/staff_medical_physiotherapist_10.png"  },
] as const;

const STAFF_DOCTORS = [
  { id: "doctor_01", name: "Dr. Alessandro Bianchi", specialty: "Team Doctor", stars: 4, recoveryBonus: 14, salary: 18000, nationality: "Italy",          age: 42, image: "images/staff/staff_medical_doctor_01.webp" },
  { id: "doctor_02", name: "Dr. Sofia Petrova",      specialty: "Team Doctor", stars: 4, recoveryBonus: 12, salary: 14000, nationality: "Bulgaria",       age: 38, image: "images/staff/staff_medical_doctor_02.webp" },
  { id: "doctor_03", name: "Dr. Hiroshi Tanaka",     specialty: "Team Doctor", stars: 4, recoveryBonus: 18, salary: 24000, nationality: "Japan",           age: 51, image: "images/staff/staff_medical_doctor_03.webp" },
  { id: "doctor_04", name: "Dr. Anna Kowalska",      specialty: "Team Doctor", stars: 4, recoveryBonus: 16, salary: 20000, nationality: "Poland",          age: 46, image: "images/staff/staff_medical_doctor_04.webp" },
  { id: "doctor_05", name: "Dr. Karim Hassan",       specialty: "Team Doctor", stars: 4, recoveryBonus: 22, salary: 28000, nationality: "Egypt",           age: 57, image: "images/staff/staff_medical_doctor_05.webp" },
  { id: "doctor_06", name: "Dr. Sarah Mitchell",     specialty: "Team Doctor", stars: 4, recoveryBonus: 12, salary: 14000, nationality: "Australia",       age: 38, image: "images/staff/staff_medical_doctor_06.webp" },
  { id: "doctor_07", name: "Dr. James O'Connor",     specialty: "Team Doctor", stars: 4, recoveryBonus: 15, salary: 20000, nationality: "Australia",       age: 45, image: "images/staff/staff_medical_doctor_07.webp" },
  { id: "doctor_08", name: "Dr. Emily Harrison",     specialty: "Team Doctor", stars: 4, recoveryBonus: 13, salary: 17000, nationality: "United Kingdom",  age: 43, image: "images/staff/staff_medical_doctor_08.webp" },
  { id: "doctor_09", name: "Dr. Priya Sharma",       specialty: "Team Doctor", stars: 4, recoveryBonus: 11, salary: 13000, nationality: "India",           age: 39, image: "images/staff/staff_medical_doctor_09.webp" },
  { id: "doctor_10", name: "Dr. Michael Anderson",   specialty: "Team Doctor", stars: 4, recoveryBonus: 20, salary: 26000, nationality: "USA",             age: 54, image: "images/staff/staff_medical_doctor_10.webp" },
] as const;

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

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function getMedicalImageUrl(name: string): string {
  return `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(name + "_medical")}&backgroundColor=b6e3f4,ffd5dc,d1d4f9,c0aede`;
}

function generateMedicalStaffPhysiotherapist() {
  const physio = pick(STAFF_PHYSIOTHERAPISTS);
  const overallRating = Math.min(95, 45 + Math.round(physio.rehabilitationBonus * 2.2));
  const attrNames = ROLE_ATTRIBUTES["physiotherapist"];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-8, 8);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }
  return {
    name:            physio.name,
    role:            "physiotherapist" as MedicalRole,
    specialty:       physio.specialty,
    salary:          physio.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     physio.nationality,
    imageUrl:        `/${physio.image}`,
    isAvailable:     true,
    age:             physio.age,
    overallRating,
    contractLength:  pick([6, 12, 18, 24] as const),
    coachSpeciality: "Medical",
    personality:     pick(["Empathetic", "Methodical", "Results-Driven", "Detail-Oriented", "Innovative"] as const),
    attributes,
    specialTrait:    pick(ROLE_TRAITS["physiotherapist"]),
    isScoutRevealed: false,
    scoutingRating:  rand(15, 40),
  };
}

function generateMedicalStaffDoctor() {
  const doc = pick(STAFF_DOCTORS);
  const overallRating = Math.min(95, 60 + Math.round(doc.recoveryBonus * 1.5));
  const attrNames = ROLE_ATTRIBUTES["team_doctor"];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-8, 8);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }
  return {
    name:            doc.name,
    role:            "team_doctor" as MedicalRole,
    specialty:       doc.specialty,
    salary:          doc.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     doc.nationality,
    imageUrl:        `/${doc.image}`,
    isAvailable:     true,
    age:             doc.age,
    overallRating,
    contractLength:  pick([6, 12, 18, 24] as const),
    coachSpeciality: "Medical",
    personality:     pick(["Empathetic", "Methodical", "Results-Driven", "Detail-Oriented", "Innovative"] as const),
    attributes,
    specialTrait:    pick(ROLE_TRAITS["team_doctor"]),
    isScoutRevealed: false,
    scoutingRating:  rand(15, 40),
  };
}

export function generateMedicalStaffMember(role: MedicalRole) {
  if (role === "team_doctor") {
    return generateMedicalStaffDoctor();
  }
  if (role === "physiotherapist") {
    return generateMedicalStaffPhysiotherapist();
  }

  const name          = pick(FEMALE_MEDICAL_NAMES);
  const nationality   = pick(NATIONALITIES);
  const [rMin, rMax]  = ROLE_RATING_RANGES[role];
  const overallRating = rand(rMin, rMax);
  const [sMin, sMax]  = ROLE_SALARY_RANGES[role];
  const salary        = rand(sMin, sMax);

  const attrNames = ROLE_ATTRIBUTES[role];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-10, 10);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }

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
    contractLength:  pick([6, 12, 18, 24] as const),
    coachSpeciality: "Medical",
    personality:     pick(["Empathetic", "Methodical", "Results-Driven", "Detail-Oriented", "Innovative"] as const),
    attributes,
    specialTrait:    pick(ROLE_TRAITS[role]),
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
