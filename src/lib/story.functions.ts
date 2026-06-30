import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAi, requireLovableKey } from "./ai-gateway.server";
import { computeMetrics, type ActivityRow } from "./scoring";

const sb = (s: any) => s as any;

type Period = "weekly" | "monthly" | "yearly";

function periodRange(period: Period): { start: Date; end: Date; key: string; label: string } {
  const end = new Date();
  const start = new Date();
  if (period === "weekly") {
    start.setDate(end.getDate() - 6);
    return { start, end, key: `${end.getFullYear()}-W${weekNum(end)}`, label: `Week of ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` };
  }
  if (period === "monthly") {
    start.setMonth(end.getMonth(), 1);
    return { start, end, key: end.toISOString().slice(0, 7), label: end.toLocaleString(undefined, { month: "long", year: "numeric" }) };
  }
  start.setMonth(0, 1);
  return { start, end, key: String(end.getFullYear()), label: `${end.getFullYear()} Year in Review` };
}
function weekNum(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return String(Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)).padStart(2, "0");
}

export const STORY_MIN_MEANINGFUL_ENTRIES = 14;

export const generateStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ period: z.enum(["weekly", "monthly", "yearly"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { start, end, key, label } = periodRange(data.period);
    const { data: rows } = await sb(context.supabase)
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date")
      .gte("activity_date", start.toISOString().slice(0, 10))
      .lte("activity_date", end.toISOString().slice(0, 10));
    const list = (rows ?? []) as ActivityRow[];

    const meaningfulEntries = list.filter(r => r.duration_minutes >= 10 && r.score !== 0).length;
    if (meaningfulEntries < STORY_MIN_MEANINGFUL_ENTRIES) {
      return {
        insufficient: true as const,
        meaningfulEntries,
        requiredEntries: STORY_MIN_MEANINGFUL_ENTRIES,
        period: data.period,
        label,
      };
    }

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const m = computeMetrics(list, days);

    // goals completed within period
    const { data: goals } = await sb(context.supabase).from("goals").select("id,title,target_minutes,category,period").eq("user_id", context.userId);
    const completedGoals = (goals ?? []).filter((g: any) => {
      const min = list.filter(r => !g.category || r.category === g.category).reduce((a, r) => a + r.duration_minutes, 0);
      return min >= g.target_minutes;
    }).length;

    const longestStreak = (() => {
      const days = new Set(list.filter(r => r.score >= 5).map(r => r.activity_date));
      let best = 0, cur = 0; const all = Array.from(days).sort();
      let prev: Date | null = null;
      for (const d of all) {
        const cd = new Date(d);
        if (prev && (cd.getTime() - prev.getTime()) === 86400000) cur++; else cur = 1;
        best = Math.max(best, cur); prev = cd;
      }
      return best;
    })();

    const stats = {
      total_hours: Math.round(m.totalMin / 60),
      learning_hours: Math.round(m.learningMin / 60),
      deep_work_hours: Math.round(m.deepWorkMin / 60),
      fitness_hours: Math.round(m.fitnessMin / 60),
      focusflow_score: m.focusFlowScore,
      consistency: m.consistency,
      completed_goals: completedGoals,
      longest_streak: longestStreak,
      period_label: label,
    };

    let narrative = `In ${label} you logged ${stats.total_hours} hours across ${list.length} activities.`;
    if (list.length === 0) {
      narrative = `No activity logged in ${label}. Log a few days to unlock your story.`;
    } else {
      try {
        const ai = createLovableAi(requireLovableKey());
        const { text } = await generateText({
          model: ai("google/gemini-3-flash-preview"),
          prompt: `Write a ${data.period} productivity narrative for the user. Tone: professional, insightful, second person, data-driven.
Period: ${label}.
Stats:
- Total hours: ${stats.total_hours}
- Learning hours: ${stats.learning_hours}
- Deep work hours: ${stats.deep_work_hours}
- Fitness hours: ${stats.fitness_hours}
- FocusFlow score: ${stats.focusflow_score}/100
- Consistency: ${stats.consistency}/100
- Goals completed: ${completedGoals}
- Longest streak in window: ${longestStreak} days
- Activities logged: ${list.length}

Style rules: Never use em-dashes. Use commas, periods, or colons instead.

Write 4-7 sentences in flowing prose. Cite real numbers. No bullet points, no markdown headers, no motivational fluff. End with a forward-looking observation about momentum.`,
        });
        narrative = text.trim();
      } catch (e) { console.error("[story] ai failed", e); }
    }

    await sb(context.supabase).from("life_stories").upsert({
      user_id: context.userId,
      period_type: data.period,
      period_key: key,
      narrative,
      stats,
    }, { onConflict: "user_id,period_type,period_key" });

    return { period: data.period, key, label, narrative, stats };
  });

export const listStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await sb(context.supabase)
      .from("life_stories")
      .select("id,period_type,period_key,narrative,stats,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    return { stories: (data ?? []) as Array<{ id: string; period_type: Period; period_key: string; narrative: string; stats: any; created_at: string }> };
  });
