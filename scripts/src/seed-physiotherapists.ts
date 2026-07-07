/**
 * Replaces all existing Physiotherapists with the real 10 from card images.
 * Includes full JSON attributes from the Physiotherapist schema.
 * Run: pnpm --filter @workspace/scripts run seed-physiotherapists
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db/schema";
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

// Star → skill level range (mid-point used, adjusted by experience)
function skillFromStars(stars: number, expYears: number): number {
  const base = { 1.5: 45, 2: 55, 2.5: 62, 3: 68, 3.5: 74, 4: 79, 4.5: 86, 5: 92 }[stars] ?? 70;
  return Math.min(99, Math.round(base + expYears * 0.3));
}

function salaryFromStarsExp(stars: number, expYears: number): number {
  const base = { 1.5: 2800, 2: 3500, 2.5: 4000, 3: 4500, 3.5: 5000, 4: 5500, 4.5: 6500, 5: 7800 }[stars] ?? 5000;
  return Math.round((base + expYears * 80) / 100) * 100;
}

const PHYSIOS = [
  {
    name: "Dr. Isabella Conti",
    nationality: "Italian", gender: "Female",
    age: 38, stars: 4, experienceYears: 10,
    specialty: "Injury & Rehab Specialist",
    coachSpeciality: "Injury Rehabilitation",
    specialties: ["Injury Rehabilitation", "Sports Physiotherapy", "Recovery Protocols"],
    description: "Italian physiotherapist with 10 years of elite sports experience. Specialises in comprehensive injury rehabilitation and return-to-play protocols for beach volleyball athletes.",
    attributes: { injuryRecovery: 86, injuryPrevention: 82, mobility: 80, rehabilitation: 88, manualTherapy: 84, fitnessSupport: 78, playerCare: 85, professionalism: 86 },
    imageFile: "staff_medical_physiotherapist_01_1783427455027.webp", slot: "staff-01",
  },
  {
    name: "Dr. Sipho Dlamini",
    nationality: "South African", gender: "Male",
    age: 37, stars: 4, experienceYears: 12,
    specialty: "Team Physiotherapist",
    coachSpeciality: "Team Physiotherapy",
    specialties: ["Team Physiotherapy", "Musculoskeletal Therapy", "Sports Injury Management"],
    description: "Experienced South African team physiotherapist with 12 years working with elite athletes. Expert in musculoskeletal therapy and comprehensive injury management.",
    attributes: { injuryRecovery: 85, injuryPrevention: 84, mobility: 82, rehabilitation: 86, manualTherapy: 85, fitnessSupport: 80, playerCare: 84, professionalism: 85 },
    imageFile: "staff_medical_physiotherapist_02_1783427463131.webp", slot: "staff-02",
  },
  {
    name: "Dr. Anastasia Ivanova",
    nationality: "Russian", gender: "Female",
    age: 42, stars: 4, experienceYears: 17,
    specialty: "Team Physiotherapist",
    coachSpeciality: "Team Physiotherapy",
    specialties: ["Team Physiotherapy", "Manual Therapy", "Long-Term Athlete Development"],
    description: "A highly seasoned Russian physiotherapist with 17 years at the elite level. Renowned for her manual therapy expertise and long-term athlete development programmes.",
    attributes: { injuryRecovery: 88, injuryPrevention: 86, mobility: 84, rehabilitation: 90, manualTherapy: 92, fitnessSupport: 82, playerCare: 88, professionalism: 90 },
    imageFile: "staff_medical_physiotherapist_03_1783427469244.webp", slot: "staff-03",
  },
  {
    name: "Dr. Nattaya Somboon",
    nationality: "Thai", gender: "Female",
    age: 29, stars: 4, experienceYears: 7,
    specialty: "Team Physiotherapist",
    coachSpeciality: "Team Physiotherapy",
    specialties: ["Team Physiotherapy", "Recovery & Mobility", "Soft Tissue Therapy"],
    description: "A dedicated Thai team physiotherapist with a focus on recovery optimisation and soft tissue work. Highly regarded for her patient-centred approach to athlete care.",
    attributes: { injuryRecovery: 80, injuryPrevention: 79, mobility: 84, rehabilitation: 80, manualTherapy: 82, fitnessSupport: 77, playerCare: 86, professionalism: 80 },
    imageFile: "staff_medical_physiotherapist_04_1783427473605.webp", slot: "staff-04",
  },
  {
    name: "Dr. Anita Sharma",
    nationality: "Indian", gender: "Female",
    age: 52, stars: 4, experienceYears: 23,
    specialty: "Team Physiotherapist",
    coachSpeciality: "Team Physiotherapy",
    specialties: ["Team Physiotherapy", "Chronic Injury Management", "Athlete Longevity"],
    description: "One of the most experienced physiotherapists in the game, with 23 years of elite sport behind her. Dr. Sharma specialises in chronic injury management and extending athlete careers.",
    attributes: { injuryRecovery: 90, injuryPrevention: 92, mobility: 86, rehabilitation: 91, manualTherapy: 90, fitnessSupport: 84, playerCare: 92, professionalism: 94 },
    imageFile: "staff_medical_physiotherapist_05_1783427484813.webp", slot: "staff-05",
  },
  {
    name: "Dr. Emily Harrison",
    nationality: "Australian", gender: "Female",
    age: 31, stars: 4, experienceYears: 6,
    specialty: "Musculoskeletal Specialist",
    coachSpeciality: "Musculoskeletal Physiotherapy",
    specialties: ["Musculoskeletal Physiotherapy", "Sports Injury Rehabilitation", "Movement Assessment"],
    description: "Australian musculoskeletal specialist with 6 years of focused experience in beach volleyball. Known for precise movement assessments and evidence-based rehabilitation programmes.",
    attributes: { injuryRecovery: 79, injuryPrevention: 80, mobility: 86, rehabilitation: 80, manualTherapy: 81, fitnessSupport: 78, playerCare: 82, professionalism: 80 },
    imageFile: "staff_medical_physiotherapist_06_1783427487485.webp", slot: "staff-06",
  },
  {
    // ★2 — lower tier
    name: "Irina Morozova",
    nationality: "Russian", gender: "Female",
    age: 29, stars: 2, experienceYears: 7,
    specialty: "Movement. Recovery. Performance.",
    coachSpeciality: "Sports Rehabilitation",
    specialties: ["Sports Injury Rehabilitation", "Mobility & Flexibility", "Manual Therapy & Massage"],
    description: "A developing Russian physiotherapist with broad rehabilitation skills. Strong in mobility work and manual therapy, she is building her reputation on the World Tour circuit.",
    attributes: { injuryRecovery: 60, injuryPrevention: 58, mobility: 68, rehabilitation: 62, manualTherapy: 65, fitnessSupport: 60, playerCare: 64, professionalism: 62 },
    imageFile: "staff_medical_physiotherapist_07_1783427498249.webp", slot: "staff-07",
  },
  {
    // ★5 — top tier
    name: "Alexei Mironov",
    nationality: "Russian", gender: "Male",
    age: 34, stars: 5, experienceYears: 9,
    specialty: "Rehabilitate. Restore. Perform.",
    coachSpeciality: "Sports Injury Rehabilitation",
    specialties: ["Sports Injury Rehabilitation", "Manual Therapy & Mobilisation", "Kinesio Taping"],
    description: "An elite 5-star Russian physiotherapist with a stellar reputation for rehabilitating complex sports injuries. His combination of manual therapy, kinesio taping and spinal rehab makes him one of the best available.",
    attributes: { injuryRecovery: 94, injuryPrevention: 90, mobility: 88, rehabilitation: 95, manualTherapy: 94, fitnessSupport: 88, playerCare: 90, professionalism: 92 },
    imageFile: "staff_medical_physiotherapist_08_1783427501091.webp", slot: "staff-08",
  },
  {
    // ★4
    name: "Mei Ling Tan",
    nationality: "Singaporean", gender: "Female",
    age: 27, stars: 4, experienceYears: 5,
    specialty: "Move Well. Recover Stronger.",
    coachSpeciality: "Sports Rehabilitation",
    specialties: ["Sports Injury Rehabilitation", "Kinesiotaping & Strapping", "Post-Operative Rehabilitation"],
    description: "A talented young Singaporean physiotherapist focused on helping athletes move better and recover faster. Specialises in kinesiotaping, post-operative rehab and pain management.",
    attributes: { injuryRecovery: 78, injuryPrevention: 77, mobility: 82, rehabilitation: 80, manualTherapy: 79, fitnessSupport: 76, playerCare: 84, professionalism: 78 },
    imageFile: "staff_medical_physiotherapist_09_1783427512066.webp", slot: "staff-09",
  },
  {
    // ★5 Extra Specialist
    name: "Nikita Belyakov",
    nationality: "Russian", gender: "Male",
    age: 31, stars: 5, experienceYears: 7,
    specialty: "Restore. Rehabilitate. Perform.",
    coachSpeciality: "Sports Injury Rehabilitation",
    specialties: ["Manual Therapy & Mobilisation", "Spinal & Joint Rehabilitation", "Injury Prevention & Performance"],
    description: "A 5-star extra specialist and one of the most complete physiotherapists on the market. Nikita's mastery of spinal rehabilitation, soft tissue therapy and kinesiotaping makes him an invaluable asset to any elite squad.",
    attributes: { injuryRecovery: 93, injuryPrevention: 92, mobility: 90, rehabilitation: 94, manualTherapy: 96, fitnessSupport: 88, playerCare: 88, professionalism: 90 },
    imageFile: "staff_medical_physiotherapist_10_1783427514345.webp", slot: "staff-10",
  },
];

async function main() {
  // ── Step 1: delete all existing Physiotherapists ──────────────────────────
  console.log("Removing existing Physiotherapists...");
  const existing = await db
    .select({ id: staffTable.id, name: staffTable.name })
    .from(staffTable)
    .where(eq(staffTable.role, "Physiotherapist"));

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    await db.execute(`UPDATE training_sessions SET coach_id = NULL WHERE coach_id = ANY(ARRAY[${ids.join(",")}]::int[])` as any);
    await db.execute(`UPDATE continental_scouting_missions SET assigned_staff_id = NULL WHERE assigned_staff_id = ANY(ARRAY[${ids.join(",")}]::int[])` as any);
    await db.delete(staffTable).where(inArray(staffTable.id, ids));
    console.log(`  deleted ${ids.length} rows.\n`);
  }

  // ── Step 2: upload & insert all 10 ───────────────────────────────────────
  for (const [i, p] of PHYSIOS.entries()) {
    const skill = skillFromStars(p.stars, p.experienceYears);
    const salary = salaryFromStarsExp(p.stars, p.experienceYears);
    console.log(`[${i + 1}/10] ${p.name} (${p.nationality}, ★${p.stars}, ${p.experienceYears} yrs) — skill ${skill}`);

    const imageUrl = await upload(
      resolve(WORKSPACE_ROOT, "attached_assets", p.imageFile),
      `staff/physiotherapist/${p.slot}.webp`,
    );

    await db.insert(staffTable).values({
      name:            p.name,
      role:            "Physiotherapist",
      specialty:       p.specialty,
      age:             p.age,
      nationality:     p.nationality,
      salary:          String(salary),
      skillLevel:      skill,
      overallRating:   skill,
      contractLength:  12,
      coachSpeciality: p.coachSpeciality,
      personality:     "Caring",
      specialTrait:    p.specialties[0],
      attributes: {
        schema:          "beach_volleyball_staff",
        version:         "1.0",
        staffType:       "Physiotherapist",
        nationality:     p.nationality,
        age:             p.age,
        gender:          p.gender,
        stars:           p.stars,
        experienceYears: p.experienceYears,
        salary,
        specialties:     p.specialties,
        description:     p.description,
        // Physiotherapist-specific attributes
        injuryRecovery:  p.attributes.injuryRecovery,
        injuryPrevention:p.attributes.injuryPrevention,
        mobility:        p.attributes.mobility,
        rehabilitation:  p.attributes.rehabilitation,
        manualTherapy:   p.attributes.manualTherapy,
        fitnessSupport:  p.attributes.fitnessSupport,
        playerCare:      p.attributes.playerCare,
        professionalism: p.attributes.professionalism,
      },
      imageUrl,
      isAvailable:     true,
      isScoutRevealed: false,
      scoutingRating:  skill - 5,
    });

    console.log(`  ✓ inserted → ${imageUrl}`);
  }

  // ── verify ────────────────────────────────────────────────────────────────
  const final = await db
    .select({ name: staffTable.name, skill: staffTable.skillLevel })
    .from(staffTable)
    .where(eq(staffTable.role, "Physiotherapist"));

  console.log(`\nDone — ${final.length} Physiotherapists now in DB:`);
  final.forEach((r) => console.log(`  ${r.name} (skill ${r.skill})`));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
