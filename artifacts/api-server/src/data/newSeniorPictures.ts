/**
 * 1.1.1 (Rob, 18 Oct; Downloads/NEW-SENIORS-BRIEF-18OCT.md): Rob's new senior pictures, one list
 * for every career. Each is a woman in her own nation's bikini with that nation's flag and code, so
 * THE PICTURE DECIDES THE NATION: `nation` is the folder Rob put it in (Desktop\new senior cards\
 * <continent>\<nation>\), read by scripts/install-new-senior-cards.mjs, never a file name. Never
 * give one of these to a player of another nation (utils/newSeniors.ts).
 *
 * The list is new-senior-pictures.json, written by the installer. Until Rob's pictures are
 * installed it is empty, and no picture players arrive (the kept-on youths take graduate pictures).
 * A suite may point the server at its own placeholder list with VBE_NEW_SENIOR_PICTURES (a JSON file
 * of the same shape); a production build never reads it.
 */
import fs from "node:fs";
import type { ContinentKey } from "@workspace/db";
import manifest from "./new-senior-pictures.json";

export type NewSeniorPicture = { url: string; nation: string; continent: ContinentKey };

export const NEW_SENIOR_PICTURE_PREFIX = "/images/players/new-seniors/";

function load(): readonly NewSeniorPicture[] {
  const override = process.env.NODE_ENV !== "production" ? process.env.VBE_NEW_SENIOR_PICTURES : undefined;
  if (override) return (JSON.parse(fs.readFileSync(override, "utf8")) as { pictures: NewSeniorPicture[] }).pictures;
  return (manifest as { pictures: NewSeniorPicture[] }).pictures;
}

export const NEW_SENIOR_PICTURES: readonly NewSeniorPicture[] = load();
