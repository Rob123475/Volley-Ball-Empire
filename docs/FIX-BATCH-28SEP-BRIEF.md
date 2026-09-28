# Brief: play-test fix batch + one Steam build (written 28 Sep 2026)

Repo: C:\Users\rbonn\Documents\Volley-Ball-Empire. Work on a new branch `fix-batch-28sep` from the commit Steam build 25520280 (v0.9.2b) came from.
Replaces docs/STEAM-IMAGE-UPDATE-BRIEF.md (that one is folded in as item 8; do not run it separately).

## Rules of engagement
- ONE item at a time, in order. After each item: harness green, commit, push, and write a short proof line in docs/FIX-BATCH-28SEP-STATUS.md (what changed, commit hash, how it was proven).
- Never write to Rob's live save (C:\Users\rbonn\AppData\Roaming\Beach Volleyball Empire). Test on copies.
- If an item can't be finished cleanly, rebuild the broken part fresh rather than patching over it. Delete dead code you replace.
- Do not guess. If something needed isn't in this brief, stop that item, note the question in the status file, and move to the next item.
- Do not set any Steam build live.

## Items

### 1. Soundtrack: the 14 songs (P-02)
Source: `C:\Users\rbonn\OneDrive\Desktop\suno volleyball songs` (14 mp3s). This set REPLACES the current 10.
- Copy all 14 into artifacts/beach-volleyball/public/audio/music with lower-case hyphen names (e.g. "We Own the Summer Sky (1).mp3" -> we-own-the-summer-sky.mp3). Titles in the game drop the "(1)".
- Remove the 5 songs not in the folder: endless-summer, rum-under-the-palms, summer-by-the-sea, teeth-of-foam, volleyball-and-reggae.
- The 9 unchanged-looking files are byte-identical to what's already in the game where they overlap; the new ones (Barefoot Tonight, Bobby Farquhar, Burn Under the Sun, Give Me One More Summer, No Name Beach, Pineapple Morning, Queen of the Sand, Under the Lights, We Own the Summer Sky) must be loudness-matched to the existing processed tracks, same as the 19 Sep processing.
- Update data/music-tracks.ts to exactly these 14, "Beach Volleyball Empire" first. harness/music-playlist.mjs must pass.

### 2. Music restarts on every screen before the dashboard (P-03)
Cause found: components/layout/auth-guard.tsx moves between screens with `window.location.href = ...` (lines ~83, 89, 92, 179, 185, 192), which reloads the whole window and restarts the music. Check pages/profile-picker.tsx and pages/new-career.tsx for the same.
- Replace with in-app navigation (wouter) so MusicProvider is never remounted. Keep the real login redirect only if one is truly needed.
- Proof: one song plays unbroken from profile picker -> New Career -> Underdog/Established -> Dashboard.

### 3. Songs don't roll into the next one (P-04)
Rob hears the song end and nothing follows. music-provider.tsx does have an `ended` -> advance() handler, so find the real cause in the packaged app (not dev) and fix it. Required behaviour: the full soundtrack plays on its own, song after song; the only way a song changes early is the Skip button.
- Proof: let two songs end back to back in the built app.

### 4. Hired staff give no bonuses (P-09, high)
Cause found: seeded staff rows store roles in Title Case ("Head Coach", "Promotional Manager", "Strength Coach"), but pages/staff.tsx (BONUS_DESCRIPTIONS, ROLE_LABELS/COLORS/ICONS lookups) and the server (routes/training.ts ~421-427 head/assistant/fitness bonuses, routes/finances.ts ~331 promotions manager) compare against snake_case ("head_coach"). They never match, so no bonus ever applies and the panel says "Hire staff to unlock bonuses" with 4 of 4 slots filled.
- Make ONE shared role normaliser (the scouting unlock already has `normaliseRole`) and use it everywhere roles are compared, client and server. Note the DB says "Strength Coach" and "Promotional Manager" while code says strength_conditioner / promotions_manager: map them.
- Proof: a harness case with a Title-Case head coach, assistant coach, fitness trainer and promotional manager hired shows each bonus actually applied (training XP multiplier, fatigue reduction, sponsorship boost), and the panel lists them.

### 5. Scout mission dropdown lists every staff member (P-07)
pages/continental-scouting.tsx ~713 maps over all staff. Show only hired staff whose normalised role is scout. If none, keep the existing "You need a Scout" message.

### 6. Staff renames: keep every picture, change the name (P-08)
Apply to the starter DB (lib/db/volleyball-empire.sqlite) AND every seed/source file that holds these names. Name and nationality move together; picture, age, rating, trait and pay stay on the card. Match by id AND old name.

| id | Role | Old name · nationality | New name · nationality |
|---|---|---|---|
| 1 | Head Coach | Valentina Greco · Italy | Valentino Greco · Italy |
| 86 | Scout | Marco Vieira · Brazil | Ana Vieira · Brazil |
| 2 | Head Coach | Mariana Souza · Brazil | Rafael Souza · Brazil |
| 3 | Head Coach | Sun Li · China | Stefan Lindqvist · Sweden |
| 5 | Head Coach | Fatima Al-Rashid · Qatar | Li Wei · China |
| 10 | Head Coach | Zara Williams · Australia | Jack Williams · Australia |
| 13 | Assistant Coach | Kwame Adu · Ghana | Carmen Romero · Spain |
| 18 | Assistant Coach | Sofia Martinez · Spain | Kwame Adu · Ghana |
| 12 | Assistant Coach | Mei-Ling Tan · Singapore | Marcos Silva · Brazil |
| 19 | Assistant Coach | Marcos Silva · Brazil | Grace Lim · Singapore |
| 110 | Strength Coach | Dmitri Volkov · Russia | Elena Marchetti · Italy |
| 107 | Strength Coach | Elena Marchetti · Italy | Sione Taufa · New Zealand |
| 111 | Strength Coach | Thabo Dlamini · South Africa | Katya Volkova · Russia |
| 114 | Strength Coach | Mei Sun · China | Sun Hao · China |
| 104 | Promotional Manager | Fiona Walsh · Ireland | Henri Fontaine · Belgium |
| 105 | Promotional Manager | Henri Fontaine · Belgium | Fiona Walsh · Ireland |
| 102 | Promotional Manager | Priya Sharma · India | Oliver Bennett · United Kingdom |
| 90 | Scout | Sandra Kowalski · Poland | Lukas Höfer · Austria |
| 91 | Scout | Ahmad Khoury · Lebanon | Sandra Kowalski · Poland |
| 95 | Scout | Pete Harrison · New Zealand | Rachel Thompson · Australia |
| 92 | Scout | Rachel Thompson · Australia | Pete Harrison · New Zealand |
| 93 | Scout | Emeka Nwosu · Ghana | Chioma Obi · Nigeria |
| 89 | Scout | Chioma Obi · Nigeria | Kenji Tanaka · Japan |
| 80 | Massage Therapist | Lena Bauer · Germany | Yuki Hashimoto · Japan |
| 76 | Massage Therapist | Yuki Hashimoto · Japan | Lena Bauer · Germany |
| 84 | Massage Therapist | Ji-Yeon Park · South Korea | Ryan Mitchell · Canada |
| 85 | Massage Therapist | Daniela Ferreira · Brazil | Daniel Ferreira · Brazil |
| 126 | Doctor | Dr. Alessandro Bianchi · Italy | Dr. Joseph Falzon · Malta |

Swapped pairs: do them in one transaction so no name is ever used twice mid-change.
Note id 13 gets "Carmen Romero" (not Sofia Martinez) because Dr. Sofia Martinez (Medical Specialist, id 122) already has that name printed on her picture.
- Then run a duplicate check across ALL 120 staff (ignore a leading "Dr."). Zero duplicates, or stop and list them in the status file.

### 7. Name changes must reach existing saves (P-11)
Today reference-data sync only inserts missing rows, and names are never updated because staff names can be edited by the player (pencil icon). Rob's save still shows 4 old names the starter DB already fixed (ids 131, 141, 147, 161) plus will miss all of item 6.
- At boot, update a save's staff name and nationality to the starter DB's value ONLY where the save's current name is a known previous starter name for that id (keep a small history map in code: id -> list of old names). A name the player typed stays untouched.
- Proof: harness on a COPY of Rob's save: the 4 old names + item 6 names update; a staff name hand-edited in the copy does not.

### 8. New medical pictures (was STEAM-IMAGE-UPDATE-BRIEF)
Rob replaced 4 pictures on 28 Sep: public/images/staff/medical_doctor/staff-01.webp and medical_specialist/staff-01, -03, -08.webp. They are 1086x1448, about 1.8 MB each; every other staff picture is 600x800, about 30 KB. Resize these 4 to 600x800 WebP, same crop. (The doctor 01 rename is in item 6.)

### 9. Starting squad: free changes in week 1 only (P-05)
Rob's rule: in a new career, releasing any starting-squad player is free until the first game week has passed. After week 1, releasing a contracted player costs the contract payout, the same as any early release (22 Sep rule: a club that axes a contract early pays it out). Check what the release path does today first and write it in the status file, then make it match.
- Proof: harness case releasing a player in week 1 (balance unchanged) and after week 1 (payout deducted).

### 10. Build and upload
- Full harness green on the final commit. Push. Harness, build and GitHub must share one hash.
- Build the Windows package (C:\build\vbe\win-unpacked) from that hash as v0.9.3.
- Check inside win-unpacked: 14 songs; the 4 resized pictures; starter DB has the item 6 names.
- Upload to SteamPipe (App 5233750, depot 5233751), description "v0.9.3 - play-test fixes 28 Sep (<hash>)". Do NOT set live.
- Final report in docs/FIX-BATCH-28SEP-STATUS.md: each item done/not done with hash and proof, the new BuildID, and every open question.
