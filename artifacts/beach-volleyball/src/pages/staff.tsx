import { 
  useListStaff, 
  useListAvailableStaff, 
  useHireStaff, 
  useFireStaff,
  getListStaffQueryKey,
  getListAvailableStaffQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  UserMinus, 
  UserPlus, 
  Star, 
  DollarSign, 
  ChevronDown, 
  ChevronUp,
  Briefcase
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

const roleColors: Record<string, string> = {
  head_coach: "bg-blue-500",
  physiotherapist: "bg-green-500",
  assistant_coach: "bg-yellow-500",
  nutritionist: "bg-purple-500",
  strength_coach: "bg-red-500",
  scout: "bg-orange-500",
};

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
    return <div className="space-y-8"><Skeleton className="h-10 w-48" /><div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div></div>;
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Staff Management</h2>
        <p className="text-muted-foreground">Build a world-class support team for your athletes.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {myStaff?.map((member) => (
          <Card key={member.id} className="overflow-hidden" style={{ borderTop: `4px solid` }}>
            <div className="relative h-40 overflow-hidden">
              <img
                src={member.imageUrl ?? undefined}
                alt={member.name}
                className="w-full h-full object-cover object-[center_20%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                <Badge className={cn("text-white text-[10px]", roleColors[member.role])}>{member.role.replace('_', ' ').toUpperCase()}</Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/40 hover:bg-black/60 text-white">
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
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="font-bold text-base text-white drop-shadow leading-tight">{member.name}</div>
                <div className="text-xs text-white/70">{member.specialty}</div>
              </div>
            </div>
            <CardHeader className="p-4 pb-2 hidden" />
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Skill Level</span>
                  <span>{member.skillLevel}%</span>
                </div>
                <Progress value={member.skillLevel} className="h-1.5" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 font-bold text-primary">
                  <DollarSign className="h-4 w-4" /> {formatCurrency(member.salary)}/mo
                </div>
              </div>
            </CardContent>
          </Card>
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
            {availableLoading ? <Skeleton className="h-48 w-full" /> : 
              availableStaff?.map((member) => (
                <Card key={member.id} className="group overflow-hidden hover-elevate border-dashed">
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={member.imageUrl ?? undefined}
                      alt={member.name}
                      className="w-full h-full object-cover object-[center_20%]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <Badge variant="outline" className={cn("border-2 text-[10px] bg-black/40 text-white", roleColors[member.role].replace('bg-', 'border-'))}>{member.role.replace('_', ' ').toUpperCase()}</Badge>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="font-bold text-sm text-white drop-shadow">{member.name}</div>
                      <div className="text-xs text-white/70">{member.specialty}</div>
                    </div>
                  </div>
                  <CardContent className="p-4 pt-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Skill: <span className="text-foreground font-bold">{member.skillLevel}%</span></div>
                      <div className="text-sm font-black text-primary">${member.salary.toLocaleString()}</div>
                    </div>
                    <Button 
                      className="w-full gap-2" 
                      onClick={() => handleHire(member.id)}
                      disabled={hireMutation.isPending}
                    >
                      <UserPlus className="h-4 w-4" /> Hire specialist
                    </Button>
                  </CardContent>
                </Card>
              ))
            }
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
