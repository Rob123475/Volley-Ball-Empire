// Scratch: how long a game day takes now (a plain day and the weekly salary day), over two months.
import { createWorld } from "./night2-world.mjs";
import { healAllSquads } from "./harness-club.mjs";
const W = createWorld("time-days", 4976);
try {
  await W.boot(process.env.BUDGET_ON ? { VBE_STAFF_BUDGET: "on" } : {});
  await W.newCareer("Timing");
  const times = [];
  for (let i = 0; i < Number(process.env.DAYS ?? 70); i++) {
    healAllSquads(W.db);
    const t0 = Date.now();
    const r = await W.day();
    const ms = Date.now() - t0;
    const d = (await W.api("GET", "/calendar")).data.currentDate;
    times.push({ d, ms, week: !!r.data?.salaryWeek || /Salary week/.test(JSON.stringify(r.data?.events ?? "")) });
  }
  const s = [...times].sort((a, b) => b.ms - a.ms);
  console.log("slowest:", s.slice(0, 8).map((t) => `${t.d} ${t.ms}ms${t.week ? " (salary week)" : ""}`).join(", "));
  console.log("median ms:", s[Math.floor(s.length / 2)].ms, " total s:", Math.round(times.reduce((a, t) => a + t.ms, 0) / 1000));
} catch (e) { console.log(e); } finally { await W.stop(); }
process.exit(0);
