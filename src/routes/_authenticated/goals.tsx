import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listGoals, createGoal, deleteGoal } from "@/lib/goals.functions";
import { CATEGORY_META, type Category } from "@/lib/scoring";
import { Target, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HoursMinutesInput, totalMinutes, fromMinutes } from "@/components/HoursMinutesInput";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals , FocusFlow AI" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const list = useServerFn(listGoals);
  const create = useServerFn(createGoal);
  const remove = useServerFn(deleteGoal);
  const qc = useQueryClient();
  const goalsQ = useQuery({ queryKey: ["goals"], queryFn: () => list({}) });
  const createM = useMutation({
    mutationFn: (input: any) => create({ data: input }),
    onSuccess: () => { toast.success("Goal created"); qc.invalidateQueries(); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [activityName, setActivityName] = useState("");
  const [category, setCategory] = useState<Category | "">("learning");
  const [hours, setHours] = useState(1);
  const [mins, setMins] = useState(0);
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Goals</p>
          <h1 className="font-display text-3xl font-semibold">What you're chasing</h1>
        </div>
        <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> New goal
        </button>
      </div>

      {open && (
        <div className="glass-strong rounded-3xl p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Title" value={title} onChange={setTitle} placeholder="e.g. Solve 10 LeetCode problems" />
            <Input label="Specific activity (optional)" value={activityName} onChange={setActivityName} placeholder="e.g. LeetCode — only this activity counts" />
            <Select label="Category" value={category} onChange={v => setCategory(v as Category)}
              options={[["", "Any"], ...Object.entries(CATEGORY_META).map(([k, v]) => [k, v.label])] as [string, string][]} />
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Target time</span>
              <HoursMinutesInput hours={hours} minutes={mins} onChange={(v) => { setHours(v.hours); setMins(v.minutes); }} />
            </div>
            <Select label="Period" value={period} onChange={v => setPeriod(v as any)} options={[["daily", "Daily"], ["weekly", "Weekly"]]} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Progress is tracked by activity name. By default the goal <span className="font-medium">title</span> is matched against logged activities (e.g. a goal titled "Read Book" advances when you log "Read Book"). Use <span className="font-medium">Specific activity</span> to override the match (e.g. title "Solve 10 LeetCode Problems", specific activity "LeetCode"). Category is informational only and never advances a goal on its own.
          </p>
          <button onClick={() => {
              const target = totalMinutes(hours, mins);
              if (target < 5) { toast.error("Target must be at least 5 minutes"); return; }
              createM.mutate({ title, category: category || null, activity_name: activityName.trim() || null, target_minutes: target, period });
            }}
            disabled={!title || createM.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {createM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create goal"}
          </button>
        </div>
      )}


      <div className="grid gap-3 md:grid-cols-2">
        {(goalsQ.data?.goals ?? []).map((g: any) => (
          <div key={g.id} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span>{g.period}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    matches: {(g.activity_name ?? g.title)}
                  </span>
                  {g.category ? <span className="opacity-70">· {CATEGORY_META[g.category as Category].label}</span> : null}
                </div>
                <p className="mt-1 font-display text-lg">{g.title}</p>

              </div>
              <button onClick={() => deleteM.mutate(g.id)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <p className="text-sm">{fmtHM(g.achieved_minutes)}<span className="text-muted-foreground"> / {fmtHM(g.target_minutes)}</span></p>
              <p className="font-display text-lg">{g.pct}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${g.pct}%` }} />
            </div>
          </div>
        ))}
        {(goalsQ.data?.goals ?? []).length === 0 && (
          <div className="glass rounded-2xl p-8 text-center md:col-span-2">
            <Target className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">No active goals yet. Set one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus:border-primary" />
    </label>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus:border-primary">
        {options.map(([v, l]: [string, string]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function fmtHM(total: number): string {
  const { hours, minutes } = fromMinutes(total);
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
