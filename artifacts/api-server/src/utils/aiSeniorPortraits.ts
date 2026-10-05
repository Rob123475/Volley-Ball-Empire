/**
 * Final brief 5 Oct, A4 (try branch): Rob's pictures for the AI clubs' players.
 *
 * The 120 AI club players' cards are reference data: continental_pool_players
 * .image_url, 96 of them Rob's new pictures (matched by continent and skin
 * tone, scripts/portraits/ai-senior-cards.json) and 24 the cards his list
 * keeps. Saves get them at boot from the starter DB like any reference column
 * (ensureSchema REFERENCE_UPDATE_ONLY). An AI club senior already made a
 * career player in a save (the Player Market does that the first time it lists
 * them, utils/aiSquads.ts) carries her own copy of the card; one made before
 * the pictures existed has none, and is given it here, once. A card she
 * already has is never changed.
 */
import { db, careerPlayerStateTable, continentalPoolPlayersTable, playersTable } from "@workspace/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { updatePlayerReference } from "../lib/playerDto.js";

export async function giveAiSeniorsTheirPictures(): Promise<number> {
  const rows = await db.select({ playerId: careerPlayerStateTable.playerId, imageUrl: continentalPoolPlayersTable.imageUrl })
    .from(careerPlayerStateTable)
    .innerJoin(continentalPoolPlayersTable, eq(continentalPoolPlayersTable.id, careerPlayerStateTable.poolPlayerId))
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(isNotNull(continentalPoolPlayersTable.imageUrl), isNull(playersTable.imageUrl)));
  const done = new Set<number>();
  for (const r of rows) {
    if (done.has(r.playerId) || !r.imageUrl) continue;
    await updatePlayerReference(r.playerId, { imageUrl: r.imageUrl });
    done.add(r.playerId);
  }
  return done.size;
}
