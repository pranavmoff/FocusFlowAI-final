import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAi, requireLovableKey } from "./ai-gateway.server";

const PRODUCTIVE_CATS = new Set(["learning", "work", "fitness", "wellness"]);
const UNPRODUCTIVE_THRESHOLD = -2;

const PeriodSchema = z.object({ period: z.enum(["weekly", "monthly", "yearly"]) });

const NarrativeSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  patterns: z.array(z.string()).max(5),
  recommendations: z.array(z.string()).max(5),
});

type Period = "weekly" | "monthly" | "yearly";

function rangeFor(period: Period) {
  const end = new Date();
  const start = new Date();
  if (period === "weekly") start.setDate(end.getDate() - 6);
  else if (period === "monthly") start.setDate(end.getDate() - 29);
  else start.setDate(end.getDate() - 364);
  return { startStr: start.toISOString().slice(0, 10), endStr: end.toISOString().slice(0, 10), start, end };
}

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PeriodSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { period } = data;
    const { startStr, endStr, start, end } = rangeFor(period);

    const { data: rows, error } = await context.supabase
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date")
      .gte("activity_date", startStr)
      .lte("activity_date", endStr)
      .order("activity_date", { ascending: true });
    if (error) throw new Error(error.message);

    const list = rows ?? [];

    // Totals
    let prodMin = 0, unprodMin = 0, neutralMin = 0;
    const catMap = new Map<string, number>();
    const actMap = new Map<string, { hours: number; productive: boolean }>();
    for (const r of list) {
      const isUnprod = r.score <= UNPRODUCTIVE_THRESHOLD;
      const isProd = !isUnprod && (PRODUCTIVE_CATS.has(r.category) || r.score >= 3);
      if (isUnprod) unprodMin += r.duration_minutes;
      else if (isProd) prodMin += r.duration_minutes;
      else neutralMin += r.duration_minutes;

      catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.duration_minutes);
      const a = actMap.get(r.name) ?? { hours: 0, productive: isProd };
      a.hours += r.duration_minutes / 60;
      actMap.set(r.name, a);
    }

    const totalMin = prodMin + unprodMin + neutralMin;
    const productiveHours = +(prodMin / 60).toFixed(1);
    const unproductiveHours = +(unprodMin / 60).toFixed(1);
    const neutralHours = +(neutralMin / 60).toFixed(1);
    const totalHours = +(totalMin / 60).toFixed(1);
    const productivityPct = totalMin ? Math.round((prodMin / totalMin) * 100) : 0;

    const byCategory = Array.from(catMap.entries())
      .map(([category, min]) => ({ category, hours: +(min / 60).toFixed(1) }))
      .sort((a, b) => b.hours - a.hours);

    const topActivities = Array.from(actMap.entries())
      .map(([name, v]) => ({ name, hours: +v.hours.toFixed(1), productive: v.productive }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    // Per-day or per-bucket series
    const series: { label: string; productive: number; unproductive: number }[] = [];
    if (period === "weekly" || period === "monthly") {
      const days = period === "weekly" ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        const dayRows = list.filter((r: any) => r.activity_date === ds);
        let p = 0, u = 0;
        for (const r of dayRows) {
          if (r.score <= UNPRODUCTIVE_THRESHOLD) u += r.duration_minutes;
          else if (PRODUCTIVE_CATS.has(r.category) || r.score >= 3) p += r.duration_minutes;
        }
        series.push({
          label: period === "weekly" ? d.toLocaleDateString(undefined, { weekday: "short" }) : `${d.getMonth() + 1}/${d.getDate()}`,
          productive: +(p / 60).toFixed(2),
          unproductive: +(u / 60).toFixed(2),
        });
      }
    } else {
      // yearly: 12 monthly buckets
      const buckets = new Map<string, { p: number; u: number; label: string }>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets.set(key, { p: 0, u: 0, label: d.toLocaleDateString(undefined, { month: "short" }) });
      }
      for (const r of list) {
        const key = r.activity_date.slice(0, 7);
        const b = buckets.get(key);
        if (!b) continue;
        if (r.score <= UNPRODUCTIVE_THRESHOLD) b.u += r.duration_minutes;
        else if (PRODUCTIVE_CATS.has(r.category) || r.score >= 3) b.p += r.duration_minutes;
      }
      for (const b of buckets.values()) {
        series.push({ label: b.label, productive: +(b.p / 60).toFixed(2), unproductive: +(b.u / 60).toFixed(2) });
      }
    }

    // AI narrative (best-effort)
    let narrative: z.infer<typeof NarrativeSchema> = {
      headline: list.length ? `Your ${period} snapshot` : "Not enough data yet",
      summary: list.length
        ? `You logged ${totalHours}h over this ${period} window. ${productivityPct}% of your tracked time was productive.`
        : "Log some activities to see your AI-generated report.",
      patterns: [],
      recommendations: list.length ? [] : ["Add a few activities on the Log page to unlock your report."],
    };

    if (list.length >= 3) {
      try {
        const ai = createLovableAi(requireLovableKey());
        const topCat = byCategory.slice(0, 5).map(c => `${c.category}: ${c.hours}h`).join(", ");
        const topAct = topActivities.slice(0, 6).map(a => `${a.name} (${a.hours}h)`).join(", ");
        const { experimental_output } = await generateText({
          model: ai("google/gemini-3-flash-preview"),
          experimental_output: Output.object({ schema: NarrativeSchema }),
          prompt: `You are FocusFlow, a productivity coach. Write a ${period} report.
Range: ${startStr} to ${endStr}
Total: ${totalHours}h tracked. Productive ${productiveHours}h, Unproductive ${unproductiveHours}h, Neutral ${neutralHours}h. Productivity = ${productivityPct}%.
Top categories: ${topCat || "none"}.
Top activities: ${topAct || "none"}.

Style rules: Never use em-dashes. Use commas, periods, or colons instead.

Return:
- headline: punchy 6-10 word title
- summary: 2-3 sentence narrative citing the actual numbers
- patterns: 3-5 specific observations grounded in the data (cite hours)
- recommendations: 3-5 concrete actions for the next ${period === "yearly" ? "quarter" : period === "monthly" ? "month" : "week"}`,
        });
        narrative = experimental_output;
      } catch (e) {
        console.error("[generateReport] AI narrative failed", e);
      }
    }

    return {
      period,
      range: { start: startStr, end: endStr, startLabel: start.toLocaleDateString(), endLabel: end.toLocaleDateString() },
      totals: { totalHours, productiveHours, unproductiveHours, neutralHours, productivityPct, entries: list.length },
      byCategory,
      topActivities,
      series,
      narrative,
    };
  });
