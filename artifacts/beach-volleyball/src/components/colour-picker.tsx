/**
 * 1.2 9b (Rob, 28 Nov 2026): the colour picker for swimwear (plain, and every colour of a print the
 * player may change) and the store's items. Bright full colours AND pastels, not one muted set:
 * twelve brights, their twelve soft versions, white, black and grey, and any other colour by hand.
 */
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check } from "lucide-react";

/** Each bright with its pastel (the same hue, soft). */
export const BRIGHTS: readonly [string, string][] = [
  ["Red", "#e11d2a"], ["Orange", "#f97316"], ["Yellow", "#facc15"], ["Lime", "#84cc16"],
  ["Green", "#16a34a"], ["Teal", "#0d9488"], ["Cyan", "#06b6d4"], ["Blue", "#2563eb"],
  ["Navy", "#1e2a78"], ["Purple", "#7c3aed"], ["Magenta", "#d946ef"], ["Hot pink", "#ff2d8a"],
];
export const PASTELS: readonly [string, string][] = [
  ["Pastel red", "#f9a8ac"], ["Peach", "#fdc9a1"], ["Butter", "#fde99a"], ["Pastel lime", "#d4ef9e"],
  ["Mint", "#a7e3bd"], ["Pastel teal", "#9fdcd5"], ["Sky", "#a5e6f2"], ["Baby blue", "#a9c4f7"],
  ["Periwinkle", "#a9b0e3"], ["Lavender", "#cbb5f7"], ["Orchid", "#f0b5f7"], ["Pastel pink", "#ffb8d6"],
];
export const NEUTRALS: readonly [string, string][] = [["White", "#ffffff"], ["Grey", "#8a8f98"], ["Black", "#111111"]];

function Swatch({ name, hex, on, pick }: { name: string; hex: string; on: boolean; pick: (hex: string) => void }) {
  return (
    <button type="button" title={name} aria-label={name} onClick={() => pick(hex)}
      className="relative h-6 w-6 rounded border border-black/20" style={{ background: hex }}>
      {on && <Check className="absolute inset-0 m-auto h-4 w-4" style={{ color: hex === "#ffffff" || PASTELS.some(([, p]) => p === hex) ? "#111" : "#fff" }} />}
    </button>
  );
}

/** A colour: a button showing it, opening the palette. */
export function ColourPicker({ value, onChange, label, disabled }: { value: string; onChange: (hex: string) => void; label: string; disabled?: boolean }) {
  const v = value.toLowerCase();
  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" aria-label={label} title={label} disabled={disabled}
          className="h-9 w-10 shrink-0 rounded border border-input disabled:opacity-30" style={{ background: value }} />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" data-testid="colour-palette">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Brights</div>
          <div className="grid grid-cols-6 gap-1">{BRIGHTS.map(([n, h]) => <Swatch key={h} name={n} hex={h} on={v === h} pick={onChange} />)}</div>
          <div className="text-xs font-medium text-muted-foreground">Pastels</div>
          <div className="grid grid-cols-6 gap-1">{PASTELS.map(([n, h]) => <Swatch key={h} name={n} hex={h} on={v === h} pick={onChange} />)}</div>
          <div className="flex items-center gap-1">
            {NEUTRALS.map(([n, h]) => <Swatch key={h} name={n} hex={h} on={v === h} pick={onChange} />)}
            <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              Any colour
              <input type="color" aria-label={`${label}: any colour`} value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 rounded border" />
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
