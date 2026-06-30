import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { GitBranch, Sparkles, Trophy } from "lucide-react";
import { getTimeline } from "@/lib/growth.functions";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({ meta: [{ title: "Growth Timeline, FocusFlow AI" }] }),
  component: TimelinePage,
});

function TimelinePage() {
  const fn = useServerFn(getTimeline);
  const q = useQuery({ queryKey: ["timeline"], queryFn: () => fn({}) });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Growth Evolution</p>
        <h1 className="font-display text-3xl font-semibold">Your personal timeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">Month-by-month DNA, score progression, and milestones.</p>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading timeline…</p>}
      {q.data && q.data.entries.length === 0 && (
        <Card className="glass"><CardContent className="p-8 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Log activities across at least one month to see your timeline.</p>
        </CardContent></Card>
      )}

      {q.data && q.data.entries.length > 0 && (
        <div className="relative space-y-6 border-l-2 border-border/60 pl-6">
          {q.data.entries.map((e, i) => (
            <div key={e.month} className="relative">
              <div className="absolute -left-[35px] grid h-6 w-6 place-items-center rounded-full bg-gradient-primary shadow-glow">
                <span className="text-[10px] font-bold text-primary-foreground">{i + 1}</span>
              </div>
              <Card className="glass transition hover:border-primary/40">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{e.label}</p>
                      <p className="font-display text-xl text-gradient">{e.persona}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">FocusFlow</p>
                      <p className="font-display text-2xl">{e.score}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>Consistency <span className="font-semibold text-foreground">{e.consistency}%</span></span>
                    <span>Learning <span className="font-semibold text-foreground">{e.learningHours}h</span></span>
                    <span>Fitness <span className="font-semibold text-foreground">{e.fitnessHours}h</span></span>
                  </div>
                  {e.milestone && (
                    <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">
                      <Trophy className="h-3.5 w-3.5" /> {e.milestone}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
          <div className="relative">
            <div className="absolute -left-[35px] grid h-6 w-6 place-items-center rounded-full bg-surface">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Keep logging to extend your story.</p>
          </div>
        </div>
      )}
    </div>
  );
}
