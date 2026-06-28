import { UserCog, Briefcase, Globe, Star, Clock } from "lucide-react";

export default function ManagerProfile() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Manager Profile</h1>
        <p className="text-sm text-white/50 mt-1">Your personal manager identity and career overview.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/3 p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
          <UserCog className="h-8 w-8 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">Manager Profile</h2>
          <p className="text-sm text-white/40 mt-1 max-w-sm">
            View and edit your manager identity, personal stats, reputation and career highlights.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          {[
            { icon: Star, label: "Reputation" },
            { icon: Globe, label: "Nationality" },
            { icon: Briefcase, label: "Coaching Licence" },
            { icon: Clock, label: "Experience" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-xs font-semibold text-white/50">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
          ))}
        </div>
        <p className="text-xs text-white/25 italic mt-2">Coming soon</p>
      </div>
    </div>
  );
}
