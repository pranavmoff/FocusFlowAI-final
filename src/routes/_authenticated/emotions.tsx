import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addEmotionEntry, listEmotionEntries, getEmotionAnalytics, decryptEmotionNote, deleteEmotionEntry } from "@/lib/emotions.functions";
import { Loader2, Lock, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/emotions")({
  head: () => ({ meta: [{ title: "Emotion Dumper, FocusFlow AI" }] }),
  component: EmotionsPage,
});

const EMOTIONS = [
  { key: "happy", emoji: "😀", label: "Happy", bg: "bg-yellow-500/30", border: "border-yellow-400/60", card: "from-yellow-400 to-amber-300" },
  { key: "calm", emoji: "😌", label: "Calm", bg: "bg-blue-500/30", border: "border-blue-400/60", card: "from-blue-400 to-sky-300" },
  { key: "excited", emoji: "🤩", label: "Excited", bg: "bg-orange-500/30", border: "border-orange-400/60", card: "from-orange-400 to-amber-300" },
  { key: "sad", emoji: "😔", label: "Sad", bg: "bg-purple-500/30", border: "border-purple-400/60", card: "from-purple-400 to-violet-300" },
  { key: "angry", emoji: "😡", label: "Angry", bg: "bg-red-500/30", border: "border-red-400/60", card: "from-red-400 to-rose-300" },
  { key: "anxious", emoji: "😰", label: "Anxious", bg: "bg-teal-500/30", border: "border-teal-400/60", card: "from-teal-400 to-cyan-300" },
  { key: "tired", emoji: "😴", label: "Tired", bg: "bg-slate-500/30", border: "border-slate-400/60", card: "from-slate-400 to-zinc-300" },
  { key: "frustrated", emoji: "😞", label: "Frustrated", bg: "bg-rose-500/30", border: "border-rose-400/60", card: "from-rose-400 to-pink-300" },
  { key: "grateful", emoji: "❤️", label: "Grateful", bg: "bg-pink-500/30", border: "border-pink-400/60", card: "from-pink-400 to-rose-300" },
  { key: "confident", emoji: "😎", label: "Confident", bg: "bg-emerald-500/30", border: "border-emerald-400/60", card: "from-emerald-400 to-teal-300" },
] as const;

function EmotionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmotionEntries);
  const analyticsFn = useServerFn(getEmotionAnalytics);
  const addFn = useServerFn(addEmotionEntry);
  const decryptFn = useServerFn(decryptEmotionNote);
  const delFn = useServerFn(deleteEmotionEntry);
  const list = useQuery({ queryKey: ["emotions"], queryFn: () => listFn({}) });
  const analytics = useQuery({ queryKey: ["emotion-analytics"], queryFn: () => analyticsFn({}) });

  const [active, setActive] = useState<typeof EMOTIONS[number] | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState<{ id: string; emotion: string; note: string } | null>(null);

  async function refresh() {
    await qc.invalidateQueries();
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    try {
      await addFn({ data: { emotion: active.key, note: note.trim() } });
      toast.success("Saved");
      setActive(null); setNote("");
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  }

  async function openNote(id: string, emotion: string) {
    try {
      const r = await decryptFn({ data: { id } });
      setReading({ id, emotion, note: r.note });
    } catch (e: any) { toast.error("Could not open"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    await delFn({ data: { id } });
    setReading(null);
    await refresh();
  }

  const a = analytics.data;
  const dist = a?.distribution ?? {};
  const totalDist = Object.values(dist).reduce((s: number, n: any) => s + n, 0) || 1;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Private journal</p>
        <h1 className="font-display text-3xl font-semibold">Emotion Dumper</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tap how you feel. Add a note if you want.</p>
      </div>

      <div className="glass rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 text-emerald-400" />
          <p className="text-xs text-emerald-100/80">
            Your journal entries are private and encrypted. FocusFlow AI does not analyze or store the content of your notes for productivity scoring.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {EMOTIONS.map(em => (
          <button key={em.key} onClick={() => { setActive(em); setNote(""); }}
            className={`group flex flex-col items-center gap-2 rounded-2xl border ${em.border} ${em.bg} p-4 backdrop-blur transition hover:scale-105`}>
            <span className="text-3xl">{em.emoji}</span>
            <span className="text-xs font-medium">{em.label}</span>
          </button>
        ))}
      </div>

      {/* Recent */}
      <section>
        <h2 className="font-display text-xl">Recent entries</h2>
        <div className="mt-3 space-y-2">
          {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!list.isLoading && (list.data?.items.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          )}
          {(list.data?.items ?? []).slice(0, 20).map((e: any) => {
            const meta = EMOTIONS.find(m => m.key === e.emotion);
            return (
              <div key={e.id} className="glass flex items-center justify-between gap-3 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta?.emoji}</span>
                  <div>
                    <p className="text-sm font-medium capitalize">{e.emotion}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {e.has_note && (
                    <button onClick={() => openNote(e.id, e.emotion)} className="rounded-full border border-border px-3 py-1 text-xs">Open note</button>
                  )}
                  <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Analytics */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Mood distribution (90d)</p>
          <div className="mt-3 space-y-2">
            {EMOTIONS.map(em => {
              const n = dist[em.key] ?? 0;
              const pct = Math.round((n / totalDist) * 100);
              return (
                <div key={em.key} className="flex items-center gap-2 text-xs">
                  <span className="w-6">{em.emoji}</span>
                  <span className="w-20 capitalize text-muted-foreground">{em.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface/60">
                    <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="glass space-y-3 rounded-2xl p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Most common</p>
            <p className="mt-1 font-display text-2xl capitalize">{a?.mostCommon ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Best day of week</p>
            <p className="mt-1 font-display text-2xl">{a?.bestDay ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Reflection</p>
            <p className="mt-1 text-sm">{a?.reflection ?? ""}</p>
          </div>
        </div>
      </section>

      {/* Note modal */}
      {active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className={`relative w-full max-w-md rounded-3xl bg-gradient-to-br ${active.card} p-6 text-slate-900 shadow-2xl`}>
            <button onClick={() => setActive(null)} className="absolute right-3 top-3 rounded-full bg-black/10 p-1"><X className="h-4 w-4" /></button>
            <div className="text-center">
              <p className="text-5xl">{active.emoji}</p>
              <p className="mt-2 font-display text-xl font-semibold">{active.label}</p>
            </div>
            <textarea autoFocus value={note} onChange={e => setNote(e.target.value)} maxLength={2000}
              placeholder="Why do you feel this way? (optional, private and encrypted)"
              className="mt-4 h-32 w-full resize-none rounded-2xl border-0 bg-white/70 p-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setActive(null)} className="flex-1 rounded-full bg-white/30 py-2 text-sm font-medium">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-full bg-slate-900 py-2 text-sm font-medium text-white">
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-surface p-6 shadow-2xl">
            <button onClick={() => setReading(null)} className="absolute right-3 top-3 rounded-full bg-surface/60 p-1"><X className="h-4 w-4" /></button>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Your note</p>
            <p className="mt-1 font-display text-lg capitalize">{reading.emotion}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm">{reading.note || <span className="text-muted-foreground">(empty)</span>}</p>
          </div>
        </div>
      )}
    </div>
  );
}
