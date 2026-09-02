# Parked ideas

Things worth building that are deliberately **not** in the current work. Filed
here so they stop occupying head-space, not because they are scheduled.

---

## Olympic medal ceremony

**Status: idea only — Rob has a design in mind, not yet written down.**
Filed 3 September 2026 so it does not get lost or derail the roster work.

### Why it is worth doing

The Olympics is the emotional peak of a five-season career, and right now it
just... resolves. `pages/locations.tsx` walks a bracket — Group Stage,
Quarter Finals, Semi Finals, Bronze Medal Match, Gold Medal Match — and there
is a Medal Cabinet that counts what you have won. But between winning the gold
medal match and seeing a number increment, **nothing happens**. The single
biggest moment in the game has no moment.

Compare it with what already exists: the season boundary gets a
`season-review-dialog` that interrupts the auto-advance ticker, because "a
season boundary is an event, not a place". A medal is far more of an event than
a season rollover, and it has less ceremony than one.

### What already exists to build on

- **Bracket and stages** — `OLYMPIC_STAGES` in `pages/locations.tsx`, including
  the bronze and gold matches and which carries which medal.
- **Medal cabinet** — `MedalBadge` for gold / silver / bronze, and
  `olympic_medals_count` on the players table.
- **Nation identity** — `olympic_selections` holds the squad the player picked,
  with its flag and country.
- **The interrupt pattern** — `season-review-dialog` already shows how to stop
  the clock and demand attention at a moment that matters. A ceremony would
  follow the same shape rather than inventing one.

### Open questions for when we come back

- Is it a **dialog** (like the season review, interrupting the ticker) or a
  **screen** you navigate to and can revisit?
- Does it show all three placings on a podium, or only the player's own result?
- What happens when the player **does not medal** — nothing, or a
  "watch someone else win" beat, which is arguably stronger?
- Does it fire for **every** medal, including AI-only ceremonies in seasons the
  player did not qualify? That is the difference between a personal reward and a
  living world.
- Anthem / flag-raise moment — this is where the **real flag assets** below
  would earn their place. A podium with `🇫🇯` rendering as the letters "FJ" would
  be worse than no podium.

### Dependency worth noting

**A ceremony needs real flags.** See the flag-assets note below — emoji flags do
not render on Windows, which is the shipping platform. Do the flags first or
the ceremony lands flat.

---

## Flags of the world — asset sources

**Status: recommended, not done.** Letters are fine for youth cards; they are
not fine for an Olympic podium.

### The problem being solved

Windows ships no country-flag emoji. Microsoft excludes them from Segoe UI
Emoji, so Chromium draws the two regional-indicator letters instead: `🇫🇯`
becomes `FJ`. The game is Electron on Windows, so that is what every player
sees — on the youth cards, on the Olympics screen (`COUNTRY_FLAGS` in
`routes/olympics.ts`), and in the job market.

### Recommended source

**`flag-icons`** — https://github.com/lipis/flag-icons

- **MIT licence.** Free for commercial use, no attribution required in-app.
- **~260 SVG flags**, named by ISO 3166-1 alpha-2: `au.svg`, `fj.svg`, `pg.svg`.
- Ships 4:3 and 1:1 (square) variants — the square set suits a card corner, the
  4:3 suits a podium or a results table.
- Vector, so it scales to a full-screen ceremony without going soft.

**It drops straight into what already exists.** `countryFlag()` and
`countryCode()` are already in `lib/db/src/schema/continents.ts`, and
`countryCode()` returns exactly the ISO2 code these files are named after — it
resolves all 65 player nationalities and all 56 staff ones. So the integration
is roughly:

```tsx
<img src={`/images/flags/${countryCode(nationality)}.svg`} alt={nationality} />
```

Copy the `flags/4x3/` folder into `artifacts/beach-volleyball/public/images/flags/`
and it works offline in the packaged app — no CDN, no network at runtime, which
matters because Electron must work without a connection.

### Alternatives considered

| source | licence | note |
|---|---|---|
| **flag-icons** | MIT | recommended — ISO2 filenames match `countryCode()` |
| circle-flags | MIT | circular crops; nice for avatars, wrong for a podium |
| twemoji | CC-BY 4.0 | flags named by codepoint, not ISO2; needs attribution |
| flagcdn.com | free API | **needs network** — unusable in a packaged Electron app |
| Wikimedia Commons | mixed | per-file licensing and inconsistent naming; avoid |

### Scope when we do it

Do it **once, across every screen** — youth cards, Olympics, job market,
national squads — rather than one screen at a time. Mixed flags-and-letters
would look more broken than letters everywhere. ~260 SVGs is about 3 MB, which
is nothing against a 686 MB installer.
