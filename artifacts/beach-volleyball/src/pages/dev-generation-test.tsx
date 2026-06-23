import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────

type GenerationType = "senior_players" | "youth_players" | "staff" | "medical_staff";

type TestItem = {
  name: string;
  age: number;
  nationality: string;
  roleOrPosition: string;
  imageUrl: string;
  sourceSystem: string;
};

type ItemResult = TestItem & {
  passed: boolean;
  invalidAge: boolean;
  missingName: boolean;
  missingImage: boolean;
  invalidRole: boolean;
};

type Summary = {
  total: number;
  passed: number;
  failed: number;
  invalidAges: number;
  missingNames: number;
  missingImages: number;
  invalidRoles: number;
  generationType: GenerationType;
};

// ── Validation constants ───────────────────────────────────────────────────

const VALID_POSITIONS = new Set(["setter", "spiker", "defender", "blocker", "server", "all_rounder"]);
const VALID_STAFF_ROLES = new Set([
  "head_coach", "assistant_coach", "fitness_trainer",
  "strength_conditioner", "massage_therapist", "promotions_manager",
]);
const VALID_MEDICAL_ROLES = new Set([
  "team_doctor", "medical_specialist", "physiotherapist",
  "nutritionist", "sports_chemist",
]);

const AGE_RANGES: Record<GenerationType, [number, number]> = {
  senior_players: [18, 40],
  youth_players:  [14, 18],
  staff:          [18, 70],
  medical_staff:  [18, 70],
};

const BUTTON_LABELS: Record<GenerationType, string> = {
  senior_players: "Generate 100 Senior Players",
  youth_players:  "Generate 100 Youth Players",
  staff:          "Generate 100 Staff",
  medical_staff:  "Generate 100 Medical Staff",
};

const SOURCE_LABELS: Record<GenerationType, string> = {
  senior_players: "Draft (Senior)",
  youth_players:  "Youth Scouting",
  staff:          "Staff Market",
  medical_staff:  "Medical Market",
};

const ROLE_DISPLAY: Record<string, string> = {
  setter:               "Setter",
  spiker:               "Spiker",
  defender:             "Defender",
  blocker:              "Blocker",
  server:               "Server",
  all_rounder:          "All-Rounder",
  head_coach:           "Head Coach",
  assistant_coach:      "Assistant Coach",
  fitness_trainer:      "Fitness Trainer",
  strength_conditioner: "Strength Conditioner",
  massage_therapist:    "Massage Therapist",
  promotions_manager:   "Promotions Manager",
  team_doctor:          "Team Doctor",
  medical_specialist:   "Medical Specialist",
  physiotherapist:      "Physiotherapist",
  nutritionist:         "Nutritionist",
  sports_chemist:       "Sports Chemist",
};

// ── Validation helpers ─────────────────────────────────────────────────────

function isValidRole(type: GenerationType, role: string): boolean {
  if (type === "senior_players" || type === "youth_players") return VALID_POSITIONS.has(role);
  if (type === "staff") return VALID_STAFF_ROLES.has(role);
  if (type === "medical_staff") return VALID_MEDICAL_ROLES.has(role);
  return false;
}

function validateItem(item: TestItem, type: GenerationType): ItemResult {
  const [minAge, maxAge] = AGE_RANGES[type];
  const invalidAge   = item.age < minAge || item.age > maxAge;
  const missingName  = !item.name || item.name.trim() === "";
  const missingImage = !item.imageUrl || item.imageUrl.trim() === "";
  const invalidRole  = !isValidRole(type, item.roleOrPosition);
  return {
    ...item,
    passed:       !invalidAge && !missingName && !missingImage && !invalidRole,
    invalidAge,
    missingName,
    missingImage,
    invalidRole,
  };
}

function buildSummary(results: ItemResult[], type: GenerationType): Summary {
  const failed       = results.filter(r => !r.passed).length;
  const invalidAges  = results.filter(r => r.invalidAge).length;
  const missingNames = results.filter(r => r.missingName).length;
  const missingImages = results.filter(r => r.missingImage).length;
  const invalidRoles = results.filter(r => r.invalidRole).length;
  return {
    total:         results.length,
    passed:        results.length - failed,
    failed,
    invalidAges,
    missingNames,
    missingImages,
    invalidRoles,
    generationType: type,
  };
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DevGenerationTest() {
  const [results, setResults]       = useState<ItemResult[]>([]);
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [loading, setLoading]       = useState<GenerationType | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [showFailedOnly, setShowFailedOnly] = useState(false);

  async function generate(type: GenerationType) {
    setLoading(type);
    setError(null);
    try {
      const resp = await fetch("/api/dev/generate-test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, count: 100 }),
        credentials: "include",
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error((body as any).error ?? `HTTP ${resp.status}`);
      }
      const data: TestItem[] = await resp.json();
      const validated = data.map(item => validateItem(item, type));
      setResults(validated);
      setSummary(buildSummary(validated, type));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  function clearData() {
    setResults([]);
    setSummary(null);
    setError(null);
    setShowFailedOnly(false);
  }

  const displayedRows = showFailedOnly ? results.filter(r => !r.passed) : results;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Generation Test</h1>
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-mono uppercase tracking-wider">
            DEV ONLY
          </Badge>
        </div>
        <p className="text-gray-400 text-sm">
          Verifies player, youth, staff and medical staff generation rules.
          No data is saved — all output is generated in memory only.
        </p>
      </div>

      {/* ── Generation buttons ── */}
      <div className="flex flex-wrap gap-3 mb-8">
        {(["senior_players", "youth_players", "staff", "medical_staff"] as GenerationType[]).map(type => (
          <Button
            key={type}
            onClick={() => generate(type)}
            disabled={loading !== null}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
          >
            {loading === type ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Generating…
              </span>
            ) : BUTTON_LABELS[type]}
          </Button>
        ))}
        <Button
          onClick={clearData}
          disabled={loading !== null || (results.length === 0 && !error)}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white text-sm"
        >
          Clear Test Data
        </Button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── Validation summary ── */}
      {summary && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Validation Summary — {SOURCE_LABELS[summary.generationType]}
            {" "}
            <span className="text-gray-500 normal-case font-normal">
              (age {AGE_RANGES[summary.generationType][0]}–{AGE_RANGES[summary.generationType][1]})
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <SummaryCard label="Total" value={summary.total} colour="gray" />
            <SummaryCard label="Passed" value={summary.passed} colour="green" />
            <SummaryCard label="Failed" value={summary.failed} colour={summary.failed > 0 ? "red" : "green"} />
            <SummaryCard label="Invalid Ages" value={summary.invalidAges} colour={summary.invalidAges > 0 ? "red" : "gray"} />
            <SummaryCard label="Missing Names" value={summary.missingNames} colour={summary.missingNames > 0 ? "red" : "gray"} />
            <SummaryCard label="Missing Images" value={summary.missingImages} colour={summary.missingImages > 0 ? "red" : "gray"} />
            <SummaryCard label="Invalid Roles" value={summary.invalidRoles} colour={summary.invalidRoles > 0 ? "red" : "gray"} />
          </div>
        </div>
      )}

      {/* ── Results table ── */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Results ({displayedRows.length} {showFailedOnly ? "failed" : "total"})
            </h2>
            {summary && summary.failed > 0 && (
              <button
                onClick={() => setShowFailedOnly(v => !v)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                {showFailedOnly ? "Show all rows" : `Show failed only (${summary.failed})`}
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/60">
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">#</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Image</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Name</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Age</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Nationality</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Role / Position</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Image Assigned</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Source System</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, idx) => {
                  const globalIdx = showFailedOnly
                    ? results.indexOf(row)
                    : idx;
                  return (
                    <ResultRow
                      key={globalIdx}
                      index={globalIdx + 1}
                      row={row}
                      ageRange={summary ? AGE_RANGES[summary.generationType] : [0, 999]}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {results.length === 0 && !error && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600">
          <div className="text-5xl mb-4">🧪</div>
          <p className="text-sm">Click a button above to run a generation test.</p>
          <p className="text-xs mt-1 text-gray-700">Nothing is saved to the database.</p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: "gray" | "green" | "red";
}) {
  const bg = colour === "green"
    ? "bg-green-900/20 border-green-800/40 text-green-400"
    : colour === "red"
    ? "bg-red-900/20 border-red-800/40 text-red-400"
    : "bg-gray-900/40 border-gray-800 text-gray-300";

  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs mt-0.5 opacity-70">{label}</div>
    </div>
  );
}

function ResultRow({
  index,
  row,
  ageRange,
}: {
  index: number;
  row: ItemResult;
  ageRange: [number, number];
}) {
  const rowBg = row.passed
    ? "hover:bg-gray-900/40"
    : "bg-red-950/20 hover:bg-red-950/30";

  return (
    <tr className={`border-b border-gray-800/50 ${rowBg} transition-colors`}>
      <td className="px-3 py-2 text-gray-500 tabular-nums">{index}</td>

      {/* Avatar */}
      <td className="px-3 py-2">
        {row.imageUrl ? (
          <img
            src={row.imageUrl}
            alt={row.name}
            className="w-8 h-8 rounded-full bg-gray-800"
            onError={e => { (e.currentTarget as HTMLImageElement).src = ""; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center text-red-400 text-xs">✕</div>
        )}
      </td>

      {/* Name */}
      <td className="px-3 py-2 font-medium">
        {row.missingName ? (
          <span className="text-red-400 italic">— blank —</span>
        ) : (
          <span className={row.passed ? "text-gray-100" : "text-gray-200"}>{row.name}</span>
        )}
      </td>

      {/* Age */}
      <td className="px-3 py-2 tabular-nums">
        <span className={row.invalidAge ? "text-red-400 font-semibold" : "text-gray-200"}>
          {row.age}
          {row.invalidAge && (
            <span className="ml-1 text-xs text-red-500">
              (outside {ageRange[0]}–{ageRange[1]})
            </span>
          )}
        </span>
      </td>

      {/* Nationality */}
      <td className="px-3 py-2 text-gray-300">{row.nationality}</td>

      {/* Role/Position */}
      <td className="px-3 py-2">
        <span className={row.invalidRole ? "text-red-400 font-semibold" : "text-gray-200"}>
          {ROLE_DISPLAY[row.roleOrPosition] ?? row.roleOrPosition}
          {row.invalidRole && <span className="ml-1 text-xs text-red-500">(invalid)</span>}
        </span>
      </td>

      {/* Image assigned */}
      <td className="px-3 py-2">
        {row.missingImage ? (
          <span className="text-red-400 text-xs font-medium">✗ Missing</span>
        ) : (
          <span className="text-green-400 text-xs font-medium">✓ Yes</span>
        )}
      </td>

      {/* Source system */}
      <td className="px-3 py-2">
        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-mono">
          {row.sourceSystem}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        {row.passed ? (
          <span className="text-xs font-semibold text-green-400">✓ Pass</span>
        ) : (
          <span className="text-xs font-semibold text-red-400">✗ Fail</span>
        )}
      </td>
    </tr>
  );
}
