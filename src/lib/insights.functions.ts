import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAi, requireLovableKey } from "./ai-gateway.server";
import { computeMetrics, type ActivityRow } from "./scoring";

const InsightsSchema = z.object({
  headline: z.string(),
  daily_summary: z.string(),
  weekly_analysis: z.string(),
  patterns: z.array(z.string()).max(6),
  recommendations: z.array(z.string()).max(5),
  action_plan: z.array(z.string()).max(5),
});

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data } = await context.supabase
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date")
      .gte("activity_date", since.toISOString().slice(0, 10));
    const rows = (data ?? []) as ActivityRow[];

    const last7 = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      last7.add(d.toISOString().slice(0, 10));
    }
    const week = rows.filter(r => last7.has(r.activity_date));
    const activeDays = new Set(week.map(r => r.activity_date)).size;

    if (activeDays < 7) {
      return {
        headline: "No AI Insights Available Yet",
        daily_summary: "",
        weekly_analysis: `We need at least 7 active days of data before generating insights. Current progress: ${activeDays} / 7 days collected.`,
        patterns: [],
        recommendations: ["Log activities daily for a full week to unlock personalized insights."],
        action_plan: [],
      };
    }

    const m = computeMetrics(week, 7);


    const byDay = new Map<string, { score: number; min: number }>();
    for (const r of week) {
      const e = byDay.get(r.activity_date) ?? { score: 0, min: 0 };
      e.min += r.duration_minutes;
      e.score += r.duration_minutes * (r.score / 10);
      byDay.set(r.activity_date, e);
    }
    const daySummary = Array.from(byDay.entries()).sort()
      .map(([d, v]) => `${d}: ${Math.round(v.min)}min, signal=${Math.round(v.score)}`).join("\n");

    const distractList = week.filter(r => r.score <= -3)
      .reduce<Record<string, number>>((acc, r) => { acc[r.name] = (acc[r.name] ?? 0) + r.duration_minutes; return acc; }, {});
    const topDistract = Object.entries(distractList).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, v]) => `${k}: ${v}min`).join(", ") || "none";

    const ai = createLovableAi(requireLovableKey());
    const { experimental_output } = await generateText({
      model: ai("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: InsightsSchema }),
      prompt: `Analyze this user's last 7 days for a productivity intelligence platform.
Be specific, cite actual hours and trends from the data. No generic motivational fluff.
Style rules: Never use em-dashes. Use commas, periods, or colons instead.

Metrics: FocusFlow=${m.focusFlowScore}, productivity=${m.productivity}, consistency=${m.consistency}, focus=${m.focus}, wellness=${m.wellness}, distraction=${m.distraction}
Learning ${Math.round(m.learningMin/60*10)/10}h, deep work ${Math.round(m.deepWorkMin/60*10)/10}h, fitness ${Math.round(m.fitnessMin/60*10)/10}h, distractions ${m.distractionMin}min.
Top distractions: ${topDistract}.
Per-day:
${daySummary}

Produce: a short headline, daily_summary (1-2 sentences for today/most recent day), weekly_analysis (3-4 sentences), 3-5 concrete patterns observed (cite numbers), 3-5 personalized recommendations, and 3-5 action plan steps for tomorrow.`,
    });

    // persist
    await context.supabase.from("ai_insights").insert({
      user_id: context.userId,
      period: "weekly",
      content: experimental_output,
    }).then(() => {}, () => {});

    return experimental_output;
  });
