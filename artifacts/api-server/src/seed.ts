import { db } from "@workspace/db";
import { playersTable, staffTable, locationsTable, promoDealsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";

const playerNames = [
  "Ana Silva","Beatriz Costa","Carolina Lima","Diana Ferreira","Elena Santos",
  "Fernanda Oliveira","Gabriela Rocha","Helena Martins","Isabel Souza","Julia Pereira",
  "Katarina Novak","Laura Müller","Maria Garcia","Natalia López","Olivia Brown",
  "Petra Wagner","Quinn Davis","Rosa Mendez","Sofia Andersen","Tina Larsson",
  "Uma Johansson","Valentina Rossi","Wanda Kowalski","Xena Papadopoulos","Yuki Tanaka",
  "Zara Ahmed","Amara Diallo","Bianca Nkosi","Chiara Bianchi","Daria Ivanova",
  "Ekaterina Volkov","Fatima Al-Rashid","Giselle Dupont","Hana Sato","Ingrid Berg",
  "Jana Horak","Keiko Yamamoto","Lena Fischer","Maya Patel","Nadia Okafor",
];

const staffNames = [
  "Sarah Johnson","Michelle Rodriguez","Jennifer Williams","Karen Thompson","Lisa Anderson",
  "Patricia Martinez","Sandra Taylor","Christine Wilson","Dorothy Moore","Ruth Jackson",
];

const locationNames = [
  "Rio de Janeiro","Sydney","Cancun","Barcelona","Miami",
  "Honolulu","Phuket","Gold Coast","Maldives","Ibiza",
];

const sponsorNames = [
  "SunBurst Sports","WaveRider Gear","VolleyPro","BeachQueen","SandStorm Energy",
  "CoastalWear","TidalForce","PalmBay","AquaVolt","CoastalChic",
];

const getPlayerImageUrl = (name: string) =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear`;

const getStaffImageUrl = (name: string) =>
  `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(name + "_coach")}&backgroundColor=b6e3f4,ffd5dc,d1d4f9`;

const getLocationImageUrl = (city: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(city.toLowerCase())}/800/500`;

const getSponsorImageUrl = (name: string) =>
  `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name)}&backgroundColor=4CAF50,2196F3,FF9800,9C27B0,F44336`;

async function main() {
  console.log("Starting seed...");

  const allPlayers = await db.select().from(playersTable);
  console.log(`Found ${allPlayers.length} players to update`);

  for (const player of allPlayers) {
    const imageUrl = getPlayerImageUrl(player.name);
    const updates: Record<string, unknown> = { imageUrl };

    if (player.isDraftPlayer) {
      updates.age = Math.floor(Math.random() * 4) + 17;
    }

    await db.update(playersTable)
      .set(updates)
      .where(eq(playersTable.id, player.id));
  }
  console.log("Players updated with images and draft ages");

  const allStaff = await db.select().from(staffTable);
  console.log(`Found ${allStaff.length} staff to update`);

  for (const member of allStaff) {
    await db.update(staffTable)
      .set({ imageUrl: getStaffImageUrl(member.name) })
      .where(eq(staffTable.id, member.id));
  }
  console.log("Staff updated with images");

  const allLocations = await db.select().from(locationsTable);
  console.log(`Found ${allLocations.length} locations to update`);

  for (const loc of allLocations) {
    await db.update(locationsTable)
      .set({ imageUrl: getLocationImageUrl(loc.city) })
      .where(eq(locationsTable.id, loc.id));
  }
  console.log("Locations updated with images");

  const allDeals = await db.select().from(promoDealsTable);
  console.log(`Found ${allDeals.length} promo deals to update`);

  for (const deal of allDeals) {
    await db.update(promoDealsTable)
      .set({ imageUrl: getSponsorImageUrl(deal.sponsor) })
      .where(eq(promoDealsTable.id, deal.id));
  }
  console.log("Promo deals updated with sponsor images");

  console.log("Seed complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
