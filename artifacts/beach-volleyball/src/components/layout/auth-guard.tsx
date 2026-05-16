import { 
  useGetCurrentAuthUser, 
  useGetMyTeam, 
  useCreateTeam, 
  useListLocations,
  useCreateProfile,
  getGetMyTeamQueryKey,
  getGetCurrentAuthUserQueryKey,
  getGetProfileQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const teamSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters"),
  locationId: z.coerce.number().min(1, "Select a home location"),
});

type TeamFormValues = {
  name: string;
  locationId: string;
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user, isLoading: authLoading } = useGetCurrentAuthUser({
    query: {
      queryKey: getGetCurrentAuthUserQueryKey(),
    }
  });

  const { data: team, isLoading: teamLoading, isError: noTeam } = useGetMyTeam({
    query: {
      enabled: !!user,
      queryKey: getGetMyTeamQueryKey(),
      retry: false,
    }
  });

  const showOnboarding = !!user && (!team && noTeam);
  const { data: locations } = useListLocations({
    query: {
      enabled: showOnboarding,
      queryKey: ["locations"],
    }
  });

  const createTeamMutation = useCreateTeam();
  const createProfileMutation = useCreateProfile();

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      locationId: "",
    },
  });

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="mb-8 flex flex-col items-center gap-4 animate-in zoom-in duration-500">
          <Activity className="h-20 w-20 text-primary" />
          <h1 className="text-5xl font-extrabold tracking-tight text-primary">
            BEACH VOLLEY <span className="text-secondary">PRO</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-md">
            Manage your all-women beach volleyball team to global glory in the ultimate sports simulation.
          </p>
        </div>
        <Button 
          size="lg" 
          className="px-12 py-6 text-xl font-bold shadow-lg hover:shadow-xl transition-all"
          onClick={() => window.location.href = `/api/login?returnTo=${window.location.origin}`}
          data-testid="button-signin"
        >
          START YOUR CAREER
        </Button>
      </div>
    );
  }

  if (teamLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (noTeam || !team) {
    const onSubmit = (values: TeamFormValues) => {
      const data = { name: values.name, locationId: parseInt(values.locationId, 10) };
      createTeamMutation.mutate({ data }, {
        onSuccess: (newTeam) => {
          createProfileMutation.mutate({ data: { teamName: newTeam.name } }, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
              toast({ title: "Team Created!", description: `Welcome to the pro league, ${newTeam.name}!` });
            }
          });
        }
      });
    };

    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-primary/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary">Establish Your Team</CardTitle>
            <CardDescription>Every legend starts somewhere. Give your team a name and a home.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Tropical Spikes" {...field} data-testid="input-team-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Location</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-home-location">
                            <SelectValue placeholder="Select a home beach" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations?.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id.toString()}>
                              {loc.city}, {loc.country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createTeamMutation.isPending || createProfileMutation.isPending}
                  data-testid="button-create-team"
                >
                  {(createTeamMutation.isPending || createProfileMutation.isPending) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : "Create Team"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
