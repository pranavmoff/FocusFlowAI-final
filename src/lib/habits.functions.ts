import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listHabitCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("habit_catalog")
      .select("id,category,name,description,icon,frequency,sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as Array<{
      id: string; category: string; name: string; description: string | null;
      icon: string | null; frequency: string | null; sort_order: number;
    }> };
  });

export const listMyHabits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(); since.setDate(since.getDate() - 60);
    const sinceStr = since.toISOString().slice(0, 10);

    const [habitsRes, completionsRes] = await Promise.all([
      (context.supabase as any).from("user_habits")
        .select("id,name,category,icon,description,frequency,start_date,end_date,archived,created_at")
        .eq("archived", false)
        .order("created_at", { ascending: true }),
      (context.supabase as any).from("habit_completions")
        .select("user_habit_id,completion_date")
        .gte("completion_date", sinceStr),
    ]);
    if (habitsRes.error) throw new Error(habitsRes.error.message);
    if (completionsRes.error) throw new Error(completionsRes.error.message);

    const completionsByHabit = new Map<string, Set<string>>();
    for (const c of completionsRes.data ?? []) {
      if (!completionsByHabit.has(c.user_habit_id)) completionsByHabit.set(c.user_habit_id, new Set());
      completionsByHabit.get(c.user_habit_id)!.add(c.completion_date);
    }

    function streak(set: Set<string>): number {
      let s = 0; const d = new Date();
      while (set.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); if (s > 365) break; }
      return s;
    }
    function longest(set: Set<string>): number {
      const dates: string[] = Array.from(set).sort();
      let best = 0, cur = 0;
      let prev: string | null = null;
      for (const d of dates) {
        if (prev !== null) {
          const prevDate: Date = new Date(prev);
          prevDate.setDate(prevDate.getDate() + 1);
          if (prevDate.toISOString().slice(0, 10) === d) cur++; else cur = 1;
        } else cur = 1;
        if (cur > best) best = cur;
        prev = d;
      }
      return best;
    }

    const items = (habitsRes.data ?? []).map((h: any) => {
      const set = completionsByHabit.get(h.id) ?? new Set<string>();
      const last30 = new Set<string>();
      for (let i = 0; i < 30; i++) { const d = new Date(); d.setDate(d.getDate() - i); last30.add(d.toISOString().slice(0, 10)); }
      const completed30 = Array.from(set).filter(d => last30.has(d)).length;
      return {
        ...h,
        completed_today: set.has(today),
        current_streak: streak(set),
        longest_streak: longest(set),
        completion_rate_30d: Math.round((completed30 / 30) * 100),
        completion_dates: Array.from(set),
      };
    });

    const todayCompleted = items.filter((i: any) => i.completed_today).length;
    const last7 = new Set<string>();
    for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); last7.add(d.toISOString().slice(0, 10)); }
    const week = (completionsRes.data ?? []).filter((c: any) => last7.has(c.completion_date)).length;
    const month = (completionsRes.data ?? []).filter((c: any) => {
      const d = new Date(c.completion_date); const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return { items, scores: { daily: todayCompleted, weekly: week, monthly: month } };
  });

export const addHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    catalog_id: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(1).max(80),
    category: z.string().trim().min(1).max(40),
    icon: z.string().trim().max(40).optional().nullable(),
    description: z.string().trim().max(280).optional().nullable(),
    frequency: z.string().trim().max(20).optional().default("daily"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).from("user_habits").insert({
      user_id: context.userId,
      catalog_id: data.catalog_id ?? null,
      name: data.name, category: data.category, icon: data.icon ?? null,
      description: data.description ?? null, frequency: data.frequency,
      start_date: data.start_date, end_date: data.end_date ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const toggleHabitCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_habit_id: z.string().uuid(),
    completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await (context.supabase as any).from("habit_completions")
      .select("id").eq("user_habit_id", data.user_habit_id).eq("completion_date", data.completion_date).maybeSingle();
    if (existing) {
      const { error } = await (context.supabase as any).from("habit_completions").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { completed: false };
    } else {
      const { error } = await (context.supabase as any).from("habit_completions").insert({
        user_id: context.userId, user_habit_id: data.user_habit_id, completion_date: data.completion_date,
      });
      if (error) throw new Error(error.message);
      return { completed: true };
    }
  });

export const deleteHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("user_habits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
