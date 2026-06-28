import { Briefcase, Globe, Star, Building2 } from "lucide-react";

export default function JobMarket() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Job Market</h1>
        <p className="text-sm text-white/50 mt-1">Available coaching positions around the world.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/3 p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <Briefcase className="h-8 w-8 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">Job Market</h2>
          <p className="text-sm text-white/40 mt-1 max-w-sm">
            Browse open club and national team vacancies, submit applications and negotiate contracts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          {[
            { icon: Building2, label: "Club Jobs" },
            { icon: Globe,     label: "National Teams" },
            { icon: Star,      label: "Reputation Required" },
            { icon: Briefcase, label: "Applications" },
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
