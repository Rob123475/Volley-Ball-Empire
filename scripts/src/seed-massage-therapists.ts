/**
 * Replaces all existing Massage Therapists with real card data.
 * Run: pnpm --filter @workspace/scripts run seed-massage-therapists
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

const SEED = "BVM_MASSAGE_THERAPIST_V2_2026_07_07";

// ★3 → ~60-68, ★4 → ~80-83; calibrated by experience
const THERAPISTS = [
  {
    name: "Mele Taufatofua",
    nationality: "Tongan", gender: "Female",
    age: 33, stars: 3, experienceYears: 9,
    description: "A Tongan massage therapist with nine years of World Tour experience and a warm, patient-centred approach. Mele Taufatofua specialises in deep tissue work and recovery therapy, and her ability to combine myofascial release with relaxation techniques makes her one of the most trusted practitioners in any squad.",
    specialties: ["Deep Tissue Massage", "Recovery Therapy", "Myofascial Release"],
    skillLevel: 68, salary: 7000, contractYears: 2,
    personality: { leadership: 60, discipline: 72, communication: 80, adaptability: 76, professionalism: 78 },
    attributes: { sportsMassage: 72, muscleRecovery: 76, softTissueTherapy: 74, triggerPointTherapy: 68, flexibilitySupport: 70, circulationImprovement: 68, relaxationTechniques: 80, playerCare: 82 },
    imageFile: "staff_massage_therapist_01_1783431183428.webp", slot: "staff-01",
  },
  {
    name: "Sara Lindgren",
    nationality: "Swedish", gender: "Female",
    age: 29, stars: 3, experienceYears: 6,
    description: "A Swedish massage therapist who brings Scandinavian precision and a strong recovery focus to her practice. Sara Lindgren excels in sports massage, myofascial release, and trigger point therapy, and is particularly valued for her ability to improve athlete flexibility and mobility ahead of competition.",
    specialties: ["Sports Massage", "Myofascial Release", "Flexibility & Mobility"],
    skillLevel: 63, salary: 6000, contractYears: 1,
    personality: { leadership: 56, discipline: 70, communication: 74, adaptability: 72, professionalism: 76 },
    attributes: { sportsMassage: 68, muscleRecovery: 66, softTissueTherapy: 66, triggerPointTherapy: 68, flexibilitySupport: 72, circulationImprovement: 62, relaxationTechniques: 64, playerCare: 70 },
    imageFile: "staff_massage_therapist_02_1783431186902.webp", slot: "staff-02",
  },
  {
    name: "Jessica Moreau",
    nationality: "France", gender: "Female",
    age: 31, stars: 4, experienceYears: 7,
    description: "A French massage therapist whose exceptional technical range sets her apart from her peers. Jessica Moreau combines deep tissue expertise with lymphatic drainage, postural alignment, and sports recovery protocols, bringing a holistic and highly effective approach to athlete maintenance at the elite level.",
    specialties: ["Deep Tissue Massage", "Lymphatic Drainage", "Postural Alignment"],
    skillLevel: 80, salary: 11000, contractYears: 2,
    personality: { leadership: 66, discipline: 80, communication: 82, adaptability: 80, professionalism: 84 },
    attributes: { sportsMassage: 82, muscleRecovery: 82, softTissueTherapy: 84, triggerPointTherapy: 78, flexibilitySupport: 78, circulationImprovement: 84, relaxationTechniques: 76, playerCare: 84 },
    imageFile: "staff_massage_therapist_03_1783431189490.webp", slot: "staff-03",
  },
  {
    name: "Jamal Reid",
    nationality: "Jamaican", gender: "Male",
    age: 28, stars: 3, experienceYears: 5,
    description: "A Jamaican massage therapist with a strong background in sports massage and injury rehabilitation. Jamal Reid is known for his precise trigger point therapy and myofascial release techniques, and his approachable personality makes athletes feel comfortable and cared for throughout the treatment process.",
    specialties: ["Sports Massage", "Trigger Point Therapy", "Injury Rehab"],
    skillLevel: 62, salary: 5500, contractYears: 1,
    personality: { leadership: 58, discipline: 68, communication: 78, adaptability: 74, professionalism: 72 },
    attributes: { sportsMassage: 66, muscleRecovery: 64, softTissueTherapy: 62, triggerPointTherapy: 70, flexibilitySupport: 68, circulationImprovement: 60, relaxationTechniques: 62, playerCare: 72 },
    imageFile: "staff_massage_therapist_04_1783431192160.webp", slot: "staff-04",
  },
  {
    name: "Mikaela Sato",
    nationality: "Australia", gender: "Female",
    age: 27, stars: 3, experienceYears: 4,
    description: "A young Australian massage therapist of Japanese heritage who blends Eastern and Western recovery techniques. Mikaela Sato has quickly established herself on the World Tour circuit for her skillful Swedish massage, lymphatic drainage, and post-competition recovery sessions that help athletes bounce back faster.",
    specialties: ["Sports Massage", "Lymphatic Drainage", "Post Competition Recovery"],
    skillLevel: 60, salary: 5000, contractYears: 1,
    personality: { leadership: 54, discipline: 66, communication: 76, adaptability: 78, professionalism: 70 },
    attributes: { sportsMassage: 64, muscleRecovery: 62, softTissueTherapy: 60, triggerPointTherapy: 58, flexibilitySupport: 64, circulationImprovement: 64, relaxationTechniques: 66, playerCare: 72 },
    imageFile: "staff_massage_therapist_05_1783431194217.webp", slot: "staff-05",
  },
  {
    name: "Eleni Papadopoulos",
    nationality: "Greek", gender: "Female",
    age: 30, stars: 3, experienceYears: 6,
    description: "A Greek massage therapist whose deep tissue expertise and manual lymphatic drainage skills have made her a reliable presence in professional beach volleyball squads. Eleni Papadopoulos brings a calm, methodical approach to athlete recovery, with a particular focus on flexibility, mobility, and soft tissue restoration.",
    specialties: ["Deep Tissue Massage", "Manual Lymphatic Drainage", "Flexibility & Mobility"],
    skillLevel: 64, salary: 6000, contractYears: 1,
    personality: { leadership: 58, discipline: 72, communication: 72, adaptability: 70, professionalism: 76 },
    attributes: { sportsMassage: 66, muscleRecovery: 68, softTissueTherapy: 68, triggerPointTherapy: 64, flexibilitySupport: 72, circulationImprovement: 70, relaxationTechniques: 66, playerCare: 72 },
    imageFile: "staff_massage_therapist_06_1783431196509.webp", slot: "staff-06",
  },
  {
    name: "Sofia Martinez",
    nationality: "Spain", gender: "Female",
    age: 31, stars: 3, experienceYears: 6,
    description: "A Spanish massage therapist who combines deep tissue and sports massage with a proactive approach to injury prevention. Sofia Martinez is valued for her stretch therapy protocols and her ability to identify muscular tension patterns before they develop into injuries, keeping athletes performing consistently across long tournament schedules.",
    specialties: ["Deep Tissue Massage", "Stretch Therapy", "Injury Prevention"],
    skillLevel: 64, salary: 6000, contractYears: 1,
    personality: { leadership: 60, discipline: 74, communication: 74, adaptability: 72, professionalism: 76 },
    attributes: { sportsMassage: 68, muscleRecovery: 66, softTissueTherapy: 68, triggerPointTherapy: 64, flexibilitySupport: 72, circulationImprovement: 64, relaxationTechniques: 64, playerCare: 72 },
    imageFile: "staff_massage_therapist_07_1783431198885.webp", slot: "staff-07",
  },
  {
    name: "Priya Desai",
    nationality: "India", gender: "Female",
    age: 28, stars: 3, experienceYears: 5,
    description: "An Indian massage therapist who draws on a rich tradition of therapeutic bodywork to deliver effective sports massage, trigger point therapy, and mobility support. Priya Desai's empathetic and professional manner earns strong trust from athletes, and her attention to detail in deep tissue work shows steady promise at the elite level.",
    specialties: ["Sports Massage", "Trigger Point Therapy", "Mobility & Flexibility"],
    skillLevel: 62, salary: 5500, contractYears: 1,
    personality: { leadership: 56, discipline: 70, communication: 78, adaptability: 74, professionalism: 74 },
    attributes: { sportsMassage: 66, muscleRecovery: 64, softTissueTherapy: 62, triggerPointTherapy: 68, flexibilitySupport: 68, circulationImprovement: 60, relaxationTechniques: 62, playerCare: 72 },
    imageFile: "staff_massage_therapist_08_1783431201065.webp", slot: "staff-08",
  },
  {
    name: "Lucas Moreau",
    nationality: "France", gender: "Male",
    age: 34, stars: 4, experienceYears: 9,
    description: "A French massage therapist with nine years of elite-level experience and a comprehensive technical repertoire that covers sports massage, myofascial release, postural alignment, and rehabilitation massage. Lucas Moreau is recognised as one of the most effective practitioners on the World Tour, consistently helping athletes maintain peak physical condition across demanding competition schedules.",
    specialties: ["Sports Massage", "Myofascial Release", "Rehabilitation Massage"],
    skillLevel: 83, salary: 12000, contractYears: 3,
    personality: { leadership: 68, discipline: 82, communication: 80, adaptability: 78, professionalism: 86 },
    attributes: { sportsMassage: 86, muscleRecovery: 84, softTissueTherapy: 86, triggerPointTherapy: 82, flexibilitySupport: 80, circulationImprovement: 80, relaxationTechniques: 78, playerCare: 86 },
    imageFile: "staff_massage_therapist_09_1783431203526.webp", slot: "staff-09",
  },
  {
    name: "Emre Yilmaz",
    nationality: "Turkish", gender: "Male",
    age: 33, stars: 3, experienceYears: 7,
    description: "A Turkish massage therapist who brings a distinctive blend of deep tissue expertise and traditional cupping therapy to his practice. Emre Yilmaz is particularly effective at postural correction and recovery stretching, and his broad technical range has made him a valued member of multiple World Tour squads over a seven-year career.",
    specialties: ["Deep Tissue Massage", "Cupping Therapy", "Postural Correction"],
    skillLevel: 65, salary: 6500, contractYears: 2,
    personality: { leadership: 60, discipline: 74, communication: 72, adaptability: 74, professionalism: 76 },
    attributes: { sportsMassage: 68, muscleRecovery: 68, softTissueTherapy: 70, triggerPointTherapy: 66, flexibilitySupport: 68, circulationImprovement: 66, relaxationTechniques: 66, playerCare: 72 },
    imageFile: "staff_massage_therapist_10_1783431206467.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("=== Seed Massage Therapists ===\n");

  console.log("Deleting existing massage therapists...");
  await db.delete(staffTable).where(eq(staffTable.role, "Massage Therapist"));
  console.log("  Deleted.\n");

  const now = new Date().toISOString();

  for (const [i, t] of THERAPISTS.entries()) {
    const gcsPath = `staff/massage_therapist/${t.slot}.webp`;
    console.log(`[${i + 1}/10] ${t.name}`);
    const imageUrl = await upload(resolve(WORKSPACE_ROOT, "attached_assets", t.imageFile), gcsPath);
    console.log(`  ✓ Image → ${imageUrl}`);

    await db.insert(staffTable).values({
      name: t.name,
      role: "Massage Therapist",
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
        specialties: t.specialties,
        description: t.description,
        personality: t.personality,
        massageAttributes: t.attributes,
        availability: { injured: false, suspended: false, available: true },
        career: { club: "", yearsAtClub: 0, careerAchievements: [] },
        metadata: { created: now, lastModified: now, notes: "" },
      },
    });
    console.log(`  ✓ DB row inserted (skill: ${t.skillLevel}, ★${t.stars})`);
  }

  console.log("\n=== Done — 10 massage therapists seeded. ===");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
