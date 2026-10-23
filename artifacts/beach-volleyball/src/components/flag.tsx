import { Globe } from "lucide-react";
import { flagCode } from "@shared/continents";

/**
 * 1.1.3 (brief A2): a nation's real flag, the one way the game draws one.
 *
 * The picture is public/images/flags/<code>.svg (the MIT flag-icons set, 4:3),
 * found by flagCode() in lib/db's continents.ts, which takes any spelling the
 * game stores ("Brazil", "Brazilian", "Scotland"). Windows has no emoji flags,
 * so the old emoji showed as two letters; a nationality the game doesn't know
 * shows a plain globe, never letters.
 *
 * `size` is the height in px, or "em" to follow the text around it (a card that
 * scales); the flag is 4:3.
 */
export function Flag({ nation, size = 14, className = "", title }: { nation: string | null | undefined; size?: number | "em"; className?: string; title?: string }) {
  const code = flagCode(nation);
  const label = title ?? nation ?? "";
  const box = size === "em" ? { width: "1.333em", height: "1em" } : { width: Math.round((size * 4) / 3), height: size };
  if (!code) {
    return <Globe data-testid="flag-unknown" aria-label={label} className={`inline-block shrink-0 text-muted-foreground ${className}`} style={{ width: box.height, height: box.height }} />;
  }
  return (
    <img
      data-testid="flag"
      data-flag={code}
      src={`${import.meta.env.BASE_URL}images/flags/${code}.svg`}
      alt={label}
      title={label}
      draggable={false}
      className={`inline-block shrink-0 rounded-[2px] object-cover align-[-0.125em] shadow-[0_0_0_1px_rgba(0,0,0,0.25)] ${className}`}
      style={box}
    />
  );
}
