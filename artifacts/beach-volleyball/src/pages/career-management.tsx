import { useState } from "react";
import {
  useListCareerSaves,
  getListCareerSavesQueryKey,
  useUpsertCareerSave,
  useDeleteCareerSave,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  Trash2,
  PlusCircle,
  Play,
  Trophy,
  Globe,
  DollarSign,
  CalendarDays,
  User,
  Loader2,
  AlertTriangle,
} from "lucide-react";

type SaveSlot = import("@workspace/api-client-react").CareerSaveSlot;

const SLOT_NUMBERS = [1, 2, 3] as const;

function formatBudget(budget: string | null | undefined): string {
  if (!budget) return "—";
  const n = parseFloat(budget);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── New Career Modal ──────────────────────────────────────────────────────────

interface NewCareerModalProps {
  slotNumber: number;
  onClose: () => void;
  onSave: (data: { slotNumber: number; managerName: string; clubName: string }) => void;
  isSaving: boolean;
}

function NewCareerModal({ slotNumber, onClose, onSave, isSaving }: NewCareerModalProps) {
  const [managerName, setManagerName] = useState("");
  const [clubName, setClubName]       = useState("");

  const valid = managerName.trim().length > 0 && clubName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Save className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">New Career — Slot {slotNumber}</h2>
              <p className="text-[11px] text-white/45 mt-0.5">Set your manager name and club to begin</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Manager Name</label>
            <input
              autoFocus
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              placeholder="e.g. Sarah Mitchell"
              maxLength={100}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Club Name</label>
            <input
              value={clubName}
              onChange={e => setClubName(e.target.value)}
              placeholder="e.g. Pacific Waves BC"
              maxLength={100}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ slotNumber, managerName: managerName.trim(), clubName: clubName.trim() })}
            disabled={!valid || isSaving}
            className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isSaving ? "Creating…" : "Start Career"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

interface DeleteConfirmProps {
  save: SaveSlot;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({ save, onClose, onConfirm, isDeleting }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Delete Career?</h2>
              <p className="text-[11px] text-white/45 mt-0.5">This cannot be undone</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
            <div className="text-sm font-bold text-white">{save.managerName}</div>
            <div className="text-xs text-white/45 mt-0.5">{save.clubName} · {save.season}</div>
          </div>

          <p className="text-sm text-white/50">
            All progress in Slot {save.slotNumber} will be permanently deleted.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Filled Slot Card ──────────────────────────────────────────────────────────

interface FilledCardProps {
  save: SaveSlot;
  onLoad: () => void;
  onDelete: () => void;
}

function FilledSlotCard({ save, onLoad, onDelete }: FilledCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/80 to-slate-900 shadow-lg group hover:border-white/20 transition-all">

      {/* Slot badge */}
      <div className="absolute top-3.5 right-3.5 h-6 w-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-black text-violet-400">
        {save.slotNumber}
      </div>

      <div className="p-5 space-y-4">
        {/* Manager + club */}
        <div className="space-y-1 pr-8">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-white/35 shrink-0" />
            <span className="text-base font-black text-white leading-tight truncate">{save.managerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-amber-400/70 shrink-0" />
            <span className="text-sm font-semibold text-white/70 truncate">{save.clubName}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <CalendarDays className="h-3 w-3" />
              Season
            </div>
            <div className="text-sm font-black text-white truncate">{save.season}</div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <Globe className="h-3 w-3" />
              Ranking
            </div>
            <div className={cn("text-sm font-black", save.worldRanking ? "text-white" : "text-white/25")}>
              {save.worldRanking ? `#${save.worldRanking}` : "Unranked"}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <DollarSign className="h-3 w-3" />
              Budget
            </div>
            <div className={cn("text-sm font-black", save.budget ? "text-emerald-400" : "text-white/25")}>
              {formatBudget(save.budget)}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <CalendarDays className="h-3 w-3" />
              Last Played
            </div>
            <div className="text-[11px] font-bold text-white/60 leading-snug">{formatDate(save.lastPlayedAt)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onLoad}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-black text-white transition-all"
          >
            <Play className="h-4 w-4" />
            Load Career
          </button>
          <button
            onClick={onDelete}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
            title="Delete career"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty Slot Card ───────────────────────────────────────────────────────────

interface EmptyCardProps {
  slotNumber: number;
  onCreate: () => void;
}

function EmptySlotCard({ slotNumber, onCreate }: EmptyCardProps) {
  return (
    <div
      onClick={onCreate}
      className="relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-transparent cursor-pointer group hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
    >
      <div className="absolute top-3.5 right-3.5 h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/30">
        {slotNumber}
      </div>

      <div className="p-5 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/4 group-hover:bg-violet-500/15 group-hover:border-violet-500/30 flex items-center justify-center transition-all">
          <PlusCircle className="h-6 w-6 text-white/25 group-hover:text-violet-400 transition-all" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-sm font-black text-white/35 group-hover:text-white/70 transition-all">Empty Slot</div>
          <div className="text-[11px] text-white/25 group-hover:text-white/45 transition-all">Click to start a new career</div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CareerManagement() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const { data, isLoading } = useListCareerSaves({
    query: { queryKey: getListCareerSavesQueryKey() },
  });

  const upsertMutation = useUpsertCareerSave();
  const deleteMutation = useDeleteCareerSave();

  const [newSlot,    setNewSlot]    = useState<number | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<SaveSlot | null>(null);

  const savesBySlot = new Map<number, SaveSlot>(
    (data?.saves ?? []).map(s => [s.slotNumber, s]),
  );

  const handleCreate = (body: { slotNumber: number; managerName: string; clubName: string }) => {
    upsertMutation.mutate(
      { data: body },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListCareerSavesQueryKey() });
          setNewSlot(null);
          toast({ title: "Career created", description: `${body.managerName} — Slot ${body.slotNumber}` });
        },
        onError: () => {
          toast({ title: "Failed to create career", variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = (save: SaveSlot) => {
    deleteMutation.mutate(
      { id: save.id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListCareerSavesQueryKey() });
          setDeleteSlot(null);
          toast({ title: "Career deleted", description: `Slot ${save.slotNumber} cleared` });
        },
        onError: () => {
          toast({ title: "Failed to delete", variant: "destructive" });
        },
      },
    );
  };

  const handleLoad = (save: SaveSlot) => {
    toast({ title: `Loading career`, description: `${save.managerName} — ${save.clubName}` });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 md:p-8 space-y-8">

      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Save className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-none">Career Management</h1>
            <p className="text-sm text-white/45 mt-1">Manage your Beach Volley Pro save files</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-sky-500/15 bg-sky-500/8 px-4 py-3 flex items-start gap-3">
        <div className="text-sky-400 mt-0.5 shrink-0">ℹ️</div>
        <p className="text-sm text-white/55">
          You can maintain up to <span className="font-bold text-white/80">3 separate careers</span> simultaneously.
          Each slot tracks its own manager, club, season progression, world ranking, and budget independently.
        </p>
      </div>

      {/* Save slots grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-white/40">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading save slots…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SLOT_NUMBERS.map(slot => {
            const save = savesBySlot.get(slot);
            return save ? (
              <FilledSlotCard
                key={slot}
                save={save}
                onLoad={() => handleLoad(save)}
                onDelete={() => setDeleteSlot(save)}
              />
            ) : (
              <EmptySlotCard
                key={slot}
                slotNumber={slot}
                onCreate={() => setNewSlot(slot)}
              />
            );
          })}
        </div>
      )}

      {/* Modals */}
      {newSlot !== null && (
        <NewCareerModal
          slotNumber={newSlot}
          onClose={() => setNewSlot(null)}
          onSave={handleCreate}
          isSaving={upsertMutation.isPending}
        />
      )}

      {deleteSlot !== null && (
        <DeleteConfirmModal
          save={deleteSlot}
          onClose={() => setDeleteSlot(null)}
          onConfirm={() => handleDelete(deleteSlot)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
