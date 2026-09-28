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
| 1 | Soundtrack: the 14 songs (P-02) | DONE | `bc8f490` | 5 removed (endless-summer, rum-under-the-palms, summer-by-the-sea, teeth-of-foam, volleyball-and-reggae); 9 added. The 5 kept files are byte-identical to Rob's folder (`cmp`). There was no 19 Sep loudness processing to copy: R-79 shipped Rob's Suno files as they came, so "matched" = matched to those. Measured EBU R128 integrated loudness (pyloudnorm, scratch venv): the existing ten sit at -17.05 to -14.49 LUFS (mean -15.65); 8 new songs fall inside that range and were copied byte-for-byte; Bobby Farquhar was the only outlier (-13.53 LUFS, peak -0.46 dBFS) and was gained -2.1 dB and re-encoded at 192 kbps (source 195) -> -15.90 LUFS, peak -2.76. music-tracks.ts lists exactly these 14, title track first; "ten"/"nine" wording removed from provider comments and the harness label. Full harness 48/48 (music playlist: 14 listed, 14 on disk, 14 in both build outputs, no orphans). |
| 1b | Soundtrack: 4 more songs, 18 in all | DONE | `93d6d69` | Asked for in chat on 28 Sep ("re-read item 1b"); the brief file on disk has no 1b section, so this follows the chat message plus item 1's rules. Added balls-out ("Balls Out"), rum-under-the-palms ("Rum Under the Palms"), second-place-sucks ("Second Place Sucks"), sun-rum-ganja ("Sun, Rum & Ganja", punctuation kept in the title; a file name cannot carry it). "(1)" dropped from titles. All four measured -16.29 to -15.77 LUFS, inside the existing range, so copied byte-for-byte. Rum Under the Palms (1) is the same audio as the track item 1 removed (same length and loudness; differs only at byte 250, in the ID3 tag). List is title track first, then A-Z. Full harness 48/48 (music playlist: 18 listed, 18 in both build outputs). |
| 2 | Music restarts before the dashboard (P-03) | DONE | this commit | Every page load on the way in replaced by in-app (wouter) navigation: auth-guard (3 click paths + the 3 redirects that ran during render, now one effect; "no career" re-shows the title in place), profile-picker (after choosing a profile; returnTo can no longer point back at /login), new-career (5), and App.tsx's 401 redirect. That last one was a restart nobody listed: GET /auth/user answers 401 with no profile, so it fired on every first launch. After a career is created the query cache is removed, not just marked stale, because AuthGuard reads a stale 404 still being refetched as "no career" and would bounce the new manager to the title. No login reload was needed; Shell's logout (/api/logout) is untouched, it is not on this path. Proof, real server on a copy of the starter DB in the browser pane, one sitting: first launch -> picker -> new profile -> title -> START NEW CAREER -> Underdog -> Cancun Marlins -> Start Career -> dashboard. A marker set on first load survived to the dashboard, 1 navigation entry, 1 mp3 request, and the same `<audio>` element played beach-volleyball-empire.mp3 unbroken from 30.5s to 95.9s; no script errors. New harness check: no pre-dashboard screen assigns window.location (sabotage-tested); job-market's auth-guard check follows the new navigate call. Full harness 48/48. |
