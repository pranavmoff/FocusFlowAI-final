import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Brain, LayoutDashboard, PenLine, Sparkles, MessageSquare, Target, LogOut, Sun, Moon,
  Dna, BookOpen, Gift, FlaskConical, GitBranch, Repeat, Heart, ListChecks, CalendarDays, User,
  Menu, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/use-theme";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/log", label: "Log activity", icon: PenLine },
  { to: "/habits", label: "Habits", icon: Repeat },
  { to: "/emotions", label: "Emotions", icon: Heart },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/calendar", label: "My Calendar", icon: CalendarDays },
  { to: "/dna", label: "DNA", icon: Dna },
  { to: "/story", label: "Life Story", icon: BookOpen },
  { to: "/wrapped", label: "Wrapped", icon: Gift },
  { to: "/timeline", label: "Growth Timeline", icon: GitBranch },
  { to: "/simulator", label: "AI Simulator", icon: FlaskConical },
  { to: "/insights", label: "Reports", icon: Sparkles },
  { to: "/coach", label: "AI Coach", icon: MessageSquare },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/settings", label: "My Profile", icon: User },
] as const;

function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface/40 text-muted-foreground transition hover:text-foreground ${className}`}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NavList({ pathname, onNavigate, signOut }: { pathname: string; onNavigate?: () => void; signOut: () => void }) {
  return (
    <>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to} to={to} onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-3 flex items-center gap-2 pt-2">
        <ThemeToggle />
        <button onClick={signOut} className="flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Lock body scroll while drawer open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border/60 bg-sidebar/60 backdrop-blur md:block md:sticky md:top-0 md:h-screen">
        <div className="flex h-full flex-col">
          <Link to="/dashboard" className="m-4 mb-2 flex items-center gap-2 px-2 py-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold leading-tight">FocusFlow</p>
              <p className="text-[10px] uppercase tracking-widest text-primary">AI</p>
            </div>
          </Link>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            <NavList pathname={pathname} signOut={signOut} />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface/40 text-muted-foreground transition hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-primary"><Brain className="h-4 w-4 text-primary-foreground" /></div>
            <span className="truncate font-display font-semibold">FocusFlow</span>
          </Link>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${drawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}>
        {/* Backdrop */}
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
        />
        {/* Panel */}
        <aside
          role="dialog" aria-modal="true" aria-label="Navigation"
          className={`absolute inset-y-0 left-0 flex w-[85vw] max-w-[320px] flex-col border-r border-border/60 bg-sidebar shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <Link to="/dashboard" onClick={() => setDrawerOpen(false)} className="flex min-w-0 items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold leading-tight">FocusFlow</p>
                <p className="text-[10px] uppercase tracking-widest text-primary">AI</p>
              </div>
            </Link>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/60 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-4" style={{ WebkitOverflowScrolling: "touch" }}>
            <NavList pathname={pathname} onNavigate={() => setDrawerOpen(false)} signOut={signOut} />
          </div>
        </aside>
      </div>

      <main className="min-w-0 px-4 py-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
