import { Router } from "express";
import { generateStaffMember, type StaffRole } from "../utils/staff-generator.js";
import { generateMedicalStaffMember, type MedicalRole, MEDICAL_ROLES } from "../utils/medical-staff-generator.js";

const router = Router();

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ── Name/nationality pools — mirror the real draft & prospect systems ────────

const SENIOR_NAMES = [
  "Aiko Tanaka", "Yuna Park", "Mei Lin", "Sakura Ito", "Ji-Young Kim",
  "Ana Souza", "Camila Lima", "Isabela Costa", "Mariana Santos", "Julia Oliveira",
  "Emma Weber", "Lena Müller", "Sophie Braun", "Hannah Fischer", "Laura Becker",
  "Chloé Dupont", "Amélie Martin", "Inès Bernard", "Zoé Petit", "Léa Moreau",
  "Mia Rossi", "Sofia Ferrari", "Giulia Romano", "Elena Ricci", "Chiara Bruno",
  "Freya Andersen", "Maja Pedersen", "Astrid Larsen", "Ingrid Johansen", "Sigrid Berg",
  "Zara Williams", "Amara Johnson", "Kezia Mensah", "Nadia Ahmed", "Sara Hassan",
  "Valentina García", "Sofía López", "Isabella Martínez", "Camila Rodríguez", "Lucía Hernández",
  "Avery Thompson", "Riley Anderson", "Taylor Mitchell", "Morgan Wilson", "Jordan Davis",
  "Yuki Watanabe", "Hana Suzuki", "Rin Sato", "Miku Yamamoto", "Shiori Nakamura",
  "Priya Sharma", "Ananya Patel", "Divya Nair", "Meera Krishnan", "Riya Gupta",
  "Fatou Diallo", "Aminata Koné", "Adaeze Okafor", "Efua Asante", "Nkechi Eze",
];

const SENIOR_NATIONALITIES = [
  "Japan", "Brazil", "Germany", "France", "Italy", "Norway", "USA",
  "Australia", "Canada", "Spain", "South Korea", "Netherlands",
  "Ghana", "Sweden", "Denmark", "Switzerland", "Brazil", "USA", "Australia",
];

const POSITIONS = ["setter", "spiker", "defender", "blocker", "server", "all_rounder"] as const;

const YOUTH_NAMES = [
  "Emma Weber", "Lena Müller", "Sophie Braun", "Hannah Fischer", "Laura Becker",
  "Chloé Dupont", "Amélie Martin", "Inès Bernard", "Zoé Petit", "Léa Moreau",
  "Mia Rossi", "Sofia Ferrari", "Giulia Romano", "Elena Ricci", "Chiara Bruno",
  "Freya Andersen", "Maja Pedersen", "Astrid Larsen", "Ingrid Johansen", "Sigrid Berg",
  "Valentina García", "Sofía López", "Isabella Martínez", "Camila Rodríguez",
  "Fatou Diallo", "Aminata Koné", "Adaeze Okafor", "Efua Asante", "Nkechi Eze",
  "Abena Amponsah", "Ama Boateng", "Chiamaka Obi", "Ngozi Eze", "Adaora Nwosu",
  "Nadia Ahmed", "Sara Hassan", "Layla Omar", "Amina Ndiaye",
  "Avery Thompson", "Riley Anderson", "Taylor Mitchell", "Morgan Wilson", "Jordan Davis",
  "Brooke Sullivan", "Paige Harris", "Sydney Clark", "Kayla Lewis", "Alexis Walker",
  "Ana Souza", "Camila Lima", "Isabela Costa", "Mariana Santos", "Julia Oliveira",
  "Valentina Ramos", "Lucía Fernández", "Sofía Castro", "Gabriela Moreno", "Daniela Ruiz",
  "Aiko Tanaka", "Yuna Park", "Mei Lin", "Sakura Ito", "Ji-Young Kim",
  "Yuki Watanabe", "Hana Suzuki", "Rin Sato", "Miku Yamamoto", "Shiori Nakamura",
  "Priya Sharma", "Ananya Patel", "Divya Nair", "Meera Krishnan",
  "Zoe Harrison", "Chloe Martin", "Emma Wilson", "Lily Thompson", "Grace Anderson",
  "Mia Cooper", "Ella Davis", "Sophie Evans", "Charlotte Moore", "Olivia Turner",
];

const YOUTH_NATIONALITIES = [
  "Germany", "France", "Italy", "Spain", "Norway", "Sweden", "Netherlands", "Poland", "Denmark",
  "Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Egypt", "Morocco",
  "USA", "Canada",
  "Brazil", "Colombia", "Argentina", "Chile",
  "Japan", "South Korea", "China", "India", "Thailand",
  "Australia", "New Zealand",
];

const YOUTH_SPECIALITIES = ["Power", "Defense", "Serve", "Speed", "Block", "All-Rounder"] as const;

const STAFF_ROLES: StaffRole[] = [
  "head_coach", "assistant_coach", "fitness_trainer",
  "strength_conditioner", "massage_therapist", "promotions_manager",
];

type TestItem = {
  name: string;
  age: number;
  nationality: string;
  roleOrPosition: string;
  imageUrl: string;
  sourceSystem: string;
};

function generateSeniorPlayerItem(): TestItem {
  const name = pick(SENIOR_NAMES);
  const nationality = pick(SENIOR_NATIONALITIES);
  const age = rand(17, 20);
  const position = pick(POSITIONS);
  return {
    name,
    age,
    nationality,
    roleOrPosition: position,
    imageUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name + "_draft")}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear`,
    sourceSystem: "Draft (Senior)",
  };
}

function generateYouthPlayerItem(): TestItem {
  const name = pick(YOUTH_NAMES);
  const nationality = pick(YOUTH_NATIONALITIES);
  const age = rand(14, 18);
  const speciality = pick(YOUTH_SPECIALITIES);
  const position = (speciality === "Serve" || speciality === "Defense") ? "setter" : "spiker";
  return {
    name,
    age,
    nationality,
    roleOrPosition: position,
    imageUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name + "_youth")}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear`,
    sourceSystem: "Youth Scouting",
  };
}

router.post("/dev/generate-test", (req, res) => {
  const body = req.body as { type?: string; count?: number };
  const { type } = body;
  const safeCount = Math.min(200, Math.max(1, Number(body.count) || 100));

  const results: TestItem[] = [];

  switch (type) {
    case "senior_players":
      for (let i = 0; i < safeCount; i++) results.push(generateSeniorPlayerItem());
      break;

    case "youth_players":
      for (let i = 0; i < safeCount; i++) results.push(generateYouthPlayerItem());
      break;

    case "staff":
      for (let i = 0; i < safeCount; i++) {
        const s = generateStaffMember(pick(STAFF_ROLES));
        results.push({
          name:           s.name,
          age:            s.age,
          nationality:    s.nationality,
          roleOrPosition: s.role,
          imageUrl:       s.imageUrl,
          sourceSystem:   "Staff Market",
        });
      }
      break;

    case "medical_staff":
      for (let i = 0; i < safeCount; i++) {
        const m = generateMedicalStaffMember(pick(MEDICAL_ROLES as MedicalRole[]));
        results.push({
          name:           m.name,
          age:            m.age,
          nationality:    m.nationality,
          roleOrPosition: m.role,
          imageUrl:       m.imageUrl,
          sourceSystem:   "Medical Market",
        });
      }
      break;

    default:
      res.status(400).json({ error: `Unknown type: ${type ?? "(none)"}` });
      return;
  }

  res.json(results);
});

export default router;
