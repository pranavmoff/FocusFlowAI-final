import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addActivity, classifyActivity, updateActivity, deleteActivity, listRecentActivities,
} from "@/lib/activities.functions";
import { HoursMinutesInput, totalMinutes, fromMinutes } from "@/components/HoursMinutesInput";
import { Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/log")({
  head: () => ({ meta: [{ title: "Log activity, FocusFlow AI" }] }),
  component: LogPage,
});

function today() { return new Date().toISOString().slice(0, 10); }
function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const MAIN_SUGGESTIONS = ["Study","Work","Fitness","Reading","Coding","Meditation","Sleep","Entertainment","Social","Other"];

function LogPage() {
  const qc = useQueryClient();
  const add = useServerFn(addActivity);
  const classify = useServerFn(classifyActivity);
  const update = useServerFn(updateActivity);
  const del = useServerFn(deleteActivity);
  const fetchRecent = useServerFn(listRecentActivities);

  const recent = useQuery({ queryKey: ["recent"], queryFn: () => fetchRecent({}) });

  const [main, setMain] = useState("");
  const [sub, setSub] = useState("");
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMain, setEditMain] = useState("");
  const [editSub, setEditSub] = useState("");
  const [editHours, setEditHours] = useState(1);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editDate, setEditDate] = useState(today());

  async function refresh() {
    await qc.invalidateQueries();
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const mins = totalMinutes(hours, minutes);
    if (!main.trim()) { toast.error("Enter a main activity."); return; }
    if (mins <= 0) { toast.error("Enter a duration of at least 1 minute."); return; }
    if (mins > 1440) { toast.error("Duration cannot exceed 24 hours."); return; }
    setSaving(true);
    try {
      const res = await add({ data: {
        activity_name: main.trim(), sub_activity: sub.trim() || null,
        minutes: mins, activity_date: date,
      } });
      toast.success("Activity saved");
      setMain(""); setSub(""); setHours(1); setMinutes(0); setDate(today());
      await refresh();
      if (res.needsClassification) {
        classify({ data: { id: res.id } }).then(() => refresh()).catch(() => {});
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save");
    } finally { setSaving(false); }
  }

  function startEdit(item: any) {
    setEditingId(item.id);
    setEditMain(item.name);
    setEditSub(item.sub_activity ?? "");
    const { hours: h, minutes: m } = fromMinutes(item.duration_minutes);
    setEditHours(h); setEditMinutes(m);
    setEditDate(item.activity_date);
  }

  async function saveEdit() {
    if (!editingId) return;
    const mins = totalMinutes(editHours, editMinutes);
    if (!editMain.trim()) { toast.error("Enter a main activity."); return; }
    if (mins <= 0) { toast.error("Enter a duration of at least 1 minute."); return; }
    if (mins > 1440) { toast.error("Duration cannot exceed 24 hours."); return; }
    try {
      const res = await update({ data: {
        id: editingId, activity_name: editMain.trim(),
        sub_activity: editSub.trim() || null,
        minutes: mins, activity_date: editDate,
      } });
      toast.success("Updated");
      setEditingId(null);
      await refresh();
      if (res.needsClassification) {
        classify({ data: { id: res.id } }).then(() => refresh()).catch(() => {});
      }
    } catch (e: any) { toast.error(e?.message ?? "Update failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this activity?")) return;
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Delete failed"); }
  }

  const items = (recent.data?.items ?? []) as any[];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">New entry</p>
        <h1 className="font-display text-3xl font-semibold">Log Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Main + sub activity, hours, and date. FocusFlow handles the rest.</p>
      </div>

      <form onSubmit={onAdd} className="glass-strong space-y-4 rounded-3xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Main activity</label>
            <input
              value={main} onChange={e => setMain(e.target.value)} maxLength={120}
              list="main-suggestions"
              placeholder="e.g. Study"
              className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
            <datalist id="main-suggestions">{MAIN_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Sub activity (optional)</label>
            <input
              value={sub} onChange={e => setSub(e.target.value)} maxLength={120}
              placeholder="e.g. Data Structures"
              className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Time spent</label>
            <HoursMinutesInput
              hours={hours} minutes={minutes}
              onChange={({ hours: h, minutes: m }) => { setHours(h); setMinutes(m); }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Date</label>
            <input
              type="date" value={date} max={today()} onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary py-3 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {saving ? "Saving…" : "Add activity"}
        </button>
      </form>

      <div className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Recent activities</h2>
          <span className="text-xs text-muted-foreground">{items.length} entries</span>
        </div>

        <div className="mt-3 divide-y divide-border/60">
          {items.length === 0 && !recent.isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing logged yet. Add your first activity above.</p>
          )}
          {recent.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}

          {items.map((item: any) => (
            <div key={item.id} className="py-3">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editMain} onChange={e => setEditMain(e.target.value)} placeholder="Main"
                      className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus:border-primary" />
                    <input value={editSub} onChange={e => setEditSub(e.target.value)} placeholder="Sub (optional)"
                      className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>
                  <HoursMinutesInput
                    hours={editHours} minutes={editMinutes}
                    onChange={({ hours: h, minutes: m }) => { setEditHours(h); setEditMinutes(m); }}
                  />
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                    <input type="date" value={editDate} max={today()} onChange={e => setEditDate(e.target.value)}
                      className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus:border-primary" />
                    <button onClick={saveEdit} className="rounded-lg bg-gradient-primary px-3 text-primary-foreground"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingId(null)} className="rounded-lg border border-border px-3"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize">
                      {item.name}{item.sub_activity ? <span className="text-muted-foreground"> · {item.sub_activity}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.activity_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums">{fmtDuration(item.duration_minutes)}</span>
                    <button onClick={() => startEdit(item)} className="rounded-lg p-2 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(item.id)} className="rounded-lg p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
