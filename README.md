# FocusFlow AI

An AI-powered productivity platform that turns the way you actually spend your time into goals, habits, insights and a personal growth story.

Built with **React 19**, **TypeScript**, **TanStack Start**, **Tailwind CSS v4**, **Supabase** (Auth + Postgres with RLS) and the **Vercel AI SDK**. Ships standalone — no Lovable runtime required.

---

## Features

- **Authentication** — email / password sign‑up, email verification, sign‑in, forgot password, password reset with strength rules (8+ chars, upper, lower, number).
- **Dashboard** — live activity scoring, focus minutes, streaks, top categories.
- **Goals** — semantic‑relevance based progress (activities are matched to goals by meaning, not just category).
- **Habits** — daily/weekly cadences, streaks, completion history.
- **Tasks** — quick capture, scheduling, status tracking.
- **Calendar / Timeline** — chronological log of activities and events.
- **Activity Log** — manual + automatic logging with hours/minutes input.
- **Emotions** — mood tracking attached to activities and time blocks.
- **Insights** — AI‑generated weekly/monthly summaries.
- **Coach** — conversational AI coach with full user context.
- **DNA** — AI‑built personality / focus profile.
- **Story** — narrative recap of your progress.
- **Wrapped** — year‑in‑review.
- **Simulator** — "what‑if" scenarios for time allocation.
- **Downloads** — export Dashboard, DNA, Story etc. to **PNG / JPG / PDF**.
- **Mobile‑first** — fully responsive 320 → 1440 px.

---

## Technology Stack

| Layer        | Tech |
| ------------ | ---- |
| Framework    | TanStack Start v1 (file‑based routes, server functions) |
| UI           | React 19, Tailwind CSS v4, shadcn/ui, Radix primitives |
| Build        | Vite 7, Nitro 3 (Vercel preset) |
| Data         | Supabase (Postgres + Auth + RLS) |
| AI           | Vercel AI SDK + OpenAI‑compatible gateway (Gemini models) |
| Charts       | Recharts |
| Exports      | html2canvas-pro, jsPDF |
| Lang         | TypeScript (strict) |
| Package mgr  | Bun |

---

## Folder Structure

```
focusflow-ai/
├── src/
│   ├── routes/                      # File-based routes (TanStack)
│   │   ├── __root.tsx               # Root layout / <head>
│   │   ├── index.tsx                # Landing
│   │   ├── auth.tsx                 # Sign in / Sign up / Forgot
│   │   ├── auth.callback.tsx        # Email-link callback
│   │   ├── reset-password.tsx       # Password reset
│   │   └── _authenticated/          # Auth-gated subtree
│   │       ├── dashboard.tsx
│   │       ├── goals.tsx
│   │       ├── habits.tsx
│   │       ├── tasks.tsx
│   │       ├── calendar.tsx
│   │       ├── timeline.tsx
│   │       ├── log.tsx
│   │       ├── emotions.tsx
│   │       ├── insights.tsx
│   │       ├── coach.tsx
│   │       ├── dna.tsx
│   │       ├── story.tsx
│   │       ├── wrapped.tsx
│   │       ├── simulator.tsx
│   │       └── settings.tsx
│   ├── components/                  # UI components (AppShell, inputs, shadcn/ui)
│   ├── hooks/                       # use-mobile, use-theme, ...
│   ├── integrations/supabase/       # client, admin client, auth middleware
│   ├── lib/                         # server functions, scoring, downloads, site-url
│   ├── styles.css                   # Tailwind v4 entry
│   ├── router.tsx
│   ├── start.ts
│   └── server.ts
├── supabase/
│   ├── config.toml
│   └── migrations/                  # SQL migrations (schema + RLS + grants)
├── public/                          # Static assets
├── package.json
├── bun.lock
├── tsconfig.json
├── vite.config.ts
├── components.json
└── .env.example
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

### Required (minimum to run)

| Variable | Where | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Supabase anon / publishable key. |
| `VITE_SITE_URL` | Browser (build) | Canonical public URL used in auth email redirects, e.g. `https://focus-flow-ai-70.vercel.app`. Must be allow‑listed in Supabase Auth. |

### Required for server functions & SSR

| Variable | Where | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Server | Same value as `VITE_SUPABASE_URL`. |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Same value as `VITE_SUPABASE_PUBLISHABLE_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (secret) | Service‑role key — bypasses RLS. Never expose to the browser. |
| `VITE_SUPABASE_PROJECT_ID` | Browser (build) | Project ref, used for the auth storage key. |

### Optional — AI features (Coach, DNA, Story, Insights, Growth)

| Variable | Description |
| --- | --- |
| `LOVABLE_API_KEY` | API key for the AI gateway used by AI features. If unset, AI routes return an error but the rest of the app works. |

> All `VITE_*` variables are inlined into the client bundle at **build time** — they must be set in Vercel **before** the build runs.

---

## Local Development

```bash
bun install
cp .env.example .env       # then fill the values
bun run dev                # http://localhost:8080
```

Type‑check and build:

```bash
bunx tsgo --noEmit
bun run build              # outputs .vercel/output/ (Vercel Build Output v3)
```

---

## Supabase Setup

1. **Create a project** at https://supabase.com.
2. **Apply migrations** — run every SQL file in `supabase/migrations/` (in filename order) against your database, either with:
   ```bash
   supabase db push
   ```
   or by pasting each file into the SQL editor.
3. **Auth → URL Configuration**
   - **Site URL**: `https://focus-flow-ai-70.vercel.app` (or your domain)
   - **Redirect URLs (allow‑list)** — add all of:
     - `https://focus-flow-ai-70.vercel.app/**`
     - `https://focus-flow-ai-70.vercel.app/auth/callback`
     - `https://focus-flow-ai-70.vercel.app/reset-password`
     - `http://localhost:8080/**` (for local dev)
4. **Auth → Email Templates**
   - Confirm signup, magic link, reset password — each must use `{{ .ConfirmationURL }}` so the redirect comes from your configured Site URL.
5. **Auth → SMTP (strongly recommended)**
   - Supabase's built‑in email sender is heavily rate‑limited and may silently drop verification emails. Configure a custom SMTP provider (Resend, SendGrid, Postmark, AWS SES) for reliable delivery.
6. **Auth → Providers → Email**
   - Enable "Confirm email" if you want verification required before sign‑in.

---

## Authentication Flow

- **Sign up** → user submits email + password (8+ chars, upper, lower, number) → Supabase sends verification email pointing at `${VITE_SITE_URL}/auth/callback`.
- **Verification** → `/auth/callback` exchanges the code (PKCE) or hash tokens for a session and redirects to `/dashboard`.
- **Forgot password** → user submits email → Supabase sends reset email pointing at `${VITE_SITE_URL}/reset-password`.
- **Reset** → `/reset-password` exchanges the code, then calls `supabase.auth.updateUser({ password })`.
- **Protected routes** → everything under `src/routes/_authenticated/` is gated by `route.tsx`, which redirects unauthenticated users to `/auth`.

Site‑URL resolution (`src/lib/site-url.ts`) order:
1. `VITE_SITE_URL` env var.
2. `window.location.origin` — **only if** it is not a Lovable preview domain.
3. Hardcoded production fallback `https://focus-flow-ai-70.vercel.app`.

This guarantees auth emails never link back to a preview domain.

---

## Production Deployment on Vercel

1. Push the repo to GitHub.
2. In Vercel, **Add New Project** and import the repo. No framework preset override needed — Vercel detects `.vercel/output/` from the Nitro build.
3. **Project Settings → Environment Variables** — add every variable from the table above for **Production** (and optionally Preview / Development). `VITE_*` values must exist **before** the first build.
4. Deploy. Vercel runs `bun run build` and serves the function + static assets in one shot.
5. After the first deploy, update Supabase **Site URL** and **Redirect URLs** to match the final Vercel domain (or your custom domain).

To target a different host instead of Vercel, set `NITRO_PRESET` (e.g. `node-server`, `cloudflare-module`).

---

## Known Limitations

- **AI features require `LOVABLE_API_KEY`** — without it, Coach / DNA / Story / Insights / Growth return errors; the rest of the app is fully functional.
- **Supabase email rate limits** — the built‑in sender is fine for testing but not production. Configure custom SMTP.
- **Server runtime** — server functions run on the Vercel edge / Node serverless runtime. Heavy native deps (sharp, puppeteer, child_process) are not supported; exports use pure‑JS html2canvas‑pro + jsPDF on the client instead.

---

## License

Proprietary — © FocusFlow AI. All rights reserved.
