/**
 * Updates staff DB records from the user-uploaded JSON data files.
 * - Merges uploaded skill attributes into existing JSONB (preserves descriptions, images, etc.)
 * - Recalculates overall_rating and skill_level from the average of skill stats
 * - Matches by name (handles "Dr." prefix for Medical Specialists)
 * - Roles with blank JSON files (Massage Therapist, Strength Coach, Promotional Manager)
 *   are left as-is since the V2 seeder already has good data.
 *
 * Run: pnpm --filter @workspace/scripts run update-staff-from-json
 */

import { db } from "@workspace/db";
import { staffTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

function avg(vals: number[]): number {
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ── ASSISTANT COACHES ──────────────────────────────────────────────────────────
const ASSISTANT_COACHES = [
  { name: "Lukas Schmidt",    stars: 4.5, speciality: "Tactics & Game Strategy",        coachingAttributes: { matchPreparation: 95, tacticalKnowledge: 96, offense: 89, defense: 88, training: 84, playerDevelopment: 80, motivation: 85 } },
  { name: "Mei-Ling Tan",     stars: 4.5, speciality: "Technical Skills & Serve",       coachingAttributes: { matchPreparation: 82, tacticalKnowledge: 86, offense: 92, defense: 80, training: 93, playerDevelopment: 90, motivation: 83 } },
  { name: "Kwame Adu",        stars: 4.5, speciality: "Strength & Conditioning",        coachingAttributes: { matchPreparation: 85, tacticalKnowledge: 82, offense: 84, defense: 86, training: 98, playerDevelopment: 88, motivation: 94 } },
  { name: "Isabella Ricci",   stars: 4.5, speciality: "Defense & Court Positioning",    coachingAttributes: { matchPreparation: 88, tacticalKnowledge: 90, offense: 77, defense: 96, training: 88, playerDevelopment: 85, motivation: 86 } },
  { name: "Jessica De Groot", stars: 4.5, speciality: "Setting & Game Analysis",        coachingAttributes: { matchPreparation: 93, tacticalKnowledge: 92, offense: 87, defense: 89, training: 86, playerDevelopment: 90, motivation: 84 } },
  { name: "Anouk Van Dijk",   stars: 2.5, speciality: "All-Rounder Strategy",           coachingAttributes: { matchPreparation: 72, tacticalKnowledge: 74, offense: 71, defense: 72, training: 70, playerDevelopment: 73, motivation: 78 } },
  { name: "Emma Watson",      stars: 3.0, speciality: "Defensive Strategy",             coachingAttributes: { matchPreparation: 78, tacticalKnowledge: 82, offense: 66, defense: 89, training: 80, playerDevelopment: 77, motivation: 84 } },
  { name: "Sofia Martinez",   stars: 2.5, speciality: "Defensive Strategy",             coachingAttributes: { matchPreparation: 73, tacticalKnowledge: 75, offense: 65, defense: 82, training: 74, playerDevelopment: 76, motivation: 80 } },
  { name: "Marcos Silva",     stars: 2.5, speciality: "Player Development",             coachingAttributes: { matchPreparation: 70, tacticalKnowledge: 73, offense: 75, defense: 73, training: 84, playerDevelopment: 94, motivation: 82 } },
  { name: "Luca Bardi",       stars: 4.0, speciality: "Offensive Strategy",             coachingAttributes: { matchPreparation: 90, tacticalKnowledge: 89, offense: 95, defense: 74, training: 82, playerDevelopment: 84, motivation: 88 } },
];

// ── FITNESS TRAINERS ───────────────────────────────────────────────────────────
const FITNESS_TRAINERS = [
  { name: "Sophie Martin",        stars: 4.0, fitnessAttributes: { strengthTraining: 91, conditioning: 90, speedDevelopment: 84, agility: 86, endurance: 88, injuryPrevention: 87, recovery: 81, nutrition: 85, playerDevelopment: 82, motivation: 86 } },
  { name: "Eleni Papadopoulos",   stars: 4.0, fitnessAttributes: { strengthTraining: 88, conditioning: 85, speedDevelopment: 82, agility: 93, endurance: 84, injuryPrevention: 90, recovery: 94, nutrition: 89, playerDevelopment: 84, motivation: 85 } },
  { name: "Isabella Rodriguez",   stars: 4.0, fitnessAttributes: { strengthTraining: 90, conditioning: 87, speedDevelopment: 91, agility: 92, endurance: 83, injuryPrevention: 89, recovery: 82, nutrition: 86, playerDevelopment: 87, motivation: 88 } },
  { name: "Natalie Thompson",     stars: 4.0, fitnessAttributes: { strengthTraining: 89, conditioning: 92, speedDevelopment: 84, agility: 83, endurance: 91, injuryPrevention: 90, recovery: 95, nutrition: 88, playerDevelopment: 86, motivation: 87 } },
  { name: "Lucía Martínez",       stars: 4.0, fitnessAttributes: { strengthTraining: 87, conditioning: 84, speedDevelopment: 88, agility: 94, endurance: 82, injuryPrevention: 85, recovery: 80, nutrition: 79, playerDevelopment: 84, motivation: 90 } },
  { name: "Mateo Gonzalez",       stars: 4.0, fitnessAttributes: { strengthTraining: 94, conditioning: 92, speedDevelopment: 90, agility: 85, endurance: 91, injuryPrevention: 88, recovery: 84, nutrition: 87, playerDevelopment: 86, motivation: 91 } },
  { name: "Sofia Bianchi",        stars: 4.0, fitnessAttributes: { strengthTraining: 89, conditioning: 90, speedDevelopment: 87, agility: 90, endurance: 84, injuryPrevention: 82, recovery: 91, nutrition: 78, playerDevelopment: 80, motivation: 88 } },
  { name: "Emily Carter",         stars: 4.0, fitnessAttributes: { strengthTraining: 88, conditioning: 91, speedDevelopment: 86, agility: 89, endurance: 90, injuryPrevention: 86, recovery: 83, nutrition: 92, playerDevelopment: 84, motivation: 89 } },
  { name: "Lauren Johnson",       stars: 2.0, fitnessAttributes: { strengthTraining: 73, conditioning: 71, speedDevelopment: 74, agility: 76, endurance: 72, injuryPrevention: 78, recovery: 69, nutrition: 81, playerDevelopment: 74, motivation: 80 } },
  { name: "Lucas Anderson",       stars: 4.5, fitnessAttributes: { strengthTraining: 96, conditioning: 95, speedDevelopment: 92, agility: 88, endurance: 94, injuryPrevention: 93, recovery: 90, nutrition: 84, playerDevelopment: 88, motivation: 92 } },
];

// ── MEDICAL SPECIALISTS ────────────────────────────────────────────────────────
// DB stores names with "Dr." prefix; JSON file doesn't have the prefix
const MEDICAL_SPECIALISTS = [
  { name: "Daniel Thompson",   dbName: "Dr. Daniel Thompson",   stars: 4.5, specialty: "Sports Injury & Rehabilitation Expert", specialistAttributes: { diagnosis: 88, rehabilitation: 92, research: 78, morale: 84, recoveryBonus: 16 } },
  { name: "Sofia Martinez",    dbName: "Dr. Sofia Martinez",    stars: 4.0, specialty: "Performance Analyst",                  specialistAttributes: { diagnosis: 74, rehabilitation: 76, research: 90, morale: 86, recoveryBonus: 10 } },
  { name: "Meera Kapoor",      dbName: "Dr. Meera Kapoor",      stars: 5.0, specialty: "Brain & Nervous System Expert",        specialistAttributes: { diagnosis: 98, rehabilitation: 95, research: 86, morale: 91, recoveryBonus: 22 } },
  { name: "Andrew Wilson",     dbName: "Dr. Andrew Wilson",     stars: 4.5, specialty: "Knee Specialist",                      specialistAttributes: { diagnosis: 95, rehabilitation: 93, research: 80, morale: 90, recoveryBonus: 20 } },
  { name: "Benjamin Harris",   dbName: "Dr. Benjamin Harris",   stars: 4.5, specialty: "Hand Specialist",                      specialistAttributes: { diagnosis: 93, rehabilitation: 92, research: 79, morale: 88, recoveryBonus: 18 } },
  { name: "David Thompson",    dbName: "Dr. David Thompson",    stars: 4.5, specialty: "Ankle Specialist",                     specialistAttributes: { diagnosis: 92, rehabilitation: 94, research: 82, morale: 87, recoveryBonus: 19 } },
  { name: "Sarah Mitchell",    dbName: "Dr. Sarah Mitchell",    stars: 4.5, specialty: "Shoulder Specialist",                  specialistAttributes: { diagnosis: 94, rehabilitation: 92, research: 83, morale: 89, recoveryBonus: 19 } },
  { name: "James Carter",      dbName: "Dr. James Carter",      stars: 4.5, specialty: "Back Specialist",                      specialistAttributes: { diagnosis: 95, rehabilitation: 95, research: 81, morale: 90, recoveryBonus: 21 } },
  { name: "Nathaniel Goodwin", dbName: "Dr. Nathaniel Goodwin", stars: 4.5, specialty: "Neurology Specialist",                 specialistAttributes: { diagnosis: 97, rehabilitation: 91, research: 90, morale: 88, recoveryBonus: 22 } },
  { name: "Alessandro Rossi",  dbName: "Dr. Alessandro Rossi",  stars: 4.5, specialty: "Cardiology Specialist",                specialistAttributes: { diagnosis: 90, rehabilitation: 84, research: 91, morale: 87, recoveryBonus: 15 } },
];

// ── HEAD COACHES ───────────────────────────────────────────────────────────────
// From the user's uploaded JSON file (Pasted--id-1-name-James-Whitmore...)
const HEAD_COACHES = [
  { name: "James Whitmore",  stars: 4.5, coachingAttributes: { leadership: 90, development: 92, matchManagement: 94, tactics: 93, motivation: 90, discipline: 89 } },
  { name: "Marco Ricci",     stars: 4.5, coachingAttributes: { leadership: 91, development: 90, matchManagement: 95, tactics: 96, motivation: 87, discipline: 92 } },
  { name: "Tomasz Kowalski", stars: 3.0, coachingAttributes: { leadership: 81, development: 88, matchManagement: 82, tactics: 89, motivation: 79, discipline: 86 } },
  { name: "Sarah Mitchell",  stars: 3.0, coachingAttributes: { leadership: 87, development: 91, matchManagement: 79, tactics: 78, motivation: 90, discipline: 80 } },
  { name: "Daniel Persson",  stars: 3.0, coachingAttributes: { leadership: 78, development: 82, matchManagement: 77, tactics: 85, motivation: 76, discipline: 84 } },
  { name: "Laura Martínez",  stars: 4.0, coachingAttributes: { leadership: 92, development: 90, matchManagement: 86, tactics: 85, motivation: 93, discipline: 84 } },
  { name: "Nikita Thompson", stars: 4.0, coachingAttributes: { leadership: 89, development: 86, matchManagement: 87, tactics: 84, motivation: 94, discipline: 95 } },
  { name: "Jessica Reid",    stars: 3.5, coachingAttributes: { leadership: 94, development: 88, matchManagement: 74, tactics: 73, motivation: 91, discipline: 75 } },
  { name: "Mekdes Tesfaye",  stars: 4.0, coachingAttributes: { leadership: 90, development: 89, matchManagement: 93, tactics: 88, motivation: 86, discipline: 96 } },
  { name: "Massimo Bianchi", stars: 4.5, coachingAttributes: { leadership: 91, development: 90, matchManagement: 94, tactics: 95, motivation: 90, discipline: 91 } },
];

async function updateRole<T extends { coachingAttributes?: Record<string, number>; fitnessAttributes?: Record<string, number>; specialistAttributes?: Record<string, number>; stars: number; speciality?: string; specialty?: string; dbName?: string; name: string }>(
  role: string,
  records: T[],
  attrKey: string,
  getDbName: (r: T) => string,
) {
  console.log(`\n── ${role} ──`);
  for (const r of records) {
    const skillObj = (r as any)[attrKey] as Record<string, number>;
    const skillVals = Object.values(skillObj);
    const rating = avg(skillVals);
    const dbName = getDbName(r);

    const existing = await db.query.staffTable.findFirst({
      where: and(eq(staffTable.name, dbName), eq(staffTable.role, role)),
    });

    if (!existing) {
      console.log(`  ✗ NOT FOUND: "${dbName}"`);
      continue;
    }

    const mergedAttrs = {
      ...(existing.attributes as object),
      [attrKey]: skillObj,
      stars: r.stars,
    };

    await db.update(staffTable)
      .set({
        attributes:    mergedAttrs,
        overallRating: rating,
        skillLevel:    rating,
        specialTrait:  r.speciality ?? r.specialty ?? (existing as any).specialTrait ?? "",
      })
      .where(and(eq(staffTable.name, dbName), eq(staffTable.role, role)));

    console.log(`  ✓ ${dbName} → OVR ${rating} (★${r.stars})`);
  }
}

async function main() {
  console.log("=== Update staff from user JSON files ===");

  await updateRole("Assistant Coach",   ASSISTANT_COACHES,    "coachingAttributes",   r => r.name);
  await updateRole("Fitness Trainer",   FITNESS_TRAINERS,     "fitnessAttributes",    r => r.name);
  await updateRole("Medical Specialist",MEDICAL_SPECIALISTS,  "specialistAttributes", r => r.dbName!);
  await updateRole("Head Coach",        HEAD_COACHES,         "coachingAttributes",   r => r.name);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
