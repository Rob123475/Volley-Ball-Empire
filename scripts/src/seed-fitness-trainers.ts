/**
 * Replaces all existing Fitness Trainers with real card data.
 * Run: pnpm --filter @workspace/scripts run seed-fitness-trainers
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

const SEED = "BVM_FITNESS_TRAINER_V2_2026_07_07";

const TRAINERS = [
  {
    name: "Lucas Anderson",
    nationality: "Australian", gender: "Male",
    age: 32, stars: 4.5, experienceYears: 8,
    description: "An elite Australian fitness trainer who combines strength programming with injury prevention science. Lucas Anderson's athletes consistently maintain peak physical condition throughout the gruelling World Tour season.",
    specialty: "Strength & Conditioning",
    specialties: ["Strength & Conditioning", "Injury Prevention", "Mobility & Flexibility"],
    skillLevel: 88, salary: 13000, contractYears: 3,
    personality: { leadership: 82, discipline: 86, communication: 84, adaptability: 80, professionalism: 86 },
    attributes: { strengthTraining: 90, speedDevelopment: 86, agilityTraining: 84, conditioning: 91, endurance: 85, explosivePower: 88, recoveryPlanning: 87, motivation: 85 },
    imageFile: "staff_fitness_trainer_01_1783429686456.webp", slot: "staff-01",
  },
  {
    name: "Lauren Johnson",
    nationality: "American", gender: "Female",
    age: 27, stars: 2, experienceYears: 5,
    description: "A young American fitness trainer who is still finding her footing on the World Tour. Lauren Johnson brings enthusiasm and modern training methods but lacks the elite experience needed for consistent top-level results.",
    specialty: "Strength Training",
    specialties: ["Strength Training", "Nutrition Coaching", "Performance Optimization"],
    skillLevel: 55, salary: 3200, contractYears: 1,
    personality: { leadership: 56, discipline: 60, communication: 62, adaptability: 65, professionalism: 58 },
    attributes: { strengthTraining: 58, speedDevelopment: 54, agilityTraining: 56, conditioning: 57, endurance: 55, explosivePower: 53, recoveryPlanning: 54, motivation: 62 },
    imageFile: "staff_fitness_trainer_02_1783429688337.webp", slot: "staff-02",
  },
  {
    name: "Emily Carter",
    nationality: "Australian", gender: "Female",
    age: 32, stars: 4, experienceYears: 6,
    description: "A well-rounded Australian fitness trainer known for her comprehensive approach to physical preparation. Emily Carter's strength and flexibility programmes have helped several athletes extend their careers on the World Tour.",
    specialty: "Strength Training",
    specialties: ["Strength Training", "Conditioning", "Flexibility & Mobility"],
    skillLevel: 80, salary: 8500, contractYears: 2,
    personality: { leadership: 74, discipline: 78, communication: 76, adaptability: 74, professionalism: 78 },
    attributes: { strengthTraining: 82, speedDevelopment: 76, agilityTraining: 79, conditioning: 81, endurance: 78, explosivePower: 77, recoveryPlanning: 80, motivation: 76 },
    imageFile: "staff_fitness_trainer_03_1783429690444.webp", slot: "staff-03",
  },
  {
    name: "Sofia Bianchi",
    nationality: "Italian", gender: "Female",
    age: 29, stars: 4, experienceYears: 4,
    description: "An Italian fitness trainer who has quickly built a reputation for innovative HIIT protocols and core strength development. Sofia Bianchi's recovery and rehabilitation programmes keep athletes in peak condition across long tournament runs.",
    specialty: "HIIT Training",
    specialties: ["HIIT Training", "Core Strength", "Recovery & Rehab"],
    skillLevel: 78, salary: 7500, contractYears: 2,
    personality: { leadership: 72, discipline: 80, communication: 74, adaptability: 76, professionalism: 76 },
    attributes: { strengthTraining: 78, speedDevelopment: 80, agilityTraining: 82, conditioning: 78, endurance: 76, explosivePower: 80, recoveryPlanning: 79, motivation: 78 },
    imageFile: "staff_fitness_trainer_04_1783429692695.webp", slot: "staff-04",
  },
  {
    name: "Mateo Gonzalez",
    nationality: "Argentinian", gender: "Male",
    age: 33, stars: 4, experienceYears: 7,
    description: "A passionate Argentinian fitness trainer who integrates strength science with sports nutrition to maximise athletic performance. Mateo Gonzalez is respected for his ability to build explosive, injury-resistant athletes.",
    specialty: "Strength & Conditioning",
    specialties: ["Strength & Conditioning", "Sports Nutrition", "Athletic Performance"],
    skillLevel: 80, salary: 8500, contractYears: 2,
    personality: { leadership: 78, discipline: 80, communication: 76, adaptability: 74, professionalism: 78 },
    attributes: { strengthTraining: 82, speedDevelopment: 78, agilityTraining: 76, conditioning: 80, endurance: 78, explosivePower: 84, recoveryPlanning: 76, motivation: 82 },
    imageFile: "staff_fitness_trainer_05_1783429694439.webp", slot: "staff-05",
  },
  {
    name: "Lucía Martínez",
    nationality: "Spanish", gender: "Female",
    age: 28, stars: 4, experienceYears: 5,
    description: "A Spanish fitness trainer who specialises in mobility-focused strength work and functional performance testing. Lucía Martínez's holistic approach to physical preparation has made her a sought-after conditioner on the European circuit.",
    specialty: "Strength Training",
    specialties: ["Strength Training", "Mobility & Flexibility", "Performance Testing"],
    skillLevel: 78, salary: 7500, contractYears: 2,
    personality: { leadership: 72, discipline: 76, communication: 78, adaptability: 78, professionalism: 76 },
    attributes: { strengthTraining: 79, speedDevelopment: 76, agilityTraining: 80, conditioning: 78, endurance: 76, explosivePower: 75, recoveryPlanning: 78, motivation: 76 },
    imageFile: "staff_fitness_trainer_06_1783429696134.webp", slot: "staff-06",
  },
  {
    name: "Natalie Thompson",
    nationality: "Canadian", gender: "Female",
    age: 34, stars: 4, experienceYears: 8,
    description: "A Canadian fitness trainer who brings a complete physical development package to any team. Natalie Thompson's strength and nutrition expertise, combined with her rehabilitation knowledge, makes her one of the most versatile conditioners on tour.",
    specialty: "Strength & Conditioning",
    specialties: ["Strength & Conditioning", "Sports Nutrition", "Rehabilitation"],
    skillLevel: 80, salary: 8500, contractYears: 2,
    personality: { leadership: 76, discipline: 82, communication: 78, adaptability: 74, professionalism: 80 },
    attributes: { strengthTraining: 81, speedDevelopment: 76, agilityTraining: 77, conditioning: 82, endurance: 80, explosivePower: 76, recoveryPlanning: 82, motivation: 79 },
    imageFile: "staff_fitness_trainer_07_1783429698345.webp", slot: "staff-07",
  },
  {
    name: "Isabella Rodriguez",
    nationality: "Brazilian", gender: "Female",
    age: 30, stars: 4, experienceYears: 6,
    description: "A Brazilian fitness trainer who combines her country's tradition of athletic dynamism with modern strength science. Isabella Rodriguez excels at building fast, mobile athletes who can sustain high-intensity output throughout long tournaments.",
    specialty: "Strength Training",
    specialties: ["Strength Training", "Sports Nutrition", "Mobility & Flexibility"],
    skillLevel: 79, salary: 8000, contractYears: 2,
    personality: { leadership: 74, discipline: 78, communication: 76, adaptability: 76, professionalism: 76 },
    attributes: { strengthTraining: 80, speedDevelopment: 78, agilityTraining: 80, conditioning: 79, endurance: 78, explosivePower: 80, recoveryPlanning: 76, motivation: 80 },
    imageFile: "staff_fitness_trainer_08_1783429700446.webp", slot: "staff-08",
  },
  {
    name: "Eleni Papadopoulos",
    nationality: "Greek", gender: "Female",
    age: 32, stars: 4, experienceYears: 7,
    description: "A Greek fitness trainer whose meticulous approach to strength programming and recovery planning has earned her strong reviews on the World Tour. Eleni Papadopoulos is known for tailoring her programmes precisely to each athlete's needs.",
    specialty: "Strength Training",
    specialties: ["Strength Training", "Flexibility & Mobility", "Recovery & Rehab"],
    skillLevel: 79, salary: 8000, contractYears: 2,
    personality: { leadership: 74, discipline: 80, communication: 76, adaptability: 76, professionalism: 78 },
    attributes: { strengthTraining: 80, speedDevelopment: 76, agilityTraining: 78, conditioning: 79, endurance: 78, explosivePower: 76, recoveryPlanning: 82, motivation: 77 },
    imageFile: "staff_fitness_trainer_09_1783429702508.webp", slot: "staff-09",
  },
  {
    name: "Sophie Martin",
    nationality: "French", gender: "Female",
    age: 28, stars: 4, experienceYears: 5,
    description: "A French fitness trainer who brings a disciplined, science-based approach to physical conditioning. Sophie Martin's structured strength and nutrition programmes have helped emerging athletes make the step up to consistent World Tour performance.",
    specialty: "Strength Training",
    specialties: ["Strength Training", "Conditioning", "Sports Nutrition"],
    skillLevel: 78, salary: 7500, contractYears: 2,
    personality: { leadership: 72, discipline: 78, communication: 74, adaptability: 72, professionalism: 76 },
    attributes: { strengthTraining: 79, speedDevelopment: 74, agilityTraining: 76, conditioning: 80, endurance: 77, explosivePower: 74, recoveryPlanning: 76, motivation: 74 },
    imageFile: "staff_fitness_trainer_10_1783429749201.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("=== Seed Fitness Trainers ===\n");

  console.log("Deleting existing fitness trainers...");
  await db.delete(staffTable).where(eq(staffTable.role, "Fitness Trainer"));
  console.log("  Deleted.\n");

  const now = new Date().toISOString();

  for (const [i, t] of TRAINERS.entries()) {
    const gcsPath = `staff/fitness_trainer/${t.slot}.webp`;
    console.log(`[${i + 1}/10] ${t.name}`);
    const imageUrl = await upload(resolve(WORKSPACE_ROOT, "attached_assets", t.imageFile), gcsPath);
    console.log(`  ✓ Image → ${imageUrl}`);

    await db.insert(staffTable).values({
      name: t.name,
      role: "Fitness Trainer",
      nationality: t.nationality,
      baseAge: t.age,
      skillLevel: t.skillLevel,
      baseSalary: t.salary,
      imageUrl,
      attributes: {
        regenerationSeed: SEED,
        gender: t.gender,
        contractYears: t.contractYears,
        stars: t.stars,
        experienceYears: t.experienceYears,
        specialty: t.specialty,
        specialties: t.specialties,
        description: t.description,
        personality: t.personality,
        fitnessAttributes: t.attributes,
        availability: { injured: false, suspended: false, available: true },
        career: { club: "", yearsAtClub: 0, careerAchievements: [] },
        metadata: { created: now, lastModified: now, notes: "" },
      },
    });
    console.log(`  ✓ DB row inserted (skill: ${t.skillLevel}, ★${t.stars})`);
  }

  console.log("\n=== Done — 10 fitness trainers seeded. ===");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
