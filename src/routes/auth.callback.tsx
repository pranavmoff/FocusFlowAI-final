import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing you in , FocusFlow AI" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      try {
        const url = new URL(window.location.href);

        // Detect recovery links and hand them off to /reset-password so the
        // user can choose a new password instead of being silently signed in.
        const isRecovery =
          url.searchParams.get("type") === "recovery" ||
          window.location.hash.includes("type=recovery");
        if (isRecovery) {
          const search = url.search + (url.search ? "&" : "?") + "from=callback";
          window.location.replace(`/reset-password${search}${window.location.hash}`);
          return;
        }

        // 1) PKCE / code exchange flow: ?code=...
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        } else if (window.location.hash.includes("access_token")) {
          // 2) Implicit flow: tokens arrive in the URL hash fragment
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
        }

        // Clean the URL so tokens don't linger in history
        window.history.replaceState({}, document.title, "/auth/callback");

        const { data } = await supabase.auth.getUser();
        if (cancelled) return;

        if (data.user) {
          toast.success("Email verified. Welcome to FocusFlow.");
          navigate({ to: "/dashboard" });
        } else {
          setMessage("Session not found. Redirecting to sign in…");
          navigate({ to: "/auth" });
        }
      } catch (err: any) {
        console.error("Auth callback error:", err);
        toast.error(err?.message ?? "Could not complete sign in");
        navigate({ to: "/auth" });
      }
    }

    complete();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="glass-strong rounded-3xl px-10 py-12 text-center">
        <p className="text-sm font-medium tracking-widest text-muted-foreground">FocusFlow AI</p>
        <h1 className="mt-3 text-2xl font-semibold">{message}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Hang tight, this only takes a moment.</p>
      </div>
    </div>
  );
}
