/**
 * Replaces all existing Assistant Coaches with real card data.
 * Run: pnpm --filter @workspace/scripts run seed-assistant-coaches
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

const SEED = "BVM_ASSISTANT_COACH_V2_2026_07_07";

// star → skill_level calibration
// ★2 ~57, ★3 ~66, ★4 ~82, ★4.5 ~89
const COACHES = [
  {
    name: "Luca Bardi",
    nationality: "Australian", gender: "Male",
    age: 38, stars: 4, experienceYears: 9,
    description: "An Australian assistant coach with a sharp offensive mind. Luca Bardi is renowned for crafting attacking patterns that put opponents under constant pressure from serve reception to the final swing.",
    specialties: ["Offense Strategy", "Attack Combinations", "Game Planning"],
    specialty: "Offense Strategy",
    skillLevel: 82, salary: 9500, contractYears: 2,
    personality: { leadership: 78, discipline: 74, communication: 80, adaptability: 76, professionalism: 79 },
    attributes: { technicalCoaching: 83, tacticalKnowledge: 84, playerDevelopment: 76, motivation: 80, matchPreparation: 82, oppositionAnalysis: 78, trainingQuality: 80, teamwork: 77 },
    imageFile: "staff_assistant_coach_01_1783429600734.webp", slot: "staff-01",
  },
  {
    name: "Marcos Silva",
    nationality: "Brazilian", gender: "Male",
    age: 46, stars: 2, experienceYears: 17,
    description: "A veteran Brazilian assistant coach whose experience exceeds his current rating. Marcos Silva has dedicated his career to long-term player development, shaping raw talent into consistent performers.",
    specialties: ["Player Development", "Technical Fundamentals", "Mentoring"],
    specialty: "Player Development",
    skillLevel: 57, salary: 3500, contractYears: 1,
    personality: { leadership: 60, discipline: 58, communication: 65, adaptability: 62, professionalism: 63 },
    attributes: { technicalCoaching: 60, tacticalKnowledge: 56, playerDevelopment: 70, motivation: 68, matchPreparation: 54, oppositionAnalysis: 52, trainingQuality: 62, teamwork: 66 },
    imageFile: "staff_assistant_coach_02_1783429602791.webp", slot: "staff-02",
  },
  {
    name: "Sofia Martinez",
    nationality: "Spanish", gender: "Female",
    age: 34, stars: 2, experienceYears: 8,
    description: "A determined Spanish assistant coach who brings defensive grit and discipline to every session. Sofia Martinez is steadily building a reputation as a defensive systems specialist on the World Tour.",
    specialties: ["Defensive Strategy", "Block Organisation", "Defensive Patterns"],
    specialty: "Defensive Strategy",
    skillLevel: 57, salary: 3200, contractYears: 1,
    personality: { leadership: 62, discipline: 70, communication: 60, adaptability: 58, professionalism: 65 },
    attributes: { technicalCoaching: 58, tacticalKnowledge: 60, playerDevelopment: 54, motivation: 62, matchPreparation: 60, oppositionAnalysis: 64, trainingQuality: 56, teamwork: 59 },
    imageFile: "staff_assistant_coach_03_1783429604611.webp", slot: "staff-03",
  },
  {
    name: "Emma Watson",
    nationality: "Australian", gender: "Female",
    age: 42, stars: 3, experienceYears: 14,
    description: "An experienced Australian assistant coach who has built a career around defensive structure and resilience. Emma Watson's methodical approach has helped multiple teams tighten their back-court and limit opponent scoring.",
    specialties: ["Defensive Strategy", "Resilience Coaching", "Team Organisation"],
    specialty: "Defensive Strategy",
    skillLevel: 66, salary: 5500, contractYears: 2,
    personality: { leadership: 68, discipline: 72, communication: 70, adaptability: 65, professionalism: 70 },
    attributes: { technicalCoaching: 65, tacticalKnowledge: 68, playerDevelopment: 62, motivation: 70, matchPreparation: 66, oppositionAnalysis: 69, trainingQuality: 64, teamwork: 67 },
    imageFile: "staff_assistant_coach_04_1783429606328.webp", slot: "staff-04",
  },
  {
    name: "Anouk Van Dijk",
    nationality: "Dutch", gender: "Female",
    age: 47, stars: 2, experienceYears: 15,
    description: "A Dutch all-round assistant coach who has worked across attack, defence, and serve tactics over a long career. Anouk Van Dijk provides steady, reliable support to any coaching staff.",
    specialties: ["All-Rounder Strategy", "Serve Tactics", "Team Balance"],
    specialty: "All-Rounder Strategy",
    skillLevel: 58, salary: 3800, contractYears: 1,
    personality: { leadership: 58, discipline: 62, communication: 62, adaptability: 70, professionalism: 64 },
    attributes: { technicalCoaching: 60, tacticalKnowledge: 59, playerDevelopment: 58, motivation: 60, matchPreparation: 57, oppositionAnalysis: 58, trainingQuality: 59, teamwork: 65 },
    imageFile: "staff_assistant_coach_05_1783429609054.webp", slot: "staff-05",
  },
  {
    name: "Jessica De Groot",
    nationality: "Australian", gender: "Female",
    age: 38, stars: 4.5, experienceYears: 11,
    description: "One of the most tactically astute assistant coaches on the World Tour. Jessica De Groot combines elite setting knowledge with advanced game-film analysis to give her teams a consistent edge in match preparation.",
    specialties: ["Setting & Game Analysis", "Video Analysis", "Match Preparation"],
    specialty: "Setting & Game Analysis",
    skillLevel: 90, salary: 14000, contractYears: 3,
    personality: { leadership: 85, discipline: 82, communication: 90, adaptability: 84, professionalism: 88 },
    attributes: { technicalCoaching: 89, tacticalKnowledge: 92, playerDevelopment: 85, motivation: 87, matchPreparation: 93, oppositionAnalysis: 91, trainingQuality: 88, teamwork: 86 },
    imageFile: "staff_assistant_coach_06_1783429611025.webp", slot: "staff-06",
  },
  {
    name: "Isabella Ricci",
    nationality: "Italian", gender: "Female",
    age: 34, stars: 4, experienceYears: 8,
    description: "An Italian assistant coach who has made defensive excellence and court positioning her calling card. Isabella Ricci's players consistently rank among the best in defensive efficiency on tour.",
    specialties: ["Defense & Court Positioning", "Block Timing", "Defensive Reads"],
    specialty: "Defense & Court Positioning",
    skillLevel: 80, salary: 8500, contractYears: 2,
    personality: { leadership: 76, discipline: 80, communication: 77, adaptability: 74, professionalism: 80 },
    attributes: { technicalCoaching: 80, tacticalKnowledge: 79, playerDevelopment: 74, motivation: 77, matchPreparation: 78, oppositionAnalysis: 82, trainingQuality: 80, teamwork: 76 },
    imageFile: "staff_assistant_coach_07_1783429613148.webp", slot: "staff-07",
  },
  {
    name: "Kwame Adu",
    nationality: "Ghanaian", gender: "Male",
    age: 40, stars: 4, experienceYears: 14,
    description: "A Ghanaian assistant coach who blends strength and conditioning expertise with tactical coaching. Kwame Adu is known for building physically dominant athletes who remain explosive deep into match play.",
    specialties: ["Strength & Conditioning", "Athletic Development", "Peak Performance"],
    specialty: "Strength & Conditioning",
    skillLevel: 82, salary: 9500, contractYears: 2,
    personality: { leadership: 80, discipline: 84, communication: 76, adaptability: 78, professionalism: 82 },
    attributes: { technicalCoaching: 78, tacticalKnowledge: 76, playerDevelopment: 84, motivation: 86, matchPreparation: 80, oppositionAnalysis: 74, trainingQuality: 86, teamwork: 80 },
    imageFile: "staff_assistant_coach_08_1783429615275.webp", slot: "staff-08",
  },
  {
    name: "Mei-Ling Tan",
    nationality: "Singaporean", gender: "Female",
    age: 31, stars: 4.5, experienceYears: 7,
    description: "A prodigiously talented Singaporean assistant coach who has risen quickly through the coaching ranks. Mei-Ling Tan's technical precision in serve development and skill refinement is exceptional for her age.",
    specialties: ["Technical Skills & Serve", "Serve Development", "Skill Refinement"],
    specialty: "Technical Skills & Serve",
    skillLevel: 88, salary: 13000, contractYears: 3,
    personality: { leadership: 80, discipline: 85, communication: 83, adaptability: 86, professionalism: 86 },
    attributes: { technicalCoaching: 91, tacticalKnowledge: 85, playerDevelopment: 88, motivation: 84, matchPreparation: 86, oppositionAnalysis: 82, trainingQuality: 90, teamwork: 84 },
    imageFile: "staff_assistant_coach_09_1783429617256.webp", slot: "staff-09",
  },
  {
    name: "Lukas Schmidt",
    nationality: "German", gender: "Male",
    age: 37, stars: 4, experienceYears: 12,
    description: "A methodical German assistant coach who excels at game strategy and tactical preparation. Lukas Schmidt is a master of scouting opposition weaknesses and translating them into clear, actionable game plans.",
    specialties: ["Tactics & Game Strategy", "Opposition Scouting", "Set Plays"],
    specialty: "Tactics & Game Strategy",
    skillLevel: 84, salary: 10500, contractYears: 2,
    personality: { leadership: 80, discipline: 86, communication: 79, adaptability: 77, professionalism: 84 },
    attributes: { technicalCoaching: 82, tacticalKnowledge: 88, playerDevelopment: 78, motivation: 80, matchPreparation: 88, oppositionAnalysis: 90, trainingQuality: 82, teamwork: 79 },
    imageFile: "staff_assistant_coach_10_1783429619545.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("=== Seed Assistant Coaches ===\n");

  // Delete existing
  console.log("Deleting existing assistant coaches...");
  await db.delete(staffTable).where(eq(staffTable.role, "Assistant Coach"));
  console.log("  Deleted.\n");

  const now = new Date().toISOString();

  for (const [i, c] of COACHES.entries()) {
    const gcsPath = `staff/assistant_coach/${c.slot}.webp`;
    console.log(`[${i + 1}/10] ${c.name}`);
    const imageUrl = await upload(resolve(WORKSPACE_ROOT, "attached_assets", c.imageFile), gcsPath);
    console.log(`  ✓ Image → ${imageUrl}`);

    await db.insert(staffTable).values({
      name: c.name,
      role: "Assistant Coach",
      nationality: c.nationality,
      age: c.age,
      skillLevel: c.skillLevel,
      salary: c.salary,
      imageUrl,
      attributes: {
        regenerationSeed: SEED,
        gender: c.gender,
        contractYears: c.contractYears,
        stars: c.stars,
        experienceYears: c.experienceYears,
        specialty: c.specialty,
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

  console.log("\n=== Done — 10 assistant coaches seeded. ===");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
