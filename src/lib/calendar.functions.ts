import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function emotionColor(em: string) {
  return ({
    happy: "#facc15", calm: "#3b82f6", excited: "#f97316",
    sad: "#a855f7", angry: "#ef4444", anxious: "#14b8a6",
    tired: "#64748b", frustrated: "#f43f5e", grateful: "#ec4899", confident: "#10b981",
  } as Record<string,string>)[em] ?? "#6b7280";
}

export const getCalendarMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(0).max(11),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { start, end } = monthBounds(data.year, data.month);
    const [actsRes, habitsRes, tasksRes, emoRes] = await Promise.all([
      (context.supabase as any).from("activities")
        .select("activity_date,duration_minutes,score").gte("activity_date", start).lte("activity_date", end),
      (context.supabase as any).from("habit_completions")
        .select("completion_date").gte("completion_date", start).lte("completion_date", end),
      (context.supabase as any).from("tasks")
        .select("completed_at,completed").not("completed_at","is",null)
        .gte("completed_at", start).lte("completed_at", end + "T23:59:59"),
      (context.supabase as any).from("emotion_entries")
        .select("emotion,created_at").gte("created_at", start).lte("created_at", end + "T23:59:59"),
    ]);

    const days: Record<string, any> = {};
    function ensure(d: string) {
      days[d] ??= { date: d, activities: 0, total_minutes: 0, score_sum: 0,
        habits_completed: 0, tasks_completed: 0, emotions: [] as string[] };
      return days[d];
    }

    for (const a of actsRes.data ?? []) {
      const d = ensure(a.activity_date);
      d.activities++; d.total_minutes += a.duration_minutes ?? 0;
      d.score_sum += (a.score ?? 0) * (a.duration_minutes ?? 0);
    }
    for (const h of habitsRes.data ?? []) ensure(h.completion_date).habits_completed++;
    for (const t of tasksRes.data ?? []) {
      if (!t.completed_at) continue;
      ensure(String(t.completed_at).slice(0, 10)).tasks_completed++;
    }
    for (const e of emoRes.data ?? []) {
      ensure(String(e.created_at).slice(0, 10)).emotions.push(e.emotion);
    }

    // Compute per-day FocusFlow-style score 0-100
    const result = Object.values(days).map((d: any) => {
      const weighted = d.total_minutes ? d.score_sum / d.total_minutes : 0; // -10..10
      const baseFromActivities = Math.max(0, Math.min(100, (weighted + 10) * 5)); // 0..100
      const habitBonus = Math.min(20, d.habits_completed * 3);
      const taskBonus = Math.min(10, d.tasks_completed * 2);
      const dayScore = Math.round(Math.max(0, Math.min(100, baseFromActivities * 0.7 + habitBonus + taskBonus)));
      // Dominant emotion
      const counts: Record<string, number> = {};
      for (const em of d.emotions) counts[em] = (counts[em] ?? 0) + 1;
      const dominant = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;
      return {
        ...d,
        score: dayScore,
        score_band: dayScore >= 70 ? "high" : dayScore >= 40 ? "mid" : "low",
        dominant_emotion: dominant,
        emotion_color: dominant ? emotionColor(dominant) : null,
      };
    });

    return { days: result };
  });

export const getDaySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const start = data.date; const end = data.date + "T23:59:59";
    const [actsRes, habRes, tasksRes, emoRes] = await Promise.all([
      (context.supabase as any).from("activities")
        .select("id,name,sub_activity,category,score,duration_minutes").eq("activity_date", start),
      (context.supabase as any).from("habit_completions")
        .select("user_habit_id").eq("completion_date", start),
      (context.supabase as any).from("tasks")
        .select("id,title,priority").eq("completed", true)
        .gte("completed_at", start).lte("completed_at", end),
      (context.supabase as any).from("emotion_entries")
        .select("id,emotion,created_at").gte("created_at", start).lte("created_at", end),
    ]);

    let habitNames: any[] = [];
    if (habRes.data?.length) {
      const ids = habRes.data.map((h: any) => h.user_habit_id);
      const { data: h2 } = await (context.supabase as any).from("user_habits").select("id,name,icon,category").in("id", ids);
      habitNames = h2 ?? [];
    }

    const totalMin = (actsRes.data ?? []).reduce((s: number, a: any) => s + (a.duration_minutes ?? 0), 0);
    const weighted = totalMin ? (actsRes.data ?? []).reduce((s: number, a: any) => s + (a.score ?? 0) * (a.duration_minutes ?? 0), 0) / totalMin : 0;
    const base = Math.max(0, Math.min(100, (weighted + 10) * 5));
    const score = Math.round(Math.max(0, Math.min(100,
      base * 0.7 + Math.min(20, habitNames.length * 3) + Math.min(10, (tasksRes.data?.length ?? 0) * 2)
    )));

    const emotions = emoRes.data ?? [];
    const counts: Record<string, number> = {};
    for (const e of emotions) counts[e.emotion] = (counts[e.emotion] ?? 0) + 1;
    const dominant = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;

    let reflection = "A quiet day. Even rest is part of growth.";
    if (score >= 70) reflection = "Strong, focused day. You executed with intention.";
    else if (score >= 40) reflection = "A balanced day. Steady progress compounds over time.";
    else if (totalMin > 0) reflection = "A lighter day, and that's okay. Small efforts still matter.";

    return {
      date: data.date,
      activities: actsRes.data ?? [],
      habits: habitNames,
      tasks: tasksRes.data ?? [],
      emotions,
      dominant_emotion: dominant,
      score,
      reflection,
    };
  });
