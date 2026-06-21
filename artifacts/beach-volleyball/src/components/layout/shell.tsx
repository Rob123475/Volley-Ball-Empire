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
  Menu,
  Box,
  Heart,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useGetCurrentAuthUser,
  getGetCurrentAuthUserQueryKey,
  useGetOlympicSelection,
  getGetOlympicSelectionQueryKey,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const clubManagerItems = [
  { href: "/",           label: "Dashboard",     icon: LayoutDashboard },
  { href: "/team",       label: "Team & Roster",  icon: Users           },
  { href: "/players",    label: "Player Market",  icon: UserPlus        },
  { href: "/draft",      label: "Player Draft",   icon: Box             },
  { href: "/matches",    label: "Matches",        icon: Trophy          },
  { href: "/court",      label: "3D Court",       icon: Activity        },
  { href: "/training",   label: "Training",       icon: Activity        },
  { href: "/contracts",  label: "Contracts",      icon: FileText        },
  { href: "/staff",      label: "Staff",          icon: UserCog         },
  { href: "/medical",    label: "Medical Centre", icon: Heart           },
  { href: "/finances",   label: "Finances",       icon: DollarSign      },
  { href: "/leaderboard",label: "Leaderboard",    icon: Trophy          },
];

const nationalCoachItems = [
  { href: "/locations",  label: "Olympics",       icon: Medal           },
];

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useGetCurrentAuthUser({
    query: { queryKey: getGetCurrentAuthUserQueryKey() }
  });
  const { data: selection } = useGetOlympicSelection({
    query: { queryKey: getGetOlympicSelectionQueryKey(), retry: false }
  });
  const logout = () => { window.location.href = "/api/logout"; };
  const [isOpen, setIsOpen] = useState(false);

  const NavSection = ({
    label,
    icon: SectionIcon,
    items,
    accent,
  }: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    items: typeof clubManagerItems;
    accent?: boolean;
  }) => (
    <div className="mb-2">
      <div className={cn(
        "flex items-center gap-1.5 px-3 mb-1 mt-3",
      )}>
        <SectionIcon className={cn("h-3 w-3", accent ? "text-blue-400" : "text-sidebar-foreground/40")} />
        <span className={cn(
          "text-[9px] font-black uppercase tracking-widest",
          accent ? "text-blue-400" : "text-sidebar-foreground/40"
        )}>{label}</span>
      </div>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            location === item.href
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground"
          )}
          data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          {location === item.href && <ChevronRight className="ml-auto h-4 w-4" />}
        </Link>
      ))}
    </div>
  );

  const NavContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-6 pb-2">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-sidebar-primary" />
          <span>BEACH VOLLEY <span className="text-sidebar-primary">PRO</span></span>
        </h1>
      </div>

      <nav className="flex-1 px-4 overflow-y-auto">
        <NavSection label="Club Manager" icon={Briefcase} items={clubManagerItems} />
        <NavSection label="National Team Coach" icon={Medal} items={nationalCoachItems} accent />
      </nav>

      {/* ── Dual-role identity strip ── */}
      <div className="px-4 pt-3 pb-2 border-t border-sidebar-border space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-sidebar-accent/30">
          <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-sidebar-foreground/40 leading-none">Club Manager</p>
            <p className="text-xs font-semibold truncate leading-tight mt-0.5">{user?.username ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-blue-500/5 border border-blue-500/10">
          <div className="h-6 w-6 rounded-md bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <Medal className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/70 leading-none">National Coach</p>
            {selection ? (
              <p className="text-xs font-semibold truncate leading-tight mt-0.5">
                {selection.flag} {selection.country}
              </p>
            ) : (
              <p className="text-xs text-sidebar-foreground/30 italic leading-tight mt-0.5">Unassigned</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-8 w-8 border border-sidebar-border">
            <AvatarImage src={user?.profileImage ?? undefined} />
            <AvatarFallback>{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 mt-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={() => logout()}
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
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground sticky top-0 z-50">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5 text-sidebar-primary" />
          <span>BVP</span>
        </h1>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 overflow-hidden border-r border-sidebar-border">
        <NavContent />
      </aside>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
