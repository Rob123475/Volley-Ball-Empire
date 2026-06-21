import { 
  useListStaff, 
  useListAvailableStaff, 
  useHireStaff, 
  useFireStaff,
  getListStaffQueryKey,
  getListAvailableStaffQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  UserMinus, 
  UserPlus, 
  DollarSign, 
  ChevronDown, 
  ChevronUp,
  Briefcase,
  Star,
  Calendar,
  Sparkles
} from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const roleColors: Record<string, string> = {
  head_coach: "bg-blue-500",
  physiotherapist: "bg-green-500",
  assistant_coach: "bg-yellow-500",
  nutritionist: "bg-purple-500",
  strength_coach: "bg-red-500",
  scout: "bg-orange-500",
  physio: "bg-green-500",
  fitness_trainer: "bg-red-500",
  manager: "bg-slate-500",
};

const specialityColors: Record<string, string> = {
  "Technical":         "bg-purple-500/15 text-purple-700 border-purple-300",
  "Athletic":          "bg-blue-500/15   text-blue-700   border-blue-300",
  "Defensive":         "bg-green-500/15  text-green-700  border-green-300",
  "Conditioning":      "bg-orange-500/15 text-orange-700 border-orange-300",
  "Youth Development": "bg-pink-500/15   text-pink-700   border-pink-300",
  "General":           "bg-slate-500/15  text-slate-600  border-slate-300",
};

const specialityBonusLabel: Record<string, string> = {
  "Technical":         "+10% Serve & Block",
  "Athletic":          "+10% Speed & Power",
  "Defensive":         "+10% Defense",
  "Conditioning":      "+15% Recovery",
  "Youth Development": "+20% XP (under 21)",
  "General":           "No speciality bonus",
};

const personalityColors: Record<string, string> = {
  "Motivator":       "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  "Demanding":       "bg-red-500/15    text-red-700    border-red-300",
  "Player Friendly": "bg-teal-500/15   text-teal-700   border-teal-300",
  "Disciplinarian":  "bg-slate-500/15  text-slate-700  border-slate-300",
};

const personalityLabel: Record<string, string> = {
  "Motivator":       "+5% XP • +2 Morale",
  "Demanding":       "+15% XP • −2 Morale",
  "Player Friendly": "−10% XP • +3 Morale",
  "Disciplinarian":  "+8 Fatigue Recovery",
};

function OvrBadge({ rating }: { rating: number }) {
  const color =
    rating >= 85 ? "bg-yellow-400 text-yellow-900" :
    rating >= 75 ? "bg-blue-500 text-white" :
    rating >= 65 ? "bg-slate-500 text-white" :
                   "bg-slate-300 text-slate-700";
  return (
    <div className={cn("absolute top-2 right-10 flex flex-col items-center justify-center rounded w-9 h-9 font-black text-sm leading-none shadow", color)}>
      <span className="text-[8px] font-bold opacity-70 uppercase">OVR</span>
      <span>{rating}</span>
    </div>
  );
}

export default function StaffManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);

  const { data: myStaff, isLoading: staffLoading } = useListStaff({
    query: { queryKey: getListStaffQueryKey() }
  });
  const { data: availableStaff, isLoading: availableLoading } = useListAvailableStaff({
    query: { queryKey: getListAvailableStaffQueryKey() }
  });

  const hireMutation = useHireStaff();
  const fireMutation = useFireStaff();

  const handleHire = (staffId: number) => {
    hireMutation.mutate({ data: { staffId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAvailableStaffQueryKey() });
        toast({ title: "Staff Hired!", description: "A new specialist has joined your team." });
      }
    });
  };

  const handleFire = (staffId: number) => {
    fireMutation.mutate({ id: staffId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAvailableStaffQueryKey() });
        toast({ title: "Staff Terminated", description: "The position is now vacant." });
      }
    });
  };

  if (staffLoading) {
    return <div className="space-y-8"><Skeleton className="h-10 w-48" /><div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div></div>;
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const StaffCard = ({ member, isOwned }: { member: any; isOwned: boolean }) => (
    <Card className={cn("overflow-hidden", isOwned ? "" : "border-dashed group hover-elevate")}>
      <div className="relative h-64 overflow-hidden">
        <img
          src={member.imageUrl ?? undefined}
          alt={member.name}
          className="w-full h-full object-cover object-[center_20%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute top-2 left-2">
          <Badge className={cn("text-white text-[10px]", roleColors[member.role] ?? "bg-slate-500")}>
            {member.role.replace(/_/g, " ").toUpperCase()}
          </Badge>
        </div>

        <OvrBadge rating={member.overallRating} />

        {isOwned && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 bg-black/40 hover:bg-black/60 text-white">
                <UserMinus className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Fire {member.name}?</AlertDialogTitle>
                <AlertDialogDescription>Are you sure? This will leave the {member.role} position empty.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleFire(member.id)} className="bg-destructive text-destructive-foreground">Fire Staff</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="font-bold text-base text-white drop-shadow leading-tight">{member.name}</div>
          <div className="text-xs text-white/70">{member.specialty}</div>
        </div>
      </div>

      <CardContent className="p-4 pt-0 space-y-3 mt-3">
        {/* Speciality + Personality badges */}
        <div className="flex flex-wrap gap-1.5">
          {member.coachSpeciality && member.coachSpeciality !== "General" && (
            <Badge variant="outline" className={cn("text-[10px] font-semibold border", specialityColors[member.coachSpeciality])}>
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              {member.coachSpeciality}
            </Badge>
          )}
          {member.personality && (
            <Badge variant="outline" className={cn("text-[10px] border", personalityColors[member.personality] ?? "")}>
              {member.personality}
            </Badge>
          )}
        </div>

        {/* Bonus description */}
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{specialityBonusLabel[member.coachSpeciality] ?? "—"}</span>
          {member.personality && personalityLabel[member.personality] && (
            <span> · {personalityLabel[member.personality]}</span>
          )}
        </div>

        {/* Skill level bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" /> Skill Level</span>
            <span>{member.skillLevel}%</span>
          </div>
          <Progress value={member.skillLevel} className="h-1.5" />
        </div>

        {/* Age + contract + salary row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Age {member.age} · {member.contractLength}mo
          </span>
          <span className="flex items-center gap-1 font-bold text-primary text-sm">
            <DollarSign className="h-3.5 w-3.5" /> {formatCurrency(member.salary)}/mo
          </span>
        </div>

        {!isOwned && (
          <Button
            className="w-full gap-2"
            onClick={() => handleHire(member.id)}
            disabled={hireMutation.isPending}
          >
            <UserPlus className="h-4 w-4" /> Hire specialist
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Staff Management</h2>
        <p className="text-muted-foreground">Build a world-class support team for your athletes.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {myStaff?.map((member) => (
          <StaffCard key={member.id} member={member} isOwned={true} />
        ))}
      </div>

      <Collapsible open={isBrowseOpen} onOpenChange={setIsBrowseOpen} className="space-y-4">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full gap-2 justify-between">
            <span className="flex items-center gap-2 font-bold"><Briefcase className="h-4 w-4" /> BROWSE AVAILABLE STAFF</span>
            {isBrowseOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availableLoading ? <Skeleton className="h-64 w-full" /> :
              availableStaff?.map((member) => (
                <StaffCard key={member.id} member={member} isOwned={false} />
              ))
            }
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
