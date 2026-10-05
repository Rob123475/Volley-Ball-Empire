import { staffAbsenceBadge } from "@shared/staff-illness";

/**
 * Final brief 5 Oct, Part B: "Off: flu, back in 4 days" on a Staff or Medical
 * card while the member is off ill or hurt (their bonus does not apply until
 * they are back). Nothing while they are on duty.
 */
export function StaffOffBadge({ member }: { member: { offCause?: string | null; offDaysLeft?: number | null } }) {
  const text = staffAbsenceBadge(member.offCause, member.offDaysLeft ?? 0);
  if (!text) return null;
  return (
    <div
      data-testid="staff-off-badge"
      className="flex w-full items-center justify-center rounded-md bg-rose-600/90 px-2 py-1 text-xs font-bold text-white shadow"
      title="Off ill or hurt: their bonus does not apply until they are back."
    >
      {text}
    </div>
  );
}

/** On duty: only these give their bonus (the pages' bonus panels count only them). */
export function onDuty(member: { offDaysLeft?: number | null }): boolean {
  return (member.offDaysLeft ?? 0) <= 0;
}
