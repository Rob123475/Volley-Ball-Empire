#!/usr/bin/env node
/**
 * Update 1, day 2 part 6 (Rob, 15 Oct, O-2; docs/UPDATE1-DAY2-BRIEF.md):
 * install Rob's 90 new staff portraits as 90 new staff.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 *   1. reads one subfolder per role in Rob's folder ("Head Coach", "Assistant
 *      Coach", "Doctor", "Physiotherapist", "Massage Therapist", "Medical
 *      Specialist"; the folder name is the staff role, exactly as the staff
 *      table spells it)
 *   2. reads each file name for the age, nationality and gender ("...portrait
 *      of a 42-year-old Nigerian woman..."), as install-manager-faces.cjs does,
 *      and lists every file whose name it can't read. The name is looked up in
 *      docs/staff-portrait-names.json (written by Claude chat once the pictures
 *      exist; this script never invents a name):
 *        { "Head Coach": { "42 Nigerian woman": "Ada Okoye", ... }, ... }
 *      The key is the age, nationality and gender words, or the exact file name
 *      (for two alike, or one whose name can't be read; then the entry is
 *      { "name", "age", "nationality", "gender" }). A file with no entry, an
 *      entry with no file, or a file it can't read stops the run
 *   3. crops the centre square (from near the top of a tall picture, where
 *      the face is) to 500 x 500 WebP at q=88, the existing staff portraits'
 *      size and format (scripts/portraits/crop-staff-portraits.py), written as
 *      public/images/staff/<role folder>/staff-11.webp onwards
 *   4. writes each person into the staff table of the starter DB
 *      (lib/db/volleyball-empire.sqlite), on the rules the role's existing
 *      staff already follow:
 *        skill  spread over the role's existing skill range, the oldest the
 *               most skilled (the existing doctors' skill rises with age)
 *        wage   the role's existing skill -> monthly wage line (straight between
 *               existing staff, flat past the ends), so a new 85 costs what the
 *               existing staff either side of 85 say
 *        the rest (specialty, personality, sub-ratings, stars...) from the
 *               role's existing member of nearest skill, sub-ratings moved by
 *               the skill difference; nationality, age and gender from the file
 *      The new people take ids from 10001 up (data/staff-ids.json), never the next free id: a save
 *      makes its own staff (the thin-market top-up, createCareerStaff) at the
 *      next free id, and ensureReferenceData matches staff by id, so a new
 *      starter row at, say, id 168 would overwrite a save's own 168. Existing
 *      saves get the new people on their next boot (ensureSchema.ts, Pass 3b).
 *      Re-running updates the people it wrote before (matched by picture).
 *
 * Usage:
 *   node scripts/install-staff-portraits.cjs "<folder>"            dry run
 *   node scripts/install-staff-portraits.cjs "<folder>" --write
 *   options (for a test run): --db <starter db copy>  --images <public/images/staff copy>  --names <names file>
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { COUNTRY } = require("./lib/nationality-words.cjs");

const REPO = path.resolve(__dirname, "..");
const NAMES_DEFAULT = path.join(REPO, "docs/staff-portrait-names.json");
const TAG = "[install-staff-portraits]";
const SIZE = 500, QUALITY = 88;
const FIRST_ID = require("../artifacts/api-server/src/data/staff-ids.json").starterOnlyFrom;

/** The role folder Rob fills -> the staff role and its existing picture folder. */
const ROLES = {
  "Head Coach":         "head_coach",
  "Assistant Coach":    "assistant_coach",
  "Doctor":             "medical_doctor",
  "Physiotherapist":    "physiotherapist",
  "Massage Therapist":  "massage_therapist",
  "Medical Specialist": "medical_specialist",
};

const arg = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : undefined; };
const srcDir = process.argv[2];
const write = process.argv.includes("--write");
const DB = arg("--db") ?? path.join(REPO, "lib/db/volleyball-empire.sqlite");
const NAMES = arg("--names") ?? NAMES_DEFAULT;
const IMAGES = arg("--images") ?? path.join(REPO, "artifacts/beach-volleyball/public/images/staff");
if (!srcDir || !fs.existsSync(srcDir)) {
  console.error(`${TAG} usage: node scripts/install-staff-portraits.cjs <folder with the role folders> [--write]`);
  process.exit(1);
}

let sharp;
try {
  sharp = require(path.join(REPO, "scripts/node_modules/sharp"));
} catch {
  console.error(`${TAG} sharp is not installed. Run \`pnpm install\` in the repo first.`);
  process.exit(1);
}

/** "... portrait of a 42-year-old Nigerian woman ..." -> its age, word and gender. */
function readName(file) {
  const m = file.match(/(\d+)[- ]year[- ]old (.+?) (man|woman|male|female)(?![a-z])/i);
  if (!m) return null;
  const word = m[2].replace(/^(an?|the) /i, "").trim();
  return { age: Number(m[1]), word, gender: /^(man|male)$/i.test(m[3]) ? "male" : "female" };
}

/** The role's skill -> monthly wage line: straight between its staff, flat past the ends. */
function wageFor(existing, skill) {
  const bySkill = new Map();
  for (const r of existing) bySkill.set(r.skill_level, [...(bySkill.get(r.skill_level) ?? []), Number(r.base_salary)]);
  const pts = [...bySkill].map(([s, w]) => [s, w.reduce((a, b) => a + b, 0) / w.length]).sort((a, b) => a[0] - b[0]);
  if (skill <= pts[0][0]) return Math.round(pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [s0, w0] = pts[i - 1], [s1, w1] = pts[i];
    if (skill <= s1) return Math.round(w0 + ((w1 - w0) * (skill - s0)) / (s1 - s0));
  }
  return Math.round(pts[pts.length - 1][1]);
}

/** The template's attributes, made this person's. */
function attributesFor(template, person, skill, wage) {
  let a;
  try { a = JSON.parse(template.attributes || "{}"); } catch { a = {}; }
  const shift = skill - template.skill_level;
  const out = {};
  for (const [k, v] of Object.entries(a)) {
    if (k === "description" || k === "regenerationSeed") continue; // about the template's own person
    out[k] = typeof v === "number" && !["age", "stars", "experienceYears", "salary"].includes(k)
      ? Math.max(1, Math.min(99, v + shift)) : v;
  }
  if ("experienceYears" in a) out.experienceYears = Math.max(1, Number(a.experienceYears) + person.age - template.base_age);
  if ("salary" in a) out.salary = wage;
  // Only where the role's attributes already carry them: a coach's are 1-99
  // ratings and nothing else (the staff page edits each one as a number).
  if ("age" in a) out.age = person.age;
  if ("nationality" in a) out.nationality = person.word;
  if ("gender" in a) out.gender = person.gender === "male" ? "Male" : "Female";
  return JSON.stringify(out);
}

(async () => {
  const names = fs.existsSync(NAMES) ? JSON.parse(fs.readFileSync(NAMES, "utf8")) : {};
  const db = new DatabaseSync(DB, write ? {} : { readOnly: true });
  const problems = [];
  const unreadable = [];
  const plan = [];

  for (const [role, folder] of Object.entries(ROLES)) {
    const dir = path.join(srcDir, role);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort() : [];
    if (files.length === 0) { console.log(`${TAG} ${role}: no pictures`); continue; }
    const roleNames = names[role] ?? {};
    const keys = Object.keys(roleNames).filter((k) => !k.startsWith("_"));
    const used = new Set();
    const people = [];
    for (const f of files) {
      const read = readName(f);
      const byFile = roleNames[f];
      if (!read) unreadable.push(`${role}/${f}`);
      let person;
      if (byFile && typeof byFile === "object") {
        person = { name: byFile.name, age: Number(byFile.age), word: byFile.nationality, gender: /^m/i.test(byFile.gender) ? "male" : "female" };
        used.add(f);
      } else if (read) {
        const key = `${read.age} ${read.word} ${read.gender === "male" ? "man" : "woman"}`;
        const name = typeof byFile === "string" ? byFile : roleNames[key];
        if (typeof byFile === "string") used.add(f); else used.add(key);
        if (!name) { problems.push(`${role}/${f}: no entry "${key}" (or the file name) in docs/staff-portrait-names.json`); continue; }
        person = { name, ...read };
      } else {
        problems.push(`${role}/${f}: the name gives no "<age>-year-old <nationality> man|woman", and the names file has no { name, age, nationality, gender } entry for the file`);
        continue;
      }
      if (!(person.word in COUNTRY)) { problems.push(`${role}/${f}: no country known for "${person.word}" (scripts/lib/nationality-words.cjs)`); continue; }
      if (!(person.age >= 18 && person.age <= 80)) { problems.push(`${role}/${f}: age ${person.age}?`); continue; }
      people.push({ ...person, src: path.join(dir, f), file: f });
    }
    for (const k of keys) if (!used.has(k)) problems.push(`${role}: names file entry "${k}" matches no picture`);
    const keyCount = new Map();
    for (const p of people) { const k = `${p.age} ${p.word} ${p.gender}`; keyCount.set(k, [...(keyCount.get(k) ?? []), p]); }
    for (const [k, ps] of keyCount) if (ps.length > 1 && ps.some((p) => !(p.file in roleNames))) problems.push(`${role}: ${ps.length} pictures read as "${k}"; give each its own entry by file name`);

    const existing = db.prepare("SELECT * FROM staff WHERE role = ? AND id < ? ORDER BY skill_level").all(role, FIRST_ID);
    if (existing.length === 0) { problems.push(`${role}: no existing staff in the starter DB to take the rules from`); continue; }
    const lo = existing[0].skill_level, hi = existing[existing.length - 1].skill_level;
    // Oldest first, then the names file's order; the picture numbers follow it.
    const order = [...people].sort((a, b) => b.age - a.age || a.file.localeCompare(b.file));
    const firstNo = Math.max(0, ...existing.map((r) => Number(r.image_url?.match(/staff-(\d+)\.webp$/)?.[1] ?? 0))) + 1;
    order.forEach((p, i) => {
      const skill = order.length === 1 ? Math.round((lo + hi) / 2) : Math.round(hi - ((hi - lo) * i) / (order.length - 1));
      const template = existing.reduce((best, r) => (Math.abs(r.skill_level - skill) < Math.abs(best.skill_level - skill) ? r : best));
      const wage = wageFor(existing, skill);
      plan.push({
        ...p, role, folder, skill, wage, template,
        image: `/images/staff/${folder}/staff-${String(firstNo + i).padStart(2, "0")}.webp`,
      });
    });
  }

  if (unreadable.length) {
    console.log(`${TAG} ${unreadable.length} file name(s) it can't read the age, nationality and gender from:`);
    for (const u of unreadable) console.log(`  - ${u}`);
  }
  if (problems.length) {
    console.error(`${TAG} FAILED, nothing written:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  for (const role of Object.keys(ROLES)) {
    const of = plan.filter((p) => p.role === role);
    if (of.length) console.log(`  ${role.padEnd(19)} ${String(of.length).padStart(2)}  (${of.filter((p) => p.gender === "female").length} women, ${of.filter((p) => p.gender === "male").length} men)`);
  }
  for (const p of plan) {
    console.log(`  ${p.role.padEnd(19)} ${p.name.padEnd(24)} ${String(p.age).padStart(2)} ${COUNTRY[p.word].padEnd(14)} ${p.gender.padEnd(6)} skill ${p.skill}  $${p.wage.toLocaleString()}/mo  ${p.image}  (like ${p.template.name})`);
  }
  if (!write) { console.log(`\n${TAG} dry run: nothing written. Re-run with --write.`); return; }

  // ── Crop, resize, convert ──────────────────────────────────────────────────
  for (const p of plan) {
    const input = fs.readFileSync(p.src);   // a buffer: on Windows sharp holds a file it opened by path
    const meta = await sharp(input).metadata();
    const side = Math.min(meta.width, meta.height);
    const left = Math.round((meta.width - side) / 2);
    const top = meta.height > meta.width ? Math.round((meta.height - side) * 0.1) : 0;
    await sharp(input).extract({ left, top, width: side, height: side })
      .resize(SIZE, SIZE, { kernel: "lanczos3" }).webp({ quality: QUALITY })
      .toFile(path.join(IMAGES, p.folder, path.basename(p.image)));
  }
  console.log(`${TAG} ${plan.length} portraits written under ${IMAGES}`);

  // ── The staff rows ─────────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  let nextId = Math.max(FIRST_ID - 1, db.prepare("SELECT max(id) AS m FROM staff").get().m ?? 0) + 1;
  const find = db.prepare("SELECT id FROM staff WHERE image_url = ? AND id >= ?");
  const cols = ["name", "role", "specialty", "skill_level", "nationality", "image_url", "overall_rating", "coach_speciality",
    "personality", "attributes", "special_trait", "scouting_rating", "base_salary", "base_age"];
  const update = db.prepare(`UPDATE staff SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`);
  const insert = db.prepare(`INSERT INTO staff (id, ${cols.join(", ")}, created_at) VALUES (${["?", ...cols.map(() => "?"), "?"].join(", ")})`);
  let added = 0, updated = 0;
  db.exec("BEGIN");
  for (const p of plan) {
    const t = p.template;
    const values = [p.name, p.role, t.specialty, p.skill, COUNTRY[p.word], p.image, p.skill, t.coach_speciality,
      t.personality, attributesFor(t, p, p.skill, p.wage), t.special_trait, t.scouting_rating, p.wage, p.age];
    const had = find.get(p.image, FIRST_ID);
    if (had) { update.run(...values, had.id); updated++; } else { insert.run(nextId++, ...values, now); added++; }
  }
  db.exec("COMMIT");
  console.log(`${TAG} staff table (${DB}): ${added} added, ${updated} updated`);
})();
