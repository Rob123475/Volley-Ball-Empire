# Overnight brief 1 Oct → 2 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\OVERNIGHT-BRIEF-01OCT.md`, followed in its order (A → B → C → D).
Game repo branch `fix-batch-29sep`; Unity repo `Rob123475/volleyball-unity`, branch `main`.
Rob's live save is never opened: tests use copies of the starter DB or of `Downloads\volleyball-empire-backup-01oct-1225.sqlite` (only ever copied). No Steam upload.
The ElevenLabs key check (`scripts/check-no-elevenlabs-key.cjs`) runs in the pre-push hook of both repos on every push.

## Items (one proof line each)

| # | Item | Status | Commit | What changed, and how it is proven |
|---|---|---|---|---|
| 1 | N-26 Banner: WINNER only | Done | Unity `fef9585` | SPIKE and BLOCK are no longer bannered (their three calls and the word switch deleted); WINNER stays where it was, high in the frame. Proof (Editor/PlayRenderProof `-renderShot words`, batch): 3 words rendered, all WINNER, while 10 spikes and 3 blocks were played; none on the players. `docs/proof-02oct/n26-word-1.png`, `n26_words.txt`. In the game with the WebGL export below. |
| 2 | N-27 Scoreboard larger | Done | Unity `735bc9f` | It was one OnGUI label at a fixed 24 px whatever the window size, white on the sky. Rebuilt as a screen-space canvas scaled with the window (reference 1280 × 720, ×1.5 at 1920 × 1080): serve line 22 px, "SET n SETS a-b" 26 px, the score line 40 px (auto-sizes down to 28 for long club names, never clips), on a dark band above the WINNER banner; the OnGUI label is deleted. Proof render (PlayRenderProof `-renderShot score`): `docs/proof-02oct/n27-scoreboard.png`, `n27_scoreboard.txt`; headless render of the WebGL export: see the export row. |
| 3 | N-28 Crowd sound is static | Done | Unity `806f7d4`; game (scripts) see below | Cause: the crowd was one procedurally made noise loop (white noise, hence "waves", no rise and fall) plus one generated cheer; both, the generated whistle and their generator are deleted. **Made** (ElevenLabs Sound Effects, `eleven_text_to_sound_v2`, `scripts/elevenlabs-crowd.mjs`; prompts written in the style of Rob's two clips, a real stadium crowd close and loud): two seamless 30 s crowd beds, `bed_calm` and `bed_excited` (loop point checked: level either side of the wrap within 0.5 dB, waveform jump under 3 typical steps, so no crossfade was needed), 4 cheers, 3 applause, 2 crowd whistles (fans whistling; the referee whistle is still off, as before), 2 groans, 1 big roar (7 s). Point reactions loudness-matched to Rob's clips (RMS −14 dBFS; whistles −16; beds −20), peaks under −1 dBFS, stereo 44.1 kHz. In the game: Unity `Assets/Resources/Audio/Crowd/` (shipped inside the 3D match; Rob's two MP3s are there too); copies (MP3) in `Downloads\bve-commentary\crowd\generated`. **How it plays** (AudioManager rebuilt): both beds loop all match; the excited bed and the overall level rise with the rally (from 4 touches, fully worked up at 14), peak as the point ends, then drop below resting between points and come back at the serve. Reactions by how the point ended: a cheer (4 made + Rob's 2, never the same twice in a row; a crowd whistle on top a third of the time) for an ace, kill or block; a groan for a serve or attack error; cheer + applause for a set; applause after any rally of 12+ touches; the roar on match point and on the winning point (with a cheer and a whistle). Commentary stays louder: everything ducks to 0.40 under speech (unchanged mechanism; proven again with the new clips in item 4). **Proof** (Editor/CrowdAudioProof, a whole match at 4×, `docs/proof-02oct/n28_crowd_audio.txt`): 16/16 clips load; both beds looping all match; bed level between points 0.21, start of a rally 0.32, long rally 0.91, just after a point 1.07; 68 points, 14 different reaction clips heard (all of them); 10 errors, 10 groans; roar on the match point and on the winning point. |

## Questions for Rob

## ElevenLabs credits used

The key has no `user_read` permission, so the account's own counter could not be read; these are the API's `character-cost` response headers, summed per call.

| What | Calls | Credits (header) |
|---|---|---|
| Sound effects, item 3 (N-28): two test calls (a 1 s whistle as PCM and as MP3, to find the PCM layout) | 2 | 22 |
| Sound effects, item 3: 13 clips (2 beds of 30 s, 4 cheers, 3 applause, 2 groans, roar, and a referee whistle later remade) | 13 | 1,036 |
| Sound effects, item 3: the 2 whistles remade as crowd whistling | 2 | 50 |
| **Sound effects total** | 17 | **1,108** |

## What Rob must check on screen
