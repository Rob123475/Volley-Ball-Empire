import { sqlite } from "@workspace/db";

const dice = (name: string, bg = "b6e3f4") =>
  `https://api.dicebear.com/7.x/lorelei/png?seed=${encodeURIComponent(name)}&size=200&backgroundColor=${bg}`;

// Stat helper: generates an attribute score centred on `avg` with spread ±spread
function s(avg: number, spread = 10): number {
  const v = avg + (Math.random() - 0.5) * spread * 2;
  return Math.max(40, Math.min(99, Math.round(v)));
}

// Build a stat block based on overall rating and position
function stats(ovr: number, pos: "setter" | "spiker") {
  if (pos === "setter") {
    return { speed: s(ovr, 8), power: s(ovr - 5, 10), defense: s(ovr + 5, 8), serve: s(ovr + 3, 8), block: s(ovr - 2, 8), stamina: s(ovr, 7) };
  }
  return { speed: s(ovr + 3, 8), power: s(ovr + 5, 10), defense: s(ovr - 5, 8), serve: s(ovr, 8), block: s(ovr + 2, 8), stamina: s(ovr, 7) };
}

function potential(): string {
  const r = Math.random();
  if (r < 0.12) return "Low";
  if (r < 0.48) return "Average";
  if (r < 0.78) return "High";
  if (r < 0.94) return "Elite";
  return "Generational";
}

// salary() lived here and is gone: the wage is career state now and is derived
// from asking_price. Leaving it would have been an invitation to reintroduce a
// reference-row salary.
function askingPrice(ovr: number): number {
  return Math.round((ovr - 60) * 800 + 15000 + Math.random() * 5000);
}

// ── Continent assignment for ALL existing senior players ───────────────────────
const EXISTING_CONTINENT: Record<number, string> = {
  1:  "South America", // Valentina Costa, Brazil
  2:  "Africa",        // Aisha Okonkwo, Nigeria
  3:  "Asia",          // Mei Xing, China
  5:  "South America", // Camila Rivera, Argentina
  6:  "Asia",          // Priya Sharma, India
  7:  "Asia",          // Yuki Tanaka, Japan
  9:  "Europe",        // Elena Kovacs, Hungary
  10: "Oceania",       // Zara Williams, Australia
  11: "Europe",        // Isabella Müller, Germany
  12: "Africa",        // Fatima Al-Rashid, Egypt
  13: "Europe",        // Lucía Fernández, Spain
  14: "Africa",        // Nia Adeyemi, Ghana
  15: "Asia",          // Hana Kim, South Korea
  16: "Europe",        // Astrid Larsen, Norway
  17: "South America", // Bianca Santos, Brazil
  18: "Africa",        // Rania Khalil, Morocco
  19: "Europe",        // Serena Bianchi, Italy
  20: "North America", // Aaliya Jackson, USA
  21: "Europe",        // Oksana Petrenko, Ukraine
  22: "Asia",          // Miriam Nakamura, Japan
  23: "Africa",        // Laila Ahmed, Tunisia
  24: "North America", // Nadia Dupont, Canada
  25: "Africa",        // Thandi Dlamini, South Africa
  26: "Europe",        // Vera Petrakis, Greece
  27: "Oceania",       // Zoe Thompson, New Zealand
  28: "North America", // Carmen López, Mexico
  29: "Europe",        // Ingrid Svensson, Sweden
  30: "Asia",          // Keiko Watanabe, Japan
  31: "Europe",        // Anika Becker, Germany
  33: "Europe",        // Petra Novak, Czech Republic
};

// IDs to DELETE (Europe overflow free agents, and old malformed youth reserves)
const DELETE_IDS = [4, 8, 41, 42, 43, 44, 45, 46, 47, 48];

// ── New Senior Players (30 total — fills each continent to 10) ────────────────
type SeniorDef = { name: string; age: number; nationality: string; continent: string; pos: "setter" | "spiker"; height: number; ovr: number; };
const NEW_SENIORS: SeniorDef[] = [
  // Africa (4 — brings Africa to 10)
  { name: "Destiny Brown",       age: 26, nationality: "Kenya",        continent: "Africa",        pos: "spiker", height: 175, ovr: 78 },
  { name: "Precious Osei",       age: 23, nationality: "Ghana",        continent: "Africa",        pos: "setter", height: 170, ovr: 72 },
  { name: "Adaeze Nwosu",        age: 28, nationality: "Nigeria",      continent: "Africa",        pos: "spiker", height: 178, ovr: 80 },
  { name: "Nomvula Dube",        age: 25, nationality: "South Africa", continent: "Africa",        pos: "setter", height: 172, ovr: 74 },
  // Asia (4 — brings Asia to 10)
  { name: "Ji-Yeon Park",        age: 24, nationality: "South Korea",  continent: "Asia",          pos: "setter", height: 173, ovr: 76 },
  { name: "Sakura Yamaguchi",    age: 22, nationality: "Japan",        continent: "Asia",          pos: "spiker", height: 171, ovr: 70 },
  { name: "Xiao Ling",           age: 27, nationality: "China",        continent: "Asia",          pos: "spiker", height: 179, ovr: 79 },
  { name: "Anjali Menon",        age: 25, nationality: "India",        continent: "Asia",          pos: "setter", height: 169, ovr: 72 },
  // North America (7 — brings North America to 10)
  { name: "Jessica Hawkins",     age: 25, nationality: "USA",          continent: "North America", pos: "spiker", height: 176, ovr: 77 },
  { name: "Brittany Torres",     age: 23, nationality: "USA",          continent: "North America", pos: "setter", height: 170, ovr: 71 },
  { name: "Michelle Leblanc",    age: 27, nationality: "Canada",       continent: "North America", pos: "spiker", height: 177, ovr: 79 },
  { name: "Ashley Stevens",      age: 24, nationality: "USA",          continent: "North America", pos: "setter", height: 172, ovr: 74 },
  { name: "Gabrielle Jordan",    age: 28, nationality: "USA",          continent: "North America", pos: "spiker", height: 178, ovr: 82 },
  { name: "Rosa Gutierrez",      age: 23, nationality: "Mexico",       continent: "North America", pos: "setter", height: 169, ovr: 69 },
  { name: "Sophia Reyes",        age: 26, nationality: "USA",          continent: "North America", pos: "spiker", height: 175, ovr: 76 },
  // South America (7 — brings South America to 10)
  { name: "Mariana Oliveira",    age: 25, nationality: "Brazil",       continent: "South America", pos: "spiker", height: 177, ovr: 78 },
  { name: "Ana Beatriz Lima",    age: 24, nationality: "Brazil",       continent: "South America", pos: "setter", height: 170, ovr: 73 },
  { name: "Fernanda Castro",     age: 27, nationality: "Brazil",       continent: "South America", pos: "spiker", height: 180, ovr: 81 },
  { name: "Daniela Herrera",     age: 23, nationality: "Colombia",     continent: "South America", pos: "setter", height: 171, ovr: 70 },
  { name: "Paola Torres",        age: 26, nationality: "Peru",         continent: "South America", pos: "spiker", height: 175, ovr: 75 },
  { name: "Florencia Sosa",      age: 22, nationality: "Argentina",    continent: "South America", pos: "setter", height: 169, ovr: 68 },
  { name: "Gabriela Reyes",      age: 28, nationality: "Chile",        continent: "South America", pos: "spiker", height: 176, ovr: 78 },
  // Oceania (8 — brings Oceania to 10)
  { name: "Emily Chen",          age: 24, nationality: "Australia",    continent: "Oceania",       pos: "setter", height: 171, ovr: 74 },
  { name: "Jessica Park",        age: 26, nationality: "Australia",    continent: "Oceania",       pos: "spiker", height: 177, ovr: 78 },
  { name: "Brooke Andrews",      age: 23, nationality: "Australia",    continent: "Oceania",       pos: "setter", height: 170, ovr: 70 },
  { name: "Madison Hughes",      age: 27, nationality: "Australia",    continent: "Oceania",       pos: "spiker", height: 178, ovr: 79 },
  { name: "Caitlin Walsh",       age: 25, nationality: "New Zealand",  continent: "Oceania",       pos: "setter", height: 172, ovr: 75 },
  { name: "Olivia Mitchell",     age: 22, nationality: "New Zealand",  continent: "Oceania",       pos: "spiker", height: 174, ovr: 72 },
  { name: "Charlotte Reid",      age: 28, nationality: "New Zealand",  continent: "Oceania",       pos: "spiker", height: 179, ovr: 80 },
  { name: "Rebecca Tran",        age: 24, nationality: "Australia",    continent: "Oceania",       pos: "setter", height: 169, ovr: 72 },
];

// ── Youth Players (60 total — 10 per continent, ages 14–18) ───────────────────
type YouthDef = { name: string; age: number; nationality: string; continent: string; pos: "setter" | "spiker"; height: number; };
const NEW_YOUTH: YouthDef[] = [
  // Africa (10)
  { name: "Amina Kamara",        age: 16, nationality: "Sierra Leone",   continent: "Africa",        pos: "spiker", height: 168 },
  { name: "Fatou Diallo",        age: 15, nationality: "Senegal",         continent: "Africa",        pos: "setter", height: 165 },
  { name: "Aissatou Bah",        age: 17, nationality: "Guinea",          continent: "Africa",        pos: "spiker", height: 170 },
  { name: "Nkechi Okonkwo",      age: 15, nationality: "Nigeria",         continent: "Africa",        pos: "setter", height: 166 },
  { name: "Aicha Touré",         age: 14, nationality: "Mali",            continent: "Africa",        pos: "spiker", height: 167 },
  { name: "Mariam Kouyaté",      age: 16, nationality: "Guinea",          continent: "Africa",        pos: "setter", height: 164 },
  { name: "Yewande Adeyemi",     age: 17, nationality: "Nigeria",         continent: "Africa",        pos: "spiker", height: 171 },
  { name: "Salmata Coulibaly",   age: 15, nationality: "Burkina Faso",    continent: "Africa",        pos: "setter", height: 165 },
  { name: "Rokiatou Diallo",     age: 16, nationality: "Mali",            continent: "Africa",        pos: "spiker", height: 168 },
  { name: "Adjoa Mensah",        age: 18, nationality: "Ghana",           continent: "Africa",        pos: "setter", height: 169 },
  // Asia (10)
  { name: "Yuna Choi",           age: 16, nationality: "South Korea",     continent: "Asia",          pos: "setter", height: 167 },
  { name: "Mina Kobayashi",      age: 15, nationality: "Japan",           continent: "Asia",          pos: "spiker", height: 168 },
  { name: "Ling Chen",           age: 17, nationality: "China",           continent: "Asia",          pos: "spiker", height: 172 },
  { name: "Phuong Nguyen",       age: 15, nationality: "Vietnam",         continent: "Asia",          pos: "setter", height: 163 },
  { name: "Nuan Saengsai",       age: 16, nationality: "Thailand",        continent: "Asia",          pos: "setter", height: 165 },
  { name: "Divya Krishnan",      age: 17, nationality: "India",           continent: "Asia",          pos: "spiker", height: 169 },
  { name: "Ayesha Malik",        age: 14, nationality: "Pakistan",        continent: "Asia",          pos: "setter", height: 163 },
  { name: "Suki Park",           age: 18, nationality: "South Korea",     continent: "Asia",          pos: "spiker", height: 170 },
  { name: "Mei Lin Zhang",       age: 15, nationality: "China",           continent: "Asia",          pos: "setter", height: 167 },
  { name: "Nozomi Ito",          age: 16, nationality: "Japan",           continent: "Asia",          pos: "spiker", height: 169 },
  // Europe (10)
  { name: "Emma Schmidt",        age: 16, nationality: "Germany",         continent: "Europe",        pos: "spiker", height: 172 },
  { name: "Lena Johansson",      age: 15, nationality: "Sweden",          continent: "Europe",        pos: "setter", height: 168 },
  { name: "Sophie Bernard",      age: 17, nationality: "France",          continent: "Europe",        pos: "spiker", height: 173 },
  { name: "Isabel García",       age: 15, nationality: "Spain",           continent: "Europe",        pos: "setter", height: 166 },
  { name: "Chiara Romano",       age: 16, nationality: "Italy",           continent: "Europe",        pos: "spiker", height: 170 },
  { name: "Anna Kowalska",       age: 17, nationality: "Poland",          continent: "Europe",        pos: "setter", height: 167 },
  { name: "Maja Andersen",       age: 14, nationality: "Denmark",         continent: "Europe",        pos: "spiker", height: 165 },
  { name: "Liisa Mäkinen",       age: 18, nationality: "Finland",         continent: "Europe",        pos: "setter", height: 170 },
  { name: "Petra Horváth",       age: 15, nationality: "Hungary",         continent: "Europe",        pos: "spiker", height: 168 },
  { name: "Nataliya Kovalenko",  age: 16, nationality: "Ukraine",         continent: "Europe",        pos: "setter", height: 167 },
  // North America (10)
  { name: "Madison Johnson",     age: 16, nationality: "USA",             continent: "North America", pos: "spiker", height: 171 },
  { name: "Brianna Williams",    age: 15, nationality: "USA",             continent: "North America", pos: "setter", height: 167 },
  { name: "Kayla Thompson",      age: 17, nationality: "USA",             continent: "North America", pos: "spiker", height: 174 },
  { name: "Destiny Robinson",    age: 15, nationality: "USA",             continent: "North America", pos: "setter", height: 165 },
  { name: "Jasmine Carter",      age: 16, nationality: "USA",             continent: "North America", pos: "spiker", height: 170 },
  { name: "Hailey Martin",       age: 17, nationality: "Canada",          continent: "North America", pos: "setter", height: 168 },
  { name: "Alyssa Wilson",       age: 14, nationality: "Canada",          continent: "North America", pos: "spiker", height: 164 },
  { name: "Sophie Tremblay",     age: 18, nationality: "Canada",          continent: "North America", pos: "setter", height: 169 },
  { name: "Isabella Flores",     age: 15, nationality: "Mexico",          continent: "North America", pos: "spiker", height: 167 },
  { name: "Valeria Moreno",      age: 16, nationality: "Mexico",          continent: "North America", pos: "setter", height: 166 },
  // South America (10)
  { name: "Larissa Costa",       age: 16, nationality: "Brazil",          continent: "South America", pos: "spiker", height: 170 },
  { name: "Beatriz Sousa",       age: 15, nationality: "Brazil",          continent: "South America", pos: "setter", height: 166 },
  { name: "Juliana Alves",       age: 17, nationality: "Brazil",          continent: "South America", pos: "spiker", height: 173 },
  { name: "María Rodríguez",     age: 15, nationality: "Colombia",        continent: "South America", pos: "setter", height: 165 },
  { name: "Valentina Mora",      age: 16, nationality: "Colombia",        continent: "South America", pos: "spiker", height: 168 },
  { name: "Lucía Castillo",      age: 17, nationality: "Peru",            continent: "South America", pos: "setter", height: 167 },
  { name: "Camila Torres",       age: 14, nationality: "Argentina",       continent: "South America", pos: "spiker", height: 163 },
  { name: "Sofia Vega",          age: 18, nationality: "Argentina",       continent: "South America", pos: "setter", height: 170 },
  { name: "Natalia Bravo",       age: 15, nationality: "Chile",           continent: "South America", pos: "spiker", height: 167 },
  { name: "Andrea Espinoza",     age: 16, nationality: "Ecuador",         continent: "South America", pos: "setter", height: 165 },
  // Oceania (10)
  { name: "Lily Anderson",       age: 16, nationality: "Australia",       continent: "Oceania",       pos: "spiker", height: 170 },
  { name: "Chloe Robinson",      age: 15, nationality: "Australia",       continent: "Oceania",       pos: "setter", height: 167 },
  { name: "Grace Murphy",        age: 17, nationality: "Australia",       continent: "Oceania",       pos: "spiker", height: 173 },
  { name: "Sophia Williams",     age: 15, nationality: "Australia",       continent: "Oceania",       pos: "setter", height: 165 },
  { name: "Ruby Thompson",       age: 16, nationality: "Australia",       continent: "Oceania",       pos: "spiker", height: 171 },
  { name: "Hannah Davis",        age: 17, nationality: "New Zealand",     continent: "Oceania",       pos: "setter", height: 168 },
  { name: "Ella Wilson",         age: 14, nationality: "New Zealand",     continent: "Oceania",       pos: "spiker", height: 164 },
  { name: "Mia Campbell",        age: 18, nationality: "New Zealand",     continent: "Oceania",       pos: "setter", height: 169 },
  { name: "Zoe Harris",          age: 15, nationality: "New Zealand",     continent: "Oceania",       pos: "spiker", height: 167 },
  { name: "Amy Parker",          age: 16, nationality: "New Zealand",     continent: "Oceania",       pos: "setter", height: 165 },
];

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("▶ Starting player expansion…\n");

  // 1. Delete excess / malformed players
  console.log(`Deleting ${DELETE_IDS.length} players: ${DELETE_IDS.join(", ")}`);
  const deletePlaceholders = DELETE_IDS.map(() => "?").join(",");
  sqlite.prepare(`DELETE FROM players WHERE id IN (${deletePlaceholders})`).run(...DELETE_IDS);

  // 2. Tag existing seniors with continent + player_type
  console.log("\nTagging existing senior players with continent…");
  for (const [idStr, continent] of Object.entries(EXISTING_CONTINENT)) {
    sqlite.prepare(
      `UPDATE players SET continent = ?, player_type = 'senior' WHERE id = ?`
    ).run(continent, parseInt(idStr));
  }

  // 3. Insert new senior free agents
  console.log(`\nInserting ${NEW_SENIORS.length} new senior players…`);
  // salary, is_active, squad_role, is_injured, fitness, morale and fatigue have
  // all moved to career_player_state, so a reference-row INSERT can no longer
  // name them — this statement would have failed with "no such column: salary".
  // asking_price stays and is what the starting wage is derived from.
  const insertSenior = sqlite.prepare(`
    INSERT INTO players
       (name, nationality, age, height, position, speed, power, defense, serve, block, stamina,
        asking_price, continent, player_type, potential, image_url, is_retired)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'senior',?,?,false)
  `);
  for (const p of NEW_SENIORS) {
    const st = stats(p.ovr, p.pos);
    const ap  = askingPrice(p.ovr);
    insertSenior.run(
      p.name, p.nationality, p.age, p.height, p.pos,
      st.speed, st.power, st.defense, st.serve, st.block, st.stamina,
      ap, p.continent,
      potential(), dice(p.name, "b6e3f4"),
    );
    console.log(`  ✓ ${p.name} (${p.continent}, OVR ${p.ovr})`);
  }

  // 4. Insert youth players
  console.log(`\nInserting ${NEW_YOUTH.length} new youth players…`);
  // Same as the senior insert above. Youth carry no asking_price and every
  // youth in the shipped data sits at salary 0, so nothing is lost by dropping
  // the literal 1500 rather than moving it.
  const insertYouth = sqlite.prepare(`
    INSERT INTO players
       (name, nationality, age, height, position, speed, power, defense, serve, block, stamina,
        continent, player_type, potential, image_url, is_retired)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'youth',?,?,false)
  `);
  for (const p of NEW_YOUTH) {
    const yOvr = 45 + Math.round((p.age - 14) * 3 + Math.random() * 12);
    const st = stats(yOvr, p.pos);
    insertYouth.run(
      p.name, p.nationality, p.age, p.height, p.pos,
      st.speed, st.power, st.defense, st.serve, st.block, st.stamina,
      p.continent, potential(), dice(p.name, "ffd5dc"),
    );
    console.log(`  ✓ ${p.name} (${p.continent}, age ${p.age})`);
  }

  // 5. Validation report
  console.log("\n── Validation ──────────────────────────────────────────────");
  const counts = sqlite.prepare(`
    SELECT player_type, continent, COUNT(*) AS n
    FROM players
    WHERE is_retired = false
    GROUP BY player_type, continent
    ORDER BY player_type, continent
  `).all();
  const totals = sqlite.prepare(`
    SELECT player_type, COUNT(*) AS n
    FROM players WHERE is_retired = false
    GROUP BY player_type ORDER BY player_type
  `).all();
  console.table(counts);
  console.table(totals);

  // Age checks
  const ageViolations = sqlite.prepare(`
    SELECT id, name, age, player_type
    FROM players
    WHERE is_retired = false
      AND (
        (player_type = 'senior' AND (age < 18 OR age > 40))
        OR (player_type = 'youth' AND (age < 14 OR age > 18))
      )
  `).all();
  if (ageViolations.length > 0) {
    console.warn("⚠ Age violations:", ageViolations);
  } else {
    console.log("✅ All age ranges valid.");
  }

  console.log("\n✅ Expansion complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("Expansion failed:", err);
  process.exit(1);
});
