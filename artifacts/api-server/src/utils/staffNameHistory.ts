/**
 * P-11 — every name a starter-DB staff card has ever shipped under.
 *
 * A save keeps its own copy of the staff table, and the boot-time reference
 * sync deliberately never touches `name` or `nationality`: the player can edit
 * both (PATCH /staff/:id, the pencil on a staff card), and a blanket sync would
 * undo their edit on every launch. So a card renamed in the starter DB — the
 * four doctors fixed earlier (131, 141, 147, 161), the 28 renamed on 28 Sep —
 * kept its old name in every existing save for good.
 *
 * This list is how a rename is told apart from a player's own edit: if the
 * save still holds a name the STARTER DB used for that id, nobody typed it,
 * and ensureReferenceData() brings the card up to date (name and nationality
 * together). Any other name is the player's and is left alone.
 *
 * Built from every committed version of lib/db/volleyball-empire.sqlite
 * (54 versions, first-seen order), not from memory. Whenever a staff name
 * changes in the starter DB, add the name it had here, or existing saves will
 * never see the change.
 */
export const PREVIOUS_STAFF_NAMES: Readonly<Record<number, readonly string[]>> = {
  1: ["Roberto Alves", "Valentina Greco"],   // now Valentino Greco
  2: ["Karen Whitman", "Mariana Souza"],   // now Rafael Souza
  3: ["Fabio Bianchi", "Sun Li"],   // now Stefan Lindqvist
  4: ["Sandra Mueller"],   // now Anika Hoffmann
  5: ["Peter Larsson", "Fatima Al-Rashid"],   // now Li Wei
  6: ["Isabel Marquez"],   // now Elena Popova
  7: ["Tom Bradley"],   // now Priya Nair
  8: ["Yuki Tanaka"],   // now Sofia Andersen
  9: ["Klaus Weber"],   // now Amara Diallo
  10: ["Nadia Kowalski", "Zara Williams"],   // now Jack Williams
  11: ["Simon Clarke"],   // now Lukas Schmidt
  12: ["Priya Sharma", "Mei-Ling Tan"],   // now Marcos Silva
  13: ["Henrik Olsen", "Kwame Adu"],   // now Carmen Romero
  14: ["Claudia Ferrari"],   // now Isabella Ricci
  15: ["David Okafor"],   // now Jessica De Groot
  18: ["Sofia Martinez"],   // now Kwame Adu
  19: ["Marcos Silva"],   // now Grace Lim
  76: ["Yuki Hashimoto"],   // now Lena Bauer
  80: ["Lena Bauer"],   // now Yuki Hashimoto
  84: ["Ji-Yeon Park"],   // now Ryan Mitchell
  85: ["Daniela Ferreira"],   // now Daniel Ferreira
  86: ["Marco Vieira"],   // now Ana Vieira
  89: ["Chioma Obi"],   // now Kenji Tanaka
  90: ["Sandra Kowalski"],   // now Lukas Höfer
  91: ["Ahmad Khoury"],   // now Sandra Kowalski
  92: ["Rachel Thompson"],   // now Pete Harrison
  93: ["Emeka Nwosu"],   // now Chioma Obi
  95: ["Pete Harrison"],   // now Rachel Thompson
  102: ["Priya Sharma"],   // now Oliver Bennett
  104: ["Fiona Walsh"],   // now Henri Fontaine
  105: ["Henri Fontaine"],   // now Fiona Walsh
  107: ["Elena Marchetti"],   // now Sione Taufa
  110: ["Dmitri Volkov"],   // now Elena Marchetti
  111: ["Thabo Dlamini"],   // now Katya Volkova
  114: ["Mei Sun"],   // now Sun Hao
  126: ["Dr. Alessandro Bianchi"],   // now Dr. Joseph Falzon
  131: ["Dr. Sarah Mitchell"],   // now Dr. Alice Fitzgerald
  141: ["Dr. Emily Harrison"],   // now Dr. Rachel Lombardi
  147: ["Dr. James O'Connor"],   // now Dr. Liam Whitlock
  161: ["Dr. James O'Connor"],   // now Dr. Cormac Bailey
};
