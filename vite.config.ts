import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import path from "node:path";

// Vercel-targeted build for TanStack Start.
// - On Vercel (VERCEL=1 in their build env) we emit `.vercel/output` via the `vercel` preset.
// - Everywhere else (Lovable preview/publish, local builds) we emit `dist/` via the
//   `cloudflare-module` preset, which matches what Lovable's pipeline expects.
// - Set `NITRO_PRESET` to override (e.g. "vercel-edge", "node-server").
const nitroPreset =
  process.env.NITRO_PRESET || (process.env.VERCEL ? "vercel" : "cloudflare-module");

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  server: {
    host: "::",
    port: 8080,
  },
  preview: {
    host: "::",
    port: 8080,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
    }),
    nitro({
      preset: nitroPreset,
      // Lovable's pipeline expects build output at `dist/`. The `vercel` preset
      // ignores this and writes to `.vercel/output` (Build Output API v3).
      ...(nitroPreset === "vercel" ? {} : { output: { dir: "dist" } }),
    }),
    react(),
  ],
});
