/**
 * 1.1.1, Part 4 (Rob, 16 Oct): the perks a senior contract can carry, as a
 * row of tick boxes with their monthly cost. Used by every senior contract
 * box: a signing or a bid, a renewal, and a counter-offer. The perks and their
 * costs are lib/db schema/transfers.ts PERKS. Each costs the club every month
 * from the day she arrives (or the renewal starts), counts toward the cap, and
 * shows in Finances as "Player perks".
 */
import { PERKS, PERK_PULL_VALUE } from "@shared/transfers";
import { cn } from "@/lib/utils";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const PULL_LABEL = { small: "small pull", medium: "medium pull", large: "large pull" } as const;

/** What a set of perks costs a month. */
export const perksCost = (keys: readonly string[]) => PERKS.filter((p) => keys.includes(p.key)).reduce((t, p) => t + p.monthly, 0);

export function PerkPicker({ value, onChange, testIdPrefix = "perk" }: { value: string[]; onChange: (keys: string[]) => void; testIdPrefix?: string }) {
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="space-y-1.5" data-testid={`${testIdPrefix}-picker`}>
      <div className="flex justify-between text-sm font-medium">
        <span>Perks</span>
        <span className="text-primary font-bold" data-testid={`${testIdPrefix}-total`}>{money(perksCost(value))} a month</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {PERKS.map((p) => (
          <label key={p.key} title={`Worth about ${money(PERK_PULL_VALUE[p.pull])} a month to her (${PULL_LABEL[p.pull]})`}
            className={cn("flex items-center gap-1.5 rounded border px-1.5 py-1 text-[11px] cursor-pointer", value.includes(p.key) ? "border-primary bg-primary/10" : "border-border")}>
            <input type="checkbox" checked={value.includes(p.key)} onChange={() => toggle(p.key)} data-testid={`${testIdPrefix}-${p.key}`} />
            <span className="flex-1">{p.label}</span>
            <span className="text-muted-foreground">{money(p.monthly)}</span>
          </label>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Paid every month with her wage from the day she starts, and counted toward the salary cap.</p>
    </div>
  );
}
