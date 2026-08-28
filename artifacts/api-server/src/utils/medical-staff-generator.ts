const STAFF_NUTRITIONISTS = [
  { id: "nutritionist_01", name: "Dr. Lucy Mitchell",    specialty: "Team Nutrition",            stars: 4,   experience:  9, nutritionBonus: 14, salary: 14500, nationality: "Australia",    age: 34, image: "images/staff/staff_medical_nutritionist_01.webp" },
  { id: "nutritionist_02", name: "Dr. James O'Connor",   specialty: "Performance Nutrition",     stars: 4,   experience: 14, nutritionBonus: 16, salary: 17000, nationality: "Australia",    age: 41, image: "images/staff/staff_medical_nutritionist_02.webp" },
  { id: "nutritionist_03", name: "Dr. Ingrid Nilsen",    specialty: "Team Nutrition",            stars: 4,   experience:  8, nutritionBonus: 13, salary: 14000, nationality: "Norway",       age: 33, image: "images/staff/staff_medical_nutritionist_03.webp" },
  { id: "nutritionist_04", name: "Dr. Anastasia Petrova",specialty: "Plant-Based Nutrition",     stars: 2,   experience:  6, nutritionBonus:  6, salary:  7500, nationality: "Russia",       age: 33, image: "images/staff/staff_medical_nutritionist_04.webp" },
  { id: "nutritionist_05", name: "Dr. Sipho Ndlovu",     specialty: "Team Nutrition",            stars: 2,   experience:  7, nutritionBonus:  7, salary:  8000, nationality: "South Africa", age: 35, image: "images/staff/staff_medical_nutritionist_05.webp" },
  { id: "nutritionist_06", name: "Dr. Elena Sokolova",   specialty: "Head Performance Nutrition",stars: 5,   experience: 15, nutritionBonus: 19, salary: 21000, nationality: "Russia",       age: 42, image: "images/staff/staff_medical_nutritionist_06.webp" },
  { id: "nutritionist_07", name: "Larissa Mendes",       specialty: "Recovery Nutrition",        stars: 3.5, experience:  4, nutritionBonus: 11, salary:  9000, nationality: "Brazil",       age: 27, image: "images/staff/staff_medical_nutritionist_07.webp" },
  { id: "nutritionist_08", name: "Sophie Nguyen",        specialty: "Performance Nutrition",     stars: 4,   experience: 13, nutritionBonus: 14, salary: 16000, nationality: "Canada",       age: 42, image: "images/staff/staff_medical_nutritionist_08.webp" },
  { id: "nutritionist_09", name: "Emilie Dupont",        specialty: "Performance Nutrition",     stars: 4.5, experience:  6, nutritionBonus: 15, salary: 13000, nationality: "France",       age: 29, image: "images/staff/staff_medical_nutritionist_09.webp" },
  { id: "nutritionist_10", name: "Isabella Moretti",     specialty: "Elite Sports Nutrition",    stars: 5,   experience: 18, nutritionBonus: 20, salary: 22000, nationality: "Italy",        age: 46, image: "images/staff/staff_medical_nutritionist_10.webp" },
] as const;

const STAFF_MEDICAL_SPECIALISTS = [
  { id: "specialist_01", name: "Dr. James Carter",      specialty: "Back Specialist",           stars: 4.5, experience: 20, recoveryBonus: 21, salary: 25000, nationality: "United Kingdom", age: 52, image: "images/staff/staff_medical_specialist_01.webp" },
  { id: "specialist_02", name: "Dr. Sarah Mitchell",    specialty: "Shoulder Specialist",        stars: 4.5, experience: 18, recoveryBonus: 19, salary: 24000, nationality: "Australia",      age: 48, image: "images/staff/staff_medical_specialist_02.webp" },
  { id: "specialist_03", name: "Dr. David Thompson",    specialty: "Ankle Specialist",           stars: 4.5, experience: 17, recoveryBonus: 19, salary: 22000, nationality: "Canada",         age: 46, image: "images/staff/staff_medical_specialist_03.webp" },
  { id: "specialist_04", name: "Dr. Benjamin Harris",   specialty: "Hand Specialist",            stars: 4.5, experience: 19, recoveryBonus: 18, salary: 23000, nationality: "United Kingdom", age: 50, image: "images/staff/staff_medical_specialist_04.webp" },
  { id: "specialist_05", name: "Dr. Andrew Wilson",     specialty: "Knee Specialist",            stars: 4.5, experience: 18, recoveryBonus: 20, salary: 24000, nationality: "Australia",      age: 45, image: "images/staff/staff_medical_specialist_05.webp" },
  { id: "specialist_06", name: "Dr. Meera Kapoor",      specialty: "Neck Specialist",            stars: 5,   experience: 21, recoveryBonus: 22, salary: 28000, nationality: "India",          age: 53, image: "images/staff/staff_medical_specialist_06.webp" },
  { id: "specialist_07", name: "Dr. Sofia Martinez",    specialty: "Performance Analyst",        stars: 4.0, experience:  4, recoveryBonus: 10, salary: 13000, nationality: "Spain",          age: 27, image: "images/staff/staff_medical_specialist_07.webp" },
  { id: "specialist_08", name: "Dr. Daniel Thompson",   specialty: "Orthopaedic Specialist",     stars: 4.5, experience: 13, recoveryBonus: 16, salary: 19000, nationality: "Australia",      age: 41, image: "images/staff/staff_medical_specialist_08.webp" },
  { id: "specialist_09", name: "Dr. Alessandro Rossi",  specialty: "Cardiology Specialist",      stars: 4.5, experience: 10, recoveryBonus: 15, salary: 20000, nationality: "Italy",          age: 35, image: "images/staff/staff_medical_specialist_09.webp" },
  { id: "specialist_10", name: "Dr. Nathaniel Goodwin", specialty: "Neurology Specialist",       stars: 4.5, experience: 16, recoveryBonus: 22, salary: 26000, nationality: "New Zealand",    age: 46, image: "images/staff/staff_medical_specialist_10.webp" },
] as const;

const STAFF_SPORTS_SCIENTISTS = [
  { id: "scientist_01", name: "Dr. Matthew Anderson", specialty: "Team Sports Scientist",        stars: 4.5, experience: 12, performanceBonus: 17, salary: 17500, nationality: "Australia",    age: 38, image: "images/staff/staff_medical_science_01.webp" },
  { id: "scientist_02", name: "Dr. Emma Clarke",       specialty: "Team Sports Scientist",        stars: 4.0, experience:  8, performanceBonus: 12, salary: 12000, nationality: "Australia",    age: 33, image: "images/staff/staff_medical_science_02.webp" },
  { id: "scientist_03", name: "Dr. Zandile Mokwena",   specialty: "Team Sports Scientist",        stars: 4.5, experience: 11, performanceBonus: 16, salary: 16500, nationality: "South Africa", age: 36, image: "images/staff/staff_medical_science_03.webp" },
  { id: "scientist_04", name: "Dr. Luca Moretti",      specialty: "Team Sports Scientist",        stars: 4.5, experience:  8, performanceBonus: 14, salary: 14000, nationality: "Italy",        age: 33, image: "images/staff/staff_medical_science_04.webp" },
  { id: "scientist_05", name: "Dr. Marta García",      specialty: "Performance Analyst",          stars: 4.0, experience:  7, performanceBonus: 11, salary: 11000, nationality: "Spain",        age: 31, image: "images/staff/staff_medical_science_05.webp" },
  { id: "scientist_06", name: "Dr. James O'Connor",    specialty: "Performance Specialist",       stars: 4.5, experience:  9, performanceBonus: 15, salary: 15000, nationality: "Australia",    age: 34, image: "images/staff/staff_medical_science_06.webp" },
  { id: "scientist_07", name: "Dr. Takashi Mori",      specialty: "Biomechanics Specialist",      stars: 4.5, experience: 12, performanceBonus: 17, salary: 17500, nationality: "Japan",        age: 38, image: "images/staff/staff_medical_science_07.webp" },
  { id: "scientist_08", name: "Dr. Emily Thompson",    specialty: "Exercise Physiologist",        stars: 4.5, experience:  6, performanceBonus: 13, salary: 13000, nationality: "Canada",       age: 29, image: "images/staff/staff_medical_science_08.webp" },
  { id: "scientist_09", name: "Dr. Larissa Almeida",   specialty: "Human Performance Specialist", stars: 4.5, experience:  5, performanceBonus: 12, salary: 12500, nationality: "Brazil",       age: 28, image: "images/staff/staff_medical_science_09.webp" },
  { id: "scientist_10", name: "Dr. Andrea Bianchi",    specialty: "Data & Analytics Specialist",  stars: 4.5, experience: 14, performanceBonus: 19, salary: 20000, nationality: "Italy",        age: 42, image: "images/staff/staff_medical_science_10.webp" },
] as const;

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
  { id: "doctor_01", name: "Dr. Alessandro Bianchi", specialty: "Team Doctor", stars: 4, experience: 16, recoveryBonus: 14, salary: 18000, contractYears: 2, nationality: "Italy",         age: 42, morale: 85, fatigue: 12, image: "images/staff/staff_medical_doctor_01.webp" },
  { id: "doctor_02", name: "Dr. Sofia Petrova",      specialty: "Team Doctor", stars: 4, experience: 12, recoveryBonus: 12, salary: 14000, contractYears: 3, nationality: "Bulgaria",      age: 38, morale: 88, fatigue:  9, image: "images/staff/staff_medical_doctor_02.webp" },
  { id: "doctor_03", name: "Dr. Hiroshi Tanaka",     specialty: "Team Doctor", stars: 4, experience: 25, recoveryBonus: 18, salary: 24000, contractYears: 1, nationality: "Japan",         age: 51, morale: 80, fatigue: 16, image: "images/staff/staff_medical_doctor_03.webp" },
  { id: "doctor_04", name: "Dr. Anna Kowalska",      specialty: "Team Doctor", stars: 4, experience: 20, recoveryBonus: 16, salary: 20000, contractYears: 2, nationality: "Poland",        age: 46, morale: 83, fatigue: 13, image: "images/staff/staff_medical_doctor_04.webp" },
  { id: "doctor_05", name: "Dr. Karim Hassan",       specialty: "Team Doctor", stars: 4, experience: 30, recoveryBonus: 22, salary: 28000, contractYears: 1, nationality: "Egypt",         age: 57, morale: 78, fatigue: 19, image: "images/staff/staff_medical_doctor_05.webp" },
  { id: "doctor_06", name: "Dr. Sarah Mitchell",     specialty: "Team Doctor", stars: 4, experience: 12, recoveryBonus: 12, salary: 14000, contractYears: 4, nationality: "Australia",     age: 38, morale: 91, fatigue:  7, image: "images/staff/staff_medical_doctor_06.webp" },
  { id: "doctor_07", name: "Dr. James O'Connor",     specialty: "Team Doctor", stars: 4, experience: 19, recoveryBonus: 15, salary: 20000, contractYears: 2, nationality: "Australia",     age: 45, morale: 84, fatigue: 14, image: "images/staff/staff_medical_doctor_07.webp" },
  { id: "doctor_08", name: "Dr. Emily Harrison",     specialty: "Team Doctor", stars: 4, experience: 17, recoveryBonus: 13, salary: 17000, contractYears: 3, nationality: "United Kingdom", age: 43, morale: 86, fatigue: 11, image: "images/staff/staff_medical_doctor_08.webp" },
  { id: "doctor_09", name: "Dr. Priya Sharma",       specialty: "Team Doctor", stars: 4, experience: 13, recoveryBonus: 11, salary: 13000, contractYears: 3, nationality: "India",         age: 39, morale: 87, fatigue: 10, image: "images/staff/staff_medical_doctor_09.webp" },
  { id: "doctor_10", name: "Dr. Michael Anderson",   specialty: "Team Doctor", stars: 4, experience: 28, recoveryBonus: 20, salary: 26000, contractYears: 1, nationality: "USA",           age: 54, morale: 79, fatigue: 17, image: "images/staff/staff_medical_doctor_10.webp" },
] as const;

// Real overallRating comes straight from skillLevel (matches the actual seeded
// roster) rather than a derived bonus formula like the other STAFF_* arrays use.
const STAFF_MASSAGE_THERAPISTS = [
  { id: "massage_01", name: "Yuki Hashimoto",   specialty: "Sports Massage & Deep Tissue",       skillLevel: 90, salary: 78000, nationality: "Japan",        age: 34, image: "images/staff/massage_therapist/staff-01.webp" },
  { id: "massage_02", name: "Camille Dupont",   specialty: "Relaxation & Recovery Massage",      skillLevel: 82, salary: 68000, nationality: "France",       age: 28, image: "images/staff/massage_therapist/staff-02.webp" },
  { id: "massage_03", name: "Amira Osman",      specialty: "Thai Sports Massage",                skillLevel: 85, salary: 72000, nationality: "Sudan",        age: 37, image: "images/staff/massage_therapist/staff-03.webp" },
  { id: "massage_04", name: "Nkechi Eze",       specialty: "Trigger Point & Myofascial Release", skillLevel: 87, salary: 75000, nationality: "Nigeria",      age: 31, image: "images/staff/massage_therapist/staff-04.webp" },
  { id: "massage_05", name: "Lena Bauer",       specialty: "Lymphatic Drainage & Recovery",      skillLevel: 83, salary: 70000, nationality: "Germany",      age: 39, image: "images/staff/massage_therapist/staff-05.webp" },
  { id: "massage_06", name: "Maya Patel",       specialty: "Ayurvedic Sports Massage",           skillLevel: 78, salary: 63000, nationality: "India",        age: 26, image: "images/staff/massage_therapist/staff-06.webp" },
  { id: "massage_07", name: "Ingrid Svensson",  specialty: "Cold & Heat Therapy Massage",        skillLevel: 80, salary: 66000, nationality: "Norway",       age: 43, image: "images/staff/massage_therapist/staff-07.webp" },
  { id: "massage_08", name: "Rosa Gutierrez",   specialty: "Pre-Match Activation Massage",       skillLevel: 76, salary: 61000, nationality: "Peru",         age: 33, image: "images/staff/massage_therapist/staff-08.webp" },
  { id: "massage_09", name: "Ji-Yeon Park",     specialty: "Acupressure & Meridian Therapy",     skillLevel: 81, salary: 67000, nationality: "South Korea",  age: 30, image: "images/staff/massage_therapist/staff-09.webp" },
  { id: "massage_10", name: "Daniela Ferreira", specialty: "Structural Integration & Fascia",    skillLevel: 73, salary: 58000, nationality: "Brazil",       age: 48, image: "images/staff/massage_therapist/staff-10.webp" },
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
  | "sports_scientist"
  | "massage_therapist";

export const MEDICAL_ROLE_LABELS: Record<MedicalRole, string> = {
  team_doctor:        "Team Doctor",
  medical_specialist: "Medical Specialist",
  physiotherapist:    "Physiotherapist",
  nutritionist:       "Nutritionist",
  sports_scientist:   "Sports Scientist",
  massage_therapist:  "Massage Therapist",
};

export const MEDICAL_ROLES: MedicalRole[] = [
  "team_doctor",
  "medical_specialist",
  "physiotherapist",
  "nutritionist",
  "sports_scientist",
  "massage_therapist",
];

/**
 * Every spelling of a medical role, snake_case AND Title Case.
 *
 * Roles are stored Title Case by the seeders and snake_case by the market
 * auto-refill, so any check against MEDICAL_ROLES alone silently matches half
 * the data. Three files kept their own local list and facilities.ts got it
 * wrong: its list was snake_case apart from "Sports Scientist", so of the 60
 * medical staff in the shipped data it classified 10 as medical and scored the
 * other 50 as COACHING — both halves of a club rating that weights staff and
 * medical at 15 each.
 *
 * One exported set so there is nothing to keep in sync.
 */
export const MEDICAL_ROLE_NAMES: ReadonlySet<string> = new Set<string>([
  ...MEDICAL_ROLES,
  "Doctor", "Team Doctor", "Medical Specialist", "Physiotherapist",
  "Nutritionist", "Sports Scientist", "Massage Therapist",
  "sports_chemist", // legacy rows already migrated; guard against stragglers
]);

const ROLE_ATTRIBUTES: Record<MedicalRole, string[]> = {
  team_doctor:        ["Diagnosis Accuracy", "Treatment Efficacy", "Emergency Response"],
  medical_specialist: ["Specialist Knowledge", "Clinical Precision", "Recovery Protocol"],
  physiotherapist:    ["Rehabilitation Skill", "Manual Therapy", "Exercise Prescription"],
  nutritionist:       ["Dietary Planning", "Performance Nutrition", "Supplement Knowledge"],
  sports_scientist:   ["Load Monitoring", "Performance Testing", "Data Analysis"],
  massage_therapist:  ["Deep Tissue Technique", "Muscle Recovery", "Player Care"],
};

const ROLE_TRAITS: Record<MedicalRole, string[]> = {
  team_doctor:        ["Rapid Diagnostician", "Emergency Expert", "Patient Advocate", "Clinical Genius", "Preventive Practitioner"],
  medical_specialist: ["Precision Healer", "Specialist Network", "Complex Case Expert", "Fast Track Recovery", "Evidence-Based Expert"],
  physiotherapist:    ["Rehabilitation Guru", "Hands-On Healer", "Movement Specialist", "Pain Relief Expert", "Functional Recovery Pro"],
  nutritionist:       ["Performance Fueller", "Metabolic Specialist", "Recovery Nutrition Expert", "Anti-Inflammatory Diet", "Hydration Guru"],
  sports_scientist:   ["Data Driven", "Peak Load Expert", "Biomechanics Guru", "Performance Prophet", "Recovery Analyst"],
  massage_therapist:  ["Deep Tissue Master", "Tension Reliever", "Circulation Expert", "Recovery Specialist", "Player Favourite"],
};

const ROLE_SALARY_RANGES: Record<MedicalRole, [number, number]> = {
  team_doctor:        [14000, 34000],
  medical_specialist: [11000, 26000],
  physiotherapist:    [5500, 14000],
  nutritionist:       [4500, 12000],
  sports_scientist:   [9000, 22000],
  massage_therapist:  [58000, 78000],
};

const ROLE_RATING_RANGES: Record<MedicalRole, [number, number]> = {
  team_doctor:        [55, 95],
  medical_specialist: [52, 92],
  physiotherapist:    [48, 88],
  nutritionist:       [46, 85],
  sports_scientist:   [50, 92],
  massage_therapist:  [73, 90],
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

function generateMedicalStaffSpecialist() {
  const s = pick(STAFF_MEDICAL_SPECIALISTS);
  const overallRating = Math.min(95, 48 + Math.round(s.recoveryBonus * 2.1));
  const attrNames = ROLE_ATTRIBUTES["medical_specialist"];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-8, 8);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }
  return {
    name:            s.name,
    role:            "medical_specialist" as MedicalRole,
    specialty:       s.specialty,
    salary:          s.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     s.nationality,
    imageUrl:        `/${s.image}`,
    isAvailable:     true,
    age:             s.age,
    overallRating,
    contractLength:  pick([6, 12, 18, 24] as const),
    coachSpeciality: "Medical",
    personality:     pick(["Precise", "Methodical", "Dedicated", "Evidence-Based", "Compassionate"] as const),
    attributes,
    specialTrait:    pick(ROLE_TRAITS["medical_specialist"]),
    isScoutRevealed: false,
    scoutingRating:  rand(15, 40),
  };
}

function generateMedicalStaffSportsScientist() {
  const s = pick(STAFF_SPORTS_SCIENTISTS);
  const overallRating = Math.min(95, 44 + Math.round(s.performanceBonus * 2.6));
  const attrNames = ROLE_ATTRIBUTES["sports_scientist"];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-8, 8);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }
  return {
    name:            s.name,
    role:            "sports_scientist" as MedicalRole,
    specialty:       s.specialty,
    salary:          s.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     s.nationality,
    imageUrl:        `/${s.image}`,
    isAvailable:     true,
    age:             s.age,
    overallRating,
    contractLength:  pick([6, 12, 18, 24] as const),
    coachSpeciality: "Performance",
    personality:     pick(["Analytical", "Methodical", "Innovative", "Detail-Oriented", "Data-Driven"] as const),
    attributes,
    specialTrait:    pick(ROLE_TRAITS["sports_scientist"]),
    isScoutRevealed: false,
    scoutingRating:  rand(15, 40),
  };
}

function generateMedicalStaffNutritionist() {
  const n = pick(STAFF_NUTRITIONISTS);
  const overallRating = Math.min(95, 42 + Math.round(n.nutritionBonus * 2.4));
  const attrNames = ROLE_ATTRIBUTES["nutritionist"];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-8, 8);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }
  return {
    name:            n.name,
    role:            "nutritionist" as MedicalRole,
    specialty:       n.specialty,
    salary:          n.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     n.nationality,
    imageUrl:        `/${n.image}`,
    isAvailable:     true,
    age:             n.age,
    overallRating,
    contractLength:  pick([6, 12, 18, 24] as const),
    coachSpeciality: "Medical",
    personality:     pick(["Empathetic", "Methodical", "Results-Driven", "Detail-Oriented", "Innovative"] as const),
    attributes,
    specialTrait:    pick(ROLE_TRAITS["nutritionist"]),
    isScoutRevealed: false,
    scoutingRating:  rand(15, 40),
  };
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

function generateMedicalStaffMassageTherapist() {
  const m = pick(STAFF_MASSAGE_THERAPISTS);
  const overallRating = m.skillLevel;
  const attrNames = ROLE_ATTRIBUTES["massage_therapist"];
  const attributes: Record<string, number> = {};
  for (const attr of attrNames) {
    const base = overallRating + rand(-8, 8);
    attributes[attr] = Math.min(99, Math.max(40, base));
  }
  return {
    name:            m.name,
    role:            "massage_therapist" as MedicalRole,
    specialty:       m.specialty,
    salary:          m.salary.toFixed(2),
    skillLevel:      overallRating,
    nationality:     m.nationality,
    imageUrl:        `/${m.image}`,
    isAvailable:     true,
    age:             m.age,
    overallRating,
    contractLength:  pick([6, 12, 18, 24] as const),
    coachSpeciality: "Massage",
    personality:     pick(["Empathetic", "Methodical", "Results-Driven", "Detail-Oriented", "Calming"] as const),
    attributes,
    specialTrait:    pick(ROLE_TRAITS["massage_therapist"]),
    isScoutRevealed: false,
    scoutingRating:  rand(15, 40),
  };
}

export function generateMedicalStaffMember(role: MedicalRole) {
  if (role === "team_doctor") {
    return generateMedicalStaffDoctor();
  }
  if (role === "medical_specialist") {
    return generateMedicalStaffSpecialist();
  }
  if (role === "physiotherapist") {
    return generateMedicalStaffPhysiotherapist();
  }
  if (role === "nutritionist") {
    return generateMedicalStaffNutritionist();
  }
  if (role === "sports_scientist") {
    return generateMedicalStaffSportsScientist();
  }
  if (role === "massage_therapist") {
    return generateMedicalStaffMassageTherapist();
  }

  const exhaustiveCheck: never = role;
  throw new Error(`Unhandled medical role: ${exhaustiveCheck}`);
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
    "sports_scientist", "sports_scientist", "sports_scientist",
    "massage_therapist", "massage_therapist", "massage_therapist",
  ];

  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(generateMedicalStaffMember(pick(roles)));
  }
  return result;
}
