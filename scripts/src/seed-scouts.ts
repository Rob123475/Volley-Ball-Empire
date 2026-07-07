/**
 * Replaces all existing Scouts with real card data.
 * Includes 2 Super Scouts (★5) and 8 Common Scouts.
 * Run: pnpm --filter @workspace/scripts run seed-scouts
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

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

const SEED = "BVM_SCOUT_V2_2026_07_07";

// ★2→~52-56, ★3→~64-68, ★4→~78-84, ★4.5→92, ★5(Super)→96
const SCOUTS = [
  // --- Common Scouts ---
  {
    name: "Emma Thompson",
    nationality: "Canadian", gender: "Female",
    age: 34, stars: 2, experienceYears: 9,
    scoutTier: "Common Scout",
    description: "A Canadian scout who has spent nine years developing her talent identification and data scouting skills across North American and European circuits. Emma Thompson is a diligent and analytical professional whose opponent analysis work adds real value, though she is still building the international network and evaluation depth needed to reach the elite tier.",
    specialties: ["Talent Identification", "Player Evaluation", "Data Scouting"],
    skillLevel: 56, salary: 6500, contractYears: 1,
    personality: { leadership: 58, discipline: 70, communication: 68, adaptability: 66, professionalism: 72 },
    attributes: { playerEvaluation: 60, talentIdentification: 60, technicalAnalysis: 56, opponentScouting: 62, youthDevelopment: 54, internationalNetworking: 52, dataAnalysis: 62, negotiation: 48 },
    superScoutAttributes: null,
    imageFile: "staff_scouts_01_1783431610100.webp", slot: "staff-01",
  },
  {
    name: "Wei Zhang",
    nationality: "Chinese", gender: "Male",
    age: 56, stars: 4.5, experienceYears: 22,
    scoutTier: "Common Scout",
    description: "One of the most experienced scouts in the pool, Wei Zhang has spent 22 years identifying and developing talent across Asia, Europe, and the Americas. His deep tactical knowledge, data and performance analysis expertise, and vast international scouting network make him one of the most trusted and effective non-Super Scout operators on the World Tour.",
    specialties: ["International Scouting", "Data & Performance Analysis", "Tactical Evaluation"],
    skillLevel: 92, salary: 22000, contractYears: 3,
    personality: { leadership: 82, discipline: 88, communication: 78, adaptability: 80, professionalism: 90 },
    attributes: { playerEvaluation: 92, talentIdentification: 94, technicalAnalysis: 92, opponentScouting: 90, youthDevelopment: 88, internationalNetworking: 94, dataAnalysis: 92, negotiation: 84 },
    superScoutAttributes: null,
    imageFile: "staff_scouts_02_1783431612809.webp", slot: "staff-02",
  },
  {
    name: "Liam Chen",
    nationality: "Chinese", gender: "Male",
    age: 28, stars: 2, experienceYears: 5,
    scoutTier: "Common Scout",
    description: "A young Chinese scout in the early stages of his career, Liam Chen has shown a good eye for upcoming talent and a methodical approach to data collection and match observation. His regional scouting work is developing well, though he needs significantly more experience at the international level before he can be trusted with major recruitment decisions.",
    specialties: ["Upcoming Talent", "Regional Scouting", "Player Potential"],
    skillLevel: 52, salary: 5500, contractYears: 1,
    personality: { leadership: 50, discipline: 66, communication: 62, adaptability: 70, professionalism: 68 },
    attributes: { playerEvaluation: 54, talentIdentification: 56, technicalAnalysis: 50, opponentScouting: 50, youthDevelopment: 56, internationalNetworking: 44, dataAnalysis: 56, negotiation: 42 },
    superScoutAttributes: null,
    imageFile: "staff_scouts_03_1783431615010.webp", slot: "staff-03",
  },
  {
    name: "Lukas Höfer",
    nationality: "Austrian", gender: "Male",
    age: 38, stars: 5, experienceYears: 15,
    scoutTier: "Super Scout",
    description: "One of the rarest talents in global beach volleyball scouting, Lukas Höfer is an elite-level Austrian talent identification expert whose 15 years of international experience have produced an unmatched record of elite player discovery. His ability to combine tactical intelligence with biomechanical data analysis, sports psychology insights, and global transfer strategy makes him the most complete Super Scout available. Clubs that secure his services gain an exceptional competitive advantage in player acquisition.",
    specialties: ["Elite Talent Identification", "International Player Scouting", "Global Transfer Strategy"],
    skillLevel: 96, salary: 35000, contractYears: 4,
    personality: { leadership: 88, discipline: 92, communication: 86, adaptability: 88, professionalism: 94 },
    attributes: { playerEvaluation: 96, talentIdentification: 98, technicalAnalysis: 94, opponentScouting: 92, youthDevelopment: 94, internationalNetworking: 98, dataAnalysis: 96, negotiation: 92 },
    superScoutAttributes: {
      eliteTalentDevelopment: 98, internationalPlayerScouting: 98, highPerformanceAnalysis: 96,
      tacticalIntelligenceScouting: 96, sportsPsychologyInsights: 90, dataAndBiomechanicalAnalysis: 96,
      globalTransferStrategy: 94, multiculturalCommunication: 88,
    },
    imageFile: "staff_scouts_04_1783431626850.webp", slot: "staff-04",
  },
  {
    name: "Olivia Martin",
    nationality: "Australian", gender: "Female",
    age: 31, stars: 3, experienceYears: 7,
    scoutTier: "Common Scout",
    description: "An Australian scout who has built a solid reputation over seven years through consistent talent identification, player evaluation, and game strategy analysis. Olivia Martin's recruitment strategy instincts are above average for her experience level, and her data scouting approach is methodical and reliable, making her a dependable addition to any club's scouting department.",
    specialties: ["Talent Identification", "Game Strategy Analysis", "Recruitment Strategy"],
    skillLevel: 66, salary: 7500, contractYears: 2,
    personality: { leadership: 64, discipline: 72, communication: 72, adaptability: 74, professionalism: 74 },
    attributes: { playerEvaluation: 68, talentIdentification: 70, technicalAnalysis: 66, opponentScouting: 66, youthDevelopment: 62, internationalNetworking: 60, dataAnalysis: 68, negotiation: 58 },
    superScoutAttributes: null,
    imageFile: "staff_scouts_05_1783431635737.webp", slot: "staff-05",
  },
  {
    name: "Marcus Lindström",
    nationality: "Swedish", gender: "Male",
    age: 42, stars: 4, experienceYears: 14,
    scoutTier: "Common Scout",
    description: "A highly experienced Swedish scout whose 14 years of World Tour service have made him one of the most respected player evaluators in the European market. Marcus Lindström's tactical analysis and opponent scouting skills are elite-level, and his extensive recruitment network across Scandinavia and Central Europe gives clubs hiring him a significant advantage in identifying and securing quality targets.",
    specialties: ["Player Evaluation", "Tactical Analysis", "Opponent Scouting"],
    skillLevel: 84, salary: 14000, contractYears: 3,
    personality: { leadership: 76, discipline: 84, communication: 76, adaptability: 78, professionalism: 86 },
    attributes: { playerEvaluation: 86, talentIdentification: 84, technicalAnalysis: 86, opponentScouting: 88, youthDevelopment: 78, internationalNetworking: 82, dataAnalysis: 82, negotiation: 76 },
    superScoutAttributes: null,
    imageFile: "staff_scouts_06_1783431637761.webp", slot: "staff-06",
  },
  {
    name: "Isabella Rodriguez",
    nationality: "Spanish", gender: "Female",
    age: 29, stars: 4, experienceYears: 6,
    scoutTier: "Common Scout",
    description: "A young Spanish scout who has made a rapid impact on the World Tour through sharp talent identification and exceptional youth recruitment work. Isabella Rodriguez's tactical scouting instincts and data analysis skills are well beyond her years, and her emerging international network suggests she has the potential to develop into a truly elite-level scouting professional.",
    specialties: ["Talent Identification", "Tactical Scouting", "Youth Recruitment"],
    skillLevel: 78, salary: 10000, contractYears: 2,
    personality: { leadership: 70, discipline: 76, communication: 78, adaptability: 82, professionalism: 78 },
    attributes: { playerEvaluation: 80, talentIdentification: 82, technicalAnalysis: 78, opponentScouting: 76, youthDevelopment: 82, internationalNetworking: 72, dataAnalysis: 80, negotiation: 68 },
    superScoutAttributes: null,
    imageFile: "staff_scouts_07_1783431648129.webp", slot: "staff-07",
  },
  {
    name: "Sofia Petrova",
    nationality: "Bulgarian", gender: "Female",
    age: 33, stars: 4, experienceYears: 8,
    scoutTier: "Common Scout",
    description: "A Bulgarian scout who has combined a sharp eye for talent with strong team analysis and international scouting credentials over eight years on the circuit. Sofia Petrova's recruitment strategy work and ability to evaluate players across multiple Eastern European and Central Asian markets gives her a distinctive profile that makes her particularly effective for clubs targeting non-traditional talent pools.",
    specialties: ["Talent Identification", "Team Analysis", "International Scouting"],
    skillLevel: 80, salary: 11000, contractYears: 2,
    personality: { leadership: 72, discipline: 78, communication: 74, adaptability: 78, professionalism: 80 },
    attributes: { playerEvaluation: 82, talentIdentification: 84, technicalAnalysis: 78, opponentScouting: 80, youthDevelopment: 76, internationalNetworking: 82, dataAnalysis: 78, negotiation: 70 },
    superScoutAttributes: null,
    imageFile: "staff_scouts_08_1783431650585.webp", slot: "staff-08",
  },
  {
    name: "Anna Kowalska",
    nationality: "Polish", gender: "Female",
    age: 37, stars: 4, experienceYears: 11,
    scoutTier: "Common Scout",
    description: "A Polish scout with 11 years of experience and a well-rounded profile across player evaluation, technical analysis, and youth development. Anna Kowalska is particularly valued for her opponent scouting work and her ability to identify technically gifted young players before they reach the wider market, making her a consistent and reliable presence in any club's scouting operation.",
    specialties: ["Player Evaluation", "Technical Analysis", "Youth Development"],
    skillLevel: 82, salary: 12000, contractYears: 2,
    personality: { leadership: 74, discipline: 82, communication: 76, adaptability: 76, professionalism: 84 },
    attributes: { playerEvaluation: 84, talentIdentification: 84, technicalAnalysis: 84, opponentScouting: 82, youthDevelopment: 84, internationalNetworking: 78, dataAnalysis: 80, negotiation: 72 },
    superScoutAttributes: null,
    imageFile: "staff_scouts_09_1783431664564.webp", slot: "staff-09",
  },
  {
    name: "Valentina Moretti",
    nationality: "Italian", gender: "Female",
    age: 32, stars: 5, experienceYears: 13,
    scoutTier: "Super Scout",
    description: "An elite Italian scouting specialist whose 13 years of work have established her as one of the most coveted Super Scouts in global beach volleyball. Valentina Moretti combines elite talent development instincts with high performance analysis, tactical intelligence scouting, and world-class multicultural communication to deliver consistently exceptional results across every major global market. Her global transfer strategy expertise and sports psychology insights give any club that employs her a decisive advantage in the most competitive transfer windows.",
    specialties: ["Elite Talent Development", "International Player Scouting", "High Performance Analysis"],
    skillLevel: 96, salary: 35000, contractYears: 4,
    personality: { leadership: 86, discipline: 90, communication: 92, adaptability: 88, professionalism: 94 },
    attributes: { playerEvaluation: 96, talentIdentification: 98, technicalAnalysis: 94, opponentScouting: 92, youthDevelopment: 96, internationalNetworking: 98, dataAnalysis: 96, negotiation: 90 },
    superScoutAttributes: {
      eliteTalentDevelopment: 98, internationalPlayerScouting: 98, highPerformanceAnalysis: 96,
      tacticalIntelligenceScouting: 94, sportsPsychologyInsights: 92, dataAndBiomechanicalAnalysis: 94,
      globalTransferStrategy: 96, multiculturalCommunication: 96,
    },
    imageFile: "staff_scouts_10_1783431668010.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("=== Seed Scouts ===\n");

  // NULL out FK references before deleting
  console.log("Nulling assigned_staff_id FK references in continental_scouting_missions...");
  await db.execute(sql`UPDATE continental_scouting_missions SET assigned_staff_id = NULL WHERE assigned_staff_id IN (SELECT id FROM staff WHERE role = 'Scout')`);
  console.log("  Done.\n");

  console.log("Deleting existing scouts...");
  await db.delete(staffTable).where(eq(staffTable.role, "Scout"));
  console.log("  Deleted.\n");

  const now = new Date().toISOString();

  for (const [i, s] of SCOUTS.entries()) {
    const gcsPath = `staff/scout/${s.slot}.webp`;
    console.log(`[${i + 1}/10] ${s.name} (${s.scoutTier})`);
    const imageUrl = await upload(resolve(WORKSPACE_ROOT, "attached_assets", s.imageFile), gcsPath);
    console.log(`  ✓ Image → ${imageUrl}`);

    await db.insert(staffTable).values({
      name: s.name,
      role: "Scout",
      nationality: s.nationality,
      gender: s.gender,
      age: s.age,
      skillLevel: s.skillLevel,
      salary: s.salary,
      contractYears: s.contractYears,
      imageUrl,
      attributes: {
        regenerationSeed: SEED,
        stars: s.stars,
        experienceYears: s.experienceYears,
        scoutTier: s.scoutTier,
        specialties: s.specialties,
        description: s.description,
        personality: s.personality,
        scoutingAttributes: s.attributes,
        ...(s.superScoutAttributes ? { superScoutAttributes: s.superScoutAttributes } : {}),
        availability: { injured: false, suspended: false, available: true },
        career: { club: "", yearsAtClub: 0, careerAchievements: [] },
        metadata: { created: now, lastModified: now, notes: "" },
      },
    });
    console.log(`  ✓ DB row inserted (skill: ${s.skillLevel}, ★${s.stars})`);
  }

  console.log("\n=== Done — 10 scouts seeded (8 Common + 2 Super). ===");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
