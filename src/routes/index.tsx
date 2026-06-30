import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Sparkles, Target, Zap, LineChart, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FocusFlow AI, Personal Growth Intelligence Platform" },
      { name: "description", content: "Log your day, get an AI productivity score, build your Productivity DNA, and track personal growth with AI-powered insights." },
      { property: "og:title", content: "FocusFlow AI" },
      { property: "og:description", content: "Transform daily activities into actionable personal growth intelligence." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">FocusFlow<span className="text-primary"> AI</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/auth" className="rounded-full bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">Get started</Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-24 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Powered by FocusFlow Intelligence Engine
        </div>
        <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Your day, decoded into <span className="text-gradient">focus</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
          Log your day in seconds. FocusFlow AI scores your productivity, builds your Productivity DNA,
          predicts your growth, and turns your habits into a personal evolution timeline.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" className="group rounded-full bg-gradient-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow transition hover:scale-[1.02]">
            Start your first day →
          </Link>
          <a href="#how" className="rounded-full border border-border px-6 py-3 text-sm">How it works</a>
        </div>

        <div className="relative mx-auto mt-20 max-w-4xl">
          <div className="absolute -inset-x-10 -top-10 h-64 bg-gradient-primary opacity-20 blur-3xl" />
          <div className="glass-strong relative grid gap-4 rounded-3xl p-6 text-left md:grid-cols-3">
            <div className="md:col-span-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">FocusFlow Score</p>
              <p className="mt-2 font-display text-6xl font-semibold text-gradient">82</p>
              <p className="mt-1 text-xs text-success">+9 vs last week</p>
            </div>
            <Stat label="Deep Work" value="6.4h" />
            <Stat label="Distractions" value="38m" tone="warn" />
            <Stat label="Learning" value="4.2h" />
            <Stat label="Fitness" value="2.0h" />
            <Stat label="Streak" value="11 days" tone="primary" />
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-center font-display text-3xl font-semibold">An intelligence layer for your time</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Feature icon={Zap} title="One-tap logging" desc="Log activity name, hours, and date. Saving never depends on AI." />
          <Feature icon={Brain} title="Productivity DNA" desc="AI-generated identity based on 30 days of your behavior: Deep Learner, Focused Builder, and more." />
          <Feature icon={LineChart} title="FocusFlow Score" desc="A proprietary blend of productivity, consistency, focus and wellness, not a vanity metric." />
          <Feature icon={Target} title="Goals & streaks" desc="Targets that auto-track from your activities. Streaks that reward what matters." />
          <Feature icon={MessageSquare} title="AI Coach" desc="A coach grounded in your actual data, not motivational quotes. Ask why your week dipped." />
          <Feature icon={Sparkles} title="Reports & exports" desc="Weekly, monthly, and annual reports with downloadable PDF and PNG share cards." />
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Developed by Pranav M
      </footer>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "primary" }) {
  const cls = tone === "warn" ? "text-warning" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold ${cls}`}>{value}</p>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="glass group rounded-2xl p-6 transition hover:-translate-y-1">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
        <Icon className="h-5 w-5 text-primary-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
