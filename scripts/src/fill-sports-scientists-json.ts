/**
 * Populates the full JSON attributes for all 10 Sports Scientists.
 * Run: pnpm --filter @workspace/scripts run fill-sports-scientists-json
 */
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// Per-scientist data derived from card images + specialty-weighted attribute generation
const SCIENTISTS = [
  {
    name: "Dr. Matthew Anderson",
    nationality: "Australian",
    age: 38, gender: "Male", stars: 4, experienceYears: 12,
    salary: 5800,
    specialties: ["Team Sports Science", "Performance Monitoring", "Athlete Conditioning"],
    description: "A seasoned team sports scientist with 12 years of elite beach volleyball experience. Specialises in holistic athlete management and conditioning protocols.",
    attributes: { sportsScience: 85, performanceAnalysis: 84, workloadManagement: 83, fatigueMonitoring: 82, biomechanics: 80, dataAnalysis: 78, research: 76, professionalism: 85 },
  },
  {
    name: "Dr. Emma Clarke",
    nationality: "Australian",
    age: 33, gender: "Female", stars: 4, experienceYears: 8,
    salary: 5200,
    specialties: ["Athlete Monitoring", "Fatigue Management", "Recovery Science"],
    description: "A team sports scientist focused on fatigue monitoring and recovery strategies for elite beach volleyball athletes.",
    attributes: { sportsScience: 80, performanceAnalysis: 80, workloadManagement: 82, fatigueMonitoring: 86, biomechanics: 76, dataAnalysis: 76, research: 74, professionalism: 82 },
  },
  {
    name: "Dr. Zandile Mokwena",
    nationality: "South African",
    age: 36, gender: "Female", stars: 4, experienceYears: 11,
    salary: 5600,
    specialties: ["Performance Science", "Load Management", "Athlete Wellbeing"],
    description: "Brings 11 years of international sports science experience with a strong focus on workload management and athlete wellbeing in hot-climate environments.",
    attributes: { sportsScience: 84, performanceAnalysis: 82, workloadManagement: 86, fatigueMonitoring: 84, biomechanics: 78, dataAnalysis: 80, research: 78, professionalism: 84 },
  },
  {
    name: "Dr. Luca Moretti",
    nationality: "Italian",
    age: 33, gender: "Male", stars: 4, experienceYears: 8,
    salary: 5200,
    specialties: ["Strength & Conditioning Science", "Movement Analysis", "Recovery Protocols"],
    description: "Italian sports scientist with a background in strength physiology and movement analysis tailored for beach volleyball athletes.",
    attributes: { sportsScience: 80, performanceAnalysis: 79, workloadManagement: 80, fatigueMonitoring: 78, biomechanics: 84, dataAnalysis: 77, research: 76, professionalism: 80 },
  },
  {
    name: "Dr. Marta García",
    nationality: "Spanish",
    age: 31, gender: "Female", stars: 4, experienceYears: 7,
    salary: 5000,
    specialties: ["Performance Analysis", "Video Analytics", "Statistical Modelling"],
    description: "A performance analyst specialising in data-driven insights and video analytics for tactical decision-making in beach volleyball.",
    attributes: { sportsScience: 77, performanceAnalysis: 88, workloadManagement: 76, fatigueMonitoring: 76, biomechanics: 75, dataAnalysis: 90, research: 82, professionalism: 80 },
  },
  {
    name: "Dr. James O'Connor",
    nationality: "Australian",
    age: 34, gender: "Male", stars: 4, experienceYears: 9,
    salary: 5400,
    specialties: ["Athletic Performance", "Speed & Power Development", "Periodisation"],
    description: "Performance specialist with 9 years in elite sport, focusing on speed, power development and competition periodisation for beach volleyball.",
    attributes: { sportsScience: 82, performanceAnalysis: 85, workloadManagement: 82, fatigueMonitoring: 80, biomechanics: 80, dataAnalysis: 79, research: 77, professionalism: 82 },
  },
  {
    name: "Dr. Takashi Mori",
    nationality: "Japanese",
    age: 38, gender: "Male", stars: 4, experienceYears: 12,
    salary: 5800,
    specialties: ["Biomechanics", "Movement Efficiency", "Injury Prevention"],
    description: "World-renowned biomechanics specialist with 12 years at the intersection of movement science and beach volleyball, reducing injury risk through technical analysis.",
    attributes: { sportsScience: 85, performanceAnalysis: 82, workloadManagement: 78, fatigueMonitoring: 76, biomechanics: 94, dataAnalysis: 85, research: 88, professionalism: 85 },
  },
  {
    name: "Dr. Emily Thompson",
    nationality: "Canadian",
    age: 29, gender: "Female", stars: 4, experienceYears: 6,
    salary: 4800,
    specialties: ["Exercise Physiology", "Cardiovascular Conditioning", "Endurance Science"],
    description: "Exercise physiologist who combines cardiorespiratory science with practical conditioning programmes, ensuring athletes peak at the right moments.",
    attributes: { sportsScience: 76, performanceAnalysis: 77, workloadManagement: 80, fatigueMonitoring: 86, biomechanics: 76, dataAnalysis: 75, research: 79, professionalism: 78 },
  },
  {
    name: "Dr. Larissa Almeida",
    nationality: "Brazilian",
    age: 28, gender: "Female", stars: 4, experienceYears: 5,
    salary: 4600,
    specialties: ["Human Performance", "Athlete Profiling", "Nutrition Science"],
    description: "A rising talent in human performance science from Brazil, combining nutrition science and athlete profiling to unlock individual potential.",
    attributes: { sportsScience: 75, performanceAnalysis: 77, workloadManagement: 78, fatigueMonitoring: 78, biomechanics: 74, dataAnalysis: 76, research: 76, professionalism: 77 },
  },
  {
    name: "Dr. Andrea Bianchi",
    nationality: "Italian",
    age: 42, gender: "Male", stars: 4, experienceYears: 14,
    salary: 6200,
    specialties: ["Data & Analytics", "AI-Assisted Performance", "Statistical Research"],
    description: "Italy's foremost sports data scientist with 14 years of research. Pioneers AI-assisted performance analytics to give clubs a data-driven competitive edge.",
    attributes: { sportsScience: 88, performanceAnalysis: 86, workloadManagement: 82, fatigueMonitoring: 80, biomechanics: 80, dataAnalysis: 95, research: 92, professionalism: 88 },
  },
];

async function main() {
  console.log("Populating Sports Scientist JSON attributes...\n");

  for (const s of SCIENTISTS) {
    const fullAttributes = {
      // schema fields
      schema:           "beach_volleyball_staff",
      version:          "1.0",
      staffType:        "Sports Scientist",
      // identity
      nationality:      s.nationality,
      age:              s.age,
      gender:           s.gender,
      stars:            s.stars,
      experienceYears:  s.experienceYears,
      salary:           s.salary,
      specialties:      s.specialties,
      description:      s.description,
      // Sports Scientist specific attributes
      sportsScience:        s.attributes.sportsScience,
      performanceAnalysis:  s.attributes.performanceAnalysis,
      workloadManagement:   s.attributes.workloadManagement,
      fatigueMonitoring:    s.attributes.fatigueMonitoring,
      biomechanics:         s.attributes.biomechanics,
      dataAnalysis:         s.attributes.dataAnalysis,
      research:             s.attributes.research,
      professionalism:      s.attributes.professionalism,
    };

    await db
      .update(staffTable)
      .set({ attributes: fullAttributes })
      .where(eq(staffTable.name, s.name));

    const avg = Math.round(
      Object.values(s.attributes).reduce((a, b) => a + b, 0) / Object.values(s.attributes).length
    );
    console.log(`✓ ${s.name} (${s.nationality}) — avg attribute: ${avg}`);
  }

  console.log("\nDone — all 10 Sports Scientists fully populated.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
