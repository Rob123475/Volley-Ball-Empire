/**
 * A staff or medical contract's end date, and the three lengths it can be
 * renewed for (L-02a).
 *
 * Staff contracts used to have no end date at all: a coach hired in season one
 * was still on the payroll in season thirty and the only way out was to
 * terminate him. They now expire on the game clock like a player's, with four
 * weeks' warning on the Attention list, so every screen that shows a staff
 * member has to show when his deal ends and let the club keep him.
 *
 * Shared by the Staff and Medical pages because they are the same rows, told
 * apart by role, and renewed through the same route.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRenewStaffContract, getListStaffQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CONTRACT_LENGTHS, CONTRACT_LENGTH_LABELS, type ContractLength } from "@/lib/contract-lengths";

export function ContractRenewBar({
  staffId,
  endDate,
  gameDate,
  onRenewed,
}: {
  staffId: number;
  endDate: string | null | undefined;
  /** The game clock, so "ends soon" means soon in the career, not in real life. */
  gameDate?: string | null;
  onRenewed?: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const renew = useRenewStaffContract();

  if (!endDate) return null;

  const daysLeft = gameDate
    ? Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${gameDate}T00:00:00Z`)) / 86_400_000)
    : null;
  const soon = daysLeft != null && daysLeft >= 0 && daysLeft <= 28;

  const pick = (length: ContractLength) => {
    renew.mutate({ id: staffId, data: { length } }, {
      onSuccess: () => {
        setChoosing(false);
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        onRenewed?.();
        toast({ title: "Contract renewed", description: `Extended by ${CONTRACT_LENGTH_LABELS[length]}.` });
      },
      onError: () => toast({ title: "Could not renew", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs">
        <CalendarClock className={soon ? "h-3 w-3 text-orange-500 shrink-0" : "h-3 w-3 text-muted-foreground shrink-0"} />
        <span className="text-muted-foreground">Contract ends:</span>
        <span className={soon ? "font-semibold text-orange-500" : "font-semibold"}>{endDate}</span>
        {soon && daysLeft != null && (
          <span className="text-orange-500">({daysLeft}d)</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2 text-xs"
          data-testid={`button-renew-staff-${staffId}`}
          onClick={() => setChoosing((c) => !c)}
        >
          {choosing ? "Cancel" : "Renew"}
        </Button>
      </div>

      {choosing && (
        <div className="grid grid-cols-3 gap-1.5">
          {CONTRACT_LENGTHS.map((l) => (
            <button
              key={l}
              type="button"
              disabled={renew.isPending}
              data-testid={`button-renew-staff-${staffId}-${l}`}
              onClick={() => pick(l)}
              className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-muted/70 disabled:opacity-50"
            >
              {CONTRACT_LENGTH_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
