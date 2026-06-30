import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CATEGORIES = ["learning","work","fitness","wellness","entertainment","personal","social","sleep","other"] as const;

/**
 * Universal goal matcher. Goal progress is driven ENTIRELY by activity-name
 * matching — category alone never advances a goal. The match target is the
 * goal's explicit `activity_name` when set, otherwise its `title`.
 */
function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
export function activityMatchesGoal(
  activity: { name?: string | null; normalized_name?: string | null },
  goal: { title?: string | null; activity_name?: string | null },
): boolean {
  const target = normalize(goal.activity_name) || normalize(goal.title);
  if (!target) return false;
  const a = normalize(activity.normalized_name) || normalize(activity.name);
  if (!a) return false;
  if (a === target) return true;
  // Word-aware substring: match either direction so "Read" hits "Read Book"
  // and "Gym Workout" hits "Gym".
  return a.includes(target) || target.includes(a);
}

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: goals } = await context.supabase
      .from("goals").select("*").eq("active", true).order("created_at", { ascending: false });
    const since = new Date(); since.setDate(since.getDate() - 7);
    const { data: acts } = await context.supabase
      .from("activities")
      .select("name,normalized_name,duration_minutes,activity_date")
      .gte("activity_date", since.toISOString().slice(0, 10));

    const today = new Date().toISOString().slice(0, 10);
    const progress = (goals ?? []).map((g: any) => {
      let achieved = 0;
      for (const a of acts ?? []) {
        if (g.period === "daily" && a.activity_date !== today) continue;
        if (!activityMatchesGoal(a, g)) continue;
        achieved += a.duration_minutes;
      }
      const pct = g.target_minutes > 0
        ? Math.min(100, Math.round((achieved / g.target_minutes) * 100))
        : 0;
      return { ...g, achieved_minutes: achieved, pct };
    });
    return { goals: progress };
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().min(1).max(120),
      category: z.enum(CATEGORIES).nullable(),
      activity_name: z.string().trim().max(120).optional().nullable(),
      target_minutes: z.number().int().min(5).max(1440),
      period: z.enum(["daily", "weekly"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("goals").insert({
      user_id: context.userId,
      title: data.title,
      category: data.category,
      activity_name: data.activity_name?.trim() || null,
      target_minutes: data.target_minutes,
      period: data.period,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goals").update({ active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
