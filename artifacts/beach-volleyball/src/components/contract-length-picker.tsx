/**
 * Overnight brief 30 Sep, item 33b: every staff and medical hire is a contract,
 * its length chosen when hiring (the markets showed "12mo" and offered no
 * choice). Rob, 24 Oct: 1 season or 2 seasons, to 7 January, the same two the
 * renew bar offers.
 */
import { STAFF_CONTRACT_LENGTHS, CONTRACT_LENGTH_LABELS, type ContractLength } from "@/lib/contract-lengths";
import { cn } from "@/lib/utils";

export function ContractLengthPicker({ value, onChange }: { value: ContractLength; onChange: (v: ContractLength) => void }) {
  return (
    <div className="flex gap-2 pt-2" role="radiogroup" aria-label="Contract length" data-testid="contract-length-picker">
      {STAFF_CONTRACT_LENGTHS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={cn(
            "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold",
            value === l ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50",
          )}
        >
          {CONTRACT_LENGTH_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
