import { Medal, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MedalTable() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Medal Table</h1>
        <p className="text-muted-foreground mt-1">Olympic medal standings by nation</p>
      </div>
      <div className="rounded-xl border bg-card p-10 flex flex-col items-center text-center space-y-4 max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Medal className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Medal Table</h3>
          <p className="text-muted-foreground text-sm mt-2">
            The Olympic medal table will be populated once the tournament concludes and medals
            have been awarded.
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
