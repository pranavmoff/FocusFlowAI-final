import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthCallbackUrl, getPasswordResetUrl } from "@/lib/site-url";
import { Brain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in , FocusFlow AI" }] }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email first. Check your inbox.";
  if (m.includes("user already registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("password should be")) return message; // pass through password policy messages
  return message || "Something went wrong. Please try again.";
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain a number.";
  return null;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce to dashboard
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }: { data: { user: unknown } }) => {
      if (!cancelled && data.user) navigate({ to: "/dashboard" });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard" });
        return;
      }

      if (mode === "signup") {
        const pwError = validatePassword(password);
        if (pwError) { toast.error(pwError); return; }
        if (password !== confirmPassword) { toast.error("Passwords do not match."); return; }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;

        // If email confirmation is disabled, Supabase returns a session immediately
        if (data.session) {
          toast.success("Account created. Welcome to FocusFlow.");
          navigate({ to: "/dashboard" });
        } else {
          toast.success("Check your email to verify your account.");
          setMode("signin");
        }
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getPasswordResetUrl(),
        });
        if (error) throw error;
        toast.success("Password reset email sent. Check your inbox.");
        setMode("signin");
        return;
      }
    } catch (err: any) {
      toast.error(friendlyAuthError(err?.message ?? ""));
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
          {mode !== "forgot" && (
            <div className="flex gap-1 rounded-full bg-muted/50 p-1 text-sm">
              <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded-full py-2 ${mode === "signin" ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>Sign in</button>
              <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-full py-2 ${mode === "signup" ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>Create account</button>
            </div>
          )}

          {mode === "forgot" && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Reset your password</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter your account email and we'll send you a reset link.</p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field label="Name" value={name} onChange={setName} placeholder="Your name" />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@domain.com" required autoComplete="email" />
            {mode !== "forgot" && (
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
                minLength={mode === "signup" ? 8 : 6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            )}
            {mode === "signup" && (
              <Field
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            )}
            {mode === "signup" && (
              <p className="text-[11px] text-muted-foreground">
                Use 8+ characters with upper, lower case and a number.
              </p>
            )}
            <button disabled={loading} className="w-full rounded-full bg-gradient-primary py-3 font-medium text-primary-foreground shadow-glow disabled:opacity-60">
              {loading ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            {mode === "signin" ? (
              <button type="button" onClick={() => setMode("forgot")} className="hover:text-foreground underline-offset-4 hover:underline">
                Forgot password?
              </button>
            ) : <span />}
            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("signin")} className="hover:text-foreground underline-offset-4 hover:underline">
                Back to sign in
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing you agree to FocusFlow AI's privacy-first usage of your activity data.
          </p>
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
