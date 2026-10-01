/**
 * The contract box: one for every signing (Unity brief item 15, overnight
 * 30 Sep 33b, overnight 1 Oct N-33/N-41/N-44 (b)). The Player Market's seniors
 * and youths, and a scouting mission's finds (Continental Scouting, Youth
 * Academy) all sign through it: her price, her wage (a senior's negotiable from
 * her asking wage; a youth's the academy's wage for her talent), 6 months /
 * 1 season / 2 seasons, where she goes (Main Team or Interchange for a senior;
 * the academy's Youth Team or Reserves for a youth), and the confirm.
 */
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { CONTRACT_LENGTHS, CONTRACT_LENGTH_LABELS, type ContractLength } from "@/lib/contract-lengths";
import { youthWageText } from "@/lib/youth-wage";
import { cn } from "@/lib/utils";

export type SquadRole = "starter" | "interchange" | "reserve";
export type AcademyRole = "youth_team" | "reserve";

/** What the box sends: the market's POST /contracts body, and a find's signing body. */
export type ContractOffer = {
  salary: number; winBonus: number; length: ContractLength; squadRole: SquadRole; academyRole?: AcademyRole;
};

const SQUAD_DESTINATIONS: { role: SquadRole; label: string }[] = [
  { role: "starter",     label: "Main Team" },
  { role: "interchange", label: "Interchange" },
];

const ACADEMY_DESTINATIONS: { role: AcademyRole; label: string }[] = [
  { role: "youth_team", label: "Youth Team" },
  { role: "reserve",    label: "Reserves" },
];

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function ContractModal({ player, onSign, isPending, triggerTestId }: { player: any; onSign: (v: ContractOffer) => void; isPending: boolean; triggerTestId?: string }) {
  // Item 15 (Rob's design): signing is a confirm step with her price on it:
  // the exact price for a scouted player, the range for an unscouted one,
  // whose exact price is revealed, with her attributes, when she signs.
  const blind = !!player.priceRange && player.price == null;
  // Overnight 1 Oct, N-41: the offer starts at her asking wage (the 1 Oct rise
  // included), and the slider reaches well past it; it started at $5,000 and
  // stopped at $20,000, below what most seniors now ask.
  const asking = Math.round(Number(player.salary) || 0);
  const salaryMax = Math.max(40_000, Math.ceil((asking * 2) / 1000) * 1000);
  const [salary, setSalary]   = useState([asking > 0 ? asking : 5000]);
  const [winBonus, setWinBonus] = useState([500]);
  const [length, setLength]   = useState<ContractLength>("1s");
  // An academy youth (not a promoted graduate); the age is the fallback for a record without the type.
  const isYouth = player.playerType ? player.playerType === "youth" && !player.isPromoted : player.age >= 14 && player.age <= 17;
  const defaultRole: SquadRole = isYouth ? "reserve" : "interchange";
  const [squadRole, setSquadRole] = useState<SquadRole>(defaultRole);
  // N-44 (b): a youth goes to the academy's youth team (3 who play) or its reserves.
  const [academyRole, setAcademyRole] = useState<AcademyRole>("youth_team");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full gap-2" data-testid={triggerTestId ?? `button-sign-${player.id}`}>
          <UserPlus className="h-4 w-4" />
          {blind ? "Sign (unscouted)" : "Sign"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contract Offer: {player.name}</DialogTitle>
          <DialogDescription>Negotiate terms. A contract runs 6 months, 1 season or 2 seasons.</DialogDescription>
        </DialogHeader>
        {player.priceRange && (
          <div className={cn("rounded-lg border px-3 py-2 text-sm", blind ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-muted/40")} data-testid="sign-price">
            {blind ? (
              <>
                <p className="font-semibold">Unscouted: her price is between {money(player.priceRange.low)} and {money(player.priceRange.high)}.</p>
                <p className="text-xs text-muted-foreground mt-0.5">Her exact price and attributes are revealed when she signs, and the price is charged then. Scouting her first (5 days) shows both before you buy.</p>
              </>
            ) : (
              <p className="font-semibold">Her price: {money(player.price)}, charged when she signs, on top of her wage.</p>
            )}
          </div>
        )}
        <div className="space-y-6 py-4">
          {isYouth ? (
            // N-33: a youth is paid the academy's wage for her talent (it is what the
            // weekly run bills); the offer defaulted to $5,000 a month.
            <div className="space-y-1" data-testid="youth-wage">
              <div className="flex justify-between text-sm font-medium">
                <span>Wage</span>
                <span className="text-primary font-bold">{youthWageText(asking)}</span>
              </div>
              <p className="text-xs text-muted-foreground">The academy's wage for her talent.</p>
            </div>
          ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Monthly Salary</span>
              <span className="text-primary font-bold">${salary[0].toLocaleString()}</span>
            </div>
            <Slider min={1000} max={salaryMax} step={100} value={salary} onValueChange={setSalary} />
            {asking > 0 && <p className="text-xs text-muted-foreground">She asks ${asking.toLocaleString("en-US")} a month.</p>}
          </div>
          )}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Win Bonus</span>
              <span className="text-secondary font-bold">${winBonus[0].toLocaleString()}</span>
            </div>
            <Slider min={0} max={5000} step={50} value={winBonus} onValueChange={setWinBonus} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Contract Length</p>
            <div className="grid grid-cols-3 gap-1.5">
              {CONTRACT_LENGTHS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLength(l)}
                  data-testid={`button-length-${l}`}
                  className={[
                    "rounded-md border px-2 py-2 text-xs font-semibold transition-colors",
                    length === l
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/40 text-foreground hover:border-primary/60 hover:bg-muted/70",
                  ].join(" ")}
                >
                  {CONTRACT_LENGTH_LABELS[l]}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-right">
              A season ends when the World Tour does — the club sets the date.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Assign To</p>
            <div className={cn("grid gap-1.5", isYouth ? "grid-cols-2" : "grid-cols-2")}>
              {isYouth
                ? ACADEMY_DESTINATIONS.map(({ role, label }) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setAcademyRole(role)}
                      data-testid={`button-academy-${role}`}
                      className={[
                        "rounded-md border px-2 py-2 text-xs font-semibold transition-colors",
                        academyRole === role
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/40 text-foreground hover:border-primary/60 hover:bg-muted/70",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))
                : SQUAD_DESTINATIONS.map(({ role, label }) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSquadRole(role)}
                      className={[
                        "rounded-md border px-2 py-2 text-xs font-semibold transition-colors",
                        squadRole === role
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/40 text-foreground hover:border-primary/60 hover:bg-muted/70",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
            </div>
            {isYouth && (
              <p className="text-[10px] text-muted-foreground">
                The youth team is the 3 who play and develop at the full rate; reserves develop at half. If the youth team is full she starts in the reserves.
              </p>
            )}
          </div>
        </div>
        <Button
          className="w-full"
          onClick={() => onSign({ salary: isYouth ? asking : salary[0], winBonus: winBonus[0], length, squadRole: isYouth ? "reserve" : squadRole, ...(isYouth ? { academyRole } : {}) })}
          disabled={isPending}
          data-testid="button-confirm-sign"
        >
          {isPending ? "Negotiating..." : player.priceRange ? (blind ? `Confirm: sign for ${money(player.priceRange.low)} - ${money(player.priceRange.high)}` : `Confirm: sign for ${money(player.price)}`) : "Finalize Contract"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A scouting mission's find, as the contract box takes a player: a youth whose
 * wage is the academy's for her talent and whose price is the find's (known,
 * because a scout found her).
 */
export function findAsSigning(p: { id: number; name: string; age: number; signingCost: number; wage?: number | null }) {
  return {
    id: p.id, name: p.name, age: p.age, playerType: "youth", isPromoted: false,
    salary: p.wage ?? 0, price: p.signingCost, priceRange: { low: p.signingCost, high: p.signingCost },
  };
}

/** What the box's choice did, in words, for the toast after a youth signs. */
export function academyPlaceText(place: string | null | undefined, wanted?: AcademyRole): string {
  if (place === "youth_team") return "She joins your youth team.";
  if (place === "reserve") return wanted === "youth_team" ? "Your youth team is full: she joins the reserves (swap her in from Team > Youth Loans)." : "She joins the reserves.";
  return "";
}
