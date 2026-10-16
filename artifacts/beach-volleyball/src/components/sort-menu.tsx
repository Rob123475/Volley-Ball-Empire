/**
 * Rob, 16 Oct: a Sort menu on the Player Market, the Staff Market and the
 * Medical Market. Each screen offers only the orders it has data for, read from
 * the fields its cards already show. A card that doesn't show the value (an
 * unscouted rating, no contract) goes after the rest, and cards that tie keep
 * the order they had.
 */
export type SortKey = "none" | "price_desc" | "price_asc" | "rating_desc" | "age_asc" | "fit_first" | "injured_first" | "contract_asc";

export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  none:          "Default order",
  price_desc:    "Price: highest first",
  price_asc:     "Price: lowest first",
  rating_desc:   "Rating: best first",
  age_asc:       "Age: youngest first",
  fit_first:     "Injuries: fit first",
  injured_first: "Injuries: injured first",
  contract_asc:  "Contract: least time left first",
};

/** How a screen reads each value from a card's data; a missing reader leaves that order off its menu. */
export type SortReaders<T> = {
  price?: (t: T) => number | null;
  rating?: (t: T) => number | null;
  age?: (t: T) => number | null;
  injured?: (t: T) => boolean;
  /** The contract's end date (yyyy-mm-dd), or null with none shown. */
  contractEnd?: (t: T) => string | null;
};

/** The orders a screen has data for, in menu order. */
export function sortKeysFor<T>(readers: SortReaders<T>): SortKey[] {
  return (["none", "price_desc", "price_asc", "rating_desc", "age_asc", "fit_first", "injured_first", "contract_asc"] as const).filter((k) =>
    k === "none" || (k.startsWith("price") ? !!readers.price : k === "rating_desc" ? !!readers.rating : k === "age_asc" ? !!readers.age
      : k === "contract_asc" ? !!readers.contractEnd : !!readers.injured));
}

/** A middle of a range shown on a card ("$12,000 - $16,000"), for a price or wage not yet exact. */
export const midpoint = (r: { low: number; high: number } | null | undefined): number | null => (r ? (r.low + r.high) / 2 : null);

export function sortList<T>(list: readonly T[], key: SortKey, readers: SortReaders<T>): T[] {
  // Unknown last, whichever way the known values run.
  const byNumber = (read: ((t: T) => number | null) | undefined, dir: 1 | -1) => (a: T, b: T) => {
    const x = read?.(a) ?? null, y = read?.(b) ?? null;
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
    return (x - y) * dir;
  };
  const cmp: ((a: T, b: T) => number) | null =
    key === "price_desc" ? byNumber(readers.price, -1)
    : key === "price_asc" ? byNumber(readers.price, 1)
    : key === "rating_desc" ? byNumber(readers.rating, -1)
    : key === "age_asc" ? byNumber(readers.age, 1)
    : key === "fit_first" ? (a, b) => Number(!!readers.injured?.(a)) - Number(!!readers.injured?.(b))
    : key === "injured_first" ? (a, b) => Number(!!readers.injured?.(b)) - Number(!!readers.injured?.(a))
    : key === "contract_asc" ? byNumber((t) => { const d = readers.contractEnd?.(t); return d ? Date.parse(d) : null; }, 1)
    : null;
  return cmp ? [...list].sort(cmp) : [...list];
}

/**
 * 1.1.1, Part 10 (Rob): scouted first. Every market list (the Player Market's
 * seniors and youths, the Staff Market, the Medical list, the Watch List and
 * the Clubs page) shows the cards whose report is in at the top, then those
 * with a report in progress, then the unscouted; inside each group the chosen
 * Sort order stands. The state is the server's for today, so a card moves up
 * the day its report comes in.
 */
export function scoutedFirst<T>(list: readonly T[], stateOf: (t: T) => string | null | undefined): T[] {
  const rank = (s: string | null | undefined) => (s === "done" ? 0 : s === "in_progress" ? 1 : 2);
  return list.map((t, i) => ({ t, i, r: rank(stateOf(t)) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.t);
}

export function SortMenu({ value, onChange, keys, testId }: { value: SortKey; onChange: (k: SortKey) => void; keys: readonly SortKey[]; testId: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
      Sort
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
        data-testid={testId}
        aria-label="Sort"
      >
        {keys.map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
      </select>
    </label>
  );
}
