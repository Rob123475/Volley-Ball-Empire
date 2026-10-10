/**
 * Pictures brief 10 Oct: each AI club player's skin tone is her picture's band.
 *
 * Rob reshuffled his 96 AI club pictures within each continent so that every
 * player has the picture that best fits her country (scripts/portraits/
 * ai-senior-cards.json: pictureFrom), so 49 players' tones change to their new
 * picture's band. A player's tone is kept in one place, continental_pool_players
 * .skin_tone: the court reads it there for her pool row and, through
 * career_player_state.pool_player_id, for the career player she becomes (at an
 * AI club, or bought by Rob). Her career copy has no player_v4 of its own.
 *
 * The starter DB has the new tones (scripts/src/seed-pool-skin-tones.ts gives a
 * player with one of Rob's pictures her picture's band). An existing save is
 * brought forward here at boot, keyed by stable_id, and only where it still has
 * the old tone, as the 2 Oct reference corrections were (utils/referenceRenames.ts).
 * ensureReferenceData only fills a tone a save has none of (R-75), so these
 * changes reach a save through this list alone. A second boot changes nothing.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const AI_SKIN_TONE_CHANGES: ReadonlyArray<{ stableId: string; was: string; now: string }> = [
  { stableId: "AFM_01_P1", was: "Medium", now: "Dark" }, // Amara Okafor
  { stableId: "AFM_01_P2", was: "Medium Light", now: "Dark" }, // Chisom Nwosu
  { stableId: "AFM_02_P1", was: "Dark", now: "Medium Light" }, // Fatima Al-Rashid
  { stableId: "AFM_04_P1", was: "Light", now: "Medium" }, // Rania Al-Mansouri
  { stableId: "AFM_04_P2", was: "Dark", now: "Light" }, // Sara Al-Hashimi
  { stableId: "AFM_05_P1", was: "Medium Light", now: "Dark" }, // Wanjiru Kamau
  { stableId: "AFM_06_P1", was: "Dark", now: "Medium Light" }, // Nadia Benali
  { stableId: "AFM_06_P2", was: "Dark", now: "Medium Light" }, // Samira El-Fassi
  { stableId: "AFM_07_P2", was: "Medium Light", now: "Dark" }, // Efua Mensah
  { stableId: "ASI_01_P1", was: "Dark", now: "Medium Dark" }, // Yuki Tanaka
  { stableId: "ASI_01_P2", was: "Medium Light", now: "Light" }, // Aoi Yamamoto
  { stableId: "ASI_02_P1", was: "Medium Dark", now: "Medium Light" }, // Wei Lin
  { stableId: "ASI_03_P2", was: "Medium Light", now: "Light" }, // Min-Seo Kim
  { stableId: "ASI_04_P2", was: "Light", now: "Medium Light" }, // Pimchanok Meesuk
  { stableId: "ASI_05_P2", was: "Medium", now: "Medium Dark" }, // Ananya Nair
  { stableId: "ASI_06_P1", was: "Light", now: "Dark" }, // Dewi Santoso
  { stableId: "ASI_07_P2", was: "Medium Dark", now: "Medium" }, // Ana Reyes
  { stableId: "AUS_02_P2", was: "Light", now: "Medium Light" }, // Lily Mitchell
  { stableId: "AUS_03_P1", was: "Medium Dark", now: "Light" }, // Aroha Tane
  { stableId: "AUS_04_P1", was: "Medium Light", now: "Medium Dark" }, // Leilani Kahananui
  { stableId: "AUS_06_P1", was: "Dark", now: "Medium Dark" }, // Sina Faleolo
  { stableId: "AUS_07_P1", was: "Medium Dark", now: "Dark" }, // Mandy Tari
  { stableId: "AUS_07_P2", was: "Medium Dark", now: "Dark" }, // Lisa Natuman
  { stableId: "AUS_08_P1", was: "Dark", now: "Medium Dark" }, // Mele Taufa
  { stableId: "EUR_01_P1", was: "Medium Dark", now: "Medium" }, // Annika Bauer
  { stableId: "EUR_02_P1", was: "Medium", now: "Medium Dark" }, // María Alonso
  { stableId: "EUR_03_P1", was: "Light", now: "Medium Dark" }, // Élise Fontaine
  { stableId: "EUR_04_P1", was: "Light", now: "Medium" }, // Giulia Ricci
  { stableId: "EUR_04_P2", was: "Dark", now: "Medium" }, // Valentina Bianchi
  { stableId: "EUR_05_P1", was: "Medium Light", now: "Light" }, // Emma van Dijk
  { stableId: "EUR_05_P2", was: "Medium", now: "Dark" }, // Lisa de Boer
  { stableId: "EUR_06_P1", was: "Medium Dark", now: "Medium" }, // Eleni Papadaki
  { stableId: "EUR_07_P1", was: "Medium", now: "Medium Light" }, // Agnieszka Kowal
  { stableId: "EUR_08_P1", was: "Medium", now: "Light" }, // Ingrid Larsson
  { stableId: "NAM_01_P1", was: "Medium Light", now: "Medium Dark" }, // Ashley Carter
  { stableId: "NAM_01_P2", was: "Medium Dark", now: "Medium" }, // Taylor Brooks
  { stableId: "NAM_02_P1", was: "Medium Light", now: "Dark" }, // Destiny Rivera
  { stableId: "NAM_02_P2", was: "Medium Light", now: "Medium Dark" }, // Jasmine Washington
  { stableId: "NAM_03_P1", was: "Medium Dark", now: "Medium" }, // Valentina Torres
  { stableId: "NAM_03_P2", was: "Dark", now: "Medium Light" }, // Sofía Herrera
  { stableId: "NAM_04_P1", was: "Medium Dark", now: "Medium Light" }, // Lisandra Pérez
  { stableId: "NAM_04_P2", was: "Medium", now: "Dark" }, // Yoanna Fuentes
  { stableId: "NAM_06_P2", was: "Medium", now: "Medium Light" }, // Cassandra Tremblay
  { stableId: "NAM_08_P1", was: "Dark", now: "Medium Dark" }, // Mariela Colon
  { stableId: "SAM_01_P1", was: "Medium Dark", now: "Medium Light" }, // Fernanda Silva
  { stableId: "SAM_02_P1", was: "Medium Dark", now: "Medium Light" }, // Carolina Souza
  { stableId: "SAM_04_P2", was: "Light", now: "Medium Dark" }, // Andrea Huanca
  { stableId: "SAM_07_P1", was: "Medium Light", now: "Light" }, // Verónica Martínez
  { stableId: "SAM_07_P2", was: "Medium Light", now: "Medium Dark" }, // Paula Álvarez
];

export function applyAiSkinToneChanges(): number {
  const has = db.all<{ name: string }>(sql.raw(`PRAGMA table_info(continental_pool_players)`)).some((c) => c.name === "skin_tone");
  if (!has) return 0;
  let changed = 0;
  for (const c of AI_SKIN_TONE_CHANGES) {
    const r = db.run(sql`UPDATE continental_pool_players SET skin_tone = ${c.now} WHERE stable_id = ${c.stableId} AND skin_tone = ${c.was}`);
    changed += Number((r as { changes?: number }).changes ?? 0);
  }
  return changed;
}
