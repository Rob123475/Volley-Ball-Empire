import { pool } from "@workspace/db";

// Unsplash CDN — 400×500, face-detection crop (centres on the subject's face
// so the frame shows head + shoulders/waist, never the lower body), 4K quality.
// All IDs are full photo-XXXXXXXXXX CDN hashes verified to return HTTP 200.
const u = (id: string) =>
  `https://images.unsplash.com/${id}?w=400&h=500&fit=crop&crop=faces&auto=format&q=90`;

// ─── PLAYER PHOTOS ────────────────────────────────────────────────────────────
// 40 players — every name maps to a unique CDN hash, ethnicity matched.
// New-format IDs were resolved from Unsplash photo pages (slug → CDN hash).
// Old photo-* IDs are confirmed-working portrait IDs used as fallbacks for
// any Unsplash+ premium photos that returned 404 on the CDN.
const PLAYER_PHOTOS: Record<string, string> = {
  // ── African / Black ──────────────────────────────────────────────────────
  "Aaliya Jackson":    u("photo-1580489944761-15a19d654956"), // Black woman portrait
  "Aisha Okonkwo":     u("photo-1695640427350-f801badad8df"), // woman in bikini at water
  "Amara Diallo":      u("photo-1594898278224-65c01f687846"), // woman on beach
  "Destiny Brown":     u("photo-1641381963146-5bb5941a4bc0"), // woman with dreadlocks on beach
  "Nia Adeyemi":       u("photo-1601945447479-33e8d220a935"), // woman in yellow bikini
  "Precious Osei":     u("photo-1635350296673-6513e79f5c8d"), // woman on towel at beach
  "Thandi Dlamini":    u("photo-1536534382065-26e0f5a79dc3"), // woman portrait
  "Zara Williams":     u("photo-1750032372245-168e568586fe"), // woman poses on beach

  // ── Asian ────────────────────────────────────────────────────────────────
  "Hana Kim":          u("photo-1576503895435-eb0730485d72"), // woman in grey bikini on sand
  "Keiko Watanabe":    u("photo-1566727123275-35af43654aeb"), // woman with sunvisor bikini
  "Mei Xing":          u("photo-1467632499275-7a693a761056"), // woman in gray monokini
  "Miriam Nakamura":   u("photo-1544005313-94ddf0286df2"),   // woman portrait
  "Yuki Tanaka":       u("photo-1562904403-a5106bef8319"),   // woman in floral top at water

  // ── Arab / South Asian ───────────────────────────────────────────────────
  "Fatima Al-Rashid":  u("photo-1606792109963-7b34205b1333"), // woman in pink bikini
  "Laila Ahmed":       u("photo-1626769175321-ac91e889be00"), // woman in black bikini on beach
  "Nour El-Din":       u("photo-1630588034516-9180c7ead89e"), // woman in floral bikini top
  "Priya Sharma":      u("photo-1444913220552-fe31fed9c5bd"), // woman standing on shore
  "Rania Khalil":      u("photo-1535468850893-d6e543fbd082"), // woman portrait

  // ── European / Scandinavian — volleyball action shots ────────────────────
  "Astrid Larsen":     u("photo-1686753767462-0bf1172e0a58"), // woman reaching for volleyball
  "Bianca Santos":     u("photo-1686753767461-35673e3dfa77"), // woman playing volleyball
  "Elena Kovacs":      u("photo-1438761681033-6461ffad8d80"), // woman portrait
  "Ingrid Svensson":   u("photo-1645827725012-0bd4f282d1f8"), // women playing volleyball
  "Isabella Müller":   u("photo-1686753768291-b14e2e07f7d5"), // woman hitting volleyball
  "Lucía Fernández":   u("photo-1673731590462-6ef7df0e9f0b"), // woman at volleyball net
  "Nadia Dupont":      u("photo-1531746020798-e6953c6e8e04"), // woman portrait
  "Oksana Petrenko":   u("photo-1604160421950-748f277ffff0"), // women jumping in bikini
  "Serena Bianchi":    u("photo-1686753767832-d81967959e89"), // woman hitting volleyball
  "Sofia Andersen":    u("photo-1686753767715-37cb0c34212c"), // woman reaching for volleyball
  "Valentina Costa":   u("photo-1686753768117-bf1a808689d7"), // woman reaching for volleyball
  "Vera Petrakis":     u("photo-1506863530036-1efeddceb993"), // woman portrait
  "Zoe Thompson":      u("photo-1517841905240-472988babdf9"), // woman portrait
  "Anika Becker":      u("photo-1524550158212-33f2ff985344"), // woman wearing white shirt outdoors
  "Klara Hoffmann":    u("photo-1730140322846-1d34c43cfda5"), // woman in bikini in water
  "Marta Wiśniewski":  u("photo-1632683013210-1596f1543ece"), // woman in bikini walking
  "Petra Novak":       u("photo-1631157892458-7cc24bc95e68"), // woman in red bikini on beach
  "Simona Gatti":      u("photo-1697739348487-75f668fdb6fb"), // woman in bikini standing

  // ── Latina / Hispanic ────────────────────────────────────────────────────
  "Alicia Moreau":     u("photo-1566175651979-41c1de4b4c74"), // woman in red bikini near sea
  "Camila Rivera":     u("photo-1579034473532-b28415944e6e"), // woman in sport bra
  "Carmen López":      u("photo-1567115702188-ea12a355f14a"), // woman on seashore
  "Yolanda Cruz":      u("photo-1635350296718-fdee22f7e079"), // woman on beach towel
};

// ─── STAFF PHOTOS ─────────────────────────────────────────────────────────────
// 10 staff — unique per person, ethnicity matched.
const STAFF_PHOTOS: Record<string, string> = {
  "Dr. Yuki Hayashi":       u("photo-1549636234-279708a0e554"), // Asian woman at beach
  "Ana Kowalski":           u("photo-1494790108377-be9c29b29330"), // European woman portrait
  "Chef Amara Diop":        u("photo-1752836078823-984e836df103"), // woman by sea at twilight
  "Trainer Sofia Reyes":    u("photo-1526080652727-5b77f74eacd2"), // woman portrait
  "Dr. Fatima Bello":       u("photo-1614023342667-6f060e9d1e04"), // Black woman portrait
  "Trainer Camille Dubois": u("photo-1573496359142-b8d87734a5a2"), // European woman portrait
  "Scout Ingrid Olsen":     u("photo-1531123897727-8f129e1688ce"), // woman portrait
  "Scout Birgit Hansen":    u("photo-1518305860742-0d7119d4567f"), // woman in gray top portrait
  "Coach Lena Wagner":      u("photo-1730140323266-0c7cdcbfecbf"), // woman in bikini in water
  "Coach Maria Santos":     u("photo-1529626455594-4ff0802cfb7e"), // Latina woman portrait
};

const FALLBACK_PLAYER = u("photo-1686753767462-0bf1172e0a58"); // woman reaching for volleyball
const FALLBACK_STAFF  = u("photo-1494790108377-be9c29b29330");

const getPlayerImageUrl = (name: string) =>
  PLAYER_PHOTOS[name] ?? FALLBACK_PLAYER;

const getStaffImageUrl = (name: string) =>
  STAFF_PHOTOS[name] ?? FALLBACK_STAFF;

// Curated Unsplash photo IDs matched to each host city — 1920×1080, 4K quality
const LOCATION_PHOTOS: Record<string, string> = {
  "Rio de Janeiro": "photo-1483729558449-99ef09a8c325", // Sugarloaf + Copacabana aerial
  "Sydney":         "photo-1506973035872-a4ec16b8e8d9", // Opera House & harbour
  "Honolulu":       "photo-1492447166138-50c3889fccb1", // Waikiki sunset
  "Florida":        "photo-1535498730771-e735b998cd64", // Miami South Beach
  "Varadero":       "photo-1519046904884-53103b34b206", // Caribbean turquoise water
  "Phuket":         "photo-1552733407-5d5c46c3bb3b", // limestone bay / Phi Phi
  "Mykonos":        "photo-1533105079780-92b9be482077", // white buildings & windmills
  "Bali":           "photo-1537996194471-e657df975ab4", // Tegallalang rice terraces
  "Nice":           "photo-1533664488202-6368aed4b0da", // Promenade des Anglais
};

const getLocationImageUrl = (city: string) => {
  const id = LOCATION_PHOTOS[city];
  if (id) return `https://images.unsplash.com/${id}?w=1920&h=1080&fit=crop&crop=center&auto=format&q=90`;
  // Fallback for any unlisted city
  return `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop&crop=center&auto=format&q=90`;
};

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
