/**
 * Overnight brief 30 Sep, item 9: staff and medical attributes in plain words,
 * the same on every card (Staff Market, Medical Market, Staff, Medical, the
 * staff edit form). Cards showed the stored keys: "matchPreparation",
 * "deepTissueMassage". And one rule for which numbers are skills: a V2 record
 * keeps them in a nested "...Attributes" object; an older record keeps them
 * flat beside bookkeeping numbers (age, salary, stars...), which are not skills.
 */

/** Numbers stored beside the skills on older records; never shown as an attribute. */
const NOT_SKILLS = new Set([
  "age", "salary", "stars", "starRating", "experience", "experienceYears", "nutritionBonus", "morale", "fatigue",
]);

/** Words kept in lower case inside a label ("Return to Play"). */
const SMALL = new Set(["to", "and", "of", "for", "in", "on", "the", "a"]);

/** Words written as they are known ("VO2 Max", not "Vo2 Max"). */
const AS_KNOWN: Record<string, string> = { vo2: "VO2", cpr: "CPR", gps: "GPS", acl: "ACL" };

/** "deepTissueMassage" -> "Deep Tissue Massage"; "return_to_play" -> "Return to Play". */
export function attributeLabel(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean);
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (AS_KNOWN[lower]) return AS_KNOWN[lower];
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** A staff member's skills as [key, value] pairs, whichever way the record stores them. */
export function skillAttributes(attributes: Record<string, unknown> | null | undefined): [string, number][] {
  const attrs = attributes ?? {};
  for (const [key, val] of Object.entries(attrs)) {
    if (key.endsWith("Attributes") && val && typeof val === "object" && !Array.isArray(val)) {
      return Object.entries(val as Record<string, unknown>).filter(([, v]) => typeof v === "number") as [string, number][];
    }
  }
  return Object.entries(attrs).filter(([k, v]) => typeof v === "number" && !NOT_SKILLS.has(k)) as [string, number][];
}
