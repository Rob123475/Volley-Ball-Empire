import { useGetFacilities } from "@workspace/api-client-react";
import { Building2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface FacilityBonusBannerProps {
  facilityType: string;
  facilityName: string;
  getBonusText: (level: number) => string;
  className?: string;
}

/**
 * Shows the active facility bonus for a given facility type.
 * Returns null when the facility is at Level 1 (no active bonus yet).
 */
export function FacilityBonusBanner({
  facilityType,
  facilityName,
  getBonusText,
  className,
}: FacilityBonusBannerProps) {
  const { data: facilities } = useGetFacilities();
  const facility = facilities?.find((f) => f.type === facilityType);
  const level = facility?.level ?? 1;

  if (level <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm",
        className,
      )}
    >
      <Building2 className="h-4 w-4 shrink-0 text-primary" />
      <span>
        <Link href="/facilities" className="font-semibold text-primary hover:underline">
          {facilityName} Level {level}
        </Link>
        {" — "}
        {getBonusText(level)}
      </span>
    </div>
  );
}
