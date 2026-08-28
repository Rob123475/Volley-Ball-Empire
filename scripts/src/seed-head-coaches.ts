/**
 * Replaces all existing Head Coaches with real card data.
 * Run: pnpm --filter @workspace/scripts run seed-head-coaches
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

const SEED = "BVM_HEAD_COACH_V2_2026_07_07";

// star → skill: ★3 ~64-68, ★4 ~82-85, ★4.5 ~90
const COACHES = [
  {
    name: "James Whitmore",
    nationality: "Australian", gender: "Male",
    age: 41, stars: 4, experienceYears: 15,
    description: "A commanding Australian head coach with 15 years of World Tour experience. James Whitmore is renowned for building elite tactical structures and instilling a culture of relentless performance standards in every squad he leads.",
    specialties: ["Leadership", "Strategy", "Elite Performance"],
    skillLevel: 84, salary: 18000, contractYears: 3,
    personality: { leadership: 86, discipline: 82, communication: 84, adaptability: 80, professionalism: 86 },
    attributes: { leadership: 87, technicalCoaching: 83, tacticalKnowledge: 86, playerDevelopment: 80, matchManagement: 85, trainingPlanning: 84, motivation: 82, recruitment: 78 },
    imageFile: "staff_head_coach_01_1783429917929.webp", slot: "staff-01",
  },
  {
    name: "Marco Ricci",
    nationality: "Italian", gender: "Male",
    age: 52, stars: 4, experienceYears: 21,
    description: "A veteran Italian head coach whose tactical sophistication has been forged over two decades on the World Tour. Marco Ricci combines deep strategic knowledge with the ability to command respect from even the most experienced athletes.",
    specialties: ["Leadership", "Strategy", "Elite Performance"],
    skillLevel: 85, salary: 18500, contractYears: 3,
    personality: { leadership: 88, discipline: 84, communication: 82, adaptability: 76, professionalism: 88 },
    attributes: { leadership: 88, technicalCoaching: 84, tacticalKnowledge: 88, playerDevelopment: 82, matchManagement: 87, trainingPlanning: 85, motivation: 80, recruitment: 80 },
    imageFile: "staff_head_coach_02_1783429919663.webp", slot: "staff-02",
  },
  {
    name: "Tomasz Kowalski",
    nationality: "Polish", gender: "Male",
    age: 45, stars: 3, experienceYears: 17,
    description: "A Polish head coach with a deep tactical mind and a proven record in player development. Tomasz Kowalski is respected for his ability to read the game and build cohesive systems, though his inconsistency in high-pressure moments has limited his top-level success.",
    specialties: ["Tactical Expert", "Game Intelligence", "Player Development"],
    skillLevel: 68, salary: 9000, contractYears: 2,
    personality: { leadership: 70, discipline: 74, communication: 68, adaptability: 72, professionalism: 74 },
    attributes: { leadership: 68, technicalCoaching: 70, tacticalKnowledge: 74, playerDevelopment: 72, matchManagement: 66, trainingPlanning: 70, motivation: 66, recruitment: 62 },
    imageFile: "staff_head_coach_03_1783429939187.webp", slot: "staff-03",
  },
  {
    name: "Sarah Mitchell",
    nationality: "New Zealander", gender: "Female",
    age: 45, stars: 3, experienceYears: 12,
    description: "A New Zealand head coach who has built her reputation on motivating players and developing game intelligence across her squads. Sarah Mitchell's supportive leadership style creates strong team environments but she is still developing her elite tactical credentials.",
    specialties: ["Development", "Motivation", "Game Intelligence"],
    skillLevel: 65, salary: 8000, contractYears: 2,
    personality: { leadership: 68, discipline: 66, communication: 76, adaptability: 70, professionalism: 70 },
    attributes: { leadership: 66, technicalCoaching: 64, tacticalKnowledge: 66, playerDevelopment: 72, matchManagement: 62, trainingPlanning: 64, motivation: 76, recruitment: 60 },
    imageFile: "staff_head_coach_04_1783429946957.webp", slot: "staff-04",
  },
  {
    name: "Daniel Persson",
    nationality: "Swedish", gender: "Male",
    age: 38, stars: 3, experienceYears: 8,
    description: "A young Swedish head coach who brings analytical precision and a modern approach to tactics. Daniel Persson is one of the most data-driven coaches on the circuit but is still building the authority and experience needed to consistently lead at the highest level.",
    specialties: ["Tactics", "Analysis", "Performance"],
    skillLevel: 64, salary: 7500, contractYears: 1,
    personality: { leadership: 62, discipline: 70, communication: 68, adaptability: 74, professionalism: 72 },
    attributes: { leadership: 62, technicalCoaching: 66, tacticalKnowledge: 70, playerDevelopment: 64, matchManagement: 62, trainingPlanning: 68, motivation: 62, recruitment: 58 },
    imageFile: "staff_head_coach_05_1783429961133.webp", slot: "staff-05",
  },
  {
    name: "Laura Martínez",
    nationality: "Spanish", gender: "Female",
    age: 49, stars: 4, experienceYears: 16,
    description: "A seasoned Spanish head coach celebrated for her exceptional communication skills and ability to build powerful team cultures. Laura Martínez has guided multiple clubs to continental honours through her inclusive and demanding leadership philosophy.",
    specialties: ["Leadership", "Communication", "Team Culture"],
    skillLevel: 82, salary: 17000, contractYears: 3,
    personality: { leadership: 84, discipline: 78, communication: 92, adaptability: 80, professionalism: 84 },
    attributes: { leadership: 84, technicalCoaching: 80, tacticalKnowledge: 82, playerDevelopment: 84, matchManagement: 80, trainingPlanning: 81, motivation: 88, recruitment: 76 },
    imageFile: "staff_head_coach_06_1783429962978.webp", slot: "staff-06",
  },
  {
    name: "Nikita Thompson",
    nationality: "Jamaican", gender: "Female",
    age: 43, stars: 3, experienceYears: 14,
    description: "A Jamaican head coach who has forged a career on discipline, resilience, and instilling a winning mentality. Nikita Thompson draws from a background of competing in high-pressure environments and translates that experience into demanding but fair leadership.",
    specialties: ["Discipline", "Resilience", "Winning Mentality"],
    skillLevel: 66, salary: 8500, contractYears: 2,
    personality: { leadership: 70, discipline: 80, communication: 68, adaptability: 66, professionalism: 74 },
    attributes: { leadership: 68, technicalCoaching: 64, tacticalKnowledge: 66, playerDevelopment: 66, matchManagement: 68, trainingPlanning: 64, motivation: 74, recruitment: 58 },
    imageFile: "staff_head_coach_07_1783429965068.webp", slot: "staff-07",
  },
  {
    name: "Jessica Reid",
    nationality: "Jamaican", gender: "Female",
    age: 29, stars: 3, experienceYears: 6,
    description: "One of the youngest head coaches on the World Tour, Jessica Reid compensates for limited experience with boundless energy and a natural ability to connect with players. Her player development instincts are exceptional but her match management is still maturing.",
    specialties: ["Energy", "Team Culture", "Player Development"],
    skillLevel: 62, salary: 7000, contractYears: 1,
    personality: { leadership: 64, discipline: 60, communication: 74, adaptability: 78, professionalism: 66 },
    attributes: { leadership: 62, technicalCoaching: 62, tacticalKnowledge: 60, playerDevelopment: 70, matchManagement: 58, trainingPlanning: 62, motivation: 76, recruitment: 56 },
    imageFile: "staff_head_coach_08_1783429981825.webp", slot: "staff-08",
  },
  {
    name: "Mekdes Tesfaye",
    nationality: "Ethiopian", gender: "Female",
    age: 61, stars: 4, experienceYears: 22,
    description: "The most experienced head coach in the pool, Mekdes Tesfaye has spent over two decades building beach volleyball programmes from the ground up. Her wisdom, discipline, and deep knowledge of the long game have made her one of the most respected figures on the international circuit.",
    specialties: ["Experience", "Wisdom", "Discipline"],
    skillLevel: 84, salary: 17500, contractYears: 2,
    personality: { leadership: 86, discipline: 88, communication: 80, adaptability: 74, professionalism: 90 },
    attributes: { leadership: 86, technicalCoaching: 82, tacticalKnowledge: 84, playerDevelopment: 86, matchManagement: 84, trainingPlanning: 84, motivation: 80, recruitment: 78 },
    imageFile: "staff_head_coach_09_1783429984771.webp", slot: "staff-09",
  },
  {
    name: "Massimo Bianchi",
    nationality: "Italian", gender: "Male",
    age: 52, stars: 4.5, experienceYears: 20,
    description: "The standout head coach in this pool, Massimo Bianchi combines elite tactical acumen with exceptional motivational skills honed over 20 years at the top of the game. His record of building championship-winning cultures and developing world-class athletes is virtually unmatched.",
    specialties: ["Leadership", "Tactics", "Motivation"],
    skillLevel: 90, salary: 25000, contractYears: 4,
    personality: { leadership: 92, discipline: 86, communication: 88, adaptability: 84, professionalism: 90 },
    attributes: { leadership: 92, technicalCoaching: 88, tacticalKnowledge: 92, playerDevelopment: 88, matchManagement: 91, trainingPlanning: 90, motivation: 92, recruitment: 86 },
    imageFile: "staff_head_coach_10_1783429987511.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("=== Seed Head Coaches ===\n");

  console.log("Deleting existing head coaches...");
  await db.delete(staffTable).where(eq(staffTable.role, "Head Coach"));
  console.log("  Deleted.\n");

  const now = new Date().toISOString();

  for (const [i, c] of COACHES.entries()) {
    const gcsPath = `staff/head_coach/${c.slot}.webp`;
    console.log(`[${i + 1}/10] ${c.name}`);
    const imageUrl = await upload(resolve(WORKSPACE_ROOT, "attached_assets", c.imageFile), gcsPath);
    console.log(`  ✓ Image → ${imageUrl}`);

    await db.insert(staffTable).values({
      name: c.name,
      role: "Head Coach",
      nationality: c.nationality,
      baseAge: c.age,
      skillLevel: c.skillLevel,
      baseSalary: c.salary,
      imageUrl,
      attributes: {
        regenerationSeed: SEED,
        gender: c.gender,
        contractYears: c.contractYears,
        stars: c.stars,
        experienceYears: c.experienceYears,
        specialties: c.specialties,
        description: c.description,
        personality: c.personality,
        coachingAttributes: c.attributes,
        availability: { injured: false, suspended: false, available: true },
        career: { club: "", yearsAtClub: 0, careerAchievements: [] },
        metadata: { created: now, lastModified: now, notes: "" },
      },
    });
    console.log(`  ✓ DB row inserted (skill: ${c.skillLevel}, ★${c.stars})`);
  }

  console.log("\n=== Done — 10 head coaches seeded. ===");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
