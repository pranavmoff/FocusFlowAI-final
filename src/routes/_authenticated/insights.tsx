import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { generateReport } from "@/lib/reports.functions";
import { useRef, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Sparkles, Loader2, Lightbulb, Activity, TrendingUp, TrendingDown, Clock, Target, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadElementAsPdf, reportFilename } from "@/lib/downloads";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Reports, FocusFlow AI" }] }),
  component: ReportsPage,
});

type Period = "weekly" | "monthly" | "yearly";

const CATEGORY_COLORS: Record<string, string> = {
  learning: "oklch(0.74 0.17 165)",
  work: "oklch(0.68 0.19 295)",
  fitness: "oklch(0.78 0.15 200)",
  wellness: "oklch(0.8 0.12 320)",
  entertainment: "oklch(0.7 0.16 60)",
  personal: "oklch(0.7 0.025 260)",
  social: "oklch(0.7 0.15 240)",
  sleep: "oklch(0.55 0.04 265)",
  other: "oklch(0.55 0.025 265)",
};

function ReportsPage() {
  const gen = useServerFn(generateReport);
  const [period, setPeriod] = useState<Period>("weekly");
  const reportRef = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ["report", period],
    queryFn: () => gen({ data: { period } }),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">AI Reports</p>
          <h1 className="font-display text-3xl font-semibold">Productivity intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">Weekly, monthly, and yearly breakdowns generated from your activity.</p>
        </div>
        <div className="flex gap-2">
          {q.data && (
            <Button variant="outline" onClick={() => reportRef.current && downloadElementAsPdf(reportRef.current, reportFilename(period))}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          )}
          <button
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50">
            {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate
          </button>
        </div>
      </div>

      <div className="glass inline-flex rounded-full p-1">
        {(["weekly", "monthly", "yearly"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-5 py-2 text-sm font-medium capitalize transition ${
              period === p ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}>
            {p}
          </button>
        ))}
      </div>

      {q.isLoading && (
        <div className="glass rounded-3xl p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">FocusFlow is analyzing your {period} data…</p>
        </div>
      )}

      {q.error && (
        <div className="glass rounded-3xl p-8 text-center">
          <p className="text-destructive">Couldn't generate the report.</p>
          <button onClick={() => q.refetch()} className="mt-4 rounded-full border border-border px-4 py-2 text-sm">Try again</button>
        </div>
      )}

      {q.data && <div ref={reportRef} className="space-y-6"><ReportView data={q.data} period={period} /></div>}
    </div>
  );
}

function ReportView({ data, period }: { data: any; period: Period }) {
  const { totals, byCategory, topActivities, series, narrative, range } = data;
  const pieData = byCategory.filter((c: any) => c.hours > 0);
  const prodSplit = [
    { name: "Productive", value: totals.productiveHours, color: "oklch(0.74 0.17 165)" },
    { name: "Unproductive", value: totals.unproductiveHours, color: "oklch(0.66 0.22 25)" },
    { name: "Neutral", value: totals.neutralHours, color: "oklch(0.55 0.025 265)" },
  ].filter(d => d.value > 0);

  return (
    <>
      <div className="glass-strong relative overflow-hidden rounded-3xl p-6">
        <div className="absolute inset-0 -z-10 bg-gradient-aurora opacity-50" />
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-gradient-primary p-2 shadow-glow"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-primary">AI {period} report</p>
            <h2 className="mt-1 font-display text-2xl">{narrative.headline}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{narrative.summary}</p>
            <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground">{range.startLabel} → {range.endLabel}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Target} label="Productivity" value={`${totals.productivityPct}%`} accent="primary" sub={`${totals.productiveHours}h productive`} />
        <Stat icon={Clock} label="Total tracked" value={`${totals.totalHours}h`} sub={`${totals.entries} entries`} />
        <Stat icon={TrendingUp} label="Productive" value={`${totals.productiveHours}h`} accent="success" />
        <Stat icon={TrendingDown} label="Unproductive" value={`${totals.unproductiveHours}h`} accent="destructive" />
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="font-display text-lg">Productive vs unproductive</h3>
        <p className="text-xs text-muted-foreground">
          {period === "weekly" ? "Hours per day" : period === "monthly" ? "Hours per day (last 30)" : "Hours per month (last 12)"}
        </p>
        <div className="mt-4 h-72">
          <ResponsiveContainer>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.74 0.17 165)" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="oklch(0.74 0.17 165)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.66 0.22 25)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="oklch(0.66 0.22 25)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklab, currentColor 10%, transparent)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} unit="h" />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
                formatter={(v: any) => `${v}h`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="productive" name="Productive" stroke="oklch(0.74 0.17 165)" fill="url(#gP)" strokeWidth={2} />
              <Area type="monotone" dataKey="unproductive" name="Unproductive" stroke="oklch(0.66 0.22 25)" fill="url(#gU)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-3xl p-5">
          <h3 className="font-display text-lg">Time split</h3>
          <p className="text-xs text-muted-foreground">Productive vs unproductive vs neutral</p>
          <div className="mt-4 h-64">
            {prodSplit.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={prodSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {prodSplit.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
                    formatter={(v: any) => `${v}h`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass rounded-3xl p-5">
          <h3 className="font-display text-lg">By category</h3>
          <p className="text-xs text-muted-foreground">Where your hours went</p>
          <div className="mt-4 h-64">
            {pieData.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="hours" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {pieData.map((d: any, i: number) => <Cell key={i} fill={CATEGORY_COLORS[d.category] ?? "var(--muted)"} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
                    formatter={(v: any) => `${v}h`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="font-display text-lg">Top activities</h3>
        <p className="text-xs text-muted-foreground">Where your time went, ranked</p>
        <div className="mt-4 h-72">
          {topActivities.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <BarChart data={topActivities} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklab, currentColor 10%, transparent)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} unit="h" />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={140} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
                  formatter={(v: any) => `${v}h`}
                />
                <Bar dataKey="hours" radius={[0, 8, 8, 0]}>
                  {topActivities.map((a: any, i: number) => (
                    <Cell key={i} fill={a.productive ? "oklch(0.74 0.17 165)" : "oklch(0.66 0.22 25 / 70%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <NarrativeCard icon={Activity} title="Patterns we noticed" items={narrative.patterns} />
        <NarrativeCard icon={Lightbulb} title="Recommendations" items={narrative.recommendations} accent />
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: "primary" | "success" | "destructive" }) {
  const color =
    accent === "primary" ? "text-primary" :
    accent === "success" ? "text-success" :
    accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="glass rounded-2xl p-4">
      <Icon className={`h-4 w-4 ${color}`} />
      <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function NarrativeCard({ icon: Icon, title, items, accent }: { icon: any; title: string; items: string[]; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${accent ? "bg-gradient-primary" : "bg-surface-strong"}`}>
          <Icon className={`h-4 w-4 ${accent ? "text-primary-foreground" : "text-primary"}`} />
        </div>
        <h3 className="font-display">{title}</h3>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {!items?.length ? <li className="text-muted-foreground">No observations yet, log more activities.</li> :
          items.map((t, i) => (
            <li key={i} className="rounded-lg bg-surface/50 p-3 text-muted-foreground">{t}</li>
          ))}
      </ul>
    </div>
  );
}

function Empty() {
  return <div className="grid h-full place-items-center text-sm text-muted-foreground">No data in this range.</div>;
}
