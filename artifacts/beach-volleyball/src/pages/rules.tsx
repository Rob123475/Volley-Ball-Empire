import { CONTINENT_COUNT } from "@shared/continents";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Award,
  Globe,
  ArrowUpDown,
  Timer,
  Users,
  Ruler,
  Hand,
  Camera,
  Keyboard,
} from "lucide-react";

// — Sport Rules —
const SPORT_RULES = [
  {
    icon: Trophy,
    title: "Match Format",
    text: "Best of three sets: first two sets to 21 points, deciding third set to 15. Every set must be won by two clear points — if the score reaches 20–20 (or 14–14 in the third), play continues until one team leads by two.",
  },
  {
    icon: Users,
    title: "Teams & Touches",
    text: "Played 2-on-2. Each team gets a maximum of three touches to return the ball, and a block counts as the first touch.",
  },
  {
    icon: Award,
    title: "Rally Scoring",
    text: "A point is scored on every rally regardless of who served. Whichever team wins the point serves next.",
  },
  {
    icon: ArrowUpDown,
    title: "Side Switches",
    text: "Teams switch sides every 7 combined points in the 21-point sets, and every 5 combined points in a 15-point third set, plus between sets — since wind and sun matter outdoors.",
  },
  {
    icon: Timer,
    title: "Timeouts",
    text: "Each team gets one 30-second timeout per set, called only when the ball is out of play.",
  },
  {
    icon: Ruler,
    title: "The Court",
    text: "A sand court measuring 16m long by 8m wide (8m x 8m per side) — smaller than an indoor volleyball court.",
  },
  {
    icon: Hand,
    title: "Ball Contact",
    text: "Players may contact the ball with any part of their body, including their feet — but the serve must be hit with the hand or arm.",
  },
];

// — Competition Structure —
const COMP_TIERS = [
  {
    title: "Regional League",
    badge: "6 teams / continent",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
    points: [
      "Positions 1–3 qualify for the World Tour",
      "Positions 4–5 remain in regional competition",
      "Position 6 is relegated to the continental pool",
    ],
  },
  {
    title: "Continental Pool",
    badge: "4 teams / continent",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/25",
    points: [
      "After Round 10 completes each season, the highest-ranked pool team is promoted to the regional league",
      "Promotion is never processed early — projections only confirm once the season ends",
    ],
  },
  {
    title: "World Tour",
    badge: "18 teams total",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    points: [
      `3 qualifying teams from each of the ${CONTINENT_COUNT} continental regions`,
      "Europe, Asia, North America, South America, Africa & Middle East, Australia & Pacific Islands",
    ],
  },
  {
    title: "Olympics",
    badge: "12 teams",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/25",
    points: [
      "Top 12 World Tour teams qualify",
      "Group stage (4 groups, days 1–4) → Quarterfinals (day 5) → Semifinals (day 6) → Gold & Bronze medal matches (day 7)",
    ],
  },
];

// — Camera Controls —
const CAMERA_KEYS = [
  { key: "1", label: "Camera Angle 1" },
  { key: "2", label: "Camera Angle 2" },
  { key: "3", label: "Camera Angle 3" },
];

export default function Rules() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-400" />
          Rules &amp; Competition Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          How beach volleyball works, how the competition is structured, and how to control the match camera.
        </p>
      </div>

      {/* Sport Rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hand className="h-4 w-4 text-muted-foreground" />
            How Beach Volleyball Works
          </CardTitle>
          <CardDescription>The official rules of the sport</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            {SPORT_RULES.map((rule) => (
              <div
                key={rule.title}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3.5"
              >
                <div className="h-8 w-8 shrink-0 rounded-lg bg-white/8 flex items-center justify-center">
                  <rule.icon className="h-4 w-4 text-white/70" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white/90">{rule.title}</div>
                  <div className="text-xs text-white/55 mt-1 leading-relaxed">{rule.text}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Competition Structure */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            How the Competition Works
          </CardTitle>
          <CardDescription>The path from regional league to Olympic gold</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {COMP_TIERS.map((tier, i) => (
            <div key={tier.title} className={`rounded-xl border p-4 ${tier.bg} ${tier.border}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${tier.color}`}>
                    {i + 1}. {tier.title}
                  </span>
                </div>
                <Badge variant="outline" className={`text-[10px] font-bold ${tier.color} border-current/30`}>
                  {tier.badge}
                </Badge>
              </div>
              <ul className="space-y-1">
                {tier.points.map((p) => (
                  <li key={p} className="text-xs text-white/60 leading-relaxed pl-3 relative before:content-['—'] before:absolute before:left-0 before:text-white/25">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Camera Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            Match Camera Controls
          </CardTitle>
          <CardDescription>Switch between camera angles during a live match</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            {CAMERA_KEYS.map((c) => (
              <div
                key={c.key}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5"
              >
                <div className="h-8 w-8 rounded-lg border border-white/20 bg-white/5 flex items-center justify-center font-black text-sm text-white/80">
                  {c.key}
                </div>
                <span className="text-xs font-semibold text-white/70">{c.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-white/40">
            <Keyboard className="h-3 w-3" />
            Press 1, 2, or 3 during a live match to cycle between camera angles
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
