# Fix batch 28 Sep 2026: status

Brief: docs/FIX-BATCH-28SEP-BRIEF.md. Branch `fix-batch-28sep`.

## Base

Steam BuildID 25520280 (v0.9.2b, uploaded 25 Sep 13:25) was built from `e144aca` **plus six
files that were never committed**: the React #310 Team-screen crash fix (pages/team.tsx),
the component stack on the error screen (components/error-boundary.tsx), and the `sold_on`
achievement deletion (achievement-definitions.ts, docs/achievements-table.md,
harness/job-market.mjs, harness/watched-match.mjs). Proven from the shipped package: the
v0.9.2 server bundle in C:\build\vbe has no "Sold On", its UI bundle has "Component stack:",
and the 25 Sep SteamPipe description is "Team screen crash fixed (React #310 hooks order)".

Decision: the branch starts at `e144aca` and its first commit is exactly those six files, so
the branch equals what is live on Steam and nothing in v0.9.3 goes backwards.
Harness: 48/48 green (28 Sep, 11:03-11:37) on that tree. That run also carried the doctor-01
rename and the 4 resized pictures, which have since been set aside for items 6 and 8.

## Items

| # | Item | Status | Commit | Proof |
|---|---|---|---|---|
