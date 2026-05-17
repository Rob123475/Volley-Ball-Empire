import { pool } from "@workspace/db";

// Deterministic hash → same photo every time for the same person
const nameHash = (s: string, mod: number) =>
  Math.abs(s.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) % mod;

// pravatar.cc — real stock-photo human faces at 300×300, indices 1-70
const getPlayerImageUrl = (name: string) =>
  `https://i.pravatar.cc/300?img=${nameHash(name, 70) + 1}`;

const getStaffImageUrl = (name: string) =>
  `https://i.pravatar.cc/300?img=${nameHash(name + "_staff", 70) + 1}`;

const getLocationImageUrl = (city: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(city.toLowerCase())}/800/500`;

const getSponsorImageUrl = (name: string) =>
  `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name)}`;

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
      await client.query("UPDATE staff SET image_url = $1 WHERE id = $2", [getStaffImageUrl(s.name), s.id]);
    }
    console.log("Staff done.");

    const locations = await client.query("SELECT id, city FROM locations");
    console.log(`Updating ${locations.rows.length} locations...`);
    for (const loc of locations.rows) {
      await client.query("UPDATE locations SET image_url = $1 WHERE id = $2", [getLocationImageUrl(loc.city), loc.id]);
    }
    console.log("Locations done.");

    const deals = await client.query("SELECT id, sponsor FROM promo_deals");
    console.log(`Updating ${deals.rows.length} promo deals...`);
    for (const d of deals.rows) {
      await client.query("UPDATE promo_deals SET image_url = $1 WHERE id = $2", [getSponsorImageUrl(d.sponsor), d.id]);
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
