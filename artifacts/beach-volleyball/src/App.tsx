import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LightboxProvider } from "@/components/image-lightbox";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Shell } from "@/components/layout/shell";

// Pages
import Dashboard        from "@/pages/dashboard";
import PlayerMarket     from "@/pages/players";
import Matches          from "@/pages/matches";
import ThreeDCourt      from "@/pages/court";
import Finances         from "@/pages/finances";
import NewCareer        from "@/pages/new-career";
import ProfilePicker    from "@/pages/profile-picker";
import DevGenerationTest from "@/pages/dev-generation-test";
import NotFound         from "@/pages/not-found";

// Hub pages
import TeamHub          from "@/pages/team-hub";
import StaffHub         from "@/pages/staff-hub";
import WorldTourHub     from "@/pages/world-tour";
import ContinentalHub   from "@/pages/continental";
import OlympicsHub      from "@/pages/olympics";
import YouthLeagueHub   from "@/pages/youth-league";
import ClubHub          from "@/pages/club-hub";
import CareerHub        from "@/pages/career-hub";

// Leaf pages kept for backward-compatible direct URLs
import TeamRoster         from "@/pages/team";
import Training           from "@/pages/training";
import Contracts          from "@/pages/contracts";
import StaffManagement    from "@/pages/staff";
import StaffMarket        from "@/pages/staff-market";
import MedicalCentre      from "@/pages/medical";
import TrophyCabinet      from "@/pages/trophy-cabinet";
import Facilities         from "@/pages/facilities";
import Wellbeing          from "@/pages/wellbeing";
import YouthAcademy       from "@/pages/youth-academy";
import Achievements       from "@/pages/achievements";
import YouthResults       from "@/pages/youth-results";
import ContinentalScouting from "@/pages/continental-scouting";
import MedicalMarket      from "@/pages/medical-market";
import CareerManagement   from "@/pages/career-management";
import ManagerProfile     from "@/pages/profile";
import ManagerContract    from "@/pages/manager-contract";
import JobMarket          from "@/pages/job-market";
import CareerHistory      from "@/pages/career-history";
import LeagueLadders      from "@/pages/league-ladders";
import Leaderboard        from "@/pages/leaderboard";
import WorldTourLocations from "@/pages/locations";
import Rules from "@/pages/rules";

// Competition pages — Continental
import RegionalOverview    from "@/pages/competition/regional-overview";
import RegionalFixtures    from "@/pages/competition/regional-fixtures";
import RegionalResults     from "@/pages/competition/regional-results";
import RegionalLadders     from "@/pages/competition/regional-ladders";
import ContinentalPools    from "@/pages/competition/continental-pools";
import PromotionRelegation from "@/pages/competition/promotion-relegation";
import RegionalHistory     from "@/pages/competition/regional-history";

// Competition pages — World Tour
import QualifiedTeams from "@/pages/competition/qualified-teams";
import WtFixtures     from "@/pages/competition/wt-fixtures";
import WtResults      from "@/pages/competition/wt-results";
import WtLadder       from "@/pages/competition/wt-ladder";
import WorldFinals    from "@/pages/competition/world-finals";
import AllStar        from "@/pages/competition/all-star";
import WtHistory      from "@/pages/competition/wt-history";

import AnnualCalendar from "@/pages/annual-calendar";

// Competition pages — Olympics
import NationalSquads   from "@/pages/competition/national-squads";
import OlympicSchedule  from "@/pages/competition/olympic-schedule";
import OlympicResults   from "@/pages/competition/olympic-results";
import MedalTable       from "@/pages/competition/medal-table";
import OlympicHistory   from "@/pages/competition/olympic-history";

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
    window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/dev/generation-test" component={DevGenerationTest} />
      <Route path="/login" component={ProfilePicker} />
      <Route path="/new-career" component={NewCareer} />
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
              {/* ── Primary hub routes (sidebar links) ── */}
              <Route path="/"            component={Dashboard}    />
              <Route path="/team"        component={TeamHub}      />
              <Route path="/players"     component={PlayerMarket} />
              <Route path="/staff"       component={StaffHub}     />
              <Route path="/world-tour"  component={WorldTourHub} />
              <Route path="/continental" component={ContinentalHub} />
              <Route path="/olympics"    component={OlympicsHub}  />
              <Route path="/youth-league" component={YouthLeagueHub} />
              <Route path="/club"        component={ClubHub}      />
              <Route path="/finances"    component={Finances}     />
              <Route path="/career"      component={CareerHub}    />

              {/* ── Backward-compatible leaf routes ── */}
              <Route path="/matches"            component={Matches}           />
              <Route path="/training"           component={Training}          />
        <Route path="/rules"               component={Rules}              />
              <Route path="/contracts"          component={Contracts}         />
              <Route path="/staff-market"       component={StaffMarket}       />
              <Route path="/medical"            component={MedicalCentre}     />
              <Route path="/leaderboard"        component={Leaderboard}       />
              <Route path="/locations"          component={WorldTourLocations}/>
              <Route path="/trophy-cabinet"     component={TrophyCabinet}     />
              <Route path="/facilities"         component={Facilities}        />
              <Route path="/wellbeing"          component={Wellbeing}         />
              <Route path="/youth-academy"      component={YouthAcademy}      />
              <Route path="/youth-results"      component={YouthResults}      />
              <Route path="/continental-scouting" component={ContinentalScouting} />
              <Route path="/achievements"       component={Achievements}      />
              <Route path="/medical-market"     component={MedicalMarket}     />
              <Route path="/career-management"  component={CareerManagement}  />
              <Route path="/profile"            component={ManagerProfile}    />
              <Route path="/manager-contract"   component={ManagerContract}   />
              <Route path="/job-market"         component={JobMarket}         />
              <Route path="/career-history"     component={CareerHistory}     />
              <Route path="/league-ladders"     component={LeagueLadders}     />

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

              <Route path="/annual-calendar" component={AnnualCalendar} />

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
        <LightboxProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </LightboxProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
