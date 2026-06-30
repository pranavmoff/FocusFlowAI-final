import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: tasks, error } = await (context.supabase as any)
      .from("tasks")
      .select("id,title,description,priority,due_date,estimated_minutes,completed,completed_at,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (tasks ?? []).map((t: any) => t.id);
    let subs: any[] = [];
    if (ids.length) {
      const { data: s } = await (context.supabase as any)
        .from("subtasks").select("id,task_id,title,completed,position").in("task_id", ids).order("position", { ascending: true });
      subs = s ?? [];
    }
    const byTask = new Map<string, any[]>();
    for (const s of subs) {
      if (!byTask.has(s.task_id)) byTask.set(s.task_id, []);
      byTask.get(s.task_id)!.push(s);
    }
    return {
      items: (tasks ?? []).map((t: any) => {
        const st = byTask.get(t.id) ?? [];
        const done = st.filter(s => s.completed).length;
        const pct = st.length ? Math.round((done / st.length) * 100) : (t.completed ? 100 : 0);
        return { ...t, subtasks: st, progress: pct };
      }),
    };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    priority: z.enum(["low","medium","high"]).default("medium"),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    estimated_minutes: z.number().int().min(0).max(1440).optional().nullable(),
    subtasks: z.array(z.string().trim().min(1).max(160)).max(20).optional().default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await (context.supabase as any).from("tasks").insert({
      user_id: context.userId, title: data.title,
      description: data.description ?? null, priority: data.priority, due_date: data.due_date ?? null,
      estimated_minutes: data.estimated_minutes ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    if (data.subtasks && data.subtasks.length) {
      const payload = data.subtasks.map((title, i) => ({
        task_id: t.id, user_id: context.userId, title, position: i,
      }));
      await (context.supabase as any).from("subtasks").insert(payload);
    }
    return { id: t.id };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("tasks").update({
      completed: data.completed, completed_at: data.completed ? new Date().toISOString() : null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSubtask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("subtasks").update({ completed: data.completed }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
