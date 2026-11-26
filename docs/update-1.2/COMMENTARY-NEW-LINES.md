# 1.2 B4: new commentary lines for Rob to record

The court now says what really happened: an ace, an error, a comeback, set point, match point, the walk-on, and the match won.

**What exists today.** The existing 48 clips cover 8 kinds of play: serve, dig, set, spike, block attempt, block, point and rally. They are still used, as before.

**What is missing.** The 42 lines below are written, and the court is ready for them, but nothing has been recorded. Per the brief, no audio was made for them.

**Until Rob records them, nothing breaks:**
- A point that ends in one of these ways says one of the existing **point** lines, as every point did before.
- The walk-on says nothing.
- Once a clip is in the folder under its file name, it plays. No code change is needed.

**Where the clips go:** `artifacts/beach-volleyball/public/unity-build/StreamingAssets/commentary/`, as MP3, beside the existing 48.

**Voices.** The same as `LINES.txt`: ElevenLabs, A = Kailey, B = Hukum, eleven_v4, stability 0.0, style 0.8. Use [excited] or [shouting] as the existing point, block and rally lines do; [shouting] suits ace, match point and match won.

**When each is said:**

| Kind | When the court says it |
|---|---|
| ace | a serve nobody on the other side touched |
| error | the point was lost by a mistake: out, into the net, four hits, a double contact, a service or attack error |
| comeback | a pair that was 3 or more behind in this set draws level or takes the lead (once per set for each pair) |
| setpoint | after a point, the next point can end the set |
| matchpoint | after a point, the next point can end the match |
| walkon | as the players walk on before the first serve |
| matchwon | the last point of the match |

If more than one fits, the court picks one in this order: match won, comeback, ace, block, match point, set point, error, point.

## Kailey (A)

| File | Line |
|---|---|
| `A_ace_1.mp3` | Ace! Nobody laid a hand on it! |
| `A_ace_2.mp3` | Service ace! Right on the line! |
| `A_ace_3.mp3` | Ace! She found the gap perfectly! |
| `A_error_1.mp3` | Oh no, that one's gone long! |
| `A_error_2.mp3` | Into the net! A costly error! |
| `A_error_3.mp3` | An unforced error, and that's a gift! |
| `A_comeback_1.mp3` | They were behind, and now they've fought back level! |
| `A_comeback_2.mp3` | What a comeback! The momentum has swung! |
| `A_comeback_3.mp3` | From three down, they've clawed their way back! |
| `A_setpoint_1.mp3` | Set point! |
| `A_setpoint_2.mp3` | One more point and the set is theirs! |
| `A_setpoint_3.mp3` | Set point! The pressure is on now! |
| `A_matchpoint_1.mp3` | Match point! |
| `A_matchpoint_2.mp3` | One point from victory! |
| `A_matchpoint_3.mp3` | Match point! Can they finish it? |
| `A_walkon_1.mp3` | Here come the teams! Welcome to the beach! |
| `A_walkon_2.mp3` | The players are out, and the crowd is ready! |
| `A_walkon_3.mp3` | What an atmosphere for this one! |
| `A_matchwon_1.mp3` | And that's the match! What a performance! |
| `A_matchwon_2.mp3` | Game, set and match! |
| `A_matchwon_3.mp3` | They've done it! The match is theirs! |

## Hukum (B)

| File | Line |
|---|---|
| `B_ace_1.mp3` | An ace! That serve was unplayable! |
| `B_ace_2.mp3` | Clean ace! The receiver never moved! |
| `B_ace_3.mp3` | Ace! What a weapon that serve is! |
| `B_error_1.mp3` | Out! She overcooked it! |
| `B_error_2.mp3` | That's a mistake they'll want back! |
| `B_error_3.mp3` | An error hands them the point! |
| `B_comeback_1.mp3` | Here comes the comeback! |
| `B_comeback_2.mp3` | They just won't go away! |
| `B_comeback_3.mp3` | The fightback is on! Listen to this crowd! |
| `B_setpoint_1.mp3` | Set point coming up! |
| `B_setpoint_2.mp3` | They can close out the set right here! |
| `B_setpoint_3.mp3` | Big moment! Set point! |
| `B_matchpoint_1.mp3` | Match point, and the crowd is on its feet! |
| `B_matchpoint_2.mp3` | They're serving for the match! |
| `B_matchpoint_3.mp3` | This is it! Match point! |
| `B_walkon_1.mp3` | A big welcome for both pairs! |
| `B_walkon_2.mp3` | They're walking out to a great reception! |
| `B_walkon_3.mp3` | Let's get this match under way! |
| `B_matchwon_1.mp3` | Victory! Listen to that crowd! |
| `B_matchwon_2.mp3` | That's it! A brilliant win! |
| `B_matchwon_3.mp3` | Match over! What a way to finish! |

"They're serving for the match" is always true when it is said: under rally scoring, the pair that has just reached match point won the last point, so it serves next.
