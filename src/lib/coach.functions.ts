import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAi, requireLovableKey } from "./ai-gateway.server";
import { computeMetrics, derivePersona, type ActivityRow } from "./scoring";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const coachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ messages: z.array(MessageSchema).min(1).max(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Pull last 30 days of activity data for grounding
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data: rowsRaw } = await context.supabase
      .from("activities")
      .select("name,category,score,duration_minutes,activity_date")
      .gte("activity_date", since.toISOString().slice(0, 10));
    const rows = (rowsRaw ?? []) as ActivityRow[];

    const last7Set = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      last7Set.add(d.toISOString().slice(0, 10));
    }
    const week = rows.filter(r => last7Set.has(r.activity_date));
    const m = computeMetrics(week, 7);
    const persona = derivePersona(m);

    // Summary string the model can reason about
    const byCat = new Map<string, number>();
    for (const r of week) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.duration_minutes);
    const catSummary = Array.from(byCat.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${Math.round(v / 60 * 10) / 10}h`).join(", ");

    const topDistractions = week
      .filter(r => r.score <= -3)
      .reduce<Record<string, number>>((acc, r) => { acc[r.name] = (acc[r.name] ?? 0) + r.duration_minutes; return acc; }, {});
    const distractList = Object.entries(topDistractions)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k, v]) => `${k} (${v}m)`).join(", ") || "none significant";

    const system = `You are FocusFlow Coach, the AI productivity coach inside FocusFlow AI.
Be concrete, direct, and warm. Reference the user's actual numbers. Never give generic motivational quotes.
If they ask "why was X low", point to actual data. Keep responses under 180 words. Use short paragraphs and bullet points.
Style rules: Never use em-dashes. Use commas, periods, or colons instead.

User's last 7 days:
- FocusFlow Score: ${m.focusFlowScore}/100
- Productivity ${m.productivity}, Consistency ${m.consistency}, Focus ${m.focus}, Wellness ${m.wellness}
- Time by category: ${catSummary || "no data yet"}
- Learning: ${Math.round(m.learningMin/60*10)/10}h, Deep work: ${Math.round(m.deepWorkMin/60*10)/10}h
- Top distractions: ${distractList}
- Persona: ${persona.name}, ${persona.reason}`;

    const ai = createLovableAi(requireLovableKey());
    const { text } = await generateText({
      model: ai("google/gemini-3-flash-preview"),
      system,
      messages: data.messages,
    });
    return { reply: text };
  });
