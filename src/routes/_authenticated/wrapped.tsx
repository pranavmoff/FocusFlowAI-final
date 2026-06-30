import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Image as ImageIcon, Gift, Flame, GraduationCap, Dumbbell, TrendingUp, Calendar, Trophy } from "lucide-react";
import { getWrapped } from "@/lib/growth.functions";
import { downloadElementAsPng, downloadElementAsPdf, cardFilename } from "@/lib/downloads";

export const Route = createFileRoute("/_authenticated/wrapped")({
  head: () => ({ meta: [{ title: "FocusFlow Wrapped, FocusFlow AI" }] }),
  component: WrappedPage,
});

type Period = "month" | "quarter" | "year";

function WrappedPage() {
  const [period, setPeriod] = useState<Period>("year");
  const fn = useServerFn(getWrapped);
  const cardRef = useRef<HTMLDivElement>(null);

  const q = useMutation({ mutationFn: (p: Period) => fn({ data: { period: p } }) });

  // Trigger first load
  if (q.isIdle) q.mutate(period);

  const data = q.data;

  function switchPeriod(p: Period) {
    setPeriod(p);
    q.mutate(p);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">FocusFlow Wrapped</p>
          <h1 className="font-display text-3xl font-semibold">Your productivity story</h1>
          <p className="mt-1 text-sm text-muted-foreground">A shareable summary of your growth.</p>
        </div>
        <Tabs value={period} onValueChange={(v) => switchPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="quarter">Quarterly</TabsTrigger>
            <TabsTrigger value="year">Annual</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {q.isPending && <p className="text-sm text-muted-foreground">Generating your Wrapped…</p>}
      {q.error && <p className="text-sm text-destructive">Couldn't load Wrapped.</p>}

      {data && "insufficient" in data && data.insufficient && (
        <Card className="glass"><CardContent className="p-8 text-center">
          <Gift className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-2 font-display text-lg">No Wrapped available yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We need at least {data.requiredDays} active days of activity before generating your Wrapped.
          </p>
          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">Current progress</p>
          <p className="font-display text-3xl text-gradient">{data.daysActive} / {data.requiredDays} Days Collected</p>
        </CardContent></Card>
      )}

      {data && !("insufficient" in data && data.insufficient) && (
        <>
          <div ref={cardRef} className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-[#1a1140] via-[#0f1729] to-[#0a0f1f] p-8 text-foreground">
            <div className="absolute inset-0 -z-10 bg-gradient-aurora opacity-30" />
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                <Gift className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary">Your {period === "year" ? "Annual" : period === "quarter" ? "Quarterly" : "Monthly"} Wrapped</p>
                <p className="font-display text-2xl">FocusFlow AI</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <BigStat icon={GraduationCap} label="Learning hours" value={`${data.totals!.learningHours}h`} tone="primary" />
              <BigStat icon={Dumbbell} label="Fitness hours" value={`${data.totals!.fitnessHours}h`} tone="accent" />
              <BigStat icon={Flame} label="Longest streak" value={`${data.longestStreak} days`} />
              <BigStat icon={Trophy} label="Highest score" value={`${data.highestScore}`} tone="primary" />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <InfoTile label="Most productive day" value={data.bestDay!.date ? new Date(data.bestDay!.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "Log more to unlock"} />
              {data.bestMonth && <InfoTile label="Most productive month" value={`${data.bestMonth.label} (${data.bestMonth.hours}h)`} />}
              <InfoTile label="Most common DNA" value={data.persona ?? "—"} />
              <InfoTile label="FocusFlow score growth" value={`${data.growth!.scoreFrom} → ${data.growth!.scoreTo}`} tone={data.growth!.scoreDelta >= 0 ? "good" : "warn"} />
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-surface/40 p-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Consistency growth</p>
                <p className="mt-1 font-display text-2xl">{data.growth!.consistencyFrom}% → {data.growth!.consistencyTo}%</p>
              </div>
              <TrendingUp className="h-6 w-6 text-success" />
            </div>

            <p className="mt-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">focusflow.ai · Personal growth intelligence</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => cardRef.current && downloadElementAsPng(cardRef.current, cardFilename("Wrapped", `${period}_${new Date().getFullYear()}`))}
            >
              <ImageIcon className="mr-2 h-4 w-4" /> Download PNG
            </Button>
            <Button
              variant="outline"
              onClick={() => cardRef.current && downloadElementAsPdf(cardRef.current, cardFilename("Wrapped", `${period}_${new Date().getFullYear()}`, "pdf"))}
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function BigStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "primary" | "accent" }) {
  const c = tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-foreground";
  return (
    <Card className="glass">
      <CardContent className="p-5">
        <Icon className={`h-5 w-5 ${c}`} />
        <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`mt-1 font-display text-3xl font-semibold ${c}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const cls = tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/40 bg-surface/40 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-lg ${cls}`}>{value}</p>
    </div>
  );
}
