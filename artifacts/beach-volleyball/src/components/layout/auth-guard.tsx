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
import { Activity, Loader2, Play, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TEAM_NAME_SUGGESTIONS = [
  "Sunset Spikers",
  "Tide Breakers",
  "Sandy Aces",
  "Wave Riders",
  "Coral Crush",
  "Shoreline Sirens",
  "Dune Destroyers",
  "Pacific Blaze",
  "Golden Coast FC",
  "Horizon Hitters",
];

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
    const loginUrl = `/api/login?returnTo=${encodeURIComponent(window.location.origin + import.meta.env.BASE_URL)}`;
    return (
      <div className="relative h-screen w-full overflow-hidden bg-black">
        {/* Hero image */}
        <img
          src={`${import.meta.env.BASE_URL}title-hero.png`}
          alt="Beach Volleyball Pro"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Dark vignette overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />

        {/* Top logo bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <Activity className="h-7 w-7 text-secondary" />
            <span className="text-white/80 font-bold text-sm uppercase tracking-widest">Beach Volley Pro</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">Season 2026</span>
          </div>
        </div>

        {/* Main content — bottom-left anchor */}
        <div className="absolute bottom-0 left-0 right-0 px-8 md:px-16 pb-16 md:pb-20">
          <div className="max-w-2xl">
            {/* Tag line */}
            <div className="mb-3 inline-flex items-center gap-2 bg-secondary/90 backdrop-blur px-3 py-1 rounded-full">
              <span className="text-white text-xs font-black uppercase tracking-widest">All-Women World Tour</span>
            </div>

            {/* Title */}
            <h1 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tight drop-shadow-2xl">
              BEACH
              <br />
              <span className="text-secondary drop-shadow-[0_0_30px_rgba(244,162,97,0.6)]">VOLLEY</span>
              <br />
              PRO
            </h1>

            <p className="mt-4 text-white/60 text-base md:text-lg max-w-md leading-relaxed">
              Build your dream team. Conquer 11 cities across 9 countries.
              Claim the world championship.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="group relative overflow-hidden bg-secondary hover:bg-secondary/90 text-white font-black text-lg px-10 py-6 rounded-xl shadow-[0_0_30px_rgba(244,162,97,0.4)] hover:shadow-[0_0_40px_rgba(244,162,97,0.6)] transition-all"
                onClick={() => window.location.href = loginUrl}
                data-testid="button-signin"
              >
                <Play className="mr-2 h-5 w-5 fill-white" />
                START NEW GAME
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="group border-white/30 bg-white/10 backdrop-blur hover:bg-white/20 text-white font-bold text-lg px-10 py-6 rounded-xl transition-all"
                onClick={() => window.location.href = loginUrl}
                data-testid="button-continue"
              >
                CONTINUE
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            {/* Footer hint */}
            <p className="mt-6 text-white/30 text-xs">
              Sign in with your Replit account to save your progress across sessions.
            </p>
          </div>
        </div>

        {/* Right side — decorative stat pills (visible on wider screens) */}
        <div className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 flex-col gap-3">
          {[
            { label: "World Tour Stops", value: "11" },
            { label: "Countries", value: "9" },
            { label: "Grand Final Prize", value: "$50k" },
          ].map((s) => (
            <div key={s.label} className="bg-black/50 backdrop-blur border border-white/10 rounded-xl px-5 py-3 text-right">
              <div className="text-white font-black text-2xl">{s.value}</div>
              <div className="text-white/40 text-xs uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
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
                      <div className="space-y-2">
                        <Select onValueChange={(val) => field.onChange(val)} data-testid="select-team-name-preset">
                          <SelectTrigger className="text-muted-foreground">
                            <SelectValue placeholder="Pick a name…" />
                          </SelectTrigger>
                          <SelectContent>
                            {TEAM_NAME_SUGGESTIONS.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="flex-1 h-px bg-border" />
                          <span>or type your own</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <FormControl>
                          <Input placeholder="e.g. Tropical Spikes" {...field} data-testid="input-team-name" />
                        </FormControl>
                      </div>
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
