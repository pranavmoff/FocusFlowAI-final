import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTasks, createTask, toggleTask, toggleSubtask, deleteTask } from "@/lib/tasks.functions";
import { HoursMinutesInput, totalMinutes } from "@/components/HoursMinutesInput";
import { Plus, Trash2, X, Clock } from "lucide-react";
import { toast } from "sonner";

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks, FocusFlow AI" }] }),
  component: TasksPage,
});

function TasksPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const toggleFn = useServerFn(toggleTask);
  const subToggle = useServerFn(toggleSubtask);
  const delFn = useServerFn(deleteTask);
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => listFn({}) });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [estHours, setEstHours] = useState(0);
  const [estMinutes, setEstMinutes] = useState(0);
  const [subs, setSubs] = useState<string[]>([""]);

  async function refresh() { await qc.invalidateQueries(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const est = totalMinutes(estHours, estMinutes);
    if (est > 1440) { toast.error("Estimated time cannot exceed 24 hours."); return; }
    try {
      await createFn({ data: {
        title: title.trim(), description: description.trim() || null, priority,
        due_date: dueDate || null,
        estimated_minutes: est > 0 ? est : null,
        subtasks: subs.map(s => s.trim()).filter(Boolean),
      } });
      toast.success("Task created");
      setOpen(false); setTitle(""); setDescription(""); setDueDate(""); setSubs([""]); setPriority("medium");
      setEstHours(0); setEstMinutes(0);
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  const items = tasks.data?.items ?? [];
  const active = items.filter((t: any) => !t.completed);
  const done = items.filter((t: any) => t.completed);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Plan & execute</p>
          <h1 className="font-display text-3xl font-semibold">Tasks</h1>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-4 py-2 text-xs font-medium text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> New task
        </button>
      </div>

      {tasks.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <section className="space-y-2">
        {active.length === 0 && !tasks.isLoading && <p className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No active tasks. Create one to get started.</p>}
        {active.map((t: any) => <TaskCard key={t.id} task={t} onToggle={async (completed: boolean) => { await toggleFn({ data: { id: t.id, completed } }); await refresh(); }} onSub={async (sid: string, c: boolean) => { await subToggle({ data: { id: sid, completed: c } }); await refresh(); }} onDelete={async () => { if (confirm("Delete task?")) { await delFn({ data: { id: t.id } }); await refresh(); } }} />)}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Completed</h2>
          {done.slice(0, 10).map((t: any) => <TaskCard key={t.id} task={t} onToggle={async (completed: boolean) => { await toggleFn({ data: { id: t.id, completed } }); await refresh(); }} onSub={async (sid: string, c: boolean) => { await subToggle({ data: { id: sid, completed: c } }); await refresh(); }} onDelete={async () => { if (confirm("Delete task?")) { await delFn({ data: { id: t.id } }); await refresh(); } }} />)}
        </section>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form onSubmit={submit} className="relative w-full max-w-lg space-y-3 rounded-3xl bg-surface p-6 shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-full bg-surface/60 p-1"><X className="h-4 w-4" /></button>
            <h3 className="font-display text-lg">New task</h3>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" maxLength={200}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={1000}
              className="h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select value={priority} onChange={e => setPriority(e.target.value as any)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <option value="low">Low priority</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Estimated time (optional)</p>
              <HoursMinutesInput
                hours={estHours} minutes={estMinutes}
                onChange={({ hours: h, minutes: m }) => { setEstHours(h); setEstMinutes(m); }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Subtasks</p>
              {subs.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input value={s} onChange={e => setSubs(arr => arr.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={`Subtask ${i + 1}`} maxLength={160}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                  {subs.length > 1 && (
                    <button type="button" onClick={() => setSubs(arr => arr.filter((_, j) => j !== i))} className="rounded-xl border border-border px-3 text-sm">−</button>
                  )}
                </div>
              ))}
              {subs.length < 20 && (
                <button type="button" onClick={() => setSubs(arr => [...arr, ""])} className="text-xs text-primary">+ Add subtask</button>
              )}
            </div>
            <button type="submit" className="w-full rounded-full bg-gradient-primary py-2.5 text-sm font-medium text-primary-foreground">Create</button>
          </form>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onToggle, onSub, onDelete }: any) {
  const priColor = task.priority === "high" ? "text-red-400" : task.priority === "medium" ? "text-yellow-400" : "text-emerald-400";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={task.completed} onChange={e => onToggle(e.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-medium ${task.completed ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
            <span className={`text-[10px] uppercase tracking-widest ${priColor}`}>{task.priority}</span>
          </div>
          {task.description && <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>}
          {task.due_date && <p className="mt-1 text-xs text-muted-foreground">Due {task.due_date}</p>}
          {task.estimated_minutes ? <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {fmtDuration(task.estimated_minutes)}</p> : null}
          {task.subtasks.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface/60">
                <div className="h-full bg-gradient-primary" style={{ width: `${task.progress}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">{task.progress}% complete</p>
              {task.subtasks.map((s: any) => (
                <label key={s.id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={s.completed} onChange={e => onSub(s.id, e.target.checked)} className="h-4 w-4 accent-primary" />
                  <span className={s.completed ? "text-muted-foreground line-through" : ""}>{s.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
