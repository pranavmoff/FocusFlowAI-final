import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAi, requireLovableKey } from "./ai-gateway.server";
import { computeMetrics, type ActivityRow } from "./scoring";

const sb = (s: any) => s as any;

// Minimum activity required before we'll fabricate any DNA identity.
export const DNA_MIN_ACTIVE_DAYS = 7;

const PROFILES = [
  "Deep Learner","Focused Builder","Consistent Performer","Creative Explorer",
  "Sprint Worker","Night Builder","Morning Achiever","Balanced Performer",
  "Goal Crusher","Distracted Achiever",
] as const;

function deriveProfile(m: ReturnType<typeof computeMetrics>, peakHour: number, weekendShare: number): typeof PROFILES[number] {
  if (m.distraction >= 50 && m.productivity >= 45) return "Distracted Achiever";
  if (m.focus >= 70 && m.learning >= 55) return "Deep Learner";
  if (m.deepWorkMin >= 600 && m.focus >= 60) return "Focused Builder";
  if (m.consistency >= 75 && m.productivity >= 60) return "Consistent Performer";
  if (peakHour >= 20) return "Night Builder";
  if (peakHour >= 5 && peakHour <= 10) return "Morning Achiever";
  if (weekendShare > 0.45) return "Sprint Worker";
  if (m.wellness >= 55 && m.productivity >= 50) return "Balanced Performer";
  if (m.learning >= 70) return "Goal Crusher";
  return "Creative Explorer";
}

function activeDayCount(rows: Pick<ActivityRow, "activity_date">[]) {
  return new Set(rows.map(r => r.activity_date)).size;
}

export const generateDna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data } = await sb(context.supabase)
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date,created_at")
      .gte("activity_date", since.toISOString().slice(0, 10));
    const rows = ((data ?? []) as Array<ActivityRow & { created_at: string }>);

    const daysActive = activeDayCount(rows);
    if (daysActive < DNA_MIN_ACTIVE_DAYS) {
      return {
        insufficient: true as const,
        daysActive,
        requiredDays: DNA_MIN_ACTIVE_DAYS,
      };
    }

    const m = computeMetrics(rows, 30);

    // peak hour
    const hourBuckets = new Array(24).fill(0);
    for (const r of rows) {
      const h = new Date(r.created_at).getHours();
      hourBuckets[h] += r.duration_minutes * (r.score > 0 ? 1 : 0);
    }
    let peakHour = 9, peakVal = -1;
    hourBuckets.forEach((v, h) => { if (v > peakVal) { peakVal = v; peakHour = h; } });

    // weekend share
    let weekendMin = 0, totalMin = 0;
    for (const r of rows) {
      const d = new Date(r.activity_date).getDay();
      totalMin += r.duration_minutes;
      if (d === 0 || d === 6) weekendMin += r.duration_minutes;
    }
    const weekendShare = totalMin ? weekendMin / totalMin : 0;

    const profile = deriveProfile(m, peakHour, weekendShare);

    const breakdown = {
      learning: m.learning,
      focus: m.focus,
      consistency: m.consistency,
      fitness: Math.round((m.fitnessMin / (30 * 30)) * 100),
      wellness: m.wellness,
      // Only meaningful when there's actual tracked time; otherwise 0 (not 100).
      distraction_resistance: m.totalMin > 0 ? Math.max(0, 100 - m.distraction) : 0,
    };

    let description = `You are a ${profile}. Keep logging, your DNA refines as we learn more about your patterns.`;
    let strengths: string[] = [];
    let growth_areas: string[] = [];

    try {
      const ai = createLovableAi(requireLovableKey());
      const { experimental_output } = await generateText({
        model: ai("google/gemini-3-flash-preview"),
        experimental_output: Output.object({
          schema: z.object({
            description: z.string().max(400),
            strengths: z.array(z.string().max(80)).min(2).max(4),
            growth_areas: z.array(z.string().max(80)).min(2).max(4),
          }),
        }),
        prompt: `You write Productivity DNA profiles. Tone: insightful, data-driven, second person.
User profile assigned: ${profile}.
Past 30 days metrics:
- Learning: ${m.learning}/100 (${Math.round(m.learningMin/60)}h)
- Focus: ${m.focus}/100 (${Math.round(m.deepWorkMin/60)}h deep work)
- Consistency: ${m.consistency}/100
- Wellness: ${m.wellness}/100 (${Math.round(m.fitnessMin/60)}h fitness)
- Distraction: ${m.distraction}/100 (${m.distractionMin}min)
- Peak productive hour: ${peakHour}:00
- Weekend share: ${Math.round(weekendShare*100)}%

Style rules: Never use em-dashes. Use commas, periods, or colons instead.

Return:
- description: 2-3 sentences explaining this profile for this user, citing one or two numbers.
- strengths: 2-4 short bullets grounded in the metrics.
- growth_areas: 2-4 short bullets, actionable, grounded in the metrics.`,
      });
      description = experimental_output.description;
      strengths = experimental_output.strengths;
      growth_areas = experimental_output.growth_areas;
    } catch (e) { console.error("[dna] ai failed", e); }

    await sb(context.supabase).from("productivity_dna").upsert({
      user_id: context.userId,
      primary_profile: profile,
      description,
      strengths,
      growth_areas,
      breakdown,
      updated_at: new Date().toISOString(),
    });

    const monthKey = new Date().toISOString().slice(0, 7);
    await sb(context.supabase).from("dna_history").upsert({
      user_id: context.userId,
      month_key: monthKey,
      profile,
    }, { onConflict: "user_id,month_key" });

    await sb(context.supabase).from("profiles").update({ persona: profile }).eq("id", context.userId);

    return { insufficient: false as const, profile, description, strengths, growth_areas, breakdown, peakHour, weekendShare };
  });

export const getDna = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data: activityRows } = await sb(context.supabase)
      .from("activities")
      .select("activity_date")
      .gte("activity_date", since.toISOString().slice(0, 10));
    const daysActive = activeDayCount((activityRows ?? []) as Array<{ activity_date: string }>);

    const { data: dna } = await sb(context.supabase)
      .from("productivity_dna").select("*").eq("user_id", context.userId).maybeSingle();
    const { data: history } = await sb(context.supabase)
      .from("dna_history").select("month_key,profile").eq("user_id", context.userId).order("month_key", { ascending: true });

    return {
      dna: daysActive >= DNA_MIN_ACTIVE_DAYS ? dna : null,
      history: (history ?? []) as Array<{ month_key: string; profile: string }>,
      sufficiency: {
        daysActive,
        requiredDays: DNA_MIN_ACTIVE_DAYS,
        sufficient: daysActive >= DNA_MIN_ACTIVE_DAYS,
      },
    };
  });
