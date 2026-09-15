# Overnight status — night of 15 Sep 2026

Written for Rob, in plain words. Every number here comes from a run tonight; nothing is guessed.

Your real save (`AppData\Roaming\Beach Volleyball Empire`) was only ever copied, never opened or
changed. Its fingerprint (sha256 `06033863…`) was the same at the start, after every installer test and
at the end.

## The short version

| | What | Result |
|---|---|---|
| 1 | Camera zoom on all three 3D Court cameras; the overhead camera starts closer (R-71) | PASSED |
| 2 | Players move: attackers go to the net, the other side blocks and covers (R-76) | PASSED |
| 3 | Spectators animate on the spot; the three walkers on the left stand and animate (R-74) | PASSED |
| 4 | Club names on the 3D scoreboard; the opponent in its own kit (R-73, Unity half) | PASSED |
| 5 | New 3D Court build copied into the game, render proof on the real graphics card | PASSED |
| 6 | Full harness | PASSED on the second run (38 of 38); the first run was 35 of 38, see "What failed" |
| 7 | Installer 0.9.1, install folder named "Beach Volleyball Empire" (R-66) | PASSED, after one rebuild |

---

## What passed, with the numbers

### 1. Camera zoom (R-71)

**Why the earlier test showed no zoom.** It was none of the three guesses:
- the input system was working: the wheel was read correctly;
- the script was on the right camera;
- it was active.

The script kept each camera's starting position in a list. Unity reloads its scripts when a file
changes, and in the test runs that happened in the middle of play. The reload emptied the list, so the
zoom quietly did nothing. The camera no longer stores its starting position; it just moves in and out
from where it is.

**How it was tested.** A test in Unity rolls the mouse wheel and holds + and −, then reads where the
camera actually is. It ran normally, and again after forcing that script reload. All three cameras
passed both times. "Distance" below is how far the camera is from what it is looking at.

| Camera (key) | Starts at | Wheel all the way in | Wheel all the way out | Hold + / hold − | Switch camera |
|---|---|---|---|---|---|
| Close (3) | 19.1 m | 10.1 m (9 m closer) | 27.1 m (8 m further) | moves in / moves out | back to start |
| Wide (1) | 17.1 m | 9.1 m (8 m closer) | 27.1 m (10 m further) | moves in / moves out | back to start |
| Overhead (2) | **21.4 m — was 37.4 m** | 11.4 m (10 m closer) | 37.4 m (the old view) | moves in / moves out | back to start |

The close camera stops before it reaches the umpire's chair.

### 2. Players move (R-76)

**How it was tested.** The movement test had collected nothing, because Unity refused to run the piece
that took the samples. That was fixed first, then a match was played in Unity for 70 seconds and every
player's position was read on every frame (130,074 frames).

| Player | Furthest from her starting spot | Closest she got to the net |
|---|---|---|
| A1 | 5.3 m | 0.6 m |
| A2 | 6.3 m | 0.6 m |
| B1 | 6.5 m | 0.6 m |
| B2 | 4.5 m | 0.6 m |

- All four players leave their spots, and all four reach the net.
- **28 spikes:** the attacker hit from 1.1–1.8 m off the net (1.4 m on average). The blocker on the
  other side was at the net, 0.6 m away, every time.
- About a second after the spike, the attacker was on her way back.
- They walk using the animations already in the project, and nobody leaves the court.

### 3. Spectators (R-74)

- **25 of 25** animated crowd figures clap, cheer, take photos or idle on the spot for the whole
  70-second test. Before the fix it was 17 of 25; the three girls by the tent were frozen.
- **The three walkers on the left** now stand and animate. Each moved 0.00 m in the test. None of the
  crowd's animation sets contains a walk any more, so nobody can wander off.
- Only animations already in the project were used.

### 4. Club names and kits on the court (R-73, Unity half)

- Tested in Unity against a copy of your save, on career 10, match 312.
- The scoreboard reads **SYDNEY RIPTIDE vs ROME BEACH GLADIATORS**, instead of the old "BLUE SHARKS /
  RED GIANTS".
- Your pair wears your wizard colours. The opponents wear Rome Beach Gladiators' own navy and sky blue,
  with their own skin tones.

### 5. The new 3D Court build

| File | Before | Tonight |
|---|---|---|
| Game data (`.data`) | 267,141,147 bytes | 266,214,711 bytes (214,583,435 compressed) |
| Game code (`.wasm`) | 51,445,891 bytes | 51,484,510 bytes (9,009,996 compressed) |

Same settings as the last build (textures capped at 2048). The render proof ran on your RTX 5080,
against a copy of your save:
- the court, venue, crowd and four players all render;
- the scoreboard says "SYDNEY RIPTIDE 0 - ROME BEACH GLADIATORS 2";
- all four players' data and colours arrived, and the match started 4.2 seconds after loading;
- **0 errors**.

### 6. Harness

- **First full run: 35 of 38.**
  - world tour competitors: a harness team forfeited one match because of injuries;
  - gameplay smoke: one match came back forfeited;
  - season trophies: none of its eight simulated seasons produced a champion.
  - None of the game's code had changed since the last clean run; these results come down to random
    seasons.
- **Second full run straight after, same build: 38 of 38, 845 checks, all passed.**
- Recorded as R-78; it needs a decision from you (see below).

### 7. Installer 0.9.1 (R-66)

**Why it offered "Volley-Ball-Empire".** Nothing in the build settings used that name. The installer
re-offers whatever folder an earlier install on the computer used. This machine once had the build from
before the rename installed in a "Volley-Ball-Empire" folder, and more recently my test folders.

**The fix.** The installer ignores a remembered folder that is not called "Beach Volleyball Empire".
It offers `…\AppData\Local\Programs\Beach Volleyball Empire` instead, and still removes the old version
from wherever it was.

**The proof,** run on this machine:
1. Put a 0.9.0 install back into a wrongly named test folder, using the real 0.9.0 installer.
2. Ran the 0.9.1 installer by its own window. The "Choose Install Location" page showed
   `C:\Users\rbonn\AppData\Local\Programs\Beach Volleyball Empire` (screenshot taken), then Cancel.
3. Installed 0.9.1 silently. It went into that folder (953 files), and the old test folder was emptied
   (953 → 0 files).
4. Installed again, which reused the same folder. Then uninstalled, which left it clean.

**The build:**
- **Installer:** `C:\build\vbe\Beach Volleyball Empire Setup 0.9.1.exe`, 335,301,232 bytes, sha256
  `548f6206c4758acda8cf83c56618790e022715fd5ae45567aa3f8c280235d396`.
- **`C:\build\vbe\win-unpacked`:** 952 files, 556,297,102 bytes, fingerprint of all its files
  `ab3b700ed71043382a309b19d6c2ccae6f6855799c6ea39a7abe9b6ef08e2e55`.
  - The game exe: sha256 `3103c04be4856c6bccb0cdd78bb2b8ddc039af6706014f801fd0c3ea72f81ebb`, version
    0.9.1, Bean & Label.
- **Checks:**
  - the database library matches Electron (verify-native-abi OK);
  - the starter database was packaged on its own, with no extra `-wal`/`-shm` files;
  - only the compressed 3D Court files are in the package.
- **No menu bar:** the game was started from `win-unpacked` on an empty test profile (not your save).
  The window has no File/Edit/View bar, and it opened on "Select Manager — No profiles yet".

---

## What failed or was left, and why

1. **The first installer fix left the old install's files behind.**
   - Its folder was right, but the old version's own uninstaller looked for its files in the wrong
     place and removed nothing.
   - I found this in the test, changed the fix, rebuilt 0.9.1 and ran the full test again (above).
   - The installer described above is the second one; the first was replaced.
2. **The first harness run was 35 of 38 (R-78, needs your decision).**
   - Three tests assume things that are only likely, not certain: that nobody gets injured, and that
     one of eight seasons ends in a title.
   - I did not change the tests tonight. Options, your call:
     - switch injuries off for the test teams;
     - accept a forfeit as a valid result in those checks;
     - or play more seasons in the trophy test.
3. **Not covered by the installer fix.** If someone with an old, wrongly named install picks "Anyone
   who uses this computer" on the first page, the old files may be left behind. The normal "Only for
   me" path is the one tested.
4. **Left on the C: drive, not deleted:**
   - **A full copy of the game, version 0.9.0,** in
     `C:\vbe-test-install\Volley-Ball-Empire\Beach Volleyball Empire` (953 files, 557 MB).
     - It was put there at 12:25 today.
     - That path is exactly what the R-66 fault produces: the old "Volley-Ball-Empire" folder with
       "Beach Volleyball Empire" added underneath.
     - Windows no longer lists it as installed, and tonight's tests did not touch it.
     - Your save is not in it (saves live in `AppData\Roaming`), so the folder can be deleted.
   - **Empty test folders** with no files in them:
     - `C:\vbe-test-install-0.9.0-r65`
     - `C:\vbe-test-install-0.9.0`
     - `…\AppData\Local\Programs\Beach Volleyball Empire`
5. **Windows lists nothing as installed now.** My test install was removed, so your install tomorrow is
   a fresh one.
6. **Unity side notes.**
   - Unity's batch mode changes two settings files every time it runs, `UnityConnectSettings.asset` and
     `ProjectSettings.asset`. I put `ProjectSettings.asset` back and committed neither.
   - Unity also can't carry a running match through a script reload while you play in the Editor. The
     real game never reloads, so this only matters if you edit scripts during Play.

---

## Three things to check on screen tomorrow

1. **Install.**
   - Run `C:\build\vbe\Beach Volleyball Empire Setup 0.9.1.exe`. On "Choose Install Location" the folder
     should end in `\Programs\Beach Volleyball Empire`, with no "Volley-Ball-Empire" in it.
   - Finish, start the game from the Start menu. There should be no menu bar at the top, and your
     profiles should be there.
2. **Zoom.**
   - Open a match in 3D Court and roll the mouse wheel: the camera moves in and out, and + and − do the
     same.
   - Press 2: the overhead view starts much closer than before, and the wheel works there and on 1 too.
3. **A rally.**
   - Watch a few points. The attacker runs to the net to spike, and a player on the other side goes up
     at the net to block.
   - The three girls by the tent clap and cheer, and the figures on the left stand in place.
   - The scoreboard shows both clubs' names, and the opponents wear their own colours.

---

## Commits (all pushed)

**Unity** (`volleyball-unity`, main):
- `da6f869` R-73 scoreboard names
- `707defe` R-76 players move
- `347e193` R-71 zoom
- `415375c` R-74 spectators

**Game** (`Volley-Ball-Empire`, main):
- `2d23dcc` the new 3D Court build
- `9e86e48` register
- `b85ae80` R-66 installer folder and 0.9.1
- `9e4d1a5` register
- then the commit that adds this file
