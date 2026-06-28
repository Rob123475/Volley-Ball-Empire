import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useListCareerSaves,
  getListCareerSavesQueryKey,
  useApplyJob,
} from "@workspace/api-client-react";
import {
  Briefcase,
  Globe,
  MapPin,
  DollarSign,
  Wallet,
  Trophy,
  TrendingUp,
  Users,
  Building2,
  Info,
  Search,
  ShieldCheck,
  Flame,
  CheckCircle2,
  XCircle,
  Loader2,
  Star,
  Calendar,
  HandCoins,
  ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobOffer {
  id:                  number;
  clubName:            string;
  continent:           string;
  country:             string;
  city:                string;
  competition:         string;
  tier:                "Elite" | "Premier" | "Regional" | "Emerging";
  salary:              number;
  transferBudget:      number;
  clubReputation:      number;
  expectedFinish:      string;
  requiredReputation:  number;
  squadStrength:       number;
  description:         string;
  founded:             number;
  logoColor:           string;
  contractLength:      string;
}

// ── Job data ──────────────────────────────────────────────────────────────────

const JOB_OFFERS: JobOffer[] = [
  {
    id: 1, clubName: "Rio Praia SC", continent: "South America", country: "Brazil",
    city: "Rio de Janeiro", competition: "FIVB World Tour", tier: "Elite",
    salary: 28_000, transferBudget: 650_000, clubReputation: 88,
    expectedFinish: "Top 4", requiredReputation: 70, squadStrength: 85,
    description: "One of South America's most storied beach volleyball clubs, playing on the iconic sands of Copacabana. The board demands excellence and backs it with serious investment.",
    founded: 1998, logoColor: "#10b981", contractLength: "3 seasons",
  },
  {
    id: 2, clubName: "Barcelona Sand FC", continent: "Europe", country: "Spain",
    city: "Barcelona", competition: "European Beach Tour", tier: "Elite",
    salary: 24_000, transferBudget: 500_000, clubReputation: 84,
    expectedFinish: "Top 4", requiredReputation: 65, squadStrength: 80,
    description: "A Mediterranean powerhouse with a flair for attacking play. The club has invested heavily in its youth academy and looks for a manager who can develop talent while competing at the top.",
    founded: 2002, logoColor: "#3b82f6", contractLength: "2 seasons",
  },
  {
    id: 3, clubName: "Miami Blazers", continent: "North America", country: "USA",
    city: "Miami", competition: "NORCECA Beach Tour", tier: "Premier",
    salary: 22_000, transferBudget: 420_000, clubReputation: 78,
    expectedFinish: "Top 8", requiredReputation: 55, squadStrength: 75,
    description: "Florida's most ambitious club rides a wave of commercial momentum. Strong sponsor relationships and a passionate fanbase make this a high-profile role.",
    founded: 2007, logoColor: "#f59e0b", contractLength: "2 seasons",
  },
  {
    id: 4, clubName: "Shanghai Stormers", continent: "Asia", country: "China",
    city: "Shanghai", competition: "Asian Beach Tour", tier: "Premier",
    salary: 20_000, transferBudget: 380_000, clubReputation: 72,
    expectedFinish: "Top 4", requiredReputation: 50, squadStrength: 70,
    description: "Rapid-growth club backed by major corporate investment. The Asian Tour is increasingly competitive and the board want a manager who can modernise training methods.",
    founded: 2011, logoColor: "#ef4444", contractLength: "3 seasons",
  },
  {
    id: 5, clubName: "Sydney Surf FC", continent: "Oceania", country: "Australia",
    city: "Sydney", competition: "Oceania Cup", tier: "Premier",
    salary: 18_000, transferBudget: 300_000, clubReputation: 68,
    expectedFinish: "Top 8", requiredReputation: 45, squadStrength: 66,
    description: "Australia's premier beach volleyball club with world-class facilities at Bondi. A comfortable environment for a manager looking to rebuild a squad on the rise.",
    founded: 2004, logoColor: "#0ea5e9", contractLength: "2 seasons",
  },
  {
    id: 6, clubName: "Athens Aegean BC", continent: "Europe", country: "Greece",
    city: "Athens", competition: "European Beach Tour", tier: "Regional",
    salary: 14_000, transferBudget: 200_000, clubReputation: 58,
    expectedFinish: "Reach Knockouts", requiredReputation: 35, squadStrength: 58,
    description: "Steeped in Mediterranean tradition, Athens Aegean offers a real challenge: limited resources, passionate fans, and beautiful surroundings. A classic project club.",
    founded: 1995, logoColor: "#8b5cf6", contractLength: "1 season",
  },
  {
    id: 7, clubName: "Cape Town Swells", continent: "Africa", country: "South Africa",
    city: "Cape Town", competition: "African Beach Championship", tier: "Regional",
    salary: 12_000, transferBudget: 160_000, clubReputation: 54,
    expectedFinish: "Top 8", requiredReputation: 30, squadStrength: 54,
    description: "Playing on some of the world's most spectacular beaches, Cape Town Swells are looking for a progressive manager to develop the club's young talent pipeline.",
    founded: 2009, logoColor: "#f97316", contractLength: "2 seasons",
  },
  {
    id: 8, clubName: "Hokkaido Snow Birds", continent: "Asia", country: "Japan",
    city: "Sapporo", competition: "Asian Beach Tour", tier: "Regional",
    salary: 13_000, transferBudget: 180_000, clubReputation: 56,
    expectedFinish: "Mid-table", requiredReputation: 30, squadStrength: 55,
    description: "A disciplined, tactically-focused club from Japan's north. Training facilities are excellent and the organisation is meticulously run — ideal for a methodical manager.",
    founded: 2014, logoColor: "#06b6d4", contractLength: "2 seasons",
  },
  {
    id: 9, clubName: "Lagos Beach Kings", continent: "Africa", country: "Nigeria",
    city: "Lagos", competition: "African Beach Championship", tier: "Emerging",
    salary: 9_000, transferBudget: 100_000, clubReputation: 44,
    expectedFinish: "Qualify for Finals", requiredReputation: 15, squadStrength: 46,
    description: "A passionate, high-energy club in one of Africa's fastest-growing markets. Limited funds but bags of raw talent. Perfect for a manager who thrives on development.",
    founded: 2017, logoColor: "#84cc16", contractLength: "1 season",
  },
  {
    id: 10, clubName: "Reykjavik Frostbiters", continent: "Europe", country: "Iceland",
    city: "Reykjavik", competition: "European Beach Tour", tier: "Emerging",
    salary: 8_000, transferBudget: 80_000, clubReputation: 38,
    expectedFinish: "Avoid Bottom 4", requiredReputation: 0, squadStrength: 40,
    description: "Playing mostly indoors due to climate, Reykjavik Frostbiters are the ultimate underdog project. A fresh-start role with zero pressure and total freedom to build from scratch.",
    founded: 2019, logoColor: "#e2e8f0", contractLength: "1 season",
  },
];

// ── Filter tab type ────────────────────────────────────────────────────────────

type FilterTab = "All" | "Realistic" | "Ambitious" | "Elite" | "International" | "Too Low Rep";

const FILTER_TABS: FilterTab[] = ["All", "Realistic", "Ambitious", "Elite", "International", "Too Low Rep"];

function filterJobs(jobs: JobOffer[], tab: FilterTab, rep: number): JobOffer[] {
  switch (tab) {
    case "All":
      return jobs;
    case "Realistic":
      return jobs.filter(j => rep >= j.requiredReputation);
    case "Ambitious":
      return jobs.filter(j => rep < j.requiredReputation && rep >= j.requiredReputation - 25);
    case "Elite":
      return jobs.filter(j => j.clubReputation >= 78 || j.tier === "Elite");
    case "International":
      return jobs.filter(j => j.continent !== "Europe" && j.continent !== "North America");
    case "Too Low Rep":
      return jobs.filter(j => rep < j.requiredReputation);
    default:
      return jobs;
  }
}

// ── Status badge logic ─────────────────────────────────────────────────────────

type StatusBadge = {
  label:     string;
  className: string;
  dotClass:  string;
};

function getStatusBadge(job: JobOffer, rep: number): StatusBadge {
  const qualified = rep >= job.requiredReputation;
  if (!qualified) {
    return {
      label:     "Rep Too Low",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      dotClass:  "bg-rose-400",
    };
  }
  if (job.tier === "Elite") {
    return {
      label:     "Elite Club",
      className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
      dotClass:  "bg-yellow-400",
    };
  }
  if (Math.abs(job.clubReputation - rep) <= 20) {
    return {
      label:     "Good Fit",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      dotClass:  "bg-emerald-400",
    };
  }
  return {
    label:     "Available",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    dotClass:  "bg-blue-400",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSalary(n: number) { return `$${n.toLocaleString()} / season`; }
function fmtBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function tierConfig(tier: JobOffer["tier"]) {
  switch (tier) {
    case "Elite":    return { bg: "bg-yellow-500/15 border-yellow-500/30", text: "text-yellow-400",  dot: "bg-yellow-400"  };
    case "Premier":  return { bg: "bg-blue-500/15 border-blue-500/30",     text: "text-blue-400",    dot: "bg-blue-400"    };
    case "Regional": return { bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-400",  dot: "bg-purple-400"  };
    case "Emerging": return { bg: "bg-slate-500/15 border-slate-500/30",   text: "text-slate-400",   dot: "bg-slate-400"   };
  }
}

function continentFlag(continent: string) {
  switch (continent) {
    case "South America": case "North America": return "🌎";
    case "Europe": case "Africa":               return "🌍";
    case "Asia":   case "Oceania":              return "🌏";
    default:                                    return "🌐";
  }
}

function reputationLabel(rep: number) {
  if (rep >= 80) return { label: "World Class",  colour: "text-yellow-400"  };
  if (rep >= 65) return { label: "Elite",         colour: "text-blue-400"    };
  if (rep >= 50) return { label: "Professional",  colour: "text-emerald-400" };
  if (rep >= 35) return { label: "Semi-Pro",      colour: "text-amber-400"   };
  if (rep >= 15) return { label: "Amateur",       colour: "text-orange-400"  };
  return               { label: "None required",  colour: "text-white/40"    };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ icon: Icon, label, value, valueColour }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; valueColour?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="h-8 w-8 shrink-0 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-white/35" />
      </div>
      <span className="flex-1 text-xs text-white/50">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", valueColour ?? "text-white")}>{value}</span>
    </div>
  );
}

function ClubLogo({ job, size = "md" }: { job: JobOffer; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg"
    ? "h-14 w-14 text-2xl rounded-2xl"
    : size === "md" ? "h-11 w-11 text-lg rounded-xl"
    : "h-9 w-9 text-base rounded-lg";
  return (
    <div
      className={cn("shrink-0 flex items-center justify-center font-black border", dim)}
      style={{ backgroundColor: `${job.logoColor}22`, borderColor: `${job.logoColor}44`, color: job.logoColor }}
    >
      {job.clubName[0]}
    </div>
  );
}

function ReputationBar({ current, required }: { current: number; required: number }) {
  const qualified = current >= required;
  return (
    <div className="space-y-1.5 py-3 border-b border-white/5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50 flex items-center gap-1.5">
          <Star className="h-3 w-3" />
          Reputation Check
        </span>
        <span className={cn("font-bold", qualified ? "text-emerald-400" : "text-rose-400")}>
          {qualified ? "✓ Qualified" : "✗ Not qualified"}
        </span>
      </div>
      <div className="relative h-2 w-full bg-white/8 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${Math.min(current, 100)}%`, backgroundColor: qualified ? "#10b981" : "#f43f5e" }}
        />
        {required > 0 && (
          <div className="absolute inset-y-0 w-0.5 bg-white/60" style={{ left: `${required}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-white/35 tabular-nums">
        <span>Your rep: <span className={cn("font-bold", qualified ? "text-emerald-400" : "text-white/60")}>{current}</span></span>
        <span>Required: <span className="font-bold text-white/60">{required === 0 ? "None" : required}</span></span>
      </div>
    </div>
  );
}

function JobCard({ job, managerReputation, onApply, onView }: {
  job:               JobOffer;
  managerReputation: number;
  onApply:           (job: JobOffer) => void;
  onView:            (job: JobOffer) => void;
}) {
  const tier      = tierConfig(job.tier);
  const repReq    = reputationLabel(job.requiredReputation);
  const qualified = managerReputation >= job.requiredReputation;
  const status    = getStatusBadge(job, managerReputation);

  return (
    <div className={cn(
      "rounded-2xl border bg-white/3 overflow-hidden transition-all flex flex-col",
      qualified ? "border-white/10 hover:border-white/18" : "border-white/7 opacity-75",
    )}>
      {/* Header */}
      <div className="flex items-start gap-3.5 p-4 pb-3">
        <ClubLogo job={job} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-white leading-tight mb-1">{job.clubName}</h3>
          <p className="text-[11px] text-white/45 flex items-center gap-1 flex-wrap">
            <span>{continentFlag(job.continent)}</span>
            <span>{job.city}, {job.country}</span>
            <span className="text-white/20">·</span>
            <span>{job.competition}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest", tier.bg, tier.text)}>
              <span className={cn("h-1 w-1 rounded-full", tier.dot)} />
              {job.tier}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest", status.className)}>
              <span className={cn("h-1 w-1 rounded-full", status.dotClass)} />
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-b border-white/8">
        <div className="bg-[#0a0f1a] px-4 py-2.5">
          <p className="text-[9px] uppercase tracking-widest text-white/30 font-semibold mb-0.5">Salary</p>
          <p className="text-xs font-black text-emerald-400">{fmtSalary(job.salary)}</p>
        </div>
        <div className="bg-[#0a0f1a] px-4 py-2.5">
          <p className="text-[9px] uppercase tracking-widest text-white/30 font-semibold mb-0.5">Transfer Budget</p>
          <p className="text-xs font-black text-blue-400">{fmtBudget(job.transferBudget)}</p>
        </div>
        <div className="bg-[#0a0f1a] px-4 py-2.5">
          <p className="text-[9px] uppercase tracking-widest text-white/30 font-semibold mb-0.5">Expected Finish</p>
          <p className="text-xs font-bold text-white/80">{job.expectedFinish}</p>
        </div>
        <div className="bg-[#0a0f1a] px-4 py-2.5">
          <p className="text-[9px] uppercase tracking-widest text-white/30 font-semibold mb-0.5">Contract</p>
          <p className="text-xs font-bold text-amber-300/80">{job.contractLength}</p>
        </div>
      </div>

      {/* Rep bar + club rep */}
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">Club Reputation</span>
          <span className="text-[10px] font-black text-white/55 tabular-nums">{job.clubReputation} / 100</span>
        </div>
        <div className="h-1.5 w-full bg-white/8 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${job.clubReputation}%`, backgroundColor: job.logoColor }} />
        </div>
        <div className="flex items-center justify-between text-[9px] text-white/30">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-2.5 w-2.5" />
            Min. rep: <span className={cn("font-bold ml-0.5", repReq.colour)}>{job.requiredReputation === 0 ? "None" : repReq.label}</span>
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            Est. {job.founded}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 mt-auto border-t border-white/5">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 border border-white/10 bg-white/3 hover:bg-white/8 text-white/70 text-[11px] h-8"
          onClick={() => onView(job)}
        >
          <Building2 className="h-3.5 w-3.5 mr-1.5" />
          View Club
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled
          className="flex-1 border border-white/8 bg-white/2 text-white/30 text-[11px] h-8 cursor-not-allowed"
          title="Salary negotiation coming in a future update"
        >
          <HandCoins className="h-3.5 w-3.5 mr-1" />
          Negotiate
          <span className="ml-1 text-[8px] font-black uppercase tracking-wide text-white/20">Soon</span>
        </Button>
        <Button
          size="sm"
          disabled={!qualified}
          className={cn(
            "flex-1 text-[11px] font-bold border h-8",
            !qualified && "opacity-40 cursor-not-allowed",
          )}
          style={qualified ? { backgroundColor: `${job.logoColor}22`, borderColor: `${job.logoColor}55`, color: job.logoColor } : undefined}
          onClick={() => qualified && onApply(job)}
        >
          <Briefcase className="h-3.5 w-3.5 mr-1.5" />
          Apply
        </Button>
      </div>
    </div>
  );
}

// ── Apply flow ─────────────────────────────────────────────────────────────────

type ApplyState = "confirm" | "submitting" | "accepted" | "rejected";

function ApplyModal({ job, managerReputation, onClose, onAccepted }: {
  job:               JobOffer;
  managerReputation: number;
  onClose:           () => void;
  onAccepted:        (clubName: string) => void;
}) {
  const [state, setState] = useState<ApplyState>("confirm");
  const applyMutation     = useApplyJob();
  const qualified         = managerReputation >= job.requiredReputation;

  function handleApply() {
    setState("submitting");
    applyMutation.mutate(
      {
        data: {
          clubName:           job.clubName,
          continent:          job.continent,
          country:            job.country,
          city:               job.city,
          competition:        job.competition,
          salary:             job.salary,
          transferBudget:     job.transferBudget,
          clubReputation:     job.clubReputation,
          requiredReputation: job.requiredReputation,
          logoColor:          job.logoColor,
        },
      },
      {
        onSuccess: (result) => {
          if (result.accepted) {
            setState("accepted");
          } else {
            setState("rejected");
          }
        },
        onError: () => {
          setState("confirm");
        },
      },
    );
  }

  return (
    <DialogContent className="max-w-sm border-white/10 bg-[#0a0f1a]">
      {state === "accepted" ? (
        <>
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div
                className="h-16 w-16 rounded-2xl border flex items-center justify-center text-2xl font-black"
                style={{ backgroundColor: `${job.logoColor}22`, borderColor: `${job.logoColor}44`, color: job.logoColor }}
              >
                {job.clubName[0]}
              </div>
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <div className="text-center">
                <DialogTitle className="text-lg font-black text-white">Offer Accepted!</DialogTitle>
                <DialogDescription className="text-sm text-white/50 mt-1">
                  Welcome to {job.clubName}. You are now head coach.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-300/80 leading-relaxed">
            Your career save has been updated. Head to the dashboard to start building your squad.
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
              onClick={() => onAccepted(job.clubName)}
            >
              Go to Dashboard
              <ChevronRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </>
      ) : state === "rejected" ? (
        <>
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <XCircle className="h-12 w-12 text-rose-400" />
              <div className="text-center">
                <DialogTitle className="text-base font-black text-white">Application Rejected</DialogTitle>
                <DialogDescription className="text-sm text-white/50 mt-1">
                  {job.clubName} requires a higher reputation.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="rounded-xl border border-white/8 bg-white/3 px-4">
            <ReputationBar current={managerReputation} required={job.requiredReputation} />
          </div>
          <p className="text-xs text-white/40 text-center leading-relaxed px-2">
            Win matches and advance through the season to raise your reputation before reapplying.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm" className="w-full bg-white/8 border border-white/12 text-white/70 hover:bg-white/12">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </>
      ) : (
        <>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <ClubLogo job={job} size="sm" />
              <div>
                <DialogTitle className="text-sm font-black text-white leading-tight">
                  Apply to {job.clubName}
                </DialogTitle>
                <DialogDescription className="text-xs text-white/40 mt-0.5">
                  {job.city}, {job.country} · {job.contractLength}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="rounded-xl border border-white/8 bg-white/3 px-4">
            <StatRow icon={DollarSign} label="Annual Salary"    value={fmtSalary(job.salary)}        valueColour="text-emerald-400" />
            <StatRow icon={Wallet}     label="Transfer Budget"  value={fmtBudget(job.transferBudget)} valueColour="text-blue-400"    />
            <StatRow icon={TrendingUp} label="Board Expects"    value={job.expectedFinish} />
            <StatRow icon={Calendar}   label="Contract Length"  value={job.contractLength}             valueColour="text-amber-300/80" />
            <ReputationBar current={managerReputation} required={job.requiredReputation} />
          </div>

          {!qualified && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/8 p-3">
              <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-300/80 leading-relaxed">
                Your reputation ({managerReputation}) is below this club's minimum ({job.requiredReputation}).
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="text-white/50">Cancel</Button>
            </DialogClose>
            <Button
              size="sm"
              disabled={state === "submitting" || !qualified}
              className="border font-bold"
              style={qualified ? { backgroundColor: `${job.logoColor}22`, borderColor: `${job.logoColor}55`, color: job.logoColor } : undefined}
              onClick={handleApply}
            >
              {state === "submitting"
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Applying…</>
                : <><Briefcase className="h-3.5 w-3.5 mr-1.5" />Submit Application</>
              }
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  );
}

// ── View Club modal ────────────────────────────────────────────────────────────

function ViewClubModal({ job, managerReputation, onApply, onClose }: {
  job:               JobOffer;
  managerReputation: number;
  onApply:           () => void;
  onClose:           () => void;
}) {
  const tier      = tierConfig(job.tier);
  const qualified = managerReputation >= job.requiredReputation;

  return (
    <DialogContent className="max-w-md border-white/10 bg-[#0a0f1a]">
      <DialogHeader>
        <div className="flex items-center gap-4 mb-2">
          <ClubLogo job={job} size="lg" />
          <div>
            <DialogTitle className="text-base font-black text-white leading-tight">{job.clubName}</DialogTitle>
            <DialogDescription className="text-xs text-white/40 mt-0.5">
              {continentFlag(job.continent)} {job.city}, {job.country} · Est. {job.founded}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div className="flex flex-wrap gap-2">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest", tier.bg, tier.text)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", tier.dot)} />
          {job.tier}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/50">
          <Trophy className="h-3 w-3" />
          {job.competition}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/50">
          <Calendar className="h-3 w-3" />
          {job.contractLength}
        </span>
      </div>
      <p className="text-sm text-white/60 leading-relaxed">{job.description}</p>
      <div className="rounded-xl border border-white/8 bg-white/3 px-4">
        <StatRow icon={DollarSign}  label="Annual Salary"   value={fmtSalary(job.salary)}          valueColour="text-emerald-400" />
        <StatRow icon={Wallet}      label="Transfer Budget" value={fmtBudget(job.transferBudget)}   valueColour="text-blue-400"    />
        <StatRow icon={TrendingUp}  label="Expected Finish" value={job.expectedFinish} />
        <StatRow icon={ShieldCheck} label="Min. Reputation" value={job.requiredReputation === 0 ? "None required" : `${job.requiredReputation} pts`} />
        <StatRow icon={Flame}       label="Club Reputation" value={`${job.clubReputation} / 100`}   valueColour="text-amber-400"   />
        <StatRow icon={Users}       label="Squad Strength"  value={`${job.squadStrength} / 100`} />
        <StatRow icon={MapPin}      label="Region"          value={`${continentFlag(job.continent)} ${job.continent}`} />
      </div>
      <DialogFooter className="gap-2">
        <DialogClose asChild>
          <Button variant="ghost" size="sm" className="text-white/50">Close</Button>
        </DialogClose>
        <Button
          size="sm"
          disabled={!qualified}
          className={cn("border font-bold", !qualified && "opacity-40 cursor-not-allowed")}
          style={qualified ? { backgroundColor: `${job.logoColor}22`, borderColor: `${job.logoColor}55`, color: job.logoColor } : undefined}
          onClick={() => { if (qualified) { onClose(); onApply(); } }}
        >
          <Briefcase className="h-3.5 w-3.5 mr-1.5" />
          {qualified ? "Apply for Role" : "Rep Too Low"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JobMarket() {
  const [, navigate]   = useLocation();
  const queryClient    = useQueryClient();
  const [search,       setSearch]      = useState("");
  const [activeTab,    setActiveTab]   = useState<FilterTab>("All");
  const [viewJob,      setViewJob]     = useState<JobOffer | null>(null);
  const [applyJob,     setApplyJob]    = useState<JobOffer | null>(null);

  const { data: savesData } = useListCareerSaves();
  const activeSave          = savesData?.saves.find(s => s.id === savesData.activeCareerSaveId);
  const managerReputation   = activeSave?.managerReputation ?? 50;

  function handleAccepted(_clubName: string) {
    queryClient.invalidateQueries({ queryKey: getListCareerSavesQueryKey() });
    setApplyJob(null);
    navigate("/");
  }

  const tabFiltered = filterJobs(JOB_OFFERS, activeTab, managerReputation);

  const filtered = tabFiltered.filter(j => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      j.clubName.toLowerCase().includes(q)    ||
      j.country.toLowerCase().includes(q)      ||
      j.city.toLowerCase().includes(q)         ||
      j.competition.toLowerCase().includes(q)
    );
  });

  const tabCounts: Record<FilterTab, number> = {
    All:           JOB_OFFERS.length,
    Realistic:     filterJobs(JOB_OFFERS, "Realistic",     managerReputation).length,
    Ambitious:     filterJobs(JOB_OFFERS, "Ambitious",     managerReputation).length,
    Elite:         filterJobs(JOB_OFFERS, "Elite",         managerReputation).length,
    International: filterJobs(JOB_OFFERS, "International", managerReputation).length,
    "Too Low Rep": filterJobs(JOB_OFFERS, "Too Low Rep",   managerReputation).length,
  };

  return (
    <>
      <div className="space-y-6">

        {/* Heading */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Job Market</h1>
          <p className="text-sm text-white/50 mt-1">
            Available head coach positions from clubs around the world.
          </p>
        </div>

        {/* Reputation summary */}
        <div className="rounded-2xl border border-white/10 bg-white/3 px-5 py-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Star className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-1.5">Your Manager Reputation</p>
            <div className="h-1.5 w-full bg-white/8 rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${managerReputation}%` }} />
            </div>
            <p className="text-xs text-white/45">
              <span className="font-bold text-amber-400">{managerReputation}</span>
              <span className="text-white/30"> / 100 — </span>
              <span>{reputationLabel(managerReputation).label}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-black text-white tabular-nums">{managerReputation}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">rep.</p>
          </div>
        </div>

        {/* Sample data notice */}
        <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/8 px-4 py-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/70 leading-relaxed">
            Curated listings — salary negotiation and real-time club matching will expand as the game evolves.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Search clubs, countries, competitions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/3 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map(tab => {
            const count = tabCounts[tab];
            const active = activeTab === tab;
            const isDanger = tab === "Too Low Rep";
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all",
                  active
                    ? isDanger
                      ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                      : "border-white/25 bg-white/10 text-white"
                    : isDanger
                      ? "border-rose-500/15 bg-rose-500/5 text-rose-400/60 hover:text-rose-400/90"
                      : "border-white/8 bg-white/3 text-white/40 hover:text-white/70",
                )}
              >
                {tab}
                <span className={cn(
                  "rounded-md px-1.5 py-0.5 text-[9px] font-black tabular-nums",
                  active
                    ? isDanger ? "bg-rose-500/20 text-rose-300" : "bg-white/15 text-white/80"
                    : "bg-white/5 text-white/30",
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between -mt-2">
          <p className="text-xs text-white/35 font-semibold">
            {filtered.length} position{filtered.length !== 1 ? "s" : ""} shown
          </p>
          <p className="text-[10px] text-white/20 italic">Updated each season</p>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/3 p-12 flex flex-col items-center gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Briefcase className="h-7 w-7 text-white/20" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/60">No positions match your filters</p>
              <p className="text-xs text-white/30 mt-1">Try clearing the search or switching tabs</p>
            </div>
            <button
              onClick={() => { setSearch(""); setActiveTab("All"); }}
              className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(job => (
              <JobCard
                key={job.id}
                job={job}
                managerReputation={managerReputation}
                onApply={setApplyJob}
                onView={setViewJob}
              />
            ))}
          </div>
        )}
      </div>

      {/* View Club modal */}
      <Dialog open={viewJob !== null} onOpenChange={o => { if (!o) setViewJob(null); }}>
        {viewJob && (
          <ViewClubModal
            job={viewJob}
            managerReputation={managerReputation}
            onApply={() => setApplyJob(viewJob)}
            onClose={() => setViewJob(null)}
          />
        )}
      </Dialog>

      {/* Apply modal */}
      <Dialog open={applyJob !== null} onOpenChange={o => { if (!o) setApplyJob(null); }}>
        {applyJob && (
          <ApplyModal
            job={applyJob}
            managerReputation={managerReputation}
            onClose={() => setApplyJob(null)}
            onAccepted={handleAccepted}
          />
        )}
      </Dialog>
    </>
  );
}
