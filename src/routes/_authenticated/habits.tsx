import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listHabitCatalog, listMyHabits, addHabit, toggleHabitCompletion, deleteHabit } from "@/lib/habits.functions";
import { Loader2, Plus, Check, Trash2, Flame, Calendar as CalendarIcon, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({ meta: [{ title: "Habits, FocusFlow AI" }] }),
  component: HabitsPage,
});

function today() { return new Date().toISOString().slice(0, 10); }

const CATEGORY_COLORS: Record<string, string> = {
  Learning: "from-blue-500/20 to-cyan-500/20 text-blue-300",
  Fitness: "from-orange-500/20 to-red-500/20 text-orange-300",
  Health: "from-emerald-500/20 to-teal-500/20 text-emerald-300",
  Productivity: "from-violet-500/20 to-fuchsia-500/20 text-violet-300",
  Mindfulness: "from-amber-500/20 to-yellow-500/20 text-amber-300",
};

function HabitsPage() {
  const qc = useQueryClient();
  const catalogFn = useServerFn(listHabitCatalog);
  const mineFn = useServerFn(listMyHabits);
  const addFn = useServerFn(addHabit);
  const toggleFn = useServerFn(toggleHabitCompletion);
  const delFn = useServerFn(deleteHabit);
  const catalog = useQuery({ queryKey: ["habit-catalog"], queryFn: () => catalogFn({}) });
  const mine = useQuery({ queryKey: ["my-habits"], queryFn: () => mineFn({}) });

  const [showAdd, setShowAdd] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("Productivity");
  const [endDate, setEndDate] = useState("");

  async function refresh() { await qc.invalidateQueries(); }

  async function pickFromCatalog(item: any) {
    try {
      await addFn({ data: {
        catalog_id: item.id, name: item.name, category: item.category,
        icon: item.icon, description: item.description,
        start_date: today(), end_date: null, frequency: item.frequency ?? "daily",
      } });
      toast.success(`${item.name} added to your habits`);
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed to add"); }
  }

  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customName.trim()) return;
    try {
      await addFn({ data: {
        name: customName.trim(), category: customCategory,
        start_date: today(), end_date: endDate || null,
      } });
      toast.success("Custom habit added");
      setCustomName(""); setEndDate("");
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function onToggle(h: any) {
    try {
      await toggleFn({ data: { user_habit_id: h.id, completion_date: today() } });
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this habit? Completion history will also be deleted.")) return;
    await delFn({ data: { id } });
    await refresh();
  }

  const items = mine.data?.items ?? [];
  const scores = mine.data?.scores ?? { daily: 0, weekly: 0, monthly: 0 };
  const cat = catalog.data?.items ?? [];
  const categories = Array.from(new Set(cat.map((c: any) => c.category)));
  const adopted = new Set(items.map((i: any) => i.name.toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-24">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Build consistency</p>
        <h1 className="font-display text-3xl font-semibold">Habits</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick from the library or create your own. Every check-in gives +1 FocusFlow Score.</p>
      </div>

      {/* Score summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Today", value: scores.daily, icon: Flame },
          { label: "This week", value: scores.weekly, icon: Target },
          { label: "This month", value: scores.monthly, icon: CalendarIcon },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-3xl">{s.value}</p>
            <p className="text-xs text-muted-foreground">completions</p>
          </div>
        ))}
      </div>

      {/* My habits */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">My habits</h2>
          <button onClick={() => setShowAdd(s => !s)} className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-4 py-2 text-xs font-medium text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Custom habit
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addCustom} className="glass-strong space-y-3 rounded-2xl p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Habit name"
                className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm" maxLength={80} />
              <select value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm">
                {["Learning","Fitness","Health","Productivity","Mindfulness","Custom"].map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="End date (optional)"
                className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm" />
            </div>
            <p className="text-xs text-muted-foreground">No end date means infinite duration.</p>
            <button type="submit" className="rounded-full bg-gradient-primary px-5 py-2 text-xs text-primary-foreground">Add habit</button>
          </form>
        )}

        {mine.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No habits yet. Pick one from the library below.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((h: any) => (
              <div key={h.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{h.name}</p>
                      <span className="rounded-full bg-surface/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{h.category}</span>
                    </div>
                    {h.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{h.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400" />{h.current_streak}d streak</span>
                      <span>Best {h.longest_streak}d</span>
                      <span>{h.completion_rate_30d}% in 30d</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => onToggle(h)}
                      className={`grid h-10 w-10 place-items-center rounded-full transition ${h.completed_today ? "bg-gradient-primary text-primary-foreground shadow-glow" : "border border-border text-muted-foreground hover:text-foreground"}`}>
                      <Check className="h-5 w-5" />
                    </button>
                    <button onClick={() => onDelete(h.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                {/* Mini heatmap, last 30d */}
                <div className="mt-3 grid grid-cols-15 gap-0.5">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const d = new Date(); d.setDate(d.getDate() - (29 - i));
                    const key = d.toISOString().slice(0, 10);
                    const done = h.completion_dates.includes(key);
                    return <div key={i} className={`h-3 rounded-sm ${done ? "bg-primary" : "bg-surface/60"}`} title={key} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Catalog */}
      <section className="space-y-3">
        <h2 className="font-display text-xl">Habit library</h2>
        {categories.map((c: any) => (
          <div key={c} className="space-y-2">
            <p className={`bg-gradient-to-r ${CATEGORY_COLORS[c] ?? "from-slate-500/20 to-slate-500/20 text-slate-300"} inline-block rounded-full bg-clip-padding px-3 py-1 text-xs font-medium uppercase tracking-widest`}>{c}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cat.filter((i: any) => i.category === c).map((i: any) => {
                const taken = adopted.has(i.name.toLowerCase());
                return (
                  <button key={i.id} disabled={taken} onClick={() => pickFromCatalog(i)}
                    className={`glass rounded-xl p-3 text-left transition ${taken ? "opacity-50" : "hover:border-primary/40"}`}>
                    <p className="text-sm font-medium">{i.name}</p>
                    {i.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{i.description}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{taken ? "Added" : "Tap to add"}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
