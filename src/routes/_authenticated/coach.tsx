import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { coachChat } from "@/lib/coach.functions";
import { Loader2, Send, Sparkles, Bot, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "AI Coach , FocusFlow AI" }] }),
  component: Coach,
});

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "Why was my productivity low this week?",
  "What's my biggest distraction?",
  "What should I focus on tomorrow?",
  "How do I improve my FocusFlow score?",
];

function Coach() {
  const chat = useServerFn(coachChat);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey , I'm your FocusFlow coach. I've read your last 30 days of activity. Ask me anything about your focus, distractions, or how to level up." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim()) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const r = await chat({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: "I hit an error. Try again in a moment." }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-3xl flex-col pb-20 md:pb-0">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">AI Coach</p>
        <h1 className="font-display text-3xl font-semibold">Grounded in your data</h1>
      </div>

      <div className="glass flex-1 overflow-y-auto rounded-3xl p-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.role === "user" ? "bg-surface-strong" : "bg-gradient-primary"}`}>
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary-foreground" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-surface-strong" : "bg-surface/60"}`}>
                <p className="whitespace-pre-line">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-primary"><Bot className="h-4 w-4 text-primary-foreground" /></div>
              <div className="rounded-2xl bg-surface/60 px-4 py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-surface/50 px-3 py-1.5 text-xs hover:bg-surface">
              <Sparkles className="mr-1 inline h-3 w-3 text-primary" />{s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about your week…" disabled={loading}
          className="flex-1 rounded-full border border-border bg-surface/60 px-5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring" />
        <button disabled={loading || !input.trim()} className="grid h-12 w-12 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
