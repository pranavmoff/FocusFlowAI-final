// Canonical production URL for FocusFlow AI. This is the destination for
// Supabase auth emails (verification + password reset). It must match an
// entry in your Supabase Auth "Site URL" + "Redirect URLs" allow-list.
//
// Resolution order:
//   1. VITE_SITE_URL env var (if set at build time)
//   2. PRODUCTION_SITE_URL constant below (hardcoded fallback)
//   3. window.location.origin — only when it is NOT a Lovable preview
//      domain. This prevents reset / verification emails from sending
//      users back to id-preview--*.lovable.app after the project is
//      deployed standalone.
const PRODUCTION_SITE_URL = "https://focus-flow-ai-final.vercel.app/";

const ENV_SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "";

function isLovablePreviewOrigin(origin: string): boolean {
  return /\.lovable(?:\.app|\.dev|project\.com)$/i.test(new URL(origin).hostname);
}

export function getSiteUrl(): string {
  if (ENV_SITE_URL) return ENV_SITE_URL;
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, "");
    if (!isLovablePreviewOrigin(origin)) return origin;
  }
  return PRODUCTION_SITE_URL;
}

export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}

export function getPasswordResetUrl(): string {
  return `${getSiteUrl()}/reset-password`;
}

// Back-compat exports
export const SITE_URL = ENV_SITE_URL || PRODUCTION_SITE_URL;
export const AUTH_CALLBACK_URL = `${SITE_URL}/auth/callback`;
