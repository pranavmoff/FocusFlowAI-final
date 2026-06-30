import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Download, Sparkles, Brain, FileText } from "lucide-react";
import { generateStory, listStories } from "@/lib/story.functions";
import { downloadElementAsPng, downloadElementAsPdf, cardFilename, reportFilename } from "@/lib/downloads";

export const Route = createFileRoute("/_authenticated/story")({
  head: () => ({ meta: [{ title: "Life Story, FocusFlow AI" }] }),
  component: StoryPage,
});

type Period = "weekly" | "monthly" | "yearly";

function StoryPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("monthly");
  const cardRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const listFn = useServerFn(listStories);
  const genFn = useServerFn(generateStory);

  const list = useQuery({ queryKey: ["stories"], queryFn: () => listFn({}) });
  const gen = useMutation({
    mutationFn: () => genFn({ data: { period } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stories"] }),
  });

  const current = (list.data?.stories ?? []).find(s => s.period_type === period);
  const lastGen = gen.data;
  const insufficient = lastGen && "insufficient" in lastGen && lastGen.insufficient ? lastGen : null;

  async function downloadCard() {
    if (!cardRef.current) return;
    await downloadElementAsPng(cardRef.current, cardFilename("LifeStory", current?.stats?.period_label ?? period));
  }
  async function downloadReport() {
    if (!reportRef.current) return;
    await downloadElementAsPdf(reportRef.current, reportFilename(period));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Life story</p>
          <h1 className="font-display text-3xl font-semibold">AI Narrative</h1>
          <p className="text-sm text-muted-foreground">Your productivity, told as a story, grounded in actual numbers.</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Year in Review</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="bg-gradient-primary text-primary-foreground">
          <Sparkles className="mr-2 h-4 w-4" />{gen.isPending ? "Writing…" : current ? `Regenerate ${period}` : `Generate ${period} story`}
        </Button>
        {current && <Button variant="outline" onClick={downloadCard}><Download className="mr-2 h-4 w-4" /> Download share card</Button>}
      </div>

      {insufficient && (
        <Card className="glass"><CardContent className="p-8 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-2 font-display text-lg">No Life Story available yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We need at least {insufficient.requiredEntries} meaningful logged activities before generating your story.
          </p>
          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">Current progress</p>
          <p className="font-display text-3xl text-gradient">{insufficient.meaningfulEntries} / {insufficient.requiredEntries} Entries</p>
        </CardContent></Card>
      )}

      {!current && !insufficient && (
        <Card className="glass"><CardContent className="p-8 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-2 font-display text-lg">No {period} story yet</p>
          <p className="text-sm text-muted-foreground">Click "Generate" above , we'll write a narrative from your real data.</p>
        </CardContent></Card>
      )}

      {current && (
        <div ref={reportRef} className="space-y-6">
          <Card className="glass">
            <CardHeader><CardTitle>{current.stats?.period_label ?? period}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total hours" value={current.stats?.total_hours} />
                <Stat label="Learning" value={current.stats?.learning_hours} suffix="h" />
                <Stat label="Deep work" value={current.stats?.deep_work_hours} suffix="h" />
                <Stat label="Fitness" value={current.stats?.fitness_hours} suffix="h" />
                <Stat label="FocusFlow" value={current.stats?.focusflow_score} suffix="/100" />
                <Stat label="Consistency" value={current.stats?.consistency} suffix="/100" />
                <Stat label="Goals done" value={current.stats?.completed_goals} />
                <Stat label="Longest streak" value={current.stats?.longest_streak} suffix="d" />
              </div>
              <article className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">{current.narrative}</article>
            </CardContent>
          </Card>

          {/* Shareable card */}
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <div ref={cardRef} className="relative aspect-[1.91/1] w-full" style={{
              background: "linear-gradient(135deg, oklch(0.2 0.04 270), oklch(0.16 0.04 220))",
              padding: 40, color: "#f5f7fb",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#34d3a3,#b985ff)", display: "grid", placeItems: "center" }}>
                  <Brain size={18} color="#0f1729" />
                </div>
                <span style={{ fontFamily: "Space Grotesk, Inter, sans-serif", fontWeight: 600 }}>FocusFlow AI</span>
              </div>
              <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7 }}>{current.stats?.period_label ?? period}</div>
              <div style={{ fontFamily: "Space Grotesk, Inter, sans-serif", fontSize: 44, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>
                {current.stats?.total_hours ?? 0}h productive · score {current.stats?.focusflow_score ?? 0}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 28 }}>
                <CardStat label="Learning" value={`${current.stats?.learning_hours ?? 0}h`} />
                <CardStat label="Deep work" value={`${current.stats?.deep_work_hours ?? 0}h`} />
                <CardStat label="Goals done" value={`${current.stats?.completed_goals ?? 0}`} />
                <CardStat label="Best streak" value={`${current.stats?.longest_streak ?? 0}d`} />
              </div>
              <div style={{ position: "absolute", bottom: 16, right: 24, fontSize: 11, opacity: 0.6 }}>Generated by FocusFlow AI</div>
            </div>
          </div>
        </div>
      )}


      {list.data && list.data.stories.length > 0 && (
        <Card className="glass">
          <CardHeader><CardTitle>Story archive</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/40">
              {list.data.stories.map(s => (
                <li key={s.id} className="py-2 text-sm">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{s.period_type}</span>
                  <span className="ml-2 font-medium">{s.period_key}</span>
                  <span className="ml-2 text-muted-foreground">{s.stats?.total_hours ?? 0}h · score {s.stats?.focusflow_score ?? 0}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: any; suffix?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold tabular-nums">{value ?? 0}{suffix ?? ""}</p>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</div>
      <div style={{ fontFamily: "Space Grotesk, Inter, sans-serif", fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
