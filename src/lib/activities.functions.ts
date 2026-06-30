import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAi, requireLovableKey } from "./ai-gateway.server";
import type { Category, ActivityRow } from "./scoring";
import { computeMetrics, derivePersona } from "./scoring";

const CATEGORIES = ["learning","work","fitness","wellness","entertainment","personal","social","sleep","other"] as const;

/** Deterministic keyword fallback so common activities never get stuck in "other".
 *  Returns null if no keyword matches. Order matters: most specific first. */
function keywordClassify(name: string): { category: Category; score: number } | null {
  const n = ` ${name.toLowerCase()} `;
  const has = (...words: string[]) => words.some(w => n.includes(` ${w} `) || n.includes(`${w} `) || n.includes(` ${w}`) || n === ` ${w} `);
  if (has("gym","workout","run","running","jog","jogging","cycling","cycle","yoga","swim","swimming","fitness","exercise","cardio","lifting","weights","sports","football","basketball","cricket","tennis","badminton","walk","walking","hike","hiking")) return { category: "fitness", score: 8 };
  if (has("sleep","sleeping","nap","rest")) return { category: "sleep", score: 5 };
  if (has("meditate","meditation","journaling","journal","breathwork","therapy","mindfulness","stretching","stretch")) return { category: "wellness", score: 7 };
  if (has("study","studying","read","reading","learn","learning","course","lecture","tutorial","homework","revision","practice","coding","programming","leetcode")) return { category: "learning", score: 9 };
  if (has("work","working","meeting","email","emails","office","project","client","deepwork","standup","review","design","writing","build","building","ship","shipping")) return { category: "work", score: 7 };
  if (has("instagram","insta","reels","reel","tiktok","youtube","shorts","netflix","movie","movies","series","tv","show","gaming","game","games","scroll","scrolling","twitter","x")) return { category: "entertainment", score: -5 };
  if (has("family","mom","dad","parents","temple","prayer","pray","grocery","groceries","cooking","cook","cleaning","clean","laundry","chores","shopping","errands")) return { category: "personal", score: 5 };
  if (has("friends","party","hangout","date","dinner","lunch","brunch","social","call","catchup")) return { category: "social", score: 4 };
  return null;
}

/** Add a single activity. Saves immediately; AI classification runs in background. */
export const addActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      activity_name: z.string().trim().min(1).max(120),
      sub_activity: z.string().trim().max(120).optional().nullable(),
      hours: z.number().min(0).max(24).optional(),
      minutes: z.number().int().min(0).max(1440).optional(),
      activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).refine(v => (v.minutes ?? 0) > 0 || (v.hours ?? 0) > 0, { message: "Duration required" }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const normalized = data.activity_name.trim().toLowerCase();
    const duration_minutes = data.minutes != null ? Math.floor(data.minutes) : Math.round((data.hours ?? 0) * 60);
    if (duration_minutes <= 0 || duration_minutes > 1440) throw new Error("Duration must be between 1 minute and 24 hours");

    let category: Category = "other";
    let score = 0;

    const { data: exact } = await context.supabase
      .from("activity_dataset")
      .select("category,score")
      .eq("activity_name", normalized)
      .maybeSingle();
    if (exact) { category = exact.category; score = exact.score; }
    else {
      const { data: kb } = await context.supabase
        .from("activity_knowledge_base")
        .select("category,score")
        .eq("activity_name", normalized)
        .maybeSingle();
      if (kb) { category = kb.category; score = kb.score; }
    }
    // Deterministic keyword fallback — guarantees common activities land in
    // the right category even if dataset/kb lookups return nothing or fail.
    if (category === "other" && score === 0) {
      const kw = keywordClassify(normalized);
      if (kw) { category = kw.category; score = kw.score; }
    }

    const { data: inserted, error } = await (context.supabase as any)
      .from("activities")
      .insert({
        user_id: context.userId,
        name: data.activity_name.trim(),
        sub_activity: data.sub_activity?.trim() || null,
        normalized_name: normalized,
        category,
        score,
        duration_minutes,
        activity_date: data.activity_date,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: inserted!.id, needsClassification: category === "other" && score === 0 };
  });

/** Background-classify a stored activity. Failures are swallowed — saving must never depend on AI. */
export const classifyActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { data: row } = await context.supabase
        .from("activities")
        .select("id,normalized_name,category,score")
        .eq("id", data.id)
        .maybeSingle();
      if (!row) return { ok: false };
      if (row.category !== "other" || row.score !== 0) return { ok: true, cached: true };

      const name = row.normalized_name;

      // 1. Deterministic keyword fallback — fastest, never fails.
      const kw0 = keywordClassify(name);
      if (kw0) {
        await context.supabase.from("activities").update({ category: kw0.category, score: kw0.score }).eq("id", row.id);
        await context.supabase.from("activity_knowledge_base")
          .insert({ activity_name: name, category: kw0.category, score: kw0.score, confidence: 0.9, source: "keyword" })
          .then(() => {}, () => {});
        return { ok: true };
      }

      // 2. dataset keyword overlap
      const tokens = name.split(/\s+/).filter((t: string) => t.length > 2);
      if (tokens.length) {
        const { data: kw } = await context.supabase
          .from("activity_dataset")
          .select("category,score")
          .overlaps("keywords", tokens)
          .limit(1);
        if (kw && kw.length) {
          await context.supabase.from("activities").update({ category: kw[0].category, score: kw[0].score }).eq("id", row.id);
          return { ok: true };
        }
      }

      // Gemini fallback
      const ai = createLovableAi(requireLovableKey());
      const { experimental_output } = await generateText({
        model: ai("google/gemini-3-flash-preview"),
        experimental_output: Output.object({
          schema: z.object({
            category: z.enum(CATEGORIES),
            score: z.number().int().min(-10).max(10),
          }),
        }),
        prompt: `Classify the activity "${name}" for a productivity tracker.
Categories: learning, work, fitness, wellness, entertainment, personal, social, sleep, other.
Score: -10 (very distracting) to +10 (deeply productive).
Examples: study=+10, gym=+8, instagram=-5, reels=-8, meditation=+7, sleep=+5.`,
      });

      await context.supabase
        .from("activity_knowledge_base")
        .insert({ activity_name: name, category: experimental_output.category, score: experimental_output.score, confidence: 0.7, source: "gemini" })
        .then(() => {}, () => {});
      await context.supabase
        .from("activities")
        .update({ category: experimental_output.category, score: experimental_output.score })
        .eq("id", row.id);
      return { ok: true };
    } catch (e) {
      console.error("[classifyActivity] failed", e);
      return { ok: false };
    }
  });

/** Update name / hours / date of an existing activity. Triggers re-classification if name changed. */
export const updateActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      activity_name: z.string().trim().min(1).max(120),
      sub_activity: z.string().trim().max(120).optional().nullable(),
      hours: z.number().min(0).max(24).optional(),
      minutes: z.number().int().min(0).max(1440).optional(),
      activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).refine(v => (v.minutes ?? 0) > 0 || (v.hours ?? 0) > 0, { message: "Duration required" }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const normalized = data.activity_name.trim().toLowerCase();
    const { data: existing } = await context.supabase
      .from("activities").select("normalized_name").eq("id", data.id).maybeSingle();
    const nameChanged = !existing || existing.normalized_name !== normalized;

    const duration_minutes = data.minutes != null ? Math.floor(data.minutes) : Math.round((data.hours ?? 0) * 60);
    if (duration_minutes <= 0 || duration_minutes > 1440) throw new Error("Duration must be between 1 minute and 24 hours");

    const patch: any = {
      name: data.activity_name.trim(),
      sub_activity: data.sub_activity?.trim() || null,
      normalized_name: normalized,
      duration_minutes,
      activity_date: data.activity_date,
    };
    if (nameChanged) { patch.category = "other"; patch.score = 0; }

    const { error } = await (context.supabase as any).from("activities").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id, needsClassification: nameChanged };
  });

/** Delete an activity. */
export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("activities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Dashboard data: last 30 days + computed metrics. */
export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data, error } = await context.supabase
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date,created_at")
      .gte("activity_date", since.toISOString().slice(0, 10))
      .order("activity_date", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ActivityRow[];

    const last7 = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      last7.add(d.toISOString().slice(0, 10));
    }
    const week = rows.filter(r => last7.has(r.activity_date));
    const metrics = computeMetrics(week, 7);
    const persona = derivePersona(metrics);

    let streak = 0;
    {
      const productiveDays = new Set(rows.filter(r => r.score >= 5).map(r => r.activity_date));
      const d = new Date();
      while (productiveDays.has(d.toISOString().slice(0, 10))) {
        streak++; d.setDate(d.getDate() - 1);
      }
    }

    return { rows, metrics, persona, streak };
  });

/** Recent activities feed — no internal fields exposed in UI, but include them for edit prefill. */
export const listRecentActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("activities")
      .select("id,name,sub_activity,category,score,duration_minutes,activity_date,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
