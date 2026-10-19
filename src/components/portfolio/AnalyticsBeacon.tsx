import { useEffect } from "react";
import { useSiteSettings } from "@/hooks/use-content";

/**
 * Cloudflare Web Analytics beacon — injected only when the owner sets an
 * analytics token in /admin. Zero cost when off; excluded from admin by
 * placement (rendered on the public index route only).
 */
export function AnalyticsBeacon() {
  const { settings } = useSiteSettings();
  const token = (settings.analytics_token ?? "").trim();

  useEffect(() => {
    if (!token) return;
    const existing = document.querySelector<HTMLScriptElement>("script[data-cf-beacon]");
    // Re-inject whenever the token changes so a stale beacon doesn't linger and
    // double-count under the previous token.
    if (existing?.getAttribute("data-cf-beacon")?.includes(token)) return;
    existing?.remove();
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token }));
    document.head.appendChild(s);
    return () => {
      s.remove();
    };
  }, [token]);

  return null;
}
