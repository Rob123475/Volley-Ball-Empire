import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Shell } from "@/components/layout/shell";

// Pages
import Dashboard from "@/pages/dashboard";
import TeamRoster from "@/pages/team";
import PlayerMarket from "@/pages/players";
import PlayerDraft from "@/pages/draft";
import Matches from "@/pages/matches";
import ThreeDCourt from "@/pages/court";
import Training from "@/pages/training";
import Contracts from "@/pages/contracts";
import StaffManagement from "@/pages/staff";
import Finances from "@/pages/finances";
import Leaderboard from "@/pages/leaderboard";
import WorldTourLocations from "@/pages/locations";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <AuthGuard>
      <Shell>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/team" component={TeamRoster} />
          <Route path="/players" component={PlayerMarket} />
          <Route path="/draft" component={PlayerDraft} />
          <Route path="/matches" component={Matches} />
          <Route path="/court" component={ThreeDCourt} />
          <Route path="/training" component={Training} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/staff" component={StaffManagement} />
          <Route path="/finances" component={Finances} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/locations" component={WorldTourLocations} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </AuthGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
