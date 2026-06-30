import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeMetrics, derivePersona, type ActivityRow } from "./scoring";

const sb = (s: any) => s as any;

const WRAPPED_PERIODS = ["month", "quarter", "year"] as const;
type WrappedPeriod = (typeof WRAPPED_PERIODS)[number];

function rangeFor(period: WrappedPeriod) {
  const end = new Date();
  const start = new Date();
  if (period === "month") start.setDate(end.getDate() - 29);
  else if (period === "quarter") start.setDate(end.getDate() - 89);
  else start.setDate(end.getDate() - 364);
  return { startStr: start.toISOString().slice(0, 10), endStr: end.toISOString().slice(0, 10), start, end };
}

function minOf(rows: ActivityRow[], pred: (r: ActivityRow) => boolean) {
  return rows.filter(pred).reduce((a, r) => a + r.duration_minutes, 0);
}

function longestStreak(rows: ActivityRow[]): number {
  const days = new Set(rows.filter(r => r.score >= 5).map(r => r.activity_date));
  if (days.size === 0) return 0;
  const sorted = Array.from(days).sort();
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const next = new Date(sorted[i]);
    const diff = Math.round((next.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

export const WRAPPED_MIN_ACTIVE_DAYS = 30;
export const SIMULATOR_MIN_ACTIVE_DAYS = 21;

function activeDays(rows: { activity_date: string }[]) {
  return new Set(rows.map(r => r.activity_date)).size;
}

export const getWrapped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ period: z.enum(WRAPPED_PERIODS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { startStr, endStr, start, end } = rangeFor(data.period);
    const { data: raw } = await sb(context.supabase)
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date")
      .gte("activity_date", startStr)
      .lte("activity_date", endStr);
    const rows = (raw ?? []) as ActivityRow[];

    const days = activeDays(rows);
    if (days < WRAPPED_MIN_ACTIVE_DAYS) {
      return {
        insufficient: true as const,
        daysActive: days,
        requiredDays: WRAPPED_MIN_ACTIVE_DAYS,
        period: data.period,
        range: { start: startStr, end: endStr },
      };
    }


    const learningMin = minOf(rows, r => r.category === "learning" || (r.category === "work" && r.score >= 5));
    const fitnessMin = minOf(rows, r => r.category === "fitness");
    const wellnessMin = minOf(rows, r => r.category === "wellness");
    const entertainmentMin = minOf(rows, r => r.category === "entertainment");

    // Best day
    const byDay = new Map<string, number>();
    for (const r of rows) {
      if (r.score >= 5) byDay.set(r.activity_date, (byDay.get(r.activity_date) ?? 0) + r.duration_minutes * (r.score / 10));
    }
    let bestDay: { date: string | null; score: number } = { date: null, score: 0 };
    for (const [d, s] of byDay.entries()) if (s > bestDay.score) bestDay = { date: d, score: Math.round(s) };

    // Best month (only meaningful for quarter/year)
    const byMonth = new Map<string, number>();
    for (const r of rows) {
      const k = r.activity_date.slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + (r.score > 0 ? r.duration_minutes : 0));
    }
    let bestMonth: { month: string | null; minutes: number } = { month: null, minutes: 0 };
    for (const [m, v] of byMonth.entries()) if (v > bestMonth.minutes) bestMonth = { month: m, minutes: v };

    const metrics = computeMetrics(rows.slice(-7 * 30), Math.min(30, Math.max(7, rows.length / 5 | 0)));
    const persona = derivePersona(metrics);

    // Growth: compare first half vs second half
    const mid = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
    const midStr = mid.toISOString().slice(0, 10);
    const firstHalf = rows.filter(r => r.activity_date < midStr);
    const secondHalf = rows.filter(r => r.activity_date >= midStr);
    const firstMetrics = computeMetrics(firstHalf, Math.max(7, ((mid.getTime() - start.getTime()) / 86400000) | 0));
    const secondMetrics = computeMetrics(secondHalf, Math.max(7, ((end.getTime() - mid.getTime()) / 86400000) | 0));

    const totalProductiveHours = +(rows.filter(r => r.score >= 3).reduce((a, r) => a + r.duration_minutes, 0) / 60).toFixed(1);

    return {
      period: data.period,
      range: { start: startStr, end: endStr },
      totals: {
        entries: rows.length,
        totalProductiveHours,
        learningHours: +(learningMin / 60).toFixed(1),
        fitnessHours: +(fitnessMin / 60).toFixed(1),
        wellnessHours: +(wellnessMin / 60).toFixed(1),
        entertainmentHours: +(entertainmentMin / 60).toFixed(1),
      },
      longestStreak: longestStreak(rows),
      highestScore: metrics.focusFlowScore,
      bestDay,
      bestMonth: bestMonth.month
        ? { label: new Date(bestMonth.month + "-01").toLocaleString(undefined, { month: "long", year: "numeric" }), hours: +(bestMonth.minutes / 60).toFixed(1) }
        : null,
      persona: persona.name,
      growth: {
        scoreFrom: firstMetrics.focusFlowScore,
        scoreTo: secondMetrics.focusFlowScore,
        scoreDelta: secondMetrics.focusFlowScore - firstMetrics.focusFlowScore,
        consistencyFrom: firstMetrics.consistency,
        consistencyTo: secondMetrics.consistency,
      },
    };
  });

const SimSchema = z.object({
  learningDeltaMinPerDay: z.number().min(-240).max(240).default(0),
  fitnessDeltaMinPerDay: z.number().min(-240).max(240).default(0),
  entertainmentDeltaMinPerDay: z.number().min(-240).max(240).default(0),
  wellnessDeltaMinPerDay: z.number().min(-240).max(240).default(0),
});

export const simulateScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SimSchema.parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data: raw } = await sb(context.supabase)
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date")
      .gte("activity_date", since.toISOString().slice(0, 10));
    const rows = (raw ?? []) as ActivityRow[];

    const days = activeDays(rows);
    if (days < SIMULATOR_MIN_ACTIVE_DAYS) {
      return {
        insufficient: true as const,
        daysActive: days,
        requiredDays: SIMULATOR_MIN_ACTIVE_DAYS,
      };
    }

    const current = computeMetrics(rows, 30);

    // Project: synthesize 7 extra days worth of deltas, recompute
    const today = new Date();
    const synth: ActivityRow[] = [...rows];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const push = (mins: number, category: ActivityRow["category"], score: number, name: string) => {
        if (mins > 0) synth.push({ name, category, score, duration_minutes: mins, activity_date: ds });
      };
      push(Math.max(0, data.learningDeltaMinPerDay), "learning", 8, "Simulated learning");
      push(Math.max(0, data.fitnessDeltaMinPerDay), "fitness", 7, "Simulated fitness");
      push(Math.max(0, data.wellnessDeltaMinPerDay), "wellness", 6, "Simulated wellness");
      // Entertainment delta: negative = reducing distraction
      const entMin = data.entertainmentDeltaMinPerDay;
      if (entMin > 0) push(entMin, "entertainment", -3, "Simulated entertainment");
      else if (entMin < 0) {
        // Remove up to |entMin| of entertainment from that day
        let toRemove = Math.abs(entMin);
        for (let j = 0; j < synth.length && toRemove > 0; j++) {
          const r = synth[j];
          if (r.activity_date === ds && r.category === "entertainment" && r.duration_minutes > 0) {
            const cut = Math.min(r.duration_minutes, toRemove);
            synth[j] = { ...r, duration_minutes: r.duration_minutes - cut };
            toRemove -= cut;
          }
        }
      }
    }
    const projected = computeMetrics(synth, 30);
    const projectedPersona = derivePersona(projected);

    const extraLearningHoursPerMonth = +((Math.max(0, data.learningDeltaMinPerDay) * 30) / 60).toFixed(1);

    return {
      current: {
        score: current.focusFlowScore,
        consistency: current.consistency,
        focus: current.focus,
        learningHours: +(current.learningMin / 60).toFixed(1),
      },
      projected: {
        score: projected.focusFlowScore,
        consistency: projected.consistency,
        focus: projected.focus,
        learningHours: +(projected.learningMin / 60).toFixed(1),
        persona: projectedPersona.name,
        extraLearningHoursPerMonth,
      },
      delta: {
        score: projected.focusFlowScore - current.focusFlowScore,
        consistency: projected.consistency - current.consistency,
        focus: projected.focus - current.focus,
      },
    };
  });


export const getTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Look back 6 months
    const since = new Date(); since.setMonth(since.getMonth() - 6);
    const { data: raw } = await sb(context.supabase)
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date")
      .gte("activity_date", since.toISOString().slice(0, 10))
      .order("activity_date", { ascending: true });
    const rows = (raw ?? []) as ActivityRow[];

    const months = new Map<string, ActivityRow[]>();
    for (const r of rows) {
      const k = r.activity_date.slice(0, 7);
      if (!months.has(k)) months.set(k, []);
      months.get(k)!.push(r);
    }

    const entries: Array<{
      month: string;
      label: string;
      persona: string;
      score: number;
      consistency: number;
      learningHours: number;
      fitnessHours: number;
      entries: number;
      milestone: string | null;
    }> = [];

    let prevScore: number | null = null;
    const keys = Array.from(months.keys()).sort();
    for (const k of keys) {
      const monthRows = months.get(k)!;
      const m = computeMetrics(monthRows, 30);
      const persona = derivePersona(m);
      const learningHours = +(m.learningMin / 60).toFixed(1);
      const fitnessHours = +(m.fitnessMin / 60).toFixed(1);

      let milestone: string | null = null;
      if (prevScore !== null) {
        const delta = m.focusFlowScore - prevScore;
        if (delta >= 10) milestone = `Score jumped +${delta} from last month`;
        else if (delta <= -10) milestone = `Score dropped ${delta} from last month`;
      }
      if (!milestone && learningHours >= 40) milestone = "40+ learning hours, deep focus month";
      if (!milestone && monthRows.length >= 60) milestone = "Most active month yet";

      entries.push({
        month: k,
        label: new Date(k + "-01").toLocaleString(undefined, { month: "long", year: "numeric" }),
        persona: persona.name,
        score: m.focusFlowScore,
        consistency: m.consistency,
        learningHours,
        fitnessHours,
        entries: monthRows.length,
        milestone,
      });
      prevScore = m.focusFlowScore;
    }

    return { entries };
  });
