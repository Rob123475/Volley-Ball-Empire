/**
 * Update 1, night 2: what the four night-2 suites share (injury-treatment,
 * reconstruction, staff-roles, injured-list): a server on a throwaway copy of
 * the shipped database, an API with a session, reads and writes on that copy,
 * a new career through the Day 1 draft, and hiring a staff member by role.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { startCareer } from "./harness-club.mjs";

export const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");

export function createWorld(name, port) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `vbe-${name}-`));
  const db = path.join(work, "save.sqlite");
  fs.copyFileSync(SHIPPED, db);
  const BASE = `http://localhost:${port}/api`;
  let cookie = "", child = null, failures = 0, checks = 0;
  const world = {
    db, work,
    check(label, cond, detail = "") {
      checks++;
      if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
      else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
    },
    info: (s) => console.log(`  INFO  ${s}`),
    async api(method, p, body) {
      const res = await fetch(BASE + p, {
        method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { status: res.status, data };
    },
    q(sql, ...a) { const d = new DatabaseSync(db, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } },
    w(sql, ...a) { const d = new DatabaseSync(db); try { return d.prepare(sql).run(...a); } finally { d.close(); } },
    async boot(env = {}) {
      const out = fs.openSync(path.join(work, `server-${Date.now()}.log`), "w");
      child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(port), NODE_ENV: "development", SESSION_SECRET: name, VBE_STAFF_ABSENCES: "off", VBE_STAFF_BUDGET: "off", ...env } });
      for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
      throw new Error("server never came up");
    },
    async stop() { if (child) { await stopServer(child); child = null; } },
    /** A new career through the Day 1 draft (Established unless told); returns { profileId, teamId, cid }. */
    async newCareer(label = name, difficulty = "established") {
      const prof = await world.api("POST", "/profiles", { name: label });
      await world.api("POST", `/profiles/${prof.data.id}/select`);
      const club = ((await world.api("GET", "/club-templates")).data?.clubs ?? [])[0];
      await startCareer(world.api, { managerFaceId: 8, slotNumber: 1, managerName: label, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
        budget: club.startingBudget, difficulty, gameDifficulty: "medium", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
      const teamId = (await world.api("GET", "/team")).data?.id;
      const cid = world.q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0]?.id;
      return { profileId: prof.data.id, teamId, cid };
    },
    async select(profileId) { await world.api("POST", `/profiles/${profileId}/select`); },
    /** A game day (a match on it simulated). */
    async day() {
      const r = await world.api("POST", "/calendar/advance", {});
      const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
      if (id) { await world.api("POST", `/matches/${id}/simulate`); await world.api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); }
      return r;
    },
    /** Hire the market's member of `role` nearest `skill` (medical roles through the Medical Market). Returns the member. */
    async hire(role, skill = 75, cid) {
      const medical = ["Doctor", "Physiotherapist", "Massage Therapist", "Medical Specialist", "Nutritionist", "Sports Scientist"].includes(role);
      const row = world.q(`SELECT st.id, st.name, st.role, st.skill_level AS skill FROM career_staff_state s JOIN staff st ON st.id = s.staff_id
        WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.role = ? ORDER BY ABS(st.skill_level - ?), st.id LIMIT 1`, cid, role, skill)[0];
      if (!row) throw new Error(`no ${role} on the market`);
      const r = await world.api("POST", medical ? "/medical-staff" : "/staff", { staffId: row.id, length: "6m" });
      if (r.status >= 300) throw new Error(`hiring ${role}: ${r.status} ${JSON.stringify(r.data)}`);
      return row;
    },
    async release(member) {
      const medical = ["Doctor", "Physiotherapist", "Massage Therapist", "Medical Specialist", "Nutritionist", "Sports Scientist"].includes(member.role);
      return world.api("DELETE", `${medical ? "/medical-staff" : "/staff"}/${member.id}`);
    },
    finish() {
      console.log(`\n${checks - failures}/${checks} checks passed`);
      try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* the OS cleans tmp */ }
      process.exit(failures === 0 ? 0 : 1);
    },
    fail(err) { failures++; console.log(`  FAIL  the suite threw: ${err?.stack ?? err}`); },
  };
  return world;
}
