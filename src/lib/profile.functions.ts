import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sb = (s: any) => s as any;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Resolve auth user first so we can derive a name fallback and
    // self-heal a missing profiles row (signups before the trigger, etc).
    const { data: userRes } = await sb(context.supabase).auth.getUser();
    const authUser = userRes?.user ?? null;
    const email: string | null = authUser?.email ?? null;

    const metaName: string | null =
      authUser?.user_metadata?.full_name ??
      authUser?.user_metadata?.name ??
      null;
    const emailPrefix = email ? email.split("@")[0] : null;

    let { data: profile, error } = await sb(context.supabase)
      .from("profiles")
      .select("id, full_name, persona, created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Self-heal: if the trigger never created a row, create one now so the
    // profile page never crashes for a signed-in user.
    if (!profile) {
      const seedName = (metaName && metaName.trim()) || emailPrefix || null;
      const { data: inserted } = await sb(context.supabase)
        .from("profiles")
        .upsert({ id: context.userId, full_name: seedName }, { onConflict: "id" })
        .select("id, full_name, persona, created_at")
        .maybeSingle();
      profile = inserted ?? { id: context.userId, full_name: seedName, persona: null, created_at: null };
    }

    const memberSince: string | null =
      authUser?.created_at ?? profile?.created_at ?? null;

    const resolvedFullName =
      (profile?.full_name && profile.full_name.trim()) ||
      (metaName && metaName.trim()) ||
      emailPrefix ||
      null;

    return {
      profile: { ...profile, full_name: resolvedFullName },
      email,
      memberSince,
    };
  });
