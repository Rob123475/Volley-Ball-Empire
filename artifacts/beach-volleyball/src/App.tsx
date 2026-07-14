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
import StaffMarket from "@/pages/staff-market";
import Finances from "@/pages/finances";
import Leaderboard from "@/pages/leaderboard";
import WorldTourLocations from "@/pages/locations";
import MedicalCentre from "@/pages/medical";
import TrophyCabinet from "@/pages/trophy-cabinet";
import Facilities from "@/pages/facilities";
import Wellbeing from "@/pages/wellbeing";
import YouthAcademy from "@/pages/youth-academy";
import Achievements from "@/pages/achievements";
import YouthResults from "@/pages/youth-results";
import ContinentalScouting from "@/pages/continental-scouting";
import MedicalMarket from "@/pages/medical-market";
import CareerManagement from "@/pages/career-management";
import ManagerProfile from "@/pages/profile";
import ManagerContract from "@/pages/manager-contract";
import JobMarket from "@/pages/job-market";
import CareerHistory from "@/pages/career-history";
import LeagueLadders from "@/pages/league-ladders";
import DevGenerationTest from "@/pages/dev-generation-test";
import NotFound from "@/pages/not-found";

// Competition pages — Continental
import RegionalOverview from "@/pages/competition/regional-overview";
import RegionalFixtures from "@/pages/competition/regional-fixtures";
import RegionalResults from "@/pages/competition/regional-results";
import RegionalLadders from "@/pages/competition/regional-ladders";
import ContinentalPools from "@/pages/competition/continental-pools";
import PromotionRelegation from "@/pages/competition/promotion-relegation";
import RegionalHistory from "@/pages/competition/regional-history";

// Competition pages — World Tour
import QualifiedTeams from "@/pages/competition/qualified-teams";
import WtFixtures from "@/pages/competition/wt-fixtures";
import WtResults from "@/pages/competition/wt-results";
import WtLadder from "@/pages/competition/wt-ladder";
import WorldFinals from "@/pages/competition/world-finals";
import AllStar from "@/pages/competition/all-star";
import WtHistory from "@/pages/competition/wt-history";

// Competition pages — Olympics
import NationalSquads from "@/pages/competition/national-squads";
import OlympicSchedule from "@/pages/competition/olympic-schedule";
import OlympicResults from "@/pages/competition/olympic-results";
import MedalTable from "@/pages/competition/medal-table";
import OlympicHistory from "@/pages/competition/olympic-history";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
  mutationCache: undefined,
});

// Redirect to login whenever any query or mutation gets a 401
queryClient.getQueryCache().subscribe((event) => {
  if (
    event.type === "updated" &&
    event.action.type === "error" &&
    (event.action.error as any)?.status === 401
  ) {
    window.location.href = `/api/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/dev/generation-test" component={DevGenerationTest} />
      {/* Court page rendered outside Shell — full viewport, no sidebar */}
      <Route path="/court">
        <AuthGuard>
          <div style={{ width: "100vw", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <ThreeDCourt />
          </div>
        </AuthGuard>
      </Route>
      <Route>
        <AuthGuard>
          <Shell>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/team" component={TeamRoster} />
              <Route path="/players" component={PlayerMarket} />
              <Route path="/draft" component={PlayerDraft} />
              <Route path="/matches" component={Matches} />
              <Route path="/training" component={Training} />
              <Route path="/contracts" component={Contracts} />
              <Route path="/staff" component={StaffManagement} />
              <Route path="/staff-market" component={StaffMarket} />
              <Route path="/medical" component={MedicalCentre} />
              <Route path="/finances" component={Finances} />
              <Route path="/leaderboard" component={Leaderboard} />
              <Route path="/locations" component={WorldTourLocations} />
              <Route path="/trophy-cabinet" component={TrophyCabinet} />
              <Route path="/facilities" component={Facilities} />
              <Route path="/wellbeing" component={Wellbeing} />
              <Route path="/youth-academy" component={YouthAcademy} />
              <Route path="/youth-results" component={YouthResults} />
              <Route path="/continental-scouting" component={ContinentalScouting} />
              <Route path="/achievements" component={Achievements} />
              <Route path="/medical-market" component={MedicalMarket} />
              <Route path="/career" component={CareerManagement} />
              <Route path="/profile" component={ManagerProfile} />
              <Route path="/manager-contract" component={ManagerContract} />
              <Route path="/job-market" component={JobMarket} />
              <Route path="/career-history" component={CareerHistory} />
              <Route path="/league-ladders" component={LeagueLadders} />
              {/* Competition — Continental */}
              <Route path="/competition/regional-overview"    component={RegionalOverview}    />
              <Route path="/competition/regional-fixtures"    component={RegionalFixtures}    />
              <Route path="/competition/regional-results"     component={RegionalResults}     />
              <Route path="/competition/regional-ladders"     component={RegionalLadders}     />
              <Route path="/competition/continental-pools"    component={ContinentalPools}    />
              <Route path="/competition/promotion-relegation" component={PromotionRelegation} />
              <Route path="/competition/regional-history"     component={RegionalHistory}     />
              {/* Competition — World Tour */}
              <Route path="/competition/qualified-teams"      component={QualifiedTeams}      />
              <Route path="/competition/wt-fixtures"          component={WtFixtures}          />
              <Route path="/competition/wt-results"           component={WtResults}           />
              <Route path="/competition/wt-ladder"            component={WtLadder}            />
              <Route path="/competition/world-finals"         component={WorldFinals}         />
              <Route path="/competition/all-star"             component={AllStar}             />
              <Route path="/competition/wt-history"           component={WtHistory}           />
              {/* Competition — Olympics */}
              <Route path="/competition/national-squads"      component={NationalSquads}      />
              <Route path="/competition/olympic-schedule"     component={OlympicSchedule}     />
              <Route path="/competition/olympic-results"      component={OlympicResults}      />
              <Route path="/competition/medal-table"          component={MedalTable}          />
              <Route path="/competition/olympic-history"      component={OlympicHistory}      />
              <Route component={NotFound} />
            </Switch>
          </Shell>
        </AuthGuard>
      </Route>
    </Switch>
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
