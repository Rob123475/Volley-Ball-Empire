import { pool } from "@workspace/db";

// Deterministic hash → same photo every time for the same name string
const nameHash = (s: string, mod: number) =>
  Math.abs(s.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) % mod;

// Curated pool of high-quality Unsplash female portrait photo IDs.
// Served at 400×500 with face-detection crop → sharp, properly centred headshots.
const PORTRAIT_IDS = [
  "photo-1494790108377-be9c29b29330",
  "photo-1438761681033-6461ffad8d80",
  "photo-1544005313-94ddf0286df2",
  "photo-1531746020798-e6953c6e8e04",
  "photo-1529626455594-4ff0802cfb7e",
  "photo-1524504388940-b1c1722653e1",
  "photo-1506863530036-1efeddceb993",
  "photo-1543610892-0b1f7e6d8ac1",
  "photo-1541823709867-1b206113181a",
  "photo-1488426862026-3ee34a7d66df",
  "photo-1487412720507-e7ab37603c6f",
  "photo-1467632499275-7a693a761056",
  "photo-1452022449306-fa48ef26ef48",
  "photo-1496360166961-10a51d5f367a",
  "photo-1517841905240-472988babdf9",
  "photo-1522075469751-3a6694fb2f61",
  "photo-1524250502761-1ac6f2e30d43",
  "photo-1526080652727-5b77f74eacd2",
  "photo-1517365830460-955ce3be0547",
  "photo-1535468850893-d6e543fbd082",
  "photo-1529688530647-93a6e1916f5f",
  "photo-1549065332-5bc35e8cda01",
  "photo-1519699047748-de8e457a634e",
  "photo-1508214751196-bcfd4ca60f91",
  "photo-1502685104226-ee32379fefbe",
  "photo-1520813792240-56fc4a3765a7",
  "photo-1489424731084-a5d8b219a5bb",
  "photo-1534528741775-53994a69daeb",
  "photo-1508243771214-6d0bf9b1da86",
  "photo-1513956589380-bad6acb9b9d4",
  "photo-1531123897727-8f129e1688ce",
  "photo-1573496359142-b8d87734a5a2",
  "photo-1580489944761-15a19d654956",
  "photo-1590086782957-93c06ef21604",
  "photo-1536534382065-26e0f5a79dc3",
  "photo-1578774296842-c45e472b3028",
  "photo-1614023342667-6f060e9d1e04",
  "photo-1607746882042-944635dfe10e",
  "photo-1560087637-bf797bc7796a",
  "photo-1583195764036-6dc248ac07d9",
];

// Unsplash CDN: 400×500, face-crop, WebP, q=80 — sharp at any container size
const unsplashPortrait = (id: string) =>
  `https://images.unsplash.com/${id}?w=400&h=500&fit=crop&crop=faces&auto=format&q=80`;

const getPlayerImageUrl = (name: string) =>
  unsplashPortrait(PORTRAIT_IDS[nameHash(name, PORTRAIT_IDS.length)]);

// Staff use a different offset so they don't repeat the same faces as players
const getStaffImageUrl = (name: string) =>
  unsplashPortrait(PORTRAIT_IDS[nameHash(name + "_s", PORTRAIT_IDS.length)]);

const getLocationImageUrl = (city: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(city.toLowerCase())}/800/500`;

// Curated Unsplash photo IDs for sponsor cards (landscape 600×300, face-safe crop)
// Uses images.unsplash.com (the live CDN) — source.unsplash.com is shut down.
const unsplashBanner = (id: string) =>
  `https://images.unsplash.com/${id}?w=600&h=300&fit=crop&crop=center&auto=format&q=80`;

const SPONSOR_IMAGES: Record<string, string> = {
  "AirJump Footwear":          unsplashBanner("photo-1542291026-7eec264c27ff"), // red Nike runner
  "SandMaster Courts":         unsplashBanner("photo-1547153760-18fc86324498"), // beach volleyball match
  "CoastalWave Swimwear":      unsplashBanner("photo-1570295064577-4be29dbab2cf"), // woman in red swimsuit on beach
  "VitaBoost Supplements":     unsplashBanner("photo-1490645935967-10de6ba17061"), // healthy food bowls
  "Sunny Sport Sunscreen":     unsplashBanner("photo-1507525428034-b723cf961d3e"), // tropical beach / sun
  "TurboNet Sports Equipment": unsplashBanner("photo-1612872087720-bb876e2e67d1"), // volleyball net action
  "BeachGlow Beauty":          unsplashBanner("photo-1522337360788-8b13dee7a37e"), // beauty / skincare
  "ProHydrate Sports Drinks":  unsplashBanner("photo-1550673671-5ee5e3f89d90"), // sports water bottle
};
const getSponsorImageUrl = (name: string) =>
  SPONSOR_IMAGES[name] ?? unsplashBanner("photo-1476480862126-209bfaa8edc8"); // generic sport

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
