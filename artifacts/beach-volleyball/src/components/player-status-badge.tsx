import { cn } from "@/lib/utils";

export type PlayerStatusLevel = "Healthy" | "Tired" | "Carrying Injury" | "Unavailable";

export interface PlayerStatusInfo {
  level: PlayerStatusLevel;
  label: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
}

export function getPlayerStatus(player: {
  fatigue?: number | null;
  injuryStatus?: string | null;
}): PlayerStatusInfo {
  const fatigue = player.fatigue ?? 0;
  const injury = player.injuryStatus ?? "Healthy";

  if (injury === "Unavailable") return {
    level: "Unavailable",
    label: "Unavailable",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-300 dark:border-red-800",
  };

  if (injury === "Major Injury" || injury === "Minor Injury") return {
    level: "Carrying Injury",
    label: "Carrying Injury",
    dot: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-300 dark:border-orange-800",
  };

  if (fatigue >= 75) return {
    level: "Tired",
    label: "Tired",
    dot: "bg-yellow-400",
    text: "text-yellow-700 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-300 dark:border-yellow-800",
  };

  return {
    level: "Healthy",
    label: "Healthy",
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-300 dark:border-green-800",
  };
}

interface PlayerStatusBadgeProps {
  player: { fatigue?: number | null; injuryStatus?: string | null };
  className?: string;
  size?: "xs" | "sm";
}

export function PlayerStatusBadge({ player, className, size = "sm" }: PlayerStatusBadgeProps) {
  const s = getPlayerStatus(player);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        s.text, s.bg, s.border,
        className,
      )}
    >
      <span className={cn("rounded-full flex-shrink-0", s.dot, size === "xs" ? "w-1 h-1" : "w-1.5 h-1.5")} />
      {s.label}
    </span>
  );
}
