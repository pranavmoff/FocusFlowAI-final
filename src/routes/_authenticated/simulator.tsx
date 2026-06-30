import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { FlaskConical, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { simulateScenario } from "@/lib/growth.functions";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({ meta: [{ title: "AI Productivity Simulator, FocusFlow AI" }] }),
  component: SimulatorPage,
});

function SimulatorPage() {
  const [learning, setLearning] = useState(0);
  const [fitness, setFitness] = useState(0);
  const [entertainment, setEntertainment] = useState(0);
  const [wellness, setWellness] = useState(0);

  const fn = useServerFn(simulateScenario);
  const sim = useMutation({
    mutationFn: () => fn({ data: {
      learningDeltaMinPerDay: learning,
      fitnessDeltaMinPerDay: fitness,
      entertainmentDeltaMinPerDay: entertainment,
      wellnessDeltaMinPerDay: wellness,
    } }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">AI Simulator</p>
        <h1 className="font-display text-3xl font-semibold">What if you changed your habits?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Predict your score, consistency, and DNA based on your last 30 days.</p>
      </header>

      <Card className="glass">
        <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Adjust your day</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <SliderRow label="Learning" unit="min/day" value={learning} setValue={setLearning} min={-120} max={120} />
          <SliderRow label="Fitness" unit="min/day" value={fitness} setValue={setFitness} min={-90} max={90} />
          <SliderRow label="Wellness" unit="min/day" value={wellness} setValue={setWellness} min={-60} max={120} />
          <SliderRow label="Entertainment" unit="min/day (negative = reduce)" value={entertainment} setValue={setEntertainment} min={-180} max={180} />
          <Button onClick={() => sim.mutate()} disabled={sim.isPending} className="bg-gradient-primary text-primary-foreground">
            <Sparkles className="mr-2 h-4 w-4" /> {sim.isPending ? "Predicting…" : "Run AI prediction"}
          </Button>
        </CardContent>
      </Card>

      {sim.data && "insufficient" in sim.data && sim.data.insufficient && (
        <Card className="glass"><CardContent className="p-8 text-center">
          <FlaskConical className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-2 font-display text-lg">Simulator not available yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We need at least {sim.data.requiredDays} active days of data before running a prediction.
          </p>
          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">Current progress</p>
          <p className="font-display text-3xl text-gradient">{sim.data.daysActive} / {sim.data.requiredDays} Days Collected</p>
        </CardContent></Card>
      )}

      {sim.data && !("insufficient" in sim.data && sim.data.insufficient) && (
        <Card className="glass-strong">
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /> Predicted outcome</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Compare label="FocusFlow Score" from={sim.data.current!.score} to={sim.data.projected!.score} />
              <Compare label="Consistency" from={sim.data.current!.consistency} to={sim.data.projected!.consistency} suffix="%" />
              <Compare label="Focus" from={sim.data.current!.focus} to={sim.data.projected!.focus} suffix="%" />
            </div>
            <div className="rounded-2xl border border-border/40 bg-surface/40 p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Expected DNA</p>
              <p className="mt-1 font-display text-2xl text-gradient">{sim.data.projected!.persona}</p>
            </div>
            {sim.data.projected!.extraLearningHoursPerMonth > 0 && (
              <p className="text-sm text-muted-foreground">
                Additional learning time: <span className="font-semibold text-foreground">+{sim.data.projected!.extraLearningHoursPerMonth} hours / month</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SliderRow({ label, unit, value, setValue, min, max }: { label: string; unit: string; value: number; setValue: (v: number) => void; min: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          <span className={`font-mono ${value > 0 ? "text-success" : value < 0 ? "text-warning" : ""}`}>{value > 0 ? "+" : ""}{value}</span> {unit}
        </p>
      </div>
      <Slider value={[value]} onValueChange={([v]) => setValue(v)} min={min} max={max} step={5} className="mt-2" />
    </div>
  );
}

function Compare({ label, from, to, suffix = "" }: { label: string; from: number; to: number; suffix?: string }) {
  const delta = to - from;
  const positive = delta >= 0;
  return (
    <div className="rounded-2xl border border-border/40 bg-surface/40 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-2 font-display text-2xl">
        <span className="text-muted-foreground">{from}{suffix}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span className={positive ? "text-success" : "text-warning"}>{to}{suffix}</span>
      </div>
      <p className={`mt-1 text-xs ${positive ? "text-success" : "text-warning"}`}>{positive ? "+" : ""}{delta}{suffix}</p>
    </div>
  );
}
