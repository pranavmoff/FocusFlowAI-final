import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, CalendarDays, Sparkles, KeyRound } from "lucide-react";
import { getMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "My Profile, FocusFlow AI" }] }),
  component: ProfilePage,
});

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return "—"; }
}

function daysSince(iso: string | null) {
  if (!iso) return 0;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}

function ProfilePage() {
  const getFn = useServerFn(getMyProfile);
  const me = useQuery({ queryKey: ["my-profile"], queryFn: () => getFn({}) });

  if (me.isLoading) {
    return <p className="text-muted-foreground">Loading your profile…</p>;
  }
  if (me.error || !me.data) {
    return <p className="text-destructive">Couldn't load your profile. Please sign in again.</p>;
  }

  const fullName = me.data.profile?.full_name?.trim() || "Not set yet";
  const email = me.data.email || "Email unavailable";
  const memberSince = me.data.memberSince ?? null;
  const days = daysSince(memberSince);
  const memberSinceLabel = memberSince ? formatDate(memberSince) : "Just now";
  const daysLabel = memberSince ? `${days} ${days === 1 ? "Day" : "Days"}` : "Less than a day";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">Account</p>
        <h1 className="font-display text-3xl font-semibold">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your FocusFlow AI account at a glance.
        </p>
      </header>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Profile details
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          <Row icon={User} label="Name" value={fullName} />
          <Row icon={Mail} label="Email" value={email} mono />
          <Row icon={CalendarDays} label="Member Since" value={memberSinceLabel} />
          <Row icon={Sparkles} label="Using FocusFlow AI For" value={daysLabel} />
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain a number.";
  return null;
}

function ChangePasswordCard() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pwError = validatePassword(password);
    if (pwError) { toast.error(pwError); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      setPassword(""); setConfirm("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Change password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">New password</span>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={8} autoComplete="new-password"
              className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Confirm new password</span>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••" required minLength={8} autoComplete="new-password"
              className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Use 8+ characters with upper, lower case and a number.
          </p>
          <button disabled={loading} className="rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

function Row({
  icon: Icon, label, value, mono,
}: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface/60 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`mt-1 text-base text-foreground ${mono ? "font-mono break-all" : "font-medium"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
