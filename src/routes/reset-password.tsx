import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password , FocusFlow AI" }] }),
  component: ResetPasswordPage,
});

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain a number.";
  return null;
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Supabase's recovery link delivers the user here. Depending on the
  // project config the URL contains either a `?code=` (PKCE) or a hash
  // fragment with access/refresh tokens. Establish the session before
  // calling updateUser.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        } else if (window.location.hash.includes("access_token")) {
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
        }
        // Strip tokens from the URL
        window.history.replaceState({}, document.title, "/reset-password");

        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setHasSession(!!data.user);
      } catch (err: any) {
        console.error("Reset init error:", err);
        toast.error(err?.message ?? "This reset link is invalid or expired.");
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pwError = validatePassword(password);
    if (pwError) { toast.error(pwError); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold">FocusFlow<span className="text-primary"> AI</span></span>
        </Link>
        <div className="glass-strong rounded-3xl p-8">
          <h1 className="text-lg font-semibold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready
              ? hasSession
                ? "Choose a strong new password to finish resetting."
                : "This link is invalid or has expired. Request a new one from sign in."
              : "Verifying your reset link…"}
          </p>

          {ready && hasSession && (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field
                label="New password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <Field
                label="Confirm new password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">
                Use 8+ characters with upper, lower case and a number.
              </p>
              <button disabled={loading} className="w-full rounded-full bg-gradient-primary py-3 font-medium text-primary-foreground shadow-glow disabled:opacity-60">
                {loading ? "…" : "Update password"}
              </button>
            </form>
          )}

          {ready && !hasSession && (
            <Link to="/auth" className="mt-6 inline-flex w-full justify-center rounded-full bg-gradient-primary py-3 text-sm font-medium text-primary-foreground">
              Back to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required, minLength, autoComplete }: any) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} minLength={minLength} autoComplete={autoComplete}
        className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}