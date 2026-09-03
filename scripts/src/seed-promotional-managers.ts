/**
 * Replaces all existing Promotional Managers with real card data.
 * Run: pnpm --filter @workspace/scripts run seed-promotional-managers
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

const SEED = "BVM_PROMOTIONAL_MANAGER_V2_2026_07_07";

// ★3 → ~68-72, ★2 → ~52-58; calibrated by experience
const MANAGERS = [
  {
    name: "Sophie Müller",
    nationality: "German", gender: "Female",
    age: 37, stars: 3, experienceYears: 12,
    description: "The standout promotional manager in the pool, Sophie Müller brings 12 years of elite sports marketing experience and a comprehensive skill set spanning brand strategy, event promotion, and sponsor relations. Her track record of delivering significant brand growth and successful marketing campaigns has made her one of the most sought-after commercial professionals on the World Tour.",
    specialties: ["Brand Strategy", "Sponsor Relations", "Marketing Campaigns"],
    skillLevel: 70, salary: 14000, contractYears: 3,
    personality: { leadership: 78, discipline: 80, communication: 84, adaptability: 78, professionalism: 86 },
    attributes: { marketing: 82, sponsorshipDeals: 80, fanEngagement: 76, mediaRelations: 78, brandGrowth: 84, eventPromotion: 80, merchandiseSales: 72, publicRelations: 78 },
    imageFile: "staff_promotional_manager_01_1783431412730.webp", slot: "staff-01",
  },
  {
    name: "Oliver Harrison",
    nationality: "English", gender: "Male",
    age: 38, stars: 2, experienceYears: 10,
    description: "An English promotional manager with a decade of experience in sports event promotion and sponsor relations. Oliver Harrison is a steady and professional operator whose brand development instincts and social media strategy have produced consistent commercial results, though he has yet to break through at the very highest level of the game.",
    specialties: ["Event Promotion", "Sponsor Relations", "Brand Development"],
    skillLevel: 56, salary: 7000, contractYears: 2,
    personality: { leadership: 62, discipline: 68, communication: 72, adaptability: 66, professionalism: 74 },
    attributes: { marketing: 58, sponsorshipDeals: 60, fanEngagement: 56, mediaRelations: 62, brandGrowth: 58, eventPromotion: 64, merchandiseSales: 52, publicRelations: 60 },
    imageFile: "staff_promotional_manager_02_1783431414475.webp", slot: "staff-02",
  },
  {
    name: "Isabella Costa",
    nationality: "Brazil", gender: "Female",
    age: 34, stars: 2, experienceYears: 8,
    description: "A Brazilian promotional manager who brings Latin American energy and creativity to her marketing and sponsor relations work. Isabella Costa has an eye for digital campaigns and brand development, and her understanding of event promotion in South American and European markets gives her a useful cross-cultural perspective.",
    specialties: ["Event Promotion", "Brand Development", "Digital Campaigns"],
    skillLevel: 54, salary: 6500, contractYears: 1,
    personality: { leadership: 60, discipline: 64, communication: 74, adaptability: 72, professionalism: 68 },
    attributes: { marketing: 56, sponsorshipDeals: 54, fanEngagement: 60, mediaRelations: 56, brandGrowth: 56, eventPromotion: 62, merchandiseSales: 54, publicRelations: 56 },
    imageFile: "staff_promotional_manager_03_1783431417017.webp", slot: "staff-03",
  },
  {
    name: "James Walker",
    nationality: "United Kingdom", gender: "Male",
    age: 36, stars: 2, experienceYears: 9,
    description: "A British promotional manager who has built his career on thorough event promotion and reliable sponsor relations. James Walker is a dependable commercial operator whose media planning skills and brand development work produce steady results, though his conservative approach means he rarely delivers the kind of breakout commercial moments that top clubs require.",
    specialties: ["Event Promotion", "Sponsor Relations", "Media Planning"],
    skillLevel: 55, salary: 6500, contractYears: 1,
    personality: { leadership: 60, discipline: 68, communication: 68, adaptability: 62, professionalism: 72 },
    attributes: { marketing: 56, sponsorshipDeals: 58, fanEngagement: 54, mediaRelations: 60, brandGrowth: 54, eventPromotion: 62, merchandiseSales: 50, publicRelations: 58 },
    imageFile: "staff_promotional_manager_04_1783431419698.webp", slot: "staff-04",
  },
  {
    name: "Maria Sanchez",
    nationality: "Spain", gender: "Female",
    age: 33, stars: 2, experienceYears: 7,
    description: "A Spanish promotional manager whose enthusiasm and community engagement skills have helped her carve out a niche in event promotion and marketing strategy. Maria Sanchez is particularly effective at building local fan bases and grassroots sponsor relationships, though her experience at the elite international level remains limited.",
    specialties: ["Event Promotion", "Brand Development", "Community Engagement"],
    skillLevel: 53, salary: 6000, contractYears: 1,
    personality: { leadership: 58, discipline: 62, communication: 74, adaptability: 70, professionalism: 66 },
    attributes: { marketing: 54, sponsorshipDeals: 52, fanEngagement: 62, mediaRelations: 54, brandGrowth: 54, eventPromotion: 60, merchandiseSales: 52, publicRelations: 56 },
    imageFile: "staff_promotional_manager_05_1783431436211.webp", slot: "staff-05",
  },
  {
    name: "Kenji Tanaka",
    nationality: "Japan", gender: "Male",
    age: 35, stars: 2, experienceYears: 8,
    description: "A Japanese promotional manager who brings a disciplined, detail-oriented approach to marketing strategy and digital marketing. Kenji Tanaka's work ethic and professionalism are beyond question, and his sponsorship relations skills show promise, though he is still developing the creative instinct needed to generate standout campaigns at the elite level.",
    specialties: ["Event Promotion", "Brand Development", "Digital Marketing"],
    skillLevel: 54, salary: 6500, contractYears: 1,
    personality: { leadership: 60, discipline: 76, communication: 64, adaptability: 62, professionalism: 78 },
    attributes: { marketing: 56, sponsorshipDeals: 56, fanEngagement: 52, mediaRelations: 58, brandGrowth: 56, eventPromotion: 60, merchandiseSales: 52, publicRelations: 54 },
    imageFile: "staff_promotional_manager_06_1783431438766.webp", slot: "staff-06",
  },
  {
    name: "Lucas Moreau",
    nationality: "France", gender: "Male",
    age: 37, stars: 2, experienceYears: 9,
    description: "A French promotional manager with nine years of experience across event promotion, sponsor relations, and public relations. Lucas Moreau is a well-rounded commercial professional whose calm, strategic demeanour and solid marketing instincts make him a reliable addition to any club's commercial department, though he lacks the elite-level impact of the very top performers.",
    specialties: ["Event Promotion", "Sponsor Relations", "Public Relations"],
    skillLevel: 55, salary: 6500, contractYears: 2,
    personality: { leadership: 62, discipline: 68, communication: 70, adaptability: 66, professionalism: 72 },
    attributes: { marketing: 56, sponsorshipDeals: 58, fanEngagement: 54, mediaRelations: 62, brandGrowth: 54, eventPromotion: 62, merchandiseSales: 50, publicRelations: 62 },
    imageFile: "staff_promotional_manager_07_1783431441286.webp", slot: "staff-07",
  },
  {
    name: "Alexander Petrov",
    nationality: "Russia", gender: "Male",
    age: 34, stars: 2, experienceYears: 8,
    description: "A Russian promotional manager whose eight years in sports marketing have given him a solid grounding in event promotion, brand development, and sponsor relations. Alexander Petrov's communications skills and marketing strategy work are dependable, and his ambition suggests he has more to offer as he continues to develop his commercial profile.",
    specialties: ["Event Promotion", "Brand Development", "Communications"],
    skillLevel: 54, salary: 6000, contractYears: 1,
    personality: { leadership: 60, discipline: 66, communication: 68, adaptability: 66, professionalism: 70 },
    attributes: { marketing: 56, sponsorshipDeals: 54, fanEngagement: 52, mediaRelations: 58, brandGrowth: 56, eventPromotion: 60, merchandiseSales: 50, publicRelations: 56 },
    imageFile: "staff_promotional_manager_08_1783431443980.webp", slot: "staff-08",
  },
  {
    name: "Matthew Anderson",
    nationality: "USA", gender: "Male",
    age: 39, stars: 2, experienceYears: 11,
    description: "An American promotional manager with 11 years of experience and a particular strength in building global partnerships and marketing strategy. Matthew Anderson's World Tour network is extensive, and his sponsor relations and brand development work carry the credibility of a long career, though he has never quite translated that experience into a top-tier commercial impact.",
    specialties: ["Sponsor Relations", "Brand Development", "Global Partnerships"],
    skillLevel: 57, salary: 7000, contractYears: 2,
    personality: { leadership: 64, discipline: 68, communication: 70, adaptability: 68, professionalism: 72 },
    attributes: { marketing: 58, sponsorshipDeals: 62, fanEngagement: 54, mediaRelations: 60, brandGrowth: 60, eventPromotion: 62, merchandiseSales: 54, publicRelations: 60 },
    imageFile: "staff_promotional_manager_09_1783431468722.webp", slot: "staff-09",
  },
  {
    name: "Victoria Lawson",
    nationality: "USA", gender: "Female",
    age: 36, stars: 2, experienceYears: 9,
    description: "An American promotional manager whose nine years in sports marketing have been built around event promotion, media partnerships, and brand development. Victoria Lawson's marketing strategy skills and ability to manage sponsor relations make her a consistent commercial contributor, and her communication style is well suited to the collaborative environment of a professional beach volleyball club.",
    specialties: ["Event Promotion", "Brand Development", "Media Partnerships"],
    skillLevel: 55, salary: 6500, contractYears: 2,
    personality: { leadership: 62, discipline: 66, communication: 74, adaptability: 68, professionalism: 70 },
    attributes: { marketing: 56, sponsorshipDeals: 56, fanEngagement: 56, mediaRelations: 62, brandGrowth: 56, eventPromotion: 62, merchandiseSales: 52, publicRelations: 60 },
    imageFile: "staff_promotional_manager_10_1783431471788.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("=== Seed Promotional Managers ===\n");

  console.log("Deleting existing promotional managers...");
  await db.delete(staffTable).where(eq(staffTable.role, "Promotional Manager"));
  console.log("  Deleted.\n");

  const now = new Date().toISOString();

  for (const [i, m] of MANAGERS.entries()) {
    const gcsPath = `staff/promotional_manager/${m.slot}.webp`;
    console.log(`[${i + 1}/10] ${m.name}`);
    const imageUrl = await upload(resolve(WORKSPACE_ROOT, "attached_assets", m.imageFile), gcsPath);
    console.log(`  ✓ Image → ${imageUrl}`);

    await db.insert(staffTable).values({
      name: m.name,
      role: "Promotional Manager",
      nationality: m.nationality,
      baseAge: m.age,
      skillLevel: m.skillLevel,
      baseSalary: m.salary,
      imageUrl,
      attributes: {
        regenerationSeed: SEED,
        gender: m.gender,
        contractYears: m.contractYears,
        stars: m.stars,
        experienceYears: m.experienceYears,
        specialties: m.specialties,
        description: m.description,
        personality: m.personality,
        promotionalAttributes: m.attributes,
        availability: { injured: false, suspended: false, available: true },
        career: { club: "", yearsAtClub: 0, careerAchievements: [] },
        metadata: { created: now, lastModified: now, notes: "" },
      },
    });
    console.log(`  ✓ DB row inserted (skill: ${m.skillLevel}, ★${m.stars})`);
  }

  console.log("\n=== Done — 10 promotional managers seeded. ===");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
