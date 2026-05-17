import { pool } from "@workspace/db";

// Deterministic hash → same photo every time for the same person
const nameHash = (s: string, mod: number) =>
  Math.abs(s.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) % mod;

// randomuser.me women's portrait library — 100 real professional photos, indices 0–99
const getPlayerImageUrl = (name: string) =>
  `https://randomuser.me/api/portraits/women/${nameHash(name, 100)}.jpg`;

// randomuser.me women's portrait library — 100 real professional photos, indices 0–99
// Directly constructed URL guarantees gender-correct headshots every time.
const getStaffImageUrl = (name: string) =>
  `https://randomuser.me/api/portraits/women/${nameHash(name + "_staff", 100)}.jpg`;

const getLocationImageUrl = (city: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(city.toLowerCase())}/800/500`;

// Hand-picked Unsplash keyword searches — one per sponsor so images are always on-brand
const SPONSOR_IMAGES: Record<string, string> = {
  "Sunny Sport Sunscreen":     "https://source.unsplash.com/600x300/?sunscreen,spf,sun-lotion",
  "CoastalWave Swimwear":      "https://source.unsplash.com/600x300/?swimwear,bikini,beachwear",
  "ProHydrate Sports Drinks":  "https://source.unsplash.com/600x300/?sports-drink,electrolyte,bottle",
  "AirJump Footwear":          "https://source.unsplash.com/600x300/?sneakers,athletic-shoes,trainers",
  "TurboNet Sports Equipment": "https://source.unsplash.com/600x300/?volleyball,net,beach-sport",
  "VitaBoost Supplements":     "https://source.unsplash.com/600x300/?protein,supplement,fitness-nutrition",
  "BeachGlow Beauty":          "https://source.unsplash.com/600x300/?skincare,beauty,cosmetics",
  "SandMaster Courts":         "https://source.unsplash.com/600x300/?beach-volleyball-court,sand,arena",
};
const getSponsorImageUrl = (name: string) =>
  SPONSOR_IMAGES[name] ?? "https://source.unsplash.com/600x300/?sports,brand";

async function main() {
  const client = await pool.connect();
  console.log("Starting seed...");

  try {
    const players = await client.query("SELECT id, name, is_draft_player FROM players");
    console.log(`Updating ${players.rows.length} players...`);
    for (const p of players.rows) {
      const imageUrl = getPlayerImageUrl(p.name);
      if (p.is_draft_player) {
        const age = Math.floor(Math.random() * 4) + 17;
        await client.query("UPDATE players SET image_url = $1, age = $2 WHERE id = $3", [imageUrl, age, p.id]);
      } else {
        await client.query("UPDATE players SET image_url = $1 WHERE id = $2", [imageUrl, p.id]);
      }
    }
    console.log("Players done.");

    const staff = await client.query("SELECT id, name FROM staff");
    console.log(`Updating ${staff.rows.length} staff...`);
    for (const s of staff.rows) {
      const imageUrl = getStaffImageUrl(s.name);
      await client.query("UPDATE staff SET image_url = $1 WHERE id = $2", [imageUrl, s.id]);
      console.log(`  ${s.name} → ${imageUrl}`);
    }
    console.log("Staff done.");

    const locations = await client.query("SELECT id, city FROM locations");
    console.log(`Updating ${locations.rows.length} locations...`);
    for (const loc of locations.rows) {
      await client.query("UPDATE locations SET image_url = $1 WHERE id = $2", [getLocationImageUrl(loc.city), loc.id]);
    }
    console.log("Locations done.");

    // Rebalanced deal values — smaller payouts, meaningful win gates (min 1 win)
    const DEAL_STATS: Record<string, { amount: number; wins: number }> = {
      "AirJump Footwear":          { amount: 20000, wins: 8 },
      "SandMaster Courts":         { amount: 15000, wins: 7 },
      "CoastalWave Swimwear":      { amount: 12000, wins: 6 },
      "VitaBoost Supplements":     { amount: 10000, wins: 5 },
      "Sunny Sport Sunscreen":     { amount:  7000, wins: 4 },
      "TurboNet Sports Equipment": { amount:  5000, wins: 3 },
      "BeachGlow Beauty":          { amount:  3000, wins: 2 },
      "ProHydrate Sports Drinks":  { amount:  2000, wins: 1 },
    };
    const deals = await client.query("SELECT id, sponsor FROM promo_deals");
    console.log(`Updating ${deals.rows.length} promo deals...`);
    for (const d of deals.rows) {
      const img = getSponsorImageUrl(d.sponsor);
      const stats = DEAL_STATS[d.sponsor];
      if (stats) {
        await client.query(
          "UPDATE promo_deals SET image_url = $1, amount = $2, requirement_wins = $3 WHERE id = $4",
          [img, stats.amount, stats.wins, d.id]
        );
        console.log(`  ${d.sponsor} → $${stats.amount}, ${stats.wins} wins req`);
      } else {
        await client.query("UPDATE promo_deals SET image_url = $1 WHERE id = $2", [img, d.id]);
      }
    }
    console.log("Promo deals done.");

    console.log("Seed complete!");
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
