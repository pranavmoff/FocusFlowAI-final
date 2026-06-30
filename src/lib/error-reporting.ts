// Deployment-independent error reporting hook. No-op by default; replace
// with Sentry/PostHog/etc. when needed. Kept as a stable import so future
// providers can be swapped in without touching every error boundary.
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof console !== "undefined") {
    console.error("[error]", error, context);
  }
}