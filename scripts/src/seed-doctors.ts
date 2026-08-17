/**
 * Replaces all existing Doctors with the real 10 from card images.
 * Run: pnpm --filter @workspace/scripts run seed-doctors
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { staffTable, trainingSessionsTable, continentalScoutingMissionsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, "../../");
const SIDECAR = "http://127.0.0.1:1106";
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR!;

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as object,
  projectId: "",
});

async function upload(localFile: string, entityId: string): Promise<string> {
  const privateDir = PRIVATE_OBJECT_DIR.endsWith("/") ? PRIVATE_OBJECT_DIR : `${PRIVATE_OBJECT_DIR}/`;
  const parts = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const slashIdx = parts.indexOf("/");
  const bucketName = slashIdx === -1 ? parts.replace(/\/$/, "") : parts.slice(0, slashIdx);
  const prefix = slashIdx === -1 ? "" : parts.slice(slashIdx + 1);
  await gcs.bucket(bucketName).file(`${prefix}${entityId}`).save(readFileSync(localFile), {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return `/objects/${entityId}`;
}

// All 10 cards are ★4. Skill calibrated by experience.
function skillFromExp(exp: number): number {
  return Math.min(94, 78 + Math.round(exp * 0.55));
}
function salaryFromExp(exp: number): number {
  return Math.round((5500 + exp * 80) / 100) * 100;
}

// Doctor attributes: all ★4, adjusted by specialty/experience
function attrs(
  exp: number,
  overrides: Partial<Record<"injuryDiagnosis"|"injuryRecovery"|"playerHealth"|"emergencyCare"|"fatigueManagement"|"rehabilitationSupport"|"medicalKnowledge"|"professionalism", number>>
) {
  const base = 75 + Math.round(exp * 0.5);
  return {
    injuryDiagnosis:       overrides.injuryDiagnosis       ?? Math.min(94, base + 2),
    injuryRecovery:        overrides.injuryRecovery         ?? Math.min(92, base),
    playerHealth:          overrides.playerHealth           ?? Math.min(92, base + 1),
    emergencyCare:         overrides.emergencyCare          ?? Math.min(90, base - 1),
    fatigueManagement:     overrides.fatigueManagement      ?? Math.min(90, base),
    rehabilitationSupport: overrides.rehabilitationSupport  ?? Math.min(90, base - 2),
    medicalKnowledge:      overrides.medicalKnowledge       ?? Math.min(94, base + 3),
    professionalism:       overrides.professionalism        ?? Math.min(94, base + 2),
  };
}

const DOCTORS = [
  {
    name: "Dr. Alessandro Bianchi", nationality: "Italian", gender: "Male",
    age: 42, stars: 4, experienceYears: 15,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Injury Diagnosis", "Athlete Health Management"],
    description: "An experienced Italian team doctor with 15 years on the elite circuit. Dr. Bianchi is known for his rapid and accurate injury diagnosis and comprehensive athlete health programmes.",
    attributes: attrs(15, { injuryDiagnosis: 90, medicalKnowledge: 92 }),
    imageFile: "staff_medical_doctor_01_1783428250581.webp", slot: "staff-01",
  },
  {
    name: "Dr. Sofia Petrova", nationality: "Bulgarian", gender: "Female",
    age: 38, stars: 4, experienceYears: 12,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Fatigue Management", "Player Wellness"],
    description: "A sharp Bulgarian team doctor with 12 years of elite sports experience. Dr. Petrova specialises in fatigue management and the long-term wellness of beach volleyball athletes.",
    attributes: attrs(12, { fatigueManagement: 90, playerHealth: 89 }),
    imageFile: "staff_medical_doctor_02_1783428260713.webp", slot: "staff-02",
  },
  {
    name: "Dr. Hiroshi Tanaka", nationality: "Japanese", gender: "Male",
    age: 51, stars: 4, experienceYears: 20,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Medical Knowledge", "Injury Rehabilitation"],
    description: "A highly respected Japanese team doctor with two decades at the top of elite sport. Dr. Tanaka's encyclopaedic medical knowledge and calm approach make him a cornerstone of any medical team.",
    attributes: attrs(20, { medicalKnowledge: 94, injuryRecovery: 91, professionalism: 93 }),
    imageFile: "staff_medical_doctor_03_1783428264232.webp", slot: "staff-03",
  },
  {
    name: "Dr. Anna Kowalska", nationality: "Polish", gender: "Female",
    age: 46, stars: 4, experienceYears: 18,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Rehabilitation Support", "Emergency Care"],
    description: "A distinguished Polish team doctor with 18 years in elite sport. Dr. Kowalska excels in rehabilitation support and is one of the most reliable emergency care practitioners on the tour.",
    attributes: attrs(18, { rehabilitationSupport: 93, emergencyCare: 92, professionalism: 93 }),
    imageFile: "staff_medical_doctor_04_1783428268278.webp", slot: "staff-04",
  },
  {
    name: "Dr. Karim Hassan", nationality: "Egyptian", gender: "Male",
    age: 57, stars: 4, experienceYears: 25,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Chronic Injury Management", "Athlete Longevity"],
    description: "One of the most experienced team doctors in the game with 25 years of elite service. Dr. Hassan's expertise in chronic injury management and athlete longevity is unparalleled.",
    attributes: attrs(25, { injuryDiagnosis: 94, medicalKnowledge: 95, professionalism: 95, playerHealth: 93 }),
    imageFile: "staff_medical_doctor_05_1783428289569.webp", slot: "staff-05",
  },
  {
    name: "Dr. Sarah Mitchell", nationality: "Australian", gender: "Female",
    age: 38, stars: 4, experienceYears: 12,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Player Health Monitoring", "Fatigue Recovery"],
    description: "An energetic Australian team doctor with 12 years on the World Tour. Dr. Mitchell is lauded for her player health monitoring systems and proactive approach to fatigue recovery.",
    attributes: attrs(12, { playerHealth: 90, fatigueManagement: 89 }),
    imageFile: "staff_medical_doctor_06_1783428292716.webp", slot: "staff-06",
  },
  {
    name: "Dr. James O'Connor", nationality: "Australian", gender: "Male",
    age: 45, stars: 4, experienceYears: 17,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Emergency Care", "Injury Diagnosis"],
    description: "A dependable Australian team doctor with 17 years of elite experience. Dr. O'Connor is highly regarded for his composure in emergency situations and precise injury diagnosis.",
    attributes: attrs(17, { emergencyCare: 92, injuryDiagnosis: 91 }),
    imageFile: "staff_medical_doctor_07_1783428305309.webp", slot: "staff-07",
  },
  {
    name: "Dr. Emily Harrison", nationality: "British", gender: "Female",
    age: 43, stars: 4, experienceYears: 14,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Medical Knowledge", "Rehabilitation Support"],
    description: "A highly competent British team doctor with 14 years at elite level. Dr. Harrison brings strong medical knowledge and a methodical approach to rehabilitation support.",
    attributes: attrs(14, { medicalKnowledge: 91, rehabilitationSupport: 90 }),
    imageFile: "staff_medical_doctor_08_1783428307486.webp", slot: "staff-08",
  },
  {
    name: "Dr. Priya Sharma", nationality: "Indian", gender: "Female",
    age: 39, stars: 4, experienceYears: 11,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Player Wellness", "Injury Recovery"],
    description: "An engaging and dedicated Indian team doctor with 11 years in elite sport. Dr. Sharma's warm player-centric approach and strong diagnostic skills make her a favourite among athletes.",
    attributes: attrs(11, { playerHealth: 88, injuryRecovery: 87 }),
    imageFile: "staff_medical_doctor_09_1783428316377.webp", slot: "staff-09",
  },
  {
    name: "Dr. Michael Anderson", nationality: "American", gender: "Male",
    age: 54, stars: 4, experienceYears: 22,
    specialty: "Team Doctor",
    coachSpeciality: "Sports Medicine",
    specialties: ["Sports Medicine", "Fatigue Management", "Athlete Health Management"],
    description: "A highly experienced American team doctor with 22 years in professional sport. Dr. Anderson's deep understanding of fatigue management and athlete health makes him a senior presence in any medical staff.",
    attributes: attrs(22, { fatigueManagement: 93, playerHealth: 92, medicalKnowledge: 93, professionalism: 94 }),
    imageFile: "staff_medical_doctor_10_1783428318510.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("Removing existing Doctors...");
  const existing = await db
    .select({ id: staffTable.id, name: staffTable.name })
    .from(staffTable)
    .where(eq(staffTable.role, "Doctor"));

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    await db.update(trainingSessionsTable).set({ coachId: null }).where(inArray(trainingSessionsTable.coachId, ids));
    await db.update(continentalScoutingMissionsTable).set({ assignedStaffId: null }).where(inArray(continentalScoutingMissionsTable.assignedStaffId, ids));
    await db.delete(staffTable).where(inArray(staffTable.id, ids));
    console.log(`  deleted ${ids.length} rows.\n`);
  }

  for (const [i, d] of DOCTORS.entries()) {
    const skill = skillFromExp(d.experienceYears);
    const salary = salaryFromExp(d.experienceYears);
    console.log(`[${i + 1}/10] ${d.name} (${d.nationality}, ★${d.stars}, ${d.experienceYears} yrs) — skill ${skill}`);

    const imageUrl = await upload(
      resolve(WORKSPACE_ROOT, "attached_assets", d.imageFile),
      `staff/medical_doctor/${d.slot}.webp`,
    );

    await db.insert(staffTable).values({
      name:            d.name,
      role:            "Doctor",
      specialty:       d.specialty,
      age:             d.age,
      nationality:     d.nationality,
      salary,
      skillLevel:      skill,
      overallRating:   skill,
      contractLength:  12,
      coachSpeciality: d.coachSpeciality,
      personality:     "Caring",
      specialTrait:    d.specialties[0],
      attributes: {
        schema:           "beach_volleyball_staff",
        version:          "1.0",
        staffType:        "Doctor",
        regenerationSeed: "BVM_DOCTOR_V1_2026_07_07",
        nationality:      d.nationality,
        age:              d.age,
        gender:           d.gender,
        stars:            d.stars,
        experienceYears:  d.experienceYears,
        salary,
        specialties:      d.specialties,
        description:      d.description,
        ...d.attributes,
      },
      imageUrl,
      isAvailable:     true,
      isScoutRevealed: false,
      scoutingRating:  skill - 5,
    });

    console.log(`  ✓ inserted → ${imageUrl}`);
  }

  const final = await db
    .select({ name: staffTable.name, skill: staffTable.skillLevel })
    .from(staffTable)
    .where(eq(staffTable.role, "Doctor"));

  console.log(`\nDone — ${final.length} Doctors now in DB:`);
  final.forEach((r) => console.log(`  ${r.name} (skill ${r.skill})`));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
