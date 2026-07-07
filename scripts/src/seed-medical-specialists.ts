/**
 * Replaces all existing Medical Specialists with the real 10 from card images.
 * Run: pnpm --filter @workspace/scripts run seed-medical-specialists
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

function skillFromStarsExp(stars: number, exp: number): number {
  const base = { 3: 68, 4: 78, 5: 90 }[stars] ?? 75;
  return Math.min(96, Math.round(base + exp * 0.55));
}
function salaryFromStarsExp(stars: number, exp: number): number {
  const base = { 3: 4000, 4: 5500, 5: 8000 }[stars] ?? 5500;
  return Math.round((base + exp * 80) / 100) * 100;
}

type AttrKey = "sportsMedicine"|"injuryAssessment"|"concussionManagement"|"rehabilitationPlanning"|"returnToPlay"|"playerWellbeing"|"medicalResearch"|"professionalism";

function attrs(stars: number, exp: number, overrides: Partial<Record<AttrKey, number>>) {
  const base = { 3: 64, 4: 76, 5: 88 }[stars] ?? 76;
  const bExp = Math.round(exp * 0.45);
  const cap = (v: number) => Math.min(97, v);
  return {
    sportsMedicine:         cap(overrides.sportsMedicine         ?? base + bExp + 2),
    injuryAssessment:       cap(overrides.injuryAssessment       ?? base + bExp + 1),
    concussionManagement:   cap(overrides.concussionManagement   ?? base + bExp),
    rehabilitationPlanning: cap(overrides.rehabilitationPlanning ?? base + bExp),
    returnToPlay:           cap(overrides.returnToPlay           ?? base + bExp + 1),
    playerWellbeing:        cap(overrides.playerWellbeing        ?? base + bExp),
    medicalResearch:        cap(overrides.medicalResearch        ?? base + bExp),
    professionalism:        cap(overrides.professionalism        ?? base + bExp + 2),
  };
}

const SPECIALISTS = [
  {
    name: "Dr. James Carter", nationality: "British", gender: "Male",
    age: 52, stars: 4, experienceYears: 20,
    specialty: "Back Specialist",
    coachSpeciality: "Spinal & Back Medicine",
    specialties: ["Spinal Rehabilitation", "Back Injury Management", "Return to Play Protocols"],
    description: "A highly regarded British back specialist with 20 years in elite sport. Dr. Carter is one of the leading spinal rehabilitation experts on the World Tour, trusted by coaches and athletes alike.",
    attributes: attrs(4, 20, { injuryAssessment: 93, rehabilitationPlanning: 92, returnToPlay: 93 }),
    imageFile: "staff_medical_specialist_01_1783428591843.webp", slot: "staff-01",
  },
  {
    name: "Dr. Sarah Mitchell", nationality: "Australian", gender: "Female",
    age: 48, stars: 4, experienceYears: 18,
    specialty: "Shoulder Specialist",
    coachSpeciality: "Shoulder & Upper Limb Medicine",
    specialties: ["Shoulder Injury Rehabilitation", "Upper Limb Medicine", "Return to Play"],
    description: "An accomplished Australian shoulder specialist with 18 years of elite sports experience. Dr. Mitchell's expertise in upper limb medicine makes her indispensable for beach volleyball rosters.",
    attributes: attrs(4, 18, { injuryAssessment: 92, rehabilitationPlanning: 91, returnToPlay: 92 }),
    imageFile: "staff_medical_specialist_02_1783428594971.webp", slot: "staff-02",
  },
  {
    name: "Dr. David Thompson", nationality: "Canadian", gender: "Male",
    age: 46, stars: 4, experienceYears: 17,
    specialty: "Ankle Specialist",
    coachSpeciality: "Ankle & Lower Limb Medicine",
    specialties: ["Ankle Injury Management", "Lower Limb Rehabilitation", "Sports Injury Assessment"],
    description: "A trusted Canadian ankle specialist with 17 years on the elite circuit. Dr. Thompson's lower limb rehabilitation programmes have helped countless athletes return to peak performance.",
    attributes: attrs(4, 17, { injuryAssessment: 91, rehabilitationPlanning: 90, returnToPlay: 91 }),
    imageFile: "staff_medical_specialist_03_1783428597295.webp", slot: "staff-03",
  },
  {
    name: "Dr. Benjamin Harris", nationality: "British", gender: "Male",
    age: 50, stars: 4, experienceYears: 19,
    specialty: "Hand Specialist",
    coachSpeciality: "Hand & Wrist Medicine",
    specialties: ["Hand & Wrist Rehabilitation", "Fine Motor Recovery", "Return to Play"],
    description: "A meticulous British hand specialist with 19 years in professional sport. Dr. Harris is widely recognised for his precision rehabilitation of hand and wrist injuries that affect setting and attacking mechanics.",
    attributes: attrs(4, 19, { injuryAssessment: 92, rehabilitationPlanning: 92, sportsMedicine: 91 }),
    imageFile: "staff_medical_specialist_04_1783428599354.webp", slot: "staff-04",
  },
  {
    name: "Dr. Andrew Wilson", nationality: "Australian", gender: "Male",
    age: 45, stars: 4, experienceYears: 18,
    specialty: "Knee Specialist",
    coachSpeciality: "Knee & Lower Limb Medicine",
    specialties: ["Knee Injury Rehabilitation", "ACL & Ligament Recovery", "Return to Play"],
    description: "A respected Australian knee specialist with 18 years of elite experience. Dr. Wilson is the go-to expert for ACL and ligament rehabilitation, a critical skill in beach volleyball.",
    attributes: attrs(4, 18, { injuryAssessment: 92, rehabilitationPlanning: 93, returnToPlay: 94 }),
    imageFile: "staff_medical_specialist_05_1783428612997.webp", slot: "staff-05",
  },
  {
    // ★5
    name: "Dr. Meera Kapoor", nationality: "Indian", gender: "Female",
    age: 53, stars: 5, experienceYears: 21,
    specialty: "Neck Specialist",
    coachSpeciality: "Cervical & Neck Medicine",
    specialties: ["Cervical Spine Rehabilitation", "Neck Injury Management", "Concussion Management"],
    description: "A 5-star Indian neck and cervical spine specialist with 21 years at the elite level. Dr. Kapoor's expertise in concussion management and cervical rehabilitation makes her one of the most complete medical specialists on the market.",
    attributes: attrs(5, 21, { concussionManagement: 96, injuryAssessment: 95, rehabilitationPlanning: 95, professionalism: 96 }),
    imageFile: "staff_medical_specialist_06_1783428614658.webp", slot: "staff-06",
  },
  {
    // ★3 — younger, lower tier
    name: "Dr. Sofia Martinez", nationality: "Spanish", gender: "Female",
    age: 27, stars: 3, experienceYears: 4,
    specialty: "Sports Scientist",
    coachSpeciality: "Performance Analysis",
    specialties: ["Performance Analysis", "Sports Science", "Athletic Wellbeing"],
    description: "A talented young Spanish sports scientist and performance analyst with 4 years in elite sport. Dr. Martinez brings fresh analytical thinking and modern sports science methodology to her role.",
    attributes: attrs(3, 4, { medicalResearch: 72, playerWellbeing: 70, sportsMedicine: 68 }),
    imageFile: "staff_medical_specialist_07_1783428616973.webp", slot: "staff-07",
  },
  {
    name: "Dr. Daniel Thompson", nationality: "Australian", gender: "Male",
    age: 41, stars: 4, experienceYears: 13,
    specialty: "Orthopaedic Specialist",
    coachSpeciality: "Orthopaedic Medicine",
    specialties: ["Orthopaedic Rehabilitation", "Sports Injury Assessment", "Return to Play"],
    description: "A skilled Australian orthopaedic specialist and sports injury expert with 13 years of elite experience. Dr. Thompson's holistic approach to assessment and rehabilitation makes him a valued addition to any squad.",
    attributes: attrs(4, 13, { injuryAssessment: 89, rehabilitationPlanning: 89, returnToPlay: 90 }),
    imageFile: "staff_medical_specialist_08_1783428619535.webp", slot: "staff-08",
  },
  {
    name: "Dr. Alessandro Rossi", nationality: "Italian", gender: "Male",
    age: 35, stars: 4, experienceYears: 10,
    specialty: "Cardiology Specialist",
    coachSpeciality: "Cardiology & Performance Medicine",
    specialties: ["Cardiovascular Health", "Performance Medicine", "Player Wellbeing"],
    description: "An innovative Italian cardiology specialist with 10 years in elite sports performance medicine. Dr. Rossi focuses on heart health optimisation and cardiovascular performance enhancement for elite athletes.",
    attributes: attrs(4, 10, { sportsMedicine: 86, playerWellbeing: 88, medicalResearch: 86 }),
    imageFile: "staff_medical_specialist_09_1783428650582.webp", slot: "staff-09",
  },
  {
    name: "Dr. Nathaniel Goodwin", nationality: "New Zealander", gender: "Male",
    age: 46, stars: 4, experienceYears: 16,
    specialty: "Neurology Specialist",
    coachSpeciality: "Neurology & Brain Medicine",
    specialties: ["Neurological Assessment", "Concussion Management", "Brain & Nervous System Medicine"],
    description: "A distinguished New Zealand neurology specialist with 16 years in elite sport. Dr. Goodwin's expertise in concussion protocols and neurological assessment makes him an essential component of any top-tier medical team.",
    attributes: attrs(4, 16, { concussionManagement: 93, injuryAssessment: 91, medicalResearch: 90 }),
    imageFile: "staff_medical_specialist_10_1783428652885.webp", slot: "staff-10",
  },
];

async function main() {
  console.log("Removing existing Medical Specialists...");
  const existing = await db
    .select({ id: staffTable.id, name: staffTable.name })
    .from(staffTable)
    .where(eq(staffTable.role, "Medical Specialist"));

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    await db.execute(`UPDATE training_sessions SET coach_id = NULL WHERE coach_id = ANY(ARRAY[${ids.join(",")}]::int[])` as any);
    await db.execute(`UPDATE continental_scouting_missions SET assigned_staff_id = NULL WHERE assigned_staff_id = ANY(ARRAY[${ids.join(",")}]::int[])` as any);
    await db.delete(staffTable).where(inArray(staffTable.id, ids));
    console.log(`  deleted ${ids.length} rows.\n`);
  }

  for (const [i, s] of SPECIALISTS.entries()) {
    const skill = skillFromStarsExp(s.stars, s.experienceYears);
    const salary = salaryFromStarsExp(s.stars, s.experienceYears);
    console.log(`[${i + 1}/10] ${s.name} (${s.nationality}, ★${s.stars}, ${s.experienceYears} yrs) — skill ${skill}`);

    const imageUrl = await upload(
      resolve(WORKSPACE_ROOT, "attached_assets", s.imageFile),
      `staff/medical_specialist/${s.slot}.webp`,
    );

    await db.insert(staffTable).values({
      name:            s.name,
      role:            "Medical Specialist",
      specialty:       s.specialty,
      age:             s.age,
      nationality:     s.nationality,
      salary:          String(salary),
      skillLevel:      skill,
      overallRating:   skill,
      contractLength:  12,
      coachSpeciality: s.coachSpeciality,
      personality:     "Analytical",
      specialTrait:    s.specialties[0],
      attributes: {
        schema:                 "beach_volleyball_staff",
        version:                "1.0",
        staffType:              "Medical Specialist",
        regenerationSeed:       "BVM_MEDICAL_SPECIALIST_V1_2026_07_07",
        nationality:            s.nationality,
        age:                    s.age,
        gender:                 s.gender,
        stars:                  s.stars,
        experienceYears:        s.experienceYears,
        salary,
        specialties:            s.specialties,
        description:            s.description,
        ...s.attributes,
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
    .where(eq(staffTable.role, "Medical Specialist"));

  console.log(`\nDone — ${final.length} Medical Specialists now in DB:`);
  final.forEach((r) => console.log(`  ${r.name} (skill ${r.skill})`));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
