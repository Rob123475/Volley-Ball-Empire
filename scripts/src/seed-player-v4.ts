/**
 * Populates the `player_v4` JSONB column for every non-retired player.
 * Preserves all existing visible data. Generates hidden values (DNA, development,
 * scouting, personality, regen seed, visual kit, career data) from sensible defaults.
 *
 * Run: pnpm --filter @workspace/scripts run seed-player-v4
 */
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { eq, isNull, or } from "drizzle-orm";

// ── tiny helpers ──────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 99): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}
function jitter(base: number, range = 5): number {
  return clamp(base + Math.floor(Math.random() * range * 2) - range);
}
function rand(min: number, max: number): number {
  return Math.round(Math.random() * (max - min) + min);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
function uid(prefix: string, id: number): string {
  return `${prefix}-${String(id).padStart(5, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ── flag / country codes ──────────────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  "Algeria": "DZ", "Angola": "AO", "Cameroon": "CM", "Egypt": "EG",
  "Ethiopia": "ET", "Ghana": "GH", "Kenya": "KE", "Morocco": "MA",
  "Nigeria": "NG", "Senegal": "SN", "South Africa": "ZA", "Tanzania": "TZ",
  "Tunisia": "TN", "Uganda": "UG", "Ivory Coast": "CI", "Mozambique": "MZ",
  "Saudi Arabia": "SA", "UAE": "AE", "Qatar": "QA", "Kuwait": "KW",
  "Iran": "IR", "Israel": "IL", "Jordan": "JO",
  "China": "CN", "Japan": "JP", "South Korea": "KR", "Thailand": "TH",
  "Vietnam": "VN", "Philippines": "PH", "Indonesia": "ID", "Malaysia": "MY",
  "India": "IN", "Kazakhstan": "KZ", "Turkey": "TR", "Uzbekistan": "UZ",
  "France": "FR", "Germany": "DE", "Italy": "IT", "Spain": "ES",
  "Netherlands": "NL", "Poland": "PL", "Russia": "RU", "Sweden": "SE",
  "Norway": "NO", "Switzerland": "CH", "Czech Republic": "CZ", "Austria": "AT",
  "England": "GB", "Greece": "GR", "Portugal": "PT", "Croatia": "HR",
  "Hungary": "HU", "Romania": "RO", "Belgium": "BE", "Denmark": "DK",
  "Ukraine": "UA", "Serbia": "RS", "Slovakia": "SK",
  "United States": "US", "USA": "US", "Canada": "CA", "Mexico": "MX",
  "Cuba": "CU", "Dominican Republic": "DO", "Puerto Rico": "PR", "Jamaica": "JM",
  "Brazil": "BR", "Argentina": "AR", "Chile": "CL", "Colombia": "CO",
  "Peru": "PE", "Venezuela": "VE", "Ecuador": "EC", "Bolivia": "BO",
  "Uruguay": "UY", "Paraguay": "PY",
  "Australia": "AU", "New Zealand": "NZ", "Fiji": "FJ", "Samoa": "WS",
  "Tonga": "TO", "Papua New Guinea": "PG", "Tahiti": "PF", "Cook Islands": "CK",
  "Maldives": "MV", "Costa Rica": "CR",
};

// ── national kit colours (top/bottom primary) ─────────────────────────────────

const KIT_COLOURS: Record<string, { top: string; bottom: string; trim: string }> = {
  "Brazil":          { top: "#009C3B",  bottom: "#FFDF00",  trim: "#002776" },
  "Australia":       { top: "#00843D",  bottom: "#FFD700",  trim: "#003DA5" },
  "USA":             { top: "#B22234",  bottom: "#3C3B6E",  trim: "#FFFFFF" },
  "United States":   { top: "#B22234",  bottom: "#3C3B6E",  trim: "#FFFFFF" },
  "Germany":         { top: "#000000",  bottom: "#DD0000",  trim: "#FFCE00" },
  "France":          { top: "#002395",  bottom: "#FFFFFF",  trim: "#ED2939" },
  "Italy":           { top: "#009246",  bottom: "#FFFFFF",  trim: "#CE2B37" },
  "Spain":           { top: "#AA151B",  bottom: "#F1BF00",  trim: "#AA151B" },
  "Japan":           { top: "#BC002D",  bottom: "#FFFFFF",  trim: "#BC002D" },
  "China":           { top: "#DE2910",  bottom: "#FFDE00",  trim: "#DE2910" },
  "South Korea":     { top: "#003478",  bottom: "#FFFFFF",  trim: "#CD2E3A" },
  "Russia":          { top: "#FFFFFF",  bottom: "#003087",  trim: "#DA010D" },
  "Netherlands":     { top: "#FF4F00",  bottom: "#FFFFFF",  trim: "#003DA5" },
  "Canada":          { top: "#FF0000",  bottom: "#FFFFFF",  trim: "#FF0000" },
  "Argentina":       { top: "#75AADB",  bottom: "#FFFFFF",  trim: "#75AADB" },
  "Cuba":            { top: "#002A8F",  bottom: "#CF142B",  trim: "#FFFFFF" },
  "Thailand":        { top: "#A51931",  bottom: "#F4F5F8",  trim: "#2D2A4A" },
  "Kenya":           { top: "#006600",  bottom: "#BB0000",  trim: "#000000" },
  "Nigeria":         { top: "#008751",  bottom: "#FFFFFF",  trim: "#008751" },
  "Morocco":         { top: "#C1272D",  bottom: "#006233",  trim: "#FFFFFF" },
  "Egypt":           { top: "#CE1126",  bottom: "#FFFFFF",  trim: "#000000" },
  "Poland":          { top: "#FFFFFF",  bottom: "#DC143C",  trim: "#FFFFFF" },
  "Turkey":          { top: "#E30A17",  bottom: "#FFFFFF",  trim: "#E30A17" },
  "Greece":          { top: "#0D5EAF",  bottom: "#FFFFFF",  trim: "#0D5EAF" },
  "Sweden":          { top: "#006AA7",  bottom: "#FECC02",  trim: "#006AA7" },
  "Norway":          { top: "#EF2B2D",  bottom: "#FFFFFF",  trim: "#002868" },
  "Mexico":          { top: "#006847",  bottom: "#FFFFFF",  trim: "#CE1126" },
  "India":           { top: "#FF9933",  bottom: "#138808",  trim: "#000080" },
  "Iran":            { top: "#239F40",  bottom: "#FFFFFF",  trim: "#DA0000" },
  "Serbia":          { top: "#C6363C",  bottom: "#0C4076",  trim: "#FFFFFF" },
  "England":         { top: "#FFFFFF",  bottom: "#CF111A",  trim: "#003078" },
  "New Zealand":     { top: "#000000",  bottom: "#000000",  trim: "#CC142B" },
  "Fiji":            { top: "#68BFE5",  bottom: "#003087",  trim: "#CC0001" },
};

const CONTINENT_KITS: Record<string, { top: string; bottom: string; trim: string }> = {
  "Africa & Middle East": { top: "#C17F24", bottom: "#1A6B3C", trim: "#FFFFFF" },
  "Asia":                 { top: "#CC0000", bottom: "#FFFFFF", trim: "#CC0000" },
  "Europe":               { top: "#003DA5", bottom: "#FFFFFF", trim: "#003DA5" },
  "North America":        { top: "#CC0000", bottom: "#003087", trim: "#FFFFFF" },
  "South America":        { top: "#009C3B", bottom: "#FFD700", trim: "#FFFFFF" },
  "Oceania":              { top: "#006AA7", bottom: "#00843D", trim: "#FFFFFF" },
};

function kitFor(nationality: string, continent: string | null) {
  return KIT_COLOURS[nationality]
    ?? CONTINENT_KITS[continent ?? ""]
    ?? { top: "#1A56DB", bottom: "#FFFFFF", trim: "#1A56DB" };
}

// ── specialities / weaknesses by position ────────────────────────────────────

const SPECIALITIES: Record<string, string[]> = {
  spiker:     ["Power Spiker", "Jump Serve", "Cross-Court Attack", "Sharp Angle", "Back Row Attack", "Pipeline Attack"],
  defender:   ["Pancake Dig", "Dive & Recover", "Aerial Defence", "Read & React", "Serve Receive Specialist", "Line Defence"],
  setter:     ["Quick Set", "Back Set", "Jump Set", "Dump Shot", "Court Vision", "Two-Ball Attack"],
  blocker:    ["Roof Block", "Soft Block", "Double Block", "Cross-Body Block", "Tactical Footwork", "Closing Speed"],
  all_rounder:["Serve Pressure", "Transition Play", "Clutch Performance", "All-Court Awareness", "Versatile Attack", "Rally IQ"],
  universal:  ["Serve Pressure", "Transition Play", "All-Court Awareness", "Versatile Attack", "Clutch Performance"],
};

const WEAKNESSES: Record<string, string[]> = {
  spiker:     ["Limited Blocking", "Below-Average Reception", "Weak Back Defence"],
  defender:   ["Limited Power", "Average Blocking", "Short Attack Range"],
  setter:     ["Below-Average Serve Power", "Limited Attack", "Inconsistent Tempo"],
  blocker:    ["Slow Court Coverage", "Weak Reception", "Limited Dig Depth"],
  all_rounder:["No Elite Specialty", "Average Power", "Inconsistent Serve"],
  universal:  ["No Elite Specialty", "Average Power"],
};

const DEV_CURVES = ["Steady", "Late Bloomer", "Early Peak", "Explosive Growth", "Consistent"];
const DEV_PERSONALITIES = ["Hard Worker", "Natural Talent", "Competitor", "Tactician", "Leader"];
const ANIMATION_STYLES: Record<string, string> = {
  spiker:     "Power Forward",
  defender:   "Quick Defensive",
  setter:     "Elegant Playmaker",
  blocker:    "Strong Defensive",
  all_rounder:"Athletic Versatile",
  universal:  "Athletic Versatile",
};

// ── V4 builder ────────────────────────────────────────────────────────────────

function buildV4(p: {
  id: number; name: string; nationality: string; continent: string | null;
  age: number; position: string; playerType: string; isDraftPlayer: boolean;
  speed: number; power: number; defense: number; serve: number; block: number;
  stamina: number; morale: number; fatigue: number; fitness: number;
  injuryStatus: string; isInjured: boolean; scoutedPotential: string | null;
  potential: string; imageUrl: string | null; height: string;
  teamId: number | null; contractEndDate: string | null; salary: string;
}) {
  const pos   = p.position as keyof typeof SPECIALITIES;
  const pot   = p.potential;
  const age   = p.age;
  const ovr   = Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
  const kit   = kitFor(p.nationality, p.continent);
  const flag  = FLAG_MAP[p.nationality] ?? "XX";
  const stars = pot === "Elite" ? 5 : pot === "High" ? 4 : pot === "Average" ? 3 : pot === "Low" ? 2 : 3;

  // player_type
  let playerType: "Senior" | "Youth" | "Draft" | "Regen" = "Senior";
  if (p.playerType === "youth")  playerType = "Youth";
  else if (p.isDraftPlayer)      playerType = "Draft";

  // peak window
  const peakStart = pot === "Elite" ? rand(24, 26) : pot === "High" ? rand(25, 27) : rand(26, 29);
  const peakEnd   = peakStart + (pot === "Elite" ? rand(5, 7) : pot === "High" ? rand(4, 6) : rand(3, 5));

  // dev curve
  const devCurve  = age < 22 ? pick(["Late Bloomer", "Explosive Growth", "Steady"])
                  : age > 28 ? pick(["Early Peak", "Steady", "Consistent"])
                  : pick(DEV_CURVES);

  // core attrs (map existing + derive missing)
  const core = {
    serve:     clamp(p.serve),
    attack:    clamp(p.power + jitter(0, 3)),
    defence:   clamp(p.defense),
    block:     clamp(p.block),
    set:       pos === "setter" ? clamp(p.serve + jitter(2, 4)) : jitter(55, 8),
    dig:       pos === "defender" ? clamp(p.defense + jitter(2, 3)) : jitter(62, 8),
    speed:     clamp(p.speed),
    stamina:   clamp(p.stamina),
    jump:      pos === "blocker" ? clamp(p.block + jitter(0, 4)) : pos === "spiker" ? clamp(p.power - jitter(2, 3)) : jitter(68, 8),
    power:     clamp(p.power),
    accuracy:  jitter(ovr + (pos === "setter" ? 6 : pos === "defender" ? 3 : 0), 6),
    reaction:  jitter(p.speed + (pos === "defender" ? 4 : 0), 5),
    vision:    jitter(ovr + (pos === "setter" ? 8 : 2), 6),
    composure: jitter(ovr + (age > 26 ? 6 : 2), 5),
    teamwork:  jitter(ovr + (pos === "setter" ? 6 : 3), 5),
  };

  // advanced attrs
  const adv = {
    serve_pressure:   jitter(core.serve + (pos === "spiker" ? 4 : 0), 5),
    spike_timing:     jitter(core.attack + (pos === "spiker" ? 6 : -4), 5),
    shot_selection:   jitter(core.vision + 2, 5),
    line_defence:     jitter(core.defence + (pos === "defender" ? 6 : 0), 5),
    cross_defence:    jitter(core.defence + (pos === "defender" ? 4 : -2), 5),
    net_awareness:    jitter(core.block + (pos === "blocker" ? 6 : 0), 5),
    clutch:           jitter(ovr + (pot === "Elite" ? 8 : 2), 6),
    consistency:      jitter(ovr + (age > 25 ? 5 : 0), 5),
    error_control:    jitter(ovr + (pos === "defender" ? 4 : 0), 5),
    rally_iq:         jitter(core.vision + (pos === "setter" ? 6 : 2), 5),
    momentum_control: jitter(core.composure + 2, 5),
    adaptability:     jitter(ovr + (pos === "all_rounder" ? 8 : 2), 5),
  };

  // match engine modifiers
  const me = {
    winner_chance_modifier:  parseFloat((0.9 + ovr / 1000 + (pot === "Elite" ? 0.05 : 0)).toFixed(3)),
    error_chance_modifier:   parseFloat((1.1 - ovr / 1000).toFixed(3)),
    dig_success_modifier:    parseFloat((0.85 + core.defence / 1000 + (pos === "defender" ? 0.08 : 0)).toFixed(3)),
    block_success_modifier:  parseFloat((0.75 + core.block / 1000 + (pos === "blocker" ? 0.1 : 0)).toFixed(3)),
    serve_ace_modifier:      parseFloat((0.9 + core.serve / 1000).toFixed(3)),
    fatigue_drop_rate:       parseFloat((1.1 - core.stamina / 1000).toFixed(3)),
    pressure_bonus:          parseFloat((0.95 + adv.clutch / 1000).toFixed(3)),
    bad_form_penalty:        parseFloat((1.05 - ovr / 2000).toFixed(3)),
    boost_response: {
      attack_boost_effect:          parseFloat((1.05 + core.attack / 2000).toFixed(3)),
      defence_boost_effect:         parseFloat((1.05 + core.defence / 2000).toFixed(3)),
      risk_under_attack_boost:      parseFloat((1.0  + adv.clutch / 2000).toFixed(3)),
      stamina_cost_under_boost:     parseFloat((1.1  + p.fatigue / 500).toFixed(3)),
    },
  };

  // development
  const growth   = pot === "Elite" ? rand(68, 88) / 100 : pot === "High" ? rand(55, 75) / 100 : rand(40, 62) / 100;
  const ceiling  = pot === "Elite" ? rand(88, 99) : pot === "High" ? rand(80, 92) : rand(70, 84);
  const dev = {
    development_curve:             devCurve,
    growth_rate:                   parseFloat(growth.toFixed(2)),
    training_response:             parseFloat((growth * 0.9 + Math.random() * 0.1).toFixed(2)),
    peak_age_start:                peakStart,
    peak_age_end:                  peakEnd,
    decline_rate:                  parseFloat((pot === "Elite" ? rand(18, 28) : rand(25, 38)) / 100 + ""),
    hidden_ceiling:                ceiling,
    same_rating_variance_enabled:  true,
    development_personality:       pick(DEV_PERSONALITIES),
    potential_can_rise:            age < 24 && pot !== "Elite",
    potential_can_fall:            age > 28 && pot === "Average",
    breakout_probability:          parseFloat((age < 22 ? rand(12, 22) : rand(4, 12)) / 100 + ""),
    bust_probability:              parseFloat((pot === "Average" ? rand(8, 14) : rand(2, 8)) / 100 + ""),
    late_bloomer_probability:      parseFloat((devCurve === "Late Bloomer" ? rand(18, 28) : rand(4, 12)) / 100 + ""),
    position_change_probability:   parseFloat((playerType === "Youth" ? rand(8, 16) : rand(2, 7)) / 100 + ""),
  };

  // youth development
  const yd = {
    enabled_if_player_type_youth:  playerType === "Youth",
    physical_growth:               parseFloat((rand(55, 88)) / 100 + ""),
    mental_growth:                 parseFloat((rand(50, 82)) / 100 + ""),
    skill_growth:                  parseFloat((rand(60, 90)) / 100 + ""),
    growth_variance:               parseFloat((rand(18, 38)) / 100 + ""),
    late_growth_chance:            parseFloat((rand(15, 30)) / 100 + ""),
    early_peak_chance:             parseFloat((rand(5, 14)) / 100 + ""),
    personality_shift:             age < 20,
    position_change_probability:   parseFloat((rand(8, 18)) / 100 + ""),
    breakout_probability:          parseFloat((rand(12, 24)) / 100 + ""),
    bust_probability:              parseFloat((rand(6, 14)) / 100 + ""),
    academy_quality_modifier:      1.0,
  };

  // hidden DNA
  const dna = {
    competitiveness:       rand(60, 94),
    work_ethic:            rand(62, 96),
    coachability:          rand(55, 92),
    confidence_growth:     rand(50, 88),
    pressure_resistance:   jitter(ovr + (pot === "Elite" ? 10 : 2), 8),
    injury_resilience:     rand(50, 90),
    adaptability:          rand(55, 92),
    consistency_gene:      jitter(ovr, 10),
    leadership_growth:     rand(45, 88),
    professionalism_growth:rand(55, 92),
  };

  // regen
  const contCode  = (p.continent ?? "XX").slice(0, 3).toUpperCase().replace(/\s/g, "");
  const posCode   = pos.slice(0, 3).toUpperCase();
  const regen = {
    regen_enabled:                  true,
    regen_seed:                     uid(`${contCode}-${posCode}-${p.id}`, p.id),
    regen_quality_min:              Math.max(60, ovr - 15),
    regen_quality_max:              Math.min(99, ovr + 12),
    inheritance_strength:           parseFloat((rand(25, 55)) / 100 + ""),
    can_create_family_style_successor: pot === "Elite" || pot === "High",
    lineage_id:                     `LINEAGE_${String(p.id).padStart(5, "0")}`,
    parent_player_id:               null,
    generation_number:              1,
    regen_notes:                    "New regen must never be a clone. Inherit playstyle DNA only.",
  };

  // health
  const health = {
    current_fitness:   clamp(p.fitness, 0, 100),
    injury_status:     p.injuryStatus ?? "Healthy",
    injury_type:       p.isInjured ? p.injuryStatus : null,
    weeks_out:         0,
    injury_proneness:  rand(10, 45),
    recovery_speed:    rand(55, 90),
    fatigue:           clamp(p.fatigue, 0, 100),
    morale:            clamp(p.morale, 0, 100),
    confidence:        jitter(clamp(p.morale, 0, 100), 8),
    burnout_risk:      rand(8, 35),
  };

  // personality
  const personality = {
    professionalism: rand(60, 92),
    ambition:        pot === "Elite" ? rand(74, 96) : rand(58, 88),
    temperament:     rand(55, 90),
    leadership:      pos === "setter" ? rand(68, 94) : rand(50, 84),
    coachability:    age < 24 ? rand(68, 92) : rand(58, 84),
    marketability:   rand(50, 88),
    ego:             pot === "Elite" ? rand(40, 70) : rand(20, 55),
    loyalty:         rand(50, 85),
    media_handling:  rand(45, 85),
  };

  // form
  const form = {
    current_form:           clamp(p.morale, 40, 99),
    last_5_matches_average: parseFloat((clamp(p.morale, 40, 99) + jitter(0, 5)).toFixed(1)),
    confidence_trend:       p.morale >= 78 ? "Rising" : p.morale <= 55 ? "Falling" : "Stable",
    morale_trend:           p.fatigue > 50 ? "Declining" : "Stable",
    hot_streak:             p.morale >= 88 && p.fatigue < 20,
    cold_streak:            p.morale < 55 || p.fatigue > 70,
  };

  // specialities / weaknesses
  const specPool = SPECIALITIES[pos] ?? SPECIALITIES["all_rounder"];
  const wkPool   = WEAKNESSES[pos]   ?? WEAKNESSES["all_rounder"];
  const specialities = pickN(specPool, rand(2, 3));
  const weaknesses   = pickN(wkPool, rand(1, 2));

  // visual identity
  const visual_identity = {
    card_image:      p.imageUrl ?? null,
    unity_model:     "SK_Female_Base",
    skin_tone:       pick(["Light", "Medium Light", "Medium", "Medium Dark", "Dark"]),
    hair_style:      pick(["Ponytail", "Bun", "Braids", "Short", "Straight Long", "Curly"]),
    hair_colour:     pick(["Black", "Brown", "Dark Brown", "Blonde", "Auburn", "Dark"]),
    body_type:       pick(["Athletic", "Lean", "Muscular", "Tall Athletic"]),
    height_scale:    parseFloat((Number(p.height) / 175).toFixed(3)),
    face_variant:    `FACE_${String(rand(1, 20)).padStart(3, "0")}`,
    animation_style: ANIMATION_STYLES[pos] ?? "Athletic Versatile",
  };

  // visual kit
  const visual_kit = {
    kit_source:             "card_image_colours",
    top_primary_colour:     kit.top,
    top_secondary_colour:   kit.trim,
    bottom_primary_colour:  kit.bottom,
    bottom_secondary_colour:kit.trim,
    trim_colour:            kit.trim,
    accessory_colour:       kit.top,
    unity_material_rule:    "Apply primary colours to kit during matches. Never use default grey clothing.",
  };

  // scouting
  const scouting = {
    scouted_accuracy:    p.scoutedPotential ? rand(55, 90) : null,
    known_potential:     !!p.scoutedPotential,
    hidden_gem:          !p.scoutedPotential && pot === "Elite" && ovr < 78,
    risk_level:          pot === "Elite" ? "Low" : pot === "High" ? "Medium" : "Medium-High",
    scout_summary:       p.scoutedPotential
      ? `Rated ${p.scoutedPotential} potential. Strong ${pos} profile.`
      : `Unassessed. Appears to be a ${pot.toLowerCase()} ceiling ${pos}.`,
    scout_confidence:    p.scoutedPotential ? rand(60, 88) : null,
    false_positive_risk: rand(5, 20),
    false_negative_risk: rand(3, 15),
  };

  // career stats
  const career_stats = {
    matches_played:   0, wins: 0, losses: 0, aces: 0, blocks: 0,
    kills: 0, digs: 0, errors: 0, tournament_wins: 0, championships: 0,
    mvp_awards: 0, all_star_selections: 0,
  };

  // hall of fame
  const hall_of_fame = {
    eligible:       false,
    score:          0,
    legacy_rating:  0,
    retired_number: false,
    legend_status:  "None",
  };

  // contract data
  const salary = Number(p.salary);
  const contractStatus = p.teamId ? "Signed" : playerType === "Draft" ? "Draft Eligible" : "Free Agent";
  const contractYrs    = p.contractEndDate ? 1 : playerType === "Draft" ? 0 : 0;

  return {
    schema_version: "players_v4_ultimate_dynasty",
    player_id:      p.id,
    player_type:    playerType,
    position:       pos,
    overall_rating: ovr,
    status: {
      active:         !p.isDraftPlayer && !!p.teamId,
      retired:        false,
      draft_eligible: p.isDraftPlayer,
      youth_player:   p.playerType === "youth",
      free_agent:     !p.teamId && !p.isDraftPlayer,
      injured:        p.isInjured,
      suspended:      false,
    },
    contract: {
      status:              contractStatus,
      years_remaining:     contractYrs,
      salary:              salary,
      release_clause:      Math.round(salary * 12),
      loyalty:             personality.loyalty,
      transfer_interest:   rand(20, 70),
      wage_demand_growth:  parseFloat((rand(103, 112)) / 100 + ""),
      renewal_likelihood:  rand(40, 85),
    },
    draft: {
      draft_year:           playerType === "Draft" ? new Date().getFullYear() : null,
      draft_rank:           null,
      projected_pick_range: playerType === "Draft" ? `${rand(1, 15)}-${rand(16, 30)}` : null,
      combine_score:        playerType === "Draft" ? rand(55, 90) : null,
      interview_score:      playerType === "Draft" ? rand(50, 88) : null,
      boom_bust_rating:     playerType === "Draft" ? rand(40, 90) : null,
    },
    core_attributes:     core,
    advanced_attributes: adv,
    match_engine:        me,
    development:         dev,
    youth_development:   yd,
    hidden_dna:          dna,
    regen,
    health,
    personality,
    form,
    specialities,
    weaknesses,
    visual_identity,
    visual_kit,
    scouting,
    career_stats,
    hall_of_fame,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("⏳  Fetching all non-retired players…");

  const active = (await db.select({
    id:              playersTable.id,
    name:            playersTable.name,
    nationality:     playersTable.nationality,
    continent:       playersTable.continent,
    age:             playersTable.age,
    position:        playersTable.position,
    playerType:      playersTable.playerType,
    isDraftPlayer:   playersTable.isDraftPlayer,
    speed:           playersTable.speed,
    power:           playersTable.power,
    defense:         playersTable.defense,
    serve:           playersTable.serve,
    block:           playersTable.block,
    stamina:         playersTable.stamina,
    morale:          playersTable.morale,
    fatigue:         playersTable.fatigue,
    fitness:         playersTable.fitness,
    injuryStatus:    playersTable.injuryStatus,
    isInjured:       playersTable.isInjured,
    scoutedPotential:playersTable.scoutedPotential,
    potential:       playersTable.potential,
    imageUrl:        playersTable.imageUrl,
    height:          playersTable.height,
    teamId:          playersTable.teamId,
    contractEndDate: playersTable.contractEndDate,
    salary:          playersTable.salary,
  })
  .from(playersTable)
  .where(eq(playersTable.isRetired, false)));

  console.log(`✅  Found ${active.length} players to process.`);

  let success = 0;
  let failed  = 0;
  const failures: { id: number; name: string; error: string }[] = [];

  const BATCH = 50;
  for (let i = 0; i < active.length; i += BATCH) {
    const batch = active.slice(i, i + BATCH);
    const label = `Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(active.length / BATCH)} (players ${i + 1}–${Math.min(i + BATCH, active.length)})`;
    process.stdout.write(`  ⚙️  ${label}…`);

    await Promise.all(
      batch.map(async (p) => {
        try {
          const v4 = buildV4({
            ...p,
            isDraftPlayer:   p.isDraftPlayer ?? false,
            morale:          p.morale ?? 80,
            fatigue:         p.fatigue ?? 0,
            fitness:         p.fitness ?? 100,
            injuryStatus:    p.injuryStatus ?? "Healthy",
            isInjured:       p.isInjured ?? false,
            potential:       p.potential ?? "Average",
            height:          String(p.height ?? "175"),
            salary:          String(p.salary ?? "5000"),
          });

          await db.update(playersTable)
            .set({ playerV4: v4 } as any)
            .where(eq(playersTable.id, p.id));

          success++;
        } catch (err: any) {
          failed++;
          failures.push({ id: p.id, name: p.name, error: String(err?.message ?? err) });
        }
      })
    );
    console.log(" done");
  }

  // ── validation pass ─────────────────────────────────────────────────────────
  console.log("\n🔍  Validating seeded records…");
  const sample = await db.select({ id: playersTable.id, playerV4: playersTable.playerV4 as any })
    .from(playersTable)
    .where(eq(playersTable.isRetired, false));

  let nullCount  = 0;
  let validCount = 0;
  for (const row of sample) {
    const v4 = (row as any).playerV4;
    if (!v4 || !v4.schema_version) { nullCount++; continue; }
    validCount++;
  }

  // ── report ──────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("  V4 SEED REPORT");
  console.log("═══════════════════════════════════════════");
  console.log(`  ✅  Seeded successfully : ${success}`);
  console.log(`  ❌  Seed failures       : ${failed}`);
  console.log(`  ✅  Validated (v4 valid): ${validCount}`);
  console.log(`  ⚠️   Validated (v4 null) : ${nullCount}`);
  console.log("═══════════════════════════════════════════");

  if (failures.length > 0) {
    console.log("\n  FAILURES:");
    for (const f of failures) {
      console.log(`    [${f.id}] ${f.name} → ${f.error}`);
    }
  }

  if (nullCount === 0 && failed === 0) {
    console.log("\n  🎉  All players seeded and validated successfully.");
  } else {
    console.log("\n  ⚠️  Some records require attention (see above).");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
