import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createHash } from "crypto";

// Derive a stable encryption passphrase from the server secret. Never sent to client.
function getEncryptionKey() {
  const seed = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_URL ?? "focusflow-fallback";
  return createHash("sha256").update("ff-journal:" + seed).digest("hex");
}

const EMOTIONS = [
  "happy","calm","excited","sad","angry","anxious","tired","frustrated","grateful","confident"
] as const;

export const addEmotionEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    emotion: z.enum(EMOTIONS),
    note: z.string().max(2000).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    let encrypted: any = null;
    if (data.note && data.note.trim()) {
      const { data: enc, error } = await (context.supabase as any)
        .rpc("encrypt_note", { plain: data.note, key: getEncryptionKey() });
      if (error) throw new Error(error.message);
      encrypted = enc;
    }
    const { data: row, error: insErr } = await (context.supabase as any)
      .from("emotion_entries")
      .insert({ user_id: context.userId, emotion: data.emotion, note_encrypted: encrypted })
      .select("id").single();
    if (insErr) throw new Error(insErr.message);
    return { id: row.id };
  });

export const listEmotionEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("emotion_entries")
      .select("id,emotion,created_at,note_encrypted")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    // Return only metadata + a boolean for has_note. Note content is decrypted on demand.
    return {
      items: (data ?? []).map((r: any) => ({
        id: r.id, emotion: r.emotion, created_at: r.created_at,
        has_note: !!r.note_encrypted,
      })),
    };
  });

export const decryptEmotionNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("emotion_entries")
      .select("id,user_id,note_encrypted")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.user_id !== context.userId) throw new Error("Not found");
    if (!row.note_encrypted) return { note: "" };
    const { data: dec, error: dErr } = await (context.supabase as any)
      .rpc("decrypt_note", { cipher: row.note_encrypted, key: getEncryptionKey() });
    if (dErr) throw new Error(dErr.message);
    return { note: dec ?? "" };
  });

export const deleteEmotionEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("emotion_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getEmotionAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(); since.setDate(since.getDate() - 90);
    const { data, error } = await (context.supabase as any)
      .from("emotion_entries")
      .select("emotion,created_at")
      .gte("created_at", since.toISOString());
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ emotion: string; created_at: string }>;

    const distribution: Record<string, number> = {};
    const byWeekday: Record<string, { positive: number; total: number }> = {};
    const positive = new Set(["happy","calm","excited","grateful","confident"]);
    const WD = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    for (const r of rows) {
      distribution[r.emotion] = (distribution[r.emotion] ?? 0) + 1;
      const wd = WD[new Date(r.created_at).getDay()];
      byWeekday[wd] ??= { positive: 0, total: 0 };
      byWeekday[wd].total++;
      if (positive.has(r.emotion)) byWeekday[wd].positive++;
    }

    const mostCommon = Object.entries(distribution).sort((a,b) => b[1] - a[1])[0]?.[0] ?? null;
    let bestDay: string | null = null; let bestRatio = -1;
    for (const [d, v] of Object.entries(byWeekday)) {
      const r = v.total ? v.positive / v.total : 0;
      if (r > bestRatio) { bestRatio = r; bestDay = d; }
    }

    // Last 30d vs prior 30d positive ratio
    const now = Date.now();
    const last30 = rows.filter(r => now - +new Date(r.created_at) <= 30*86400000);
    const prior30 = rows.filter(r => {
      const dt = now - +new Date(r.created_at);
      return dt > 30*86400000 && dt <= 60*86400000;
    });
    const ratio = (arr: typeof rows) => arr.length ? arr.filter(r => positive.has(r.emotion)).length / arr.length : 0;
    const trend = ratio(last30) - ratio(prior30);

    let reflection = "Every emotion you log is a step toward understanding yourself better.";
    if (trend > 0.05) reflection = "You experienced more positive emotions recently than the month before. Keep going.";
    else if (trend < -0.05) reflection = "It has been a heavier stretch. Progress includes the difficult days too.";
    else if (rows.length > 5) reflection = "You have shown emotional consistency. Self-awareness is a quiet superpower.";

    return {
      distribution, byWeekday, mostCommon, bestDay,
      totalEntries: rows.length, trend, reflection,
    };
  });
