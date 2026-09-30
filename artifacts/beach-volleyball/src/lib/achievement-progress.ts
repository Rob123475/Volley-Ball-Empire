/**
 * Overnight brief 30 Sep, item 29: an achievement's progress, in one format on
 * every page. The Trophy Cabinet printed money targets raw ("396045 /
 * 1000000") while the Career page showed "$0.40M / $1M".
 */
export function formatProgress(current: number, target: number): string {
  if (target >= 1_000_000) return `$${(current / 1_000_000).toFixed(2)}M / $${(target / 1_000_000).toFixed(0)}M`;
  if (target >= 100_000)   return `$${Math.round(current / 1000)}k / $${Math.round(target / 1000)}k`;
  return `${current} / ${target}`;
}
