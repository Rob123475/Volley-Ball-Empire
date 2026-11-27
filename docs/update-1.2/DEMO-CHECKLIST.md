# 1.2 demo: Rob's checklist

The demo is `C:\build\vbe-1.2-demo-2026-11-27\Beach Volleyball Empire 1.2 Demo Setup 1.2.0-demo1.exe` (450 MB). It is installed on this PC already.

1. **Plug in a real Xbox or PlayStation controller and play a few points, before the weekend.** No real controller has been tested yet: only the keyboard and Unity's virtual pad in batch proofs.
   - Start Manual from the court's button, or Tab / View / Share.
   - Check that the pad moves her (left stick) and that A/Cross digs, X/Square sets and Y/Triangle spikes.
   - Check that L3 switches camera look, the D-pad steps views and R3 skips between points.
   - If the pad does nothing, tell me which pad and what you pressed.
2. **Installing it on your friend's PC.** Copy the Setup .exe across and run it.
   - Windows will warn that it is from an unknown publisher (it is not code-signed): **More info → Run anyway**.
   - It installs as "Beach Volleyball Empire 1.2 Demo", with its own Start-menu and desktop shortcut, beside the Steam version. It never opens the Steam version's save.
3. **The title screen.** Along the bottom it says **"Beach Volleyball Empire 1.2 Demo · version 1.2.0-demo1"**. The first run has no managers: it starts from the starter database.
4. **New Profile, then a new career.** The Day 1 draft as usual: pick 2 or 3 seniors, then Finish.
5. **Settings → Camera and Match presentation** (gear on the title screen, or Settings in the menu).
   - Camera: TV look for watched matches, Game look for played ones (the defaults).
   - Leave both skip switches **off** to show off the presentation. Turn on "Skip to next serve" if your friend wants pace.
6. **Next match → Watch Match.** The court loads, about 20 s the first time. The **walk-on** follows: the four walk on, then each gets a lower third with her name, nation and club.
   - The walk-on has no commentary yet: its lines are written but not recorded (`COMMENTARY-NEW-LINES.md`).
7. **During play:**
   - **V** (L3) switches between the roaming **TV** camera and the **Game** look.
   - **1–6** pick a Game view; **+ / −** zoom.
   - The **1x / 2x / 4x** buttons zoom the camera (they don't change the match's speed).
8. **Between points** (about 3 s, 4 s for a big one): the score, the umpire's signal, close-ups of the scorer and the other side.
   - Aces, blocks, diving saves and hard spikes get a slow-motion **REPLAY**.
   - **Enter** (R3) skips it.
9. **Played match: Manual** (the button on the court page, or Tab):
   - Your timing decides the point: **J** dig, **K** set, **L** hold and release to spike (tap L on the serve meter).
   - **WASD** moves her. **H** hides the controls help.
   - At 1280×720 the help panel covers the left end of the score bar, so press H once you know the keys.
   - Be ready for a beating at first: a test bot that only mashes the buttons and never moves lost 0-11, 0-11.
10. **Set point and match point** get a banner. At the end the winners walk to the net applauding, then the result box shows the sets.
11. **Continue** on the result box goes back to the dashboard. Recent Results shows the match with WIN or LOSS. **Finances** shows the prize (a loss still pays the runner-up share).
12. **Leaving:** Settings → Exit game. The save stays in `AppData\Roaming\Beach Volleyball Empire 1.2 Demo`. Uninstalling (Windows Settings → Apps) leaves that folder; delete it by hand to start fresh.
13. **To show your own career in the demo** (optional): quit the demo, then copy `AppData\Roaming\Beach Volleyball Empire\volleyball-empire.sqlite` into `AppData\Roaming\Beach Volleyball Empire 1.2 Demo\`.
    - Copy it, never move it. The demo then plays on the copy only.
    - The test did exactly this, and your real save was byte for byte unchanged afterwards.

**Things you may notice, known and not fixed for the demo:**
- **Commentary:** aces, errors, set and match point, comebacks and match won use an existing point line until the 42 new lines are recorded.
- **Close-ups:** a scorer close-up is sometimes shot through the net.
- **Match length:** matches are longer than in 1.1.3, because of the walk-on and 3–4 s between points. Use the skip switches if that drags.
