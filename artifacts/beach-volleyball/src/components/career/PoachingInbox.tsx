import { continentLabel, continentKeyFrom } from "@shared/continents";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClubCrest } from "@/components/club-crest";
import {
  useGetPoachingOffers,
  useAcceptPoachingOffer,
  useDeclinePoachingOffer,
  getGetPoachingOffersQueryKey,
} from "@workspace/api-client-react";
import type { PoachingOffer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  MapPin,
  DollarSign,
  CalendarDays,
  Target,
  Star,
  X,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trophy,
} from "lucide-react";
import { useLocation } from "wouter";

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

function fmt(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function repLabel(rep: number): string {
  if (rep >= 85) return "Elite";
  if (rep >= 70) return "Prestigious";
  if (rep >= 55) return "Established";
  return "Developing";
}

// ── Single offer card ───────────────────────────────────────────────────────

function OfferCard({ offer, onDone }: { offer: PoachingOffer; onDone: () => void }) {
  const [expanded,  setExpanded]  = useState(true);
  const [confirming, setConfirming] = useState<"accept" | null>(null);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { mutate: accept, isPending: accepting } = useAcceptPoachingOffer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPoachingOffersQueryKey() });
        onDone();
        navigate("/");
        window.location.reload();
      },
    },
  });

  const { mutate: decline, isPending: declining } = useDeclinePoachingOffer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPoachingOffersQueryKey() });
        onDone();
      },
    },
  });

  const isBusy = accepting || declining;

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-slate-950/80 shadow-lg overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        {/* Club crest */}
        <ClubCrest
          name={offer.clubName}
          primaryColor={offer.logoColor}
          size={40}
          className="shrink-0 mt-0.5 drop-shadow-lg"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400/80">
              Poaching Approach
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20">
              {repLabel(offer.clubReputation)} Club
            </span>
          </div>
          <p className="text-sm font-bold text-white leading-snug">
            {offer.clubName} wants to speak with you.
          </p>
          <p className="text-[11px] text-white/40 mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {offer.country} · {continentLabel(offer.continent)}
          </p>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 mt-0.5 text-white/30 hover:text-white/70 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <>
          {/* Offer details grid */}
          <div className="mx-5 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: <DollarSign className="h-3 w-3" />, label: "Monthly Salary", value: fmt(offer.salary) },
              { icon: <CalendarDays className="h-3 w-3" />, label: "Contract", value: `${offer.contractLength} season${offer.contractLength > 1 ? "s" : ""}` },
              { icon: <Briefcase className="h-3 w-3" />, label: "Transfer Budget", value: fmt(offer.transferBudget) },
              { icon: <Target className="h-3 w-3" />, label: "Board Expectation", value: offer.seasonExpectation },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col gap-0.5 rounded-xl bg-white/4 border border-white/8 px-3 py-2"
              >
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/35">
                  {item.icon} {item.label}
                </span>
                <span className="text-sm font-black text-white leading-tight">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Club rep bar */}
          <div className="mx-5 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35 flex items-center gap-1">
                <Star className="h-3 w-3" /> Club Reputation
              </span>
              <span className="text-[11px] font-bold text-white/60">{offer.clubReputation} / 100</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${offer.clubReputation}%`,
                  backgroundColor: offer.logoColor,
                }}
              />
            </div>
          </div>

          {/* Confirm accept prompt */}
          {confirming === "accept" && (
            <div className="mx-5 mb-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 px-4 py-3">
              <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-400" />
                Accept offer from {offer.clubName}?
              </p>
              <p className="text-[11px] text-white/50 mb-3">
                You'll leave your current club immediately and take charge at {offer.clubName}. A career history entry will be created.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={isBusy}
                  onClick={() => accept({ id: offer.id })}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                  Confirm & Join
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => setConfirming(null)}
                  className="text-white/50 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {confirming === null && (
            <div className="flex items-center gap-2 px-5 pb-4 flex-wrap">
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => setConfirming("accept")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Accept
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => decline({ id: offer.id })}
                className={cn(
                  "border-white/15 text-white/60 hover:text-white hover:border-white/30",
                  declining && "opacity-50 pointer-events-none"
                )}
              >
                {declining
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <X className="h-3.5 w-3.5 mr-1.5" />
                }
                Decline
              </Button>

              <Button
                size="sm"
                variant="ghost"
                disabled={isBusy}
                title="Negotiations are not available yet"
                className="text-white/35 hover:text-white/50 cursor-not-allowed"
                onClick={() => {}}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Negotiate
              </Button>

              <span className="text-[9px] text-white/20 italic ml-1 hidden sm:inline">
                Negotiate coming soon
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

export function PoachingInbox() {
  const { data, isLoading } = useGetPoachingOffers({
    query: { queryKey: getGetPoachingOffersQueryKey(), refetchOnWindowFocus: false },
  });
  const qc = useQueryClient();

  const offers = data?.offers ?? [];

  if (isLoading || offers.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400/80">
          Inbox — {offers.length} job offer{offers.length > 1 ? "s" : ""}
        </span>
      </div>

      {offers.map(offer => (
        <OfferCard
          key={offer.id}
          offer={offer}
          onDone={() => qc.invalidateQueries({ queryKey: getGetPoachingOffersQueryKey() })}
        />
      ))}
    </div>
  );
}
