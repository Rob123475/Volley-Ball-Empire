import { Calendar, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OlympicSchedule() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olympic Schedule</h1>
        <p className="text-muted-foreground mt-1">Match schedule for the Olympic tournament</p>
      </div>
      <div className="rounded-xl border bg-card p-10 flex flex-col items-center text-center space-y-4 max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Olympic Schedule</h3>
          <p className="text-muted-foreground text-sm mt-2">
            The Olympic tournament schedule will be available once Olympic qualification
            and the draw have been completed.
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
