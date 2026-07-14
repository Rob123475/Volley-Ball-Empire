import { Flag, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function NationalSquads() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">National Squads</h1>
        <p className="text-muted-foreground mt-1">
          Country rosters selected for Olympic qualification
        </p>
      </div>

      <div className="rounded-xl border bg-card p-10 flex flex-col items-center text-center space-y-4 max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Flag className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">National Squads</h3>
          <p className="text-muted-foreground text-sm mt-2">
            National squad selection and Olympic qualification tracking will be available
            once the Olympic campaign system is activated.
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
