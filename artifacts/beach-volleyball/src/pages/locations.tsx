import { 
  useListLocations,
  getListLocationsQueryKey,
  useGetLocation
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  CloudSun, 
  Wind, 
  Umbrella, 
  Navigation,
  ExternalLink
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function WorldTourLocations() {
  const { data: locations, isLoading } = useListLocations({
    query: { queryKey: getListLocationsQueryKey() }
  });

  if (isLoading) {
    return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
    </div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Navigation className="h-8 w-8 text-secondary" />
          World Tour Locations
        </h2>
        <p className="text-muted-foreground">Explore the 10 premier beach volleyball destinations across the globe.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {locations?.map((location) => (
          <LocationCard key={location.id} location={location} />
        ))}
      </div>
    </div>
  );
}

function LocationCard({ location }: { location: any }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="overflow-hidden group hover:border-primary/50 transition-all cursor-pointer hover:shadow-2xl">
          <div className="h-48 bg-muted relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
            <img 
              src={`https://source.unsplash.com/featured/?beach,${location.city}`} 
              alt={location.city}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute bottom-4 left-4 z-20">
              <div className="text-white text-xs font-bold uppercase tracking-widest">{location.country}</div>
              <h3 className="text-white text-2xl font-black">{location.city}</h3>
            </div>
            <div className="absolute top-4 right-4 z-20">
              <Badge className="bg-white/20 backdrop-blur text-white border-white/30">{location.courtType}</Badge>
            </div>
          </div>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1 bg-primary/5 text-primary border-primary/10">
                <CloudSun className="h-3 w-3" /> {location.weatherPattern}
              </Badge>
              <Badge variant="secondary" className="gap-1 bg-secondary/5 text-secondary border-secondary/10">
                <Wind className="h-3 w-3" /> Windy
              </Badge>
              <Badge variant="secondary" className="gap-1 bg-accent/5 text-accent border-accent/10">
                <Umbrella className="h-3 w-3" /> Tropical
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{location.description}</p>
            <Button variant="ghost" className="w-full group-hover:bg-primary group-hover:text-white transition-colors" data-testid={`button-view-${location.id}`}>
              View Details <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black">{location.city}, {location.country}</DialogTitle>
          <DialogDescription>Full Location Dossier</DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-8 py-4">
          <div className="space-y-4">
            <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
              <img src={`https://source.unsplash.com/featured/?beach,volleyball,${location.city}`} className="w-full h-full object-cover" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Coordinates</div>
                <div className="font-mono text-xs">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Court Surface</div>
                <div className="font-bold text-primary">{location.courtType}</div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> About
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{location.description}</p>
            
            <div className="space-y-2 pt-4 border-t">
              <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Typical Conditions</h4>
              <div className="grid grid-cols-2 gap-2">
                <ConditionBadge icon={CloudSun} label="Weather" value={location.weatherPattern} />
                <ConditionBadge icon={Wind} label="Wind Speed" value="Moderate" />
                <ConditionBadge icon={Umbrella} label="Humidity" value="High" />
                <ConditionBadge icon={Navigation} label="Visibility" value="Perfect" />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConditionBadge({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <div className="text-[8px] font-bold text-muted-foreground uppercase">{label}</div>
        <div className="text-xs font-bold">{value}</div>
      </div>
    </div>
  );
}
