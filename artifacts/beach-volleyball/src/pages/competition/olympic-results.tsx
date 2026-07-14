import { CheckCircle2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OlympicResults() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olympic Results</h1>
        <p className="text-muted-foreground mt-1">Match results from the Olympic tournament</p>
      </div>
      <div className="rounded-xl border bg-card p-10 flex flex-col items-center text-center space-y-4 max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Olympic Results</h3>
          <p className="text-muted-foreground text-sm mt-2">
            Olympic match results will appear here once the Olympic tournament is underway.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Lock className="h-3 w-3" />
          Coming in a future update
        </Badge>
      </div>
    </div>
  );
}
