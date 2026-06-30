import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dna, Sparkles, TrendingUp, Download, Brain } from "lucide-react";
import { generateDna, getDna } from "@/lib/dna.functions";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { downloadElementAsPng, cardFilename } from "@/lib/downloads";

export const Route = createFileRoute("/_authenticated/dna")({
  head: () => ({ meta: [{ title: "Productivity DNA, FocusFlow AI" }] }),
  component: DnaPage,
});

function DnaPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getDna);
  const genFn = useServerFn(generateDna);
  const cardRef = useRef<HTMLDivElement>(null);

  const q = useQuery({ queryKey: ["dna"], queryFn: () => getFn({}) });
  const gen = useMutation({
    mutationFn: () => genFn({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dna"] }),
  });

  const dna = q.data?.dna;
  const history = q.data?.history ?? [];
  const sufficiency = q.data?.sufficiency;
  const sufficient = sufficiency?.sufficient ?? false;
  const daysActive = sufficiency?.daysActive ?? 0;
  const requiredDays = sufficiency?.requiredDays ?? 7;

  const radarData = dna ? Object.entries(dna.breakdown ?? {}).map(([k, v]) => ({
    metric: k.replace("_", " "),
    value: Math.max(0, Math.min(100, Number(v) || 0)),
  })) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Identity</p>
          <h1 className="font-display text-3xl font-semibold">Productivity DNA</h1>
          <p className="text-sm text-muted-foreground">AI-generated identity based on the last 30 days of your activity.</p>
        </div>
        <div className="flex gap-2">
          {dna && (
            <Button variant="outline" onClick={() => cardRef.current && downloadElementAsPng(cardRef.current, cardFilename("DNA", dna.primary_profile))}>
              <Download className="mr-2 h-4 w-4" /> Save card
            </Button>
          )}
          {sufficient && (
            <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="bg-gradient-primary text-primary-foreground">
              <Sparkles className="mr-2 h-4 w-4" />{gen.isPending ? "Analyzing…" : dna ? "Recompute DNA" : "Generate my DNA"}
            </Button>
          )}
        </div>
      </header>

      {!sufficient && (
        <Card className="glass"><CardContent className="p-8 text-center">
          <Dna className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-2 font-display text-lg">No Productivity DNA Available Yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We need at least {requiredDays} active days of productivity data before generating your Productivity DNA.
          </p>
          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">Current progress</p>
          <p className="font-display text-3xl text-gradient">{daysActive} / {requiredDays} Days Collected</p>
        </CardContent></Card>
      )}

      {sufficient && !dna && (
        <Card className="glass"><CardContent className="p-8 text-center">
          <Dna className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-2 font-display text-lg">Ready to generate your DNA</p>
          <p className="text-sm text-muted-foreground">You have enough data. Click "Generate my DNA" to build your profile.</p>
        </CardContent></Card>
      )}

      {dna && (
        <>
          <Card className="glass overflow-hidden">
            <div className="bg-gradient-primary p-6 text-primary-foreground">
              <p className="text-xs uppercase tracking-widest opacity-80">Primary profile</p>
              <h2 className="font-display text-4xl font-bold">{dna.primary_profile}</h2>
            </div>
            <CardContent className="p-6">
              <p className="leading-relaxed">{dna.description}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass">
              <CardHeader><CardTitle>DNA breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                      <Radar dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.45} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-2">
                  {Object.entries(dna.breakdown ?? {}).map(([k, v]) => (
                    <li key={k}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="capitalize text-muted-foreground">{k.replace("_", " ")}</span>
                        <span className="tabular-nums">{Math.round(Number(v))}/100</span>
                      </div>
                      <Progress value={Math.max(0, Math.min(100, Number(v)))} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="glass">
                <CardHeader><CardTitle>Strengths</CardTitle></CardHeader>
                <CardContent><ul className="list-inside list-disc space-y-1 text-sm">{(dna.strengths ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></CardContent>
              </Card>
              <Card className="glass">
                <CardHeader><CardTitle>Growth areas</CardTitle></CardHeader>
                <CardContent><ul className="list-inside list-disc space-y-1 text-sm">{(dna.growth_areas ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></CardContent>
              </Card>
            </div>
          </div>

          {/* Shareable DNA card */}
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <div ref={cardRef} className="relative" style={{
              aspectRatio: "1.91/1", padding: 40, color: "#f5f7fb",
              background: "linear-gradient(135deg, oklch(0.2 0.04 270), oklch(0.16 0.04 220))",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#34d3a3,#b985ff)", display: "grid", placeItems: "center" }}>
                  <Brain size={18} color="#0f1729" />
                </div>
                <span style={{ fontFamily: "Space Grotesk, Inter, sans-serif", fontWeight: 600 }}>FocusFlow AI</span>
              </div>
              <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7 }}>Productivity DNA</div>
              <div style={{ fontFamily: "Space Grotesk, Inter, sans-serif", fontSize: 48, fontWeight: 700, lineHeight: 1.05, marginTop: 4 }}>
                {dna.primary_profile}
              </div>
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85, maxWidth: 520, lineHeight: 1.5 }}>
                {String(dna.description).slice(0, 180)}
              </div>
              <div style={{ position: "absolute", bottom: 16, right: 24, fontSize: 11, opacity: 0.6 }}>focusflow.ai</div>
            </div>
          </div>

          <Card className="glass">
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Monthly evolution</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Your DNA timeline will fill in as months progress.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-border/60 pl-4">
                  {history.map(h => (
                    <li key={h.month_key} className="relative">
                      <span className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">{h.month_key}</p>
                      <p className="font-medium">{h.profile}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
