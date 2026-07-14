import { FolderOpen, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OlympicHistory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olympic History</h1>
        <p className="text-muted-foreground mt-1">Past Olympic campaigns and medal results</p>
      </div>
      <div className="rounded-xl border bg-card p-10 flex flex-col items-center text-center space-y-4 max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <FolderOpen className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Olympic History</h3>
          <p className="text-muted-foreground text-sm mt-2">
            A full record of past Olympic campaigns, including qualification paths, results,
            and medal winners will be available here in a future update.
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
