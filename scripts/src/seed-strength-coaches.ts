/**
 * Replaces all existing Strength Coaches with real card data.
 * Run: pnpm --filter @workspace/scripts run seed-strength-coaches
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

const SEED = "BVM_STRENGTH_AND_CONDITIONING_COACH_V2_2026_07_07";

// All ★4 — skill calibrated by experience years
const COACHES = [
  {
    name: "Alexander Reed",
    nationality: "American", gender: "Male",
    age: 48, stars: 4, experienceYears: 18,
    description: "The most experienced strength coach in the pool, Alexander Reed has spent 18 years building championship-level physical foundations for elite beach volleyball athletes. His programme design philosophy integrates power, conditioning, and injury prevention in a system that consistently produces peak performers.",
    specialties: ["Strength Training", "Power Development", "Program Design"],
    skillLevel: 86, salary: 15000, contractYears: 3,
    personality: { leadership: 84, discipline: 90, communication: 80, adaptability: 78, professionalism: 88 },
    attributes: { strengthDevelopment: 90, powerTraining: 88, explosiveMovement: 84, conditioning: 86, speedDevelopment: 80, injuryPrevention: 86, periodisation: 88, athleticPerformance: 88 },
    imageFile: "staff_strength_conditioner_01_1783430103742.webp", slot: "staff-01",
  },
  {
    name: "Siate Toketau",
    nationality: "Tongan", gender: "Male",
    age: 36, stars: 4, experienceYears: 12,
    description: "A Tongan strength and conditioning coach whose imposing physical presence is matched by a deep technical understanding of power development. Siate Toketau has built a reputation on the World Tour for transforming athletic potential into explosive competitive performance.",
    specialties: ["Strength Training", "Power Development", "Athlete Performance"],
    skillLevel: 82, salary: 11000, contractYears: 2,
    personality: { leadership: 80, discipline: 86, communication: 74, adaptability: 76, professionalism: 82 },
    attributes: { strengthDevelopment: 86, powerTraining: 86, explosiveMovement: 82, conditioning: 82, speedDevelopment: 78, injuryPrevention: 80, periodisation: 80, athleticPerformance: 84 },
    imageFile: "staff_strength_conditioner_02_1783430106526.webp", slot: "staff-02",
  },
  {
    name: "Rafael Oliveira",
    nationality: "Brazilian", gender: "Male",
    age: 34, stars: 4, experienceYears: 9,
    description: "A Brazilian strength coach who blends South American athleticism philosophy with European periodisation methods. Rafael Oliveira is known for his ability to rapidly develop conditioning levels and bring players to physical peak at tournament time.",
    specialties: ["Strength Training", "Power Development", "Athlete Performance"],
    skillLevel: 80, salary: 10000, contractYears: 2,
    personality: { leadership: 78, discipline: 82, communication: 80, adaptability: 82, professionalism: 80 },
    attributes: { strengthDevelopment: 82, powerTraining: 82, explosiveMovement: 80, conditioning: 82, speedDevelopment: 80, injuryPrevention: 78, periodisation: 78, athleticPerformance: 82 },
    imageFile: "staff_strength_conditioner_03_1783430109739.webp", slot: "staff-03",
  },
  {
    name: "Emily Harrison",
    nationality: "Canadian", gender: "Female",
    age: 31, stars: 4, experienceYears: 7,
    description: "A Canadian strength and conditioning coach who brings a holistic approach to athlete preparation. Emily Harrison integrates strength work with mobility, recovery protocols, and nutrition support to ensure players perform at their physical best across the full competitive season.",
    specialties: ["Strength Training", "Mobility & Recovery", "Nutrition Support"],
    skillLevel: 79, salary: 9500, contractYears: 2,
    personality: { leadership: 76, discipline: 80, communication: 84, adaptability: 82, professionalism: 82 },
    attributes: { strengthDevelopment: 80, powerTraining: 78, explosiveMovement: 76, conditioning: 80, speedDevelopment: 76, injuryPrevention: 84, periodisation: 78, athleticPerformance: 80 },
    imageFile: "staff_strength_conditioner_04_1783430112804.webp", slot: "staff-04",
  },
  {
    name: "Leilani Kalei",
    nationality: "American", gender: "Female",
    age: 28, stars: 4, experienceYears: 6,
    description: "A Hawaiian-born strength coach who specialises in explosive movement and speed and agility development. Leilani Kalei brings a background in Pacific Islander athletic traditions and modern sports science, with a particular talent for movement optimisation and rehabilitation protocols.",
    specialties: ["Explosive Power", "Speed & Agility", "Movement Optimization"],
    skillLevel: 78, salary: 9000, contractYears: 1,
    personality: { leadership: 74, discipline: 78, communication: 82, adaptability: 86, professionalism: 78 },
    attributes: { strengthDevelopment: 78, powerTraining: 80, explosiveMovement: 86, conditioning: 78, speedDevelopment: 86, injuryPrevention: 80, periodisation: 74, athleticPerformance: 82 },
    imageFile: "staff_strength_conditioner_05_1783430126611.webp", slot: "staff-05",
  },
  {
    name: "Sofie Larsen",
    nationality: "Danish", gender: "Female",
    age: 27, stars: 4, experienceYears: 5,
    description: "One of the youngest professionals in the pool, Sofie Larsen is a Danish strength coach who has rapidly made her mark with elite-level performance analytics and a focus on core stability and injury prevention. Her data-driven approach has drawn attention from some of the Tour's top clubs.",
    specialties: ["Core Stability", "Injury Prevention", "Performance Analytics"],
    skillLevel: 78, salary: 8500, contractYears: 1,
    personality: { leadership: 72, discipline: 82, communication: 78, adaptability: 84, professionalism: 82 },
    attributes: { strengthDevelopment: 78, powerTraining: 76, explosiveMovement: 74, conditioning: 78, speedDevelopment: 74, injuryPrevention: 84, periodisation: 78, athleticPerformance: 78 },
    imageFile: "staff_strength_conditioner_06_1783430128939.webp", slot: "staff-06",
  },
  {
    name: "Maria González",
    nationality: "Spanish", gender: "Female",
    age: 33, stars: 4, experienceYears: 8,
    description: "A Spanish strength and conditioning coach whose comprehensive approach encompasses movement efficiency, sports nutrition, and recovery optimisation alongside traditional strength programming. Maria González is widely regarded as one of the most well-rounded physical performance specialists on the Tour.",
    specialties: ["Power Development", "Movement Efficiency", "Recovery Optimization"],
    skillLevel: 80, salary: 10000, contractYears: 2,
    personality: { leadership: 78, discipline: 82, communication: 82, adaptability: 80, professionalism: 84 },
    attributes: { strengthDevelopment: 80, powerTraining: 82, explosiveMovement: 78, conditioning: 82, speedDevelopment: 78, injuryPrevention: 82, periodisation: 80, athleticPerformance: 82 },
    imageFile: "staff_strength_conditioner_07_1783430131345.webp", slot: "staff-07",
  },
  {
    name: "James Morrison",
    nationality: "Australian", gender: "Male",
    age: 38, stars: 4, experienceYears: 13,
    description: "An Australian strength and conditioning coach with 13 years of high-performance experience across beach volleyball and other elite sports. James Morrison is known for producing exceptional speed and agility gains without compromising injury prevention protocols.",
    specialties: ["Strength Training", "Speed & Agility", "Athlete Performance"],
    skillLevel: 83, salary: 12000, contractYears: 2,
    personality: { leadership: 82, discipline: 84, communication: 78, adaptability: 78, professionalism: 84 },
    attributes: { strengthDevelopment: 84, powerTraining: 84, explosiveMovement: 82, conditioning: 84, speedDevelopment: 86, injuryPrevention: 82, periodisation: 82, athleticPerformance: 86 },
    imageFile: "staff_strength_conditioner_08_1783430134758.webp", slot: "staff-08",
  },
  {
    name: "Darius Coleman",
    nationality: "American", gender: "Male",
    age: 32, stars: 4, experienceYears: 9,
    description: "An American strength coach who combines explosive power training with a sophisticated understanding of athlete nutrition strategy and performance analytics. Darius Coleman's ability to identify and close physical performance gaps makes him a sought-after specialist on the World Tour.",
    specialties: ["Explosive Power", "Nutrition Strategy", "Performance Analytics"],
    skillLevel: 80, salary: 10000, contractYears: 2,
    personality: { leadership: 76, discipline: 84, communication: 80, adaptability: 82, professionalism: 82 },
    attributes: { strengthDevelopment: 80, powerTraining: 82, explosiveMovement: 84, conditioning: 80, speedDevelopment: 80, injuryPrevention: 78, periodisation: 78, athleticPerformance: 82 },
    imageFile: "staff_strength_conditioner_09_1783430179245.webp", slot: "staff-09",
  },
  {
    name: "Renato Araújo",
    nationality: "Brazilian", gender: "Male",
    age: 35, stars: 4, experienceYears: 10,
    description: "A Brazilian strength and conditioning specialist with a decade of World Tour experience and a particular focus on injury prevention, recovery, and rehabilitation. Renato Araújo has earned a reputation for extending athlete careers through meticulous physical management and progressive load programming.",
    specialties: ["Power Development", "Injury Prevention", "Recovery & Rehab"],
    skillLevel: 82, salary: 11000, contractYears: 2,
    personality: { leadership: 78, discipline: 84, communication: 78, adaptability: 80, professionalism: 84 },
    attributes: { strengthDevelopment: 82, powerTraining: 82, explosiveMovement: 78, conditioning: 84, speedDevelopment: 76, injuryPrevention: 88, periodisation: 82, athleticPerformance: 84 },
    imageFile: "staff_strength_conditioner_10_1783430176647.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("=== Seed Strength Coaches ===\n");

  console.log("Deleting existing strength coaches...");
  await db.delete(staffTable).where(eq(staffTable.role, "Strength Coach"));
  console.log("  Deleted.\n");

  const now = new Date().toISOString();

  for (const [i, c] of COACHES.entries()) {
    const gcsPath = `staff/strength_coach/${c.slot}.webp`;
    console.log(`[${i + 1}/10] ${c.name}`);
    const imageUrl = await upload(resolve(WORKSPACE_ROOT, "attached_assets", c.imageFile), gcsPath);
    console.log(`  ✓ Image → ${imageUrl}`);

    await db.insert(staffTable).values({
      name: c.name,
      role: "Strength Coach",
      nationality: c.nationality,
      gender: c.gender,
      age: c.age,
      skillLevel: c.skillLevel,
      salary: c.salary,
      contractYears: c.contractYears,
      imageUrl,
      attributes: {
        regenerationSeed: SEED,
        stars: c.stars,
        experienceYears: c.experienceYears,
        specialties: c.specialties,
        description: c.description,
        personality: c.personality,
        strengthConditioningAttributes: c.attributes,
        availability: { injured: false, suspended: false, available: true },
        career: { club: "", yearsAtClub: 0, careerAchievements: [] },
        metadata: { created: now, lastModified: now, notes: "" },
      },
    });
    console.log(`  ✓ DB row inserted (skill: ${c.skillLevel}, ★${c.stars})`);
  }

  console.log("\n=== Done — 10 strength coaches seeded. ===");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
