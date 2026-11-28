/**
 * 1.2 9b (Rob, 28 Nov 2026): the swimwear prints, from one data file (data/prints.json) and their
 * pictures in the game's public/prints folder. A new print is a picture and a line; no code changes.
 *
 * Rob's rule: a print of three colours or fewer can have each colour changed by the player (his
 * colours are the defaults); a print of more is shown exactly as painted. A print he painted in
 * several colours (paisley) is chosen by its colourway.
 */
import printsFile from "../data/prints.json";

export type Wrap = "repeat" | "mirror";
export type Colourway = { id: string; name: string; file: string };
export type Print = {
  id: string; name: string;
  /** The picture, in public/prints (a print with colourways has one per colourway instead). */
  file?: string;
  /** Its own colours, Rob's defaults, each one the player's to change; none: shown as painted. */
  colours: string[];
  /** How it repeats across the swimwear (across, down), or "single": one picture, not repeated. */
  wrap: [Wrap, Wrap] | "single";
  /** How many times it repeats across the width of the swimwear's texture. */
  scale: number;
  colourways?: Colourway[];
};

export const PRINTS: readonly Print[] = (printsFile as unknown as { prints: Print[] }).prints;
export const printById = (id: string) => PRINTS.find((p) => p.id === id) ?? null;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The picture a print is shown with, in a colourway or its only one. */
export function printFile(p: Print, colourway?: string | null): string | null {
  if (p.colourways) return p.colourways.find((c) => c.id === colourway)?.file ?? null;
  return p.file ?? null;
}

/** A print's choices as the pick screen and the store offer them. */
export function printOption(p: Print) {
  return {
    id: p.id, name: p.name, colours: p.colours,
    picture: `/prints/${p.file ?? p.colourways![0].file}`,
    colourways: p.colourways?.map((c) => ({ id: c.id, name: c.name, picture: `/prints/${c.file}` })),
  };
}

/**
 * A print's colour as the store keeps it: its colours ("#rrggbb,#rrggbb"), a colourway's id, or ""
 * for one shown as painted. Null if it does not fit the print.
 */
export function cleanPrintColour(p: Print, colour: string): string | null {
  if (p.colourways) return p.colourways.some((c) => c.id === colour) ? colour : null;
  if (p.colours.length === 0) return colour === "" ? "" : null;
  const parts = colour.split(",").map((c) => c.trim());
  return parts.length === p.colours.length && parts.every((c) => HEX.test(c)) ? parts.map((c) => c.toLowerCase()).join(",") : null;
}

/** A player's swimwear on the pick screen: a cut, and plain in one colour or a print in its colours. */
export type SwimChoice = { cut: string; print: string; colours: string[]; colourway?: string };

/** Why a swimwear choice does not add up, or null. */
export function swimProblem(s: SwimChoice, cuts: readonly string[]): string | null {
  if (!cuts.includes(s.cut) || !Array.isArray(s.colours) || !s.colours.every((c) => typeof c === "string" && HEX.test(c))) return "Swimwear is a cut and its colours.";
  if (s.print === "plain") return s.colours.length === 1 ? null : "Plain swimwear takes one colour.";
  const p = printById(s.print);
  if (!p) return "No such print.";
  if (p.colourways && !p.colourways.some((c) => c.id === s.colourway)) return `${p.name} comes in ${p.colourways.map((c) => c.name).join(", ")}.`;
  return s.colours.length === p.colours.length ? null : `${p.name} takes ${p.colours.length || "no"} colour${p.colours.length === 1 ? "" : "s"}.`;
}

/**
 * The court's view of the swimwear (flat, for Unity's JSON): plain in one colour, or a print's
 * picture with its own colours (the palette), the colours chosen for them, how it repeats and its scale.
 */
export function courtSwimwear(s: SwimChoice) {
  const p = s.print === "plain" ? null : printById(s.print);
  return {
    cut: s.cut,
    printFile: p ? printFile(p, s.colourway) : "",
    palette: p ? p.colours : [],
    colours: s.colours,
    wrapU: p ? (p.wrap === "single" ? "single" : p.wrap[0]) : "",
    wrapV: p ? (p.wrap === "single" ? "single" : p.wrap[1]) : "",
    scale: p ? p.scale : 1,
  };
}
