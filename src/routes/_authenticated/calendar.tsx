import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCalendarMonth, getDaySummary } from "@/lib/calendar.functions";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "My Calendar, FocusFlow AI" }] }),
  component: CalendarPage,
});

function bandColor(b: string | undefined) {
  if (b === "high") return "bg-emerald-500/20 border-emerald-400/40";
  if (b === "mid") return "bg-yellow-500/20 border-yellow-400/40";
  if (b === "low") return "bg-red-500/15 border-red-400/30";
  return "bg-surface/40 border-border";
}

function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [selected, setSelected] = useState<string | null>(null);

  const monthFn = useServerFn(getCalendarMonth);
  const dayFn = useServerFn(getDaySummary);

  const monthQ = useQuery({
    queryKey: ["calendar", year, month],
    queryFn: () => monthFn({ data: { year, month } }),
  });
  const dayQ = useQuery({
    queryKey: ["calendar-day", selected],
    queryFn: () => dayFn({ data: { date: selected! } }),
    enabled: !!selected,
  });

  const daysMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const d of monthQ.data?.days ?? []) m.set(d.date, d);
    return m;
  }, [monthQ.data]);

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: string | null; n: number | null }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, n: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, month, d));
      cells.push({ date: dt.toISOString().slice(0, 10), n: d });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, n: null });
    return cells;
  }, [year, month]);

  function shift(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Your year at a glance</p>
          <h1 className="font-display text-3xl font-semibold">My Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="rounded-full border border-border p-2"><ChevronLeft className="h-4 w-4" /></button>
          <p className="min-w-[10ch] text-center font-display text-lg">
            {new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" })}
          </p>
          <button onClick={() => shift(1)} className="rounded-full border border-border p-2"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="glass rounded-3xl p-4">
        <div className="mb-2 grid grid-cols-7 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {grid.map((cell, i) => {
            if (!cell.date) return <div key={i} />;
            const d = daysMap.get(cell.date);
            const has = !!d;
            return (
              <button key={i} onClick={() => setSelected(cell.date)}
                className={`relative aspect-square rounded-xl border p-1.5 text-left transition hover:scale-[1.02] ${bandColor(d?.score_band)}`}>
                <p className="text-xs font-medium">{cell.n}</p>
                {d?.emotion_color && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: d.emotion_color }} />
                )}
                {has && (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 space-y-0.5">
                    <p className="text-[10px] font-medium tabular-nums">{d.score}</p>
                    <div className="flex gap-1 text-[8px] text-muted-foreground">
                      {d.activities > 0 && <span>•{d.activities}a</span>}
                      {d.habits_completed > 0 && <span>•{d.habits_completed}h</span>}
                      {d.tasks_completed > 0 && <span>•{d.tasks_completed}t</span>}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/40" /> High (≥70)</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-500/40" /> Mid (40-69)</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500/40" /> Low (&lt;40)</span>
          <span>•a=activities · h=habits · t=tasks · colored dot=emotion</span>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="relative w-full max-w-lg space-y-3 rounded-3xl bg-surface p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute right-3 top-3 rounded-full bg-surface/60 p-1"><X className="h-4 w-4" /></button>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Daily summary</p>
            <h3 className="font-display text-xl">{new Date(selected).toDateString()}</h3>
            {dayQ.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : dayQ.data && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="FocusFlow Score" value={String(dayQ.data.score)} />
                  <Stat label="Emotion" value={dayQ.data.dominant_emotion ?? "—"} />
                  <Stat label="Activities" value={String(dayQ.data.activities.length)} />
                  <Stat label="Habits" value={String(dayQ.data.habits.length)} />
                  <Stat label="Tasks done" value={String(dayQ.data.tasks.length)} />
                  <Stat label="Emotions" value={String(dayQ.data.emotions.length)} />
                </div>
                {dayQ.data.activities.length > 0 && (
                  <Section title="Activities">
                    {dayQ.data.activities.map((a: any) => (
                      <Row key={a.id} left={`${a.name}${a.sub_activity ? " · " + a.sub_activity : ""}`} right={`${Math.round((a.duration_minutes ?? 0) / 60 * 10) / 10}h`} />
                    ))}
                  </Section>
                )}
                {dayQ.data.habits.length > 0 && (
                  <Section title="Habits">
                    {dayQ.data.habits.map((h: any) => <Row key={h.id} left={h.name} right={h.category} />)}
                  </Section>
                )}
                {dayQ.data.tasks.length > 0 && (
                  <Section title="Tasks">
                    {dayQ.data.tasks.map((t: any) => <Row key={t.id} left={t.title} right={t.priority} />)}
                  </Section>
                )}
                <div className="rounded-2xl bg-gradient-primary/10 p-3 text-sm">✨ {dayQ.data.reflection}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: any) {
  return <div className="rounded-xl border border-border bg-surface/40 p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg capitalize">{value}</p></div>;
}
function Section({ title, children }: any) {
  return <div><p className="text-xs uppercase tracking-widest text-muted-foreground">{title}</p><div className="mt-1 space-y-1">{children}</div></div>;
}
function Row({ left, right }: any) {
  return <div className="flex justify-between text-sm"><span className="truncate">{left}</span><span className="text-muted-foreground capitalize">{right}</span></div>;
}
