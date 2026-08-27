import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Plus, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Profile = { id: string; name: string; profileImage: string | null };

function getReturnTo(): string {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");
  return returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
}

export default function ProfilePicker() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  // A failed profiles request must never render as "you have no managers" —
  // that reads as data loss on what is often the first screen of the game.
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["local-profiles"],
    queryFn: async (): Promise<{ profiles: Profile[] }> => {
      const res = await fetch("/api/profiles");
      if (!res.ok) throw new Error("Failed to load profiles");
      return res.json();
    },
  });

  const selectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/profiles/${id}/select`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to select profile");
      return res.json();
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = getReturnTo();
    },
    onError: () => setActionError("Could not open that profile. Please try again."),
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create profile");
      return res.json() as Promise<{ id: string }>;
    },
    onMutate: () => setActionError(null),
    onSuccess: (created) => {
      selectMutation.mutate(created.id);
    },
    onError: () => setActionError("Could not create that profile. Please try again."),
  });

  const profiles = data?.profiles ?? [];
  const busy = selectMutation.isPending || createMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">Select Manager</h1>
          <p className="text-sm text-white/40">Pick a profile, or create a new one.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/3 divide-y divide-white/5 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-3 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading profiles…</span>
            </div>
          ) : isError ? (
            <div className="py-8 px-4 text-center space-y-3">
              <p className="text-sm text-white/50">
                Could not load your managers. They have not been deleted — the
                game could not reach its local server.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-8 px-4 text-center text-sm text-white/30">No profiles yet — create one below.</div>
          ) : (
            profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => selectMutation.mutate(p.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/6 transition-colors disabled:opacity-40"
              >
                <div className="h-9 w-9 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-secondary" />
                </div>
                <span className="flex-1 text-sm font-bold text-white">{p.name}</span>
                <Play className="h-4 w-4 text-white/30" />
              </button>
            ))
          )}
        </div>

        {creating ? (
          <div className="rounded-2xl border border-white/10 bg-white/3 p-4 space-y-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim() && !busy) createMutation.mutate(newName.trim());
              }}
              placeholder="Manager name"
              maxLength={50}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/30 transition-all"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setCreating(false); setNewName(""); }}
                disabled={busy}
                className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => newName.trim() && createMutation.mutate(newName.trim())}
                disabled={busy || !newName.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary hover:bg-secondary/90 py-2 text-sm font-black text-white transition-all disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                Create & Continue
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={busy}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white/70 hover:bg-white/10 transition-all disabled:opacity-40",
            )}
          >
            <Plus className="h-4 w-4" /> New Profile
          </button>
        )}

        {actionError && (
          <p className="text-center text-sm text-red-400/90" role="alert">{actionError}</p>
        )}
      </div>
    </div>
  );
}
