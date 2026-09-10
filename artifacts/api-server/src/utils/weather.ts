/**
 * Per-venue weather generation.
 *
 * Moved out of routes/matches.ts unchanged (R-35): the season fixture
 * generator needs it, and the generator had to move to utils/ to keep the
 * import graph one-directional, so the weather it depends on came with it.
 * routes/matches.ts imports it back for the one scheduling route that also
 * generates weather.
 */

// ── Weather system ────────────────────────────────────────────────────────────
// Location pools: biased toward the typical climate of each real-world venue.
// Each string appears multiple times to weight probability.
// Types: clear, sunny, windy, rain, hot, extreme_heat, stormy, perfect, cloudy, overcast
export const LOCATION_WEATHER_POOLS: Record<number, string[]> = {
  1:  ["sunny","sunny","hot","hot","rain","stormy","perfect","cloudy"],           // Copacabana – tropical
  11: ["hot","hot","extreme_heat","hot","sunny","sunny","windy","perfect"],       // Hurghada – Red Sea desert
  2:  ["sunny","sunny","windy","windy","cloudy","perfect","overcast","clear"],    // Bondi – breezy southern
  3:  ["sunny","sunny","sunny","hot","perfect","cloudy","windy","clear"],         // Waikiki – balmy trade-winds
  4:  ["sunny","hot","hot","stormy","rain","cloudy","windy","overcast"],          // Clearwater – Florida heat/storms
  5:  ["hot","hot","sunny","stormy","rain","cloudy","sunny","overcast"],          // Varadero – Caribbean
  6:  ["sunny","hot","hot","perfect","rain","stormy","cloudy","sunny"],           // Ipanema – tropical
  7:  ["hot","hot","stormy","rain","rain","cloudy","sunny","overcast"],           // Kata Beach – Southeast Asia
  8:  ["sunny","sunny","windy","windy","perfect","cloudy","hot","clear"],         // Mykonos – Mediterranean meltemi
  9:  ["hot","sunny","stormy","rain","cloudy","sunny","overcast","perfect"],      // Bali – tropical
  10: ["cloudy","cloudy","windy","overcast","perfect","sunny","stormy","rain"],   // Nice – Mediterranean, variable
};

// Fallback for unknown location ids
const DEFAULT_POOL = ["sunny","clear","cloudy","windy","hot","overcast","stormy","perfect","rain"];

export type WeatherResult = { weather: string; windSpeed: number; temperature: number };

export function generateWeather(locId?: number | null): WeatherResult {
  const pool = (locId != null ? LOCATION_WEATHER_POOLS[locId] : null) ?? DEFAULT_POOL;
  const weather = pool[Math.floor(Math.random() * pool.length)];

  // Weather-conditional wind & temperature ranges for realism
  let wind: number, temp: number;
  switch (weather) {
    case "stormy":
      wind = 22 + Math.random() * 32;   // 22–54 km/h — genuinely dangerous
      temp = 17 + Math.random() * 9;    // 17–26°C — cooled by storm
      break;
    case "windy":
      wind = 20 + Math.random() * 24;   // 20–44 km/h
      temp = 16 + Math.random() * 16;   // 16–32°C
      break;
    case "rain":
      wind = 8 + Math.random() * 20;    // 8–28 km/h — moderate wind with rain
      temp = 14 + Math.random() * 12;   // 14–26°C — cooler in rain
      break;
    case "hot":
      wind = Math.random() * 9;         // 0–9 km/h — still & sweltering
      temp = 34 + Math.random() * 13;   // 34–47°C
      break;
    case "extreme_heat":
      wind = Math.random() * 6;         // 0–6 km/h — barely any breeze
      temp = 44 + Math.random() * 10;   // 44–54°C — dangerously hot
      break;
    case "perfect":
      wind = 6 + Math.random() * 10;    // 6–16 km/h — pleasant sea breeze
      temp = 22 + Math.random() * 9;    // 22–31°C
      break;
    case "clear":
      wind = 2 + Math.random() * 10;    // 2–12 km/h — calm & bright
      temp = 22 + Math.random() * 12;   // 22–34°C
      break;
    case "overcast":
      wind = 10 + Math.random() * 18;   // 10–28 km/h
      temp = 15 + Math.random() * 13;   // 15–28°C
      break;
    case "cloudy":
      wind = 6 + Math.random() * 17;    // 6–23 km/h
      temp = 17 + Math.random() * 14;   // 17–31°C
      break;
    case "sunny":
    default:
      wind = Math.random() * 16;        // 0–16 km/h
      temp = 24 + Math.random() * 15;   // 24–39°C
      break;
  }

  // 8% chance of extreme conditions (heatwave spike, gale burst, cold snap)
  if (Math.random() < 0.08) {
    const roll = Math.random();
    if (roll < 0.4) {
      temp  = Math.min(temp + 6 + Math.random() * 6, 54);  // Heatwave
    } else if (roll < 0.75) {
      wind  = Math.min(wind * 1.8 + Math.random() * 10, 65); // Gale
    } else {
      temp  = Math.max(temp - 8 - Math.random() * 6, 8);   // Cold snap
    }
  }

  return {
    weather,
    windSpeed:   Number(wind.toFixed(1)),
    temperature: Number(temp.toFixed(1)),
  };
}
