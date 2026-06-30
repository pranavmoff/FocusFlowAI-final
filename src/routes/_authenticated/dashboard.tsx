import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/activities.functions";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { Flame, Sparkles, Brain, Dumbbell, Heart, Tv, GraduationCap, Briefcase, Users, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard , FocusFlow AI" }] }),
  component: Dashboard,
});

function fmtH(min: number) {
  const h = min / 60;
  if (h < 1) return `${Math.round(min)}m`;
  return `${(+h.toFixed(1))}h`;
}

function Dashboard() {
  const fetchDash = useServerFn(getDashboardData);
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDash({}) });

  if (dash.isLoading) return <Skeleton />;
  if (dash.error) return <p className="text-destructive">Couldn't load dashboard.</p>;
  const d = dash.data!;
  const m = d.metrics;
  const hasData = d.rows.length > 0;

  // 14-day weekly trend , total productive hours per day
  const days: { date: string; learning: number; fitness: number; wellness: number; entertainment: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const ds = dt.toISOString().slice(0, 10);
    const rows = d.rows.filter(r => r.activity_date === ds);
    const by = (cat: string) => +(rows.filter(r => r.category === cat).reduce((a, r) => a + r.duration_minutes, 0) / 60).toFixed(2);
    days.push({
      date: ds.slice(5),
      learning: by("learning") + +(rows.filter(r => r.category === "work").reduce((a, r) => a + r.duration_minutes, 0) / 60).toFixed(2),
      fitness: by("fitness"),
      wellness: by("wellness"),
      entertainment: by("entertainment"),
    });
  }

  // monthly trend , last 4 weeks, total focus-flow approximation per week (sum of constructive hours)
  const weeks: { label: string; hours: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    const end = new Date(); end.setDate(end.getDate() - w * 7);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const rows = d.rows.filter(r => r.activity_date >= startStr && r.activity_date <= endStr);
    const hrs = rows
      .filter(r => ["learning", "work", "fitness", "wellness"].includes(r.category))
      .reduce((a, r) => a + r.duration_minutes, 0) / 60;
    weeks.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, hours: +hrs.toFixed(1) });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Your week</p>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
        </div>
        <Link to="/log" className="rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow">+ Add activity</Link>
      </div>

      {!hasData && (
        <div className="glass rounded-2xl p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-display text-xl">Your dashboard is waiting on data</p>
          <p className="mt-1 text-sm text-muted-foreground">Log your first activity to start seeing insights.</p>
          <Link to="/log" className="mt-5 inline-flex rounded-full bg-gradient-primary px-5 py-2 text-sm font-medium text-primary-foreground">Add an activity</Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* FocusFlow score hero */}
        <div className="glass-strong relative overflow-hidden rounded-3xl p-6">
          <div className="absolute inset-0 -z-10 bg-gradient-aurora opacity-50" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">FocusFlow Score</p>
          <p className="mt-2 font-display text-7xl font-semibold text-gradient">{m.focusFlowScore}</p>
          <p className="mt-1 text-xs text-muted-foreground">last 7 days · your blended focus + consistency + wellness signal</p>
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-surface/60 p-3">
            <Flame className="h-4 w-4 text-warning" />
            <p className="text-sm"><span className="font-semibold">{d.streak}</span> day productive streak</p>
          </div>
        </div>

        {/* Persona */}
        <div className="glass rounded-3xl p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Your persona</p>
          <p className="mt-2 font-display text-2xl text-gradient">{d.persona.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">{d.persona.reason}</p>
          <Link to="/insights" className="mt-5 inline-flex items-center gap-1 text-sm text-primary">
            See AI insights →
          </Link>
        </div>

        {/* Hours cards — every logged minute belongs to one of these */}
        <div className="grid grid-cols-2 gap-3">
          <HourCard icon={GraduationCap} label="Learning" min={m.learningMin} tone="primary" />
          <HourCard icon={Briefcase} label="Work" min={m.deepWorkMin} tone="primary" />
          <HourCard icon={Dumbbell} label="Fitness" min={m.fitnessMin} tone="accent" />
          <HourCard icon={Heart} label="Wellness" min={m.wellnessMin + m.sleepMin} />
          <HourCard icon={Tv} label="Entertainment" min={m.entertainmentMin} />
          <HourCard icon={Users} label="Personal" min={m.personalMin + m.socialMin} />
          <HourCard icon={MoreHorizontal} label="Other" min={m.otherMin} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display text-lg">Weekly trend · last 14 days</h3>
          <p className="text-xs text-muted-foreground">Hours per category, per day</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.74 0.17 165)" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="oklch(0.74 0.17 165)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                <XAxis dataKey="date" stroke="oklch(0.7 0.025 260)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.025 260)" fontSize={11} unit="h" />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.024 265)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 12 }} formatter={(v: any) => `${v}h`} />
                <Area type="monotone" dataKey="learning" name="Learning" stroke="oklch(0.74 0.17 165)" fill="url(#gL)" strokeWidth={2} />
                <Area type="monotone" dataKey="fitness" name="Fitness" stroke="oklch(0.78 0.15 200)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="wellness" name="Wellness" stroke="oklch(0.8 0.12 320)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="entertainment" name="Entertainment" stroke="oklch(0.7 0.16 60)" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-display text-lg">Monthly trend · last 4 weeks</h3>
          <p className="text-xs text-muted-foreground">Constructive hours per week</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={weeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                <XAxis dataKey="label" stroke="oklch(0.7 0.025 260)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.025 260)" fontSize={11} unit="h" />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.024 265)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 12 }} formatter={(v: any) => `${v}h`} />
                <Bar dataKey="hours" fill="oklch(0.74 0.17 165)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-primary p-2"><Brain className="h-5 w-5 text-primary-foreground" /></div>
            <div>
              <h3 className="font-display text-lg">AI Insights</h3>
              <p className="text-xs text-muted-foreground">Weekly + monthly reports generated from your activity</p>
            </div>
          </div>
          <Link to="/insights" className="rounded-full border border-border px-4 py-2 text-sm">Open insights</Link>
        </div>
      </div>
    </div>
  );
}

function HourCard({ icon: Icon, label, min, tone }: { icon: any; label: string; min: number; tone?: "primary" | "accent" }) {
  const c = tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-foreground";
  return (
    <div className="glass rounded-2xl p-4">
      <Icon className={`h-4 w-4 ${c}`} />
      <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${c}`}>{fmtH(min)}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-4">
      <div className="h-10 w-40 rounded bg-muted" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 rounded-3xl bg-muted/40" />
        <div className="h-64 rounded-3xl bg-muted/40" />
        <div className="h-64 rounded-3xl bg-muted/40" />
      </div>
    </div>
  );
}
