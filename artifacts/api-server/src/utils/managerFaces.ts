/**
 * Update 1, item 2 (Rob, 13 Oct; docs/UPDATE1-MANAGERS-BRIEF.md): the manager
 * faces.
 *
 * A face is a character: its picture, its name and its speciality, always
 * together, wherever it is dealt (Addendum point 1). The 61 are in
 * data/manager-faces.json (scripts/install-manager-faces.cjs).
 *
 *   - The player's manager has one face, career_saves.manager_face_id, picked
 *     in the new-career wizard. The player keeps the name he typed.
 *   - Each AI club's manager is a face, career_pool_team_state.manager_face_id,
 *     and the club's manager_name is that face's name. A new career deals the
 *     other faces to the AI clubs at random, so every career is a different
 *     set-up (utils/aiManagers.ts appoint).
 *   - A face is IN USE when it is the player's, or the face of an AI club whose
 *     manager is in post (manager_name set, not taken over). A sacked manager's
 *     face stays on the vacant club's row (the Job Market shows the manager
 *     being replaced) but is free to be dealt again; a club the player takes
 *     over frees its face the same way.
 *   - Older saves: a career with no face is dealt them once at boot
 *     (dealFacesToOlderCareers). Never again once it has one.
 */
import { db, careerSavesTable, careerPoolTeamStateTable } from "@workspace/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import manifest from "../data/manager-faces.json";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const SPECIALITIES = [
  "Talent Recruiter", "Negotiator", "Contracts Expert", "Sponsor Magnet",
  "Leader", "Coach", "Youth Developer", "Fitness Guru",
] as const;
export type Speciality = typeof SPECIALITIES[number];

/**
 * M-1: what each speciality does for the club its manager runs, in one line
 * (the new-career card shows it), and its size: a multiplier on the number the
 * game already works out, or (Leader) points added to the board's starting
 * confidence. M-6: for now only the PLAYER's manager's speciality is used;
 * an AI manager's is shown, not used, until AI clubs train (item 3).
 */
export const SPECIALITY_EFFECTS: Record<Speciality, { effect: string; factor: number }> = {
  "Talent Recruiter": { effect: "Scouting missions cost 25% less", factor: 0.75 },
  "Negotiator":       { effect: "Players' signing fees are 10% lower", factor: 0.9 },
  "Contracts Expert": { effect: "New seniors ask 10% less in wages", factor: 0.9 },
  "Sponsor Magnet":   { effect: "Sponsor offers are worth 10% more", factor: 1.1 },
  "Leader":           { effect: "Board confidence starts at 70, not 60", factor: 1 },
  "Coach":            { effect: "Seniors gain 10% more XP in training", factor: 1.1 },
  "Youth Developer":  { effect: "Academy players gain 15% more XP", factor: 1.15 },
  "Fitness Guru":     { effect: "Match injury risk is 20% lower", factor: 0.8 },
};
/** Leader: board confidence starts this many points above CONFIDENCE_START. */
export const LEADER_CONFIDENCE_BONUS = 10;

export type ManagerFace = {
  id: number;
  /** Under public/, as every picture the game shows. */
  file: string;
  name: string;
  gender: "male" | "female";
  age: number;
  nationality: string;
  speciality: Speciality;
};

export const MANAGER_FACES: readonly ManagerFace[] = manifest.faces as ManagerFace[];
const BY_ID = new Map(MANAGER_FACES.map((f) => [f.id, f]));

export function faceById(id: number | null | undefined): ManagerFace | null {
  return id == null ? null : BY_ID.get(id) ?? null;
}

/** The player's manager's speciality, for the club he runs (a `teams` row: only the player's clubs have one). */
export function playerSpecialityForTeam(teamId: number | null | undefined): Speciality | null {
  if (teamId == null) return null;
  const row = db.select({ f: careerSavesTable.managerFaceId }).from(careerSavesTable).where(eq(careerSavesTable.teamId, teamId)).get();
  return faceById(row?.f)?.speciality ?? null;
}

/**
 * The one multiplier a speciality puts on its number: the effect's factor when
 * the manager of this club (the player's) has `speciality`, else 1.
 */
export function specialityFactor(teamId: number | null | undefined, speciality: Speciality): number {
  return playerSpecialityForTeam(teamId) === speciality ? SPECIALITY_EFFECTS[speciality].factor : 1;
}

/**
 * M-4, M-5: a manager as the screens show one: the face, the name (an AI
 * manager's is the face's; the player's is the one he typed), the speciality
 * and its one-line effect.
 */
export type ManagerCard = {
  faceId: number; name: string; image: string; gender: "male" | "female";
  speciality: Speciality; effect: string; isPlayer: boolean;
};

export function managerCard(face: ManagerFace | null, name?: string | null, isPlayer = false): ManagerCard | null {
  if (!face) return null;
  return {
    faceId: face.id, name: name ?? face.name, image: `/${face.file}`, gender: face.gender,
    speciality: face.speciality, effect: SPECIALITY_EFFECTS[face.speciality].effect, isPlayer,
  };
}

/** The player's manager in this career, as the screens show him. */
export function playerManagerCard(careerSaveId: number): ManagerCard | null {
  const save = db.select({ f: careerSavesTable.managerFaceId, n: careerSavesTable.managerName }).from(careerSavesTable)
    .where(eq(careerSavesTable.id, careerSaveId)).get();
  return save ? managerCard(faceById(save.f), save.n, true) : null;
}

/**
 * Who runs each AI pool club in this career: its manager's face, or the
 * player's at a club he took over. Null while the job is vacant.
 */
export function clubManagersOf(careerSaveId: number): Map<number, ManagerCard | null> {
  const mine = playerManagerCard(careerSaveId);
  const rows = db.select().from(careerPoolTeamStateTable).where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).all();
  return new Map(rows.map((r) => [r.poolTeamId,
    r.takenOverAt != null ? mine : r.managerName == null ? null : managerCard(faceById(r.managerFaceId), r.managerName)]));
}

/** He or she, from the face (Addendum point 1). */
export function pronounsOf(face: ManagerFace | null): { he: string; him: string; his: string } {
  return face?.gender === "male" ? { he: "he", him: "him", his: "his" } : { he: "she", him: "her", his: "her" };
}

/** The faces in use in this career: the player's, and every AI manager's in post. */
export function facesInUseTx(tx: Tx, careerSaveId: number): Set<number> {
  const used = new Set<number>();
  const mine = tx.select({ f: careerSavesTable.managerFaceId }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get()?.f;
  if (mine != null) used.add(mine);
  for (const r of tx.select({ f: careerPoolTeamStateTable.managerFaceId }).from(careerPoolTeamStateTable).where(and(
    eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt),
    isNotNull(careerPoolTeamStateTable.managerName), isNotNull(careerPoolTeamStateTable.managerFaceId))).all()) {
    used.add(r.f!);
  }
  return used;
}

/**
 * A face for a club appointing a manager: one at random that is not in use and
 * is not still shown on another club's vacancy. If none, the club's own last
 * face (the one just freed); then any face not in use. Null only if all 61 are
 * in use, which a career (one player, at most sixty AI clubs) cannot reach.
 */
export function pickFaceTx(tx: Tx, careerSaveId: number, justFreed: number | null, random: () => number = Math.random): number | null {
  const used = facesInUseTx(tx, careerSaveId);
  const onVacancies = new Set(tx.select({ f: careerPoolTeamStateTable.managerFaceId }).from(careerPoolTeamStateTable).where(and(
    eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt),
    isNull(careerPoolTeamStateTable.managerName), isNotNull(careerPoolTeamStateTable.managerFaceId))).all().map((r) => r.f!));
  const free = MANAGER_FACES.filter((f) => !used.has(f.id));
  const fresh = free.filter((f) => !onVacancies.has(f.id));
  if (fresh.length > 0) return fresh[Math.floor(random() * fresh.length)]!.id;
  if (justFreed != null && !used.has(justFreed)) return justFreed;
  return free.length > 0 ? free[Math.floor(random() * free.length)]!.id : null;
}

/** A face for the player's manager when none was picked (an older save, or a caller without the wizard). */
export function randomFreeFaceTx(tx: Tx, careerSaveId: number, random: () => number = Math.random): number | null {
  const used = facesInUseTx(tx, careerSaveId);
  const free = MANAGER_FACES.filter((f) => !used.has(f.id));
  return free.length > 0 ? free[Math.floor(random() * free.length)]!.id : null;
}

/**
 * Boot pass for saves made before the faces: a career with no face is dealt
 * them once. The player's manager gets one at random; every AI manager in post
 * gets one of the rest at random and takes its name. Additive only: a career
 * that has a face is never dealt again. Returns the careers dealt.
 */
export function dealFacesToOlderCareers(): number {
  const careers = db.select({ id: careerSavesTable.id }).from(careerSavesTable).where(isNull(careerSavesTable.managerFaceId)).all();
  for (const { id } of careers) {
    db.transaction((tx) => {
      const mine = randomFreeFaceTx(tx, id);
      tx.update(careerSavesTable).set({ managerFaceId: mine }).where(eq(careerSavesTable.id, id)).run();
      const clubs = tx.select().from(careerPoolTeamStateTable).where(and(
        eq(careerPoolTeamStateTable.careerSaveId, id), isNull(careerPoolTeamStateTable.takenOverAt),
        isNotNull(careerPoolTeamStateTable.managerName), isNull(careerPoolTeamStateTable.managerFaceId))).all();
      for (const c of clubs) {
        const face = faceById(pickFaceTx(tx, id, null));
        if (!face) break;
        tx.update(careerPoolTeamStateTable).set({ managerFaceId: face.id, managerName: face.name, updatedAt: new Date() })
          .where(eq(careerPoolTeamStateTable.id, c.id)).run();
      }
    });
  }
  return careers.length;
}
