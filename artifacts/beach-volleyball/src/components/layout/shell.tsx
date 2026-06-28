import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Trophy,
  Activity,
  FileText,
  UserCog,
  DollarSign,
  Medal,
  LogOut,
  ChevronRight,
  ChevronDown,
  Menu,
  Box,
  Heart,
  Briefcase,
  Building2,
  Sparkles,
  Globe,
  Crown,
  Star,
  Flame,
  Monitor,
  Radar,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useGetCurrentAuthUser,
  getGetCurrentAuthUserQueryKey,
  useGetOlympicSelection,
  getGetOlympicSelectionQueryKey,
  useGetAchievements,
  getGetAchievementsQueryKey,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

// ── Nav data ─────────────────────────────────────────────────────────────────

type NavSubItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  neverActive?: boolean;
};

type DirectGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  items?: never;
};

type ExpandableGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: never;
  items: NavSubItem[];
};

type NavGroup = DirectGroup | ExpandableGroup;

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    id: "team",
    label: "Team",
    icon: Users,
    items: [
      { href: "/team",           label: "Team & Roster",   icon: Users    },
      { href: "/youth-academy",  label: "Youth Academy",   icon: Star     },
      { href: "/training",       label: "Training",         icon: Activity },
      { href: "/medical",        label: "Medical Centre",   icon: Heart    },
      { href: "/medical-market", label: "Medical Market",   icon: Heart    },
      { href: "/contracts",      label: "Contracts",        icon: FileText },
    ],
  },
  {
    id: "recruitment",
    label: "Recruitment",
    icon: UserPlus,
    items: [
      { href: "/players",               label: "Player Market",       icon: UserPlus },
      { href: "/draft",                 label: "Player Draft",        icon: Box      },
      { href: "/staff",                 label: "My Staff",            icon: UserCog  },
      { href: "/staff-market",          label: "Staff Market",        icon: UserCog  },
      { href: "/continental-scouting",  label: "Continental Scouting", icon: Radar   },
    ],
  },
  {
    id: "competition",
    label: "Competition",
    icon: Trophy,
    items: [
      { href: "/youth-results", label: "Youth Results", icon: Star    },
      { href: "/matches",       label: "World Tour",    icon: Globe   },
      { href: "/locations",     label: "Olympics",      icon: Medal   },
    ],
  },
  {
    id: "club",
    label: "Club",
    icon: Building2,
    items: [
      { href: "/finances",       label: "Finances",        icon: DollarSign             },
      { href: "/facilities",     label: "Facilities",      icon: Building2              },
      { href: "/wellbeing",      label: "Wellbeing Camps", icon: Sparkles               },
      { href: "/trophy-cabinet", label: "Trophy Cabinet",  icon: Trophy                 },
      { href: "/trophy-cabinet", label: "Hall of Fame",    icon: Crown, neverActive: true },
    ],
  },
  {
    id: "matchday",
    label: "Match Day",
    icon: Monitor,
    items: [
      { href: "/court", label: "3D Court", icon: Monitor },
    ],
  },
  {
    id: "career",
    label: "Career",
    icon: FolderOpen,
    items: [
      { href: "/profile",          label: "Manager Profile", icon: UserCog  },
      { href: "/manager-contract", label: "Contract",        icon: FileText },
      { href: "/job-market",       label: "Job Market",      icon: Briefcase },
      { href: "/career-history",   label: "Career History",  icon: Activity  },
      { href: "/achievements",     label: "Achievements",    icon: Star      },
      { href: "/trophy-cabinet",   label: "Manager Records", icon: Flame, neverActive: true },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupContainsLocation(group: NavGroup, loc: string): boolean {
  if (group.href) return loc === group.href;
  return group.items?.some(item => loc === item.href) ?? false;
}

function findActiveGroupId(loc: string): string | null {
  return NAV_GROUPS.find(g => groupContainsLocation(g, loc))?.id ?? null;
}

// ── Sidebar component ─────────────────────────────────────────────────────────

export function Sidebar() {
  const [location] = useLocation();

  const { data: user } = useGetCurrentAuthUser({
    query: { queryKey: getGetCurrentAuthUserQueryKey() },
  });
  const { data: selection } = useGetOlympicSelection({
    query: { queryKey: getGetOlympicSelectionQueryKey(), retry: false },
  });

  const logout = () => { window.location.href = "/api/logout"; };
  const [mobileOpen, setMobileOpen] = useState(false);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = findActiveGroupId(location);
    return active ? new Set([active]) : new Set();
  });

  useEffect(() => {
    const active = findActiveGroupId(location);
    if (active) {
      setOpenGroups(prev => {
        if (prev.has(active)) return prev;
        return new Set([...prev, active]);
      });
    }
  }, [location]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const NavContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-hidden">

      {/* ── Logo ── */}
      <div className="px-5 py-5 pb-3 shrink-0">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5 text-sidebar-primary shrink-0" />
          <span className="truncate">
            BEACH VOLLEY <span className="text-sidebar-primary">PRO</span>
          </span>
        </h1>
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 px-3 pb-2 overflow-y-auto min-h-0">
        <div className="space-y-0.5">
          {NAV_GROUPS.map(group => {
            const GroupIcon = group.icon;
            const isGroupActive = groupContainsLocation(group, location);
            const isOpen = openGroups.has(group.id);

            // ── Direct link (Dashboard) ──
            if (group.href) {
              return (
                <Link
                  key={group.id}
                  href={group.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full",
                    isGroupActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  )}
                  data-testid="link-dashboard"
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  {group.label}
                  {isGroupActive && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
                </Link>
              );
            }

            // ── Expandable group ──
            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full text-left",
                    isGroupActive
                      ? "text-sidebar-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                  )}
                >
                  <GroupIcon className={cn(
                    "h-4 w-4 shrink-0",
                    isGroupActive ? "text-sidebar-primary" : "",
                  )} />
                  <span className="flex-1 min-w-0 truncate">{group.label}</span>
                  <ChevronDown className={cn(
                    "h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200",
                    isOpen ? "rotate-180" : "",
                  )} />
                </button>

                {/* Sub-items */}
                {isOpen && (
                  <div className="mt-0.5 ml-4 pl-3 border-l border-sidebar-border/60 space-y-0.5 pb-1">
                    {group.items!.map(item => {
                      const ItemIcon = item.icon;
                      const isItemActive = !item.neverActive && location === item.href;
                      return (
                        <Link
                          key={`${item.href}::${item.label}`}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                            isItemActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                          )}
                          data-testid={`link-${item.label.toLowerCase().replace(/[\s&]+/g, "-")}`}
                        >
                          <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {isItemActive && <ChevronRight className="ml-auto h-3 w-3 opacity-50 shrink-0" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── Role blocks ── */}
      <div className="px-3 pt-3 pb-2 border-t border-sidebar-border shrink-0 space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-sidebar-accent/30">
          <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none">Club Manager</p>
            <p className="text-xs font-semibold truncate leading-tight mt-0.5">{user?.username ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-blue-500/5 border border-blue-500/10">
          <div className="h-6 w-6 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0">
            <Medal className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/70 leading-none">National Coach</p>
            {selection ? (
              <p className="text-xs font-semibold truncate leading-tight mt-0.5">{selection.flag} {selection.country}</p>
            ) : (
              <p className="text-xs text-sidebar-foreground/30 italic leading-tight mt-0.5">Unassigned</p>
            )}
          </div>
        </div>
      </div>

      {/* ── User + logout ── */}
      <div className="px-3 pb-4 pt-2 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-8 w-8 border border-sidebar-border shrink-0">
            <AvatarImage src={user?.profileImage ?? undefined} />
            <AvatarFallback>{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-sidebar text-sidebar-foreground sticky top-0 z-50 border-b border-sidebar-border">
        <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5 text-sidebar-primary" />
          <span>BVP</span>
        </h1>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 h-screen sticky top-0 border-r border-sidebar-border overflow-hidden shrink-0">
        <NavContent />
      </aside>
    </>
  );
}

function AchievementWatcher() {
  const { toast } = useToast();
  const { data: achievements } = useGetAchievements({
    query: {
      queryKey: getGetAchievementsQueryKey(),
      refetchInterval: false,
    },
  });

  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!achievements) return;
    const currentUnlocked = new Set(
      achievements.filter((a) => a.unlocked).map((a) => a.key),
    );
    if (seenRef.current === null) {
      seenRef.current = currentUnlocked;
      return;
    }
    const newlyUnlocked = [...currentUnlocked].filter(
      (k) => !seenRef.current!.has(k),
    );
    for (const key of newlyUnlocked) {
      const def = achievements.find((a) => a.key === key);
      if (def) {
        toast({
          title: "🏆 Achievement Unlocked!",
          description: `${def.name} — ${def.description}`,
          duration: 5000,
        });
      }
    }
    seenRef.current = currentUnlocked;
  }, [achievements, toast]);

  return null;
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background">
      <AchievementWatcher />
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto min-w-0">
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
